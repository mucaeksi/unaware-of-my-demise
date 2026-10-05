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
## The server refused for lack of a currency (Ration for a stage, Fate's Threads for a pull); its message says which.
const KIND_INSUFFICIENT_FUNDS: String = "insufficient_funds"


func _offline() -> Outcome:
	return Outcome.fail(KIND_OFFLINE, "The game server cannot be reached.")


## The server's release contract (`GET /v1/bootstrap`, judged by `ClientRelease.check`), asked at boot before anything else. `value`
## null = this backend has no contract to check (this "no server" base and test doubles); its other calls decide.
func fetch_bootstrap() -> Outcome:
	return Outcome.ok(null)


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
## Gives up an open attempt (a defeat, or a battle not resumed): it pays nothing. `value`: {"state", "attempt_status"}.
func abandon_attempt(_attempt_id: String) -> Outcome:
	return _offline()


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


## Reads (no snapshot): `value` is the route's reply as is.
## `value`: {"half_day_cycle_id", ..., "claimed", "mail", "daily_tasks", "weekly_tasks"} (GET /v1/quests/status).
func quest_status() -> Outcome:
	return _offline()


## `kind` "daily" | "weekly"; `period` a week's Monday (YYYY-MM-DD) or "" for the current one.
## `value`: {"state", "claim_key", "already_claimed", "granted", "eclipse_tokens"}.
func claim_quest(_kind: String, _task_id: String, _period: String = "") -> Outcome:
	return _offline()


## `value`: {"banners": [{"banner_id", "banner_type", "pull_cost", "pity", "next_pull", "guarantee", ...}]}.
func gacha_banners() -> Outcome:
	return _offline()


## `value`: {"banner_types": {"character": {...}, "weapon": {...}, "standard_character": {...}}}.
func gacha_pity() -> Outcome:
	return _offline()


## Newest first; `before` is the previous page's `next_cursor` (0 = first page). `value`: {"items", "next_cursor"}.
func gacha_history(_limit: int = 50, _before: int = 0) -> Outcome:
	return _offline()


## One or ten pulls, resolved and granted by the server. `target_id` picks the Hall of Armaments weapon ("" = none).
## `value`: {"state", "pull": {"pull_count", "results": [{"pull_id", "rarity", "reward_id", "grant", ...}], ...}}.
func gacha_pull(_banner_id: String, _pull_count: int, _target_id: String = "") -> Outcome:
	return _offline()


## Eclipse Tokens -> `count` Fate's Threads at the authored rate. `value`: {"state", "fate_threads_gained", "eclipse_tokens_spent"}.
func convert_fate_threads(_count: int) -> Outcome:
	return _offline()


## Today's Inn Meal (DEC-0014): Ration once per UTC day. `value`: {"state", "claim_key", "already_claimed", "ration_granted"}.
func claim_inn_meal() -> Outcome:
	return _offline()


# -- social (INF-037; reads and changes that touch no player state, so no snapshot) ----------------------------------


## The own account and public profile. `value`: {"account_id", "friend_code", "nickname", "presence_opt_in",
## "nickname_change_available_at_utc", ...} (GET /v1/account).
func fetch_account() -> Outcome:
	return _offline()


## Changes {"nickname"} and/or {"presence_opt_in"}. `value`: the own profile as `fetch_account` shows it.
func update_profile(_changes: Dictionary) -> Outcome:
	return _offline()


## Friends and requests, newest first. `value`: {"items": [{"account_id", "nickname", "player_level", "presence",
## "relationship", "request_id", ...}], "next_cursor", "counts", "limits"}.
func friends(_cursor: String = "") -> Outcome:
	return _offline()


## `value`: the other player's public record with `relationship` "pending_out" (or "accepted" when they had asked first).
func send_friend_request(_friend_code: String) -> Outcome:
	return _offline()


## `answer`: "accept" | "reject" (a request to the player) or "cancel" (the player's own request).
func answer_friend_request(_request_id: String, _answer: String) -> Outcome:
	return _offline()


func remove_friend(_account_id: String) -> Outcome:
	return _offline()


## `value`: {"items": [{"account_id", "nickname", "blocked_at_utc"}]}.
func blocked_players() -> Outcome:
	return _offline()


func block_player(_account_id: String) -> Outcome:
	return _offline()


func unblock_player(_account_id: String) -> Outcome:
	return _offline()


## `reason`: spam | harassment | inappropriate_name | cheating | other.
func report_player(_account_id: String, _reason: String) -> Outcome:
	return _offline()
