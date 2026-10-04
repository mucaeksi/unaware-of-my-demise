extends GutTest
## Port of tests/test_battle_service.py and the engine-level part of tests/test_battle_seed.py (the GameController async
## seed plumbing belongs to the client and is ported with it in G4/G5).

const STARTER_FIVE: Array[String] = ["mahmut", "fadyme", "brin_alder", "nixie_vale", "kera_voss"]

var _registry: ContentModels.ContentRegistry = null
var _service: BattleService = null


func before_all() -> void:
	_registry = BattleTestHelpers.registry()
	assert_not_null(_registry, "content must load")
	_service = BattleTestHelpers.service(_registry)


func _run(stage_id: String, roster: Array, options: Dictionary = {}) -> BattleService.BattleResult:
	var result: BattleService.BattleResult = _service.run(stage_id, roster, options)
	assert_eq(result.error, "", "battle %s must not fault" % stage_id)
	return result


func _levels(level: int) -> Dictionary:
	var levels: Dictionary = {}
	for character_id: String in STARTER_FIVE:
		levels[character_id] = level
	return levels


func _events_of_type(result: BattleService.BattleResult, event_type: String) -> Array[Dictionary]:
	var found: Array[Dictionary] = []
	for event: Dictionary in result.state.battle_events:
		if event.get("type") == event_type:
			found.append(event)
	return found


func _fingerprint(result: BattleService.BattleResult) -> String:
	return var_to_str([result.outcome, result.stars, result.actions, result.final_units, result.state.battle_events])


func _party(result: BattleService.BattleResult) -> Array[BattleUnit]:
	var party: Array[BattleUnit] = []
	for unit: BattleUnit in result.state.units:
		if unit.team == "player":
			party.append(unit)
	return party


func test_tutorial_and_story_loan_auto_parties_are_five_slot_safe() -> void:
	var tutorial: BattleService.BattleResult = _run("1-1", ["mahmut", "fadyme"], {"run_seed": 20260927})
	var loan: BattleService.BattleResult = _run("1-2", ["mahmut", "fadyme"], {"run_seed": 20260927})

	assert_eq(tutorial.outcome, "victory")
	assert_false(_events_of_type(tutorial, "damage_dealt").is_empty())
	assert_eq(_party(tutorial), tutorial.state.living_units("player"))
	assert_eq(tutorial.state.living_units("player").size(), 2)
	assert_eq(loan.outcome, "victory")
	var party: Array[BattleUnit] = _party(loan)
	assert_eq(party.size(), 5)
	var shape: Array = []
	var ids: Array[String] = []
	for unit: BattleUnit in party:
		shape.append([unit.row, unit.slot_index])
		ids.append(unit.entity_id)
		assert_eq(unit.level, 1)
	assert_eq(shape, [["front", 0], ["front", 1], ["rear", 2], ["rear", 3], ["rear", 4]])
	ids.sort()
	var expected: Array[String] = STARTER_FIVE.duplicate()
	expected.sort()
	assert_eq(ids, expected)
	for unit: BattleUnit in party:
		assert_eq(unit.temporary, ["brin_alder", "nixie_vale", "kera_voss"].has(unit.entity_id), unit.entity_id)

	var brin: BattleUnit = null
	for unit: BattleUnit in party:
		if unit.entity_id == "brin_alder":
			brin = unit
	var record: ContentModels.Character = _registry.characters["brin_alder"]
	var brin_base: Dictionary = _service.progression.base_stat_at_level(record.base_stats_level_1, record.growth_per_level, 1)
	assert_gt(int(brin.stats["hp"]), int(brin_base["hp"]), "story loan gear raises HP above the bare level-1 stats")
	var again: BattleService.BattleResult = _run("1-2", ["mahmut", "fadyme"], {"run_seed": 20260927})
	var brin_again: BattleUnit = null
	for unit: BattleUnit in again.state.units:
		if unit.entity_id == "brin_alder":
			brin_again = unit
	assert_eq(var_to_str(brin.stats), var_to_str(brin_again.stats))


func test_seeded_auto_replay_produces_identical_event_trace() -> void:
	var story_state: StoryState.PlayerStoryState = _service.story.new_player_state()
	story_state.owned_character_ids = {}
	for character_id: String in STARTER_FIVE:
		story_state.owned_character_ids[character_id] = true
	var options: Dictionary = {"story_state": story_state, "player_levels": _levels(20), "run_seed": 88421}
	var first: BattleService.BattleResult = _run("7-5", STARTER_FIVE, options)
	var second: BattleService.BattleResult = _run("7-5", STARTER_FIVE, options)

	assert_eq(first.outcome, "victory")
	assert_eq(second.outcome, "victory")
	assert_eq(var_to_str(first.state.battle_events), var_to_str(second.state.battle_events))
	assert_eq(var_to_str(first.final_units), var_to_str(second.final_units))


func test_auto_uses_boss_break_targets_and_applies_both_boss_phases() -> void:
	var result: BattleService.BattleResult = _run("1-5", STARTER_FIVE, {"player_levels": _levels(3), "run_seed": 340})
	assert_eq(result.outcome, "victory")
	assert_false(_events_of_type(result, "boss_phase_changed").is_empty())
	assert_false(_events_of_type(result, "boss_objective_destroyed").is_empty())
	assert_false(_events_of_type(result, "boss_telegraph_interrupted").is_empty())
	assert_eq(result.state.phase_index, 1)


func test_eclipse_pylons_remove_ward_and_decay_status() -> void:
	var result: BattleService.BattleResult = _run("7-5", STARTER_FIVE, {"player_levels": _levels(20), "run_seed": 2026})
	var state: EncounterState = result.state
	assert_eq(result.outcome, "victory")
	assert_eq(state.phase_index, 1)
	for objective_id: String in ["altar_pylon_left", "altar_pylon_center", "altar_pylon_right"]:
		assert_eq(int(state.objectives[objective_id]["hp"]), 0, objective_id)
	for modifier: Dictionary in state.boss_modifiers:
		assert_ne(modifier.get("modifier_id"), "aether_ward")
	assert_false(state.boss.statuses.has("decay"))
	var pulse_interrupted: bool = false
	for event: Dictionary in _events_of_type(result, "boss_telegraph_interrupted"):
		if event.get("action_id") == "boss_eclipse_construct_eclipse_pulse":
			pulse_interrupted = true
	assert_true(pulse_interrupted)


func test_same_seed_reproduces_the_same_battle() -> void:
	var seed_value: int = 987_654_321_012_345
	var first: BattleService.BattleResult = _run("1-1", [], {"run_seed": seed_value})
	var second: BattleService.BattleResult = _run("1-1", [], {"run_seed": seed_value})
	assert_eq(first.run_seed, seed_value)
	assert_eq(second.run_seed, seed_value)
	assert_eq(_fingerprint(first), _fingerprint(second))


func test_explicit_seed_is_recorded_and_replays() -> void:
	var first: BattleService.BattleResult = _run("1-1", [], {"run_seed": 4242})
	assert_eq(first.run_seed, 4242)
	var replay: BattleService.BattleResult = _run("1-1", [], {"run_seed": 4242})
	assert_eq(_fingerprint(replay), _fingerprint(first))
