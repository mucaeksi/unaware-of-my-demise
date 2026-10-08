class_name QuestsScreen
extends UiScreen
## Quests: today's tasks, the window chest, the active weekly segment and unclaimed weekly mail (port of client/screens/quests_screen.py). The
## rows arrive computed by `GameFlow.quest_rows()` from the server's verified progress; the screen lists them and reports which one to claim.

signal claim_requested(kind: String, task_id: String, period: String)
signal back_requested
## INF-036: one rewarded ad for Eclipse Tokens (the server pays when AdMob confirms; LEGACY offered it here).
signal ad_requested

const STATE_TEXT: Dictionary = {"locked": "in progress", "claimable": "READY", "claimed": "claimed"}

var selected: String = ""

var _list: VBoxContainer = null
var _status_label: Label = null
var _claim_button: Button = null
var _ad_button: Button = null
var _ad_available: bool = false
var _group: ButtonGroup = null
var _rows: Dictionary = {}
var _row_buttons: Dictionary = {}
var _busy: bool = false


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Quests", UiTheme.TITLE))
	_list = UiKit.scroll_column(column, 12)
	_status_label = UiKit.label("")
	column.add_child(_status_label)
	var footer: HBoxContainer = UiKit.row(16)
	_claim_button = UiKit.button("Claim")
	_claim_button.disabled = true
	_claim_button.pressed.connect(_on_claim)
	footer.add_child(_claim_button)
	_ad_button = UiKit.button("Watch an ad")
	_ad_button.visible = false
	_ad_button.pressed.connect(func() -> void:
		if not _busy and _ad_available:
			ad_requested.emit())
	footer.add_child(_ad_button)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void:
		if not _busy:
			back_requested.emit())
	footer.add_child(back)
	column.add_child(footer)


func load_quests(rows: Array[GameViews.QuestRow], selected_key: String = "", status: String = "") -> void:
	ensure_built()
	UiKit.clear(_list)
	_rows.clear()
	_row_buttons.clear()
	_group = ButtonGroup.new()
	selected = ""
	_busy = false
	for row: GameViews.QuestRow in rows:
		var button: Button = UiKit.button(row_text(row), true)
		button.button_group = _group
		button.custom_minimum_size = Vector2(0, 150)
		button.toggled.connect(_on_toggled.bind(row.key()))
		_list.add_child(button)
		_rows[row.key()] = row
		_row_buttons[row.key()] = button
	if _row_buttons.has(selected_key):
		(_row_buttons[selected_key] as Button).button_pressed = true
	_status_label.text = status
	_refresh()


## "Win Three Battles  2/3  [in progress]" over the reward line.
static func row_text(row: GameViews.QuestRow) -> String:
	return "%s  %d/%d  [%s]\nReward: %s" % [row.title, row.progress, row.target, str(STATE_TEXT.get(row.state, row.state)), row.reward_text]


## `label`: "" hides the ad button; otherwise its text ("Watch an ad (+30)  2/4"); `available`: whether it may be pressed.
func set_ad(label: String, available: bool) -> void:
	ensure_built()
	_ad_button.visible = not label.is_empty()
	_ad_button.text = label
	_ad_available = available
	_refresh()


func ad_enabled() -> bool:
	return _ad_button.visible and not _ad_button.disabled


func press_ad() -> void:
	if ad_enabled():
		_ad_button.pressed.emit()


func set_busy(busy: bool) -> void:
	_busy = busy
	_refresh()


func row_keys() -> Array[String]:
	var keys: Array[String] = []
	for key: String in _row_buttons:
		keys.append(key)
	return keys


func row_label(key: String) -> String:
	return (_row_buttons[key] as Button).text if _row_buttons.has(key) else ""


func choose(key: String) -> void:
	if _row_buttons.has(key):
		(_row_buttons[key] as Button).button_pressed = true


func claim_enabled() -> bool:
	return not _claim_button.disabled


func press_claim() -> void:
	if claim_enabled():
		_claim_button.pressed.emit()


func status_text() -> String:
	return _status_label.text


func _on_toggled(pressed: bool, key: String) -> void:
	if pressed:
		selected = key
		_refresh()


func _on_claim() -> void:
	var row: GameViews.QuestRow = _rows.get(selected)
	if row != null and row.state == "claimable" and not _busy:
		claim_requested.emit(row.kind, row.task_id, row.period)


func _refresh() -> void:
	var row: GameViews.QuestRow = _rows.get(selected)
	_claim_button.disabled = row == null or row.state != "claimable" or _busy
	_claim_button.text = "Claiming..." if _busy else "Claim"
	_ad_button.disabled = _busy or not _ad_available
