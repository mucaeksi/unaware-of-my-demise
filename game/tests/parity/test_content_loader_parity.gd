extends GutTest
## G3.2: ContentLoader builds the same registry as core.content_loader (parity/fixtures/content_registry.json)
## and rejects broken content with the reference's messages (content_errors.json).

const CONTENT_DIR: String = "res://data/content"

var _registry: ContentModels.ContentRegistry = null
var _load_error: String = ""


func before_all() -> void:
	var loader: ContentLoader = ContentLoader.new()
	_registry = loader.load_dir(CONTENT_DIR)
	_load_error = loader.error


func _packs() -> Dictionary:
	var packs: Dictionary = {}
	for file_name: String in ContentLoader.PACK_FILES:
		packs[file_name] = JSON.parse_string(FileAccess.get_file_as_string(CONTENT_DIR.path_join(file_name)))
	return packs


func test_the_shipped_content_loads() -> void:
	assert_eq(_load_error, "", "no ContentLoadError for the shipped packs")
	assert_not_null(_registry)


func test_record_counts_match_the_reference() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("content_registry")
	var counts: Dictionary = fixture["counts"]
	for table: String in counts:
		var actual: Dictionary = _registry.get(table)
		assert_eq(actual.size(), int(counts[table]), table + " count")


func test_every_record_table_matches_the_reference_field_by_field() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("content_registry")
	for table: String in fixture["counts"]:
		var expected_rows: Array = fixture[table]
		var actual: Dictionary = _registry.get(table)
		var keys: Array = actual.keys()
		assert_eq(keys.size(), expected_rows.size(), table + " size")
		for index: int in range(mini(keys.size(), expected_rows.size())):
			var row: Dictionary = expected_rows[index]
			assert_eq(String(keys[index]), String(row["id"]), "%s order at %d" % [table, index])
			var found: String = ParityCompare.diff(actual[keys[index]], row["record"], "%s[%s]" % [table, row["id"]])
			assert_eq(found, "", table + " " + String(row["id"]))
			if not found.is_empty():
				return


func test_catalogs_match_the_reference() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("content_registry")
	var catalogs: Dictionary = fixture["catalogs"]
	for name: String in catalogs:
		var found: String = ParityCompare.diff(_registry.get(name), catalogs[name], name)
		assert_eq(found, "", "catalog " + name)


func test_effect_operation_parameters_keep_their_numbers() -> void:
	# A spot check that reads like the battle code will: a typed record, a parameter map, a stage multiplier.
	var stage: ContentModels.Stage = _registry.stages["1-1"]
	assert_eq(stage.enemy_stat_multiplier, 1.0, "the tutorial stage keeps authored enemy stats")
	assert_eq(_registry.stages["1-2"].enemy_stat_multiplier, 2.5, "the owner's x2.5 difficulty decision")
	var skill: ContentModels.Skill = _registry.skills["mahmut_basic_oathless_cut"]
	assert_gt(skill.effect_ops.size(), 0)
	assert_eq(skill.effect_ops[0].op, "damage")


func _apply(document: Variant, mutation: Dictionary) -> Variant:
	var op: String = String(mutation["op"])
	if op == "replace_root":
		return mutation["value"]
	var path: Array = mutation["path"]
	var parent: Variant = document
	for step_index: int in range(path.size() - 1):
		parent = _step(parent, path[step_index])
	var key: Variant = path[path.size() - 1]
	match op:
		"set":
			_assign(parent, key, mutation["value"])
		"delete":
			(parent as Dictionary).erase(key)
		"append_copy":
			(parent as Array).append(_step(parent, key).duplicate(true))
		_:
			fail_test("unknown mutation op " + op)
	return document


func _step(container: Variant, key: Variant) -> Variant:
	if container is Array:
		return (container as Array)[int(key)]
	return (container as Dictionary)[key]


func _assign(container: Variant, key: Variant, value: Variant) -> void:
	if container is Array:
		(container as Array)[int(key)] = value
	else:
		(container as Dictionary)[key] = value


func test_broken_content_fails_with_the_reference_message() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("content_errors")
	var cases: Array = fixture["cases"]
	assert_gt(cases.size(), 40, "the error fixture is present")
	for case: Dictionary in cases:
		var packs: Dictionary = _packs()
		var pack_name: String = String(case["pack"])
		var document: Variant = packs[pack_name]
		for mutation: Dictionary in case["mutations"]:
			document = _apply(document, mutation)
		packs[pack_name] = document
		var loader: ContentLoader = ContentLoader.new()
		var registry: ContentModels.ContentRegistry = loader.load_packs(packs)
		assert_null(registry, "%s must not load" % case["name"])
		assert_eq(loader.error, String(case["error"]), String(case["name"]))


func test_absent_optional_fields_take_the_reference_defaults() -> void:
	# The real content spells every field out, so the default paths need their own check.
	var packs: Dictionary = _packs()
	var hero: Dictionary = (packs["characters_part1.json"]["characters"] as Array)[0]
	var skill: Dictionary = (hero["skills"] as Array)[0]
	for field: String in ["cooldown_turns", "focus_cost", "multipliers_pct", "event_hooks", "continuous_modifiers",
			"phase_ids", "telegraph_rules", "element", "auto_priority", "multiplier"]:
		skill.erase(field)
	var stage: Dictionary = (packs["stages_part1.json"]["stages"] as Array)[1]
	stage.erase("enemy_stat_multiplier")
	stage.erase("guest_characters")
	stage.erase("boss_id")
	var loader: ContentLoader = ContentLoader.new()
	var registry: ContentModels.ContentRegistry = loader.load_packs(packs)
	assert_eq(loader.error, "")
	var loaded: ContentModels.Skill = registry.skills[String(skill["skill_id"])]
	assert_eq(loaded.cooldown_turns, 0)
	assert_eq(loaded.focus_cost, 0)
	assert_eq(loaded.multipliers_pct.size(), 0)
	assert_eq(loaded.event_hooks.size(), 0)
	assert_eq(loaded.continuous_modifiers.size(), 0)
	assert_eq(loaded.phase_ids.size(), 0)
	assert_eq(loaded.telegraph_rules.size(), 0)
	assert_eq(loaded.element, "")
	assert_null(loaded.auto_priority)
	assert_null(loaded.multiplier)
	var loaded_stage: ContentModels.Stage = registry.stages[String(stage["stage_id"])]
	assert_eq(loaded_stage.enemy_stat_multiplier, 1.0)
	assert_eq(loaded_stage.guest_characters.size(), 0)
	assert_eq(loaded_stage.boss_id, "")


func test_a_missing_pack_directory_reports_an_error() -> void:
	var loader: ContentLoader = ContentLoader.new()
	assert_null(loader.load_dir("res://data/does_not_exist"))
	assert_true(loader.error.begins_with("characters_part1.json: unable to read valid UTF-8 JSON"), loader.error)
