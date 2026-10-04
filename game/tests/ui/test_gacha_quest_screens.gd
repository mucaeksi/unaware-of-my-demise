extends GutTest
## The Summon and Quests screens on their own (ports of client/screens/gacha_screen.py and quests_screen.py): what each shows, which buttons
## are enabled when, and which signal each raises. The views behind them are test_gacha_quest_flow.gd.


func _banner(banner_id: String, banner_type: String, pity: int = 12) -> GameViews.BannerView:
	var banner: GameViews.BannerView = GameViews.BannerView.new()
	banner.banner_id = banner_id
	banner.banner_type = banner_type
	banner.title = banner_id.capitalize()
	banner.pull_cost = 1
	banner.five_star_percent = 0.6
	banner.pity = pity
	banner.hard_pity = 90
	return banner


func _gacha(fate_threads: int = 5) -> GachaScreen:
	var gacha: GachaScreen = add_child_autofree(GachaScreen.new())
	var hall: GameViews.BannerView = _banner("hall_of_armaments", "weapon", 0)
	hall.title = "Hall of Armaments"
	hall.targets = [{"id": "w1", "name": "First Blade"}, {"id": "w2", "name": "Second Blade"}] as Array[Dictionary]
	hall.selected_target = "w2"
	var oath: GameViews.BannerView = _banner("character:oath_01_aveline", "character")
	oath.title = "Oath: Sister Aveline"
	oath.closes_at = "2026-10-19T00:00:00Z"
	oath.guarantee = "Next 5★ is guaranteed to be the featured hero"
	gacha.load_gacha([oath, hall] as Array[GameViews.BannerView], fate_threads)
	return gacha


func test_nothing_can_be_pulled_before_a_banner_is_chosen() -> void:
	var gacha: GachaScreen = _gacha()
	assert_eq(gacha.banner_ids(), ["character:oath_01_aveline", "hall_of_armaments"] as Array[String])
	assert_eq(gacha.wallet_text(), "Fate's Threads: 5")
	assert_eq(gacha.info_label_text(), "Select a banner.")
	assert_false(gacha.pull_enabled(1))
	assert_false(gacha.target_visible())


func test_the_rules_are_shown_before_a_pull_and_the_wallet_gates_the_buttons() -> void:
	var gacha: GachaScreen = _gacha()
	gacha.choose("character:oath_01_aveline")
	assert_eq(gacha.info_label_text(), "Oath: Sister Aveline\nNext pull: 0.6% for a 5★. Guaranteed 5★ at 90 pulls without one (now 12).\n"
			+ "Cost: 1 Fate's Thread per pull. Duplicates become Memory Shards.\nCloses 2026-10-19 00:00:00 UTC\nNext 5★ is guaranteed to be the featured hero")
	assert_true(gacha.pull_enabled(1))
	assert_false(gacha.pull_enabled(10), "5 threads do not pay ten pulls")
	watch_signals(gacha)
	gacha.press_pull(1)
	assert_signal_emitted_with_parameters(gacha, "pull_requested", ["character:oath_01_aveline", 1, ""])


func test_the_hall_of_armaments_pulls_for_the_chosen_target() -> void:
	var gacha: GachaScreen = _gacha(20)
	gacha.choose("hall_of_armaments")
	assert_true(gacha.target_visible())
	assert_eq(gacha.target_text(), "Target: Second Blade", "the server's remembered target comes first")
	gacha.cycle_target()
	assert_eq(gacha.target_text(), "Target: First Blade")
	watch_signals(gacha)
	gacha.press_pull(10)
	assert_signal_emitted_with_parameters(gacha, "pull_requested", ["hall_of_armaments", 10, "w1"])


func test_a_pull_in_flight_blocks_everything_until_the_reload() -> void:
	var gacha: GachaScreen = _gacha(20)
	gacha.choose("character:oath_01_aveline")
	gacha.set_busy(true)
	assert_false(gacha.pull_enabled(1))
	assert_false(gacha.pull_enabled(10))
	gacha.load_gacha([_banner("character:oath_01_aveline", "character")] as Array[GameViews.BannerView], 19, "character:oath_01_aveline", "5★ Sister Aveline  NEW")
	assert_true(gacha.pull_enabled(10))
	assert_eq(gacha.results_text(), "5★ Sister Aveline  NEW")
	assert_eq(gacha.selected, "character:oath_01_aveline", "a reload keeps the banner")


func _row(kind: String, task_id: String, state: String, period: String = "") -> GameViews.QuestRow:
	var row: GameViews.QuestRow = GameViews.QuestRow.new()
	row.kind = kind
	row.task_id = task_id
	row.title = task_id.capitalize()
	row.progress = 1
	row.target = 3
	row.state = state
	row.reward_text = "80 Eclipse Tokens"
	row.period = period
	return row


func test_only_a_claimable_row_can_be_claimed() -> void:
	var quests: QuestsScreen = add_child_autofree(QuestsScreen.new())
	quests.load_quests([_row("daily", "win_three_battles", "locked"), _row("daily", "improve_company_kit", "claimed"),
			_row("weekly", "cycle_a", "claimable", "2026-09-28")] as Array[GameViews.QuestRow])
	assert_eq(quests.row_label("daily/win_three_battles/"), "Win Three Battles  1/3  [in progress]\nReward: 80 Eclipse Tokens")
	assert_false(quests.claim_enabled())
	quests.choose("daily/improve_company_kit/")
	assert_false(quests.claim_enabled(), "already claimed")
	quests.choose("weekly/cycle_a/2026-09-28")
	assert_true(quests.claim_enabled())
	watch_signals(quests)
	quests.press_claim()
	assert_signal_emitted_with_parameters(quests, "claim_requested", ["weekly", "cycle_a", "2026-09-28"])
	quests.set_busy(true)
	assert_false(quests.claim_enabled())
