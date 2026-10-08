class_name HubScreen
extends UiScreen
## The home hub (port of client/screens/hub_screen.py): the title, a wallet summary, a status line and a column of menu buttons. The screen
## knows no game rule and no destination: the director hands it the entries ({"id", "label"}) and hears which one was pressed.

signal chosen(entry_id: String)

var _summary_label: Label = null
var _status_label: Label = null
var _menu: VBoxContainer = null
var _buttons: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	var title: Label = UiKit.label("Unaware of My Demise", UiTheme.TITLE)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	_summary_label = UiKit.label("")
	_summary_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(UiKit.card(_summary_label, UiTheme.STANDARD_PANEL))
	_status_label = UiKit.label("", UiTheme.DIM)
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_status_label)
	column.add_child(UiKit.spacer(24, false))
	# The full menu remains reachable with the shared 48 dp touch target.
	_menu = UiKit.scroll_column(column, 16)
	column.add_child(UiKit.placeholder_tag("PLACEHOLDER SCREEN"))


## `entries` is a list of {"id": String, "label": String}; a reload replaces the menu and the texts.
func load_hub(summary: String, entries: Array[Dictionary], status: String = "") -> void:
	ensure_built()
	UiKit.clear(_menu)
	_buttons.clear()
	_summary_label.text = summary
	_status_label.text = status
	for entry: Dictionary in entries:
		var entry_id: String = str(entry["id"])
		var button: Button = UiKit.button(str(entry["label"]), false, UiTheme.PRIMARY if _buttons.is_empty() else UiTheme.SECONDARY)
		button.pressed.connect(func() -> void: chosen.emit(entry_id))
		_menu.add_child(button)
		_buttons[entry_id] = button


func summary_text() -> String:
	return _summary_label.text


func status_text() -> String:
	return _status_label.text


func entry_ids() -> Array[String]:
	var ids: Array[String] = []
	for entry_id: String in _buttons:
		ids.append(entry_id)
	return ids


func label_of(entry_id: String) -> String:
	return (_buttons[entry_id] as Button).text if _buttons.has(entry_id) else ""


## Presses `entry_id` as a tap would.
func press(entry_id: String) -> void:
	if _buttons.has(entry_id):
		(_buttons[entry_id] as Button).pressed.emit()


func handle_back() -> bool:
	return false
