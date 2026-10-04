extends GutTest
## DEC-0012: the client's player state is a server snapshot. `PlayerState` validates it and normalizes JSON numbers; `GameFlow` adopts it
## from every backend reply and keeps the old one when a reply fails or carries no usable state.

## A backend that answers every call with `snapshot` (or `reply` when set) and records what it was asked.
class _StubBackend extends GameBackend:
	var snapshot: Dictionary = {}
	var reply: Outcome = null
	var calls: Array[String] = []
	## Arguments of the last begin_stage / submit_victory call.
	var args: Array = []
	## The seed begin_stage hands out (a JSON number, as the server sends it).
	var seed: int = 4242

	func _answer(call_name: String) -> Outcome:
		calls.append(call_name)
		return reply if reply != null else Outcome.ok({"state": snapshot})

	func fetch_state() -> Outcome:
		return _answer("fetch_state")

	func advance_story() -> Outcome:
		return _answer("advance_story")

	func begin_stage(stage_id: String, roster: Array) -> Outcome:
		args = [stage_id, roster]
		calls.append("begin_stage")
		if reply != null:
			return reply
		return Outcome.ok({"state": snapshot, "attempt": {"attempt_id": "attempt-1", "stage_id": stage_id, "run_seed": float(seed)}})

	func submit_victory(attempt_id: String, client_result: Dictionary) -> Outcome:
		args = [attempt_id, client_result]
		return _answer("submit_victory")

	func level_up(_character_id: String, _items: Dictionary) -> Outcome:
		return _answer("level_up")

	func abandon_attempt(attempt_id: String) -> Outcome:
		args = [attempt_id]
		return _answer("abandon_attempt")


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


## The contract fixture the Worker's own tests check its new-account snapshot against (server/test/state.test.ts).
func test_the_servers_new_account_snapshot_is_accepted() -> void:
	var path: String = ProjectSettings.globalize_path("res://").path_join("../server/test/fixtures/state_new_account.json").simplify_path()
	assert_true(FileAccess.file_exists(path), path)
	var state: PlayerState = PlayerState.from_snapshot(JSON.parse_string(FileAccess.get_file_as_string(path)), _flow.rules.story)
	assert_true(state.is_valid(), state.error)
	assert_eq(state.story_state.story_cursor, 0)
	assert_eq(state.revision(), 0, "a new account starts at state_revision 0")
	assert_eq(_flow.rules.story.to_persisted_dict(state.story_state), _flow.rules.story.to_persisted_dict(_flow.rules.story.new_player_state()),
		"identical to the client's new_player_state")
	assert_eq(state.roster_ids(), ["fadyme", "mahmut"] as Array[String])
	assert_eq(state.wallet()["silver_crowns"], 0)
	assert_eq(state.inn_meal_amount(), 30, "a new player can take today's Inn Meal")
	var eaten: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(path))
	eaten["ration"]["inn_meal"]["available"] = false
	assert_eq(PlayerState.from_snapshot(eaten, _flow.rules.story).inn_meal_amount(), 0)


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


func test_a_defeat_gives_its_attempt_up_and_reports_no_result() -> void:
	var backend: _StubBackend = _stub()
	assert_true((await _flow.sync()).is_ok())
	var lost: BattleService.BattleResult = BattleService.BattleResult.new()
	lost.stage_id = "1-1"
	lost.outcome = "defeat"
	lost.run_seed = 4242
	_flow.attempt = {"attempt_id": "attempt-1", "stage_id": "1-1", "run_seed": 4242}
	var outcome: GameFlow.StageOutcome = await _flow.complete_battle(lost)
	assert_true(outcome.is_defeat())
	assert_eq(backend.calls, ["fetch_state", "abandon_attempt"] as Array[String], "no victory report; the attempt is given up (INF-014)")
	assert_eq(backend.args, ["attempt-1"])
	assert_true(_flow.attempt.is_empty())
	backend.reply = Outcome.fail(GameBackend.KIND_OFFLINE, "offline")
	_flow.attempt = {"attempt_id": "attempt-2", "stage_id": "1-1", "run_seed": 4242}
	assert_true((await _flow.complete_battle(lost)).is_defeat(), "a failed give-up changes nothing for the player")


func test_a_victory_is_reported_and_the_reply_becomes_the_state() -> void:
	var backend: _StubBackend = _stub()
	assert_true((await _flow.sync()).is_ok())
	var won: BattleService.BattleResult = BattleService.BattleResult.new()
	won.stage_id = "1-1"
	won.outcome = "victory"
	won.run_seed = 4242
	_flow.attempt = {"attempt_id": "attempt-1", "stage_id": "1-1", "run_seed": 4242}
	var advanced: Dictionary = _snapshot()
	advanced["story_state"]["completed_stage_ids"] = ["1-1"]
	advanced["story_state"]["story_cursor"] = 2
	advanced["story_state"]["story_cursor_entry_id"] = _flow.story_index.story_order[2]
	backend.reply = Outcome.ok({"state": advanced, "applied": [{"item_id": "torn_chronicle_page"}], "first_clear": true})
	var outcome: GameFlow.StageOutcome = await _flow.complete_battle(won)
	assert_eq(outcome.error, "")
	assert_true(outcome.first_clear)
	assert_eq(outcome.applied.size(), 1)
	assert_true(outcome.story_state.completed_stage_ids.has("1-1"))
	assert_eq(_flow.state.story_state.story_cursor, 2)
	assert_eq(backend.calls[-1], "submit_victory")
	assert_eq(backend.args[0], "attempt-1", "the victory names the attempt, not a seed")
	assert_true(_flow.attempt.is_empty(), "a reported attempt is used up")


func test_begin_stage_keeps_the_attempt_the_server_opened() -> void:
	var backend: _StubBackend = _stub()
	assert_true((await _flow.sync()).is_ok())
	var opened: Outcome = await _flow.begin_stage("1-1")
	assert_true(opened.is_ok(), opened.error)
	assert_eq(backend.args, ["1-1", []], "the tutorial's default party is empty")
	assert_eq(_flow.attempt, {"attempt_id": "attempt-1", "stage_id": "1-1", "run_seed": 4242})
	assert_typeof(_flow.attempt["run_seed"], TYPE_INT, "the JSON number becomes an int seed")
	backend.reply = Outcome.ok({"state": backend.snapshot, "attempt": {"attempt_id": "x", "stage_id": "1-2", "run_seed": 1.0}})
	var wrong: Outcome = await _flow.begin_stage("1-1")
	assert_eq(wrong.error_kind, GameFlow.ERROR_PROTOCOL, "an attempt for another stage is refused")
	assert_true(_flow.attempt.is_empty())
	backend.reply = Outcome.fail("conflict", "Stage 1-1 is not unlocked")
	assert_eq((await _flow.begin_stage("1-1")).error_kind, "conflict")
	assert_true(_flow.attempt.is_empty())


func test_a_victory_without_its_attempt_is_not_reported() -> void:
	var backend: _StubBackend = _stub()
	assert_true((await _flow.sync()).is_ok())
	_flow.attempt = {"attempt_id": "attempt-1", "stage_id": "1-1", "run_seed": 7}
	var won: BattleService.BattleResult = BattleService.BattleResult.new()
	won.stage_id = "1-1"
	won.outcome = "victory"
	won.run_seed = 8
	var outcome: GameFlow.StageOutcome = await _flow.complete_battle(won)
	assert_eq(outcome.error_kind, GameFlow.ERROR_FLOW, "a battle fought on another seed matches no attempt")
	assert_false(backend.calls.has("submit_victory"))


func test_run_stage_plays_the_seed_of_the_attempt() -> void:
	var backend: _StubBackend = _stub()
	assert_true((await _flow.sync()).is_ok())
	var outcome: GameFlow.StageOutcome = await _flow.run_stage("1-1")
	assert_eq(outcome.error, "")
	assert_eq(outcome.battle.run_seed, 4242, "the battle ran on the server's seed")
	assert_eq(backend.calls.slice(1, 2), ["begin_stage"] as Array[String])
	if outcome.is_victory():
		assert_eq(backend.calls[-1], "submit_victory")
		assert_eq(backend.args[0], "attempt-1")
		assert_eq(int(backend.args[1]["stars"]), outcome.battle.stars)


func test_an_older_revision_never_replaces_the_held_snapshot() -> void:
	var backend: _StubBackend = _stub({"state_revision": 5, "wallet": {"silver_crowns": 500}})
	assert_true((await _flow.sync()).is_ok())
	assert_eq(_flow.state.revision(), 5)
	var held: PlayerState = _flow.state
	backend.snapshot = _snapshot({"state_revision": 4, "wallet": {"silver_crowns": 1}})
	var late: Outcome = await _flow.advance()
	assert_true(late.is_ok(), "the reply itself succeeded; only its older snapshot is ignored")
	assert_true(_flow.state == held)
	assert_eq(_flow.wallet()["silver_crowns"], 500)
	backend.snapshot = _snapshot({"state_revision": 5, "wallet": {"silver_crowns": 520}})
	assert_true((await _flow.sync()).is_ok())
	assert_eq(_flow.wallet()["silver_crowns"], 520, "the same revision is adopted (time-derived values such as Ration move on)")
	backend.snapshot = _snapshot({"state_revision": 6, "wallet": {"silver_crowns": 600}})
	assert_true((await _flow.advance()).is_ok())
	assert_eq([_flow.state.revision(), _flow.wallet()["silver_crowns"]], [6, 600])


func test_a_victory_without_a_reply_stays_unreported_until_it_is_sent_again() -> void:
	var backend: _StubBackend = _stub()
	assert_true((await _flow.sync()).is_ok())
	var won: BattleService.BattleResult = BattleService.BattleResult.new()
	won.stage_id = "1-1"
	won.outcome = "victory"
	won.run_seed = 4242
	_flow.attempt = {"attempt_id": "attempt-1", "stage_id": "1-1", "run_seed": 4242}
	backend.reply = Outcome.fail(GameBackend.KIND_OFFLINE, "The game server cannot be reached.")
	var lost: GameFlow.StageOutcome = await _flow.complete_battle(won)
	assert_eq(lost.error_kind, GameBackend.KIND_OFFLINE)
	assert_true(_flow.unreported == won, "the result is kept (it may have been paid)")
	assert_eq(_flow.attempt["attempt_id"], "attempt-1", "and so is its attempt")
	backend.reply = null
	var again: GameFlow.StageOutcome = await _flow.report_again()
	assert_eq(again.error, "")
	assert_eq(backend.calls.count("submit_victory"), 2)
	assert_eq(backend.args[0], "attempt-1", "the same attempt is reported")
	assert_null(_flow.unreported)
	assert_true(_flow.attempt.is_empty())
	assert_eq((await _flow.report_again()).error_kind, GameFlow.ERROR_FLOW, "nothing left to report")


## The inputs the server freezes for the current snapshot (stages.ts `battleInputs`), as they arrive in JSON.
func _server_inputs(options: Dictionary) -> Dictionary:
	var owned: Array = []
	for character_id: String in (options["story_state"] as StoryState.PlayerStoryState).owned_character_ids:
		owned.append(character_id)
	owned.sort()
	var inputs: Dictionary = {"owned_character_ids": owned, "player_levels": options["player_levels"], "equipment": options["equipment"],
		"skill_ranks": options["skill_ranks"], "memory_nodes": options["memory_nodes"]}
	return JSON.parse_string(JSON.stringify(inputs))


func test_a_resumed_attempt_runs_on_the_inputs_the_server_froze() -> void:
	var hero: String = "mahmut"
	_stub({"roster": {hero: {"level": 7, "memory_nodes": 2, "skill_ranks": {"skill_x": 3}}},
		"inventory": {"inventory_weapons": [{"instance_id": "w1", "template_id": "weapon_mahmut_signature", "level": 4, "equipped_character_id": hero}]}})
	assert_true((await _flow.sync()).is_ok())
	var current: Dictionary = _flow.battle_options(99)
	var frozen: Dictionary = _flow.frozen_battle_options(_server_inputs(current), 99)
	for key: String in ["player_levels", "equipment", "skill_ranks", "memory_nodes", "run_seed"]:
		assert_eq(frozen[key], current[key], key)
	assert_typeof(frozen["player_levels"][hero], TYPE_INT)
	assert_typeof(frozen["equipment"][hero]["weapon_level"], TYPE_INT)
	assert_eq((frozen["story_state"] as StoryState.PlayerStoryState).owned_character_ids.keys(),
		(current["story_state"] as StoryState.PlayerStoryState).owned_character_ids.keys())


func test_the_snapshots_open_attempt_can_be_resumed_or_given_up() -> void:
	var inputs: Dictionary = {"owned_character_ids": ["fadyme", "mahmut"], "player_levels": {}, "equipment": {}, "skill_ranks": {}, "memory_nodes": {}}
	var backend: _StubBackend = _stub({"open_attempt": {"attempt_id": "attempt-9", "stage_id": "1-1", "run_seed": 77.0, "roster": [], "inputs": inputs}})
	assert_true((await _flow.sync()).is_ok())
	var open: Dictionary = _flow.open_attempt()
	assert_eq([open["attempt_id"], open["stage_id"], open["run_seed"]], ["attempt-9", "1-1", 77])
	assert_typeof(open["run_seed"], TYPE_INT)
	assert_true(_flow.resume_open_attempt())
	var job: WorkerJob = _flow.start_battle("1-1", _flow.attempt["roster"], 77)
	var result: BattleService.BattleResult = job.finish() as BattleService.BattleResult
	assert_eq(result.error, "")
	assert_eq(result.run_seed, 77, "the resumed battle runs on the attempt's seed")
	var outcome: GameFlow.StageOutcome = await _flow.complete_battle(result)
	assert_eq(outcome.error, "")
	assert_eq(backend.calls[-1], "submit_victory" if result.outcome == "victory" else "abandon_attempt")
	assert_eq(backend.args[0], "attempt-9")
	assert_true((await _flow.abandon_open_attempt()).is_ok())
	assert_eq(backend.calls[-1], "abandon_attempt")
	backend.snapshot = _snapshot({"open_attempt": null})
	assert_true((await _flow.sync()).is_ok())
	assert_true(_flow.open_attempt().is_empty())
	assert_false(_flow.resume_open_attempt())
