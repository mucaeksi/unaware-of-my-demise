class_name GothicActionButton
extends Button
## A real Button with a reversible busy state; starts no account or download operation.
signal busy_changed(is_busy: bool)
var busy: bool = false
var _previous_text: String = ""
var _previous_icon: Texture2D = null
var _previous_disabled: bool = false
var _feedback: float = 0.0
var _feedback_origin: Vector2 = Vector2.ZERO
var _feedback_tween: Tween = null

func _ready() -> void:
	button_down.connect(_touch_feedback)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		_feedback_origin = (event as InputEventMouseButton).position
	elif event is InputEventScreenTouch:
		_feedback_origin = (event as InputEventScreenTouch).position

func _touch_feedback() -> void:
	if disabled or UiPageTransition.reduced_for(self):
		return
	if _feedback_tween != null and _feedback_tween.is_valid():
		_feedback_tween.kill()
	if not Rect2(Vector2.ZERO, size).has_point(_feedback_origin):
		_feedback_origin = size * 0.5
	_feedback_tween = create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_feedback_tween.tween_method(_set_feedback, 1.0, 0.0, 0.24)

func _set_feedback(value: float) -> void:
	_feedback = value
	queue_redraw()


func _init() -> void:
	name = "GothicActionButton"
	custom_minimum_size.y = 144
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	clip_contents = true


func set_busy(value: bool, caption: String = "Preparing…") -> void:
	if busy == value:
		return
	busy = value
	if busy:
		_previous_text = text
		_previous_icon = icon
		_previous_disabled = disabled
		text = caption
		icon = UiTheme.GothicTheme.icon("waiting")
		disabled = true
	else:
		text = _previous_text
		icon = _previous_icon
		disabled = _previous_disabled
	busy_changed.emit(busy)
	queue_redraw()


func _draw() -> void:
	if _feedback > 0.0:
		var radius: float = 16.0 + (1.0 - _feedback) * 44.0
		draw_arc(_feedback_origin, radius, 0.0, TAU, 24, Color(0.9, 0.37, 0.4, _feedback * 0.18), 2.0, true)
	# Texture already contains corner engraving. A selected toggle needs an additional
	# shape cue, so selection remains visible in grayscale and without changing its text.
	if not toggle_mode or not button_pressed or theme_type_variation == "SettingButton":
		return
	var color: Color = UiTheme.TEXT_DIM if disabled else UiTheme.TEXT
	draw_line(Vector2(12, 28), Vector2(12, size.y - 28), color, 4.0, true)
	var center: Vector2 = Vector2(25, size.y * 0.5)
	draw_polyline(PackedVector2Array([center + Vector2(-6, 0), center + Vector2(-1, 5), center + Vector2(7, -6)]), color, 3.0, true)
