extends GutTest
## Pins how the pinned Godot version parses and writes JSON numbers (brief 2.5). The content loader must not
## rely on int vs float from the parser: it converts every field by its schema. If a Godot upgrade changes
## any of this, this test fails and the upgrade PR has to look at the loader.


func test_every_json_number_parses_as_float() -> void:
	var parsed: Dictionary = JSON.parse_string('{"i": 1, "f": 1.0, "neg": -5, "zero": 0, "e": 1e3}')
	for key: String in parsed:
		assert_eq(typeof(parsed[key]), TYPE_FLOAT, key + " is a float even when written as an integer")
	assert_eq(typeof(JSON.parse_string("7")), TYPE_FLOAT)


func test_integers_beyond_2_to_the_53_lose_precision() -> void:
	# Why the parity fixtures carry such values as decimal strings.
	var parsed: Dictionary = JSON.parse_string('{"big": 9007199254740993, "huge": 123456789012345678}')
	assert_eq(int(parsed["big"]), 9007199254740992)
	assert_ne(int(parsed["huge"]), 123456789012345678)


func test_doubles_survive_a_parse() -> void:
	var value: float = JSON.parse_string("0.8444218515250481")
	assert_eq(value, 0.8444218515250481, "a 17-digit double parses to the same double")


func test_stringify_is_not_round_trip_exact_for_doubles() -> void:
	# JSON.stringify writes about 14 significant digits by default: never use it where an exact double matters.
	assert_eq(JSON.stringify(0.1 + 0.2), "0.3")
	assert_eq(JSON.stringify(1.0), "1.0")
	assert_eq(JSON.stringify(3), "3")
