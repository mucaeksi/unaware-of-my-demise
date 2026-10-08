extends GutTest
## G3.1: CpythonRandom reproduces parity/fixtures/rng.json (CPython random.Random) draw for draw.
## Seeds are decimal strings in the fixture (up to 2^96); they go through words_from_decimal -> init_by_array.

const _RANDOM_TOLERANCE: float = 1e-15

var _fixture: Dictionary = {}


func before_all() -> void:
	_fixture = ParityFixtures.load_fixture("rng")


func _cases() -> Array:
	return _fixture.get("cases", [])


func _rng_for(case: Dictionary) -> CpythonRandom:
	return CpythonRandom.create_from_words(CpythonRandom.words_from_decimal(String(case["seed"])))


func _int_array(values: Array) -> Array[int]:
	var result: Array[int] = []
	for value: Variant in values:
		result.append(ParityFixtures.to_int(value))
	return result


func test_fixture_is_present_and_covers_every_seed() -> void:
	assert_eq(String(_fixture.get("family", "")), "rng")
	assert_eq(_cases().size(), 11, "6 base seeds + 5 extra (negative, multi-word) seeds")


func test_words_from_decimal_matches_the_recorded_key_words() -> void:
	for case: Dictionary in _cases():
		var expected: Array[int] = _int_array(case["seed_abs_words"])
		var actual: PackedInt64Array = CpythonRandom.words_from_decimal(String(case["seed"]))
		assert_eq(Array(actual), expected, "abs(seed) words of seed " + String(case["seed"]))


func test_state_right_after_seeding() -> void:
	for case: Dictionary in _cases():
		var expected: Dictionary = case["state_after_seed"]
		var actual: Dictionary = _rng_for(case).state_summary()
		var label: String = "seed " + String(case["seed"])
		assert_eq(int(actual["index"]), int(expected["index"]), label + " index")
		assert_eq(actual["words_head"], _int_array(expected["words_head"]), label + " head")
		assert_eq(actual["words_tail"], _int_array(expected["words_tail"]), label + " tail")
		assert_eq(String(actual["words_sha256"]), String(expected["words_sha256"]), label + " state hash")


func test_random_matches_double_and_exact_numerator() -> void:
	for case: Dictionary in _cases():
		var rng: CpythonRandom = _rng_for(case)
		var draws: Array = case["random"]
		for position: int in range(draws.size()):
			var expected: Dictionary = draws[position]
			var numerator: int = rng.random_u53()
			var label: String = "seed %s random #%d" % [case["seed"], position]
			assert_eq(numerator, int(expected["u53"]), label + " numerator")
			assert_almost_eq(float(numerator) / 9007199254740992.0, float(expected["value"]), _RANDOM_TOLERANCE, label)


func test_getrandbits_every_width() -> void:
	for case: Dictionary in _cases():
		for entry: Dictionary in case["getrandbits"]:
			var bits: int = int(entry["bits"])
			var rng: CpythonRandom = _rng_for(case)
			var values: Array = entry["values"]
			var hexes: Array = entry["values_hex"]
			for position: int in range(values.size()):
				var label: String = "seed %s getrandbits(%d) #%d" % [case["seed"], bits, position]
				if bits <= 63:
					assert_eq(rng.getrandbits(bits), ParityFixtures.to_int(values[position]), label)
				else:
					assert_eq(rng.getrandbits_hex(bits), String(hexes[position]), label)


func test_getrandbits_words_equal_the_hex_form_for_small_widths_too() -> void:
	for case: Dictionary in _cases():
		for entry: Dictionary in case["getrandbits"]:
			var bits: int = int(entry["bits"])
			var rng: CpythonRandom = _rng_for(case)
			for hex: String in entry["values_hex"]:
				var label: String = "seed %s hex getrandbits(%d)" % [case["seed"], bits]
				assert_eq(rng.getrandbits_hex(bits), hex, label)


func test_randrange() -> void:
	for case: Dictionary in _cases():
		for entry: Dictionary in case["randrange"]:
			var args: Array[int] = _int_array(entry["args"])
			var rng: CpythonRandom = _rng_for(case)
			var expected: Array[int] = _int_array(entry["values"])
			for position: int in range(expected.size()):
				var actual: int
				match args.size():
					1:
						actual = rng.randrange(0, args[0])
					2:
						actual = rng.randrange(args[0], args[1])
					_:
						actual = rng.randrange(args[0], args[1], args[2])
				assert_eq(actual, expected[position], "seed %s randrange%s #%d" % [case["seed"], args, position])


func test_randint() -> void:
	for case: Dictionary in _cases():
		for entry: Dictionary in case["randint"]:
			var args: Array[int] = _int_array(entry["args"])
			var rng: CpythonRandom = _rng_for(case)
			var expected: Array[int] = _int_array(entry["values"])
			for position: int in range(expected.size()):
				assert_eq(rng.randint(args[0], args[1]), expected[position],
					"seed %s randint%s #%d" % [case["seed"], args, position])


func test_choice_picks_the_same_index() -> void:
	for case: Dictionary in _cases():
		for entry: Dictionary in case["choice"]:
			var length: int = int(entry["length"])
			var rng: CpythonRandom = _rng_for(case)
			var expected: Array[int] = _int_array(entry["values"])
			var items: Array = range(length)
			for position: int in range(expected.size()):
				assert_eq(int(rng.choice(items)), expected[position],
					"seed %s choice(%d) #%d" % [case["seed"], length, position])


func test_shuffle_twice_from_one_stream() -> void:
	for case: Dictionary in _cases():
		for entry: Dictionary in case["shuffle"]:
			var length: int = int(entry["length"])
			var rng: CpythonRandom = _rng_for(case)
			var first: Array = range(length)
			rng.shuffle(first)
			var second: Array = range(length)
			rng.shuffle(second)
			var label: String = "seed %s shuffle(%d)" % [case["seed"], length]
			assert_eq(first, Array(_int_array(entry["first"])), label + " first")
			assert_eq(second, Array(_int_array(entry["second"])), label + " second")


func test_mixed_call_script_keeps_the_shared_state_in_step() -> void:
	for case: Dictionary in _cases():
		var rng: CpythonRandom = _rng_for(case)
		var step: int = 0
		for entry: Dictionary in case["script"]:
			var args: Array[int] = _int_array(entry["args"])
			var label: String = "seed %s script step %d (%s)" % [case["seed"], step, entry["op"]]
			match String(entry["op"]):
				"random":
					assert_almost_eq(rng.random(), float(entry["value"]), _RANDOM_TOLERANCE, label)
				"getrandbits":
					if args[0] <= 63:
						assert_eq(rng.getrandbits(args[0]), ParityFixtures.to_int(entry["value"]), label)
					else:
						rng.getrandbits_words(args[0])
				"randrange":
					var picked: int = rng.randrange(0, args[0]) if args.size() == 1 else rng.randrange(args[0], args[1], args[2])
					assert_eq(picked, ParityFixtures.to_int(entry["value"]), label)
				"randint":
					assert_eq(rng.randint(args[0], args[1]), ParityFixtures.to_int(entry["value"]), label)
				"choice":
					assert_eq(rng.choice_index(args[0]), ParityFixtures.to_int(entry["value"]), label)
				"shuffle":
					var items: Array = range(args[0])
					rng.shuffle(items)
					assert_eq(items, Array(_int_array(entry["value"])), label)
				_:
					fail_test("unknown script op " + String(entry["op"]))
			step += 1


func test_seed_helpers_agree_for_values_that_fit_63_bits() -> void:
	var by_int: CpythonRandom = CpythonRandom.create_from_int(123456789012345678)
	var by_words: CpythonRandom = CpythonRandom.create_from_words(CpythonRandom.words_from_decimal("123456789012345678"))
	var by_u64: CpythonRandom = CpythonRandom.create_from_u64(123456789012345678)
	for _draw: int in range(20):
		var value: int = by_int.next_u32()
		assert_eq(by_words.next_u32(), value)
		assert_eq(by_u64.next_u32(), value)


func test_seed_u64_reads_the_top_bit_as_unsigned() -> void:
	# 2^64 - 1 as an int is -1; Python seeds with the unsigned number 18446744073709551615.
	var unsigned: CpythonRandom = CpythonRandom.create_from_u64(-1)
	var words: CpythonRandom = CpythonRandom.create_from_words(CpythonRandom.words_from_decimal("18446744073709551615"))
	for _draw: int in range(20):
		assert_eq(unsigned.next_u32(), words.next_u32())
