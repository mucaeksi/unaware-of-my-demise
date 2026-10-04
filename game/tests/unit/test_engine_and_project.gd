extends GutTest
## The pinned engine version and the project settings the brief fixes (2.1, 2.2, 2.3, G2.2).


func test_engine_is_the_pinned_version() -> void:
	var pinned: String = FileAccess.get_file_as_string("res://GODOT_VERSION").strip_edges()
	var parts: PackedStringArray = pinned.split("-")
	var numbers: PackedStringArray = parts[0].split(".")
	var info: Dictionary = Engine.get_version_info()
	assert_eq(int(info["major"]), int(numbers[0]), "major version matches res://GODOT_VERSION")
	assert_eq(int(info["minor"]), int(numbers[1]), "minor version matches res://GODOT_VERSION")
	if numbers.size() > 2:
		assert_eq(int(info["patch"]), int(numbers[2]), "patch version matches res://GODOT_VERSION")
	assert_eq(String(info["status"]), parts[1], "release status matches res://GODOT_VERSION")


func test_reference_canvas_is_portrait_1080_by_1920() -> void:
	assert_eq(int(ProjectSettings.get_setting("display/window/size/viewport_width")), 1080)
	assert_eq(int(ProjectSettings.get_setting("display/window/size/viewport_height")), 1920)
	assert_eq(String(ProjectSettings.get_setting("display/window/stretch/mode")), "canvas_items")
	assert_eq(String(ProjectSettings.get_setting("display/window/stretch/aspect")), "expand")
	# 1 = DisplayServer.SCREEN_PORTRAIT
	assert_eq(int(ProjectSettings.get_setting("display/window/handheld/orientation")), 1)


func test_compatibility_renderer_is_the_default() -> void:
	assert_eq(String(ProjectSettings.get_setting("rendering/renderer/rendering_method")), "gl_compatibility")
	assert_eq(String(ProjectSettings.get_setting("rendering/renderer/rendering_method.mobile")), "gl_compatibility")


func test_untyped_declarations_are_errors() -> void:
	# 2 = error
	assert_eq(int(ProjectSettings.get_setting("debug/gdscript/warnings/untyped_declaration")), 2)


func test_autoloads_exist() -> void:
	for autoload_name: String in ["Game", "Online", "Native"]:
		assert_not_null(get_node_or_null("/root/" + autoload_name), autoload_name + " autoload is registered")


func test_game_reports_engine_info() -> void:
	var info: Dictionary = Game.engine_info()
	assert_true(String(info["godot"]).begins_with("4."), "godot version string")
	assert_eq(String(info["renderer"]), "gl_compatibility")


func test_native_plugin_is_absent_off_device() -> void:
	assert_false(Native.is_available(), "UomdNative exists only in Android builds")
