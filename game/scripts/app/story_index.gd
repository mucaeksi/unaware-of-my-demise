class_name StoryIndex
extends RefCounted
## Flattens the Part I story-script content pack into a playable sequence (port of client/story_index.py).
##
## `story_script_part1_manifest.json` declares one flat `story_order` list that mixes stage ids ("1-1", "3-4", ...) with pure
## narrative scene ids ("opening_sad_scene", ...). A stage id's Visual Novel wrapper lives in a chapter file's `scenes` list, keyed by
## `stage_id`, and holds only `pre_battle_lines` / `post_battle_lines`: a stage scene is never shown as one read-through; the caller
## plays the "pre" half, runs the battle, then plays the "post" half. Every other entry (chapter openings, the `after_battle_scenes`
## closers) is a plain scene with a `lines` field, played as authored.
##
## Pure content indexing: no persistence, no battle or reward logic. Failures the reference raises as StoryIndexError are returned:
## `load_dir` always gives an index and sets `load_error` when the pack is unusable; a lookup that fails returns an empty Dictionary
## and sets `error`.

var story_order: Array[String] = []
## Why the pack could not be indexed ("" = ready).
var load_error: String = ""
## The last failed lookup ("" = the last lookup succeeded); reset by every lookup.
var error: String = ""

var _stage_scenes: Dictionary = {}
var _plain_scenes: Dictionary = {}


## Loads the manifest and the chapter files it lists from `content_dir` (check `load_error`).
static func load_dir(content_dir: String) -> StoryIndex:
	var index: StoryIndex = StoryIndex.new()
	index.load_error = index._load(content_dir)
	index.error = ""
	return index


func _load(content_dir: String) -> String:
	var manifest: Variant = _load_json(content_dir.path_join("story_script_part1_manifest.json"))
	if not (manifest is Dictionary):
		return error
	var chapter_files: Variant = (manifest as Dictionary).get("chapter_files")
	var order: Variant = (manifest as Dictionary).get("story_order")
	if not (chapter_files is Array) or (chapter_files as Array).is_empty():
		return "Manifest is missing a non-empty chapter_files list"
	if not (order is Array) or (order as Array).is_empty():
		return "Manifest is missing a non-empty story_order list"
	for entry: Variant in order:
		if not (entry is String):
			return "story_order entries must be strings"
		story_order.append(entry)

	for chapter_file: Variant in chapter_files:
		if not (chapter_file is String) or (chapter_file as String).is_empty():
			return "chapter_files entries must be non-empty strings"
		var chapter: Variant = _load_json(content_dir.path_join(chapter_file))
		if not (chapter is Dictionary):
			return error
		var opening: Variant = (chapter as Dictionary).get("opening_scene")
		if opening is Dictionary:
			var problem: String = _register_plain_scene(opening, chapter_file)
			if not problem.is_empty():
				return problem
		var scenes: Variant = (chapter as Dictionary).get("scenes", [])
		if not (scenes is Array):
			return "%s: scenes must be a list" % chapter_file
		for scene: Variant in scenes:
			if not (scene is Dictionary):
				return "%s: scenes entries must be objects" % chapter_file
			var stage_id: Variant = (scene as Dictionary).get("stage_id")
			if stage_id is String and not (stage_id as String).is_empty():
				if _stage_scenes.has(stage_id):
					return "Duplicate stage_id in story script: '%s'" % stage_id
				_stage_scenes[stage_id] = scene
			else:
				var problem: String = _register_plain_scene(scene, chapter_file)
				if not problem.is_empty():
					return problem
		var closers: Variant = (chapter as Dictionary).get("after_battle_scenes", [])
		if not (closers is Array):
			return "%s: after_battle_scenes must be a list" % chapter_file
		for scene: Variant in closers:
			if not (scene is Dictionary):
				return "%s: after_battle_scenes entries must be objects" % chapter_file
			var problem: String = _register_plain_scene(scene, chapter_file)
			if not problem.is_empty():
				return problem

	var missing: Array[String] = []
	for entry_id: String in story_order:
		if not _stage_scenes.has(entry_id) and not _plain_scenes.has(entry_id):
			missing.append(entry_id)
	if not missing.is_empty():
		return "story_order references undefined scene/stage IDs: %s" % str(missing)
	return ""


func _register_plain_scene(scene: Dictionary, chapter_file: String) -> String:
	var scene_id: Variant = scene.get("scene_id")
	if not (scene_id is String) or (scene_id as String).is_empty():
		return "%s: a scene is missing scene_id" % chapter_file
	if _plain_scenes.has(scene_id):
		return "Duplicate scene_id in story script: '%s'" % scene_id
	_plain_scenes[scene_id] = scene
	return ""


func _load_json(path: String) -> Variant:
	var name: String = path.get_file()
	if not FileAccess.file_exists(path):
		error = "Unable to load %s: file not found" % name
		return null
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (parsed is Dictionary):
		error = "%s root must be a JSON object" % name
		return null
	return parsed


func is_stage_entry(entry_id: String) -> bool:
	return _stage_scenes.has(entry_id)


func stage_entry_count() -> int:
	return _stage_scenes.size()


## The as-authored VN scene of a non-stage entry ({} + `error` when the id is unknown).
func narrative_scene(entry_id: String) -> Dictionary:
	error = ""
	if not _plain_scenes.has(entry_id):
		error = "Unknown non-stage story_order entry: '%s'" % entry_id
		return {}
	return _plain_scenes[entry_id]


## The VN-readable scene for the lines shown before a stage's battle ({} + `error` when the stage or its lines are missing).
func pre_battle_scene(stage_id: String) -> Dictionary:
	return _half_scene(stage_id, "pre_battle_lines", "_pre")


## The scene for the lines shown after the battle. {} WITHOUT an error when the stage authors no post-battle beat: not every stage
## does, and an empty scene cannot be played, so the caller moves straight to the next entry.
func post_battle_scene(stage_id: String) -> Dictionary:
	error = ""
	if not _stage_scenes.has(stage_id):
		error = "Unknown stage_id in story script: '%s'" % stage_id
		return {}
	var lines: Variant = (_stage_scenes[stage_id] as Dictionary).get("post_battle_lines")
	if not (lines is Array) or (lines as Array).is_empty():
		return {}
	return _half_scene(stage_id, "post_battle_lines", "_post")


func _half_scene(stage_id: String, field: String, suffix: String) -> Dictionary:
	error = ""
	if not _stage_scenes.has(stage_id):
		error = "Unknown stage_id in story script: '%s'" % stage_id
		return {}
	var scene: Dictionary = _stage_scenes[stage_id]
	var lines: Variant = scene.get(field)
	if not (lines is Array) or (lines as Array).is_empty():
		error = "Stage '%s' scene '%s' has no %s" % [stage_id, str(scene.get("scene_id")), field]
		return {}
	return {
		"scene_id": "%s%s" % [str(scene.get("scene_id")), suffix],
		"title_en": scene.get("title_en", ""),
		"lines": lines,
	}
