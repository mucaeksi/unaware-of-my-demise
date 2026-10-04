extends GutTest
## G3.1: Crc32 equals zlib.crc32 for every case in parity/fixtures/crc32.json (incl. all story-loan seed strings).


func test_every_recorded_case() -> void:
	var fixture: Dictionary = ParityFixtures.load_fixture("crc32")
	var cases: Array = fixture.get("cases", [])
	assert_gt(cases.size(), 100, "the fixture is present")
	for case: Dictionary in cases:
		var data: PackedByteArray = String(case["input_hex"]).hex_decode()
		assert_eq(Crc32.of_bytes(data), int(case["crc32"]), "crc32 of " + String(case["input_hex"]).left(40))


func test_known_check_value() -> void:
	# The standard CRC-32 check value.
	assert_eq(Crc32.of_text("123456789"), 0xCBF43926)
	assert_eq(Crc32.of_text(""), 0)


func test_continuation_equals_one_pass() -> void:
	var whole: int = Crc32.of_text("hello world")
	var first: int = Crc32.of_text("hello ")
	assert_eq(Crc32.of_bytes("world".to_utf8_buffer(), first), whole)
