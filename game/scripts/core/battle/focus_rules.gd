class_name FocusRules
extends RefCounted
## `battle_rules_part1.json` `focus` block, the engine's single source (port of core/battle/models.py FocusRules).
## Defaults equal the authored Part I values so a BattleState built without a service behaves like a real one.

var maximum: int = 100
var basic_attack_gain: int = 20
var active_skill_gain: int = 25
var taking_hit_gain_per_hit: int = 5
var taking_hit_gain_max_per_actor_turn: int = 15
var ultimate_cost: int = 100
var death_resets_focus: bool = true

## Last validation problem of `from_mapping` ("" = ok).
var error: String = ""


static func from_mapping(rules: Dictionary) -> FocusRules:
	var result: FocusRules = FocusRules.new()
	for key: String in ["maximum", "basic_attack_gain", "active_skill_gain", "taking_hit_gain_per_hit",
			"taking_hit_gain_max_per_actor_turn", "ultimate_cost"]:
		var value: Variant = rules.get(key)
		if not (value is int or value is float) or float(value) != floorf(float(value)) or int(value) < 0:
			result.error = "battle_rules focus.%s must be a non-negative integer" % key
			return result
		result.set(key, int(value))
	var resets: Variant = rules.get("death_resets_focus")
	if not (resets is bool):
		result.error = "battle_rules focus.death_resets_focus must be a boolean"
		return result
	result.death_resets_focus = resets
	return result


## Focus a unit gains from one damaging hit this actor turn.
func hit_gain(already_gained_this_turn: int) -> int:
	return mini(taking_hit_gain_per_hit, maxi(0, taking_hit_gain_max_per_actor_turn - already_gained_this_turn))


func action_gain(action_type: String) -> int:
	if action_type == "basic":
		return basic_attack_gain
	if action_type == "active":
		return active_skill_gain
	return 0
