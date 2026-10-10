class_name RosterScreen
extends UiScreen
## Party selection (port of client/screens/roster_screen.py): pick up to `party_size` owned heroes for a stage. The pick order matters to the
## battle: `StoryState.resolve_battle_roster` puts the first picks in the front row and the rest in the rear, so the screen shows the order as
## a numbered strip and not just as ticks. The caller checks the selection (`GameFlow.validate_roster_selection`) and reports back with `show_error`.

signal back_requested

signal confirmed(selected: Array[String])

var stage_id: String = ""
var party_size: int = 0
var selected: Array[String] = []

var _title_label: Label = null
var _guests_label: Label = null
var _selection_label: Label = null
var _error_label: Label = null
var _list: VBoxContainer = null
var _confirm_button: Button = null
var _buttons: Dictionary = {}
var _names: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	_title_label = UiKit.label("", UiTheme.TITLE)
	column.add_child(_title_label)
	_guests_label = UiKit.label("", UiTheme.SMALL)
	column.add_child(_guests_label)
	_selection_label = UiKit.label("", UiTheme.DIM)
	column.add_child(_selection_label)
	_list = UiKit.scroll_column(column, 12)
	_error_label = UiKit.label("", UiTheme.DANGER_LABEL)
	column.add_child(_error_label)
	_confirm_button = UiKit.button(tr("Start Battle"), false, UiTheme.PRIMARY)
	_confirm_button.pressed.connect(confirm)
	column.add_child(_confirm_button)
	var back: Button = UiKit.button("Back to Shelter", false, UiTheme.SECONDARY)
	back.pressed.connect(func() -> void: back_requested.emit())
	column.add_child(back)


## Resets the screen for one stage. `preselected` seeds the pick order (the default party, or the one that just lost).
func load_stage(new_stage_id: String, new_party_size: int, candidates: Array[GameFlow.RosterCandidate], guest_names: Array[String] = [], preselected: Array[String] = []) -> void:
	ensure_built()
	UiKit.clear(_list)
	_buttons.clear()
	_names.clear()
	stage_id = new_stage_id
	party_size = new_party_size
	_title_label.text = "Choose your party: stage %s" % stage_id
	_guests_label.text = "Story guests joining automatically: %s" % ", ".join(guest_names) if not guest_names.is_empty() else ""
	_error_label.text = ""
	var known: Dictionary = {}
	for candidate: GameFlow.RosterCandidate in candidates:
		known[candidate.character_id] = true
		_names[candidate.character_id] = candidate.name_en
	selected = []
	for character_id: String in preselected:
		if known.has(character_id) and selected.size() < party_size:
			selected.append(character_id)
	for candidate: GameFlow.RosterCandidate in candidates:
		var button: Button = UiKit.button(UiKit.hero_line(candidate), true)
		button.set_pressed_no_signal(selected.has(candidate.character_id))
		button.toggled.connect(_on_toggled.bind(candidate.character_id))
		_list.add_child(button)
		_buttons[candidate.character_id] = button
	_update_selection_label()


func candidate_count() -> int:
	return _buttons.size()


## Ticks or unticks `character_id` as a tap would.
func toggle(character_id: String) -> void:
	if _buttons.has(character_id):
		var button: Button = _buttons[character_id]
		button.button_pressed = not button.button_pressed


func _on_toggled(pressed: bool, character_id: String) -> void:
	if pressed:
		if selected.size() >= party_size:
			_error_label.text = "You can select at most %d heroes." % party_size
			(_buttons[character_id] as Button).set_pressed_no_signal(false)
			return
		selected.append(character_id)
	else:
		selected.erase(character_id)
	_error_label.text = ""
	_update_selection_label()


func _update_selection_label() -> void:
	var order: PackedStringArray = PackedStringArray()
	for index: int in range(selected.size()):
		order.append("%d. %s" % [index + 1, _names.get(selected[index], selected[index])])
	var listed: String = " > ".join(order) if not order.is_empty() else "(none selected: story guests alone must fill the party)"
	_selection_label.text = "Selected %d/%d (pick order = front to rear): %s" % [selected.size(), party_size, listed]


func selection_text() -> String:
	return _selection_label.text


func error_text() -> String:
	return _error_label.text


func show_error(message: String) -> void:
	_error_label.text = message


func confirm() -> void:
	confirmed.emit(selected.duplicate())
