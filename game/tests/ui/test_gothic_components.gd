extends GutTest
## User-visible busy/cancel/confirm behavior through the same Controls existing screens consume.


func _button(disabled: bool = false) -> GothicActionButton:
	var button: GothicActionButton = UiKit.button("Continue", true, UiTheme.PRIMARY) as GothicActionButton
	button.icon = UiTheme.GothicTheme.icon("journey")
	button.disabled = disabled
	button.button_pressed = true
	return add_child_autofree(button)


func test_busy_restores_the_original_action_and_selection() -> void:
	var button: GothicActionButton = _button()
	var original: Texture2D = button.icon
	watch_signals(button)
	button.set_busy(true)
	button.set_busy(true)  # repeated async update must not overwrite the original state
	assert_true(button.disabled)
	assert_eq(button.text, "Preparing…")
	assert_signal_emit_count(button, "busy_changed", 1)
	button.set_busy(false)
	assert_false(button.disabled)
	assert_eq(button.text, "Continue")
	assert_same(button.icon, original)
	assert_true(button.button_pressed)
	assert_signal_emit_count(button, "busy_changed", 2)


func test_busy_does_not_enable_an_action_that_was_already_unavailable() -> void:
	var button: GothicActionButton = _button(true)
	button.set_busy(true, "Waiting…")
	button.set_busy(false)
	assert_true(button.disabled)
	assert_eq(button.text, "Continue")


func test_modal_back_cancels_once_and_returns_focus_to_the_caller() -> void:
	var opener: Button = add_child_autofree(UiKit.button("Open"))
	opener.grab_focus()
	var modal: GothicModal = add_child_autofree(GothicModal.new())
	watch_signals(modal)
	modal.open("Leave?", "Your journey remains.", "Sign out", true)
	assert_same(get_viewport().gui_get_focus_owner(), modal._cancel)
	assert_true(modal.handle_back())
	assert_false(modal.handle_back())
	assert_signal_emit_count(modal, "canceled", 1)
	assert_signal_not_emitted(modal, "confirmed")
	assert_same(get_viewport().gui_get_focus_owner(), opener)


func test_modal_confirm_is_an_explicit_single_signal() -> void:
	var modal: GothicModal = add_child_autofree(GothicModal.new())
	watch_signals(modal)
	modal.open("Continue?", "Your choice is yours.")
	modal._confirm.pressed.emit()
	modal._confirm.pressed.emit()
	assert_signal_emit_count(modal, "confirmed", 1)
	assert_signal_not_emitted(modal, "canceled")
	assert_false(modal.visible)


func test_modal_escape_cancels_without_confirming() -> void:
	var modal: GothicModal = add_child_autofree(GothicModal.new())
	watch_signals(modal)
	modal.open("Leave?", "This can be canceled.")
	var escape: InputEventKey = InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	Input.parse_input_event(escape)
	await wait_process_frames(2)
	assert_signal_emit_count(modal, "canceled", 1)
	assert_signal_not_emitted(modal, "confirmed")


func test_modal_keyboard_navigation_stays_inside_its_actions() -> void:
	var behind: Button = add_child_autofree(UiKit.button("Behind the modal"))
	behind.grab_focus()
	var modal: GothicModal = add_child_autofree(GothicModal.new())
	modal.open("Continue?", "Choose an action.")
	for expected: Button in [modal._confirm, modal._cancel]:
		var tab: InputEventKey = InputEventKey.new()
		tab.keycode = KEY_TAB
		tab.pressed = true
		Input.parse_input_event(tab)
		await wait_process_frames(1)
		assert_same(get_viewport().gui_get_focus_owner(), expected)


func test_long_hub_menu_scrolls_to_the_focused_last_action() -> void:
	var hub: HubScreen = HubScreen.new()
	hub.theme = UiTheme.create()
	add_child_autofree(hub)
	var entries: Array[Dictionary] = []
	# The real hub can offer eleven actions, including Inn Meal and debug Diagnostics.
	for index: int in range(11):
		entries.append({"id": str(index), "label": "Menu action %d" % index})
	hub.load_hub("", entries)
	await wait_process_frames(3)
	var last: Button = hub._buttons["10"]
	last.grab_focus()
	await wait_process_frames(3)
	var scroll: ScrollContainer = hub._menu.get_parent() as ScrollContainer
	assert_gt(scroll.scroll_vertical, 0, "keyboard focus must expose the action instead of leaving it below the screen")
	assert_true(scroll.get_global_rect().encloses(last.get_global_rect()))
