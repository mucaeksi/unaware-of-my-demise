extends GutTest
## G3.6: BattleService equipment resolution reproduces parity/fixtures/loadouts.json (BattleService._resolve_equipment,
## _apply_memory_nodes) and story_loans.json (the deterministic 3-star field kit of every story guest).

var _registry: ContentModels.ContentRegistry = null
var _service: BattleService = null


func before_all() -> void:
	var loader: ContentLoader = ContentLoader.new()
	_registry = loader.load_dir("res://data/content")
	var story: StoryState = StoryState.new(_registry, StoryState.load_manifest("res://data/content"))
	_service = BattleService.create(_registry, story)


func _case() -> Dictionary:
	return (ParityFixtures.load_fixture("loadouts")["cases"] as Array)[0]


func test_service_is_ready() -> void:
	assert_eq(_service.error, "")


func test_resolved_stats_for_every_character_level_and_loadout() -> void:
	var rows: Array = _case()["resolve"]
	assert_eq(rows.size(), 20 * 3 * 7, "20 characters x levels 1/10/20 x 7 loadouts")
	for row: Dictionary in rows:
		var character: ContentModels.Character = _registry.characters[String(row["character_id"])]
		_service.error = ""
		var stats: Dictionary = _service.resolve_equipment(character, row["base"], row["loadout"])
		var label: String = "%s L%s %s" % [row["character_id"], row["level"], row["loadout_name"]]
		assert_eq(_service.error, "", label)
		assert_eq(ParityCompare.diff(stats, row["stats"]), "", label)


func test_rejected_loadouts() -> void:
	var rows: Array = _case()["invalid"]
	assert_eq(rows.size(), 4)
	for row: Dictionary in rows:
		var character: ContentModels.Character = _registry.characters[String(row["character_id"])]
		_service.error = ""
		var stats: Dictionary = _service.resolve_equipment(character, {"hp": 10}, row["loadout"])
		assert_ne(_service.error, "", "%s must be rejected (%s in the reference)" % [row["loadout_name"], row["raises"]])
		assert_eq(stats.size(), 0)


func test_memory_nodes() -> void:
	var rows: Array = _case()["memory_nodes"]
	assert_eq(rows.size(), 20 * 5)
	for row: Dictionary in rows:
		_service.error = ""
		var applied: Array = _service.apply_memory_nodes(row["base"], int(row["unlocked"]))
		var label: String = "%s with %s nodes" % [row["character_id"], row["unlocked"]]
		assert_eq(_service.error, "", label)
		assert_eq(ParityCompare.diff(applied[0], row["stats"]), "", label + " stats")
		assert_eq(int(applied[1]), int(row["start_focus"]), label + " start focus")


func test_story_loan_kits() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("story_loans")
	var cases: Array = fixture["cases"]
	assert_eq(cases.size(), 66)
	for row: Dictionary in cases:
		var character: ContentModels.Character = _registry.characters[String(row["character_id"])]
		_service.error = ""
		var loadout: Dictionary = _service.story_loan_loadout(character, String(row["stage_id"]))
		var label: String = "%s at %s" % [row["character_id"], row["stage_id"]]
		assert_eq(_service.error, "", label)
		assert_eq(ParityCompare.diff(loadout, row["loadout"]), "", label)
