class_name ParityCompare
extends RefCounted
## Deep comparison of a GDScript value (records, arrays, dictionaries) against parsed fixture JSON.
## `diff()` returns "" when equal, otherwise the field path of the first difference.
##
## Rules (parity/README.md): numbers compare by value (Godot parses every JSON number as float), strings and
## bools exactly, arrays element by element, dictionaries key by key. Script objects are compared through their
## script variables; at that record level a null in the fixture equals an empty String (the port's "absent
## string"), everywhere else (extra maps, effect parameters, stat blocks) null/"" stay distinct.


static func diff(actual: Variant, expected: Variant, path: String = "$") -> String:
	return _diff(actual, expected, path, false)


static func _diff(actual: Variant, expected: Variant, path: String, record_field: bool) -> String:
	if expected == null:
		if actual == null:
			return ""
		if record_field and actual is String and (actual as String).is_empty():
			return ""
		return "%s: expected null, got %s" % [path, _show(actual)]
	if expected is bool:
		if actual is bool and actual == expected:
			return ""
		return "%s: expected %s, got %s" % [path, _show(expected), _show(actual)]
	if expected is float or expected is int:
		if (actual is float or actual is int) and float(actual) == float(expected):
			return ""
		return "%s: expected %s, got %s" % [path, _show(expected), _show(actual)]
	if expected is String:
		if actual is String and actual == expected:
			return ""
		return "%s: expected %s, got %s" % [path, _show(expected), _show(actual)]
	if expected is Array:
		if not (actual is Array):
			return "%s: expected an array, got %s" % [path, _show(actual)]
		var actual_items: Array = actual
		var expected_items: Array = expected
		if actual_items.size() != expected_items.size():
			return "%s: expected %d items, got %d" % [path, expected_items.size(), actual_items.size()]
		for index: int in range(expected_items.size()):
			var found: String = _diff(actual_items[index], expected_items[index], "%s[%d]" % [path, index], false)
			if not found.is_empty():
				return found
		return ""
	if expected is Dictionary:
		var expected_map: Dictionary = expected
		if actual is Dictionary:
			return _diff_map(actual, expected_map, path)
		if actual is Object:
			return _diff_object(actual, expected_map, path)
		return "%s: expected an object, got %s" % [path, _show(actual)]
	return "%s: unsupported fixture value %s" % [path, _show(expected)]


static func _diff_map(actual: Dictionary, expected: Dictionary, path: String) -> String:
	for key: Variant in expected:
		if not actual.has(key):
			return "%s: missing key %s" % [path, str(key)]
	for key: Variant in actual:
		if not expected.has(key):
			return "%s: unexpected key %s" % [path, str(key)]
	for key: Variant in expected:
		var found: String = _diff(actual[key], expected[key], "%s.%s" % [path, str(key)], false)
		if not found.is_empty():
			return found
	return ""


static func _diff_object(actual: Object, expected: Dictionary, path: String) -> String:
	var names: Array[String] = script_variables(actual)
	for key: Variant in expected:
		if not names.has(String(key)):
			return "%s: fixture has field %s the port does not" % [path, str(key)]
	for name: String in names:
		if not expected.has(name):
			return "%s: the port has field %s the fixture does not" % [path, name]
	for name: String in names:
		var found: String = _diff(actual.get(name), expected[name], "%s.%s" % [path, name], true)
		if not found.is_empty():
			return found
	return ""


## Names of the variables declared in the object's script (its data fields).
static func script_variables(object: Object) -> Array[String]:
	var names: Array[String] = []
	for property: Dictionary in object.get_property_list():
		if (int(property["usage"]) & PROPERTY_USAGE_SCRIPT_VARIABLE) != 0:
			names.append(String(property["name"]))
	return names


static func _show(value: Variant) -> String:
	var text: String = var_to_str(value) if not (value is Object) else "<%s>" % value.get_class()
	if text.length() > 90:
		return text.left(90) + "..."
	return text
