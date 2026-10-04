class_name BattleScreen
extends UiScreen
## The battle as the player sees it. The engine resolves a stage in one call, so this screen replays the recorded event log through a
## `BattlePlayback` at a fixed interval (0.35 s per event at 1x, as client/app.py did): unit cards with HP bars and statuses, floating damage
## and heal numbers, the boss phase and telegraph banner, a running log, speed and skip. Art is placeholder.
##
## `show_loading` covers the time the battle runs on its worker thread; `play` starts the replay; `finished` fires when the player presses
## Continue after the result is shown (never before, and never if the screen is just left).

signal finished

const BASE_INTERVAL: float = 0.35
const SPEEDS: Array[int] = [1, 2, 4]
const LOG_LINES_SHOWN: int = 7

var playback: BattlePlayback = null

var _speed_index: int = 0
var _cards: Dictionary = {}
var _timer: Timer = null
var _header_label: Label = null
var _round_label: Label = null
var _loading_label: Label = null
var _field: VBoxContainer = null
var _banner_label: Label = null
var _enemy_flow: HFlowContainer = null
var _front_flow: HFlowContainer = null
var _rear_flow: HFlowContainer = null
var _log_label: Label = null
var _floaters: Control = null
var _controls: HBoxContainer = null
var _speed_button: Button = null
var _skip_button: Button = null
var _result_label: Label = null
var _continue_button: Button = null


func _build(column: VBoxContainer) -> void:
	var header: HBoxContainer = UiKit.row(12)
	_header_label = UiKit.label("", UiTheme.TITLE, false)
	_header_label.add_theme_font_size_override("font_size", 44)
	header.add_child(_header_label)
	_round_label = UiKit.label("", UiTheme.DIM, false)
	_round_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
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
	_field.add_child(UiKit.placeholder_tag("PLACEHOLDER SPRITES"))
	_banner_label = UiKit.label("", UiTheme.DANGER_LABEL)
	_banner_label.visible = false
	_field.add_child(_banner_label)
	_enemy_flow = _flow(_field)
	_field.add_child(UiKit.spacer(0, true))
	_front_flow = _flow(_field)
	_rear_flow = _flow(_field)

	_log_label = UiKit.label("", UiTheme.DIM)
	_log_label.custom_minimum_size = Vector2(0, 240)
	_log_label.visible = false
	column.add_child(_log_label)

	_controls = UiKit.row(12)
	_speed_button = UiKit.button("Speed x1")
	_speed_button.pressed.connect(cycle_speed)
	_controls.add_child(_speed_button)
	_skip_button = UiKit.button("Skip")
	_skip_button.pressed.connect(skip)
	_controls.add_child(_skip_button)
	_controls.visible = false
	column.add_child(_controls)

	_result_label = UiKit.label("", UiTheme.TITLE)
	_result_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_result_label.visible = false
	column.add_child(_result_label)
	_continue_button = UiKit.button("Continue")
	_continue_button.visible = false
	_continue_button.pressed.connect(func() -> void: finished.emit())
	column.add_child(_continue_button)

	_floaters = Control.new()
	_floaters.set_anchors_preset(Control.PRESET_FULL_RECT)
	_floaters.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_floaters)
	_timer = Timer.new()
	_timer.one_shot = false
	_timer.timeout.connect(step)
	add_child(_timer)


static func _flow(parent: Control) -> HFlowContainer:
	var flow: HFlowContainer = HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 12)
	flow.add_theme_constant_override("v_separation", 12)
	flow.alignment = FlowContainer.ALIGNMENT_CENTER
	flow.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(flow)
	return flow


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
	_result_label.visible = false
	_continue_button.visible = false


## Starts the replay of a finished battle.
func play(new_playback: BattlePlayback, stage_title: String = "") -> void:
	ensure_built()
	_stop()
	playback = new_playback
	_speed_index = 0
	_speed_button.text = "Speed x%d" % SPEEDS[0]
	if not stage_title.is_empty():
		_header_label.text = stage_title
	UiKit.clear(_enemy_flow)
	UiKit.clear(_front_flow)
	UiKit.clear(_rear_flow)
	UiKit.clear(_floaters)
	_cards.clear()
	for view: BattlePlayback.UnitView in playback.units:
		var card: UnitCard = UnitCard.create(view)
		_cards[view.entity_id] = card
		if view.team == "player":
			(_rear_flow if view.row == "rear" else _front_flow).add_child(card)
		else:
			_enemy_flow.add_child(card)
	_loading_label.visible = false
	_field.visible = true
	_log_label.visible = true
	_controls.visible = true
	_result_label.visible = false
	_continue_button.visible = false
	_update_status()
	if playback.is_finished():
		_show_result()
	else:
		_timer.start(BASE_INTERVAL / float(SPEEDS[_speed_index]))


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


func cycle_speed() -> void:
	_speed_index = (_speed_index + 1) % SPEEDS.size()
	_speed_button.text = "Speed x%d" % SPEEDS[_speed_index]
	if is_playing():
		_timer.start(BASE_INTERVAL / float(SPEEDS[_speed_index]))


## Jumps to the end: the field shows the final state and the result.
func skip() -> void:
	if playback == null:
		return
	playback.skip_to_end()
	_refresh_cards()
	_update_status()
	_show_result()


func _refresh_cards() -> void:
	for view: BattlePlayback.UnitView in playback.units:
		var unit_card: UnitCard = _cards.get(view.entity_id)
		if unit_card != null:
			unit_card.refresh(view)


func _update_status() -> void:
	_round_label.text = "Round %d" % playback.round_number if playback.round_number > 0 else ""
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
	floater.position = target.global_position - _floaters.global_position + Vector2(target.size.x * 0.5 - 30.0, target.size.y * 0.3)
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(floater, "position:y", floater.position.y - 90.0, 0.8)
	tween.tween_property(floater, "modulate:a", 0.0, 0.8)
	tween.chain().tween_callback(floater.queue_free)


func _show_result() -> void:
	_stop()
	_controls.visible = false
	var stars: String = "★".repeat(playback.stars) if playback.outcome == "victory" and playback.stars > 0 else ""
	_result_label.text = ("Victory!  %s" % stars).strip_edges() if playback.outcome == "victory" else "Defeat"
	_result_label.visible = true
	_continue_button.visible = true


func _stop() -> void:
	if _timer != null:
		_timer.stop()


## The battle screen cannot be backed out of: the result is already decided (and saved on a victory).
func handle_back() -> bool:
	return true
