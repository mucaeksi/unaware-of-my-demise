extends GutTest
## Cold-start presentation and readiness through the real AppShell/StoryDirector.

class _Backend extends GameBackend:
	var snapshot: Dictionary = {}
	var fetches: int = 0

	func fetch_state() -> Outcome:
		fetches += 1
		return Outcome.ok({"state": snapshot})


static var _flow: GameFlow = null


func before_all() -> void:
	_flow = GameFlow.create()


func after_each() -> void:
	Audio.stop_music(0.0)


func _sequence() -> StartupSequence:
	var sequence: StartupSequence = StartupSequence.new()
	sequence.auto_start = false
	sequence.fade_seconds = 0.01
	sequence.studio_hold_seconds = 0.08
	sequence.title_reveal_seconds = 0.01
	return sequence


func _shell() -> AppShell:
	var story: Dictionary = _flow.rules.story.to_persisted_dict(_flow.rules.story.new_player_state())
	var backend: _Backend = _Backend.new()
	backend.snapshot = JSON.parse_string(JSON.stringify({
		"schema_version": PlayerState.SCHEMA_VERSION, "story_state": story,
		"wallet": {"silver_crowns": 0, "eclipse_tokens": 0, "account_xp": 0},
	}))
	var prototype: StartupSequence = _sequence()
	prototype.auto_start = true
	var packed: PackedScene = PackedScene.new()
	assert_eq(packed.pack(prototype), OK)
	prototype.free()
	var shell: AppShell = AppShell.new()
	shell.flow = _flow
	shell.backend = backend
	shell.startup_presentation = packed
	add_child_autofree(shell)
	return shell


func test_silent_startup_visits_studio_title_without_a_second_godot_page() -> void:
	var sequence: StartupSequence = add_child_autofree(_sequence())
	var phases: Array[String] = []
	sequence.phase_changed.connect(func(id: String) -> void: phases.append(id))
	watch_signals(sequence)
	sequence.begin()
	sequence.begin()
	assert_false(sequence.music_available, "no owner recording has been supplied")
	await wait_for_signal(sequence.completed, 2.0)
	assert_eq(phases, ["ui.studio_splash", "ui.title"])
	assert_signal_emit_count(sequence, "completed", 1)
	assert_almost_eq(sequence.modulate.a, 0.0, 0.01)


func test_focus_loss_freezes_the_timeline_and_resume_continues_it() -> void:
	var sequence: StartupSequence = add_child_autofree(_sequence())
	sequence.begin()
	sequence._notification(Node.NOTIFICATION_APPLICATION_FOCUS_OUT)
	await wait_seconds(0.3)
	assert_eq(sequence.phase, "ui.studio_splash")
	assert_almost_eq(sequence._screen.modulate.a, 0.0, 0.01)
	sequence._notification(Node.NOTIFICATION_APPLICATION_FOCUS_IN)
	await wait_for_signal(sequence.completed, 2.0)
	assert_eq(sequence.phase, "ui.title")


func test_cancelled_startup_cannot_emit_a_late_completion() -> void:
	var sequence: StartupSequence = add_child_autofree(_sequence())
	watch_signals(sequence)
	sequence.begin()
	sequence.cancel()
	await wait_seconds(0.3)
	assert_signal_not_emitted(sequence, "completed")
	assert_eq(sequence.phase, "ui.studio_splash")


func test_early_title_tap_waits_for_startup_before_fetching_the_player() -> void:
	var shell: AppShell = _shell()
	assert_true(shell.current is TitleScreen)
	assert_not_null(shell.director._startup)
	(shell.current as TitleScreen).tap()
	assert_eq((shell.backend as _Backend).fetches, 0)
	assert_true(shell.current is TitleScreen)
	await _enter_when_ready(shell)
	assert_true(shell.current is VnScreen, "the first entry still opens for a new player")
	assert_null(shell.director._startup)
	assert_eq((shell.backend as _Backend).fetches, 1)
	assert_eq((shell.current as VnScreen)._title_label.text, "A Letter the Rain Could Not Keep")


func test_title_also_waits_for_content_when_startup_finishes_first() -> void:
	var shell: AppShell = _shell()
	# Hold the real content callback to exercise the other order of the two readiness gates.
	shell.director._loaded_flow = null
	(shell.current as TitleScreen).tap()
	await wait_until(func() -> bool: return shell.director._startup == null, 2.0)
	assert_true(shell.current is TitleScreen)
	assert_eq((shell.backend as _Backend).fetches, 0)
	shell.director._on_content_loaded(_flow)
	await _enter_when_ready(shell)
	assert_true(shell.current is VnScreen)
	assert_eq((shell.backend as _Backend).fetches, 1)


func test_retry_cancels_the_overlay_and_does_not_replay_the_splashes() -> void:
	var shell: AppShell = _shell()
	shell.director.start(true)
	assert_null(shell.director._startup)
	await _enter_when_ready(shell)
	await wait_seconds(0.3)
	assert_true(shell.current is VnScreen)
	assert_eq((shell.backend as _Backend).fetches, 1)


func test_builtin_engine_splash_and_studio_emblem_work_without_a_content_patch() -> void:
	assert_true(bool(ProjectSettings.get_setting("application/boot_splash/show_image")))
	assert_eq(String(ProjectSettings.get_setting("application/boot_splash/image", "")), "", "the engine supplies its own logo")
	var studio: StudioSplashScreen = add_child_autofree(StartupSequence.STUDIO_SCENE.instantiate())
	var emblem: TextureRect = studio.find_child("Emblem", true, false) as TextureRect
	assert_not_null(emblem)
	assert_not_null(emblem.texture, "the mark ships as a built-in resource")
	assert_true(emblem.texture.resource_path.begins_with("res://assets/branding/sovtaym/"))
	assert_eq(emblem.stretch_mode, TextureRect.STRETCH_KEEP_ASPECT_CENTERED, "the hourglass/wing tips are not cropped")
	assert_eq((studio.find_child("Wordmark", true, false) as Label).text, "SovTaym")
	assert_eq((studio.find_child("Studios", true, false) as Label).text, "STUDIOS")


func _enter_when_ready(shell: AppShell) -> void:
	await wait_until(func() -> bool: return shell.current is EntryScreen and (shell.current as EntryScreen).phase == "ready", 3.0)
	assert_true(shell.current is EntryScreen)
	(shell.current as EntryScreen).primary.pressed.emit()
	await wait_until(func() -> bool: return not (shell.current is EntryScreen), 3.0)
