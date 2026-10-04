extends GutTest
## GameFlow's gacha and quest views over the server's replies (shapes as server/README.md documents them): display names from the content,
## figures from the server, claim states from the server's claimed keys and verified progress.

class _Backend extends GameBackend:
	var banners_reply: Dictionary = {}
	var pull_reply: Dictionary = {}
	var history_reply: Dictionary = {}
	var status_reply: Dictionary = {}
	var pulled: Array = []

	func gacha_banners() -> Outcome:
		return Outcome.ok(banners_reply)

	func gacha_pull(banner_id: String, pull_count: int, target_id: String = "") -> Outcome:
		pulled = [banner_id, pull_count, target_id]
		return Outcome.ok(pull_reply)

	func gacha_history(_limit: int = 50, _before: int = 0) -> Outcome:
		return Outcome.ok(history_reply)

	func quest_status() -> Outcome:
		return Outcome.ok(status_reply)


static var _flow: GameFlow = null


func before_all() -> void:
	if _flow == null:
		_flow = GameFlow.create()


func _backend() -> _Backend:
	assert_true(_flow.is_ready(), _flow.error)
	var backend: _Backend = _Backend.new()
	_flow.backend = backend
	return backend


static func _json(value: Variant) -> Variant:
	return JSON.parse_string(JSON.stringify(value))


func test_banners_get_titles_from_the_content_and_figures_from_the_server() -> void:
	var backend: _Backend = _backend()
	backend.banners_reply = _json({"banners": [
		{"banner_id": "character:oath_01_aveline", "banner_type": "character", "pull_cost": 1, "closes_at": "2026-10-19T00:00:00Z", "target_ids": null,
			"pity": 12, "hard_pity": 90, "next_pull": {"five_star": 0.006, "four_star": 0.051, "three_star": 0.943},
			"guarantee": {"kind": "featured_character", "active": true, "text": "Next 5★ is guaranteed to be the featured hero"}, "selected_target_id": null},
		{"banner_id": "hall_of_armaments", "banner_type": "weapon", "pull_cost": 1, "closes_at": null,
			"target_ids": ["weapon_aveline_last_vigil", "weapon_fadyme_signature"], "pity": 0, "hard_pity": 80,
			"next_pull": {"five_star": 0.007}, "guarantee": {"text": ""}, "selected_target_id": "weapon_fadyme_signature"},
		{"banner_id": "hall_of_ancestors", "banner_type": "standard_character", "pull_cost": 1, "closes_at": null, "pity": 3, "hard_pity": 80,
			"next_pull": {"five_star": 0.02}, "guarantee": {"text": ""}, "selected_target_id": null},
	]})
	var reply: Outcome = await _flow.gacha_banners()
	assert_true(reply.is_ok(), reply.error)
	var views: Array = reply.value
	assert_eq(views.size(), 3)
	var oath: GameViews.BannerView = views[0]
	assert_eq(oath.title, "Oath: Sister Aveline")
	assert_eq(oath.five_star_percent, 0.6)
	assert_eq([oath.pity, oath.hard_pity], [12, 90])
	assert_eq(oath.guarantee, "Next 5★ is guaranteed to be the featured hero")
	assert_eq(oath.closes_at, "2026-10-19T00:00:00Z")
	var hall: GameViews.BannerView = views[1]
	assert_eq(hall.title, "Hall of Armaments")
	assert_eq(hall.targets, [{"id": "weapon_aveline_last_vigil", "name": "Lantern of the Last Vigil"}, {"id": "weapon_fadyme_signature", "name": "The Hour Between Bells"}] as Array[Dictionary])
	assert_eq(hall.selected_target, "weapon_fadyme_signature")
	assert_eq((views[2] as GameViews.BannerView).title, "Hall of Ancestors")
	assert_eq((views[2] as GameViews.BannerView).closes_at, "")


func test_pull_entries_name_every_result_and_mark_new_and_duplicates() -> void:
	var value: Dictionary = _json({"pull": {"results": [
		{"rarity": 5, "reward_id": "sister_aveline", "is_featured": true, "grant": {"kind": "character", "duplicate": false, "copies": 1, "memory_shards": 0}},
		{"rarity": 4, "reward_id": "fadyme", "is_featured": null, "grant": {"kind": "character", "duplicate": true, "copies": 3, "memory_shards": 10}},
		{"rarity": 3, "reward_id": "weapon_fadyme_signature", "is_featured": null, "grant": {"kind": "weapon", "duplicate": false, "instance_id": "wpn_1", "memory_shards": 0}},
	]}})
	var entries: Array[GameViews.PullEntry] = _flow.pull_entries(value)
	assert_eq(entries.size(), 3)
	assert_eq([entries[0].name_en, entries[0].rarity, entries[0].is_new, entries[0].featured], ["Sister Aveline", 5, true, true])
	assert_eq([entries[1].name_en, entries[1].duplicate, entries[1].memory_shards, entries[1].is_new], ["Fadyme", true, 10, false])
	assert_eq(entries[2].name_en, "The Hour Between Bells")
	assert_eq(StoryDirector.pull_results_text(entries), "5★ Sister Aveline  featured  NEW\n4★ Fadyme  duplicate (+10 Memory Shards)\n3★ The Hour Between Bells  NEW")


func test_history_lines_and_the_last_page() -> void:
	var backend: _Backend = _backend()
	backend.history_reply = _json({"items": [{"pull_id": "pull_1", "rarity": 5, "reward_id": "sister_aveline", "is_featured": true, "hard_pity_triggered": true,
		"created_at_utc": "2026-10-04T11:20:05Z"}], "next_cursor": null})
	var page: Outcome = await _flow.gacha_history()
	assert_true(page.is_ok(), page.error)
	assert_eq((page.value as Dictionary)["lines"], ["2026-10-04 11:20  5★ Sister Aveline  (featured, pity)"] as Array[String])
	assert_eq((page.value as Dictionary)["next_cursor"], 0)


func test_quest_rows_follow_the_servers_progress_and_claims() -> void:
	var backend: _Backend = _backend()
	backend.status_reply = _json({
		"daily_cycle_id": 41466, "daily_ends_at_utc": "2026-10-04T12:00:00+00:00", "weekly_key": "2026-09-28", "weekly_segment": "cycle_b",
		"weekly_ends_at_utc": "2026-10-04T00:00:00+00:00",
		"claimed": ["daily:41466:improve_company_kit"],
		"mail": [
			{"week_key": "2026-09-21", "segment": "sun_eclipse", "expires_at_utc": "x", "claimed": false, "progress": 1, "target": 1},
			{"week_key": "2026-09-28", "segment": "cycle_a", "expires_at_utc": "x", "claimed": true, "progress": 15, "target": 15},
		],
		"daily_tasks": [{"task_id": "win_three_battles", "progress": 3, "target": 3}, {"task_id": "improve_company_kit", "progress": 1, "target": 1}],
		"weekly_tasks": [{"task_id": "weekly:cycle_a", "progress": 0, "target": 15}, {"task_id": "weekly:cycle_b", "progress": 2, "target": 5}],
	})
	var reply: Outcome = await _flow.quest_rows()
	assert_true(reply.is_ok(), reply.error)
	var rows: Array = reply.value
	var keys: Array = rows.map(func(row: GameViews.QuestRow) -> String: return row.key())
	assert_eq(keys, ["daily/win_three_battles/", "daily/improve_company_kit/", "daily/window_completion/", "weekly/cycle_b/", "weekly/sun_eclipse/2026-09-21"],
			"the ad task is not a counted row and a claimed mail row is gone")
	var states: Array = rows.map(func(row: GameViews.QuestRow) -> String: return row.state)
	assert_eq(states, ["claimable", "claimed", "locked", "locked", "claimable"])
	var first: GameViews.QuestRow = rows[0]
	assert_eq(first.title, "Win Three Battles")
	assert_eq(first.reward_text, "80 Eclipse Tokens, 1,500 Character XP, 10,000 Silver Crowns")
	var chest: GameViews.QuestRow = rows[2]
	assert_eq([chest.progress, chest.target], [1, 2], "the chest counts the claimed tasks it needs")
	assert_eq((rows[4] as GameViews.QuestRow).period, "2026-09-21")


func test_grouping_matches_python() -> void:
	assert_eq(GameFlow.grouped(0), "0")
	assert_eq(GameFlow.grouped(999), "999")
	assert_eq(GameFlow.grouped(1000), "1,000")
	assert_eq(GameFlow.grouped(1234567), "1,234,567")
	assert_eq(GameFlow.grouped(-4500), "-4,500")


func test_the_exchange_rate_comes_from_the_economy() -> void:
	assert_eq(_flow.fate_thread_token_cost(), 160)
