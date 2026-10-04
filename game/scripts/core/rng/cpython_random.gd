class_name CpythonRandom
extends RefCounted
## Bit-exact port of CPython's `random.Random` (Mersenne Twister MT19937) for the calls the game uses.
##
## The battle engine, loot and accessory rolls are seeded and must reproduce the Python reference draw for draw
## (docs/GODOT_MIGRATION_PROMPT.md, G3; fixtures: parity/fixtures/rng.json). Reference: CPython 3.11-3.13
## `Modules/_randommodule.c` and `Lib/random.py`.
##
## Seeds. Python seeds with `abs(int)`, split into 32-bit little-endian words (`init_by_array`). A GDScript `int` is
## 64 bit, so three entry points exist:
##   seed_int(value)    non-negative value that fits a signed 64-bit int (battle seeds, stage seeds);
##   seed_u64(value)    the int's 64 bits read as an UNSIGNED number (what `random.Random(rng.getrandbits(64))` needs);
##   seed_words(words)  any width, words are 32-bit little-endian (see words_from_decimal for big decimal strings).
##
## Draw widths. getrandbits(k) returns an int for k <= 63. Wider draws (accessory ids use k = 128) come back as
## 32-bit words from getrandbits_words(k), and getrandbits_u64() returns 64 bits as the int's bit pattern.
## Nothing here throws: an invalid argument is reported with push_error and yields 0.

const _N: int = 624
const _M: int = 397
const _MATRIX_A: int = 0x9908B0DF
const _UPPER_MASK: int = 0x80000000
const _LOWER_MASK: int = 0x7FFFFFFF
const _MASK32: int = 0xFFFFFFFF
const _TWO_POW_53: float = 9007199254740992.0

var _mt: PackedInt64Array = PackedInt64Array()
var _index: int = _N


func _init() -> void:
	_mt.resize(_N)
	seed_words(PackedInt64Array([0]))


# -- seeding ---------------------------------------------------------------------------------------


static func create_from_int(value: int) -> CpythonRandom:
	var rng: CpythonRandom = CpythonRandom.new()
	rng.seed_int(value)
	return rng


static func create_from_u64(value: int) -> CpythonRandom:
	var rng: CpythonRandom = CpythonRandom.new()
	rng.seed_u64(value)
	return rng


static func create_from_words(words: PackedInt64Array) -> CpythonRandom:
	var rng: CpythonRandom = CpythonRandom.new()
	rng.seed_words(words)
	return rng


## `random.Random(value)` for a value that fits a signed 64-bit int (abs() is applied like CPython does).
func seed_int(value: int) -> void:
	if value == -9223372036854775808:
		seed_words(PackedInt64Array([0, 0x80000000]))
		return
	seed_u64(absi(value))


## Seeds with the 64 bits of `value` read as an unsigned number.
func seed_u64(value: int) -> void:
	var low: int = value & _MASK32
	var high: int = (value >> 32) & _MASK32
	if high == 0:
		seed_words(PackedInt64Array([low]))
	else:
		seed_words(PackedInt64Array([low, high]))


## `init_by_array` with the 32-bit little-endian words of abs(seed). An empty key is treated as [0] (seed 0).
func seed_words(words: PackedInt64Array) -> void:
	var key: PackedInt64Array = words
	if key.is_empty():
		key = PackedInt64Array([0])
	_init_genrand(19650218)
	var i: int = 1
	var j: int = 0
	var key_length: int = key.size()
	var k: int = maxi(_N, key_length)
	while k > 0:
		var prev: int = _mt[i - 1]
		_mt[i] = ((_mt[i] ^ ((prev ^ (prev >> 30)) * 1664525)) + (key[j] & _MASK32) + j) & _MASK32
		i += 1
		j += 1
		if i >= _N:
			_mt[0] = _mt[_N - 1]
			i = 1
		if j >= key_length:
			j = 0
		k -= 1
	k = _N - 1
	while k > 0:
		var prev2: int = _mt[i - 1]
		_mt[i] = ((_mt[i] ^ ((prev2 ^ (prev2 >> 30)) * 1566083941)) - i) & _MASK32
		i += 1
		if i >= _N:
			_mt[0] = _mt[_N - 1]
			i = 1
		k -= 1
	_mt[0] = 0x80000000
	_index = _N


func _init_genrand(seed_value: int) -> void:
	_mt[0] = seed_value & _MASK32
	for i: int in range(1, _N):
		var prev: int = _mt[i - 1]
		_mt[i] = (1812433253 * (prev ^ (prev >> 30)) + i) & _MASK32
	_index = _N


## abs() of a (possibly negative, arbitrarily long) decimal string as 32-bit little-endian words.
## Returns [0] for "0"/""; an input that is not a decimal integer yields an empty array.
static func words_from_decimal(text: String) -> PackedInt64Array:
	var digits: String = text.strip_edges()
	if digits.begins_with("-") or digits.begins_with("+"):
		digits = digits.substr(1)
	if digits.is_empty() or not digits.is_valid_int():
		return PackedInt64Array()
	# Repeated division of the decimal digit list by 2^32.
	var number: PackedInt64Array = PackedInt64Array()
	for index: int in range(digits.length()):
		number.append(digits.unicode_at(index) - 48)
	var words: PackedInt64Array = PackedInt64Array()
	while not number.is_empty():
		var remainder: int = 0
		var quotient: PackedInt64Array = PackedInt64Array()
		for digit: int in number:
			var current: int = remainder * 10 + digit
			@warning_ignore("integer_division")
			var q: int = current / 4294967296
			remainder = current % 4294967296
			if not quotient.is_empty() or q != 0:
				quotient.append(q)
		words.append(remainder)
		number = quotient
	if words.is_empty():
		words.append(0)
	return words


# -- raw generator ---------------------------------------------------------------------------------


func _twist() -> void:
	for kk: int in range(_N - _M):
		var y: int = (_mt[kk] & _UPPER_MASK) | (_mt[kk + 1] & _LOWER_MASK)
		_mt[kk] = _mt[kk + _M] ^ (y >> 1) ^ (_MATRIX_A if (y & 1) != 0 else 0)
	for kk2: int in range(_N - _M, _N - 1):
		var y2: int = (_mt[kk2] & _UPPER_MASK) | (_mt[kk2 + 1] & _LOWER_MASK)
		_mt[kk2] = _mt[kk2 + (_M - _N)] ^ (y2 >> 1) ^ (_MATRIX_A if (y2 & 1) != 0 else 0)
	var y3: int = (_mt[_N - 1] & _UPPER_MASK) | (_mt[0] & _LOWER_MASK)
	_mt[_N - 1] = _mt[_M - 1] ^ (y3 >> 1) ^ (_MATRIX_A if (y3 & 1) != 0 else 0)
	_index = 0


## One tempered 32-bit output word (`genrand_uint32`).
func next_u32() -> int:
	if _index >= _N:
		_twist()
	var y: int = _mt[_index]
	_index += 1
	y ^= y >> 11
	y ^= (y << 7) & 0x9D2C5680
	y ^= (y << 15) & 0xEFC60000
	y ^= y >> 18
	return y & _MASK32


# -- Random API ------------------------------------------------------------------------------------


## `random.random()`: k / 2^53 with k = (a << 26 | b) from two words (a = w1 >> 5, b = w2 >> 6).
func random() -> float:
	return float(random_u53()) / _TWO_POW_53


## The exact 53-bit numerator of `random()`.
func random_u53() -> int:
	var a: int = next_u32() >> 5
	var b: int = next_u32() >> 6
	return a * 67108864 + b


## `random.getrandbits(k)` for 0 <= k <= 63.
func getrandbits(bits: int) -> int:
	if bits < 0 or bits > 63:
		push_error("CpythonRandom.getrandbits: %d is outside 0..63 (use getrandbits_words)" % bits)
		return 0
	if bits == 0:
		return 0
	if bits <= 32:
		return next_u32() >> (32 - bits)
	var low: int = next_u32()
	var high: int = next_u32() >> (64 - bits)
	return low | (high << 32)


## `random.getrandbits(64)` as the int's bit pattern (negative when the top bit is set).
func getrandbits_u64() -> int:
	var low: int = next_u32()
	var high: int = next_u32()
	return low | (high << 32)


## `random.getrandbits(k)` for any k > 0 as 32-bit little-endian words (first word generated = lowest bits).
func getrandbits_words(bits: int) -> PackedInt64Array:
	var words: PackedInt64Array = PackedInt64Array()
	if bits <= 0:
		push_error("CpythonRandom.getrandbits_words: bits must be positive")
		return words
	var remaining: int = bits
	while remaining > 0:
		var word: int = next_u32()
		if remaining < 32:
			word = word >> (32 - remaining)
		words.append(word)
		remaining -= 32
	return words


## `random.getrandbits(128)` as 32 lowercase hex digits (`acc_<hex>` instance ids).
func getrandbits_hex(bits: int) -> String:
	@warning_ignore("integer_division")
	var digits: int = (bits + 3) / 4
	return words_to_hex(getrandbits_words(bits), digits)


## Words (32-bit, little-endian) as a zero-padded lowercase hex string of `digits` characters.
static func words_to_hex(words: PackedInt64Array, digits: int) -> String:
	var full: String = ""
	for index: int in range(words.size() - 1, -1, -1):
		full += "%08x" % words[index]
	if full.length() >= digits:
		return full.substr(full.length() - digits)
	return full.lpad(digits, "0")


## `Random._randbelow_with_getrandbits(n)` for 1 <= n <= 2^63 - 1: uniform in [0, n).
func randbelow(limit: int) -> int:
	if limit < 1:
		push_error("CpythonRandom.randbelow: n must be >= 1 (got %d)" % limit)
		return 0
	var bits: int = _bit_length(limit)
	var value: int = getrandbits(bits)
	while value >= limit:
		value = getrandbits(bits)
	return value


## `random.randrange(start, stop, step)`. Arguments that Python rejects with ValueError push an error and return `start`.
func randrange(start: int, stop: int, step: int = 1) -> int:
	var width: int = stop - start
	var count: int
	if step == 1:
		if width <= 0:
			push_error("CpythonRandom.randrange: empty range for randrange(%d, %d)" % [start, stop])
			return start
		return start + randbelow(width)
	if step > 0:
		@warning_ignore("integer_division")
		count = (width + step - 1) / step
	elif step < 0:
		@warning_ignore("integer_division")
		count = (width + step + 1) / step
	else:
		push_error("CpythonRandom.randrange: zero step")
		return start
	if count <= 0:
		push_error("CpythonRandom.randrange: empty range for randrange(%d, %d, %d)" % [start, stop, step])
		return start
	return start + step * randbelow(count)


## `random.randint(a, b)` = randrange(a, b + 1).
func randint(low: int, high: int) -> int:
	return randrange(low, high + 1)


## Index that `random.choice(seq)` would pick for a sequence of `length` items (`length` >= 1).
func choice_index(length: int) -> int:
	if length < 1:
		push_error("CpythonRandom.choice_index: cannot choose from an empty sequence")
		return 0
	return randbelow(length)


## `random.choice(seq)`; an empty array pushes an error and returns null.
func choice(items: Array) -> Variant:
	if items.is_empty():
		push_error("CpythonRandom.choice: cannot choose from an empty sequence")
		return null
	return items[randbelow(items.size())]


## `random.shuffle(x)` in place (Fisher-Yates from the end, exactly CPython's loop).
func shuffle(items: Array) -> void:
	for position: int in range(items.size() - 1, 0, -1):
		var other: int = randbelow(position + 1)
		var held: Variant = items[position]
		items[position] = items[other]
		items[other] = held


# -- inspection (tests) ---------------------------------------------------------------------------


## The state right after seeding, in the shape parity/fixtures/rng.json records it.
func state_summary() -> Dictionary:
	var head: Array[int] = []
	var tail: Array[int] = []
	for index: int in range(8):
		head.append(_mt[index])
	for index: int in range(_N - 4, _N):
		tail.append(_mt[index])
	var bytes: PackedByteArray = PackedByteArray()
	bytes.resize(_N * 4)
	for index: int in range(_N):
		bytes.encode_u32(index * 4, _mt[index])
	var hasher: HashingContext = HashingContext.new()
	hasher.start(HashingContext.HASH_SHA256)
	hasher.update(bytes)
	return {
		"index": _index,
		"words_head": head,
		"words_tail": tail,
		"words_sha256": hasher.finish().hex_encode(),
	}


static func _bit_length(value: int) -> int:
	var length: int = 0
	var rest: int = value
	while rest > 0:
		length += 1
		rest >>= 1
	return length
