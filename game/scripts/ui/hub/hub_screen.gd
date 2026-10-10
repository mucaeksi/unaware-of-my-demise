class_name HubScreen
extends UiScreen
## The home hub (port of client/screens/hub_screen.py): the title, a wallet summary, a status line and a column of menu buttons. The screen
## knows no game rule and no destination: the director hands it the entries ({"id", "label"}) and hears which one was pressed.

signal chosen(entry_id: String)

var _summary_label: Label = null
var _status_label: Label = null
var _journey_label: Label
var _continue_slot: VBoxContainer
var _actions: GridContainer
var _menu: VBoxContainer = null
var _buttons: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	var title: Label = UiKit.label("Shelter", UiTheme.TITLE)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	_journey_label = UiKit.label("", UiTheme.DIM)
	column.add_child(_journey_label)
	# One scroll surface keeps every action reachable at compact size / Large Text.
	_menu = UiKit.scroll_column(column, 20)
	var companions: HBoxContainer = UiKit.row(20)
	for character_id: String in ["fadyme", "mahmut"]:
		var portrait: TextureRect = TextureRect.new()
		portrait.texture = BattleArt.icon(character_id)
		portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		portrait.custom_minimum_size = Vector2(120, 120)
		portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
		companions.add_child(portrait)
	companions.add_child(UiKit.label("PART I · UNAWARE, I FADE", UiTheme.DIM))
	_menu.add_child(companions)
	_summary_label = UiKit.label("")
	_summary_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_menu.add_child(UiKit.card(_summary_label, UiTheme.STANDARD_PANEL))
	_status_label = UiKit.label("", UiTheme.DIM)
	_menu.add_child(_status_label)
	_actions = GridContainer.new()
	_actions.columns = 2
	_actions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_actions.add_theme_constant_override("h_separation", 16)
	_actions.add_theme_constant_override("v_separation", 16)
	_menu.add_child(_actions)
	_actions.resized.connect(_update_columns)
	_continue_slot = UiKit.column(12)
	column.add_child(_continue_slot)


## The primary Journey action stays in view while secondary destinations scroll.
func load_hub(summary: String, entries: Array[Dictionary], status: String = "") -> void:
	ensure_built()
	UiKit.clear(_actions)
	UiKit.clear(_continue_slot)
	_buttons.clear()
	_summary_label.text = summary
	_summary_label.visible = not summary.is_empty()
	_status_label.text = status
	_status_label.visible = not status.is_empty()
	for entry: Dictionary in entries:
		var entry_id: String = str(entry["id"])
		var primary: bool = bool(entry.get("primary", _buttons.is_empty()))
		var button: Button = UiKit.button(str(entry["label"]), false, UiTheme.PRIMARY if primary else UiTheme.SECONDARY)
		button.pressed.connect(func() -> void: chosen.emit(entry_id))
		if primary:
			_continue_slot.add_child(button)
		else:
			_actions.add_child(button)
		_buttons[entry_id] = button
	call_deferred("_update_columns")


func _update_columns() -> void:
	# Large Text must wrap at words, rather than splitting menu names into letters.
	var minimum_cell: float = 0.0
	for child: Node in _actions.get_children():
		var button: Button = child as Button
		var font: Font = button.get_theme_font("font")
		var font_size: int = button.get_theme_font_size("font_size")
		var longest_word: float = 0.0
		for word: String in button.text.split(" "):
			longest_word = maxf(longest_word, font.get_string_size(word, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x)
		var style: StyleBox = button.get_theme_stylebox("normal")
		minimum_cell = maxf(minimum_cell, longest_word + style.get_minimum_size().x + 16.0)
	_actions.columns = 2 if _actions.size.x >= minimum_cell * 2.0 + 16.0 else 1


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


func load_journey(context: String) -> void:
	ensure_built()
	_journey_label.text = context
