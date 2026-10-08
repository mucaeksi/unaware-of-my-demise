extends GutTest
## Entry contracts through the actual shell/director, with no real HTTP or Google chooser.
class HeldBackend extends GameBackend:
	signal released
	var snapshot: Dictionary = {}
	var fetches: int = 0
	var held: bool = false
	var gate: Outcome = Outcome.ok()
	func fetch_bootstrap() -> Outcome:
		return gate
	func fetch_state() -> Outcome:
		fetches += 1
		if held: await released
		return Outcome.ok({"state": snapshot})

class OfflineTransport extends OnlineBackend.Transport:
	var requests: int = 0
	func request(_method: int, _url: String, _headers: PackedStringArray, _body: String) -> Dictionary:
		requests += 1
		return {"status": 0, "body": ""}

class UpdatingBackend extends OnlineBackend:
	var releases: int = 0
	var release: Dictionary = {}
	var updated: bool = false
	var snapshot: Dictionary = {}
	func fetch_bootstrap() -> Outcome:
		return Outcome.ok() if updated else Outcome.fail(ClientRelease.KIND_CONTENT_UPDATE, "Update needed")
	func fetch_content_release() -> Outcome:
		releases += 1
		updated = true
		return Outcome.ok(release)
	func fetch_state() -> Outcome:
		return Outcome.ok({"state": snapshot})

class InstalledContent extends ContentInstaller:
	var phases: Array[String] = []
	var needs_restart: bool = true
	func install(_release: Dictionary, _download: Callable) -> Outcome:
		for phase: String in ["downloading", "verifying", "installing"]:
			phases.append(phase)
			phase_changed.emit(phase)
			await (Engine.get_main_loop() as SceneTree).process_frame
		return Outcome.ok({"generation": 1, "content_release": "test", "restart_required": needs_restart})
	func mount_new() -> bool:
		return true

var loaded: GameFlow = null
var _session: Array = []
var _transport: OnlineBackend.Transport
var _content: ContentInstaller
var _preferences_path: String
var _onboarding_path: String
var _new_account: bool
const OnboardingPreferences = preload("res://scripts/app/onboarding_preferences.gd")
var _public: CryptoKey
var _release: Dictionary
const PROLOGUE_SEEN: String = "user://test_entry_flow_prologue.cfg"

func before_all() -> void:
	loaded = GameFlow.create()
	var key: CryptoKey = Crypto.new().generate_rsa(2048)
	_public = CryptoKey.new()
	_public.load_from_string(key.save_to_string(true), true)
	var manifest: Dictionary = {"schema": 1, "channel": "test", "content_release": "consent-test", "generation": 1,
		"app": {"min_version_code": 1, "max_version_code": 1}, "base_pack_sha256": "0".repeat(64), "rules_hash": "1".repeat(64),
		"key_id": "test-key", "issued_at_utc": "2026-10-07T00:00:00Z",
		"packs": [{"name": "test.pck", "sha256": "a".repeat(64), "bytes": 5242880}]}
	var bytes: PackedByteArray = JSON.stringify(manifest).to_utf8_buffer()
	var hash: HashingContext = HashingContext.new()
	hash.start(HashingContext.HASH_SHA256)
	hash.update(bytes)
	_release = {"manifest_b64": Marshalls.raw_to_base64(bytes),
		"signature_b64": Marshalls.raw_to_base64(Crypto.new().sign(HashingContext.HASH_SHA256, hash.finish(), key))}

func _patch_backend() -> UpdatingBackend:
	var backend: UpdatingBackend = UpdatingBackend.new()
	backend.release = _release.duplicate(true)
	return backend

func _patch_installer() -> InstalledContent:
	var installer: InstalledContent = InstalledContent.new({"test-key": _public}, 1, "user://test_entry_consent")
	installer.space_left = func() -> int: return 1 << 30
	return installer

func before_each() -> void:
	DirAccess.remove_absolute(PROLOGUE_SEEN)
	_session = [Online.session_token, Online.account_id, Online.session_expires_at_utc]
	_transport = Online.transport
	_content = Game.content
	_preferences_path = Online.preferences_path
	_onboarding_path = Online.onboarding_path
	_new_account = Online.is_new_account
	Online.is_new_account = false
	Online.onboarding_path = "user://test_entry_flow_onboarding.cfg"
	DirAccess.remove_absolute(Online.onboarding_path)
	Online.preferences_path = "user://test_entry_flow_auth.cfg"
	DirAccess.remove_absolute(Online.preferences_path)
	Online.session_token = ""
	Online.account_id = ""
	loaded.state = null
	Game.flow = null

func after_each() -> void:
	DirAccess.remove_absolute(PROLOGUE_SEEN)
	Online.session_token = _session[0]
	Online.account_id = _session[1]
	Online.session_expires_at_utc = _session[2]
	Online.transport = _transport
	Game.content = _content
	DirAccess.remove_absolute(Online.preferences_path)
	Online.preferences_path = _preferences_path
	DirAccess.remove_absolute(Online.onboarding_path)
	Online.onboarding_path = _onboarding_path
	Online.is_new_account = _new_account
	Game.flow = null
	await wait_process_frames(2)

func _shell(backend: GameBackend = null) -> AppShell:
	var shell: AppShell = AppShell.new()
	shell.startup_intro_enabled = false
	shell.flow = loaded
	shell.backend = backend
	add_child_autofree(shell)
	shell.director.prologue_seen_path = PROLOGUE_SEEN
	(shell.current as TitleScreen).tap()
	return shell

func _finish_reader(reader: VnScreen) -> void:
	for step: int in range(reader.line_count() * 2 + 1):
		if reader.get_parent() == null: break
		reader.go_next()

func _complete_opening(entry: EntryScreen) -> void:
	var opening: EntryScreen.Onboarding = entry._onboarding
	for stage: int in range(3):
		assert_eq(opening.index,stage)
		assert_eq(opening.phase,"before")
		assert_true(opening._host.get_child(0) is VnScreen)
		_finish_reader(opening._host.get_child(0) as VnScreen)
		await wait_until(func() -> bool: return opening._battle != null and opening._battle.playback != null,3.0)
		assert_eq(opening._battle.playback.outcome,"","the tutorial outcome is decided while it plays")
		assert_false(opening._battle.has_method("skip"))
		opening._battle.advance_time(10000.0)
		assert_eq(opening._battle.playback.outcome,"victory","the two heroes can finish the baseline without spending Ultimate")
		opening._battle.advance_time(2.0)
		assert_true(opening._battle.can_continue())
		opening._battle.press_continue()
		assert_eq(opening.phase,"after")
		_finish_reader(opening._host.get_child(0) as VnScreen)

class HeldInstall extends InstalledContent:
	signal released
	func install(release: Dictionary,download: Callable) -> Outcome:
		phase_changed.emit("downloading")
		await released
		return await super.install(release,download)

class FailedInstall extends InstalledContent:
	func install(_release: Dictionary,_download: Callable) -> Outcome:
		phase_changed.emit("downloading")
		await (Engine.get_main_loop() as SceneTree).process_frame
		return Outcome.fail(GameBackend.KIND_OFFLINE,"Download interrupted")

func test_long_patch_does_not_block_cutscenes_or_lose_tutorial_completion() -> void:
	Online.account_id = "new-account"
	OnboardingPreferences.register(Online.onboarding_path,Online.account_id,true)
	var installer: HeldInstall = HeldInstall.new({"test-key":_public},1,"user://test_entry_consent")
	installer.space_left = func() -> int: return 1 << 30
	Game.content = installer
	var shell: AppShell = _shell(_patch_backend())
	var entry: EntryScreen = shell.current as EntryScreen
	var restart: RestartRecorder = RestartRecorder.new()
	shell.director.restart_client = restart.request
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return entry.phase == "update_available",2.0)
	entry._patch_modal._confirm_action()
	entry._prologue.advance(120.0)
	entry._prologue.request_continue()
	assert_eq(entry.phase,"downloading")
	await _complete_opening(entry)
	assert_eq(restart.calls,0,"the tutorial cannot enter unavailable main-story content")
	assert_null(entry._onboarding, "the last cutscene dissolves into the patch page")
	assert_eq(entry.phase, "downloading")
	assert_false(OnboardingPreferences.pending(Online.onboarding_path,Online.account_id))
	installer.released.emit()
	await _confirm_restart(entry, restart)
	assert_eq(entry.phase,"restart_required")
	assert_false(Game.is_ready())

func test_failed_patch_keeps_tutorial_available_and_retains_its_checkpoint() -> void:
	Online.account_id = "new-account"
	OnboardingPreferences.register(Online.onboarding_path,Online.account_id,true)
	var installer: FailedInstall = FailedInstall.new({"test-key":_public},1,"user://test_entry_consent")
	installer.space_left = func() -> int: return 1 << 30
	Game.content = installer
	var shell: AppShell = _shell(_patch_backend())
	var entry: EntryScreen = shell.current as EntryScreen
	var restart: RestartRecorder = RestartRecorder.new()
	shell.director.restart_client = restart.request
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return entry.phase == "update_available",2.0)
	entry._patch_modal._confirm_action()
	await wait_process_frames(3)
	entry._prologue.advance(120.0)
	entry._prologue.request_continue()
	assert_not_null(entry._onboarding,"a download failure cannot dismiss the first-player opening")
	assert_string_contains(entry._onboarding._status.text,"Download paused")
	await _complete_opening(entry)
	assert_eq(entry.phase,"offline")
	assert_eq(restart.calls,0)
	assert_false(OnboardingPreferences.pending(Online.onboarding_path,Online.account_id))
	assert_eq(OnboardingPreferences.cursor(Online.onboarding_path,Online.account_id)["phase"],"complete")

func test_new_account_without_a_patch_still_finishes_tutorial_before_main_story() -> void:
	Online.account_id = "new-account"
	OnboardingPreferences.register(Online.onboarding_path,Online.account_id,true)
	var shell: AppShell = _shell(_backend())
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return is_instance_valid(entry._prologue),3.0)
	entry._prologue.advance(120.0)
	entry._prologue.request_continue()
	assert_eq(entry._onboarding.phase,"before")
	assert_eq(entry._onboarding._status.text,"Story content ready")
	await _complete_opening(entry)
	assert_same(shell.current, entry, "the AAB never enters 1-1 after its final cutscene")
	assert_eq(entry.phase, "patch_complete")
	assert_false(OnboardingPreferences.pending(Online.onboarding_path,Online.account_id))

func test_completed_opening_fresh_boot_arrives_at_the_menu_without_starting_1_1() -> void:
	Online.account_id = "new-account"
	OnboardingPreferences.register(Online.onboarding_path, Online.account_id, true)
	OnboardingPreferences.checkpoint(Online.onboarding_path, Online.account_id, 2, "complete", true)
	var shell: AppShell = _shell(_backend())
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return shell.current is HubScreen, 3.0)
	assert_true(shell.current is HubScreen)
	assert_true(shell.director.flow.is_at_story_start(), "the player chooses when to start the existing main story")
	assert_null(shell.director._entry)

func _backend() -> HeldBackend:
	var backend: HeldBackend = HeldBackend.new()
	backend.snapshot = JSON.parse_string(JSON.stringify({"schema_version": PlayerState.SCHEMA_VERSION,
		"story_state": loaded.rules.story.to_persisted_dict(loaded.rules.story.new_player_state()),
		"wallet": {"silver_crowns": 0, "eclipse_tokens": 0, "account_xp": 0}}))
	return backend

func test_title_tap_does_not_request_google_or_the_server_before_continue() -> void:
	var transport: OfflineTransport = OfflineTransport.new()
	Online.transport = transport
	var shell: AppShell = _shell()
	var entry: EntryScreen = shell.current as EntryScreen
	assert_not_null(entry)
	assert_eq(entry.phase, "sign_in")
	assert_eq(transport.requests, 0)
	shell.director._entry_utility("help")
	assert_true(is_instance_valid(entry._overlay))
	assert_eq(transport.requests, 0, "public Help needs no account")
	entry.handle_back()
	entry.primary.pressed.emit()
	assert_eq(entry.phase, "signing_in", "transient failures stay in the background")
	await wait_until(func() -> bool: return entry.phase == "login_error", 3.0)
	assert_eq(transport.requests, 3, "exactly three attempts before the small login error")
	assert_eq(entry.phase, "login_error")
	assert_eq(entry.message.text, "Failed to login")
	assert_eq(Online.last_login_attempts, 3)
	assert_false(Game.is_ready())

func test_snapshot_operation_survives_settings_and_duplicate_commands() -> void:
	var backend: HeldBackend = _backend()
	backend.held = true
	var shell: AppShell = _shell(backend)
	var entry: EntryScreen = shell.current as EntryScreen
	assert_eq(entry.phase, "ready")
	assert_eq(backend.fetches, 0, "gateway precedes patch checks")
	shell.director._entry_utility("settings")
	assert_not_null(entry._overlay)
	entry.primary.pressed.emit()
	assert_eq(entry.phase, "snapshot_sync")
	assert_null(entry._overlay, "patch closes Settings")
	assert_false(entry._footer.visible)
	shell.director._entry_action("retry")
	shell.director._entry_action("enter")
	assert_eq(backend.fetches, 1)
	assert_same(shell.current, entry)
	backend.released.emit()
	await wait_until(func() -> bool: return shell.current is VnScreen, 3.0)
	assert_true(shell.current is VnScreen, "verified patch opens the new-player route automatically")

func test_update_gate_waits_for_download_and_cannot_enter() -> void:
	var backend: HeldBackend = _backend()
	backend.gate = Outcome.fail(ClientRelease.KIND_CONTENT_UPDATE, "Update needed")
	var shell: AppShell = _shell(backend)
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	assert_eq(entry.phase, "error", "a non-online test backend cannot install a content release")
	assert_eq(entry.message.text, "Game data updates need the game server.")
	assert_false(entry._footer.visible)
	assert_eq(backend.fetches, 0)
	assert_false(Game.is_ready())
	shell.director._entry_action("enter")
	assert_same(shell.current, entry)

func test_verified_install_requiring_restart_never_offers_enter_game() -> void:
	var backend: UpdatingBackend = _patch_backend()
	var installer: InstalledContent = _patch_installer()
	Game.content = installer
	var shell: AppShell = _shell(backend)
	var entry: EntryScreen = shell.current as EntryScreen
	var restart: RestartRecorder = RestartRecorder.new()
	shell.director.restart_client = restart.request
	assert_eq(backend.releases, 0, "gateway still waits for the player's tap")
	entry.primary.pressed.emit()
	shell.director._entry_utility("help")
	assert_null(entry._overlay, "patch cannot open Help")
	await wait_until(func() -> bool: return entry.phase == "update_available", 2.0)
	assert_eq(entry.phase, "update_available")
	assert_true(entry._patch_modal.visible)
	assert_string_contains(entry._patch_modal._message.text, "5.0 MiB")
	assert_eq(installer.phases, [], "preflight cannot start installation")
	assert_eq(restart.calls, 0)
	entry.handle_back()
	assert_false(entry._patch_modal.visible)
	assert_eq(installer.phases, [], "cancel never starts a transfer")
	entry.primary.pressed.emit()
	assert_true(entry._patch_modal.visible)
	entry._patch_modal._confirm_action()
	assert_null(entry._prologue, "an existing account patches without the first-player opening")
	await _confirm_restart(entry, restart)
	assert_eq(backend.releases, 1)
	assert_eq(installer.phases, ["downloading", "verifying", "installing"])
	assert_eq(restart.calls, 1, "one confirmation requests exactly one restart")
	assert_false(entry.primary.visible)
	assert_false(entry._footer.visible)
	shell.director._entry_action("enter")
	assert_same(shell.current, entry)
	assert_false(Game.is_ready())

func test_sign_out_requires_session_confirmation_and_cannot_interrupt_sync() -> void:
	var entry: EntryScreen = add_child_autofree(EntryScreen.new())
	entry.present("sign_in", false)
	entry.confirm_sign_out()
	assert_null(entry._modal)
	entry.present("snapshot_sync", true)
	entry.confirm_sign_out()
	assert_null(entry._modal)
	entry.present("ready", true)
	watch_signals(entry)
	entry.confirm_sign_out()
	assert_true(entry._modal.visible)
	entry.handle_back()
	assert_signal_not_emitted(entry, "action_requested")
	entry.confirm_sign_out()
	entry._modal._confirm_action()
	assert_signal_emitted_with_parameters(entry, "action_requested", ["sign_out"])

func test_even_a_first_content_install_restarts_and_never_enters_with_the_old_process() -> void:
	var backend: UpdatingBackend = _patch_backend()
	backend.snapshot = _backend().snapshot
	var installer: InstalledContent = _patch_installer()
	installer.needs_restart = false
	Game.content = installer
	var shell: AppShell = _shell(backend)
	var entry: EntryScreen = shell.current as EntryScreen
	var restart: RestartRecorder = RestartRecorder.new()
	shell.director.restart_client = restart.request
	entry.primary.pressed.emit()
	shell.director._entry_utility("settings")
	assert_null(entry._overlay)
	assert_eq(installer.phases, [])
	await wait_until(func() -> bool: return entry.phase == "update_available", 2.0)
	entry._patch_modal._confirm_action()
	assert_null(entry._prologue, "an existing account patches without the first-player opening")
	await _confirm_restart(entry, restart)
	assert_same(shell.current, entry)
	assert_eq(restart.calls, 1)
	assert_eq(backend.releases, 1)
	assert_false(Game.is_ready(), "old-process player state is never adopted after installation")

func test_confirmed_sign_out_clears_the_session_and_loaded_player_snapshot() -> void:
	Online.session_token = "test-session"
	Online.account_id = "test-account"
	Online.transport = OfflineTransport.new()
	var shell: AppShell = _shell(_backend())
	var entry: EntryScreen = shell.current as EntryScreen
	assert_eq(entry.phase, "ready")
	entry.confirm_sign_out()
	entry._modal._confirm_action()
	await wait_process_frames(2)
	assert_false(Online.has_session())
	assert_false(Game.is_ready())
	assert_null(loaded.state)
	assert_eq(entry.phase, "sign_in")
	assert_false(Online.returning_player())

class RestartRecorder extends RefCounted:
	var calls: int = 0
	var available: bool = true
	func request() -> bool:
		calls += 1
		return available

func _confirm_restart(entry: EntryScreen, restart: RestartRecorder) -> void:
	await wait_until(func() -> bool: return entry.phase == "patch_complete", 2.0)
	assert_eq(entry.phase, "patch_complete")
	assert_eq(restart.calls, 0, "verified content waits for the player's completion confirmation")
	assert_true(entry.primary.visible)
	entry.primary.pressed.emit()
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return restart.calls == 1, 2.0)

class RejectedContent extends ContentInstaller:
	func install(_release: Dictionary, _download: Callable) -> Outcome:
		phase_changed.emit("verifying")
		return Outcome.fail(ContentManifest.KIND_UNTRUSTED, "The content manifest signature does not verify.")

func test_untrusted_patch_stops_without_restart_or_player_state() -> void:
	var backend: UpdatingBackend = _patch_backend()
	backend.release["signature_b64"] = Marshalls.raw_to_base64(PackedByteArray([1, 2, 3]))
	var installer: InstalledContent = _patch_installer()
	Game.content = installer
	var shell: AppShell = _shell(backend)
	var restart: RestartRecorder = RestartRecorder.new()
	shell.director.restart_client = restart.request
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return entry.phase == "error", 2.0)
	assert_eq(entry.phase, "error")
	assert_eq(restart.calls, 0)
	assert_false(Game.is_ready())
	assert_string_contains(entry.message.text, "signature")
	assert_false(entry._footer.visible)
	assert_null(entry._patch_modal, "untrusted metadata cannot reach an approval popup")
	assert_eq(installer.phases, [], "untrusted preflight never reaches install")

func test_restart_retry_does_not_redownload_an_already_verified_patch() -> void:
	var backend: UpdatingBackend = _patch_backend()
	Game.content = _patch_installer()
	var shell: AppShell = _shell(backend)
	var restart: RestartRecorder = RestartRecorder.new()
	restart.available = false
	shell.director.restart_client = restart.request
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return entry.phase == "update_available", 2.0)
	entry._patch_modal._confirm_action()
	assert_null(entry._prologue, "an existing account patches without the first-player opening")
	await _confirm_restart(entry, restart)
	await wait_until(func() -> bool: return entry.phase == "restart_error", 2.0)
	assert_eq(restart.calls, 1)
	assert_false(Game.is_ready())
	restart.available = true
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return restart.calls == 2, 2.0)
	assert_eq(restart.calls, 2)
	assert_eq(backend.releases, 1, "restart retry does not fetch/install the pack again")
	assert_eq(entry.phase, "restart_required")

func test_restart_hint_is_one_use_and_contains_no_credentials() -> void:
	var path: String = "user://test_entry_restart.cfg"
	assert_eq(EntryRestart.arm(path), OK)
	assert_true(EntryRestart.pending(path))
	assert_false(FileAccess.get_file_as_string(path).contains("token"))
	assert_true(EntryRestart.consume(path))
	assert_false(EntryRestart.consume(path), "a fresh boot cannot loop on the same hint")

func test_first_download_finishing_early_waits_for_story_without_entering_game() -> void:
	Online.account_id = "new-account"
	OnboardingPreferences.register(Online.onboarding_path,Online.account_id,true)
	var backend: UpdatingBackend = _patch_backend()
	Game.content = _patch_installer()
	var shell: AppShell = _shell(backend)
	var restart: RestartRecorder = RestartRecorder.new()
	shell.director.restart_client = restart.request
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return entry.phase == "update_available", 2.0)
	entry._patch_modal._confirm_action()
	await wait_until(func() -> bool: return entry.phase == "installing", 2.0)
	assert_not_null(entry._prologue)
	entry._prologue.set_process(false)
	assert_true(entry._prologue.playing)
	assert_eq(restart.calls, 0, "verified content does not cut off the story")
	assert_true(shell.director._entry_busy)
	assert_false(Game.is_ready())
	assert_false(entry._footer.visible)
	entry._prologue.advance(119.75 - entry._prologue.elapsed_seconds)
	assert_eq(restart.calls, 0)
	assert_false(EntryPrologue.was_seen(PROLOGUE_SEEN))
	entry._prologue.advance(0.25)
	await wait_process_frames(3)
	assert_eq(restart.calls, 0, "natural completion must wait for Continue")
	assert_true(entry._prologue._end_controls.visible)
	entry._prologue.play()
	entry._prologue.set_process(false)
	assert_eq(restart.calls, 0, "Replay retains the verified content gate")
	entry._prologue.advance(120.0)
	entry._prologue.request_continue()
	assert_not_null(entry._onboarding, "Continue opens the cutscene before T-1")
	assert_eq(entry._onboarding.phase,"before")
	assert_eq(restart.calls,0,"the patch also waits for all three tutorials")
	await _complete_opening(entry)
	await _confirm_restart(entry, restart)
	assert_eq(entry.phase, "restart_required")
	assert_true(EntryPrologue.was_seen(PROLOGUE_SEEN))
	assert_eq(backend.releases, 1)
	assert_false(Game.is_ready())

func test_a_viewed_opening_does_not_hold_the_next_content_install() -> void:
	EntryPrologue.mark_seen(PROLOGUE_SEEN)
	var backend: UpdatingBackend = _patch_backend()
	Game.content = _patch_installer()
	var shell: AppShell = _shell(backend)
	var restart: RestartRecorder = RestartRecorder.new()
	shell.director.restart_client = restart.request
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	await wait_until(func() -> bool: return entry.phase == "update_available", 2.0)
	entry._patch_modal._confirm_action()
	await _confirm_restart(entry, restart)
	assert_null(entry._prologue)
	assert_eq(entry.phase, "restart_required")

class ReturningTransport extends OnlineBackend.Transport:
	var urls: Array[String] = []
	func request(_method: int, url: String, _headers: PackedStringArray, _body: String) -> Dictionary:
		urls.append(url)
		if url.ends_with("/v1/bootstrap"):
			return {"status": 0, "body": ""}
		return {"status": 200, "body": "{\"nonce\":\"returning-nonce\"}" if url.ends_with("/nonce") else "{\"account_id\":\"returning-player\",\"session_token\":\"fixture-session\"}"}

class ReturningSigner extends SignInFlow.Signer:
	var calls: int = 0
	func request_id_token(_client: String, _nonce: String) -> Dictionary:
		calls += 1
		return {"status": "ok", "id_token": "fixture-google-credential"}

func test_returning_player_skips_the_google_button_and_checks_content_automatically() -> void:
	var saved_signer: SignInFlow.Signer = Online.signer
	var signer: ReturningSigner = ReturningSigner.new()
	var transport: ReturningTransport = ReturningTransport.new()
	Online.signer = signer
	Online.transport = transport
	Online.remember_login(true)
	var shell: AppShell = _shell()
	var entry: EntryScreen = shell.current as EntryScreen
	assert_true(shell.director._patch_active,"a verified returning session starts content checks without another tap")
	assert_eq(entry.phase,"offline","the isolated transport makes the content check unavailable")
	assert_null(entry._prologue,"a returning account never gets the first-player opening on a new device")
	assert_eq(signer.calls, 1)
	assert_eq(transport.urls.size(), 3, "authentication is followed by a content check through the fixture transport")
	assert_false(Game.is_ready(), "authentication does not bypass content and snapshot checks")
	Online.signer = saved_signer

func test_returning_account_downloads_a_verified_patch_without_replaying_tutorial() -> void:
	var backend: UpdatingBackend = _patch_backend()
	var installer: InstalledContent = _patch_installer()
	Game.content = installer
	var shell: AppShell = _shell(backend)
	var restart: RestartRecorder = RestartRecorder.new()
	shell.director.restart_client = restart.request
	shell.director._automatic_return = true
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	await _confirm_restart(entry, restart)
	assert_eq(installer.phases, ["downloading", "verifying", "installing"])
	assert_null(entry._patch_modal, "the owner requested automatic patching for returning accounts")
	assert_null(entry._prologue)
	assert_null(entry._onboarding)
	assert_eq(entry.phase, "restart_required")
	assert_false(Game.is_ready(), "the existing fresh-process content gate still applies")
