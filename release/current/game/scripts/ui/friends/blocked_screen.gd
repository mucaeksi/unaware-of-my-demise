class_name BlockedScreen
extends UiScreen
## The players this player blocked (INF-037), each with Unblock. A block is one-sided: the blocked player is never told.

signal unblock_requested(account_id: String)
signal back_requested

var _list: VBoxContainer = null
var _status_label: Label = null
var _buttons: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Blocked players", UiTheme.TITLE))
	column.add_child(UiKit.label("They cannot send you friend requests. They are not told that you blocked them.", UiTheme.DIM))
	_list = UiKit.scroll_column(column, 12)
	_status_label = UiKit.label("")
	column.add_child(_status_label)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void: back_requested.emit())
	column.add_child(back)


## `players`: [{"account_id", "nickname"}].
func load_blocked(players: Array, status: String = "") -> void:
	ensure_built()
	UiKit.clear(_list)
	_buttons.clear()
	if players.is_empty():
		_list.add_child(UiKit.label("Nobody is blocked.", UiTheme.DIM))
	for player: Variant in players:
		if not (player is Dictionary):
			continue
		var account_id: String = str((player as Dictionary).get("account_id", ""))
		var row: HBoxContainer = UiKit.row(12)
		var name: Label = UiKit.label(str((player as Dictionary).get("nickname", "")), "", false)
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(name)
		var unblock: Button = UiKit.button("Unblock")
		unblock.pressed.connect(func() -> void: unblock_requested.emit(account_id))
		row.add_child(unblock)
		_list.add_child(row)
		_buttons[account_id] = unblock
	_status_label.text = status


func player_ids() -> Array[String]:
	var ids: Array[String] = []
	for account_id: String in _buttons:
		ids.append(account_id)
	return ids


func press_unblock(account_id: String) -> void:
	if _buttons.has(account_id):
		(_buttons[account_id] as Button).pressed.emit()
