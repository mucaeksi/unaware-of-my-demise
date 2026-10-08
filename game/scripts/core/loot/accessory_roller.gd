class_name AccessoryRoller
extends RefCounted
## Accessory main/sub-stat rolling and atomic reroll-token consumption (port of game_logic/accessory_rng.py).
##
## Draw order is part of the contract (parity/fixtures/accessories.json): main stat choice, then per sub-stat a choice
## and a value, then the 128-bit instance id, then the main stat value. The value rule is
## `min + (max - min) * Decimal(str(random()))` rounded half up to 0.01: exact decimals (Dec, with the shortest
## round-trip printing of random()), not binary floats.
##
## The reference raises AccessoryError; here a failed call returns an empty Dictionary / null and sets `error`.

## The reroll result: the new item and the new inventory (copies; the inputs are never touched).
class RollResult extends RefCounted:
	var item: Dictionary = {}
	var inventory: Dictionary = {}


var _templates: Dictionary = {}

## Last rejected call ("" = the last call succeeded).
var error: String = ""


## `templates`: {accessory_id: ContentModels.AccessoryTemplate} (the registry's `accessories`).
func _init(templates: Dictionary) -> void:
	_templates = templates


func _fail(message: String) -> void:
	if error.is_empty():
		error = message


func _template(accessory_id: Variant) -> ContentModels.AccessoryTemplate:
	if not (accessory_id is String) or not _templates.has(accessory_id):
		_fail("Unknown accessory template: %s" % str(accessory_id))
		return null
	return _templates[accessory_id]


func _profile(template: ContentModels.AccessoryTemplate, rarity: Variant) -> Dictionary:
	var key: String = str(int(rarity)) if (rarity is int or rarity is float) else str(rarity)
	var profile: Variant = template.rarity_profiles.get(key, {})
	return profile if profile is Dictionary else {}


## A newly rolled accessory instance from a template, drawing from `rng` (a seeded CpythonRandom).
func roll_drop(accessory_id: String, rng: CpythonRandom) -> Dictionary:
	error = ""
	var template: ContentModels.AccessoryTemplate = _template(accessory_id)
	if template == null:
		return {}
	var profile: Dictionary = _profile(template, template.rarity)
	var main: Dictionary = weighted_choice(template.possible_main_stats, rng)
	if main.is_empty():
		_fail("Stat pool must have a positive total weight.")
		return {}
	var substats: Array[Dictionary] = _roll_substats(template, int(profile["substat_count"]), rng, String(main["stat_id"]))
	if not error.is_empty():
		return {}
	var instance_id: String = "acc_" + rng.getrandbits_hex(128)
	var main_stat: Dictionary = roll_value_from(main, rng.random())
	return {
		"instance_id": instance_id,
		"accessory_id": accessory_id,
		"name_en": template.name_en,
		"rarity": template.rarity,
		"slot": template.slot,
		"set_id": template.set_id,
		"brand_mark_id": template.brand_mark_id,
		"main_stat": main_stat,
		"sub_stats": substats,
		"reroll_count": 0,
		"is_rerollable": bool(profile["is_rerollable"]),
		"locked": false,
	}


## `roll_drop(accessory_id, seed=seed)` for a seed given as an unsigned 64-bit pattern (the int's bits).
func roll_drop_seeded(accessory_id: String, seed_u64: int) -> Dictionary:
	return roll_drop(accessory_id, CpythonRandom.create_from_u64(seed_u64))


## Rerolls only the sub-stats and consumes the token cost; returns null (inputs unchanged) on any violation.
func reroll(item: Dictionary, inventory: Dictionary, rng: CpythonRandom) -> RollResult:
	error = ""
	var current: Dictionary = item.duplicate(true)
	var inv: Dictionary = inventory.duplicate(true)
	var template: ContentModels.AccessoryTemplate = _template(current.get("accessory_id", ""))
	if template == null:
		return null
	var profile: Dictionary = _profile(template, current.get("rarity"))
	if not bool(profile.get("is_rerollable", false)) or current.get("is_rerollable") == false:
		_fail("This accessory cannot be rerolled.")
		return null

	var instance_id: Variant = current.get("instance_id")
	var equipment: Array = inv.get("equipment", [])
	var slot: int = -1
	for index: int in range(equipment.size()):
		if (equipment[index] as Dictionary).get("instance_id") == instance_id:
			slot = index
			break
	if slot < 0:
		_fail("The accessory instance is not present in this inventory.")
		return null
	var owned: Dictionary = equipment[slot]
	if owned.get("accessory_id") != current.get("accessory_id") or owned.get("rarity") != current.get("rarity"):
		_fail("The requested item does not match the owned accessory instance.")
		return null
	current = owned.duplicate(true)
	if bool(current.get("locked", false)):
		_fail("Unlock the accessory before rerolling it.")
		return null

	var cost: Dictionary = profile["reroll_cost"]
	var token_id: String = String(cost["item_id"])
	if not inv.has("items"):
		inv["items"] = {}
	var item_counts: Dictionary = inv["items"]
	if float(item_counts.get(token_id, 0)) < float(cost["quantity"]):
		_fail("Insufficient reroll token: %s." % token_id)
		return null

	var replacement: Array[Dictionary] = _roll_substats(template, int(profile["substat_count"]), rng, String((current["main_stat"] as Dictionary)["stat_id"]))
	if not error.is_empty():
		return null
	# Commit on the local copies only after every validation and roll succeeded.
	item_counts[token_id] = item_counts[token_id] - cost["quantity"]
	if item_counts[token_id] == 0:
		item_counts.erase(token_id)
	current["sub_stats"] = replacement
	current["reroll_count"] = int(current.get("reroll_count", 0)) + 1
	equipment[slot] = current.duplicate(true)
	inv["equipment"] = equipment
	var result: RollResult = RollResult.new()
	result.item = current
	result.inventory = inv
	return result


func reroll_seeded(item: Dictionary, inventory: Dictionary, seed_u64: int) -> RollResult:
	return reroll(item, inventory, CpythonRandom.create_from_u64(seed_u64))


## One weighted pick: `mark = random() * sum(weights)`, then subtract weights until the mark turns negative.
## Returns {} for a pool without positive total weight.
static func weighted_choice(rows: Array[Dictionary], rng: CpythonRandom) -> Dictionary:
	var total: float = 0.0
	for row: Dictionary in rows:
		total += float(row["weight"])
	if total <= 0.0:
		return {}
	var mark: float = rng.random() * total
	for row: Dictionary in rows:
		mark -= float(row["weight"])
		if mark < 0.0:
			return row.duplicate()
	return rows[rows.size() - 1].duplicate()


func _roll_substats(template: ContentModels.AccessoryTemplate, count: int, rng: CpythonRandom, main_stat_id: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var available: Array[Dictionary] = []
	for row: Dictionary in template.possible_sub_stats:
		if String(row["stat_id"]) != main_stat_id:
			available.append(row)
	if available.size() < count:
		_fail("Substat pool has too few distinct choices.")
		return result
	for _draw: int in range(count):
		var row: Dictionary = weighted_choice(available, rng)
		if row.is_empty():
			_fail("Stat pool must have a positive total weight.")
			return result
		var remaining: Array[Dictionary] = []
		for candidate: Dictionary in available:
			if String(candidate["stat_id"]) != String(row["stat_id"]):
				remaining.append(candidate)
		available = remaining
		result.append(roll_value_from(row, rng.random()))
	return result


## `_roll_value` for one random() draw `r`: `low + (high - low) * Decimal(str(r))` quantized half up to 0.01.
static func roll_value_from(row: Dictionary, random_value: float) -> Dictionary:
	var low: Dec = Dec.from_variant(row["min_value"])
	var high: Dec = Dec.from_variant(row["max_value"])
	var value: Dec = low.add(high.sub(low).mul(Dec.from_float(random_value)))
	return {
		"stat_id": row["stat_id"],
		"value": value.quantize_half_up(2).to_float(),
		"unit": row["unit"],
	}
