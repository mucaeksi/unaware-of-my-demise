class_name GothicActionButton
extends Button
## A real Button with a reversible busy state; starts no account or download operation.
signal busy_changed(is_busy: bool)
var busy: bool = false
var _previous_text: String = ""
var _previous_icon: Texture2D = null
var _previous_disabled: bool = false


func _init() -> void:
	name = "GothicActionButton"
	custom_minimum_size.y = 144
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	autowrap_mode = TextServer.AUTOWRAP_WORD_SMART


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
	if theme_type_variation not in [UiTheme.PRIMARY, UiTheme.MODAL_ACTION]:
		return
	var color: Color = UiTheme.TEXT_DIM if disabled else UiTheme.ACCENT
	for x: float in [16.0, size.x - 16.0]:
		var center: Vector2 = Vector2(x, size.y * 0.5)
		draw_polyline(PackedVector2Array([center + Vector2(0, -6), center + Vector2(4, 0), center + Vector2(0, 6), center + Vector2(-4, 0), center + Vector2(0, -6)]), color, 1.5, true)
