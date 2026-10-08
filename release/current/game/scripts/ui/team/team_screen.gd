class_name TeamScreen
extends UiScreen
## The team (port of client/screens/team_screen.py): pick an owned hero and spend character XP items on them; Skills and Memory Node lead on.
## Names, never ids. Every rule (costs, gates, ownership) lives in `ProgressionService`; this screen only reports which hero and which item.

signal use_item(character_id: String, item_id: String)
signal skills_requested(character_id: String)
signal memory_requested(character_id: String)
signal back_requested

var selected: String = ""

var _wallet_label: Label = null
var _status_label: Label = null
var _list: VBoxContainer = null
var _items: VBoxContainer = null
var _skills_button: Button = null
var _memory_button: Button = null
var _group: ButtonGroup = null
var _member_buttons: Dictionary = {}
var _item_buttons: Dictionary = {}
var _item_owned: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Team", UiTheme.TITLE))
	_wallet_label = UiKit.label("", UiTheme.DIM)
	column.add_child(_wallet_label)
	_list = UiKit.scroll_column(column, 12)
	_status_label = UiKit.label("")
	column.add_child(_status_label)
	_items = UiKit.column(10)
	column.add_child(_items)
	var extras: HBoxContainer = UiKit.row(12)
	_skills_button = UiKit.button("Skills")
	_skills_button.pressed.connect(func() -> void: skills_requested.emit(selected))
	extras.add_child(_skills_button)
	_memory_button = UiKit.button("Memory Node")
	_memory_button.pressed.connect(func() -> void: memory_requested.emit(selected))
	extras.add_child(_memory_button)
	column.add_child(extras)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void: back_requested.emit())
	column.add_child(back)


## `wallet_text` is the line under the title. `selected_id` keeps the hero the player was on across a reload.
func load_team(members: Array[GameViews.TeamMember], xp_items: Array[GameViews.XpItem], wallet_text: String, selected_id: String = "", status: String = "") -> void:
	ensure_built()
	UiKit.clear(_list)
	UiKit.clear(_items)
	_member_buttons.clear()
	_item_buttons.clear()
	_item_owned.clear()
	_group = ButtonGroup.new()
	_wallet_label.text = wallet_text
	_status_label.text = status
	selected = ""
	for member: GameViews.TeamMember in members:
		var button: Button = UiKit.button(member_text(member), true)
		button.button_group = _group
		button.toggled.connect(_on_member_toggled.bind(member.character_id))
		_list.add_child(button)
		_member_buttons[member.character_id] = button
	for item: GameViews.XpItem in xp_items:
		var use: Button = UiKit.button("Use 1 %s (+%d XP, owned %d)" % [item.name_en, item.xp_each, item.owned])
		use.pressed.connect(_on_item_pressed.bind(item.item_id))
		_items.add_child(use)
		_item_buttons[item.item_id] = use
		_item_owned[item.item_id] = item.owned
	if _member_buttons.has(selected_id):
		(_member_buttons[selected_id] as Button).button_pressed = true
	_refresh_buttons()


## "Name  5★  Lv 3/20  XP 40/120  Asc 0  Mem 0/6 (0 sh)" over two lines.
static func member_text(member: GameViews.TeamMember) -> String:
	var xp: String = "XP %d/%d" % [member.xp, member.xp_to_next] if member.xp_to_next >= 0 else "MAX"
	return "%s  %d★  Lv %d/%d\n%s  Asc %d  Mem %d/%d (%d sh)" % [member.name_en, member.rarity, member.level, member.level_cap, xp, member.ascension, member.memory_nodes, member.memory_total, member.memory_shards]


func member_ids() -> Array[String]:
	var ids: Array[String] = []
	for character_id: String in _member_buttons:
		ids.append(character_id)
	return ids


func member_label(character_id: String) -> String:
	return (_member_buttons[character_id] as Button).text if _member_buttons.has(character_id) else ""


func item_label(item_id: String) -> String:
	return (_item_buttons[item_id] as Button).text if _item_buttons.has(item_id) else ""


func status_text() -> String:
	return _status_label.text


func can_use_item(item_id: String) -> bool:
	return _item_buttons.has(item_id) and not (_item_buttons[item_id] as Button).disabled


func can_open_skills() -> bool:
	return not _skills_button.disabled


func choose(character_id: String) -> void:
	if _member_buttons.has(character_id):
		(_member_buttons[character_id] as Button).button_pressed = true


## Presses as a tap would: a disabled button does nothing.
func press_item(item_id: String) -> void:
	if can_use_item(item_id):
		(_item_buttons[item_id] as Button).pressed.emit()


func press_skills() -> void:
	if not _skills_button.disabled:
		_skills_button.pressed.emit()


func press_memory() -> void:
	if not _memory_button.disabled:
		_memory_button.pressed.emit()


func _on_member_toggled(pressed: bool, character_id: String) -> void:
	if not pressed:
		return
	selected = character_id
	_refresh_buttons()


func _on_item_pressed(item_id: String) -> void:
	if not selected.is_empty():
		use_item.emit(selected, item_id)


func _refresh_buttons() -> void:
	for item_id: String in _item_buttons:
		(_item_buttons[item_id] as Button).disabled = selected.is_empty() or int(_item_owned.get(item_id, 0)) <= 0
	_skills_button.disabled = selected.is_empty()
	_memory_button.disabled = selected.is_empty()
	if selected.is_empty() and _status_label.text.is_empty():
		_status_label.text = "Select a hero."
