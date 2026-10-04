class_name Progression
extends RefCounted
## Compact-stat character progression, equipment levels, skill ranks and Memory Nodes (port of core/progression.py).
##
## Every number comes from `battle_rules_part1.json` (the registry's `battle_rules`). Stat maths uses exact decimals
## (Dec) with a half-up round at the end, like the reference's `Decimal`.
##
## Invalid input (a level below 1, an unknown skill type, an unsupported curve) is reported through `error`
## (reset by every call) and the call returns a neutral value (0, {}, null); the reference raises ValueError/TypeError
## for exactly the same calls (parity/fixtures/curves.json, "errors").

const _CORE_STATS: Array[String] = ["hp", "atk", "def", "spd", "res"]
const _XP_CURVE_PATTERN: String = "^\\s*xp_to_next\\(level\\)\\s*=\\s*(\\d+)\\s*\\+\\s*(\\d+)\\s*\\*\\s*level\\s*\\+\\s*(\\d+)\\s*\\*\\s*level\\s*\\*\\s*level\\s*$"

static var _xp_curve_regex: RegEx = null

var _battle_rules: Dictionary = {}

## The last invalid input ("" = the last call was fine).
var error: String = ""


class AscensionItemRequirement extends RefCounted:
	var item_id: String = ""
	var quantity: int = 0


## The next cap gate and its account/material requirements. `next_cap` is null once the Part I cap is reached.
class AscensionRequirement extends RefCounted:
	var next_cap: Variant = null  # int | null
	var required_account_level: Variant = null  # int | null
	var items: Array[AscensionItemRequirement] = []
	var account_level_met: bool = true


## Normalized equipment bonuses before stat aggregation. Flat values are stat points, percent values are fractions
## (0.10 = +10%). Both maps are stat id -> Dec.
class EquippedItem extends RefCounted:
	var flat_stats: Dictionary = {}
	var percent_stats: Dictionary = {}


class EquipmentMilestone extends RefCounted:
	var from_level: int = 0
	var item_id: String = ""
	var item_quantity: int = 0
	var bonus_pct: Dec = Dec.from_int(0)


class SkillUpgradeRequirement extends RefCounted:
	var to_rank: int = 0
	var required_character_level: int = 0
	var item_id: String = ""  # "" = no item (the reference's None)
	var item_quantity: int = 0
	var silver_crowns: int = 0


class MemoryNode extends RefCounted:
	var node: int = 0
	var shard_cost: int = 0
	var effect_type: String = ""  # "stat_pct" | "start_focus"
	var stat: String = ""  # "" = none
	var value: Dec = Dec.from_int(0)


func _init(battle_rules: Dictionary = {}) -> void:
	_battle_rules = battle_rules


static func create(registry: ContentModels.ContentRegistry) -> Progression:
	return Progression.new(registry.battle_rules)


# -- helpers ---------------------------------------------------------------------------------------


func _fail(message: String) -> void:
	if error.is_empty():
		error = message


static func _is_number(value: Variant) -> bool:
	return value is int or value is float


static func _is_whole(value: Variant) -> bool:
	if value is int:
		return true
	return value is float and is_finite(value) and value == floorf(value)


## `_decimal(value, context)`: a finite number as Dec, or a recorded error.
func _decimal(value: Variant, context: String) -> Dec:
	if value is Dec:
		return value
	if not _is_number(value):
		_fail("%s must be numeric" % context)
		return Dec.from_int(0)
	return Dec.from_variant(value)


func _positive_level(level: int, name: String = "level") -> bool:
	if level < 1:
		_fail("%s must be a positive integer" % name)
		return false
	return true


func _int_of(value: Variant, fallback: int) -> int:
	return int(value) if _is_number(value) else fallback


func _rules(section: String) -> Dictionary:
	var rules: Variant = _battle_rules.get(section)
	if not (rules is Dictionary):
		_fail("battle_rules_part1.json is missing %s" % section)
		return {}
	return rules


# -- character stats -------------------------------------------------------------------------------


func character_level_cap() -> int:
	error = ""
	return _int_of(_rules("character_progression").get("level_cap", 20), 20)


## `base + growth * (level - 1)` per stat, Dec half-up at the final value: stat id -> int.
func base_stat_at_level(base_stats_level_1: Dictionary, growth_per_level: Dictionary, level: int) -> Dictionary:
	error = ""
	var resolved: Dictionary = {}
	if not _positive_level(level):
		return resolved
	var cap: int = _int_of(_rules("character_progression").get("level_cap", 20), 20)
	if level > cap:
		_fail("level %d exceeds the Part I level cap (%d)" % [level, cap])
		return resolved
	var stat_ids: Array = []
	for stat_id: String in base_stats_level_1:
		stat_ids.append(stat_id)
	for stat_id: String in growth_per_level:
		if not stat_ids.has(stat_id):
			stat_ids.append(stat_id)
	for stat_id: String in stat_ids:
		var base: Dec = _decimal(base_stats_level_1.get(stat_id, 0), "base stat %s" % stat_id)
		var growth: Dec = _decimal(growth_per_level.get(stat_id, 0), "growth stat %s" % stat_id)
		if not error.is_empty():
			return {}
		resolved[stat_id] = base.add(growth.mul_int(level - 1)).round_half_up()
	return resolved


## `base_stat_at_level` with the stage's `enemy_stat_multiplier` applied to HP and ATK. The factor scales the
## level-one value and the per-level growth (as doubles, like the reference) before rounding, so 1.0 is identical.
func enemy_stats_at_level(base_stats_level_1: Dictionary, growth_per_level: Dictionary, level: int, multiplier: float = 1.0) -> Dictionary:
	var base: Dictionary = base_stats_level_1
	var growth: Dictionary = growth_per_level
	if multiplier != 1.0:
		base = base_stats_level_1.duplicate()
		growth = growth_per_level.duplicate()
		for stat: String in ["hp", "atk"]:
			if base.has(stat) and _is_number(base[stat]):
				base[stat] = float(base[stat]) * multiplier
			if growth.has(stat) and _is_number(growth[stat]):
				growth[stat] = float(growth[stat]) * multiplier
	return base_stat_at_level(base, growth, level)


func _minimum_for_stat(stat_id: String) -> int:
	var stat_rules: Variant = _battle_rules.get("stat_resolution", {})
	var rules: Dictionary = stat_rules if stat_rules is Dictionary else {}
	if stat_id == "hp":
		return _int_of(rules.get("minimum_hp", 1), 1)
	if stat_id == "def":
		return _int_of(rules.get("minimum_defense", 0), 0)
	if stat_id == "spd":
		return _int_of(rules.get("minimum_speed", 1), 1)
	return 0


## Sums all flat bonuses, then sums and applies each stat's percent once: `round_half_up((base + flat) * (1 + pct))`,
## clamped to the stat minimums. `base` values are numbers; result: stat id -> int.
func apply_equipment(base: Dictionary, weapon: EquippedItem, armor: EquippedItem, accessories: Array[EquippedItem]) -> Dictionary:
	error = ""
	var flat_totals: Dictionary = {}
	var percent_totals: Dictionary = {}
	var items: Array[EquippedItem] = [weapon, armor]
	items.append_array(accessories)
	for item: EquippedItem in items:
		for stat_id: String in item.flat_stats:
			var current: Dec = flat_totals.get(stat_id, Dec.from_int(0))
			flat_totals[stat_id] = current.add(_decimal(item.flat_stats[stat_id], "flat bonus %s" % stat_id))
		for stat_id: String in item.percent_stats:
			var current_percent: Dec = percent_totals.get(stat_id, Dec.from_int(0))
			percent_totals[stat_id] = current_percent.add(_decimal(item.percent_stats[stat_id], "percent bonus %s" % stat_id))
	var stat_ids: Array = []
	for stat_id: String in base:
		stat_ids.append(stat_id)
	for stat_id: String in flat_totals:
		if not stat_ids.has(stat_id):
			stat_ids.append(stat_id)
	for stat_id: String in percent_totals:
		if not stat_ids.has(stat_id):
			stat_ids.append(stat_id)
	var resolved: Dictionary = {}
	for stat_id: String in stat_ids:
		var base_value: Dec = _decimal(base.get(stat_id, 0), "base stat %s" % stat_id)
		var flat_value: Dec = flat_totals.get(stat_id, Dec.from_int(0))
		var total_percent: Dec = percent_totals.get(stat_id, Dec.from_int(0))
		var value: int = base_value.add(flat_value).mul(Dec.from_int(1).add(total_percent)).round_half_up()
		resolved[stat_id] = maxi(_minimum_for_stat(stat_id), value)
	if not error.is_empty():
		return {}
	return resolved


## `EquippedItem.from_content`: normalizes a weapon/armor row ({base_stats_level_1, growth_per_level}) at `level` or a
## rolled accessory instance ({main_stat, sub_stats}).
func equipped_item_from_content(item: Dictionary, level: int = 1) -> EquippedItem:
	error = ""
	var result: EquippedItem = EquippedItem.new()
	if item.has("main_stat") or item.has("sub_stats"):
		var rows: Array = [item.get("main_stat")]
		var sub_stats: Variant = item.get("sub_stats", [])
		if sub_stats is Array:
			rows.append_array(sub_stats)
		for row: Variant in rows:
			if not (row is Dictionary):
				continue
			var stat_id: Variant = (row as Dictionary).get("stat_id")
			if not (stat_id is String) or (stat_id as String).is_empty():
				_fail("Accessory stat is missing stat_id")
				return EquippedItem.new()
			var value: Dec = _decimal((row as Dictionary).get("value"), "accessory %s" % stat_id)
			var unit: Variant = (row as Dictionary).get("unit")
			if (stat_id as String).ends_with("_pct") or unit == "percent":
				var target: String = (stat_id as String).trim_suffix("_pct")
				result.percent_stats[target] = (result.percent_stats.get(target, Dec.from_int(0)) as Dec).add(value)
			else:
				var flat_target: String = (stat_id as String).trim_suffix("_flat")
				result.flat_stats[flat_target] = (result.flat_stats.get(flat_target, Dec.from_int(0)) as Dec).add(value)
		if not error.is_empty():
			return EquippedItem.new()
		return result

	var base_stats: Variant = item.get("base_stats_level_1", {})
	var growth: Variant = item.get("growth_per_level", {})
	if not (base_stats is Dictionary) or not (growth is Dictionary):
		_fail("Equipment base_stats_level_1 and growth_per_level must be mappings")
		return EquippedItem.new()
	var numeric_base: Dictionary = {}
	for key: String in base_stats:
		if _is_number(base_stats[key]):
			numeric_base[key] = base_stats[key]
	var resolved: Dictionary = base_stat_at_level(numeric_base, growth, level)
	if not error.is_empty():
		return EquippedItem.new()
	var flat: Dictionary = {}
	for key: String in resolved:
		if _CORE_STATS.has(key):
			flat[key] = Dec.from_int(int(resolved[key]))
	if level > 1:
		# Milestone bonus: a fraction of the item's level-1 stats once a milestone level has been passed.
		var bonus: Dec = equipment_bonus_pct(level)
		if not bonus.is_zero():
			for key: String in flat.keys():
				var level_one: Dec = _decimal(numeric_base.get(key, 0), key)
				flat[key] = (flat[key] as Dec).add(level_one.mul(bonus))
	result.flat_stats = flat
	var secondary_stat: Variant = (base_stats as Dictionary).get("secondary_stat")
	var secondary_value: Variant = (base_stats as Dictionary).get("secondary_value")
	if secondary_stat is String and (secondary_stat as String).ends_with("_pct") and _is_number(secondary_value):
		result.percent_stats[(secondary_stat as String).trim_suffix("_pct")] = _decimal(secondary_value, secondary_stat)
	if not error.is_empty():
		return EquippedItem.new()
	return result


# -- XP, costs, ascension --------------------------------------------------------------------------


## XP needed to advance from `level` (parses the authored curve string `xp_to_next(level) = a + b * level + c * level * level`).
func xp_to_next(level: int) -> int:
	error = ""
	if not _positive_level(level):
		return 0
	if _xp_curve_regex == null:
		_xp_curve_regex = RegEx.create_from_string(_XP_CURVE_PATTERN)
	var curve: Variant = _rules("character_progression").get("xp_curve")
	var found: RegExMatch = _xp_curve_regex.search(str(curve)) if curve != null else null
	if found == null:
		_fail("Unsupported character XP curve in content: %s" % ContentLoader.py_repr(curve))
		return 0
	var base: int = found.get_string(1).to_int()
	var linear: int = found.get_string(2).to_int()
	var quadratic: int = found.get_string(3).to_int()
	return base + linear * level + quadratic * level * level


func ascension_gate(character_level: int, account_level: int) -> AscensionRequirement:
	error = ""
	var requirement: AscensionRequirement = AscensionRequirement.new()
	if not _positive_level(character_level, "character_level") or not _positive_level(account_level, "account_level"):
		return requirement
	var progression: Dictionary = _rules("character_progression")
	var level_cap: int = _int_of(progression.get("level_cap", 20), 20)
	if character_level > level_cap:
		_fail("character_level exceeds the Part I level cap (%d)" % level_cap)
		return requirement
	var gates: Variant = progression.get("ascension")
	if not (gates is Array):
		_fail("character_progression.ascension must be an array")
		return requirement
	for gate: Dictionary in gates:
		var cap: int = int(gate["cap"])
		if character_level < cap:
			var required_account_level: int = int(gate["account_level"])
			requirement.next_cap = cap
			requirement.required_account_level = required_account_level
			for row: Dictionary in gate.get("items", []):
				var entry: AscensionItemRequirement = AscensionItemRequirement.new()
				entry.item_id = str(row["item_id"])
				entry.quantity = int(row["quantity"])
				requirement.items.append(entry)
			requirement.account_level_met = account_level >= required_account_level
			return requirement
	return requirement


## Silver Crowns to level up from `level` to `level + 1`.
func level_up_silver_crowns_cost(level: int) -> int:
	error = ""
	if not _positive_level(level):
		return 0
	var level_up: Variant = _rules("character_progression").get("level_up_silver_crowns")
	if not (level_up is Dictionary):
		_fail("character_progression.level_up_silver_crowns must be an object")
		return 0
	return _int_of((level_up as Dictionary).get("base", 100), 100) + level * _int_of((level_up as Dictionary).get("increment", 50), 50)


## Silver Crowns cost of the ascension gate at `character_level` (0 if there is none at this level).
func ascension_silver_crowns_cost(character_level: int) -> int:
	error = ""
	if not _positive_level(character_level, "character_level"):
		return 0
	var gates: Variant = _rules("character_progression").get("ascension")
	if not (gates is Array):
		return 0
	for gate: Dictionary in gates:
		if character_level == int(gate["cap"]) - 1:
			return _int_of(gate.get("silver_crowns_cost", 0), 0)
	return 0


## Number of ascension gates a character must have passed to stand at `level`.
func ascensions_required_for_level(level: int) -> int:
	error = ""
	if not _positive_level(level):
		return 0
	var gates: Variant = _rules("character_progression").get("ascension")
	if not (gates is Array):
		return 0
	var count: int = 0
	for gate: Dictionary in gates:
		if int(gate["cap"]) <= level:
			count += 1
	return count


# -- account level ---------------------------------------------------------------------------------


func account_xp_to_next(level: int) -> int:
	error = ""
	if not _positive_level(level):
		return 0
	var curve: Variant = _rules("account_progression").get("xp_to_next")
	if not (curve is Dictionary) or (curve as Dictionary).get("formula") != "base + (level - 1) * increment":
		_fail("Unsupported account XP curve in content: %s" % ContentLoader.py_repr(curve))
		return 0
	return int((curve as Dictionary)["base"]) + (level - 1) * int((curve as Dictionary)["increment"])


## Account level reached with `total_account_xp` lifetime XP (capped).
func account_level_for_xp(total_account_xp: int) -> int:
	error = ""
	if total_account_xp < 0:
		_fail("total_account_xp must be a non-negative integer")
		return 1
	var cap: int = _int_of(_rules("account_progression").get("level_cap", 20), 20)
	var level: int = 1
	var remaining: int = total_account_xp
	while level < cap:
		var needed: int = account_xp_to_next(level)
		if not error.is_empty():
			return 1
		if remaining < needed:
			break
		remaining -= needed
		level += 1
	return level


# -- equipment levels ------------------------------------------------------------------------------


func _linear_cost(block: Variant, level: int, name: String) -> int:
	if not _positive_level(level):
		return 0
	if not (block is Dictionary) or (block as Dictionary).get("formula") != "base + level * increment":
		_fail("Unsupported equipment %s formula: %s" % [name, ContentLoader.py_repr(block)])
		return 0
	return int((block as Dictionary)["base"]) + level * int((block as Dictionary)["increment"])


func equipment_level_cap() -> int:
	error = ""
	return _int_of(_rules("equipment_progression").get("level_cap", 20), 20)


## Weapon Tempering XP to go from `level` to `level + 1`.
func equipment_xp_to_next(level: int) -> int:
	error = ""
	return _linear_cost(_rules("equipment_progression").get("xp_to_next"), level, "xp_to_next")


func equipment_level_up_silver_crowns_cost(level: int) -> int:
	error = ""
	return _linear_cost(_rules("equipment_progression").get("level_up_silver_crowns"), level, "level_up_silver_crowns")


func _equipment_milestones() -> Array[EquipmentMilestone]:
	var milestones: Array[EquipmentMilestone] = []
	var rules: Dictionary = _rules("equipment_progression")
	var item_id: String = str(rules.get("milestone_item_id", ""))
	for row: Dictionary in rules.get("milestones", []):
		var milestone: EquipmentMilestone = EquipmentMilestone.new()
		milestone.from_level = int(row["from_level"])
		milestone.item_id = item_id
		milestone.item_quantity = int(row["item_quantity"])
		milestone.bonus_pct = _decimal(row["bonus_pct_of_level_1_stats"], "milestone bonus")
		milestones.append(milestone)
	return milestones


## The milestone paid on the `level` -> `level + 1` step, or null.
func equipment_milestone_for_step(level: int) -> EquipmentMilestone:
	error = ""
	for milestone: EquipmentMilestone in _equipment_milestones():
		if milestone.from_level == level:
			return milestone
	return null


## Milestone bonus (fraction of level-1 stats) active at `level`.
func equipment_bonus_pct(level: int) -> Dec:
	var best: Dec = Dec.from_int(0)
	for milestone: EquipmentMilestone in _equipment_milestones():
		if level > milestone.from_level and milestone.bonus_pct.greater_than(best):
			best = milestone.bonus_pct
	return best


# -- skill ranks and Memory Nodes ------------------------------------------------------------------


func skill_max_rank(skill_type: String) -> int:
	error = ""
	var by_type: Variant = _rules("skill_progression").get("max_rank_by_skill_type", {})
	var maximum: Variant = (by_type as Dictionary).get(skill_type) if by_type is Dictionary else null
	if not _is_whole(maximum):
		_fail("Unknown skill type for ranks: %s" % ContentLoader.py_repr(skill_type))
		return 0
	return int(maximum)


## Factor applied to a skill's damage/heal/shield multipliers at `rank`: `1 + bonus * (rank - 1)` as a double.
func skill_rank_multiplier(rank: int) -> float:
	error = ""
	if not _positive_level(rank, "rank"):
		return 0.0
	var bonus: Dec = _decimal(_rules("skill_progression").get("damage_heal_shield_multiplier_bonus_per_rank"), "skill rank bonus")
	return Dec.from_int(1).add(bonus.mul_int(rank - 1)).to_float()


## What raising `current_rank` -> `current_rank + 1` costs; null at max rank.
func skill_upgrade_requirement(skill_type: String, current_rank: int) -> SkillUpgradeRequirement:
	var maximum: int = skill_max_rank(skill_type)
	if not error.is_empty() or current_rank >= maximum:
		return null
	var rules: Dictionary = _rules("skill_progression")
	var to_rank: int = current_rank + 1
	var requirement: SkillUpgradeRequirement = SkillUpgradeRequirement.new()
	requirement.to_rank = to_rank
	requirement.required_character_level = int(rules["unlock_character_level"][skill_type][str(to_rank)])
	var item: Variant = (rules["upgrade_item_by_skill_type"] as Dictionary).get(skill_type)
	requirement.item_id = item if item is String else ""
	var cost: Dictionary = rules["upgrade_cost"][str(to_rank)]
	requirement.item_quantity = int(cost["item_quantity"])
	requirement.silver_crowns = int(cost["silver_crowns"])
	return requirement


func memory_nodes() -> Array[MemoryNode]:
	error = ""
	var nodes: Array[MemoryNode] = []
	var rows: Variant = _battle_rules.get("memory_nodes")
	if not (rows is Array) or (rows as Array).is_empty():
		_fail("battle_rules_part1.json is missing memory_nodes")
		return nodes
	for row: Dictionary in rows:
		var effect: Dictionary = row["effect"]
		var node: MemoryNode = MemoryNode.new()
		node.node = int(row["node"])
		node.shard_cost = int(row["shard_cost"])
		node.effect_type = str(effect["type"])
		var stat: Variant = effect.get("stat")
		node.stat = stat if stat is String else ""
		node.value = _decimal(effect["value"], "memory node value")
		nodes.append(node)
	for index: int in range(nodes.size()):
		if nodes[index].node != index + 1:
			_fail("memory_nodes must be numbered 1..N in order")
			return []
	return nodes
