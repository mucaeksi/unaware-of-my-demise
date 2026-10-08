extends GutTest
## INF-040: the licenses screen covers everything the app ships: the engine and its components, and every Android
## library the UomdNative build declares (the committed notices file must list each one with a license). Libraries are
## matched by group and name: Gradle may resolve a newer version than one declaration asks for, and the file lists the
## version that ships.


func test_every_declared_android_library_is_in_the_notices_with_a_license() -> void:
	var gradle: String = FileAccess.get_file_as_string("res://android/plugins/uomd_native/build.gradle")
	var declared: Array[String] = []
	for found: RegExMatch in RegEx.create_from_string("(?:implementation|runtimeOnly) \"([^\"]+)\"").search_all(gradle):
		declared.append(":".join(found.get_string(1).split(":").slice(0, 2)))
	assert_gt(declared.size(), 5)
	var listed: Dictionary = {}
	for library: Dictionary in ThirdPartyNotices.android_libraries():
		listed["%s:%s" % [library["group"], library["name"]]] = library
	for coordinates: String in declared:
		assert_true(listed.has(coordinates), "%s is missing from data/legal/android_libraries.json (run tools/build_uomd_native.sh)" % coordinates)
	for library: Dictionary in listed.values():
		assert_false((library["licenses"] as Array).is_empty(), "%s has no license" % library["name"])


func test_the_notice_names_the_engine_its_components_and_the_libraries() -> void:
	var text: String = ThirdPartyNotices.text()
	assert_string_contains(text, Engine.get_license_text())
	var components: Array[Dictionary] = Engine.get_copyright_info()
	assert_gt(components.size(), 0)
	assert_string_contains(text, str(components[0]["name"]))
	assert_string_contains(text, "com.android.billingclient:billing 9.1.0")
	assert_string_contains(text, "Version 2.0, January 2004", "the Apache License text itself")
	var licenses: Dictionary = Engine.get_license_info()
	assert_string_contains(text, "== %s ==" % str(licenses.keys()[0]))


func test_a_missing_notices_file_lists_no_libraries() -> void:
	assert_eq(ThirdPartyNotices.android_libraries("res://no/such/file.json"), [])


func test_the_licenses_screen_shows_the_text() -> void:
	var screen: LicensesScreen = add_child_autofree(LicensesScreen.new())
	watch_signals(screen)
	screen.load_text("Godot Engine\nMIT")
	assert_eq(screen.shown_text(), "Godot Engine\nMIT")
