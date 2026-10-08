extends GutTest
## Shared presentation must not submit pending actions or navigate on its own.


func test_pending_state_blocks_submission_until_the_owner_changes_state() -> void:
	var view: UiStateView = add_child_autofree(UiStateView.new())
	watch_signals(view)
	view.present("pending", "Processing", "Please wait.", "Submit", "submit")
	view.action.pressed.emit()
	assert_signal_not_emitted(view, "action_requested")
	assert_true(view.action.disabled)
	view.present("error", "Request failed", "Try again.", "Retry", "retry")
	view.action.pressed.emit()
	assert_signal_emitted_with_parameters(view, "action_requested", ["retry"])
	assert_eq(view.state, "error")


func test_navigation_requests_a_route_without_selecting_it_or_enabling_missing_routes() -> void:
	var nav: UiBottomNav = add_child_autofree(UiBottomNav.new())
	watch_signals(nav)
	nav.set_available(["shelter", "journey"])
	nav.select_route("shelter")
	(nav._buttons["records"] as Button).pressed.emit()
	assert_signal_not_emitted(nav, "route_requested")
	(nav._buttons["journey"] as Button).pressed.emit()
	assert_signal_emitted_with_parameters(nav, "route_requested", ["journey"])
	assert_true((nav._buttons["shelter"] as Button).button_pressed)
	assert_false((nav._buttons["journey"] as Button).button_pressed)


func test_badge_keeps_its_caption_on_one_line_when_shrink_aligned() -> void:
	var root: VBoxContainer = VBoxContainer.new()
	root.size = Vector2(1000, 500)
	root.theme = UiTheme.create()
	add_child_autofree(root)
	var badge: PanelContainer = UiKit.badge("Pending")
	root.add_child(badge)
	await wait_process_frames(3)
	var caption: Label = badge.get_child(0) as Label
	var text_width: float = caption.get_theme_font("font").get_string_size(caption.text, HORIZONTAL_ALIGNMENT_LEFT, -1, caption.get_theme_font_size("font_size")).x
	assert_gte(caption.size.x, text_width, "a badge must not collapse into one character per line")


func test_large_text_navigation_captions_fit_their_targets() -> void:
	var root: VBoxContainer = VBoxContainer.new()
	root.size = Vector2(1000, 500)
	root.theme = UiTheme.create(1.25)
	add_child_autofree(root)
	var nav: UiBottomNav = UiBottomNav.new()
	root.add_child(nav)
	await wait_process_frames(3)
	for button: Button in nav._buttons.values():
		var text_width: float = button.get_theme_font("font").get_string_size(button.text, HORIZONTAL_ALIGNMENT_LEFT, -1, button.get_theme_font_size("font_size")).x
		assert_gte(button.size.x, text_width, "navigation captions must not split a word in Large Text: " + button.text)
