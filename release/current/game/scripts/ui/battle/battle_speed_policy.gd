class_name BattleSpeedPolicy
extends RefCounted
## Read-only presentation unlock. Freeze it before the engine resolves a battle;
## saving a victory before its replay must not unlock speed midway through it.

const CHAPTER_ID: String = "ch03_oakhaven_red_harvest"
const FINAL_STAGE_ID: String = "3-5"

static func double_speed_unlocked(story: StoryState.PlayerStoryState, registry: ContentModels.ContentRegistry) -> bool:
	if story == null or registry == null or not registry.stages.has(FINAL_STAGE_ID):
		return false
	var final_stage: ContentModels.Stage = registry.stages[FINAL_STAGE_ID]
	if final_stage.chapter_id != CHAPTER_ID or not story.completed_stage_ids.has(FINAL_STAGE_ID):
		return false
	for stage: ContentModels.Stage in registry.stages.values():
		if stage.chapter_id == CHAPTER_ID and not story.completed_stage_ids.has(stage.stage_id):
			return false
	return true
