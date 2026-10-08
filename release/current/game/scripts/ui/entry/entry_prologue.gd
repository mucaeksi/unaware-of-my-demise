class_name EntryPrologue
extends Control
## Presentation clock only. Download facts arrive from Entry; there are no game-state mutations.
signal finished(skipped: bool)
signal dismissed
signal scene_presented(line_id: String, audio_cue: String)
signal ending_started(fade_seconds: float)
const ScriptData = preload("res://scripts/ui/entry/entry_prologue_script.gd")
const Masthead = preload("res://scripts/ui/entry/entry_masthead.gd")
const Shot = preload("res://scripts/ui/entry/prologue_shot.gd")
const SEEN_PATH: String = "user://entry_prologue.cfg"
const STORY_ID: String = "entry_before_the_road_v001"
const DISSOLVE_SECONDS: float = 2.4
const END_FADE_SECONDS: float = 3.0

var playing: bool = false
var elapsed_seconds: float = 0.0
var reduced_motion: bool = false
var error: String = ""
var continue_selected: bool = false
var narration_duration_seconds: float = 0.0
var _data: Dictionary = {}
var _scene_index: int = -1
var _scene_start: float = 0.0
var _suspended: bool = false
var _ending: bool = false
var _ending_fade_started: bool = false
var _ending_veil: ColorRect = null
var _shot: Shot
var _previous_shot: Shot
var _warm_paths: Array[String] = []
var _narration_panel: PanelContainer
var _caption: Label
var _text: Label
var _status: Label
var _bytes: Label
var _progress: ProgressBar
var _skip: Button
var _replay: Button
var _logo: TextureRect
var _download: VBoxContainer
var _end_controls: CenterContainer
var _continue: Button
var _skip_armed: bool = false
var _end_grid: GridContainer
var _action_scale: float = 0.0

static func was_seen(path: String = SEEN_PATH) -> bool:
	var config: ConfigFile = ConfigFile.new()
	return config.load(path) == OK and str(config.get_value("opening", "seen", "")) == STORY_ID

static func mark_seen(path: String = SEEN_PATH) -> Error:
	var config: ConfigFile = ConfigFile.new()
	config.set_value("opening", "seen", STORY_ID)
	return config.save(path)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build()
	theme_changed.connect(_refresh_end_controls)
	_refresh_end_controls()
	set_process(false)

func _build() -> void:
	var background: ColorRect = ColorRect.new()
	background.color = Color("#100c10")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	var shade: ColorRect = ColorRect.new()
	shade.color = Color(0.025, 0.016, 0.025, 0.28)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	var gradient: Gradient = Gradient.new()
	gradient.set_color(0, Color(0.025, 0.016, 0.025, 0))
	gradient.set_color(1, Color(0.025, 0.016, 0.025, 0.48))
	var curtain: GradientTexture2D = GradientTexture2D.new()
	curtain.gradient = gradient
	curtain.width = 8
	curtain.height = 256
	curtain.fill_from = Vector2(0.5, 0.58)
	curtain.fill_to = Vector2(0.5, 1.0)
	var footer: TextureRect = TextureRect.new()
	footer.texture = curtain
	footer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	footer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(footer)
	var safe: SafeAreaContainer = SafeAreaContainer.new()
	safe.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(safe)
	var padding: MarginContainer = MarginContainer.new()
	for side: String in ["left", "right"]: padding.add_theme_constant_override("margin_" + side, 40)
	padding.add_theme_constant_override("margin_top", 20)
	padding.add_theme_constant_override("margin_bottom", 12)
	safe.add_child(padding)
	var column: VBoxContainer = UiKit.column(18)
	padding.add_child(column)
	var title: HBoxContainer = UiKit.row(12)
	_logo = Masthead.logo()
	_logo.custom_minimum_size = Vector2(330, 120)
	_logo.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_logo.modulate.a = 0.42
	title.add_child(_logo)
	var top_space: Control = UiKit.spacer(0, false)
	top_space.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.add_child(top_space)
	_skip = UiKit.button("Skip Story", false, "PrologueSkipButton")
	_skip.custom_minimum_size = Vector2(270, UiTheme.TOUCH_HEIGHT)
	_skip.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	_skip.pressed.connect(_on_skip_pressed)
	title.add_child(_skip)
	column.add_child(title)
	column.add_child(UiKit.spacer(0, true))
	_download = UiKit.column(6)
	_download.modulate.a = 0.58
	_status = UiKit.label("Downloading update...", "PrologueTransfer")
	_status.add_theme_color_override("font_color",Color.WHITE)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_download.add_child(_status)
	_progress = ProgressBar.new()
	_progress.theme_type_variation = "EntryProgress"
	_progress.custom_minimum_size.y = 8
	_progress.show_percentage = false
	_progress.step = 0.0
	_progress.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_download.add_child(_progress)
	_bytes = UiKit.label("Waiting for download...", "PrologueTransfer")
	_bytes.add_theme_color_override("font_color",Color.WHITE)
	_bytes.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_download.add_child(_bytes)
	var transfer_panel: PanelContainer = PanelContainer.new()
	transfer_panel.add_theme_stylebox_override("panel",BattleHudStyle.frame(BattleHudStyle.EDGE,0.80,12))
	transfer_panel.add_child(_download)
	column.add_child(transfer_panel)
	_download.visibility_changed.connect(func() -> void: transfer_panel.visible = _download.visible)
	var narration: VBoxContainer = UiKit.column(12)
	_caption = UiKit.label("", "EntryQuote")
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	narration.add_child(_caption)
	_text = UiKit.label("", "EntryNarration")
	_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_text.custom_minimum_size.y = 240
	_text.visible_characters_behavior = TextServer.VC_CHARS_AFTER_SHAPING
	narration.add_child(_text)
	var panel: PanelContainer = UiKit.card(narration)
	_narration_panel = panel
	var ink: StyleBoxFlat = StyleBoxFlat.new()
	ink.bg_color = Color(0.035, 0.024, 0.035, 0.38)
	ink.border_color = Color(0.47, 0.25, 0.29, 0.32)
	ink.border_width_top = 1
	ink.set_corner_radius_all(16)
	ink.set_content_margin_all(20)
	panel.add_theme_stylebox_override("panel", ink)
	column.add_child(panel)
	_ending_veil = ColorRect.new()
	_ending_veil.color = Color(0, 0, 0, 0)
	_ending_veil.z_index = 50
	_ending_veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_ending_veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_ending_veil)
	_skip.z_index = 100
	_end_controls = CenterContainer.new()
	_end_controls.z_index = 100
	_end_controls.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_end_controls.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_end_controls)
	var controls: GridContainer = GridContainer.new()
	_end_grid = controls
	controls.columns = 2
	controls.add_theme_constant_override("h_separation",24)
	controls.add_theme_constant_override("v_separation",18)
	resized.connect(_refresh_end_controls)
	_end_controls.add_child(controls)
	_replay = UiKit.button("Replay", false, "QuietButton")
	BattleHudStyle.action(_replay)
	_replay.custom_minimum_size.x = 350
	_replay.pressed.connect(play)
	controls.add_child(_replay)
	_continue = UiKit.button("Continue", false, "QuietButton")
	BattleHudStyle.action(_continue,true)
	_continue.custom_minimum_size.x = 350
	_continue.pressed.connect(request_continue)
	controls.add_child(_continue)
	_continue.focus_next = _continue.get_path_to(_replay)
	_replay.focus_next = _replay.get_path_to(_continue)
	_continue.focus_previous = _continue.focus_next
	_replay.focus_previous = _replay.focus_next
	# Every decorative layer lets the first touch reach the story root.
	for node: Node in find_children("*", "Control", true, false):
		if not node is BaseButton: (node as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(_layout_art)
	_narration_panel.resized.connect(_layout_art)
	_logo.resized.connect(_layout_art)

func _refresh_end_controls() -> void:
	if _end_grid == null: return
	_end_grid.columns = 1 if size.x < 840 else 2
	var font_scale: float = BattleHudStyle.text_scale(self)
	if is_equal_approx(font_scale,_action_scale): return
	_action_scale = font_scale
	for button: Button in [_replay,_continue]:
		button.add_theme_font_size_override("font_size",roundi(32*font_scale))

func play() -> void:
	var loaded: Outcome = ScriptData.load_timeline()
	if not loaded.is_ok():
		error = loaded.error
		push_error(error)
		return
	_data = loaded.value
	_clear_shots()
	elapsed_seconds = 0.0
	_scene_index = -1
	_ending = false
	_ending_fade_started = false
	_ending_veil.color.a = 0.0
	continue_selected = false
	playing = true
	_end_controls.hide()
	_download.show()
	_narration_panel.show()
	_skip.hide()
	_skip.focus_mode = Control.FOCUS_NONE
	_skip_armed = false
	show()
	set_process(true)
	_present_at_time()

func _process(delta: float) -> void:
	if playing and not _suspended:
		advance(delta)

func advance(seconds: float) -> void:
	if not playing or seconds <= 0.0: return
	elapsed_seconds = minf(elapsed_seconds + seconds, float(_data["duration_seconds"]))
	_present_at_time()
	if elapsed_seconds >= float(_data["duration_seconds"]):
		_complete(false)

func _present_at_time() -> void:
	var start: float = 0.0
	var scenes: Array = _data["scenes"]
	var index: int = scenes.size() - 1
	for candidate: int in scenes.size():
		if elapsed_seconds < start + float(scenes[candidate]["duration_seconds"]):
			index = candidate
			break
		if candidate < scenes.size() - 1: start += float(scenes[candidate]["duration_seconds"])
	_scene_start = start
	var scene: Dictionary = scenes[index]
	if index != _scene_index:
		_scene_index = index
		_show_scene(scene)
	var local: float = elapsed_seconds - _scene_start
	if _shot != null: _shot.update_time(local)
	if _previous_shot != null:
		_previous_shot.modulate.a = 1.0 - smoothstep(0.0, DISSOLVE_SECONDS, local)
		if local >= DISSOLVE_SECONDS or is_equal_approx(local, DISSOLVE_SECONDS): _release_previous()
	var readable: float = 1.0 if reduced_motion or index == 0 else smoothstep(0.0, 1.4, local)
	_text.modulate.a = readable
	_caption.modulate.a = readable
	# Keep the full shaped paragraph for stable wrapping while revealing glyphs.
	var reveal_seconds: float = narration_duration_seconds if narration_duration_seconds > 0.0 else minf(7.5, maxf(4.0, _text.text.length() / 28.0))
	reveal_seconds = minf(reveal_seconds, float(scene["duration_seconds"]) - 1.5)
	_text.visible_characters = -1 if reduced_motion else mini(_text.text.length(), floori(_text.text.length() * local / reveal_seconds))
	var duration: float = float(_data["duration_seconds"])
	var fade_start: float = duration - END_FADE_SECONDS
	_ending_veil.color.a = smoothstep(fade_start, duration, elapsed_seconds)
	if elapsed_seconds >= fade_start and not _ending_fade_started:
		_ending_fade_started = true
		ending_started.emit(maxf(0.0, duration - elapsed_seconds))

func _show_scene(scene: Dictionary) -> void:
	_release_previous()
	_previous_shot = _shot
	_shot = Shot.new()
	_shot.reduced_motion = reduced_motion
	var warmed: Dictionary = {}
	for path: String in _warm_paths:
		# Started a full scene ahead. Retrieving joins the worker if a seek jumped ahead.
		warmed[path] = ResourceLoader.load_threaded_get(path)
	_warm_paths.clear()
	var status: Error = _shot.prepare(str(scene["id"]), warmed)
	if status != OK:
		error = "An opening shot could not be loaded: " + str(scene["id"])
		_shot.free()
		_shot = null
		push_error(error)
		abort()
		return
	add_child(_shot)
	move_child(_shot, 1)
	_shot.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_caption.text = str(scene["caption_en"])
	_text.text = str(scene["text_en"])
	narration_duration_seconds = 0.0
	_caption.modulate.a = 1.0
	_text.modulate.a = 1.0
	if reduced_motion: _release_previous()
	_layout_art()
	_prewarm_next()
	scene_presented.emit(str(scene["line_id"]), str(scene.get("audio_cue", "")))

func _layout_art() -> void:
	if _logo == null or _narration_panel == null: return
	# The watermark is an overlay. It no longer reserves a band above the art.
	var bottom: float = _download.global_position.y - global_position.y - 12.0
	var area: Rect2 = Rect2(0, 0, size.x, maxf(200.0, bottom))
	if _shot != null: _shot.set_focus(area)
	if _previous_shot != null: _previous_shot.set_focus(area)

func _prewarm_next() -> void:
	var scenes: Array = _data["scenes"]
	if _scene_index + 1 >= scenes.size(): return
	for path: String in Shot.paths_for(str(scenes[_scene_index + 1]["id"])):
		if ResourceLoader.load_threaded_request(path, "Texture2D") == OK:
			_warm_paths.append(path)

func _release_previous() -> void:
	if _previous_shot == null: return
	remove_child(_previous_shot)
	_previous_shot.free()
	_previous_shot = null

func _clear_shots() -> void:
	_release_previous()
	if _shot != null:
		remove_child(_shot)
		_shot.free()
		_shot = null
	for path: String in _warm_paths: ResourceLoader.load_threaded_get(path)
	_warm_paths.clear()

func set_transfer(received: int, total: int) -> void:
	var expected: int = maxi(0, total)
	var committed: int = clampi(received, 0, expected)
	_progress.value = 100.0 * committed / expected if expected > 0 else 0.0
	_bytes.text = "%d%%  ·  %s / %s" % [floori(_progress.value), _format_bytes(committed), _format_bytes(expected)] if expected > 0 else "Waiting for download..."

static func _format_bytes(bytes: int) -> String:
	if bytes < 1024: return "%d B" % bytes
	if bytes < 1048576: return "%.1f KiB" % (bytes / 1024.0)
	if bytes < 1073741824: return "%.1f MiB" % (bytes / 1048576.0)
	return "%.2f GiB" % (bytes / 1073741824.0)

func set_status(text: String) -> void:
	_status.text = text

func skip() -> void:
	if continue_selected: return
	_complete(true)
	request_continue()

func request_continue() -> void:
	if continue_selected or not _ending: return
	continue_selected = true
	dismissed.emit()

func reveal_skip(arm_immediately: bool = true) -> void:
	if not playing or _ending: return
	if _skip.visible: return
	_skip.show()
	_skip.focus_mode = Control.FOCUS_ALL
	_skip_armed = arm_immediately

func _on_skip_pressed() -> void:
	if _skip_armed: skip()

func _input(event: InputEvent) -> void:
	if _skip == null or not _skip.visible or _skip_armed: return
	var released: bool = (event is InputEventScreenTouch and not (event as InputEventScreenTouch).pressed) or (event is InputEventMouseButton and not (event as InputEventMouseButton).pressed) or (event is InputEventKey and not (event as InputEventKey).pressed)
	if released: _arm_skip.call_deferred()

func _arm_skip() -> void:
	# Arm after the reveal gesture (including its emulated mouse release) finishes.
	_skip_armed = true

func _gui_input(event: InputEvent) -> void:
	var touched: bool = event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed
	var clicked: bool = event is InputEventMouseButton and (event as InputEventMouseButton).pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT
	if touched or clicked:
		reveal_skip(false)
		accept_event()

func _unhandled_key_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept") and playing and not _skip.visible:
		reveal_skip()
		_skip.grab_focus()
		get_viewport().set_input_as_handled()

func abort() -> void:
	playing = false
	set_process(false)
	_clear_shots()
	hide()

func _complete(skipped: bool) -> void:
	if _ending: return
	_ending = true
	playing = false
	_ending_veil.color.a = 1.0
	if skipped and not _ending_fade_started:
		_ending_fade_started = true
		ending_started.emit(0.35)
	set_process(false)
	_skip.hide()
	_skip.focus_mode = Control.FOCUS_NONE
	_download.hide()
	_narration_panel.hide()
	_end_controls.show()
	_continue.grab_focus()
	finished.emit(skipped)

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_PAUSED: _suspended = true
	elif what == NOTIFICATION_APPLICATION_RESUMED: _suspended = false

func _exit_tree() -> void:
	for path: String in _warm_paths: ResourceLoader.load_threaded_get(path)
	_warm_paths.clear()
