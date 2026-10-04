extends GutTest
## Port of tests/test_battle_hooks.py: authored passive hooks (event filters, limits, conditions) and continuous modifiers
## on an encounter built from every character plus four enemies on stage 7-5.

var _registry: ContentModels.ContentRegistry = null
var _service: BattleService = null


func before_all() -> void:
	_registry = BattleTestHelpers.registry()
	assert_not_null(_registry, "content must load")
	_service = BattleTestHelpers.service(_registry)


## Returns {state: EncounterState, units: Dictionary}. Characters are keyed by character id, enemies by enemy id.
func _make_hook_state() -> Dictionary:
	var stage: ContentModels.Stage = _registry.stages["7-5"]
	var units: Array[BattleUnit] = []
	var records: Dictionary = {}
	var actors: Dictionary = {}
	var index: int = 0
	for character: ContentModels.Character in _registry.characters.values():
		var stats: Dictionary = _service.progression.base_stat_at_level(character.base_stats_level_1, character.growth_per_level, 1)
		var unit: BattleUnit = BattleUnit.build({
			"entity_id": character.character_id, "team": "player", "slot_index": index,
			"row": "front" if index < 2 else "rear", "stats": stats,
			"element": character.element, "tags": [character.class_id, character.combat_role],
			"stat_resolution_rules": _service.rules["stat_resolution"],
			"status_definitions": _service.statuses,
		})
		units.append(unit)
		records[unit.entity_id] = character
		actors[unit.entity_id] = unit
		index += 1
	index = 0
	for enemy_id: String in ["hollow_pilgrim", "ash_wolf", "choir_knight", "royal_hollow"]:
		var enemy: ContentModels.Enemy = _registry.enemies[enemy_id]
		var stats: Dictionary = _service.progression.base_stat_at_level(enemy.base_stats_level_1, enemy.growth_per_level, 1)
		var unit: BattleUnit = BattleUnit.build({
			"entity_id": "test:" + enemy_id, "team": "enemy", "slot_index": index,
			"row": "front", "stats": stats, "element": enemy.element,
			"weaknesses": enemy.weaknesses, "resistances": enemy.resistances,
			"status_immunities": enemy.status_immunities, "faction_id": enemy.faction_id,
			"tags": [enemy.role], "enemy_id": enemy.enemy_id,
			"stat_resolution_rules": _service.rules["stat_resolution"],
			"status_definitions": _service.statuses,
		})
		units.append(unit)
		records[unit.entity_id] = enemy
		actors[enemy_id] = unit
		index += 1
	var state: EncounterState = EncounterState.create(units, _service, stage, records)
	state.rng = CpythonRandom.create_from_int(31)  # first passive-chance roll is < 10%.
	state.action_type = "basic"
	return {"state": state, "units": actors}


func _dispatch(state: EncounterState, event_name: String, actor: BattleUnit, source: Variant, target: Variant,
		extra: Dictionary = {}) -> void:
	state.actor = actor
	var payload: Dictionary = {
		"actor": actor, "source": source if source != null else actor,
		"target": target, "action_type": "basic", "source_action_type": "basic",
	}
	payload.merge(extra, true)
	state.dispatch_battle_event(event_name, payload, _service.interpreter)


func _passive_events(state: EncounterState) -> Array[Dictionary]:
	var found: Array[Dictionary] = []
	for event: Dictionary in state.battle_events:
		if event.get("type") == "passive_triggered":
			found.append(event)
	return found


func _has_damage_modifier(unit: BattleUnit, source_id: Variant, multiplier: float) -> bool:
	for modifier: Dictionary in unit.damage_modifiers:
		if (source_id == null or modifier.get("source_id") == source_id) and is_equal_approx(float(modifier.get("multiplier", -1.0)), multiplier):
			return true
	return false


func test_authored_event_hooks_dispatch_with_conditions_and_limits() -> void:
	var built: Dictionary = _make_hook_state()
	var state: EncounterState = built["state"]
	var units: Dictionary = built["units"]
	var attacker: BattleUnit = units["ash_wolf"]
	var other_enemy: BattleUnit = units["choir_knight"]
	var pilgrim: BattleUnit = units["hollow_pilgrim"]

	var mahmut: BattleUnit = units["mahmut"]
	mahmut.shields.append({"amount": 2, "source_id": "test"})
	var attacker_hp_before: int = attacker.hp
	_dispatch(state, "before_damage_received", attacker, attacker, mahmut, {"incoming_action_type": "basic"})
	assert_lt(attacker.hp, attacker_hp_before, "mahmut's shield-guarded passive reflects damage")
	assert_eq(mahmut.focus, 5)

	var sable: BattleUnit = units["sable_wren"]
	_dispatch(state, "before_damage_received", attacker, attacker, sable, {"incoming_action_type": "basic"})
	assert_true(_has_damage_modifier(sable, null, 0.5))

	var nara_target: BattleUnit = units["brin_alder"]  # Front owner protects this Rear target below.
	nara_target.row = "rear"
	(units["nara_vell"] as BattleUnit).row = "front"
	_dispatch(state, "before_damage_received", attacker, attacker, nara_target, {"incoming_action_type": "basic", "team": "player"})
	assert_true(_has_damage_modifier(nara_target, "nara_vell", 0.9))

	var fadyme: BattleUnit = units["fadyme"]
	fadyme.hp = maxi(1, int(fadyme.max_hp * 0.4))
	_dispatch(state, "owner_turn_start", fadyme, fadyme, fadyme)
	var veil_found: bool = false
	for unit: BattleUnit in state.units:
		for modifier: Dictionary in unit.stat_modifiers:
			if modifier.get("source_id") == "fadyme" and modifier.get("stat_id") == "veil_res":
				veil_found = true
	assert_true(veil_found, "fadyme veil_res modifier applied")

	var thistle: BattleUnit = units["thistle_roe"]
	thistle.hp = int(thistle.max_hp * 0.9)
	_dispatch(state, "owner_turn_start", thistle, thistle, thistle)
	var any_shield: bool = false
	for unit: BattleUnit in state.living_units("player"):
		if unit.shield_total() > 0:
			any_shield = true
	assert_true(any_shield, "thistle grants a shield")

	var low_ally: BattleUnit = units["brin_alder"]
	low_ally.max_hp = 10
	low_ally.hp = 2
	_dispatch(state, "ally_hp_threshold_crossed", attacker, attacker, low_ally,
		{"team": "player", "target_hp_before_pct": 40, "target_hp_after_pct": 20})
	assert_gt(low_ally.shield_total(), 0)
	var iona_event: bool = false
	for event: Dictionary in _passive_events(state):
		if event.get("owner_id") == "iona_mist":
			iona_event = true
	assert_true(iona_event)

	var tilda: BattleUnit = units["tilda_fen"]
	_dispatch(state, "after_ally_healed", tilda, tilda, low_ally, {"team": "player", "healing": 1})
	assert_true(low_ally.has_status("soaked_immunity"))

	var rikka: BattleUnit = units["rikka_ember"]
	_dispatch(state, "after_damage_received", attacker, attacker, rikka, {"team": "player", "damage": 1})
	assert_eq(rikka.focus, 5)

	mahmut.statuses["stoneguard"] = {"duration_turns": 1, "tags": ["buff"]}
	_dispatch(state, "after_ally_action", mahmut, mahmut, mahmut, {"ally_action_type": "basic"})
	assert_eq((units["mirel_quill"] as BattleUnit).focus, 5)
	_dispatch(state, "after_ally_ultimate", mahmut, mahmut, mahmut, {"ally_action_type": "ultimate"})
	assert_eq((units["pippa_bell"] as BattleUnit).focus, 10)

	var clem: BattleUnit = units["clem_marr"]
	pilgrim.statuses["dread"] = {"duration_turns": 2, "tags": ["debuff"]}
	state.last_target = pilgrim
	_dispatch(state, "before_damage_dealt", clem, clem, pilgrim, {"owner_action_type": "any_attack"})
	assert_true(_has_damage_modifier(clem, "clem_marr", 1.08))

	var vespera: BattleUnit = units["vespera_wisp"]
	_dispatch(state, "after_enemy_defeated", mahmut, mahmut, pilgrim,
		{"target_statuses_before": ["dread"], "target_defeated": true})
	assert_eq(vespera.focus, 10)

	var hana: BattleUnit = units["hana_birch"]
	_dispatch(state, "after_round_end", mahmut, mahmut, mahmut)
	assert_false(hana.next_attack_bonuses.is_empty())
	assert_almost_eq(float(hana.next_attack_bonuses[0]["damage_multiplier"]), 1.2, 1e-12)

	var kera_built: Dictionary = _make_hook_state()
	var kera_state: EncounterState = kera_built["state"]
	var kera_units: Dictionary = kera_built["units"]
	var kera: BattleUnit = kera_units["kera_voss"]
	var kera_pilgrim: BattleUnit = kera_units["hollow_pilgrim"]
	kera_pilgrim.statuses["burn"] = {"duration_turns": 2, "tags": ["debuff", "damage_over_time"]}
	kera_state.last_target = kera_pilgrim
	kera_state.last_primary_target = kera_pilgrim
	kera_state.rng = CpythonRandom.create_from_int(31)  # deterministic successful 10% passive roll.
	_dispatch(kera_state, "after_damage_dealt", kera, kera, kera_pilgrim,
		{"damage_action_id": 7, "damage_action_type": "basic_or_skill"})
	var kera_event: bool = false
	for event: Dictionary in _passive_events(kera_state):
		if event.get("owner_id") == "kera_voss" and event.get("skill_id") == "kera_voss_passive_measure_twice":
			kera_event = true
	assert_true(kera_event, "kera's 10% passive fires with seed 31")

	var nixie: BattleUnit = units["nixie_vale"]
	state.last_target = pilgrim
	state.last_primary_target = pilgrim
	_dispatch(state, "after_damage_dealt", nixie, nixie, pilgrim, {"damage_action_id": 8, "owner_action_type": "any_attack"})
	var marked: bool = false
	for status: Dictionary in other_enemy.statuses.values():
		if (status.get("tags", []) as Array).has("mark"):
			marked = true
	for unit: BattleUnit in state.living_units("enemy"):
		if unit.has_status("trail_mark"):
			marked = true
	assert_true(marked, "nixie marks an enemy")

	state.last_target = pilgrim
	_dispatch(state, "ally_damaged", mahmut, mahmut, pilgrim, {"event_target_faction_is": "hollow_host", "damage": 1})
	var choir_event: bool = false
	for event: Dictionary in _passive_events(state):
		if event.get("owner_id") == "test:choir_knight":
			choir_event = true
	assert_true(choir_event)

	var royal: BattleUnit = units["royal_hollow"]
	_dispatch(state, "before_damage_received", mahmut, mahmut, royal, {"incoming_action_type": "basic"})
	assert_eq(royal.blocked_attack_hits, 1)
	assert_gte(_passive_events(state).size(), 15)
	assert_eq(state.fault, "")
	assert_eq(kera_state.fault, "")


func test_continuous_modifiers_follow_damage_direction_and_stat_snapshot() -> void:
	var built: Dictionary = _make_hook_state()
	var state: EncounterState = built["state"]
	var units: Dictionary = built["units"]
	var brin: BattleUnit = units["brin_alder"]
	brin.statuses["taunt"] = {"duration_turns": 1, "tags": ["buff", "control"]}
	var incoming: float = state.continuous_damage_multiplier("before_damage_received",
		{"actor": units["ash_wolf"], "target": brin}, _service.interpreter)
	assert_eq(incoming, 0.9)

	var pilgrim: BattleUnit = units["hollow_pilgrim"]
	pilgrim.statuses["trail_mark"] = {"duration_turns": 2, "tags": ["mark"]}
	var outgoing: float = state.continuous_damage_multiplier("before_damage_dealt",
		{"actor": units["mahmut"], "target": pilgrim}, _service.interpreter)
	assert_eq(outgoing, 1.05)

	# Isolate Odelia's soaked-target modifier from Nixie's trail-mark aura.
	pilgrim.statuses.erase("trail_mark")
	pilgrim.statuses["soaked"] = {"duration_turns": 2, "tags": ["debuff"]}
	var soaked: float = state.continuous_damage_multiplier("before_damage_dealt",
		{"actor": units["odelia_pike"], "target": pilgrim}, _service.interpreter)
	assert_eq(soaked, 1.1)

	var jori: BattleUnit = units["jori_flint"]
	jori.shields.append({"amount": 1, "source_id": "test"})
	state.action_type = "basic"
	var shielded: float = state.continuous_damage_multiplier("before_damage_dealt",
		{"actor": jori, "target": pilgrim}, _service.interpreter)
	assert_eq(shielded, 1.15)

	state.refresh_stat_auras()
	var front: BattleUnit = units["mahmut"]
	var aura_found: bool = false
	for modifier: Dictionary in front.stat_modifiers:
		if String(modifier.get("source_id", "")).begins_with("continuous_aura:marek_vane") \
				and modifier.get("stat_id") == "def" and is_equal_approx(float(modifier.get("amount", 0.0)), 0.05):
			aura_found = true
	assert_true(aura_found, "marek's def aura on the front row")
