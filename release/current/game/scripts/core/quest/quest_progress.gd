class_name QuestProgress
extends RefCounted
## Daily / weekly task progress (port of core/quest_progress.py) plus the content-side helpers of
## backend/quest_service.py (`daily_tasks`, `weekly_tasks`, `character_xp_items`).
##
## Pure: no persistence, no rewards, no clock. Tasks come from `economy_part1.json` (`daily_schedule.tasks`,
## `weekly_cycle.segments`); only tasks with a counted objective (`{"type": ..., "count": N}`) are tracked.
## `verified_rewarded_ad` is excluded on purpose: its progress must come from a verified ad-provider callback.
## The caller supplies the cycle id (`ResetClock`) and persists the returned mapping.
##
## Failures the reference raises as `ValueError` set `error` (the first failure wins, the call returns its neutral
## value). JSON numbers are floats in Godot, so a `count` of `3.0` counts as an integer here (invalid content only).

const WEEKLY_PREFIX: String = "weekly:"

## Gameplay event name -> the objective `type` it advances. One victory can raise several events.
const EVENT_OBJECTIVES: Dictionary = {
	"eligible_win": "eligible_wins",
	"boss_win": "boss_wins",
	"three_star_win": "three_star_wins",
	"successful_level_up": "successful_level_up",
}


class QuestTask extends RefCounted:
	var task_id: String = ""
	var objective_type: String = ""
	var target: int = 0
	## Weekly tasks only advance while their segment is the active one; "" for daily tasks.
	var segment_id: String = ""


var error: String = ""

var _economy: Dictionary = {}
var _character_xp: Variant = null


## Reads `economy_part1.json` and `items_part1.json` from `content_dir` (as the reference reads the packs directly).
static func from_content_dir(content_dir: String) -> QuestProgress:
	var quest: QuestProgress = QuestProgress.new()
	var economy: Variant = _read_json(content_dir.path_join("economy_part1.json"))
	var items: Variant = _read_json(content_dir.path_join("items_part1.json"))
	if not (economy is Dictionary) or not (items is Dictionary):
		quest.error = "economy_part1.json / items_part1.json could not be read"
		return quest
	quest._economy = economy
	var rules: Variant = (items as Dictionary).get("progression_rules", {})
	quest._character_xp = (rules as Dictionary).get("character_xp") if rules is Dictionary else null
	return quest


static func _read_json(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	return JSON.parse_string(FileAccess.get_file_as_string(path))


func _fail(message: String) -> void:
	if error.is_empty():
		error = message


static func _is_positive_whole(value: Variant) -> bool:
	if value is bool:
		return false
	if value is int:
		return value > 0
	return value is float and is_finite(value) and value == floorf(value) and value > 0.0


## The raw economy_part1.json object (task rows, reward amounts, banners).
func economy() -> Dictionary:
	return _economy


func daily_tasks() -> Array[QuestTask]:
	return counted_tasks(_economy.get("daily_schedule", {}))


func weekly_tasks() -> Array[QuestTask]:
	return counted_weekly_tasks(_economy.get("weekly_cycle", {}))


## Daily tasks followed by weekly tasks (the order the reference's fixtures use).
func all_tasks() -> Array[QuestTask]:
	var tasks: Array[QuestTask] = daily_tasks()
	tasks.append_array(weekly_tasks())
	return tasks


static func counted_tasks(daily_schedule: Dictionary) -> Array[QuestTask]:
	var tasks: Array[QuestTask] = []
	for row: Variant in daily_schedule.get("tasks", []):
		var objective: Variant = (row as Dictionary).get("objective", {}) if row is Dictionary else {}
		var count: Variant = (objective as Dictionary).get("count") if objective is Dictionary else null
		if _is_positive_whole(count):
			var task: QuestTask = QuestTask.new()
			task.task_id = str((row as Dictionary)["id"])
			task.objective_type = str((objective as Dictionary)["type"])
			task.target = int(count)
			tasks.append(task)
	return tasks


## Counted objectives of `weekly_cycle.segments` as `weekly:<segment>` tasks.
static func counted_weekly_tasks(weekly_cycle: Dictionary) -> Array[QuestTask]:
	var tasks: Array[QuestTask] = []
	for segment: Variant in weekly_cycle.get("segments", []):
		var objective: Variant = (segment as Dictionary).get("objective", {}) if segment is Dictionary else {}
		var count: Variant = (objective as Dictionary).get("count") if objective is Dictionary else null
		if _is_positive_whole(count):
			var task: QuestTask = QuestTask.new()
			task.task_id = WEEKLY_PREFIX + str((segment as Dictionary)["id"])
			task.objective_type = str((objective as Dictionary)["type"])
			task.target = int(count)
			task.segment_id = str((segment as Dictionary)["id"])
			tasks.append(task)
	return tasks


## New progress after `event` (capped at each task's target). Tasks with a segment only advance when it equals
## `active_segment` ("" = none). `amount` is a Variant so a non-integer (or bool) is rejected like the reference does.
func apply_event(progress: Dictionary, tasks: Array[QuestTask], event: String, amount: Variant = 1, active_segment: String = "") -> Dictionary:
	if not EVENT_OBJECTIVES.has(event):
		_fail("Unknown quest event %s" % ContentLoader.py_repr(event))
		return progress.duplicate()
	if amount is bool or not (amount is int) or int(amount) <= 0:
		_fail("amount must be a positive integer")
		return progress.duplicate()
	var objective: String = EVENT_OBJECTIVES[event]
	var updated: Dictionary = progress.duplicate()
	for task: QuestTask in tasks:
		if not task.segment_id.is_empty() and task.segment_id != active_segment:
			continue
		if task.objective_type == objective:
			updated[task.task_id] = mini(task.target, int(updated.get(task.task_id, 0)) + int(amount))
	return updated


## Ids of the tasks whose progress reached the target, sorted.
static func completed_tasks(progress: Dictionary, tasks: Array[QuestTask]) -> Array[String]:
	var done: Array[String] = []
	for task: QuestTask in tasks:
		if int(progress.get(task.task_id, 0)) >= task.target:
			done.append(task.task_id)
	done.sort()
	return done


## Pays `amount` Character XP as Chronicle items, largest first (draft_v1): `{item_id: count}`. Every authored quest
## amount is a multiple of the smallest item (the content validator pins it), so the conversion is exact.
func character_xp_items(amount: int) -> Dictionary:
	var items: Dictionary = {}
	if not (_character_xp is Dictionary) or (_character_xp as Dictionary).is_empty():
		_fail("items_part1.json progression_rules.character_xp is missing")
		return items
	var values: Array = []
	for item_id: String in _character_xp:
		values.append([item_id, int((_character_xp as Dictionary)[item_id])])
	var ordered: Array = BattleUtil.sorted_by(values, func(entry: Array) -> Array: return [-int(entry[1])])
	var remaining: int = amount
	for entry: Array in ordered:
		var xp: int = entry[1]
		var count: int = remaining / xp
		remaining = remaining % xp
		if count != 0:
			items[entry[0]] = count
	if remaining != 0:
		_fail("%d Character XP is not a multiple of the smallest XP item" % amount)
		return {}
	return items
