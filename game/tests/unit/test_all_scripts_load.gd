extends GutTest
## GUT silently skips a test file that fails to parse (it "does not extend GutTest") and still exits 0, so a
## script with a parse error, including any untyped declaration (an error by project setting), would pass CI.
## This test loads every project script explicitly, so such an error fails the run.

const ROOTS: Array[String] = ["res://scripts", "res://tests"]


func _collect(dir_path: String, into: Array[String]) -> void:
	for file_name: String in DirAccess.get_files_at(dir_path):
		if file_name.ends_with(".gd"):
			into.append(dir_path.path_join(file_name))
	for sub_dir: String in DirAccess.get_directories_at(dir_path):
		_collect(dir_path.path_join(sub_dir), into)


func test_every_project_script_parses() -> void:
	var paths: Array[String] = []
	for root: String in ROOTS:
		_collect(root, paths)
	assert_gt(paths.size(), 5, "the project has scripts to check")
	for path: String in paths:
		var script: Resource = ResourceLoader.load(path)
		assert_not_null(script, "%s loads (no parse error)" % path)
