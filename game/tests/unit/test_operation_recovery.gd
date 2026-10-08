extends GutTest
## INF-013: a mutation whose reply never arrived keeps its Idempotency-Key until its outcome is settled, so a retry is never applied twice
## and an abandoned request is never replayed as a new action.

const STATE_REPLY: String = "{\"state\": {}}"
const NOT_FOUND: String = "{\"error\": {\"code\": \"ITEM_NOT_FOUND\", \"message\": \"No committed operation with this key\"}}"


class ScriptedTransport extends OnlineBackend.Transport:
	var replies: Array[Dictionary] = []
	var sent: Array[Dictionary] = []

	func request(method: int, url: String, headers: PackedStringArray, body: String) -> Dictionary:
		sent.append({"method": method, "url": url, "headers": headers, "body": body})
		return replies.pop_front() if not replies.is_empty() else {"status": 0, "body": ""}


func _backend(replies: Array[Dictionary]) -> Array:
	var transport: ScriptedTransport = ScriptedTransport.new()
	transport.replies = replies
	return [OnlineBackend.new("https://api.example", "token-1", transport), transport]


static func _key(request: Dictionary) -> String:
	for header: String in request["headers"]:
		if header.begins_with("Idempotency-Key:"):
			return header.substr("Idempotency-Key:".length()).strip_edges()
	return ""


static func _lost() -> Dictionary:
	return {"status": 0, "body": ""}


func test_a_lost_reply_keeps_the_key_and_the_retry_reuses_it() -> void:
	var pair: Array = _backend([_lost(), _lost(), {"status": 200, "body": STATE_REPLY}] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	var first: Outcome = await backend.gacha_pull("hall_of_ancestors", 10)
	assert_eq(first.error_kind, GameBackend.KIND_OFFLINE)
	assert_true(backend.has_pending_operation(), "the pull may have committed")
	assert_true((await backend.gacha_pull("hall_of_ancestors", 10)).is_ok())
	var sent: Array[Dictionary] = (pair[1] as ScriptedTransport).sent
	assert_eq(sent.size(), 3)
	assert_eq(_key(sent[2]), _key(sent[0]), "the player's retry is the same request: replayed, never applied twice")
	assert_false(backend.has_pending_operation(), "a reply settles it")


func test_another_mutation_first_settles_the_pending_one() -> void:
	var pair: Array = _backend([_lost(), _lost(), {"status": 404, "body": NOT_FOUND}, {"status": 200, "body": STATE_REPLY}] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	await backend.advance_story()
	var pending_key: String = str(backend.pending["key"])
	assert_true((await backend.claim_inn_meal()).is_ok())
	var sent: Array[Dictionary] = (pair[1] as ScriptedTransport).sent
	assert_eq([sent[2]["method"], sent[2]["url"]], [HTTPClient.METHOD_GET, "https://api.example/v1/operations/%s" % pending_key])
	assert_eq(sent[3]["url"], "https://api.example/v1/ration/inn-meal")
	assert_ne(_key(sent[3]), pending_key, "a different action gets its own key")
	assert_false(backend.has_pending_operation())
	await backend.advance_story()
	assert_ne(_key((pair[1] as ScriptedTransport).sent[-1]), pending_key, "the settled advance is never replayed later")


func test_a_committed_pending_operation_is_settled_too() -> void:
	var committed: String = "{\"operation_key\": \"k\", \"endpoint\": \"story_advance\", \"response\": {\"state\": {}}}"
	var pair: Array = _backend([_lost(), _lost(), {"status": 200, "body": committed}, {"status": 200, "body": STATE_REPLY}] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	await backend.advance_story()
	assert_true((await backend.claim_inn_meal()).is_ok())
	assert_false(backend.has_pending_operation())


func test_nothing_else_is_sent_while_the_pending_operation_cannot_be_settled() -> void:
	var pair: Array = _backend([_lost(), _lost(), _lost()] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	await backend.advance_story()
	var pending_key: String = str(backend.pending["key"])
	assert_eq((await backend.claim_inn_meal()).error_kind, GameBackend.KIND_OFFLINE)
	var sent: Array[Dictionary] = (pair[1] as ScriptedTransport).sent
	assert_eq(sent.size(), 3, "two tries of the advance, one settle attempt, no inn meal")
	assert_eq(str(backend.pending["key"]), pending_key, "still pending")


func test_only_replies_without_an_api_answer_are_uncertain() -> void:
	var cases: Array = [
		[{"status": 502, "body": "<html>Bad gateway</html>"}, true],
		[{"status": 500, "body": "{\"error\": {\"code\": \"INTERNAL_ERROR\", \"message\": \"x\"}}"}, false],
		[{"status": 409, "body": "{\"error\": {\"code\": \"CONFLICT\", \"message\": \"x\"}}"}, false],
		[{"status": 200, "body": STATE_REPLY}, false],
	]
	for case: Array in cases:
		var backend: OnlineBackend = _backend([case[0]] as Array[Dictionary])[0]
		await backend.advance_story()
		assert_eq(backend.has_pending_operation(), case[1], str(case[0]))


func test_reads_neither_create_nor_settle_a_pending_operation() -> void:
	var pair: Array = _backend([_lost(), _lost(), {"status": 200, "body": "{\"schema_version\": 1}"}] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	await backend.advance_story()
	assert_true((await backend.fetch_state()).is_ok())
	assert_true(backend.has_pending_operation(), "the snapshot does not say whether that request committed")


func test_a_renewal_into_another_account_drops_the_pending_operation() -> void:
	var pair: Array = _backend([_lost(), _lost(), {"status": 401, "body": "{\"error\": {\"code\": \"UNAUTHORIZED\", \"message\": \"expired\"}}"}] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	backend.reauthenticate = func() -> Outcome: return Outcome.fail(OnlineBackend.KIND_ACCOUNT_CHANGED, "another account")
	await backend.advance_story()
	assert_eq((await backend.advance_story()).error_kind, OnlineBackend.KIND_ACCOUNT_CHANGED)
	assert_false(backend.has_pending_operation(), "a request made for one account is never sent for another")


func test_without_a_bound_account_no_session_is_renewed() -> void:
	var saved: String = Online.account_id
	Online.account_id = ""
	assert_eq((await Online.renew_session()).error_kind, Online.KIND_ACCOUNT_CHANGED)
	Online.account_id = saved
