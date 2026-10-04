extends GutTest
## Ports of the positive shape tests of tests/test_content_loader.py and tests/test_equipment_weapon_types.py. The whole
## registry (every record, every field) is compared against the reference in test_content_loader_parity.gd; these tests
## pin the well-known landmarks so a wrong fixture regeneration cannot pass silently.

var _registry: ContentModels.ContentRegistry = null


func before_all() -> void:
	_registry = BattleTestHelpers.registry()
	assert_not_null(_registry, "content must load")


func test_loads_all_catalogs_as_stable_id_indexes() -> void:
	assert_eq(_registry.characters.size(), 20)
	assert_eq(_registry.enemies.size(), 27)
	assert_eq(_registry.weapons.size(), 180)
	assert_eq(_registry.armors.size(), 36)
	assert_eq(_registry.accessories.size(), 42)
	assert_eq(_registry.items.size(), 18)
	assert_eq(_registry.stages.size(), 35)
	assert_true(_registry.statuses.has("burn"))
	assert_true(_registry.characters["mahmut"] is ContentModels.Character)
	assert_true(_registry.enemies["ash_wolf"] is ContentModels.Enemy)
	assert_true(_registry.stages["1-1"] is ContentModels.Stage)


func test_mahmut_has_four_typed_skills_and_resolved_signature() -> void:
	var mahmut: ContentModels.Character = _registry.characters["mahmut"]
	assert_eq(mahmut.skills.size(), 4)
	assert_true(_registry.weapons.has(mahmut.signature_weapon_id))
	assert_eq(mahmut.equip_weapon_type, _registry.weapons[mahmut.signature_weapon_id].weapon_type)
	assert_same(_registry.skills[mahmut.skills[0].skill_id], mahmut.skills[0])
	for skill: ContentModels.Skill in mahmut.skills:
		for op: ContentModels.EffectOp in skill.effect_ops:
			assert_false(op.op.is_empty())


func test_eclipse_construct_has_two_typed_phases_and_objectives() -> void:
	var boss: ContentModels.Enemy = _registry.enemies["boss_eclipse_construct"]
	assert_eq(boss.phases.size(), 2)
	assert_gt(boss.phases[0].objectives.size(), 0)
	assert_eq(boss.phases[1].phase_id, "aether_ward")
	assert_true(_registry.boss_objectives.has("altar_pylon_center"))


func test_stage_enemy_and_drop_table_references_are_resolved() -> void:
	var final_stage: ContentModels.Stage = _registry.stages["7-5"]
	var wave_enemy_ids: Dictionary = {}
	for wave: Array in final_stage.enemy_waves:
		for entry: ContentModels.EnemyWaveEntry in wave:
			wave_enemy_ids[entry.enemy_id] = true
	assert_true(wave_enemy_ids.has("boss_eclipse_construct"))
	for enemy_id: String in wave_enemy_ids:
		assert_true(_registry.enemies.has(enemy_id), enemy_id)
	assert_true(_registry.drop_tables.has(final_stage.drop_table_id))


func test_every_character_weapon_type_matches_signature_catalog() -> void:
	assert_eq(_registry.characters.size(), 20)
	for character: ContentModels.Character in _registry.characters.values():
		assert_true(_registry.weapon_types.has(character.equip_weapon_type), character.character_id)
		assert_eq(character.equip_weapon_type, _registry.weapons[character.signature_weapon_id].weapon_type, character.character_id)
