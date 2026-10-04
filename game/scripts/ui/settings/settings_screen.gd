class_name SettingsScreen
extends UiScreen
## Settings (port of client/screens/settings_screen.py, offline part): the build line and the offline note. Sign-out and account deletion
## arrive with the online build (G6), which passes their buttons in `load_settings`' `actions`.

signal back_requested
signal action_requested(action_id: String)

var _info_label: Label = null
var _status_label: Label = null
var _actions: VBoxContainer = null


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Settings", UiTheme.TITLE))
	_info_label = UiKit.label("")
	column.add_child(_info_label)
	_status_label = UiKit.label("", UiTheme.DIM)
	column.add_child(_status_label)
	_actions = UiKit.column(16)
	column.add_child(_actions)
	column.add_child(UiKit.spacer(0, true))
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void: back_requested.emit())
	column.add_child(back)


## `info` is the build line (and the offline note); `actions` is a list of {"id", "label"} for extra buttons.
func load_settings(info: String, status: String = "", actions: Array[Dictionary] = []) -> void:
	ensure_built()
	UiKit.clear(_actions)
	_info_label.text = info
	_status_label.text = status
	for action: Dictionary in actions:
		var action_id: String = str(action["id"])
		var button: Button = UiKit.button(str(action["label"]))
		button.pressed.connect(func() -> void: action_requested.emit(action_id))
		_actions.add_child(button)


func info_text() -> String:
	return _info_label.text


func status_text() -> String:
	return _status_label.text
