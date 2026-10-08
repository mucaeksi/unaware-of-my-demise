extends SceneTree
## Headless acceptance of the actual exported base and its data-only story patch.
const Tutorial = preload("res://scripts/ui/entry/tutorial_battle.gd")
const Live = preload("res://scripts/core/battle/live_battle.gd")
var failures: Array[String] = []
var report: Dictionary = {}

func check(condition: bool, description: String) -> void:
	if not condition: failures.append(description)

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var arguments: PackedStringArray = OS.get_cmdline_user_args()
	if arguments.size() != 2:
		push_error("Expected: -- <story-content.pck> <report.json>")
		quit(2)
		return
	check(OS.has_feature("opening_bootstrap"),"Exported opening feature must be enabled")
	check(not FileAccess.file_exists("res://data/content/story_script_ch01.json"),"Main story must be absent from the base")
	check(not FileAccess.file_exists("res://addons/godot_ai/plugin.cfg"),"Editor plugin must be excluded")
	var flow: GameFlow = GameFlow.create()
	check(flow.is_ready(),"Base rules registry: "+flow.error)
	check(flow.opening_only,"Base must be in opening-only mode")
	var chapters: Array[Dictionary] = []
	if flow.is_ready():
		for chapter: Dictionary in Tutorial.data()["chapters"]:
			var battle: BattleService.BattleResult = Tutorial.run(flow.registry,chapter,true)
			var session: Live = Live.new()
			session.start(battle)
			session.advance(100)
			check(battle.error.is_empty() and session.completed and battle.outcome == "victory","Tutorial "+str(chapter.get("stage_id","")))
			chapters.append({"stage_id":chapter.get("stage_id",""),"outcome":battle.outcome,"completed":session.completed})
	var pose_count: int = 0
	for actor: String in ["fadyme","mahmut","bellbound_dead","hollow_pilgrim"]:
		for state: String in BattleArt.STATES:
			check(BattleArt.pose(actor,state) != null,"Imported pose: "+actor+"/"+state)
			pose_count += 1
	for actor: String in ["fadyme","mahmut"]:
		check(BattleArt.icon(actor) != null,"Round face: "+actor)
		check(BattleArt.ultimate(actor) != null,"Ultimate cut-in: "+actor)
	for illustration: String in ["roadside_rest", "shelter_evening"]:
		check(BattleArt.illustration(illustration) != null, "Imported paired illustration: " + illustration)
	check(load("res://assets/ui/narrative/prologue_v002/writing_arm_v003.png") is Texture2D, "Imported complete writing arm")
	check(ProjectSettings.load_resource_pack(arguments[0],true),"Story patch must mount")
	var full: GameFlow = GameFlow.create()
	check(full.is_ready(),"Patched story registry: "+full.error)
	check(not full.opening_only,"Patched flow must leave opening-only mode")
	check(FileAccess.file_exists("res://data/content/story_script_ch01.json"),"Patch must restore main-story chapter one")
	check(FileAccess.file_exists("res://data/content/story_script_ch07.json"),"Patch must include the complete existing story payload")
	check(not full.story_index.pre_battle_scene("1-1").is_empty(),"Patched story must expose the 1-1 opening")
	report = {"base_ready":flow.is_ready(),"base_opening_only":flow.opening_only,"tutorials":chapters,"pose_count":pose_count,"patch_ready":full.is_ready(),"patch_opening_only":full.opening_only,"failures":failures}
	var output: FileAccess = FileAccess.open(arguments[1],FileAccess.WRITE)
	output.store_string(JSON.stringify(report,"\t"))
	output.close()
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
