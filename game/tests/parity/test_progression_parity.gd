extends GutTest
## G3.3: Progression reproduces parity/fixtures/{stats_characters,stats_enemies,stats_equipment,curves}.json
## (core/progression.py: stats, equipment levels, XP and cost curves, ascension, skill ranks, Memory Nodes).

var _registry: ContentModels.ContentRegistry = null
var _progression: Progression = null


func before_all() -> void:
	var loader: ContentLoader = ContentLoader.new()
	_registry = loader.load_dir("res://data/content")
	_progression = Progression.create(_registry)


func _int_map(map: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for key: String in map:
		result[key] = int(map[key])
	return result


func _dec_maps_match(actual: Dictionary, expected: Dictionary) -> String:
	for key: String in expected:
		if not actual.has(key):
			return "missing " + key
	for key: String in actual:
		if not expected.has(key):
			return "unexpected " + key
	for key: String in expected:
		var wanted: Dec = Dec.parse(String(expected[key]))
		if not (actual[key] as Dec).equals(wanted):
			return "%s: expected %s, got %s" % [key, expected[key], (actual[key] as Dec).to_text()]
	return ""


func test_character_stats_every_level() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("stats_characters")
	assert_eq(int(fixture["level_cap"]), _progression.character_level_cap())
	for case: Dictionary in fixture["cases"]:
		var character: ContentModels.Character = _registry.characters[String(case["character_id"])]
		var levels: Array = case["levels"]
		for index: int in range(levels.size()):
			var actual: Dictionary = _progression.base_stat_at_level(
				character.base_stats_level_1, character.growth_per_level, index + 1)
			assert_eq(_progression.error, "")
			assert_eq(actual, _int_map(levels[index]), "%s level %d" % [case["character_id"], index + 1])


func test_enemy_stats_every_level_and_multiplier() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("stats_enemies")
	for case: Dictionary in fixture["cases"]:
		var enemy: ContentModels.Enemy = _registry.enemies[String(case["enemy_id"])]
		var levels: Array = case["levels"]
		for index: int in range(levels.size()):
			var actual: Dictionary = _progression.enemy_stats_at_level(
				enemy.base_stats_level_1, enemy.growth_per_level, index + 1, float(case["multiplier"]))
			assert_eq(actual, _int_map(levels[index]), "%s x%s level %d" % [case["enemy_id"], case["multiplier"], index + 1])


func test_stages_use_the_recorded_enemy_level_and_multiplier() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("stats_enemies")
	for row: Dictionary in fixture["stages"]:
		var stage: ContentModels.Stage = _registry.stages[String(row["stage_id"])]
		assert_eq(stage.enemy_level, int(row["enemy_level"]), String(row["stage_id"]))
		assert_eq(stage.enemy_stat_multiplier, float(row["enemy_stat_multiplier"]), String(row["stage_id"]))
		assert_eq(stage.recommended_level, int(row["recommended_level"]), String(row["stage_id"]))


func test_weapon_and_armor_bonuses_every_level() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("stats_equipment")
	for case: Dictionary in fixture["cases"]:
		var item_id: String = String(case["item_id"])
		var row: Dictionary = {}
		if String(case["kind"]) == "weapon":
			var weapon: ContentModels.Weapon = _registry.weapons[item_id]
			row = {"base_stats_level_1": weapon.base_stats_level_1, "growth_per_level": weapon.growth_per_level}
		else:
			var armor: ContentModels.Armor = _registry.armors[item_id]
			row = {"base_stats_level_1": armor.base_stats_level_1, "growth_per_level": armor.growth_per_level}
		var levels: Array = case["levels"]
		for index: int in range(levels.size()):
			var equipped: Progression.EquippedItem = _progression.equipped_item_from_content(row, index + 1)
			assert_eq(_progression.error, "", "%s level %d" % [item_id, index + 1])
			assert_eq(_dec_maps_match(equipped.flat_stats, levels[index]["flat"]), "", "%s L%d flat" % [item_id, index + 1])
			assert_eq(_dec_maps_match(equipped.percent_stats, levels[index]["percent"]), "", "%s L%d percent" % [item_id, index + 1])


func _curves() -> Dictionary:
	return (ParityFixtures.load_fixture("curves")["cases"] as Array)[0]


func test_xp_and_cost_curves() -> void:
	var curves: Dictionary = _curves()
	assert_eq(_progression.character_level_cap(), int(curves["character_level_cap"]))
	for level: int in range(1, int(curves["character_level_cap"]) + 1):
		assert_eq(_progression.xp_to_next(level), int(curves["xp_to_next"][level - 1]), "xp_to_next %d" % level)
		assert_eq(_progression.level_up_silver_crowns_cost(level), int(curves["level_up_silver_crowns_cost"][level - 1]), "level up cost %d" % level)
		assert_eq(_progression.ascension_silver_crowns_cost(level), int(curves["ascension_silver_crowns_cost"][level - 1]), "ascension cost %d" % level)
		assert_eq(_progression.ascensions_required_for_level(level), int(curves["ascensions_required_for_level"][level - 1]), "gates %d" % level)
	for level: int in range(1, 20):
		assert_eq(_progression.account_xp_to_next(level), int(curves["account_xp_to_next"][level - 1]), "account xp %d" % level)
	for sample: Dictionary in curves["account_level_for_xp"]:
		assert_eq(_progression.account_level_for_xp(int(sample["total_xp"])), int(sample["level"]), "account level for %s xp" % sample["total_xp"])


func test_ascension_gates() -> void:
	var curves: Dictionary = _curves()
	for entry: Dictionary in curves["ascension_gates"]:
		var expected: Dictionary = entry.duplicate()
		expected.erase("character_level")
		expected.erase("account_level")
		var actual: Progression.AscensionRequirement = _progression.ascension_gate(int(entry["character_level"]), int(entry["account_level"]))
		assert_eq(ParityCompare.diff(actual, expected), "", "gate for level %s / account %s" % [entry["character_level"], entry["account_level"]])


func test_equipment_curves_and_milestones() -> void:
	var curves: Dictionary = _curves()
	var cap: int = int(curves["equipment_level_cap"])
	assert_eq(_progression.equipment_level_cap(), cap)
	for level: int in range(1, cap + 1):
		assert_eq(_progression.equipment_xp_to_next(level), int(curves["equipment_xp_to_next"][level - 1]), "equipment xp %d" % level)
		assert_eq(_progression.equipment_level_up_silver_crowns_cost(level), int(curves["equipment_level_up_silver_crowns_cost"][level - 1]), "equipment cost %d" % level)
		var expected_bonus: Dec = Dec.parse(String(curves["equipment_bonus_pct"][level - 1]))
		assert_true(_progression.equipment_bonus_pct(level).equals(expected_bonus), "bonus at %d" % level)
		var milestone: Progression.EquipmentMilestone = _progression.equipment_milestone_for_step(level)
		var expected_milestone: Variant = curves["equipment_milestone_for_step"][level - 1]
		if expected_milestone == null:
			assert_null(milestone, "no milestone at step %d" % level)
		else:
			assert_not_null(milestone, "milestone at step %d" % level)
			if milestone != null:
				assert_eq(milestone.from_level, int(expected_milestone["from_level"]))
				assert_eq(milestone.item_id, String(expected_milestone["item_id"]))
				assert_eq(milestone.item_quantity, int(expected_milestone["item_quantity"]))
				assert_true(milestone.bonus_pct.equals(Dec.parse(String(expected_milestone["bonus_pct"]))))


func test_skill_ranks() -> void:
	var curves: Dictionary = _curves()
	for entry: Dictionary in curves["skills"]:
		var skill_type: String = String(entry["skill_type"])
		var maximum: int = int(entry["max_rank"])
		assert_eq(_progression.skill_max_rank(skill_type), maximum, skill_type)
		var upgrades: Array = entry["upgrade_from_rank"]
		for index: int in range(upgrades.size()):
			var requirement: Progression.SkillUpgradeRequirement = _progression.skill_upgrade_requirement(skill_type, index + 1)
			if upgrades[index] == null:
				assert_null(requirement, "%s has no upgrade from rank %d" % [skill_type, index + 1])
			else:
				assert_eq(ParityCompare.diff(requirement, upgrades[index]), "", "%s rank %d upgrade" % [skill_type, index + 1])
		var multipliers: Array = entry["multiplier_by_rank"]
		for index: int in range(multipliers.size()):
			assert_almost_eq(_progression.skill_rank_multiplier(index + 1), float(multipliers[index]), 1e-12, "%s rank %d multiplier" % [skill_type, index + 1])


func test_memory_nodes() -> void:
	var expected: Array = _curves()["memory_nodes"]
	var nodes: Array[Progression.MemoryNode] = _progression.memory_nodes()
	assert_eq(_progression.error, "")
	assert_eq(nodes.size(), expected.size())
	for index: int in range(mini(nodes.size(), expected.size())):
		var row: Dictionary = expected[index]
		assert_eq(nodes[index].node, int(row["node"]))
		assert_eq(nodes[index].shard_cost, int(row["shard_cost"]))
		assert_eq(nodes[index].effect_type, String(row["effect_type"]))
		assert_eq(nodes[index].stat, "" if row["stat"] == null else String(row["stat"]))
		assert_true(nodes[index].value.equals(Dec.parse(String(row["value"]))), "node %d value" % (index + 1))


func test_invalid_inputs_fail_like_the_reference() -> void:
	var curves: Dictionary = _curves()
	var cap: int = int(curves["character_level_cap"])
	for entry: Dictionary in curves["errors"]:
		assert_not_null(entry["raises"], "the fixture only lists calls the reference rejects")
	_progression.base_stat_at_level({"hp": 10}, {"hp": 1}, 0)
	assert_ne(_progression.error, "", "level 0")
	_progression.base_stat_at_level({"hp": 10}, {"hp": 1}, -1)
	assert_ne(_progression.error, "", "level -1")
	_progression.base_stat_at_level({"hp": 10}, {"hp": 1}, cap + 1)
	assert_ne(_progression.error, "", "level above the cap")
	_progression.xp_to_next(0)
	assert_ne(_progression.error, "", "xp_to_next(0)")
	_progression.level_up_silver_crowns_cost(0)
	assert_ne(_progression.error, "", "level_up_silver_crowns_cost(0)")
	_progression.ascension_gate(cap + 1, 1)
	assert_ne(_progression.error, "", "ascension_gate above the cap")
	_progression.account_xp_to_next(0)
	assert_ne(_progression.error, "", "account_xp_to_next(0)")
	_progression.account_level_for_xp(-1)
	assert_ne(_progression.error, "", "account_level_for_xp(-1)")
	_progression.skill_rank_multiplier(0)
	assert_ne(_progression.error, "", "skill_rank_multiplier(0)")
	_progression.skill_max_rank("no_such_type")
	assert_ne(_progression.error, "", "unknown skill type")
	_progression.xp_to_next(1)
	assert_eq(_progression.error, "", "a valid call clears the error")
