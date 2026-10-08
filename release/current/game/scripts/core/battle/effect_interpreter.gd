class_name EffectInterpreter
extends RefCounted
## Strict interpreter for the `battle_effects_part1.json` operation records (port of core/battle/interpreter.py).
##
## A complete operation list is validated before any battle state is touched. Unknown operations, fields, selector ids,
## predicates, events and statuses are errors; authored content is never silently skipped. The reference raises
## EffectContractError/EffectExecutionError; here the message lands in `error` (and in `BattleState.fault` when a
## battle is running) and the call returns what it has.
##
## Numbers: the reference's float maths is kept operation for operation (doubles), and every `int(...)` truncation and
## `int(x + 0.5)` half-up rounding is written out the same way, because damage, healing and shields are decided there.

const _PREDICATE_VALUE_REQUIRED: Array[String] = [
	"owner_in_row", "owner_hp_below_pct", "owner_hp_above_pct",
	"owner_has_status", "owner_action_type", "last_target_has_status",
	"last_target_has_status_tag", "target_has_status", "target_has_status_tag",
	"target_has_any_status_tag", "target_in_row", "event_target_hp_at_or_below_pct",
	"event_target_had_status", "event_source_faction_is", "count_enemies_with_status",
	"enemy_ally_hp_below_pct", "no_enemy_ally_below_pct",
	"damage_dealt_at_least_pct_of_target_hp", "round_number_at_most",
]
const _IMPLEMENTED_PREDICATES: Array[String] = [
	"owner_in_row", "owner_hp_below_pct", "owner_hp_above_pct", "owner_has_shield",
	"owner_has_status", "owner_action_type", "owner_took_no_damage_this_round",
	"last_target_has_status", "last_target_has_status_tag", "last_target_defeated",
	"last_primary_target_defeated", "target_has_status", "target_has_status_tag",
	"target_has_any_status_tag", "target_has_acted_this_battle", "target_in_row",
	"event_target_hp_at_or_below_pct", "event_target_had_status", "event_actor_has_any_buff",
	"event_source_faction_is", "count_enemies_with_status", "enemy_ally_hp_below_pct",
	"no_enemy_ally_below_pct", "damage_dealt_at_least_pct_of_target_hp",
	"round_number_at_most",
]
const _KNOWN_SELECTOR_KINDS: Array[String] = [
	"manual_single", "row_priority_single", "all_by_row", "all_living",
	"minimum_stat", "maximum_stat", "minimum_stat_by_row",
	"random_excluding_last_primary", "ordered_minimum_stat_set", "event_reference",
	"previous_operation_result", "previous_successful_heal_target", "actor",
	"encounter_boss", "actor_plus_minimum_stat", "actor_plus_tagged_allies",
	"boss_plus_tagged_allies", "maximum_missing_hp", "lowest_hp_with_status",
	"maximum_status_count",
]
const _OPERATIONS: Array[String] = [
	"damage", "heal", "heal_per_removed_status", "grant_shield", "apply_status", "remove_status",
	"reduce_status_durations", "modify_stat", "modify_incoming_damage", "modify_outgoing_damage",
	"grant_damage_reduction", "grant_redirect", "grant_intercept", "grant_first_hit_guard", "grant_opening_guard",
	"gain_focus", "delay_next_action", "reduce_cooldowns", "apply_regeneration", "arm_counter",
	"arm_next_attack_bonus", "grant_status_immunity", "remove_shield", "copy_buff", "block_attack", "pay_hp_cost",
	"boss_damage_taken_modifier", "summon_enemies", "cancel_boss_telegraph", "remove_boss_modifier",
	"remove_copied_statuses", "clear_status_if_all_objectives_destroyed",
]
const _RANK_SCALED_OPS: Array[String] = ["damage", "heal", "heal_per_removed_status", "grant_shield"]
const _DAMAGE_TYPES: Array[String] = ["physical", "magic", "elemental"]
const _TAG_ALIASES: Dictionary = {"mark_or_dread": ["mark", "dread"]}
const _ATTACK_ACTION_TYPES: Array[String] = ["basic", "active", "ultimate", "signature", "counter"]


## The outcome of one operation (`OperationResult` in the reference).
class OperationResult extends RefCounted:
	var operation: String = ""
	var target_ids: Array[String] = []
	var damage: Array[Dictionary] = []
	var healing: Array[Dictionary] = []
	var statuses_applied: Array[Dictionary] = []
	var details: Dictionary = {}


var contract: Dictionary = {}
var schemas: Dictionary = {}
var selector_rules: Dictionary = {}
var predicates: Array = []
var events: Array = []
var rules: Dictionary = {}
var status_definitions: Dictionary = {}
var gauge_rules: GaugeRules = null
var focus_rules: FocusRules = null
var damage_rules: Dictionary = {}
var stat_resolution_rules: Dictionary = {}
var rng: CpythonRandom = null
var progression: Progression = null

## First contract/execution problem of the current call ("" = none); reset by the public entry points.
var error: String = ""

var _registry: ContentModels.ContentRegistry = null


static func create(registry: ContentModels.ContentRegistry, initial_rng: CpythonRandom = null) -> EffectInterpreter:
	var interpreter: EffectInterpreter = EffectInterpreter.new()
	interpreter._registry = registry
	interpreter.rules = registry.battle_rules
	interpreter.contract = registry.effect_contract
	interpreter.schemas = registry.effect_operation_schemas
	var selector_value: Variant = interpreter.contract.get("selector_rules")
	interpreter.selector_rules = selector_value if selector_value is Dictionary else {}
	interpreter.predicates = interpreter.contract.get("predicates", [])
	interpreter.events = interpreter.contract.get("events", [])
	for predicate: Variant in interpreter.predicates:
		if not _IMPLEMENTED_PREDICATES.has(String(predicate)):
			interpreter.error = "Contract predicates have no evaluator: %s" % ContentLoader.py_repr(predicate)
			return interpreter
	for status: Dictionary in interpreter.rules.get("statuses", []):
		interpreter.status_definitions[status["status_id"]] = status
	interpreter.gauge_rules = GaugeRules.from_mapping(interpreter.rules["turn_queue"])
	interpreter.focus_rules = FocusRules.from_mapping(interpreter.rules["focus"])
	if not interpreter.focus_rules.error.is_empty():
		interpreter.error = interpreter.focus_rules.error
		return interpreter
	interpreter.damage_rules = interpreter.rules["damage"]
	interpreter.stat_resolution_rules = interpreter.rules["stat_resolution"]
	interpreter.rng = initial_rng if initial_rng != null else CpythonRandom.new()
	interpreter.progression = Progression.create(registry)
	var missing: Array[String] = []
	for schema_name: String in interpreter.schemas:
		if not _OPERATIONS.has(schema_name):
			missing.append(schema_name)
	var extra: Array[String] = []
	for operation: String in _OPERATIONS:
		if not interpreter.schemas.has(operation):
			extra.append(operation)
	if not missing.is_empty() or not extra.is_empty():
		interpreter.error = "Interpreter/schema operation mismatch: missing=%s, extra=%s" % [ContentLoader.py_repr(missing), ContentLoader.py_repr(extra)]
		return interpreter
	for rule: Dictionary in interpreter.selector_rules.values():
		if not _KNOWN_SELECTOR_KINDS.has(String(rule.get("kind", ""))):
			interpreter.error = "Selector kinds have no resolver: %s" % ContentLoader.py_repr(rule.get("kind"))
			return interpreter
	return interpreter


func _fail(message: String) -> void:
	if error.is_empty():
		error = message


# -- validation ------------------------------------------------------------------------------------


## The normalized (Dictionary) form of an operation given as a Dictionary or an EffectOp record.
func _normalize_operation(raw: Variant, index: int) -> Dictionary:
	if raw is Dictionary:
		return (raw as Dictionary).duplicate()
	if raw is ContentModels.EffectOp:
		var record: ContentModels.EffectOp = raw
		var operation: Dictionary = record.parameters.duplicate()
		operation["op"] = record.op
		if not record.target_selector_id.is_empty():
			operation["target_selector_id"] = record.target_selector_id
		return operation
	_fail("effect_ops[%d] must be an object or EffectOp" % index)
	return {}


## Validates every operation (closed schema, selectors, statuses, events, damage types, conditions) and returns the
## normalized operations; an empty array with `error` set on the first problem.
func validate_effect_ops(effect_ops: Array) -> Array[Dictionary]:
	var normalized: Array[Dictionary] = []
	var index: int = 0
	for raw: Variant in effect_ops:
		var operation: Dictionary = _normalize_operation(raw, index)
		if not error.is_empty():
			return []
		var op_name: Variant = operation.get("op")
		if not (op_name is String) or not schemas.has(op_name):
			_fail("effect_ops[%d]: unknown operation %s" % [index, ContentLoader.py_repr(op_name)])
			return []
		var schema: Dictionary = schemas[op_name]
		var required: Array = schema.get("required", [])
		var optional: Array = schema.get("optional", [])
		var missing: Array[String] = []
		for field: String in required:
			if not operation.has(field):
				missing.append(field)
		var unknown: Array[String] = []
		for field: String in operation:
			if field != "op" and not required.has(field) and not optional.has(field):
				unknown.append(field)
		missing.sort()
		unknown.sort()
		if not missing.is_empty():
			_fail("effect_ops[%d] (%s): missing fields %s" % [index, op_name, ContentLoader.py_repr(missing)])
			return []
		if not unknown.is_empty():
			_fail("effect_ops[%d] (%s): unknown fields %s" % [index, op_name, ContentLoader.py_repr(unknown)])
			return []
		for field_name: String in ["target_selector_id", "source_selector_id", "protected_ally_selector_id"]:
			var selector_id: Variant = operation.get(field_name)
			if selector_id != null and not selector_rules.has(selector_id):
				_fail("effect_ops[%d] (%s): unknown %s %s" % [index, op_name, field_name, ContentLoader.py_repr(selector_id)])
				return []
		var status_id: Variant = operation.get("status_id")
		if status_id != null and not status_definitions.has(status_id):
			_fail("effect_ops[%d] (%s): unknown status_id %s" % [index, op_name, ContentLoader.py_repr(status_id)])
			return []
		var event_name: Variant = operation.get("event")
		if event_name != null and not events.has(event_name):
			_fail("effect_ops[%d] (%s): unknown event %s" % [index, op_name, ContentLoader.py_repr(event_name)])
			return []
		var damage_type: Variant = operation.get("damage_type")
		if damage_type != null and not _DAMAGE_TYPES.has(String(damage_type)):
			_fail("effect_ops[%d] (%s): invalid damage_type %s" % [index, op_name, ContentLoader.py_repr(damage_type)])
			return []
		_validate_conditions(operation, "effect_ops[%d]" % index)
		if not error.is_empty():
			return []
		normalized.append(operation)
		index += 1
	return normalized


func _validate_conditions(operation: Dictionary, location: String) -> void:
	if operation.has("when"):
		_validate_condition(operation["when"], "%s.when" % location)
	var modifiers: Variant = operation.get("modifiers", [])
	if _truthy(modifiers):
		if not (modifiers is Array):
			_fail("%s.modifiers must be an array" % location)
			return
		var index: int = 0
		for modifier: Variant in modifiers:
			if not (modifier is Dictionary):
				_fail("%s.modifiers[%d] must be an object" % [location, index])
				return
			var unknown: Array[String] = []
			for key: String in modifier:
				if not ["condition", "multiplier", "add_multiplier_per_count", "maximum_count"].has(key):
					unknown.append(key)
			unknown.sort()
			if not unknown.is_empty():
				_fail("%s.modifiers[%d]: unknown fields %s" % [location, index, ContentLoader.py_repr(unknown)])
				return
			if not (modifier as Dictionary).has("condition"):
				_fail("%s.modifiers[%d]: condition is required" % [location, index])
				return
			_validate_condition(modifier["condition"], "%s.modifiers[%d].condition" % [location, index])
			index += 1


func _validate_condition(condition: Variant, location: String) -> void:
	if not (condition is Dictionary):
		_fail("%s: a condition must be an object" % location)
		return
	var map: Dictionary = condition
	if map.is_empty():
		_fail("%s: an empty condition is invalid" % location)
		return
	var unknown: Array[String] = []
	for key: String in map:
		if not ["all", "any", "not", "predicate", "value"].has(key):
			unknown.append(key)
	unknown.sort()
	if not unknown.is_empty():
		_fail("%s: unknown condition fields %s" % [location, ContentLoader.py_repr(unknown)])
		return
	var branches: int = 0
	for key: String in ["all", "any", "not", "predicate"]:
		if map.has(key):
			branches += 1
	if branches != 1:
		_fail("%s: use exactly one of all, any, not, or predicate" % location)
		return
	if map.has("all") or map.has("any"):
		var key: String = "all" if map.has("all") else "any"
		var values: Variant = map[key]
		if not (values is Array) or (values as Array).is_empty():
			_fail("%s.%s: expected a non-empty condition array" % [location, key])
			return
		var index: int = 0
		for nested: Variant in values:
			_validate_condition(nested, "%s.%s[%d]" % [location, key, index])
			index += 1
		if map.has("value"):
			_fail("%s: boolean group cannot carry value" % location)
		return
	if map.has("not"):
		_validate_condition(map["not"], "%s.not" % location)
		if map.has("value"):
			_fail("%s: not-group cannot carry value" % location)
		return
	var predicate: Variant = map.get("predicate")
	if not predicates.has(predicate):
		_fail("%s: unknown predicate %s" % [location, ContentLoader.py_repr(predicate)])
		return
	if _PREDICATE_VALUE_REQUIRED.has(String(predicate)) and not map.has("value"):
		_fail("%s: predicate %s requires value" % [location, ContentLoader.py_repr(predicate)])


static func _truthy(value: Variant) -> bool:
	if value == null:
		return false
	if value is bool:
		return value
	if value is int or value is float:
		return value != 0
	if value is String or value is Array or value is Dictionary:
		return not value.is_empty()
	return true


# -- execution -------------------------------------------------------------------------------------


## Runs a skill's effect_ops (`type` and `skill_id` come from the record).
func execute_skill(skill: ContentModels.Skill, state: BattleState, actor: BattleUnit, skill_action_type: String = "", manual_targets: Dictionary = {}, event_payload: Variant = null) -> Array[OperationResult]:
	var ops: Array = []
	for op: ContentModels.EffectOp in skill.effect_ops:
		ops.append(op)
	return execute_effect_ops(ops, state, actor, skill_action_type if not skill_action_type.is_empty() else skill.type, manual_targets, event_payload, skill.skill_id)


## Validates then runs `effect_ops` for `actor`. `manual_targets` maps selector id -> ids; `event_payload` seeds the
## state's event (hook payloads). `skill_id` selects the skill rank scaling.
func execute_effect_ops(effect_ops: Array, state: BattleState, actor: BattleUnit = null, op_action_type: String = "skill", manual_targets: Variant = null, event_payload: Variant = null, skill_id: String = "") -> Array[OperationResult]:
	error = ""
	var results: Array[OperationResult] = []
	var operations: Array[Dictionary] = validate_effect_ops(effect_ops)
	if not error.is_empty():
		state.report_fault(error)
		return results
	var acting: BattleUnit = actor if actor != null else state.actor
	if acting == null:
		state.report_fault("An actor is required to execute effect_ops")
		return results
	operations = _apply_skill_rank(operations, acting, skill_id)
	state.actor = acting
	state.action_type = op_action_type
	state.gauge_rules = gauge_rules
	for unit: BattleUnit in state.units:
		unit.stat_resolution_rules = stat_resolution_rules
		unit.status_definitions = status_definitions
	if state.rng == null:
		state.rng = rng
	else:
		# The battle loop owns one seeded stream shared by target rolls, status chances and per-hit critical checks.
		rng = state.rng
	if manual_targets != null:
		var mapped: Dictionary = {}
		for key: String in (manual_targets as Dictionary):
			mapped[key] = _ids(manual_targets[key])
		state.manual_targets = mapped
	if event_payload != null:
		state.event = (event_payload as Dictionary).duplicate()
	for operation: Dictionary in operations:
		var op_name: String = operation["op"]
		var selector_id: Variant = operation.get("target_selector_id")
		var targets: Array[BattleUnit] = []
		if selector_id != null and _truthy(selector_id):
			targets = resolve_selector(String(selector_id), state, operation)
		if operation.get("when") != null:
			var kept: Array[BattleUnit] = []
			for candidate: BattleUnit in targets:
				if evaluate_condition(operation["when"], state, candidate):
					kept.append(candidate)
			targets = kept
			# Owner-only effects (e.g. a conditional focus gain) with an empty selector still need their owner condition.
			if selector_id != null and _truthy(selector_id) and targets.is_empty():
				state.previous_operation_targets = []
				var skipped: OperationResult = OperationResult.new()
				skipped.operation = op_name
				results.append(skipped)
				continue
		state.previous_operation_targets = targets.duplicate()
		var result: OperationResult = _run_handler(op_name, operation, state, targets)
		if not error.is_empty():
			state.report_fault(error)
			return results
		results.append(result)
		state.log.append({
			"event": "effect_operation", "operation": op_name, "actor_id": acting.entity_id,
			"target_ids": result.target_ids.duplicate(), "details": result.details.duplicate(),
		})
		_publish_presentation_events(result, state, acting.entity_id)
	return results


func _run_handler(op_name: String, operation: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	match op_name:
		"damage":
			return _op_damage(operation, state, targets)
		"heal":
			return _op_heal(operation, state, targets)
		"heal_per_removed_status":
			return _op_heal_per_removed_status(operation, state, targets)
		"grant_shield":
			return _op_grant_shield(operation, state, targets)
		"apply_status":
			return _op_apply_status(operation, state, targets)
		"remove_status":
			return _op_remove_status(operation, state, targets)
		"reduce_status_durations":
			return _op_reduce_status_durations(operation, state, targets)
		"modify_stat":
			return _op_modify_stat(operation, state, targets)
		"modify_incoming_damage", "modify_outgoing_damage":
			return _op_damage_modifier(operation, state, targets)
		"grant_damage_reduction":
			return _op_grant_damage_reduction(operation, state, targets)
		"grant_redirect":
			return _op_grant_redirect(operation, state, targets)
		"grant_intercept":
			return _op_grant_intercept(operation, state, targets)
		"grant_first_hit_guard":
			return _op_first_hit_guard(operation, state, targets)
		"grant_opening_guard":
			return _op_opening_guard(operation, state, targets)
		"gain_focus":
			return _op_gain_focus(operation, state, targets)
		"delay_next_action":
			return _op_delay_next_action(operation, state, targets)
		"reduce_cooldowns":
			return _op_reduce_cooldowns(operation, state, targets)
		"apply_regeneration":
			return _op_regeneration(operation, state, targets)
		"arm_counter":
			return _op_arm_counter(operation, state, targets)
		"arm_next_attack_bonus":
			return _op_next_attack_bonus(operation, state, targets)
		"grant_status_immunity":
			return _op_status_immunity(operation, state, targets)
		"remove_shield":
			return _op_remove_shield(operation, state, targets)
		"copy_buff":
			return _op_copy_buff(operation, state, targets)
		"block_attack":
			return _op_block_attack(operation, state, targets)
		"pay_hp_cost":
			return _op_pay_hp_cost(operation, state, targets)
		"boss_damage_taken_modifier":
			return _op_boss_damage_modifier(operation, state, targets)
		"summon_enemies":
			return _op_summon(operation, state, targets)
		"cancel_boss_telegraph":
			return _op_cancel_telegraph(operation, state, targets)
		"remove_boss_modifier":
			return _op_remove_boss_modifier(operation, state, targets)
		"remove_copied_statuses":
			return _op_remove_copied_statuses(operation, state, targets)
		"clear_status_if_all_objectives_destroyed":
			return _op_clear_status_if_objectives_destroyed(operation, state, targets)
	_fail("Interpreter has no handler for operation %s" % op_name)
	return OperationResult.new()


## Compact state-change events for presentation adapters (separate from `state.log` so a UI observer cannot change
## authored applied-order values or replay data).
static func _publish_presentation_events(result: OperationResult, state: BattleState, source_id: String) -> void:
	var by_id: Dictionary = {}
	for unit: BattleUnit in state.units:
		by_id[unit.entity_id] = unit
	for record: Dictionary in result.damage:
		var target_id: String = _first_text(record.get("recipient_id"), record.get("target_id"))
		var target: BattleUnit = by_id.get(target_id)
		state.record_event({
			"type": "damage_dealt", "source_id": source_id, "target_id": target_id,
			"amount": int(record.get("damage", 0)), "hp_damage": int(record.get("hp_damage", 0)),
			"shield_absorbed": int(record.get("shield_absorbed", 0)),
			"hp": target.hp if target != null else null,
			"max_hp": target.max_hp if target != null else null,
			"alive": target.alive if target != null else null,
			"damage_type": record.get("damage_type"), "element": record.get("element"),
			"critical": bool(record.get("critical", false)),
		})
	for record: Dictionary in result.healing:
		var target_id: String = str(record.get("target_id", ""))
		var target: BattleUnit = by_id.get(target_id)
		state.record_event({
			"type": "healing_applied", "source_id": source_id, "target_id": target_id,
			"amount": int(record.get("healing", 0)),
			"hp": target.hp if target != null else null,
			"max_hp": target.max_hp if target != null else null,
			"alive": target.alive if target != null else null,
		})
	for record: Dictionary in result.statuses_applied:
		var target_id: String = str(record.get("target_id", ""))
		var target: BattleUnit = by_id.get(target_id)
		state.record_event({
			"type": "status_applied", "source_id": source_id, "target_id": target_id,
			"status_id": str(record.get("status_id", "")),
			"duration_turns": int(record.get("duration_turns", 0)),
			"statuses": BattleUtil.sorted_keys(target.statuses) if target != null else [],
			"hp": target.hp if target != null else null,
			"max_hp": target.max_hp if target != null else null,
		})


## `str(record.get("recipient_id") or record.get("target_id") or "")`.
static func _first_text(first: Variant, second: Variant) -> String:
	if _truthy(first):
		return str(first)
	if _truthy(second):
		return str(second)
	return ""


# -- selectors -------------------------------------------------------------------------------------


func resolve_selector(selector_id: String, state: BattleState, operation: Dictionary = {}) -> Array[BattleUnit]:
	var none: Array[BattleUnit] = []
	if selector_id.is_empty():
		return none
	if not selector_rules.has(selector_id):
		_fail("Unknown target_selector_id %s" % ContentLoader.py_repr(selector_id))
		return none
	var rule: Dictionary = selector_rules[selector_id]
	var kind: String = rule["kind"]
	var actor: BattleUnit = state.actor
	if kind == "actor":
		return _one(actor) if actor != null and actor.alive else none
	if kind == "encounter_boss":
		var boss: BattleUnit = state.boss
		if boss == null:
			for unit: BattleUnit in state.units:
				if unit.is_boss and unit.alive:
					boss = unit
					break
		return _one(boss) if boss != null else none
	if kind == "event_reference":
		var referenced: Variant = state.event.get(rule["reference"])
		var unit_ref: BattleUnit = _resolve_unit_reference(referenced, state)
		return _one(unit_ref) if unit_ref != null else none
	if kind == "previous_operation_result":
		var alive_targets: Array[BattleUnit] = []
		for unit: BattleUnit in state.previous_operation_targets:
			if unit.alive:
				alive_targets.append(unit)
		return alive_targets
	if kind == "previous_successful_heal_target":
		var alive_healed: Array[BattleUnit] = []
		for unit: BattleUnit in state.previous_successful_heal_targets:
			if unit.alive:
				alive_healed.append(unit)
		return alive_healed
	if kind == "manual_single":
		var forced_target: BattleUnit = _taunt_forced_target(state, rule.get("side"))
		if forced_target != null:
			return [forced_target]
		var selected_ids: Array = state.manual_targets.get(selector_id, [])
		if not selected_ids.is_empty():
			var candidates_manual: Array[BattleUnit] = _side_units(rule.get("side"), state)
			var picked: BattleUnit = null
			for entity_id: Variant in selected_ids:
				for candidate: BattleUnit in candidates_manual:
					if candidate.entity_id == entity_id and candidate.alive:
						picked = candidate
						break
				if picked != null:
					break
			if picked == null and rule.get("side") == "opposing":
				for entity_id: Variant in selected_ids:
					var objective: Variant = state.objectives.get(entity_id)
					if objective == null:
						for candidate_objective: Dictionary in state.objectives.values():
							if candidate_objective.get("entity_id") == entity_id:
								objective = candidate_objective
								break
					var objective_unit: Variant = (objective as Dictionary).get("unit") if objective != null else null
					if objective_unit != null and (objective_unit as BattleUnit).alive and (objective_unit as BattleUnit).hp > 0 and bool((objective as Dictionary).get("targetable_by_player", true)):
						picked = objective_unit
						break
			return _one(picked) if picked != null else none
		if not state.automatic:
			return none
		var fallback: Variant = rule.get("auto_fallback")
		return resolve_selector(String(fallback), state, operation) if fallback != null and _truthy(fallback) else none
	var candidates: Array[BattleUnit] = _side_units(rule.get("side"), state)
	if kind == "all_living":
		return _sort_units(candidates)
	if kind == "all_by_row":
		var in_row: Array[BattleUnit] = []
		for unit: BattleUnit in candidates:
			if unit.row == rule["row"]:
				in_row.append(unit)
		return _sort_units(in_row)
	if kind == "row_priority_single":
		var forced: BattleUnit = _taunt_forced_target(state, rule.get("side"))
		if forced != null:
			return [forced]
		for row: Variant in rule.get("row_priority", ["front", "rear"]):
			var row_units: Array[BattleUnit] = []
			for unit: BattleUnit in candidates:
				if unit.row == row:
					row_units.append(unit)
			if not row_units.is_empty():
				return [_sort_units(row_units)[0]]
		return none
	if ["minimum_stat", "maximum_stat", "minimum_stat_by_row", "maximum_missing_hp", "lowest_hp_with_status", "maximum_status_count"].has(kind):
		var pool: Array[BattleUnit] = candidates
		if kind == "minimum_stat_by_row":
			var by_row: Array[BattleUnit] = []
			for unit: BattleUnit in pool:
				if unit.row == rule["row"]:
					by_row.append(unit)
			pool = by_row
		elif kind == "lowest_hp_with_status":
			var with_status: Array[BattleUnit] = []
			for unit: BattleUnit in pool:
				if unit.has_status(String(rule["status_id"])):
					with_status.append(unit)
			pool = with_status
		var reverse: bool = false
		var stat_fn: Callable
		if kind == "maximum_status_count":
			var category: Variant = rule.get("status_category")
			stat_fn = func(unit: BattleUnit) -> float: return float(_category_status_count(unit, category))
			reverse = true
		elif kind == "maximum_missing_hp":
			stat_fn = func(unit: BattleUnit) -> float: return float(unit.max_hp - unit.hp)
			reverse = true
		else:
			var stat_name: Variant = rule.get("stat")
			stat_fn = func(unit: BattleUnit) -> float: return _stat_value(unit, stat_name)
			reverse = kind == "maximum_stat"
		if pool.is_empty() and kind == "lowest_hp_with_status" and _truthy(rule.get("empty_fallback")):
			return resolve_selector(String(rule["empty_fallback"]), state, operation)
		var ranked: Array[BattleUnit] = _ranked(pool, stat_fn, reverse, rule.get("tie_break", []))
		return ranked.slice(0, 1)
	if kind == "ordered_minimum_stat_set":
		var stat_name_set: Variant = rule.get("stat")
		var ranked_set: Array[BattleUnit] = _ranked(candidates, func(unit: BattleUnit) -> float: return _stat_value(unit, stat_name_set), false, rule.get("tie_break", []))
		var maximum: Variant = operation.get("maximum_targets", ranked_set.size()) if not operation.is_empty() else ranked_set.size()
		var limit: int = ranked_set.size() if (maximum == null or (maximum is String and maximum == "all")) else maxi(0, int(maximum))
		return ranked_set.slice(0, limit)
	if kind == "random_excluding_last_primary":
		var primary: BattleUnit = state.last_primary_target
		var options: Array[BattleUnit] = []
		for unit: BattleUnit in candidates:
			if primary == null or unit.entity_id != primary.entity_id:
				options.append(unit)
		if options.is_empty():
			var empty_fallback: Variant = rule.get("empty_fallback")
			return resolve_selector(String(empty_fallback), state, operation) if _truthy(empty_fallback) else none
		var sorted_options: Array[BattleUnit] = _sort_units(options)
		return [rng.choice(sorted_options)]
	if kind == "actor_plus_minimum_stat":
		var others: Array[BattleUnit] = []
		for unit: BattleUnit in candidates:
			if actor == null or unit.entity_id != actor.entity_id:
				others.append(unit)
		var stat_name_min: Variant = rule["stat"]
		var ranked_others: Array[BattleUnit] = _ranked(others, func(unit: BattleUnit) -> float: return _stat_value(unit, stat_name_min), false, rule.get("tie_break", []))
		var combined: Array[BattleUnit] = []
		if actor != null and actor.alive:
			combined.append(actor)
		combined.append_array(ranked_others.slice(0, 1))
		return _unique_units(combined)
	if kind == "actor_plus_tagged_allies" or kind == "boss_plus_tagged_allies":
		var base: BattleUnit = state.boss if kind == "boss_plus_tagged_allies" else actor
		var team: String = ""
		if base != null:
			team = base.team
		elif actor != null:
			team = actor.team
		var tagged: Array[BattleUnit] = []
		for unit: BattleUnit in state.living_units(team):
			if _has_tag(unit, String(rule.get("tag", ""))):
				tagged.append(unit)
		var allies: Array[BattleUnit] = _sort_units(tagged)
		var group: Array[BattleUnit] = []
		if base != null and base.alive:
			group.append(base)
		group.append_array(allies)
		return _unique_units(group)
	_fail("Selector %s has unsupported kind %s" % [ContentLoader.py_repr(selector_id), ContentLoader.py_repr(kind)])
	return none


static func _one(unit: BattleUnit) -> Array[BattleUnit]:
	var single: Array[BattleUnit] = [unit]
	return single


func _side_units(side: Variant, state: BattleState) -> Array[BattleUnit]:
	var actor: BattleUnit = state.actor
	if side == "opposing":
		return state.living_units(state.opposing_team(actor))
	if side == "boss_team":
		var team: String = ""
		if state.boss != null:
			team = state.boss.team
		elif actor != null:
			team = actor.team
		return state.living_units(team)
	if side == "actor" or side == null:
		return state.living_units(actor.team if actor != null else "")
	_fail("Unsupported selector side %s" % ContentLoader.py_repr(side))
	return []


## Living units by (slot index, entity id).
static func _sort_units(units: Array) -> Array[BattleUnit]:
	var living: Array = []
	for unit: BattleUnit in units:
		if unit.alive and unit.hp > 0:
			living.append(unit)
	var sorted: Array = BattleUtil.sorted_by(living, func(unit: BattleUnit) -> Array: return [unit.slot_index, unit.entity_id])
	var result: Array[BattleUnit] = []
	result.assign(sorted)
	return result


## Living units ordered by `stat_fn` (descending when `reverse`), then the authored tie-break fields.
func _ranked(units: Array, stat_fn: Callable, reverse: bool, tie_break: Array) -> Array[BattleUnit]:
	var living: Array = []
	for unit: BattleUnit in units:
		if unit.alive and unit.hp > 0:
			living.append(unit)
	var sorted: Array = BattleUtil.sorted_by(living, func(unit: BattleUnit) -> Array:
		var value: float = float(stat_fn.call(unit))
		var keys: Array = [-value if reverse else value]
		for field_name: Variant in tie_break:
			keys.append(unit.slot_index if field_name == "slot_index" else unit.entity_id)
		if tie_break.is_empty():
			keys.append(unit.slot_index)
			keys.append(unit.entity_id)
		return keys)
	var result: Array[BattleUnit] = []
	result.assign(sorted)
	return result


func _taunt_forced_target(state: BattleState, side: Variant) -> BattleUnit:
	var actor: BattleUnit = state.actor
	if side != "opposing" or actor == null:
		return null
	for status_id: String in actor.statuses:
		var status: Dictionary = actor.statuses[status_id]
		if int(status.get("duration_turns", 0)) <= 0:
			continue
		if status_id != "taunt" and not (status.get("tags", []) as Array).has("taunt"):
			continue
		var source: BattleUnit = _resolve_unit_reference(status.get("source_id"), state)
		if source != null and source.alive and source.team != actor.team:
			return source
	return null


func _stat_value(unit: BattleUnit, stat_name: Variant) -> float:
	if stat_name == "hp_fraction":
		return _hp_pct(unit)
	if stat_name == "focus":
		return float(unit.focus)
	return float(unit.effective_stat(str(stat_name)))


func _category_status_count(unit: BattleUnit, category: Variant) -> int:
	if category == null:
		return unit.statuses.size()
	var count: int = 0
	for status_id: String in unit.statuses:
		if _status_tags(unit, status_id).has(String(category)):
			count += 1
	return count


static func _hp_pct(unit: BattleUnit) -> float:
	var maximum: int = maxi(1, unit.max_hp if unit.max_hp != 0 else 1)
	return float(unit.hp) * 100.0 / float(maximum)


func _has_tag(unit: BattleUnit, tag: String) -> bool:
	var wanted: Array = _TAG_ALIASES.get(tag, [tag])
	for candidate: String in unit.tags:
		if wanted.has(candidate):
			return true
	for status_id: String in unit.statuses:
		for status_tag: String in _status_tags(unit, status_id):
			if wanted.has(status_tag):
				return true
	return false


func _status_tags(unit: BattleUnit, status_id: String) -> Array[String]:
	return unit.status_tags(status_id, status_definitions)


static func _resolve_unit_reference(reference: Variant, state: BattleState) -> BattleUnit:
	if reference is BattleUnit:
		return reference
	if reference is String:
		for unit: BattleUnit in state.units:
			if unit.entity_id == reference:
				return unit
		return null
	if reference is Dictionary:
		var map: Dictionary = reference
		var entity_id: Variant = map.get("entity_id", map.get("unit_id"))
		if entity_id != null:
			for unit: BattleUnit in state.units:
				if unit.entity_id == entity_id:
					return unit
	return null


static func _ids(value: Variant) -> Array[String]:
	var ids: Array[String] = []
	if value == null:
		return ids
	var values: Array = value if value is Array else [value]
	for item: Variant in values:
		ids.append((item as BattleUnit).entity_id if item is BattleUnit else str(item))
	return ids


static func _unique_units(units: Array) -> Array[BattleUnit]:
	var result: Array[BattleUnit] = []
	var seen: Dictionary = {}
	for unit: Variant in units:
		if unit != null and (unit as BattleUnit).alive and not seen.has((unit as BattleUnit).entity_id):
			seen[(unit as BattleUnit).entity_id] = true
			result.append(unit)
	return result


func _targets_result(op: String, targets: Array[BattleUnit], details: Dictionary = {}) -> OperationResult:
	var result: OperationResult = OperationResult.new()
	result.operation = op
	for unit: BattleUnit in targets:
		result.target_ids.append(unit.entity_id)
	result.details = details
	return result


# -- conditions ------------------------------------------------------------------------------------


## Validates then evaluates a condition (`all`/`any`/`not`/`predicate`) against the state.
func evaluate_condition(condition: Variant, state: BattleState, target: BattleUnit = null) -> bool:
	_validate_condition(condition, "condition")
	if not error.is_empty():
		state.report_fault(error)
		return false
	return _evaluate_condition(condition, state, target)


func _evaluate_condition(condition: Dictionary, state: BattleState, target: BattleUnit) -> bool:
	if condition.has("all"):
		for item: Variant in condition["all"]:
			if not _evaluate_condition(item, state, target):
				return false
		return true
	if condition.has("any"):
		for item: Variant in condition["any"]:
			if _evaluate_condition(item, state, target):
				return true
		return false
	if condition.has("not"):
		return not _evaluate_condition(condition["not"], state, target)
	return _evaluate_predicate(String(condition["predicate"]), condition.get("value"), state, target)


func _evaluate_predicate(predicate: String, value: Variant, state: BattleState, target: BattleUnit) -> bool:
	var owner_unit: BattleUnit = state.actor
	var event_actor: BattleUnit = _resolve_unit_reference(state.event.get("actor"), state)
	var event_target: BattleUnit = _resolve_unit_reference(state.event.get("target"), state)
	var last: BattleUnit = state.last_target
	var own_team: String = owner_unit.team if owner_unit != null else ""
	var allies: Array[BattleUnit] = state.living_units(own_team) if not own_team.is_empty() else []
	var enemies: Array[BattleUnit] = state.living_units(state.opposing_team(owner_unit)) if owner_unit != null else []
	match predicate:
		"owner_in_row":
			return owner_unit != null and owner_unit.row == value
		"owner_hp_below_pct":
			return owner_unit != null and _hp_pct(owner_unit) < float(value)
		"owner_hp_above_pct":
			return owner_unit != null and _hp_pct(owner_unit) > float(value)
		"owner_has_shield":
			return owner_unit != null and owner_unit.shield_total() > 0
		"owner_has_status":
			return owner_unit != null and owner_unit.has_status(str(value))
		"owner_action_type":
			return state.action_type == value
		"owner_took_no_damage_this_round":
			return owner_unit != null and owner_unit.damage_taken_this_round == 0 and not state.damaged_entity_ids_this_round.has(owner_unit.entity_id)
		"last_target_has_status", "last_target_has_status_tag":
			if last == null:
				return false
			if predicate == "last_target_has_status":
				return last.has_status(str(value))
			return _has_tag(last, str(value))
		"last_target_defeated":
			return last != null and (not last.alive or last.hp <= 0)
		"last_primary_target_defeated":
			return state.last_primary_target_defeated
		"target_has_status":
			return target != null and target.has_status(str(value))
		"target_has_status_tag", "target_has_any_status_tag":
			return target != null and _has_tag(target, str(value))
		"target_has_acted_this_battle":
			return target != null and (target.has_acted or state.acted_entity_ids.has(target.entity_id))
		"target_in_row":
			return target != null and target.row == value
		"event_target_hp_at_or_below_pct":
			return event_target != null and _hp_pct(event_target) <= float(value)
		"event_target_had_status":
			var before: Variant = state.event.get("target_statuses_before", [])
			return (before as Array).has(str(value))
		"event_actor_has_any_buff":
			if event_actor == null:
				return false
			for status_id: String in event_actor.statuses:
				if _status_tags(event_actor, status_id).has("buff"):
					return true
			return false
		"event_source_faction_is":
			var source: BattleUnit = _resolve_unit_reference(state.event.get("source"), state)
			if source == null:
				return false
			var faction: String = source.faction_id if not source.faction_id.is_empty() else source.team
			return faction == value
		"count_enemies_with_status":
			var count: int = 0
			for unit: BattleUnit in enemies:
				if unit.has_status(str(value)):
					count += 1
			return count > 0
		"enemy_ally_hp_below_pct":
			for unit: BattleUnit in allies:
				if _hp_pct(unit) < float(value):
					return true
			return false
		"no_enemy_ally_below_pct":
			for unit: BattleUnit in allies:
				if _hp_pct(unit) < float(value):
					return false
			return true
		"damage_dealt_at_least_pct_of_target_hp":
			var max_hp: int = state.last_damage_target_max_hp
			if max_hp == 0:
				max_hp = target.max_hp if target != null else 0
			return max_hp > 0 and float(state.last_damage) >= float(max_hp) * float(value) / 100.0
		"round_number_at_most":
			return state.round_number <= int(value)
	_fail("Predicate %s has no evaluator" % ContentLoader.py_repr(predicate))
	return false


# -- operations ------------------------------------------------------------------------------------


func _chance_succeeds(operation: Dictionary) -> bool:
	var chance: float = float(operation.get("chance", 1.0))
	if not (0.0 <= chance and chance <= 1.0):
		_fail("chance must be in [0, 1], got %s" % str(chance))
		return false
	if chance == 1.0:
		return true
	if chance == 0.0:
		return false
	return rng.random() < chance


func _op_damage(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var actor: BattleUnit = state.actor
	if not _chance_succeeds(op):
		return _targets_result("damage", targets, {"chance_failed": true})
	var per_target_multiplier: float = float(op["multiplier"])
	var damage_records: Array[Dictionary] = []
	var hits: int = maxi(1, int(op.get("hit_count", 1)))
	var damage_action_id: int = state.next_damage_action_id()
	var attack_bonus: float = 1.0
	var consumed_bonuses: Array[Dictionary] = []
	for bonus: Dictionary in actor.next_attack_bonuses:
		attack_bonus *= float(bonus.get("damage_multiplier", 1.0))
		if bool(bonus.get("consume_on_attack", true)):
			consumed_bonuses.append(bonus)
	var passives_enabled: bool = bool(op.get("can_trigger_passives", true))
	for target: BattleUnit in targets:
		state.last_target = target
		state.last_primary_target = target
		for recipient: Array in _damage_recipients(target, actor, state):
			var defender: BattleUnit = recipient[0]
			var redirected_fraction: float = recipient[1]
			var redirect_kind: Variant = recipient[2]
			var reaction_multiplier: float = 1.0
			if defender.has_status("soaked"):
				var reaction: Variant = null
				for item: Dictionary in (status_definitions["soaked"] as Dictionary).get("reaction_triggers", []):
					if item.get("element") == actor.element:
						reaction = item
						break
				if reaction != null:
					reaction_multiplier = 1.0 + float((reaction as Dictionary)["bonus_damage_multiplier"])
					if bool((reaction as Dictionary).get("consume_status", true)):
						defender.statuses.erase("soaked")
			for _hit: int in range(hits):
				if not defender.alive:
					break
				var hit_multiplier: float = per_target_multiplier * attack_bonus * redirected_fraction * reaction_multiplier
				var previous_event: Dictionary = state.event.duplicate()
				var hit_event: Dictionary = {
					"actor": actor, "source": actor, "target": defender, "primary_target": target,
					"action_type": state.action_type, "source_action_type": state.action_type,
					"incoming_action_type": state.action_type, "damage_action_type": state.action_type,
					"damage_action_id": damage_action_id,
					"target_statuses_before": _keys_in_order(defender.statuses),
					"target_hp_before": defender.hp,
					"can_trigger_passives": passives_enabled,
					"no_focus_gain": bool(op.get("no_focus_gain", false)),
				}
				if passives_enabled:
					if state.supports_passives():
						state.dispatch_battle_event("before_damage_dealt", hit_event, self)
						var recipient_event: Dictionary = hit_event.duplicate()
						recipient_event["target"] = defender
						recipient_event["team"] = defender.team
						state.dispatch_battle_event("before_damage_received", recipient_event, self)
						hit_multiplier *= state.continuous_damage_multiplier("before_damage_dealt", hit_event, self)
						hit_multiplier *= state.continuous_damage_multiplier("before_damage_received", recipient_event, self)
				state.event = previous_event
				if defender.blocked_attack_hits > 0:
					defender.blocked_attack_hits -= 1
					damage_records.append({"target_id": target.entity_id, "recipient_id": defender.entity_id, "blocked": true, "damage": 0})
					continue
				for rule: Dictionary in op.get("modifiers", []):
					if evaluate_condition(rule["condition"], state, target):
						if rule.has("multiplier"):
							hit_multiplier *= float(rule["multiplier"])
						if rule.has("add_multiplier_per_count"):
							var count: int = _condition_count(rule["condition"], state, target)
							count = mini(count, int(rule.get("maximum_count", count)))
							hit_multiplier += float(rule["add_multiplier_per_count"]) * float(count)
				hit_multiplier *= _objective_damage_multiplier(op, state)
				var stat: String = str(op.get("scale_stat", "atk"))
				var scale_value: int = actor.effective_stat(stat)
				# Damage's canonical formula uses the chosen source stat as the attack basis; non-ATK scale stats get a
				# read-only view.
				var source: Damage.Attacker = Damage.Attacker.of_unit(actor) if stat == "atk" else Damage.Attacker.scaled(actor, scale_value)
				var result: Damage.DamageResult = Damage.calculate_damage(
					source, defender, String(op["damage_type"]), actor.element, hit_multiplier, rng,
					damage_rules, status_definitions, float(op.get("shield_damage_multiplier", 1.0)), true)
				if not result.error.is_empty():
					_fail(result.error)
					return _targets_result("damage", targets)
				var shared_damage: int = _apply_soul_link_damage(defender, result.hp_damage, state)
				state.last_damage = result.damage
				state.last_damage_target_max_hp = defender.max_hp
				state.last_damage_target_defeated = not defender.alive
				state.last_primary_target_defeated = not target.alive
				if result.damage != 0:
					state.damaged_entity_ids_this_round[defender.entity_id] = true
				damage_records.append({
					"target_id": target.entity_id, "recipient_id": defender.entity_id,
					"redirect_kind": redirect_kind, "redirected_fraction": redirected_fraction,
					"damage": result.damage, "hp_damage": maxi(0, result.hp_damage - shared_damage),
					"shared_damage": shared_damage, "shield_absorbed": result.shield_absorbed,
					"critical": result.critical, "damage_type": op["damage_type"], "element": actor.element if not actor.element.is_empty() else null,
					"defense_stat": result.defense_stat, "element_multiplier": result.element_multiplier,
				})
				if defender.is_objective and not defender.objective_id.is_empty():
					var objective: Variant = state.objectives.get(defender.objective_id)
					if objective != null:
						(objective as Dictionary)["hp"] = defender.hp
						if defender.hp <= 0 and not bool((objective as Dictionary).get("destroyed", false)):
							(objective as Dictionary)["destroyed"] = true
							state.objective_destroyed(objective, self, actor)
				for modifier: Dictionary in defender.damage_modifiers.duplicate():
					if int(modifier.get("hits_remaining", 1)) > 1:
						modifier["hits_remaining"] = int(modifier["hits_remaining"]) - 1
					elif modifier.has("hits_remaining"):
						BattleUtil.remove_first_equal(defender.damage_modifiers, modifier)
				if passives_enabled:
					var after_event: Dictionary = hit_event.duplicate()
					after_event["damage"] = result.damage
					after_event["hp_damage"] = result.hp_damage
					after_event["shield_absorbed"] = result.shield_absorbed
					after_event["target_hp_after"] = defender.hp
					after_event["target_defeated"] = not defender.alive
					after_event["target_statuses_before"] = (hit_event["target_statuses_before"] as Array).duplicate()
					if state.supports_passives() and (result.damage > 0 or result.shield_absorbed > 0):
						var received: Dictionary = after_event.duplicate()
						received["team"] = defender.team
						state.dispatch_battle_event("after_damage_received", received, self)
						if defender.team != actor.team:
							state.dispatch_battle_event("ally_damaged", after_event, self)
						state.dispatch_battle_event("after_damage_dealt", after_event, self)
						if result.hp_damage > 0 and defender.team == "player":
							var defender_max: float = float(maxi(1, defender.max_hp if defender.max_hp != 0 else 1))
							var before_pct: float = float(hit_event["target_hp_before"]) * 100.0 / defender_max
							var after_pct: float = float(defender.hp) * 100.0 / defender_max
							if before_pct > after_pct:
								var crossed: Dictionary = after_event.duplicate()
								crossed["team"] = defender.team
								crossed["threshold_crossed"] = true
								state.dispatch_battle_event("ally_hp_threshold_crossed", crossed, self)
						if not defender.alive:
							state.dispatch_battle_event("after_enemy_defeated", after_event, self)
					if result.damage > 0 and not bool(op.get("no_focus_gain", false)):
						var taken: int = defender.hit_focus_gained_this_turn
						var gained: int = state.focus_rules.hit_gain(taken)
						defender.focus = mini(state.focus_rules.maximum, defender.focus + gained)
						defender.hit_focus_gained_this_turn = taken + gained
					state.event = previous_event
	for bonus: Dictionary in consumed_bonuses:
		BattleUtil.remove_first_equal(actor.next_attack_bonuses, bonus)
	var final_result: OperationResult = _targets_result("damage", targets, {"hits": hits})
	final_result.damage = damage_records
	return final_result


static func _keys_in_order(map: Dictionary) -> Array[String]:
	var keys: Array[String] = []
	for key: String in map:
		keys.append(key)
	return keys


func _apply_soul_link_damage(defender: BattleUnit, hp_damage: int, state: BattleState) -> int:
	if hp_damage <= 0 or not defender.alive or not defender.has_status("soul_link"):
		return 0
	var link: Dictionary = defender.statuses["soul_link"]
	var source: BattleUnit = _resolve_unit_reference(link.get("source_id"), state)
	if source == null or source == defender or not source.alive:
		return 0
	var fraction: float = maxf(0.0, float(link.get("shared_damage_fraction", 0.25)))
	var definition: Dictionary = status_definitions["soul_link"]
	var cap_fraction: float = float(definition.get("maximum_shared_damage_per_hit_pct_of_max_hp", 0.15))
	var shared: int = mini(int(float(hp_damage) * fraction), int(float(source.max_hp) * cap_fraction))
	shared = mini(shared, source.hp)
	if shared <= 0:
		return 0
	defender.hp = mini(defender.max_hp if defender.max_hp != 0 else 1, defender.hp + shared)
	defender.alive = defender.hp > 0
	source.hp = maxi(0, source.hp - shared)
	source.alive = source.hp > 0
	source.damage_taken_this_round += shared
	state.damaged_entity_ids_this_round[source.entity_id] = true
	return shared


## Routes single-target damage through the first eligible guard/intercept: [[unit, fraction, kind-or-null], ...].
func _damage_recipients(target: BattleUnit, _actor: BattleUnit, state: BattleState) -> Array:
	var others: Array[BattleUnit] = []
	for unit: BattleUnit in state.living_units(target.team):
		if unit.entity_id != target.entity_id:
			others.append(unit)
	for guardian: BattleUnit in _sort_units(others):
		for redirect: Dictionary in guardian.redirects:
			if not (redirect.get("protected_ids", []) as Array).has(target.entity_id):
				continue
			if int(redirect.get("duration_turns", 1)) <= 0:
				continue
			var eligible: Variant = redirect.get("eligible_action_types")
			if _truthy(eligible) and not (eligible as Array).has(state.action_type):
				continue
			if redirect.get("kind") == "intercept":
				var maximum: int = int(redirect.get("maximum_intercepts", 999999))
				var used: int = int(redirect.get("intercepts_used", 0))
				if used >= maximum:
					continue
				redirect["intercepts_used"] = used + 1
			var fraction: float = maxf(0.0, minf(1.0, float(redirect.get("fraction", 0.0))))
			var recipients: Array = []
			if fraction < 1.0:
				recipients.append([target, 1.0 - fraction, null])
			if fraction > 0.0:
				recipients.append([guardian, fraction, str(redirect.get("kind", "redirect"))])
			return recipients
	return [[target, 1.0, null]]


func _condition_count(condition: Dictionary, state: BattleState, target: BattleUnit) -> int:
	if condition.get("predicate") == "count_enemies_with_status":
		var count: int = 0
		for unit: BattleUnit in state.living_units(state.opposing_team(state.actor)):
			if unit.has_status(str(condition.get("value"))):
				count += 1
		return count
	return int(evaluate_condition(condition, state, target))


func _objective_damage_multiplier(op: Dictionary, state: BattleState) -> float:
	var value: float = 1.0
	var single: Variant = op.get("multiplier_if_objective_alive")
	if _truthy(single):
		var objective: Dictionary = state.objectives.get((single as Dictionary)["objective_id"], {})
		if int(objective.get("hp", 0)) > 0:
			value *= float((single as Dictionary)["multiplier"])
	var all_alive: Variant = op.get("multiplier_if_all_objectives_alive")
	if _truthy(all_alive) and not state.objectives.is_empty():
		var every: bool = true
		for objective_entry: Dictionary in state.objectives.values():
			if int(objective_entry.get("hp", 0)) <= 0:
				every = false
				break
		if every:
			value *= float((all_alive as Dictionary)["multiplier"])
	return value


func _op_heal(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	if not _chance_succeeds(op):
		return _targets_result("heal", targets, {"chance_failed": true})
	var actor: BattleUnit = state.actor
	var basis: int = actor.effective_stat(str(op.get("scale_stat", "atk")))
	var records: Array[Dictionary] = []
	var successful: Array[BattleUnit] = []
	for target: BattleUnit in targets:
		var missing: int = target.max_hp - target.hp
		var bonus: float = float(actor.stats.get("heal_bonus", 0.0))
		var received: float = 1.0
		if target.has_status("sanctuary"):
			received *= float((target.statuses["sanctuary"] as Dictionary).get(
				"healing_received_multiplier", (status_definitions["sanctuary"] as Dictionary).get("healing_received_multiplier", 1.1)))
		if target.has_status("decay"):
			received *= float((target.statuses["decay"] as Dictionary).get(
				"healing_received_multiplier", (status_definitions["decay"] as Dictionary).get("healing_received_multiplier", 0.5)))
		var amount: int = maxi(0, int(float(basis) * float(op["multiplier"]) * (1.0 + bonus) * received + 0.5))
		var actual: int = mini(missing, amount)
		target.hp = target.hp + actual
		if actual > 0:
			successful.append(target)
		records.append({"target_id": target.entity_id, "healing": actual, "requested": amount})
		if actual > 0 and state.supports_passives():
			state.dispatch_battle_event("after_ally_healed", {
				"actor": actor, "source": actor, "target": target, "team": target.team, "healing": actual,
				"action_type": state.action_type, "source_action_type": state.action_type,
			}, self)
	state.previous_successful_heal_targets = successful
	var result: OperationResult = _targets_result("heal", targets)
	result.healing = records
	return result


func _op_heal_per_removed_status(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var removed_total: int = 0
	for value: Array in state.last_removed_statuses.values():
		removed_total += value.size()
	if bool(op.get("requires_successful_cleanse", false)) and removed_total <= 0:
		return _targets_result("heal_per_removed_status", targets, {"cleansed": 0})
	var actor: BattleUnit = state.actor
	var limited: Array[BattleUnit] = targets.slice(0, int(op.get("maximum_targets", targets.size())))
	var stack_budget: int = mini(removed_total, int(op.get("maximum_total_stacks", removed_total)))
	var basis: int = actor.effective_stat(str(op.get("scale_stat", "atk")))
	var records: Array[Dictionary] = []
	for target: BattleUnit in limited:
		# The cap is shared by selected targets, and each target benefits only from statuses removed from it.
		var stacks: int = mini((state.last_removed_statuses.get(target.entity_id, []) as Array).size(), stack_budget)
		stack_budget -= stacks
		var amount: int = maxi(0, int(float(basis) * float(op["multiplier"]) * float(stacks) + 0.5))
		var actual: int = mini(target.max_hp - target.hp, amount)
		target.hp = target.hp + actual
		records.append({"target_id": target.entity_id, "healing": actual, "cleanse_stacks": stacks})
	var healed: Array[BattleUnit] = []
	for unit: BattleUnit in limited:
		for record: Dictionary in records:
			if record["target_id"] == unit.entity_id and int(record["healing"]) > 0:
				healed.append(unit)
				break
	state.previous_successful_heal_targets = healed
	var result: OperationResult = _targets_result("heal_per_removed_status", limited, {"removed_status_count": removed_total})
	result.healing = records
	return result


func _op_grant_shield(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var actor: BattleUnit = state.actor
	var amount: int = maxi(0, int(float(actor.effective_stat(str(op["scale_stat"]))) * float(op["multiplier"]) + 0.5))
	var records: Array[Dictionary] = []
	for target: BattleUnit in targets:
		var cap: int = (target.max_hp if target.max_hp != 0 else 1) * 2
		var current: int = target.shield_total()
		var granted: int = mini(amount, maxi(0, cap - current))
		if granted != 0:
			target.shields.append({
				"amount": granted, "duration_turns": int(op["duration_turns"]),
				"source_id": op.get("shield_source_id", actor.entity_id), "applied_order": state.log.size(),
			})
		records.append({"target_id": target.entity_id, "shield": granted})
	return _targets_result("grant_shield", targets, {"shields": records})


func _op_apply_status(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var records: Array[Dictionary] = []
	var status_id: String = String(op["status_id"])
	var definition: Dictionary = status_definitions[status_id]
	var boss_control_immunities: Array = (rules.get("targeting", {}) as Dictionary).get("boss_control_immunities_default", [])
	for target: BattleUnit in targets:
		if not _chance_succeeds(op):
			continue
		if target.status_immunities.has(status_id):
			continue
		var immune: bool = false
		for immunity: Dictionary in target.stats.get("status_immunities_runtime", []):
			if (immunity.get("status_id") == status_id or immunity.get("status_id") == "all") and int(immunity.get("duration_turns", 0)) > 0:
				immune = true
				break
		if immune:
			continue
		for active_id: String in target.statuses:
			if ((status_definitions.get(active_id, {}) as Dictionary).get("immune_status_ids", []) as Array).has(status_id):
				immune = true
				break
		if immune:
			continue
		var definition_tags: Array = definition.get("tags", [])
		# Boss control immunities from the battle rules.
		if target.is_boss and definition_tags.has("control") and boss_control_immunities.has(status_id):
			continue
		var duration: int = int(op["duration_turns"])
		if target.is_boss and definition_tags.has("control"):
			var scaled: int = _boss_control_duration(state, target, duration)
			if scaled < 0:
				continue
			duration = scaled
		var status: Dictionary = (target.statuses.get(status_id, {}) as Dictionary).duplicate()
		status["duration_turns"] = duration
		status["source_id"] = state.actor.entity_id if state.actor != null else null
		status["tags"] = definition_tags.duplicate()
		status["applied_order"] = state.log.size()
		for field_name: String in ["shared_damage_fraction", "consume_on_single_target_action"]:
			if op.has(field_name):
				status[field_name] = op[field_name]
		# Part I status payloads are read from the rules pack.
		if status_id == "burn" or status_id == "venom":
			var source: BattleUnit = null
			for unit: BattleUnit in state.units:
				if unit.entity_id == status["source_id"]:
					source = unit
					break
			var default_multiplier: float = 0.12 if status_id == "burn" else 0.1
			var source_atk: int = source.effective_stat("atk") if source != null else 1
			status["tick_damage"] = maxi(1, int(float(source_atk) * float(definition.get("source_atk_multiplier_per_tick", default_multiplier))))
			status["ticks_at_owner_turn_start"] = true
		target.statuses[status_id] = status
		if status_id == "gust":
			var delay_fraction: float = float(definition.get("next_action_gauge_delay_fraction", 0.15))
			ActionGauge.delay_next_action(target, Frac.from_number(delay_fraction), gauge_rules)
		records.append({"target_id": target.entity_id, "status_id": status_id, "duration_turns": duration})
	var result: OperationResult = _targets_result("apply_status", targets)
	result.statuses_applied = records
	return result


## Scaled control duration for a boss, or -1 when it is fully immune (the reference returns None).
func _boss_control_duration(state: BattleState, target: BattleUnit, duration: int) -> int:
	var record: Variant = state.record_of(target.entity_id)
	var extra: Dictionary = {}
	if record != null and record.get("extra") is Dictionary:
		extra = record.get("extra")
	var control: Dictionary = extra.get("control_rules", {})
	if bool(control.get("blanket_control_immunity", false)):
		return -1
	var multiplier: Variant = control.get("control_duration_multiplier", (rules.get("targeting", {}) as Dictionary).get("boss_control_duration_multiplier"))
	var rounding: Variant = control.get("control_duration_rounding", "minimum_one_turn")
	if multiplier is bool or not (multiplier is int or multiplier is float) or float(multiplier) < 0.0:
		_fail("Invalid boss control duration multiplier: %s" % ContentLoader.py_repr(multiplier))
		return -1
	if rounding != "minimum_one_turn":
		_fail("Unsupported control_duration_rounding: %s" % ContentLoader.py_repr(rounding))
		return -1
	if duration <= 0:
		return 0
	# The authored text is "minimum one turn when base duration is positive"; the engine keeps its historical ceiling
	# (confirmed by the project owner on 2026-09-28: 3 turns -> 2, the player-favourable reading).
	return maxi(1, Frac.from_number(multiplier).mul_int(duration).ceil_int())


## Scales strength multipliers by the actor's rank in `skill_id` (rank 1 or no rank returns the operations unchanged).
func _apply_skill_rank(operations: Array[Dictionary], actor: BattleUnit, skill_id: String) -> Array[Dictionary]:
	var rank: int = int(actor.skill_ranks.get(skill_id, 1)) if not skill_id.is_empty() else 1
	if rank <= 1:
		return operations
	var factor: float = progression.skill_rank_multiplier(rank)
	var scaled: Array[Dictionary] = []
	for op: Dictionary in operations:
		if _RANK_SCALED_OPS.has(String(op.get("op", ""))) and op.has("multiplier"):
			var copy: Dictionary = op.duplicate()
			copy["multiplier"] = float(op["multiplier"]) * factor
			scaled.append(copy)
		else:
			scaled.append(op)
	return scaled


func _op_remove_status(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var removed_by_target: Dictionary = {}
	var category: String = String(op["category"])
	for target: BattleUnit in targets:
		var choices: Array = []
		for status_id: String in target.statuses:
			if _status_tags(target, status_id).has(category) and (not op.has("status_id") or status_id == op["status_id"]):
				choices.append(status_id)
		if op["selection"] == "oldest_applied":
			choices = BattleUtil.sorted_by(choices, func(sid: String) -> Array: return [int((target.statuses[sid] as Dictionary).get("applied_order", 0))])
		elif op["selection"] == "random_applied_buff":
			choices = _sort_statuses(choices, target)
			rng.shuffle(choices)
		else:
			_fail("Unsupported remove_status selection %s" % ContentLoader.py_repr(op["selection"]))
			return _targets_result("remove_status", targets)
		var removed: Array[Dictionary] = []
		for status_id: String in choices.slice(0, maxi(0, int(op["count"]))):
			var payload: Dictionary = {"status_id": status_id}
			payload.merge(target.statuses[status_id], true)
			target.statuses.erase(status_id)
			removed.append(payload)
		removed_by_target[target.entity_id] = removed
	state.last_removed_statuses = removed_by_target
	var summary: Dictionary = {}
	for key: String in removed_by_target:
		var ids: Array = []
		for status: Dictionary in removed_by_target[key]:
			ids.append(status["status_id"])
		summary[key] = ids
	return _targets_result("remove_status", targets, {"removed": summary})


static func _sort_statuses(status_ids: Array, unit: BattleUnit) -> Array:
	return BattleUtil.sorted_by(status_ids, func(sid: String) -> Array: return [int((unit.statuses[sid] as Dictionary).get("applied_order", 0))])


func _op_reduce_status_durations(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var changed: Array[Dictionary] = []
	for target: BattleUnit in targets:
		for status_id: String in target.statuses.keys():
			if _status_tags(target, status_id).has(String(op["category"])):
				var status: Dictionary = target.statuses[status_id]
				status["duration_turns"] = maxi(int(op["minimum_remaining_turns"]), int(status.get("duration_turns", 0)) - int(op["amount_turns"]))
				if int(status["duration_turns"]) == 0:
					target.statuses.erase(status_id)
				changed.append({"target_id": target.entity_id, "status_id": status_id, "duration_turns": status.get("duration_turns", 0)})
	return _targets_result("reduce_status_durations", targets, {"changed": changed})


func _op_modify_stat(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var modes: Dictionary = {"add_pct": "percent", "percent": "percent", "flat": "flat", "add_flat": "flat"}
	if not modes.has(op["mode"]):
		_fail("Unsupported stat modifier mode %s" % ContentLoader.py_repr(op["mode"]))
		return _targets_result("modify_stat", targets)
	for target: BattleUnit in targets:
		target.stat_modifiers.append({
			"stat_id": op["stat_id"], "mode": modes[op["mode"]], "amount": float(op["amount"]),
			"duration_turns": int(op["duration_turns"]),
			"source_id": state.actor.entity_id if state.actor != null else null,
		})
	return _targets_result("modify_stat", targets, {"stat_id": op["stat_id"], "mode": op["mode"]})


func _op_damage_modifier(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var kind: String = "incoming" if op["op"] == "modify_incoming_damage" else "outgoing"
	for target: BattleUnit in targets:
		target.damage_modifiers.append({
			"kind": kind, "multiplier": float(op["multiplier"]), "duration_turns": int(op.get("duration_turns", 1)),
			"source_id": state.actor.entity_id if state.actor != null else null,
		})
	return _targets_result(String(op["op"]), targets, {"kind": kind})


func _op_grant_damage_reduction(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	for target: BattleUnit in targets:
		target.damage_modifiers.append({
			"kind": "incoming", "multiplier": float(op["damage_taken_multiplier"]), "duration_turns": int(op["duration_turns"]),
			"source_id": state.actor.entity_id if state.actor != null else null,
		})
	return _targets_result("grant_damage_reduction", targets)


func _op_grant_redirect(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var protected: Array[BattleUnit] = resolve_selector(String(op["protected_ally_selector_id"]), state, op)
	protected = _exclude_guardians_from_protected(protected, targets, op, state)
	for guardian: BattleUnit in targets:
		guardian.redirects.append({
			"protected_ids": BattleUtil.names_of(protected), "fraction": float(op["redirected_fraction"]),
			"duration_turns": int(op["duration_turns"]),
			"eligible_action_types": (op["eligible_action_types"] as Array).duplicate(), "kind": "redirect",
		})
	return _targets_result("grant_redirect", targets, {"protected_ids": BattleUtil.names_of(protected)})


func _op_grant_intercept(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var protected: Array[BattleUnit] = resolve_selector(String(op["protected_ally_selector_id"]), state, op)
	protected = _exclude_guardians_from_protected(protected, targets, op, state)
	for guardian: BattleUnit in targets:
		guardian.redirects.append({
			"protected_ids": BattleUtil.names_of(protected), "fraction": float(op["redirected_fraction"]),
			"duration_turns": int(op["duration_turns"]),
			"maximum_intercepts": int(op.get("maximum_intercepts", 999999)), "kind": "intercept",
		})
	return _targets_result("grant_intercept", targets, {"protected_ids": BattleUtil.names_of(protected)})


func _exclude_guardians_from_protected(protected: Array[BattleUnit], guardians: Array[BattleUnit], op: Dictionary, state: BattleState) -> Array[BattleUnit]:
	var guardian_ids: Dictionary = {}
	for unit: BattleUnit in guardians:
		guardian_ids[unit.entity_id] = true
	var valid: Array[BattleUnit] = []
	for unit: BattleUnit in protected:
		if not guardian_ids.has(unit.entity_id):
			valid.append(unit)
	if not valid.is_empty():
		return valid
	var rule: Dictionary = selector_rules[op["protected_ally_selector_id"]]
	var candidates: Array[BattleUnit] = []
	for unit: BattleUnit in _side_units(rule.get("side"), state):
		if not guardian_ids.has(unit.entity_id):
			candidates.append(unit)
	var ordered: Array[BattleUnit] = []
	if _truthy(rule.get("stat")):
		var stat_name: Variant = rule["stat"]
		ordered = _ranked(candidates, func(unit: BattleUnit) -> float: return _stat_value(unit, stat_name), false, rule.get("tie_break", []))
	else:
		ordered = _sort_units(candidates)
	return ordered.slice(0, 1)


func _op_first_hit_guard(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	for target: BattleUnit in targets:
		target.damage_modifiers.append({
			"kind": "incoming", "multiplier": float(op["damage_taken_multiplier"]), "duration_turns": int(op["duration_turns"]),
			"hits_remaining": int(op["hits_per_target"]), "guard": "first_hit",
		})
	return _targets_result("grant_first_hit_guard", targets)


func _op_opening_guard(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	for target: BattleUnit in targets:
		target.damage_modifiers.append({
			"kind": "incoming", "multiplier": float(op["damage_taken_multiplier"]), "duration_rounds": int(op["duration_rounds"]),
			"target_override": op["target_override"], "guard": "opening",
		})
	return _targets_result("grant_opening_guard", targets)


func _op_gain_focus(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	for target: BattleUnit in targets:
		var amount: int = int(op["amount"])
		if target.has_status("dread"):
			amount = int(float(amount) * float((target.statuses["dread"] as Dictionary).get(
				"focus_gain_multiplier", (status_definitions["dread"] as Dictionary).get("focus_gain_multiplier", 0.8))))
		target.focus = maxi(0, mini(state.focus_rules.maximum, target.focus + amount))
	return _targets_result("gain_focus", targets, {"amount": int(op["amount"])})


func _op_delay_next_action(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var updated: Dictionary = {}
	for target: BattleUnit in targets:
		updated[target.entity_id] = ActionGauge.delay_next_action(target, Frac.from_number(op["gauge_fraction"]), gauge_rules).to_text()
	return _targets_result("delay_next_action", targets, {"pending_delay_gauge": updated})


func _op_reduce_cooldowns(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var changes: Array[Dictionary] = []
	for target: BattleUnit in targets:
		for skill_id: String in target.cooldowns.keys():
			target.cooldowns[skill_id] = maxi(int(op["minimum_remaining_turns"]), int(target.cooldowns[skill_id]) - int(op["amount_turns"]))
			changes.append({"target_id": target.entity_id, "skill_id": skill_id, "cooldown": target.cooldowns[skill_id]})
	return _targets_result("reduce_cooldowns", targets, {"changed": changes})


func _op_regeneration(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var actor: BattleUnit = state.actor
	var amount: int = maxi(0, int(float(actor.effective_stat(str(op["scale_stat"]))) * float(op["multiplier"]) + 0.5))
	for target: BattleUnit in targets:
		target.statuses["regeneration"] = {
			"duration_turns": int(op["duration_turns"]), "ticks_remaining": int(op["ticks"]),
			"tick_event": op["tick_event"], "tick_healing": amount, "source_id": actor.entity_id,
			"tags": ["buff", "regeneration"], "applied_order": state.log.size(),
		}
	return _targets_result("apply_regeneration", targets, {"tick_healing": amount})


func _op_arm_counter(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	for target: BattleUnit in targets:
		target.counters.append({
			"event": op["event"], "scale_stat": op["scale_stat"], "multiplier": float(op["multiplier"]),
			"damage_type": op["damage_type"], "consume_on_trigger": bool(op["consume_on_trigger"]),
			"source_id": state.actor.entity_id if state.actor != null else null,
			"source_turn_at_arm": state.owner_turn_count(state.actor.entity_id) if state.actor != null else 0,
		})
	return _targets_result("arm_counter", targets)


func _op_next_attack_bonus(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	for target: BattleUnit in targets:
		target.next_attack_bonuses.append({"damage_multiplier": float(op["damage_multiplier"]), "consume_on_attack": bool(op["consume_on_attack"])})
	return _targets_result("arm_next_attack_bonus", targets)


func _op_status_immunity(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	for target: BattleUnit in targets:
		if not target.stats.has("status_immunities_runtime"):
			target.stats["status_immunities_runtime"] = []
		(target.stats["status_immunities_runtime"] as Array).append({"status_id": op["status_id"], "duration_turns": int(op["duration_turns"])})
	return _targets_result("grant_status_immunity", targets)


func _op_remove_shield(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var removed: Array[Dictionary] = []
	for target: BattleUnit in targets:
		var fraction: float = float(op.get("amount_fraction", 1.0))
		var layers: Array[Dictionary] = []
		for layer: Dictionary in target.shields:
			if not op.has("shield_source_id") or layer.get("source_id") == op["shield_source_id"]:
				layers.append(layer)
		var source_total: int = 0
		for layer: Dictionary in layers:
			source_total += maxi(0, int(layer.get("amount", 0)))
		var total: int = int(float(source_total) * maxf(0.0, minf(1.0, fraction)))
		var remaining: int = total
		for layer: Dictionary in layers:
			var take: int = mini(int(layer.get("amount", 0)), remaining)
			layer["amount"] = int(layer.get("amount", 0)) - take
			remaining -= take
			if remaining <= 0:
				break
		var kept: Array[Dictionary] = []
		for layer: Dictionary in target.shields:
			if int(layer.get("amount", 0)) > 0:
				kept.append(layer)
		target.shields = kept
		removed.append({"target_id": target.entity_id, "shield_removed": total - remaining})
	return _targets_result("remove_shield", targets, {"removed": removed})


func _op_copy_buff(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var sources: Array[BattleUnit] = resolve_selector(String(op["source_selector_id"]), state, op)
	var source: BattleUnit = sources[0] if not sources.is_empty() else null
	var copied: Dictionary = {}
	for target: BattleUnit in targets:
		var count: int = 0
		if source != null:
			if op["category"] == "shield":
				var shield_budget: int = maxi(0, (target.max_hp if target.max_hp != 0 else 1) * 2 - target.shield_total())
				for layer: Dictionary in source.shields.slice(0, int(op["maximum_count"])):
					var copied_layer: int = mini(maxi(0, int(layer.get("amount", 0))), shield_budget)
					if copied_layer <= 0:
						continue
					var clone: Dictionary = layer.duplicate()
					clone["amount"] = copied_layer
					clone["duration_turns"] = int(op["duration_turns"])
					clone["copied"] = true
					target.shields.append(clone)
					shield_budget -= copied_layer
					count += 1
			else:
				var buffs: Array = []
				for status_id: String in source.statuses:
					if _status_tags(source, status_id).has(String(op["category"])):
						buffs.append(status_id)
				buffs = _sort_statuses(buffs, source).slice(0, int(op["maximum_count"]))
				for status_id: String in buffs:
					var status_clone: Dictionary = (source.statuses[status_id] as Dictionary).duplicate()
					status_clone["duration_turns"] = int(op["duration_turns"])
					status_clone["copied"] = true
					target.statuses[status_id] = status_clone
					count += 1
		copied[target.entity_id] = count
	return _targets_result("copy_buff", targets, {"copied": copied, "source_id": source.entity_id if source != null else null})


func _op_block_attack(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	for target: BattleUnit in targets:
		target.blocked_attack_hits = target.blocked_attack_hits + int(op["maximum_hits"])
	return _targets_result("block_attack", targets, {"maximum_hits": int(op["maximum_hits"])})


func _op_pay_hp_cost(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var records: Array[Dictionary] = []
	for target: BattleUnit in targets:
		var amount: int = maxi(0, int(float(target.max_hp if target.max_hp != 0 else 1) * float(op["max_hp_fraction"])))
		target.hp = maxi(int(op["cannot_reduce_below"]), target.hp - amount)
		target.alive = target.hp > 0
		records.append({"target_id": target.entity_id, "hp_cost": amount, "hp": target.hp})
	return _targets_result("pay_hp_cost", targets, {"results": records})


func _op_boss_damage_modifier(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var record: Dictionary = {
		"multiplier": float(op["multiplier"]),
		"modifier_id": op.get("modifier_id", "boss_modifier_%d" % state.boss_modifiers.size()),
		"until_objective_destroyed": op.get("until_objective_destroyed"),
		"while_any_objective_alive": op.get("while_any_objective_alive"),
	}
	state.boss_modifiers.append(record)
	for target: BattleUnit in targets:
		target.damage_modifiers.append({"kind": "incoming", "multiplier": record["multiplier"], "modifier_id": record["modifier_id"], "boss_modifier": true})
	return _targets_result("boss_damage_taken_modifier", targets, {"modifier": record})


func _op_summon(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var objective_id: Variant = op.get("only_if_objective_alive")
	if objective_id != null and _truthy(objective_id):
		var objective: Dictionary = state.objectives.get(objective_id, {})
		if int(objective.get("hp", 0)) <= 0:
			return _targets_result("summon_enemies", targets, {"summoned": 0})
	var record: Dictionary = {
		"enemy_id": op["enemy_id"], "count": int(op["count"]),
		"team": state.actor.team if state.actor != null else "enemy", "join_cycle": "next",
	}
	state.pending_summons.append(record)
	for unit: BattleUnit in state.spawn_summons(String(record["enemy_id"]), int(record["count"])):
		state.units.append(unit)
	return _targets_result("summon_enemies", targets, {"summoned": record["count"], "enemy_id": record["enemy_id"]})


func _op_cancel_telegraph(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var cancelled: bool = false
	if state.pending_telegraph != null and (state.pending_telegraph as Dictionary).get("action_id") == op["action_id"]:
		(state.pending_telegraph as Dictionary)["cancelled"] = true
		cancelled = true
	return _targets_result("cancel_boss_telegraph", targets, {"cancelled": cancelled})


func _op_remove_boss_modifier(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var modifier_id: Variant = op["modifier_id"]
	var kept_modifiers: Array[Dictionary] = []
	for modifier: Dictionary in state.boss_modifiers:
		if modifier.get("modifier_id") != modifier_id:
			kept_modifiers.append(modifier)
	state.boss_modifiers = kept_modifiers
	for unit: BattleUnit in state.units:
		var kept: Array[Dictionary] = []
		for modifier: Dictionary in unit.damage_modifiers:
			if modifier.get("modifier_id") != modifier_id:
				kept.append(modifier)
		unit.damage_modifiers = kept
	return _targets_result("remove_boss_modifier", targets, {"modifier_id": modifier_id})


func _op_remove_copied_statuses(op: Dictionary, _state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var removed: Dictionary = {}
	for target: BattleUnit in targets:
		removed[target.entity_id] = []
		for status_id: String in target.statuses.keys():
			var status: Dictionary = target.statuses[status_id]
			if _truthy(status.get("copied")) and _status_tags(target, status_id).has(String(op["category"])):
				target.statuses.erase(status_id)
				(removed[target.entity_id] as Array).append(status_id)
	return _targets_result("remove_copied_statuses", targets, {"removed": removed})


func _op_clear_status_if_objectives_destroyed(op: Dictionary, state: BattleState, targets: Array[BattleUnit]) -> OperationResult:
	var all_destroyed: bool = true
	for objective_id: Variant in op["objective_ids"]:
		if int((state.objectives.get(objective_id, {}) as Dictionary).get("hp", 0)) > 0:
			all_destroyed = false
			break
	if all_destroyed:
		for target: BattleUnit in targets:
			target.statuses.erase(op["status_id"])
	return _targets_result("clear_status_if_all_objectives_destroyed", targets, {"cleared": all_destroyed})
