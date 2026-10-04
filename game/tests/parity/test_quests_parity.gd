extends GutTest
## G3.8: QuestProgress and ResetClock reproduce parity/fixtures/quests.json (core/quest_progress.py, core/reset_clock.py and
## the content helpers of backend/quest_service.py): the tasks read from economy_part1.json, six apply_event scripts, the
## rejected inputs, half-day and weekly windows at 82 instants (unix seconds in, ISO strings and the weekly cycle key out)
## and Character XP -> Chronicle item conversion.

var _quest: QuestProgress = null
var _case: Dictionary = {}
var _scripts: Dictionary = {}  # name -> [[event, amount, active segment], ...]: the events tools/parity/f_story.py feeds


func before_all() -> void:
	_quest = QuestProgress.from_content_dir("res://data/content")
	assert_eq(_quest.error, "")
	_case = (ParityFixtures.load_fixture("quests")["cases"] as Array)[0]
	_scripts = _build_scripts()


static func _repeat(event: Array, times: int) -> Array:
	var events: Array = []
	for _i: int in range(times):
		events.append(event.duplicate())
	return events


static func _build_scripts() -> Dictionary:
	return {
		"daily_only": _repeat(["eligible_win", 1, ""], 4) + [["successful_level_up", 1, ""], ["boss_win", 1, ""]],
		"weekly_cycle_a": _repeat(["eligible_win", 1, "cycle_a"], 16),
		"weekly_cycle_b_ignores_a": _repeat(["boss_win", 1, "cycle_a"], 2) + _repeat(["boss_win", 1, "cycle_b"], 6),
		"weekly_sun_eclipse": _repeat(["three_star_win", 1, "sun_eclipse"], 4),
		"amount_over_target": [["eligible_win", 50, "cycle_a"]],
		"no_active_segment": [["eligible_win", 1, ""], ["three_star_win", 2, ""]],
	}


func test_tasks_come_from_the_economy_pack() -> void:
	var tasks: Array[QuestProgress.QuestTask] = _quest.all_tasks()
	assert_eq(ParityCompare.diff(tasks, _case["tasks"]), "")
	assert_eq(_quest.daily_tasks().size(), 2, "the rewarded-ad task has no counted objective")
	assert_eq(_quest.weekly_tasks().size(), 3)


func test_apply_event_scripts() -> void:
	var tasks: Array[QuestProgress.QuestTask] = _quest.all_tasks()
	var sequences: Array = _case["sequences"]
	assert_eq(sequences.size(), _scripts.size())
	for sequence: Dictionary in sequences:
		var name: String = String(sequence["name"])
		var events: Array = _scripts[name]
		var steps: Array = sequence["steps"]
		assert_eq(events.size(), steps.size(), name)
		var progress: Dictionary = {}
		for index: int in range(steps.size()):
			var step: Dictionary = steps[index]
			assert_eq(step["event"], events[index][0], "%s step %d" % [name, index])
			var segment: String = "" if step["active_segment"] == null else String(step["active_segment"])
			progress = _quest.apply_event(progress, tasks, String(step["event"]), int(step["amount"]), segment)
			assert_eq(_quest.error, "", name)
			assert_eq(ParityCompare.diff(progress, step["progress"]), "", "%s step %d" % [name, index])
			assert_eq(ParityCompare.diff(QuestProgress.completed_tasks(progress, tasks), step["completed"]), "", "%s step %d" % [name, index])


func test_invalid_events_and_amounts_are_rejected_without_changing_progress() -> void:
	var tasks: Array[QuestProgress.QuestTask] = _quest.all_tasks()
	var calls: Dictionary = {
		"unknown_event": ["no_such_event", 1],
		"zero_amount": ["eligible_win", 0],
		"negative_amount": ["eligible_win", -1],
		"bool_amount": ["eligible_win", true],
	}
	assert_eq((_case["invalid"] as Array).size(), calls.size())
	for entry: Dictionary in _case["invalid"]:
		assert_eq(entry["raises"], "ValueError")
		var call: Array = calls[entry["name"]]
		var quest: QuestProgress = QuestProgress.from_content_dir("res://data/content")
		var before: Dictionary = {"win_three_battles": 1}
		var after: Dictionary = quest.apply_event(before, tasks, call[0], call[1])
		assert_ne(quest.error, "", String(entry["name"]))
		assert_eq(after, before, String(entry["name"]))


func test_half_day_and_weekly_windows() -> void:
	var windows: Array = _case["windows"]
	assert_gt(windows.size(), 80)
	for entry: Dictionary in windows:
		var unix: int = int(entry["unix"])
		var label: String = "unix %d" % unix
		assert_eq(ParityCompare.diff(ResetClock.half_day_window(unix), entry["half_day"]), "", label)
		assert_eq(ParityCompare.diff(ResetClock.weekly_segment(unix), entry["weekly"]), "", label)
		assert_eq(ParityCompare.diff(ResetClock.weekly_cycle_key(unix), entry["weekly_cycle_key"]), "", label)


func test_naive_datetimes_have_no_counterpart() -> void:
	# The reference rejects a naive datetime with ValueError; the port takes UTC unix seconds, so the case cannot arise.
	assert_eq(_case["naive_datetime_raises"], "ValueError")


func test_character_xp_is_paid_as_chronicle_items_largest_first() -> void:
	var entries: Array = _case["character_xp_items"]
	assert_eq(entries.size(), 9)
	for entry: Dictionary in entries:
		var quest: QuestProgress = QuestProgress.from_content_dir("res://data/content")
		var items: Dictionary = quest.character_xp_items(int(entry["amount"]))
		var label: String = "amount %d" % int(entry["amount"])
		if entry["raises"] != null:
			assert_ne(quest.error, "", label)
			assert_true(items.is_empty(), label)
		else:
			assert_eq(quest.error, "", label)
			assert_eq(ParityCompare.diff(items, entry["items"]), "", label)


func test_content_defaults_and_malformed_rows() -> void:
	# Rows without a counted objective (or with a non-positive / boolean / missing count) are not tracked.
	var schedule: Dictionary = {"tasks": [
		{"id": "a", "objective": {"type": "eligible_wins", "count": 2}},
		{"id": "b", "objective": {"type": "verified_rewarded_ad", "per_view": 30}},
		{"id": "c", "objective": {"type": "boss_wins", "count": 0}},
		{"id": "d", "objective": {"type": "boss_wins", "count": true}},
		{"id": "e"},
		"not a row",
	]}
	var tasks: Array[QuestProgress.QuestTask] = QuestProgress.counted_tasks(schedule)
	assert_eq(tasks.size(), 1)
	assert_eq(tasks[0].task_id, "a")
	assert_eq(tasks[0].segment_id, "")
	assert_eq(QuestProgress.counted_tasks({}).size(), 0)
	assert_eq(QuestProgress.counted_weekly_tasks({}).size(), 0)
	var weekly: Array[QuestProgress.QuestTask] = QuestProgress.counted_weekly_tasks({"segments": [
		{"id": "s1", "objective": {"type": "boss_wins", "count": 5}}, {"id": "s2", "objective": {"type": "x"}}]})
	assert_eq(weekly.size(), 1)
	assert_eq(weekly[0].task_id, "weekly:s1")
	assert_eq(weekly[0].segment_id, "s1")
