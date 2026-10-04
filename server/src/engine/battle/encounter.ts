// Battle-local state that resolves passive hooks, waves and boss mechanics (port of core/battle/encounter_state.gd,
// LEGACY core/battle/encounter_state.py). It reaches its owning BattleService through `service`.
import { pyRepr, type BossObjective, type BossPhase, type Character, type EffectHook, type Enemy, type Stage } from "../content";
import type { CpythonRandom } from "../random";
import type { BattleAction } from "./auto";
import { ATTACK_ACTION_TYPES, type EffectInterpreter, type RawOperation } from "./interpreter";
import type { BattleService } from "./service";
import { BattleState } from "./state";
import { BattleUnit } from "./unit";
import { dget, dgetArray, dgetDict, isDict, removeFirstEqual, sortedBy, str, toBool, toFloat, toInt, truthy, type Dict } from "./util";

export type UnitRecord = Character | Enemy;

export const isCharacter = (record: unknown): record is Character =>
  record !== null && typeof record === "object" && "character_id" in record;
export const isEnemy = (record: unknown): record is Enemy => record !== null && typeof record === "object" && "enemy_id" in record;

const isUnit = (value: unknown): value is BattleUnit => value instanceof BattleUnit;
const entityIdOf = (unit: unknown): string | null => (isUnit(unit) ? unit.entity_id : null);
const teamOf = (unit: unknown): string | null => (isUnit(unit) ? unit.team : null);

const LIMIT_SCOPES = ["per_battle", "per_round", "per_owner_turn", "per_target_per_battle", "per_damage_action", "per_event"];

export class EncounterState extends BattleState {
  service!: BattleService;
  stage!: Stage;
  /** entity id -> Character | Enemy */
  records = new Map<string, UnitRecord>();
  wave_index = -1;
  next_wave_index = 0;
  phase_index = 0;
  current_phase: BossPhase | null = null;
  phase_transition_pending = false;
  owner_turn_counts = new Map<string, number>();
  hook_counts = new Map<string, number>();
  suppressed_passive_owners = new Set<string>();
  action_serial = 0;
  damage_action_serial = 0;
  hook_event_serial = 0;
  summon_serial = 0;
  telegraph_player_opportunities = 0;

  static create(newUnits: BattleUnit[], owningService: BattleService, encounterStage: Stage, unitRecords: ReadonlyMap<string, UnitRecord>): EncounterState {
    const state = new EncounterState();
    state.units = newUnits;
    state.gauge_rules = owningService.interpreter.gauge_rules;
    state.focus_rules = owningService.interpreter.focus_rules;
    state.service = owningService;
    state.stage = encounterStage;
    state.records = new Map(unitRecords);
    return state;
  }

  interpreter(): EffectInterpreter {
    return this.service.interpreter;
  }

  override serviceInterpreter(): EffectInterpreter {
    return this.service.interpreter;
  }

  override supportsPassives(): boolean {
    return true;
  }

  override recordOf(entityId: string): UnitRecord | null {
    return this.records.get(entityId) ?? null;
  }

  override ownerTurnCount(entityId: string): number {
    return this.owner_turn_counts.get(entityId) ?? 0;
  }

  override spawnSummons(enemyId: string, count: number): BattleUnit[] {
    return this.service.summonFactory(enemyId, count, this);
  }

  override nextDamageActionId(): number {
    this.damage_action_serial += 1;
    return this.damage_action_serial;
  }

  override isBattleOver(): boolean {
    if (this.livingUnits("player").length === 0) return true;
    if (this.next_wave_index < this.stage.enemy_waves.length) return false;
    return this.livingUnits("enemy").length === 0;
  }

  override startTurn(turnActor: BattleUnit): void {
    turnActor.hit_focus_gained_this_turn = 0;
    this.action_serial += 1;
    const ownerTurn = (this.owner_turn_counts.get(turnActor.entity_id) ?? 0) + 1;
    this.owner_turn_counts.set(turnActor.entity_id, ownerTurn);
    for (const unit of this.units) {
      unit.counters = unit.counters.filter(
        (counter) => !(dget(counter, "source_id") === turnActor.entity_id && ownerTurn > toInt(dget(counter, "source_turn_at_arm", 0))),
      );
    }
    super.startTurn(turnActor);
    this.refreshStatAuras();
    if (turnActor.alive) {
      this.dispatchBattleEvent("owner_turn_start", {
        actor: turnActor, source: turnActor, target: turnActor,
        action_type: "owner_turn_start", source_action_type: "owner_turn_start",
      }, this.service.interpreter);
    }
  }

  override endCycle(): void {
    this.dispatchBattleEvent("after_round_end", {
      actor: this.actor, source: this.actor, target: this.actor,
      action_type: "after_round_end", source_action_type: "after_round_end",
    }, this.service.interpreter);
    super.endCycle();
  }

  override resolveAction(turnActor: BattleUnit, chosen: unknown, _random: CpythonRandom): void {
    const action = chosen as BattleAction;
    if (action.skill_id === "__hold_telegraph__") {
      this.recordEvent({
        type: "boss_telegraph_held", boss_id: turnActor.entity_id,
        action_id: this.pending_telegraph !== null ? dget(this.pending_telegraph, "action_id") : null,
        round: this.round_number,
      });
      return;
    }
    const record = this.records.get(turnActor.entity_id);
    const skill = record !== undefined ? (record.skills.find((entry) => entry.skill_id === action.skill_id) ?? null) : null;
    if (skill === null || skill.type === "passive") {
      this.reportFault(`Invalid battle action ${pyRepr(action.skill_id)} for ${pyRepr(turnActor.entity_id)}`);
      return;
    }
    if ((turnActor.cooldowns.get(skill.skill_id) ?? 0) > 0) {
      this.reportFault(`Skill ${pyRepr(skill.skill_id)} is still on cooldown`);
      return;
    }
    if (turnActor.team === "player" && turnActor.focus < skill.focus_cost) {
      this.reportFault(`Skill ${pyRepr(skill.skill_id)} requires ${skill.focus_cost} Focus`);
      return;
    }
    turnActor.focus = Math.max(0, turnActor.focus - skill.focus_cost);
    this.recordEvent({ type: "action_started", actor_id: turnActor.entity_id, skill_id: skill.skill_id, action_type: skill.type, round: this.round_number });
    this.service.interpreter.executeSkill(skill, this, turnActor, skill.type, action.targets);
    if (skill.cooldown_turns !== 0) turnActor.cooldowns.set(skill.skill_id, skill.cooldown_turns);
    if (turnActor.team === "player") {
      turnActor.focus = Math.min(this.focus_rules.maximum, turnActor.focus + this.focus_rules.actionGain(skill.type));
      const hookEvent: Dict = {
        actor: turnActor, source: turnActor, target: turnActor,
        action_type: skill.type, source_action_type: skill.type, skill_id: skill.skill_id,
      };
      this.dispatchBattleEvent("after_ally_action", hookEvent, this.service.interpreter);
      if (skill.type === "ultimate") this.dispatchBattleEvent("after_ally_ultimate", hookEvent, this.service.interpreter);
    }
    this.recordEvent({ type: "action_completed", actor_id: turnActor.entity_id, skill_id: skill.skill_id, action_type: skill.type, round: this.round_number });
    this.advanceWaveIfCleared();
  }

  /** The (skill id, hook) pairs a record contributes. */
  private static hooksFor(record: UnitRecord | undefined): [string, EffectHook][] {
    const result: [string, EffectHook][] = [];
    if (isCharacter(record)) {
      for (const skill of record.skills) for (const hook of skill.event_hooks) result.push([skill.skill_id, hook]);
    } else if (isEnemy(record)) {
      record.passive_hooks.forEach((hook, index) => result.push([`${record.enemy_id}_passive_${index}`, hook]));
    }
    return result;
  }

  private static hookOwnerMatches(eventName: string, owner: BattleUnit, eventPayload: Dict, hook: EffectHook): boolean {
    const eventActor = dget(eventPayload, "actor");
    let source = dget(eventPayload, "source");
    const target = dget(eventPayload, "target");
    if (!truthy(source)) source = eventActor;
    const targetId = entityIdOf(target);
    const sourceId = entityIdOf(source);
    switch (eventName) {
      case "owner_turn_start":
        return owner.entity_id === entityIdOf(eventActor);
      case "before_damage_dealt":
      case "after_damage_dealt":
        return owner.entity_id === sourceId;
      case "before_damage_received":
      case "after_damage_received": {
        const referencesTeam = hook.effect_ops.some((op) => op.target_selector_id === "event_target");
        return owner.entity_id === targetId || (referencesTeam && owner.team === teamOf(target));
      }
      case "ally_damaged":
        return owner.team === teamOf(target) && owner.entity_id !== targetId;
      case "after_enemy_defeated":
        return owner.team === teamOf(source);
      case "ally_hp_threshold_crossed":
      case "after_ally_healed":
        return owner.team === teamOf(target);
      case "after_ally_action":
      case "after_ally_ultimate":
        return owner.team === teamOf(eventActor);
      case "after_round_end":
        return owner.team === "player";
    }
    return owner.entity_id === sourceId;
  }

  /** `EffectContractError` is raised by the reference for an unsupported filter field; the port reports it via `fault`. */
  private eventFilterMatches(filters: Dict, owner: BattleUnit, eventPayload: Dict): boolean {
    const eventActor = dget(eventPayload, "actor");
    let source = dget(eventPayload, "source");
    if (!truthy(source)) source = eventActor;
    const target = dget(eventPayload, "target");
    const actionTypeValue = str(dget(eventPayload, "source_action_type", dget(eventPayload, "action_type", "")));
    for (const [key, value] of Object.entries(filters)) {
      if (key === "incoming_action_type" || key === "ally_action_type") {
        if (actionTypeValue !== value) return false;
      } else if (key === "owner_action_type" || key === "damage_action_type") {
        if (value === "any_attack" || value === "basic_or_skill") {
          if (!ATTACK_ACTION_TYPES.includes(actionTypeValue)) return false;
        } else if (actionTypeValue !== value) {
          return false;
        }
      } else if (key === "team") {
        if (teamOf(target) !== value) return false;
      } else if (key === "event_target_faction_is") {
        let faction: string | null = null;
        if (isUnit(target)) faction = target.faction_id.length > 0 ? target.faction_id : target.team;
        if (faction !== value) return false;
      } else if (key === "source_is_owner") {
        if ((entityIdOf(source) === owner.entity_id) !== toBool(value)) return false;
      } else if (key === "exclude_owner") {
        if ((entityIdOf(eventActor) === owner.entity_id) === toBool(value)) return false;
      } else {
        this.reportFault(`Unsupported event_filter field ${pyRepr(key)}`);
        return false;
      }
    }
    return true;
  }

  private hookLimitKey(owner: BattleUnit, skillId: string, hook: EffectHook, limit: Dict, eventPayload: Dict): string {
    const scope = LIMIT_SCOPES.find((candidate) => truthy(dget(limit, candidate))) ?? "per_event";
    let value: unknown;
    switch (scope) {
      case "per_round":
        value = this.round_number;
        break;
      case "per_owner_turn":
        value = this.owner_turn_counts.get(owner.entity_id) ?? 0;
        break;
      case "per_target_per_battle": {
        const target = dget(eventPayload, "target");
        value = isUnit(target) ? target.entity_id : "";
        break;
      }
      case "per_damage_action":
        value = dget(eventPayload, "damage_action_id", this.action_serial);
        break;
      case "per_event":
        value = dget(eventPayload, "event_id", this.hook_event_serial);
        break;
      default:
        value = "battle";
    }
    return `${owner.entity_id}|${skillId}|${hook.event}|${scope}|${str(value)}`;
  }

  override dispatchBattleEvent(eventName: string, eventPayload: Dict, interpreterRef: EffectInterpreter): void {
    this.hook_event_serial += 1;
    const payload: Dict = { ...eventPayload };
    payload.name = eventName;
    payload.event_name = eventName;
    payload.event_id = this.hook_event_serial;
    payload.round_number = this.round_number;
    const previousEvent = this.event;
    this.event = payload;
    const owners = sortedBy(this.livingUnits(), (unit) => [unit.team === "player" ? 0 : 1, unit.slot_index, unit.entity_id]);
    for (const owner of owners) {
      if (this.suppressed_passive_owners.has(owner.entity_id)) continue;
      for (const [skillId, hook] of EncounterState.hooksFor(this.records.get(owner.entity_id))) {
        if (hook.event !== eventName || !EncounterState.hookOwnerMatches(eventName, owner, payload, hook)) continue;
        const filters = dgetDict(hook.extra, "event_filter");
        if (!this.eventFilterMatches(filters, owner, payload)) continue;
        const target = dget(payload, "target");
        if (eventName === "ally_hp_threshold_crossed") {
          const before = toFloat(dget(payload, "target_hp_before_pct", 0));
          const after = toFloat(dget(payload, "target_hp_after_pct", 0));
          if (!EncounterState.conditionThresholdCrossed(dget(hook.extra, "condition"), before, after)) continue;
        }
        const condition = dget(hook.extra, "condition");
        const previousConditionActor = this.actor;
        this.actor = owner;
        let conditionHolds = true;
        if (truthy(condition)) conditionHolds = interpreterRef.evaluateCondition(condition, this, isUnit(target) ? target : owner);
        this.actor = previousConditionActor;
        if (!conditionHolds) continue;
        const limit = dgetDict(hook.extra, "limit");
        if (truthy(dget(limit, "one_pending_bonus")) && owner.next_attack_bonuses.length > 0) continue;
        const key = this.hookLimitKey(owner, skillId, hook, limit, payload);
        if ((this.hook_counts.get(key) ?? 0) !== 0) continue;
        const chance = toFloat(dget(limit, "chance", 1.0));
        if (chance < 1.0 && (this.rng === null || this.rng.random() >= chance)) {
          this.hook_counts.set(key, 1);
          continue;
        }
        if (hook.effect_ops.length === 0) continue;
        const savedActor = this.actor;
        const savedActionType = this.action_type;
        const savedEvent: Dict = { ...this.event };
        const savedPreviousTargets = [...this.previous_operation_targets];
        const savedLastTarget = this.last_target;
        const savedLastPrimary = this.last_primary_target;
        const savedLastDamage = this.last_damage;
        const savedLastMaxHp = this.last_damage_target_max_hp;
        const savedLastDefeated = this.last_damage_target_defeated;
        const savedPrimaryDefeated = this.last_primary_target_defeated;
        this.suppressed_passive_owners.add(owner.entity_id);
        interpreterRef.executeEffectOps(hook.effect_ops, this, owner, "passive", null, payload, skillId);
        this.hook_counts.set(key, 1);
        this.recordEvent({ type: "passive_triggered", owner_id: owner.entity_id, skill_id: skillId, event: eventName, round: this.round_number });
        this.actor = savedActor;
        this.action_type = savedActionType;
        this.event = savedEvent;
        this.previous_operation_targets = savedPreviousTargets;
        this.last_target = savedLastTarget;
        this.last_primary_target = savedLastPrimary;
        this.last_damage = savedLastDamage;
        this.last_damage_target_max_hp = savedLastMaxHp;
        this.last_damage_target_defeated = savedLastDefeated;
        this.last_primary_target_defeated = savedPrimaryDefeated;
        this.suppressed_passive_owners.delete(owner.entity_id);
      }
    }
    if (eventName === "after_enemy_defeated") this.refreshStatAuras();
    this.event = previousEvent;
  }

  private static conditionThresholdCrossed(condition: unknown, before: number, after: number): boolean {
    if (!isDict(condition)) return false;
    if (dget(condition, "predicate") === "event_target_hp_at_or_below_pct") {
      return before > toFloat(condition.value) && toFloat(condition.value) >= after;
    }
    if (Object.hasOwn(condition, "all")) return (condition.all as unknown[]).some((item) => EncounterState.conditionThresholdCrossed(item, before, after));
    if (Object.hasOwn(condition, "any")) return (condition.any as unknown[]).some((item) => EncounterState.conditionThresholdCrossed(item, before, after));
    return true;
  }

  override continuousDamageMultiplier(eventName: string, eventPayload: Dict, interpreterRef: EffectInterpreter): number {
    const eventActor = dget(eventPayload, "actor");
    const target = dget(eventPayload, "target");
    const affectedUnit = eventName === "before_damage_dealt" ? eventActor : target;
    let multiplier = 1.0;
    const owners = sortedBy(this.livingUnits("player"), (unit) => [unit.slot_index, unit.entity_id]);
    for (const owner of owners) {
      const record = this.records.get(owner.entity_id);
      if (!isCharacter(record)) continue;
      for (const skill of record.skills) {
        for (const mod of skill.continuous_modifiers as Dict[]) {
          if (dget(mod, "event") !== eventName) continue;
          const applies = dget(mod, "applies_to", "self");
          if (applies === "self" && owner.entity_id !== entityIdOf(affectedUnit)) continue;
          if (applies === "all_allies_while_owner_alive" && owner.team !== teamOf(affectedUnit)) continue;
          if (applies !== "self" && applies !== "all_allies_while_owner_alive") {
            this.reportFault(`Unsupported continuous modifier applies_to ${pyRepr(applies)}`);
            return multiplier;
          }
          const oldActor = this.actor;
          const oldEvent = this.event;
          this.actor = owner;
          this.event = { ...eventPayload };
          if (interpreterRef.evaluateCondition(mod.condition, this, isUnit(target) ? target : null)) multiplier *= toFloat(mod.damage_multiplier);
          this.actor = oldActor;
          this.event = oldEvent;
        }
      }
    }
    return multiplier;
  }

  refreshStatAuras(): void {
    const prefix = "continuous_aura:";
    for (const unit of this.units) {
      unit.stat_modifiers = unit.stat_modifiers.filter((modifier) => !str(dget(modifier, "source_id", "")).startsWith(prefix));
    }
    for (const owner of this.livingUnits("player")) {
      const record = this.records.get(owner.entity_id);
      if (!isCharacter(record) || owner.row !== "rear") continue;
      for (const skill of record.skills) {
        for (const mod of skill.continuous_modifiers as Dict[]) {
          if (dget(mod, "event") !== "stat_snapshot") continue;
          for (const target of this.livingUnits("player")) {
            if (target.row === "front") {
              target.stat_modifiers.push({
                stat_id: mod.stat_id, mode: "percent", amount: toFloat(mod.amount),
                duration_turns: 999999, source_id: `${prefix}${owner.entity_id}:${skill.skill_id}`,
              });
            }
          }
        }
      }
    }
  }

  override objectiveDestroyed(objective: Dict, interpreterRef: EffectInterpreter, destroyingActor: BattleUnit): void {
    for (const operation of dget(objective, "on_destroyed", []) as RawOperation[]) {
      interpreterRef.executeEffectOps([operation], this, destroyingActor, "objective_break");
    }
    const objectiveId = str(objective.objective_id);
    for (const modifier of [...this.boss_modifiers]) {
      let remove = dget(modifier, "until_objective_destroyed") === objectiveId;
      const rule = dget(modifier, "while_any_objective_alive");
      if (isDict(rule)) {
        const ids = dgetArray(rule, "objective_ids");
        remove = remove || (ids.length > 0 && this.allDestroyed(ids));
      } else if (Array.isArray(rule)) {
        remove = remove || (rule.length > 0 && this.allDestroyed(rule));
      }
      if (remove) {
        interpreterRef.executeEffectOps(
          [{ op: "remove_boss_modifier", target_selector_id: "boss", modifier_id: modifier.modifier_id }], this, destroyingActor, "objective_break",
        );
      }
    }
    this.recordEvent({
      type: "boss_objective_destroyed", boss_id: this.boss !== null ? this.boss.entity_id : null,
      objective_id: objectiveId, round: this.round_number,
    });
    if (this.pending_telegraph !== null && this.telegraphInterrupted(this.pending_telegraph)) this.pending_telegraph.cancelled = true;
  }

  private allDestroyed(ids: readonly unknown[]): boolean {
    return ids.every((item) => toInt(dget(this.objectives.get(String(item)) ?? {}, "hp", 0)) <= 0);
  }

  override resolveBossTelegraphIfReady(turnActor: BattleUnit, _random: CpythonRandom): void {
    const pending = this.pending_telegraph;
    if (pending === null || turnActor.team !== "player") return;
    this.telegraph_player_opportunities += 1;
    if (toBool(dget(pending, "cancelled", false)) || this.telegraphInterrupted(pending)) {
      this.recordEvent({ type: "boss_telegraph_interrupted", boss_id: pending.boss_id, action_id: pending.action_id, round: this.round_number });
      this.pending_telegraph = null;
      this.phase_transition_pending = false;
      this.telegraph_player_opportunities = 0;
      return;
    }
    const needed = toInt(dget(pending, "player_actions_before_resolution", 1));
    if (this.telegraph_player_opportunities < needed) return;
    const bossUnit = this.findUnit(String(pending.boss_id));
    const enemy = this.records.get(String(pending.boss_id));
    const skill = isEnemy(enemy) ? (enemy.skills.find((item) => item.skill_id === pending.action_id) ?? null) : null;
    if (bossUnit !== null && bossUnit.alive && skill !== null) {
      this.recordEvent({ type: "boss_telegraph_resolved", boss_id: bossUnit.entity_id, action_id: skill.skill_id, round: this.round_number });
      const previousActor = this.actor;
      const previousAction = this.action_type;
      this.actor = bossUnit;
      this.action_type = "signature";
      this.service.interpreter.executeSkill(skill, this, bossUnit, "signature");
      if (skill.cooldown_turns !== 0) bossUnit.cooldowns.set(skill.skill_id, skill.cooldown_turns);
      this.actor = previousActor;
      this.action_type = previousAction;
    }
    this.pending_telegraph = null;
    this.telegraph_player_opportunities = 0;
    this.advanceWaveIfCleared();
  }

  private telegraphInterrupted(pending: Dict): boolean {
    const rules = dgetDict(pending, "intent_rules");
    const one = dget(rules, "interrupt_if_objective_destroyed");
    if (truthy(one) && toInt(dget(this.objectives.get(String(one)) ?? {}, "hp", 0)) <= 0) return true;
    const ids = dgetArray(rules, "interrupt_if_all_objectives_destroyed");
    return ids.length > 0 && this.allDestroyed(ids);
  }

  override resolvePhaseTransitionIfNeeded(_random: CpythonRandom): void {
    if (this.boss === null || !this.boss.alive) return;
    const enemy = this.records.get(this.boss.entity_id) as Enemy;
    if (this.phase_index + 1 >= enemy.phases.length) return;
    const contract = dgetDict(enemy.extra, "phase_transition_contract");
    const threshold = toFloat(dget(contract, "threshold_pct", 50.0));
    if (this.boss.hp * 100 > (this.boss.max_hp !== 0 ? this.boss.max_hp : 1) * threshold) return;
    if (this.pending_telegraph !== null && !toBool(dget(this.pending_telegraph, "cancelled", false))) {
      this.phase_transition_pending = true;
      return;
    }
    this.loadBossPhase(this.phase_index + 1, true);
  }

  override resolveReactions(turnActor: BattleUnit, _random: CpythonRandom): void {
    for (const counter of [...turnActor.counters]) {
      if (dget(counter, "event") !== "target_action_before_owner_next_turn") continue;
      removeFirstEqual(turnActor.counters, counter);
      const source = this.findUnit(str(dget(counter, "source_id", "")));
      if (source === null || !source.alive) continue;
      const op: Dict = {
        op: "damage", target_selector_id: "event_target", damage_type: counter.damage_type,
        scale_stat: counter.scale_stat, multiplier: counter.multiplier,
        no_focus_gain: true, can_trigger_passives: false,
      };
      this.service.interpreter.executeEffectOps([op], this, source, "counter", null, { actor: turnActor, source, target: turnActor });
    }
  }

  findUnit(entityId: string): BattleUnit | null {
    for (const unit of this.units) if (unit.entity_id === entityId) return unit;
    for (const objective of this.objectives.values()) {
      if (dget(objective, "entity_id") === entityId) return dget(objective, "unit") as BattleUnit | null;
    }
    return null;
  }

  advanceWaveIfCleared(): void {
    if (this.livingUnits("enemy").length > 0 || this.next_wave_index >= this.stage.enemy_waves.length) return;
    const index = this.next_wave_index;
    this.next_wave_index += 1;
    this.wave_index = index;
    this.service.spawnWave(this, index);
    this.recordEvent({ type: "enemy_wave_started", stage_id: this.stage.stage_id, wave_index: index, round: this.round_number });
  }

  loadBossPhase(newPhaseIndex: number, resetHealth: boolean): void {
    const boss = this.boss;
    if (boss === null) return;
    const enemy = this.records.get(boss.entity_id) as Enemy;
    const phase = enemy.phases[newPhaseIndex]!;
    const prior = this.objectives;
    this.phase_index = newPhaseIndex;
    this.current_phase = phase;
    const base = this.service.interpreter.progression.enemyStatsAtLevel(
      enemy.base_stats_level_1, enemy.growth_per_level, this.stage.enemy_level, this.stage.enemy_stat_multiplier,
    );
    const hp = Math.max(1, Math.trunc(toFloat(base.hp) * phase.hp_multiplier + 0.5));
    const stats: Dict = { ...base };
    stats.atk = Math.max(1, Math.trunc(toFloat(base.atk) * phase.atk_multiplier + 0.5));
    stats.def = Math.max(0, Math.trunc(toFloat(base.def) * phase.def_multiplier + 0.5));
    boss.stats = stats;
    boss.weaknesses = [...phase.weaknesses];
    // A phase-authored weakness replaces an inherited resistance for the same element; a live unit must never be both.
    boss.resistances = enemy.resistances.filter((element) => !phase.weaknesses.includes(element));
    boss.max_hp = hp;
    boss.hp = resetHealth ? hp : Math.min(hp, boss.hp !== 0 ? boss.hp : hp);
    // hp_multiplier defines a fresh, compact phase health bar; it is not a multiplier on a hidden total-health pool.
    const carried = new Map<string, Dict>();
    for (const [key, objective] of prior) {
      if (toBool(dget(objective, "persists_across_phases", false)) && toInt(dget(objective, "hp", 0)) > 0) carried.set(key, objective);
    }
    this.objectives = carried;
    for (const objective of phase.objectives) if (!this.objectives.has(objective.objective_id)) this.addObjective(objective);
    // Boss control immunities for the new phase.
    const bossImmunities = [...boss.status_immunities];
    for (const item of dgetArray(dgetDict(this.service.rules, "targeting"), "boss_control_immunities_default")) {
      if (!bossImmunities.includes(String(item))) bossImmunities.push(String(item));
    }
    boss.status_immunities = bossImmunities;
    if (resetHealth) {
      const contract = dgetDict(enemy.extra, "phase_transition_contract");
      const category = str(dget(contract, "clear_status_category", "debuff"));
      const keep = dget(contract, "preserve_status_ids", ["break"]) as unknown[];
      for (const statusId of [...boss.statuses.keys()]) {
        if (!keep.includes(statusId) && boss.statusTags(statusId, this.service.statuses).includes(category)) boss.statuses.delete(statusId);
      }
      this.recordEvent({
        type: "boss_phase_changed", boss_id: boss.entity_id, phase_id: phase.phase_id,
        phase_index: newPhaseIndex, hp: boss.hp, max_hp: boss.max_hp, round: this.round_number,
      });
    }
    const operations: RawOperation[] = [...phase.enter_ops, ...phase.passive_ops];
    if (operations.length > 0) this.service.interpreter.executeEffectOps(operations, this, boss, "boss_phase");
  }

  private addObjective(objective: BossObjective): void {
    const boss = this.boss!;
    const unit = BattleUnit.build({
      entity_id: `${boss.entity_id}:objective:${objective.objective_id}`,
      team: "enemy", slot_index: boss.slot_index, row: "rear",
      stats: { hp: objective.max_hp, atk: 0, def: 0, spd: 1 },
      hp: objective.hp, max_hp: objective.max_hp, element: boss.element,
      is_objective: true, objective_id: objective.objective_id,
      stat_resolution_rules: this.service.rules.stat_resolution as Dict, status_definitions: this.service.statuses,
    });
    this.objectives.set(objective.objective_id, {
      objective_id: objective.objective_id, name_en: objective.name_en,
      hp: objective.hp, max_hp: objective.max_hp,
      unit, entity_id: unit.entity_id,
      targetable_by_player: objective.targetable_by_player,
      persists_across_phases: objective.persists_across_phases === true,
      on_destroyed: objective.on_destroyed,
      destroyed: objective.hp <= 0,
    });
  }
}

