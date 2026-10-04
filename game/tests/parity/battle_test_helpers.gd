class_name BattleTestHelpers
extends RefCounted
## Shared builders for the battle unit tests (ports of tests/test_battle_*.py).


static func make_unit(entity_id: String, team: String, slot: int, hp: int = 1000, atk: int = 50, defense: int = 50,
		speed: int = 100, element: String = "Stone", row: String = "") -> BattleUnit:
	var options: Dictionary = {
		"entity_id": entity_id, "team": team, "slot_index": slot,
		"stats": {"hp": hp, "atk": atk, "def": defense, "spd": speed, "crit_rate": 0.0},
		"hp": hp, "max_hp": hp, "element": element,
	}
	if not row.is_empty():
		options["row"] = row
	return BattleUnit.build(options)


static func state_of(units: Array[BattleUnit], actor: BattleUnit = null) -> BattleState:
	var state: BattleState = BattleState.make(units)
	state.actor = actor
	return state


static func registry() -> ContentModels.ContentRegistry:
	var loader: ContentLoader = ContentLoader.new()
	return loader.load_dir("res://data/content")


static func interpreter(content: ContentModels.ContentRegistry, seed_value: int = 0) -> EffectInterpreter:
	return EffectInterpreter.create(content, CpythonRandom.create_from_int(seed_value))


static func service(content: ContentModels.ContentRegistry) -> BattleService:
	var story: StoryState = StoryState.new(content, StoryState.load_manifest("res://data/content"))
	return BattleService.create(content, story)


static func statuses_with(unit: BattleUnit, status_id: String, status: Dictionary) -> void:
	unit.statuses[status_id] = status
