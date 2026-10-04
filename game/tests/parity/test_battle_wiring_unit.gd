extends GutTest
## Port of the battle-engine parts of tests/test_battle_progression_wiring.py: saved levels and equipped gear reach the
## engine, invalid loadouts are rejected. The GameController parts (inventory views, equip/unequip, quest status, skill
## upgrade previews) belong to the save layer and the screens, ported in G4/G5.

var _registry: ContentModels.ContentRegistry = null
var _service: BattleService = null


func before_all() -> void:
	_registry = BattleTestHelpers.registry()
	assert_not_null(_registry, "content must load")
	_service = BattleTestHelpers.service(_registry)


func _unit(result: BattleService.BattleResult, character_id: String) -> BattleUnit:
	for unit: BattleUnit in result.state.units:
		if unit.entity_id == character_id:
			return unit
	fail_test("no unit " + character_id)
	return null


func _run(options: Dictionary) -> BattleService.BattleResult:
	var merged: Dictionary = {"story_state": _service.story.new_player_state(), "run_seed": 3}
	merged.merge(options, true)
	return _service.run("1-1", [], merged)


func _numeric_stats(record_stats: Dictionary) -> Dictionary:
	var out: Dictionary = {}
	for key: String in record_stats:
		if not (record_stats[key] is String):
			out[key] = record_stats[key]
	return out


func test_saved_level_10_changes_battle_stats_with_same_seed() -> void:
	var level_one: Dictionary = _unit(_run({"run_seed": 5}), "mahmut").stats
	var level_ten: Dictionary = _unit(_run({"run_seed": 5, "player_levels": {"mahmut": 10}}), "mahmut").stats
	var character: ContentModels.Character = _registry.characters["mahmut"]
	var expected: Dictionary = _service.progression.base_stat_at_level(character.base_stats_level_1, character.growth_per_level, 10)
	assert_eq(var_to_str(level_ten), var_to_str(expected))
	assert_ne(var_to_str(level_ten), var_to_str(level_one))
	assert_gt(int(level_ten["hp"]), int(level_one["hp"]))


func test_equipped_weapon_reaches_battle_and_partial_loadout_is_valid() -> void:
	var bare: Dictionary = _unit(_run({}), "mahmut").stats
	var loadout: Dictionary = {"weapon_id": "weapon_arming_sword_4_01", "weapon_level": 1, "armor_id": null,
		"accessory_ids": [], "rolled_accessories": []}
	var result: BattleService.BattleResult = _run({"equipment": {"mahmut": loadout}})
	assert_eq(result.error, "")
	var armed: Dictionary = _unit(result, "mahmut").stats
	assert_gt(int(armed["atk"]), int(bare["atk"]))
	# Partial loadout (weapon only) is valid: no armor/accessory contribution.
	assert_eq(armed["hp"], bare["hp"])


func test_item_level_scales_weapon_contribution() -> void:
	var stats: Dictionary = {}
	for level: int in [1, 20]:
		var loadout: Dictionary = {"weapon_id": "weapon_arming_sword_4_01", "weapon_level": level}
		var result: BattleService.BattleResult = _run({"equipment": {"mahmut": loadout}})
		assert_eq(result.error, "")
		stats[level] = _unit(result, "mahmut").stats
	assert_gte(int(stats[20]["atk"]), int(stats[1]["atk"]))
	var weapon: ContentModels.Weapon = _registry.weapons["weapon_arming_sword_4_01"]
	var numeric: Dictionary = _numeric_stats(weapon.base_stats_level_1)
	var grown: Dictionary = _service.progression.base_stat_at_level(numeric, weapon.growth_per_level, 20)
	var base: Dictionary = _service.progression.base_stat_at_level(numeric, weapon.growth_per_level, 1)
	assert_eq(int(stats[20]["atk"]) > int(stats[1]["atk"]), int(grown["atk"]) > int(base["atk"]))


func test_set_bonus_needs_both_accessories() -> void:
	var empty_roll: Dictionary = {"main_stat": null, "sub_stats": []}
	var stats_with: Callable = func(accessory_ids: Array) -> Dictionary:
		var rolls: Array = []
		for _id: Variant in accessory_ids:
			rolls.append(empty_roll)
		var loadout: Dictionary = {"weapon_id": null, "accessory_ids": accessory_ids, "rolled_accessories": rolls}
		var result: BattleService.BattleResult = _run({"equipment": {"mahmut": loadout}})
		assert_eq(result.error, "")
		return _unit(result, "mahmut").stats
	var bare: Dictionary = stats_with.call([])
	var ring_only: Dictionary = stats_with.call(["accessory_ash_maw_hide_ring_4"])
	var both: Dictionary = stats_with.call(["accessory_ash_maw_hide_necklace_4", "accessory_ash_maw_hide_ring_4"])
	assert_eq(var_to_str(ring_only), var_to_str(bare), "empty rolls + no set bonus -> no change")
	# Pinned reference defect (parity/README.md, "Reference behavior" 1): the set bonus keeps its `_pct` key and lands
	# as a junk `hp_pct: 0` stat, so `both != bare` holds only because of that key; the real stat is unchanged.
	assert_ne(var_to_str(both), var_to_str(bare), "both set pieces add the (junk) set-bonus key")


func test_invalid_partial_loadouts_are_rejected() -> void:
	var too_many: BattleService.BattleResult = _run({"run_seed": 1, "equipment": {"mahmut": {
		"weapon_id": null,
		"accessory_ids": ["accessory_ash_maw_hide_ring_4", "accessory_ash_maw_hide_ring_3"]}}})
	assert_true(too_many.error.contains("at most one necklace and one ring"), too_many.error)
	var wrong_type: BattleService.BattleResult = _run({"run_seed": 1, "equipment": {"mahmut": {"weapon_id": "weapon_bell_focus_3_01"}}})
	assert_true(wrong_type.error.contains("cannot equip"), wrong_type.error)
