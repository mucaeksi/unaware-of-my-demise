extends GutTest
const Tutorial = preload("res://scripts/ui/entry/tutorial_battle.gd")
const Live = preload("res://scripts/core/battle/live_battle.gd")
var directory: String

class BootstrapBackend extends GameBackend:
	var snapshots: int = 0
	func fetch_bootstrap() -> Outcome:
		return Outcome.ok({"api_version":1,"snapshot_schema_version":PlayerState.SCHEMA_VERSION,"min_client_version_code":1,"rules_hash":ClientRelease.local_rules_hash(),"maintenance":{"active":false}})
	func fetch_state() -> Outcome:
		snapshots += 1
		return Outcome.fail(KIND_OFFLINE,"Unexpected snapshot call before the story pack")

func before_all() -> void:
	directory = "user://gut_opening_%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(directory)
	for file: String in DirAccess.get_files_at("res://data/content"):
		if not file.ends_with(".json") or file.begins_with("story_script_ch"): continue
		var output: FileAccess = FileAccess.open(directory.path_join(file),FileAccess.WRITE)
		output.store_buffer(FileAccess.get_file_as_bytes("res://data/content".path_join(file)))
		output.close()

func after_all() -> void:
	for file: String in DirAccess.get_files_at(directory):
		DirAccess.remove_absolute(directory.path_join(file))
	DirAccess.remove_absolute(directory)

func test_opening_registry_runs_all_three_tutorials_without_main_story_files() -> void:
	var flow: GameFlow = GameFlow.create(directory,true)
	assert_true(flow.is_ready(),flow.error)
	assert_true(flow.opening_only)
	for chapter: Dictionary in Tutorial.data()["chapters"]:
		var battle: BattleService.BattleResult = Tutorial.run(flow.registry,chapter,true)
		assert_eq(battle.error,"")
		var session: Live = Live.new()
		session.start(battle)
		session.advance(100)
		assert_true(session.completed)
		assert_eq(battle.outcome,"victory")

func test_rules_hash_match_does_not_admit_a_player_before_the_story_payload() -> void:
	var flow: GameFlow = GameFlow.create(directory,true)
	var backend: BootstrapBackend = BootstrapBackend.new()
	assert_false(await Game.attach(flow,backend))
	assert_eq(Game.boot_error_kind,ClientRelease.KIND_CONTENT_UPDATE)
	assert_eq(backend.snapshots,0)

func test_missing_story_in_a_normal_development_build_remains_a_load_error() -> void:
	if OS.has_feature("opening_bootstrap"):
		pending("This assertion belongs to the full development project")
		return
	var flow: GameFlow = GameFlow.create(directory)
	assert_false(flow.is_ready())
	assert_string_contains(flow.error,"story script failed")
