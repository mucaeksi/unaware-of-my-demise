extends GutTest
## docs/design/FIRST_LAUNCH_FLOW.md through the real shell and director: the title comes first, the tap goes on to the
## server, a new player lands in the opening scene, everyone else on the hub.

class _Backend extends GameBackend:
	var snapshot: Dictionary = {}

	func fetch_state() -> Outcome:
		return Outcome.ok({"state": snapshot})


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
	var shell: AppShell = AppShell.new()
	shell.flow = _flow
	shell.backend = backend
	add_child_autofree(shell)
	return shell


func _start(shell: AppShell) -> void:
	assert_true(shell.current is TitleScreen, "the title comes first")
	(shell.current as TitleScreen).tap()
	await wait_until(func() -> bool: return not (shell.current is MessageScreen) and not (shell.current is TitleScreen), 5.0)


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
	await wait_until(func() -> bool: return shell.current is HubScreen, 5.0)
	assert_true(shell.current is HubScreen)
