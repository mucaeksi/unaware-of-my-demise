class_name StoryState
extends RefCounted
## Player story progression, story recruits, First Oath selector claims and battle loans (port of core/story_state.py).
##
## Engine-neutral state layer. Story beats come from `story_script_part1_manifest.json`, party limits from the
## battle rules, stage guests from the loaded Stage records. Transitions never mutate their input: they return a new
## PlayerStoryState (or null with `error` set where the reference raises ValueError/TypeError).

const STORY_LOAN_EQUIPMENT_TEMPLATE_ID: String = "story_loan_standard"


## One deployed hero; `level` is null when the player's saved build is loaded.
class BattleSlot extends RefCounted:
	var slot_index: int = 0
	var position: String = "front"  # "front" | "rear"
	var character_id: String = ""
	var temporary: bool = false
	var level: Variant = null  # int | null
	var equipment_template_id: String = ""  # "" = none


## Save-state fields owned by the Part I story state machine. Sets are Dictionaries (id -> true).
class PlayerStoryState extends RefCounted:
	var completed_stage_ids: Dictionary = {}
	var owned_character_ids: Dictionary = {}
	var first_oath_invitation_claimed: bool = false
	var first_oath_invitation_selection: String = ""  # "" = none
	var first_oath_invitation_available: bool = false
	## Index into the manifest's flat `story_order` of the next entry not yet presented.
	var story_cursor: int = 0
	## Characters the server granted (gacha) that the client mirrors; also in owned_character_ids but never story-derived.
	var online_character_ids: Dictionary = {}

	func copy() -> PlayerStoryState:
		var result: PlayerStoryState = PlayerStoryState.new()
		result.completed_stage_ids = completed_stage_ids.duplicate()
		result.owned_character_ids = owned_character_ids.duplicate()
		result.first_oath_invitation_claimed = first_oath_invitation_claimed
		result.first_oath_invitation_selection = first_oath_invitation_selection
		result.first_oath_invitation_available = first_oath_invitation_available
		result.story_cursor = story_cursor
		result.online_character_ids = online_character_ids.duplicate()
		return result

	## owned_character_ids minus online_character_ids, sorted.
	func story_owned_character_ids() -> Array[String]:
		var ids: Array[String] = []
		for character_id: String in owned_character_ids:
			if not online_character_ids.has(character_id):
				ids.append(character_id)
		ids.sort()
		return ids


var _registry: ContentModels.ContentRegistry = null
var _manifest: Dictionary = {}

## Last rejected call ("" = the last call succeeded); reset by every public call.
var error: String = ""
## Non-fatal notes of the last call (the reference's log warnings/infos).
var notes: Array[String] = []


func _init(registry: ContentModels.ContentRegistry, story_manifest: Dictionary) -> void:
	_registry = registry
	_manifest = story_manifest


## Loads `story_script_part1_manifest.json` from a content directory ({} + error on failure).
static func load_manifest(content_dir: String) -> Dictionary:
	var path: String = content_dir.path_join("story_script_part1_manifest.json")
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path)) if FileAccess.file_exists(path) else null
	if not (parsed is Dictionary):
		push_error("Unable to load story_script_part1_manifest.json")
		return {}
	return parsed


func _fail(message: String) -> void:
	if error.is_empty():
		error = message


func _begin() -> void:
	error = ""
	notes = []


# -- state construction and persistence ------------------------------------------------------------


func _starting_owned_ids() -> Array[String]:
	var ids: Array[String] = []
	for character: ContentModels.Character in _registry.characters.values():
		if character.acquisition is String and character.acquisition == "free_start":
			ids.append(character.character_id)
	return ids


## `PlayerStoryState()`: nothing completed, the free-start characters owned.
func new_player_state() -> PlayerStoryState:
	var state: PlayerStoryState = PlayerStoryState.new()
	for character_id: String in _starting_owned_ids():
		state.owned_character_ids[character_id] = true
	return state


func story_order() -> Array[String]:
	var order: Variant = _manifest.get("story_order")
	var result: Array[String] = []
	var valid: bool = order is Array
	if valid:
		for entry: Variant in order:
			if not (entry is String):
				valid = false
				break
			result.append(entry)
	if not valid:
		_fail("Story manifest story_order must be an array of strings")
		return []
	return result


static func _sorted_ids(set: Dictionary) -> Array[String]:
	var ids: Array[String] = []
	for key: String in set:
		ids.append(key)
	ids.sort()
	return ids


## Plain JSON-compatible form for storage (sets become sorted lists). `order` defaults to the manifest's story_order.
func to_persisted_dict(state: PlayerStoryState, order: Variant = null) -> Dictionary:
	_begin()
	var entries: Array[String] = []
	if order == null:
		entries = story_order()
	else:
		for entry: Variant in order:
			entries.append(String(entry))
	var cursor_entry: Variant = entries[state.story_cursor] if state.story_cursor < entries.size() else null
	return {
		"completed_stage_ids": _sorted_ids(state.completed_stage_ids),
		"owned_character_ids": _sorted_ids(state.owned_character_ids),
		"first_oath_invitation_claimed": state.first_oath_invitation_claimed,
		"first_oath_invitation_selection": null if state.first_oath_invitation_selection.is_empty() else state.first_oath_invitation_selection,
		"first_oath_invitation_available": state.first_oath_invitation_available,
		"story_cursor": state.story_cursor,
		"story_cursor_entry_id": cursor_entry,
		"online_character_ids": _sorted_ids(state.online_character_ids),
	}


static func _is_string_list(value: Variant) -> bool:
	if not (value is Array):
		return false
	for item: Variant in value:
		if not (item is String):
			return false
	return true


static func _is_whole(value: Variant) -> bool:
	if value is int:
		return true
	return value is float and is_finite(value) and value == floorf(value)


## Reconstructs a PlayerStoryState from `to_persisted_dict` output (null + `error` if malformed).
## The cursor is re-resolved through `story_cursor_entry_id` when content moved entries (see the reference).
func from_persisted_dict(data: Dictionary, order: Variant = null) -> PlayerStoryState:
	_begin()
	var completed: Variant = data.get("completed_stage_ids", [])
	var owned: Variant = data.get("owned_character_ids", [])
	if not _is_string_list(completed):
		_fail("Persisted completed_stage_ids must be a list of strings")
		return null
	if not _is_string_list(owned):
		_fail("Persisted owned_character_ids must be a list of strings")
		return null
	var claimed: Variant = data.get("first_oath_invitation_claimed", false)
	var selection: Variant = data.get("first_oath_invitation_selection")
	var available: Variant = data.get("first_oath_invitation_available", false)
	if not (claimed is bool) or not (available is bool):
		_fail("Persisted first_oath_invitation flags must be booleans")
		return null
	if selection != null and not (selection is String):
		_fail("Persisted first_oath_invitation_selection must be a string or null")
		return null
	# story_cursor defaults to 0 so saves written before the field existed still load.
	var raw_cursor: Variant = data.get("story_cursor", 0)
	if raw_cursor is bool or not _is_whole(raw_cursor) or int(raw_cursor) < 0:
		_fail("Persisted story_cursor must be a non-negative integer")
		return null
	var cursor: int = int(raw_cursor)
	var online: Variant = data.get("online_character_ids", [])
	if not _is_string_list(online):
		_fail("Persisted online_character_ids must be a list of strings")
		return null
	var entry_id: Variant = data.get("story_cursor_entry_id")
	if entry_id != null:
		if not (entry_id is String):
			_fail("Persisted story_cursor_entry_id must be a string or null")
			return null
		var entries: Array[String] = []
		if order == null:
			entries = story_order()
			if not error.is_empty():
				return null
		else:
			for entry: Variant in order:
				entries.append(String(entry))
		if not (cursor < entries.size() and entries[cursor] == entry_id):
			var resolved: int = entries.find(entry_id)
			if resolved >= 0:
				notes.append("StoryState: story_cursor re-resolved from %d to %d for entry %s" % [cursor, resolved, ContentLoader.py_repr(entry_id)])
				cursor = resolved
			else:
				notes.append("StoryState: persisted story_cursor entry %s no longer exists in story_order; keeping index %d" % [ContentLoader.py_repr(entry_id), cursor])
	var state: PlayerStoryState = PlayerStoryState.new()
	for stage_id: String in completed:
		state.completed_stage_ids[stage_id] = true
	for character_id: String in owned:
		state.owned_character_ids[character_id] = true
	state.first_oath_invitation_claimed = claimed
	state.first_oath_invitation_selection = "" if selection == null else selection
	state.first_oath_invitation_available = available
	state.story_cursor = cursor
	for character_id: String in online:
		state.online_character_ids[character_id] = true
	return state


## A new state pointing at the next story_order entry.
func advance_story_cursor(state: PlayerStoryState) -> PlayerStoryState:
	var result: PlayerStoryState = state.copy()
	result.story_cursor += 1
	return result


# -- manifest and rules ----------------------------------------------------------------------------


func _acquisition_beats() -> Dictionary:
	var beats: Variant = _manifest.get("acquisition_story_beats")
	if not (beats is Dictionary):
		_fail("Story manifest is missing acquisition_story_beats")
		return {}
	return beats


## (size, front, rear) of the party for a stage, honouring the tutorial exception.
func _party_shape(stage: ContentModels.Stage) -> Array[int]:
	var party: Variant = _registry.battle_rules.get("party")
	if not (party is Dictionary):
		_fail("battle_rules_part1.json is missing the party rules")
		return [0, 0, 0]
	var rules: Dictionary = party
	var size: Variant = rules.get("size")
	var front: Variant = rules.get("front")
	var rear: Variant = rules.get("rear")
	for value: Variant in [size, front, rear]:
		if value is bool or not _is_whole(value):
			_fail("Battle party size/front/rear rules must be integers")
			return [0, 0, 0]
	var size_n: int = int(size)
	var front_n: int = int(front)
	var rear_n: int = int(rear)
	if size_n != front_n + rear_n or size_n < 1 or front_n < 0 or rear_n < 0:
		_fail("Battle party size must equal front plus rear slots")
		return [0, 0, 0]
	var exception: Variant = rules.get("tutorial_exception")
	if exception is Dictionary and (exception as Dictionary).get("stage_id") == stage.stage_id:
		var exception_size: Variant = (exception as Dictionary).get("size")
		if exception_size is bool or not _is_whole(exception_size) or int(exception_size) < 1:
			_fail("Tutorial party exception size must be a positive integer")
			return [0, 0, 0]
		return [int(exception_size), int(exception_size), 0]
	return [size_n, front_n, rear_n]


func _battle_slot(character_id: String, slot_index: int, front_count: int, temporary: bool, stage_level: int) -> BattleSlot:
	var slot: BattleSlot = BattleSlot.new()
	slot.slot_index = slot_index
	slot.position = "front" if slot_index < front_count else "rear"
	slot.character_id = character_id
	slot.temporary = temporary
	slot.level = stage_level if temporary else null
	slot.equipment_template_id = STORY_LOAN_EQUIPMENT_TEMPLATE_ID if temporary else ""
	return slot


## Resolves saved heroes and fills vacant slots with the stage's story guests (authored order) up to the party size.
## Returns an empty array with `error` set when the selection is invalid.
func resolve_battle_roster(state: PlayerStoryState, stage: ContentModels.Stage, player_selected_five: Array) -> Array[BattleSlot]:
	_begin()
	var none: Array[BattleSlot] = []
	var selected: Array[String] = []
	for character_id: Variant in player_selected_five:
		if not (character_id is String) or (character_id as String).is_empty():
			_fail("player_selected_five must be a list of non-empty character IDs")
			return none
		selected.append(character_id)
	var seen: Dictionary = {}
	for character_id: String in selected:
		if seen.has(character_id):
			_fail("A battle roster cannot contain duplicate character IDs")
			return none
		seen[character_id] = true

	var shape: Array[int] = _party_shape(stage)
	if not error.is_empty():
		return none
	var size: int = shape[0]
	var front_count: int = shape[1]
	var unknown_guests: Array[String] = []
	for character_id: String in stage.guest_characters:
		if not _registry.characters.has(character_id):
			unknown_guests.append(character_id)
	if not unknown_guests.is_empty():
		_fail("Stage %s has unknown guest IDs: %s" % [ContentLoader.py_repr(stage.stage_id), ContentLoader.py_repr(unknown_guests)])
		return none

	if stage.stage_id == "1-1":
		var starters: Array[String] = _starting_owned_ids()
		var ordered_starters: Array[String] = []
		for character: ContentModels.Character in _registry.characters.values():
			if starters.has(character.character_id):
				ordered_starters.append(character.character_id)
		if ordered_starters.size() != size:
			_fail("The 1-1 tutorial exception must resolve to exactly its two free starters")
			return none
		for character_id: String in starters:
			if not state.owned_character_ids.has(character_id):
				_fail("Mahmut and Fadyme must be owned for the 1-1 tutorial party")
				return none
		var tutorial: Array[BattleSlot] = []
		for index: int in range(ordered_starters.size()):
			tutorial.append(_battle_slot(ordered_starters[index], index, front_count, false, stage.recommended_level))
		return tutorial

	if selected.size() > size:
		_fail("The party can contain at most %d selected heroes" % size)
		return none
	var roster_ids: Array[String] = selected.duplicate()
	for character_id: String in roster_ids:
		if not _registry.characters.has(character_id):
			_fail("Unknown selected character: %s" % character_id)
			return none
		if not state.owned_character_ids.has(character_id) and not stage.guest_characters.has(character_id):
			_fail("Character %s is neither owned nor a guest in this stage" % ContentLoader.py_repr(character_id))
			return none

	# A selected guest keeps the player's actual copy when owned; otherwise the slot is a temporary story loan.
	var temporary_by_id: Dictionary = {}
	for character_id: String in roster_ids:
		temporary_by_id[character_id] = not state.owned_character_ids.has(character_id)
	for character_id: String in stage.guest_characters:
		if roster_ids.size() >= size:
			break
		if roster_ids.has(character_id):
			continue
		roster_ids.append(character_id)
		temporary_by_id[character_id] = not state.owned_character_ids.has(character_id)

	if roster_ids.size() != size:
		_fail("Stage %s requires %d heroes; selected heroes and story guests provide %d. Select %d more owned hero(s)." % [
			ContentLoader.py_repr(stage.stage_id), size, roster_ids.size(), size - roster_ids.size()])
		return none
	var slots: Array[BattleSlot] = []
	for index: int in range(roster_ids.size()):
		slots.append(_battle_slot(roster_ids[index], index, front_count, temporary_by_id[roster_ids[index]], stage.recommended_level))
	return slots


# -- rewards and the First Oath selector -----------------------------------------------------------


## A new state after recording stage completion and story unlocks (null + `error` on invalid content).
func apply_story_rewards(state: PlayerStoryState, stage: ContentModels.Stage) -> PlayerStoryState:
	_begin()
	var result: PlayerStoryState = state.copy()
	result.completed_stage_ids[stage.stage_id] = true
	for row: Dictionary in stage.story_rewards:
		var recruit_id: Variant = row.get("recruit_character_id")
		if recruit_id != null:
			if not (recruit_id is String) or not _registry.characters.has(recruit_id):
				_fail("Stage %s has an invalid recruit_character_id" % ContentLoader.py_repr(stage.stage_id))
				return null
			result.owned_character_ids[recruit_id] = true

	var beats: Dictionary = _acquisition_beats()
	if not error.is_empty():
		return null
	var recruits: Variant = beats.get("story_recruits", [])
	if not (recruits is Array):
		_fail("acquisition_story_beats.story_recruits must be an array")
		return null
	for recruit: Variant in recruits:
		if not (recruit is Dictionary):
			_fail("Story recruit entries must be objects")
			return null
		if (recruit as Dictionary).get("after_stage") == stage.stage_id:
			var character_id: Variant = (recruit as Dictionary).get("character_id")
			if not (character_id is String) or not _registry.characters.has(character_id):
				_fail("Story manifest has invalid recruit for stage %s" % ContentLoader.py_repr(stage.stage_id))
				return null
			result.owned_character_ids[character_id] = true

	var invitation_granted: bool = false
	for row: Dictionary in stage.story_rewards:
		if row.get("grant_item_id") == "first_oath_invitation":
			invitation_granted = true
	var selector: Variant = beats.get("guaranteed_selector")
	if not (selector is Dictionary):
		_fail("acquisition_story_beats.guaranteed_selector must be an object")
		return null
	if (selector as Dictionary).get("claim_after_stage") == stage.stage_id:
		invitation_granted = true
	result.first_oath_invitation_available = not state.first_oath_invitation_claimed and (state.first_oath_invitation_available or invitation_granted)
	return result


func _first_oath_selector_pool() -> Array[String]:
	var pool: Array[String] = []
	var beats: Dictionary = _acquisition_beats()
	if not error.is_empty():
		return pool
	var selector: Variant = beats.get("guaranteed_selector")
	if not (selector is Dictionary):
		_fail("acquisition_story_beats.guaranteed_selector must be an object")
		return pool
	var eligible: Variant = (selector as Dictionary).get("choose_one_from")
	if not _is_string_list(eligible):
		_fail("First Oath Invitation selector has an invalid choose_one_from list")
		return pool
	for character_id: String in eligible:
		pool.append(character_id)
	return pool


## The selector's manifest-defined character pool in authored order (independent of any state).
func first_oath_choices() -> Array[String]:
	_begin()
	return _first_oath_selector_pool()


## Claims the one-time guaranteed character selector (null + `error` when it cannot be claimed).
func claim_first_oath_invitation(state: PlayerStoryState, chosen_character_id: String) -> PlayerStoryState:
	_begin()
	if state.first_oath_invitation_claimed:
		_fail("First Oath Invitation has already been claimed")
		return null
	if not state.first_oath_invitation_available:
		_fail("First Oath Invitation is not available yet")
		return null
	var eligible: Array[String] = _first_oath_selector_pool()
	if not error.is_empty():
		return null
	if not eligible.has(chosen_character_id):
		_fail("Character %s is not eligible for First Oath Invitation" % ContentLoader.py_repr(chosen_character_id))
		return null
	if not _registry.characters.has(chosen_character_id):
		_fail("Selector references unknown character %s" % ContentLoader.py_repr(chosen_character_id))
		return null
	var result: PlayerStoryState = state.copy()
	result.owned_character_ids[chosen_character_id] = true
	result.first_oath_invitation_claimed = true
	result.first_oath_invitation_selection = chosen_character_id
	result.first_oath_invitation_available = false
	return result
