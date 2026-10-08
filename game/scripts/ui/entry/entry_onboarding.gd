extends Control
## The AAB's reward-free opening. Patch status is independent of story pacing.
signal finished
const Tutorial = preload("res://scripts/ui/entry/tutorial_battle.gd")
const Preferences = preload("res://scripts/app/onboarding_preferences.gd")
const LivePlayback = preload("res://scripts/ui/battle/live_battle_playback.gd")

var completed: bool = false
var index: int = 0
var phase: String = "before"
var _registry: ContentModels.ContentRegistry
var _chapters: Array = []
var _host: Control
var _status: Label
var _bar: ProgressBar
var _account: String = ""
var _preferences: String = ""
var _job: WorkerJob = null
var _battle: BattleScreen = null
var _patch_done: bool = false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var column: VBoxContainer = UiKit.column(8)
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(column)
	_host = Control.new()
	_host.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_host)
	_status = UiKit.label("Story content downloading…", "", false)
	BattleHudStyle.label(_status, 24, BattleHudStyle.MUTED)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_status)
	_bar = ProgressBar.new()
	_bar.show_percentage = false
	_bar.custom_minimum_size.y = 6
	column.add_child(_bar)
	set_process(false)

func start(registry: ContentModels.ContentRegistry, account: String = "", preferences: String = "") -> void:
	_registry = registry
	_account = account
	_preferences = preferences
	_chapters = Tutorial.data().get("chapters", [])
	var cursor: Dictionary = Preferences.cursor(preferences, account) if not account.is_empty() else {"index":0,"phase":"before"}
	index = int(cursor["index"])
	phase = str(cursor["phase"])
	if phase == "after": _show_scene("after")
	else: _show_scene("before")

func _checkpoint(next_phase: String, done: bool = false) -> void:
	phase = next_phase
	if _account.is_empty(): return
	var saved: Error = Preferences.checkpoint(_preferences,_account,index,phase,done)
	if saved != OK: push_warning("Could not save the tutorial viewing checkpoint: " + error_string(saved))

func _show_scene(kind: String) -> void:
	UiKit.clear(_host)
	_battle = null
	_checkpoint(kind)
	var reader: VnScreen = VnScreen.new()
	reader.audio_enabled = false
	_host.add_child(reader)
	reader.load_scene((_chapters[index] as Dictionary)[kind])
	reader.finished.connect(_start_battle if kind == "before" else _next_chapter, CONNECT_ONE_SHOT)

func _start_battle() -> void:
	UiKit.clear(_host)
	_checkpoint("battle")
	_battle = BattleScreen.new()
	_host.add_child(_battle)
	_battle.show_loading(str(_chapters[index]["title_en"]))
	var registry: ContentModels.ContentRegistry = _registry
	var chapter: Dictionary = (_chapters[index] as Dictionary).duplicate(true)
	_job = WorkerJob.start(func() -> Variant: return Tutorial.run(registry,chapter,true))
	set_process(true)

func _process(_delta: float) -> void:
	if _job == null or not _job.is_finished(): return
	var result: BattleService.BattleResult = _job.finish() as BattleService.BattleResult
	_job = null
	set_process(false)
	if not result.error.is_empty():
		UiKit.clear(_host)
		var problem: MessageScreen = MessageScreen.new()
		_host.add_child(problem)
		problem.load_message("Unable to continue", "This encounter could not be loaded. Please try again.", [{"id":"retry","label":"Retry"}] as Array[Dictionary])
		problem.chosen.connect(func(_id: String) -> void: _start_battle(),CONNECT_ONE_SHOT)
		return
	var live: LivePlayback = LivePlayback.new()
	live.begin(result,_registry)
	_battle.play(live,str(_chapters[index]["title_en"]))
	_battle.finished.connect(func() -> void:
		if result.outcome == "victory": _show_scene("after")
		else: _start_battle(), CONNECT_ONE_SHOT)

func _next_chapter() -> void:
	if index < _chapters.size() - 1:
		index += 1
		_show_scene("before")
		return
	completed = true
	_checkpoint("complete",true)
	# Keep the final tableau available to the parent's dissolve into the patch page.
	finished.emit()

func set_transfer(received: int, total: int) -> void:
	if _patch_done: return
	_bar.value = clampf(100.0 * float(received) / float(total),0.0,100.0) if total > 0 else 0.0
	_status.text = "Story content downloading · %d%%" % int(_bar.value) if total > 0 else "Story content downloading…"

func set_patch_result(result: Outcome) -> void:
	_patch_done = result.is_ok()
	_status.text = "Story content ready" if _patch_done else "Download paused · Your tutorial can continue"
	if _patch_done: _bar.value = 100

func _exit_tree() -> void:
	if _job != null: _job.finish()
