extends GutTest
## INF-037 on the client: the friends screen offers only the actions a row's relationship allows (LEGACY's table plus
## cancel), and GameFlow turns the server's replies into the screen's view and its actions into the right calls.

class _Backend extends GameBackend:
	var calls: Array = []
	var pages: Array[Dictionary] = []

	func fetch_account() -> Outcome:
		return Outcome.ok({"friend_code": "ABCD-2345", "nickname": "Ash", "presence_opt_in": false, "nickname_change_available_at_utc": "2026-10-06T12:00:00.000Z"})

	func friends(cursor: String = "") -> Outcome:
		calls.append(["friends", cursor])
		return Outcome.ok(pages.pop_front())

	func send_friend_request(code: String) -> Outcome:
		calls.append(["add", code])
		return Outcome.ok({"relationship": "pending_out"})

	func answer_friend_request(request_id: String, answer: String) -> Outcome:
		calls.append([answer, request_id])
		return Outcome.ok({})

	func remove_friend(account_id: String) -> Outcome:
		calls.append(["remove", account_id])
		return Outcome.ok({})

	func block_player(account_id: String) -> Outcome:
		calls.append(["block", account_id])
		return Outcome.ok({})

	func report_player(account_id: String, reason: String) -> Outcome:
		calls.append(["report", account_id, reason])
		return Outcome.ok({})


static var _flow: GameFlow = null


func before_all() -> void:
	if _flow == null:
		_flow = GameFlow.create()


func _item(account_id: String, relationship: String, request_id: Variant = null) -> Dictionary:
	return {"account_id": account_id, "nickname": account_id.to_upper(), "player_level": 3, "presence": "online", "relationship": relationship, "request_id": request_id}


func _row(account_id: String, relationship: String) -> GameViews.FriendRow:
	var row: GameViews.FriendRow = GameViews.FriendRow.new()
	row.account_id = account_id
	row.nickname = account_id.to_upper()
	row.relationship = relationship
	row.request_id = "freq_%s" % account_id
	return row


func test_the_overview_reads_the_profile_and_every_page() -> void:
	var backend: _Backend = _Backend.new()
	backend.pages = [
		{"items": [_item("a", "accepted")], "next_cursor": "1.acct_x", "counts": {"friends": 1}, "limits": {"friends": 50}},
		{"items": [_item("b", "pending_in", "freq_b")], "next_cursor": null, "counts": {"friends": 1}, "limits": {"friends": 50}},
	]
	_flow.backend = backend
	var overview: Outcome = await _flow.friends_overview()
	assert_true(overview.is_ok(), overview.error)
	var view: GameViews.FriendsView = overview.value
	assert_eq([view.friend_code, view.nickname, view.presence_opt_in, view.friend_count, view.friend_limit], ["ABCD-2345", "Ash", false, 1, 50])
	assert_eq(view.nickname_change_available_at, "2026-10-06T12:00:00.000Z")
	assert_eq(view.rows.size(), 2)
	assert_eq([view.rows[1].relationship, view.rows[1].request_id, view.rows[1].player_level], ["pending_in", "freq_b", 3])
	assert_eq(backend.calls, [["friends", ""], ["friends", "1.acct_x"]], "the second page asks with the first page's cursor")


func test_actions_call_the_server_with_the_rows_ids() -> void:
	var backend: _Backend = _Backend.new()
	_flow.backend = backend
	await _flow.friend_action("add", null, "abcd 2345")
	await _flow.friend_action("accept", _row("b", "pending_in"))
	await _flow.friend_action("cancel", _row("c", "pending_out"))
	await _flow.friend_action("remove", _row("d", "accepted"))
	await _flow.friend_action("block", _row("e", "accepted"))
	await _flow.friend_action("report", _row("e", "accepted"), "cheating")
	assert_eq(backend.calls, [["add", "abcd 2345"], ["accept", "freq_b"], ["cancel", "freq_c"], ["remove", "d"], ["block", "e"], ["report", "e", "cheating"]])
	assert_false((await _flow.friend_action("hug", _row("e", "accepted"))).is_ok())


func _screen(rows: Array[GameViews.FriendRow]) -> FriendsScreen:
	var view: GameViews.FriendsView = GameViews.FriendsView.new()
	view.friend_code = "ABCD-2345"
	view.nickname = "Ash"
	view.friend_count = 1
	view.friend_limit = 50
	view.rows = rows
	var screen: FriendsScreen = add_child_autofree(FriendsScreen.new())
	screen.load_friends(view)
	return screen


func test_the_screen_offers_only_what_fits_the_relationship() -> void:
	var screen: FriendsScreen = _screen([_row("a", "accepted"), _row("b", "pending_in"), _row("c", "pending_out")] as Array[GameViews.FriendRow])
	assert_eq(screen.row_label("b"), "B  Lv 1  offline\n[wants to be your friend]")
	for action: String in FriendsScreen.ACTIONS:
		assert_false(screen.action_enabled(action), "%s needs a chosen player" % action)
	var expected: Dictionary = {
		"a": ["remove", "block", "report"],
		"b": ["accept", "reject", "block", "report"],
		"c": ["cancel", "block", "report"],
	}
	for account_id: String in expected:
		screen.select(account_id)
		var enabled: Array = []
		for action: String in FriendsScreen.ACTIONS:
			if screen.action_enabled(action):
				enabled.append(action)
		assert_eq(enabled, expected[account_id], account_id)


func test_the_screen_reports_the_chosen_action_reason_and_typed_code() -> void:
	var screen: FriendsScreen = _screen([_row("a", "accepted")] as Array[GameViews.FriendRow])
	watch_signals(screen)
	screen.select("a")
	screen.choose_reason("inappropriate_name")
	screen.press("report")
	assert_signal_emitted_with_parameters(screen, "action_requested", ["report", "a", "inappropriate_name"])
	screen.press("accept")
	assert_signal_emit_count(screen, "action_requested", 1, "accept does not fit a friend")
	screen.type_code(" abcd-2345 ")
	screen.press_add()
	assert_signal_emitted_with_parameters(screen, "action_requested", ["add", "", "abcd-2345"])
	screen.set_busy(true)
	screen.press("remove")
	assert_signal_emit_count(screen, "action_requested", 2, "nothing while busy")


func test_an_empty_list_says_how_to_start() -> void:
	var screen: FriendsScreen = _screen([] as Array[GameViews.FriendRow])
	assert_eq(screen.row_ids(), [] as Array[String])
	assert_string_contains(FriendsScreen.profile_text(GameViews.FriendsView.new()), "Friend code")
