extends GutTest
## G3.6: BattleService reproduces parity/fixtures/battle_<stage>.json: 35 stages x 3 squad variants x 5 seeds = 525
## complete Auto battles, compared on outcome, stars, action/cycle counts, final units and the whole event log.
##
## BATTLE_PARITY_STAGES (comma list of stage ids) and BATTLE_PARITY_LIMIT (cases per stage) narrow a run while
## developing; CI and a bare `gut` run replay everything.

var _registry: ContentModels.ContentRegistry = null
var _story: StoryState = null
var _service: BattleService = null


func before_all() -> void:
	var loader: ContentLoader = ContentLoader.new()
	_registry = loader.load_dir("res://data/content")
	_story = StoryState.new(_registry, StoryState.load_manifest("res://data/content"))
	_service = BattleService.create(_registry, _story)


func _stage_ids() -> Array[String]:
	var wanted: String = OS.get_environment("BATTLE_PARITY_STAGES")
	var result: Array[String] = []
	for stage_id: String in _registry.stages:
		if wanted.is_empty() or wanted.split(",").has(stage_id):
			result.append(stage_id)
	return result


func _limit() -> int:
	var raw: String = OS.get_environment("BATTLE_PARITY_LIMIT")
	return raw.to_int() if not raw.is_empty() else 1000000


## First difference of one recorded case against a fresh run ("" = identical).
func _run_case(stage_id: String, case: Dictionary) -> String:
	var input: Dictionary = case["input"]
	var story_state: StoryState.PlayerStoryState = _story.new_player_state()
	story_state.owned_character_ids = {}
	for character_id: Variant in input["owned_character_ids"]:
		story_state.owned_character_ids[String(character_id)] = true
	var result: BattleService.BattleResult = _service.run(stage_id, input["roster"], {
		"story_state": story_state, "player_levels": input["player_levels"], "equipment": input["equipment"],
		"skill_ranks": input["skill_ranks"], "memory_nodes": input["memory_nodes"],
		"run_seed": String(case["seed"]).to_int(),
	})
	if not result.error.is_empty():
		return "run failed: " + result.error
	if result.outcome != String(case["outcome"]):
		return "outcome %s, expected %s" % [result.outcome, case["outcome"]]
	var events: Array = case["events"]
	var actual: Array[Dictionary] = result.state.battle_events
	for index: int in range(mini(actual.size(), events.size())):
		var found: String = ParityCompare.diff(actual[index], events[index], "events[%d]" % index)
		if not found.is_empty():
			return found
	if actual.size() != events.size():
		return "event count %d, expected %d" % [actual.size(), events.size()]
	if result.stars != int(case["stars"]):
		return "stars %d, expected %d" % [result.stars, int(case["stars"])]
	if result.actions != int(case["actions"]):
		return "actions %d, expected %d" % [result.actions, int(case["actions"])]
	if result.cycles != int(case["cycles"]):
		return "cycles %d, expected %d" % [result.cycles, int(case["cycles"])]
	return ParityCompare.diff(result.final_units, case["final_units"], "final_units")


func test_every_recorded_battle() -> void:
	var replayed: int = 0
	var failures: Array[String] = []
	for stage_id: String in _stage_ids():
		var fixture: Dictionary = ParityFixtures.load_fixture("battle_" + stage_id)
		var cases: Array = fixture.get("cases", [])
		assert_gt(cases.size(), 0, "fixture for %s is present" % stage_id)
		for index: int in range(mini(cases.size(), _limit())):
			var case: Dictionary = cases[index]
			var found: String = _run_case(stage_id, case)
			replayed += 1
			if not found.is_empty():
				failures.append("%s %s seed %s: %s" % [stage_id, case["variant"], case["seed"], found])
	assert_eq(failures.size(), 0, "battles that differ (first 8 shown):\n" + "\n".join(failures.slice(0, 8)))
	assert_false(Frac.overflowed, "the Action Gauge stayed inside int64")
	gut.p("replayed %d battles" % replayed)
