extends GutTest

func test_settings_reports_real_values_and_gates_future_frame_rate() -> void:
	var utility: EntryUtility = EntryUtility.new()
	utility.page = "settings"
	utility.volumes = {"Music": 0.8, "Voice": 0.5, "SFX": 1.0}
	add_child_autofree(utility)
	watch_signals(utility)
	assert_almost_eq((utility.sliders["Music"] as HSlider).value, 0.8, 0.001)
	(utility.sliders["Voice"] as HSlider).value = 0.0
	assert_signal_emitted_with_parameters(utility, "volume_changed", ["Voice", 0.0])
	(utility.fps_buttons[30] as Button).pressed.emit()
	assert_signal_emitted_with_parameters(utility, "frame_rate_changed", [30])
	assert_true((utility.fps_buttons[120] as Button).disabled)
	(utility.fps_buttons[120] as Button).pressed.emit()
	assert_signal_emit_count(utility, "frame_rate_changed", 1)

func test_settings_active_states_are_red_and_use_buttons_without_checkbox_glyphs() -> void:
	var utility: EntryUtility = EntryUtility.new()
	utility.theme = UiTheme.create()
	utility.page = "settings"
	add_child_autofree(utility)
	assert_eq(utility.find_children("*", "CheckBox", true, false).size(), 0)
	assert_eq((utility.fps_buttons[60] as Button).theme_type_variation, "SettingButton")
	var normal: StyleBoxFlat = (utility.fps_buttons[60] as Button).get_theme_stylebox("normal") as StyleBoxFlat
	var active: StyleBoxFlat = (utility.fps_buttons[60] as Button).get_theme_stylebox("pressed") as StyleBoxFlat
	assert_ne(normal.bg_color, active.bg_color)
	assert_gt(active.bg_color.r, active.bg_color.g * 2.0)
	assert_gt(active.border_width_left, normal.border_width_left, "selection is also identifiable by its border")
	var filled: StyleBoxFlat = (utility.sliders["Music"] as HSlider).get_theme_stylebox("grabber_area") as StyleBoxFlat
	assert_eq(filled.bg_color, active.border_color)
	watch_signals(utility)
	utility.text_toggle.button_pressed = true
	utility.motion_toggle.button_pressed = true
	assert_signal_emitted_with_parameters(utility, "text_scale_changed", [1.25])
	assert_signal_emitted_with_parameters(utility, "motion_changed", [true])

func test_fps_policy_and_preferences_preserve_audio_values() -> void:
	assert_eq(FrameRatePolicy.resolve(0), 60)
	assert_eq(FrameRatePolicy.resolve(30), 30)
	assert_eq(FrameRatePolicy.resolve(120, false, 144.0), 60)
	assert_eq(FrameRatePolicy.resolve(120, true, 60.0), 60)
	assert_eq(FrameRatePolicy.resolve(120, true, 120.0), 120)
	var original_cap: int = Engine.max_fps
	var shell: AppShell = AppShell.new()
	var path: String = "user://test_entry_ui_settings.cfg"
	var config: ConfigFile = ConfigFile.new()
	config.set_value("audio", "Music", 0.4)
	config.save(path)
	shell.set_frame_rate(30)
	shell.text_scale = 1.25
	shell.reduced_motion = true
	shell.save_ui_preferences(path)
	assert_eq(Engine.max_fps, 30)
	config.load(path)
	assert_eq(config.get_value("ui", "frame_rate"), 30)
	assert_eq(config.get_value("ui", "text_scale"), 1.25)
	assert_true(config.get_value("ui", "reduced_motion"))
	assert_eq(config.get_value("audio", "Music"), 0.4)
	shell.free()
	DirAccess.remove_absolute(path)
	Engine.max_fps = original_cap

func test_help_has_ten_expandable_answers_and_contact_without_an_owner_address() -> void:
	var help: EntryUtility = add_child_autofree(EntryUtility.new())
	watch_signals(help)
	assert_eq(help.faq_buttons.size(), 10)
	var question: Button = help.faq_buttons[1]
	var answer: Label = question.get_parent().get_child(1) as Label
	assert_false(answer.visible)
	question.button_pressed = true
	assert_true(answer.visible)
	for node: Node in help.find_children("*", "Label", true, false):
		assert_false((node as Label).text.contains(StoryDirector.SUPPORT_EMAIL), "Help never prints the recipient")
	for node: Node in help.find_children("*", "Button", true, false):
		if (node as Button).text == "Contact Us": (node as Button).pressed.emit()
	assert_signal_emitted_with_parameters(help, "page_requested", ["contact"])

func test_contact_prevents_duplicates_preserves_failure_draft_and_only_accepts_real_receipt() -> void:
	var contact: EntryUtility = EntryUtility.new()
	contact.page = "contact"
	add_child_autofree(contact)
	watch_signals(contact)
	contact.reply_field.text = "player@example.test"
	contact.subject_field.text = "Google chooser"
	contact.message_field.text = "The chooser does not open when I press Continue with Google."
	contact.consent.button_pressed = true
	contact._refresh_submit()
	assert_false(contact.submit_button.disabled)
	contact.submit_button.pressed.emit()
	contact.submit_button.pressed.emit()
	assert_signal_emit_count(contact, "support_submitted", 1)
	assert_true(contact.submit_button.disabled)
	contact.handle_back()
	assert_signal_not_emitted(contact, "page_requested", "submission stays visible until confirmed")
	var draft: String = contact.message_field.text
	contact.support_result(Outcome.fail("support_unavailable", "Not available"))
	assert_eq(contact.message_field.text, draft)
	assert_false(contact.submit_button.disabled)
	assert_eq(contact.status_label.text, "Not available")
	contact.submit_button.pressed.emit()
	assert_signal_emit_count(contact, "support_submitted", 2)
	contact.support_result(Outcome.ok({"reference": "receipt-123"}))
	assert_string_contains(contact.status_label.text, "receipt-123")
	assert_eq(contact.message_field.text, "")
	assert_true(contact.submit_button.disabled)
