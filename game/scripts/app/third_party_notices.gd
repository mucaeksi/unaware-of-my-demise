class_name ThirdPartyNotices
extends RefCounted
## The licenses of everything the app ships (INF-040), shown under Settings -> Licenses. The engine reports its own
## license and every component built into it (Engine.get_license_text / get_copyright_info / get_license_info); the
## Android libraries come from data/legal/android_libraries.json, generated from their Maven POMs by the UomdNative
## plugin build (tools/build_uomd_native.sh fails when it is stale), with the Apache License 2.0 text most of them use.

const ANDROID_LIBRARIES: String = "res://data/legal/android_libraries.json"
const APACHE_TEXT: String = "res://data/legal/apache-2.0.txt"


## The Android libraries: [{"group", "name", "version", "licenses": [{"name", "url"}]}] ([] when the file is missing).
static func android_libraries(path: String = ANDROID_LIBRARIES) -> Array:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path)) if FileAccess.file_exists(path) else null
	return (parsed as Dictionary).get("libraries", []) if parsed is Dictionary and (parsed as Dictionary).get("libraries") is Array else []


## The whole notice, in reading order: the engine, its components, the Android libraries, then the license texts.
static func text() -> String:
	var out: PackedStringArray = PackedStringArray()
	out.append("Unaware of My Demise is built with the Godot Engine and the libraries below.")
	out.append("\n== Godot Engine ==\n%s" % Engine.get_license_text())
	out.append("\n== Components of the Godot Engine ==")
	for component: Dictionary in Engine.get_copyright_info():
		var licenses: PackedStringArray = PackedStringArray()
		var holders: PackedStringArray = PackedStringArray()
		for part: Dictionary in component.get("parts", []):
			if not licenses.has(str(part.get("license", ""))):
				licenses.append(str(part.get("license", "")))
			for holder: String in part.get("copyright", PackedStringArray()):
				holders.append("(c) %s" % holder)
		out.append("%s — %s\n  %s" % [str(component.get("name", "")), ", ".join(licenses), "\n  ".join(holders)])
	out.append("\n== Android libraries ==")
	for library: Variant in android_libraries():
		if not (library is Dictionary):
			continue
		var names: PackedStringArray = PackedStringArray()
		for license: Variant in (library as Dictionary).get("licenses", []):
			if license is Dictionary:
				names.append("%s <%s>" % [str((license as Dictionary).get("name", "")), str((license as Dictionary).get("url", ""))])
		out.append("%s:%s %s — %s" % [str(library.get("group", "")), str(library.get("name", "")), str(library.get("version", "")), "; ".join(names)])
	out.append("\n== Apache License 2.0 ==\n%s" % FileAccess.get_file_as_string(APACHE_TEXT))
	var texts: Dictionary = Engine.get_license_info()
	var names_sorted: Array = texts.keys()
	names_sorted.sort()
	for name: Variant in names_sorted:
		out.append("\n== %s ==\n%s" % [str(name), str(texts[name])])
	return "\n".join(out)
