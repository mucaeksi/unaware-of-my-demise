extends GutTest
const Backend = preload("res://scripts/art_review/desktop_story_backend.gd")
var flow: GameFlow
func before_each() -> void:
	flow = GameFlow.create()
	flow.backend = Backend.new(flow)
	assert_true((await flow.sync()).is_ok())

func test_unseen_journey_and_unowned_companions_never_leak_playable_records() -> void:
	var rows: Array[Dictionary] = StoryRecords.rows(flow)
	assert_eq(rows.size(), 76)
	for row: Dictionary in rows:
		assert_true(row["locked"])
		assert_eq(row["scene"], {}, "locked copy cannot contain the spoiler payload")
		assert_string_contains(row["label"], "Locked")
	assert_true((await flow.advance()).is_ok())
	rows = StoryRecords.rows(flow)
	assert_eq(rows[0]["id"], "opening_sad_scene")
	assert_false(rows[0]["locked"])
	assert_eq(flow.current_entry(), "1-1", "building replay rows never advances")

func test_unlock_requires_both_authored_stage_and_character_ownership() -> void:
	var state: StoryState.PlayerStoryState = flow.state.story_state
	state.completed_stage_ids["7-5"] = true
	state.completed_stage_ids["2-5"] = true
	var rows: Array[Dictionary] = StoryRecords.rows(flow)
	for row: Dictionary in rows:
		if row["id"] == "cs_mahmut_1": assert_false(row["locked"], "free starter + 2-5")
		if row["id"] == "cs_mahmut_2": assert_false(row["locked"], "7-5 ending is unlocked")
		if row["id"] == "cs_sable_wren_1": assert_true(row["locked"], "stage alone is not recruitment")

func test_story_portrait_gates_are_scene_specific_and_do_not_use_the_latest_account_cursor() -> void:
	var healthy: Texture2D = BattleArt.portrait("fadyme", "composed")
	assert_same(BattleArt.story_portrait("fadyme", "composed", "vn_5_4_pre", "node_5_4_pre_002"), healthy)
	var after: Texture2D = BattleArt.story_portrait("fadyme", "composed", "vn_5_4_post", "node_5_4_post_001")
	assert_not_same(after, healthy)
	assert_same(BattleArt.story_portrait("fadyme", "composed", "vn_6_1_pre", ""), after)
	assert_not_same(BattleArt.story_portrait("fadyme", "composed", "vn_7_5_post", ""), after)
	assert_same(BattleArt.story_portrait("fadyme", "composed", "vn_1_1_pre", ""), healthy)
