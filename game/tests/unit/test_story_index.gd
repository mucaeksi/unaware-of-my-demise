extends GutTest
## G5: the story script index (port of tests/test_story_index.py): the real pack, and small synthetic packs for the failure paths.

const ROOT: String = "user://test_story_index"

var _index: StoryIndex = null


func before_all() -> void:
	_index = StoryIndex.load_dir("res://data/content")


func after_each() -> void:
	_remove_tree(ROOT)


static func _remove_tree(path: String) -> void:
	if not DirAccess.dir_exists_absolute(path):
		return
	for file_name: String in DirAccess.get_files_at(path):
		DirAccess.remove_absolute(path.path_join(file_name))
	for folder: String in DirAccess.get_directories_at(path):
		_remove_tree(path.path_join(folder))
	DirAccess.remove_absolute(path)


## Writes a synthetic pack: a manifest plus one chapter file, both as given.
func _pack(name: String, manifest: Dictionary, chapter: Dictionary) -> String:
	var folder: String = ROOT.path_join(name)
	DirAccess.make_dir_recursive_absolute(folder)
	manifest["chapter_files"] = ["chapter.json"]
	for entry: Array in [["story_script_part1_manifest.json", manifest], ["chapter.json", chapter]]:
		var file: FileAccess = FileAccess.open(folder.path_join(entry[0]), FileAccess.WRITE)
		file.store_string(JSON.stringify(entry[1]))
		file.close()
	return folder


func test_the_real_pack_indexes_every_entry() -> void:
	assert_eq(_index.load_error, "")
	assert_eq(_index.story_order.size(), 51)
	assert_eq(_index.stage_entry_count(), 35, "35 battle stages, the other 16 entries are narrative scenes")
	assert_eq(_index.story_order.slice(0, 5), ["opening_sad_scene", "1-1", "1-2", "ch1_first_oath", "1-3"])
	assert_eq(_index.story_order[50], "part1_clockless_reveal")


func test_every_entry_resolves_to_playable_lines() -> void:
	var stages: int = 0
	for entry_id: String in _index.story_order:
		var scenes: Array[Dictionary] = []
		if _index.is_stage_entry(entry_id):
			stages += 1
			scenes.append(_index.pre_battle_scene(entry_id))
			assert_eq(_index.error, "", entry_id)
			var post: Dictionary = _index.post_battle_scene(entry_id)
			assert_eq(_index.error, "", entry_id)
			if not post.is_empty():
				scenes.append(post)
		else:
			scenes.append(_index.narrative_scene(entry_id))
			assert_eq(_index.error, "", entry_id)
		for scene: Dictionary in scenes:
			assert_false((scene["lines"] as Array).is_empty(), "%s has lines" % entry_id)
			for line: Dictionary in scene["lines"]:
				assert_true(line.has("text_en") and line.has("speaker_display"), "%s: %s" % [entry_id, str(line.get("line_id"))])
	assert_eq(stages, 35)


func test_a_stage_scene_is_split_into_pre_and_post_halves() -> void:
	var pre: Dictionary = _index.pre_battle_scene("1-1")
	assert_eq(pre["scene_id"], "vn_1_1_pre")
	assert_eq(pre["title_en"], "The Road That Whispers")
	assert_eq((pre["lines"] as Array).size(), 3)
	var first: Dictionary = (pre["lines"] as Array)[0]
	assert_eq(first["line_id"], "node_1_1_pre_001")
	assert_eq(first["speaker_id"], "mahmut")
	assert_eq(first["text_en"], "Three wolves. Stay behind my shield.")
	assert_eq(_index.post_battle_scene("1-1")["scene_id"], "vn_1_1_post")


func test_lookups_of_the_wrong_kind_or_an_unknown_id_report_an_error() -> void:
	assert_true(_index.narrative_scene("1-1").is_empty(), "a stage is not a plain scene")
	assert_string_contains(_index.error, "Unknown non-stage story_order entry")
	assert_true(_index.pre_battle_scene("opening_sad_scene").is_empty())
	assert_string_contains(_index.error, "Unknown stage_id")
	assert_true(_index.post_battle_scene("9-9").is_empty())
	assert_string_contains(_index.error, "Unknown stage_id")
	_index.narrative_scene("opening_sad_scene")
	assert_eq(_index.error, "", "a successful lookup clears the error")


func test_a_stage_without_a_post_battle_beat_is_not_an_error() -> void:
	var folder: String = _pack("no_post", {"story_order": ["a", "s"]}, {
		"opening_scene": {"scene_id": "a", "lines": [{"text_en": "x"}]},
		"scenes": [{"stage_id": "s", "scene_id": "vn_s", "title_en": "T", "pre_battle_lines": [{"text_en": "y"}], "post_battle_lines": []}],
	})
	var index: StoryIndex = StoryIndex.load_dir(folder)
	assert_eq(index.load_error, "")
	assert_true(index.post_battle_scene("s").is_empty())
	assert_eq(index.error, "", "no post-battle lines is normal: the caller skips to the next entry")
	assert_eq(index.pre_battle_scene("s")["scene_id"], "vn_s_pre")


func test_a_stage_without_pre_battle_lines_is_reported() -> void:
	var folder: String = _pack("no_pre", {"story_order": ["s"]}, {
		"scenes": [{"stage_id": "s", "scene_id": "vn_s", "pre_battle_lines": [], "post_battle_lines": []}],
	})
	var index: StoryIndex = StoryIndex.load_dir(folder)
	assert_true(index.pre_battle_scene("s").is_empty())
	assert_string_contains(index.error, "has no pre_battle_lines")


func test_a_broken_pack_is_rejected_with_a_reason() -> void:
	var missing: StoryIndex = StoryIndex.load_dir(ROOT.path_join("nothing_here"))
	assert_string_contains(missing.load_error, "Unable to load")

	var undefined: StoryIndex = StoryIndex.load_dir(_pack("undefined", {"story_order": ["a", "ghost"]}, {
		"opening_scene": {"scene_id": "a", "lines": [{"text_en": "x"}]},
	}))
	assert_string_contains(undefined.load_error, "undefined scene/stage IDs")
	assert_string_contains(undefined.load_error, "ghost")

	var duplicate_stage: StoryIndex = StoryIndex.load_dir(_pack("dup_stage", {"story_order": ["s"]}, {
		"scenes": [
			{"stage_id": "s", "scene_id": "one", "pre_battle_lines": [{"text_en": "x"}]},
			{"stage_id": "s", "scene_id": "two", "pre_battle_lines": [{"text_en": "x"}]},
		],
	}))
	assert_string_contains(duplicate_stage.load_error, "Duplicate stage_id")

	var duplicate_scene: StoryIndex = StoryIndex.load_dir(_pack("dup_scene", {"story_order": ["a"]}, {
		"opening_scene": {"scene_id": "a", "lines": [{"text_en": "x"}]},
		"after_battle_scenes": [{"scene_id": "a", "lines": [{"text_en": "x"}]}],
	}))
	assert_string_contains(duplicate_scene.load_error, "Duplicate scene_id")

	var no_id: StoryIndex = StoryIndex.load_dir(_pack("no_id", {"story_order": ["a"]}, {
		"opening_scene": {"lines": [{"text_en": "x"}]},
	}))
	assert_string_contains(no_id.load_error, "missing scene_id")

	var empty_order: StoryIndex = StoryIndex.load_dir(_pack("empty_order", {"story_order": []}, {}))
	assert_string_contains(empty_order.load_error, "story_order")
