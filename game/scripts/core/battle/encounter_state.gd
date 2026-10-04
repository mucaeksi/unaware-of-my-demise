class_name EncounterState
extends BattleState
## Battle-local state that resolves passive hooks, waves and boss mechanics (port of core/battle/encounter_state.py).
## It reaches its owning BattleService through `service` (duck-typed in the reference; typed here).

var service: BattleService = null
var stage: ContentModels.Stage = null
var records: Dictionary = {}  # entity id -> Character | Enemy
var wave_index: int = -1
var next_wave_index: int = 0
var phase_index: int = 0
var current_phase: ContentModels.BossPhase = null
var phase_transition_pending: bool = false
var owner_turn_counts: Dictionary = {}  # entity id -> int
var hook_counts: Dictionary = {}  # String key -> int
var suppressed_passive_owners: Dictionary = {}  # set
var action_serial: int = 0
var damage_action_serial: int = 0
var hook_event_serial: int = 0
var summon_serial: int = 0
var telegraph_player_opportunities: int = 0


static func create(new_units: Array[BattleUnit], owning_service: BattleService, encounter_stage: ContentModels.Stage, unit_records: Dictionary) -> EncounterState:
	var state: EncounterState = EncounterState.new()
	state.units = new_units
	state.gauge_rules = owning_service.interpreter.gauge_rules
	state.focus_rules = owning_service.interpreter.focus_rules
	state.service = owning_service
	state.stage = encounter_stage
	state.records = unit_records.duplicate()
	return state


func interpreter() -> EffectInterpreter:
	return service.interpreter


func service_interpreter() -> EffectInterpreter:
	return service.interpreter


func supports_passives() -> bool:
	return true


func record_of(entity_id: String) -> Variant:
	return records.get(entity_id)


func owner_turn_count(entity_id: String) -> int:
	return int(owner_turn_counts.get(entity_id, 0))


func spawn_summons(enemy_id: String, count: int) -> Array[BattleUnit]:
	return service.summon_factory(enemy_id, count, self)


func next_damage_action_id() -> int:
	damage_action_serial += 1
	return damage_action_serial


func is_battle_over() -> bool:
	if living_units("player").is_empty():
		return true
	if next_wave_index < stage.enemy_waves.size():
		return false
	return living_units("enemy").is_empty()


func start_turn(turn_actor: BattleUnit) -> void:
	turn_actor.hit_focus_gained_this_turn = 0
	action_serial += 1
	owner_turn_counts[turn_actor.entity_id] = int(owner_turn_counts.get(turn_actor.entity_id, 0)) + 1
	var owner_turn: int = int(owner_turn_counts[turn_actor.entity_id])
	for unit: BattleUnit in units:
		var kept: Array[Dictionary] = []
		for counter: Dictionary in unit.counters:
			if not (counter.get("source_id") == turn_actor.entity_id and owner_turn > int(counter.get("source_turn_at_arm", 0))):
				kept.append(counter)
		unit.counters = kept
	super.start_turn(turn_actor)
	refresh_stat_auras()
	if turn_actor.alive:
		dispatch_battle_event("owner_turn_start", {
			"actor": turn_actor, "source": turn_actor, "target": turn_actor,
			"action_type": "owner_turn_start", "source_action_type": "owner_turn_start",
		}, service.interpreter)


func end_cycle() -> void:
	dispatch_battle_event("after_round_end", {
		"actor": actor, "source": actor, "target": actor,
		"action_type": "after_round_end", "source_action_type": "after_round_end",
	}, service.interpreter)
	super.end_cycle()


func resolve_action(turn_actor: BattleUnit, chosen: Variant, _random: CpythonRandom) -> void:
	var action: AutoBattleProvider.BattleAction = chosen
	if action.skill_id == "__hold_telegraph__":
		record_event({
			"type": "boss_telegraph_held", "boss_id": turn_actor.entity_id,
			"action_id": (pending_telegraph as Dictionary).get("action_id") if pending_telegraph != null else null,
			"round": round_number,
		})
		return
	var record: Variant = records.get(turn_actor.entity_id)
	var skill: ContentModels.Skill = null
	if record != null:
		for entry: ContentModels.Skill in record.skills:
			if entry.skill_id == action.skill_id:
				skill = entry
				break
	if skill == null or skill.type == "passive":
		report_fault("Invalid battle action %s for %s" % [ContentLoader.py_repr(action.skill_id), ContentLoader.py_repr(turn_actor.entity_id)])
		return
	if int(turn_actor.cooldowns.get(skill.skill_id, 0)) > 0:
		report_fault("Skill %s is still on cooldown" % ContentLoader.py_repr(skill.skill_id))
		return
	if turn_actor.team == "player" and turn_actor.focus < skill.focus_cost:
		report_fault("Skill %s requires %d Focus" % [ContentLoader.py_repr(skill.skill_id), skill.focus_cost])
		return
	turn_actor.focus = maxi(0, turn_actor.focus - skill.focus_cost)
	record_event({"type": "action_started", "actor_id": turn_actor.entity_id, "skill_id": skill.skill_id, "action_type": skill.type, "round": round_number})
	service.interpreter.execute_skill(skill, self, turn_actor, skill.type, action.targets)
	if skill.cooldown_turns != 0:
		turn_actor.cooldowns[skill.skill_id] = skill.cooldown_turns
	if turn_actor.team == "player":
		turn_actor.focus = mini(focus_rules.maximum, turn_actor.focus + focus_rules.action_gain(skill.type))
		var hook_event: Dictionary = {
			"actor": turn_actor, "source": turn_actor, "target": turn_actor,
			"action_type": skill.type, "source_action_type": skill.type, "skill_id": skill.skill_id,
		}
		dispatch_battle_event("after_ally_action", hook_event, service.interpreter)
		if skill.type == "ultimate":
			dispatch_battle_event("after_ally_ultimate", hook_event, service.interpreter)
	record_event({"type": "action_completed", "actor_id": turn_actor.entity_id, "skill_id": skill.skill_id, "action_type": skill.type, "round": round_number})
	advance_wave_if_cleared()


## The (skill id, hook) pairs a record contributes.
static func _hooks_for(record: Variant) -> Array:
	var result: Array = []
	if record is ContentModels.Character:
		for skill: ContentModels.Skill in (record as ContentModels.Character).skills:
			for hook: ContentModels.EffectHook in skill.event_hooks:
				result.append([skill.skill_id, hook])
	elif record is ContentModels.Enemy:
		var enemy: ContentModels.Enemy = record
		for index: int in range(enemy.passive_hooks.size()):
			result.append(["%s_passive_%d" % [enemy.enemy_id, index], enemy.passive_hooks[index]])
	return result


static func _entity_id_of(unit: Variant) -> Variant:
	return (unit as BattleUnit).entity_id if unit is BattleUnit else null


static func _team_of(unit: Variant) -> Variant:
	return (unit as BattleUnit).team if unit is BattleUnit else null


static func _hook_owner_matches(event_name: String, owner_unit: BattleUnit, event_payload: Dictionary, hook: ContentModels.EffectHook) -> bool:
	var event_actor: Variant = event_payload.get("actor")
	var source: Variant = event_payload.get("source")
	var target: Variant = event_payload.get("target")
	if not _truthy(source):
		source = event_actor
	var target_id: Variant = _entity_id_of(target)
	var source_id: Variant = _entity_id_of(source)
	match event_name:
		"owner_turn_start":
			return owner_unit.entity_id == _entity_id_of(event_actor)
		"before_damage_dealt", "after_damage_dealt":
			return owner_unit.entity_id == source_id
		"before_damage_received", "after_damage_received":
			var references_team: bool = false
			for op: ContentModels.EffectOp in hook.effect_ops:
				if op.target_selector_id == "event_target":
					references_team = true
			return owner_unit.entity_id == target_id or (references_team and owner_unit.team == _team_of(target))
		"ally_damaged":
			return owner_unit.team == _team_of(target) and owner_unit.entity_id != target_id
		"after_enemy_defeated":
			return owner_unit.team == _team_of(source)
		"ally_hp_threshold_crossed", "after_ally_healed":
			return owner_unit.team == _team_of(target)
		"after_ally_action", "after_ally_ultimate":
			return owner_unit.team == _team_of(event_actor)
		"after_round_end":
			return owner_unit.team == "player"
	return owner_unit.entity_id == source_id


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


## `EffectContractError` is raised by the reference for an unsupported filter field; the port reports it via `fault`.
func _event_filter_matches(filters: Dictionary, owner_unit: BattleUnit, event_payload: Dictionary) -> bool:
	var event_actor: Variant = event_payload.get("actor")
	var source: Variant = event_payload.get("source")
	if not _truthy(source):
		source = event_actor
	var target: Variant = event_payload.get("target")
	var action_type_value: String = str(event_payload.get("source_action_type", event_payload.get("action_type", "")))
	for key: String in filters:
		var value: Variant = filters[key]
		if key == "incoming_action_type" or key == "ally_action_type":
			if action_type_value != value:
				return false
		elif key == "owner_action_type" or key == "damage_action_type":
			if value == "any_attack":
				if not EffectInterpreter._ATTACK_ACTION_TYPES.has(action_type_value):
					return false
			elif value == "basic_or_skill":
				if not EffectInterpreter._ATTACK_ACTION_TYPES.has(action_type_value):
					return false
			elif action_type_value != value:
				return false
		elif key == "team":
			if _team_of(target) != value:
				return false
		elif key == "event_target_faction_is":
			var faction: Variant = null
			if target is BattleUnit:
				faction = (target as BattleUnit).faction_id if not (target as BattleUnit).faction_id.is_empty() else (target as BattleUnit).team
			if faction != value:
				return false
		elif key == "source_is_owner":
			if (_entity_id_of(source) == owner_unit.entity_id) != bool(value):
				return false
		elif key == "exclude_owner":
			if (_entity_id_of(event_actor) == owner_unit.entity_id) == bool(value):
				return false
		else:
			report_fault("Unsupported event_filter field %s" % ContentLoader.py_repr(key))
			return false
	return true


func _hook_limit_key(owner_unit: BattleUnit, skill_id: String, hook: ContentModels.EffectHook, limit: Dictionary, event_payload: Dictionary) -> String:
	var scope: String = "per_event"
	for candidate: String in ["per_battle", "per_round", "per_owner_turn", "per_target_per_battle", "per_damage_action", "per_event"]:
		if _truthy(limit.get(candidate)):
			scope = candidate
			break
	var value: Variant
	match scope:
		"per_round":
			value = round_number
		"per_owner_turn":
			value = int(owner_turn_counts.get(owner_unit.entity_id, 0))
		"per_target_per_battle":
			var target: Variant = event_payload.get("target")
			value = (target as BattleUnit).entity_id if target is BattleUnit else ""
		"per_damage_action":
			value = event_payload.get("damage_action_id", action_serial)
		"per_event":
			value = event_payload.get("event_id", hook_event_serial)
		_:
			value = "battle"
	return "%s|%s|%s|%s|%s" % [owner_unit.entity_id, skill_id, hook.event, scope, str(value)]


func dispatch_battle_event(event_name: String, event_payload: Dictionary, interpreter_ref: EffectInterpreter) -> void:
	hook_event_serial += 1
	var payload: Dictionary = event_payload.duplicate()
	payload["name"] = event_name
	payload["event_name"] = event_name
	payload["event_id"] = hook_event_serial
	payload["round_number"] = round_number
	var previous_event: Dictionary = event
	event = payload
	var owners: Array = BattleUtil.sorted_by(living_units(), func(unit: BattleUnit) -> Array:
		return [0 if unit.team == "player" else 1, unit.slot_index, unit.entity_id])
	for owner_unit: BattleUnit in owners:
		if suppressed_passive_owners.has(owner_unit.entity_id):
			continue
		for pair: Array in _hooks_for(records.get(owner_unit.entity_id)):
			var skill_id: String = pair[0]
			var hook: ContentModels.EffectHook = pair[1]
			if hook.event != event_name or not _hook_owner_matches(event_name, owner_unit, payload, hook):
				continue
			var filters: Dictionary = hook.extra.get("event_filter", {})
			if not _event_filter_matches(filters, owner_unit, payload):
				continue
			var target: Variant = payload.get("target")
			if event_name == "ally_hp_threshold_crossed":
				var before: float = float(payload.get("target_hp_before_pct", 0))
				var after: float = float(payload.get("target_hp_after_pct", 0))
				if not _condition_threshold_crossed(hook.extra.get("condition"), before, after):
					continue
			var condition: Variant = hook.extra.get("condition")
			var previous_condition_actor: BattleUnit = actor
			actor = owner_unit
			var condition_holds: bool = true
			if _truthy(condition):
				condition_holds = interpreter_ref.evaluate_condition(condition, self, target if target is BattleUnit else owner_unit)
			actor = previous_condition_actor
			if not condition_holds:
				continue
			var limit: Dictionary = hook.extra.get("limit", {})
			if _truthy(limit.get("one_pending_bonus")) and not owner_unit.next_attack_bonuses.is_empty():
				continue
			var key: String = _hook_limit_key(owner_unit, skill_id, hook, limit, payload)
			if int(hook_counts.get(key, 0)) != 0:
				continue
			var chance: float = float(limit.get("chance", 1.0))
			if chance < 1.0 and (rng == null or rng.random() >= chance):
				hook_counts[key] = 1
				continue
			if hook.effect_ops.is_empty():
				continue
			var saved_actor: BattleUnit = actor
			var saved_action_type: String = action_type
			var saved_event: Dictionary = event.duplicate()
			var saved_previous_targets: Array[BattleUnit] = previous_operation_targets.duplicate()
			var saved_last_target: BattleUnit = last_target
			var saved_last_primary: BattleUnit = last_primary_target
			var saved_last_damage: int = last_damage
			var saved_last_max_hp: int = last_damage_target_max_hp
			var saved_last_defeated: bool = last_damage_target_defeated
			var saved_primary_defeated: bool = last_primary_target_defeated
			suppressed_passive_owners[owner_unit.entity_id] = true
			var ops: Array = []
			for op: ContentModels.EffectOp in hook.effect_ops:
				ops.append(op)
			interpreter_ref.execute_effect_ops(ops, self, owner_unit, "passive", null, payload, skill_id)
			hook_counts[key] = 1
			record_event({"type": "passive_triggered", "owner_id": owner_unit.entity_id, "skill_id": skill_id, "event": event_name, "round": round_number})
			actor = saved_actor
			action_type = saved_action_type
			event = saved_event
			previous_operation_targets = saved_previous_targets
			last_target = saved_last_target
			last_primary_target = saved_last_primary
			last_damage = saved_last_damage
			last_damage_target_max_hp = saved_last_max_hp
			last_damage_target_defeated = saved_last_defeated
			last_primary_target_defeated = saved_primary_defeated
			suppressed_passive_owners.erase(owner_unit.entity_id)
	if event_name == "after_enemy_defeated":
		refresh_stat_auras()
	event = previous_event


static func _condition_threshold_crossed(condition: Variant, before: float, after: float) -> bool:
	if not (condition is Dictionary):
		return false
	var map: Dictionary = condition
	if map.get("predicate") == "event_target_hp_at_or_below_pct":
		return before > float(map["value"]) and float(map["value"]) >= after
	if map.has("all"):
		for item: Variant in map["all"]:
			if _condition_threshold_crossed(item, before, after):
				return true
		return false
	if map.has("any"):
		for item: Variant in map["any"]:
			if _condition_threshold_crossed(item, before, after):
				return true
		return false
	return true


func continuous_damage_multiplier(event_name: String, event_payload: Dictionary, interpreter_ref: EffectInterpreter) -> float:
	var event_actor: Variant = event_payload.get("actor")
	var target: Variant = event_payload.get("target")
	var affected_unit: Variant = event_actor if event_name == "before_damage_dealt" else target
	var multiplier: float = 1.0
	var owners: Array = BattleUtil.sorted_by(living_units("player"), func(unit: BattleUnit) -> Array: return [unit.slot_index, unit.entity_id])
	for owner_unit: BattleUnit in owners:
		var record: Variant = records.get(owner_unit.entity_id)
		if not (record is ContentModels.Character):
			continue
		for skill: ContentModels.Skill in (record as ContentModels.Character).skills:
			for mod: Dictionary in skill.continuous_modifiers:
				if mod.get("event") != event_name:
					continue
				var applies: Variant = mod.get("applies_to", "self")
				if applies == "self" and owner_unit.entity_id != _entity_id_of(affected_unit):
					continue
				if applies == "all_allies_while_owner_alive" and owner_unit.team != _team_of(affected_unit):
					continue
				if applies != "self" and applies != "all_allies_while_owner_alive":
					report_fault("Unsupported continuous modifier applies_to %s" % ContentLoader.py_repr(applies))
					return multiplier
				var old_actor: BattleUnit = actor
				var old_event: Dictionary = event
				actor = owner_unit
				event = event_payload.duplicate()
				if interpreter_ref.evaluate_condition(mod["condition"], self, target if target is BattleUnit else null):
					multiplier *= float(mod["damage_multiplier"])
				actor = old_actor
				event = old_event
	return multiplier


func refresh_stat_auras() -> void:
	var prefix: String = "continuous_aura:"
	for unit: BattleUnit in units:
		var kept: Array[Dictionary] = []
		for modifier: Dictionary in unit.stat_modifiers:
			if not str(modifier.get("source_id", "")).begins_with(prefix):
				kept.append(modifier)
		unit.stat_modifiers = kept
	for owner_unit: BattleUnit in living_units("player"):
		var record: Variant = records.get(owner_unit.entity_id)
		if not (record is ContentModels.Character) or owner_unit.row != "rear":
			continue
		for skill: ContentModels.Skill in (record as ContentModels.Character).skills:
			for mod: Dictionary in skill.continuous_modifiers:
				if mod.get("event") == "stat_snapshot":
					for target: BattleUnit in living_units("player"):
						if target.row == "front":
							target.stat_modifiers.append({
								"stat_id": mod["stat_id"], "mode": "percent", "amount": float(mod["amount"]),
								"duration_turns": 999999, "source_id": "%s%s:%s" % [prefix, owner_unit.entity_id, skill.skill_id],
							})


func objective_destroyed(objective: Dictionary, interpreter_ref: EffectInterpreter, destroying_actor: BattleUnit) -> void:
	for operation: ContentModels.EffectOp in objective.get("on_destroyed", []):
		interpreter_ref.execute_effect_ops([operation], self, destroying_actor, "objective_break")
	var objective_id: String = str(objective["objective_id"])
	for modifier: Dictionary in boss_modifiers.duplicate():
		var remove: bool = modifier.get("until_objective_destroyed") == objective_id
		var rule: Variant = modifier.get("while_any_objective_alive")
		if rule is Dictionary:
			var ids: Array = (rule as Dictionary).get("objective_ids", [])
			remove = remove or (not ids.is_empty() and _all_destroyed(ids))
		elif rule is Array:
			remove = remove or (not (rule as Array).is_empty() and _all_destroyed(rule))
		if remove:
			interpreter_ref.execute_effect_ops([{
				"op": "remove_boss_modifier", "target_selector_id": "boss", "modifier_id": modifier["modifier_id"],
			}], self, destroying_actor, "objective_break")
	record_event({
		"type": "boss_objective_destroyed", "boss_id": boss.entity_id if boss != null else null,
		"objective_id": objective_id, "round": round_number,
	})
	if pending_telegraph != null and _telegraph_interrupted(pending_telegraph):
		(pending_telegraph as Dictionary)["cancelled"] = true


func _all_destroyed(ids: Array) -> bool:
	for item: Variant in ids:
		if int((objectives.get(item, {}) as Dictionary).get("hp", 0)) > 0:
			return false
	return true


func resolve_boss_telegraph_if_ready(turn_actor: BattleUnit, _random: CpythonRandom) -> void:
	var pending: Variant = pending_telegraph
	if pending == null or turn_actor.team != "player":
		return
	var pending_map: Dictionary = pending
	telegraph_player_opportunities += 1
	if bool(pending_map.get("cancelled", false)) or _telegraph_interrupted(pending_map):
		record_event({"type": "boss_telegraph_interrupted", "boss_id": pending_map["boss_id"], "action_id": pending_map["action_id"], "round": round_number})
		pending_telegraph = null
		phase_transition_pending = false
		telegraph_player_opportunities = 0
		return
	var needed: int = int(pending_map.get("player_actions_before_resolution", 1))
	if telegraph_player_opportunities < needed:
		return
	var boss_unit: BattleUnit = _find_unit(String(pending_map["boss_id"]))
	var enemy: Variant = records.get(pending_map["boss_id"])
	var skill: ContentModels.Skill = null
	if enemy is ContentModels.Enemy:
		for item: ContentModels.Skill in (enemy as ContentModels.Enemy).skills:
			if item.skill_id == pending_map["action_id"]:
				skill = item
				break
	if boss_unit != null and boss_unit.alive and skill != null:
		record_event({"type": "boss_telegraph_resolved", "boss_id": boss_unit.entity_id, "action_id": skill.skill_id, "round": round_number})
		var previous_actor: BattleUnit = actor
		var previous_action: String = action_type
		actor = boss_unit
		action_type = "signature"
		service.interpreter.execute_skill(skill, self, boss_unit, "signature")
		if skill.cooldown_turns != 0:
			boss_unit.cooldowns[skill.skill_id] = skill.cooldown_turns
		actor = previous_actor
		action_type = previous_action
	pending_telegraph = null
	telegraph_player_opportunities = 0
	advance_wave_if_cleared()


func _telegraph_interrupted(pending: Dictionary) -> bool:
	var rules: Dictionary = pending.get("intent_rules", {})
	var one: Variant = rules.get("interrupt_if_objective_destroyed")
	if _truthy(one) and int((objectives.get(one, {}) as Dictionary).get("hp", 0)) <= 0:
		return true
	var ids: Array = rules.get("interrupt_if_all_objectives_destroyed", [])
	return not ids.is_empty() and _all_destroyed(ids)


func resolve_phase_transition_if_needed(_random: CpythonRandom) -> void:
	if boss == null or not boss.alive:
		return
	var enemy: ContentModels.Enemy = records[boss.entity_id]
	if phase_index + 1 >= enemy.phases.size():
		return
	var contract: Dictionary = enemy.extra.get("phase_transition_contract", {})
	var threshold: float = float(contract.get("threshold_pct", 50.0))
	if float(boss.hp * 100) > float((boss.max_hp if boss.max_hp != 0 else 1)) * threshold:
		return
	if pending_telegraph != null and not bool((pending_telegraph as Dictionary).get("cancelled", false)):
		phase_transition_pending = true
		return
	load_boss_phase(phase_index + 1, true)


func resolve_reactions(turn_actor: BattleUnit, _random: CpythonRandom) -> void:
	for counter: Dictionary in turn_actor.counters.duplicate():
		if counter.get("event") != "target_action_before_owner_next_turn":
			continue
		BattleUtil.remove_first_equal(turn_actor.counters, counter)
		var source: BattleUnit = _find_unit(str(counter.get("source_id", "")))
		if source == null or not source.alive:
			continue
		var op: Dictionary = {
			"op": "damage", "target_selector_id": "event_target", "damage_type": counter["damage_type"],
			"scale_stat": counter["scale_stat"], "multiplier": counter["multiplier"],
			"no_focus_gain": true, "can_trigger_passives": false,
		}
		service.interpreter.execute_effect_ops([op], self, source, "counter", null, {"actor": turn_actor, "source": source, "target": turn_actor})


func _find_unit(entity_id: String) -> BattleUnit:
	for unit: BattleUnit in units:
		if unit.entity_id == entity_id:
			return unit
	for objective: Dictionary in objectives.values():
		if objective.get("entity_id") == entity_id:
			return objective.get("unit")
	return null


func advance_wave_if_cleared() -> void:
	if not living_units("enemy").is_empty() or next_wave_index >= stage.enemy_waves.size():
		return
	var index: int = next_wave_index
	next_wave_index += 1
	wave_index = index
	service.spawn_wave(self, index)
	record_event({"type": "enemy_wave_started", "stage_id": stage.stage_id, "wave_index": index, "round": round_number})


func load_boss_phase(new_phase_index: int, reset_health: bool) -> void:
	if boss == null:
		return
	var enemy: ContentModels.Enemy = records[boss.entity_id]
	var phase: ContentModels.BossPhase = enemy.phases[new_phase_index]
	var prior: Dictionary = objectives
	phase_index = new_phase_index
	current_phase = phase
	var base: Dictionary = service.interpreter.progression.enemy_stats_at_level(
		enemy.base_stats_level_1, enemy.growth_per_level, stage.enemy_level, stage.enemy_stat_multiplier)
	var hp: int = maxi(1, int(float(base["hp"]) * phase.hp_multiplier + 0.5))
	var stats: Dictionary = base.duplicate()
	stats["atk"] = maxi(1, int(float(base["atk"]) * phase.atk_multiplier + 0.5))
	stats["def"] = maxi(0, int(float(base["def"]) * phase.def_multiplier + 0.5))
	boss.stats = stats
	boss.weaknesses = phase.weaknesses.duplicate()
	# A phase-authored weakness replaces an inherited resistance for the same element; a live unit must never be both.
	var resistances: Array[String] = []
	for element: String in enemy.resistances:
		if not phase.weaknesses.has(element):
			resistances.append(element)
	boss.resistances = resistances
	boss.max_hp = hp
	boss.hp = hp if reset_health else mini(hp, boss.hp if boss.hp != 0 else hp)
	# hp_multiplier defines a fresh, compact phase health bar; it is not a multiplier on a hidden total-health pool.
	var carried: Dictionary = {}
	for key: String in prior:
		var objective: Dictionary = prior[key]
		if bool(objective.get("persists_across_phases", false)) and int(objective.get("hp", 0)) > 0:
			carried[key] = objective
	objectives = carried
	for objective: ContentModels.BossObjective in phase.objectives:
		if not objectives.has(objective.objective_id):
			_add_objective(objective)
	# Boss control immunities for the new phase.
	var boss_immunities: Array[String] = boss.status_immunities.duplicate()
	for item: Variant in (service.rules.get("targeting", {}) as Dictionary).get("boss_control_immunities_default", []):
		if not boss_immunities.has(String(item)):
			boss_immunities.append(String(item))
	boss.status_immunities = boss_immunities
	if reset_health:
		var contract: Dictionary = enemy.extra.get("phase_transition_contract", {})
		var category: String = str(contract.get("clear_status_category", "debuff"))
		var keep: Array = contract.get("preserve_status_ids", ["break"])
		for status_id: String in boss.statuses.keys():
			if not keep.has(status_id) and boss.status_tags(status_id, service.statuses).has(category):
				boss.statuses.erase(status_id)
		record_event({
			"type": "boss_phase_changed", "boss_id": boss.entity_id, "phase_id": phase.phase_id,
			"phase_index": new_phase_index, "hp": boss.hp, "max_hp": boss.max_hp, "round": round_number,
		})
	var operations: Array = []
	operations.append_array(phase.enter_ops)
	operations.append_array(phase.passive_ops)
	if not operations.is_empty():
		service.interpreter.execute_effect_ops(operations, self, boss, "boss_phase")


func _add_objective(objective: ContentModels.BossObjective) -> void:
	var unit: BattleUnit = BattleUnit.build({
		"entity_id": "%s:objective:%s" % [boss.entity_id, objective.objective_id],
		"team": "enemy", "slot_index": boss.slot_index, "row": "rear",
		"stats": {"hp": objective.max_hp, "atk": 0, "def": 0, "spd": 1},
		"hp": objective.hp, "max_hp": objective.max_hp, "element": boss.element,
		"is_objective": true, "objective_id": objective.objective_id,
		"stat_resolution_rules": service.rules["stat_resolution"], "status_definitions": service.statuses,
	})
	objectives[objective.objective_id] = {
		"objective_id": objective.objective_id, "name_en": objective.name_en,
		"hp": objective.hp, "max_hp": objective.max_hp,
		"unit": unit, "entity_id": unit.entity_id,
		"targetable_by_player": objective.targetable_by_player,
		"persists_across_phases": objective.persists_across_phases == true,
		"on_destroyed": objective.on_destroyed,
		"destroyed": objective.hp <= 0,
	}
