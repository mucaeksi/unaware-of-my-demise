class_name PlayerState
extends RefCounted
## One server-issued snapshot of the player (DEC-0012), read-only on the client. Replaces the local SQLite save of the LEGACY build:
## the screens read from here, every change goes through `GameBackend` and comes back as a new snapshot.
##
## Snapshot shape (JSON object, versioned by "schema_version"):
##   story_state  the `StoryState.to_persisted_dict` form (cursor, completed stages, owned heroes, First Oath)
##   wallet       {"silver_crowns", "eclipse_tokens", "account_xp", ...} ints
##   items        {item_id: quantity}
##   roster       {character_id: {"level", "xp", "xp_to_next" (-1 = none), "ascension", "level_cap",
##                 "level_up_silver_crowns" (-1 = none), "memory_shards", "memory_nodes", "skill_ranks": {skill_id: rank}}}
##   inventory    {"inventory_weapons" | "inventory_armor" | "inventory_accessories": [{"instance_id", "template_id", "level",
##                 "locked", "equipped_character_id" (null = none), "equip_slot", "payload"}]} in acquisition order
## Numbers arrive as JSON floats (Godot parses every JSON number as float); every accessor converts by its schema.

const SCHEMA_VERSION: int = 1
const EQUIPMENT_TABLES: Array[String] = ["inventory_weapons", "inventory_armor", "inventory_accessories"]

var story_state: StoryState.PlayerStoryState = null
var _data: Dictionary = {}
## Why `from_snapshot` rejected the data ("" = it did not).
var error: String = ""


static func from_snapshot(data: Variant, story: StoryState) -> PlayerState:
	var state: PlayerState = PlayerState.new()
	if not (data is Dictionary):
		state.error = "player snapshot is not a JSON object"
		return state
	var snapshot: Dictionary = data
	if int(snapshot.get("schema_version", -1)) != SCHEMA_VERSION:
		state.error = "player snapshot schema_version %s is not %d" % [str(snapshot.get("schema_version")), SCHEMA_VERSION]
		return state
	var story_data: Variant = snapshot.get("story_state")
	if not (story_data is Dictionary):
		state.error = "player snapshot has no story_state object"
		return state
	state.story_state = story.from_persisted_dict(story_data)
	if state.story_state == null:
		state.error = "player snapshot story_state is invalid: %s" % story.error
		return state
	state._data = snapshot
	return state


func is_valid() -> bool:
	return error.is_empty() and story_state != null


func _section(name: String) -> Dictionary:
	var value: Variant = _data.get(name)
	return value if value is Dictionary else {}


func wallet() -> Dictionary:
	var result: Dictionary = {}
	var raw: Dictionary = _section("wallet")
	for key: String in raw:
		result[key] = int(raw[key])
	return result


func item_quantity(item_id: String) -> int:
	return int(_section("items").get(item_id, 0))


func _roster_entry(character_id: String) -> Dictionary:
	var entry: Variant = _section("roster").get(character_id)
	return entry if entry is Dictionary else {}


func roster_ids() -> Array[String]:
	var ids: Array[String] = []
	for character_id: String in _section("roster"):
		ids.append(character_id)
	return ids


func level(character_id: String) -> int:
	return int(_roster_entry(character_id).get("level", 1))


## The roster numbers the team screen shows (level, xp, xp_to_next, ascension, level_cap, level_up_silver_crowns); missing = defaults.
func progress(character_id: String) -> Dictionary:
	var entry: Dictionary = _roster_entry(character_id)
	return {
		"level": int(entry.get("level", 1)),
		"xp": int(entry.get("xp", 0)),
		"xp_to_next": int(entry.get("xp_to_next", -1)),
		"ascension": int(entry.get("ascension", 0)),
		"level_cap": int(entry.get("level_cap", 20)),
		"level_up_silver_crowns": int(entry.get("level_up_silver_crowns", -1)),
	}


## [memory shards, unlocked Memory Nodes].
func memory(character_id: String) -> Array[int]:
	var entry: Dictionary = _roster_entry(character_id)
	return [int(entry.get("memory_shards", 0)), int(entry.get("memory_nodes", 0))]


## skill_id -> rank (only the skills above rank 1 need to be present).
func skill_ranks(character_id: String) -> Dictionary:
	var result: Dictionary = {}
	var raw: Variant = _roster_entry(character_id).get("skill_ranks")
	if raw is Dictionary:
		for skill_id: String in raw:
			result[skill_id] = int((raw as Dictionary)[skill_id])
	return result


func skill_rank(character_id: String, skill_id: String) -> int:
	return int(skill_ranks(character_id).get(skill_id, 1))


## The instances of one equipment table, each normalized (ints, bool, null owner) as the LEGACY repository returned them.
func instances(table: String) -> Array[Dictionary]:
	var rows: Array[Dictionary] = []
	var raw: Variant = _section("inventory").get(table)
	if not (raw is Array):
		return rows
	for item: Variant in raw:
		if not (item is Dictionary):
			continue
		var record: Dictionary = item
		var owner: Variant = record.get("equipped_character_id")
		rows.append({
			"instance_id": str(record.get("instance_id", "")),
			"template_id": str(record.get("template_id", "")),
			"level": int(record.get("level", 1)),
			"locked": bool(record.get("locked", false)),
			"equipped_character_id": str(owner) if owner is String and not (owner as String).is_empty() else null,
			"equip_slot": str(record.get("equip_slot", "")),
			"payload": record.get("payload") if record.get("payload") is Dictionary else null,
		})
	return rows
