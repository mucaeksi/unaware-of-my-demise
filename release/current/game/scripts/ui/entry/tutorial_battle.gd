extends RefCounted
## Reward-free local onboarding encounters. Reuses the actual combat resolver;
## isolated stage/roster records cannot change the main-story registry or saves.
const DATA: String = "res://data/entry/tutorial_v001.json"

class TutorialRoster extends StoryState:
	func resolve_battle_roster(_state: PlayerStoryState, stage: ContentModels.Stage, selected: Array) -> Array[BattleSlot]:
		var slots: Array[BattleSlot] = []
		if stage.chapter_id != "onboarding" or selected != ["mahmut", "fadyme"]:
			error = "The opening tutorial uses Mahmut and Fadyme only."
			return slots
		for index: int in range(2):
			var slot: BattleSlot = BattleSlot.new()
			slot.character_id = str(selected[index])
			slot.slot_index = 0 if index == 0 else 2
			slot.position = "front" if index == 0 else "rear"
			slots.append(slot)
		return slots

static func data() -> Dictionary:
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string(DATA))
	return raw if raw is Dictionary else {}

static func run(registry: ContentModels.ContentRegistry, chapter: Dictionary, deferred: bool = false) -> BattleService.BattleResult:
	var local: ContentModels.ContentRegistry = ContentModels.ContentRegistry.new()
	for property: Dictionary in registry.get_property_list():
		if int(property["usage"]) & PROPERTY_USAGE_SCRIPT_VARIABLE:
			local.set(str(property["name"]), registry.get(str(property["name"])))
	local.stages = registry.stages.duplicate()
	var stage: ContentModels.Stage = ContentModels.Stage.new()
	stage.stage_id = str(chapter["stage_id"])
	stage.chapter_id = "onboarding"
	stage.title_en = str(chapter["title_en"])
	stage.enemy_level = 1
	stage.recommended_level = 1
	var wave: Array = []
	for raw: Dictionary in chapter["enemies"]:
		var entry: ContentModels.EnemyWaveEntry = ContentModels.EnemyWaveEntry.new()
		entry.enemy_id = str(raw["enemy_id"])
		entry.count = int(raw["count"])
		wave.append(entry)
	stage.enemy_waves.append(wave)
	local.stages[stage.stage_id] = stage
	var roster: TutorialRoster = TutorialRoster.new(local, {})
	var service: BattleService = BattleService.create(local, roster)
	if not service.error.is_empty():
		var failure: BattleService.BattleResult = BattleService.BattleResult.new()
		failure.error = service.error
		return failure
	return service.run(stage.stage_id, ["mahmut","fadyme"], {"player_levels":{"mahmut":5,"fadyme":5},"run_seed":int(chapter["seed"]),"deferred":deferred})
