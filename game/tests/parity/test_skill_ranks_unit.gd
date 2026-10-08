extends GutTest
## Port of the pure-rule and battle-engine parts of tests/test_skill_ranks_and_nodes.py (owner-approved draft_v1). The
## service half of that file (upgrade_skill / unlock_memory_node over the SQLite repository) is ported with the save
## layer in G5.

const BASIC: String = "mahmut_basic_oathless_cut"

var _registry: ContentModels.ContentRegistry = null
var _service: BattleService = null
var _active: String = ""


func before_all() -> void:
	_registry = BattleTestHelpers.registry()
	assert_not_null(_registry, "content must load")
	_service = BattleTestHelpers.service(_registry)
	for skill: ContentModels.Skill in _registry.characters["mahmut"].skills:
		if skill.type == "active" and _active.is_empty():
			_active = skill.skill_id


func _new_story() -> StoryState.PlayerStoryState:
	return _service.story.new_player_state()


func _run(options: Dictionary = {}) -> BattleService.BattleResult:
	var merged: Dictionary = {"story_state": _new_story(), "run_seed": 5}
	merged.merge(options, true)
	var result: BattleService.BattleResult = _service.run("1-1", [], merged)
	assert_eq(result.error, "")
	return result


## Player units exactly as they stand when the encounter is ready: id -> [focus, max_hp, stats, skill_ranks, temporary].
func _opening_units(stage_id: String, roster: Array, story: StoryState.PlayerStoryState, options: Dictionary = {}) -> Dictionary:
	var snapshot: Dictionary = {}
	var capture: Callable = func(state: BattleState) -> void:
		for unit: BattleUnit in state.units:
			if unit.team == "player":
				snapshot[unit.entity_id] = [unit.focus, unit.max_hp, unit.stats.duplicate(), unit.skill_ranks.duplicate(), unit.temporary]
	var merged: Dictionary = {"story_state": story, "run_seed": 3, "on_encounter_ready": capture}
	merged.merge(options, true)
	var result: BattleService.BattleResult = _service.run(stage_id, roster, merged)
	assert_eq(result.error, "")
	return snapshot


# -- pure rules ---------------------------------------------------------------


func test_rank_multiplier_and_requirements_come_from_content() -> void:
	var progression: Progression = _service.progression
	var multipliers: Array[float] = []
	for rank: int in [1, 2, 3]:
		multipliers.append(progression.skill_rank_multiplier(rank))
	assert_eq(multipliers, [1.0, 1.1, 1.2] as Array[float])
	var maximums: Dictionary = {}
	for skill_type: String in ["basic", "active", "passive", "ultimate"]:
		maximums[skill_type] = progression.skill_max_rank(skill_type)
	assert_eq(maximums, {"basic": 3, "active": 3, "passive": 2, "ultimate": 3})
	var need: Progression.SkillUpgradeRequirement = progression.skill_upgrade_requirement("ultimate", 2)
	assert_eq([need.to_rank, need.required_character_level, need.item_id], [3, 20, "hymn_leaves"])
	assert_null(progression.skill_upgrade_requirement("passive", 2))
	assert_eq(progression.skill_upgrade_requirement("basic", 1).item_id, "")


func test_memory_nodes_cost_140_shards_in_total() -> void:
	var nodes: Array[Progression.MemoryNode] = _service.progression.memory_nodes()
	var total: int = 0
	for node: Progression.MemoryNode in nodes:
		total += node.shard_cost
	assert_eq(total, 140)
	assert_eq(nodes[nodes.size() - 1].effect_type, "start_focus")


# -- engine -------------------------------------------------------------------


func test_rank_one_and_missing_ranks_are_byte_identical() -> void:
	var plain: BattleService.BattleResult = _run()
	var explicit: BattleService.BattleResult = _run({"skill_ranks": {"mahmut": {BASIC: 1, _active: 1}}})
	assert_eq(var_to_str(plain.state.battle_events), var_to_str(explicit.state.battle_events))
	assert_eq(var_to_str(plain.final_units), var_to_str(explicit.final_units))


func test_higher_rank_scales_damage_ops_of_that_skill() -> void:
	var interpreter: EffectInterpreter = _service.interpreter
	var skill: ContentModels.Skill = _registry.skills[BASIC]
	var ops: Array = []
	for op: ContentModels.EffectOp in skill.effect_ops:
		ops.append(op)
	var validated: Array[Dictionary] = interpreter.validate_effect_ops(ops)
	assert_eq(interpreter.error, "")
	var mahmut: BattleUnit = BattleTestHelpers.make_unit("mahmut", "player", 0)
	var base_multipliers: Array = []
	for op: Dictionary in interpreter._apply_skill_rank(validated, mahmut, BASIC):
		if op["op"] == "damage":
			base_multipliers.append(op["multiplier"])
	mahmut.skill_ranks = {BASIC: 3}
	var ranked_multipliers: Array = []
	for op: Dictionary in interpreter._apply_skill_rank(validated, mahmut, BASIC):
		if op["op"] == "damage":
			ranked_multipliers.append(op["multiplier"])
	assert_false(base_multipliers.is_empty(), "the basic attack has a damage op")
	assert_almost_eq(float(ranked_multipliers[0]), float(base_multipliers[0]) * 1.2, 1e-12)
	# Another skill id is not scaled by the rank of BASIC.
	var other: Array[Dictionary] = interpreter._apply_skill_rank(validated, mahmut, _active)
	assert_eq(var_to_str(other), var_to_str(validated))


func test_story_loan_units_never_carry_ranks_or_nodes() -> void:
	# kera_voss is a temporary story loan on 1-3.
	var owned: StoryState.PlayerStoryState = _new_story()
	owned.completed_stage_ids = {"1-1": true, "1-2": true}
	owned.owned_character_ids = {"mahmut": true, "fadyme": true, "brin_alder": true, "tilda_fen": true}
	var roster: Array = ["mahmut", "fadyme", "brin_alder", "tilda_fen"]
	var plain: Dictionary = _opening_units("1-3", roster, owned)
	var ranked: Dictionary = _opening_units("1-3", roster, owned,
		{"skill_ranks": {"kera_voss": {"x": 3}}, "memory_nodes": {"kera_voss": 6}})
	assert_true(plain["kera_voss"][4], "kera_voss is really a loan")
	assert_eq(var_to_str(ranked["kera_voss"]), var_to_str(plain["kera_voss"]))
	assert_eq(ranked["kera_voss"][3], {})
	assert_eq(ranked["kera_voss"][0], 0)


func test_memory_nodes_raise_stats_and_grant_opening_focus() -> void:
	var story: StoryState.PlayerStoryState = _new_story()
	var plain: Array = _opening_units("1-1", [], story)["mahmut"]
	var nodes: Array = _opening_units("1-1", [], story, {"memory_nodes": {"mahmut": 6}})["mahmut"]
	assert_eq(plain[0], 0)
	assert_eq(nodes[0], 10, "node 6: +10 opening Focus")
	assert_gte(nodes[1], plain[1])
	assert_gte(int(nodes[2]["atk"]), int(plain[2]["atk"]))
	var plain_keys: Array = plain[2].keys()
	var node_keys: Array = nodes[2].keys()
	plain_keys.sort()
	node_keys.sort()
	assert_eq(node_keys, plain_keys, "no stat keys invented (e.g. a zero res)")
	var only_two: Array = _opening_units("1-1", [], story, {"memory_nodes": {"mahmut": 2}})["mahmut"]
	assert_eq(only_two[0], 0, "Focus node not unlocked")


func test_only_unlocked_nodes_apply() -> void:
	var stats: Dictionary = {"hp": 100, "atk": 100, "def": 100, "res": 100, "spd": 100}
	var two: Array = _service.apply_memory_nodes(stats, 2)
	assert_eq(two[0]["hp"], 102)
	assert_eq(two[0]["atk"], 102)
	assert_eq(two[0]["def"], 100)
	assert_eq(two[1], 0)
	var six: Array = _service.apply_memory_nodes(stats, 6)
	assert_eq(six[0]["res"], 103)
	assert_eq(six[1], 10)
