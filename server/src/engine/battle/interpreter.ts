// Strict interpreter for the `battle_effects_part1.json` operation records (port of core/battle/effect_interpreter.gd,
// LEGACY core/battle/interpreter.py).
//
// A complete operation list is validated before any battle state is touched. Unknown operations, fields, selector ids,
// predicates, events and statuses are errors; authored content is never silently skipped. The reference raises
// EffectContractError/EffectExecutionError; as in the GDScript port the message lands in `error` (and in
// `BattleState.fault` while a battle runs) and the call returns what it has. Construction problems throw
// BattleSetupError.
//
// Numbers: the reference's float maths is kept operation for operation (doubles), and every `int(...)` truncation and
// `int(x + 0.5)` half-up rounding is written out the same way, because damage, healing and shields are decided there.
import { pyRepr, type ContentRegistry, type EffectOp, type Skill } from "../content";
import { Frac } from "../frac";
import { Progression } from "../progression";
import { CpythonRandom } from "../random";
import { attackerOfUnit, calculateDamage, scaledAttacker } from "./damage";
import { BattleSetupError } from "./errors";
import { delayNextAction } from "./gauge";
import { FocusRules, GaugeRules } from "./rules";
import type { BattleState } from "./state";
import type { BattleUnit } from "./unit";
import {
  dget, dgetArray, dgetDict, isDict, keysInOrder, removeFirstEqual, sortedBy, str, toBool, toFloat, toInt, truthy,
  type Dict, type SortKey,
} from "./util";

const PREDICATE_VALUE_REQUIRED = [
  "owner_in_row", "owner_hp_below_pct", "owner_hp_above_pct",
  "owner_has_status", "owner_action_type", "last_target_has_status",
  "last_target_has_status_tag", "target_has_status", "target_has_status_tag",
  "target_has_any_status_tag", "target_in_row", "event_target_hp_at_or_below_pct",
  "event_target_had_status", "event_source_faction_is", "count_enemies_with_status",
  "enemy_ally_hp_below_pct", "no_enemy_ally_below_pct",
  "damage_dealt_at_least_pct_of_target_hp", "round_number_at_most",
];
const IMPLEMENTED_PREDICATES = [
  "owner_in_row", "owner_hp_below_pct", "owner_hp_above_pct", "owner_has_shield",
  "owner_has_status", "owner_action_type", "owner_took_no_damage_this_round",
  "last_target_has_status", "last_target_has_status_tag", "last_target_defeated",
  "last_primary_target_defeated", "target_has_status", "target_has_status_tag",
  "target_has_any_status_tag", "target_has_acted_this_battle", "target_in_row",
  "event_target_hp_at_or_below_pct", "event_target_had_status", "event_actor_has_any_buff",
  "event_source_faction_is", "count_enemies_with_status", "enemy_ally_hp_below_pct",
  "no_enemy_ally_below_pct", "damage_dealt_at_least_pct_of_target_hp",
  "round_number_at_most",
];
const KNOWN_SELECTOR_KINDS = [
  "manual_single", "row_priority_single", "all_by_row", "all_living",
  "minimum_stat", "maximum_stat", "minimum_stat_by_row",
  "random_excluding_last_primary", "ordered_minimum_stat_set", "event_reference",
  "previous_operation_result", "previous_successful_heal_target", "actor",
  "encounter_boss", "actor_plus_minimum_stat", "actor_plus_tagged_allies",
  "boss_plus_tagged_allies", "maximum_missing_hp", "lowest_hp_with_status",
  "maximum_status_count",
];
export const OPERATIONS = [
  "damage", "heal", "heal_per_removed_status", "grant_shield", "apply_status", "remove_status",
  "reduce_status_durations", "modify_stat", "modify_incoming_damage", "modify_outgoing_damage",
  "grant_damage_reduction", "grant_redirect", "grant_intercept", "grant_first_hit_guard", "grant_opening_guard",
  "gain_focus", "delay_next_action", "reduce_cooldowns", "apply_regeneration", "arm_counter",
  "arm_next_attack_bonus", "grant_status_immunity", "remove_shield", "copy_buff", "block_attack", "pay_hp_cost",
  "boss_damage_taken_modifier", "summon_enemies", "cancel_boss_telegraph", "remove_boss_modifier",
  "remove_copied_statuses", "clear_status_if_all_objectives_destroyed",
];
const RANK_SCALED_OPS = ["damage", "heal", "heal_per_removed_status", "grant_shield"];
const DAMAGE_TYPE_NAMES = ["physical", "magic", "elemental"];
const TAG_ALIASES: Record<string, string[]> = { mark_or_dread: ["mark", "dread"] };
export const ATTACK_ACTION_TYPES = ["basic", "active", "ultimate", "signature", "counter"];
const MINIMUM_STAT_KINDS = ["minimum_stat", "maximum_stat", "minimum_stat_by_row", "maximum_missing_hp", "lowest_hp_with_status", "maximum_status_count"];
const CONDITION_KEYS = ["all", "any", "not", "predicate", "value"];
const MODIFIER_KEYS = ["condition", "multiplier", "add_multiplier_per_count", "maximum_count"];

/** An operation as authored content (EffectOp record) or as a plain dictionary (`{"op": ..., ...}`). */
export type RawOperation = EffectOp | Dict;

/** The outcome of one operation (`OperationResult` in the reference). */
export class OperationResult {
  operation = "";
  target_ids: string[] = [];
  damage: Dict[] = [];
  healing: Dict[] = [];
  statuses_applied: Dict[] = [];
  details: Dict = {};
}

type Recipient = [BattleUnit, number, string | null];

const isEffectOp = (raw: RawOperation): raw is EffectOp =>
  isDict(raw) && Object.keys(raw).length === 3 && typeof raw.op === "string" && isDict(raw.parameters) && Object.hasOwn(raw, "target_selector_id");

const isUnit = (value: unknown): value is BattleUnit => value !== null && typeof value === "object" && "entity_id" in value && "statuses" in value;

export class EffectInterpreter {
  contract: Dict = {};
  schemas: Record<string, Dict> = {};
  selector_rules: Dict = {};
  predicates: unknown[] = [];
  events: unknown[] = [];
  rules: Dict = {};
  /** status id -> authored status definition */
  status_definitions: Dict = {};
  gauge_rules: GaugeRules = new GaugeRules();
  focus_rules: FocusRules = new FocusRules();
  damage_rules: Dict = {};
  stat_resolution_rules: Dict = {};
  rng: CpythonRandom = new CpythonRandom();
  progression!: Progression;

  /** First contract/execution problem of the current call ("" = none); reset by the public entry points. */
  error = "";

  static create(registry: ContentRegistry, initialRng: CpythonRandom | null = null): EffectInterpreter {
    const interpreter = new EffectInterpreter();
    interpreter.rules = registry.battle_rules as Dict;
    interpreter.contract = registry.effect_contract as Dict;
    interpreter.schemas = registry.effect_operation_schemas as Record<string, Dict>;
    const selectorValue = dget(interpreter.contract, "selector_rules");
    interpreter.selector_rules = isDict(selectorValue) ? selectorValue : {};
    interpreter.predicates = dget(interpreter.contract, "predicates", []) as unknown[];
    interpreter.events = dget(interpreter.contract, "events", []) as unknown[];
    for (const predicate of interpreter.predicates) {
      if (!IMPLEMENTED_PREDICATES.includes(String(predicate))) {
        throw new BattleSetupError(`Contract predicates have no evaluator: ${pyRepr(predicate)}`);
      }
    }
    for (const status of dgetArray(interpreter.rules, "statuses") as Dict[]) {
      interpreter.status_definitions[String(status.status_id)] = status;
    }
    interpreter.gauge_rules = GaugeRules.fromMapping(interpreter.rules.turn_queue as Dict);
    interpreter.focus_rules = FocusRules.fromMapping(interpreter.rules.focus as Dict);
    interpreter.damage_rules = interpreter.rules.damage as Dict;
    interpreter.stat_resolution_rules = interpreter.rules.stat_resolution as Dict;
    interpreter.rng = initialRng ?? new CpythonRandom();
    interpreter.progression = Progression.create(registry);
    const missing = Object.keys(interpreter.schemas).filter((name) => !OPERATIONS.includes(name));
    const extra = OPERATIONS.filter((operation) => !Object.hasOwn(interpreter.schemas, operation));
    if (missing.length > 0 || extra.length > 0) {
      throw new BattleSetupError(`Interpreter/schema operation mismatch: missing=${pyRepr(missing)}, extra=${pyRepr(extra)}`);
    }
    for (const rule of Object.values(interpreter.selector_rules) as Dict[]) {
      if (!KNOWN_SELECTOR_KINDS.includes(String(dget(rule, "kind", "")))) {
        throw new BattleSetupError(`Selector kinds have no resolver: ${pyRepr(dget(rule, "kind"))}`);
      }
    }
    return interpreter;
  }

  private fail(message: string): void {
    if (this.error.length === 0) this.error = message;
  }

  // -- validation ------------------------------------------------------------------------------------

  /** The normalized (Dictionary) form of an operation given as a dictionary or an EffectOp record. */
  private normalizeOperation(raw: RawOperation): Dict {
    if (isEffectOp(raw)) {
      const operation: Dict = { ...raw.parameters };
      operation.op = raw.op;
      if (raw.target_selector_id !== null && raw.target_selector_id.length > 0) operation.target_selector_id = raw.target_selector_id;
      return operation;
    }
    return { ...raw };
  }

  /**
   * Validates every operation (closed schema, selectors, statuses, events, damage types, conditions) and returns the
   * normalized operations; an empty array with `error` set on the first problem.
   */
  validateEffectOps(effectOps: readonly RawOperation[]): Dict[] {
    const normalized: Dict[] = [];
    let index = 0;
    for (const raw of effectOps) {
      const operation = this.normalizeOperation(raw);
      const opName = dget(operation, "op");
      if (typeof opName !== "string" || !Object.hasOwn(this.schemas, opName)) {
        this.fail(`effect_ops[${index}]: unknown operation ${pyRepr(opName)}`);
        return [];
      }
      const schema = this.schemas[opName]!;
      const required = dget(schema, "required", []) as unknown[];
      const optional = dget(schema, "optional", []) as unknown[];
      const missing = (required as string[]).filter((field) => !Object.hasOwn(operation, field));
      const unknown = Object.keys(operation).filter((field) => field !== "op" && !required.includes(field) && !optional.includes(field));
      missing.sort();
      unknown.sort();
      if (missing.length > 0) {
        this.fail(`effect_ops[${index}] (${opName}): missing fields ${pyRepr(missing)}`);
        return [];
      }
      if (unknown.length > 0) {
        this.fail(`effect_ops[${index}] (${opName}): unknown fields ${pyRepr(unknown)}`);
        return [];
      }
      for (const fieldName of ["target_selector_id", "source_selector_id", "protected_ally_selector_id"]) {
        const selectorId = dget(operation, fieldName);
        if (selectorId !== null && !Object.hasOwn(this.selector_rules, String(selectorId))) {
          this.fail(`effect_ops[${index}] (${opName}): unknown ${fieldName} ${pyRepr(selectorId)}`);
          return [];
        }
      }
      const statusId = dget(operation, "status_id");
      if (statusId !== null && !Object.hasOwn(this.status_definitions, String(statusId))) {
        this.fail(`effect_ops[${index}] (${opName}): unknown status_id ${pyRepr(statusId)}`);
        return [];
      }
      const eventName = dget(operation, "event");
      if (eventName !== null && !this.events.includes(eventName)) {
        this.fail(`effect_ops[${index}] (${opName}): unknown event ${pyRepr(eventName)}`);
        return [];
      }
      const damageType = dget(operation, "damage_type");
      if (damageType !== null && !DAMAGE_TYPE_NAMES.includes(String(damageType))) {
        this.fail(`effect_ops[${index}] (${opName}): invalid damage_type ${pyRepr(damageType)}`);
        return [];
      }
      this.validateConditions(operation, `effect_ops[${index}]`);
      if (this.error.length > 0) return [];
      normalized.push(operation);
      index++;
    }
    return normalized;
  }

  private validateConditions(operation: Dict, location: string): void {
    if (Object.hasOwn(operation, "when")) this.validateCondition(operation.when, `${location}.when`);
    const modifiers = dget(operation, "modifiers", []);
    if (!truthy(modifiers)) return;
    if (!Array.isArray(modifiers)) {
      this.fail(`${location}.modifiers must be an array`);
      return;
    }
    let index = 0;
    for (const modifier of modifiers) {
      if (!isDict(modifier)) {
        this.fail(`${location}.modifiers[${index}] must be an object`);
        return;
      }
      const unknown = Object.keys(modifier).filter((key) => !MODIFIER_KEYS.includes(key)).sort();
      if (unknown.length > 0) {
        this.fail(`${location}.modifiers[${index}]: unknown fields ${pyRepr(unknown)}`);
        return;
      }
      if (!Object.hasOwn(modifier, "condition")) {
        this.fail(`${location}.modifiers[${index}]: condition is required`);
        return;
      }
      this.validateCondition(modifier.condition, `${location}.modifiers[${index}].condition`);
      index++;
    }
  }

  private validateCondition(condition: unknown, location: string): void {
    if (!isDict(condition)) {
      this.fail(`${location}: a condition must be an object`);
      return;
    }
    const map = condition;
    if (Object.keys(map).length === 0) {
      this.fail(`${location}: an empty condition is invalid`);
      return;
    }
    const unknown = Object.keys(map).filter((key) => !CONDITION_KEYS.includes(key)).sort();
    if (unknown.length > 0) {
      this.fail(`${location}: unknown condition fields ${pyRepr(unknown)}`);
      return;
    }
    const branches = ["all", "any", "not", "predicate"].filter((key) => Object.hasOwn(map, key)).length;
    if (branches !== 1) {
      this.fail(`${location}: use exactly one of all, any, not, or predicate`);
      return;
    }
    if (Object.hasOwn(map, "all") || Object.hasOwn(map, "any")) {
      const key = Object.hasOwn(map, "all") ? "all" : "any";
      const values = map[key];
      if (!Array.isArray(values) || values.length === 0) {
        this.fail(`${location}.${key}: expected a non-empty condition array`);
        return;
      }
      values.forEach((nested, index) => this.validateCondition(nested, `${location}.${key}[${index}]`));
      if (Object.hasOwn(map, "value")) this.fail(`${location}: boolean group cannot carry value`);
      return;
    }
    if (Object.hasOwn(map, "not")) {
      this.validateCondition(map.not, `${location}.not`);
      if (Object.hasOwn(map, "value")) this.fail(`${location}: not-group cannot carry value`);
      return;
    }
    const predicate = dget(map, "predicate");
    if (!this.predicates.includes(predicate)) {
      this.fail(`${location}: unknown predicate ${pyRepr(predicate)}`);
      return;
    }
    if (PREDICATE_VALUE_REQUIRED.includes(String(predicate)) && !Object.hasOwn(map, "value")) {
      this.fail(`${location}: predicate ${pyRepr(predicate)} requires value`);
    }
  }

  // -- execution -------------------------------------------------------------------------------------

  /** Runs a skill's effect_ops (`type` and `skill_id` come from the record). */
  executeSkill(
    skill: Skill,
    state: BattleState,
    actor: BattleUnit,
    skillActionType = "",
    manualTargets: ReadonlyMap<string, unknown> = new Map(),
    eventPayload: Dict | null = null,
  ): OperationResult[] {
    return this.executeEffectOps(
      skill.effect_ops, state, actor, skillActionType.length > 0 ? skillActionType : skill.type, manualTargets, eventPayload, skill.skill_id,
    );
  }

  /**
   * Validates then runs `effectOps` for `actor`. `manualTargets` maps selector id -> ids; `eventPayload` seeds the
   * state's event (hook payloads). `skillId` selects the skill rank scaling.
   */
  executeEffectOps(
    effectOps: readonly RawOperation[],
    state: BattleState,
    actor: BattleUnit | null = null,
    opActionType = "skill",
    manualTargets: ReadonlyMap<string, unknown> | null = null,
    eventPayload: Dict | null = null,
    skillId = "",
  ): OperationResult[] {
    this.error = "";
    const results: OperationResult[] = [];
    let operations = this.validateEffectOps(effectOps);
    if (this.error.length > 0) {
      state.reportFault(this.error);
      return results;
    }
    const acting = actor ?? state.actor;
    if (acting === null) {
      state.reportFault("An actor is required to execute effect_ops");
      return results;
    }
    operations = this.applySkillRank(operations, acting, skillId);
    state.actor = acting;
    state.action_type = opActionType;
    state.gauge_rules = this.gauge_rules;
    for (const unit of state.units) {
      unit.stat_resolution_rules = this.stat_resolution_rules;
      unit.status_definitions = this.status_definitions;
    }
    if (state.rng === null) state.rng = this.rng;
    // The battle loop owns one seeded stream shared by target rolls, status chances and per-hit critical checks.
    else this.rng = state.rng;
    if (manualTargets !== null) {
      const mapped = new Map<string, string[]>();
      for (const [key, value] of manualTargets) mapped.set(key, EffectInterpreter.ids(value));
      state.manual_targets = mapped;
    }
    if (eventPayload !== null) state.event = { ...eventPayload };
    for (const operation of operations) {
      const opName = operation.op as string;
      const selectorId = dget(operation, "target_selector_id");
      let targets: BattleUnit[] = [];
      if (selectorId !== null && truthy(selectorId)) targets = this.resolveSelector(String(selectorId), state, operation);
      if (dget(operation, "when") !== null) {
        targets = targets.filter((candidate) => this.evaluateCondition(operation.when, state, candidate));
        // Owner-only effects (e.g. a conditional focus gain) with an empty selector still need their owner condition.
        if (selectorId !== null && truthy(selectorId) && targets.length === 0) {
          state.previous_operation_targets = [];
          const skipped = new OperationResult();
          skipped.operation = opName;
          results.push(skipped);
          continue;
        }
      }
      state.previous_operation_targets = [...targets];
      const result = this.runHandler(opName, operation, state, targets);
      if (this.error.length > 0) {
        state.reportFault(this.error);
        return results;
      }
      results.push(result);
      state.log.push({
        event: "effect_operation", operation: opName, actor_id: acting.entity_id,
        target_ids: [...result.target_ids], details: { ...result.details },
      });
      EffectInterpreter.publishPresentationEvents(result, state, acting.entity_id);
    }
    return results;
  }

  private runHandler(opName: string, operation: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    switch (opName) {
      case "damage": return this.opDamage(operation, state, targets);
      case "heal": return this.opHeal(operation, state, targets);
      case "heal_per_removed_status": return this.opHealPerRemovedStatus(operation, state, targets);
      case "grant_shield": return this.opGrantShield(operation, state, targets);
      case "apply_status": return this.opApplyStatus(operation, state, targets);
      case "remove_status": return this.opRemoveStatus(operation, state, targets);
      case "reduce_status_durations": return this.opReduceStatusDurations(operation, targets);
      case "modify_stat": return this.opModifyStat(operation, state, targets);
      case "modify_incoming_damage":
      case "modify_outgoing_damage": return this.opDamageModifier(operation, state, targets);
      case "grant_damage_reduction": return this.opGrantDamageReduction(operation, state, targets);
      case "grant_redirect": return this.opGrantRedirect(operation, state, targets);
      case "grant_intercept": return this.opGrantIntercept(operation, state, targets);
      case "grant_first_hit_guard": return this.opFirstHitGuard(operation, targets);
      case "grant_opening_guard": return this.opOpeningGuard(operation, targets);
      case "gain_focus": return this.opGainFocus(operation, state, targets);
      case "delay_next_action": return this.opDelayNextAction(operation, targets);
      case "reduce_cooldowns": return this.opReduceCooldowns(operation, targets);
      case "apply_regeneration": return this.opRegeneration(operation, state, targets);
      case "arm_counter": return this.opArmCounter(operation, state, targets);
      case "arm_next_attack_bonus": return this.opNextAttackBonus(operation, targets);
      case "grant_status_immunity": return this.opStatusImmunity(operation, targets);
      case "remove_shield": return this.opRemoveShield(operation, targets);
      case "copy_buff": return this.opCopyBuff(operation, state, targets);
      case "block_attack": return this.opBlockAttack(operation, targets);
      case "pay_hp_cost": return this.opPayHpCost(operation, targets);
      case "boss_damage_taken_modifier": return this.opBossDamageModifier(operation, state, targets);
      case "summon_enemies": return this.opSummon(operation, state, targets);
      case "cancel_boss_telegraph": return this.opCancelTelegraph(operation, state, targets);
      case "remove_boss_modifier": return this.opRemoveBossModifier(operation, state, targets);
      case "remove_copied_statuses": return this.opRemoveCopiedStatuses(operation, targets);
      case "clear_status_if_all_objectives_destroyed": return this.opClearStatusIfObjectivesDestroyed(operation, state, targets);
    }
    this.fail(`Interpreter has no handler for operation ${opName}`);
    return new OperationResult();
  }

  /**
   * Compact state-change events for presentation adapters (separate from `state.log` so a UI observer cannot change
   * authored applied-order values or replay data).
   */
  private static publishPresentationEvents(result: OperationResult, state: BattleState, sourceId: string): void {
    const byId = new Map<string, BattleUnit>();
    for (const unit of state.units) byId.set(unit.entity_id, unit);
    for (const record of result.damage) {
      const targetId = EffectInterpreter.firstText(dget(record, "recipient_id"), dget(record, "target_id"));
      const target = byId.get(targetId) ?? null;
      state.recordEvent({
        type: "damage_dealt", source_id: sourceId, target_id: targetId,
        amount: toInt(dget(record, "damage", 0)), hp_damage: toInt(dget(record, "hp_damage", 0)),
        shield_absorbed: toInt(dget(record, "shield_absorbed", 0)),
        hp: target !== null ? target.hp : null,
        max_hp: target !== null ? target.max_hp : null,
        alive: target !== null ? target.alive : null,
        damage_type: dget(record, "damage_type"), element: dget(record, "element"),
        critical: toBool(dget(record, "critical", false)),
      });
    }
    for (const record of result.healing) {
      const targetId = str(dget(record, "target_id", ""));
      const target = byId.get(targetId) ?? null;
      state.recordEvent({
        type: "healing_applied", source_id: sourceId, target_id: targetId,
        amount: toInt(dget(record, "healing", 0)),
        hp: target !== null ? target.hp : null,
        max_hp: target !== null ? target.max_hp : null,
        alive: target !== null ? target.alive : null,
      });
    }
    for (const record of result.statuses_applied) {
      const targetId = str(dget(record, "target_id", ""));
      const target = byId.get(targetId) ?? null;
      state.recordEvent({
        type: "status_applied", source_id: sourceId, target_id: targetId,
        status_id: str(dget(record, "status_id", "")),
        duration_turns: toInt(dget(record, "duration_turns", 0)),
        statuses: target !== null ? [...target.statuses.keys()].sort() : [],
        hp: target !== null ? target.hp : null,
        max_hp: target !== null ? target.max_hp : null,
      });
    }
  }

  /** `str(record.get("recipient_id") or record.get("target_id") or "")`. */
  private static firstText(first: unknown, second: unknown): string {
    if (truthy(first)) return str(first);
    if (truthy(second)) return str(second);
    return "";
  }

  // -- selectors -------------------------------------------------------------------------------------

  resolveSelector(selectorId: string, state: BattleState, operation: Dict = {}): BattleUnit[] {
    if (selectorId.length === 0) return [];
    if (!Object.hasOwn(this.selector_rules, selectorId)) {
      this.fail(`Unknown target_selector_id ${pyRepr(selectorId)}`);
      return [];
    }
    const rule = this.selector_rules[selectorId] as Dict;
    const kind = rule.kind as string;
    const actor = state.actor;
    if (kind === "actor") return actor !== null && actor.alive ? [actor] : [];
    if (kind === "encounter_boss") {
      let boss = state.boss;
      if (boss === null) boss = state.units.find((unit) => unit.is_boss && unit.alive) ?? null;
      return boss !== null ? [boss] : [];
    }
    if (kind === "event_reference") {
      const unitRef = EffectInterpreter.resolveUnitReference(dget(state.event, String(rule.reference)), state);
      return unitRef !== null ? [unitRef] : [];
    }
    if (kind === "previous_operation_result") return state.previous_operation_targets.filter((unit) => unit.alive);
    if (kind === "previous_successful_heal_target") return state.previous_successful_heal_targets.filter((unit) => unit.alive);
    if (kind === "manual_single") {
      const forcedTarget = this.tauntForcedTarget(state, dget(rule, "side"));
      if (forcedTarget !== null) return [forcedTarget];
      const selectedIds = state.manual_targets.get(selectorId) ?? [];
      if (selectedIds.length > 0) {
        const candidatesManual = this.sideUnits(dget(rule, "side"), state);
        let picked: BattleUnit | null = null;
        for (const entityId of selectedIds) {
          picked = candidatesManual.find((candidate) => candidate.entity_id === entityId && candidate.alive) ?? null;
          if (picked !== null) break;
        }
        if (picked === null && dget(rule, "side") === "opposing") {
          for (const entityId of selectedIds) {
            let objective: Dict | null = state.objectives.get(entityId) ?? null;
            if (objective === null) {
              for (const candidateObjective of state.objectives.values()) {
                if (dget(candidateObjective, "entity_id") === entityId) {
                  objective = candidateObjective;
                  break;
                }
              }
            }
            const objectiveUnit = objective !== null ? (dget(objective, "unit") as BattleUnit | null) : null;
            if (objectiveUnit !== null && objectiveUnit.alive && objectiveUnit.hp > 0 && toBool(dget(objective!, "targetable_by_player", true))) {
              picked = objectiveUnit;
              break;
            }
          }
        }
        return picked !== null ? [picked] : [];
      }
      if (!state.automatic) return [];
      const fallback = dget(rule, "auto_fallback");
      return fallback !== null && truthy(fallback) ? this.resolveSelector(String(fallback), state, operation) : [];
    }
    const candidates = this.sideUnits(dget(rule, "side"), state);
    if (kind === "all_living") return EffectInterpreter.sortUnits(candidates);
    if (kind === "all_by_row") return EffectInterpreter.sortUnits(candidates.filter((unit) => unit.row === rule.row));
    if (kind === "row_priority_single") {
      const forced = this.tauntForcedTarget(state, dget(rule, "side"));
      if (forced !== null) return [forced];
      for (const row of dget(rule, "row_priority", ["front", "rear"]) as unknown[]) {
        const rowUnits = candidates.filter((unit) => unit.row === row);
        if (rowUnits.length > 0) return [EffectInterpreter.sortUnits(rowUnits)[0]!];
      }
      return [];
    }
    if (MINIMUM_STAT_KINDS.includes(kind)) {
      let pool = candidates;
      if (kind === "minimum_stat_by_row") pool = pool.filter((unit) => unit.row === rule.row);
      else if (kind === "lowest_hp_with_status") pool = pool.filter((unit) => unit.hasStatus(String(rule.status_id)));
      let reverse = false;
      let statFn: (unit: BattleUnit) => number;
      if (kind === "maximum_status_count") {
        const category = dget(rule, "status_category");
        statFn = (unit) => this.categoryStatusCount(unit, category);
        reverse = true;
      } else if (kind === "maximum_missing_hp") {
        statFn = (unit) => unit.max_hp - unit.hp;
        reverse = true;
      } else {
        const statName = dget(rule, "stat");
        statFn = (unit) => this.statValue(unit, statName);
        reverse = kind === "maximum_stat";
      }
      if (pool.length === 0 && kind === "lowest_hp_with_status" && truthy(dget(rule, "empty_fallback"))) {
        return this.resolveSelector(String(rule.empty_fallback), state, operation);
      }
      return this.ranked(pool, statFn, reverse, dget(rule, "tie_break", []) as unknown[]).slice(0, 1);
    }
    if (kind === "ordered_minimum_stat_set") {
      const statNameSet = dget(rule, "stat");
      const rankedSet = this.ranked(candidates, (unit) => this.statValue(unit, statNameSet), false, dget(rule, "tie_break", []) as unknown[]);
      const maximum = Object.keys(operation).length > 0 ? dget(operation, "maximum_targets", rankedSet.length) : rankedSet.length;
      const limit = maximum === null || maximum === "all" ? rankedSet.length : Math.max(0, toInt(maximum));
      return rankedSet.slice(0, limit);
    }
    if (kind === "random_excluding_last_primary") {
      const primary = state.last_primary_target;
      const options = candidates.filter((unit) => primary === null || unit.entity_id !== primary.entity_id);
      if (options.length === 0) {
        const emptyFallback = dget(rule, "empty_fallback");
        return truthy(emptyFallback) ? this.resolveSelector(String(emptyFallback), state, operation) : [];
      }
      return [this.rng.choice(EffectInterpreter.sortUnits(options))];
    }
    if (kind === "actor_plus_minimum_stat") {
      const others = candidates.filter((unit) => actor === null || unit.entity_id !== actor.entity_id);
      const statNameMin = rule.stat;
      const rankedOthers = this.ranked(others, (unit) => this.statValue(unit, statNameMin), false, dget(rule, "tie_break", []) as unknown[]);
      const combined: BattleUnit[] = [];
      if (actor !== null && actor.alive) combined.push(actor);
      combined.push(...rankedOthers.slice(0, 1));
      return EffectInterpreter.uniqueUnits(combined);
    }
    if (kind === "actor_plus_tagged_allies" || kind === "boss_plus_tagged_allies") {
      const base = kind === "boss_plus_tagged_allies" ? state.boss : actor;
      let team = "";
      if (base !== null) team = base.team;
      else if (actor !== null) team = actor.team;
      const tag = String(dget(rule, "tag", ""));
      const allies = EffectInterpreter.sortUnits(state.livingUnits(team).filter((unit) => this.hasTag(unit, tag)));
      const group: BattleUnit[] = [];
      if (base !== null && base.alive) group.push(base);
      group.push(...allies);
      return EffectInterpreter.uniqueUnits(group);
    }
    this.fail(`Selector ${pyRepr(selectorId)} has unsupported kind ${pyRepr(kind)}`);
    return [];
  }

  private sideUnits(side: unknown, state: BattleState): BattleUnit[] {
    const actor = state.actor;
    if (side === "opposing") return state.livingUnits(state.opposingTeam(actor));
    if (side === "boss_team") {
      let team = "";
      if (state.boss !== null) team = state.boss.team;
      else if (actor !== null) team = actor.team;
      return state.livingUnits(team);
    }
    if (side === "actor" || side === null) return state.livingUnits(actor !== null ? actor.team : "");
    this.fail(`Unsupported selector side ${pyRepr(side)}`);
    return [];
  }

  /** Living units by (slot index, entity id). */
  static sortUnits(units: readonly BattleUnit[]): BattleUnit[] {
    const living = units.filter((unit) => unit.alive && unit.hp > 0);
    return sortedBy(living, (unit) => [unit.slot_index, unit.entity_id]);
  }

  /** Living units ordered by `statFn` (descending when `reverse`), then the authored tie-break fields. */
  private ranked(units: readonly BattleUnit[], statFn: (unit: BattleUnit) => number, reverse: boolean, tieBreak: readonly unknown[]): BattleUnit[] {
    const living = units.filter((unit) => unit.alive && unit.hp > 0);
    return sortedBy(living, (unit): SortKey => {
      const value = statFn(unit);
      const keys: unknown[] = [reverse ? -value : value];
      for (const fieldName of tieBreak) keys.push(fieldName === "slot_index" ? unit.slot_index : unit.entity_id);
      if (tieBreak.length === 0) keys.push(unit.slot_index, unit.entity_id);
      return keys;
    });
  }

  private tauntForcedTarget(state: BattleState, side: unknown): BattleUnit | null {
    const actor = state.actor;
    if (side !== "opposing" || actor === null) return null;
    for (const [statusId, status] of actor.statuses) {
      if (toInt(dget(status, "duration_turns", 0)) <= 0) continue;
      if (statusId !== "taunt" && !dgetArray(status, "tags").includes("taunt")) continue;
      const source = EffectInterpreter.resolveUnitReference(dget(status, "source_id"), state);
      if (source !== null && source.alive && source.team !== actor.team) return source;
    }
    return null;
  }

  private statValue(unit: BattleUnit, statName: unknown): number {
    if (statName === "hp_fraction") return EffectInterpreter.hpPct(unit);
    if (statName === "focus") return unit.focus;
    return unit.effectiveStat(str(statName));
  }

  private categoryStatusCount(unit: BattleUnit, category: unknown): number {
    if (category === null) return unit.statuses.size;
    let count = 0;
    for (const statusId of unit.statuses.keys()) if (this.statusTags(unit, statusId).includes(String(category))) count++;
    return count;
  }

  static hpPct(unit: BattleUnit): number {
    const maximum = Math.max(1, unit.max_hp !== 0 ? unit.max_hp : 1);
    return (unit.hp * 100.0) / maximum;
  }

  private hasTag(unit: BattleUnit, tag: string): boolean {
    const wanted = TAG_ALIASES[tag] ?? [tag];
    for (const candidate of unit.tags) if (wanted.includes(candidate)) return true;
    for (const statusId of unit.statuses.keys()) {
      for (const statusTag of this.statusTags(unit, statusId)) if (wanted.includes(statusTag)) return true;
    }
    return false;
  }

  private statusTags(unit: BattleUnit, statusId: string): string[] {
    return unit.statusTags(statusId, this.status_definitions);
  }

  static resolveUnitReference(reference: unknown, state: BattleState): BattleUnit | null {
    if (isUnit(reference)) return reference;
    if (typeof reference === "string") return state.units.find((unit) => unit.entity_id === reference) ?? null;
    if (isDict(reference)) {
      const entityId = dget(reference, "entity_id", dget(reference, "unit_id"));
      if (entityId !== null) return state.units.find((unit) => unit.entity_id === entityId) ?? null;
    }
    return null;
  }

  static ids(value: unknown): string[] {
    if (value === null || value === undefined) return [];
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => (isUnit(item) ? item.entity_id : str(item)));
  }

  private static uniqueUnits(units: readonly (BattleUnit | null)[]): BattleUnit[] {
    const result: BattleUnit[] = [];
    const seen = new Set<string>();
    for (const unit of units) {
      if (unit !== null && unit.alive && !seen.has(unit.entity_id)) {
        seen.add(unit.entity_id);
        result.push(unit);
      }
    }
    return result;
  }

  private targetsResult(op: string, targets: readonly BattleUnit[], details: Dict = {}): OperationResult {
    const result = new OperationResult();
    result.operation = op;
    result.target_ids = targets.map((unit) => unit.entity_id);
    result.details = details;
    return result;
  }

  // -- conditions ------------------------------------------------------------------------------------

  /** Validates then evaluates a condition (`all`/`any`/`not`/`predicate`) against the state. */
  evaluateCondition(condition: unknown, state: BattleState, target: BattleUnit | null = null): boolean {
    this.validateCondition(condition, "condition");
    if (this.error.length > 0) {
      state.reportFault(this.error);
      return false;
    }
    return this.evaluateConditionTree(condition as Dict, state, target);
  }

  private evaluateConditionTree(condition: Dict, state: BattleState, target: BattleUnit | null): boolean {
    if (Object.hasOwn(condition, "all")) {
      for (const item of condition.all as Dict[]) if (!this.evaluateConditionTree(item, state, target)) return false;
      return true;
    }
    if (Object.hasOwn(condition, "any")) {
      for (const item of condition.any as Dict[]) if (this.evaluateConditionTree(item, state, target)) return true;
      return false;
    }
    if (Object.hasOwn(condition, "not")) return !this.evaluateConditionTree(condition.not as Dict, state, target);
    return this.evaluatePredicate(String(condition.predicate), dget(condition, "value"), state, target);
  }

  private evaluatePredicate(predicate: string, value: unknown, state: BattleState, target: BattleUnit | null): boolean {
    const owner = state.actor;
    const eventActor = EffectInterpreter.resolveUnitReference(dget(state.event, "actor"), state);
    const eventTarget = EffectInterpreter.resolveUnitReference(dget(state.event, "target"), state);
    const last = state.last_target;
    const ownTeam = owner !== null ? owner.team : "";
    const allies = ownTeam.length > 0 ? state.livingUnits(ownTeam) : [];
    const enemies = owner !== null ? state.livingUnits(state.opposingTeam(owner)) : [];
    switch (predicate) {
      case "owner_in_row":
        return owner !== null && owner.row === value;
      case "owner_hp_below_pct":
        return owner !== null && EffectInterpreter.hpPct(owner) < toFloat(value);
      case "owner_hp_above_pct":
        return owner !== null && EffectInterpreter.hpPct(owner) > toFloat(value);
      case "owner_has_shield":
        return owner !== null && owner.shieldTotal() > 0;
      case "owner_has_status":
        return owner !== null && owner.hasStatus(str(value));
      case "owner_action_type":
        return state.action_type === value;
      case "owner_took_no_damage_this_round":
        return owner !== null && owner.damage_taken_this_round === 0 && !state.damaged_entity_ids_this_round.has(owner.entity_id);
      case "last_target_has_status":
      case "last_target_has_status_tag":
        if (last === null) return false;
        if (predicate === "last_target_has_status") return last.hasStatus(str(value));
        return this.hasTag(last, str(value));
      case "last_target_defeated":
        return last !== null && (!last.alive || last.hp <= 0);
      case "last_primary_target_defeated":
        return state.last_primary_target_defeated;
      case "target_has_status":
        return target !== null && target.hasStatus(str(value));
      case "target_has_status_tag":
      case "target_has_any_status_tag":
        return target !== null && this.hasTag(target, str(value));
      case "target_has_acted_this_battle":
        return target !== null && (target.has_acted || state.acted_entity_ids.has(target.entity_id));
      case "target_in_row":
        return target !== null && target.row === value;
      case "event_target_hp_at_or_below_pct":
        return eventTarget !== null && EffectInterpreter.hpPct(eventTarget) <= toFloat(value);
      case "event_target_had_status":
        return (dget(state.event, "target_statuses_before", []) as unknown[]).includes(str(value));
      case "event_actor_has_any_buff":
        if (eventActor === null) return false;
        for (const statusId of eventActor.statuses.keys()) if (this.statusTags(eventActor, statusId).includes("buff")) return true;
        return false;
      case "event_source_faction_is": {
        const source = EffectInterpreter.resolveUnitReference(dget(state.event, "source"), state);
        if (source === null) return false;
        const faction = source.faction_id.length > 0 ? source.faction_id : source.team;
        return faction === value;
      }
      case "count_enemies_with_status":
        return enemies.filter((unit) => unit.hasStatus(str(value))).length > 0;
      case "enemy_ally_hp_below_pct":
        return allies.some((unit) => EffectInterpreter.hpPct(unit) < toFloat(value));
      case "no_enemy_ally_below_pct":
        return !allies.some((unit) => EffectInterpreter.hpPct(unit) < toFloat(value));
      case "damage_dealt_at_least_pct_of_target_hp": {
        let maxHp = state.last_damage_target_max_hp;
        if (maxHp === 0) maxHp = target !== null ? target.max_hp : 0;
        return maxHp > 0 && state.last_damage >= (maxHp * toFloat(value)) / 100.0;
      }
      case "round_number_at_most":
        return state.round_number <= toInt(value);
    }
    this.fail(`Predicate ${pyRepr(predicate)} has no evaluator`);
    return false;
  }

  // -- operations ------------------------------------------------------------------------------------

  private chanceSucceeds(operation: Dict): boolean {
    const chance = toFloat(dget(operation, "chance", 1.0));
    if (!(chance >= 0.0 && chance <= 1.0)) {
      this.fail(`chance must be in [0, 1], got ${chance}`);
      return false;
    }
    if (chance === 1.0) return true;
    if (chance === 0.0) return false;
    return this.rng.random() < chance;
  }

  private opDamage(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const actor = state.actor!;
    if (!this.chanceSucceeds(op)) return this.targetsResult("damage", targets, { chance_failed: true });
    const perTargetMultiplier = toFloat(op.multiplier);
    const damageRecords: Dict[] = [];
    const hits = Math.max(1, toInt(dget(op, "hit_count", 1)));
    const damageActionId = state.nextDamageActionId();
    let attackBonus = 1.0;
    const consumedBonuses: Dict[] = [];
    for (const bonus of actor.next_attack_bonuses) {
      attackBonus *= toFloat(dget(bonus, "damage_multiplier", 1.0));
      if (toBool(dget(bonus, "consume_on_attack", true))) consumedBonuses.push(bonus);
    }
    const passivesEnabled = toBool(dget(op, "can_trigger_passives", true));
    const noFocusGain = toBool(dget(op, "no_focus_gain", false));
    for (const target of targets) {
      state.last_target = target;
      state.last_primary_target = target;
      for (const [defender, redirectedFraction, redirectKind] of this.damageRecipients(target, state)) {
        let reactionMultiplier = 1.0;
        if (defender.hasStatus("soaked")) {
          let reaction: Dict | null = null;
          for (const item of dgetArray(this.status_definitions.soaked as Dict, "reaction_triggers") as Dict[]) {
            if (dget(item, "element") === actor.element) {
              reaction = item;
              break;
            }
          }
          if (reaction !== null) {
            reactionMultiplier = 1.0 + toFloat(reaction.bonus_damage_multiplier);
            if (toBool(dget(reaction, "consume_status", true))) defender.statuses.delete("soaked");
          }
        }
        for (let hit = 0; hit < hits; hit++) {
          if (!defender.alive) break;
          let hitMultiplier = perTargetMultiplier * attackBonus * redirectedFraction * reactionMultiplier;
          const previousEvent: Dict = { ...state.event };
          const hitEvent: Dict = {
            actor, source: actor, target: defender, primary_target: target,
            action_type: state.action_type, source_action_type: state.action_type,
            incoming_action_type: state.action_type, damage_action_type: state.action_type,
            damage_action_id: damageActionId,
            target_statuses_before: keysInOrder(defender.statuses),
            target_hp_before: defender.hp,
            can_trigger_passives: passivesEnabled,
            no_focus_gain: noFocusGain,
          };
          if (passivesEnabled && state.supportsPassives()) {
            state.dispatchBattleEvent("before_damage_dealt", hitEvent, this);
            const recipientEvent: Dict = { ...hitEvent };
            recipientEvent.target = defender;
            recipientEvent.team = defender.team;
            state.dispatchBattleEvent("before_damage_received", recipientEvent, this);
            hitMultiplier *= state.continuousDamageMultiplier("before_damage_dealt", hitEvent, this);
            hitMultiplier *= state.continuousDamageMultiplier("before_damage_received", recipientEvent, this);
          }
          state.event = previousEvent;
          if (defender.blocked_attack_hits > 0) {
            defender.blocked_attack_hits -= 1;
            damageRecords.push({ target_id: target.entity_id, recipient_id: defender.entity_id, blocked: true, damage: 0 });
            continue;
          }
          for (const rule of dget(op, "modifiers", []) as Dict[]) {
            if (this.evaluateCondition(rule.condition, state, target)) {
              if (Object.hasOwn(rule, "multiplier")) hitMultiplier *= toFloat(rule.multiplier);
              if (Object.hasOwn(rule, "add_multiplier_per_count")) {
                let count = this.conditionCount(rule.condition as Dict, state, target);
                count = Math.min(count, toInt(dget(rule, "maximum_count", count)));
                hitMultiplier += toFloat(rule.add_multiplier_per_count) * count;
              }
            }
          }
          hitMultiplier *= this.objectiveDamageMultiplier(op, state);
          const stat = str(dget(op, "scale_stat", "atk"));
          const scaleValue = actor.effectiveStat(stat);
          // Damage's canonical formula uses the chosen source stat as the attack basis; non-ATK scale stats get a
          // read-only view.
          const source = stat === "atk" ? attackerOfUnit(actor) : scaledAttacker(actor, scaleValue);
          const result = calculateDamage(
            source, defender, String(op.damage_type), actor.element, hitMultiplier, this.rng,
            this.damage_rules, this.status_definitions, toFloat(dget(op, "shield_damage_multiplier", 1.0)), true,
          );
          if (result.error.length > 0) {
            this.fail(result.error);
            return this.targetsResult("damage", targets);
          }
          const sharedDamage = this.applySoulLinkDamage(defender, result.hp_damage, state);
          state.last_damage = result.damage;
          state.last_damage_target_max_hp = defender.max_hp;
          state.last_damage_target_defeated = !defender.alive;
          state.last_primary_target_defeated = !target.alive;
          if (result.damage !== 0) state.damaged_entity_ids_this_round.add(defender.entity_id);
          damageRecords.push({
            target_id: target.entity_id, recipient_id: defender.entity_id,
            redirect_kind: redirectKind, redirected_fraction: redirectedFraction,
            damage: result.damage, hp_damage: Math.max(0, result.hp_damage - sharedDamage),
            shared_damage: sharedDamage, shield_absorbed: result.shield_absorbed,
            critical: result.critical, damage_type: op.damage_type, element: actor.element.length > 0 ? actor.element : null,
            defense_stat: result.defense_stat, element_multiplier: result.element_multiplier,
          });
          if (defender.is_objective && defender.objective_id.length > 0) {
            const objective = state.objectives.get(defender.objective_id);
            if (objective !== undefined) {
              objective.hp = defender.hp;
              if (defender.hp <= 0 && !toBool(dget(objective, "destroyed", false))) {
                objective.destroyed = true;
                state.objectiveDestroyed(objective, this, actor);
              }
            }
          }
          for (const modifier of [...defender.damage_modifiers]) {
            if (toInt(dget(modifier, "hits_remaining", 1)) > 1) modifier.hits_remaining = toInt(modifier.hits_remaining) - 1;
            else if (Object.hasOwn(modifier, "hits_remaining")) removeFirstEqual(defender.damage_modifiers, modifier);
          }
          if (passivesEnabled) {
            const afterEvent: Dict = { ...hitEvent };
            afterEvent.damage = result.damage;
            afterEvent.hp_damage = result.hp_damage;
            afterEvent.shield_absorbed = result.shield_absorbed;
            afterEvent.target_hp_after = defender.hp;
            afterEvent.target_defeated = !defender.alive;
            afterEvent.target_statuses_before = [...(hitEvent.target_statuses_before as string[])];
            if (state.supportsPassives() && (result.damage > 0 || result.shield_absorbed > 0)) {
              const received: Dict = { ...afterEvent };
              received.team = defender.team;
              state.dispatchBattleEvent("after_damage_received", received, this);
              if (defender.team !== actor.team) state.dispatchBattleEvent("ally_damaged", afterEvent, this);
              state.dispatchBattleEvent("after_damage_dealt", afterEvent, this);
              if (result.hp_damage > 0 && defender.team === "player") {
                const defenderMax = Math.max(1, defender.max_hp !== 0 ? defender.max_hp : 1);
                const beforePct = (toFloat(hitEvent.target_hp_before) * 100.0) / defenderMax;
                const afterPct = (defender.hp * 100.0) / defenderMax;
                if (beforePct > afterPct) {
                  const crossed: Dict = { ...afterEvent };
                  crossed.team = defender.team;
                  crossed.threshold_crossed = true;
                  state.dispatchBattleEvent("ally_hp_threshold_crossed", crossed, this);
                }
              }
              if (!defender.alive) state.dispatchBattleEvent("after_enemy_defeated", afterEvent, this);
            }
            if (result.damage > 0 && !noFocusGain) {
              const taken = defender.hit_focus_gained_this_turn;
              const gained = state.focus_rules.hitGain(taken);
              defender.focus = Math.min(state.focus_rules.maximum, defender.focus + gained);
              defender.hit_focus_gained_this_turn = taken + gained;
            }
            state.event = previousEvent;
          }
        }
      }
    }
    for (const bonus of consumedBonuses) removeFirstEqual(actor.next_attack_bonuses, bonus);
    const finalResult = this.targetsResult("damage", targets, { hits });
    finalResult.damage = damageRecords;
    return finalResult;
  }

  private applySoulLinkDamage(defender: BattleUnit, hpDamage: number, state: BattleState): number {
    if (hpDamage <= 0 || !defender.alive || !defender.hasStatus("soul_link")) return 0;
    const link = defender.statuses.get("soul_link")!;
    const source = EffectInterpreter.resolveUnitReference(dget(link, "source_id"), state);
    if (source === null || source === defender || !source.alive) return 0;
    const fraction = Math.max(0.0, toFloat(dget(link, "shared_damage_fraction", 0.25)));
    const definition = this.status_definitions.soul_link as Dict;
    const capFraction = toFloat(dget(definition, "maximum_shared_damage_per_hit_pct_of_max_hp", 0.15));
    let shared = Math.min(Math.trunc(hpDamage * fraction), Math.trunc(source.max_hp * capFraction));
    shared = Math.min(shared, source.hp);
    if (shared <= 0) return 0;
    defender.hp = Math.min(defender.max_hp !== 0 ? defender.max_hp : 1, defender.hp + shared);
    defender.alive = defender.hp > 0;
    source.hp = Math.max(0, source.hp - shared);
    source.alive = source.hp > 0;
    source.damage_taken_this_round += shared;
    state.damaged_entity_ids_this_round.add(source.entity_id);
    return shared;
  }

  /** Routes single-target damage through the first eligible guard/intercept: [[unit, fraction, kind-or-null], ...]. */
  private damageRecipients(target: BattleUnit, state: BattleState): Recipient[] {
    const others = state.livingUnits(target.team).filter((unit) => unit.entity_id !== target.entity_id);
    for (const guardian of EffectInterpreter.sortUnits(others)) {
      for (const redirect of guardian.redirects) {
        if (!dgetArray(redirect, "protected_ids").includes(target.entity_id)) continue;
        if (toInt(dget(redirect, "duration_turns", 1)) <= 0) continue;
        const eligible = dget(redirect, "eligible_action_types");
        if (truthy(eligible) && !(eligible as unknown[]).includes(state.action_type)) continue;
        if (dget(redirect, "kind") === "intercept") {
          const maximum = toInt(dget(redirect, "maximum_intercepts", 999999));
          const used = toInt(dget(redirect, "intercepts_used", 0));
          if (used >= maximum) continue;
          redirect.intercepts_used = used + 1;
        }
        const fraction = Math.max(0.0, Math.min(1.0, toFloat(dget(redirect, "fraction", 0.0))));
        const recipients: Recipient[] = [];
        if (fraction < 1.0) recipients.push([target, 1.0 - fraction, null]);
        if (fraction > 0.0) recipients.push([guardian, fraction, str(dget(redirect, "kind", "redirect"))]);
        return recipients;
      }
    }
    return [[target, 1.0, null]];
  }

  private conditionCount(condition: Dict, state: BattleState, target: BattleUnit): number {
    if (dget(condition, "predicate") === "count_enemies_with_status") {
      const wanted = str(dget(condition, "value"));
      return state.livingUnits(state.opposingTeam(state.actor)).filter((unit) => unit.hasStatus(wanted)).length;
    }
    return this.evaluateCondition(condition, state, target) ? 1 : 0;
  }

  private objectiveDamageMultiplier(op: Dict, state: BattleState): number {
    let value = 1.0;
    const single = dget(op, "multiplier_if_objective_alive");
    if (truthy(single)) {
      const objective = state.objectives.get(String((single as Dict).objective_id)) ?? {};
      if (toInt(dget(objective, "hp", 0)) > 0) value *= toFloat((single as Dict).multiplier);
    }
    const allAlive = dget(op, "multiplier_if_all_objectives_alive");
    if (truthy(allAlive) && state.objectives.size > 0) {
      let every = true;
      for (const objectiveEntry of state.objectives.values()) {
        if (toInt(dget(objectiveEntry, "hp", 0)) <= 0) {
          every = false;
          break;
        }
      }
      if (every) value *= toFloat((allAlive as Dict).multiplier);
    }
    return value;
  }

  private opHeal(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    if (!this.chanceSucceeds(op)) return this.targetsResult("heal", targets, { chance_failed: true });
    const actor = state.actor!;
    const basis = actor.effectiveStat(str(dget(op, "scale_stat", "atk")));
    const records: Dict[] = [];
    const successful: BattleUnit[] = [];
    for (const target of targets) {
      const missing = target.max_hp - target.hp;
      const bonus = toFloat(dget(actor.stats, "heal_bonus", 0.0));
      let received = 1.0;
      if (target.hasStatus("sanctuary")) {
        received *= toFloat(dget(target.statuses.get("sanctuary")!, "healing_received_multiplier",
          dget(this.status_definitions.sanctuary as Dict, "healing_received_multiplier", 1.1)));
      }
      if (target.hasStatus("decay")) {
        received *= toFloat(dget(target.statuses.get("decay")!, "healing_received_multiplier",
          dget(this.status_definitions.decay as Dict, "healing_received_multiplier", 0.5)));
      }
      const amount = Math.max(0, Math.trunc(basis * toFloat(op.multiplier) * (1.0 + bonus) * received + 0.5));
      const actual = Math.min(missing, amount);
      target.hp = target.hp + actual;
      if (actual > 0) successful.push(target);
      records.push({ target_id: target.entity_id, healing: actual, requested: amount });
      if (actual > 0 && state.supportsPassives()) {
        state.dispatchBattleEvent("after_ally_healed", {
          actor, source: actor, target, team: target.team, healing: actual,
          action_type: state.action_type, source_action_type: state.action_type,
        }, this);
      }
    }
    state.previous_successful_heal_targets = successful;
    const result = this.targetsResult("heal", targets);
    result.healing = records;
    return result;
  }

  private opHealPerRemovedStatus(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    let removedTotal = 0;
    for (const value of state.last_removed_statuses.values()) removedTotal += value.length;
    if (toBool(dget(op, "requires_successful_cleanse", false)) && removedTotal <= 0) {
      return this.targetsResult("heal_per_removed_status", targets, { cleansed: 0 });
    }
    const actor = state.actor!;
    const limited = targets.slice(0, toInt(dget(op, "maximum_targets", targets.length)));
    let stackBudget = Math.min(removedTotal, toInt(dget(op, "maximum_total_stacks", removedTotal)));
    const basis = actor.effectiveStat(str(dget(op, "scale_stat", "atk")));
    const records: Dict[] = [];
    for (const target of limited) {
      // The cap is shared by selected targets, and each target benefits only from statuses removed from it.
      const stacks = Math.min((state.last_removed_statuses.get(target.entity_id) ?? []).length, stackBudget);
      stackBudget -= stacks;
      const amount = Math.max(0, Math.trunc(basis * toFloat(op.multiplier) * stacks + 0.5));
      const actual = Math.min(target.max_hp - target.hp, amount);
      target.hp = target.hp + actual;
      records.push({ target_id: target.entity_id, healing: actual, cleanse_stacks: stacks });
    }
    state.previous_successful_heal_targets = limited.filter((unit) =>
      records.some((record) => record.target_id === unit.entity_id && toInt(record.healing) > 0));
    const result = this.targetsResult("heal_per_removed_status", limited, { removed_status_count: removedTotal });
    result.healing = records;
    return result;
  }

  private opGrantShield(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const actor = state.actor!;
    const amount = Math.max(0, Math.trunc(actor.effectiveStat(str(op.scale_stat)) * toFloat(op.multiplier) + 0.5));
    const records: Dict[] = [];
    for (const target of targets) {
      const cap = (target.max_hp !== 0 ? target.max_hp : 1) * 2;
      const current = target.shieldTotal();
      const granted = Math.min(amount, Math.max(0, cap - current));
      if (granted !== 0) {
        target.shields.push({
          amount: granted, duration_turns: toInt(op.duration_turns),
          source_id: dget(op, "shield_source_id", actor.entity_id), applied_order: state.log.length,
        });
      }
      records.push({ target_id: target.entity_id, shield: granted });
    }
    return this.targetsResult("grant_shield", targets, { shields: records });
  }

  private opApplyStatus(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const records: Dict[] = [];
    const statusId = String(op.status_id);
    const definition = this.status_definitions[statusId] as Dict;
    const bossControlImmunities = dgetArray(dgetDict(this.rules, "targeting"), "boss_control_immunities_default");
    for (const target of targets) {
      if (!this.chanceSucceeds(op)) continue;
      if (target.status_immunities.includes(statusId)) continue;
      let immune = false;
      for (const immunity of dget(target.stats, "status_immunities_runtime", []) as Dict[]) {
        const immunityStatus = dget(immunity, "status_id");
        if ((immunityStatus === statusId || immunityStatus === "all") && toInt(dget(immunity, "duration_turns", 0)) > 0) {
          immune = true;
          break;
        }
      }
      if (immune) continue;
      for (const activeId of target.statuses.keys()) {
        if (dgetArray(dgetDict(this.status_definitions, activeId), "immune_status_ids").includes(statusId)) {
          immune = true;
          break;
        }
      }
      if (immune) continue;
      const definitionTags = dgetArray(definition, "tags");
      // Boss control immunities from the battle rules.
      if (target.is_boss && definitionTags.includes("control") && bossControlImmunities.includes(statusId)) continue;
      let duration = toInt(op.duration_turns);
      if (target.is_boss && definitionTags.includes("control")) {
        const scaled = this.bossControlDuration(state, target, duration);
        if (scaled < 0) continue;
        duration = scaled;
      }
      const status: Dict = { ...(target.statuses.get(statusId) ?? {}) };
      status.duration_turns = duration;
      status.source_id = state.actor !== null ? state.actor.entity_id : null;
      status.tags = [...definitionTags];
      status.applied_order = state.log.length;
      for (const fieldName of ["shared_damage_fraction", "consume_on_single_target_action"]) {
        if (Object.hasOwn(op, fieldName)) status[fieldName] = op[fieldName];
      }
      // Part I status payloads are read from the rules pack.
      if (statusId === "burn" || statusId === "venom") {
        const source = state.units.find((unit) => unit.entity_id === status.source_id) ?? null;
        const defaultMultiplier = statusId === "burn" ? 0.12 : 0.1;
        const sourceAtk = source !== null ? source.effectiveStat("atk") : 1;
        status.tick_damage = Math.max(1, Math.trunc(sourceAtk * toFloat(dget(definition, "source_atk_multiplier_per_tick", defaultMultiplier))));
        status.ticks_at_owner_turn_start = true;
      }
      target.statuses.set(statusId, status);
      if (statusId === "gust") {
        const delayFraction = toFloat(dget(definition, "next_action_gauge_delay_fraction", 0.15));
        delayNextAction(target, Frac.fromNumber(delayFraction), this.gauge_rules);
      }
      records.push({ target_id: target.entity_id, status_id: statusId, duration_turns: duration });
    }
    const result = this.targetsResult("apply_status", targets);
    result.statuses_applied = records;
    return result;
  }

  /** Scaled control duration for a boss, or -1 when it is fully immune (the reference returns None). */
  private bossControlDuration(state: BattleState, target: BattleUnit, duration: number): number {
    const record = state.recordOf(target.entity_id);
    const extra: Dict = record !== null && isDict(record.extra) ? record.extra : {};
    const control = dgetDict(extra, "control_rules");
    if (toBool(dget(control, "blanket_control_immunity", false))) return -1;
    const multiplier = dget(control, "control_duration_multiplier", dget(dgetDict(this.rules, "targeting"), "boss_control_duration_multiplier"));
    const rounding = dget(control, "control_duration_rounding", "minimum_one_turn");
    if (typeof multiplier !== "number" || multiplier < 0.0) {
      this.fail(`Invalid boss control duration multiplier: ${pyRepr(multiplier)}`);
      return -1;
    }
    if (rounding !== "minimum_one_turn") {
      this.fail(`Unsupported control_duration_rounding: ${pyRepr(rounding)}`);
      return -1;
    }
    if (duration <= 0) return 0;
    // The authored text is "minimum one turn when base duration is positive"; the engine keeps its historical ceiling
    // (confirmed by the project owner on 2026-09-28: 3 turns -> 2, the player-favourable reading).
    return Math.max(1, Number(Frac.fromNumber(multiplier).mulInt(duration).ceil()));
  }

  /** Scales strength multipliers by the actor's rank in `skillId` (rank 1 or no rank returns the operations unchanged). */
  private applySkillRank(operations: Dict[], actor: BattleUnit, skillId: string): Dict[] {
    const rank = skillId.length > 0 ? toInt(actor.skill_ranks.get(skillId) ?? 1) : 1;
    if (rank <= 1) return operations;
    const factor = this.progression.skillRankMultiplier(rank);
    return operations.map((op) => {
      if (RANK_SCALED_OPS.includes(String(dget(op, "op", ""))) && Object.hasOwn(op, "multiplier")) {
        return { ...op, multiplier: toFloat(op.multiplier) * factor };
      }
      return op;
    });
  }

  private opRemoveStatus(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const removedByTarget = new Map<string, Dict[]>();
    const category = String(op.category);
    for (const target of targets) {
      let choices: string[] = [];
      for (const statusId of target.statuses.keys()) {
        if (this.statusTags(target, statusId).includes(category) && (!Object.hasOwn(op, "status_id") || statusId === op.status_id)) {
          choices.push(statusId);
        }
      }
      if (op.selection === "oldest_applied") {
        choices = EffectInterpreter.sortStatuses(choices, target);
      } else if (op.selection === "random_applied_buff") {
        choices = EffectInterpreter.sortStatuses(choices, target);
        this.rng.shuffle(choices);
      } else {
        this.fail(`Unsupported remove_status selection ${pyRepr(op.selection)}`);
        return this.targetsResult("remove_status", targets);
      }
      const removed: Dict[] = [];
      for (const statusId of choices.slice(0, Math.max(0, toInt(op.count)))) {
        removed.push({ status_id: statusId, ...target.statuses.get(statusId)! });
        target.statuses.delete(statusId);
      }
      removedByTarget.set(target.entity_id, removed);
    }
    state.last_removed_statuses = removedByTarget;
    const summary: Dict = {};
    for (const [key, removed] of removedByTarget) summary[key] = removed.map((status) => status.status_id);
    return this.targetsResult("remove_status", targets, { removed: summary });
  }

  private static sortStatuses(statusIds: readonly string[], unit: BattleUnit): string[] {
    return sortedBy(statusIds, (statusId) => [toInt(dget(unit.statuses.get(statusId)!, "applied_order", 0))]);
  }

  private opReduceStatusDurations(op: Dict, targets: BattleUnit[]): OperationResult {
    const changed: Dict[] = [];
    for (const target of targets) {
      for (const statusId of [...target.statuses.keys()]) {
        if (this.statusTags(target, statusId).includes(String(op.category))) {
          const status = target.statuses.get(statusId)!;
          status.duration_turns = Math.max(toInt(op.minimum_remaining_turns), toInt(dget(status, "duration_turns", 0)) - toInt(op.amount_turns));
          if (toInt(status.duration_turns) === 0) target.statuses.delete(statusId);
          changed.push({ target_id: target.entity_id, status_id: statusId, duration_turns: dget(status, "duration_turns", 0) });
        }
      }
    }
    return this.targetsResult("reduce_status_durations", targets, { changed });
  }

  private opModifyStat(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const modes: Record<string, string> = { add_pct: "percent", percent: "percent", flat: "flat", add_flat: "flat" };
    const mode = op.mode;
    if (typeof mode !== "string" || !Object.hasOwn(modes, mode)) {
      this.fail(`Unsupported stat modifier mode ${pyRepr(mode)}`);
      return this.targetsResult("modify_stat", targets);
    }
    for (const target of targets) {
      target.stat_modifiers.push({
        stat_id: op.stat_id, mode: modes[mode], amount: toFloat(op.amount),
        duration_turns: toInt(op.duration_turns),
        source_id: state.actor !== null ? state.actor.entity_id : null,
      });
    }
    return this.targetsResult("modify_stat", targets, { stat_id: op.stat_id, mode });
  }

  private opDamageModifier(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const kind = op.op === "modify_incoming_damage" ? "incoming" : "outgoing";
    for (const target of targets) {
      target.damage_modifiers.push({
        kind, multiplier: toFloat(op.multiplier), duration_turns: toInt(dget(op, "duration_turns", 1)),
        source_id: state.actor !== null ? state.actor.entity_id : null,
      });
    }
    return this.targetsResult(String(op.op), targets, { kind });
  }

  private opGrantDamageReduction(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    for (const target of targets) {
      target.damage_modifiers.push({
        kind: "incoming", multiplier: toFloat(op.damage_taken_multiplier), duration_turns: toInt(op.duration_turns),
        source_id: state.actor !== null ? state.actor.entity_id : null,
      });
    }
    return this.targetsResult("grant_damage_reduction", targets);
  }

  private opGrantRedirect(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    let protectedUnits = this.resolveSelector(String(op.protected_ally_selector_id), state, op);
    protectedUnits = this.excludeGuardiansFromProtected(protectedUnits, targets, op, state);
    for (const guardian of targets) {
      guardian.redirects.push({
        protected_ids: protectedUnits.map((unit) => unit.entity_id), fraction: toFloat(op.redirected_fraction),
        duration_turns: toInt(op.duration_turns),
        eligible_action_types: [...(op.eligible_action_types as unknown[])], kind: "redirect",
      });
    }
    return this.targetsResult("grant_redirect", targets, { protected_ids: protectedUnits.map((unit) => unit.entity_id) });
  }

  private opGrantIntercept(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    let protectedUnits = this.resolveSelector(String(op.protected_ally_selector_id), state, op);
    protectedUnits = this.excludeGuardiansFromProtected(protectedUnits, targets, op, state);
    for (const guardian of targets) {
      guardian.redirects.push({
        protected_ids: protectedUnits.map((unit) => unit.entity_id), fraction: toFloat(op.redirected_fraction),
        duration_turns: toInt(op.duration_turns),
        maximum_intercepts: toInt(dget(op, "maximum_intercepts", 999999)), kind: "intercept",
      });
    }
    return this.targetsResult("grant_intercept", targets, { protected_ids: protectedUnits.map((unit) => unit.entity_id) });
  }

  private excludeGuardiansFromProtected(protectedUnits: BattleUnit[], guardians: BattleUnit[], op: Dict, state: BattleState): BattleUnit[] {
    const guardianIds = new Set(guardians.map((unit) => unit.entity_id));
    const valid = protectedUnits.filter((unit) => !guardianIds.has(unit.entity_id));
    if (valid.length > 0) return valid;
    const rule = this.selector_rules[String(op.protected_ally_selector_id)] as Dict;
    const candidates = this.sideUnits(dget(rule, "side"), state).filter((unit) => !guardianIds.has(unit.entity_id));
    let ordered: BattleUnit[];
    if (truthy(dget(rule, "stat"))) {
      const statName = rule.stat;
      ordered = this.ranked(candidates, (unit) => this.statValue(unit, statName), false, dget(rule, "tie_break", []) as unknown[]);
    } else {
      ordered = EffectInterpreter.sortUnits(candidates);
    }
    return ordered.slice(0, 1);
  }

  private opFirstHitGuard(op: Dict, targets: BattleUnit[]): OperationResult {
    for (const target of targets) {
      target.damage_modifiers.push({
        kind: "incoming", multiplier: toFloat(op.damage_taken_multiplier), duration_turns: toInt(op.duration_turns),
        hits_remaining: toInt(op.hits_per_target), guard: "first_hit",
      });
    }
    return this.targetsResult("grant_first_hit_guard", targets);
  }

  private opOpeningGuard(op: Dict, targets: BattleUnit[]): OperationResult {
    for (const target of targets) {
      target.damage_modifiers.push({
        kind: "incoming", multiplier: toFloat(op.damage_taken_multiplier), duration_rounds: toInt(op.duration_rounds),
        target_override: op.target_override, guard: "opening",
      });
    }
    return this.targetsResult("grant_opening_guard", targets);
  }

  private opGainFocus(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    for (const target of targets) {
      let amount = toInt(op.amount);
      if (target.hasStatus("dread")) {
        amount = Math.trunc(amount * toFloat(dget(target.statuses.get("dread")!, "focus_gain_multiplier",
          dget(this.status_definitions.dread as Dict, "focus_gain_multiplier", 0.8))));
      }
      target.focus = Math.max(0, Math.min(state.focus_rules.maximum, target.focus + amount));
    }
    return this.targetsResult("gain_focus", targets, { amount: toInt(op.amount) });
  }

  private opDelayNextAction(op: Dict, targets: BattleUnit[]): OperationResult {
    const updated: Dict = {};
    for (const target of targets) {
      updated[target.entity_id] = delayNextAction(target, Frac.fromNumber(toFloat(op.gauge_fraction)), this.gauge_rules).toString();
    }
    return this.targetsResult("delay_next_action", targets, { pending_delay_gauge: updated });
  }

  private opReduceCooldowns(op: Dict, targets: BattleUnit[]): OperationResult {
    const changes: Dict[] = [];
    for (const target of targets) {
      for (const skillId of [...target.cooldowns.keys()]) {
        target.cooldowns.set(skillId, Math.max(toInt(op.minimum_remaining_turns), toInt(target.cooldowns.get(skillId)) - toInt(op.amount_turns)));
        changes.push({ target_id: target.entity_id, skill_id: skillId, cooldown: target.cooldowns.get(skillId) });
      }
    }
    return this.targetsResult("reduce_cooldowns", targets, { changed: changes });
  }

  private opRegeneration(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const actor = state.actor!;
    const amount = Math.max(0, Math.trunc(actor.effectiveStat(str(op.scale_stat)) * toFloat(op.multiplier) + 0.5));
    for (const target of targets) {
      target.statuses.set("regeneration", {
        duration_turns: toInt(op.duration_turns), ticks_remaining: toInt(op.ticks),
        tick_event: op.tick_event, tick_healing: amount, source_id: actor.entity_id,
        tags: ["buff", "regeneration"], applied_order: state.log.length,
      });
    }
    return this.targetsResult("apply_regeneration", targets, { tick_healing: amount });
  }

  private opArmCounter(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    for (const target of targets) {
      target.counters.push({
        event: op.event, scale_stat: op.scale_stat, multiplier: toFloat(op.multiplier),
        damage_type: op.damage_type, consume_on_trigger: toBool(op.consume_on_trigger),
        source_id: state.actor !== null ? state.actor.entity_id : null,
        source_turn_at_arm: state.actor !== null ? state.ownerTurnCount(state.actor.entity_id) : 0,
      });
    }
    return this.targetsResult("arm_counter", targets);
  }

  private opNextAttackBonus(op: Dict, targets: BattleUnit[]): OperationResult {
    for (const target of targets) {
      target.next_attack_bonuses.push({ damage_multiplier: toFloat(op.damage_multiplier), consume_on_attack: toBool(op.consume_on_attack) });
    }
    return this.targetsResult("arm_next_attack_bonus", targets);
  }

  private opStatusImmunity(op: Dict, targets: BattleUnit[]): OperationResult {
    for (const target of targets) {
      if (!Object.hasOwn(target.stats, "status_immunities_runtime")) target.stats.status_immunities_runtime = [];
      (target.stats.status_immunities_runtime as Dict[]).push({ status_id: op.status_id, duration_turns: toInt(op.duration_turns) });
    }
    return this.targetsResult("grant_status_immunity", targets);
  }

  private opRemoveShield(op: Dict, targets: BattleUnit[]): OperationResult {
    const removed: Dict[] = [];
    for (const target of targets) {
      const fraction = toFloat(dget(op, "amount_fraction", 1.0));
      const layers = target.shields.filter((layer) => !Object.hasOwn(op, "shield_source_id") || dget(layer, "source_id") === op.shield_source_id);
      let sourceTotal = 0;
      for (const layer of layers) sourceTotal += Math.max(0, toInt(dget(layer, "amount", 0)));
      const total = Math.trunc(sourceTotal * Math.max(0.0, Math.min(1.0, fraction)));
      let remaining = total;
      for (const layer of layers) {
        const take = Math.min(toInt(dget(layer, "amount", 0)), remaining);
        layer.amount = toInt(dget(layer, "amount", 0)) - take;
        remaining -= take;
        if (remaining <= 0) break;
      }
      target.shields = target.shields.filter((layer) => toInt(dget(layer, "amount", 0)) > 0);
      removed.push({ target_id: target.entity_id, shield_removed: total - remaining });
    }
    return this.targetsResult("remove_shield", targets, { removed });
  }

  private opCopyBuff(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const sources = this.resolveSelector(String(op.source_selector_id), state, op);
    const source = sources[0] ?? null;
    const copied: Dict = {};
    for (const target of targets) {
      let count = 0;
      if (source !== null) {
        if (op.category === "shield") {
          let shieldBudget = Math.max(0, (target.max_hp !== 0 ? target.max_hp : 1) * 2 - target.shieldTotal());
          for (const layer of source.shields.slice(0, toInt(op.maximum_count))) {
            const copiedLayer = Math.min(Math.max(0, toInt(dget(layer, "amount", 0))), shieldBudget);
            if (copiedLayer <= 0) continue;
            const clone: Dict = { ...layer };
            clone.amount = copiedLayer;
            clone.duration_turns = toInt(op.duration_turns);
            clone.copied = true;
            target.shields.push(clone);
            shieldBudget -= copiedLayer;
            count++;
          }
        } else {
          const buffs = [...source.statuses.keys()].filter((statusId) => this.statusTags(source, statusId).includes(String(op.category)));
          for (const statusId of EffectInterpreter.sortStatuses(buffs, source).slice(0, toInt(op.maximum_count))) {
            const statusClone: Dict = { ...source.statuses.get(statusId)! };
            statusClone.duration_turns = toInt(op.duration_turns);
            statusClone.copied = true;
            target.statuses.set(statusId, statusClone);
            count++;
          }
        }
      }
      copied[target.entity_id] = count;
    }
    return this.targetsResult("copy_buff", targets, { copied, source_id: source !== null ? source.entity_id : null });
  }

  private opBlockAttack(op: Dict, targets: BattleUnit[]): OperationResult {
    for (const target of targets) target.blocked_attack_hits = target.blocked_attack_hits + toInt(op.maximum_hits);
    return this.targetsResult("block_attack", targets, { maximum_hits: toInt(op.maximum_hits) });
  }

  private opPayHpCost(op: Dict, targets: BattleUnit[]): OperationResult {
    const records: Dict[] = [];
    for (const target of targets) {
      const amount = Math.max(0, Math.trunc((target.max_hp !== 0 ? target.max_hp : 1) * toFloat(op.max_hp_fraction)));
      target.hp = Math.max(toInt(op.cannot_reduce_below), target.hp - amount);
      target.alive = target.hp > 0;
      records.push({ target_id: target.entity_id, hp_cost: amount, hp: target.hp });
    }
    return this.targetsResult("pay_hp_cost", targets, { results: records });
  }

  private opBossDamageModifier(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const record: Dict = {
      multiplier: toFloat(op.multiplier),
      modifier_id: dget(op, "modifier_id", `boss_modifier_${state.boss_modifiers.length}`),
      until_objective_destroyed: dget(op, "until_objective_destroyed"),
      while_any_objective_alive: dget(op, "while_any_objective_alive"),
    };
    state.boss_modifiers.push(record);
    for (const target of targets) {
      target.damage_modifiers.push({ kind: "incoming", multiplier: record.multiplier, modifier_id: record.modifier_id, boss_modifier: true });
    }
    return this.targetsResult("boss_damage_taken_modifier", targets, { modifier: record });
  }

  private opSummon(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const objectiveId = dget(op, "only_if_objective_alive");
    if (objectiveId !== null && truthy(objectiveId)) {
      const objective = state.objectives.get(String(objectiveId)) ?? {};
      if (toInt(dget(objective, "hp", 0)) <= 0) return this.targetsResult("summon_enemies", targets, { summoned: 0 });
    }
    const record: Dict = {
      enemy_id: op.enemy_id, count: toInt(op.count),
      team: state.actor !== null ? state.actor.team : "enemy", join_cycle: "next",
    };
    state.pending_summons.push(record);
    for (const unit of state.spawnSummons(String(record.enemy_id), toInt(record.count))) state.units.push(unit);
    return this.targetsResult("summon_enemies", targets, { summoned: record.count, enemy_id: record.enemy_id });
  }

  private opCancelTelegraph(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    let cancelled = false;
    if (state.pending_telegraph !== null && dget(state.pending_telegraph, "action_id") === op.action_id) {
      state.pending_telegraph.cancelled = true;
      cancelled = true;
    }
    return this.targetsResult("cancel_boss_telegraph", targets, { cancelled });
  }

  private opRemoveBossModifier(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    const modifierId = op.modifier_id;
    state.boss_modifiers = state.boss_modifiers.filter((modifier) => dget(modifier, "modifier_id") !== modifierId);
    for (const unit of state.units) unit.damage_modifiers = unit.damage_modifiers.filter((modifier) => dget(modifier, "modifier_id") !== modifierId);
    return this.targetsResult("remove_boss_modifier", targets, { modifier_id: modifierId });
  }

  private opRemoveCopiedStatuses(op: Dict, targets: BattleUnit[]): OperationResult {
    const removed: Dict = {};
    for (const target of targets) {
      const ids: string[] = [];
      removed[target.entity_id] = ids;
      for (const statusId of [...target.statuses.keys()]) {
        const status = target.statuses.get(statusId)!;
        if (truthy(dget(status, "copied")) && this.statusTags(target, statusId).includes(String(op.category))) {
          target.statuses.delete(statusId);
          ids.push(statusId);
        }
      }
    }
    return this.targetsResult("remove_copied_statuses", targets, { removed });
  }

  private opClearStatusIfObjectivesDestroyed(op: Dict, state: BattleState, targets: BattleUnit[]): OperationResult {
    let allDestroyed = true;
    for (const objectiveId of op.objective_ids as unknown[]) {
      if (toInt(dget(state.objectives.get(String(objectiveId)) ?? {}, "hp", 0)) > 0) {
        allDestroyed = false;
        break;
      }
    }
    if (allDestroyed) for (const target of targets) target.statuses.delete(String(op.status_id));
    return this.targetsResult("clear_status_if_all_objectives_destroyed", targets, { cleared: allDestroyed });
  }
}
