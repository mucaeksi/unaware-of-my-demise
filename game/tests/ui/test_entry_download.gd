extends GutTest
## Download consent, real byte display and authored quote lifecycle at the touch UI boundary.

func _entry(phase: String = "downloading") -> EntryScreen:
	var viewport: SubViewport = SubViewport.new()
	viewport.size = Vector2i(1080, 1920)
	add_child_autofree(viewport)
	var entry: EntryScreen = EntryScreen.new()
	entry.theme = UiTheme.create()
	entry.set_meta("ui_reduced_motion", true)
	entry.present(phase, true)
	viewport.add_child(entry)
	return entry

func test_download_display_waits_for_bytes_and_does_not_advance_with_time() -> void:
	var entry: EntryScreen = _entry()
	entry.set_download_progress(1048576, 4194304)
	await wait_seconds(0.15)
	assert_eq(entry._progress.value, 25.0)
	assert_string_contains(entry._progress_label.text, "1.0 MiB / 4.0 MiB")
	await wait_seconds(0.15)
	assert_eq(entry._progress.value, 25.0, "a slow connection does not invent progress")
	assert_eq(entry._progress.mouse_filter, Control.MOUSE_FILTER_IGNORE)
	entry.set_download_progress(0, 0)
	assert_eq(entry._progress.value, 0.0)
	assert_eq(entry._progress_label.text, "Waiting for download…")
	entry.set_download_progress(4194304, 4194304)
	assert_eq(entry._progress.value, 100.0)
	assert_false(entry._footer.visible)

func test_quotes_are_exact_shipped_dialogue_and_do_not_repeat_until_the_pool_is_used() -> void:
	var quotes: EntryQuotes = EntryQuotes.new()
	assert_eq(quotes.lines.size(), 7)
	var source: String = FileAccess.get_file_as_string(EntryQuotes.SOURCE)
	var texts: Array[String] = []
	for line: Dictionary in quotes.lines:
		assert_string_contains(source, str(line["text"]), str(line["line_id"]))
		texts.append(str(line["text"]))
	var shown: Array[String] = []
	for index: int in quotes.lines.size():
		var text: String = quotes.next()
		assert_has(texts, text)
		assert_false(text in shown)
		shown.append(text)
	assert_ne(quotes.next(), shown.back(), "shuffling the next pool avoids an immediate repeat")

func test_ten_second_quote_clock_runs_only_during_download_and_stops_on_phase_change() -> void:
	var entry: EntryScreen = _entry()
	assert_eq(entry._quote_timer.wait_time, 10.0)
	assert_false(entry._quote_timer.is_stopped(), "presenting before tree entry still starts the clock")
	assert_false(entry._download_quote.text.is_empty())
	var first: String = entry._download_quote.text
	# Observe the first real timeout. A busy machine can process several quote
	# rotations before a fixed 75 ms sleep resumes, cycling back to `first`.
	var rotated: Array[String] = []
	entry._quote_timer.timeout.connect(func() -> void: rotated.append(entry._download_quote.text), CONNECT_ONE_SHOT)
	entry._quote_timer.start(0.05)
	await wait_for_signal(entry._quote_timer.timeout, 2.0)
	assert_false(rotated.is_empty(), "the real Timer emits its first timeout")
	if not rotated.is_empty(): assert_ne(rotated[0], first, "the first timeout changes the quote")
	assert_eq(entry._download_quote.modulate.a, 1.0, "reduced motion changes quotes without fading")
	entry.present("verifying", true)
	var last: String = entry._download_quote.text
	assert_true(entry._quote_timer.is_stopped())
	assert_false(entry._download.visible)
	await wait_seconds(0.075)
	assert_eq(entry._download_quote.text, last)

func test_popup_captures_focus_and_cancel_does_not_emit_download() -> void:
	var entry: EntryScreen = _entry("update_available")
	watch_signals(entry)
	entry.confirm_content_update({"total_bytes": 4194304, "remaining_bytes": 3145728})
	await wait_process_frames(3)
	assert_true(entry._patch_modal.visible)
	assert_string_contains(entry._patch_modal._message.text, "Update size: 4.0 MiB")
	assert_string_contains(entry._patch_modal._message.text, "Download remaining: 3.0 MiB")
	assert_eq(entry.primary.focus_mode, Control.FOCUS_NONE)
	assert_true(entry.handle_back())
	assert_signal_not_emitted(entry, "action_requested")
	assert_eq(entry.primary.focus_mode, Control.FOCUS_ALL)
	entry.confirm_content_update({"total_bytes": 4194304, "remaining_bytes": 3145728})
	entry._patch_modal._confirm_action()
	assert_signal_emitted_with_parameters(entry, "action_requested", ["download"])

func test_english_controls_keep_english_shaping_on_a_turkish_device() -> void:
	var previous: String = TranslationServer.get_locale()
	TranslationServer.set_locale("tr_TR")
	var entry: EntryScreen = _entry("sign_in")
	assert_eq(entry.primary.text, "SIGN IN")
	assert_eq(entry.primary.language, "en")
	assert_eq(entry._opening_quote.language, "en")
	TranslationServer.set_locale(previous)
