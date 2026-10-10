import type { EffectOp, Element, Encounter, EventHook, Predicate, RulesDef, SkillDef, StatusDef, TargetSelector, UnitDef, UnitPack } from '@uomd/content-schema';
import { Rng } from '@uomd/shared';
import {
  IllegalActionError,
  type BattleEvent,
  type BattleResult,
  type Combatant,
  type PlayerAction,
  type Row,
  type Side,
  type SkillOption,
  type StatKey,
  type StepResult,
  type TurnPrompt
} from './types';

/** Safety net: a battle that is still undecided after this many turns is lost by the player. */
export const MAX_TURNS = 300;

const roundHalfUp = (x: number): number => Math.floor(x + 0.5 + 1e-9);

type ActionKind = 'basic' | 'active' | 'ultimate' | 'signature';

interface Ctx {
  actor: Combatant;
  skill: SkillDef;
  chosen: Combatant | null;
  prev: Combatant[];
  lastTargets: Combatant[];
  removedStacks: number;
  eventSource: Combatant | null;
  inHook: boolean;
  actionKind: ActionKind | null;
}

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
  private turnCounter = 0;
  private current: Combatant | null = null;
  private outcome: BattleResult | null = null;
  private readonly startingPlayers: number;

  private constructor(pack: UnitPack, encounter: Encounter) {
    this.rules = pack.rules;
    for (const s of pack.rules.statuses) this.statusDefs.set(s.status_id, s);
    this.rng = new Rng(encounter.seed);
    const defs = new Map<string, UnitDef>(pack.units.map((u) => [u.unit_id, u]));
    const slotsSeen = new Set<string>();
    const add = (side: Side, e: Encounter['party'][number]): void => {
      const def = defs.get(e.unit_id);
      if (!def) throw new Error(`encounter references unknown unit ${e.unit_id}`);
      const key = `${side}:${e.slot}`;
      if (slotsSeen.has(key)) throw new Error(`duplicate slot ${key}`);
      slotsSeen.add(key);
      this.combatants.push(this.makeCombatant(def, side, e.slot, e.row, e.level));
    };
    for (const p of encounter.party) add('player', p);
    for (const e of encounter.enemies) add('enemy', e);
    this.startingPlayers = encounter.party.length;
    this.log.push({ type: 'battle_start', seed: encounter.seed });
  }

  static create(pack: UnitPack, encounter: Encounter): Battle {
    return new Battle(pack, encounter);
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
      hookBattleCount: {},
      hookTurnCount: {},
      alive: true
    };
  }

  // ---------------------------------------------------------------- queries

  get result(): BattleResult | null {
    return this.outcome;
  }

  unit(id: string): Combatant {
    const c = this.combatants.find((x) => x.id === id);
    if (!c) throw new Error(`unknown combatant ${id}`);
    return c;
  }

  living(side: Side): Combatant[] {
    return this.combatants.filter((c) => c.side === side && c.alive).sort((a, b) => a.slot - b.slot);
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
    let value = (baseVal + flat) * (1 + pct);
    if (stat === 'def' || (stat === 'res' && c.base.res === null)) {
      for (const s of c.statuses) value *= this.statusDefs.get(s.statusId)?.def_multiplier ?? 1;
    }
    const min = stat === 'spd' ? 1 : 0;
    return Math.max(min, roundHalfUp(value));
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

  /** Single-target attacks must pick a living front-row unit while one exists. */
  legalEnemyTargets(actor: Combatant): Combatant[] {
    const opp = this.opponents(actor);
    const front = opp.filter((o) => o.row === 'front');
    const pool = front.length > 0 ? front : opp;
    const taunter = this.tauntSource(actor);
    return taunter ? [taunter] : pool;
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
    const legal = this.legalEnemyTargets(actor);
    return [...legal].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.slot - b.slot || (a.id < b.id ? -1 : 1))[0] ?? null;
  }

  // ---------------------------------------------------------------- element math

  elementMultiplier(attackerElement: Element, target: Combatant): number {
    const el = this.rules.element;
    const t = target.def;
    if (t.weaknesses?.includes(attackerElement)) return el.weakness;
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
    const live = this.combatants.filter((c) => c.alive);
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
    const live = this.combatants.filter((c) => c.alive);
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
    this.executeSkill(actor, skill, skill.player_target === 'enemy' ? this.unit(action.targetId as string) : null);
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
  intentFor(enemyId: string): { skillId: string; skillName: string; targetId: string | null } | null {
    const c = this.unit(enemyId);
    if (!c.alive || c.side !== 'enemy') return null;
    const skill = this.chooseEnemySkill(c);
    if (!skill) return null;
    const sel = skill.effect_ops[0]?.target_selector_id;
    const target = sel === 'single_enemy' || sel === 'single_enemy_default' ? this.pickDefaultTarget(c) : null;
    return { skillId: skill.skill_id, skillName: skill.name_en, targetId: target?.id ?? null };
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
      this.beginTurn(actor);
      const skipReason = this.consumeSkip(actor);
      if (skipReason) {
        this.emit({ type: 'turn_skipped', actor: actor.id, reason: skipReason });
        this.finishTurn(actor);
        continue;
      }
      if (!actor.alive) {
        this.finishTurn(actor);
        continue;
      }
      if (actor.side === 'player') {
        this.current = actor;
        continue;
      }
      const skill = this.chooseEnemySkill(actor);
      if (!skill) {
        this.emit({ type: 'turn_skipped', actor: actor.id, reason: 'no_usable_skill' });
      } else {
        const target = skill.player_target === 'enemy' ? this.pickDefaultTarget(actor) : null;
        this.executeSkill(actor, skill, target);
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
    this.checkEnd();
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
    if (enemies.length === 0 || players.length === 0) {
      const winner: Side = enemies.length === 0 ? 'player' : 'enemy';
      let stars: 0 | 1 | 2 | 3 = 0;
      if (winner === 'player') {
        const defeated = this.startingPlayers - players.length;
        stars = defeated === 0 ? 3 : defeated === 1 ? 2 : 1;
      }
      this.outcome = { winner, stars, turns: this.turnCounter };
      this.emit({ type: 'battle_end', winner, stars });
    }
  }

  private emit(e: BattleEvent): void {
    this.log.push(e);
  }

  // ---------------------------------------------------------------- turn start

  private beginTurn(actor: Combatant): void {
    for (const k of Object.keys(actor.cooldowns)) {
      const v = actor.cooldowns[k] ?? 0;
      if (v > 0) actor.cooldowns[k] = v - 1;
    }
    for (const s of [...actor.statuses]) {
      s.turnsLeft -= 1;
      if (s.turnsLeft <= 0) {
        actor.statuses.splice(actor.statuses.indexOf(s), 1);
        this.emit({ type: 'status_removed', target: actor.id, status: s.statusId, reason: 'expired' });
      }
    }
    actor.mods = actor.mods.filter((m) => --m.turnsLeft > 0);
    actor.shields = actor.shields.filter((s) => --s.turnsLeft > 0);
    for (const c of this.combatants) c.redirects = c.redirects.filter((r) => (r.protectorId === actor.id ? --r.turnsLeft > 0 : true));
    actor.hookTurnCount = {};
    actor.focusGainedThisTurn = 0;
    this.fireHooks(actor, 'owner_turn_start', null, null);
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
    const candidates = actor.def.skills.filter((s) => s.type !== 'passive' && this.usable(actor, s).ok);
    candidates.sort((a, b) => b.ai_priority - a.ai_priority);
    return candidates[0] ?? null;
  }

  private buildPrompt(actor: Combatant): TurnPrompt {
    const options: SkillOption[] = actor.def.skills
      .filter((s) => s.type !== 'passive')
      .map((s) => {
        const u = this.usable(actor, s);
        const needsTarget = s.player_target === 'enemy';
        const option: SkillOption = {
          skillId: s.skill_id,
          name: s.name_en,
          type: s.type,
          available: u.ok,
          cooldownLeft: actor.cooldowns[s.skill_id] ?? 0,
          needsTarget,
          legalTargets: needsTarget ? this.legalEnemyTargets(actor).map((t) => t.id) : [],
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
    if (skill.player_target === 'enemy') {
      const legal = this.legalEnemyTargets(actor).map((t) => t.id);
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
      const t = [...o.legalTargets.map((id) => this.unit(id))].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.slot - b.slot || (a.id < b.id ? -1 : 1))[0];
      if (!t) throw new IllegalActionError('no legal target');
      return { skillId: o.skillId, targetId: t.id };
    };
    const healer = ok.find((o) => o.type === 'active' && o.def.effect_ops.some((op) => op.op === 'heal'));
    const lowAlly = this.allies(actor).some((a) => a.hp / a.maxHp < this.rules.auto_battle.heal_priority_hp_percent / 100);
    if (healer && lowAlly) return target(healer);
    const ult = ok.find((o) => o.type === 'ultimate');
    if (ult && !this.rules.auto_battle.save_ultimate_until_boss) return target(ult);
    const active = ok.filter((o) => o.type === 'active').sort((a, b) => b.def.ai_priority - a.def.ai_priority)[0];
    if (active) return target(active);
    const basic = ok.find((o) => o.type === 'basic');
    if (!basic) throw new IllegalActionError('no usable skill');
    return target(basic);
  }

  // ---------------------------------------------------------------- execution

  private executeSkill(actor: Combatant, skill: SkillDef, chosen: Combatant | null): void {
    const kind = skill.type === 'passive' ? null : (skill.type as ActionKind);
    const ctx: Ctx = { actor, skill, chosen, prev: [], lastTargets: [], removedStacks: 0, eventSource: null, inHook: false, actionKind: kind };
    const firstOp = skill.effect_ops[0];
    const shown = firstOp ? this.resolve(firstOp.target_selector_id, ctx) : [];
    this.emit({ type: 'skill_used', actor: actor.id, skill: skill.skill_id, skillType: skill.type, targets: shown.map((t) => t.id) });
    if (skill.type === 'ultimate') actor.focus = Math.max(0, actor.focus - skill.focus_cost);
    for (const op of skill.effect_ops) this.applyOp(op, ctx);
    if (skill.type === 'basic') this.addFocus(actor, this.rules.focus.basic_gain, true);
    else if (skill.type === 'active') this.addFocus(actor, this.rules.focus.active_gain, true);
    if (skill.cooldown_turns > 0) actor.cooldowns[skill.skill_id] = skill.cooldown_turns;
  }

  private resolve(sel: TargetSelector, ctx: Ctx): Combatant[] {
    const a = ctx.actor;
    switch (sel) {
      case 'single_enemy': {
        const chosen = ctx.chosen;
        if (!chosen) return [];
        const taunter = this.tauntSource(a);
        const t = taunter ?? chosen;
        return t.alive ? [t] : [];
      }
      case 'single_enemy_default': {
        const t = this.pickDefaultTarget(a);
        return t ? [t] : [];
      }
      case 'all_enemies':
        return this.opponents(a);
      case 'front_row_enemies':
        return this.opponents(a).filter((c) => c.row === 'front');
      case 'rear_row_enemies':
        return this.opponents(a).filter((c) => c.row === 'rear');
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
    }
  }

  private byLowestHp(list: Combatant[]): Combatant[] {
    return [...list].sort((a, b) => a.hp - b.hp || a.slot - b.slot || (a.id < b.id ? -1 : 1));
  }

  private holds(pred: Predicate | undefined, ctx: Ctx, owner: Combatant): boolean {
    if (!pred) return true;
    switch (pred.predicate) {
      case 'last_target_has_status':
        return ctx.lastTargets.some((t) => this.hasStatus(t, pred.value));
      case 'owner_in_row':
        return owner.row === pred.value;
      case 'owner_hp_below_pct':
        return (owner.hp / owner.maxHp) * 100 < pred.value;
      case 'owner_has_shield':
        return this.shieldTotal(owner) > 0;
    }
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
        for (const t of targets) this.dealDamage(ctx, t, op, element, single);
        ctx.lastTargets = targets;
        break;
      }
      case 'heal': {
        for (const t of targets) {
          const raw = Math.floor(this.scale(ctx.actor, op.scale_stat) * op.multiplier);
          this.healUnit(ctx.actor, t, Math.max(1, Math.floor(raw * this.statusProduct(t, 'healing_received_multiplier'))));
        }
        break;
      }
      case 'apply_status': {
        for (const t of targets) {
          if (op.chance !== undefined && this.rng.next() >= op.chance) continue;
          this.applyStatus(ctx.actor, t, op.status_id, op.duration_turns);
        }
        break;
      }
      case 'remove_status': {
        for (const t of targets) {
          for (let n = 0; n < op.count; n++) {
            const cands = t.statuses.filter((s) => this.statusDefs.get(s.statusId)?.category === op.category).sort((a, b) => a.seq - b.seq);
            const victim = cands[0];
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
          const amount = Math.max(1, Math.floor(this.scale(ctx.actor, op.scale_stat) * op.multiplier));
          t.shields.push({ amount, turnsLeft: op.duration_turns });
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
        const per = Math.max(1, Math.floor(this.scale(ctx.actor, op.scale_stat) * op.multiplier * stacks));
        for (const t of targets.slice(0, op.maximum_targets)) this.healUnit(ctx.actor, t, Math.floor(per * this.statusProduct(t, 'healing_received_multiplier')));
        break;
      }
    }
    ctx.prev = targets;
  }

  private applyStatus(source: Combatant, target: Combatant, statusId: string, turns: number): void {
    if (!target.alive) return;
    if (!this.statusDefs.has(statusId)) throw new Error(`unknown status ${statusId}`);
    const existing = target.statuses.find((s) => s.statusId === statusId);
    if (existing) {
      existing.turnsLeft = Math.max(existing.turnsLeft, turns);
      existing.sourceId = source.id;
    } else {
      target.statuses.push({ statusId, turnsLeft: turns, sourceId: source.id, seq: ++this.statusSeq });
    }
    this.emit({ type: 'status_applied', source: source.id, target: target.id, status: statusId, turns });
  }

  private healUnit(source: Combatant, target: Combatant, amount: number): void {
    if (!target.alive || amount <= 0) return;
    const applied = Math.min(amount, target.maxHp - target.hp);
    target.hp += applied;
    this.emit({ type: 'heal', source: source.id, target: target.id, amount: applied, hpAfter: target.hp });
  }

  private addFocus(unit: Combatant, amount: number, scaled: boolean): void {
    if (!unit.alive) return;
    const gain = scaled ? Math.floor(amount * this.statusProduct(unit, 'focus_gain_multiplier')) : amount;
    const next = Math.min(this.rules.focus.maximum, unit.focus + gain);
    const delta = next - unit.focus;
    if (delta === 0) return;
    unit.focus = next;
    this.emit({ type: 'focus', unit: unit.id, delta, total: unit.focus });
  }

  // ---------------------------------------------------------------- damage

  private dealDamage(ctx: Ctx, target: Combatant, op: Extract<EffectOp, { op: 'damage' }>, element: Element, single: boolean): void {
    if (!target.alive) return;
    const attacker = ctx.actor;
    const defStat = op.damage_type === 'physical' ? this.effStat(target, 'def') : this.effStat(target, 'res');
    const elementMult = this.elementMultiplier(element, target);
    const crit = this.rng.next() < this.rules.crit.chance;
    let veilRes = 1;
    if (element === 'Veil') {
      let pct = 0;
      for (const m of target.mods) if (m.stat === 'veil_res' && m.mode === 'add_pct') pct += m.amount;
      veilRes = Math.max(0, 1 - pct);
    }
    const raw =
      this.scale(attacker, op.scale_stat === 'hp' ? 'hp' : op.scale_stat) *
      op.multiplier *
      (this.rules.defense_scale / (this.rules.defense_scale + Math.max(0, defStat))) *
      elementMult *
      this.statusProduct(attacker, 'outgoing_damage_multiplier') *
      this.statusProduct(target, 'damage_taken_multiplier') *
      veilRes *
      (crit ? this.rules.crit.multiplier : 1);
    const dmg = Math.max(1, Math.floor(raw + 1e-9));

    let toTarget = dmg;
    const redirect = single && ctx.actionKind ? target.redirects.find((r) => r.eligible.includes(ctx.actionKind as string)) : undefined;
    if (redirect) {
      const protector = this.combatants.find((c) => c.id === redirect.protectorId && c.alive);
      if (protector && protector !== target) {
        const share = roundHalfUp(dmg * redirect.fraction);
        toTarget = dmg - share;
        if (share > 0) this.receive(ctx, attacker, protector, share, crit, elementMult, op.no_focus_gain === true, target.id);
      }
    }
    if (toTarget > 0) this.receive(ctx, attacker, target, toTarget, crit, elementMult, op.no_focus_gain === true);
  }

  private receive(ctx: Ctx, source: Combatant, target: Combatant, amount: number, crit: boolean, elementMult: number, noFocus: boolean, redirectedFrom?: string): void {
    if (!target.alive) return;
    if (!ctx.inHook && ctx.actionKind) this.fireHooks(target, 'before_damage_received', source, ctx.actionKind);
    let remaining = amount;
    let absorbed = 0;
    while (remaining > 0 && target.shields.length > 0) {
      const s = target.shields[0];
      if (!s) break;
      const take = Math.min(s.amount, remaining);
      s.amount -= take;
      remaining -= take;
      absorbed += take;
      if (s.amount <= 0) target.shields.shift();
    }
    target.hp = Math.max(0, target.hp - remaining);
    const ev: BattleEvent = {
      type: 'damage',
      source: source.id,
      target: target.id,
      amount: remaining,
      absorbed,
      hpAfter: target.hp,
      crit,
      elementMultiplier: elementMult
    };
    if (redirectedFrom) ev.redirectedFrom = redirectedFrom;
    if (ctx.inHook) ev.counter = true;
    this.emit(ev);
    if (target.hp === 0) {
      target.alive = false;
      target.shields = [];
      target.statuses = [];
      target.mods = [];
      target.redirects = [];
      target.focus = 0;
      this.emit({ type: 'defeat', unit: target.id });
      return;
    }
    if (!noFocus && remaining + absorbed > 0) {
      const room = this.rules.focus.hit_gain_cap_per_turn - target.focusGainedThisTurn;
      const gain = Math.min(this.rules.focus.hit_gain, Math.max(0, room));
      if (gain > 0) {
        target.focusGainedThisTurn += gain;
        this.addFocus(target, gain, false);
      }
    }
  }

  // ---------------------------------------------------------------- hooks

  private fireHooks(owner: Combatant, event: EventHook['event'], source: Combatant | null, incoming: ActionKind | null): void {
    if (!owner.alive) return;
    for (const skill of owner.def.skills) {
      for (const [i, hook] of (skill.event_hooks ?? []).entries()) {
        if (hook.event !== event) continue;
        if (hook.event_filter && hook.event_filter.incoming_action_type !== incoming) continue;
        const ctx: Ctx = { actor: owner, skill, chosen: null, prev: [], lastTargets: [], removedStacks: 0, eventSource: source, inHook: true, actionKind: null };
        if (!this.holds(hook.condition, ctx, owner)) continue;
        const key = `${skill.skill_id}:${i}`;
        if (hook.limit?.per_battle !== undefined && (owner.hookBattleCount[key] ?? 0) >= hook.limit.per_battle) continue;
        if (hook.limit?.per_owner_turn !== undefined && (owner.hookTurnCount[key] ?? 0) >= hook.limit.per_owner_turn) continue;
        owner.hookBattleCount[key] = (owner.hookBattleCount[key] ?? 0) + 1;
        owner.hookTurnCount[key] = (owner.hookTurnCount[key] ?? 0) + 1;
        this.emit({ type: 'hook_triggered', unit: owner.id, skill: skill.skill_id, event });
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
        cooldowns: { ...c.cooldowns }
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
  }[];
  turn: number;
  awaiting: string | null;
}

export type { StatKey };
