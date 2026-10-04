class_name ParityFixtures
extends RefCounted
## Loads the golden fixtures the Python reference wrote to <repo>/parity/fixtures (see parity/README.md).
## Tests only: the fixtures live outside the Godot project, so this reads them from the file system (desktop/CI).
##
## Encoding rules (parity/README.md): integers above 2^53 are decimal strings, non-integer stat values are
## exact decimal strings, and JSON numbers must never be trusted to be int or float (Godot 4.7 parses all as float).
## Convert every field by its schema with the helpers below.


static func fixtures_dir() -> String:
	return ProjectSettings.globalize_path("res://").path_join("../parity/fixtures").simplify_path()


static func exists(fixture_name: String) -> bool:
	return FileAccess.file_exists(fixtures_dir().path_join(fixture_name + ".json"))


## The parsed fixture object (`{"family", "schema_version", "description", "cases": [...] ...}`); empty if missing.
static func load_fixture(fixture_name: String) -> Dictionary:
	var path: String = fixtures_dir().path_join(fixture_name + ".json")
	if not FileAccess.file_exists(path):
		push_error("parity fixture not found: " + path)
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (parsed is Dictionary):
		push_error("parity fixture is not a JSON object: " + path)
		return {}
	return parsed


## A JSON number that is an integer <= 2^53, or a decimal string that fits a signed 64-bit int, as an int.
static func to_int(value: Variant) -> int:
	if value is String:
		return (value as String).to_int()
	return int(value)


## Whether `value` is an integral JSON number/decimal string (used to fail loudly on a schema drift).
static func is_integral(value: Variant) -> bool:
	if value is String:
		return (value as String).is_valid_int()
	if value is float:
		return is_equal_approx(value, roundf(value))
	return value is int
