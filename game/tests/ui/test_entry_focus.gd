extends GutTest
## Physical UI input and focus ownership through the pre-patch screens; no account/server requests.

func _key(keycode: Key) -> void:
	var event: InputEventKey = InputEventKey.new()
	event.keycode = keycode
	event.physical_keycode = keycode
	event.pressed = true
	get_viewport().push_input(event)
	await wait_process_frames(1)
	event = InputEventKey.new()
	event.keycode = keycode
	event.physical_keycode = keycode
	event.pressed = false
	get_viewport().push_input(event)
	await wait_process_frames(1)

func _entry(phase: String = "sign_in", signed_in: bool = false) -> EntryScreen:
	var entry: EntryScreen = EntryScreen.new()
	entry.present(phase, signed_in)
	add_child_autofree(entry)
	return entry

func _rendered_title() -> TitleScreen:
	# A real logical viewport isolates pointer tests from GUT's own GUI and window scaling.
	var viewport: SubViewport = SubViewport.new()
	viewport.size = Vector2i(1080, 1920)
	add_child_autofree(viewport)
	var title: TitleScreen = TitleScreen.new()
	title.theme = UiTheme.create()
	viewport.add_child(title)
	return title

func _pointer(viewport: Viewport, position: Vector2, touch: bool = false) -> void:
	if touch:
		var press: InputEventScreenTouch = InputEventScreenTouch.new()
		press.position = position
		press.pressed = true
		viewport.push_input(press, true)
		await wait_process_frames(1)
		var release: InputEventScreenTouch = InputEventScreenTouch.new()
		release.position = position
		release.pressed = false
		viewport.push_input(release, true)
	else:
		var motion: InputEventMouseMotion = InputEventMouseMotion.new()
		motion.position = position
		viewport.push_input(motion, true)
		var press: InputEventMouseButton = InputEventMouseButton.new()
		press.position = position
		press.button_index = MOUSE_BUTTON_LEFT
		press.pressed = true
		viewport.push_input(press, true)
		await wait_process_frames(1)
		var release: InputEventMouseButton = InputEventMouseButton.new()
		release.position = position
		release.button_index = MOUSE_BUTTON_LEFT
		release.pressed = false
		viewport.push_input(release, true)
	await wait_process_frames(1)

func test_title_background_mouse_and_touch_start_without_a_button_target() -> void:
	var title: TitleScreen = _rendered_title()
	title.set_ready(true)
	watch_signals(title)
	await wait_process_frames(3)
	await _pointer(title.get_viewport(), title.get_global_rect().position + Vector2(180, 320))
	assert_signal_emit_count(title, "start_requested", 1, "the artwork accepts a physical mouse event")
	await _pointer(title.get_viewport(), title._logo.get_global_rect().get_center(), true)
	assert_signal_emit_count(title, "start_requested", 2, "the logo accepts a real touch event")

func test_title_background_early_touch_waits_and_support_does_not_start() -> void:
	var title: TitleScreen = _rendered_title()
	watch_signals(title)
	await wait_process_frames(3)
	await _pointer(title.get_viewport(), title.get_global_rect().position + Vector2(180, 320), true)
	assert_true(title.start_pending)
	assert_signal_not_emitted(title, "start_requested")
	title.set_ready(true)
	assert_signal_emit_count(title, "start_requested", 1)
	await _pointer(title.get_viewport(), title._support_button.get_global_rect().get_center())
	assert_signal_emit_count(title, "support_requested", 1)
	assert_signal_emit_count(title, "start_requested", 1, "Support owns its input")

func test_title_breathing_prompt_is_legible_and_respects_reduced_motion() -> void:
	var title: TitleScreen = _rendered_title()
	title._pulse_time = 0
	title._process(1.4)
	assert_almost_eq(title._start_button.modulate.a, 0.40, 0.001)
	assert_true(title._start_button.get_theme_stylebox("normal") is StyleBoxEmpty, "the prompt is typography rather than a framed primary button")
	title.reduced_motion = true
	title._process(1.4)
	assert_eq(title._start_button.modulate.a, 1.0)

func test_promoted_title_art_and_wordmark_resolve_from_the_shipped_catalog() -> void:
	var catalog: AssetCatalog = AssetCatalog.from_dir("res://data/content")
	assert_eq(catalog.error, "")
	var title: TitleScreen = TitleScreen.new()
	title.assets = AssetResolver.new(catalog)
	add_child_autofree(title)
	assert_false(title.shows_placeholder())
	assert_true(title._art.visible)
	assert_true(title._logo.visible)
	assert_false(title._name_label.visible)
	assert_eq(title.assets.missing(), [], "runtime Title has no missing art warning")

func test_title_can_be_started_with_keyboard_after_lazy_construction() -> void:
	var title: TitleScreen = TitleScreen.new()
	title.assets = AssetResolver.new(AssetCatalog.from_packs({}), func(_path: String) -> bool: return false)
	title.load_title("build 1")
	title.set_ready(true)
	add_child_autofree(title)
	watch_signals(title)
	await wait_process_frames(2)
	assert_same(get_viewport().gui_get_focus_owner(), title._start_button)
	await _key(KEY_ENTER)
	assert_signal_emit_count(title, "start_requested", 1)
	await _key(KEY_TAB)
	assert_same(get_viewport().gui_get_focus_owner(), title._support_button)
	assert_signal_emit_count(title, "start_requested", 1, "navigation does not start a second command")

func test_entry_keyboard_command_requires_an_actionable_phase() -> void:
	var entry: EntryScreen = _entry()
	watch_signals(entry)
	await wait_process_frames(2)
	assert_same(get_viewport().gui_get_focus_owner(), entry.primary)
	await _key(KEY_ENTER)
	assert_signal_emitted_with_parameters(entry, "action_requested", ["sign_in"])
	assert_signal_emit_count(entry, "action_requested", 1)
	entry.present("checking", false)
	assert_null(get_viewport().gui_get_focus_owner(), "patch has no actionable footer")
	await _key(KEY_ENTER)
	assert_signal_not_emitted(entry, "utility_requested")
	assert_signal_emit_count(entry, "action_requested", 1, "checking cannot submit sign-in again")

func test_logout_requires_a_session_and_does_not_interrupt_busy_work() -> void:
	var entry: EntryScreen = _entry()
	watch_signals(entry)
	await wait_process_frames(3)
	assert_false(entry._sign_out.visible)
	entry._sign_out.pressed.emit()
	assert_signal_not_emitted(entry, "utility_requested")
	entry.present("ready", true)
	assert_true(entry._sign_out.visible)
	assert_false(entry._sign_out.disabled)
	entry._sign_out.pressed.emit()
	assert_signal_emitted_with_parameters(entry, "utility_requested", ["sign_out"])
	entry.present("downloading", true)
	assert_true(entry._sign_out.disabled)
	entry._sign_out.pressed.emit()
	assert_signal_emit_count(entry, "utility_requested", 1)

func test_utility_returns_focus_to_gateway_and_closes_when_patch_begins() -> void:
	var entry: EntryScreen = _entry("ready", true)
	await wait_process_frames(2)
	var utility: EntryUtility = EntryUtility.new()
	utility.page = "settings"
	entry.open_utility(utility)
	var focus: Control = get_viewport().gui_get_focus_owner()
	assert_true(utility.is_ancestor_of(focus))
	assert_true(utility.is_ancestor_of(focus))
	for index: int in 7:
		await _key(KEY_TAB)
		assert_true(utility.is_ancestor_of(get_viewport().gui_get_focus_owner()))
	assert_true(entry.handle_back())
	assert_same(get_viewport().gui_get_focus_owner(), entry.primary)
	entry.open_utility(EntryUtility.new())
	entry.present("checking", true)
	assert_null(entry._overlay, "patch closes utility overlays")
	assert_false(entry._footer.is_visible_in_tree())
	await wait_process_frames(2)

func test_physical_entry_clicks_do_not_move_controls_or_trigger_footer_actions() -> void:
	var viewport: SubViewport = SubViewport.new()
	viewport.size = Vector2i(1080, 1920)
	add_child_autofree(viewport)
	var entry: EntryScreen = EntryScreen.new()
	entry.theme = UiTheme.create()
	entry.present("sign_in", false)
	viewport.add_child(entry)
	await wait_process_frames(4)
	watch_signals(entry)
	var bounds: Rect2 = entry.primary.get_global_rect()
	assert_gte(bounds.size.y, 144.0)
	assert_almost_eq(bounds.get_center().y, 1056.0, 150.0, "button is near the middle")
	await _pointer(viewport, bounds.get_center())
	assert_signal_emitted_with_parameters(entry, "action_requested", ["sign_in"])
	assert_eq(entry.primary.get_global_rect(), bounds, "press feedback preserves layout and hit geometry")
	await _pointer(viewport, bounds.position + Vector2(24, 24), true)
	assert_signal_emit_count(entry, "action_requested", 2)
	await _pointer(viewport, entry._settings_button.get_global_rect().get_center(), true)
	assert_signal_emitted_with_parameters(entry, "utility_requested", ["settings"])
	assert_signal_emit_count(entry, "action_requested", 2, "footer does not leak into main action")
	entry.present("ready", true)
	await wait_process_frames(3)
	await _pointer(viewport, entry.primary.get_global_rect().get_center(), true)
	assert_signal_emitted_with_parameters(entry, "action_requested", ["begin"])
	assert_true(entry._sign_out.is_visible_in_tree())
	entry.present("downloading", true)
	assert_false(entry._footer.is_visible_in_tree())
	assert_null(entry._overlay)

func test_entry_wordmark_is_centered_lowered_and_utilities_use_the_footer() -> void:
	var viewport: SubViewport = SubViewport.new()
	viewport.size = Vector2i(1080, 1920)
	add_child_autofree(viewport)
	var entry: EntryScreen = EntryScreen.new()
	entry.theme = UiTheme.create(1.25)
	entry.present("sign_in", false)
	viewport.add_child(entry)
	await wait_process_frames(4)
	assert_almost_eq(entry._logo.get_global_rect().get_center().x, 540.0, 1.0, "wordmark centers on the viewport, independent of utilities")
	assert_eq(entry.session_label.horizontal_alignment, HORIZONTAL_ALIGNMENT_CENTER)
	assert_eq(entry._help_button.text, "Help")
	assert_null(entry._help_button.icon, "utility remains clearly labelled")
	assert_gte(entry._logo.get_global_rect().position.y, 176.0, "logo has room below the red moon")
	assert_gt(entry._help_button.get_global_rect().position.y, entry._logo.get_global_rect().end.y)
	assert_eq(entry._help_button.get_theme_font_size("font_size"), 55, "44 pt utilities scale to 125%")
	var face: FontVariation = entry._help_button.get_theme_font("font") as FontVariation
	assert_not_null(face)
	assert_eq(float(face.variation_opentype[0x77676874]), 800.0)
	assert_eq(float(TextServerManager.get_primary_interface().font_get_variation_coordinates(face.get_rids()[0])[0x77676874]), 800.0, "the TextServer actually renders the heavy weight")

func test_entry_variable_fonts_use_the_engine_weight_axis_for_real_rendering() -> void:
	var theme: Theme = UiTheme.create()
	var server: TextServer = TextServerManager.get_primary_interface()
	for type: String in ["TitlePromptButton", "QuietButton", "EntrySignInButton", "EntryHeading", "EntrySubtitle", "SettingButton", "EntryQuote", "GoogleButton"]:
		var face: FontVariation = theme.get_font("font", type) as FontVariation
		var expected: float = 600.0 if type == "EntryQuote" else (500.0 if type == "GoogleButton" else 800.0)
		assert_not_null(face, type)
		var coordinates: Dictionary = server.font_get_variation_coordinates(face.get_rids()[0])
		assert_true(coordinates.has(0x77676874), type + " has an effective OpenType weight")
		assert_eq(float(coordinates.get(0x77676874, 0.0)), expected, type + " renders at the requested weight")

func test_title_wordmark_is_lower_while_account_and_patch_keep_shared_geometry() -> void:
	var title: TitleScreen = _rendered_title()
	await wait_process_frames(3)
	var bounds: Rect2 = title._logo.get_global_rect()
	var entry: EntryScreen = EntryScreen.new()
	entry.theme = UiTheme.create()
	title.get_viewport().add_child(entry)
	await wait_process_frames(3)
	var account_bounds: Rect2 = entry._logo.get_global_rect()
	assert_eq(bounds.position.y, account_bounds.position.y + 204.0, "Title moves below Fadyme's face")
	assert_eq(bounds.size, account_bounds.size, "Title preserves wordmark size")
	assert_eq(bounds.get_center().x, account_bounds.get_center().x)
	assert_true(entry._opening_quote.visible)
	for phase: String in ["ready", "checking", "update_available", "downloading", "verifying", "installing", "snapshot_sync", "login_error"]:
		entry.present(phase, true)
		await wait_process_frames(2)
		assert_eq(entry._logo.get_global_rect(), account_bounds, phase + " cannot move or resize the wordmark")
		assert_false(entry._opening_quote.visible, phase + " cannot repeat the opening quote")
	entry.present("sign_in", false)
	assert_true(entry._opening_quote.visible)

func test_public_footer_never_contains_a_duplicate_menu_button() -> void:
	var entry: EntryScreen = _entry("sign_in", false)
	await wait_process_frames(2)
	for node: Node in entry.find_children("*", "Button", true, false):
		assert_ne((node as Button).text, "Menu")
	assert_eq(entry.primary.theme_type_variation, "EntrySignInButton")
	assert_eq(entry.primary.text, "SIGN IN")
	assert_eq(entry.primary.language, "en", "English shaping ignores the device's Turkish locale")
	assert_eq(entry._opening_quote.text, "Some bells ring for the living\nOthers... for the forgotten")
	assert_eq(entry._logo.custom_minimum_size.y, 300.0)
	assert_eq(entry._logo_space.custom_minimum_size.y, 216.0)
	assert_false(entry.heading.visible)
	assert_false(entry.message.visible)
	assert_eq(entry._settings_button.text, "Settings")

func test_all_entry_utility_pages_keep_the_shared_logo_and_no_opening_quote() -> void:
	var title: TitleScreen = _rendered_title()
	var entry: EntryScreen = EntryScreen.new()
	title.get_viewport().add_child(entry)
	await wait_process_frames(3)
	var bounds: Rect2 = entry._logo.get_global_rect()
	for page_id: String in ["settings", "help", "contact", "licenses"]:
		var utility: EntryUtility = EntryUtility.new()
		utility.page = page_id
		title.get_viewport().add_child(utility)
		await wait_process_frames(3)
		assert_eq(utility._logo.get_global_rect(), bounds, page_id + " preserves the shared wordmark bounds")
		for label: Node in utility.find_children("*", "Label", true, false):
			assert_false("Some bells" in (label as Label).text, page_id + " has no opening quote")
		utility.queue_free()
		await wait_process_frames(1)

func test_contact_keyboard_can_reach_send_after_form_validation() -> void:
	var entry: EntryScreen = _entry()
	var contact: EntryUtility = EntryUtility.new()
	contact.page = "contact"
	entry.open_utility(contact)
	await wait_process_frames(3)
	assert_eq(contact.submit_button.focus_mode, Control.FOCUS_NONE)
	contact.reply_field.text = "player@example.test"
	contact.subject_field.text = "Account chooser"
	contact.message_field.text = "The chooser does not open when I select Continue with Google."
	contact.consent.button_pressed = true
	contact._refresh_submit()
	assert_eq(contact.submit_button.focus_mode, Control.FOCUS_ALL)
	contact.consent.grab_focus()
	await _key(KEY_TAB)
	assert_same(get_viewport().gui_get_focus_owner(), contact.submit_button)
	var scroll: ScrollContainer = contact.find_children("*", "ScrollContainer", true, false)[0] as ScrollContainer
	assert_true(scroll.get_global_rect().encloses(contact.submit_button.get_global_rect()), "keyboard navigation scrolls the enabled Send Message fully into view")
	watch_signals(contact)
	await _key(KEY_ENTER)
	assert_signal_emit_count(contact, "support_submitted", 1)
