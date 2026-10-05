extends GutTest
## INF-037 end to end: two real clients against the real Worker (server/e2e/run.sh). One adds the other by friend code,
## the other accepts; both see the friendship; one renames and the other sees the new name; a report and a block end it.

var _server: String = OS.get_environment("UOMD_E2E_SERVER")


class E2ESigner extends SignInFlow.Signer:
	var subject: String = ""

	func request_id_token(_server_client_id: String, nonce: String) -> Dictionary:
		return {"status": "ok", "id_token": "e2e:%s|%s" % [subject, nonce], "error": ""}


func _player(subject: String) -> GameFlow:
	var backend: OnlineBackend = OnlineBackend.new(_server)
	var signer: E2ESigner = E2ESigner.new()
	signer.subject = subject
	var session: Outcome = await SignInFlow.run(backend, "e2e-client", signer)
	assert_true(session.is_ok(), session.error)
	backend.session_token = str((session.value as Dictionary)["session_token"])
	var flow: GameFlow = GameFlow.create()
	flow.backend = backend
	return flow


func _overview(flow: GameFlow) -> GameViews.FriendsView:
	var overview: Outcome = await flow.friends_overview()
	assert_true(overview.is_ok(), overview.error)
	return overview.value


func test_two_players_become_friends_and_part() -> void:
	if _server.is_empty():
		pending("UOMD_E2E_SERVER is not set (run server/e2e/run.sh)")
		return
	var stamp: int = Time.get_ticks_usec()
	var ash: GameFlow = await _player("ash%d" % stamp)
	var ember: GameFlow = await _player("ember%d" % stamp)
	var ember_view: GameViews.FriendsView = await _overview(ember)
	assert_eq(ember_view.rows.size(), 0)

	var sent: Outcome = await ash.friend_action("add", null, ember_view.friend_code.to_lower().replace("-", " "))
	assert_true(sent.is_ok(), sent.error)
	ember_view = await _overview(ember)
	assert_eq(ember_view.rows.size(), 1)
	var request: GameViews.FriendRow = ember_view.rows[0]
	assert_eq(request.relationship, "pending_in")
	var accepted: Outcome = await ember.friend_action("accept", request)
	assert_true(accepted.is_ok(), accepted.error)

	var ash_view: GameViews.FriendsView = await _overview(ash)
	assert_eq([ash_view.rows.size(), ash_view.rows[0].relationship, ash_view.friend_count], [1, "accepted", 1])
	var renamed: Outcome = await ember.update_profile({"nickname": "Ember%d" % (stamp % 100000)})
	assert_true(renamed.is_ok(), renamed.error)
	ash_view = await _overview(ash)
	assert_eq(ash_view.rows[0].nickname, "Ember%d" % (stamp % 100000), "the friend sees the new name")

	var friend: GameViews.FriendRow = ash_view.rows[0]
	assert_true((await ash.friend_action("report", friend, "harassment")).is_ok())
	assert_true((await ash.friend_action("block", friend)).is_ok())
	assert_eq((await _overview(ash)).rows.size(), 0)
	assert_eq((await _overview(ember)).rows.size(), 0, "the block ended the friendship on both sides")
	var blocked: Outcome = await ash.blocked_players()
	assert_eq(((blocked.value as Array)[0] as Dictionary)["account_id"], friend.account_id)
	var again: Outcome = await ember.friend_action("add", null, (await _overview(ash)).friend_code)
	assert_eq(again.error_kind, "forbidden", "the blocked player cannot ask again")
