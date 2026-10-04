class_name GameBackend
extends RefCounted
## The server side of the game as the client sees it (DEC-0012): every state change the player can make goes through here and comes back
## as an `Outcome` whose `value` carries the new player snapshot under "state" (see `PlayerState.from_snapshot`). The client never writes
## progression, currencies, inventory or story progress itself; it renders what the server returns.
##
## Every method is a coroutine: callers `await` it. This base class is the "no server" backend: each call fails with `Outcome.OFFLINE`,
## so a build without a configured server shows the connection problem instead of pretending to work. `OnlineBackend` (the Worker API)
## and test doubles override the methods.

const KIND_OFFLINE: String = "offline"


func _offline() -> Outcome:
	return Outcome.fail(KIND_OFFLINE, "The game server cannot be reached.")


## The player's current snapshot (`value["state"]`).
func fetch_state() -> Outcome:
	return _offline()


## Moves the story cursor past the current narrative entry.
func advance_story() -> Outcome:
	return _offline()


func claim_first_oath(_character_id: String) -> Outcome:
	return _offline()


## Opens a battle attempt: the server checks the stage and the party and picks the seed (DEC-0013).
## `value`: {"state", "attempt": {"attempt_id", "stage_id", "run_seed"}}.
func begin_stage(_stage_id: String, _roster: Array) -> Outcome:
	return _offline()


## Reports the victory of an attempt; the server re-runs it from its stored inputs and decides what it is worth.
## `value`: {"state", "applied", "first_clear"}.
func submit_victory(_attempt_id: String, _client_result: Dictionary) -> Outcome:
	return _offline()


## Spends `items` (item_id -> count) on `character_id`. `value`: {"state", "xp_gained", "level_before", "level_after", "stopped_reason"}.
func level_up(_character_id: String, _items: Dictionary) -> Outcome:
	return _offline()


## `value`: {"state", "rank_before", "rank_after"}.
func upgrade_skill(_character_id: String, _skill_id: String) -> Outcome:
	return _offline()


## `value`: {"state", "node", "shards_remaining"}.
func unlock_memory_node(_character_id: String) -> Outcome:
	return _offline()


func equip(_table: String, _instance_id: String, _character_id: String) -> Outcome:
	return _offline()


func unequip(_table: String, _instance_id: String) -> Outcome:
	return _offline()


func set_locked(_table: String, _instance_id: String, _locked: bool) -> Outcome:
	return _offline()


## `value`: {"state", "granted": {item_id: count}}.
func dismantle_weapon(_instance_id: String) -> Outcome:
	return _offline()


## `value`: {"state", "level_before", "level_after", "xp_spent", "stopped_reason"}.
func level_up_equipment(_table: String, _instance_id: String) -> Outcome:
	return _offline()


func reroll_accessory(_instance_id: String) -> Outcome:
	return _offline()
