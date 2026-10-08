extends GutTest
## Dec: the exact-decimal subset of Python's Decimal the stat maths relies on.


func test_parse_and_text_keep_the_scale() -> void:
	assert_eq(Dec.parse("3.10").to_text(), "3.10")
	assert_eq(Dec.parse("-0.05").to_text(), "-0.05")
	assert_eq(Dec.parse("12").to_text(), "12")
	assert_eq(Dec.parse("0.000").to_text(), "0.000")
	assert_null(Dec.parse("1.2.3"))
	assert_null(Dec.parse("abc"))
	assert_null(Dec.parse(""))


func test_addition_keeps_the_larger_scale_and_multiplication_adds_scales() -> void:
	assert_eq(Dec.parse("1.5").add(Dec.parse("1.50")).to_text(), "3.00")
	assert_eq(Dec.parse("0.05").mul(Dec.parse("3")).to_text(), "0.15")
	assert_eq(Dec.parse("1.5").mul(Dec.parse("1.5")).to_text(), "2.25")
	assert_eq(Dec.parse("2").sub(Dec.parse("0.25")).to_text(), "1.75")


func test_comparison_ignores_the_scale() -> void:
	assert_true(Dec.parse("3.10").equals(Dec.parse("3.1")))
	assert_true(Dec.parse("0.3").greater_than(Dec.parse("0.25")))
	assert_eq(Dec.parse("-1").compare(Dec.parse("1")), -1)


func test_half_up_rounds_ties_away_from_zero() -> void:
	assert_eq(Dec.parse("0.5").round_half_up(), 1)
	assert_eq(Dec.parse("1.5").round_half_up(), 2)
	assert_eq(Dec.parse("2.5").round_half_up(), 3, "Python's default (half even) would give 2")
	assert_eq(Dec.parse("2.4999").round_half_up(), 2)
	assert_eq(Dec.parse("-0.5").round_half_up(), -1)
	assert_eq(Dec.parse("-2.5").round_half_up(), -3)
	assert_eq(Dec.parse("0.085").mul(Dec.parse("100")).round_half_up(), 9)
	assert_eq(Dec.parse("7").round_half_up(), 7)


func test_from_float_recovers_the_authored_decimal() -> void:
	# What Decimal(str(value)) sees: the shortest decimal that round-trips the double.
	assert_eq(Dec.from_float(0.05).to_text(), "0.05")
	assert_eq(Dec.from_float(0.1).to_text(), "0.1")
	assert_eq(Dec.from_float(2.75).to_text(), "2.75")
	assert_eq(Dec.from_float(40.0).to_text(), "40")
	assert_eq(Dec.from_float(-3.5).to_text(), "-3.5")


func test_from_float_is_not_fooled_by_binary_noise_on_a_tie() -> void:
	# 0.1 + 0.2 is 0.30000000000000004 as a double; the stat maths never feeds that in, but the values that are
	# authored with two decimals (x.xx5 products of float multiplies) must land exactly.
	var growth: float = 1.1
	var scaled: float = growth * 2.5  # 2.75 exactly representable? either way the shortest form is 2.75
	assert_eq(Dec.from_float(scaled).to_text(), "2.75")


func test_to_float_is_correctly_rounded() -> void:
	assert_eq(Dec.parse("1.1").to_float(), 1.1)
	assert_eq(Dec.parse("0.05").to_float(), 0.05)
	assert_eq(Dec.parse("12").to_float(), 12.0)
	assert_eq(Dec.parse("1.30").to_float(), 1.3)


func test_quantize_half_up_keeps_exactly_the_requested_decimals() -> void:
	assert_eq(Dec.parse("0.085").quantize_half_up(2).to_text(), "0.09", "0.06 + 0.05 * 0.5 must become 0.09")
	assert_eq(Dec.parse("0.084999").quantize_half_up(2).to_text(), "0.08")
	assert_eq(Dec.parse("1.5").quantize_half_up(2).to_text(), "1.50")
	assert_eq(Dec.parse("0.005").quantize_half_up(2).to_text(), "0.01")
	assert_eq(Dec.parse("-0.005").quantize_half_up(2).to_text(), "-0.01")
	assert_eq(Dec.parse("0.994999999999999999999").quantize_half_up(2).to_text(), "0.99")
	assert_eq(Dec.parse("0.995").quantize_half_up(2).to_text(), "1.00")
