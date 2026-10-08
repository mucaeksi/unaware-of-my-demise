class_name FriendsScreen
extends UiScreen
## Friends (INF-037; port of client/screens/friends_screen.py): the player's own name, friend code and presence setting,
## add by friend code, and one list of friends and requests either way. A row is chosen, then an action that fits its
## relationship (LEGACY's table, plus cancelling one's own request). Every rule is the server's: the screen only says
## which action the player chose.

signal action_requested(action: String, account_id: String, argument: String)
signal rename_requested(nickname: String)
signal presence_changed(show_presence: bool)
signal blocked_requested
signal back_requested

## The LEGACY report reasons, in its order.
const REASONS: Array[String] = ["spam", "harassment", "inappropriate_name", "cheating", "other"]
const REASON_TEXT: Dictionary = {"spam": "Spam", "harassment": "Harassment", "inappropriate_name": "Inappropriate name",
	"cheating": "Cheating", "other": "Other"}
const STATE_TEXT: Dictionary = {"pending_in": "wants to be your friend", "accepted": "friend", "pending_out": "request sent"}
## action -> the relationships it applies to (empty = any chosen player).
const ACTIONS: Dictionary = {
	"accept": ["pending_in"], "reject": ["pending_in"], "cancel": ["pending_out"],
	"remove": ["accepted"], "block": [], "report": [],
}
const ACTION_TEXT: Dictionary = {"accept": "Accept", "reject": "Reject", "cancel": "Cancel request",
	"remove": "Remove", "block": "Block", "report": "Report"}

var selected: String = ""

var _profile_label: Label = null
var _code: String = ""
var _name_input: LineEdit = null
var _rename_button: Button = null
var _presence_toggle: CheckButton = null
var _code_input: LineEdit = null
var _add_button: Button = null
var _count_label: Label = null
var _list: VBoxContainer = null
var _status_label: Label = null
var _reason: OptionButton = null
var _action_buttons: Dictionary = {}
var _rows: Dictionary = {}
var _row_buttons: Dictionary = {}
var _group: ButtonGroup = null
var _busy: bool = false
var _loading: bool = false
## False while the server's wait between nickname changes runs.
var _rename_allowed: bool = true


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Friends", UiTheme.TITLE))
	_profile_label = UiKit.label("")
	column.add_child(_profile_label)
	var profile_row: HBoxContainer = UiKit.row(12)
	_name_input = LineEdit.new()
	_name_input.placeholder_text = "New name (3-16 characters)"
	_name_input.max_length = 16
	_name_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	profile_row.add_child(_name_input)
	_rename_button = UiKit.button("Rename")
	_rename_button.pressed.connect(func() -> void:
		var name: String = _name_input.text.strip_edges()
		if not name.is_empty() and not _busy:
			rename_requested.emit(name))
	profile_row.add_child(_rename_button)
	var copy: Button = UiKit.button("Copy code")
	copy.pressed.connect(func() -> void: DisplayServer.clipboard_set(_code))
	profile_row.add_child(copy)
	column.add_child(profile_row)
	_presence_toggle = CheckButton.new()
	_presence_toggle.text = "Show friends when I'm online"
	_presence_toggle.toggled.connect(func(on: bool) -> void:
		if not _loading and not _busy:
			presence_changed.emit(on))
	column.add_child(_presence_toggle)

	var add_row: HBoxContainer = UiKit.row(12)
	_code_input = LineEdit.new()
	_code_input.placeholder_text = "Friend code (XXXX-XXXX)"
	# Room for a pasted code with spaces around it; the server normalizes "abcd 2345", " ABCD-2345 " and "ABCD2345".
	_code_input.max_length = 12
	_code_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_row.add_child(_code_input)
	_add_button = UiKit.button("Add")
	_add_button.pressed.connect(_on_add)
	add_row.add_child(_add_button)
	column.add_child(add_row)

	_count_label = UiKit.label("", UiTheme.DIM)
	column.add_child(_count_label)
	_list = UiKit.scroll_column(column, 12)
	_status_label = UiKit.label("")
	column.add_child(_status_label)

	var first: HBoxContainer = UiKit.row(12)
	var second: HBoxContainer = UiKit.row(12)
	for action: String in ACTIONS:
		var button: Button = UiKit.button(str(ACTION_TEXT[action]))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_action.bind(action))
		_action_buttons[action] = button
		(first if action in ["accept", "reject", "cancel"] else second).add_child(button)
	column.add_child(first)
	column.add_child(second)
	var report_row: HBoxContainer = UiKit.row(12)
	report_row.add_child(UiKit.label("Report reason:", UiTheme.DIM, false))
	_reason = OptionButton.new()
	_reason.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for reason: String in REASONS:
		_reason.add_item(str(REASON_TEXT[reason]))
	report_row.add_child(_reason)
	column.add_child(report_row)

	var footer: HBoxContainer = UiKit.row(16)
	var blocked: Button = UiKit.button("Blocked players")
	blocked.pressed.connect(func() -> void:
		if not _busy:
			blocked_requested.emit())
	footer.add_child(blocked)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void:
		if not _busy:
			back_requested.emit())
	footer.add_child(back)
	column.add_child(footer)


func load_friends(view: GameViews.FriendsView, selected_id: String = "", status: String = "") -> void:
	ensure_built()
	_loading = true
	_code = view.friend_code
	_profile_label.text = profile_text(view)
	_name_input.text = ""
	_rename_allowed = view.nickname_change_available_at.is_empty()
	_presence_toggle.button_pressed = view.presence_opt_in
	_count_label.text = "Friends %d/%d" % [view.friend_count, view.friend_limit] if view.friend_limit > 0 else ""
	UiKit.clear(_list)
	_rows.clear()
	_row_buttons.clear()
	_group = ButtonGroup.new()
	selected = ""
	_busy = false
	if view.rows.is_empty():
		_list.add_child(UiKit.label("No friends yet. Share your friend code, or add someone's.", UiTheme.DIM))
	for row: GameViews.FriendRow in view.rows:
		var button: Button = UiKit.button(row_text(row), true)
		button.button_group = _group
		button.custom_minimum_size = Vector2(0, 140)
		button.toggled.connect(_on_toggled.bind(row.account_id))
		_list.add_child(button)
		_rows[row.account_id] = row
		_row_buttons[row.account_id] = button
	if _row_buttons.has(selected_id):
		(_row_buttons[selected_id] as Button).button_pressed = true
	_code_input.text = ""
	_status_label.text = status
	_loading = false
	_refresh()


## "You: Ashen Road   Friend code: ABCD-2345" (and when the name can change again).
static func profile_text(view: GameViews.FriendsView) -> String:
	var text: String = "You: %s   Friend code: %s" % [view.nickname, view.friend_code]
	if not view.nickname_change_available_at.is_empty():
		text += "\nName change possible again at %s (UTC)" % view.nickname_change_available_at.left(16).replace("T", " ")
	return text


## "Ember  Lv 7  online" over "[friend]".
static func row_text(row: GameViews.FriendRow) -> String:
	return "%s  Lv %d  %s\n[%s]" % [row.nickname, row.player_level, row.presence, str(STATE_TEXT.get(row.relationship, row.relationship))]


func set_busy(busy: bool) -> void:
	_busy = busy
	_refresh()


func row_ids() -> Array[String]:
	var ids: Array[String] = []
	for account_id: String in _row_buttons:
		ids.append(account_id)
	return ids


func row_label(account_id: String) -> String:
	return (_row_buttons[account_id] as Button).text if _row_buttons.has(account_id) else ""


func select(account_id: String) -> void:
	if _row_buttons.has(account_id):
		(_row_buttons[account_id] as Button).button_pressed = true


func action_enabled(action: String) -> bool:
	return not (_action_buttons[action] as Button).disabled


func press(action: String) -> void:
	_on_action(action)


func type_code(code: String) -> void:
	_code_input.text = code


func press_add() -> void:
	_on_add()


func choose_reason(reason: String) -> void:
	_reason.select(REASONS.find(reason))


func status_text() -> String:
	return _status_label.text


func _on_toggled(pressed: bool, account_id: String) -> void:
	if pressed:
		selected = account_id
	elif selected == account_id:
		selected = ""
	_refresh()


func _on_add() -> void:
	var code: String = _code_input.text.strip_edges()
	if not code.is_empty() and not _busy:
		action_requested.emit("add", "", code)


func _on_action(action: String) -> void:
	if _busy or not _rows.has(selected) or not _allowed(action, _rows[selected]):
		return
	var argument: String = REASONS[maxi(_reason.selected, 0)] if action == "report" else ""
	action_requested.emit(action, selected, argument)


static func _allowed(action: String, row: GameViews.FriendRow) -> bool:
	var states: Array = ACTIONS[action]
	return states.is_empty() or row.relationship in states


func _refresh() -> void:
	var row: GameViews.FriendRow = _rows.get(selected)
	for action: String in ACTIONS:
		(_action_buttons[action] as Button).disabled = _busy or row == null or not _allowed(action, row)
	_add_button.disabled = _busy
	_rename_button.disabled = _busy or not _rename_allowed
