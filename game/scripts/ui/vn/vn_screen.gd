class_name VnScreen
extends UiScreen
## The Visual Novel reader (port of client/screens/vn_screen.py): one scene at a time, line by line, with back, next, auto speed and a log.
## Art comes from the asset resolver (INF-024): the scene's `location_id` names the background ("background/<id>/story") and the speaker
## the bust ("character/<id>/vn_bust"). Where the art is not shipped yet, a tinted panel stands in (the speaker's initial and the line's
## `emotion`) and says so. Text is the player's language with English as the fallback (`LocalizedText`); a line with a recording
## plays it on the Voice bus (`Audio.play_voice(speaker_id, line_id)`), and leaving the line or the screen stops it.
## `finished` fires once, when the reader advances past the last line (Finish button or auto play) or skips the scene after confirming
## (the scene then counts as seen: story progress moves on exactly as at its end), never when the screen is
## just left. Story cues (docs/design/FIRST_LAUNCH_FLOW.md): the scene's music_cue_id/ambience_cue_id start with it, a line's `audio`
## changes play when the line shows.

signal finished

const BASE_AUTO_SECONDS: float = 5.0
const SPEED_STEPS: Array[int] = [0, 1, 2, 3]
const LINE_FIELDS: Array[String] = ["pre_battle_lines", "lines", "battle_lines", "post_battle_lines"]

## Why the last `load_scene` was refused ("" = it was not).
var error: String = ""
## Where art comes from; null = the app's (`Game.assets`). Tests set their own before the screen is built.
var assets: AssetResolver = null
## Whether the current line's recording started (false: text only).
var voiced: bool = false

var _lines: Array[Dictionary] = []
var _index: int = 0
var _auto_speed: int = 0
var _done: bool = false

var _title_label: Label = null
var _stage_panel: PanelContainer = null
var _background: TextureRect = null
var _bust: TextureRect = null
var _placeholder_tag: Label = null
var _background_reference: String = ""
var _bust_reference: String = ""
var _dialogue_panel: PanelContainer = null
var _bust_letter: Label = null
var _emotion_label: Label = null
var _speaker_label: Label = null
var _dialogue_label: Label = null
var _back_button: Button = null
var _auto_button: Button = null
var _log_button: Button = null
var _next_button: Button = null
var _skip_button: Button = null
var _skip_panel: PanelContainer = null
var _log_panel: PanelContainer = null
var _log_text: Label = null
var _auto_timer: Timer = null


func _build(column: VBoxContainer) -> void:
	_title_label = UiKit.label("", UiTheme.DIM)
	column.add_child(_title_label)

	_stage_panel = PanelContainer.new()
	_stage_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var stage_column: VBoxContainer = UiKit.column(8)
	stage_column.alignment = BoxContainer.ALIGNMENT_CENTER
	_stage_panel.add_child(stage_column)
	_background = TextureRect.new()
	_background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_background.visible = false
	_stage_panel.add_child(_background)
	_bust = TextureRect.new()
	_bust.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_bust.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_bust.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bust.visible = false
	_stage_panel.add_child(_bust)
	_stage_panel.move_child(stage_column, -1)
	_placeholder_tag = UiKit.placeholder_tag("PLACEHOLDER BACKGROUND AND BUST")
	stage_column.add_child(_placeholder_tag)
	_bust_letter = UiKit.label("", "", false)
	_bust_letter.add_theme_font_size_override("font_size", 220)
	_bust_letter.add_theme_color_override("font_color", UiTheme.PANEL_HOVER)
	_bust_letter.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stage_column.add_child(_bust_letter)
	_emotion_label = UiKit.label("", UiTheme.DIM, false)
	_emotion_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stage_column.add_child(_emotion_label)
	column.add_child(_stage_panel)

	_dialogue_panel = PanelContainer.new()
	_dialogue_panel.custom_minimum_size = Vector2(0, 420)
	_dialogue_panel.gui_input.connect(_on_dialogue_input)
	var dialogue_column: VBoxContainer = UiKit.column(12)
	_dialogue_panel.add_child(dialogue_column)
	_speaker_label = UiKit.label("", UiTheme.TITLE, false)
	_speaker_label.add_theme_font_size_override("font_size", 44)
	dialogue_column.add_child(_speaker_label)
	_dialogue_label = UiKit.label("")
	_dialogue_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	dialogue_column.add_child(_dialogue_label)
	column.add_child(_dialogue_panel)

	var controls: HBoxContainer = UiKit.row(12)
	_back_button = UiKit.button("Back")
	_back_button.pressed.connect(go_back)
	_auto_button = UiKit.button("Auto: Off")
	_auto_button.pressed.connect(cycle_auto_speed)
	_log_button = UiKit.button("Log")
	_log_button.pressed.connect(toggle_log)
	_skip_button = UiKit.button("Skip")
	_skip_button.pressed.connect(ask_skip)
	_next_button = UiKit.button("Next")
	_next_button.pressed.connect(go_next)
	for button: Button in [_back_button, _auto_button, _log_button, _skip_button, _next_button]:
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		controls.add_child(button)
	column.add_child(controls)

	# Skipping asks first, in place of the dialogue (a mistap must not lose a scene's first reading).
	_skip_panel = PanelContainer.new()
	_skip_panel.visible = false
	var skip_column: VBoxContainer = UiKit.column(16)
	_skip_panel.add_child(skip_column)
	skip_column.add_child(UiKit.label("Skip the rest of this scene?"))
	var skip_row: HBoxContainer = UiKit.row(12)
	var confirm: Button = UiKit.button("Skip scene")
	confirm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	confirm.pressed.connect(confirm_skip)
	var keep: Button = UiKit.button("Keep reading")
	keep.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	keep.pressed.connect(cancel_skip)
	skip_row.add_child(confirm)
	skip_row.add_child(keep)
	skip_column.add_child(skip_row)
	column.add_child(_skip_panel)

	# The log sits in the same column (so it respects the safe area) and replaces the stage and the dialogue while it is open.
	_log_panel = PanelContainer.new()
	_log_panel.visible = false
	_log_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var log_column: VBoxContainer = UiKit.column(16)
	_log_panel.add_child(log_column)
	log_column.add_child(UiKit.label("Log", UiTheme.TITLE, false))
	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_log_text = UiKit.label("")
	scroll.add_child(_log_text)
	log_column.add_child(scroll)
	column.add_child(_log_panel)
	column.move_child(_log_panel, 1)

	_auto_timer = Timer.new()
	_auto_timer.one_shot = false
	_auto_timer.timeout.connect(_auto_tick)
	add_child(_auto_timer)


## Loads one scene record (`lines`, or `pre_battle_lines` / `post_battle_lines`, in that order). False (and `error`) when the record cannot be
## shown; the screen then keeps what it had.
func load_scene(scene: Dictionary) -> bool:
	ensure_built()
	var flat: Array[Dictionary] = []
	error = ""
	for field: String in LINE_FIELDS:
		var value: Variant = scene.get(field)
		if value == null:
			continue
		if not (value is Array):
			error = "scene field '%s' must be a list of line records" % field
			return false
		for index: int in range((value as Array).size()):
			var line: Variant = (value as Array)[index]
			if not (line is Dictionary):
				error = "scene field '%s'[%d] must be an object" % [field, index]
				return false
			if not ((line as Dictionary).get("text_en") is String):
				error = "scene field '%s'[%d] is missing text_en" % [field, index]
				return false
			flat.append(line)
	if flat.is_empty():
		error = "scene contains no English dialogue lines"
		return false
	_stop_auto()
	_lines = flat
	_index = 0
	_done = false
	if _log_panel.visible:
		toggle_log()
	cancel_skip()
	Audio.apply_scene_audio(scene)
	_title_label.text = LocalizedText.pick(scene, "title")
	var location: String = str(scene.get("location_id", ""))
	_background_reference = "background/%s/story" % location if not location.is_empty() else ""
	_show_art(_background, _background_reference)
	_show_line()
	return true


func line_count() -> int:
	return _lines.size()


func line_index() -> int:
	return _index


func speaker_text() -> String:
	return _speaker_label.text


func dialogue_text() -> String:
	return _dialogue_label.text


func auto_speed() -> int:
	return _auto_speed


func is_log_open() -> bool:
	return _log_panel.visible


## The asset references the current scene and line ask for ("" = none), and whether real art shows (not the placeholder).
func background_reference() -> String:
	return _background_reference


func bust_reference() -> String:
	return _bust_reference


func shows_background_art() -> bool:
	return _background.visible


func shows_bust_art() -> bool:
	return _bust.visible


func _resolver() -> AssetResolver:
	return assets if assets != null else Game.assets


## Shows `reference`'s art in `target`, or hides it when there is none (the placeholder panel shows through).
func _show_art(target: TextureRect, reference: String) -> void:
	var resolver: AssetResolver = _resolver()
	var present: bool = not reference.is_empty() and resolver.has_art(reference)
	target.texture = resolver.texture(reference) if present else null
	target.visible = present
	_placeholder_tag.visible = not (_background.visible and _bust.visible)


func _show_line() -> void:
	if _lines.is_empty():
		return
	var line: Dictionary = _lines[_index]
	var speaker: String = str(line.get("speaker_display", "")) if not str(line.get("speaker_display", "")).is_empty() else str(line.get("speaker_id", ""))
	_speaker_label.text = speaker
	_dialogue_label.text = LocalizedText.pick(line, "text")
	Audio.apply_line_audio(line.get("audio"))
	voiced = Audio.play_voice(str(line.get("speaker_id", "")), str(line.get("line_id", "")))
	var speaker_id: String = str(line.get("speaker_id", "")).trim_suffix("_thought")
	# Speakers without character art (narrator, enemies, extras) ask for none: only roster characters have busts.
	_bust_reference = "character/%s/vn_bust" % speaker_id
	if speaker_id.is_empty() or not _resolver().catalog.has(_bust_reference):
		_bust_reference = ""
	_show_art(_bust, _bust_reference)
	_bust_letter.text = speaker.left(1).to_upper() if not _bust.visible else ""
	var emotion: String = str(line.get("emotion", ""))
	_emotion_label.text = "[%s]" % emotion if not emotion.is_empty() else ""
	_back_button.disabled = _index == 0
	_next_button.text = "Finish" if _index == _lines.size() - 1 else "Next"
	if _log_panel.visible:
		_refresh_log()


func go_next() -> void:
	if _lines.is_empty():
		return
	if _index + 1 < _lines.size():
		_index += 1
		_show_line()
	else:
		_finish()


## Asks to skip the rest of the scene (the dialogue gives way to the question until it is answered).
func ask_skip() -> void:
	if _lines.is_empty() or _done:
		return
	_stop_auto()
	_skip_panel.visible = true
	_dialogue_panel.visible = false


func cancel_skip() -> void:
	if _skip_panel == null:
		return
	_skip_panel.visible = false
	_dialogue_panel.visible = not _log_panel.visible


func is_skip_asked() -> bool:
	return _skip_panel.visible


func confirm_skip() -> void:
	if not _skip_panel.visible:
		return
	cancel_skip()
	_finish()


func go_back() -> void:
	if _index > 0:
		_index -= 1
		_show_line()


## Off, 1x, 2x, 3x: a full line takes `BASE_AUTO_SECONDS / speed`.
func cycle_auto_speed() -> void:
	var current: int = SPEED_STEPS.find(_auto_speed)
	_auto_speed = SPEED_STEPS[(current + 1) % SPEED_STEPS.size()]
	_auto_button.text = "Auto: %dx" % _auto_speed if _auto_speed > 0 else "Auto: Off"
	if _auto_speed > 0:
		_auto_timer.start(BASE_AUTO_SECONDS / float(_auto_speed))
	else:
		_auto_timer.stop()


func toggle_log() -> void:
	if _skip_panel.visible:
		cancel_skip()
	_log_panel.visible = not _log_panel.visible
	_stage_panel.visible = not _log_panel.visible
	_dialogue_panel.visible = not _log_panel.visible
	if _log_panel.visible:
		_refresh_log()


func _refresh_log() -> void:
	var rows: PackedStringArray = PackedStringArray()
	for index: int in range(_index + 1):
		var line: Dictionary = _lines[index]
		var speaker: String = str(line.get("speaker_display", ""))
		var text: String = LocalizedText.pick(line, "text")
		rows.append(("%s: %s" % [speaker, text]) if not speaker.is_empty() else text)
	_log_text.text = "\n\n".join(rows)


func _auto_tick() -> void:
	if _auto_speed == 0 or _lines.is_empty():
		_stop_auto()
		return
	go_next()


func _stop_auto() -> void:
	_auto_speed = 0
	if _auto_button != null:
		_auto_button.text = "Auto: Off"
	if _auto_timer != null:
		_auto_timer.stop()


func _exit_tree() -> void:
	Audio.stop_voice()


func _finish() -> void:
	_stop_auto()
	Audio.stop_voice()
	if _done:
		return
	_done = true
	finished.emit()


func _on_dialogue_input(event: InputEvent) -> void:
	var click: InputEventMouseButton = event as InputEventMouseButton
	if click != null and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		go_next()


func handle_back() -> bool:
	if _skip_panel != null and _skip_panel.visible:
		cancel_skip()
		return true
	if _log_panel != null and _log_panel.visible:
		toggle_log()
		return true
	if _index > 0:
		go_back()
		return true
	return false
