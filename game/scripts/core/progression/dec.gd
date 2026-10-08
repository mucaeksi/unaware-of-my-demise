@warning_ignore_start("integer_division")
class_name Dec
extends RefCounted
## Exact decimal number: `sign * magnitude / 10^scale` with an arbitrary-size magnitude (BigNat), the subset of
## Python's `decimal.Decimal` the game uses.
##
## The reference resolves stats with `Decimal(str(value))` and rounds half up (ROUND_HALF_UP = ties away from zero)
## at the end, so binary floats must never decide a tie. Scale rules match Decimal: addition keeps the larger scale,
## multiplication adds the scales (exact, no rounding), so `Dec.parse("1.5").add(Dec.parse("1.50"))` is 3.00.
## Python's default context keeps 28 significant digits; every value the game builds has far fewer, so no rounding
## step is emulated.

const _FLOAT_POW10: Array[float] = [
	1.0, 10.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, 10000000.0, 100000000.0, 1000000000.0, 10000000000.0,
	100000000000.0, 1000000000000.0, 10000000000000.0, 100000000000000.0, 1000000000000000.0,
]

var negative: bool = false
var magnitude: PackedInt64Array = PackedInt64Array()
var scale: int = 0


static func from_parts(is_negative: bool, digits: PackedInt64Array, scale_value: int) -> Dec:
	var result: Dec = Dec.new()
	result.magnitude = digits
	result.negative = is_negative and not digits.is_empty()
	result.scale = scale_value
	return result


static func of(unscaled_value: int, scale_value: int = 0) -> Dec:
	return from_parts(unscaled_value < 0, BigNat.from_int(absi(unscaled_value)), scale_value)


static func from_int(value: int) -> Dec:
	return of(value, 0)


## `Decimal(str(value))` for a double: the shortest decimal that round-trips it (what Python's `repr(float)` prints).
## Whole floats such as 40.0 become 40 (same value; Decimal("40.0") only differs in scale).
static func from_float(value: float) -> Dec:
	if not is_finite(value):
		push_error("Dec.from_float: value must be finite")
		return of(0, 0)
	# Fast path: the smallest number of decimals whose exact decimal-to-double conversion is `value`.
	for digits: int in range(0, _FLOAT_POW10.size()):
		var factor: float = _FLOAT_POW10[digits]
		var candidate: float = roundf(value * factor)
		if absf(candidate) < 9007199254740992.0 and candidate / factor == value:
			return of(int(candidate), digits)
	return FloatRepr.shortest(value)


## A JSON int/float as Dec (null for anything else, so callers can reject non-numbers like the reference does).
static func from_variant(value: Variant) -> Dec:
	if value is Dec:
		return value
	if value is int:
		return from_int(value)
	if value is float:
		return from_float(value)
	return null


## Parses "12", "-0.05", "3.10" exactly (null on anything else).
static func parse(text: String) -> Dec:
	var body: String = text.strip_edges()
	var is_negative: bool = false
	if body.begins_with("-"):
		is_negative = true
		body = body.substr(1)
	elif body.begins_with("+"):
		body = body.substr(1)
	if body.is_empty():
		return null
	var parts: PackedStringArray = body.split(".")
	if parts.size() > 2:
		return null
	var whole: String = parts[0]
	var fraction: String = parts[1] if parts.size() == 2 else ""
	if whole.is_empty() and fraction.is_empty():
		return null
	for character: String in whole + fraction:
		if character < "0" or character > "9":
			return null
	return from_parts(is_negative, BigNat.from_text(whole + fraction), fraction.length())


# -- arithmetic ------------------------------------------------------------------------------------


func _magnitude_at(target_scale: int) -> PackedInt64Array:
	return BigNat.shift10(magnitude, target_scale - scale)


func add(other: Dec) -> Dec:
	var target: int = maxi(scale, other.scale)
	var left: PackedInt64Array = _magnitude_at(target)
	var right: PackedInt64Array = other._magnitude_at(target)
	if negative == other.negative:
		return from_parts(negative, BigNat.add(left, right), target)
	var order: int = BigNat.compare(left, right)
	if order == 0:
		return from_parts(false, BigNat.zero(), target)
	if order > 0:
		return from_parts(negative, BigNat.sub(left, right), target)
	return from_parts(other.negative, BigNat.sub(right, left), target)


func sub(other: Dec) -> Dec:
	return add(other.neg())


func neg() -> Dec:
	return from_parts(not negative, magnitude, scale)


func mul(other: Dec) -> Dec:
	return from_parts(negative != other.negative, BigNat.mul(magnitude, other.magnitude), scale + other.scale)


func mul_int(factor: int) -> Dec:
	return mul(of(factor, 0))


# -- comparison and conversion ---------------------------------------------------------------------


## Numeric comparison (scale-independent): -1, 0 or 1.
func compare(other: Dec) -> int:
	if negative != other.negative:
		return -1 if negative else 1
	var target: int = maxi(scale, other.scale)
	var order: int = BigNat.compare(_magnitude_at(target), other._magnitude_at(target))
	return -order if negative else order


func equals(other: Dec) -> bool:
	return compare(other) == 0


func is_zero() -> bool:
	return magnitude.is_empty()


func greater_than(other: Dec) -> bool:
	return compare(other) > 0


## `int(value)` for a Decimal: the integer part, truncating toward zero.
func to_int_truncated() -> int:
	var whole: PackedInt64Array = magnitude
	if scale > 0:
		whole = (BigNat.divmod10(magnitude, scale))[0]
	elif scale < 0:
		whole = BigNat.shift10(magnitude, -scale)
	var value: int = BigNat.to_int_or_negative(whole)
	if value < 0:
		push_error("Dec.to_int_truncated: the result does not fit a 64-bit int")
		return 0
	return -value if negative else value


## `int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))`: ties go away from zero.
func round_half_up() -> int:
	var whole: PackedInt64Array = magnitude
	if scale > 0:
		var parts: Array = BigNat.divmod10(magnitude, scale)
		whole = parts[0]
		var twice_remainder: PackedInt64Array = BigNat.mul_small(parts[1], 2)
		if BigNat.compare(twice_remainder, BigNat.shift10(BigNat.from_int(1), scale)) >= 0:
			whole = BigNat.add(whole, BigNat.from_int(1))
	elif scale < 0:
		whole = BigNat.shift10(magnitude, -scale)
	var value: int = BigNat.to_int_or_negative(whole)
	if value < 0:
		push_error("Dec.round_half_up: the result does not fit a 64-bit int")
		return 0
	return -value if negative else value


## `value.quantize(Decimal(10) ** -places, rounding=ROUND_HALF_UP)`: exactly `places` decimals, ties away from zero.
func quantize_half_up(places: int) -> Dec:
	if scale <= places:
		return from_parts(negative, BigNat.shift10(magnitude, places - scale), places)
	var dropped: int = scale - places
	var parts: Array = BigNat.divmod10(magnitude, dropped)
	var quotient: PackedInt64Array = parts[0]
	var twice_remainder: PackedInt64Array = BigNat.mul_small(parts[1], 2)
	if BigNat.compare(twice_remainder, BigNat.shift10(BigNat.from_int(1), dropped)) >= 0:
		quotient = BigNat.add(quotient, BigNat.from_int(1))
	return from_parts(negative, quotient, places)


## `float(Decimal)`: correctly rounded while the magnitude stays below 2^53 and the scale below 23.
func to_float() -> float:
	var digits: int = BigNat.to_int_or_negative(magnitude)
	var result: float
	if digits >= 0 and digits < 9007199254740992 and scale >= 0 and scale <= 22:
		result = float(digits) / pow(10.0, scale) if scale > 0 else float(digits)
	else:
		result = to_text().to_float()
	return -result if negative and result > 0.0 else result


## Exact text like Python's `format(value, "f")` (keeps trailing zeros of the scale).
func to_text() -> String:
	var digits: String = BigNat.to_text(magnitude)
	var text: String
	if scale <= 0:
		text = digits + "0".repeat(-scale) if digits != "0" else "0"
	else:
		digits = digits.lpad(scale + 1, "0")
		text = digits.substr(0, digits.length() - scale) + "." + digits.substr(digits.length() - scale)
	return "-" + text if negative else text
