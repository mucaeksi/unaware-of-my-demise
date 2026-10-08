extends GutTest
## docs/design/FIRST_LAUNCH_FLOW.md through the real shell and director: the title comes first, the tap goes on to the
## server, a new player lands in the opening scene, everyone else on the hub.

class _Backend extends GameBackend:
	var snapshot: Dictionary = {}
	var fetches: int = 0
	var refusal: Outcome = null

	func fetch_state() -> Outcome:
		fetches += 1
		return refusal if refusal != null else Outcome.ok({"state": snapshot})


static var _flow: GameFlow = null


func before_all() -> void:
	if _flow == null:
		_flow = GameFlow.create()


func _snapshot(cursor: int) -> Dictionary:
	var story: Dictionary = _flow.rules.story.to_persisted_dict(_flow.rules.story.new_player_state())
	# The snapshot names the cursor twice (index and entry id); both move together.
	story["story_cursor"] = cursor
	story["story_cursor_entry_id"] = _flow.story_index.story_order[cursor]
	var data: Dictionary = {"schema_version": PlayerState.SCHEMA_VERSION, "story_state": story,
		"wallet": {"silver_crowns": 0, "eclipse_tokens": 0, "account_xp": 0}}
	return JSON.parse_string(JSON.stringify(data))


func _shell(cursor: int) -> AppShell:
	assert_true(_flow.is_ready(), _flow.error)
	var backend: _Backend = _Backend.new()
	backend.snapshot = _snapshot(cursor)
	_flow.state = null  # every test starts from its own snapshot (the flow is shared; INF-012 refuses an older revision)
	var shell: AppShell = AppShell.new()
	shell.startup_intro_enabled = false  # presentation is covered in test_startup_sequence.gd
	shell.flow = _flow
	shell.backend = backend
	add_child_autofree(shell)
	return shell


func _start(shell: AppShell) -> void:
	assert_true(shell.current is TitleScreen, "the title comes first")
	(shell.current as TitleScreen).tap()
	await _enter_when_ready(shell)


func _enter_when_ready(shell: AppShell) -> void:
	await wait_until(func() -> bool: return shell.current is EntryScreen and (shell.current as EntryScreen).phase == "ready", 5.0)
	assert_true(shell.current is EntryScreen, "verified Entry precedes player routing")
	(shell.current as EntryScreen).primary.pressed.emit()
	await wait_until(func() -> bool: return not (shell.current is EntryScreen), 3.0)


func test_a_new_player_goes_from_the_title_straight_into_the_opening() -> void:
	var shell: AppShell = _shell(0)
	await _start(shell)
	assert_true(shell.current is VnScreen, "no hub before the opening")
	assert_eq((shell.current as VnScreen)._title_label.text, "A Letter the Rain Could Not Keep")


func test_a_returning_player_lands_on_the_hub() -> void:
	var shell: AppShell = _shell(1)
	await _start(shell)
	assert_true(shell.current is HubScreen)


func test_the_title_has_no_say_in_a_retry() -> void:
	var shell: AppShell = _shell(1)
	await _start(shell)
	shell.director.start(true)
	assert_false(shell.current is TitleScreen, "a retry or a restart after an update goes straight on")
	await _enter_when_ready(shell)
	assert_true(shell.current is HubScreen)


func test_a_long_absence_refreshes_the_hub_and_a_short_one_does_not() -> void:
	var shell: AppShell = _shell(1)
	await _start(shell)
	var backend: _Backend = shell.backend
	var before: int = backend.fetches
	await shell.director.handle_resume(StoryDirector.RESUME_REFRESH_MS - 1)
	assert_eq(backend.fetches, before, "a quick app switch asks nothing")
	backend.snapshot["wallet"]["silver_crowns"] = 500
	backend.snapshot["state_revision"] = 7
	await shell.director.handle_resume(StoryDirector.RESUME_REFRESH_MS)
	assert_eq(backend.fetches, before + 1)
	assert_true(shell.current is HubScreen)
	assert_eq(int(shell.director.flow.wallet()["silver_crowns"]), 500, "what another device did is shown")
	await wait_process_frames(1)  # replaced screens are freed at the end of the frame


func test_a_maintenance_or_update_that_started_meanwhile_shows_on_return() -> void:
	var shell: AppShell = _shell(1)
	await _start(shell)
	var backend: _Backend = shell.backend
	backend.refusal = Outcome.fail(ClientRelease.KIND_MAINTENANCE, "Back at 03:00 UTC")
	await shell.director.handle_resume(StoryDirector.RESUME_REFRESH_MS)
	assert_true(shell.current is MessageScreen)
	assert_string_contains((shell.current as MessageScreen).message_text(), "Back at 03:00 UTC")
	await wait_process_frames(1)


func test_a_return_never_interrupts_a_story_scene() -> void:
	var shell: AppShell = _shell(0)
	await _start(shell)
	var backend: _Backend = shell.backend
	var before: int = backend.fetches
	await shell.director.handle_resume(StoryDirector.RESUME_REFRESH_MS * 10)
	assert_true(shell.current is VnScreen)
	assert_eq(backend.fetches, before)
	await wait_process_frames(1)
