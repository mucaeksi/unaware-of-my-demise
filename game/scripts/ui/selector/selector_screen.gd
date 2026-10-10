class_name SelectorScreen
extends UiScreen
## Single-choice hero selector (port of client/screens/selector_screen.py): exactly one pick from a fixed pool, currently the First Oath
## Invitation. The choices form one toggle group and Confirm stays disabled until something is picked.

signal back_requested

signal confirmed(character_id: String)

var busy: bool = false
var selected: String = ""

var _title_label: Label = null
var _selection_label: Label = null
var _error_label: Label = null
var _list: VBoxContainer = null
var _confirm_button: Button = null
var _group: ButtonGroup = null
var _buttons: Dictionary = {}
var _names: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	_title_label = UiKit.label("", UiTheme.TITLE)
	column.add_child(_title_label)
	_selection_label = UiKit.label("", UiTheme.DIM)
	column.add_child(_selection_label)
	_list = UiKit.scroll_column(column, 12)
	_error_label = UiKit.label("", UiTheme.DANGER_LABEL)
	column.add_child(_error_label)
	_confirm_button = UiKit.button("Confirm")
	_confirm_button.disabled = true
	_confirm_button.pressed.connect(confirm)
	column.add_child(_confirm_button)
	var back: Button = UiKit.button("Back to Shelter", false, UiTheme.SECONDARY)
	back.pressed.connect(func() -> void: handle_back())
	column.add_child(back)


## Resets the screen for one round of picking.
func load_choices(candidates: Array[GameFlow.RosterCandidate], title: String = "Choose one hero") -> void:
	ensure_built()
	UiKit.clear(_list)
	_buttons.clear()
	_names.clear()
	_group = ButtonGroup.new()
	selected = ""
	_confirm_button.disabled = true
	_error_label.text = ""
	_title_label.text = title
	for candidate: GameFlow.RosterCandidate in candidates:
		var button: Button = UiKit.button(UiKit.hero_line(candidate), true)
		button.icon = BattleArt.icon(candidate.character_id)
		button.expand_icon = true
		button.add_theme_constant_override("icon_max_width", 96)
		button.button_group = _group
		button.toggled.connect(_on_toggled.bind(candidate.character_id))
		_list.add_child(button)
		_buttons[candidate.character_id] = button
		_names[candidate.character_id] = candidate.name_en
	_update_selection_label()


func choice_count() -> int:
	return _buttons.size()


## Picks `character_id` as if it had been tapped.
func choose(character_id: String) -> void:
	if _buttons.has(character_id):
		(_buttons[character_id] as Button).button_pressed = true


func _on_toggled(pressed: bool, character_id: String) -> void:
	if not pressed:
		return
	selected = character_id
	_confirm_button.disabled = false
	_error_label.text = ""
	_update_selection_label()


func _update_selection_label() -> void:
	_selection_label.text = "Selected: %s" % _names[selected] if not selected.is_empty() else "(no selection yet)"


func show_error(message: String) -> void:
	_error_label.text = message


func confirm() -> void:
	if not busy and not selected.is_empty():
		confirmed.emit(selected)


func set_busy(value: bool) -> void:
	busy = value
	_confirm_button.disabled = busy or selected.is_empty()
	for button: Button in _buttons.values(): button.disabled = busy

func handle_back() -> bool:
	if not busy: back_requested.emit()
	return true
