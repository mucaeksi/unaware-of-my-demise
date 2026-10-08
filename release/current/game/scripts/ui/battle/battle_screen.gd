class_name BattleScreen
extends UiScreen
## Live encounters and archived replays share the Action Gauge presentation.
## Basic/Active automate; a live Ultimate requires player input.
## This screen owns chapter-gated speed, character HUDs and illustrated cut-ins.
##
## `show_loading` covers the time the battle runs on its worker thread; `play` starts the replay; `finished` fires when the player presses
## Continue after the result is shown (never before, and never if the screen is just left).

signal finished

const BASE_INTERVAL: float = 0.05
const SPEEDS: Array[int] = [1, 2]
const LOG_LINES_SHOWN: int = 2
const SkillTray = preload("res://scripts/ui/battle/battle_skill_tray.gd")
const LivePlayback = preload("res://scripts/ui/battle/live_battle_playback.gd")
const UltimatePresentation = preload("res://scripts/ui/battle/ultimate_presentation.gd")

func _uses_ambient_backdrop() -> bool:
	return false

var playback: BattlePlayback = null

var _speed_index: int = 0
var _double_speed_unlocked: bool = false
var _cards: Dictionary = {}
var _timer: Timer = null
var _header_label: Label = null
var _round_label: Label = null
var _loading_label: Label = null
var _field: VBoxContainer = null
var _banner_label: Label = null
var _arena: BattleField = null
var _log_label: Label = null
var _floaters: Control = null
var _controls: PanelContainer = null
var _speed_button: Button = null
var _speed_hint: Label = null
var _speed_captions: VBoxContainer = null
var _result_label: Label = null
var _continue_button: Button = null
var _skill_tray: SkillTray = null
var _last_tick_ms: int = 0
var _settle_left: float = 0.0
var _cinematic: UltimatePresentation
var _casting: bool = false
var _party_hint: Label
var _speed_title: Label
var _readability_scale: float = 0.0

func _ready() -> void:
	super._ready()
	theme_changed.connect(_queue_readability)
	_refresh_readability()


func _build(column: VBoxContainer) -> void:
	var header: HBoxContainer = UiKit.row(12)
	_header_label = UiKit.label("", UiTheme.TITLE, false)
	_header_label.add_theme_font_size_override("font_size", 36)
	_header_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_header_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(_header_label)
	_round_label = UiKit.label("", UiTheme.DIM, false)
	_round_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	BattleHudStyle.label(_round_label, 26, BattleHudStyle.MUTED)
	_round_label.size_flags_horizontal = Control.SIZE_SHRINK_END
	header.add_child(_round_label)
	column.add_child(header)

	_loading_label = UiKit.label("The battle is under way...", UiTheme.DIM)
	_loading_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_loading_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_loading_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	column.add_child(_loading_label)

	_field = UiKit.column(16)
	_field.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_field.visible = false
	column.add_child(_field)
	_banner_label = UiKit.label("", UiTheme.DANGER_LABEL)
	BattleHudStyle.label(_banner_label, 28, BattleHudStyle.ENEMY)
	_banner_label.custom_minimum_size = Vector2(0, 96)
	_banner_label.max_lines_visible = 2
	_banner_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_banner_label.visible = false
	_field.add_child(_banner_label)
	_arena = BattleField.new()
	_arena.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_arena.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_arena.custom_minimum_size = Vector2(0, 580)
	var arena_frame: PanelContainer = PanelContainer.new()
	arena_frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	arena_frame.add_theme_stylebox_override("panel", BattleHudStyle.frame(BattleHudStyle.EDGE, 0.96, 4))
	arena_frame.add_child(_arena)
	_field.add_child(arena_frame)

	_log_label = UiKit.label("", UiTheme.DIM)
	_log_label.custom_minimum_size = Vector2(0, 80)
	_log_label.add_theme_font_size_override("font_size", 28)
	_log_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	_log_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_log_label.visible = false
	column.add_child(_log_label)
	_skill_tray = SkillTray.new()
	_skill_tray.custom_minimum_size.y = 220
	_skill_tray.ultimate_requested.connect(request_ultimate)
	_skill_tray.visible = false
	var party_panel: PanelContainer = PanelContainer.new()
	party_panel.add_theme_stylebox_override("panel",BattleHudStyle.frame(BattleHudStyle.EDGE,0.88,20))
	var party_column: VBoxContainer = UiKit.column(14)
	party_panel.add_child(party_column)
	_party_hint = UiKit.label("ULTIMATES  ·  Tap a glowing portrait", "", false)
	BattleHudStyle.label(_party_hint,24,BattleHudStyle.MUTED)
	_party_hint.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	party_column.add_child(_party_hint)
	party_column.add_child(_skill_tray)
	column.add_child(party_panel)
	# Loading screens do not reserve a blank party frame.
	_skill_tray.visibility_changed.connect(func() -> void: party_panel.visible = _skill_tray.visible)
	party_panel.hide()

	_controls = PanelContainer.new()
	_controls.add_theme_stylebox_override("panel", BattleHudStyle.panel())
	var control_row: HBoxContainer = UiKit.row(24)
	_controls.add_child(control_row)
	_speed_captions = UiKit.column(8)
	_speed_captions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_speed_captions.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	control_row.add_child(_speed_captions)
	_speed_title = UiKit.label("BATTLE SPEED", "", false)
	BattleHudStyle.label(_speed_title, 24, BattleHudStyle.LIGHT_EDGE)
	_speed_captions.add_child(_speed_title)
	_speed_hint = UiKit.label("", "", true)
	BattleHudStyle.label(_speed_hint, 26, BattleHudStyle.MUTED)
	_speed_captions.add_child(_speed_hint)
	_speed_button = UiKit.button("×1")
	BattleHudStyle.speed(_speed_button)
	_speed_button.pressed.connect(cycle_speed)
	control_row.add_child(_speed_button)
	_controls.visible = false
	column.add_child(_controls)

	_result_label = UiKit.label("", UiTheme.TITLE)
	BattleHudStyle.label(_result_label, 32, BattleHudStyle.BONE)
	_result_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_result_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_result_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_result_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_result_label.visible = false
	control_row.add_child(_result_label)
	_continue_button = UiKit.button(tr("Continue"), false, UiTheme.PRIMARY)
	BattleHudStyle.action(_continue_button,true)
	_continue_button.custom_minimum_size.x = 280
	_continue_button.add_theme_font_size_override("font_size", 32)
	_continue_button.visible = false
	_continue_button.pressed.connect(func() -> void: finished.emit())
	control_row.add_child(_continue_button)

	_floaters = Control.new()
	_floaters.set_anchors_preset(Control.PRESET_FULL_RECT)
	_floaters.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_floaters.z_index = 2000
	add_child(_floaters)
	_cinematic = UltimatePresentation.new()
	_cinematic.z_index = 2100
	_cinematic.impact.connect(_ultimate_impact)
	add_child(_cinematic)
	_timer = Timer.new()
	_timer.one_shot = false
	_timer.timeout.connect(_tick)
	add_child(_timer)
	_refresh_speed_control()

func _queue_readability() -> void:
	call_deferred("_refresh_readability")

func _refresh_readability() -> void:
	if _party_hint == null: return
	var font_scale: float = BattleHudStyle.text_scale(self)
	if is_equal_approx(font_scale,_readability_scale): return
	_readability_scale = font_scale
	for label_info: Array in [[_header_label,36],[_round_label,26],[_party_hint,24],[_speed_title,24],[_speed_hint,26],[_result_label,32],[_log_label,28]]:
		(label_info[0] as Label).add_theme_font_size_override("font_size",roundi(int(label_info[1])*font_scale))
	_continue_button.add_theme_font_size_override("font_size",roundi(32*font_scale))
	_speed_button.add_theme_font_size_override("font_size",roundi(38*font_scale))
	_skill_tray.apply_text_scale(font_scale)


## Called at battle entry, before rewards can advance the saved story state.
func configure_progress(story: StoryState.PlayerStoryState, registry: ContentModels.ContentRegistry) -> void:
	_double_speed_unlocked = BattleSpeedPolicy.double_speed_unlocked(story, registry)
	if not _double_speed_unlocked:
		_speed_index = 0
	if _speed_button != null:
		_refresh_speed_control()


func _refresh_speed_control() -> void:
	_speed_button.text = "×%d" % speed()
	_speed_button.disabled = not _double_speed_unlocked
	_speed_button.icon = null if _double_speed_unlocked else UiTheme.GothicTheme.icon("lock")
	_speed_button.tooltip_text = "Switch between ×1 and ×2" if _double_speed_unlocked else "Complete Chapter 3 to unlock ×2"
	_speed_hint.text = "Tap to switch between ×1 and ×2" if _double_speed_unlocked else "×2 unlocks after Chapter 3"


## The battle is running on its worker thread.
func show_loading(stage_title: String) -> void:
	ensure_built()
	_stop()
	playback = null
	_header_label.text = stage_title
	_round_label.text = ""
	_loading_label.visible = true
	_field.visible = false
	_log_label.visible = false
	_controls.visible = false
	_skill_tray.visible = false
	_result_label.visible = false
	_continue_button.visible = false


## Starts a live encounter or an archived replay.
func play(new_playback: BattlePlayback, stage_title: String = "", environment_id: String = "forest_whispering_ash") -> void:
	ensure_built()
	_stop()
	playback = new_playback
	playback.prepare_identities()
	_settle_left = 0.0
	_speed_index = 0
	_refresh_speed_control()
	if not stage_title.is_empty():
		_header_label.text = stage_title
	UiKit.clear(_floaters)
	_cards.clear()
	_arena.populate(playback.units, environment_id)
	_skill_tray.setup(playback)
	_skill_tray.visible = true
	for view: BattlePlayback.UnitView in playback.units:
		var actor: BattleActor = _arena.actors[view.entity_id]
		_cards[view.entity_id] = actor.card
	_loading_label.visible = false
	_field.visible = true
	_log_label.visible = true
	_controls.visible = true
	_speed_captions.visible = true
	_speed_button.visible = true
	_result_label.visible = false
	_continue_button.visible = false
	_update_status()
	if playback.is_finished():
		_show_result()
	else:
		_last_tick_ms = Time.get_ticks_msec()
		_timer.start(BASE_INTERVAL)
		if _double_speed_unlocked:
			call_deferred("_focus_speed")


func speed() -> int:
	return SPEEDS[_speed_index]


func is_playing() -> bool:
	return playback != null and not playback.is_finished()


func card(entity_id: String) -> UnitCard:
	return _cards.get(entity_id)


func log_text() -> String:
	return _log_label.text


func result_text() -> String:
	return _result_label.text


func banner_text() -> String:
	return _banner_label.text if _banner_label.visible else ""


func can_continue() -> bool:
	return _continue_button.visible


func press_continue() -> void:
	if _continue_button.visible:
		finished.emit()


## Applies one event of the replay (the timer calls this; tests too).
func step() -> void:
	if playback == null or playback.is_finished():
		return
	var cues: Array[BattlePlayback.Cue] = playback.apply_next()
	_refresh_cards()
	for cue: BattlePlayback.Cue in cues:
		_show_cue(cue)
	_update_status()
	if playback.is_finished():
		_show_result()


func _tick() -> void:
	var now: int = Time.get_ticks_msec()
	var delta: float = float(now - _last_tick_ms) / 1000.0
	_last_tick_ms = now
	advance_time(delta * effective_pace())

func effective_pace() -> float:
	return 0.1 if _casting else float(speed())

func request_ultimate(entity_id: String) -> void:
	if _casting or not playback is LivePlayback or not playback.can_cast_ultimate(entity_id): return
	_casting = true
	_skill_tray.casting = true
	_skill_tray.refresh()
	_speed_button.disabled = true
	for actor: BattleActor in _arena.actors.values(): actor.set_pace(0.1)
	_cinematic.begin(playback.unit(entity_id))

func _ultimate_impact(entity_id: String) -> void:
	_casting = false
	_skill_tray.casting = false
	_refresh_speed_control()
	for actor: BattleActor in _arena.actors.values(): actor.set_pace(float(speed()))
	if playback is LivePlayback:
		(playback as LivePlayback).cast_ultimate(entity_id)
		advance_time(0.0)


## One shared clock; all due actors/effects advance in a batch, independent of
## how many animation cues or damage lines a skill produces.
func advance_time(seconds: float) -> void:
	if playback == null: return
	if _settle_left > 0.0:
		_settle_left = maxf(0.0, _settle_left - seconds)
		if _settle_left <= 0.0: _show_result()
		return
	if playback.is_finished(): return
	var cues: Array[BattlePlayback.Cue] = playback.advance(seconds)
	_round_label.text = "%02d:%02d" % [int(playback.elapsed_seconds / 60.0), int(playback.elapsed_seconds) % 60]
	if not cues.is_empty():
		_refresh_cards()
		for cue: BattlePlayback.Cue in cues: _show_cue(cue)
		_update_status()
	_skill_tray.refresh()
	if playback.is_finished(): _settle_left = 1.6


func cycle_speed() -> void:
	if _casting or not _double_speed_unlocked or not is_playing():
		return
	_speed_index = (_speed_index + 1) % SPEEDS.size()
	_refresh_speed_control()
	for actor: BattleActor in _arena.actors.values(): actor.set_pace(float(speed()))


func _refresh_cards() -> void:
	_arena.ensure_views(playback.units)
	for view: BattlePlayback.UnitView in playback.units:
		_cards[view.entity_id] = (_arena.actors[view.entity_id] as BattleActor).card
	_arena.refresh(playback.units)
	_skill_tray.refresh()


func _update_status() -> void:
	_round_label.text = "%02d:%02d" % [int(playback.elapsed_seconds / 60.0), int(playback.elapsed_seconds) % 60]
	var has_boss: bool = false
	for view: BattlePlayback.UnitView in playback.units:
		if view.is_boss:
			has_boss = true
	_banner_label.visible = has_boss
	if has_boss:
		var line: String = "Boss phase: %s" % playback.boss_phase_id.replace("_", " ") if not playback.boss_phase_id.is_empty() else "Boss"
		if playback.telegraph_state == BattlePlayback.TELEGRAPH_CHARGING or playback.telegraph_state == BattlePlayback.TELEGRAPH_HELD:
			line += "   |   Charging: %s" % playback.telegraph_action.replace("_", " ")
		elif playback.telegraph_state == BattlePlayback.TELEGRAPH_INTERRUPTED:
			line += "   |   Charge interrupted"
		_banner_label.text = line
	_log_label.text = "\n".join(playback.log_lines.slice(maxi(0, playback.log_lines.size() - LOG_LINES_SHOWN)))


func _show_cue(cue: BattlePlayback.Cue) -> void:
	_arena.cue(cue, effective_pace())
	var target: UnitCard = _cards.get(cue.unit_id)
	match cue.kind:
		BattlePlayback.CUE_DAMAGE:
			_float_text(target, ("-%d!" if cue.critical else "-%d") % cue.amount, UiTheme.DANGER, 56 if cue.critical else 44)
			if target != null:
				target.flash(Color(1.6, 0.7, 0.7))
		BattlePlayback.CUE_BLOCKED:
			_float_text(target, "Block", UiTheme.TEXT_DIM, 40)
		BattlePlayback.CUE_HEAL:
			# A heal of 0 is in the log (the engine recorded it) but there is nothing worth floating.
			if cue.amount > 0:
				_float_text(target, "+%d" % cue.amount, UiTheme.HEAL, 44)
				if target != null:
					target.flash(Color(0.7, 1.5, 0.8))
		BattlePlayback.CUE_STATUS:
			_float_text(target, cue.caption, UiTheme.ACCENT, 34)
		_:
			pass


## A number that rises from the card and fades (Tween; nothing when the screen is not in the tree).
func _float_text(target: UnitCard, text: String, color: Color, size: int) -> void:
	if target == null or text.is_empty() or not is_inside_tree():
		return
	var floater: Label = UiKit.label(text, "", false)
	floater.add_theme_font_size_override("font_size", size)
	floater.add_theme_color_override("font_color", color)
	floater.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	floater.add_theme_constant_override("outline_size", 8)
	floater.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_floaters.add_child(floater)
	var actor: BattleActor = target.get_parent() as BattleActor
	if actor != null:
		floater.position = actor.global_position - _floaters.global_position + Vector2(-30, -actor.art_size * 0.8)
	else:
		floater.position = target.global_position - _floaters.global_position + Vector2(target.size.x * 0.5 - 30.0, target.size.y * 0.3)
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(floater, "position:y", floater.position.y - 90.0, 0.8)
	tween.tween_property(floater, "modulate:a", 0.0, 0.8)
	tween.chain().tween_callback(floater.queue_free)


func _show_result() -> void:
	_stop()
	_arena.finish(playback.outcome)
	_controls.visible = true
	_speed_captions.visible = false
	_speed_button.visible = false
	var stars: String = "★".repeat(playback.stars) if playback.outcome == "victory" and playback.stars > 0 else ""
	_result_label.text = ("Victory!  %s" % stars).strip_edges() if playback.outcome == "victory" else "Defeat"
	_result_label.visible = true
	_continue_button.visible = true
	call_deferred("_focus_continue")

func _focus_speed() -> void:
	if is_instance_valid(_speed_button) and _speed_button.is_inside_tree() and _speed_button.is_visible_in_tree(): _speed_button.grab_focus()

func _focus_continue() -> void:
	if is_instance_valid(_continue_button) and _continue_button.is_inside_tree() and _continue_button.is_visible_in_tree(): _continue_button.grab_focus()


func _stop() -> void:
	_casting = false
	if _cinematic != null: _cinematic.cancel()
	if _skill_tray != null: _skill_tray.casting = false
	if _timer != null:
		_timer.stop()


## The active encounter completes through its result/Continue flow.
func handle_back() -> bool:
	return true
