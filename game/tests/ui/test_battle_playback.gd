extends GutTest
## G5: `BattlePlayback`, the presentation model of the battle replay. Synthetic logs pin each event type; the real battles (the story's 35
## default-party fights, taken from parity/fixtures) prove the model follows the engine: event-tracked HP equals the engine's final HP
## and every event produces its cue.

var _registry: ContentModels.ContentRegistry = null
var _service: BattleService = null
var _story: StoryState = null


func before_all() -> void:
	_registry = ContentLoader.new().load_dir("res://data/content")
	_story = StoryState.new(_registry, StoryState.load_manifest("res://data/content"))
	_service = BattleService.create(_registry, _story)


## The reference run of a stage's default party (recommended levels, seed 0), rebuilt from its parity fixture input.
func _default_battle(stage_id: String) -> BattleService.BattleResult:
	var fixture: Dictionary = ParityFixtures.load_fixture("battle_" + stage_id)
	for case: Dictionary in fixture["cases"]:
		if String(case["variant"]) != "auto_recommended" or String(case["seed"]) != "0":
			continue
		var input: Dictionary = case["input"]
		var state: StoryState.PlayerStoryState = _story.new_player_state()
		state.owned_character_ids = {}
		for character_id: Variant in input["owned_character_ids"]:
			state.owned_character_ids[String(character_id)] = true
		return _service.run(stage_id, input["roster"], {"story_state": state, "player_levels": input["player_levels"], "run_seed": 0})
	return null


func _unit(entity_id: String, team: String, hp: int, slot: int = 0, extra: Dictionary = {}) -> Dictionary:
	var record: Dictionary = {"entity_id": entity_id, "team": team, "row": "front", "slot_index": slot, "level": 3, "hp": hp, "max_hp": hp, "is_boss": false, "is_objective": false, "enemy_id": "", "objective_id": "", "temporary": false}
	record.merge(extra, true)
	return record


func _kinds(cues: Array[BattlePlayback.Cue]) -> Array[String]:
	var kinds: Array[String] = []
	for cue: BattlePlayback.Cue in cues:
		kinds.append(cue.kind)
	return kinds


# -- synthetic logs ---------------------------------------------------------------------------------------


func _small_battle() -> BattlePlayback:
	var initial: Array[Dictionary] = [_unit("mahmut", "player", 40), _unit("fadyme", "player", 30, 1), _unit("1-1:0:wolf:0", "enemy", 20, 0, {"enemy_id": "wolf"})]
	var later: Array[Dictionary] = initial.duplicate()
	later.append(_unit("1-1:1:wolf:0", "enemy", 25, 0, {"enemy_id": "wolf"}))
	var events: Array[Dictionary] = [
		{"type": "action_started", "actor_id": "mahmut", "round": 1, "skill_id": "not_a_skill", "action_type": "basic"},
		{"type": "damage_dealt", "source_id": "mahmut", "target_id": "1-1:0:wolf:0", "amount": 12, "hp": 8, "max_hp": 20, "alive": true, "critical": true, "blocked": false, "hp_damage": 12, "shield_absorbed": 0},
		{"type": "action_completed", "actor_id": "mahmut", "round": 1, "skill_id": "not_a_skill", "action_type": "basic"},
		{"type": "status_applied", "source_id": "fadyme", "target_id": "mahmut", "status_id": "guard_up", "duration_turns": 2, "hp": 40, "max_hp": 40, "statuses": ["guard_up"]},
		{"type": "damage_dealt", "source_id": "mahmut", "target_id": "1-1:0:wolf:0", "amount": 9, "hp": 0, "max_hp": 20, "alive": false, "critical": false, "blocked": false, "hp_damage": 8, "shield_absorbed": 0},
		{"type": "healing_applied", "source_id": "fadyme", "target_id": "mahmut", "amount": 0, "hp": 40, "max_hp": 40, "alive": true},
		{"type": "action_started", "actor_id": "1-1:1:wolf:0", "round": 2, "skill_id": "wolf_bite", "action_type": "basic"},
		{"type": "damage_dealt", "source_id": "1-1:1:wolf:0", "target_id": "mahmut", "amount": 15, "hp": 25, "max_hp": 40, "alive": true, "critical": false, "blocked": false, "hp_damage": 15, "shield_absorbed": 0},
		{"type": "battle_reward_ready", "stage_id": "1-1", "outcome": "victory", "stars": 3, "drop_table_id": "x"},
	]
	var final_units: Array[Dictionary] = [
		{"entity_id": "mahmut", "team": "player", "hp": 24, "max_hp": 40, "alive": true, "level": 3, "temporary": false, "focus": 2, "statuses": []},
		{"entity_id": "fadyme", "team": "player", "hp": 30, "max_hp": 30, "alive": true, "level": 3, "temporary": false, "focus": 0, "statuses": []},
		{"entity_id": "1-1:0:wolf:0", "team": "enemy", "hp": 0, "max_hp": 20, "alive": false, "level": 3, "temporary": false, "focus": 0, "statuses": []},
		{"entity_id": "1-1:1:wolf:0", "team": "enemy", "hp": 25, "max_hp": 25, "alive": true, "level": 3, "temporary": false, "focus": 0, "statuses": []},
	]
	return BattlePlayback.from_records(initial, later, events, final_units, _registry, "victory", 3)


func test_the_start_state_is_the_initial_field_with_later_enemies_waiting() -> void:
	var playback: BattlePlayback = _small_battle()
	assert_eq(playback.event_count(), 9)
	assert_eq(playback.field("player").size(), 2)
	assert_eq(playback.field("enemy").size(), 1, "the second wave is not on the field yet")
	assert_false(playback.unit("1-1:1:wolf:0").on_field)
	assert_eq(playback.unit("mahmut").display_name, _registry.characters["mahmut"].name_en, "heroes are named from the content")
	assert_eq(playback.unit("1-1:0:wolf:0").hp, 20)
	assert_false(playback.is_finished())


func test_events_move_hp_and_produce_cues_in_order() -> void:
	var playback: BattlePlayback = _small_battle()
	var first: Array[BattlePlayback.Cue] = playback.apply_next()
	assert_eq(_kinds(first), [BattlePlayback.CUE_ACTION] as Array[String])
	assert_string_contains(first[0].text, "not a skill", "an unknown skill falls back to its readable id")
	var hit: Array[BattlePlayback.Cue] = playback.apply_next()
	assert_eq(_kinds(hit), [BattlePlayback.CUE_DAMAGE] as Array[String])
	assert_eq(hit[0].amount, 12)
	assert_true(hit[0].critical)
	assert_eq(hit[0].unit_id, "1-1:0:wolf:0")
	assert_eq(playback.unit("1-1:0:wolf:0").hp, 8)
	assert_eq(playback.round_number, 1)
	assert_true(playback.apply_next().is_empty(), "action_completed has nothing to draw")
	playback.apply_next()
	assert_eq(playback.unit("mahmut").statuses, ["guard_up"] as Array[String])
	playback.apply_next()
	assert_eq(playback.unit("1-1:0:wolf:0").hp, 0)
	assert_false(playback.unit("1-1:0:wolf:0").alive)
	assert_eq(playback.unit("1-1:0:wolf:0").hp_fraction(), 0.0)


func test_an_enemy_joins_when_an_event_first_mentions_it() -> void:
	var playback: BattlePlayback = _small_battle()
	for _index: int in range(6):
		playback.apply_next()
	assert_false(playback.unit("1-1:1:wolf:0").on_field)
	var cues: Array[BattlePlayback.Cue] = playback.apply_next()
	assert_true(playback.unit("1-1:1:wolf:0").on_field)
	assert_eq(_kinds(cues)[0], BattlePlayback.CUE_JOIN)
	assert_eq(playback.field("enemy").size(), 2)


func test_the_last_event_reconciles_every_unit_with_the_engine() -> void:
	var playback: BattlePlayback = _small_battle()
	var last: Array[BattlePlayback.Cue] = []
	while not playback.is_finished():
		last = playback.apply_next()
	assert_eq(_kinds(last).back(), BattlePlayback.CUE_END)
	assert_eq(last.back().amount, 3, "the end cue carries the stars")
	assert_eq(last.back().text, "Victory!")
	assert_eq(playback.unit("mahmut").hp, 24)
	assert_eq(playback.unit("mahmut").focus, 2)
	assert_eq(playback.unit("mahmut").statuses.size(), 0, "final statuses replace the last reported ones")
	assert_eq(playback.drift, 1, "mahmut ended one HP below what the events showed (the fixture's final list says 24, the last hit left 25)")
	assert_true(playback.apply_next().is_empty(), "nothing after the end")


func test_a_hit_the_log_never_showed_counts_as_drift_and_is_corrected() -> void:
	var initial: Array[Dictionary] = [_unit("a", "player", 10), _unit("b", "enemy", 10)]
	var events: Array[Dictionary] = [{"type": "action_started", "actor_id": "a", "round": 1, "skill_id": "x", "action_type": "basic"}]
	var final_units: Array[Dictionary] = [
		{"entity_id": "a", "team": "player", "hp": 9, "max_hp": 10, "alive": true, "level": 1, "temporary": false, "focus": 0, "statuses": []},
		{"entity_id": "b", "team": "enemy", "hp": 10, "max_hp": 10, "alive": true, "level": 1, "temporary": false, "focus": 0, "statuses": []},
	]
	var playback: BattlePlayback = BattlePlayback.from_records(initial, initial, events, final_units, _registry, "defeat", 0)
	playback.skip_to_end()
	assert_eq(playback.drift, 1, "a skill that pays an HP cost has no event")
	assert_eq(playback.unit("a").hp, 9, "the final list wins")
	assert_eq(playback.log_lines.back(), "Defeat...")


func test_boss_events_track_phase_telegraph_and_objectives() -> void:
	var boss: String = "7-5:0:boss_x:0"
	var initial: Array[Dictionary] = [_unit("mahmut", "player", 30), _unit(boss, "enemy", 100, 0, {"is_boss": true, "enemy_id": "boss_x"}), _unit(boss + ":objective:chain", "enemy", 10, 1, {"is_objective": true, "objective_id": "chain"})]
	var events: Array[Dictionary] = [
		{"type": "boss_telegraph_started", "boss_id": boss, "action_id": "crown_fall", "phase_id": "frame", "round": 2},
		{"type": "boss_telegraph_held", "boss_id": boss, "action_id": "crown_fall", "round": 2},
		{"type": "boss_objective_destroyed", "boss_id": boss, "objective_id": "chain", "round": 3},
		{"type": "boss_telegraph_interrupted", "boss_id": boss, "action_id": "crown_fall", "round": 3},
		{"type": "boss_phase_changed", "boss_id": boss, "hp": 80, "max_hp": 90, "phase_id": "ward", "phase_index": 1, "round": 4},
		{"type": "boss_telegraph_resolved", "boss_id": boss, "action_id": "pulse", "round": 5},
	]
	var final_units: Array[Dictionary] = [
		{"entity_id": "mahmut", "team": "player", "hp": 30, "max_hp": 30, "alive": true, "level": 1, "temporary": false, "focus": 0, "statuses": []},
		{"entity_id": boss, "team": "enemy", "hp": 80, "max_hp": 90, "alive": true, "level": 1, "temporary": false, "focus": 0, "statuses": []},
		{"entity_id": boss + ":objective:chain", "team": "enemy", "hp": 0, "max_hp": 10, "alive": false, "level": 1, "temporary": false, "focus": 0, "statuses": []},
	]
	var playback: BattlePlayback = BattlePlayback.from_records(initial, initial, events, final_units, _registry, "victory", 3)
	assert_eq(playback.field("enemy").size(), 1, "an objective is part of the boss, not a separate enemy on the field")
	playback.apply_next()
	assert_eq(playback.telegraph_state, BattlePlayback.TELEGRAPH_CHARGING)
	assert_eq(playback.telegraph_action, "crown_fall")
	assert_eq(playback.boss_phase_id, "frame")
	playback.apply_next()
	assert_eq(playback.telegraph_state, BattlePlayback.TELEGRAPH_HELD)
	playback.apply_next()
	assert_false(playback.unit(boss + ":objective:chain").alive)
	assert_eq(playback.unit(boss + ":objective:chain").display_name, "chain")
	playback.apply_next()
	assert_eq(playback.telegraph_state, BattlePlayback.TELEGRAPH_INTERRUPTED)
	var changed: Array[BattlePlayback.Cue] = playback.apply_next()
	assert_eq(_kinds(changed), [BattlePlayback.CUE_PHASE] as Array[String])
	assert_eq(playback.boss_phase_index, 1)
	assert_eq(playback.unit(boss).max_hp, 90)
	assert_eq(playback.unit(boss).hp, 80)
	playback.apply_next()
	assert_eq(playback.telegraph_state, BattlePlayback.TELEGRAPH_RESOLVED)


func test_the_log_keeps_the_most_recent_lines_only() -> void:
	var initial: Array[Dictionary] = [_unit("a", "player", 10), _unit("b", "enemy", 10)]
	var events: Array[Dictionary] = []
	for _index: int in range(BattlePlayback.LOG_LIMIT + 25):
		events.append({"type": "action_started", "actor_id": "a", "round": 1, "skill_id": "x", "action_type": "basic"})
	var playback: BattlePlayback = BattlePlayback.from_records(initial, initial, events, [], _registry)
	playback.skip_to_end()
	assert_eq(playback.log_lines.size(), BattlePlayback.LOG_LIMIT)


func test_a_result_without_a_state_has_nothing_to_play() -> void:
	var playback: BattlePlayback = BattlePlayback.create(BattleService.BattleResult.new(), _registry)
	assert_true(playback.is_finished())
	assert_true(playback.apply_next().is_empty())


# -- real battles -----------------------------------------------------------------------------------------


func test_the_engine_records_the_units_on_the_field_before_the_first_event() -> void:
	var result: BattleService.BattleResult = _default_battle("1-1")
	assert_eq(result.error, "")
	var ids: Array[String] = []
	for record: Dictionary in result.initial_units:
		ids.append(str(record["entity_id"]))
		assert_eq(int(record["hp"]), int(record["max_hp"]), "everyone starts at full HP")
	assert_true(ids.has("mahmut") and ids.has("fadyme"))
	var first_wave: int = 0
	for entry: ContentModels.EnemyWaveEntry in _registry.stages["1-1"].enemy_waves[0]:
		first_wave += entry.count
	assert_eq(result.initial_units.size(), 2 + first_wave, "the two heroes plus every enemy of the first wave")
	var everyone: int = result.state.units.size()
	assert_gte(everyone, result.initial_units.size())


func test_every_story_battle_replays_to_the_engines_final_state() -> void:
	var stages_checked: int = 0
	var cues_total: int = 0
	var late_units_seen: int = 0
	for stage_id: String in _registry.stages:
		var result: BattleService.BattleResult = _default_battle(stage_id)
		assert_eq(result.error, "", stage_id)
		var playback: BattlePlayback = BattlePlayback.create(result, _registry)
		if result.state.units.size() > result.initial_units.size():
			late_units_seen += 1
			var waiting: int = 0
			for view: BattlePlayback.UnitView in playback.units:
				if not view.on_field:
					waiting += 1
			assert_gt(waiting, 0, "%s: later units start off the field" % stage_id)
		var damage_events: int = 0
		for event: Dictionary in result.state.battle_events:
			if event["type"] == "damage_dealt":
				damage_events += 1
		var damage_cues: int = 0
		var last_cursor: int = -1
		while not playback.is_finished():
			var cues: Array[BattlePlayback.Cue] = playback.apply_next()
			assert_gt(playback.cursor(), last_cursor, "%s: the cursor moves forward" % stage_id)
			last_cursor = playback.cursor()
			for cue: BattlePlayback.Cue in cues:
				cues_total += 1
				if cue.kind == BattlePlayback.CUE_DAMAGE or cue.kind == BattlePlayback.CUE_BLOCKED:
					damage_cues += 1
			for view: BattlePlayback.UnitView in playback.units:
				assert_lte(view.hp, view.max_hp, "%s: %s stays within its max HP" % [stage_id, view.entity_id])
				assert_gte(view.hp, 0)
		assert_eq(damage_cues, damage_events, "%s: every damage event is drawn" % stage_id)
		assert_eq(playback.drift, 0, "%s: event-tracked HP equals the engine's final HP" % stage_id)
		for record: Dictionary in result.final_units:
			var view: BattlePlayback.UnitView = playback.unit(str(record["entity_id"]))
			assert_not_null(view, "%s: %s is known to the replay" % [stage_id, record["entity_id"]])
			if view != null:
				assert_eq(view.hp, int(record["hp"]), "%s %s" % [stage_id, record["entity_id"]])
				assert_eq(view.alive, bool(record["alive"]))
		stages_checked += 1
	assert_eq(stages_checked, 35)
	# Part I has no multi-wave stage, so a unit that appears mid-battle (a summon) is the only way the join path meets real data.
	gut.p("replayed 35 story battles, %d cues, %d battles with units appearing after the start" % [cues_total, late_units_seen])
