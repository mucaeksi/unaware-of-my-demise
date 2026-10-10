class_name StoryRecords
extends RefCounted
## Read-only presentation index. Existing cursor/stage/ownership gates are the
## source of truth; replay never advances the story or grants a reward.
static func rows(flow: GameFlow) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if flow == null or not flow.has_state(): return result
	for index: int in range(mini(flow.state.story_state.story_cursor, flow.story_index.story_order.size())):
		var entry: String = flow.story_index.story_order[index]
		if flow.is_stage(entry):
			for half: Dictionary in [flow.story_index.pre_battle_scene(entry), flow.story_index.post_battle_scene(entry)]:
				if not half.is_empty(): result.append({"id": str(half["scene_id"]), "label": "Journey · %s · %s" % [entry, "Before" if str(half["scene_id"]).ends_with("_pre") else "After"], "scene": half, "locked": false})
		else:
			var scene: Dictionary = flow.story_index.narrative_scene(entry)
			result.append({"id": entry, "label": "Journey · " + str(scene.get("title_en", entry)), "scene": scene, "locked": false})
	var pack: Variant = JSON.parse_string(FileAccess.get_file_as_string(GameFlow.CONTENT_DIR + "/character_stories_part1.json"))
	if not (pack is Dictionary): return result
	for story: Dictionary in pack.get("stories", []):
		var previous_unlocked: bool = true
		for part: Dictionary in story.get("parts", []):
			var unlock: Dictionary = part.get("unlock", {})
			var owned: String = str(unlock.get("requires_owned_character", "")) if unlock.get("requires_owned_character") != null else ""
			var stage: String = str(unlock.get("after_stage", ""))
			var available: bool = previous_unlocked and (owned.is_empty() or flow.state.story_state.owned_character_ids.has(owned)) and (stage.is_empty() or flow.state.story_state.completed_stage_ids.has(stage))
			previous_unlocked = available
			var label: String = "%s · Part %d · %s" % [story.get("name_en", "Companion"), int(part.get("part", 1)), part.get("title_en", "") if available else "Locked"]
			if not available:
				label += "\n" + ("Recruit this companion. " if not owned.is_empty() and not flow.state.story_state.owned_character_ids.has(owned) else "") + ("Complete stage %s." % stage if not stage.is_empty() else "")
			result.append({"id": str(part.get("story_id", "")), "label": label, "scene": part.duplicate(true) if available else {}, "locked": not available})
	return result
