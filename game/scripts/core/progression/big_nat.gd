@warning_ignore_start("integer_division")
class_name BigNat
extends RefCounted
## Arbitrary-size non-negative integers as little-endian limbs in base 10^9 (a PackedInt64Array, zero = empty).
##
## Only what exact decimal maths and float printing need: add, subtract, multiply, divide by a small int, compare,
## decimal text. Every limb product stays below 2^63 (limbs < 10^9, multipliers < 2^31).

const BASE: int = 1000000000
const _SMALL_LIMIT: int = 2147483648  # multipliers/divisors must stay below 2^31 so limb * m + carry fits an int64


static func zero() -> PackedInt64Array:
	return PackedInt64Array()


static func from_int(value: int) -> PackedInt64Array:
	var limbs: PackedInt64Array = PackedInt64Array()
	var rest: int = value
	if rest < 0:
		push_error("BigNat.from_int: negative value")
		return limbs
	while rest > 0:
		limbs.append(rest % BASE)
		rest = rest / BASE
	return limbs


static func is_zero(a: PackedInt64Array) -> bool:
	return a.is_empty()


static func compare(a: PackedInt64Array, b: PackedInt64Array) -> int:
	if a.size() != b.size():
		return 1 if a.size() > b.size() else -1
	for index: int in range(a.size() - 1, -1, -1):
		if a[index] != b[index]:
			return 1 if a[index] > b[index] else -1
	return 0


static func add(a: PackedInt64Array, b: PackedInt64Array) -> PackedInt64Array:
	var result: PackedInt64Array = PackedInt64Array()
	var carry: int = 0
	for index: int in range(maxi(a.size(), b.size())):
		var total: int = carry
		if index < a.size():
			total += a[index]
		if index < b.size():
			total += b[index]
		result.append(total % BASE)
		carry = total / BASE
	if carry > 0:
		result.append(carry)
	return result


## a - b, requires a >= b.
static func sub(a: PackedInt64Array, b: PackedInt64Array) -> PackedInt64Array:
	var result: PackedInt64Array = PackedInt64Array()
	var borrow: int = 0
	for index: int in range(a.size()):
		var current: int = a[index] - borrow - (b[index] if index < b.size() else 0)
		if current < 0:
			current += BASE
			borrow = 1
		else:
			borrow = 0
		result.append(current)
	return _trim(result)


static func mul_small(a: PackedInt64Array, factor: int) -> PackedInt64Array:
	if factor < 0 or factor >= _SMALL_LIMIT:
		push_error("BigNat.mul_small: factor %d is outside 0..2^31-1" % factor)
		return zero()
	if factor == 0 or a.is_empty():
		return zero()
	var result: PackedInt64Array = PackedInt64Array()
	var carry: int = 0
	for limb: int in a:
		var product: int = limb * factor + carry
		result.append(product % BASE)
		carry = product / BASE
	while carry > 0:
		result.append(carry % BASE)
		carry = carry / BASE
	return result


static func mul(a: PackedInt64Array, b: PackedInt64Array) -> PackedInt64Array:
	if a.is_empty() or b.is_empty():
		return zero()
	var result: PackedInt64Array = PackedInt64Array()
	result.resize(a.size() + b.size())
	for i: int in range(a.size()):
		var carry: int = 0
		for j: int in range(b.size()):
			var current: int = result[i + j] + a[i] * b[j] + carry
			result[i + j] = current % BASE
			carry = current / BASE
		var position: int = i + b.size()
		while carry > 0:
			var spill: int = result[position] + carry
			result[position] = spill % BASE
			carry = spill / BASE
			position += 1
	return _trim(result)


## Multiplies by 10^exponent.
static func shift10(a: PackedInt64Array, exponent: int) -> PackedInt64Array:
	if a.is_empty() or exponent <= 0:
		return a
	var result: PackedInt64Array = a
	var whole_limbs: int = exponent / 9
	var remainder: int = exponent % 9
	if remainder > 0:
		var factor: int = 1
		for _step: int in range(remainder):
			factor *= 10
		result = mul_small(result, factor)
	if whole_limbs > 0:
		var shifted: PackedInt64Array = PackedInt64Array()
		shifted.resize(whole_limbs)
		shifted.append_array(result)
		result = shifted
	return result


## Returns [quotient, remainder] for 0 < divisor < 2^31.
static func divmod_small(a: PackedInt64Array, divisor: int) -> Array:
	if divisor <= 0 or divisor >= _SMALL_LIMIT:
		push_error("BigNat.divmod_small: divisor %d is outside 1..2^31-1" % divisor)
		return [zero(), 0]
	var quotient: PackedInt64Array = PackedInt64Array()
	quotient.resize(a.size())
	var remainder: int = 0
	for index: int in range(a.size() - 1, -1, -1):
		var current: int = remainder * BASE + a[index]
		quotient[index] = current / divisor
		remainder = current % divisor
	return [_trim(quotient), remainder]


## Returns [quotient, remainder] of a / 10^exponent.
static func divmod10(a: PackedInt64Array, exponent: int) -> Array:
	if exponent <= 0:
		return [a, zero()]
	var text: String = to_text(a)
	if exponent >= text.length():
		return [zero(), a]
	return [from_text(text.substr(0, text.length() - exponent)), from_text(text.substr(text.length() - exponent))]


static func to_text(a: PackedInt64Array) -> String:
	if a.is_empty():
		return "0"
	var text: String = str(a[a.size() - 1])
	for index: int in range(a.size() - 2, -1, -1):
		text += str(a[index]).lpad(9, "0")
	return text


## Parses decimal digits (no sign); anything else yields zero and an error.
static func from_text(text: String) -> PackedInt64Array:
	var digits: String = text.lstrip("0")
	var limbs: PackedInt64Array = PackedInt64Array()
	var end: int = digits.length()
	while end > 0:
		var start: int = maxi(0, end - 9)
		var part: String = digits.substr(start, end - start)
		if not part.is_valid_int():
			push_error("BigNat.from_text: not a decimal number: " + text)
			return zero()
		limbs.append(part.to_int())
		end = start
	return _trim(limbs)


## The value as an int when it fits below 2^63, else -1.
static func to_int_or_negative(a: PackedInt64Array) -> int:
	if a.size() > 3:
		return -1
	var total: int = 0
	for index: int in range(a.size() - 1, -1, -1):
		if total > (9223372036854775807 - a[index]) / BASE:
			return -1
		total = total * BASE + a[index]
	return total


static func _trim(a: PackedInt64Array) -> PackedInt64Array:
	var size: int = a.size()
	while size > 0 and a[size - 1] == 0:
		size -= 1
	if size == a.size():
		return a
	var trimmed: PackedInt64Array = a.slice(0, size)
	return trimmed
