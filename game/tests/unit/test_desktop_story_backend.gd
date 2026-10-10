extends GutTest
const Backend = preload("res://scripts/art_review/desktop_story_backend.gd")
const SAVE: String = "user://test_full_story_review.cfg"
var flow: GameFlow
var local: Backend

func before_each() -> void:
	flow = GameFlow.create()
	local = Backend.new(flow)
	flow.backend = local
	assert_true(flow.is_ready(), flow.error)
	assert_true((await flow.sync()).is_ok())

func after_each() -> void:
	DirAccess.remove_absolute(SAVE)
	DirAccess.remove_absolute(SAVE + ".tmp")

func test_stage_cannot_be_skipped_and_first_oath_uses_the_authored_pool() -> void:
	assert_false((await local.begin_stage("7-5", [])).is_ok())
	assert_false((await local.claim_first_oath("fadyme")).is_ok())
	assert_true((await flow.advance()).is_ok())
	assert_eq(flow.current_entry(), "1-1")
	assert_false((await flow.advance()).is_ok(), "narrative advance cannot skip a battle")

func test_all_51_authored_entries_and_35_real_battles_can_reach_the_ending() -> void:
	var entries: int = 0
	var stages: int = 0
	while not flow.is_finished() and entries < 60:
		if flow.needs_first_oath_selection():
			assert_true((await flow.claim_first_oath("tilda_fen")).is_ok())
		var entry: String = flow.current_entry()
		if flow.is_stage(entry):
			var outcome: GameFlow.StageOutcome = await flow.run_stage(entry)
			assert_true(outcome.is_victory(), "%s: %s / %s" % [entry, outcome.error, outcome.battle.outcome if outcome.battle != null else "no battle"])
			if not outcome.is_victory(): return
			stages += 1
		else:
			assert_true((await flow.advance()).is_ok(), entry)
		entries += 1
	assert_eq(entries, 51)
	assert_eq(stages, 35)
	assert_true(flow.is_finished())
	assert_eq(flow.state.wallet()["eclipse_tokens"], 0, "review creates no account economy")
	assert_true(flow.state.story_state.completed_stage_ids.has("7-5"))

func test_local_save_restores_cursor_and_open_attempt_and_victory_is_idempotent() -> void:
	local = Backend.new(flow, SAVE)
	flow.backend = local
	assert_true((await flow.advance()).is_ok())
	assert_true((await flow.begin_stage("1-1")).is_ok())
	var opened: Dictionary = flow.attempt.duplicate()
	var restored: Backend = Backend.new(flow, SAVE)
	assert_true(restored.error.is_empty(), restored.error)
	assert_eq(restored.snapshot["open_attempt"]["attempt_id"], opened["attempt_id"])
	assert_eq(restored.snapshot["open_attempt"]["run_seed"], opened["run_seed"])
	assert_true((await restored.submit_victory(opened["attempt_id"], {"outcome":"victory"})).is_ok())
	var cursor: int = restored.snapshot["story_state"]["story_cursor"]
	assert_true((await restored.submit_victory(opened["attempt_id"], {"outcome":"victory"})).is_ok())
	assert_eq(restored.snapshot["story_state"]["story_cursor"], cursor)
	var reloaded: Backend = Backend.new(flow, SAVE)
	assert_eq(reloaded.snapshot["story_state"]["story_cursor"], cursor)

func test_corrupt_save_is_preserved_and_failed_save_keeps_previous_state() -> void:
	var file: FileAccess = FileAccess.open(SAVE, FileAccess.WRITE)
	file.store_string("not a valid review save")
	file.close()
	var corrupt: Backend = Backend.new(flow, SAVE)
	assert_false((await corrupt.fetch_state()).is_ok())
	assert_eq(FileAccess.get_file_as_string(SAVE), "not a valid review save")
	var blocked: Backend = Backend.new(flow, "user://missing_review_folder/state.cfg")
	var before: Dictionary = blocked.snapshot.duplicate(true)
	assert_false((await blocked.advance_story()).is_ok())
	assert_eq(blocked.snapshot, before)

func test_purchases_and_social_actions_still_fail_without_network_or_fake_grants() -> void:
	assert_false((await local.gacha_pull("anything", 10)).is_ok())
	assert_false((await local.subscription_verify("anything")).is_ok())
	assert_false((await local.send_friend_request("AAAA-AAAA")).is_ok())
