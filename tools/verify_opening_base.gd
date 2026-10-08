extends SceneTree
## Acceptance for the real AAB base. No account/network requests or rewards.
const Tutorial = preload("res://scripts/ui/entry/tutorial_battle.gd")
const Live = preload("res://scripts/core/battle/live_battle.gd")
var failures: Array[String] = []

func check(condition: bool, description: String) -> void:
	if not condition: failures.append(description)

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	check(OS.has_feature("opening_bootstrap"), "Opening export feature enabled")
	check(not FileAccess.file_exists("res://data/content/story_script_ch01.json"), "Main story absent from base")
	check(not FileAccess.file_exists("res://.mcp.json"), "Local MCP configuration absent")
	check(not ResourceLoader.exists("res://assets/ui/narrative/prologue_v002/writing_hand.png"), "Superseded writing reference absent")
	var flow: GameFlow = GameFlow.create()
	check(flow.is_ready(), "Base registry: " + flow.error)
	check(flow.opening_only, "Opening-only runtime")
	var outcomes: Array[Dictionary] = []
	if flow.is_ready():
		for chapter: Dictionary in Tutorial.data()["chapters"]:
			var battle: BattleService.BattleResult = Tutorial.run(flow.registry, chapter, true)
			var session: Live = Live.new()
			session.start(battle)
			session.advance(100)
			check(battle.error.is_empty() and session.completed and battle.outcome == "victory", "Tutorial " + str(chapter["stage_id"]))
			outcomes.append({"stage":chapter["stage_id"], "outcome":battle.outcome})
	for actor: String in ["fadyme", "mahmut", "bellbound_dead", "hollow_pilgrim"]:
		for state: String in BattleArt.STATES:
			check(BattleArt.pose(actor, state) != null, "Pose: " + actor + "/" + state)
	for actor: String in ["fadyme", "mahmut"]:
		check(BattleArt.icon(actor) != null, "Round icon: " + actor)
		check(BattleArt.ultimate(actor) != null, "Ultimate: " + actor)
	for illustration: String in ["roadside_rest", "shelter_evening"]:
		check(BattleArt.illustration(illustration) != null, "Illustration: " + illustration)
	check(ResourceLoader.exists("res://assets/ui/narrative/prologue_v002/writing_arm_v003.png"), "Complete writing arm")
	var report: Dictionary = {"opening_only":flow.opening_only, "registry_ready":flow.is_ready(), "tutorials":outcomes, "failures":failures}
	var arguments: PackedStringArray = OS.get_cmdline_user_args()
	if not arguments.is_empty():
		var output: FileAccess = FileAccess.open(arguments[0], FileAccess.WRITE)
		if output == null:
			push_error("Could not save base acceptance report")
			quit(2)
			return
		output.store_string(JSON.stringify(report, "\t"))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
