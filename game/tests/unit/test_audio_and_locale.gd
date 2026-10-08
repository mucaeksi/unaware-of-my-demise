extends GutTest
## INF-025: audio by stable id (buses, volumes, voice/music/SFX, fades, pause) and text in the player's language.

const SETTINGS: String = "user://test_audio_settings.cfg"

var _audio: AudioDirector = null
var _present: Array[String] = []


func _stream() -> AudioStream:
	var generator: AudioStreamGenerator = AudioStreamGenerator.new()
	generator.mix_rate = 22050.0
	return generator


func before_each() -> void:
	DirAccess.remove_absolute(SETTINGS)
	_present = []
	_audio = AudioDirector.new()
	_audio.exists = func(path: String) -> bool: return _present.has(path)
	_audio.load_stream = func(_path: String) -> Resource: return _stream()
	_audio._settings_path = SETTINGS
	add_child_autofree(_audio)


func after_each() -> void:
	DirAccess.remove_absolute(SETTINGS)


func test_the_bus_layout_has_music_voice_and_sfx() -> void:
	for bus: String in AudioDirector.BUSES:
		var index: int = AudioServer.get_bus_index(bus)
		assert_gt(index, 0, bus)
		assert_eq(AudioServer.get_bus_send(index), &"Master", bus + " sends to Master")


func test_runtime_paths_follow_the_stable_ids() -> void:
	assert_eq(AudioDirector.voice_path("fadyme", "opening_001"), "res://assets/audio/voice/fadyme/opening_001.ogg")
	assert_eq(AudioDirector.music_path("bgm_fadyme_theme"), "res://assets/audio/music/bgm_fadyme_theme.ogg")
	assert_eq(AudioDirector.sfx_path("ui_confirm"), "res://assets/audio/sfx/ui_confirm.ogg")


func test_missing_audio_is_silence_reported_once() -> void:
	assert_false(_audio.play_voice("fadyme", "opening_001"))
	assert_false(_audio.play_voice("fadyme", "opening_001"))
	assert_false(_audio.play_music("bgm_fadyme_theme", 0.0))
	assert_false(_audio.play_sfx("ui_confirm"))
	assert_false(_audio.play_voice("", "x"), "no speaker: text only")
	assert_eq(_audio.missing(), [
		"res://assets/audio/music/bgm_fadyme_theme.ogg",
		"res://assets/audio/sfx/ui_confirm.ogg",
		"res://assets/audio/voice/fadyme/opening_001.ogg",
	])


func test_a_new_voice_line_cuts_the_previous_one() -> void:
	_present = [AudioDirector.voice_path("fadyme", "a"), AudioDirector.voice_path("mahmut", "b")]
	assert_true(_audio.play_voice("fadyme", "a"))
	assert_true(_audio.is_voice_playing())
	var first: AudioStream = _audio._voice.stream
	assert_true(_audio.play_voice("mahmut", "b"))
	assert_ne(_audio._voice.stream, first)
	assert_false(_audio.play_voice("fadyme", "no_recording"), "an unrecorded line stops the previous one too")
	assert_false(_audio.is_voice_playing())


func test_music_cross_fades_and_a_missing_cue_fades_the_old_one_out() -> void:
	_present = [AudioDirector.music_path("calm"), AudioDirector.music_path("battle")]
	assert_true(_audio.play_music("calm", 0.0))
	var calm: AudioStreamPlayer = _audio._music[_audio._active_music]
	assert_true(calm.playing)
	assert_true(_audio.play_music("calm", 0.0), "the same cue keeps playing")
	assert_same(_audio._music[_audio._active_music], calm)
	assert_true(_audio.play_music("battle", 0.0))
	assert_eq(_audio.music_cue(), "battle")
	assert_false(calm.playing, "an instant switch stops the old track")
	assert_true(_audio.play_music("calm", 0.5))
	assert_true(_audio._fade != null and _audio._fade.is_valid(), "a timed switch cross-fades")
	assert_false(_audio.play_music("no_such_cue", 0.0))
	assert_eq(_audio.music_cue(), "")
	assert_false(_audio._music[0].playing or _audio._music[1].playing, "another mood never keeps the old music")


func test_volumes_are_applied_saved_and_restored() -> void:
	_audio.set_volume(AudioDirector.BUS_MUSIC, 0.5)
	_audio.set_volume(AudioDirector.BUS_VOICE, 0.0)
	var music: int = AudioServer.get_bus_index(AudioDirector.BUS_MUSIC)
	var voice: int = AudioServer.get_bus_index(AudioDirector.BUS_VOICE)
	assert_almost_eq(AudioServer.get_bus_volume_db(music), linear_to_db(0.5), 0.01)
	assert_true(AudioServer.is_bus_mute(voice), "zero volume mutes the bus")
	_audio.set_volume(AudioDirector.BUS_VOICE, 4.0)
	assert_eq(_audio.volume(AudioDirector.BUS_VOICE), 1.0, "clamped")
	var restored: AudioDirector = AudioDirector.new()
	restored.load_volumes(SETTINGS)
	assert_eq(restored.volume(AudioDirector.BUS_MUSIC), 0.5)
	restored.free()
	_audio.load_volumes("user://no_such_settings.cfg")
	assert_eq(_audio.volume(AudioDirector.BUS_MUSIC), 1.0, "nothing saved: full volume")


func test_backgrounding_the_app_pauses_and_resuming_continues() -> void:
	_present = [AudioDirector.voice_path("fadyme", "a")]
	_audio.play_voice("fadyme", "a")
	_audio._notification(Node.NOTIFICATION_APPLICATION_PAUSED)
	assert_true(_audio._voice.stream_paused)
	_audio._notification(Node.NOTIFICATION_APPLICATION_RESUMED)
	assert_false(_audio._voice.stream_paused)


func test_text_follows_the_locale_with_english_as_the_fallback() -> void:
	var line: Dictionary = {"text_en": "Stay behind my shield.", "text_tr": "Kalkanımın arkasında kal."}
	assert_eq(LocalizedText.pick(line, "text", "tr_TR"), "Kalkanımın arkasında kal.")
	assert_eq(LocalizedText.pick(line, "text", "tr"), "Kalkanımın arkasında kal.")
	assert_eq(LocalizedText.pick(line, "text", "ja_JP"), "Stay behind my shield.", "no Japanese text: English")
	assert_eq(LocalizedText.pick({"text_en": "x", "text_de": ""}, "text", "de"), "x", "an empty translation falls back")
	assert_eq(LocalizedText.pick({}, "text", "en"), "")
	assert_eq(LocalizedText.language_of("pt-BR"), "pt")
	assert_eq(LocalizedText.language_of(""), "en")


func test_the_vn_keeps_story_text_english_on_a_turkish_device() -> void:
	var previous_locale: String = TranslationServer.get_locale()
	TranslationServer.set_locale("tr")
	var vn: VnScreen = add_child_autofree(VnScreen.new())
	var scene: Dictionary = {"scene_id": "s", "title_en": "The Road", "title_tr": "Yol", "lines": [
		{"line_id": "l1", "speaker_id": "mahmut", "speaker_display": "Mahmut", "text_en": "Three wolves.", "text_tr": "Üç kurt."},
		{"line_id": "l2", "speaker_id": "mahmut", "speaker_display": "Mahmut", "text_en": "Behind me."},
	]}
	assert_true(vn.load_scene(scene))
	assert_eq(vn._title_label.text, "The Road")
	assert_eq(vn.dialogue_text(), "Three wolves.")
	assert_false(vn.voiced, "no recording shipped: text only")
	vn.go_next()
	assert_eq(vn.line_index(), 0, "Next first reveals the typewriter line")
	vn.go_next()
	assert_eq(vn.dialogue_text(), "Behind me.", "untranslated line: English")
	TranslationServer.set_locale(previous_locale)


# -- cues (docs/design/FIRST_LAUNCH_FLOW.md, D-08) -----------------------------------------------------


func _cues(slots: Dictionary) -> AudioCues:
	var cues: AudioCues = AudioCues.new()
	cues.adopt(slots)
	return cues


func test_the_shipped_cue_pack_has_every_slot_and_nothing_assigned_yet() -> void:
	var shipped: AudioCues = AudioCues.load_pack()
	assert_eq(shipped.error, "", "the pack reads cleanly")
	var parsed: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(AudioCues.PACK_PATH))
	var slots: Array = (parsed["slots"] as Dictionary).keys()
	slots.sort()
	var expected: Array = AudioCues.SLOTS.duplicate()
	expected.sort()
	assert_eq(slots, expected, "the pack's slots are exactly the client's (tools/validate_part1_content.py checks the same list)")
	for slot: String in AudioCues.SLOTS:
		assert_eq(shipped.cue(slot), "", "%s is unassigned until the narrative team fills it" % slot)


func test_a_cue_pack_ignores_unknown_slots_and_empty_values() -> void:
	var cues: AudioCues = _cues({"flow.title": "bgm_title", "flow.hub": "", "flow.mystery": "bgm_x"})
	assert_eq(cues.cue(AudioCues.FLOW_TITLE), "bgm_title")
	assert_eq(cues.cue(AudioCues.FLOW_HUB), "")
	assert_eq(cues.cue("flow.mystery"), "")
	assert_string_contains(cues.error, "unknown slot")
	assert_string_contains(AudioCues.load_pack("res://no/such/pack.json").error, "missing")


func test_flow_cues_play_their_slot_and_an_unassigned_music_slot_fades_the_music_out() -> void:
	_present = [AudioDirector.music_path("bgm_title"), AudioDirector.sfx_path("sfx_start"), AudioDirector.voice_path("fadyme", "title_call")]
	_audio.cues = _cues({"flow.title": "bgm_title", "sfx.ui_start": "sfx_start", "voice.title_call": "fadyme/title_call"})
	assert_true(_audio.play_flow_cue(AudioCues.FLOW_TITLE, 0.0))
	assert_eq(_audio.music_cue(), "bgm_title")
	assert_true(_audio.play_flow_cue(AudioCues.SFX_UI_START))
	assert_true(_audio.play_flow_cue(AudioCues.VOICE_TITLE_CALL))
	assert_true(_audio.is_voice_playing())
	assert_false(_audio.play_flow_cue(AudioCues.FLOW_HUB, 0.0), "the hub has no cue yet")
	assert_eq(_audio.music_cue(), "", "another screen's music does not carry on")
	assert_false(_audio.play_flow_cue(AudioCues.SFX_UI_ERROR), "an unassigned sound is silence")


func test_story_scenes_and_lines_drive_music_ambience_and_effects() -> void:
	_present = [AudioDirector.music_path("bgm_opening"), AudioDirector.ambience_path("amb_rain"), AudioDirector.sfx_path("sfx_bell")]
	_audio.apply_scene_audio({"music_cue_id": "bgm_opening", "ambience_cue_id": "amb_rain"})
	assert_eq(_audio.music_cue(), "bgm_opening")
	assert_eq(_audio.ambience_cue(), "amb_rain")
	_audio.apply_line_audio({"sfx": "sfx_bell", "music": "stop", "fade_seconds": 0})
	assert_eq(_audio.music_cue(), "", "the bell line stops the music")
	assert_true(_audio._sfx.playing)
	assert_eq(_audio.ambience_cue(), "amb_rain", "the rain goes on")
	_audio.apply_line_audio({"ambience": "stop"})
	assert_eq(_audio.ambience_cue(), "")
	_audio.apply_scene_audio({"music_cue_id": null})
	assert_eq(_audio.music_cue(), "", "a scene without a cue changes nothing")
	_audio.apply_line_audio("not an object")


func test_stopping_music_when_none_plays_is_quiet() -> void:
	_audio.stop_music(1.0)
	_audio.stop_music(0.0)
	assert_eq(_audio.music_cue(), "")
	assert_null(_audio._fade, "no empty fade was started")


func test_future_main_theme_is_silent_without_a_file_and_does_not_use_fadyme() -> void:
	_present = [AudioDirector.music_path("bgm_fadyme_theme")]
	_audio.cues = _cues({})
	assert_false(_audio.play_entry_theme(0.0))
	assert_false(_audio.play_entry_theme(0.0))
	assert_eq(_audio.music_cue(), "")
	assert_eq(_audio.missing(), ["res://assets/audio/music/bgm_main_theme.ogg"])
	assert_false(_audio._music[0].playing or _audio._music[1].playing)


func test_reserved_main_theme_keeps_its_player_stream_and_fade_across_entry_calls() -> void:
	_present = [AudioDirector.music_path(AudioDirector.PENDING_MAIN_THEME)]
	_audio.cues = _cues({})
	assert_true(_audio.play_entry_theme())
	var player: AudioStreamPlayer = _audio._music[_audio._active_music]
	var stream: AudioStream = player.stream
	var fade: Tween = _audio._fade
	await wait_seconds(0.1)
	var position: float = player.get_playback_position()
	assert_true(_audio.play_entry_theme())
	assert_same(_audio._music[_audio._active_music], player)
	assert_same(player.stream, stream)
	assert_same(_audio._fade, fade, "re-entering title does not restart the fade")
	assert_gte(player.get_playback_position(), position, "the playback cursor is retained")
	assert_eq(_audio.music_cue(), AudioDirector.PENDING_MAIN_THEME)


func test_assigned_title_cue_overrides_the_future_filename_and_preserves_mute() -> void:
	_present = [AudioDirector.music_path("bgm_owner_title")]
	_audio.cues = _cues({"flow.title": "bgm_owner_title"})
	_audio.set_volume(AudioDirector.BUS_MUSIC, 0.0)
	assert_true(_audio.play_entry_theme(0.0))
	assert_eq(_audio.music_cue(), "bgm_owner_title")
	assert_eq(_audio.missing(), [])
	assert_eq(_audio.volume(AudioDirector.BUS_MUSIC), 0.0)
	assert_true(AudioServer.is_bus_mute(AudioServer.get_bus_index(AudioDirector.BUS_MUSIC)))


func test_backgrounding_preserves_the_entry_fade_until_resume() -> void:
	_present = [AudioDirector.music_path(AudioDirector.PENDING_MAIN_THEME)]
	_audio.cues = _cues({})
	_audio.play_entry_theme(0.5)
	var player: AudioStreamPlayer = _audio._music[_audio._active_music]
	await wait_seconds(0.05)
	_audio._notification(Node.NOTIFICATION_APPLICATION_FOCUS_OUT)
	var level: float = player.volume_db
	await wait_seconds(0.1)
	assert_almost_eq(player.volume_db, level, 0.01)
	assert_true(player.stream_paused)
	_audio._notification(Node.NOTIFICATION_APPLICATION_FOCUS_IN)
	await wait_seconds(0.1)
	assert_gt(player.volume_db, level)
	assert_false(player.stream_paused)


func test_entry_ogg_loops_without_mutating_the_imported_resource() -> void:
	var source: AudioStreamOggVorbis = AudioStreamOggVorbis.load_from_file("res://tests/fixtures/audio/silence_80ms.ogg")
	assert_not_null(source)
	assert_false(source.loop)
	_present = [AudioDirector.music_path(AudioDirector.PENDING_MAIN_THEME)]
	_audio.load_stream = func(_path: String) -> Resource: return source
	_audio.cues = _cues({})
	assert_true(_audio.play_entry_theme(0.0))
	var player: AudioStreamPlayer = _audio._music[_audio._active_music]
	assert_true((player.stream as AudioStreamOggVorbis).loop)
	assert_not_same(player.stream, source)
	assert_false(source.loop, "entry playback never changes the cached/imported resource")
	await wait_seconds(0.3)
	assert_true(player.playing, "an 80 ms recording continues beyond its first pass")


func test_entry_music_started_while_backgrounded_waits_for_resume() -> void:
	_present = [AudioDirector.music_path(AudioDirector.PENDING_MAIN_THEME)]
	_audio.cues = _cues({})
	_audio.set_paused(true)
	_audio.play_entry_theme(0.5)
	var player: AudioStreamPlayer = _audio._music[_audio._active_music]
	var level: float = player.volume_db
	await wait_seconds(0.1)
	assert_true(player.stream_paused)
	assert_almost_eq(player.volume_db, level, 0.01)
	_audio.set_paused(false)
	await wait_seconds(0.1)
	assert_false(player.stream_paused)
	assert_gt(player.volume_db, level)

func test_main_theme_default_fade_reaches_full_level_without_restarting_the_loop() -> void:
	var source: AudioStreamOggVorbis = AudioStreamOggVorbis.load_from_file("res://tests/fixtures/audio/silence_80ms.ogg")
	_present = [AudioDirector.music_path(AudioDirector.PENDING_MAIN_THEME)]
	_audio.load_stream = func(_path: String) -> Resource: return source
	_audio.cues = _cues({})
	assert_true(_audio.play_entry_theme())
	var player: AudioStreamPlayer = _audio._music[_audio._active_music]
	assert_almost_eq(player.volume_db, linear_to_db(AudioDirector.SILENT), 0.01)
	await wait_seconds(0.25)
	assert_gt(player.volume_db, linear_to_db(AudioDirector.SILENT))
	assert_lt(player.volume_db, 0.0)
	var fade: Tween = _audio._fade
	assert_true(_audio.play_entry_theme(), "menu/patch re-entry keeps the main theme")
	assert_same(_audio._music[_audio._active_music], player)
	assert_same(_audio._fade, fade)
	await wait_seconds(AudioDirector.ENTRY_FADE_SECONDS)
	assert_almost_eq(player.volume_db, 0.0, 0.01)
	assert_true(player.playing, "the 80 ms fixture is still looping after the 5 second fade")
	assert_false(source.loop, "the real imported stream remains unmodified")
