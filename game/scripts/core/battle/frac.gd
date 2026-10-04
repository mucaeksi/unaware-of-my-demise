@warning_ignore_start("integer_division")
class_name Frac
extends RefCounted
## Exact rational number (int64 numerator / positive denominator, always reduced): the subset of Python's
## `fractions.Fraction` the Action Gauge needs. Gauge maths must be exact, because ties between units are decided by
## comparing overshoots (parity/fixtures/battle_*.json).
##
## Sums and comparisons go through the least common denominator, so an intermediate never exceeds the size of the
## result. If a result would still leave the int64 range, `overflowed` is set and an error is pushed: the port fails
## loudly instead of returning a wrong ordering (never observed for Part I content).

const INT_MAX: int = 9223372036854775807

static var overflowed: bool = false

var num: int = 0
var den: int = 1


static func of(numerator: int, denominator: int = 1) -> Frac:
	var result: Frac = Frac.new()
	if denominator == 0:
		push_error("Frac: zero denominator")
		return result
	var sign_factor: int = -1 if denominator < 0 else 1
	var divisor: int = _gcd(absi(numerator), absi(denominator))
	if divisor > 1:
		result.num = sign_factor * (numerator / divisor)
		result.den = absi(denominator) / divisor
	else:
		result.num = sign_factor * numerator
		result.den = absi(denominator)
	return result


## `Fraction(str(value))` for a JSON number: the exact decimal the number is written as (0.3 -> 3/10).
static func from_number(value: Variant) -> Frac:
	var decimal: Dec = Dec.from_variant(value)
	if decimal == null:
		push_error("Frac.from_number: not a number")
		return of(0)
	return from_dec(decimal)


static func from_dec(decimal: Dec) -> Frac:
	var numerator: int = BigNat.to_int_or_negative(decimal.magnitude)
	var scale: int = maxi(decimal.scale, 0)
	if numerator < 0 or scale > 18:
		_overflow("Frac.from_dec: %s does not fit" % decimal.to_text())
		return of(0)
	var denominator: int = 1
	for _step: int in range(scale):
		denominator *= 10
	return of(-numerator if decimal.negative else numerator, denominator)


static func _overflow(message: String) -> void:
	overflowed = true
	push_error(message)


static func _gcd(a: int, b: int) -> int:
	var x: int = a
	var y: int = b
	while y != 0:
		var rest: int = x % y
		x = y
		y = rest
	return x


## a * b with overflow detection.
static func _mul(a: int, b: int) -> int:
	if a == 0 or b == 0:
		return 0
	if absi(b) > INT_MAX / absi(a):
		_overflow("Frac: product overflows int64")
		return 0
	return a * b


static func _add(a: int, b: int) -> int:
	if (b > 0 and a > INT_MAX - b) or (b < 0 and a < -INT_MAX - b):
		_overflow("Frac: sum overflows int64")
		return 0
	return a + b


func add(other: Frac) -> Frac:
	var g: int = _gcd(den, other.den)
	var left_scale: int = other.den / g
	var right_scale: int = den / g
	return of(_add(_mul(num, left_scale), _mul(other.num, right_scale)), _mul(den, left_scale))


func sub(other: Frac) -> Frac:
	return add(other.neg())


func neg() -> Frac:
	return of(-num, den)


func mul_int(factor: int) -> Frac:
	var g: int = _gcd(absi(factor), den)
	if g > 1:
		return of(_mul(num, factor / g), den / g)
	return of(_mul(num, factor), den)


func mul(other: Frac) -> Frac:
	var g1: int = _gcd(absi(num), other.den)
	var g2: int = _gcd(absi(other.num), den)
	var left_num: int = num / g1 if g1 > 1 else num
	var right_den: int = other.den / g1 if g1 > 1 else other.den
	var right_num: int = other.num / g2 if g2 > 1 else other.num
	var left_den: int = den / g2 if g2 > 1 else den
	return of(_mul(left_num, right_num), _mul(left_den, right_den))


func div_int(divisor: int) -> Frac:
	if divisor == 0:
		push_error("Frac: division by zero")
		return of(0)
	return of(num, _mul(den, absi(divisor))) if divisor > 0 else of(-num, _mul(den, absi(divisor)))


func compare(other: Frac) -> int:
	var g: int = _gcd(den, other.den)
	var left: int = _mul(num, other.den / g)
	var right: int = _mul(other.num, den / g)
	return int(left > right) - int(left < right)


func less_than(other: Frac) -> bool:
	return compare(other) < 0


func less_or_equal(other: Frac) -> bool:
	return compare(other) <= 0


func greater_or_equal(other: Frac) -> bool:
	return compare(other) >= 0


func equals(other: Frac) -> bool:
	return num == other.num and den == other.den


func is_zero() -> bool:
	return num == 0


static func minimum(a: Frac, b: Frac) -> Frac:
	return a if a.compare(b) <= 0 else b


static func maximum(a: Frac, b: Frac) -> Frac:
	return a if a.compare(b) >= 0 else b


## `math.ceil(fraction)` as an int.
func ceil_int() -> int:
	if den == 1:
		return num
	var quotient: int = num / den
	return quotient + 1 if num > 0 else quotient


## `math.floor(fraction)` as an int.
func floor_int() -> int:
	if den == 1:
		return num
	var quotient: int = num / den
	return quotient - 1 if num < 0 else quotient


func to_float() -> float:
	return float(num) / float(den)


## Python's `str(Fraction)`: "3" or "3/7".
func to_text() -> String:
	return str(num) if den == 1 else "%d/%d" % [num, den]
