extends GutTest
## G3.3: Dec.from_float returns exactly `Decimal(repr(x))` (parity/fixtures/float_repr.json): the shortest decimal
## that round-trips the double, including the 17-digit binary artifacts (0.3 * 1.5 = 0.44999999999999996).


func _double_from_bits(hex: String) -> float:
	var high: int = hex.substr(0, 8).hex_to_int()
	var low: int = hex.substr(8, 8).hex_to_int()
	var bytes: PackedByteArray = PackedByteArray()
	bytes.resize(8)
	bytes.encode_u64(0, (high << 32) | low)
	return bytes.decode_double(0)


func test_every_recorded_double() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("float_repr")
	var cases: Array = fixture["cases"]
	assert_gt(cases.size(), 2000, "the fixture is present")
	var failures: int = 0
	for case: Dictionary in cases:
		var value: float = _double_from_bits(String(case["bits"]))
		var actual: Dec = Dec.from_float(value)
		var expected: Dec = Dec.parse(String(case["decimal"]))
		if not actual.equals(expected):
			failures += 1
			if failures <= 5:
				fail_test("%s (%s): expected %s, got %s" % [case["bits"], str(value), case["decimal"], actual.to_text()])
	assert_eq(failures, 0, "doubles whose shortest repr differs")


func test_the_binary_artifact_that_decides_a_tie() -> void:
	# 0.3 * 1.5 is 0.44999999999999996 as a double: repr keeps 17 digits, so a half-up tie test sees "just below 0.5".
	var product: float = 0.3 * 1.5
	assert_eq(Dec.from_float(product).to_text(), "0.44999999999999996")
	var scaled: Dec = Dec.from_float(product).mul_int(100)
	assert_eq(scaled.round_half_up(), 45, "0.44999999999999996 * 100 = 44.999999999999996 rounds to 45")
	# Just below the tie: 0.44999999999999996 + 0.05 = 0.49999999999999996 rounds down; the exact tie 0.45 + 0.05 rounds up.
	assert_eq(Dec.from_float(product).add(Dec.parse("0.05")).round_half_up(), 0)
	assert_eq(Dec.parse("0.45").add(Dec.parse("0.05")).round_half_up(), 1)
