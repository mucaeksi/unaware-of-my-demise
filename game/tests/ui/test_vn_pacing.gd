extends GutTest
## Deterministic reader clocks: performance, breathing room and portrait transitions.

func _reader(lines: Array[Dictionary], illustration: String = "") -> VnScreen:
	var reader: VnScreen = add_child_autofree(VnScreen.new())
	reader.audio_enabled = false
	reader.load_scene({"lines": lines, "illustration_id": illustration})
	reader.set_process(false)
	reader._auto_timer.stop()
	UiPageTransition.finish_under(reader)
	return reader

func test_short_reply_has_breathing_room_before_auto_advances() -> void:
	var reader: VnScreen = _reader([
		{"speaker_id":"mahmut", "text_en":"Yes."},
		{"speaker_id":"fadyme", "text_en":"Then sit beside me."}])
	reader.reveal_all()
	reader.advance_reader(3.3)
	reader._auto_tick()
	assert_eq(reader.line_index(), 0)
	reader.advance_reader(2.3)
	reader._auto_tick()
	assert_eq(reader.line_index(), 1)
	assert_eq(reader.visible_dialogue_text(), "", "the next speaker does not start talking during the pause")

func test_preloaded_reader_starts_default_auto_when_attached() -> void:
	var reader: VnScreen = VnScreen.new()
	reader.audio_enabled = false
	assert_true(reader.load_scene({"lines":[{"text_en":"The road waits."}]}))
	assert_eq(reader.auto_speed(), 1)
	assert_true(reader._auto_timer.is_stopped())
	add_child_autofree(reader)
	await get_tree().process_frame
	assert_false(reader._auto_timer.is_stopped())

func test_speaker_change_dissolves_portraits_before_revealing_new_text() -> void:
	var reader: VnScreen = _reader([
		{"speaker_id":"fadyme", "text_en":"Hold still.", "emotion":"soft_smile"},
		{"speaker_id":"mahmut", "text_en":"I am holding still.", "emotion":"dry_humor"}])
	var previous: Texture2D = reader._bust.texture
	reader.reveal_all()
	reader.go_next()
	assert_same(reader._outgoing_bust.texture, previous)
	assert_true(reader._outgoing_bust.visible)
	assert_eq(reader._bust.modulate.a, 0.0)
	reader.advance_reader(0.4)
	assert_almost_eq(reader._bust.modulate.a, 0.5, 0.01)
	assert_almost_eq(reader._outgoing_bust.modulate.a, 0.5, 0.01)
	assert_eq(reader.visible_dialogue_text(), "")
	reader.advance_reader(0.7)
	assert_false(reader._outgoing_bust.visible)
	assert_gt(reader.visible_dialogue_text().length(), 0)

func test_paired_illustration_stays_visible_across_both_speakers() -> void:
	var reader: VnScreen = _reader([
		{"speaker_id":"fadyme", "text_en":"Your turn."},
		{"speaker_id":"mahmut", "text_en":"Agreed."}], "roadside_rest")
	var scene_art: Texture2D = BattleArt.illustration("roadside_rest")
	assert_not_null(scene_art)
	assert_same(reader._bust.texture, scene_art)
	reader.reveal_all()
	reader.go_next()
	assert_same(reader._bust.texture, scene_art)
	assert_false(reader._outgoing_bust.visible)
	assert_eq(reader._bust.modulate.a, 1.0, "a shared tableau never flashes between speakers")

func test_long_japanese_take_cannot_be_cut_off_by_auto() -> void:
	var reader: VnScreen = _reader([{"speaker_id":"mahmut", "line_id":"pacing_test", "text_en":"Stay."}])
	watch_signals(reader)
	reader.audio_enabled = true
	reader._voice_pending = true
	reader._pending_audition = AudioStreamGenerator.new()
	reader.advance_reader(0)
	assert_true(reader.voiced)
	reader.reveal_all()
	reader.advance_reader(30)
	reader._read_hold = 30
	reader._auto_tick()
	assert_signal_not_emitted(reader, "finished")
	Audio.stop_voice()
	reader._auto_tick()
	assert_signal_emit_count(reader, "finished", 1)
