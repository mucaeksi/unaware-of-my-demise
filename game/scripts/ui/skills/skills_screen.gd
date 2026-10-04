class_name SkillsScreen
extends UiScreen
## One hero's skills, their ranks and what the next rank costs (port of client/screens/skills_screen.py). The rules (levels, materials,
## Silver Crowns) live in `ProgressionService`; the rows arrive computed from `GameFlow.skill_rows`.

signal upgrade_requested(skill_id: String)
signal back_requested

var selected: String = ""

var _title_label: Label = null
var _status_label: Label = null
var _list: VBoxContainer = null
var _upgrade_button: Button = null
var _group: ButtonGroup = null
var _buttons: Dictionary = {}
var _rows: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	_title_label = UiKit.label("Skills", UiTheme.TITLE)
	column.add_child(_title_label)
	_list = UiKit.scroll_column(column, 12)
	_status_label = UiKit.label("")
	column.add_child(_status_label)
	_upgrade_button = UiKit.button("Upgrade")
	_upgrade_button.disabled = true
	_upgrade_button.pressed.connect(func() -> void: upgrade_requested.emit(selected))
	column.add_child(_upgrade_button)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void: back_requested.emit())
	column.add_child(back)


func load_skills(title: String, rows: Array[GameViews.SkillRow], selected_id: String = "", status: String = "") -> void:
	ensure_built()
	UiKit.clear(_list)
	_buttons.clear()
	_rows.clear()
	_group = ButtonGroup.new()
	_title_label.text = title
	_status_label.text = status
	selected = ""
	for row: GameViews.SkillRow in rows:
		var button: Button = UiKit.button(row_text(row), true)
		button.button_group = _group
		button.toggled.connect(_on_toggled.bind(row.skill_id))
		_list.add_child(button)
		_buttons[row.skill_id] = button
		_rows[row.skill_id] = row
	if _buttons.has(selected_id):
		(_buttons[selected_id] as Button).button_pressed = true
	_refresh()


## "Name [type]  Rank 1/3" and, below, what the next rank needs.
static func row_text(row: GameViews.SkillRow) -> String:
	var head: String = "%s [%s]  Rank %d/%d" % [row.name_en, row.type, row.rank, row.max_rank]
	if not row.has_next:
		return head + "  (max)"
	var item: String = " + %d %s" % [row.next_item_quantity, row.next_item_name] if not row.next_item_id.is_empty() else ""
	return head + "\nNext: Lv %d, %d Silver Crowns%s" % [row.next_level, row.next_silver_crowns, item]


func row_label(skill_id: String) -> String:
	return (_buttons[skill_id] as Button).text if _buttons.has(skill_id) else ""


func status_text() -> String:
	return _status_label.text


func title_text() -> String:
	return _title_label.text


func can_upgrade() -> bool:
	return not _upgrade_button.disabled


func choose(skill_id: String) -> void:
	if _buttons.has(skill_id):
		(_buttons[skill_id] as Button).button_pressed = true


func press_upgrade() -> void:
	if not _upgrade_button.disabled:
		_upgrade_button.pressed.emit()


func _on_toggled(pressed: bool, skill_id: String) -> void:
	if not pressed:
		return
	selected = skill_id
	_refresh()


func _refresh() -> void:
	var row: GameViews.SkillRow = _rows.get(selected)
	_upgrade_button.disabled = row == null or not row.has_next
