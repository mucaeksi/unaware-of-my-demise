extends GutTest
## G3.4: StoryState reproduces parity/fixtures/{story_flow,rosters,persisted_state}.json (core/story_state.py):
## the whole story walked once per First Oath choice, roster resolution for every stage (valid and invalid
## selections), the persisted format with cursor re-resolution, and the First Oath claim rules.

const PARTY: int = 5
const TUTORIAL: String = "1-1"

var _registry: ContentModels.ContentRegistry = null
var _story: StoryState = null


func before_all() -> void:
	var loader: ContentLoader = ContentLoader.new()
	_registry = loader.load_dir("res://data/content")
	_story = StoryState.new(_registry, StoryState.load_manifest("res://data/content"))


## GameController.auto_roster: nobody for the tutorial, else the first five owned heroes by id.
func _auto_roster(state: StoryState.PlayerStoryState, stage_id: String) -> Array[String]:
	var roster: Array[String] = []
	if stage_id == TUTORIAL:
		return roster
	var owned: Array[String] = []
	for character_id: String in state.owned_character_ids:
		owned.append(character_id)
	owned.sort()
	for index: int in range(mini(PARTY, owned.size())):
		roster.append(owned[index])
	return roster


func _persisted(state: StoryState.PlayerStoryState, order: Variant = null) -> Dictionary:
	return _story.to_persisted_dict(state, order)


func _state_from(data: Dictionary) -> StoryState.PlayerStoryState:
	var state: StoryState.PlayerStoryState = _story.from_persisted_dict(data)
	assert_eq(_story.error, "", "a persisted state from the fixtures loads")
	return state


func test_the_story_order_and_the_first_oath_pool() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("story_flow")
	assert_eq(Array(_story.story_order()), fixture["story_order"], "story_order")
	assert_eq(Array(_story.first_oath_choices()), fixture["first_oath_choices"], "First Oath pool, authored order")


func test_the_whole_story_walked_once_per_first_oath_choice() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("story_flow")
	var order: Array[String] = _story.story_order()
	assert_eq(order.size(), 51)
	for case: Dictionary in fixture["cases"]:
		var state: StoryState.PlayerStoryState = _story.new_player_state()
		var choice: String = String(case["first_oath_choice"])
		for step: Dictionary in case["steps"]:
			var entry_id: String = String(step["entry_id"])
			var label: String = "%s / %s" % [choice, entry_id]
			var is_stage: bool = _registry.stages.has(entry_id)
			assert_eq(is_stage, bool(step["is_stage"]), label + " is_stage")
			if state.first_oath_invitation_available:
				assert_eq(String(step["first_oath_claimed"]), choice, label + " claim")
				state = _story.claim_first_oath_invitation(state, choice)
				assert_eq(_story.error, "", label)
				assert_eq(ParityCompare.diff(_persisted(state), step["state_after_claim"]), "", label + " state after claim")
			else:
				assert_false(step.has("first_oath_claimed"), label + " no claim")
			assert_eq(ParityCompare.diff(_persisted(state), step["state_before"]), "", label + " state before")
			if is_stage:
				var stage: ContentModels.Stage = _registry.stages[entry_id]
				var roster: Array[String] = _auto_roster(state, entry_id)
				assert_eq(Array(roster), step["auto_roster"], label + " auto roster")
				var slots: Array[StoryState.BattleSlot] = _story.resolve_battle_roster(state, stage, roster)
				assert_eq(_story.error, "", label + " roster resolves")
				assert_eq(ParityCompare.diff(slots, step["slots"]), "", label + " slots")
				state = _story.advance_story_cursor(_story.apply_story_rewards(state, stage))
			else:
				state = _story.advance_story_cursor(state)
			assert_eq(ParityCompare.diff(_persisted(state), step["state_after"]), "", label + " state after")


func test_roster_resolution_valid_and_invalid_selections() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("rosters")
	assert_eq((fixture["cases"] as Array).size(), 35, "one case per stage")
	for case: Dictionary in fixture["cases"]:
		var stage: ContentModels.Stage = _registry.stages[String(case["stage_id"])]
		var state: StoryState.PlayerStoryState = _state_from(case["state"])
		assert_eq(Array(stage.guest_characters), case["guest_characters"], "%s guests" % stage.stage_id)
		assert_eq(stage.recommended_level, int(case["recommended_level"]), "%s level" % stage.stage_id)
		for row: Dictionary in case["selections"]:
			var label: String = "%s / %s" % [stage.stage_id, row["name"]]
			var slots: Array[StoryState.BattleSlot] = _story.resolve_battle_roster(state, stage, row["selected"])
			if row["error"] == null:
				assert_eq(_story.error, "", label + " resolves")
				assert_eq(ParityCompare.diff(slots, row["slots"]), "", label + " slots")
			else:
				assert_ne(_story.error, "", label + " must be rejected (%s in the reference)" % row["error"])
				assert_eq(slots.size(), 0, label + " yields no slots")


func test_persisted_states_round_trip_and_re_resolve_the_cursor() -> void:
	var fixture_case: Dictionary = (ParityFixtures.load_fixture("persisted_state")["cases"] as Array)[0]
	for row: Dictionary in fixture_case["valid"]:
		var label: String = String(row["name"])
		var order: Variant = row["story_order"]
		var state: StoryState.PlayerStoryState = _story.from_persisted_dict(row["data"], order)
		assert_eq(_story.error, "", label)
		assert_not_null(state, label)
		if state == null:
			continue
		assert_eq(state.story_cursor, int(row["story_cursor"]), label + " cursor")
		assert_eq(ParityCompare.diff(_story.to_persisted_dict(state, order), row["state"]), "", label + " persisted form")


func test_malformed_persisted_data_is_rejected() -> void:
	var fixture_case: Dictionary = (ParityFixtures.load_fixture("persisted_state")["cases"] as Array)[0]
	assert_eq((fixture_case["invalid"] as Array).size(), 11)
	for row: Dictionary in fixture_case["invalid"]:
		var state: StoryState.PlayerStoryState = _story.from_persisted_dict(row["data"])
		assert_null(state, "%s must be rejected (%s in the reference)" % [row["name"], row["raises"]])
		assert_ne(_story.error, "", String(row["name"]))


func test_a_missing_cursor_entry_only_warns() -> void:
	var fixture_case: Dictionary = (ParityFixtures.load_fixture("persisted_state")["cases"] as Array)[0]
	for row: Dictionary in fixture_case["valid"]:
		if String(row["name"]) == "entry_id_gone_keeps_index":
			_story.from_persisted_dict(row["data"], row["story_order"])
			assert_eq(_story.notes.size(), 1, "one warning note")
		if String(row["name"]) == "entry_id_moved_later":
			_story.from_persisted_dict(row["data"], row["story_order"])
			assert_eq(_story.notes.size(), 1, "one re-resolution note")


func test_first_oath_claim_rules() -> void:
	var fixture_case: Dictionary = (ParityFixtures.load_fixture("persisted_state")["cases"] as Array)[0]
	assert_eq(Array(_story.first_oath_choices()), fixture_case["first_oath_pool"])
	for row: Dictionary in fixture_case["first_oath_claims"]:
		var label: String = String(row["name"])
		var state: StoryState.PlayerStoryState = _state_from(row["state"])
		var result: StoryState.PlayerStoryState = _story.claim_first_oath_invitation(state, String(row["choice"]))
		if row["raises"] != null:
			assert_null(result, "%s must be rejected (%s in the reference)" % [label, row["raises"]])
			assert_ne(_story.error, "", label)
		else:
			assert_eq(_story.error, "", label)
			assert_eq(ParityCompare.diff(_persisted(result), row["result"]), "", label + " result")


func test_transitions_never_mutate_their_input() -> void:
	var state: StoryState.PlayerStoryState = _story.new_player_state()
	var before: Dictionary = _persisted(state)
	var stage: ContentModels.Stage = _registry.stages["1-2"]
	var next: StoryState.PlayerStoryState = _story.apply_story_rewards(state, stage)
	_story.advance_story_cursor(next)
	assert_eq(ParityCompare.diff(_persisted(state), before), "", "the input state is untouched")
	assert_true(next.completed_stage_ids.has("1-2"))
	assert_true(next.first_oath_invitation_available, "1-2 opens the First Oath selector")


func test_story_owned_ids_exclude_server_granted_characters() -> void:
	var state: StoryState.PlayerStoryState = _story.new_player_state()
	state.owned_character_ids["kera_voss"] = true
	state.online_character_ids["kera_voss"] = true
	assert_eq(Array(state.story_owned_character_ids()), ["fadyme", "mahmut"])


func test_a_claimed_invitation_is_never_offered_again() -> void:
	# The reference clears the flag with `not claimed and (...)`; the fixtures never replay a granting stage after a claim.
	var stage: ContentModels.Stage = _registry.stages["1-2"]
	var opened: StoryState.PlayerStoryState = _story.apply_story_rewards(_story.new_player_state(), stage)
	assert_true(opened.first_oath_invitation_available)
	var claimed: StoryState.PlayerStoryState = _story.claim_first_oath_invitation(opened, _story.first_oath_choices()[0])
	assert_false(claimed.first_oath_invitation_available)
	var replayed: StoryState.PlayerStoryState = _story.apply_story_rewards(claimed, stage)
	assert_false(replayed.first_oath_invitation_available, "1-2 replayed after the claim does not reopen the selector")
	assert_true(replayed.first_oath_invitation_claimed)
