class_name BattleState
extends RefCounted
## Mutable battle-local state (port of core/battle/models.py BattleState): units, the acting unit, the seeded rng,
## objectives, boss modifiers, the replay log and the presentation-neutral event list. EncounterState extends it with
## passive hooks, waves and boss phases.
##
## `battle_events` (via `record_event`) is the contract between battle logic and presentation: event types and fields
## are kept exactly as the reference writes them. `log` only carries what authored applied-order values need.

## Every recorded or emitted presentation event (`record_event` also stores it in `battle_events`).
signal event_emitted(event: Dictionary)

var units: Array[BattleUnit] = []
var actor: BattleUnit = null
var rng: CpythonRandom = null
var gauge_rules: GaugeRules = null
var focus_rules: FocusRules = FocusRules.new()
var round_number: int = 1
var action_type: String = "basic"
var automatic: bool = true
var manual_targets: Dictionary = {}  # selector id -> Array[String]
var event: Dictionary = {}
var boss: BattleUnit = null
var objectives: Dictionary = {}  # objective id -> Dictionary (incl. "unit": BattleUnit)
var boss_modifiers: Array[Dictionary] = []
var pending_telegraph: Variant = null  # Dictionary | null
var previous_operation_targets: Array[BattleUnit] = []
var previous_successful_heal_targets: Array[BattleUnit] = []
var last_target: BattleUnit = null
var last_primary_target: BattleUnit = null
var last_damage: int = 0
var last_damage_target_max_hp: int = 0
var last_damage_target_defeated: bool = false
var last_primary_target_defeated: bool = false
var last_removed_statuses: Dictionary = {}  # entity id -> Array[Dictionary]
var acted_entity_ids: Dictionary = {}  # set
var damaged_entity_ids_this_round: Dictionary = {}  # set
var pending_summons: Array[Dictionary] = []
var log: Array[Dictionary] = []
var cycle_snapshot: Dictionary = {}  # set
var cycle_acted_entity_ids: Dictionary = {}  # set
var battle_events: Array[Dictionary] = []
var turn_status_snapshot: Dictionary = {}  # entity id -> Dictionary (set of status ids)

## First fault of the run ("" = none): the reference raises (EffectContractError, ValueError ...), the port stops.
var fault: String = ""


## A bare state around `unit_list` (unit tests; a real battle uses EncounterState).
static func make(unit_list: Array[BattleUnit]) -> BattleState:
	var state: BattleState = BattleState.new()
	state.units = unit_list
	return state


func report_fault(message: String) -> void:
	if fault.is_empty():
		fault = message
		push_error("Battle fault: " + message)


# -- hooks that EncounterState overrides (the base state has no service, passives or waves) ---------


## False for a bare BattleState (unit tests); EncounterState resolves passive hooks and continuous modifiers.
func supports_passives() -> bool:
	return false


func dispatch_battle_event(_event_name: String, _payload: Dictionary, _interpreter: EffectInterpreter) -> void:
	pass


func continuous_damage_multiplier(_event_name: String, _payload: Dictionary, _interpreter: EffectInterpreter) -> float:
	return 1.0


func next_damage_action_id() -> int:
	return log.size()


## Resolves the chosen action for `turn_actor`. A bare state has no action model: subclasses (or EncounterState) override.
func resolve_action(_turn_actor: BattleUnit, _action: Variant, _random: CpythonRandom) -> void:
	report_fault("BattleState.resolve_action is not implemented for a bare state")


func resolve_reactions(_turn_actor: BattleUnit, _random: CpythonRandom) -> void:
	pass


func resolve_boss_telegraph_if_ready(_turn_actor: BattleUnit, _random: CpythonRandom) -> void:
	pass


func resolve_phase_transition_if_needed(_random: CpythonRandom) -> void:
	pass


## The interpreter owned by the service (null for a bare state).
func service_interpreter() -> EffectInterpreter:
	return null


func objective_destroyed(_objective: Dictionary, _interpreter: EffectInterpreter, _destroying_actor: BattleUnit) -> void:
	pass


## The content record (Character | Enemy) behind an entity id; null for a bare state.
func record_of(_entity_id: String) -> Variant:
	return null


## How many turns `entity_id` has taken (counter arming compares against it); 0 for a bare state.
func owner_turn_count(_entity_id: String) -> int:
	return 0


## Units a `summon_enemies` operation adds (the encounter's enemy factory); none for a bare state.
func spawn_summons(_enemy_id: String, _count: int) -> Array[BattleUnit]:
	return []


# -- events -----------------------------------------------------------------------------------------


## Synchronously publishes one event without retaining it in the log.
func emit_event(payload_source: Dictionary) -> void:
	var payload: Dictionary = payload_source.duplicate()
	if not (payload.get("type") is String) or (payload["type"] as String).is_empty():
		report_fault("battle event requires a non-empty 'type'")
		return
	event_emitted.emit(payload.duplicate())


## Adds a deterministic, presentation-neutral event to the battle log and publishes it.
func record_event(payload_source: Dictionary) -> void:
	var payload: Dictionary = payload_source.duplicate()
	battle_events.append(payload)
	emit_event(payload)


func living_units(team: String = "") -> Array[BattleUnit]:
	var result: Array[BattleUnit] = []
	for unit: BattleUnit in units:
		if unit.alive and unit.hp > 0 and (team.is_empty() or unit.team == team):
			result.append(unit)
	return result


func opposing_team(owner_unit: BattleUnit = null) -> String:
	var owner_ref: BattleUnit = owner_unit if owner_unit != null else actor
	if owner_ref == null:
		report_fault("A battle actor is required to resolve opposing-team selectors")
		return ""
	return "enemy" if owner_ref.team == "player" else "player"


func is_battle_over() -> bool:
	return living_units("player").is_empty() or living_units("enemy").is_empty()


func begin_cycle(members: Array[BattleUnit] = []) -> void:
	var snapshot: Array[BattleUnit] = members if not members.is_empty() else living_units()
	cycle_snapshot = {}
	for unit: BattleUnit in snapshot:
		cycle_snapshot[unit.entity_id] = true
	cycle_acted_entity_ids.clear()
	damaged_entity_ids_this_round.clear()
	for unit: BattleUnit in snapshot:
		unit.damage_taken_this_round = 0


func end_cycle() -> void:
	for unit: BattleUnit in units:
		for effect: Dictionary in unit.damage_modifiers.duplicate():
			if effect.has("duration_rounds"):
				effect["duration_rounds"] = maxi(0, int(effect["duration_rounds"]) - 1)
				if int(effect["duration_rounds"]) == 0:
					BattleUtil.remove_first_equal(unit.damage_modifiers, effect)


func cycle_is_complete() -> bool:
	var alive_ids: Dictionary = {}
	for unit: BattleUnit in living_units():
		alive_ids[unit.entity_id] = true
	for entity_id: String in cycle_snapshot:
		if alive_ids.has(entity_id) and not cycle_acted_entity_ids.has(entity_id):
			return false
	return true


func start_turn(turn_actor: BattleUnit) -> void:
	actor = turn_actor
	turn_actor.has_acted = true
	acted_entity_ids[turn_actor.entity_id] = true
	cycle_acted_entity_ids[turn_actor.entity_id] = true
	# Snapshot before expiry: a one-turn control status that expires at this boundary still interrupts this
	# scheduled action, then is consumed.
	var snapshot: Dictionary = {}
	for status_id: String in turn_actor.statuses:
		snapshot[status_id] = true
	turn_status_snapshot[turn_actor.entity_id] = snapshot
	for skill_id: String in turn_actor.cooldowns.keys():
		turn_actor.cooldowns[skill_id] = maxi(0, int(turn_actor.cooldowns[skill_id]) - 1)
	# The authored contract decrements durations before owner-turn effects. Expiring DOT payloads are kept locally
	# for this final tick only.
	var expiring_statuses: Dictionary = {}
	for status_id: String in turn_actor.statuses.keys():
		var status: Dictionary = turn_actor.statuses[status_id]
		if status.has("duration_turns"):
			status["duration_turns"] = maxi(0, int(status.get("duration_turns", 1)) - 1)
			if int(status["duration_turns"]) == 0:
				expiring_statuses[status_id] = status
				turn_actor.statuses.erase(status_id)
	for collection: Array in [turn_actor.shields, turn_actor.stat_modifiers, turn_actor.damage_modifiers, turn_actor.redirects]:
		for effect: Dictionary in collection.duplicate():
			if effect.has("duration_turns"):
				effect["duration_turns"] = maxi(0, int(effect["duration_turns"]) - 1)
				if int(effect["duration_turns"]) == 0:
					BattleUtil.remove_first_equal(collection, effect)
	var runtime_immunities: Variant = turn_actor.stats.get("status_immunities_runtime", [])
	if runtime_immunities is Array:
		for immunity: Dictionary in (runtime_immunities as Array).duplicate():
			immunity["duration_turns"] = maxi(0, int(immunity.get("duration_turns", 0)) - 1)
			if int(immunity["duration_turns"]) == 0:
				BattleUtil.remove_first_equal(runtime_immunities, immunity)

	var turn_statuses: Dictionary = expiring_statuses.duplicate()
	for status_id: String in turn_actor.statuses:
		turn_statuses[status_id] = turn_actor.statuses[status_id]
	for status_id: String in turn_statuses:
		var status: Dictionary = turn_statuses[status_id]
		if _truthy(status.get("ticks_at_owner_turn_start")) and _truthy(status.get("tick_damage")):
			_tick_damage(turn_actor, status_id, status)
		if status_id == "regeneration" and status.get("tick_event") == "owner_turn_start" and int(status.get("ticks_remaining", 0)) > 0:
			var old_hp: int = turn_actor.hp
			turn_actor.hp = mini(turn_actor.max_hp if turn_actor.max_hp != 0 else 1, turn_actor.hp + maxi(0, int(status.get("tick_healing", 0))))
			emit_event({
				"type": "healing_applied", "source_id": status.get("source_id"),
				"target_id": turn_actor.entity_id, "amount": turn_actor.hp - old_hp,
				"hp": turn_actor.hp, "max_hp": turn_actor.max_hp,
				"alive": turn_actor.alive, "status_id": status_id,
			})
			status["ticks_remaining"] = maxi(0, int(status["ticks_remaining"]) - 1)
			if int(status["ticks_remaining"]) == 0:
				turn_actor.statuses.erase(status_id)
		elif status_id == "regeneration" and status.get("tick_event") == "owner_turn_start":
			turn_actor.statuses.erase(status_id)


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


## One damage-over-time tick at the owner's turn start.
func _tick_damage(turn_actor: BattleUnit, status_id: String, status: Dictionary) -> void:
	var base_amount: int = maxi(1, int(status["tick_damage"]))
	var old_hp: int = turn_actor.hp
	var interpreter: EffectInterpreter = service_interpreter()
	var dispatcher_ready: bool = supports_passives() and interpreter != null
	var source: BattleUnit = null
	for unit: BattleUnit in units:
		if unit.entity_id == status.get("source_id"):
			source = unit
			break
	var hit_payload: Dictionary = {
		"actor": source, "source": source, "target": turn_actor,
		"action_type": "status", "source_action_type": "status",
		"incoming_action_type": "status", "skill_id": status_id,
	}
	if dispatcher_ready:
		dispatch_battle_event("before_damage_received", hit_payload, interpreter)

	var multiplier: float = 1.0
	for active_id: String in turn_actor.statuses:
		var definition: Dictionary = turn_actor.status_definitions.get(active_id, {})
		var active: Dictionary = turn_actor.statuses[active_id]
		multiplier *= float(active.get("damage_taken_multiplier", definition.get("damage_taken_multiplier", 1.0)))
	for modifier: Dictionary in turn_actor.damage_modifiers:
		if modifier.get("kind") == "incoming":
			multiplier *= float(modifier.get("multiplier", 1.0))
	if supports_passives() and interpreter != null and source != null:
		var continuous_payload: Dictionary = hit_payload.duplicate()
		continuous_payload["damage"] = base_amount
		multiplier *= continuous_damage_multiplier("before_damage_received", continuous_payload, interpreter)
	var amount: int = maxi(1, int(float(base_amount) * multiplier))
	var blocked: bool = turn_actor.blocked_attack_hits > 0
	if blocked:
		turn_actor.blocked_attack_hits -= 1
		amount = 0
	var remaining: int = amount
	var shield_absorbed: int = 0
	for shield: Dictionary in turn_actor.shields.duplicate():
		if remaining <= 0:
			break
		var absorbed: int = mini(remaining, maxi(0, int(shield.get("amount", 0))))
		shield["amount"] = maxi(0, int(shield.get("amount", 0)) - absorbed)
		remaining -= absorbed
		shield_absorbed += absorbed
		if int(shield["amount"]) == 0:
			BattleUtil.remove_first_equal(turn_actor.shields, shield)
	var hp_damage: int = mini(old_hp, remaining)
	turn_actor.hp = maxi(0, old_hp - hp_damage)
	turn_actor.damage_taken_this_round += hp_damage
	if hp_damage > 0:
		damaged_entity_ids_this_round[turn_actor.entity_id] = true
	turn_actor.alive = turn_actor.alive and turn_actor.hp > 0
	var tick_event: Dictionary = {
		"type": "damage_dealt", "source_id": status.get("source_id"),
		"target_id": turn_actor.entity_id, "amount": amount,
		"hp_damage": hp_damage, "shield_absorbed": shield_absorbed,
		"hp": turn_actor.hp, "max_hp": turn_actor.max_hp,
		"alive": turn_actor.alive, "damage_type": "status", "status_id": status_id,
		"blocked": blocked,
	}
	log.append(tick_event.duplicate())
	record_event(tick_event)
	if dispatcher_ready:
		var max_hp_floor: float = float(maxi(1, turn_actor.max_hp))
		var payload: Dictionary = hit_payload.duplicate()
		payload["damage"] = amount
		payload["hp_damage"] = hp_damage
		payload["shield_absorbed"] = shield_absorbed
		payload["target_hp_before_pct"] = float(old_hp) * 100.0 / max_hp_floor
		payload["target_hp_after_pct"] = float(turn_actor.hp) * 100.0 / max_hp_floor
		if amount > 0 or shield_absorbed > 0:
			dispatch_battle_event("after_damage_received", payload, interpreter)
			if source == null or source.team != turn_actor.team:
				dispatch_battle_event("ally_damaged", payload, interpreter)
		var before_pct: float = payload["target_hp_before_pct"]
		var after_pct: float = payload["target_hp_after_pct"]
		if turn_actor.team == "player":
			for threshold: int in [75, 50, 25]:
				if before_pct > float(threshold) and float(threshold) >= after_pct:
					var crossed: Dictionary = payload.duplicate()
					crossed["target_hp_before_pct"] = before_pct
					crossed["target_hp_after_pct"] = after_pct
					crossed["threshold_pct"] = threshold
					dispatch_battle_event("ally_hp_threshold_crossed", crossed, interpreter)
					break
		if old_hp > 0 and turn_actor.hp == 0 and turn_actor.team == "enemy":
			var defeated: Dictionary = payload.duplicate()
			defeated["target_defeated"] = true
			defeated["target_statuses_before"] = _keys_in_order(turn_actor.statuses)
			dispatch_battle_event("after_enemy_defeated", defeated, interpreter)
	if amount > 0:
		var taken: int = turn_actor.hit_focus_gained_this_turn
		var gained: int = focus_rules.hit_gain(taken)
		turn_actor.focus = mini(focus_rules.maximum, turn_actor.focus + gained)
		turn_actor.hit_focus_gained_this_turn = taken + gained


## Dictionary keys in insertion order (`tuple(mapping)`).
static func _keys_in_order(map: Dictionary) -> Array[String]:
	var keys: Array[String] = []
	for key: String in map:
		keys.append(key)
	return keys


func end_turn(turn_actor: BattleUnit) -> void:
	turn_status_snapshot.erase(turn_actor.entity_id)
	turn_actor.alive = turn_actor.alive and turn_actor.hp > 0
	actor = turn_actor
	reset_defeated_focus()


## `focus.death_resets_focus`: a defeated unit holds no Focus. Applied once per turn (`end_turn`) and before results are
## built, since a defeated unit cannot act and no revive exists.
func reset_defeated_focus() -> void:
	if not focus_rules.death_resets_focus:
		return
	for unit: BattleUnit in units:
		if not unit.alive or unit.hp <= 0:
			unit.focus = 0
