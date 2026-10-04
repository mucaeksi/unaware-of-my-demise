class_name VictoryStarRules
extends RefCounted
## `battle_rules_part1.json` `victory_stars` block, validated once (port of core/battle/models.py VictoryStarRules).
## The tiers are named conditions; an unknown one fails at BattleService construction instead of scoring wrong.

const _CONDITIONS: Array[String] = [
	"all_selected_heroes_alive", "exactly_one_selected_hero_defeated", "at_least_two_selected_heroes_defeated",
]

var three_stars: String = ""
var two_stars: String = ""
var one_star: String = ""
var defeat_stars: int = 0
var loaned_story_heroes_count: bool = false

## Validation problem of `from_mapping` ("" = ok).
var error: String = ""


static func from_mapping(rules: Dictionary) -> VictoryStarRules:
	var result: VictoryStarRules = VictoryStarRules.new()
	for key: String in ["three_stars", "two_stars", "one_star"]:
		var condition: Variant = rules.get(key)
		if not (condition is String) or not _CONDITIONS.has(condition):
			result.error = "Unsupported victory_stars.%s condition: %s" % [key, ContentLoader.py_repr(condition)]
			return result
		result.set(key, condition)
	if rules.get("victory_requires_at_least_one_living_hero") != true:
		result.error = "The engine only supports victory_requires_at_least_one_living_hero = true"
		return result
	var defeat: Variant = rules.get("defeat_stars")
	if not (defeat is int or defeat is float) or float(defeat) != floorf(float(defeat)) or int(defeat) < 0:
		result.error = "victory_stars.defeat_stars must be a non-negative integer"
		return result
	result.defeat_stars = int(defeat)
	var loaned: Variant = rules.get("loaned_story_heroes_count_as_selected_heroes")
	if not (loaned is bool):
		result.error = "victory_stars.loaned_story_heroes_count_as_selected_heroes must be a boolean"
		return result
	result.loaned_story_heroes_count = loaned
	return result


static func _holds(condition: String, fallen: int) -> bool:
	match condition:
		"all_selected_heroes_alive":
			return fallen == 0
		"exactly_one_selected_hero_defeated":
			return fallen == 1
		"at_least_two_selected_heroes_defeated":
			return fallen >= 2
	return false


## Stars for an outcome ("victory" | "defeat"); -1 if no tier matches (the reference raises ValueError).
func stars(outcome: String, units: Array) -> int:
	if outcome != "victory":
		return defeat_stars
	var fallen: int = 0
	for unit: BattleUnit in units:
		if unit.team == "player" and (loaned_story_heroes_count or not unit.temporary) and not unit.alive:
			fallen += 1
	for tier: Array in [[3, three_stars], [2, two_stars], [1, one_star]]:
		if _holds(String(tier[1]), fallen):
			return int(tier[0])
	return -1
