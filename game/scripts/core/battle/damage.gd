class_name Damage
extends RefCounted
## Part I damage resolution with defense type and element kept independent (port of core/battle/damage.py).
##
## Defense selection depends only on the damage type; affinity only on the element and the defender's explicit
## weakness/resistance lists; the two multiply in the final formula. The float operation order is the reference's
## (all doubles), because `floor(raw)` decides the damage.

const ELEMENTS: Array[String] = ["Ember", "Gale", "Stone", "Tide", "Dawn", "Veil"]
const DAMAGE_TYPES: Array[String] = ["physical", "magic", "elemental"]
const ELEMENT_CYCLE: Array[String] = ["Ember", "Gale", "Stone", "Tide"]


class DamageResult extends RefCounted:
	var damage: int = 0
	var critical: bool = false
	var defense_stat: String = ""
	var effective_defense: int = 0
	var element_multiplier: float = 1.0
	var raw_damage: float = 0.0
	var shield_absorbed: int = 0
	var hp_damage: int = 0
	## Non-empty when the reference raises ValueError (unknown damage type/element, negative multiplier ...).
	var error: String = ""


## What the formula reads from the attacker: `effective_stat("atk")`, `stats` (crit), statuses and damage modifiers.
## A BattleUnit is used as is; non-ATK scale stats get a read-only view (`ScaledAttacker` in the reference).
class Attacker extends RefCounted:
	var atk: int = 0
	var stats: Dictionary = {}
	var statuses: Dictionary = {}
	var damage_modifiers: Array[Dictionary] = []
	var status_definitions: Dictionary = {}

	static func of_unit(unit: BattleUnit) -> Attacker:
		var view: Attacker = Attacker.new()
		view.atk = unit.effective_stat("atk")
		view.stats = unit.stats
		view.statuses = unit.statuses
		view.damage_modifiers = unit.damage_modifiers
		view.status_definitions = unit.status_definitions
		return view

	## The read-only ATK view for authored non-ATK scale-stat damage: stats copy with "atk" replaced.
	static func scaled(unit: BattleUnit, attack: int) -> Attacker:
		var view: Attacker = Attacker.new()
		view.stats = unit.stats.duplicate()
		view.stats["atk"] = attack
		view.atk = int(view.stats.get("atk", 0))
		view.statuses = unit.statuses
		view.damage_modifiers = unit.damage_modifiers
		view.status_definitions = unit.status_definitions
		return view


## Chooses DEF for physical and RES -> DEF fallback for magic/elemental: [stat id, effective defense].
static func defense_stat_for_damage_type(damage_type: String, defender: BattleUnit, damage_rules: Dictionary) -> Array:
	var by_type: Dictionary = damage_rules.get("defense_stat_by_damage_type", {})
	var stat_id: String = String(by_type.get(damage_type, "def" if damage_type == "physical" else "res"))
	if not defender.stats.has(stat_id):
		stat_id = String(damage_rules.get("missing_res_stat_fallback", "def"))
	var value: int = defender.effective_stat(stat_id)
	return [stat_id, maxi(0, value)]


## The elemental chart / explicit affinity multiplier; -1.0 with `error` set when the reference raises ValueError.
static func element_multiplier(attacking: String, defending: String, weaknesses: Array[String], resistances: Array[String], damage_rules: Dictionary, error_out: Array = []) -> float:
	if attacking.is_empty() or defending.is_empty():
		return 1.0
	if not ELEMENTS.has(attacking) or not ELEMENTS.has(defending):
		error_out.append("Unknown element pair: %s -> %s" % [ContentLoader.py_repr(attacking), ContentLoader.py_repr(defending)])
		return 1.0
	var chart: Dictionary = damage_rules.get("element_chart", {})
	for element: String in weaknesses:
		if resistances.has(element):
			error_out.append("Element cannot be both weakness and resistance: %s" % element)
			return 1.0
	if weaknesses.has(attacking):
		return float(chart.get("explicit_target_weakness_multiplier", 1.2))
	if resistances.has(attacking):
		return float(chart.get("explicit_target_resistance_multiplier", 0.9))
	var cycle: Array = chart.get("cycle", ELEMENT_CYCLE)
	if bool(chart.get("attacker_is_strong_against_next_element", true)) and cycle.has(attacking):
		var index: int = cycle.find(attacking)
		if defending == String(cycle[(index + 1) % cycle.size()]):
			return float(chart.get("advantage_multiplier", 1.2))
		if defending == String(cycle[posmod(index - 1, cycle.size())]):
			return float(chart.get("disadvantage_multiplier", 0.9))
	elif (attacking == "Dawn" and defending == "Veil") or (attacking == "Veil" and defending == "Dawn"):
		return float(chart.get("advantage_multiplier", 1.2))
	return float(chart.get("neutral_multiplier", 1.0))


static func _status_multiplier(statuses: Dictionary, key: String, definitions: Dictionary) -> float:
	var value: float = 1.0
	var property_name: String = "damage_taken_multiplier" if key == "incoming" else "outgoing_damage_multiplier"
	for status_id: String in statuses:
		var status: Dictionary = statuses[status_id]
		var definition: Dictionary = definitions.get(status_id, {})
		if status.has(property_name) or definition.has(property_name):
			var modifier: Variant = status[property_name] if status.has(property_name) else definition[property_name]
			value *= float(modifier)
	return value


## Calculates and applies one damage packet to `defender` (its shields, HP and alive flag change).
static func calculate_damage(
	attacker: Attacker,
	defender: BattleUnit,
	damage_type: String,
	element: String,
	multiplier: float,
	rng: CpythonRandom,
	damage_rules: Dictionary,
	status_definitions: Dictionary,
	shield_damage_multiplier: float = 1.0,
	apply_shields: bool = true,
	modifiers: Array[float] = [],
	critical_chance: Variant = null,
	critical_multiplier: Variant = null
) -> DamageResult:
	var result: DamageResult = DamageResult.new()
	if not DAMAGE_TYPES.has(damage_type):
		result.error = "Unknown damage_type %s" % ContentLoader.py_repr(damage_type)
		return result
	if not element.is_empty() and not ELEMENTS.has(element):
		result.error = "Unknown attacking element %s" % ContentLoader.py_repr(element)
		return result
	if multiplier < 0.0:
		result.error = "Damage multiplier cannot be negative"
		return result
	if shield_damage_multiplier < 0.0:
		result.error = "Shield damage multiplier cannot be negative"
		return result
	var defense_info: Array = defense_stat_for_damage_type(damage_type, defender, damage_rules)
	var affinity_errors: Array = []
	var affinity: float = element_multiplier(element, defender.element, defender.weaknesses, defender.resistances, damage_rules, affinity_errors)
	if not affinity_errors.is_empty():
		result.error = String(affinity_errors[0])
		return result
	var other: float = 1.0
	other *= _status_multiplier(attacker.statuses, "outgoing", status_definitions)
	other *= _status_multiplier(defender.statuses, "incoming", status_definitions)
	if defender.statuses.has("soaked"):
		var soaked_rules: Dictionary = (status_definitions.get("soaked", {}) as Dictionary).get("element_damage_taken_multiplier", {})
		other *= float(soaked_rules.get(element, 1.0))
	for amount: float in modifiers:
		other *= amount
	for modifier: Dictionary in attacker.damage_modifiers:
		if modifier.get("kind") == "outgoing" and int(modifier.get("hits_remaining", 1)) > 0:
			other *= float(modifier.get("multiplier", 1.0))
	for modifier: Dictionary in defender.damage_modifiers:
		if modifier.get("kind") == "incoming" and int(modifier.get("hits_remaining", 1)) > 0:
			other *= float(modifier.get("multiplier", 1.0))
	var crit_chance: float = float(critical_chance) if critical_chance != null else float(attacker.stats.get("crit_rate", damage_rules.get("critical_chance_default", 0.05)))
	var crit_cap: float = float(damage_rules.get("critical_chance_cap", 1.0))
	crit_chance = maxf(0.0, minf(crit_cap, crit_chance))
	var crit_mult: float = float(critical_multiplier) if critical_multiplier != null else float(attacker.stats.get("crit_damage", damage_rules.get("critical_multiplier_default", 1.5)))
	var critical: bool = rng.random() < crit_chance
	var defense_scale: float = float(damage_rules.get("defense_scale", 10.0))
	if defense_scale <= 0.0:
		result.error = "Damage defense_scale must be greater than zero"
		return result
	var defense: int = int(defense_info[1])
	var raw: float = float(attacker.atk) * multiplier * (defense_scale / (defense_scale + float(maxi(0, defense)))) * affinity * other
	if critical:
		raw *= crit_mult
	var resolved_damage: int = maxi(int(damage_rules.get("minimum_final_damage", 1)), floori(raw))
	var absorbed: int = 0
	var remaining: int = resolved_damage
	if apply_shields:
		var shield_budget: int = floori(float(resolved_damage) * shield_damage_multiplier)
		var shield_points_consumed: int = 0
		for shield: Dictionary in defender.shields.duplicate():
			if shield_budget <= 0:
				break
			var available: int = maxi(0, int(shield.get("amount", 0)))
			var consumed: int = mini(available, shield_budget)
			shield["amount"] = available - consumed
			shield_points_consumed += consumed
			shield_budget -= consumed
			if int(shield["amount"]) <= 0:
				BattleUtil.remove_first_equal(defender.shields, shield)
		absorbed = shield_points_consumed
		if shield_damage_multiplier > 0.0:
			var prevented_base_damage: int = mini(resolved_damage, ceili(float(shield_points_consumed) / shield_damage_multiplier))
			remaining = maxi(0, resolved_damage - prevented_base_damage)
	var hp_damage: int = mini(defender.hp, remaining)
	defender.hp = maxi(0, defender.hp - hp_damage)
	if defender.hp <= 0:
		defender.alive = false
	defender.damage_taken_this_round += resolved_damage
	result.damage = resolved_damage
	result.critical = critical
	result.defense_stat = String(defense_info[0])
	result.effective_defense = defense
	result.element_multiplier = affinity
	result.raw_damage = raw
	result.shield_absorbed = absorbed
	result.hp_damage = hp_damage
	return result
