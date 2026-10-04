extends GutTest
## DEC-0012: the client's player state is a server snapshot. `PlayerState` validates it and normalizes JSON numbers; `GameFlow` adopts it
## from every backend reply and keeps the old one when a reply fails or carries no usable state.

## A backend that answers every call with `snapshot` (or `reply` when set) and records what it was asked.
class _StubBackend extends GameBackend:
	var snapshot: Dictionary = {}
	var reply: Outcome = null
	var calls: Array[String] = []

	func _answer(call_name: String) -> Outcome:
		calls.append(call_name)
		return reply if reply != null else Outcome.ok({"state": snapshot})

	func fetch_state() -> Outcome:
		return _answer("fetch_state")

	func advance_story() -> Outcome:
		return _answer("advance_story")

	func submit_victory(_stage_id: String, _roster: Array, _run_seed: int, _client_result: Dictionary) -> Outcome:
		return _answer("submit_victory")

	func level_up(_character_id: String, _items: Dictionary) -> Outcome:
		return _answer("level_up")


static var _flow: GameFlow = null


func before_all() -> void:
	if _flow == null:
		_flow = GameFlow.create()


func before_each() -> void:
	assert_true(_flow.is_ready(), _flow.error)
	_flow.backend = GameBackend.new()
	_flow.state = null


## A snapshot as the server would send it: the starting story state, run through JSON so every number is a float.
func _snapshot(extra: Dictionary = {}) -> Dictionary:
	var data: Dictionary = {
		"schema_version": PlayerState.SCHEMA_VERSION,
		"story_state": _flow.rules.story.to_persisted_dict(_flow.rules.story.new_player_state()),
		"wallet": {"silver_crowns": 1200, "eclipse_tokens": 3, "account_xp": 40},
		"items": {"torn_chronicle_page": 4},
	}
	data.merge(extra, true)
	return JSON.parse_string(JSON.stringify(data))


func _stub(extra: Dictionary = {}) -> _StubBackend:
	var backend: _StubBackend = _StubBackend.new()
	backend.snapshot = _snapshot(extra)
	_flow.backend = backend
	return backend


func test_a_snapshot_must_be_a_versioned_object_with_a_valid_story_state() -> void:
	assert_string_contains(PlayerState.from_snapshot([], _flow.rules.story).error, "not a JSON object")
	var wrong_version: Dictionary = _snapshot({"schema_version": PlayerState.SCHEMA_VERSION + 1})
	assert_string_contains(PlayerState.from_snapshot(wrong_version, _flow.rules.story).error, "schema_version")
	var no_story: Dictionary = _snapshot()
	no_story.erase("story_state")
	assert_string_contains(PlayerState.from_snapshot(no_story, _flow.rules.story).error, "no story_state")
	var bad_story: Dictionary = _snapshot({"story_state": {"story_cursor": -1}})
	assert_string_contains(PlayerState.from_snapshot(bad_story, _flow.rules.story).error, "story_state is invalid")
	assert_true(PlayerState.from_snapshot(_snapshot(), _flow.rules.story).is_valid())


func test_accessors_convert_json_numbers_and_fill_defaults() -> void:
	var state: PlayerState = PlayerState.from_snapshot(_snapshot({
		"roster": {"mahmut": {"level": 7, "xp": 15, "memory_shards": 2, "memory_nodes": 1, "skill_ranks": {"skill_x": 3}}},
		"inventory": {"inventory_weapons": [{"instance_id": "w1", "template_id": "weapon_mahmut_signature", "level": 4,
			"locked": true, "equipped_character_id": "mahmut", "equip_slot": "weapon", "payload": null}]},
	}), _flow.rules.story)
	assert_true(state.is_valid(), state.error)
	assert_eq(state.wallet(), {"silver_crowns": 1200, "eclipse_tokens": 3, "account_xp": 40})
	assert_true(state.wallet()["silver_crowns"] is int)
	assert_eq(state.item_quantity("torn_chronicle_page"), 4)
	assert_eq(state.item_quantity("missing"), 0)
	assert_eq(state.level("mahmut"), 7)
	assert_eq(state.level("nobody"), 1)
	assert_eq(state.progress("mahmut")["xp_to_next"], -1, "absent = no next level")
	assert_eq(state.memory("mahmut"), [2, 1] as Array[int])
	assert_eq(state.skill_rank("mahmut", "skill_x"), 3)
	assert_eq(state.skill_rank("mahmut", "skill_y"), 1)
	var weapon: Dictionary = state.instances("inventory_weapons")[0]
	assert_eq(weapon["level"], 4)
	assert_true(weapon["level"] is int)
	assert_eq(weapon["equipped_character_id"], "mahmut")
	assert_null(weapon["payload"])
	assert_eq(state.instances("inventory_armor").size(), 0)


func test_without_a_server_the_boot_fails_offline_and_holds_no_state() -> void:
	assert_false(await Game.attach(_flow, GameBackend.new()))
	assert_eq(Game.boot_error_kind, GameBackend.KIND_OFFLINE)
	assert_null(Game.flow)
	assert_false(Game.is_ready())
	assert_null(_flow.state)


func test_the_boot_adopts_the_servers_snapshot() -> void:
	var backend: _StubBackend = _StubBackend.new()
	backend.snapshot = _snapshot()
	assert_true(await Game.attach(_flow, backend), Game.boot_error)
	assert_true(Game.is_ready())
	assert_eq(_flow.current_entry(), _flow.story_index.story_order[0])
	assert_eq(_flow.wallet()["silver_crowns"], 1200)
	assert_eq(backend.calls, ["fetch_state"] as Array[String])
	Game.flow = null


func test_a_failed_or_stateless_reply_keeps_the_last_snapshot() -> void:
	var backend: _StubBackend = _stub()
	assert_true((await _flow.sync()).is_ok())
	var held: PlayerState = _flow.state
	backend.reply = Outcome.ok({"xp_gained": 10})
	var stateless: Outcome = await _flow.level_up("mahmut", "torn_chronicle_page")
	assert_eq(stateless.error_kind, GameFlow.ERROR_PROTOCOL)
	assert_true(_flow.state == held)
	backend.reply = Outcome.fail(Outcome.PROGRESSION, "not enough")
	var refused: Outcome = await _flow.advance()
	assert_eq(refused.error, "not enough")
	assert_true(_flow.state == held)
	backend.reply = Outcome.ok({"state": {"schema_version": 999}})
	assert_eq((await _flow.advance()).error_kind, GameFlow.ERROR_PROTOCOL)
	assert_true(_flow.state == held)


func test_battle_options_carry_only_what_the_player_owns() -> void:
	var owned: Array = _snapshot()["story_state"]["owned_character_ids"]
	assert_gt(owned.size(), 0, "the starting state owns heroes")
	var hero: String = owned[0]
	var stranger: String = "brin_alder"
	assert_false(owned.has(stranger))
	_stub({
		"roster": {
			hero: {"level": 7, "memory_nodes": 2, "skill_ranks": {"skill_x": 3}},
			stranger: {"level": 9, "memory_nodes": 2, "skill_ranks": {"skill_y": 2}},
		},
		"inventory": {
			"inventory_weapons": [
				{"instance_id": "w1", "template_id": "weapon_mahmut_signature", "level": 4, "equipped_character_id": hero},
				{"instance_id": "w2", "template_id": "weapon_mahmut_signature", "level": 1, "equipped_character_id": stranger},
			],
			"inventory_armor": [{"instance_id": "a1", "template_id": "armor_padded_3_01", "level": 2, "equipped_character_id": null}],
		},
	})
	assert_true((await _flow.sync()).is_ok())
	var options: Dictionary = _flow.battle_options(77)
	assert_eq(options["run_seed"], 77)
	assert_true(options["story_state"] == _flow.state.story_state)
	assert_eq(options["player_levels"], {hero: 7})
	assert_eq(options["skill_ranks"], {hero: {"skill_x": 3}})
	assert_eq(options["memory_nodes"], {hero: 2})
	assert_eq((options["equipment"] as Dictionary).keys(), [hero])
	assert_eq(options["equipment"][hero]["weapon_id"], "weapon_mahmut_signature")
	assert_eq(options["equipment"][hero]["weapon_level"], 4)
	assert_null(options["equipment"][hero]["armor_id"], "unequipped armor stays off the loadout")


func test_a_defeat_reports_nothing_to_the_server() -> void:
	var backend: _StubBackend = _stub()
	assert_true((await _flow.sync()).is_ok())
	var lost: BattleService.BattleResult = BattleService.BattleResult.new()
	lost.stage_id = "1-1"
	lost.outcome = "defeat"
	var outcome: GameFlow.StageOutcome = await _flow.complete_battle(lost)
	assert_true(outcome.is_defeat())
	assert_eq(backend.calls, ["fetch_state"] as Array[String], "only the boot sync reached the server")


func test_a_victory_is_reported_and_the_reply_becomes_the_state() -> void:
	var backend: _StubBackend = _stub()
	assert_true((await _flow.sync()).is_ok())
	var won: BattleService.BattleResult = BattleService.BattleResult.new()
	won.stage_id = "1-1"
	won.outcome = "victory"
	var advanced: Dictionary = _snapshot()
	advanced["story_state"]["completed_stage_ids"] = ["1-1"]
	advanced["story_state"]["story_cursor"] = 2
	advanced["story_state"]["story_cursor_entry_id"] = _flow.story_index.story_order[2]
	backend.reply = Outcome.ok({"state": advanced, "applied": [{"item_id": "torn_chronicle_page"}], "first_clear": true})
	var outcome: GameFlow.StageOutcome = await _flow.complete_battle(won, [])
	assert_eq(outcome.error, "")
	assert_true(outcome.first_clear)
	assert_eq(outcome.applied.size(), 1)
	assert_true(outcome.story_state.completed_stage_ids.has("1-1"))
	assert_eq(_flow.state.story_state.story_cursor, 2)
	assert_eq(backend.calls[-1], "submit_victory")
