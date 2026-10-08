class_name BattleUnit
extends RefCounted
## Mutable, battle-local unit (port of core/battle/models.py BattleUnit). Content records stay immutable; HP, gauge,
## statuses and shields change during one encounter. Statuses, shields and modifiers are plain Dictionaries with the
## reference's key names: they are part of the event/replay contract.
##
## `str | None` fields are "" when absent; build units with `BattleUnit.build({...})`, which applies the reference's
## `__post_init__` (max_hp/hp defaults, row from slot, HP clamp, alive).

var entity_id: String = ""
var team: String = ""
var slot_index: int = 0
## Stat id -> number (ints once resolved). `status_immunities_runtime` (an Array of Dictionaries) also lives here.
var stats: Dictionary = {}
var hp: int = 0
var max_hp: int = 0
var element: String = ""
var row: String = ""
var weaknesses: Array[String] = []
var resistances: Array[String] = []
var status_immunities: Array[String] = []
var faction_id: String = ""
var tags: Array[String] = []  # a set: unique entries
var stat_resolution_rules: Dictionary = {}
var status_definitions: Dictionary = {}
var statuses: Dictionary = {}  # status id -> Dictionary
var shields: Array[Dictionary] = []
var stat_modifiers: Array[Dictionary] = []
var damage_modifiers: Array[Dictionary] = []
var redirects: Array[Dictionary] = []
var counters: Array[Dictionary] = []
var next_attack_bonuses: Array[Dictionary] = []
var cooldowns: Dictionary = {}  # skill id -> turns
var focus: int = 0
var gauge: Frac = Frac.of(0)
var pending_delay_gauge: Frac = Frac.of(0)
var alive: bool = true
var is_boss: bool = false
var is_objective: bool = false
var objective_id: String = ""
var level: int = 1
var enemy_id: String = ""
var temporary: bool = false
## skill id -> rank (absent = rank 1, the authored kit). Set from the player's saved ranks; enemies never have ranks.
var skill_ranks: Dictionary = {}
var hit_focus_gained_this_turn: int = 0
var has_acted: bool = false
var damage_taken_this_round: int = 0
## Hits still blocked by `block_attack` (the reference sets this attribute dynamically).
var blocked_attack_hits: int = 0

const _OPTION_KEYS: Array[String] = [
	"entity_id", "team", "slot_index", "stats", "hp", "max_hp", "element", "row", "weaknesses", "resistances",
	"status_immunities", "faction_id", "tags", "stat_resolution_rules", "status_definitions", "is_boss",
	"is_objective", "objective_id", "level", "enemy_id", "temporary",
]


## Builds a unit from keyword-style options (same names as the reference dataclass) and runs `__post_init__`.
static func build(options: Dictionary) -> BattleUnit:
	var unit: BattleUnit = BattleUnit.new()
	for key: String in options:
		if not _OPTION_KEYS.has(key):
			push_error("BattleUnit.build: unknown option " + key)
			continue
		match key:
			"weaknesses", "resistances", "status_immunities", "tags":
				var target: Array[String] = []
				for item: Variant in options[key]:
					if not target.has(String(item)):
						target.append(String(item))
				unit.set(key, target)
			_:
				unit.set(key, options[key])
	var max_hp_given: bool = options.has("max_hp") and options["max_hp"] != null
	var hp_given: bool = options.has("hp") and options["hp"] != null
	if not max_hp_given:
		unit.max_hp = maxi(1, int(unit.stats.get("hp", 1)))
	if not hp_given:
		unit.hp = unit.max_hp
	if not options.has("row") or String(options["row"]).is_empty():
		unit.row = "front" if unit.slot_index < 2 else "rear"
	unit.hp = maxi(0, mini(unit.hp, unit.max_hp))
	unit.alive = unit.alive and unit.hp > 0
	return unit


## GDD-compatible alias used by the Action Gauge pseudocode.
func unit_id() -> String:
	return entity_id


func effective_speed() -> int:
	return maxi(1, effective_stat("spd"))


func shield_total() -> int:
	var total: int = 0
	for layer: Dictionary in shields:
		total += maxi(0, int(layer.get("amount", 0)))
	return total


## Resolved stat with modifiers and status multipliers, rounded half up (the contract; Python's round() is banker's).
func effective_stat(stat_id: String) -> int:
	var base: float = float(stats.get(stat_id, 0))
	var flat: float = 0.0
	var pct: float = 0.0
	for modifier: Dictionary in stat_modifiers:
		if modifier.get("stat_id") == stat_id:
			if modifier.get("mode") == "flat":
				flat += float(modifier.get("amount", 0))
			elif modifier.get("mode") == "percent":
				pct += float(modifier.get("amount", 0))
	var status_multiplier: float = 1.0
	if stat_id == "def" and statuses.has("fracture"):
		var definition: Dictionary = status_definitions.get("fracture", {})
		status_multiplier *= float((statuses["fracture"] as Dictionary).get("def_multiplier", definition.get("def_multiplier", 0.85)))
	var value: float = (base + flat) * (1.0 + pct) * status_multiplier
	var result: int = int(value + 0.5) if value >= 0.0 else int(value - 0.5)
	if stat_id == "hp":
		return maxi(int(stat_resolution_rules.get("minimum_hp", 1)), result)
	if stat_id == "def" or stat_id == "res":
		var resolved: int = maxi(int(stat_resolution_rules.get("minimum_defense", 0)), result)
		var has_res: bool = stats.has("res")
		if statuses.has("dawnward") and (stat_id == "res" or (stat_id == "def" and not has_res)):
			var dawn_definition: Dictionary = status_definitions.get("dawnward", {})
			var bonus: Variant = (statuses["dawnward"] as Dictionary).get("resistance_bonus_pct", dawn_definition.get("resistance_bonus_pct", 0.1))
			resolved = int(float(resolved) * (1.0 + float(bonus)) + 0.5)
		return resolved
	if stat_id == "spd":
		return maxi(int(stat_resolution_rules.get("minimum_speed", 1)), result)
	return result


func has_status(status_id: String) -> bool:
	return statuses.has(status_id) and int((statuses[status_id] as Dictionary).get("duration_turns", 0)) > 0


## Tags of one status: its own `tags` plus the definition's (unit_status_tags in the reference).
func status_tags(status_id: String, definitions: Dictionary) -> Array[String]:
	var found: Array[String] = []
	var status: Dictionary = statuses.get(status_id, {})
	for tag: Variant in status.get("tags", []):
		if not found.has(String(tag)):
			found.append(String(tag))
	var definition: Dictionary = definitions.get(status_id, {})
	for tag: Variant in definition.get("tags", []):
		if not found.has(String(tag)):
			found.append(String(tag))
	return found
