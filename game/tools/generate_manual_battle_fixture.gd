extends SceneTree
const Session = preload("res://scripts/core/battle/live_battle.gd")

func _initialize() -> void:
	call_deferred("_generate")

func _generate() -> void:
	var registry: ContentModels.ContentRegistry = ContentLoader.new().load_dir("res://data/content")
	var story: StoryState = StoryState.new(registry,StoryState.load_manifest("res://data/content"))
	var fixtures: Array[Dictionary] = []
	for stage: String in ["1-1","1-5","2-1"]:
		for seed: int in [0,17,4007]:
			for cast_ready: bool in [false,true]:
				var service: BattleService = BattleService.create(registry,story)
				var roster: Array[String] = []
				roster.assign(["mahmut","fadyme"] if stage == "1-1" else ["mahmut","fadyme","brin_alder","nixie_vale","kera_voss"])
				var state: StoryState.PlayerStoryState = story.new_player_state()
				var levels: Dictionary = {}
				for hero: String in roster:
					state.owned_character_ids[hero] = true
					levels[hero] = 1 if stage == "1-1" else 5
				var result: BattleService.BattleResult = service.run(stage,roster,{"deferred":true,"story_state":state,"player_levels":levels,"run_seed":seed})
				if not result.error.is_empty():
					push_error(result.error)
					quit(1)
					return
				var session: Session = Session.new()
				session.start(result)
				while not session.completed:
					if cast_ready:
						for hero: String in roster:
							if session.ultimate(hero) != null: session.cast(hero)
							if session.completed: break
					if not session.completed: session.step()
				fixtures.append({"stage_id":stage,"roster":roster,"seed":seed,"levels":levels,"commands":result.manual_commands,"expected":{"error":result.error,"outcome":result.outcome,"stars":result.stars,"actions":result.actions,"cycles":result.cycles,"final_units":result.final_units,"events":result.state.battle_events}})
	var path: String = ProjectSettings.globalize_path("res://../server/test/fixtures/manual_ultimate_v1.json")
	var file: FileAccess = FileAccess.open(path,FileAccess.WRITE)
	file.store_string(JSON.stringify(fixtures,"  "))
	print("MANUAL_FIXTURES ",fixtures.size())
	quit()
