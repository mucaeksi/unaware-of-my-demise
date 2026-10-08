extends Control
## Local art review, no account operations or rewards. Reuses LocalUiPreview.

const ENTRY: String = "res://scenes/art_review/entry_preview.tscn"
const Onboarding = preload("res://scripts/ui/entry/entry_onboarding.gd")
const Live = preload("res://scripts/ui/battle/live_battle_playback.gd")
const Tutorial = preload("res://scripts/ui/entry/tutorial_battle.gd")
var mode: String = "arena"
var _host: Control = null
var _note: Label = null
var _battle: BattleScreen = null
var _pose_actor: BattleActor = null
var _pose_label: Label = null
var _pose_index: int = 0
var _pose_id: String = "fadyme"
var _pose_timer: Timer = null
var _arena_layout: String = "tutorial"
var _review_chapter_three: bool = false
var _patch_review: EntryScreen = null
var _review_patch_ready: bool = false
var _review_patch_bytes: int = 0
var _review_patch_tween: Tween = null
var _novel_scene_index: int = 3
static var _sample_registry: ContentModels.ContentRegistry = null

func refresh_preview() -> void:
	BattleArt.reset_cache()
	show_mode(mode)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bed: ColorRect = ColorRect.new()
	bed.color = Color(0.035, 0.026, 0.052)
	bed.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bed.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bed)
	_host = Control.new()
	_host.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_host.offset_top = 180
	_host.offset_bottom = -86
	add_child(_host)
	var toolbar: HBoxContainer = HBoxContainer.new()
	toolbar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	toolbar.offset_left = 20
	toolbar.offset_right = -20
	toolbar.offset_top = 12
	toolbar.offset_bottom = 156
	toolbar.add_theme_constant_override("separation", 12)
	add_child(toolbar)
	for item: Array in [["Arena", "arena"], ["Character poses", "poses"], ["Light novel", "novel"], ["Entry", "entry"]]:
		var button: Button = UiKit.button(str(item[0]))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.add_theme_font_size_override("font_size", 26)
		var destination: String = str(item[1])
		button.pressed.connect(func() -> void: show_mode(destination))
		toolbar.add_child(button)
	_note = UiKit.label("", UiTheme.DIM, false)
	_note.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_note.offset_left = 28
	_note.offset_right = -28
	_note.offset_top = -74
	_note.offset_bottom = -12
	_note.add_theme_font_size_override("font_size", 22)
	add_child(_note)
	_pose_timer = Timer.new()
	_pose_timer.wait_time = 2.0
	_pose_timer.timeout.connect(func() -> void: show_pose((_pose_index + 1) % BattleArt.STATES.size()))
	add_child(_pose_timer)
	show_mode("arena")

func show_mode(destination: String) -> void:
	if _review_patch_tween != null and _review_patch_tween.is_valid(): _review_patch_tween.kill()
	_patch_review = null
	mode = destination
	_pose_timer.stop()
	Audio.stop_voice()
	UiKit.clear(_host)
	_battle = null
	_pose_actor = null
	match destination:
		"arena":
			_build_arena()
		"poses":
			_build_poses()
			_note.text = "Character art · Key poses + motion · Local samples"
		"novel":
			var column: VBoxContainer = UiKit.column(12)
			column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
			_host.add_child(column)
			var selector: OptionButton = OptionButton.new()
			selector.custom_minimum_size.y = 80
			selector.add_theme_font_size_override("font_size", 28)
			for label: String in ["T-1 · Before", "T-1 · After", "T-2 · Before", "T-2 · Roadside rest", "T-3 · Before", "T-3 · Shelter evening"]:
				selector.add_item(label)
			selector.select(_novel_scene_index)
			column.add_child(selector)
			var novel: VnScreen = VnScreen.new()
			novel.audio_enabled = false
			novel.size_flags_vertical = Control.SIZE_EXPAND_FILL
			column.add_child(novel)
			var script: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/entry/tutorial_v001.json"))
			var selected: Dictionary = script["chapters"][floori(float(_novel_scene_index) / 2.0)]["before" if _novel_scene_index % 2 == 0 else "after"]
			novel.load_scene(selected)
			selector.item_selected.connect(func(index: int) -> void:
				_novel_scene_index = index
				show_mode("novel"))
			_note.text = "English text · Visual review · New voice and music deferred"
		"entry":
			var packed: PackedScene = load(ENTRY) as PackedScene
			var preview: Control = packed.instantiate() as Control
			_host.add_child(preview)
			preview._entry_capture_phase = "story_beginning"
			preview.refresh_preview()
			var entry: EntryScreen = preview._host.get_child(0) as EntryScreen
			entry._prologue.dismissed.connect(func() -> void:
				if mode == "entry": _show_opening_tutorial()
			)
			_note.text = "Opening review · Continue → cutscene → three tutorials · Simulated patch"
	UiPageTransition.finish_under(_host)
	Audio.stop_music(0.0)

func _show_opening_tutorial() -> void:
	UiKit.clear(_host)
	var opening: Onboarding = Onboarding.new()
	_host.add_child(opening)
	opening.start(sample_registry())
	_review_patch_ready = false
	_review_patch_bytes = 0
	opening.finished.connect(_show_patch_review, CONNECT_ONE_SHOT)
	var patch: Tween = create_tween()
	_review_patch_tween = patch
	# The patch can outlive the tutorial page. Capture its weak reference so
	# completion does not leave a freed Node inside a long-running tween lambda.
	var opening_ref: WeakRef = weakref(opening)
	patch.tween_method(func(bytes: float) -> void:
		_review_patch_bytes = int(bytes)
		var active_opening: Control = opening_ref.get_ref() as Control
		if active_opening != null: active_opening.set_transfer(_review_patch_bytes, 100000000)
		if is_instance_valid(_patch_review): _patch_review.set_download_progress(_review_patch_bytes, 100000000), 0.0, 100000000.0, 180.0)
	patch.tween_callback(func() -> void:
		_review_patch_ready = true
		var active_opening: Control = opening_ref.get_ref() as Control
		if active_opening != null: active_opening.set_patch_result(Outcome.ok())
		if is_instance_valid(_patch_review): _patch_review.present("patch_complete", true)
	)
	_note.text = "AAB tutorial review · Simulated background patch · No account/reward changes"

func _show_patch_review() -> void:
	var previous: Control = UiPageTransition.visual_copy(_host)
	UiKit.clear(_host)
	_patch_review = EntryScreen.new()
	_host.add_child(_patch_review)
	_patch_review.set_download_progress(_review_patch_bytes, 100000000)
	_patch_review.present("patch_complete" if _review_patch_ready else "downloading", true)
	_patch_review.action_requested.connect(func(action: String) -> void:
		if action == "restart" and _review_patch_ready and _patch_review.phase == "patch_complete":
			_patch_review.present("restart_required", true)
			_note.text = "AAB restart boundary · Export restarts the process · This preview keeps the editor session open")
	UiPageTransition.reveal(_patch_review, 2.4, previous)
	_note.text = "Tutorial complete → patch verification → confirm restart · Main story opens from the installed game menu"

func _build_arena() -> void:
	var column: VBoxContainer = UiKit.column(8)
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_host.add_child(column)
	var options: HBoxContainer = UiKit.row(10)
	column.add_child(options)
	for item: Array in [["2v2", "tutorial"], ["5v5", "full"], ["Boss size", "boss"]]:
		var button: Button = UiKit.button(str(item[0]))
		button.custom_minimum_size.y = 90
		button.add_theme_font_size_override("font_size", 26)
		button.toggle_mode = true
		button.button_pressed = _arena_layout == str(item[1])
		button.pressed.connect(func() -> void:
			_arena_layout = str(item[1])
			show_mode("arena")
		)
		options.add_child(button)
	var unlock: Button = UiKit.button("Chapter 3 clear")
	unlock.custom_minimum_size.y = 90
	unlock.add_theme_font_size_override("font_size", 24)
	unlock.toggle_mode = true
	unlock.button_pressed = _review_chapter_three
	unlock.pressed.connect(func() -> void:
		_review_chapter_three = not _review_chapter_three
		show_mode("arena")
	)
	options.add_child(unlock)
	_battle = BattleScreen.new()
	_battle.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_battle)
	var story: StoryState.PlayerStoryState = StoryState.PlayerStoryState.new()
	var registry: ContentModels.ContentRegistry = sample_registry()
	if _review_chapter_three:
		for stage: ContentModels.Stage in registry.stages.values():
			if stage.chapter_id == BattleSpeedPolicy.CHAPTER_ID:
				story.completed_stage_ids[stage.stage_id] = true
	_battle.configure_progress(story, registry)
	_battle.finished.connect(_play_review)
	_play_review()
	_note.text = "Local layout samples · Chapter toggle changes sample data only · Audio deferred"

func _play_review() -> void:
	var title: String = "The First Step · Art review" if _arena_layout == "tutorial" else ("5v5 · Layout review" if _arena_layout == "full" else "Boss size · Sample art")
	_battle.play(sample_live() if _arena_layout == "tutorial" else sample_formation(_arena_layout == "boss"), title)

static func sample_live() -> BattlePlayback:
	var registry: ContentModels.ContentRegistry = sample_registry()
	var result: BattleService.BattleResult = Tutorial.run(registry,Tutorial.data()["chapters"][2],true)
	# An endurance fixture for reviewing held Focus and cut-ins, not tutorial balance.
	for unit: BattleUnit in result.state.units:
		unit.hp *= 30
		unit.max_hp *= 30
	for record: Dictionary in result.initial_units:
		record["hp"] = int(record["hp"])*30
		record["max_hp"] = int(record["max_hp"])*30
	var live: Live = Live.new()
	live.begin(result,registry)
	return live

func _build_poses() -> void:
	var field: BattleField = BattleField.new()
	field.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	field.offset_bottom = -540
	_host.add_child(field)
	var view: BattlePlayback.UnitView = BattlePlayback.UnitView.new()
	view.entity_id = _pose_id
	view.art_id = _pose_id
	view.display_name = _pose_id.replace("_", " ").capitalize()
	view.team = "player" if _pose_id in ["fadyme", "mahmut"] else "enemy"
	view.row = "rear"
	view.hp = 100
	view.max_hp = 100
	field.populate([view])
	_pose_actor = field.actors[_pose_id]
	_pose_actor.scale = Vector2(2.3, 2.3)
	_pose_actor.set_art_size(210)
	_pose_actor.card.hide()
	_pose_actor.position = field.size * Vector2(0.50, 0.62)
	field.resized.connect(func() -> void:
		if is_instance_valid(_pose_actor):
			_pose_actor.scale = Vector2(2.3, 2.3)
			_pose_actor.position = field.size * Vector2(0.50, 0.62)
	)
	var controls: VBoxContainer = UiKit.column(12)
	controls.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	controls.offset_top = -510
	_host.add_child(controls)
	var characters: HBoxContainer = UiKit.row(10)
	controls.add_child(characters)
	for character: Array in [["Fadyme", "fadyme"], ["Mahmut", "mahmut"], ["Bellbound", "bellbound_dead"], ["Pilgrim", "hollow_pilgrim"]]:
		var select: Button = UiKit.button(str(character[0]))
		select.add_theme_font_size_override("font_size", 24)
		select.custom_minimum_size.y = 74
		select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var character_id: String = str(character[1])
		select.pressed.connect(func() -> void:
			_pose_id = character_id
			show_mode("poses")
		)
		characters.add_child(select)
	_pose_label = UiKit.label("", UiTheme.TITLE, false)
	_pose_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	controls.add_child(_pose_label)
	for row_index: int in range(2):
		var row: HBoxContainer = UiKit.row(12)
		controls.add_child(row)
		for column_index: int in range(4):
			var index: int = row_index * 4 + column_index
			var button: Button = UiKit.button(BattleArt.STATES[index].capitalize())
			button.add_theme_font_size_override("font_size", 24)
			button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			button.pressed.connect(func() -> void:
				_pose_timer.stop()
				show_pose(index)
			)
			row.add_child(button)
	show_pose(0)
	_pose_timer.start()

func show_pose(index: int) -> void:
	if _pose_actor == null:
		return
	_pose_index = index
	# Review may show every pose in any order, including after the defeat pose.
	_pose_actor.alive = true
	_pose_actor.animate(BattleArt.STATES[index], 1.0, false)
	_pose_label.text = "%s · %s" % [_pose_id.replace("_", " ").capitalize(), BattleArt.STATES[index].capitalize()]

static func sample_battle() -> BattlePlayback:
	var initial: Array[Dictionary] = [
		{"entity_id":"mahmut", "team":"player", "row":"front", "slot_index":0, "hp":140,"max_hp":140},
		{"entity_id":"fadyme", "team":"player", "row":"rear", "slot_index":2, "hp":95,"max_hp":95},
		{"entity_id":"review:0:bellbound_dead:0","enemy_id":"bellbound_dead","team":"enemy","row":"front","slot_index":0,"hp":65,"max_hp":65},
		{"entity_id":"review:0:hollow_pilgrim:2","enemy_id":"hollow_pilgrim","team":"enemy","row":"rear","slot_index":2,"hp":90,"max_hp":90}
	]
	var events: Array[Dictionary] = [
		{"type":"action_started","actor_id":"mahmut","skill_id":"mahmut_basic_oathless_cut","action_type":"basic","round":1},
		{"type":"damage_dealt","source_id":"mahmut","target_id":"review:0:bellbound_dead:0","amount":20,"hp":45,"alive":true},
		{"type":"action_started","actor_id":"fadyme","skill_id":"fadyme_basic_veilglass_thorn","action_type":"basic"},
		{"type":"damage_dealt","source_id":"fadyme","target_id":"review:0:bellbound_dead:0","amount":25,"hp":20,"alive":true},
		{"type":"action_started","actor_id":"review:0:bellbound_dead:0","skill_id":"bellbound_dead_basic","action_type":"basic"},
		{"type":"damage_dealt","source_id":"review:0:bellbound_dead:0","target_id":"mahmut","amount":12,"hp":128,"alive":true},
		{"type":"action_started","actor_id":"fadyme","skill_id":"fadyme_active_borrowed_hour","action_type":"active","round":2},
		{"type":"healing_applied","target_id":"mahmut","amount":12,"hp":140},
		{"type":"action_started","actor_id":"review:0:hollow_pilgrim:2","skill_id":"hollow_pilgrim_basic","action_type":"basic"},
		{"type":"damage_dealt","source_id":"review:0:hollow_pilgrim:2","target_id":"fadyme","amount":14,"hp":81,"alive":true},
		{"type":"action_started","actor_id":"mahmut","skill_id":"mahmut_active_broken_crest_guard","action_type":"active"},
		{"type":"damage_dealt","source_id":"mahmut","target_id":"review:0:bellbound_dead:0","amount":20,"hp":0,"alive":false},
		{"type":"action_started","actor_id":"fadyme","skill_id":"fadyme_ultimate_the_bell_that_forgets","action_type":"ultimate","round":3},
		{"type":"damage_dealt","source_id":"fadyme","target_id":"review:0:hollow_pilgrim:2","amount":60,"hp":30,"alive":true,"critical":true},
		{"type":"action_started","actor_id":"mahmut","skill_id":"mahmut_basic_oathless_cut","action_type":"basic"},
		{"type":"damage_dealt","source_id":"mahmut","target_id":"review:0:hollow_pilgrim:2","amount":30,"hp":0,"alive":false}
	]
	var final: Array[Dictionary] = initial.duplicate(true)
	for record: Dictionary in final:
		record["alive"] = true
	final[1]["hp"] = 81
	for index: int in [2,3]:
		final[index]["hp"] = 0
		final[index]["alive"] = false
	var replay: BattlePlayback = _timed_sample(initial, events, [3.2,3.8,3.2,3.8,3.2,3.8,6.6,7.25,6.6,7.15,7.0,7.55,9.6,10.55,10.8,11.3], final)
	replay.unit("mahmut").display_name = "Mahmut"
	replay.unit("fadyme").display_name = "Fadyme"
	replay.unit("review:0:bellbound_dead:0").display_name = "Bellbound Dead"
	replay.unit("review:0:hollow_pilgrim:2").display_name = "Hollow Pilgrim"
	return replay

static func sample_registry() -> ContentModels.ContentRegistry:
	if _sample_registry == null:
		_sample_registry = ContentLoader.new().load_dir("res://data/content")
	return _sample_registry

static func _timed_sample(initial: Array[Dictionary], events: Array[Dictionary], times: Array, final: Array[Dictionary]) -> BattlePlayback:
	var packets: Array[Dictionary] = []
	for index: int in range(events.size()):
		packets.append({"event":events[index], "seconds":float(times[index]), "order":index})
	packets.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return float(left["seconds"]) < float(right["seconds"]) if left["seconds"] != right["seconds"] else int(left["order"]) < int(right["order"])
	)
	var sorted: Array[Dictionary] = []
	var frames: Array[Dictionary] = []
	var focus: Dictionary = {}
	for unit: Dictionary in initial: focus[unit["entity_id"]] = 30
	for packet: Dictionary in packets:
		var event: Dictionary = packet["event"]
		var actor: String = str(event.get("actor_id", ""))
		if event.get("type") == "action_started":
			focus[actor] = 0 if event.get("action_type") == "ultimate" else mini(100, int(focus.get(actor,0)) + 15)
		var snapshots: Array[Dictionary] = []
		for id: String in focus: snapshots.append({"entity_id":id,"focus":focus[id]})
		frames.append({"seconds":packet["seconds"],"units":snapshots})
		sorted.append(event)
	for unit: Dictionary in final: unit["focus"] = int(focus.get(unit["entity_id"],0)) if bool(unit.get("alive",true)) else 0
	return BattlePlayback.from_records(initial, initial, sorted, final, sample_registry(), "victory", 3, frames)

static func sample_formation(large_boss: bool = false) -> BattlePlayback:
	# Repeated artwork is a local capacity fixture, not new playable characters,
	# duplicate-party permission, or a new canonical boss species in the tutorial.
	var initial: Array[Dictionary] = []
	for team: String in ["player", "enemy"]:
		for slot: int in range(5):
			var boss: bool = large_boss and team == "enemy" and slot == 2
			initial.append({"entity_id":"%s_slot_%d" % [team,slot],"team":team,"row":"front" if slot < 2 else "rear","slot_index":slot,"hp":(800 if boss else 100),"max_hp":(1000 if boss else 100),"alive":true,"is_boss":boss})
	var events: Array[Dictionary] = []
	var times: Array[float] = []
	for round_index: int in range(5):
		for slot: int in range(5):
			var start: float = 3.2 + float(round_index) * 3.4 + float(slot % 3) * 0.12
			var damage: int = 160 if large_boss and slot == 2 else 20
			var identity: String = "mahmut" if slot < 2 else "fadyme"
			var kind: String = "active" if round_index % 2 == 1 else "basic"
			var skill: String = "%s_basic_%s" % [identity, "oathless_cut" if identity == "mahmut" else "veilglass_thorn"]
			if kind == "active": skill = "%s_active_%s" % [identity, "broken_crest_guard" if identity == "mahmut" else "borrowed_hour"]
			events.append({"type":"action_started","actor_id":"player_slot_%d" % slot,"skill_id":skill,"action_type":kind,"round":round_index+1})
			times.append(start)
			events.append({"type":"damage_dealt","source_id":"player_slot_%d" % slot,"target_id":"enemy_slot_%d" % slot,"amount":damage,"hp":damage*(4-round_index),"alive":round_index < 4})
			times.append(start + 0.7)
			if round_index < 4:
				events.append({"type":"action_started","actor_id":"enemy_slot_%d" % slot,"action_type":"basic"})
				times.append(start + 0.15)
				events.append({"type":"damage_dealt","source_id":"enemy_slot_%d" % slot,"target_id":"player_slot_%d" % slot,"amount":4,"hp":100-4*(round_index+1),"alive":true})
				times.append(start + 0.65)
	var final: Array[Dictionary] = initial.duplicate(true)
	for index: int in range(5): final[index]["hp"] = 84
	for index: int in range(5,10):
		final[index]["hp"] = 0
		final[index]["alive"] = false
	var model: BattlePlayback = _timed_sample(initial, events, times, final)
	for view: BattlePlayback.UnitView in model.units:
		view.art_id = ("mahmut" if view.row == "front" else "fadyme") if view.team == "player" else ("bellbound_dead" if view.row == "front" else "hollow_pilgrim")
		view.display_name = ("Mahmut" if view.row == "front" else "Fadyme") if view.team == "player" else ("Bellbound" if view.row == "front" else "Pilgrim")
		if view.is_boss:
			view.display_name = "Boss size sample"
	model.prepare_identities()
	return model

static func sample_novel() -> Dictionary:
	# Excerpts retain existing line ids and text; this is not a newly authored story scene.
	var chapter: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/content/story_script_ch01.json"))
	var original: Array = chapter["opening_scene"]["lines"]
	var excerpts: Array[Dictionary] = []
	for line_id: String in ["opening_012","opening_004","opening_002","opening_001"]:
		for line: Dictionary in original:
			if str(line["line_id"]) == line_id:
				excerpts.append(line.duplicate(true))
	for line: Dictionary in chapter["scenes"][0]["pre_battle_lines"]:
		if str(line["line_id"]) == "node_1_1_pre_002":
			excerpts.append(line.duplicate(true))
	return {"scene_id":"fadyme_expression_review","title_en":"Fadyme · Expression review","location_id":"forest_whispering_ash","lines":excerpts}
