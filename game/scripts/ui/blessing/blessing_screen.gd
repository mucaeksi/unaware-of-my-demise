class_name BlessingScreen
extends UiScreen
## The Eclipse Blessing (INF-036; port of client/screens/blessing_screen.py): the subscription's state, Claim for the
## open twelve-hour rewards, Subscribe (Google Play's sheet, with Play's price) and Restore (a purchase made on another
## device or not reported yet). Every grant is the server's; the screen reports which button was pressed.

signal claim_requested
signal buy_requested
signal restore_requested
signal back_requested

var _info_label: Label = null
var _status_label: Label = null
var _claim_button: Button = null
var _buy_button: Button = null
var _restore_button: Button = null
var _claimable: int = 0
var _can_buy: bool = false
var _busy: bool = false


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Eclipse Blessing", UiTheme.TITLE))
	_info_label = UiKit.label("")
	column.add_child(_info_label)
	column.add_child(UiKit.spacer(0, true))
	_status_label = UiKit.label("")
	column.add_child(_status_label)
	_claim_button = UiKit.button("Claim")
	_claim_button.pressed.connect(func() -> void:
		if not _claim_button.disabled:
			claim_requested.emit())
	column.add_child(_claim_button)
	_buy_button = UiKit.button("Subscribe")
	_buy_button.pressed.connect(func() -> void:
		if not _buy_button.disabled:
			buy_requested.emit())
	column.add_child(_buy_button)
	_restore_button = UiKit.button("Restore purchase")
	_restore_button.pressed.connect(func() -> void:
		if not _restore_button.disabled:
			restore_requested.emit())
	column.add_child(_restore_button)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void:
		if not _busy:
			back_requested.emit())
	column.add_child(back)


## `view`: Monetization.blessing()'s value; `terms`: the authored subscription (GameFlow.blessing_rules()); `price`: Play's
## price line ("" when unknown); `can_buy`: Play Billing exists here.
func load_blessing(view: Dictionary, terms: Dictionary, price: String, can_buy: bool, status: String = "") -> void:
	ensure_built()
	_claimable = int(view.get("claimable", 0))
	_can_buy = can_buy
	_busy = false
	_info_label.text = info_text(view, terms, price)
	_status_label.text = status
	_refresh()


static func info_text(view: Dictionary, terms: Dictionary, price: String) -> String:
	if bool(view.get("revoked", false)):
		return "This Eclipse Blessing was refunded or revoked by Google Play: no further rewards."
	if bool(view.get("subscribed", false)):
		return "Active until %s UTC\n%d twelve-hour reward(s) ready (%d Eclipse Tokens each)\nClaimed this period: %d/%d" % [
			str(view.get("expires_at", "")).left(16).replace("T", " "), int(view.get("claimable", 0)), int(view.get("window_tokens", 0)),
			int(view.get("claimed_this_period", 0)), int(view.get("windows_per_period", 60))]
	var days: int = int(terms.get("duration_days", 30))
	var text: String = "Eclipse Blessing: %d days of extra Eclipse Tokens.\nInstant %s, then %s every twelve hours (%s in total).\nRenews every %d days until you cancel it in Google Play." % [
		days, GameViews.number_text(terms.get("instant_eclipse_token", 0)), GameViews.number_text(terms.get("halfday_entitlement_token", 0)),
		GameViews.number_text(terms.get("expected_total_eclipse_token", 0)), days]
	if not price.is_empty():
		text += "\nPrice: %s" % price
	return text


func set_busy(busy: bool) -> void:
	_busy = busy
	_refresh()


func status_text() -> String:
	return _status_label.text


func claim_text() -> String:
	return _claim_button.text


func buttons_enabled() -> Dictionary:
	return {"claim": not _claim_button.disabled, "buy": not _buy_button.disabled, "restore": not _restore_button.disabled}


func _refresh() -> void:
	_claim_button.disabled = _busy or _claimable <= 0
	_claim_button.text = "Claim (%d)" % _claimable if _claimable > 0 else "Claim"
	_buy_button.disabled = _busy or not _can_buy
	_restore_button.disabled = _busy or not _can_buy


## Android Back/Escape follows the visible Back button while an action is pending.
func handle_back() -> bool:
	if not _busy: back_requested.emit()
	return true
