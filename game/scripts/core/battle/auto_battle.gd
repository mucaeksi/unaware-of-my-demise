class_name AutoBattleProvider
extends RefCounted
## Deterministic Auto-battle policy and the action it hands back to the loop (port of core/battle/auto_battle.py):
## the five-slot Auto policy, with boss objectives as explicit priorities. It only reads an EncounterState.


## One chosen action: a skill id and, per manual selector id, the target entity ids.
class BattleAction extends RefCounted:
	var skill_id: String = ""
	var targets: Dictionary = {}  # selector id -> Array[String]

	static func make(skill: String, chosen_targets: Dictionary = {}) -> BattleAction:
		var action: BattleAction = BattleAction.new()
		action.skill_id = skill
		action.targets = chosen_targets
		return action


var heal_below_percent: float = 40.0
var save_ultimate_for_boss: bool = true
var prioritize_boss_objectives: bool = true
var manual_ultimates: bool = false
var nearest_default: bool = false


static func from_rules(rules: Dictionary) -> AutoBattleProvider:
	var auto: Dictionary = rules.get("auto_battle", {})
	var provider: AutoBattleProvider = AutoBattleProvider.new()
	provider.heal_below_percent = float(auto.get("heal_priority_hp_percent", 40))
	provider.save_ultimate_for_boss = bool(auto.get("save_ultimate_until_boss", true))
	provider.prioritize_boss_objectives = bool(auto.get("objective_automatic_targeting_authored", true))
	return provider


func choose_action(state: EncounterState, actor: BattleUnit) -> BattleAction:
	var record: Variant = state.records[actor.entity_id]
	var basic: ContentModels.Skill = null
	for skill: ContentModels.Skill in record.skills:
		if skill.type == "basic":
			basic = skill
			break
	if basic == null:
		state.report_fault("%s has no basic skill" % actor.entity_id)
		return BattleAction.make("")
	if actor.team != "player":
		return _enemy_action(state, actor, record, basic)
	var usable: Array = []
	for skill: ContentModels.Skill in record.skills:
		if (skill.type == "active" or (skill.type == "ultimate" and not manual_ultimates)) and int(actor.cooldowns.get(skill.skill_id, 0)) == 0 and actor.focus >= skill.focus_cost:
			usable.append(skill)
	var skills: Array = BattleUtil.sorted_by(usable, func(skill: ContentModels.Skill) -> Array:
		return [-_priority(skill), skill.skill_id])
	var injured: Array[BattleUnit] = []
	for unit: BattleUnit in state.living_units("player"):
		if _hp_pct(unit) <= heal_below_percent:
			injured.append(unit)
	var boss_live: bool = state.boss != null and state.boss.alive
	for skill: ContentModels.Skill in skills:
		var has_heal: bool = _has(skill, ["heal", "heal_per_removed_status"])
		if has_heal and not injured.is_empty() and _useful(state, actor, skill, injured):
			return _action(state, actor, skill)
	for skill: ContentModels.Skill in skills:
		if skill.type == "ultimate":
			if save_ultimate_for_boss and not state.stage.boss_id.is_empty() and not boss_live:
				continue
			if not boss_live or skill.focus_cost < state.focus_rules.ultimate_cost:
				continue
		if _useful(state, actor, skill, injured):
			return _action(state, actor, skill)
	return _action(state, actor, basic)


static func _priority(skill: ContentModels.Skill) -> int:
	return 0 if skill.auto_priority == null else int(skill.auto_priority)


func _enemy_action(state: EncounterState, actor: BattleUnit, record: Variant, basic: ContentModels.Skill) -> BattleAction:
	if not (record is ContentModels.Enemy):
		return _action(state, actor, basic)
	var enemy: ContentModels.Enemy = record
	var skill: ContentModels.Skill = null
	if actor.is_boss and not enemy.phases.is_empty():
		var signature_id: String = state.current_phase.signature_action_id if state.current_phase != null else ""
		for item: ContentModels.Skill in enemy.skills:
			if item.skill_id == signature_id and state.current_phase != null:
				skill = item
				break
	else:
		var action_id: Variant = enemy.intent.get("action_id")
		for item: ContentModels.Skill in enemy.skills:
			if action_id != null and item.skill_id == action_id:
				skill = item
				break
	if skill == null or int(actor.cooldowns.get(skill.skill_id, 0)) > 0:
		return _action(state, actor, basic)
	if actor.is_boss:
		var intent_rules: Dictionary = skill.telegraph_rules.duplicate()
		if state.current_phase != null:
			intent_rules.merge(state.current_phase.intent_rules.duplicate(), true)
		state.pending_telegraph = {
			"boss_id": actor.entity_id, "action_id": skill.skill_id,
			"player_actions_before_resolution": int(intent_rules.get("player_actions_before_resolution", 1)),
			"intent_rules": intent_rules, "cancelled": false,
		}
		state.telegraph_player_opportunities = 0
		state.record_event({
			"type": "boss_telegraph_started", "boss_id": actor.entity_id, "action_id": skill.skill_id,
			"phase_id": state.current_phase.phase_id if state.current_phase != null else null,
			"round": state.round_number,
		})
		return BattleAction.make("__hold_telegraph__")
	state.record_event({"type": "enemy_intent_resolved", "enemy_id": actor.entity_id, "action_id": skill.skill_id, "round": state.round_number})
	return _action(state, actor, skill)


func _action(state: EncounterState, actor: BattleUnit, skill: ContentModels.Skill) -> BattleAction:
	var targets: Dictionary = {}
	var selector_rules: Dictionary = state.interpreter().selector_rules
	for op: ContentModels.EffectOp in skill.effect_ops:
		var selector: String = op.target_selector_id
		if selector.is_empty():
			continue
		var rule: Dictionary = selector_rules[selector]
		if rule.get("kind") != "manual_single":
			continue
		var target: BattleUnit = null
		if rule.get("side") == "opposing":
			target = _objective_target(state) if not nearest_default else null
			if target == null:
				target = nearest_enemy(state, actor) if nearest_default else _enemy_target(state, actor)
		elif ["heal", "heal_per_removed_status", "grant_shield", "grant_damage_reduction", "modify_stat", "apply_regeneration", "grant_first_hit_guard", "grant_opening_guard"].has(op.op):
			target = BattleUtil.min_by(state.living_units(actor.team), func(unit: BattleUnit) -> Array:
				return [_hp_pct(unit), unit.slot_index, unit.entity_id])
		else:
			target = nearest_enemy(state, actor) if nearest_default else _enemy_target(state, actor)
		if target != null:
			targets[selector] = [target.entity_id]
	return BattleAction.make(skill.skill_id, targets)

## Integer formation coordinates keep client/server default targeting identical.
## Authored non-manual selectors still resolve inside the interpreter.
static func formation_point(unit: BattleUnit, units: Array[BattleUnit]) -> Vector2i:
	var slots: Array[int] = []
	for other: BattleUnit in units:
		if other.team == unit.team and other.row == unit.row and not slots.has(other.slot_index): slots.append(other.slot_index)
	slots.sort()
	var rank: int = maxi(0, slots.find(unit.slot_index))
	var y: int = 560 if slots.size() <= 1 else 280 + roundi(560.0 * float(rank) / float(slots.size() - 1))
	var x: int = 180 if unit.row == "rear" else 380
	if unit.team != "player": x = 1000 - x
	return Vector2i(x,y)

static func nearest_enemy(state: EncounterState, actor: BattleUnit) -> BattleUnit:
	var origin: Vector2i = formation_point(actor,state.units)
	return BattleUtil.min_by(state.living_units(state.opposing_team(actor)),func(candidate: BattleUnit) -> Array:
		var distance: Vector2i = formation_point(candidate,state.units) - origin
		return [distance.x * distance.x + distance.y * distance.y,candidate.slot_index,candidate.entity_id])


func _objective_target(state: EncounterState) -> BattleUnit:
	if not prioritize_boss_objectives or state.boss == null or not state.boss.alive:
		return null
	var pending_id: String = ""
	if state.pending_telegraph != null:
		var rules: Dictionary = (state.pending_telegraph as Dictionary).get("intent_rules", {})
		var single: Variant = rules.get("interrupt_if_objective_destroyed")
		if single != null and _truthy(single):
			pending_id = String(single)
		else:
			for item: Variant in rules.get("interrupt_if_all_objectives_destroyed", []):
				if int((state.objectives.get(String(item), {}) as Dictionary).get("hp", 0)) > 0:
					pending_id = String(item)
					break
	var ward_ids: Array[String] = []
	for modifier: Dictionary in state.boss_modifiers:
		var until_id: Variant = modifier.get("until_objective_destroyed")
		if until_id != null and _truthy(until_id):
			ward_ids.append(String(until_id))
		var active_rule: Variant = modifier.get("while_any_objective_alive")
		if active_rule is Dictionary:
			for item: Variant in (active_rule as Dictionary).get("objective_ids", []):
				ward_ids.append(String(item))
		elif active_rule is Array:
			for item: Variant in active_rule:
				ward_ids.append(String(item))
	var priority_ids: Array[String] = []
	if not pending_id.is_empty():
		priority_ids.append(pending_id)
	for ward: String in ward_ids:
		if not priority_ids.has(ward):
			priority_ids.append(ward)
	var phase_breaks: Array[String] = []
	if state.current_phase != null:
		for item: String in state.current_phase.break_targets:
			phase_breaks.append(item)
			if not priority_ids.has(item):
				priority_ids.append(item)
	for key: String in state.objectives:
		if not priority_ids.has(key):
			priority_ids.append(key)
	for objective_id: String in priority_ids:
		var record: Variant = state.objectives.get(objective_id)
		if record == null or (record as Dictionary).is_empty():
			continue
		var entry: Dictionary = record
		if int(entry.get("hp", 0)) <= 0 or not bool(entry.get("targetable_by_player", true)):
			continue
		if objective_id == pending_id or ward_ids.has(objective_id) or phase_breaks.has(objective_id):
			return entry["unit"]
	return null


static func _enemy_target(state: EncounterState, actor: BattleUnit) -> BattleUnit:
	var enemies: Array[BattleUnit] = state.living_units(state.opposing_team(actor))
	if state.boss != null and enemies.has(state.boss):
		return state.boss
	return BattleUtil.min_by(enemies, func(unit: BattleUnit) -> Array:
		return [unit.hp, unit.slot_index, unit.entity_id])


func _useful(state: EncounterState, actor: BattleUnit, skill: ContentModels.Skill, injured: Array[BattleUnit]) -> bool:
	if _has(skill, ["heal", "heal_per_removed_status", "apply_regeneration"]):
		if not injured.is_empty():
			return true
		if not _has(skill, ["damage"]):
			return false
	var statuses: Dictionary = state.interpreter().status_definitions
	for op: ContentModels.EffectOp in skill.effect_ops:
		if op.op == "remove_status":
			for unit: BattleUnit in state.living_units(actor.team):
				for status_id: String in unit.statuses:
					if unit.status_tags(status_id, statuses).has("debuff"):
						return true
		elif op.op == "damage" and not state.living_units(state.opposing_team(actor)).is_empty():
			return true
		elif ["modify_stat", "modify_outgoing_damage", "modify_incoming_damage"].has(op.op):
			var own_modifier: bool = false
			for unit: BattleUnit in state.units:
				for modifier: Dictionary in unit.stat_modifiers + unit.damage_modifiers:
					if modifier.get("source_id") == actor.entity_id:
						own_modifier = true
			if not own_modifier:
				return true
		elif ["grant_shield", "grant_damage_reduction", "grant_opening_guard"].has(op.op):
			for unit: BattleUnit in state.living_units(actor.team):
				if unit.shield_total() < _max_hp_or_one(unit):
					return true
		elif ["apply_status", "delay_next_action", "summon_enemies", "reduce_cooldowns", "grant_redirect", "grant_intercept", "grant_first_hit_guard", "arm_counter", "arm_next_attack_bonus", "copy_buff"].has(op.op):
			return true
	return false


static func _has(skill: ContentModels.Skill, names: Array) -> bool:
	for op: ContentModels.EffectOp in skill.effect_ops:
		if names.has(op.op):
			return true
	return false


static func _max_hp_or_one(unit: BattleUnit) -> int:
	return unit.max_hp if unit.max_hp != 0 else 1


static func _hp_pct(unit: BattleUnit) -> float:
	return 100.0 * float(unit.hp) / float(maxi(1, _max_hp_or_one(unit)))


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
