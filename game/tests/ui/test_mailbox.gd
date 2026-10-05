extends GutTest
## INF-035 on the client: GameFlow turns the server's mail and notices into the mailbox view, the screen offers Claim
## only for unclaimed mail with rewards, and a claim is reported to the server and its snapshot adopted.

class _Backend extends GameBackend:
	var mail_rows: Array = []
	var notices: Variant = []
	var liveops_ok: bool = true
	var claims: Array = []
	var claim_reply: Outcome = null
	var snapshot: Dictionary = {}

	func mail() -> Outcome:
		return Outcome.ok({"mail": mail_rows})

	func liveops() -> Outcome:
		return Outcome.ok({"revision": 3, "flags": {}, "notices": notices}) if liveops_ok else _offline()

	func claim_mail(mail_id: String) -> Outcome:
		claims.append(mail_id)
		return claim_reply if claim_reply != null else Outcome.ok({"mail_id": mail_id, "granted": {"eclipse_tokens": 50}, "state": snapshot})


static var _flow: GameFlow = null


func before_all() -> void:
	if _flow == null:
		_flow = GameFlow.create()


func _backend() -> _Backend:
	assert_true(_flow.is_ready(), _flow.error)
	var backend: _Backend = _Backend.new()
	var story: Dictionary = _flow.rules.story.to_persisted_dict(_flow.rules.story.new_player_state())
	backend.snapshot = JSON.parse_string(JSON.stringify({"schema_version": PlayerState.SCHEMA_VERSION, "story_state": story, "wallet": {}}))
	_flow.backend = backend
	_flow.state = null
	return backend


func _mail(mail_id: String, rewards: Dictionary, claimed: bool = false) -> Dictionary:
	return {"mail_id": mail_id, "title_en": "Title %s" % mail_id, "body_en": "Body", "rewards": rewards, "expires_at_utc": "2026-10-12T00:00:00.000Z", "claimed": claimed}


func test_the_mailbox_view_reads_mail_and_the_notices_running_now() -> void:
	var backend: _Backend = _backend()
	backend.mail_rows = [_mail("mail_a", {"silver_crowns": 1000, "eclipse_tokens": 50, "items": {"torn_chronicle_page": 3}}), _mail("mail_b", {}, false)]
	backend.notices = [{"notice_id": "maintenance", "title_en": "Maintenance", "body_en": "Tonight at 02:00 UTC."}]
	var box: Outcome = await _flow.mailbox()
	assert_true(box.is_ok(), box.error)
	assert_eq(box.value["notices"], [{"title": "Maintenance", "body": "Tonight at 02:00 UTC."}])
	var rows: Array[GameViews.MailRow] = box.value["mail"]
	assert_eq([rows[0].mail_id, rows[0].reward_text, rows[0].expires_at, rows[0].claimed], ["mail_a", "1,000 Silver Crowns, 50 Eclipse Tokens, 3× Torn Chronicle Page", "2026-10-12 00:00", false])
	assert_eq(rows[1].reward_text, "", "a letter without rewards")


func test_notices_are_best_effort_but_mail_is_not() -> void:
	var backend: _Backend = _backend()
	backend.liveops_ok = false
	backend.mail_rows = [_mail("mail_a", {"eclipse_tokens": 5})]
	var box: Outcome = await _flow.mailbox()
	assert_true(box.is_ok(), "the mail still shows when the notices cannot be read")
	assert_eq(box.value["notices"], [])
	backend.mail_rows = []
	_flow.backend = GameBackend.new()
	assert_eq((await _flow.mailbox()).error_kind, GameBackend.KIND_OFFLINE)


func test_a_claim_adopts_the_servers_state_and_names_what_was_paid() -> void:
	var backend: _Backend = _backend()
	var claimed: Outcome = await _flow.claim_mail("mail_a")
	assert_true(claimed.is_ok(), claimed.error)
	assert_eq(backend.claims, ["mail_a"])
	assert_true(_flow.state != null, "the reply's snapshot was adopted")
	assert_eq(StoryDirector.mail_claim_text(_flow, claimed), "Received: 50 Eclipse Tokens.")
	assert_eq(StoryDirector.mail_claim_text(_flow, Outcome.fail("conflict", "This mail was already claimed")), "This mail was already claimed.")
	assert_eq(StoryDirector.mail_claim_text(_flow, Outcome.fail("not_found", "No such mail, or it has expired")), "This mail has expired.")


func _row(mail_id: String, reward_text: String, claimed: bool) -> GameViews.MailRow:
	var row: GameViews.MailRow = GameViews.MailRow.new()
	row.mail_id = mail_id
	row.title = mail_id
	row.reward_text = reward_text
	row.expires_at = "2026-10-12 00:00"
	row.claimed = claimed
	return row


func test_the_screen_offers_claim_only_for_unclaimed_rewards() -> void:
	var screen: MailboxScreen = add_child_autofree(MailboxScreen.new())
	watch_signals(screen)
	screen.load_mailbox([{"title": "News", "body": "Hello"}] as Array[Dictionary],
		[_row("mail_a", "50 Eclipse Tokens", false), _row("mail_b", "5 Eclipse Tokens", true), _row("mail_c", "", false)] as Array[GameViews.MailRow], "Received.")
	assert_eq(screen.claimable(), {"mail_a": true, "mail_b": false}, "a letter has no Claim; a claimed mail cannot be pressed")
	assert_eq(screen.notice_count(), 1)
	assert_eq(screen.status_text(), "Received.")
	screen.press_claim("mail_b")
	screen.press_claim("mail_a")
	assert_signal_emit_count(screen, "claim_requested", 1)
	assert_signal_emitted_with_parameters(screen, "claim_requested", ["mail_a"])
	screen.set_busy(true)
	assert_eq(screen.claimable(), {"mail_a": false, "mail_b": false}, "nothing can be pressed while a claim runs")
	screen.set_busy(false)
	assert_eq(screen.claimable(), {"mail_a": true, "mail_b": false})


func test_an_empty_mailbox_says_so() -> void:
	var screen: MailboxScreen = add_child_autofree(MailboxScreen.new())
	screen.load_mailbox([] as Array[Dictionary], [] as Array[GameViews.MailRow])
	assert_eq(screen.claimable(), {})
	assert_eq(screen.notice_count(), 0)
