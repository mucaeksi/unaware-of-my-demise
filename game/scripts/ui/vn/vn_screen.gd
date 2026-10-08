class_name VnScreen
extends UiScreen
## The Visual Novel reader: one scene at a time, with Back, Next, normal-speed Auto and a log.
## Art comes from the asset resolver (INF-024): the scene's `location_id` names the background ("background/<id>/story") and the speaker
## the bust ("character/<id>/vn_bust"). Where the art is not shipped yet, a tinted panel stands in (the speaker's initial and the line's
## `emotion`) and says so. Story text is English regardless of the device locale; a line with a recording
## plays it on the Voice bus (`Audio.play_voice(speaker_id, line_id)`), and leaving the line or the screen stops it.
## `finished` fires once after the final line. Every line is read with typewriter text; Next reveals it first. Story cues (docs/design/FIRST_LAUNCH_FLOW.md): the scene's music_cue_id/ambience_cue_id start with it, a line's `audio`
## changes play when the line shows.

signal finished

const BASE_AUTO_SECONDS: float = 3.2
const MIN_LINE_SECONDS: float = 5.5
const CHARACTERS_PER_SECOND: float = 26.0
const SPEAKER_PAUSE_SECONDS: float = 1.0
const SAME_SPEAKER_PAUSE_SECONDS: float = 0.65
const ART_DISSOLVE_SECONDS: float = 0.8
const LINE_FIELDS: Array[String] = ["pre_battle_lines", "lines", "battle_lines", "post_battle_lines"]

func _uses_ambient_backdrop() -> bool:
	return false

## Why the last `load_scene` was refused ("" = it was not).
var error: String = ""
## Where art comes from; null = the app's (`Game.assets`). Tests set their own before the screen is built.
var assets: AssetResolver = null
## Whether the current line's recording started (false: text only).
var voiced: bool = false
## Optional local audition source. Default production playback still uses stable
## shipped voice paths. A preview stream shares the normal Voice bus/lifecycle.
var voice_stream_resolver: Callable = Callable()
## Visual-only local review can defer all audio without changing shipped takes.
var audio_enabled: bool = true

var _lines: Array[Dictionary] = []
var _index: int = 0
var _auto_speed: int = 0
var _done: bool = false

var _title_label: Label = null
var _stage_panel: PanelContainer = null
var _background: TextureRect = null
var _bust: TextureRect = null
var _outgoing_bust: TextureRect = null
var _illustration: Texture2D = null
var _last_speaker: String = ""
var _intro_clock: float = 0.0
var _intro_duration: float = 0.0
var _closing_hold: float = 3.5
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
var _reveal_clock: float = 0.0
var _read_hold: float = 0.0
var _voice_duration: float = 0.0
var _revealed: float = 0.0
var _voice_pending: bool = false
var _pending_audition: AudioStream
var _log_panel: PanelContainer = null
var _log_text: Label = null
var _auto_timer: Timer = null
var _reader_progress: Label
var _controls_grid: GridContainer
var _readability_scale: float = 0.0


func _ready() -> void:
	super._ready()
	theme_changed.connect(_queue_readability)
	resized.connect(_queue_readability)
	body.resized.connect(_queue_readability)
	_refresh_readability()
	if _auto_speed == 1:
		_auto_timer.start()


func _build(column: VBoxContainer) -> void:
	var header: HBoxContainer = UiKit.row(24)
	_title_label = UiKit.label("", UiTheme.DIM)
	BattleHudStyle.label(_title_label,30,BattleHudStyle.BONE)
	header.add_child(_title_label)
	_reader_progress = UiKit.label("", "", false)
	_reader_progress.size_flags_horizontal = Control.SIZE_SHRINK_END
	_reader_progress.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	BattleHudStyle.label(_reader_progress,24,BattleHudStyle.MUTED)
	header.add_child(_reader_progress)
	column.add_child(header)

	_stage_panel = PanelContainer.new()
	_stage_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_stage_panel.add_theme_stylebox_override("panel",UiTheme.box(Color(0.035,0.025,0.055,0.40),12,Color(0.5,0.4,0.6,0.2),1,0,0))
	var stage_column: VBoxContainer = UiKit.column(8)
	stage_column.alignment = BoxContainer.ALIGNMENT_CENTER
	_stage_panel.add_child(stage_column)
	_background = TextureRect.new()
	_background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_background.visible = false
	_background.modulate.a = 0.45
	_stage_panel.add_child(_background)
	_bust = TextureRect.new()
	_bust.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_bust.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_bust.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_bust.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bust.visible = false
	_stage_panel.add_child(_bust)
	_outgoing_bust = TextureRect.new()
	_outgoing_bust.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_outgoing_bust.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_outgoing_bust.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_outgoing_bust.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_outgoing_bust.hide()
	_stage_panel.add_child(_outgoing_bust)
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
	_dialogue_panel.custom_minimum_size = Vector2(0, 310)
	_dialogue_panel.add_theme_stylebox_override("panel",BattleHudStyle.frame(BattleHudStyle.EDGE,0.78,28))
	_dialogue_panel.gui_input.connect(_on_dialogue_input)
	var dialogue_column: VBoxContainer = UiKit.column(12)
	_dialogue_panel.add_child(dialogue_column)
	_speaker_label = UiKit.label("", UiTheme.TITLE, false)
	BattleHudStyle.label(_speaker_label,36,BattleHudStyle.LIGHT_EDGE)
	dialogue_column.add_child(_speaker_label)
	_dialogue_label = UiKit.label("")
	BattleHudStyle.label(_dialogue_label,38)
	_dialogue_label.add_theme_constant_override("line_spacing",8)
	_dialogue_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	dialogue_column.add_child(_dialogue_label)
	column.add_child(_dialogue_panel)

	_controls_grid = GridContainer.new()
	_controls_grid.columns = 4
	_controls_grid.add_theme_constant_override("h_separation",12)
	_controls_grid.add_theme_constant_override("v_separation",12)
	_back_button = UiKit.button("Back")
	_back_button.pressed.connect(go_back)
	# An inline selection icon keeps this compact toggle separate from the
	# generic tall GothicActionButton's engraved selection edge.
	_auto_button = Button.new()
	_auto_button.language = "en"
	_auto_button.text = "Auto"
	_auto_button.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_auto_button.expand_icon = true
	_auto_button.toggle_mode = true
	_auto_button.pressed.connect(cycle_auto_speed)
	_log_button = Button.new()
	_log_button.language = "en"
	_log_button.text = "Log"
	_log_button.toggle_mode = true
	_log_button.pressed.connect(toggle_log)
	_next_button = UiKit.button("Next",false,UiTheme.PRIMARY)
	_next_button.pressed.connect(go_next)
	for button: Button in [_back_button, _auto_button, _log_button, _next_button]:
		BattleHudStyle.action(button,button == _next_button)
		_controls_grid.add_child(button)
	column.add_child(_controls_grid)

	# The log sits in the same column (so it respects the safe area) and replaces the stage and the dialogue while it is open.
	_log_panel = PanelContainer.new()
	_log_panel.add_theme_stylebox_override("panel",BattleHudStyle.frame())
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
	_auto_timer.wait_time = 0.1
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
	_last_speaker = ""
	_closing_hold = maxf(BASE_AUTO_SECONDS, float(scene.get("closing_hold_seconds", 3.5)))
	_illustration = BattleArt.illustration(str(scene.get("illustration_id", ""))) if assets == null else null
	if _log_panel.visible:
		toggle_log()
	if audio_enabled:
		Audio.apply_scene_audio(scene)
	_title_label.text = LocalizedText.pick(scene, "title", "en")
	var location: String = str(scene.get("location_id", ""))
	_background_reference = "background/%s/story" % location if not location.is_empty() else ""
	_show_art(_background, _background_reference)
	if assets == null and not _background.visible:
		var candidate_background: Texture2D = BattleArt.background(location)
		if candidate_background != null:
			_background.texture = candidate_background
			_background.visible = true
	_show_line()
	_set_auto(true)
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
	_placeholder_tag.visible = assets != null and not (_background.visible and _bust.visible)


func _show_line() -> void:
	if _lines.is_empty():
		return
	var line: Dictionary = _lines[_index]
	var old_art: Texture2D = _bust.texture if _bust.visible else null
	var old_stretch: TextureRect.StretchMode = _bust.stretch_mode
	var next_speaker: String = str(line.get("speaker_id", ""))
	_intro_clock = 0.0
	_intro_duration = (SPEAKER_PAUSE_SECONDS if next_speaker != _last_speaker else SAME_SPEAKER_PAUSE_SECONDS) if _index > 0 else 0.0
	_last_speaker = next_speaker
	var speaker: String = str(line.get("speaker_display", "")) if not str(line.get("speaker_display", "")).is_empty() else str(line.get("speaker_id", ""))
	_speaker_label.text = speaker
	var tone: Color = Color("#bda5e3") if next_speaker.begins_with("fadyme") else (Color("#d1b57f") if next_speaker.begins_with("mahmut") else BattleHudStyle.LIGHT_EDGE)
	_speaker_label.add_theme_color_override("font_color",tone)
	_dialogue_panel.add_theme_stylebox_override("panel",BattleHudStyle.frame(tone,0.78,28))
	_reader_progress.text = "%02d / %02d" % [_index + 1,_lines.size()]
	_dialogue_label.text = LocalizedText.pick(line, "text", "en")
	if audio_enabled:
		Audio.apply_line_audio(line.get("audio"))
	var speaker_key: String = str(line.get("speaker_id", ""))
	var line_key: String = str(line.get("line_id", ""))
	var audition: AudioStream = voice_stream_resolver.call(speaker_key, line_key) as AudioStream if audio_enabled and voice_stream_resolver.is_valid() else null
	Audio.stop_voice()
	_pending_audition = audition
	_voice_pending = audio_enabled
	voiced = false
	_voice_duration = 0.0
	_reveal_clock = 0.0
	_read_hold = 0.0
	_revealed = 0.0
	_dialogue_label.visible_characters = 0
	set_process(true)
	if not audio_enabled:
		Audio.stop_voice()
	var speaker_id: String = str(line.get("speaker_id", "")).trim_suffix("_thought")
	# Speakers without character art (narrator, enemies, extras) ask for none: only roster characters have busts.
	_bust_reference = "character/%s/vn_bust" % speaker_id
	if speaker_id.is_empty() or not _resolver().catalog.has(_bust_reference):
		_bust_reference = ""
	_show_art(_bust, _bust_reference)
	# The shipped Fadyme expression set follows authored emotions; tests/tooling
	# with an injected asset resolver keep their isolated catalog contract.
	var expression: Texture2D = BattleArt.portrait(speaker_id, str(line.get("emotion", ""))) if assets == null else null
	if expression != null:
		_bust.texture = expression
		_bust.visible = true
		_placeholder_tag.visible = assets != null and not _background.visible
	_bust.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if _illustration != null:
		_bust.texture = _illustration
		_bust.visible = true
		_bust.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		_placeholder_tag.hide()
	_outgoing_bust.texture = old_art
	_outgoing_bust.stretch_mode = old_stretch
	_outgoing_bust.visible = old_art != null and old_art != _bust.texture and _intro_duration > 0.0
	_outgoing_bust.modulate.a = 1.0
	_bust.modulate.a = 0.0 if _outgoing_bust.visible else 1.0
	_bust_letter.text = speaker.left(1).to_upper() if not _bust.visible else ""
	var emotion: String = str(line.get("emotion", ""))
	_emotion_label.text = "[%s]" % emotion if not emotion.is_empty() and not _bust.visible else ""
	_back_button.disabled = _index == 0
	_next_button.text = "Finish" if _index == _lines.size() - 1 else "Next"
	if _log_panel.visible:
		_refresh_log()


func go_next() -> void:
	if _lines.is_empty() or _done:
		return
	if not reveal_complete():
		reveal_all()
		return
	if _index + 1 < _lines.size():
		_index += 1
		_show_line()
	else:
		_finish()


func go_back() -> void:
	if _index > 0:
		_index -= 1
		_show_line()


## Compatibility entry point: Auto is a single normal-speed on/off toggle.
func cycle_auto_speed() -> void:
	_set_auto(_auto_speed == 0)

func _set_auto(enabled: bool) -> void:
	_auto_speed = 1 if enabled else 0
	_auto_button.text = "Auto"
	_auto_button.button_pressed = enabled
	_auto_button.icon = UiTheme.GothicTheme.icon("checked") if enabled else null
	_auto_button.tooltip_text = "Auto advance enabled · Normal speed" if enabled else "Auto advance paused"
	# load_scene can build a reader before StoryDirector attaches it to the tree.
	_auto_timer.autostart = enabled
	if enabled and _auto_timer.is_inside_tree():
		_auto_timer.start()
	else:
		_auto_timer.stop()


func toggle_log() -> void:
	_log_panel.visible = not _log_panel.visible
	_log_button.set_pressed_no_signal(_log_panel.visible)
	_stage_panel.visible = not _log_panel.visible
	_dialogue_panel.visible = not _log_panel.visible
	if _log_panel.visible:
		_refresh_log()


func _refresh_log() -> void:
	var rows: PackedStringArray = PackedStringArray()
	for index: int in range(_index + 1):
		var line: Dictionary = _lines[index]
		var speaker: String = str(line.get("speaker_display", ""))
		var text: String = LocalizedText.pick(line, "text", "en")
		rows.append(("%s: %s" % [speaker, text]) if not speaker.is_empty() else text)
	_log_text.text = "\n\n".join(rows)


func _auto_tick() -> void:
	if _auto_speed == 0 or _lines.is_empty():
		_stop_auto()
		return
	var hold: float = maxf(BASE_AUTO_SECONDS, float(_lines[_index].get("hold_seconds", BASE_AUTO_SECONDS)))
	if _index == _lines.size() - 1: hold = maxf(hold, _closing_hold)
	if _log_panel.visible or _intro_clock < _intro_duration or not reveal_complete() or _read_hold < hold or _reveal_clock < MIN_LINE_SECONDS: return
	# Auto never truncates a Japanese performance, even after subtitle reveal.
	if voiced and Audio.is_voice_playing():
		return
	go_next()


func _stop_auto() -> void:
	_auto_speed = 0
	if _auto_button != null:
		_auto_button.text = "Auto"
		_auto_button.button_pressed = false
		_auto_button.icon = null
	if _auto_timer != null:
		_auto_timer.autostart = false
		_auto_timer.stop()


func _exit_tree() -> void:
	Audio.stop_voice()


func _finish() -> void:
	_stop_auto()
	Audio.stop_voice()
	if _done:
		return
	_done = true
	set_process(false)
	finished.emit()


func _on_dialogue_input(event: InputEvent) -> void:
	var click: InputEventMouseButton = event as InputEventMouseButton
	if click != null and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		go_next()


func handle_back() -> bool:
	if _log_panel != null and _log_panel.visible:
		toggle_log()
		return true
	if _index > 0:
		go_back()
		return true
	return false

func reveal_complete() -> bool:
	return _dialogue_label.visible_characters < 0 or _dialogue_label.visible_characters >= _dialogue_label.text.length()

func reveal_all() -> void:
	_intro_clock = _intro_duration
	_update_art_dissolve()
	_revealed = float(_dialogue_label.text.length())
	_dialogue_label.visible_characters = -1

func visible_dialogue_text() -> String:
	return _dialogue_label.text if reveal_complete() else _dialogue_label.text.left(_dialogue_label.visible_characters)

func _process(delta: float) -> void:
	advance_reader(delta)

## Subtitle timing uses the recording clock when present. Final Japanese takes
## can provide subtitle_cues [{time,characters}], otherwise duration scales reveal.
func advance_reader(delta: float) -> void:
	if _done or _lines.is_empty() or _log_panel.visible or UiPageTransition.is_revealing(self): return
	var remaining: float = maxf(0.0, delta)
	if _intro_clock < _intro_duration:
		var consumed: float = minf(remaining, _intro_duration - _intro_clock)
		_intro_clock += consumed
		remaining -= consumed
		_update_art_dissolve()
		if _intro_clock < _intro_duration: return
	if _voice_pending:
		var line: Dictionary = _lines[_index]
		voiced = Audio.play_voice(str(line.get("speaker_id","")),str(line.get("line_id","")),_pending_audition)
		_voice_duration = Audio.voice_duration_seconds() if voiced else 0.0
		_voice_pending = false
	_reveal_clock += remaining
	if not reveal_complete():
		var count: int = _dialogue_label.text.length()
		var desired: float = _reveal_clock*CHARACTERS_PER_SECOND
		if voiced and _voice_duration > 0.0:
			var position_seconds: float = Audio.voice_position_seconds()
			desired = float(count)*clampf(position_seconds/maxf(0.1,_voice_duration-0.15),0,1)
			var cues: Array = _lines[_index].get("subtitle_cues",[])
			for cue: Dictionary in cues:
				if position_seconds >= float(cue.get("time",0)): desired = float(cue.get("characters",0))
			if not Audio.is_voice_playing(): desired = float(count)
		_revealed = clampf(maxf(_revealed,desired),0,float(count))
		_dialogue_label.visible_characters = int(_revealed)
		if reveal_complete(): _read_hold = 0.0
	elif not voiced or not Audio.is_voice_playing():
		_read_hold += remaining

func _update_art_dissolve() -> void:
	if not _outgoing_bust.visible: return
	var progress: float = 1.0 if UiPageTransition.reduced_for(self) else smoothstep(0.0, ART_DISSOLVE_SECONDS, _intro_clock)
	_outgoing_bust.modulate.a = 1.0 - progress
	_bust.modulate.a = progress
	if progress >= 1.0:
		_outgoing_bust.hide()
		_outgoing_bust.texture = null

func _queue_readability() -> void:
	call_deferred("_refresh_readability")

func _refresh_readability() -> void:
	if _controls_grid == null: return
	var font_scale: float = BattleHudStyle.text_scale(self)
	_controls_grid.columns = 2 if body.size.x < (960.0 if font_scale > 1.0 else 840.0) else 4
	if is_equal_approx(font_scale,_readability_scale): return
	_readability_scale = font_scale
	BattleHudStyle.label(_title_label,roundi(30 * font_scale),BattleHudStyle.BONE)
	BattleHudStyle.label(_reader_progress,roundi(24 * font_scale),BattleHudStyle.MUTED)
	_speaker_label.add_theme_font_size_override("font_size",roundi(36 * font_scale))
	_dialogue_label.add_theme_font_size_override("font_size",roundi(38 * font_scale))
	_dialogue_panel.custom_minimum_size.y = 310 * font_scale
	for button: Button in [_back_button,_auto_button,_log_button,_next_button]:
		button.add_theme_font_size_override("font_size",roundi(32 * font_scale))
