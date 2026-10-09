extends GutTest
const Review = preload("res://scripts/art_review/desktop_opening_review.gd")
const Preferences = preload("res://scripts/app/onboarding_preferences.gd")

class RecordingTransport extends OnlineBackend.Transport:
	var calls: int = 0
	func request(_method: int, _url: String, _headers: PackedStringArray, _body: String) -> Dictionary:
		calls += 1
		return {"status": 0, "body": ""}

var _previous: Dictionary = {}
var _transport: RecordingTransport

func before_each() -> void:
	_previous = {"url": Online.server_url(), "account": Online.account_id,
		"token": Online.session_token, "new": Online.is_new_account,
		"onboarding": Online.onboarding_path, "auth": Online.preferences_path,
		"transport": Online.transport, "content": Game.content, "flow": Game.flow,
		"mounted": Game._content_mounted}
	_transport = RecordingTransport.new()
	Online.transport = _transport
	Game._content_mounted = false
	DirAccess.remove_absolute(Review.REVIEW_ROOT + "/onboarding.cfg")
	DirAccess.remove_absolute(Review.REVIEW_ROOT + "/prologue.cfg")

func after_each() -> void:
	ProjectSettings.set_setting(Online.SERVER_URL_SETTING, _previous["url"])
	Online.account_id = _previous["account"]
	Online.session_token = _previous["token"]
	Online.is_new_account = _previous["new"]
	Online.onboarding_path = _previous["onboarding"]
	Online.preferences_path = _previous["auth"]
	Online.transport = _previous["transport"]
	Game.content = _previous["content"]
	Game.flow = _previous["flow"]
	Game._content_mounted = _previous["mounted"]
	DirAccess.remove_absolute(Review.REVIEW_ROOT + "/onboarding.cfg")
	DirAccess.remove_absolute(Review.REVIEW_ROOT + "/prologue.cfg")
	await wait_process_frames(2)

func _open() -> AppShell:
	var shell: AppShell = Review.new()
	shell.startup_intro_enabled = false
	shell.reduced_motion = true
	add_child_autofree(shell)
	(shell.current as TitleScreen).tap()
	return shell

func _finish_reader(reader: VnScreen) -> void:
	for step: int in range(reader.line_count() * 2 + 1):
		if reader.get_parent() == null: break
		reader.go_next()

func test_start_is_available_without_google_or_a_bearer_and_storage_is_separate() -> void:
	var shell: AppShell = _open()
	assert_true(shell.current is EntryScreen)
	assert_eq((shell.current as EntryScreen).phase, "ready")
	assert_false(Online.has_session(), "no fake bearer can reach the real service")
	assert_eq(Online.account_id, Review.REVIEW_ACCOUNT)
	assert_eq(Game.content.root, Review.REVIEW_ROOT + "/content")
	assert_eq(shell.director.restart_hint_path, Review.REVIEW_ROOT + "/restart.cfg")
	assert_true(Preferences.pending(Online.onboarding_path, Online.account_id))
	assert_eq(_transport.calls, 0)

func test_all_three_tutorials_complete_and_restart_opens_menu_without_network() -> void:
	var shell: AppShell = _open()
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return is_instance_valid(entry._prologue), 4.0)
	assert_not_null(entry._prologue)
	entry._prologue.advance(120.0)
	entry._prologue.request_continue()
	var opening: EntryScreen.Onboarding = entry._onboarding
	assert_not_null(opening)
	for stage: int in range(3):
		assert_eq(opening.index, stage)
		_finish_reader(opening._host.get_child(0) as VnScreen)
		await wait_until(func() -> bool: return opening._battle != null and opening._battle.playback != null, 4.0)
		opening._battle.advance_time(10000.0)
		assert_eq(opening._battle.playback.outcome, "victory")
		opening._battle.advance_time(2.0)
		opening._battle.press_continue()
		assert_eq(opening.phase, "after")
		_finish_reader(opening._host.get_child(0) as VnScreen)
	assert_eq(entry.phase, "patch_complete")
	assert_true(Preferences.completed(Online.onboarding_path, Online.account_id))
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return shell.current is HubScreen, 4.0)
	assert_true(shell.current is HubScreen)
	assert_true(shell.director.flow.is_at_story_start())
	assert_eq(_transport.calls, 0, "the full opening makes no Google/server request")

func test_completed_review_resumes_at_menu_and_online_actions_fail_locally() -> void:
	var shell: AppShell = _open()
	Preferences.checkpoint(Online.onboarding_path, Online.account_id, 2, "complete", true)
	(shell.current as EntryScreen).primary.pressed.emit()
	await wait_until(func() -> bool: return shell.current is HubScreen, 4.0)
	assert_true(shell.current is HubScreen)
	var result: Outcome = await shell.backend.begin_stage("1-1", [])
	assert_false(result.is_ok())
	assert_string_contains(result.error, "desktop review")
	assert_eq(_transport.calls, 0)
