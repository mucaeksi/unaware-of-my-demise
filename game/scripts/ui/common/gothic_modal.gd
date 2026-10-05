class_name GothicModal
extends Control
## Reusable confirmation frame. Caller handles confirmed; this component changes no player data.
signal confirmed
signal canceled
var _title: Label = null
var _message: Label = null
var _cancel: Button = null
var _confirm: Button = null
var _previous_focus: WeakRef = null


func _init() -> void:
	name = "GothicModal"


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var shade: ColorRect = ColorRect.new()
	shade.color = Color(0.02, 0.025, 0.03, 0.88)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(shade)
	var safe: SafeAreaContainer = SafeAreaContainer.new()
	safe.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(safe)
	var inset: MarginContainer = MarginContainer.new()
	for side: String in ["left", "right", "top", "bottom"]:
		inset.add_theme_constant_override("margin_" + side, 64)
	safe.add_child(inset)
	var center: VBoxContainer = UiKit.column()
	inset.add_child(center)
	center.add_child(UiKit.spacer())
	var frame: PanelContainer = PanelContainer.new()
	frame.theme_type_variation = UiTheme.FRAME
	center.add_child(frame)
	var column: VBoxContainer = UiKit.column(32)
	frame.add_child(column)
	_title = UiKit.label("", UiTheme.TITLE)
	_title.add_theme_font_size_override("font_size", 54)
	column.add_child(_title)
	_message = UiKit.label("")
	column.add_child(_message)
	column.add_child(UiKit.spacer(16, false))
	var actions: HBoxContainer = UiKit.row(24)
	column.add_child(actions)
	_cancel = UiKit.button("Cancel", false, UiTheme.SECONDARY)
	_confirm = UiKit.button("Continue", false, UiTheme.MODAL_ACTION)
	actions.add_child(_cancel)
	actions.add_child(_confirm)
	_cancel.pressed.connect(_cancel_action)
	_confirm.pressed.connect(_confirm_action)
	_cancel.focus_next = _cancel.get_path_to(_confirm)
	_cancel.focus_previous = _cancel.get_path_to(_confirm)
	_confirm.focus_next = _confirm.get_path_to(_cancel)
	_confirm.focus_previous = _confirm.get_path_to(_cancel)
	for direction: String in ["left", "right", "top", "bottom"]:
		_cancel.set("focus_neighbor_" + direction, _cancel.get_path_to(_confirm))
		_confirm.set("focus_neighbor_" + direction, _confirm.get_path_to(_cancel))
	center.add_child(UiKit.spacer())
	hide()


func open(title: String, message: String, confirm_caption: String = "Continue", destructive: bool = false) -> void:
	assert(_title != null, "Add the modal to the tree before opening it")
	if not visible:
		_previous_focus = weakref(get_viewport().gui_get_focus_owner())
	_title.text = title
	_message.text = message
	_confirm.text = confirm_caption
	_confirm.theme_type_variation = UiTheme.DESTRUCTIVE if destructive else UiTheme.MODAL_ACTION
	show()
	_cancel.grab_focus()


func handle_back() -> bool:
	if not visible:
		return false
	_cancel_action()
	return true


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		_cancel_action()


func _close() -> void:
	hide()
	var previous: Control = _previous_focus.get_ref() as Control if _previous_focus != null else null
	if is_instance_valid(previous) and previous.is_inside_tree() and previous.is_visible_in_tree():
		previous.grab_focus()
	_previous_focus = null


func _cancel_action() -> void:
	if not visible:
		return
	_close()
	canceled.emit()


func _confirm_action() -> void:
	if not visible:
		return
	_close()
	confirmed.emit()
