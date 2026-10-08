class_name BattlePlayback
extends RefCounted
## What a battle screen shows, worked out from a finished battle: the engine resolves a stage in one call, so the screen replays the recorded
## event log (`BattleResult.state.battle_events`) alongside action-gauge timestamps and HUD snapshots. `advance()` applies every event due
## on the shared clock, returning simultaneous actor cues while preserving the engine's resolution order. This presentation model knows
## nothing about nodes; `units` hold the current bars, and `apply_next()` remains available for model-level inspection.
##
## Start state: the units as they were when the battle began (`BattleResult.initial_units`, taken before the first event), heroes and the
## wave-0 enemies on the field; enemies of later waves and summons are known from the final unit list but stay off the field until an event
## first mentions them (the log has no "wave started" event). HP follows the events (`hp` after each hit or heal); a few skills pay an HP
## cost without any event (3-2's "paid in blood"), so the last event reconciles every unit with the engine's final unit list.
##
## The log has no status-expiry event either: a unit's statuses are what its last `status_applied` reported, corrected at the end.

const LOG_LIMIT: int = 400
## Seconds at x1 for a speed-5 unit to refill its independent action gauge.
const BASE_ACTION_SECONDS: float = 3.4
const REFERENCE_SPEED: float = 5.0
const OPENING_SECONDS: float = 0.8

const CUE_ACTION: String = "action"
const CUE_DAMAGE: String = "damage"
const CUE_BLOCKED: String = "blocked"
const CUE_HEAL: String = "heal"
const CUE_STATUS: String = "status"
const CUE_PASSIVE: String = "passive"
const CUE_JOIN: String = "join"
const CUE_PHASE: String = "phase"
const CUE_TELEGRAPH: String = "telegraph"
const CUE_OBJECTIVE: String = "objective"
const CUE_INTENT: String = "intent"
const CUE_END: String = "end"

const TELEGRAPH_NONE: String = ""
const TELEGRAPH_CHARGING: String = "charging"
const TELEGRAPH_HELD: String = "held"
const TELEGRAPH_INTERRUPTED: String = "interrupted"
const TELEGRAPH_RESOLVED: String = "resolved"


## One unit as the bars show it.
class UnitView extends RefCounted:
	var entity_id: String = ""
	## Stable character/enemy identity for presentation; entity_id still owns replay events.
	var art_id: String = ""
	var display_name: String = ""
	var team: String = ""
	var row: String = ""
	var slot_index: int = 0
	var level: int = 1
	var hp: int = 0
	var max_hp: int = 1
	var alive: bool = true
	var focus: int = 0
	var element: String = ""
	var combat_role: String = ""
	var skills: Array[ContentModels.Skill] = []
	var speed: int = 5
	var cooldowns: Dictionary = {}
	var cooldown_until: Dictionary = {}
	var next_action_at: float = 0.0
	var statuses: Array[String] = []
	var is_boss: bool = false
	var is_objective: bool = false
	var temporary: bool = false
	## Creation order: the tie-break that keeps the display order stable.
	var order: int = 0
	## False for an enemy that has not appeared yet (a later wave, a summon).
	var on_field: bool = true

	func hp_fraction() -> float:
		return clampf(float(hp) / float(maxi(1, max_hp)), 0.0, 1.0)


## One thing to draw for the event just applied.
class Cue extends RefCounted:
	var kind: String = ""
	## The unit it is drawn on ("" = the whole field).
	var unit_id: String = ""
	var amount: int = 0
	var critical: bool = false
	## The log line for this cue ("" = none).
	var text: String = ""
	## A short word to float over the unit ("" = none): the status name for a status cue.
	var caption: String = ""
	var action_type: String = "basic"
	var skill_id: String = ""
	var source_id: String = ""


var units: Array[UnitView] = []
var boss_phase_id: String = ""
var boss_phase_index: int = 0
var telegraph_state: String = TELEGRAPH_NONE
var telegraph_action: String = ""
var round_number: int = 0
var outcome: String = ""
var stars: int = 0
var log_lines: Array[String] = []
## Units whose event-tracked HP differed from the engine's final HP when the last event arrived (diagnostic, not a failure).
var drift: int = 0
var elapsed_seconds: float = 0.0
var event_times: Array[float] = []
var _frames: Array[Dictionary] = []

var _by_id: Dictionary = {}
var _events: Array[Dictionary] = []
var _final_units: Array[Dictionary] = []
var _registry: ContentModels.ContentRegistry = null
var _cursor: int = 0
var _finished: bool = false


## Builds the replay of `result`. `result.initial_units` must have been taken (`BattleService.run` does); a result without a state has nothing to play.
static func create(result: BattleService.BattleResult, registry: ContentModels.ContentRegistry) -> BattlePlayback:
	var playback: BattlePlayback = BattlePlayback.new()
	playback._registry = registry
	if result.state == null:
		playback._finished = true
		return playback
	var later: Array[Dictionary] = []
	for unit: BattleUnit in result.state.units:
		later.append({
			"entity_id": unit.entity_id, "team": unit.team, "row": unit.row, "slot_index": unit.slot_index, "level": unit.level,
			"hp": unit.max_hp, "max_hp": unit.max_hp, "is_boss": unit.is_boss, "is_objective": unit.is_objective,
			"enemy_id": unit.enemy_id, "objective_id": unit.objective_id, "temporary": unit.temporary,
		})
	playback._build(result.initial_units, later, result.state.battle_events, result.final_units, result.outcome, result.stars)
	playback.configure_timeline(result.state.replay_frames, result.state.gauge_rules.gauge_max)
	return playback


## The same from plain data (tests, tools): `initial` are the units on the field at the start, `all_units` every unit that ever existed.
static func from_records(initial: Array[Dictionary], all_units: Array[Dictionary], events: Array[Dictionary], final_units: Array[Dictionary], registry: ContentModels.ContentRegistry, battle_outcome: String = "", battle_stars: int = 0, frames: Array[Dictionary] = []) -> BattlePlayback:
	var playback: BattlePlayback = BattlePlayback.new()
	playback._registry = registry
	playback._build(initial, all_units, events, final_units, battle_outcome, battle_stars)
	playback.configure_timeline(frames)
	return playback


## Exact engine gauge timestamps become a shared presentation clock. Tied actors
## and all effects of an action are applied together; animations never block it.
func configure_timeline(frames: Array[Dictionary], gauge_max: int = 10000) -> void:
	_frames.clear()
	if frames.size() == _events.size(): _frames.assign(frames.duplicate(true))
	event_times.clear()
	var legacy_time: float = OPENING_SECONDS
	var has_action: bool = false
	for index: int in range(_events.size()):
		if not _frames.is_empty():
			var raw: Dictionary = _frames[index]
			event_times.append(float(raw.get("seconds", OPENING_SECONDS + float(raw.get("gauge_time", 0.0)) * REFERENCE_SPEED * BASE_ACTION_SECONDS / float(maxi(1, gauge_max)))))
		else:
			# Old tools/archived logs lack a clock. Preserve their event order, but
			# group an action's effects instead of giving every effect a separate turn.
			if _events[index].get("type") == "action_started":
				if has_action: legacy_time += BASE_ACTION_SECONDS
				has_action = true
			event_times.append(legacy_time)
		if index > 0:
			event_times[index] = maxf(event_times[index], event_times[index - 1])
	prepare_identities()
	_refresh_next_actions()


func prepare_identities() -> void:
	for view: UnitView in units:
		if _registry == null: continue
		if _registry.characters.has(view.art_id):
			var character: ContentModels.Character = _registry.characters[view.art_id]
			view.element = character.element
			view.combat_role = character.combat_role
			view.skills = character.skills
			view.speed = maxi(1, int(character.base_stats_level_1.get("spd", 5)))
		elif _registry.enemies.has(view.art_id):
			var enemy: ContentModels.Enemy = _registry.enemies[view.art_id]
			view.element = enemy.element
			view.combat_role = "boss" if view.is_boss else "enemy"
			view.skills = enemy.skills


func advance(seconds: float) -> Array[Cue]:
	var cues: Array[Cue] = []
	if _finished: return cues
	elapsed_seconds += maxf(0.0, seconds)
	while _cursor < event_times.size() and event_times[_cursor] <= elapsed_seconds + 0.000001 and not _finished:
		cues.append_array(apply_next())
	_refresh_next_actions()
	return cues


func _refresh_next_actions() -> void:
	for view: UnitView in units:
		view.next_action_at = 0.0
	for index: int in range(_cursor, _events.size()):
		var event: Dictionary = _events[index]
		if event.get("type") != "action_started": continue
		var view: UnitView = unit(str(event.get("actor_id", "")))
		if view != null and view.next_action_at <= 0.0:
			view.next_action_at = event_times[index]


func skill_remaining(view: UnitView, skill: ContentModels.Skill) -> float:
	if skill.type == "basic":
		return maxf(0.0, view.next_action_at - elapsed_seconds)
	return maxf(0.0, float(view.cooldown_until.get(skill.skill_id, 0.0)) - elapsed_seconds)


func _build(initial: Array[Dictionary], all_units: Array[Dictionary], events: Array[Dictionary], final_units: Array[Dictionary], battle_outcome: String, battle_stars: int) -> void:
	_events = events
	_final_units = final_units
	outcome = battle_outcome
	stars = battle_stars
	for record: Dictionary in initial:
		_add_unit(record, true)
	for record: Dictionary in all_units:
		if not _by_id.has(str(record["entity_id"])):
			_add_unit(record, false)
	units.sort_custom(_unit_order)


static func _unit_order(left: UnitView, right: UnitView) -> bool:
	if left.team != right.team:
		return left.team == "player"
	if left.slot_index != right.slot_index:
		return left.slot_index < right.slot_index
	return left.order < right.order


func _add_unit(record: Dictionary, on_field: bool) -> void:
	var view: UnitView = UnitView.new()
	view.entity_id = str(record["entity_id"])
	view.art_id = str(record.get("enemy_id", view.entity_id))
	if view.art_id.is_empty():
		view.art_id = view.entity_id
		var identity_parts: PackedStringArray = view.entity_id.split(":")
		if identity_parts.size() >= 4:
			view.art_id = identity_parts[2]
	view.team = str(record.get("team", ""))
	view.row = str(record.get("row", ""))
	view.slot_index = int(record.get("slot_index", 0))
	view.level = int(record.get("level", 1))
	view.max_hp = maxi(1, int(record.get("max_hp", 1)))
	view.hp = clampi(int(record.get("hp", view.max_hp)), 0, view.max_hp)
	view.focus = int(record.get("focus", 0))
	view.is_boss = bool(record.get("is_boss", false))
	view.is_objective = bool(record.get("is_objective", false))
	view.temporary = bool(record.get("temporary", false))
	view.on_field = on_field
	view.order = units.size()
	view.display_name = _name_of(view.entity_id, str(record.get("enemy_id", "")), str(record.get("objective_id", "")))
	units.append(view)
	_by_id[view.entity_id] = view


func _name_of(entity_id: String, enemy_id: String, objective_id: String) -> String:
	if not objective_id.is_empty():
		return _readable(objective_id)
	if _registry != null:
		if _registry.characters.has(entity_id):
			return _registry.characters[entity_id].name_en
		if not enemy_id.is_empty() and _registry.enemies.has(enemy_id):
			return _registry.enemies[enemy_id].name_en
	# "3-2:0:corrupted_mercenary:2" -> "corrupted mercenary 3"
	var parts: PackedStringArray = entity_id.split(":")
	if parts.size() >= 4:
		return "%s %d" % [parts[2].replace("_", " "), int(parts[3]) + 1]
	return entity_id


func unit(entity_id: String) -> UnitView:
	return _by_id.get(entity_id)


func event_count() -> int:
	return _events.size()


func cursor() -> int:
	return _cursor


func is_finished() -> bool:
	return _finished

func _can_finish_log() -> bool:
	return true

func can_cast_ultimate(_entity_id: String) -> bool:
	return false


## Everything currently standing on the field for `team`, in slot order.
func field(team: String) -> Array[UnitView]:
	var shown: Array[UnitView] = []
	for view: UnitView in units:
		if view.team == team and view.on_field and not view.is_objective:
			shown.append(view)
	return shown


## Applies the next event and returns what to draw for it (empty once the replay is over).
func apply_next() -> Array[Cue]:
	var cues: Array[Cue] = []
	if _finished:
		return cues
	if _cursor >= _events.size():
		if _can_finish_log(): _finish(cues)
		return cues
	var event: Dictionary = _events[_cursor]
	var frame_index: int = _cursor
	_cursor += 1
	_apply(event, cues)
	if frame_index < _frames.size():
		_apply_frame(_frames[frame_index], event_times[frame_index])
	if _cursor >= _events.size() and not _finished and _can_finish_log():
		_finish(cues)
	return cues


func _apply_frame(frame: Dictionary, event_time: float) -> void:
	for raw: Dictionary in frame.get("units", []):
		var view: UnitView = unit(str(raw.get("entity_id", "")))
		if view == null: continue
		view.focus = int(raw.get("focus", view.focus))
		view.speed = maxi(1, int(raw.get("speed", view.speed)))
		var cooldowns: Dictionary = raw.get("cooldowns", {})
		for skill_id: String in cooldowns:
			var remaining: int = int(cooldowns[skill_id])
			if remaining != int(view.cooldowns.get(skill_id, 0)):
				view.cooldown_until[skill_id] = event_time + float(remaining) * REFERENCE_SPEED * BASE_ACTION_SECONDS / float(view.speed)
		view.cooldowns = cooldowns.duplicate()


## Plays the rest without cues (skip button): the field ends in the engine's final state.
func skip_to_end() -> void:
	while not _finished:
		apply_next()


func _apply(event: Dictionary, cues: Array[Cue]) -> void:
	var kind: String = str(event.get("type", ""))
	if event.has("round"):
		round_number = int(event["round"])
	for key: String in ["actor_id", "source_id", "target_id", "owner_id", "enemy_id", "boss_id"]:
		if event.get(key) is String:
			_enter(str(event[key]), cues)
	match kind:
		"action_started":
			var actor: UnitView = unit(str(event.get("actor_id", "")))
			_push(cues, CUE_ACTION, str(event.get("actor_id", "")), 0, false, "%s uses %s." % [_label(actor, str(event.get("actor_id", ""))), _skill_name(str(event.get("skill_id", "")))])
			cues[-1].action_type = str(event.get("action_type", "basic"))
			cues[-1].skill_id = str(event.get("skill_id", ""))
		"damage_dealt":
			_apply_damage(event, cues)
		"healing_applied":
			var target: UnitView = unit(str(event.get("target_id", "")))
			if target != null:
				_sync_hp(target, event)
			var healed: int = int(event.get("amount", 0))
			_push(cues, CUE_HEAL, str(event.get("target_id", "")), healed, false, "%s recovers %d HP." % [_label(target, str(event.get("target_id", ""))), healed])
		"status_applied":
			var afflicted: UnitView = unit(str(event.get("target_id", "")))
			if afflicted != null:
				_sync_hp(afflicted, event)
				if event.get("statuses") is Array:
					afflicted.statuses = _strings(event["statuses"])
			var status_name: String = str(event.get("status_id", ""))
			_push(cues, CUE_STATUS, str(event.get("target_id", "")), int(event.get("duration_turns", 0)), false, "%s is afflicted with %s." % [_label(afflicted, str(event.get("target_id", ""))), _readable(status_name)], _readable(status_name))
		"passive_triggered":
			var passive_owner: UnitView = unit(str(event.get("owner_id", "")))
			_push(cues, CUE_PASSIVE, str(event.get("owner_id", "")), 0, false, "%s: %s." % [_label(passive_owner, str(event.get("owner_id", ""))), _skill_name(str(event.get("skill_id", "")))])
		"enemy_intent_resolved":
			_push(cues, CUE_INTENT, str(event.get("enemy_id", "")), 0, false, "")
		"boss_telegraph_started":
			telegraph_state = TELEGRAPH_CHARGING
			telegraph_action = str(event.get("action_id", ""))
			if not str(event.get("phase_id", "")).is_empty():
				boss_phase_id = str(event["phase_id"])
			_push(cues, CUE_TELEGRAPH, str(event.get("boss_id", "")), 0, false, "The boss is charging %s!" % _readable(telegraph_action))
		"boss_telegraph_held":
			telegraph_state = TELEGRAPH_HELD
			_push(cues, CUE_TELEGRAPH, str(event.get("boss_id", "")), 0, false, "The boss holds its charge.")
		"boss_telegraph_interrupted":
			telegraph_state = TELEGRAPH_INTERRUPTED
			_push(cues, CUE_TELEGRAPH, str(event.get("boss_id", "")), 0, false, "The charge is interrupted!")
		"boss_telegraph_resolved":
			telegraph_state = TELEGRAPH_RESOLVED
			_push(cues, CUE_TELEGRAPH, str(event.get("boss_id", "")), 0, false, "%s lands." % _readable(str(event.get("action_id", ""))))
		"boss_objective_destroyed":
			var objective: UnitView = unit("%s:objective:%s" % [str(event.get("boss_id", "")), str(event.get("objective_id", ""))])
			if objective != null:
				objective.hp = 0
				objective.alive = false
			_push(cues, CUE_OBJECTIVE, str(event.get("boss_id", "")), 0, false, "%s is destroyed." % _readable(str(event.get("objective_id", ""))))
		"boss_phase_changed":
			var boss: UnitView = unit(str(event.get("boss_id", "")))
			if boss != null:
				boss.max_hp = maxi(1, int(event.get("max_hp", boss.max_hp)))
				boss.hp = clampi(int(event.get("hp", boss.hp)), 0, boss.max_hp)
			boss_phase_id = str(event.get("phase_id", ""))
			boss_phase_index = int(event.get("phase_index", 0))
			_push(cues, CUE_PHASE, str(event.get("boss_id", "")), boss_phase_index, false, "The boss enters a new phase: %s." % _readable(boss_phase_id))
		_:
			pass


func _apply_damage(event: Dictionary, cues: Array[Cue]) -> void:
	var target_id: String = str(event.get("target_id", ""))
	var target: UnitView = unit(target_id)
	if target != null:
		_sync_hp(target, event)
		if event.get("alive") is bool:
			target.alive = bool(event["alive"])
			if not target.alive:
				target.hp = 0
	var amount: int = int(event.get("amount", 0))
	var critical: bool = bool(event.get("critical", false))
	var blocked: bool = bool(event.get("blocked", false))
	var line: String
	if blocked:
		line = "%s blocks the attack." % _label(target, target_id)
	else:
		line = "%s takes %d damage%s." % [_label(target, target_id), amount, " (critical)" if critical else ""]
	var kind: String = CUE_BLOCKED if blocked else CUE_DAMAGE
	_push(cues, kind, target_id, amount, critical, line)
	cues[-1].source_id = str(event.get("source_id", ""))


func _sync_hp(view: UnitView, event: Dictionary) -> void:
	if event.get("max_hp") != null:
		view.max_hp = maxi(1, int(event["max_hp"]))
	if event.get("hp") != null:
		view.hp = clampi(int(event["hp"]), 0, view.max_hp)
	if event.get("alive") is bool:
		view.alive = bool(event["alive"])


## An enemy first mentioned by an event has arrived.
func _enter(entity_id: String, cues: Array[Cue]) -> void:
	var view: UnitView = unit(entity_id)
	if view == null or view.on_field:
		return
	view.on_field = true
	_push(cues, CUE_JOIN, entity_id, 0, false, "%s joins the fight." % view.display_name)


func _finish(cues: Array[Cue]) -> void:
	_finished = true
	drift = 0
	for record: Dictionary in _final_units:
		var view: UnitView = unit(str(record["entity_id"]))
		if view == null:
			continue
		if view.hp != int(record["hp"]) or view.alive != bool(record["alive"]):
			drift += 1
		view.max_hp = maxi(1, int(record["max_hp"]))
		view.hp = clampi(int(record["hp"]), 0, view.max_hp)
		view.alive = bool(record["alive"])
		view.focus = int(record.get("focus", 0))
		view.statuses = _strings(record.get("statuses", []))
		if view.hp > 0 or view.alive:
			view.on_field = true
	var line: String = "Victory!" if outcome == "victory" else "Defeat..."
	_push(cues, CUE_END, "", stars, false, line)


func _push(cues: Array[Cue], kind: String, unit_id: String, amount: int, critical: bool, text: String, caption: String = "") -> void:
	var cue: Cue = Cue.new()
	cue.kind = kind
	cue.unit_id = unit_id
	cue.amount = amount
	cue.critical = critical
	cue.text = text
	cue.caption = caption
	cues.append(cue)
	if not text.is_empty():
		log_lines.append(text)
		if log_lines.size() > LOG_LIMIT:
			log_lines.remove_at(0)


func _label(view: UnitView, fallback: String) -> String:
	return view.display_name if view != null else fallback


func _skill_name(skill_id: String) -> String:
	if skill_id.is_empty(): return "Basic Attack"
	if _registry != null and _registry.skills.has(skill_id):
		return _registry.skills[skill_id].name_en
	return _readable(skill_id)


static func _readable(identifier: String) -> String:
	return identifier.replace("_", " ")


static func _strings(values: Variant) -> Array[String]:
	var result: Array[String] = []
	if values is Array:
		for value: Variant in values:
			result.append(str(value))
	return result
