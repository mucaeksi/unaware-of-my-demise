class_name UiBottomNav
extends PanelContainer
## Five-route navigation component. The owning screen/director supplies route availability and routing.
signal route_requested(route_id: String)
const ROUTES: Array[Array] = [["shelter", "home", "Shelter"], ["journey", "journey", "Journey"], ["companions", "companions", "Companions"], ["summon", "summon", "Summon"], ["records", "records", "Records"]]
var _buttons: Dictionary = {}
var _row: HBoxContainer = null
var _selected: String = ""


func _init() -> void:
	theme_type_variation = UiTheme.NAV_PANEL
	size_flags_horizontal = Control.SIZE_EXPAND_FILL


func _ready() -> void:
	ensure_built()


func ensure_built() -> void:
	if _row != null:
		return
	_row = UiKit.row(8)
	add_child(_row)
	for route: Array in ROUTES:
		var id: String = route[0]
		var button: Button = UiKit.button(tr(route[2]), true, UiTheme.NAVIGATION)
		button.autowrap_mode = TextServer.AUTOWRAP_OFF
		button.text_overrun_behavior = TextServer.OVERRUN_NO_TRIMMING
		# Five 144 px targets fit the reference canvas. Caption is below a separate icon.
		button.custom_minimum_size.x = UiTheme.TOUCH_HEIGHT
		var normal: StyleBoxEmpty = StyleBoxEmpty.new()
		normal.content_margin_top = 70
		normal.content_margin_left = 2
		normal.content_margin_right = 2
		for key: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			button.add_theme_stylebox_override(key, normal)
		var mark: TextureRect = TextureRect.new()
		mark.texture = UiTheme.GothicTheme.icon(route[1])
		mark.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		mark.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		mark.set_anchors_preset(Control.PRESET_CENTER_TOP)
		mark.offset_left = -24
		mark.offset_right = 24
		mark.offset_top = 14
		mark.offset_bottom = 62
		mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
		button.add_child(mark)
		button.pressed.connect(func() -> void:
			select_route(_selected)  # selection follows the verified destination, not the tap
			if not button.disabled:
				route_requested.emit(id))
		_row.add_child(button)
		_buttons[id] = button


## Example: nav.select_route("shelter") highlights a route without navigating.
func select_route(route_id: String) -> void:
	ensure_built()
	_selected = route_id
	for id: String in _buttons:
		(_buttons[id] as Button).set_pressed_no_signal(id == route_id)


## Example: nav.set_available(["shelter", "journey"]) visibly disables routes the owner cannot serve yet.
func set_available(route_ids: Array[String]) -> void:
	ensure_built()
	for id: String in _buttons:
		(_buttons[id] as Button).disabled = not route_ids.has(id)
		var mark: Control = (_buttons[id] as Button).get_child(0) as Control
		mark.modulate.a = 1.0 if route_ids.has(id) else 0.45
