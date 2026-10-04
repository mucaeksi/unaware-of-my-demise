class_name MessageScreen
extends UiScreen
## A title, a message and optional buttons: the loading screen, and the stop screen for a failure the player cannot play past (no usable
## save, a save from a newer build). `chosen` reports the pressed action's id.

signal chosen(action_id: String)

var _title_label: Label = null
var _message_label: Label = null
var _actions: VBoxContainer = null
var _buttons: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.spacer(0, true))
	_title_label = UiKit.label("", UiTheme.TITLE)
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_title_label)
	_message_label = UiKit.label("")
	_message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_message_label)
	column.add_child(UiKit.spacer(24, false))
	_actions = UiKit.column(16)
	column.add_child(_actions)
	column.add_child(UiKit.spacer(0, true))


## `actions` is a list of {"id": String, "label": String} (none = nothing to press).
func load_message(title: String, message: String, actions: Array[Dictionary] = []) -> void:
	ensure_built()
	UiKit.clear(_actions)
	_buttons.clear()
	_title_label.text = title
	_message_label.text = message
	for action: Dictionary in actions:
		var action_id: String = str(action["id"])
		var button: Button = UiKit.button(str(action["label"]))
		button.pressed.connect(func() -> void: chosen.emit(action_id))
		_actions.add_child(button)
		_buttons[action_id] = button


func title_text() -> String:
	return _title_label.text


func message_text() -> String:
	return _message_label.text


func press(action_id: String) -> void:
	if _buttons.has(action_id):
		(_buttons[action_id] as Button).pressed.emit()


func has_action(action_id: String) -> bool:
	return _buttons.has(action_id)
