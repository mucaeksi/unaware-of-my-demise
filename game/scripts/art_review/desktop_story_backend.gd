extends GameBackend
## Editor-only local story rehearsal. Uses the existing StoryState rules; grants
## no online currency, loot, purchase or social result. Save belongs to review only.
const REVIEW_LEVEL_MARGIN: int = 10
var _flow_ref: WeakRef
var game_flow: GameFlow:
	get: return _flow_ref.get_ref() as GameFlow
var save_path: String = ""
var snapshot: Dictionary = {}
var error: String = ""
var _serial: int = 0
var _settled: Dictionary = {}

func _init(source: GameFlow, path: String = "") -> void:
	_flow_ref = weakref(source)
	save_path = path
	if not source.is_ready():
		error = source.error
		return
	snapshot = {
		"schema_version": PlayerState.SCHEMA_VERSION,
		"state_revision": 0,
		"story_state": source.rules.story.to_persisted_dict(source.rules.story.new_player_state()),
		"wallet": {"silver_crowns": 0, "eclipse_tokens": 0, "fate_threads": 0, "ration": 0, "account_xp": 0},
		"roster": {},
	}
	if not path.is_empty() and FileAccess.file_exists(path):
		var saved: ConfigFile = ConfigFile.new()
		if saved.load(path) != OK:
			error = "The local story review save could not be read. It has been preserved."
			return
		var candidate: Variant = saved.get_value("review", "state", {})
		if not (candidate is Dictionary) or not PlayerState.from_snapshot(candidate, source.rules.story).is_valid():
			error = "The local story review save is invalid. It has been preserved; use ResetReview to start a separate fresh rehearsal."
			return
		snapshot = candidate
		_serial = int(saved.get_value("review", "serial", 0))
		var settled: Variant = saved.get_value("review", "settled", {})
		if not (settled is Dictionary):
			error = "The local story review attempt history is invalid; its file has been preserved."
			return
		_settled = settled

func _offline() -> Outcome:
	return Outcome.fail(KIND_OFFLINE, "This service needs the online game. Local Story Review supports the full story and battles; no purchases or account rewards are simulated.")

func fetch_state() -> Outcome:
	return Outcome.fail("review_save", error) if not error.is_empty() else _reply()

func _reply(extra: Dictionary = {}) -> Outcome:
	var value: Dictionary = extra.duplicate(true)
	value["state"] = snapshot.duplicate(true)
	return Outcome.ok(value)

func _story() -> StoryState.PlayerStoryState:
	return game_flow.rules.story.from_persisted_dict(snapshot["story_state"])

func _entry() -> String:
	var cursor: int = _story().story_cursor
	return game_flow.story_index.story_order[cursor] if cursor < game_flow.story_index.story_order.size() else ""

func _commit(next: Dictionary, extra: Dictionary = {}) -> Outcome:
	next["state_revision"] = int(snapshot.get("state_revision", 0)) + 1
	if not save_path.is_empty():
		var saved: ConfigFile = ConfigFile.new()
		saved.set_value("review", "state", next)
		saved.set_value("review", "serial", _serial)
		saved.set_value("review", "settled", _settled)
		# Never overwrite the previous complete save with an interrupted write.
		var temporary: String = save_path + ".tmp"
		if saved.save(temporary) != OK or DirAccess.rename_absolute(temporary, save_path) != OK:
			return Outcome.fail("review_save", "Local progress could not be saved. Your previous checkpoint is unchanged.")
	snapshot = next
	return _reply(extra)

func advance_story() -> Outcome:
	if not error.is_empty(): return Outcome.fail("review_save", error)
	var entry: String = _entry()
	if entry.is_empty() or game_flow.is_stage(entry) or _story().first_oath_invitation_available:
		return Outcome.fail("review_flow", "Finish the current battle or First Oath before advancing.")
	var next: Dictionary = snapshot.duplicate(true)
	next["story_state"] = game_flow.rules.story.to_persisted_dict(game_flow.rules.story.advance_story_cursor(_story()))
	return _commit(next)

func claim_first_oath(character_id: String) -> Outcome:
	var claimed: StoryState.PlayerStoryState = game_flow.rules.story.claim_first_oath_invitation(_story(), character_id)
	if claimed == null: return Outcome.fail("review_flow", game_flow.rules.story.error)
	var next: Dictionary = snapshot.duplicate(true)
	next["story_state"] = game_flow.rules.story.to_persisted_dict(claimed)
	return _commit(next)

func begin_stage(stage_id: String, roster: Array) -> Outcome:
	if _entry() != stage_id or _story().first_oath_invitation_available:
		return Outcome.fail("review_flow", "This is not the current story stage.")
	var stage: ContentModels.Stage = game_flow.stage(stage_id)
	if stage == null: return Outcome.fail("review_flow", "Unknown stage.")
	var slots: Array[StoryState.BattleSlot] = game_flow.rules.story.resolve_battle_roster(_story(), stage, roster)
	if slots.is_empty(): return Outcome.fail("review_flow", game_flow.rules.story.error)
	var next: Dictionary = snapshot.duplicate(true)
	var levels: Dictionary = {}
	for character_id: String in _story().owned_character_ids:
		# Rehearsal uses the authored recommended level plus a fixed review margin, independent of
		# the online economy. Actual combat, guests, skills and manual play remain real.
		levels[character_id] = clampi(stage.recommended_level + REVIEW_LEVEL_MARGIN, 1, game_flow.rules.progression.character_level_cap())
		(next["roster"] as Dictionary)[character_id] = {"level": levels[character_id], "level_cap": levels[character_id]}
	_serial += 1
	var attempt: Dictionary = {"attempt_id": "local-story-%d" % _serial, "stage_id": stage_id, "run_seed": 4242 + _serial,
		"roster": roster.duplicate(), "inputs": {"owned_character_ids": _story().owned_character_ids.keys(), "player_levels": levels}}
	next["open_attempt"] = attempt
	return _commit(next, {"attempt": attempt})

func submit_victory(attempt_id: String, client_result: Dictionary) -> Outcome:
	if _settled.has(attempt_id): return _reply({"applied": [], "first_clear": true})
	var attempt: Dictionary = snapshot.get("open_attempt", {})
	if attempt.get("attempt_id") != attempt_id or client_result.get("outcome") != "victory":
		return Outcome.fail("review_flow", "No matching local victory is pending.")
	var state: StoryState.PlayerStoryState = game_flow.rules.story.apply_story_rewards(_story(), game_flow.stage(attempt["stage_id"]))
	if state == null: return Outcome.fail("review_flow", game_flow.rules.story.error)
	state = game_flow.rules.story.advance_story_cursor(state)
	var next: Dictionary = snapshot.duplicate(true)
	next["story_state"] = game_flow.rules.story.to_persisted_dict(state)
	next.erase("open_attempt")
	_settled[attempt_id] = true
	var result: Outcome = _commit(next, {"applied": [], "first_clear": true})
	if not result.is_ok(): _settled.erase(attempt_id)
	return result

func abandon_attempt(attempt_id: String) -> Outcome:
	var attempt: Dictionary = snapshot.get("open_attempt", {})
	if attempt.get("attempt_id") != attempt_id: return Outcome.fail("review_flow", "No matching local attempt is open.")
	var next: Dictionary = snapshot.duplicate(true)
	next.erase("open_attempt")
	return _commit(next, {"attempt_status": "abandoned"})
