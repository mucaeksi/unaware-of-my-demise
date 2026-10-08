@warning_ignore_start("integer_division")
class_name FloatRepr
extends RefCounted
## The shortest decimal that round-trips a double, exactly what Python's `repr(float)` (David Gay, mode 0) returns,
## as a Dec. Needed because the reference feeds `Decimal(str(x))` with products such as 0.3 * 1.5, whose repr is
## 0.44999999999999996: the 17th digit decides a half-up tie.
##
## Exact method with big integers: for v = m * 2^e (e < 0) the value and the two rounding-interval bounds are
## integers over 10^t (t = -e + 2), namely 4m*5^t, (4m+2)*5^t and (4m-2 or 4m-1)*5^t. The shortest p-digit decimal
## inside the interval (bounds included when m is even, IEEE round-half-even) wins; when both neighbours of length p
## qualify, the one nearer to v does.

const _FIVE_POW_13: int = 1220703125


static func shortest(value: float) -> Dec:
	if value == 0.0:
		return Dec.from_int(0)
	var is_negative: bool = value < 0.0
	var bytes: PackedByteArray = PackedByteArray()
	bytes.resize(8)
	bytes.encode_double(0, absf(value))
	var bits: int = bytes.decode_u64(0)
	var exponent_bits: int = (bits >> 52) & 0x7FF
	var fraction: int = bits & 0xFFFFFFFFFFFFF
	var mantissa: int = fraction if exponent_bits == 0 else (fraction | (1 << 52))
	var exponent: int = -1074 if exponent_bits == 0 else exponent_bits - 1075
	if exponent >= 0:
		# An integer above 2^52: the exact integer is the value (repr digits beyond 17 are not needed by the game).
		var whole: PackedInt64Array = BigNat.from_int(mantissa)
		for _step: int in range(exponent):
			whole = BigNat.mul_small(whole, 2)
		return Dec.from_parts(is_negative, whole, 0)

	var places: int = -exponent + 2
	var five_power: PackedInt64Array = _five_pow(places)
	var lower_offset: int = 1 if (mantissa == (1 << 52) and exponent_bits > 1) else 2
	var exact: PackedInt64Array = BigNat.mul(BigNat.from_int(4 * mantissa), five_power)
	var upper: PackedInt64Array = BigNat.mul(BigNat.from_int(4 * mantissa + 2), five_power)
	var lower: PackedInt64Array = BigNat.mul(BigNat.from_int(4 * mantissa - lower_offset), five_power)
	var inclusive: bool = (mantissa & 1) == 0
	var text: String = BigNat.to_text(exact)

	for significant: int in range(1, 18):
		var dropped: int = text.length() - significant
		if dropped <= 0:
			return _result(is_negative, exact, places)
		var head: PackedInt64Array = BigNat.from_text(text.substr(0, significant))
		var tail_is_zero: bool = text.substr(significant).lstrip("0").is_empty()
		var floor_scaled: PackedInt64Array = BigNat.shift10(head, dropped)
		if tail_is_zero:
			return _result(is_negative, head, places - dropped)
		var head_up: PackedInt64Array = BigNat.add(head, BigNat.from_int(1))
		var ceil_scaled: PackedInt64Array = BigNat.shift10(head_up, dropped)
		var floor_ok: bool = _inside(floor_scaled, lower, upper, inclusive)
		var ceil_ok: bool = _inside(ceil_scaled, lower, upper, inclusive)
		if floor_ok and ceil_ok:
			var down: PackedInt64Array = BigNat.sub(exact, floor_scaled)
			var up: PackedInt64Array = BigNat.sub(ceil_scaled, exact)
			var order: int = BigNat.compare(down, up)
			var pick_floor: bool = order < 0 or (order == 0 and (head[0] % 2) == 0)
			return _result(is_negative, head if pick_floor else head_up, places - dropped)
		if floor_ok:
			return _result(is_negative, head, places - dropped)
		if ceil_ok:
			return _result(is_negative, head_up, places - dropped)
	push_error("FloatRepr.shortest: no representation found for %s" % str(value))
	return Dec.from_int(0)


static func _inside(candidate: PackedInt64Array, lower: PackedInt64Array, upper: PackedInt64Array, inclusive: bool) -> bool:
	var against_lower: int = BigNat.compare(candidate, lower)
	var against_upper: int = BigNat.compare(candidate, upper)
	if inclusive:
		return against_lower >= 0 and against_upper <= 0
	return against_lower > 0 and against_upper < 0


static func _five_pow(exponent: int) -> PackedInt64Array:
	var result: PackedInt64Array = BigNat.from_int(1)
	var remaining: int = exponent
	while remaining >= 13:
		result = BigNat.mul_small(result, _FIVE_POW_13)
		remaining -= 13
	var factor: int = 1
	for _step: int in range(remaining):
		factor *= 5
	return BigNat.mul_small(result, factor)


## Digits/scale as a Dec without trailing zeros in the digits and a non-negative scale.
static func _result(is_negative: bool, digits: PackedInt64Array, scale_value: int) -> Dec:
	var number: PackedInt64Array = digits
	var places: int = scale_value
	while places > 0:
		var parts: Array = BigNat.divmod_small(number, 10)
		if int(parts[1]) != 0:
			break
		number = parts[0]
		places -= 1
	if places < 0:
		number = BigNat.shift10(number, -places)
		places = 0
	return Dec.from_parts(is_negative, number, places)
