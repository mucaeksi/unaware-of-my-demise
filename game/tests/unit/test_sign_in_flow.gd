extends GutTest
## INF-017/INF-019: Google sign-in (`SignInFlow`, `Online`) against a scripted transport and a fake Credential Manager, session renewal
## on 401 with the same Idempotency-Key, and the Android plugin's packaging contract.

const SESSION_REPLY: String = "{\"account_id\": \"acct_1\", \"session_token\": \"session-1\", \"expires_at_utc\": \"2026-10-04T18:00:00Z\", \"is_new_account\": true}"


## Answers each request with the next scripted reply and records what it was sent.
class ScriptedTransport extends OnlineBackend.Transport:
	var replies: Array[Dictionary] = []
	var sent: Array[Dictionary] = []

	func request(method: int, url: String, headers: PackedStringArray, body: String) -> Dictionary:
		sent.append({"method": method, "url": url, "headers": headers, "body": body})
		return replies.pop_front() if not replies.is_empty() else {"status": 0, "body": ""}


## A Credential Manager stand-in: answers `results` in order and records what it was asked.
class FakeSigner extends SignInFlow.Signer:
	var results: Array[Dictionary] = []
	var asked: Array[Array] = []

	func request_id_token(server_client_id: String, nonce: String) -> Dictionary:
		asked.append([server_client_id, nonce])
		return results.pop_front() if not results.is_empty() else {"status": "error", "id_token": "", "error": "no scripted result"}


var _saved_signer: SignInFlow.Signer = null
var _saved_transport: OnlineBackend.Transport = null
var _saved_preferences_path: String


func before_each() -> void:
	_saved_signer = Online.signer
	_saved_transport = Online.transport
	_saved_preferences_path = Online.preferences_path
	Online.preferences_path = "user://test_sign_in_preferences.cfg"
	DirAccess.remove_absolute(Online.preferences_path)
	Online.session_token = ""
	Online.account_id = ""


func after_each() -> void:
	Online.signer = _saved_signer
	Online.transport = _saved_transport
	DirAccess.remove_absolute(Online.preferences_path)
	Online.preferences_path = _saved_preferences_path
	Online.session_token = ""
	Online.account_id = ""


static func _header(request: Dictionary, name: String) -> String:
	for header: String in request["headers"]:
		if header.to_lower().begins_with(name.to_lower() + ":"):
			return header.substr(name.length() + 1).strip_edges()
	return ""


static func _ok(token: String) -> Dictionary:
	return {"status": "ok", "id_token": token, "error": ""}


func _scripted(replies: Array[Dictionary]) -> ScriptedTransport:
	var transport: ScriptedTransport = ScriptedTransport.new()
	transport.replies = replies
	return transport


func test_a_sign_in_trades_the_servers_nonce_for_a_session() -> void:
	var transport: ScriptedTransport = _scripted([{"status": 200, "body": "{\"nonce\": \"n-123\"}"}, {"status": 200, "body": SESSION_REPLY}] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [_ok("google-id-token")] as Array[Dictionary]
	var result: Outcome = await SignInFlow.run(OnlineBackend.new("https://api.example", "", transport), "web-client.apps.googleusercontent.com", signer)
	assert_true(result.is_ok(), result.error)
	assert_eq(result.value, {"account_id": "acct_1", "session_token": "session-1", "expires_at_utc": "2026-10-04T18:00:00Z", "is_new_account": true})
	assert_eq(signer.asked, [["web-client.apps.googleusercontent.com", "n-123"]], "Credential Manager gets the server's nonce")
	assert_eq([transport.sent[0]["url"], transport.sent[1]["url"]], ["https://api.example/v1/auth/nonce", "https://api.example/v1/auth/google"])
	assert_eq(JSON.parse_string(transport.sent[1]["body"]), {"credential": "google-id-token"})
	for request: Dictionary in transport.sent:
		assert_eq(_header(request, "Authorization"), "", "no bearer before a session exists")


func test_a_cancelled_or_failed_chooser_never_reaches_the_server() -> void:
	for case: Array in [
		[{"status": "cancelled", "id_token": "", "error": ""}, SignInFlow.KIND_CANCELLED],
		[{"status": "no_account", "id_token": "", "error": "none"}, SignInFlow.KIND_FAILED],
		[{"status": "error", "id_token": "", "error": "16: developer error"}, SignInFlow.KIND_FAILED],
		[{"status": "unavailable", "id_token": "", "error": "no plugin"}, SignInFlow.KIND_UNAVAILABLE],
		[_ok(""), SignInFlow.KIND_FAILED],
	]:
		var transport: ScriptedTransport = _scripted([{"status": 200, "body": "{\"nonce\": \"n\"}"}] as Array[Dictionary])
		var signer: FakeSigner = FakeSigner.new()
		signer.results = [case[0]] as Array[Dictionary]
		var result: Outcome = await SignInFlow.run(OnlineBackend.new("https://api.example", "", transport), "client", signer)
		assert_eq(result.error_kind, case[1], str(case[0]))
		assert_eq(transport.sent.size(), 1, "only the nonce was requested")


func test_without_a_client_id_nothing_is_attempted() -> void:
	var transport: ScriptedTransport = _scripted([] as Array[Dictionary])
	var result: Outcome = await SignInFlow.run(OnlineBackend.new("https://api.example", "", transport), "", FakeSigner.new())
	assert_eq(result.error_kind, SignInFlow.KIND_UNAVAILABLE)
	assert_eq(transport.sent.size(), 0)


func test_server_refusals_pass_through() -> void:
	var transport: ScriptedTransport = _scripted([
		{"status": 200, "body": "{\"nonce\": \"n\"}"},
		{"status": 401, "body": "{\"error\": {\"code\": \"UNAUTHORIZED\", \"message\": \"Invalid, expired or already-used nonce\"}}"},
	] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [_ok("t")] as Array[Dictionary]
	var refused: Outcome = await SignInFlow.run(OnlineBackend.new("https://api.example", "", transport), "client", signer)
	assert_eq([refused.error_kind, refused.error], ["unauthorized", "Invalid, expired or already-used nonce"])
	var offline: Outcome = await SignInFlow.run(OnlineBackend.new("https://api.example", "", _scripted([] as Array[Dictionary])), "client", signer)
	assert_eq(offline.error_kind, GameBackend.KIND_OFFLINE)


func test_online_keeps_the_session_of_a_sign_in() -> void:
	Online.transport = _scripted([{"status": 200, "body": "{\"nonce\": \"n\"}"}, {"status": 200, "body": SESSION_REPLY}] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [_ok("t")] as Array[Dictionary]
	Online.signer = signer
	watch_signals(Online)
	assert_true((await Online.sign_in()).is_ok())
	assert_eq([Online.session_token, Online.account_id], ["session-1", "acct_1"])
	assert_signal_emitted_with_parameters(Online, "signed_in", ["acct_1"])
	assert_eq(signer.asked[0][0], Online.google_server_client_id())
	assert_true(Online.returning_player())
	assert_false(FileAccess.get_file_as_string(Online.preferences_path).contains("session-1"))
	assert_false(FileAccess.get_file_as_string(Online.preferences_path).contains("acct_1"))

func test_transient_nonce_failure_retries_twice_then_succeeds_without_reopening_chooser() -> void:
	var transport: ScriptedTransport = _scripted([
		{"status": 0}, {"status": 0}, {"status": 200, "body": "{\"nonce\":\"n3\"}"},
		{"status": 200, "body": SESSION_REPLY},
	] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [_ok("t")] as Array[Dictionary]
	var result: Outcome = await SignInFlow.run_with_retries(OnlineBackend.new("https://api.test", "", transport), "client", signer, 0.0)
	assert_true(result.is_ok(), result.error)
	assert_eq(transport.sent.size(), 4)
	assert_eq(signer.asked.size(), 1)

func test_three_failed_network_attempts_stop_without_requesting_a_credential() -> void:
	var transport: ScriptedTransport = _scripted([] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	var result: Outcome = await SignInFlow.run_with_retries(OnlineBackend.new("https://api.test", "", transport), "client", signer, 0.0)
	assert_eq(result.error_kind, GameBackend.KIND_OFFLINE)
	assert_eq(transport.sent.size(), 3)
	assert_eq(signer.asked.size(), 0)

func test_retry_after_lost_exchange_uses_a_fresh_nonce_and_stops_on_cancellation() -> void:
	var transport: ScriptedTransport = _scripted([
		{"status": 200, "body": "{\"nonce\":\"n1\"}"}, {"status": 0},
		{"status": 200, "body": "{\"nonce\":\"n2\"}"},
	] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [_ok("t1"), {"status": "cancelled"}] as Array[Dictionary]
	var result: Outcome = await SignInFlow.run_with_retries(OnlineBackend.new("https://api.test", "", transport), "client", signer, 0.0)
	assert_eq(result.error_kind, SignInFlow.KIND_CANCELLED)
	assert_eq(signer.asked, [["client", "n1"], ["client", "n2"]])
	assert_eq(transport.sent.size(), 3, "no third attempt after player cancellation")


func test_an_expired_session_is_renewed_and_the_request_resent_with_the_same_key() -> void:
	Online.session_token = "old"
	Online.account_id = "acct_1"
	Online.transport = _scripted([
		{"status": 401, "body": "{\"error\": {\"code\": \"UNAUTHORIZED\", \"message\": \"expired\"}}"},
		{"status": 200, "body": "{\"nonce\": \"n\"}"},
		{"status": 200, "body": SESSION_REPLY},
		{"status": 200, "body": "{\"state\": {}}"},
	] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [_ok("t")] as Array[Dictionary]
	Online.signer = signer
	var backend: OnlineBackend = Online.backend()
	assert_true((await backend.advance_story()).is_ok())
	var sent: Array[Dictionary] = (Online.transport as ScriptedTransport).sent
	assert_eq(sent.size(), 4)
	assert_eq(_header(sent[0], "Authorization"), "Bearer old")
	assert_eq(_header(sent[3], "Authorization"), "Bearer session-1")
	assert_eq(_header(sent[3], "Idempotency-Key"), _header(sent[0], "Idempotency-Key"), "the renewed retry cannot act twice")
	assert_eq(Online.session_token, "session-1")


func test_a_renewal_as_another_account_ends_the_session_instead_of_retrying() -> void:
	Online.session_token = "old"
	Online.account_id = "acct_someone_else"
	Online.transport = _scripted([
		{"status": 401, "body": "{\"error\": {\"code\": \"UNAUTHORIZED\", \"message\": \"expired\"}}"},
		{"status": 200, "body": "{\"nonce\": \"n\"}"},
		{"status": 200, "body": SESSION_REPLY},
	] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [_ok("t")] as Array[Dictionary]
	Online.signer = signer
	var result: Outcome = await Online.backend().advance_story()
	assert_eq(result.error_kind, Online.KIND_ACCOUNT_CHANGED)
	assert_eq((Online.transport as ScriptedTransport).sent.size(), 3, "the mutation was not resent for the other account")
	assert_false(Online.has_session())


func test_a_failed_renewal_is_the_calls_result() -> void:
	Online.session_token = "old"
	Online.account_id = "acct_1"
	Online.transport = _scripted([
		{"status": 401, "body": "{\"error\": {\"code\": \"UNAUTHORIZED\", \"message\": \"expired\"}}"},
		{"status": 200, "body": "{\"nonce\": \"n\"}"},
	] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [{"status": "cancelled", "id_token": "", "error": ""}] as Array[Dictionary]
	Online.signer = signer
	assert_eq((await Online.backend().fetch_state()).error_kind, SignInFlow.KIND_CANCELLED)


func test_without_the_android_plugin_sign_in_is_unavailable() -> void:
	assert_false(Native.is_available(), "headless runs have no Android plugin")
	assert_false(Native.start_google_sign_in("client", "nonce"))
	var result: Dictionary = await SignInFlow.NativeSigner.new().request_id_token("client", "nonce")
	assert_eq(result["status"], "unavailable")


func test_the_build_carries_the_servers_web_client_id() -> void:
	var client_id: String = Online.google_server_client_id()
	assert_true(RegEx.create_from_string("^[0-9]+-[a-z0-9]+\\.apps\\.googleusercontent\\.com$").search(client_id) != null, client_id)


func test_the_export_plugin_adds_exactly_the_aars_gradle_dependencies() -> void:
	var gradle: String = FileAccess.get_file_as_string("res://android/plugins/uomd_native/build.gradle")
	var declared: Array[String] = []
	for found: RegExMatch in RegEx.create_from_string("implementation \"([^\"]+)\"").search_all(gradle):
		declared.append(found.get_string(1))
	var exported: Array[String] = []
	for dependency: String in (load("res://addons/uomd_native/export_plugin.gd") as GDScript).get_script_constant_map()["ANDROID_DEPENDENCIES"]:
		exported.append(dependency)
	assert_gt(declared.size(), 0)
	assert_eq(exported, declared)


func test_logging_out_ends_the_session_on_the_server_and_here() -> void:
	Online.session_token = "session-1"
	Online.account_id = "acct_1"
	Online.transport = _scripted([{"status": 200, "body": "{\"signed_out\": true}"}] as Array[Dictionary])
	assert_true((await Online.log_out()).is_ok())
	var sent: Array[Dictionary] = (Online.transport as ScriptedTransport).sent
	assert_eq([sent[0]["method"], sent[0]["url"]], [HTTPClient.METHOD_POST, Online.server_url() + "/v1/auth/logout"])
	assert_eq(_header(sent[0], "Authorization"), "Bearer session-1")
	assert_false(Online.has_session())
	assert_eq(Online.account_id, "", "no account stays bound: a later renewal cannot sign anyone in")
	Online.transport = _scripted([] as Array[Dictionary])
	assert_true((await Online.log_out()).is_ok(), "signing out works offline too")


func test_deleting_the_account_confirms_the_identity_with_a_fresh_credential() -> void:
	Online.session_token = "session-1"
	Online.account_id = "acct_1"
	Online.transport = _scripted([
		{"status": 200, "body": "{\"nonce\": \"n-del\"}"},
		{"status": 200, "body": "{\"deleted\": true, \"account_id\": \"acct_1\"}"},
	] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [_ok("fresh-token")] as Array[Dictionary]
	Online.signer = signer
	assert_true((await Online.delete_account()).is_ok())
	var sent: Array[Dictionary] = (Online.transport as ScriptedTransport).sent
	assert_eq(signer.asked[0][1], "n-del", "the confirmation is bound to a new server nonce")
	assert_eq(sent[1]["url"], Online.server_url() + "/v1/account/delete")
	assert_eq(JSON.parse_string(sent[1]["body"]), {"credential": "fresh-token"})
	assert_eq(_header(sent[1], "Authorization"), "Bearer session-1")
	assert_false(Online.has_session())


func test_a_refused_or_cancelled_deletion_keeps_the_account_signed_in() -> void:
	Online.session_token = "session-1"
	Online.account_id = "acct_1"
	Online.transport = _scripted([
		{"status": 200, "body": "{\"nonce\": \"n\"}"},
		{"status": 403, "body": "{\"error\": {\"code\": \"REAUTH_MISMATCH\", \"message\": \"The confirmation was signed with another account\"}}"},
		{"status": 200, "body": "{\"nonce\": \"n2\"}"},
	] as Array[Dictionary])
	var signer: FakeSigner = FakeSigner.new()
	signer.results = [_ok("other-account-token"), {"status": "cancelled", "id_token": "", "error": ""}] as Array[Dictionary]
	Online.signer = signer
	assert_eq((await Online.delete_account()).error_kind, "reauth_mismatch")
	assert_eq((await Online.delete_account()).error_kind, SignInFlow.KIND_CANCELLED)
	assert_eq((Online.transport as ScriptedTransport).sent.size(), 3, "a cancelled confirmation sends no deletion")
	assert_true(Online.has_session())
	Online.session_token = ""
	assert_eq((await Online.delete_account()).error_kind, Online.KIND_ACCOUNT_CHANGED, "nothing to delete when signed out")

