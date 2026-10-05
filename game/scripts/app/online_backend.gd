class_name OnlineBackend
extends GameBackend
## `GameBackend` over the Worker API (server/README.md, DEC-0013): JSON over HTTPS with a bearer session token. Every
## mutating call carries a fresh UUIDv4 `Idempotency-Key`; a call whose connection failed is retried once with the same
## key, which the server answers with the stored result instead of acting twice. Every call names the app's Android
## versionCode (`X-Client-Version-Code`), so a server that no longer serves this build answers 426 "update_required".
## A session that expired mid-play (401) is renewed once through `reauthenticate` and the request is sent again with the same
## Idempotency-Key, so a renewed retry can never act twice.
##
## A mutation whose reply never arrived may or may not have committed (INF-013). It stays `pending` with its key: sent again (the
## player's "Try again"), it reuses that key, so the server replays its result instead of acting twice. Before any other mutation
## goes out, the server is asked whether the pending one committed (`GET /v1/operations/{key}`), so an abandoned request is never
## replayed later as a new action.
##
## Errors come back as `Outcome`s: no connection -> `GameBackend.KIND_OFFLINE`, an API error -> its code in lower case
## ("conflict", "unauthorized", "progression", "equipment", ...) with the server's message, a reply that is not JSON ->
## `KIND_PROTOCOL`.

const KIND_PROTOCOL: String = "protocol"
## A session renewal signed in another account (`Online.renew_session`).
const KIND_ACCOUNT_CHANGED: String = "account_changed"
const KIND_NOT_FOUND: String = "item_not_found"


## How a request reaches the server; tests substitute their own. `request` is a coroutine returning
## {"status": int (0 = no connection), "body": String}.
class Transport extends RefCounted:
	func request(_method: int, _url: String, _headers: PackedStringArray, _body: String) -> Dictionary:
		return {"status": 0, "body": ""}

	## A GET whose body goes to the file `path` (binary-safe): {"status": int (0 = no connection)}.
	func download(_url: String, _headers: PackedStringArray, _path: String) -> Dictionary:
		return {"status": 0}


## The real transport: one `HTTPRequest` node per call, parented to the scene tree root while it runs.
class HttpTransport extends Transport:
	const TIMEOUT_SECONDS: float = 15.0
	## A content pack may take a while on a slow connection; an interrupted one resumes from what arrived.
	const DOWNLOAD_TIMEOUT_SECONDS: float = 300.0

	func request(method: int, url: String, headers: PackedStringArray, body: String) -> Dictionary:
		var tree: SceneTree = Engine.get_main_loop() as SceneTree
		if tree == null:
			return {"status": 0, "body": ""}
		var node: HTTPRequest = HTTPRequest.new()
		node.timeout = TIMEOUT_SECONDS
		tree.root.add_child(node)
		if node.request(url, headers, method as HTTPClient.Method, body) != OK:
			node.queue_free()
			return {"status": 0, "body": ""}
		var completed: Array = await node.request_completed
		node.queue_free()
		var status: int = int(completed[1]) if int(completed[0]) == HTTPRequest.RESULT_SUCCESS else 0
		return {"status": status, "body": (completed[3] as PackedByteArray).get_string_from_utf8()}

	func download(url: String, headers: PackedStringArray, path: String) -> Dictionary:
		var tree: SceneTree = Engine.get_main_loop() as SceneTree
		if tree == null:
			return {"status": 0}
		var node: HTTPRequest = HTTPRequest.new()
		node.timeout = DOWNLOAD_TIMEOUT_SECONDS
		node.download_file = path
		tree.root.add_child(node)
		if node.request(url, headers, HTTPClient.METHOD_GET) != OK:
			node.queue_free()
			return {"status": 0}
		var completed: Array = await node.request_completed
		node.queue_free()
		return {"status": int(completed[1]) if int(completed[0]) == HTTPRequest.RESULT_SUCCESS else 0}


var base_url: String = ""
var session_token: String = ""
var transport: Transport = HttpTransport.new()
## Sent as `X-Client-Version-Code` (0 = not sent).
var client_version_code: int = ClientRelease.version_code()
## Coroutine renewing an expired session: returns an `Outcome` whose value is the new token (invalid Callable = no renewal).
var reauthenticate: Callable = Callable()
## The last mutation whose outcome is unknown: {"method", "path", "payload", "key"}; {} = none.
var pending: Dictionary = {}


func _init(server_url: String = "", token: String = "", with_transport: Transport = null) -> void:
	base_url = server_url.trim_suffix("/")
	session_token = token
	if with_transport != null:
		transport = with_transport


## A random RFC 4122 version-4 UUID (the server requires one per mutation).
static func new_idempotency_key() -> String:
	var bytes: PackedByteArray = Crypto.new().generate_random_bytes(16)
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	var hex: String = bytes.hex_encode()
	return "%s-%s-%s-%s-%s" % [hex.substr(0, 8), hex.substr(8, 4), hex.substr(12, 4), hex.substr(16, 4), hex.substr(20, 12)]


func has_pending_operation() -> bool:
	return not pending.is_empty()


func _call(method: int, path: String, body: Variant = null, mutating: bool = false) -> Outcome:
	var payload: String = JSON.stringify(body) if body != null else ""
	var key: String = ""
	if mutating:
		if not pending.is_empty() and pending["method"] == method and pending["path"] == path and pending["payload"] == payload:
			key = str(pending["key"])
		else:
			if not pending.is_empty():
				var settled: Outcome = await _settle_pending()
				if not settled.is_ok():
					return settled
			key = new_idempotency_key()
	var reply: Dictionary = await _send(method, path, payload, key)
	if int(reply.get("status", 0)) == 0 and mutating:
		reply = await _send(method, path, payload, key)
	if int(reply.get("status", 0)) == 401 and not session_token.is_empty() and reauthenticate.is_valid():
		var renewed: Outcome = await reauthenticate.call()
		if not renewed.is_ok():
			if renewed.error_kind == KIND_ACCOUNT_CHANGED:
				pending = {}
			return renewed
		session_token = str(renewed.value)
		reply = await _send(method, path, payload, key)
	if mutating:
		pending = {"method": method, "path": path, "payload": payload, "key": key} if _uncertain(reply) else {}
	return _outcome(reply)


## No reply at all, or a gateway error page instead of the API's JSON: the request may have committed or not.
static func _uncertain(reply: Dictionary) -> bool:
	var status: int = int(reply.get("status", 0))
	if status == 0:
		return true
	if status < 500:
		return false
	var json: JSON = JSON.new()
	return json.parse(str(reply.get("body", ""))) != OK or not (json.data is Dictionary) or not ((json.data as Dictionary).get("error") is Dictionary)


## Asks whether the pending mutation committed; either answer settles it (committed: its effect is in the next snapshot; not committed:
## it never happened). Fails, keeping it pending, while the server cannot be asked.
func _settle_pending() -> Outcome:
	var asked: Outcome = await _call(HTTPClient.METHOD_GET, "/v1/operations/%s" % str(pending["key"]))
	if asked.is_ok() or asked.error_kind == KIND_NOT_FOUND:
		pending = {}
		return Outcome.ok()
	return asked


func _send(method: int, path: String, payload: String, key: String) -> Dictionary:
	var headers: PackedStringArray = PackedStringArray(["Accept: application/json"])
	if not session_token.is_empty():
		headers.append("Authorization: Bearer %s" % session_token)
	if client_version_code > 0:
		headers.append("X-Client-Version-Code: %d" % client_version_code)
	if not payload.is_empty():
		headers.append("Content-Type: application/json")
	if not key.is_empty():
		headers.append("Idempotency-Key: %s" % key)
	return await transport.request(method, base_url + path, headers, payload)


static func _outcome(reply: Dictionary) -> Outcome:
	var status: int = int(reply.get("status", 0))
	if status == 0:
		return Outcome.fail(KIND_OFFLINE, "The game server cannot be reached.")
	# JSON.parse (not parse_string): a non-JSON body (a proxy's HTML error page) is an expected reply, not an engine error.
	var json: JSON = JSON.new()
	var parsed: Variant = json.data if json.parse(str(reply.get("body", ""))) == OK else null
	if status >= 200 and status < 300:
		return Outcome.ok(parsed) if parsed is Dictionary else Outcome.fail(KIND_PROTOCOL, "The server reply is not a JSON object.")
	if parsed is Dictionary and (parsed as Dictionary).get("error") is Dictionary:
		var error: Dictionary = (parsed as Dictionary)["error"]
		return Outcome.fail(str(error.get("code", "http_error")).to_lower(), str(error.get("message", "Request failed (HTTP %d)." % status)))
	return Outcome.fail(KIND_PROTOCOL, "Request failed (HTTP %d)." % status)


## A single-use sign-in nonce: {"nonce", "expires_at_utc"}.
func request_nonce() -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/auth/nonce")


## Trades a Google ID token for a session: {"account_id", "session_token", "expires_at_utc", "is_new_account"}.
func exchange_google_credential(credential: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/auth/google", {"credential": credential})


## Ends this session on the server (INF-019).
func log_out() -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/auth/logout")


## Deletes the account and all its data (INF-020); `credential` is a fresh ID token of the account's identity.
func delete_account(credential: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/account/delete", {"credential": credential})


## The signed manifest of the current content release: {"channel", "manifest_b64", "signature_b64"} (INF-029).
func fetch_content_release() -> Outcome:
	return await _call(HTTPClient.METHOD_GET, "/v1/content/current")


## Downloads content pack `sha256` into `path` from byte `offset` on (a resumed download appends to what is there).
## A server that ignores the range (200) sends the whole pack, which then replaces the file.
func download_pack(sha256: String, path: String, offset: int = 0) -> Outcome:
	var headers: PackedStringArray = PackedStringArray()
	if not session_token.is_empty():
		headers.append("Authorization: Bearer %s" % session_token)
	if client_version_code > 0:
		headers.append("X-Client-Version-Code: %d" % client_version_code)
	if offset > 0:
		headers.append("Range: bytes=%d-" % offset)
	var chunk: String = path + ".chunk"
	var reply: Dictionary = await transport.download(base_url + "/v1/content/packs/%s" % sha256, headers, chunk)
	var status: int = int(reply.get("status", 0))
	if status != 200 and status != 206:
		DirAccess.remove_absolute(chunk)
		return Outcome.fail(KIND_OFFLINE if status == 0 else ContentInstaller.KIND_DOWNLOAD, "The game data update could not be downloaded (HTTP %d)." % status)
	var bytes: PackedByteArray = FileAccess.get_file_as_bytes(chunk)
	DirAccess.remove_absolute(chunk)
	var file: FileAccess = FileAccess.open(path, FileAccess.READ_WRITE) if status == 206 and FileAccess.file_exists(path) else FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return Outcome.fail(ContentInstaller.KIND_DISK, "The game data update could not be written on this device.")
	file.seek_end()
	file.store_buffer(bytes)
	file.close()
	return Outcome.ok()


func fetch_bootstrap() -> Outcome:
	return await _call(HTTPClient.METHOD_GET, "/v1/bootstrap")


func fetch_state() -> Outcome:
	var reply: Outcome = await _call(HTTPClient.METHOD_GET, "/v1/state")
	# GET /v1/state answers the bare snapshot; the GameBackend contract carries it under "state".
	return Outcome.ok({"state": reply.value}) if reply.is_ok() else reply


func advance_story() -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/story/advance", null, true)


func claim_first_oath(character_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/story/first-oath", {"character_id": character_id}, true)


func begin_stage(stage_id: String, roster: Array) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/stages/%s/attempts" % stage_id.uri_encode(), {"roster": roster}, true)


func submit_victory(attempt_id: String, client_result: Dictionary) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/attempts/%s/victory" % attempt_id.uri_encode(), client_result, true)


func abandon_attempt(attempt_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/attempts/%s/abandon" % attempt_id.uri_encode(), {}, true)


func level_up(character_id: String, items: Dictionary) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/roster/%s/level-up" % character_id.uri_encode(), {"items": items}, true)


func upgrade_skill(character_id: String, skill_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/roster/%s/skills/%s/upgrade" % [character_id.uri_encode(), skill_id.uri_encode()], null, true)


func unlock_memory_node(character_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/roster/%s/memory-nodes" % character_id.uri_encode(), null, true)


func equip(table: String, instance_id: String, character_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, _instance_path(table, instance_id, "equip"), {"character_id": character_id}, true)


func unequip(table: String, instance_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, _instance_path(table, instance_id, "unequip"), {}, true)


func set_locked(table: String, instance_id: String, locked: bool) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, _instance_path(table, instance_id, "lock"), {"locked": locked}, true)


func dismantle_weapon(instance_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, _instance_path("inventory_weapons", instance_id, "dismantle"), {}, true)


func level_up_equipment(table: String, instance_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, _instance_path(table, instance_id, "level-up"), {"target_levels": 1}, true)


func reroll_accessory(instance_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, _instance_path("inventory_accessories", instance_id, "reroll"), {}, true)


func quest_status() -> Outcome:
	return await _call(HTTPClient.METHOD_GET, "/v1/quests/status")


func claim_quest(kind: String, task_id: String, period: String = "") -> Outcome:
	var body: Dictionary = {"kind": kind, "task_id": task_id}
	if not period.is_empty():
		body["period"] = period
	return await _call(HTTPClient.METHOD_POST, "/v1/quests/claim", body, true)


func gacha_banners() -> Outcome:
	return await _call(HTTPClient.METHOD_GET, "/v1/gacha/banners")


func gacha_pity() -> Outcome:
	return await _call(HTTPClient.METHOD_GET, "/v1/gacha/pity")


func gacha_history(limit: int = 50, before: int = 0) -> Outcome:
	var query: String = "?limit=%d" % limit
	if before > 0:
		query += "&before=%d" % before
	return await _call(HTTPClient.METHOD_GET, "/v1/gacha/history" + query)


func gacha_pull(banner_id: String, pull_count: int, target_id: String = "") -> Outcome:
	var body: Dictionary = {"banner_id": banner_id, "pull_count": pull_count}
	if not target_id.is_empty():
		body["target_id"] = target_id
	return await _call(HTTPClient.METHOD_POST, "/v1/gacha/pull", body, true)


func claim_inn_meal() -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/ration/inn-meal", {}, true)


func convert_fate_threads(count: int) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/wallet/convert", {"count": count}, true)


func fetch_account() -> Outcome:
	return await _call(HTTPClient.METHOD_GET, "/v1/account")


func update_profile(changes: Dictionary) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/profile", changes, true)


func friends(cursor: String = "") -> Outcome:
	var query: String = "?limit=100"
	if not cursor.is_empty():
		query += "&cursor=%s" % cursor.uri_encode()
	return await _call(HTTPClient.METHOD_GET, "/v1/friends" + query)


func send_friend_request(friend_code: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/friend-requests", {"friend_code": friend_code}, true)


func answer_friend_request(request_id: String, answer: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/friend-requests/%s/%s" % [request_id.uri_encode(), answer.uri_encode()], {}, true)


func remove_friend(account_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/friends/%s/remove" % account_id.uri_encode(), {}, true)


func blocked_players() -> Outcome:
	return await _call(HTTPClient.METHOD_GET, "/v1/blocks")


func block_player(account_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/blocks", {"account_id": account_id}, true)


func unblock_player(account_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/blocks/%s/remove" % account_id.uri_encode(), {}, true)


func report_player(account_id: String, reason: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/reports", {"account_id": account_id, "reason_key": reason}, true)


func subscription_verify(purchase_token: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/subscription/verify", {"purchase_token": purchase_token})


func subscription_status() -> Outcome:
	return await _call(HTTPClient.METHOD_GET, "/v1/subscription/status")


func subscription_claim(window_id: int = -1) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/subscription/claim", {"window_id": window_id} if window_id >= 0 else {}, true)


func ads_status() -> Outcome:
	return await _call(HTTPClient.METHOD_GET, "/v1/ads/status")


static func _instance_path(table: String, instance_id: String, action: String) -> String:
	return "/v1/inventory/%s/%s/%s" % [table.uri_encode(), instance_id.uri_encode(), action]
