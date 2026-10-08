extends GutTest
## Port of tests/test_rules_from_content.py: Focus numbers, victory-star tiers and boss control durations come from the
## battle_rules pack, not from literals; invalid rule blocks are rejected.

var _registry: ContentModels.ContentRegistry = null
var _service: BattleService = null


func before_all() -> void:
	_registry = BattleTestHelpers.registry()
	assert_not_null(_registry, "content must load")
	_service = BattleTestHelpers.service(_registry)


func _focus_block() -> Dictionary:
	return (_registry.battle_rules["focus"] as Dictionary).duplicate()


func _star_block() -> Dictionary:
	return (_registry.battle_rules["victory_stars"] as Dictionary).duplicate()


func _party_unit(entity_id: String, alive: bool, temporary: bool = false) -> BattleUnit:
	var unit: BattleUnit = BattleTestHelpers.make_unit(entity_id, "player", 0, 10, 1, 1, 1, "Stone", "front")
	unit.hp = 10 if alive else 0
	unit.alive = alive
	unit.temporary = temporary
	return unit


func test_content_focus_rules_equal_the_engine_defaults() -> void:
	# The defaults exist only for service-less unit tests; they must never drift from the authored numbers.
	var authored: FocusRules = FocusRules.from_mapping(_focus_block())
	var defaults: FocusRules = FocusRules.new()
	assert_eq(authored.error, "")
	for name: String in ["maximum", "basic_attack_gain", "active_skill_gain", "taking_hit_gain_per_hit",
			"taking_hit_gain_max_per_actor_turn", "ultimate_cost", "death_resets_focus"]:
		assert_eq(authored.get(name), defaults.get(name), name)


func test_focus_hit_gain_is_capped_per_actor_turn() -> void:
	var rules: FocusRules = FocusRules.new()
	var gains: Array = []
	for taken: int in [0, 5, 10, 12, 15]:
		gains.append(rules.hit_gain(taken))
	assert_eq(gains, [5, 5, 5, 3, 0])
	assert_eq([rules.action_gain("basic"), rules.action_gain("active"), rules.action_gain("ultimate")], [20, 25, 0])


func test_invalid_focus_rules_are_rejected() -> void:
	var bad: Dictionary = _focus_block()
	bad["basic_attack_gain"] = -1
	var rules: FocusRules = FocusRules.from_mapping(bad)
	assert_true(rules.error.contains("basic_attack_gain"), rules.error)
	for key: String in ["maximum", "ultimate_cost", "taking_hit_gain_per_hit"]:
		var fractional: Dictionary = _focus_block()
		fractional[key] = 1.5
		assert_true(FocusRules.from_mapping(fractional).error.contains(key), key)
	var missing: Dictionary = _focus_block()
	missing.erase("active_skill_gain")
	assert_true(FocusRules.from_mapping(missing).error.contains("active_skill_gain"))


func test_engine_actually_reads_focus_rules_from_the_content_pack() -> void:
	var altered: ContentModels.ContentRegistry = BattleTestHelpers.registry()
	var focus: Dictionary = altered.battle_rules["focus"]
	focus["basic_attack_gain"] = 0
	focus["active_skill_gain"] = 0
	focus["taking_hit_gain_per_hit"] = 0
	var story: StoryState = StoryState.new(altered, StoryState.load_manifest("res://data/content"))
	var stock_service: BattleService = BattleTestHelpers.service(_registry)
	var no_gain_service: BattleService = BattleService.create(altered, story)
	var stock: BattleService.BattleResult = stock_service.run("1-1", [], {"story_state": stock_service.story.new_player_state(), "run_seed": 4})
	var no_gain: BattleService.BattleResult = no_gain_service.run("1-1", [], {"story_state": story.new_player_state(), "run_seed": 4})
	assert_eq(stock.error, "")
	assert_eq(no_gain.error, "")
	# Authored gain_focus effects can still grant Focus, so compare totals.
	assert_lt(_player_focus(no_gain), _player_focus(stock))


func _player_focus(result: BattleService.BattleResult) -> int:
	var total: int = 0
	for unit: Dictionary in result.final_units:
		if unit["team"] == "player":
			total += int(unit["focus"])
	return total


func test_victory_stars_follow_authored_tiers() -> void:
	var stars: VictoryStarRules = VictoryStarRules.from_mapping(_star_block())
	assert_eq(stars.error, "")
	var team: Array = [_party_unit("a", true), _party_unit("b", true), _party_unit("c", true)]
	assert_eq(stars.stars("victory", team), 3)
	(team[0] as BattleUnit).alive = false
	assert_eq(stars.stars("victory", team), 2)
	(team[1] as BattleUnit).alive = false
	assert_eq(stars.stars("victory", team), 1)
	assert_eq(stars.stars("defeat", team), 0)


func test_loaned_heroes_flag_is_honored() -> void:
	var block: Dictionary = _star_block()
	block["loaned_story_heroes_count_as_selected_heroes"] = false
	var stars: VictoryStarRules = VictoryStarRules.from_mapping(block)
	var team: Array = [_party_unit("owned", true), _party_unit("guest", false, true)]
	assert_eq(stars.stars("victory", team), 3)


func test_unknown_star_condition_fails_fast() -> void:
	var block: Dictionary = _star_block()
	block["two_stars"] = "half_the_party_alive"
	var stars: VictoryStarRules = VictoryStarRules.from_mapping(block)
	assert_true(stars.error.contains("two_stars"), stars.error)


func _boss_state(control_rules: Variant) -> Array:
	var enemy: ContentModels.Enemy = ContentModels.Enemy.new()
	enemy.enemy_id = "boss"
	if control_rules != null:
		enemy.extra = {"control_rules": control_rules}
	var boss: BattleUnit = BattleTestHelpers.make_unit("boss", "enemy", 0)
	var state: EncounterState = EncounterState.create([boss] as Array[BattleUnit], _service, _registry.stages["1-5"], {"boss": enemy})
	return [state, boss]


func test_boss_control_duration_uses_per_enemy_rules() -> void:
	var interpreter: EffectInterpreter = BattleTestHelpers.interpreter(_registry)
	var rules: Dictionary = {"control_duration_multiplier": 0.5, "control_duration_rounding": "minimum_one_turn",
		"blanket_control_immunity": false}
	var built: Array = _boss_state(rules)
	# Historical behavior preserved: ceil(d * 0.5), minimum 1 for positive d.
	var scaled: Array = []
	for duration: int in [0, 1, 2, 3, 4, 5]:
		scaled.append(interpreter._boss_control_duration(built[0], built[1], duration))
	assert_eq(scaled, [0, 1, 1, 2, 2, 3])
	var full: Dictionary = rules.duplicate()
	full["control_duration_multiplier"] = 1.0
	var full_built: Array = _boss_state(full)
	assert_eq(interpreter._boss_control_duration(full_built[0], full_built[1], 3), 3)
	assert_eq(interpreter.error, "")


func test_boss_control_falls_back_to_global_multiplier_and_honors_immunity() -> void:
	var interpreter: EffectInterpreter = BattleTestHelpers.interpreter(_registry)
	var plain: Array = _boss_state(null)
	assert_eq(float(interpreter.rules["targeting"]["boss_control_duration_multiplier"]), 0.5)
	assert_eq(interpreter._boss_control_duration(plain[0], plain[1], 4), 2)
	var immune: Array = _boss_state({"blanket_control_immunity": true})
	assert_eq(interpreter._boss_control_duration(immune[0], immune[1], 4), -1, "fully immune (None in the reference)")
	assert_eq(interpreter.error, "")
	var odd: Array = _boss_state({"control_duration_rounding": "round_half_even"})
	interpreter._boss_control_duration(odd[0], odd[1], 3)
	assert_true(interpreter.error.contains("control_duration_rounding"), interpreter.error)
	var negative: Array = _boss_state({"control_duration_multiplier": -1})
	var fresh: EffectInterpreter = BattleTestHelpers.interpreter(_registry)
	fresh._boss_control_duration(negative[0], negative[1], 3)
	assert_true(fresh.error.contains("multiplier"), fresh.error)


func test_every_authored_boss_has_supported_control_rules() -> void:
	var bosses: Array[ContentModels.Enemy] = []
	for enemy: ContentModels.Enemy in _registry.enemies.values():
		if not enemy.boss_id.is_empty():
			bosses.append(enemy)
	assert_false(bosses.is_empty())
	for enemy: ContentModels.Enemy in bosses:
		var rules: Dictionary = enemy.extra.get("control_rules", {})
		assert_eq(rules.get("control_duration_rounding", "minimum_one_turn"), "minimum_one_turn", enemy.enemy_id)


func test_defeated_units_end_the_battle_with_zero_focus() -> void:
	var owned: StoryState.PlayerStoryState = _service.story.new_player_state()
	owned.owned_character_ids = {"mahmut": true, "fadyme": true, "brin_alder": true, "nixie_vale": true, "jori_flint": true}
	var roster: Array = owned.owned_character_ids.keys()
	roster.sort()
	var defeated: Array[Dictionary] = []
	for seed_value: int in range(6):
		var result: BattleService.BattleResult = _service.run("6-5", roster, {"story_state": owned, "run_seed": seed_value})
		assert_eq(result.error, "")
		for unit: Dictionary in result.final_units:
			if not unit["alive"]:
				defeated.append(unit)
	assert_false(defeated.is_empty(), "setup expects some defeated units")
	for unit: Dictionary in defeated:
		assert_eq(unit["focus"], 0, str(unit["entity_id"]))


func test_death_resets_focus_can_be_disabled_by_content() -> void:
	var block: Dictionary = _focus_block()
	block["death_resets_focus"] = false
	var rules: FocusRules = FocusRules.from_mapping(block)
	assert_eq(rules.error, "")
	assert_false(rules.death_resets_focus)
	block["death_resets_focus"] = "yes"
	assert_true(FocusRules.from_mapping(block).error.contains("death_resets_focus"))
