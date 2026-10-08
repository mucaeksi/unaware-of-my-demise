extends GutTest
const Session = preload("res://scripts/core/battle/live_battle.gd")

func test_manual_commands_reproduce_frozen_complete_battles() -> void:
	var registry: ContentModels.ContentRegistry = ContentLoader.new().load_dir("res://data/content")
	var story: StoryState = StoryState.new(registry,StoryState.load_manifest("res://data/content"))
	var fixtures: Array = JSON.parse_string(FileAccess.get_file_as_string(ProjectSettings.globalize_path("res://../server/test/fixtures/manual_ultimate_v1.json")))
	for fixture: Dictionary in fixtures:
		var state: StoryState.PlayerStoryState = story.new_player_state()
		for hero: String in fixture["roster"]: state.owned_character_ids[hero] = true
		var result: BattleService.BattleResult = BattleService.create(registry,story).run(fixture["stage_id"],fixture["roster"],{"story_state":state,"player_levels":fixture["levels"],"run_seed":int(fixture["seed"]),"deferred":true})
		var session: Session = Session.new()
		session.start(result)
		var cursor: int = 0
		var commands: Array = fixture["commands"]
		while not session.completed:
			while cursor < commands.size() and int(commands[cursor]["after_actions"]) == session.automatic_actions:
				assert_true(session.cast(commands[cursor]["actor_id"]))
				cursor += 1
				if session.completed: break
			if not session.completed: session.step()
		var actual: Dictionary = {"error":result.error,"outcome":result.outcome,"stars":result.stars,"actions":result.actions,"cycles":result.cycles,"final_units":result.final_units,"events":result.state.battle_events}
		assert_eq(ParityCompare.diff(actual,fixture["expected"]),"",str(fixture["stage_id"])+" seed "+str(fixture["seed"]))
		assert_eq(cursor,commands.size())
