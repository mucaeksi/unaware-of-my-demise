class_name BattleUtil
extends RefCounted
## Helpers that give GDScript the Python semantics the battle port depends on: stable sorting with tuple keys
## (`sorted(key=...)`), first-minimum selection (`min(..., key=...)`) and set-like arrays of ids.


## Lexicographic "less than" of two key tuples (numbers compare by value, strings by code point).
static func key_less(a: Array, b: Array) -> bool:
	var count: int = mini(a.size(), b.size())
	for index: int in range(count):
		var left: Variant = a[index]
		var right: Variant = b[index]
		if left is Frac and right is Frac:
			var order: int = (left as Frac).compare(right)
			if order != 0:
				return order < 0
		elif left != right:
			return left < right
	return a.size() < b.size()


## Stable sort of `items` by `key_fn(item) -> Array` (a tuple), like Python's `sorted(items, key=...)`.
static func sorted_by(items: Array, key_fn: Callable) -> Array:
	var keyed: Array = []
	for item: Variant in items:
		keyed.append([key_fn.call(item), item])
	# Insertion sort is stable and the collections here are tiny (a few units).
	for index: int in range(1, keyed.size()):
		var current: Array = keyed[index]
		var position: int = index - 1
		while position >= 0 and key_less(current[0], (keyed[position] as Array)[0]):
			keyed[position + 1] = keyed[position]
			position -= 1
		keyed[position + 1] = current
	var result: Array = []
	for entry: Array in keyed:
		result.append(entry[1])
	return result


## The first item whose key is minimal (Python's `min(items, key=...)`); null for an empty collection.
static func min_by(items: Array, key_fn: Callable) -> Variant:
	var best: Variant = null
	var best_key: Array = []
	var first: bool = true
	for item: Variant in items:
		var key: Array = key_fn.call(item)
		if first or key_less(key, best_key):
			best = item
			best_key = key
			first = false
	return best


static func set_has(set: Dictionary, key: String) -> bool:
	return set.has(key)


static func names_of(units: Array) -> Array[String]:
	var ids: Array[String] = []
	for unit: Variant in units:
		ids.append((unit as BattleUnit).entity_id)
	return ids


## Dictionary keys as a sorted Array[String] (`tuple(sorted(mapping))`).
static func sorted_keys(map: Dictionary) -> Array[String]:
	var keys: Array[String] = []
	for key: String in map:
		keys.append(key)
	keys.sort()
	return keys


## `list.remove(x)`: removes the first element equal to `value` (Dictionaries compare by content).
static func remove_first_equal(items: Array, value: Variant) -> bool:
	for index: int in range(items.size()):
		if is_same(items[index], value) or items[index] == value:
			items.remove_at(index)
			return true
	return false
