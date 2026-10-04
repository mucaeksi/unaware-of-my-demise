class_name InventoryScreen
extends UiScreen
## Owned gear: equip, unequip, lock, dismantle, reroll and level up (port of client/screens/inventory_screen.py). Button enablement mirrors the
## flags `GameFlow.inventory()` already computed; the services check everything again, so a stale button can at worst produce a message.

signal action_requested(action: String, entry: GameViews.InventoryEntry, target_id: String)
signal back_requested

const ACTIONS: Array[String] = ["equip", "unequip", "toggle_lock", "dismantle", "reroll", "level_up"]
const ACTION_LABELS: Dictionary = {"equip": "Equip", "unequip": "Unequip", "toggle_lock": "Lock", "dismantle": "Dismantle", "reroll": "Reroll", "level_up": "Upgrade"}

var selected: String = ""

var _status_label: Label = null
var _list: VBoxContainer = null
var _target_button: Button = null
var _group: ButtonGroup = null
var _entries: Dictionary = {}
var _entry_buttons: Dictionary = {}
var _targets: Array[Dictionary] = []
var _target_index: int = 0
var _action_buttons: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Inventory", UiTheme.TITLE))
	_list = UiKit.scroll_column(column, 12)
	_status_label = UiKit.label("")
	column.add_child(_status_label)
	_target_button = UiKit.button("Equip to: -")
	_target_button.pressed.connect(cycle_target)
	column.add_child(_target_button)
	var grid: GridContainer = GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for action: String in ACTIONS:
		var button: Button = UiKit.button(str(ACTION_LABELS[action]))
		button.disabled = true
		button.pressed.connect(_on_action_pressed.bind(action))
		grid.add_child(button)
		_action_buttons[action] = button
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void: back_requested.emit())
	grid.add_child(back)
	column.add_child(grid)


## `targets` is a list of {"id": character_id, "name": name_en}: the owned heroes Equip can go to.
func load_inventory(entries: Array[GameViews.InventoryEntry], targets: Array[Dictionary], selected_id: String = "", status: String = "") -> void:
	ensure_built()
	UiKit.clear(_list)
	_entries.clear()
	_entry_buttons.clear()
	_group = ButtonGroup.new()
	selected = ""
	_targets = targets
	_target_index = 0
	for entry: GameViews.InventoryEntry in entries:
		var button: Button = UiKit.button(entry_text(entry), true)
		button.button_group = _group
		button.custom_minimum_size = Vector2(0, 150)
		button.toggled.connect(_on_toggled.bind(entry.instance_id))
		_list.add_child(button)
		_entries[entry.instance_id] = entry
		_entry_buttons[entry.instance_id] = button
	if _entry_buttons.has(selected_id):
		(_entry_buttons[selected_id] as Button).button_pressed = true
	_status_label.text = status if not status.is_empty() else ("No gear yet." if entries.is_empty() else "Select an item.")
	_refresh()


## "Name 4★ Lv 3 [weapon] | on Someone | locked" over the stats line.
static func entry_text(entry: GameViews.InventoryEntry) -> String:
	var level: String = " Lv %d" % entry.level if entry.level >= 0 else ""
	var owner: String = " | on %s" % entry.equipped_character_name if not entry.equipped_character_name.is_empty() else ""
	var lock: String = " | locked" if entry.locked else ""
	return "%s %d★%s [%s]%s%s\n%s" % [entry.name_en, entry.rarity, level, entry.slot, owner, lock, entry.stats_text]


func entry_ids() -> Array[String]:
	var ids: Array[String] = []
	for instance_id: String in _entry_buttons:
		ids.append(instance_id)
	return ids


func entry_label(instance_id: String) -> String:
	return (_entry_buttons[instance_id] as Button).text if _entry_buttons.has(instance_id) else ""


func status_text() -> String:
	return _status_label.text


func target_text() -> String:
	return _target_button.text


func action_enabled(action: String) -> bool:
	return _action_buttons.has(action) and not (_action_buttons[action] as Button).disabled


func action_label(action: String) -> String:
	return (_action_buttons[action] as Button).text if _action_buttons.has(action) else ""


func choose(instance_id: String) -> void:
	if _entry_buttons.has(instance_id):
		(_entry_buttons[instance_id] as Button).button_pressed = true


## The next owned hero as the Equip target.
func cycle_target() -> void:
	if not _targets.is_empty():
		_target_index = (_target_index + 1) % _targets.size()
		_refresh()


func press(action: String) -> void:
	if action_enabled(action):
		(_action_buttons[action] as Button).pressed.emit()


func _current_target() -> String:
	if _targets.is_empty():
		return ""
	return str(_targets[_target_index % _targets.size()]["id"])


func _on_toggled(pressed: bool, instance_id: String) -> void:
	if not pressed:
		return
	selected = instance_id
	_status_label.text = ""
	_refresh()


func _on_action_pressed(action: String) -> void:
	var entry: GameViews.InventoryEntry = _entries.get(selected)
	if entry == null:
		return
	action_requested.emit(action, entry, _current_target() if action == "equip" else "")


func _refresh() -> void:
	var target_name: String = str(_targets[_target_index % _targets.size()]["name"]) if not _targets.is_empty() else "-"
	_target_button.text = "Equip to: %s" % target_name
	var entry: GameViews.InventoryEntry = _entries.get(selected)
	var have: bool = entry != null
	(_action_buttons["equip"] as Button).disabled = not have or _targets.is_empty()
	(_action_buttons["unequip"] as Button).disabled = not have or entry.equipped_character_id.is_empty()
	(_action_buttons["toggle_lock"] as Button).disabled = not have
	(_action_buttons["toggle_lock"] as Button).text = "Unlock" if have and entry.locked else "Lock"
	(_action_buttons["dismantle"] as Button).disabled = not have or not entry.can_dismantle
	(_action_buttons["reroll"] as Button).disabled = not have or not entry.can_reroll
	(_action_buttons["level_up"] as Button).disabled = not have or not entry.can_level_up
