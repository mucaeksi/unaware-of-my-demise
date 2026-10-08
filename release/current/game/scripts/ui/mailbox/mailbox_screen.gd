class_name MailboxScreen
extends UiScreen
## Mail and notices (INF-035, DEC-0034): the operators' notices running now, then the player's open mail with Claim for
## the ones that carry rewards. The server pays each mail once; the screen only reports which Claim was pressed.

signal claim_requested(mail_id: String)
signal back_requested

var _notices: VBoxContainer = null
var _list: VBoxContainer = null
var _status_label: Label = null
var _claim_buttons: Dictionary = {}
var _claimed: Dictionary = {}
var _busy: bool = false


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Mail", UiTheme.TITLE))
	_notices = UiKit.column(8)
	column.add_child(_notices)
	_list = UiKit.scroll_column(column, 16)
	_status_label = UiKit.label("")
	column.add_child(_status_label)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void:
		if not _busy:
			back_requested.emit())
	column.add_child(back)


## `notices`: [{"title", "body"}]; `mail`: GameFlow.mailbox()'s rows.
func load_mailbox(notices: Array[Dictionary], mail: Array[GameViews.MailRow], status: String = "") -> void:
	ensure_built()
	UiKit.clear(_notices)
	UiKit.clear(_list)
	_claim_buttons.clear()
	_claimed.clear()
	_busy = false
	for notice: Dictionary in notices:
		var text: VBoxContainer = UiKit.column(4)
		text.add_child(UiKit.label(str(notice.get("title", ""))))
		text.add_child(UiKit.label(str(notice.get("body", "")), UiTheme.DIM))
		_notices.add_child(UiKit.card(text))
	_notices.visible = not notices.is_empty()
	if mail.is_empty():
		_list.add_child(UiKit.label("No mail.", UiTheme.DIM))
	for row: GameViews.MailRow in mail:
		_list.add_child(UiKit.card(_mail_card(row)))
	_status_label.text = status


func _mail_card(row: GameViews.MailRow) -> VBoxContainer:
	var card: VBoxContainer = UiKit.column(6)
	card.add_child(UiKit.label(row.title))
	if not row.body.is_empty():
		card.add_child(UiKit.label(row.body, UiTheme.DIM))
	if not row.reward_text.is_empty():
		card.add_child(UiKit.label("Rewards: %s" % row.reward_text, UiTheme.SMALL))
	card.add_child(UiKit.label("Until %s UTC" % row.expires_at, UiTheme.SMALL))
	if not row.reward_text.is_empty():
		var claim: Button = UiKit.button("Claimed" if row.claimed else "Claim")
		claim.disabled = row.claimed
		var mail_id: String = row.mail_id
		claim.pressed.connect(func() -> void:
			if not claim.disabled and not _busy:
				claim_requested.emit(mail_id))
		card.add_child(claim)
		_claim_buttons[mail_id] = claim
		_claimed[mail_id] = row.claimed
	return card


func set_busy(busy: bool) -> void:
	_busy = busy
	for mail_id: String in _claim_buttons:
		(_claim_buttons[mail_id] as Button).disabled = busy or bool(_claimed[mail_id])


func status_text() -> String:
	return _status_label.text


## The mail ids that have a Claim button, and whether each can be pressed now.
func claimable() -> Dictionary:
	var open: Dictionary = {}
	for mail_id: String in _claim_buttons:
		open[mail_id] = not (_claim_buttons[mail_id] as Button).disabled
	return open


func notice_count() -> int:
	return _notices.get_child_count()


func press_claim(mail_id: String) -> void:
	if _claim_buttons.has(mail_id):
		(_claim_buttons[mail_id] as Button).pressed.emit()
