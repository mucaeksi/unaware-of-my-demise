class_name OnlineBackend
extends GameBackend
## `GameBackend` over the Worker API (server/README.md, DEC-0013): JSON over HTTPS with a bearer session token. Every
## mutating call carries a fresh UUIDv4 `Idempotency-Key`; a call whose connection failed is retried once with the same
## key, which the server answers with the stored result instead of acting twice.
##
## Errors come back as `Outcome`s: no connection -> `GameBackend.KIND_OFFLINE`, an API error -> its code in lower case
## ("conflict", "unauthorized", ...) with the server's message, a reply that is not JSON -> `KIND_PROTOCOL`. Calls the
## server does not offer yet fail with `KIND_UNSUPPORTED`.

const KIND_PROTOCOL: String = "protocol"
const KIND_UNSUPPORTED: String = "unsupported"


## How a request reaches the server; tests substitute their own. `request` is a coroutine returning
## {"status": int (0 = no connection), "body": String}.
class Transport extends RefCounted:
	func request(_method: int, _url: String, _headers: PackedStringArray, _body: String) -> Dictionary:
		return {"status": 0, "body": ""}


## The real transport: one `HTTPRequest` node per call, parented to the scene tree root while it runs.
class HttpTransport extends Transport:
	const TIMEOUT_SECONDS: float = 15.0

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


var base_url: String = ""
var session_token: String = ""
var transport: Transport = HttpTransport.new()


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


func _call(method: int, path: String, body: Variant = null, mutating: bool = false) -> Outcome:
	var headers: PackedStringArray = PackedStringArray(["Accept: application/json", "Authorization: Bearer %s" % session_token])
	var payload: String = ""
	if body != null:
		headers.append("Content-Type: application/json")
		payload = JSON.stringify(body)
	if mutating:
		headers.append("Idempotency-Key: %s" % new_idempotency_key())
	var reply: Dictionary = await transport.request(method, base_url + path, headers, payload)
	if int(reply.get("status", 0)) == 0 and mutating:
		reply = await transport.request(method, base_url + path, headers, payload)
	return _outcome(reply)


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


func _unsupported() -> Outcome:
	return Outcome.fail(KIND_UNSUPPORTED, "This action is not available on the game server yet.")


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


func level_up(character_id: String, items: Dictionary) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/roster/%s/level-up" % character_id.uri_encode(), {"items": items}, true)


func upgrade_skill(character_id: String, skill_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/roster/%s/skills/%s/upgrade" % [character_id.uri_encode(), skill_id.uri_encode()], null, true)


func unlock_memory_node(character_id: String) -> Outcome:
	return await _call(HTTPClient.METHOD_POST, "/v1/roster/%s/memory-nodes" % character_id.uri_encode(), null, true)


func equip(_table: String, _instance_id: String, _character_id: String) -> Outcome:
	return _unsupported()


func unequip(_table: String, _instance_id: String) -> Outcome:
	return _unsupported()


func set_locked(_table: String, _instance_id: String, _locked: bool) -> Outcome:
	return _unsupported()


func dismantle_weapon(_instance_id: String) -> Outcome:
	return _unsupported()


func level_up_equipment(_table: String, _instance_id: String) -> Outcome:
	return _unsupported()


func reroll_accessory(_instance_id: String) -> Outcome:
	return _unsupported()
