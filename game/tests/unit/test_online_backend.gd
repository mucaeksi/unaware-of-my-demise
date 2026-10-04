extends GutTest
## OnlineBackend against a scripted transport: what goes on the wire (auth, idempotency, JSON) and how every kind of
## reply becomes an Outcome. The replies mirror server/README.md.

const UUID_V4: String = "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"


## Answers each request with the next scripted reply and records what it was sent.
class ScriptedTransport extends OnlineBackend.Transport:
	var replies: Array[Dictionary] = []
	var sent: Array[Dictionary] = []

	func request(method: int, url: String, headers: PackedStringArray, body: String) -> Dictionary:
		sent.append({"method": method, "url": url, "headers": headers, "body": body})
		return replies.pop_front() if not replies.is_empty() else {"status": 0, "body": ""}


func _backend(replies: Array[Dictionary]) -> Array:
	var transport: ScriptedTransport = ScriptedTransport.new()
	transport.replies = replies
	return [OnlineBackend.new("https://api.example/", "token-1", transport), transport]


static func _header(request: Dictionary, name: String) -> String:
	for header: String in request["headers"]:
		if header.to_lower().begins_with(name.to_lower() + ":"):
			return header.substr(name.length() + 1).strip_edges()
	return ""


func test_fetch_state_sends_the_session_and_wraps_the_snapshot() -> void:
	var pair: Array = _backend([{"status": 200, "body": "{\"schema_version\": 1}"}] as Array[Dictionary])
	var reply: Outcome = await (pair[0] as OnlineBackend).fetch_state()
	assert_true(reply.is_ok(), reply.error)
	assert_eq(int((reply.value as Dictionary)["state"]["schema_version"]), 1)
	var sent: Dictionary = (pair[1] as ScriptedTransport).sent[0]
	assert_eq(sent["method"], HTTPClient.METHOD_GET)
	assert_eq(sent["url"], "https://api.example/v1/state", "the trailing slash of the base URL is dropped")
	assert_eq(_header(sent, "Authorization"), "Bearer token-1")
	assert_eq(_header(sent, "Idempotency-Key"), "", "reads carry no idempotency key")


func test_mutations_carry_a_fresh_uuid4_key_and_a_json_body() -> void:
	var pair: Array = _backend([{"status": 200, "body": "{\"state\": {}}"}, {"status": 200, "body": "{\"state\": {}}"}] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	assert_true((await backend.claim_first_oath("tilda_fen")).is_ok())
	assert_true((await backend.advance_story()).is_ok())
	var sent: Array[Dictionary] = (pair[1] as ScriptedTransport).sent
	assert_eq(sent[0]["url"], "https://api.example/v1/story/first-oath")
	assert_eq(JSON.parse_string(sent[0]["body"]), {"character_id": "tilda_fen"})
	assert_eq(_header(sent[0], "Content-Type"), "application/json")
	assert_eq(sent[1]["url"], "https://api.example/v1/story/advance")
	var first_key: String = _header(sent[0], "Idempotency-Key")
	assert_true(RegEx.create_from_string(UUID_V4).search(first_key) != null, first_key)
	assert_ne(first_key, _header(sent[1], "Idempotency-Key"), "every action gets its own key")


func test_a_lost_connection_is_retried_once_with_the_same_key() -> void:
	var pair: Array = _backend([{"status": 0, "body": ""}, {"status": 200, "body": "{\"state\": {}}"}] as Array[Dictionary])
	assert_true((await (pair[0] as OnlineBackend).advance_story()).is_ok())
	var sent: Array[Dictionary] = (pair[1] as ScriptedTransport).sent
	assert_eq(sent.size(), 2)
	assert_eq(_header(sent[0], "Idempotency-Key"), _header(sent[1], "Idempotency-Key"), "the retry replays, it does not act twice")


func test_no_connection_is_offline() -> void:
	var pair: Array = _backend([] as Array[Dictionary])
	var reply: Outcome = await (pair[0] as OnlineBackend).advance_story()
	assert_eq(reply.error_kind, GameBackend.KIND_OFFLINE)
	assert_eq((pair[1] as ScriptedTransport).sent.size(), 2, "one attempt plus one retry")
	assert_eq((await (pair[0] as OnlineBackend).fetch_state()).error_kind, GameBackend.KIND_OFFLINE)


func test_api_errors_keep_the_server_code_and_message() -> void:
	var body: String = "{\"error\": {\"code\": \"CONFLICT\", \"message\": \"The story is finished\"}}"
	var pair: Array = _backend([{"status": 409, "body": body}] as Array[Dictionary])
	var reply: Outcome = await (pair[0] as OnlineBackend).advance_story()
	assert_eq(reply.error_kind, "conflict")
	assert_eq(reply.error, "The story is finished")
	assert_eq((pair[1] as ScriptedTransport).sent.size(), 1, "an answered request is never retried")


func test_unreadable_replies_are_protocol_errors() -> void:
	var pair: Array = _backend([{"status": 502, "body": "<html>"}, {"status": 200, "body": "[]"}] as Array[Dictionary])
	assert_eq((await (pair[0] as OnlineBackend).fetch_state()).error_kind, OnlineBackend.KIND_PROTOCOL)
	assert_eq((await (pair[0] as OnlineBackend).fetch_state()).error_kind, OnlineBackend.KIND_PROTOCOL)


func test_the_game_flow_adopts_the_servers_story_reply() -> void:
	var flow: GameFlow = GameFlow.create()
	assert_true(flow.is_ready(), flow.error)
	var fixture: String = FileAccess.get_file_as_string(
		ProjectSettings.globalize_path("res://").path_join("../server/test/fixtures/state_new_account.json").simplify_path())
	var advanced: Dictionary = JSON.parse_string(fixture)
	advanced["story_state"]["story_cursor"] = 1
	advanced["story_state"]["story_cursor_entry_id"] = flow.story_index.story_order[1]
	var pair: Array = _backend([
		{"status": 200, "body": fixture},
		{"status": 200, "body": JSON.stringify({"state": advanced})},
	] as Array[Dictionary])
	flow.backend = pair[0]
	assert_true((await flow.sync()).is_ok())
	assert_eq(flow.current_entry(), flow.story_index.story_order[0])
	assert_true((await flow.advance()).is_ok())
	assert_eq(flow.current_entry(), flow.story_index.story_order[1])


func test_online_hands_out_the_offline_base_until_a_session_exists() -> void:
	Online.session_token = ""
	assert_false(Online.backend() is OnlineBackend)


func test_stage_attempts_and_victories_go_to_their_routes() -> void:
	var pair: Array = _backend([{"status": 200, "body": "{\"state\": {}, \"attempt\": {}}"}, {"status": 200, "body": "{\"state\": {}}"}] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	assert_true((await backend.begin_stage("1-4", ["fadyme", "mahmut"])).is_ok())
	assert_true((await backend.submit_victory("6f1c2d6e-0000-4000-8000-000000000001", {"outcome": "victory", "stars": 3})).is_ok())
	var sent: Array[Dictionary] = (pair[1] as ScriptedTransport).sent
	assert_eq(sent[0]["url"], "https://api.example/v1/stages/1-4/attempts")
	assert_eq(JSON.parse_string(sent[0]["body"]), {"roster": ["fadyme", "mahmut"]})
	assert_eq(sent[1]["url"], "https://api.example/v1/attempts/6f1c2d6e-0000-4000-8000-000000000001/victory")
	assert_eq(JSON.parse_string(sent[1]["body"]), {"outcome": "victory", "stars": 3.0})
	for request: Dictionary in sent:
		assert_ne(_header(request, "Idempotency-Key"), "", "both are mutations")


func test_progression_calls_go_to_the_roster_routes_and_map_refusals() -> void:
	var refusal: String = "{\"error\": {\"code\": \"PROGRESSION\", \"message\": \"Not enough Silver Crowns\"}}"
	var pair: Array = _backend([
		{"status": 200, "body": "{\"state\": {}, \"level_after\": 2}"},
		{"status": 409, "body": refusal},
		{"status": 200, "body": "{\"state\": {}, \"node\": 1}"},
	] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	assert_true((await backend.level_up("mahmut", {"torn_chronicle_page": 2})).is_ok())
	var refused: Outcome = await backend.upgrade_skill("mahmut", "mahmut_active_broken_crest_guard")
	assert_eq(refused.error_kind, Outcome.PROGRESSION, "a rules refusal becomes a progression outcome the screens show")
	assert_eq(refused.error, "Not enough Silver Crowns")
	assert_true((await backend.unlock_memory_node("fadyme")).is_ok())
	var sent: Array[Dictionary] = (pair[1] as ScriptedTransport).sent
	assert_eq(sent[0]["url"], "https://api.example/v1/roster/mahmut/level-up")
	assert_eq(JSON.parse_string(sent[0]["body"]), {"items": {"torn_chronicle_page": 2.0}})
	assert_eq(sent[1]["url"], "https://api.example/v1/roster/mahmut/skills/mahmut_active_broken_crest_guard/upgrade")
	assert_eq(sent[2]["url"], "https://api.example/v1/roster/fadyme/memory-nodes")


func test_equipment_calls_go_to_the_inventory_routes() -> void:
	var ok: Dictionary = {"status": 200, "body": "{\"state\": {}}"}
	var pair: Array = _backend([ok, ok, ok, ok, ok, ok] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	assert_true((await backend.equip("inventory_weapons", "wpn_1", "mahmut")).is_ok())
	assert_true((await backend.unequip("inventory_armor", "arm_1")).is_ok())
	assert_true((await backend.set_locked("inventory_accessories", "acc_1", true)).is_ok())
	assert_true((await backend.dismantle_weapon("wpn_2")).is_ok())
	assert_true((await backend.level_up_equipment("inventory_weapons", "wpn_1")).is_ok())
	assert_true((await backend.reroll_accessory("acc_1")).is_ok())
	var sent: Array[Dictionary] = (pair[1] as ScriptedTransport).sent
	var urls: Array = sent.map(func(request: Dictionary) -> String: return request["url"])
	assert_eq(urls, [
		"https://api.example/v1/inventory/inventory_weapons/wpn_1/equip",
		"https://api.example/v1/inventory/inventory_armor/arm_1/unequip",
		"https://api.example/v1/inventory/inventory_accessories/acc_1/lock",
		"https://api.example/v1/inventory/inventory_weapons/wpn_2/dismantle",
		"https://api.example/v1/inventory/inventory_weapons/wpn_1/level-up",
		"https://api.example/v1/inventory/inventory_accessories/acc_1/reroll",
	])
	assert_eq(JSON.parse_string(sent[0]["body"]), {"character_id": "mahmut"})
	assert_eq(JSON.parse_string(sent[2]["body"]), {"locked": true})


func test_quest_and_gacha_calls_go_to_their_routes() -> void:
	var ok: Dictionary = {"status": 200, "body": "{\"state\": {}}"}
	var broke: Dictionary = {"status": 402, "body": "{\"error\": {\"code\": \"INSUFFICIENT_FUNDS\", \"message\": \"Not enough Fate's Threads (have 3, need 10)\"}}"}
	var pair: Array = _backend([ok, ok, ok, ok, ok, broke, ok, ok, ok] as Array[Dictionary])
	var backend: OnlineBackend = pair[0]
	assert_true((await backend.quest_status()).is_ok())
	assert_true((await backend.claim_quest("weekly", "cycle_a", "2026-10-05")).is_ok())
	assert_true((await backend.gacha_banners()).is_ok())
	assert_true((await backend.gacha_pity()).is_ok())
	assert_true((await backend.gacha_history(20, 41)).is_ok())
	var refused: Outcome = await backend.gacha_pull("character:oath_01_aveline", 10)
	assert_eq(refused.error_kind, GameBackend.KIND_INSUFFICIENT_FUNDS)
	assert_true((await backend.gacha_pull("hall_of_armaments", 1, "weapon_fadyme_signature")).is_ok())
	assert_true((await backend.convert_fate_threads(2)).is_ok())
	assert_true((await backend.claim_inn_meal()).is_ok())
	var sent: Array[Dictionary] = (pair[1] as ScriptedTransport).sent
	var urls: Array = sent.map(func(request: Dictionary) -> String: return request["url"])
	assert_eq(urls, [
		"https://api.example/v1/quests/status",
		"https://api.example/v1/quests/claim",
		"https://api.example/v1/gacha/banners",
		"https://api.example/v1/gacha/pity",
		"https://api.example/v1/gacha/history?limit=20&before=41",
		"https://api.example/v1/gacha/pull",
		"https://api.example/v1/gacha/pull",
		"https://api.example/v1/wallet/convert",
		"https://api.example/v1/ration/inn-meal",
	])
	assert_eq(JSON.parse_string(sent[1]["body"]), {"kind": "weekly", "task_id": "cycle_a", "period": "2026-10-05"})
	assert_eq(JSON.parse_string(sent[5]["body"]), {"banner_id": "character:oath_01_aveline", "pull_count": 10.0})
	assert_eq(JSON.parse_string(sent[6]["body"]), {"banner_id": "hall_of_armaments", "pull_count": 1.0, "target_id": "weapon_fadyme_signature"})
	assert_eq(JSON.parse_string(sent[7]["body"]), {"count": 2.0})
	for index: int in [0, 2, 3, 4]:
		assert_eq(_header(sent[index], "Idempotency-Key"), "", "reads carry no idempotency key")
	for index: int in [1, 5, 6, 7, 8]:
		assert_ne(_header(sent[index], "Idempotency-Key"), "", "mutations do")
