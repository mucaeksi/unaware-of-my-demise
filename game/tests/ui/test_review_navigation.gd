extends GutTest
func test_android_back_returns_menu_screens_to_their_existing_destinations() -> void:
	for screen: UiScreen in [TeamScreen.new(), InventoryScreen.new(), SettingsScreen.new(), RecordsScreen.new(), RosterScreen.new()]:
		add_child_autofree(screen)
		watch_signals(screen)
		assert_true(screen.handle_back())
		assert_signal_emitted(screen, "back_requested")

func test_selector_blocks_back_and_duplicate_confirmation_while_request_is_pending() -> void:
	var selector: SelectorScreen = add_child_autofree(SelectorScreen.new())
	var choice: GameFlow.RosterCandidate = GameFlow.RosterCandidate.new()
	choice.character_id = "tilda_fen"
	choice.name_en = "Tilda"
	selector.load_choices([choice] as Array[GameFlow.RosterCandidate])
	selector.choose("tilda_fen")
	selector.set_busy(true)
	watch_signals(selector)
	selector.confirm()
	assert_signal_not_emitted(selector, "confirmed")
	assert_true(selector.handle_back())
	assert_signal_not_emitted(selector, "back_requested")
	# The visible Back button must obey the same pending-request guard.
	(selector.body.get_child(selector.body.get_child_count() - 1) as Button).pressed.emit()
	assert_signal_not_emitted(selector, "back_requested")
	selector.set_busy(false)
	selector.confirm()
	assert_signal_emitted(selector, "confirmed")

func test_settings_accessibility_reports_changes_through_the_existing_shell_owner() -> void:
	var screen: SettingsScreen = add_child_autofree(SettingsScreen.new())
	screen.load_accessibility(1.0, false)
	watch_signals(screen)
	(screen._accessibility.get_child(1) as Button).button_pressed = true
	assert_signal_emitted_with_parameters(screen, "text_scale_changed", [1.25])
	(screen._accessibility.get_child(2) as Button).button_pressed = true
	assert_signal_emitted_with_parameters(screen, "motion_changed", [true])

func test_platform_back_cannot_leave_pending_purchases_pulls_or_reward_requests() -> void:
	for screen: UiScreen in [GachaScreen.new(), BlessingScreen.new(), QuestsScreen.new(), MailboxScreen.new(), FriendsScreen.new()]:
		add_child_autofree(screen)
		watch_signals(screen)
		screen.call("set_busy", true)
		assert_true(screen.handle_back())
		assert_signal_not_emitted(screen, "back_requested")
		screen.call("set_busy", false)
		assert_true(screen.handle_back())
		assert_signal_emitted(screen, "back_requested")
