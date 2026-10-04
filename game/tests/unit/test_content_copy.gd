extends GutTest
## The content copy under res://data/content is byte-identical to content/*.json (tools/sync_godot_content.py
## is the only writer): every file matches the sha256 in MANIFEST.json and parses to an object.

const CONTENT_DIR: String = "res://data/content"


func test_manifest_lists_the_shipped_files() -> void:
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(CONTENT_DIR + "/MANIFEST.json"))
	var files: Dictionary = manifest["files"]
	assert_gt(files.size(), 20, "the content packs are present")
	var on_disk: Array[String] = []
	for file_name: String in DirAccess.get_files_at(CONTENT_DIR):
		if file_name.ends_with(".json") and file_name != "MANIFEST.json":
			on_disk.append(file_name)
	on_disk.sort()
	var listed: Array[String] = []
	for file_name: String in files:
		listed.append(file_name)
	listed.sort()
	assert_eq(on_disk, listed, "no file is missing from, or extra to, the manifest")


func test_every_file_matches_its_sha256_and_parses() -> void:
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(CONTENT_DIR + "/MANIFEST.json"))
	var files: Dictionary = manifest["files"]
	for file_name: String in files:
		var path: String = CONTENT_DIR + "/" + file_name
		var entry: Dictionary = files[file_name]
		assert_eq(FileAccess.get_sha256(path), String(entry["sha256"]), file_name + " sha256")
		assert_eq(FileAccess.get_file_as_bytes(path).size(), int(entry["bytes"]), file_name + " size")
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		assert_true(parsed is Dictionary, file_name + " is a JSON object")
