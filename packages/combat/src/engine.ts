import type { BattleParty, BossObjective, ContinuousModifier, EffectOp, Element, Encounter, EventHook, HookEvent, Predicate, RulesDef, SkillDef, StatusDef, TargetSelector, UnitDef, UnitPack } from '@uomd/content-schema';
import { Rng } from '@uomd/shared';
import {
  IllegalActionError,
  type BattleEvent,
  type BattleResult,
  type BossModifier,
  type Combatant,
  type PlayerAction,
  type Row,
  type Side,
  type SkillOption,
  type StatKey,
  type StatusInstance,
  type StepResult,
  type TurnPrompt
} from './types';

/** Safety net: a battle that is still undecided after this many turns is lost by the player. */
export const MAX_TURNS = 300;

/**
 * Casualty-based victory star rating:
 * - 5+ unit parties: 4+ defeated = 1★, 3 defeated = 2★, 0–2 defeated = 3★
 * - 4-unit parties:  3 defeated = 1★, 2 defeated = 2★, 0–1 defeated = 3★
 * - 3-unit parties:  2 defeated = 1★, 1 defeated = 2★, 0 defeated = 3★
 * - 1–2 unit parties: 1 defeated = 2★, 0 defeated = 3★
 */
export function computeVictoryStars(startingPlayers: number, defeated: number): 1 | 2 | 3 {
  if (startingPlayers >= 5) {
    return defeated >= 4 ? 1 : defeated === 3 ? 2 : 3;
  }
  if (startingPlayers === 4) {
    return defeated >= 3 ? 1 : defeated === 2 ? 2 : 3;
  }
  if (startingPlayers === 3) {
    return defeated >= 2 ? 1 : defeated === 1 ? 2 : 3;
  }
  return defeated === 0 ? 3 : 2;
}

const roundHalfUp = (x: number): number => Math.floor(x + 0.5 + 1e-9);

type ActionKind = 'basic' | 'active' | 'ultimate' | 'signature';

/** One damage packet while it is being resolved; hooks and continuous modifiers scale it before it lands. */
interface Packet {
  source: Combatant;
  target: Combatant;
  outMult: number;
  inMult: number;
  blocked: boolean;
  /** null for counters, damage over time and shared damage. */
  actionKind: ActionKind | null;
}

interface Ctx {
  actor: Combatant;
  skill: SkillDef;
  chosen: Combatant | null;
  prev: Combatant[];
  lastTargets: Combatant[];
  removedStacks: number;
  /** the unit that caused the event (the attacker, the healer, the defeater) */
  eventSource: Combatant | null;
  /** the unit the event is about (the damaged / healed / defeated unit) */
  eventTarget: Combatant | null;
  eventActor: Combatant | null;
  inHook: boolean;
  /** true: no hook or continuous-modifier hook fires from effects in this context */
  suppressHooks: boolean;
  actionKind: ActionKind | null;
  actionId: number;
  primary: Combatant | null;
  packet: Packet | null;
  lastDamage: number;
  lastDamageTarget: Combatant | null;
  healed: Combatant[];
  /** opening guards that redirected this action's single-target hit: guard owner id -> damage multiplier */
  guarded: Map<string, number>;
  attackBonus: number | null;
  targetStatuses: string[];
}

interface HookInfo {
  actor: Combatant | null;
  target: Combatant | null;
  actionKind: ActionKind | null;
  actionId: number;
  packet: Packet | null;
  targetStatuses?: string[];
}

interface HookEntry {
  key: string;
  skill: SkillDef;
  hook: EventHook;
}

const ATTACK_KINDS: readonly ActionKind[] = ['basic', 'active', 'ultimate', 'signature'];

/**
 * Deterministic 5v5 turn-based battle core (rules: narrative battle_rules_part1.json, interpreted in
 * docs/COMBAT_RULES.md). No I/O, no clock, no globals: the same pack + encounter + seed + player
 * actions always produce the same event log, which is what lets the server re-simulate and accept
 * or reject a client-reported battle.
 */
export class Battle {
  readonly log: BattleEvent[] = [];
  readonly combatants: Combatant[] = [];
  private readonly rules: RulesDef;
  private readonly statusDefs = new Map<string, StatusDef>();
  private readonly rng: Rng;
  private statusSeq = 0;
  private actionSeq = 0;
  private readonly defs = new Map<string, UnitDef>();
  private round = 1;
  private readonly actedThisRound = new Set<string>();
  private readonly actionMarks = new Map<string, number>();
  private readonly hookCache = new WeakMap<UnitDef, { hooks: HookEntry[]; mods: ContinuousModifier[] }>();
  private turnCounter = 0;
  private current: Combatant | null = null;
  private outcome: BattleResult | null = null;
  private readonly startingPlayers: number;
  private readonly followUpWaves: Encounter['enemies'][];
  private readonly enemyStatMultiplier: Encounter['enemy_stat_multiplier'];
  private waveIndex = 0;

  private constructor(pack: UnitPack, encounter: Encounter, party?: BattleParty) {
    this.rules = pack.rules;
    for (const s of pack.rules.statuses) this.statusDefs.set(s.status_id, s);
    this.rng = new Rng(encounter.seed);
    for (const u of pack.units) this.defs.set(u.unit_id, u);
    this.followUpWaves = encounter.waves ?? [];
    this.enemyStatMultiplier = encounter.enemy_stat_multiplier;
    const defs = this.defs;
    const slotsSeen = new Set<string>();
    const add = (side: Side, e: Encounter['party'][number] & Partial<BattleParty[number]>): void => {
      const def = defs.get(e.unit_id);
      if (!def) throw new Error(`encounter references unknown unit ${e.unit_id}`);
      const key = `${side}:${e.slot}`;
      if (slotsSeen.has(key)) throw new Error(`duplicate slot ${key}`);
      slotsSeen.add(key);
      const c = this.makeCombatant(def, side, e.slot, e.row, e.level);
      if (side === 'player') this.applyPartyOverrides(c, e);
      else this.applyEnemyTuning(c, encounter.enemy_stat_multiplier);
      this.combatants.push(c);
    };
    const members = party ?? encounter.party;
    if (members.length === 0) throw new Error('a battle needs at least one player-side unit');
    for (const p of members) add('player', p);
    for (const e of encounter.enemies) add('enemy', e);
    this.startingPlayers = members.length;
    this.log.push({ type: 'battle_start', seed: encounter.seed });
    for (const c of [...this.combatants]) if (c.def.boss) this.initBoss(c);
  }

  /**
   * `party` (owned-hero battles) replaces the encounter's own player side; the server builds it from the player's team, so the
   * client can never choose stats, ranks or levels.
   */
  static create(pack: UnitPack, encounter: Encounter, party?: BattleParty): Battle {
    return new Battle(pack, encounter, party);
  }

  /** Server-computed final stats, skill ranks and opening Focus of a player-side unit. */
  private applyPartyOverrides(c: Combatant, m: Partial<BattleParty[number]>): void {
    if (m.stats) {
      c.maxHp = c.hp = Math.max(1, m.stats.hp);
      c.base.atk = m.stats.atk;
      c.base.def = m.stats.def;
      c.base.spd = Math.max(1, m.stats.spd);
      if (m.stats.res !== undefined) c.base.res = m.stats.res;
    }
    if (m.skill_ranks) c.skillRanks = { ...m.skill_ranks };
    if (m.equipment_effects) c.equipmentEffects = { ...m.equipment_effects };
    if (m.start_focus) c.focus = Math.min(this.rules.focus.maximum, m.start_focus);
  }

  private applyEnemyTuning(c: Combatant, tuning: Encounter['enemy_stat_multiplier']): void {
    if (!tuning) return;
    const k = tuning.value;
    if (tuning.applies_to.includes('hp')) c.maxHp = c.hp = Math.max(1, roundHalfUp(c.maxHp * k));
    if (tuning.applies_to.includes('atk')) c.base.atk = roundHalfUp(c.base.atk * k);
    if (tuning.applies_to.includes('def')) c.base.def = roundHalfUp(c.base.def * k);
    if (tuning.applies_to.includes('spd')) c.base.spd = Math.max(1, roundHalfUp(c.base.spd * k));
  }

  /** x(1 + bonus per rank above 1) for the damage / heal / shield amounts of the skill being executed. */
  private rankFactor(c: Combatant, skillId: string): number {
    const rank = c.skillRanks[skillId] ?? 1;
    return 1 + (this.rules.skill_rank_bonus ?? 0) * (rank - 1);
  }

  // ---------------------------------------------------------------- construction

  private makeCombatant(def: UnitDef, side: Side, slot: number, row: Row, level: number): Combatant {
    const grow = (k: 'hp' | 'atk' | 'def' | 'spd'): number => roundHalfUp(def.base_stats[k] + (def.growth_per_level?.[k] ?? 0) * (level - 1));
    const maxHp = Math.max(1, grow('hp'));
    const resBase = def.base_stats.res;
    return {
      id: `${side}:${slot}:${def.unit_id}`,
      def,
      side,
      slot,
      row,
      level,
      maxHp,
      hp: maxHp,
      base: {
        atk: grow('atk'),
        def: Math.max(0, grow('def')),
        res: resBase === undefined ? null : Math.max(0, roundHalfUp(resBase + (def.growth_per_level?.res ?? 0) * (level - 1))),
        spd: Math.max(1, grow('spd'))
      },
      gauge: 0,
      pendingDelay: 0,
      focus: 0,
      focusGainedThisTurn: 0,
      cooldowns: {},
      statuses: [],
      mods: [],
      shields: [],
      redirects: [],
      regens: [],
      reductions: [],
      openingGuard: null,
      counters: [],
      nextAttackBonus: null,
      acted: false,
      tookDamageThisRound: false,
      lastHealTarget: null,
      hookBattleCount: {},
      hookTurnCount: {},
      hookRoundCount: {},
      hookTargetCount: {},
      skillRanks: {},
      equipmentEffects: {},
      alive: true,
      boss: null,
      objective: null,
      weaknessOverride: null
    };
  }

  // ---------------------------------------------------------------- queries

  get result(): BattleResult | null {
    return this.outcome;
  }

  get wave(): number {
    return this.waveIndex + 1;
  }

  get totalWaves(): number {
    return 1 + this.followUpWaves.length;
  }

  unit(id: string): Combatant {
    const c = this.combatants.find((x) => x.id === id);
    if (!c) throw new Error(`unknown combatant ${id}`);
    return c;
  }

  living(side: Side): Combatant[] {
    return this.combatants.filter((c) => c.side === side && c.alive && !c.objective).sort((a, b) => a.slot - b.slot);
  }

  private opponents(c: Combatant): Combatant[] {
    return this.living(c.side === 'player' ? 'enemy' : 'player');
  }

  private allies(c: Combatant): Combatant[] {
    return this.living(c.side);
  }

  effStat(c: Combatant, stat: 'atk' | 'def' | 'spd' | 'res'): number {
    const baseVal = stat === 'res' ? (c.base.res ?? c.base.def) : c.base[stat];
    let flat = 0;
    let pct = 0;
    for (const m of c.mods) {
      if (m.stat !== stat) continue;
      if (m.mode === 'add_flat') flat += m.amount;
      else pct += m.amount;
    }
    pct += this.snapshotPct(c, stat);
    let value = (baseVal + flat) * (1 + pct);
    if (stat === 'def' || (stat === 'res' && c.base.res === null)) {
      for (const s of c.statuses) value *= this.statusDefs.get(s.statusId)?.def_multiplier ?? 1;
    }
    if (stat === 'res') {
      for (const s of c.statuses) value *= this.statusDefs.get(s.statusId)?.res_multiplier ?? 1;
    }
    const min = stat === 'spd' ? 1 : 0;
    return Math.max(min, roundHalfUp(value));
  }

  /** Effective hostile status resistance fraction in [0, 1]. */
  effEffectRes(c: Combatant): number {
    let pct = (c.def.effect_res ?? 0) + (c.equipmentEffects.effect_res_pct ?? 0);
    for (const m of c.mods) {
      if (m.stat === 'effect_res' && m.mode === 'add_pct') pct += m.amount;
    }
    return Math.max(0, Math.min(1, pct));
  }

  /** Effective per-element incoming damage multiplier (1 - resistance). */
  effElementResMult(target: Combatant, element: Element): number {
    let pct = (target.def.element_res?.[element] ?? 0) + (target.equipmentEffects.element_res_pct?.[element] ?? 0);
    if (element === 'Veil') {
      for (const m of target.mods) if (m.stat === 'veil_res' && m.mode === 'add_pct') pct += m.amount;
    }
    return Math.max(0, 1 - pct);
  }

  private statusProduct(c: Combatant, key: 'outgoing_damage_multiplier' | 'damage_taken_multiplier' | 'healing_received_multiplier' | 'focus_gain_multiplier'): number {
    let p = 1;
    for (const s of c.statuses) p *= this.statusDefs.get(s.statusId)?.[key] ?? 1;
    return p;
  }

  private shieldTotal(c: Combatant): number {
    return c.shields.reduce((n, s) => n + s.amount, 0);
  }

  private hasStatus(c: Combatant, id: string): boolean {
    return c.statuses.some((s) => s.statusId === id);
  }

  private hasTag(c: Combatant, tag: string): boolean {
    return c.statuses.some((s) => this.statusDefs.get(s.statusId)?.tags?.includes(tag));
  }

  private buffCount(c: Combatant): number {
    let n = c.statuses.filter((s) => this.statusDefs.get(s.statusId)?.category === 'buff').length;
    n += c.mods.filter((m) => m.amount > 0).length;
    n += c.shields.filter((s) => s.amount > 0).length;
    return n;
  }

  // ---------------------------------------------------------------- hooks and modifiers of a unit

  private rulesOf(u: Combatant): { hooks: HookEntry[]; mods: ContinuousModifier[] } {
    let r = this.hookCache.get(u.def);
    if (!r) {
      const hooks: HookEntry[] = [];
      const mods: ContinuousModifier[] = [];
      for (const skill of u.def.skills) {
        for (const [i, hook] of (skill.event_hooks ?? []).entries()) hooks.push({ key: `${skill.skill_id}:${i}`, skill, hook });
        mods.push(...(skill.continuous_modifiers ?? []));
      }
      const first = u.def.skills[0];
      if (first) for (const [i, hook] of (u.def.passive_hooks ?? []).entries()) hooks.push({ key: `unit:${i}`, skill: first, hook });
      mods.push(...(u.def.continuous_modifiers ?? []));
      r = { hooks, mods };
      this.hookCache.set(u.def, r);
    }
    return r;
  }

  /** Percent stat bonuses granted by living allies' always-on rules (e.g. Marek's Watchman's Rhythm). */
  private snapshotPct(c: Combatant, stat: 'atk' | 'def' | 'spd' | 'res'): number {
    let pct = 0;
    for (const u of this.combatants) {
      if (!u.alive || u.side !== c.side) continue;
      for (const m of this.rulesOf(u).mods) {
        if (m.event !== 'stat_snapshot' || m.stat_id !== stat) continue;
        const hit = m.target === 'self' ? u === c : m.target === 'all_allies' ? true : c.row === 'front';
        if (hit && this.holds(m.condition, this.bareCtx(u), u)) pct += m.amount;
      }
    }
    return pct;
  }

  /** Single-target attacks must pick a living front-row unit while one exists. */
  legalEnemyTargets(actor: Combatant): Combatant[] {
    const guard = this.guardOwner(actor);
    if (guard) return [guard];
    const opp = this.opponents(actor);
    const front = opp.filter((o) => o.row === 'front');
    const pool = front.length > 0 ? front : opp;
    const taunter = this.tauntSource(actor);
    if (taunter) return [taunter];
    // breakable objectives of the other side are always legal targets (they are never behind anyone)
    const objectives = this.combatants.filter((c) => c.alive && c.objective?.targetable && c.side !== actor.side);
    return [...pool, ...objectives];
  }

  /** An opposing unit whose opening guard has not yet caught this actor's first single-target attack. */
  private guardOwner(actor: Combatant): Combatant | null {
    return this.opponents(actor).find((c) => c.openingGuard !== null && c.openingGuard.roundsLeft > 0 && !c.openingGuard.used.includes(actor.id)) ?? null;
  }

  private tauntSource(actor: Combatant): Combatant | null {
    for (const s of actor.statuses) {
      if (this.statusDefs.get(s.statusId)?.redirects_single_target_attacks) {
        const src = this.combatants.find((c) => c.id === s.sourceId && c.alive && c.side !== actor.side);
        if (src) return src;
      }
    }
    return null;
  }

  private pickDefaultTarget(actor: Combatant): Combatant | null {
    const legal = this.legalEnemyTargets(actor).filter((c) => !c.objective);
    return [...legal].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.slot - b.slot || (a.id < b.id ? -1 : 1))[0] ?? null;
  }

  // ---------------------------------------------------------------- element math

  elementMultiplier(attackerElement: Element, target: Combatant): number {
    const el = this.rules.element;
    const t = target.def;
    if (target.objective) return el.neutral;
    if ((target.weaknessOverride ?? t.weaknesses)?.includes(attackerElement)) return el.weakness;
    if (t.resistances?.includes(attackerElement)) return el.resistance;
    for (const [a, b] of el.mutual_pairs) {
      if ((attackerElement === a && t.element === b) || (attackerElement === b && t.element === a)) return el.advantage;
    }
    const i = el.cycle.indexOf(attackerElement);
    const j = el.cycle.indexOf(t.element);
    if (i >= 0 && j >= 0) {
      if (j === (i + 1) % el.cycle.length) return el.advantage;
      if (i === (j + 1) % el.cycle.length) return el.disadvantage;
    }
    return el.neutral;
  }

  // ---------------------------------------------------------------- turn queue

  private threshold(c: Combatant): number {
    return this.rules.gauge_max + c.pendingDelay;
  }

  private pickNextActor(): Combatant {
    const live = this.combatants.filter((c) => c.alive && !c.objective);
    let minTicks = Infinity;
    for (const c of live) {
      const need = this.threshold(c) - c.gauge;
      const ticks = need <= 0 ? 0 : Math.ceil(need / this.effStat(c, 'spd'));
      if (ticks < minTicks) minTicks = ticks;
    }
    for (const c of live) c.gauge += minTicks * this.effStat(c, 'spd');
    const ready = live.filter((c) => c.gauge >= this.threshold(c));
    ready.sort((a, b) => {
      const oa = a.gauge - this.threshold(a);
      const ob = b.gauge - this.threshold(b);
      if (oa !== ob) return ob - oa;
      if (a.side !== b.side) return a.side === 'player' ? -1 : 1;
      if (a.slot !== b.slot) return a.slot - b.slot;
      return a.id < b.id ? -1 : 1;
    });
    const next = ready[0];
    if (!next) throw new Error('turn queue produced no ready actor');
    return next;
  }

  /** Previews the order of the next N actions without mutating state (for the turn-order bar). */
  previewOrder(count: number): string[] {
    const live = this.combatants.filter((c) => c.alive && !c.objective);
    const g = new Map(live.map((c) => [c.id, c.gauge]));
    const pending = new Map(live.map((c) => [c.id, c.pendingDelay]));
    const out: string[] = [];
    for (let n = 0; n < count; n++) {
      let minTicks = Infinity;
      for (const c of live) {
        const need = this.rules.gauge_max + (pending.get(c.id) ?? 0) - (g.get(c.id) ?? 0);
        const t = need <= 0 ? 0 : Math.ceil(need / this.effStat(c, 'spd'));
        if (t < minTicks) minTicks = t;
      }
      for (const c of live) g.set(c.id, (g.get(c.id) ?? 0) + minTicks * this.effStat(c, 'spd'));
      const ready = live
        .filter((c) => (g.get(c.id) ?? 0) >= this.rules.gauge_max + (pending.get(c.id) ?? 0))
        .sort((a, b) => {
          const oa = (g.get(a.id) ?? 0) - (this.rules.gauge_max + (pending.get(a.id) ?? 0));
          const ob = (g.get(b.id) ?? 0) - (this.rules.gauge_max + (pending.get(b.id) ?? 0));
          if (oa !== ob) return ob - oa;
          if (a.side !== b.side) return a.side === 'player' ? -1 : 1;
          if (a.slot !== b.slot) return a.slot - b.slot;
          return a.id < b.id ? -1 : 1;
        });
      const next = ready[0];
      if (!next) break;
      out.push(next.id);
      g.set(next.id, (g.get(next.id) ?? 0) - (this.rules.gauge_max + (pending.get(next.id) ?? 0)));
      pending.set(next.id, 0);
    }
    return out;
  }

  // ---------------------------------------------------------------- flow

  /** Runs automatic (enemy) turns until a player decision is required or the battle ends. */
  advance(): StepResult {
    const start = this.log.length;
    return this.runUntilInput(start);
  }

  /** Executes a player decision, then continues until the next decision or the end. */
  act(action: PlayerAction): StepResult {
    const start = this.log.length;
    const actor = this.current;
    if (!actor) throw new IllegalActionError('no player turn is pending');
    const skill = this.validate(actor, action);
    for (const c of this.combatants) if (c.alive && c.boss?.telegraph) c.boss.telegraph.actionsSeen++;
    this.executeSkill(actor, skill, skill.player_target !== 'none' ? this.unit(action.targetId as string) : null);
    this.finishTurn(actor);
    this.current = null;
    return this.runUntilInput(start);
  }

  /** Picks the action the Auto Battle policy would take for the pending player turn. */
  autoAction(): PlayerAction {
    const actor = this.current;
    if (!actor) throw new IllegalActionError('no player turn is pending');
    return this.chooseAuto(actor);
  }

  /** Enemy intent preview: the skill (and target when single-target) the enemy will use next. */
  intentFor(enemyId: string): { skillId: string; skillName: string; targetId: string | null; announced: boolean } | null {
    const c = this.unit(enemyId);
    if (!c.alive || c.side !== 'enemy' || c.objective) return null;
    // an announced boss intent is what the player must answer; otherwise the skill the enemy would pick now
    const pending = c.boss?.telegraph ? c.def.skills.find((k) => k.skill_id === c.boss?.telegraph?.skillId) : undefined;
    const skill = pending ?? this.chooseEnemySkill(c);
    if (!skill) return null;
    const sel = skill.effect_ops[0]?.target_selector_id;
    const target = sel === 'single_enemy' || sel === 'single_enemy_default' ? this.pickDefaultTarget(c) : null;
    return { skillId: skill.skill_id, skillName: skill.name_en, targetId: target?.id ?? null, announced: pending !== undefined };
  }

  prompt(): TurnPrompt | null {
    return this.current ? this.buildPrompt(this.current) : null;
  }

  private runUntilInput(start: number): StepResult {
    while (!this.outcome) {
      if (this.current) return this.step(start, this.buildPrompt(this.current));
      const actor = this.pickNextActor();
      this.turnCounter++;
      this.emit({ type: 'turn_start', actor: actor.id, turn: this.turnCounter });
      const expiredControl = this.beginTurn(actor);
      if (!actor.alive) {
        this.finishTurn(actor);
        continue;
      }
      const skipReason = this.consumeSkip(actor) ?? expiredControl;
      if (skipReason) {
        this.emit({ type: 'turn_skipped', actor: actor.id, reason: skipReason });
        const pending = actor.boss?.telegraph;
        if (pending && actor.boss) {
          const sk = actor.def.skills.find((k) => k.skill_id === pending.skillId);
          if (sk?.telegraph?.interruptible_by_control !== false) this.cancelTelegraph(actor, 'control');
        }
        this.finishTurn(actor);
        continue;
      }
      if (actor.side === 'player') {
        this.current = actor;
        continue;
      }
      if (actor.boss) this.bossAct(actor);
      else {
        const skill = this.chooseEnemySkill(actor);
        if (!skill) {
          this.emit({ type: 'turn_skipped', actor: actor.id, reason: 'no_usable_skill' });
        } else {
          const target = skill.player_target === 'enemy' ? this.pickDefaultTarget(actor) : null;
          this.executeSkill(actor, skill, target);
        }
      }
      this.finishTurn(actor);
    }
    return this.step(start, null);
  }

  private step(start: number, prompt: TurnPrompt | null): StepResult {
    return { events: this.log.slice(start), prompt, result: this.outcome };
  }

  private finishTurn(actor: Combatant): void {
    actor.gauge -= this.threshold(actor);
    actor.pendingDelay = 0;
    this.processTransitions();
    this.checkEnd();
    if (!this.outcome) this.trackRound(actor);
  }

  /**
   * A round ends once every unit that is alive has taken a turn since the last one ended. Round-scoped
   * rules (round_number_at_most, once-per-round hooks, "took no damage this round", opening guards) key off this.
   */
  private trackRound(actor: Combatant): void {
    this.actedThisRound.add(actor.id);
    if (!this.combatants.every((c) => !c.alive || c.objective || this.actedThisRound.has(c.id))) return;
    this.fire('after_round_end', { actor: null, target: null, actionKind: null, actionId: 0, packet: null });
    this.emit({ type: 'round_end', round: this.round });
    this.round++;
    this.actedThisRound.clear();
    for (const c of this.combatants) {
      c.tookDamageThisRound = false;
      c.hookRoundCount = {};
      if (c.openingGuard && --c.openingGuard.roundsLeft <= 0) c.openingGuard = null;
    }
  }

  private checkEnd(): void {
    if (this.outcome) return;
    const players = this.living('player');
    const enemies = this.living('enemy');
    if (enemies.length > 0 && players.length > 0 && this.turnCounter >= MAX_TURNS) {
      this.outcome = { winner: 'enemy', stars: 0, turns: this.turnCounter };
      this.emit({ type: 'battle_end', winner: 'enemy', stars: 0 });
      return;
    }
    if (enemies.length === 0 && players.length > 0 && this.waveIndex < this.followUpWaves.length) {
      this.spawnNextWave();
      return;
    }
    if (enemies.length === 0 || players.length === 0) {
      const winner: Side = enemies.length === 0 ? 'player' : 'enemy';
      let stars: 0 | 1 | 2 | 3 = 0;
      if (winner === 'player') {
        const defeated = this.startingPlayers - players.length;
        stars = computeVictoryStars(this.startingPlayers, defeated);
      }
      this.outcome = { winner, stars, turns: this.turnCounter };
      this.emit({ type: 'battle_end', winner, stars });
    }
  }

  private spawnNextWave(): void {
    const nextEnemies = this.followUpWaves[this.waveIndex];
    if (!nextEnemies) return;
    this.waveIndex++;
    for (let i = this.combatants.length - 1; i >= 0; i--) {
      if (this.combatants[i]?.side === 'enemy') this.combatants.splice(i, 1);
    }
    const spawned: Combatant[] = [];
    for (const e of nextEnemies) {
      const def = this.defs.get(e.unit_id);
      if (!def) throw new Error(`encounter wave references unknown unit ${e.unit_id}`);
      const c = this.makeCombatant(def, 'enemy', e.slot, e.row, e.level);
      this.applyEnemyTuning(c, this.enemyStatMultiplier);
      this.combatants.push(c);
      spawned.push(c);
    }
    this.emit({ type: 'wave_start', wave: this.waveIndex + 1 });
    for (const c of spawned) if (c.def.boss) this.initBoss(c);
  }

  private emit(e: BattleEvent): void {
    this.log.push(e);
  }

  // ---------------------------------------------------------------- turn start

  private beginTurn(actor: Combatant): string | null {
    let expiredControl: string | null = null;
    for (const k of Object.keys(actor.cooldowns)) {
      const v = actor.cooldowns[k] ?? 0;
      if (v > 0) actor.cooldowns[k] = v - 1;
    }
    // a damage-over-time status ticks once per turn it was alive for, including the turn it expires on
    const dots = actor.statuses.filter((s) => this.statusDefs.get(s.statusId)?.dot_atk_multiplier !== undefined).map((s) => ({ ...s }));
    for (const s of [...actor.statuses]) {
      s.turnsLeft -= 1;
      if (s.turnsLeft <= 0) {
        // A one-turn control still owes its next-action skip when its duration expires.
        if (this.statusDefs.get(s.statusId)?.skip_next_action) expiredControl = s.statusId;
        actor.statuses.splice(actor.statuses.indexOf(s), 1);
        this.emit({ type: 'status_removed', target: actor.id, status: s.statusId, reason: 'expired' });
      }
    }
    actor.mods = actor.mods.filter((m) => --m.turnsLeft > 0);
    actor.shields = actor.shields.filter((s) => --s.turnsLeft > 0);
    actor.reductions = actor.reductions.filter((r) => --r.turnsLeft > 0);
    for (const c of this.combatants) {
      c.redirects = c.redirects.filter((r) => (r.protectorId === actor.id ? --r.turnsLeft > 0 : true));
      // a counter armed by this unit lapses when its next turn begins
      c.counters = c.counters.filter((k) => k.ownerId !== actor.id);
    }
    actor.hookTurnCount = {};
    actor.focusGainedThisTurn = 0;
    for (const s of dots) {
      if (!actor.alive) break;
      const d = this.statusDefs.get(s.statusId);
      if (!d || d.dot_atk_multiplier === undefined) continue;
      this.receive(null, this.combatants.find((c) => c.id === s.sourceId) ?? actor, actor, Math.max(1, Math.floor((s.power ?? 0) * d.dot_atk_multiplier + 1e-9)), { dot: s.statusId });
    }
    for (const r of [...actor.regens]) {
      if (!actor.alive) break;
      r.turnsLeft -= 1;
      if (r.ticksLeft > 0) {
        r.ticksLeft -= 1;
        this.healUnit(this.combatants.find((c) => c.id === r.sourceId) ?? actor, actor, Math.floor(r.amount * this.statusProduct(actor, 'healing_received_multiplier')), null);
      }
      if (r.ticksLeft <= 0 || r.turnsLeft <= 0) actor.regens.splice(actor.regens.indexOf(r), 1);
    }
    if (actor.alive) this.fire('owner_turn_start', { actor, target: null, actionKind: null, actionId: 0, packet: null });
    return expiredControl;
  }

  private consumeSkip(actor: Combatant): string | null {
    const idx = actor.statuses.findIndex((s) => this.statusDefs.get(s.statusId)?.skip_next_action);
    if (idx < 0) return null;
    const [removed] = actor.statuses.splice(idx, 1);
    if (!removed) return null;
    this.emit({ type: 'status_removed', target: actor.id, status: removed.statusId, reason: 'expired' });
    return removed.statusId;
  }

  // ---------------------------------------------------------------- choosing

  private usable(actor: Combatant, skill: SkillDef): { ok: boolean; reason?: 'cooldown' | 'focus' } {
    if ((actor.cooldowns[skill.skill_id] ?? 0) > 0) return { ok: false, reason: 'cooldown' };
    if (actor.focus < skill.focus_cost) return { ok: false, reason: 'focus' };
    return { ok: true };
  }

  private chooseEnemySkill(actor: Combatant): SkillDef | null {
    const phaseId = actor.boss ? actor.def.boss?.phases[actor.boss.phase]?.phase_id : undefined;
    const candidates = actor.def.skills.filter((s) => s.type !== 'passive' && this.usable(actor, s).ok && (!s.phase_ids || (phaseId !== undefined && s.phase_ids.includes(phaseId))));
    candidates.sort((a, b) => b.ai_priority - a.ai_priority);
    return candidates[0] ?? null;
  }

  private buildPrompt(actor: Combatant): TurnPrompt {
    const options: SkillOption[] = actor.def.skills
      .filter((s) => s.type !== 'passive')
      .map((s) => {
        const u = this.usable(actor, s);
        const needsTarget = s.player_target !== 'none';
        const option: SkillOption = {
          skillId: s.skill_id,
          name: s.name_en,
          type: s.type,
          available: u.ok,
          cooldownLeft: actor.cooldowns[s.skill_id] ?? 0,
          needsTarget,
          legalTargets: s.player_target === 'enemy' ? this.legalEnemyTargets(actor).map((t) => t.id) : s.player_target === 'ally' ? this.allies(actor).map((t) => t.id) : [],
          def: s
        };
        if (u.reason) option.reason = u.reason;
        return option;
      });
    return { actor: actor.id, options };
  }

  private validate(actor: Combatant, action: PlayerAction): SkillDef {
    const skill = actor.def.skills.find((s) => s.skill_id === action.skillId);
    if (!skill || skill.type === 'passive') throw new IllegalActionError(`unit ${actor.id} cannot use ${action.skillId}`);
    const u = this.usable(actor, skill);
    if (!u.ok) throw new IllegalActionError(`skill ${skill.skill_id} unavailable: ${u.reason}`);
    if (skill.player_target !== 'none') {
      const legal = (skill.player_target === 'enemy' ? this.legalEnemyTargets(actor) : this.allies(actor)).map((t) => t.id);
      if (!action.targetId || !legal.includes(action.targetId)) throw new IllegalActionError(`illegal target ${action.targetId ?? '(none)'} for ${skill.skill_id}`);
    } else if (action.targetId !== undefined) {
      throw new IllegalActionError(`skill ${skill.skill_id} takes no target`);
    }
    return skill;
  }

  private chooseAuto(actor: Combatant): PlayerAction {
    const prompt = this.buildPrompt(actor);
    const ok = prompt.options.filter((o) => o.available);
    const target = (o: SkillOption): PlayerAction => {
      if (!o.needsTarget) return { skillId: o.skillId };
      const t = [...this.autoPool(o.legalTargets.map((id) => this.unit(id)))].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.slot - b.slot || (a.id < b.id ? -1 : 1))[0];
      if (!t) throw new IllegalActionError('no legal target');
      return { skillId: o.skillId, targetId: t.id };
    };
    const healer = ok.find((o) => o.type === 'active' && o.def.effect_ops.some((op) => op.op === 'heal'));
    const lowAlly = this.allies(actor).some((a) => a.hp / a.maxHp < this.rules.auto_battle.heal_priority_hp_percent / 100);
    if (healer && lowAlly) return target(healer);
    const ult = ok.find((o) => o.type === 'ultimate');
    if (ult && (!this.rules.auto_battle.save_ultimate_until_boss || this.opponents(actor).some((enemy) => enemy.boss !== null))) return target(ult);
    const active = ok.filter((o) => o.type === 'active').sort((a, b) => b.def.ai_priority - a.def.ai_priority)[0];
    if (active) return target(active);
    const basic = ok.find((o) => o.type === 'basic');
    if (!basic) throw new IllegalActionError('no usable skill');
    return target(basic);
  }

  // ---------------------------------------------------------------- execution

  private newCtx(actor: Combatant, skill: SkillDef, over: Partial<Ctx> = {}): Ctx {
    return {
      actor,
      skill,
      chosen: null,
      prev: [],
      lastTargets: [],
      removedStacks: 0,
      eventSource: null,
      eventTarget: null,
      eventActor: null,
      inHook: false,
      suppressHooks: false,
      actionKind: null,
      actionId: 0,
      primary: null,
      packet: null,
      lastDamage: 0,
      lastDamageTarget: null,
      healed: [],
      guarded: new Map(),
      attackBonus: null,
      targetStatuses: [],
      ...over
    };
  }

  /** A context with no action behind it, for evaluating always-on rules. */
  private bareCtx(owner: Combatant, over: Partial<Ctx> = {}): Ctx {
    return this.newCtx(owner, owner.def.skills[0] as SkillDef, over);
  }

  private executeSkill(actor: Combatant, skill: SkillDef, chosen: Combatant | null): void {
    const kind = skill.type === 'passive' ? null : (skill.type as ActionKind);
    if (!this.triggerCounters(actor)) return;
    actor.acted = true;
    const ctx = this.newCtx(actor, skill, { chosen, actionKind: kind, actionId: ++this.actionSeq });
    const attacks = skill.effect_ops.some((o) => o.op === 'damage');
    if (attacks && actor.nextAttackBonus !== null) {
      ctx.attackBonus = actor.nextAttackBonus;
      actor.nextAttackBonus = null;
    }
    const firstOp = skill.effect_ops[0];
    const shown = firstOp ? this.resolve(firstOp.target_selector_id, ctx, true) : [];
    this.emit({ type: 'skill_used', actor: actor.id, skill: skill.skill_id, skillType: skill.type, targets: shown.map((t) => t.id) });
    if (skill.type === 'ultimate') actor.focus = Math.max(0, actor.focus - skill.focus_cost);
    for (const op of skill.effect_ops) this.applyOp(op, ctx);
    if (skill.type === 'basic') this.addFocus(actor, this.rules.focus.basic_gain, true);
    else if (skill.type === 'active') this.addFocus(actor, this.rules.focus.active_gain, true);
    if (skill.cooldown_turns > 0) actor.cooldowns[skill.skill_id] = skill.cooldown_turns;
    if (kind && actor.alive) {
      const info: HookInfo = { actor, target: null, actionKind: kind, actionId: ctx.actionId, packet: null };
      this.fire('after_ally_action', info);
      if (kind === 'ultimate') this.fire('after_ally_ultimate', info);
    }
  }

  /** Counters armed on the acting unit fire before its action; false = it died to the counter. */
  private triggerCounters(actor: Combatant): boolean {
    for (const c of [...actor.counters]) {
      actor.counters.splice(actor.counters.indexOf(c), 1);
      const owner = this.combatants.find((u) => u.id === c.ownerId);
      if (!owner || !owner.alive) continue;
      const armedBy = owner.def.skills.find((k) => k.skill_id === c.skillId) ?? (owner.def.skills[0] as SkillDef);
      const cctx = this.newCtx(owner, armedBy, { inHook: true, suppressHooks: true, eventSource: actor, eventTarget: actor });
      this.applyOp(
        { op: 'damage', target_selector_id: 'event_source', damage_type: c.damageType, scale_stat: c.scaleStat, multiplier: c.multiplier, no_focus_gain: true },
        cctx
      );
      if (!actor.alive) return false;
    }
    return true;
  }

  private resolve(sel: TargetSelector, ctx: Ctx, peek = false): Combatant[] {
    const a = ctx.actor;
    const opp = (): Combatant[] => this.opponents(a);
    switch (sel) {
      case 'single_enemy': {
        const chosen = ctx.chosen;
        if (!chosen) return [];
        const taunter = this.tauntSource(a);
        const t = taunter ?? chosen;
        return t.alive ? [this.guarded(ctx, a, t, peek)] : [];
      }
      case 'single_enemy_default': {
        const t = this.pickDefaultTarget(a);
        return t ? [this.guarded(ctx, a, t, peek)] : [];
      }
      case 'all_enemies':
        return opp();
      case 'front_row_enemies':
        return opp().filter((c) => c.row === 'front');
      case 'rear_row_enemies':
        return opp().filter((c) => c.row === 'rear');
      case 'self':
        return a.alive ? [a] : [];
      case 'lowest_hp_ally':
        return this.byLowestHp(this.allies(a)).slice(0, 1);
      case 'lowest_hp_allies':
        return this.byLowestHp(this.allies(a));
      case 'self_and_lowest_hp_ally': {
        const other = this.byLowestHp(this.allies(a).filter((c) => c !== a))[0];
        return [...(a.alive ? [a] : []), ...(other ? [other] : [])];
      }
      case 'all_allies':
        return this.allies(a);
      case 'previous_op_targets':
        return ctx.prev.filter((c) => c.alive);
      case 'event_source':
        return ctx.eventSource && ctx.eventSource.alive ? [ctx.eventSource] : [];
      case 'event_target':
        return ctx.eventTarget && ctx.eventTarget.alive ? [ctx.eventTarget] : [];
      case 'selected_ally':
        return ctx.chosen && ctx.chosen.alive ? [ctx.chosen] : [];
      case 'last_heal_target': {
        const fromAction = ctx.healed.filter((c) => c.alive);
        if (fromAction.length > 0) return fromAction;
        const remembered = this.combatants.find((c) => c.id === a.lastHealTarget && c.alive);
        return remembered ? [remembered] : [];
      }
      case 'ally_with_lowest_focus':
        return [...this.allies(a)].sort((x, y) => x.focus - y.focus || x.slot - y.slot || (x.id < y.id ? -1 : 1)).slice(0, 1);
      case 'front_row_allies':
        return this.allies(a).filter((c) => c.row === 'front');
      case 'random_other_enemy': {
        if (peek) return [];
        const skip = ctx.primary ?? ctx.eventTarget;
        const pool = opp().filter((c) => c !== skip);
        if (pool.length === 0) return [];
        const pick = pool[Math.min(pool.length - 1, Math.floor(this.rng.next() * pool.length))];
        return pick ? [pick] : [];
      }
      case 'enemy_with_lowest_def':
        return [...opp()].sort((x, y) => this.effStat(x, 'def') - this.effStat(y, 'def') || x.slot - y.slot || (x.id < y.id ? -1 : 1)).slice(0, 1);
      case 'enemy_with_highest_atk':
        return [...opp()].sort((x, y) => this.effStat(y, 'atk') - this.effStat(x, 'atk') || x.slot - y.slot || (x.id < y.id ? -1 : 1)).slice(0, 1);
      case 'enemy_with_most_buffs': {
        const best = [...opp()].sort((x, y) => this.buffCount(y) - this.buffCount(x) || x.slot - y.slot || (x.id < y.id ? -1 : 1))[0];
        return best && this.buffCount(best) > 0 ? [best] : [];
      }
      case 'lowest_hp_enemy':
        return this.byLowestHp(opp()).slice(0, 1);
      // a row-bound pick falls back to the whole opposing side when that row is empty, so a skill is never wasted
      case 'lowest_hp_front_enemy': {
        const row = opp().filter((c) => c.row === 'front');
        return this.byLowestHp(row.length > 0 ? row : opp()).slice(0, 1);
      }
      case 'lowest_hp_rear_enemy': {
        const row = opp().filter((c) => c.row === 'rear');
        return this.byLowestHp(row.length > 0 ? row : opp()).slice(0, 1);
      }
      case 'all_enemy_allies':
        return this.allies(a);
      case 'lowest_hp_enemy_ally':
        return this.byLowestHp(this.allies(a).filter((c) => c !== a)).slice(0, 1);
      case 'boss': {
        const b = this.allies(a).find((c) => c.def.boss);
        return b ? [b] : [];
      }
      case 'duel_marked_enemy': {
        const marked = opp().filter((c) => this.hasStatus(c, 'duel_mark'));
        const t = marked[0] ?? this.pickDefaultTarget(a);
        return t ? [t] : [];
      }
      case 'self_and_enemy_guards':
      case 'boss_and_enemy_guards':
        return this.allies(a);
      case 'most_injured_enemy_ally':
        return [...this.allies(a).filter((c) => c !== a)].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp || x.slot - y.slot || (x.id < y.id ? -1 : 1)).slice(0, 1);
    }
  }

  /** Opening guards (Nara's ultimate) take over each enemy's first single-target attack and soften it. */
  private guarded(ctx: Ctx, attacker: Combatant, target: Combatant, peek: boolean): Combatant {
    const g = target.openingGuard;
    if (peek || target.side === attacker.side || !g || g.roundsLeft <= 0 || g.used.includes(attacker.id)) return target;
    g.used.push(attacker.id);
    ctx.guarded.set(target.id, g.mult);
    return target;
  }

  private byLowestHp(list: Combatant[]): Combatant[] {
    return [...list].sort((a, b) => a.hp - b.hp || a.slot - b.slot || (a.id < b.id ? -1 : 1));
  }

  private hasAnyBuff(c: Combatant): boolean {
    return this.buffCount(c) > 0;
  }

  private holds(pred: Predicate | undefined, ctx: Ctx, owner: Combatant): boolean {
    if (!pred) return true;
    if ('all' in pred) return pred.all.every((p) => this.holds(p, ctx, owner));
    if ('any' in pred) return pred.any.some((p) => this.holds(p, ctx, owner));
    const target = ctx.eventTarget;
    const hp = (c: Combatant): number => (c.hp / c.maxHp) * 100;
    switch (pred.predicate) {
      case 'last_target_has_status':
        return ctx.lastTargets.some((t) => this.hasStatus(t, pred.value));
      case 'owner_in_row':
        return owner.row === pred.value;
      case 'owner_hp_below_pct':
        return hp(owner) < pred.value;
      case 'owner_hp_above_pct':
        return hp(owner) > pred.value;
      case 'owner_has_shield':
        return this.shieldTotal(owner) > 0;
      case 'owner_has_status':
        return this.hasStatus(owner, pred.value);
      case 'owner_action_type':
        return (ctx.packet?.actionKind ?? ctx.actionKind) === pred.value;
      case 'owner_took_no_damage_this_round':
        return !owner.tookDamageThisRound;
      case 'target_has_status':
        return target !== null && this.hasStatus(target, pred.value);
      case 'target_has_status_tag':
        return target !== null && this.hasTag(target, pred.value);
      case 'target_has_any_status_tag':
        return target !== null && pred.value.split('_or_').some((tag) => this.hasTag(target, tag));
      case 'target_in_row':
        return target !== null && target.row === pred.value;
      case 'target_has_acted_this_battle':
        return target !== null && target.acted;
      case 'round_number_at_most':
        return this.round <= pred.value;
      case 'last_target_defeated':
        return ctx.lastTargets.some((t) => !t.alive);
      case 'last_primary_target_defeated':
        return ctx.primary !== null && !ctx.primary.alive;
      case 'event_target_hp_at_or_below_pct':
        return target !== null && hp(target) <= pred.value;
      case 'event_target_had_status':
        return ctx.targetStatuses.includes(pred.value);
      case 'event_actor_has_any_buff':
        return ctx.eventActor !== null && this.hasAnyBuff(ctx.eventActor);
      case 'enemy_ally_hp_below_pct':
        return this.allies(owner).some((c) => c !== owner && hp(c) < pred.value);
      case 'no_enemy_ally_below_pct':
        return !this.allies(owner).some((c) => c !== owner && hp(c) < pred.value);
      case 'damage_dealt_at_least_pct_of_target_hp':
        return ctx.lastDamageTarget !== null && ctx.lastDamage >= (ctx.lastDamageTarget.maxHp * pred.value) / 100;
      case 'count_enemies_with_status':
        return this.predicateCount(pred, ctx, owner) > 0;
    }
  }

  /** How many units a counting predicate matches (any other predicate: 1 when it holds). */
  private predicateCount(pred: Predicate, ctx: Ctx, owner: Combatant): number {
    if (!('predicate' in pred)) return this.holds(pred, ctx, owner) ? 1 : 0;
    if (pred.predicate === 'count_enemies_with_status') return this.opponents(owner).filter((c) => this.hasStatus(c, pred.value)).length;
    return this.holds(pred, ctx, owner) ? 1 : 0;
  }

  private scale(c: Combatant, stat: 'atk' | 'def' | 'hp'): number {
    return stat === 'hp' ? c.maxHp : this.effStat(c, stat);
  }

  private applyOp(op: EffectOp, ctx: Ctx): void {
    if (!this.holds(op.when, ctx, ctx.actor)) return;
    const targets = this.resolve(op.target_selector_id, ctx);
    switch (op.op) {
      case 'damage': {
        const element: Element = ctx.skill.element ?? ctx.actor.def.element;
        const single = op.target_selector_id === 'single_enemy' || op.target_selector_id === 'single_enemy_default';
        if (!ctx.primary && targets[0]) ctx.primary = targets[0];
        for (const t of targets) for (let h = 0; h < (op.hit_count ?? 1); h++) this.dealDamage(ctx, t, op, element, single);
        ctx.lastTargets = targets;
        break;
      }
      case 'heal': {
        for (const t of targets) {
          const raw = Math.floor(this.scale(ctx.actor, op.scale_stat) * op.multiplier * this.rankFactor(ctx.actor, ctx.skill.skill_id));
          this.healUnit(ctx.actor, t, Math.max(1, Math.floor(raw * this.statusProduct(t, 'healing_received_multiplier'))), ctx);
        }
        break;
      }
      case 'apply_status': {
        const statusDef = this.statusDefs.get(op.status_id);
        const isHostile = statusDef !== undefined && statusDef.category !== 'buff';
        for (const t of targets) {
          const effRes = isHostile ? this.effEffectRes(t) : 0;
          if (op.chance !== undefined) {
            const effectiveChance = op.chance * (1 - effRes);
            if (this.rng.next() >= effectiveChance) {
              if (effRes > 0) this.emit({ type: 'status_resisted', source: ctx.actor.id, target: t.id, status: op.status_id });
              continue;
            }
          } else if (effRes > 0) {
            if (this.rng.next() < effRes) {
              this.emit({ type: 'status_resisted', source: ctx.actor.id, target: t.id, status: op.status_id });
              continue;
            }
          }
          this.applyStatus(ctx.actor, t, op.status_id, op.duration_turns, op.shared_damage_fraction);
        }
        break;
      }
      case 'remove_status': {
        for (const t of targets) {
          for (let n = 0; n < op.count; n++) {
            const cands = t.statuses.filter((s) => this.statusDefs.get(s.statusId)?.category === op.category).sort((a, b) => a.seq - b.seq);
            const victim = op.selection === 'random_applied_buff' ? cands[Math.min(cands.length - 1, Math.floor(this.rng.next() * cands.length))] : cands[0];
            if (!victim) break;
            t.statuses.splice(t.statuses.indexOf(victim), 1);
            ctx.removedStacks++;
            this.emit({ type: 'status_removed', target: t.id, status: victim.statusId, reason: 'cleansed' });
          }
        }
        break;
      }
      case 'grant_shield': {
        for (const t of targets) {
          const amount = Math.max(1, Math.floor(this.scale(ctx.actor, op.scale_stat) * op.multiplier * this.rankFactor(ctx.actor, ctx.skill.skill_id)));
          t.shields.push(op.shield_source_id ? { amount, turnsLeft: op.duration_turns, sourceId: op.shield_source_id } : { amount, turnsLeft: op.duration_turns });
          this.emit({ type: 'shield', source: ctx.actor.id, target: t.id, amount });
        }
        break;
      }
      case 'grant_redirect': {
        const protectedUnits = this.resolve(op.protected_ally_selector_id, ctx);
        for (const p of protectedUnits) {
          if (p === ctx.actor) continue;
          p.redirects = p.redirects.filter((r) => r.protectorId !== ctx.actor.id);
          p.redirects.push({ protectorId: ctx.actor.id, fraction: op.redirected_fraction, turnsLeft: op.duration_turns, eligible: op.eligible_action_types });
          this.emit({ type: 'redirect_granted', protector: ctx.actor.id, protected: p.id, fraction: op.redirected_fraction, turns: op.duration_turns });
        }
        break;
      }
      case 'grant_intercept': {
        for (const p of this.resolve(op.protected_ally_selector_id, ctx)) {
          if (p === ctx.actor) continue;
          p.redirects = p.redirects.filter((r) => r.protectorId !== ctx.actor.id);
          p.redirects.push({ protectorId: ctx.actor.id, fraction: op.redirected_fraction, turnsLeft: op.duration_turns, eligible: ATTACK_KINDS, hitsLeft: op.maximum_intercepts });
          this.emit({ type: 'redirect_granted', protector: ctx.actor.id, protected: p.id, fraction: op.redirected_fraction, turns: op.duration_turns });
        }
        break;
      }
      case 'gain_focus': {
        for (const t of targets) this.addFocus(t, op.amount, false);
        break;
      }
      case 'modify_stat': {
        for (const t of targets) {
          t.mods.push({ stat: op.stat_id, mode: op.mode, amount: op.amount, turnsLeft: op.duration_turns });
          this.emit({ type: 'stat_mod', target: t.id, stat: op.stat_id, mode: op.mode, amount: op.amount, turns: op.duration_turns });
        }
        break;
      }
      case 'heal_per_removed_status': {
        if (op.requires_successful_cleanse && ctx.removedStacks === 0) break;
        const stacks = Math.min(ctx.removedStacks, op.maximum_total_stacks);
        const per = Math.max(1, Math.floor(this.scale(ctx.actor, op.scale_stat) * op.multiplier * stacks * this.rankFactor(ctx.actor, ctx.skill.skill_id)));
        for (const t of targets.slice(0, op.maximum_targets)) this.healUnit(ctx.actor, t, Math.floor(per * this.statusProduct(t, 'healing_received_multiplier')), ctx);
        break;
      }
      // packet modifiers act on the damage packet the surrounding hook was fired for (the selector only names whose rule it is)
      case 'modify_incoming_damage':
      case 'modify_outgoing_damage': {
        if (!ctx.packet) break;
        if (op.op === 'modify_incoming_damage') ctx.packet.inMult *= op.multiplier;
        else ctx.packet.outMult *= op.multiplier;
        break;
      }
      case 'block_attack': {
        if (ctx.packet) ctx.packet.blocked = true;
        break;
      }
      case 'grant_damage_reduction': {
        for (const t of targets) t.reductions.push({ mult: op.damage_taken_multiplier, turnsLeft: op.duration_turns });
        break;
      }
      case 'grant_first_hit_guard': {
        for (const t of targets) t.reductions.push({ mult: op.damage_taken_multiplier, turnsLeft: op.duration_turns, hitsLeft: op.hits_per_target });
        break;
      }
      case 'grant_opening_guard': {
        for (const t of targets) t.openingGuard = { mult: op.damage_taken_multiplier, roundsLeft: op.duration_rounds, used: [] };
        break;
      }
      case 'apply_regeneration': {
        for (const t of targets) {
          t.regens = t.regens.filter((r) => r.sourceId !== ctx.actor.id);
          t.regens.push({ sourceId: ctx.actor.id, amount: Math.max(1, Math.floor(this.scale(ctx.actor, op.scale_stat) * op.multiplier * this.rankFactor(ctx.actor, ctx.skill.skill_id))), ticksLeft: op.ticks, turnsLeft: op.duration_turns });
        }
        break;
      }
      case 'reduce_status_durations': {
        for (const t of targets) {
          for (const s of [...t.statuses]) {
            if (this.statusDefs.get(s.statusId)?.category !== op.category || s.turnsLeft <= op.minimum_remaining_turns) continue;
            s.turnsLeft = Math.max(op.minimum_remaining_turns, s.turnsLeft - op.amount_turns);
            if (s.turnsLeft <= 0) {
              t.statuses.splice(t.statuses.indexOf(s), 1);
              this.emit({ type: 'status_removed', target: t.id, status: s.statusId, reason: 'cleansed' });
            }
          }
        }
        break;
      }
      case 'reduce_cooldowns': {
        for (const t of targets) {
          for (const k of Object.keys(t.cooldowns)) {
            const v = t.cooldowns[k] ?? 0;
            if (v > op.minimum_remaining_turns) t.cooldowns[k] = Math.max(op.minimum_remaining_turns, v - op.amount_turns);
          }
        }
        break;
      }
      case 'delay_next_action': {
        for (const t of targets) this.delay(t, op.gauge_fraction);
        break;
      }
      case 'pay_hp_cost': {
        for (const t of targets) {
          const cost = Math.max(1, Math.floor(t.maxHp * op.max_hp_fraction + 1e-9));
          const next = Math.max(op.cannot_reduce_below, t.hp - cost);
          const paid = t.hp - next;
          if (paid <= 0) continue;
          t.hp = next;
          this.emit({ type: 'hp_cost', unit: t.id, amount: paid, hpAfter: t.hp });
        }
        break;
      }
      case 'arm_counter': {
        for (const t of targets) {
          t.counters = t.counters.filter((c) => c.ownerId !== ctx.actor.id);
          t.counters.push({ ownerId: ctx.actor.id, skillId: ctx.skill.skill_id, scaleStat: op.scale_stat, multiplier: op.multiplier, damageType: op.damage_type, consume: true });
        }
        break;
      }
      case 'arm_next_attack_bonus': {
        for (const t of targets) if (t.nextAttackBonus === null) t.nextAttackBonus = op.damage_multiplier;
        break;
      }
      case 'copy_buff': {
        const source = this.resolve(op.source_selector_id, ctx)[0];
        if (!source) break;
        for (const t of targets) this.copyBuffs(source, t, op.category, op.maximum_count, op.duration_turns);
        break;
      }
      case 'remove_shield': {
        for (const t of targets) {
          let removed = 0;
          if (op.shield_source_id !== undefined) {
            for (const sh of t.shields) if (sh.sourceId === op.shield_source_id) removed += sh.amount;
            t.shields = t.shields.filter((sh) => sh.sourceId !== op.shield_source_id);
          } else {
            const fraction = op.amount_fraction ?? 0;
            for (const sh of t.shields) {
              const cut = Math.min(sh.amount, Math.max(1, Math.ceil(sh.amount * fraction - 1e-9)));
              sh.amount -= cut;
              removed += cut;
            }
            t.shields = t.shields.filter((sh) => sh.amount > 0);
          }
          if (removed > 0) this.emit({ type: 'shield_removed', unit: t.id, amount: removed });
        }
        break;
      }
      case 'cancel_boss_telegraph': {
        for (const t of targets) if (t.boss?.telegraph?.skillId === op.action_id) this.cancelTelegraph(t, 'objective');
        break;
      }
      case 'remove_boss_modifier': {
        for (const t of targets) if (t.boss) t.boss.modifiers = t.boss.modifiers.filter((m) => m.id !== op.modifier_id);
        break;
      }
      case 'boss_damage_taken_modifier': {
        for (const t of targets) {
          if (!t.boss) continue;
          t.boss.modifiers = t.boss.modifiers.filter((m) => m.id !== op.modifier_id);
          const mod: BossModifier = { id: op.modifier_id, mult: op.multiplier };
          if (op.until_objective_destroyed !== undefined) mod.untilObjective = op.until_objective_destroyed;
          if (op.while_any_objective_alive !== undefined) mod.whileAny = op.while_any_objective_alive;
          t.boss.modifiers.push(mod);
        }
        break;
      }
      case 'summon_enemies': {
        if (op.only_if_objective_alive !== undefined && !this.objectiveAlive(op.only_if_objective_alive)) break;
        for (const t of targets) this.summon(t, op.enemy_id, op.count);
        break;
      }
      case 'remove_copied_statuses': {
        for (const t of targets) {
          if (op.category === 'shield') {
            const before = t.shields.length;
            t.shields = t.shields.filter((sh) => !sh.copied);
            if (t.shields.length < before) this.emit({ type: 'shield_removed', unit: t.id, amount: 0 });
          } else {
            for (const st of t.statuses.filter((x) => x.copied)) {
              t.statuses.splice(t.statuses.indexOf(st), 1);
              this.emit({ type: 'status_removed', target: t.id, status: st.statusId, reason: 'cleansed' });
            }
          }
        }
        break;
      }
      case 'clear_status_if_all_objectives_destroyed': {
        if (!op.objective_ids.every((id) => !this.objectiveAlive(id))) break;
        for (const t of targets) {
          const st = t.statuses.find((x) => x.statusId === op.status_id);
          if (!st) continue;
          t.statuses.splice(t.statuses.indexOf(st), 1);
          this.emit({ type: 'status_removed', target: t.id, status: op.status_id, reason: 'cleansed' });
        }
        break;
      }
    }
    ctx.prev = targets;
  }

  private copyBuffs(source: Combatant, target: Combatant, category: 'buff' | 'shield', max: number, duration: number): void {
    let left = max;
    if (category === 'shield') {
      for (const s of [...source.shields].sort((a, b) => b.amount - a.amount)) {
        if (left-- <= 0) break;
        target.shields.push({ amount: s.amount, turnsLeft: duration, copied: true });
        this.emit({ type: 'buff_copied', source: source.id, target: target.id, what: 'shield' });
      }
      return;
    }
    for (const s of source.statuses.filter((x) => this.statusDefs.get(x.statusId)?.category === 'buff').sort((a, b) => a.seq - b.seq)) {
      if (left-- <= 0) return;
      this.applyStatus(target, target, s.statusId, duration);
      const copy = target.statuses.find((x) => x.statusId === s.statusId);
      if (copy) copy.copied = true;
      this.emit({ type: 'buff_copied', source: source.id, target: target.id, what: s.statusId });
    }
    for (const m of source.mods.filter((x) => x.amount > 0)) {
      if (left-- <= 0) return;
      target.mods.push({ ...m, turnsLeft: duration });
      this.emit({ type: 'buff_copied', source: source.id, target: target.id, what: `${m.stat}_${m.mode}` });
    }
  }

  private delay(target: Combatant, fraction: number): void {
    if (!target.alive || fraction <= 0) return;
    const cap = Math.floor(this.rules.max_pending_delay_fraction * this.rules.gauge_max);
    target.pendingDelay = Math.min(cap, target.pendingDelay + Math.round(fraction * this.rules.gauge_max));
    this.emit({ type: 'delay', unit: target.id, fraction });
  }

  private applyStatus(source: Combatant, target: Combatant, statusId: string, turns: number, value?: number): void {
    if (!target.alive) return;
    const def = this.statusDefs.get(statusId);
    if (!def) throw new Error(`unknown status ${statusId}`);
    if (target.def.status_immunities?.includes(statusId)) return;
    if (target.statuses.some((s) => this.statusDefs.get(s.statusId)?.immune_status_ids?.includes(statusId))) return;
    if (target.def.boss && def.category === 'control') turns = Math.max(1, Math.floor(turns * target.def.boss.control_duration_multiplier + 1e-9));
    const power = def.dot_atk_multiplier !== undefined ? this.effStat(source, 'atk') : undefined;
    const existing = target.statuses.find((s) => s.statusId === statusId);
    if (existing) {
      existing.turnsLeft = Math.max(existing.turnsLeft, turns);
      existing.sourceId = source.id;
      if (value !== undefined) existing.value = value;
      if (power !== undefined) existing.power = power;
    } else {
      const inst: StatusInstance = { statusId, turnsLeft: turns, sourceId: source.id, seq: ++this.statusSeq };
      if (value !== undefined) inst.value = value;
      if (power !== undefined) inst.power = power;
      target.statuses.push(inst);
    }
    this.emit({ type: 'status_applied', source: source.id, target: target.id, status: statusId, turns });
    if (def.next_action_gauge_delay_fraction !== undefined) this.delay(target, def.next_action_gauge_delay_fraction);
  }

  private healUnit(source: Combatant, target: Combatant, amount: number, ctx: Ctx | null): void {
    if (!target.alive || amount <= 0) return;
    amount = Math.floor(amount * (1 + (source.equipmentEffects.heal_bonus_pct ?? 0)));
    const applied = Math.min(amount, target.maxHp - target.hp);
    target.hp += applied;
    source.lastHealTarget = target.id;
    this.emit({ type: 'heal', source: source.id, target: target.id, amount: applied, hpAfter: target.hp });
    if (ctx) {
      ctx.healed.push(target);
      if (!ctx.suppressHooks) this.fire('after_ally_healed', { actor: source, target, actionKind: ctx.actionKind, actionId: ctx.actionId, packet: null });
    }
  }

  private addFocus(unit: Combatant, amount: number, scaled: boolean): void {
    if (!unit.alive) return;
    const gain = scaled ? Math.floor(amount * this.statusProduct(unit, 'focus_gain_multiplier') * (1 + (unit.equipmentEffects.focus_gain_pct ?? 0))) : amount;
    const next = Math.min(this.rules.focus.maximum, unit.focus + gain);
    const delta = next - unit.focus;
    if (delta === 0) return;
    unit.focus = next;
    this.emit({ type: 'focus', unit: unit.id, delta, total: unit.focus });
  }

  // ---------------------------------------------------------------- damage

  private dealDamage(ctx: Ctx, target: Combatant, op: Extract<EffectOp, { op: 'damage' }>, element: Element, single: boolean): void {
    if (!target.alive) return;
    if (target.objective) return this.hitObjective(ctx, target);
    const attacker = ctx.actor;
    const defStat = op.damage_type === 'physical' ? this.effStat(target, 'def') : this.effStat(target, 'res');
    const elementMult = this.elementMultiplier(element, target);
    const crit = this.rng.next() < this.rules.crit.chance;
    const elemResMult = this.effElementResMult(target, element);
    // per-target conditional multipliers of the op itself
    let mult = op.multiplier * this.rankFactor(attacker, ctx.skill.skill_id);
    if (op.multiplier_if_objective_alive && this.objectiveAlive(op.multiplier_if_objective_alive.objective_id)) mult *= op.multiplier_if_objective_alive.multiplier;
    if (op.multiplier_if_all_objectives_alive) {
      const mine = this.combatants.filter((c) => c.objective?.bossId === attacker.id);
      if (mine.length > 0 && mine.every((c) => c.alive)) mult *= op.multiplier_if_all_objectives_alive.multiplier;
    }
    if (op.modifiers) {
      const saved = ctx.eventTarget;
      ctx.eventTarget = target;
      for (const m of op.modifiers) {
        if ('multiplier' in m) {
          if (this.holds(m.condition, ctx, attacker)) mult *= m.multiplier;
        } else {
          mult += Math.min(this.predicateCount(m.condition, ctx, attacker), m.maximum_count) * m.add_multiplier_per_count;
        }
      }
      ctx.eventTarget = saved;
    }
    // element-bound status effects on the target (Soaked): extra damage taken and one-shot reactions
    let elementTaken = 1;
    let reaction = 0;
    const consumed: StatusInstance[] = [];
    for (const s of target.statuses) {
      const d = this.statusDefs.get(s.statusId);
      elementTaken *= d?.element_damage_taken_multiplier?.[element] ?? 1;
      for (const r of d?.reactions ?? []) {
        if (r.element !== element) continue;
        reaction += r.bonus_damage_multiplier;
        if (r.consume_status) consumed.push(s);
        this.emit({ type: 'reaction', unit: target.id, name: r.name_en, bonus: r.bonus_damage_multiplier });
      }
    }
    for (const s of consumed) {
      target.statuses.splice(target.statuses.indexOf(s), 1);
      this.emit({ type: 'status_removed', target: target.id, status: s.statusId, reason: 'expired' });
    }
    const attackKind = ctx.inHook ? null : ctx.actionKind;
    const base =
      this.scale(attacker, op.scale_stat === 'hp' ? 'hp' : op.scale_stat) *
      mult *
      (this.rules.defense_scale / (this.rules.defense_scale + Math.max(0, defStat))) *
      elementMult *
      this.statusProduct(attacker, 'outgoing_damage_multiplier') *
      this.statusProduct(target, 'damage_taken_multiplier') *
      elemResMult *
      (crit ? this.rules.crit.multiplier : 1);

    const packet: Packet = { source: attacker, target, outMult: 1, inMult: 1, blocked: false, actionKind: attackKind };
    const hooked = attackKind !== null && !ctx.suppressHooks && op.can_trigger_passives !== false;
    const info: HookInfo = { actor: attacker, target, actionKind: attackKind, actionId: ctx.actionId, packet };
    if (hooked) this.fire('before_damage_dealt', info);
    this.applyContinuous(packet, 'before_damage_dealt');
    if (hooked) this.fire('before_damage_received', info);
    this.applyContinuous(packet, 'before_damage_received');
    if (packet.blocked) {
      this.emit({ type: 'blocked', unit: target.id, source: attacker.id });
      return;
    }

    let guard = 1;
    if (single && ctx.guarded.has(target.id)) guard = ctx.guarded.get(target.id) ?? 1;
    let reduction = 1;
    for (const r of [...target.reductions]) {
      reduction *= r.mult;
      if (r.hitsLeft !== undefined && --r.hitsLeft <= 0) target.reductions.splice(target.reductions.indexOf(r), 1);
    }
    const bossWard = target.boss ? this.bossWard(target) : 1;
    const raw =
      base * bossWard * elementTaken * (1 + reaction) * (attackKind && ctx.attackBonus !== null ? ctx.attackBonus : 1) * packet.outMult * packet.inMult * guard * reduction;
    const dmg = Math.max(1, Math.floor(raw + 1e-9));
    ctx.lastDamage = dmg;
    ctx.lastDamageTarget = target;

    let toTarget = dmg;
    const redirect = single && attackKind ? target.redirects.find((r) => r.eligible.includes(attackKind) && (r.hitsLeft === undefined || r.hitsLeft > 0)) : undefined;
    if (redirect) {
      const protector = this.combatants.find((c) => c.id === redirect.protectorId && c.alive);
      if (protector && protector !== target) {
        const share = roundHalfUp(dmg * redirect.fraction);
        toTarget = dmg - share;
        if (redirect.hitsLeft !== undefined && --redirect.hitsLeft <= 0) target.redirects.splice(target.redirects.indexOf(redirect), 1);
        if (share > 0) this.receive(ctx, attacker, protector, share, { crit, elementMult, noFocus: op.no_focus_gain === true, redirectedFrom: target.id, shieldMult: op.shield_damage_multiplier, fireHooks: true });
      }
    }
    if (toTarget > 0) this.receive(ctx, attacker, target, toTarget, { crit, elementMult, noFocus: op.no_focus_gain === true, shieldMult: op.shield_damage_multiplier });
    if (hooked && attacker.alive) this.fire('after_damage_dealt', info);
  }

  /** Always-on rules (Brin's Hold the Gate, Nixie's Trail Mark, Jori's Hot Rivet, ...) scale the packet. */
  private applyContinuous(packet: Packet, event: 'before_damage_dealt' | 'before_damage_received'): void {
    for (const u of this.combatants) {
      if (!u.alive) continue;
      for (const m of this.rulesOf(u).mods) {
        if (m.event === 'stat_snapshot' || m.event !== event) continue;
        if (event === 'before_damage_dealt') {
          const scope = m.applies_to === 'all_allies_while_owner_alive' ? packet.source.side === u.side : packet.source === u;
          if (!scope) continue;
        } else if (packet.target !== u) continue;
        const cctx = this.bareCtx(u, { eventTarget: packet.target, eventActor: packet.source, packet });
        if (!this.holds(m.condition, cctx, u)) continue;
        if (event === 'before_damage_dealt') packet.outMult *= m.damage_multiplier;
        else packet.inMult *= m.damage_multiplier;
      }
    }
  }

  private receive(
    ctx: Ctx | null,
    source: Combatant,
    target: Combatant,
    amount: number,
    o: { crit?: boolean; elementMult?: number; noFocus?: boolean; redirectedFrom?: string; shieldMult?: number | undefined; dot?: string; fireHooks?: boolean } = {}
  ): void {
    if (!target.alive) return;
    const real = ctx !== null && o.dot === undefined;
    const attackKind = real && !ctx.inHook ? ctx.actionKind : null;
    const hooked = real && attackKind !== null && !ctx.suppressHooks;
    if (o.fireHooks && hooked) this.fire('before_damage_received', { actor: source, target, actionKind: attackKind, actionId: ctx.actionId, packet: null });
    let incoming = amount;
    // Soul Link: a share of each hit is taken by the other linked units instead
    const link = target.statuses.find((s) => this.statusDefs.get(s.statusId)?.shared_damage_cap_fraction !== undefined);
    if (link && o.dot !== 'soul_link') {
      const def = this.statusDefs.get(link.statusId);
      const others = this.living(target.side).filter((c) => c !== target && c.statuses.some((s) => s.statusId === link.statusId));
      const cap = Math.floor(target.maxHp * (def?.shared_damage_cap_fraction ?? 0));
      const share = Math.min(Math.floor(incoming * (link.value ?? 0)), cap);
      if (others.length > 0 && share > 0) {
        incoming -= share;
        const each = Math.max(1, Math.floor(share / others.length));
        for (const c of others) this.receive(null, source, c, each, { dot: 'soul_link' });
      }
    }
    let remaining = incoming;
    let absorbed = 0;
    const sm = o.shieldMult ?? 1;
    while (remaining > 0 && target.shields.length > 0) {
      const s = target.shields[0];
      if (!s) break;
      const need = Math.ceil(remaining * sm - 1e-9);
      if (s.amount >= need) {
        s.amount -= need;
        absorbed += remaining;
        remaining = 0;
      } else {
        const soaked = Math.min(remaining, Math.floor(s.amount / sm + 1e-9));
        absorbed += soaked;
        remaining -= soaked;
        s.amount = 0;
      }
      if (s.amount <= 0) target.shields.shift();
    }
    const hpBefore = target.hp;
    let nextHp = Math.max(0, target.hp - remaining);
    // a boss phase bar cannot run out: crossing the next phase threshold (or emptying) starts the change instead
    const bossState = target.boss;
    const nextPhase = bossState ? target.def.boss?.phases[bossState.phase + 1] : undefined;
    if (bossState && nextPhase) {
      const threshold = Math.floor(target.maxHp * (nextPhase.transition_hp_percent ?? 0.5) + 1e-9);
      if (bossState.transitionPending || nextHp <= threshold) {
        bossState.transitionPending = true;
        nextHp = Math.max(1, nextHp);
      }
    }
    target.hp = nextHp;
    const ev: BattleEvent = {
      type: 'damage',
      source: source.id,
      target: target.id,
      amount: remaining,
      absorbed,
      hpAfter: target.hp,
      crit: o.crit ?? false,
      elementMultiplier: o.elementMult ?? 1
    };
    if (o.redirectedFrom) ev.redirectedFrom = o.redirectedFrom;
    if (o.dot) ev.dot = o.dot;
    if (ctx?.inHook) ev.counter = true;
    this.emit(ev);
    if (remaining + absorbed > 0) target.tookDamageThisRound = true;
    if (target.hp === 0) {
      const statusesAtDeath = target.statuses.map((s) => s.statusId);
      target.alive = false;
      target.shields = [];
      target.statuses = [];
      target.mods = [];
      target.redirects = [];
      target.regens = [];
      target.reductions = [];
      target.openingGuard = null;
      target.counters = [];
      target.nextAttackBonus = null;
      target.focus = 0;
      this.emit({ type: 'defeat', unit: target.id });
      if (o.dot !== 'soul_link') this.fire('after_enemy_defeated', { actor: source, target, actionKind: attackKind, actionId: ctx?.actionId ?? 0, packet: null, targetStatuses: statusesAtDeath });
      return;
    }
    if (!o.noFocus && o.dot === undefined && remaining + absorbed > 0) {
      const room = this.rules.focus.hit_gain_cap_per_turn - target.focusGainedThisTurn;
      const gain = Math.min(this.rules.focus.hit_gain, Math.max(0, room));
      if (gain > 0) {
        target.focusGainedThisTurn += gain;
        this.addFocus(target, gain, false);
      }
    }
    if (hooked && target.hp < hpBefore) {
      const info: HookInfo = { actor: source, target, actionKind: attackKind, actionId: ctx.actionId, packet: null };
      this.fire('after_damage_received', info);
      this.fire('ally_damaged', info);
      this.fire('ally_hp_threshold_crossed', info);
    }
  }

  // ---------------------------------------------------------------- bosses

  private initBoss(c: Combatant): void {
    c.boss = { phase: -1, baseHp: c.maxHp, baseAtk: c.base.atk, baseDef: c.base.def, modifiers: [], telegraph: null, transitionPending: false };
    this.enterPhase(c, 0);
  }

  /** A phase is a fresh HP bar (level-scaled base x multiplier) with its own stats, weaknesses, objectives and opening ops. */
  private enterPhase(c: Combatant, idx: number): void {
    const bossDef = c.def.boss;
    const st = c.boss;
    const phase = bossDef?.phases[idx];
    if (!bossDef || !st || !phase) return;
    if (idx > 0) {
      for (const s of [...c.statuses]) {
        if (this.statusDefs.get(s.statusId)?.category !== bossDef.clear_status_category || bossDef.preserve_status_ids.includes(s.statusId)) continue;
        c.statuses.splice(c.statuses.indexOf(s), 1);
        this.emit({ type: 'status_removed', target: c.id, status: s.statusId, reason: 'cleansed' });
      }
      c.mods = c.mods.filter((m) => m.amount >= 0);
      for (const o of this.combatants) {
        if (o.objective?.bossId === c.id && !o.objective.persists && o.alive) o.alive = false;
      }
    }
    st.phase = idx;
    st.transitionPending = false;
    c.maxHp = Math.max(1, roundHalfUp(st.baseHp * phase.hp_multiplier));
    c.hp = c.maxHp;
    c.base.atk = Math.max(0, roundHalfUp(st.baseAtk * phase.atk_multiplier));
    c.base.def = Math.max(0, roundHalfUp(st.baseDef * phase.def_multiplier));
    c.weaknessOverride = phase.weaknesses;
    for (const obj of phase.objectives) {
      if (!this.combatants.some((o) => o.objective?.objectiveId === obj.objective_id && o.objective.bossId === c.id)) this.spawnObjective(c, obj);
    }
    this.emit({ type: 'phase_change', unit: c.id, phase: phase.phase_id, hp: c.hp, maxHp: c.maxHp });
    const ctx = this.newCtx(c, c.def.skills[0] as SkillDef, { suppressHooks: true });
    for (const op of phase.enter_ops) this.applyOp(op, ctx);
    for (const op of phase.passive_ops) this.applyOp(op, ctx);
  }

  private spawnObjective(boss: Combatant, obj: BossObjective): void {
    const def: UnitDef = {
      unit_id: obj.objective_id,
      kind: 'enemy',
      name_en: obj.name_en,
      element: 'Dawn',
      role: 'objective',
      base_stats: { hp: obj.max_hp, atk: 0, def: 0, spd: 1 },
      skills: [{ skill_id: 'objective_idle', name_en: '-', type: 'basic', description_en: '', player_target: 'none', cooldown_turns: 0, focus_cost: 0, ai_priority: 0, effect_ops: [] }],
      art_key: obj.objective_id,
      provenance: { source: 'objective' }
    };
    const used = this.combatants.filter((c) => c.objective).length;
    const o = this.makeCombatant(def, boss.side, 10 + used, 'front', boss.level);
    o.objective = { objectiveId: obj.objective_id, bossId: boss.id, targetable: obj.targetable_by_player, persists: obj.persists_across_phases === true };
    this.combatants.push(o);
  }

  private objectiveAlive(objectiveId: string): boolean {
    return this.combatants.some((c) => c.objective?.objectiveId === objectiveId && c.alive);
  }

  /** Product of the boss-side damage-taken multipliers whose objective condition still holds. */
  private bossWard(boss: Combatant): number {
    let m = 1;
    for (const mod of boss.boss?.modifiers ?? []) {
      if (mod.untilObjective !== undefined && !this.objectiveAlive(mod.untilObjective)) continue;
      if (mod.whileAny !== undefined && !mod.whileAny.some((id) => this.objectiveAlive(id))) continue;
      m *= mod.mult;
    }
    return m;
  }

  /** Every damaging hit aimed at an objective removes one point of its integrity, whatever the attacker's numbers. */
  private hitObjective(ctx: Ctx, o: Combatant): void {
    o.hp = Math.max(0, o.hp - 1);
    this.emit({ type: 'damage', source: ctx.actor.id, target: o.id, amount: 1, absorbed: 0, hpAfter: o.hp, crit: false, elementMultiplier: 1 });
    if (o.hp > 0) return;
    o.alive = false;
    this.emit({ type: 'defeat', unit: o.id });
    const info = o.objective;
    if (!info) return;
    const boss = this.combatants.find((c) => c.id === info.bossId);
    this.emit({ type: 'objective_destroyed', objective: info.objectiveId, boss: info.bossId });
    if (!boss?.alive || !boss.boss) return;
    const phases = boss.def.boss?.phases ?? [];
    const def = phases.flatMap((p) => p.objectives).find((x) => x.objective_id === info.objectiveId);
    const bctx = this.newCtx(boss, boss.def.skills[0] as SkillDef, { suppressHooks: true });
    for (const op of def?.on_destroyed ?? []) this.applyOp(op, bctx);
    const pending = boss.boss.telegraph;
    const tel = pending ? boss.def.skills.find((k) => k.skill_id === pending.skillId)?.telegraph : undefined;
    if (pending && tel) {
      const all = tel.interrupt_if_all_objectives_destroyed;
      if (tel.interrupt_if_objective_destroyed === info.objectiveId || (all && all.every((id) => !this.objectiveAlive(id)))) this.cancelTelegraph(boss, 'objective');
    }
  }

  private cancelTelegraph(boss: Combatant, reason: string): void {
    const pending = boss.boss?.telegraph;
    if (!boss.boss || !pending) return;
    boss.boss.telegraph = null;
    const skill = boss.def.skills.find((k) => k.skill_id === pending.skillId);
    // an interrupted signature is spent: it goes on cooldown as if it had been used
    if (skill && skill.cooldown_turns > 0) boss.cooldowns[skill.skill_id] = skill.cooldown_turns;
    this.emit({ type: 'telegraph_cancelled', unit: boss.id, skill: pending.skillId, reason });
  }

  /** Boss turn: announce a telegraphed signature, resolve one announced earlier, or act normally. */
  private bossAct(boss: Combatant): void {
    const st = boss.boss;
    if (!st) return;
    const pending = st.telegraph;
    if (pending) {
      const sk = boss.def.skills.find((k) => k.skill_id === pending.skillId);
      if (sk && pending.actionsSeen >= pending.actionsNeeded) {
        st.telegraph = null;
        this.executeSkill(boss, sk, null);
        return;
      }
      // the player has not had its action yet: the boss keeps pressure with a plain strike and the intent stays
      const basic = boss.def.skills.find((k) => k.type === 'basic');
      if (basic) this.executeSkill(boss, basic, null);
      return;
    }
    const skill = this.chooseEnemySkill(boss);
    if (!skill) {
      this.emit({ type: 'turn_skipped', actor: boss.id, reason: 'no_usable_skill' });
      return;
    }
    const need = skill.telegraph?.player_actions_before_resolution ?? 0;
    if (need > 0) {
      st.telegraph = { skillId: skill.skill_id, actionsNeeded: need, actionsSeen: 0 };
      const ctx = this.newCtx(boss, skill, { actionKind: skill.type === 'passive' ? null : (skill.type as ActionKind) });
      const first = skill.effect_ops[0];
      const targets = first ? this.resolve(first.target_selector_id, ctx, true) : [];
      this.emit({ type: 'telegraph', unit: boss.id, skill: skill.skill_id, skillName: skill.name_en, targets: targets.map((t) => t.id), actionsNeeded: need });
      return;
    }
    this.executeSkill(boss, skill, null);
  }

  /** Phase changes wait for the end of the action that caused them: any announced intent resolves first, then the next phase begins. */
  private processTransitions(): void {
    for (const boss of [...this.combatants]) {
      if (!boss.alive || !boss.boss?.transitionPending) continue;
      const pending = boss.boss.telegraph;
      if (pending) {
        const sk = boss.def.skills.find((k) => k.skill_id === pending.skillId);
        boss.boss.telegraph = null;
        if (sk) this.executeSkill(boss, sk, null);
      }
      if (boss.alive) this.enterPhase(boss, boss.boss.phase + 1);
    }
  }

  private summon(boss: Combatant, enemyId: string, count: number): void {
    const def = this.defs.get(enemyId);
    if (!def) throw new Error(`summon_enemies: unknown unit ${enemyId}`);
    for (let i = 0; i < count; i++) {
      if (this.living(boss.side).length >= 5) return;
      let slot = 0;
      while (this.combatants.some((c) => c.id === `${boss.side}:${slot}:${enemyId}` || (c.side === boss.side && !c.objective && c.alive && c.slot === slot))) slot++;
      const unit = this.makeCombatant(def, boss.side, slot, 'front', boss.level);
      this.combatants.push(unit);
      this.emit({ type: 'summon', source: boss.id, unit: unit.id });
    }
  }

  /** Auto Battle: break the objective that would cancel the announced intent first, otherwise leave objectives alone. */
  private autoPool(candidates: Combatant[]): Combatant[] {
    const interrupting = candidates.filter((c) => {
      if (!c.objective) return false;
      const boss = this.combatants.find((b) => b.id === c.objective?.bossId);
      const pending = boss?.boss?.telegraph;
      const tel = pending ? boss?.def.skills.find((k) => k.skill_id === pending.skillId)?.telegraph : undefined;
      return tel?.interrupt_if_objective_destroyed === c.objective.objectiveId || (tel?.interrupt_if_all_objectives_destroyed?.includes(c.objective.objectiveId) ?? false);
    });
    if (interrupting.length > 0) return interrupting;
    const plain = candidates.filter((c) => !c.objective);
    return plain.length > 0 ? plain : candidates;
  }

  // ---------------------------------------------------------------- hooks

  private scopeOk(owner: Combatant, hook: EventHook, info: HookInfo): boolean {
    const f = hook.event_filter;
    const same = (u: Combatant | null): boolean => u !== null && u.side === owner.side;
    const team = f?.team !== undefined;
    let ok: boolean;
    switch (hook.event) {
      case 'owner_turn_start':
        ok = info.actor === owner;
        break;
      case 'before_damage_dealt':
      case 'after_damage_dealt':
        ok = info.actor === owner || (team && same(info.actor));
        break;
      case 'before_damage_received':
      case 'after_damage_received':
        ok = info.target === owner || (team && same(info.target));
        break;
      case 'ally_damaged':
        ok = same(info.target) && info.target !== owner;
        break;
      case 'ally_hp_threshold_crossed':
      case 'after_ally_healed':
        ok = same(info.target);
        break;
      case 'after_ally_action':
      case 'after_ally_ultimate':
        ok = same(info.actor);
        break;
      case 'after_enemy_defeated':
        ok = info.target !== null && info.target.side !== owner.side;
        break;
      case 'after_round_end':
        ok = true;
        break;
    }
    if (!ok || !f) return ok;
    if (f.incoming_action_type !== undefined && info.actionKind !== f.incoming_action_type) return false;
    if (f.damage_action_type !== undefined && info.actionKind === null) return false;
    if (f.owner_action_type !== undefined && info.actionKind === null) return false;
    if (f.source_is_owner && info.actor !== owner) return false;
    if (f.exclude_owner && info.actor === owner) return false;
    if (f.ally_action_type !== undefined && info.actionKind !== f.ally_action_type) return false;
    if (f.event_target_faction_is !== undefined && info.target?.def.faction_id !== f.event_target_faction_is) return false;
    return true;
  }

  /** Runs every living unit's hooks for an event. */
  private fire(event: HookEvent, info: HookInfo): void {
    for (const owner of [...this.combatants]) {
      if (!owner.alive) continue;
      for (const entry of this.rulesOf(owner).hooks) {
        const hook = entry.hook;
        if (hook.event !== event || !this.scopeOk(owner, hook, info)) continue;
        const ctx = this.newCtx(owner, entry.skill, {
          eventSource: info.actor,
          eventTarget: info.target,
          eventActor: info.actor,
          lastTargets: info.target ? [info.target] : [],
          inHook: true,
          suppressHooks: true,
          actionId: info.actionId,
          packet: info.packet,
          targetStatuses: info.targetStatuses ?? []
        });
        if (!this.holds(hook.condition, ctx, owner)) continue;
        const lim = hook.limit;
        const key = entry.key;
        const tkey = `${key}>${info.target?.id ?? ''}`;
        if (lim?.per_battle !== undefined && (owner.hookBattleCount[key] ?? 0) >= lim.per_battle) continue;
        if (lim?.per_owner_turn !== undefined && (owner.hookTurnCount[key] ?? 0) >= lim.per_owner_turn) continue;
        if (lim?.per_round !== undefined && (owner.hookRoundCount[key] ?? 0) >= lim.per_round) continue;
        if (lim?.per_target_per_battle !== undefined && (owner.hookTargetCount[tkey] ?? 0) >= lim.per_target_per_battle) continue;
        const mark = `${owner.id}|${key}`;
        if (lim?.per_damage_action !== undefined && info.actionId > 0 && this.actionMarks.get(mark) === info.actionId) continue;
        if (lim?.one_pending_bonus && owner.nextAttackBonus !== null) continue;
        if (lim?.chance !== undefined && this.rng.next() >= lim.chance) continue;
        owner.hookBattleCount[key] = (owner.hookBattleCount[key] ?? 0) + 1;
        owner.hookTurnCount[key] = (owner.hookTurnCount[key] ?? 0) + 1;
        owner.hookRoundCount[key] = (owner.hookRoundCount[key] ?? 0) + 1;
        owner.hookTargetCount[tkey] = (owner.hookTargetCount[tkey] ?? 0) + 1;
        if (info.actionId > 0) this.actionMarks.set(mark, info.actionId);
        this.emit({ type: 'hook_triggered', unit: owner.id, skill: entry.skill.skill_id, event });
        for (const op of hook.effect_ops) this.applyOp(op, ctx);
      }
    }
  }

  // ---------------------------------------------------------------- snapshot for UIs

  snapshot(): CombatSnapshot {
    return {
      units: this.combatants.map((c) => ({
        id: c.id,
        unitId: c.def.unit_id,
        name: c.def.name_en,
        side: c.side,
        slot: c.slot,
        row: c.row,
        hp: c.hp,
        maxHp: c.maxHp,
        shield: this.shieldTotal(c),
        focus: c.focus,
        alive: c.alive,
        statuses: c.statuses.map((s) => ({ id: s.statusId, turns: s.turnsLeft })),
        cooldowns: { ...c.cooldowns },
        objective: c.objective !== null,
        bossPhase: c.boss ? (c.def.boss?.phases[c.boss.phase]?.phase_id ?? null) : null,
        telegraph: c.boss?.telegraph?.skillId ?? null
      })),
      turn: this.turnCounter,
      awaiting: this.current?.id ?? null
    };
  }
}

export interface CombatSnapshot {
  units: {
    id: string;
    unitId: string;
    name: string;
    side: Side;
    slot: number;
    row: Row;
    hp: number;
    maxHp: number;
    shield: number;
    focus: number;
    alive: boolean;
    statuses: { id: string; turns: number }[];
    cooldowns: Record<string, number>;
    objective: boolean;
    bossPhase: string | null;
    telegraph: string | null;
  }[];
  turn: number;
  awaiting: string | null;
}

export type { StatKey };
