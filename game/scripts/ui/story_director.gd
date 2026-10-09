class_name StoryDirector
extends Node
## Decides which screen comes next (port of client/app.py's `_present_*` sequencing on top of `GameFlow`): boot (content on a worker, then the
## player's snapshot from the server), the hub, the story_order entries (narrative scenes, the First Oath gate, stages: pre-battle scene, roster, battle
## on a worker, replay, post-battle scene, defeat). Every rule lives in `GameFlow` and the services; this only connects screens to them.

const _END_OF_PREVIEW_SCENE: Dictionary = {
	"scene_id": "part1_end_of_preview",
	"title_en": "End of Part I Preview",
	"lines": [{
		"speaker_id": "narrator",
		"speaker_display": "",
		"text_en": "You have reached the end of the currently authored Part I story content. Thank you for playing.",
	}],
}
const BATTLE_ERROR_TITLE: String = "Something went wrong"
const BATTLE_ERROR_MESSAGE: String = "Stage %s could not be completed because of an error. Nothing from this attempt was saved; you can try again."

const HUB_CONTINUE: String = "continue"
const HUB_TEAM: String = "team"
const HUB_INVENTORY: String = "inventory"
const HUB_SUMMON: String = "summon"
const HUB_QUESTS: String = "quests"
const HUB_FRIENDS: String = "friends"
const HUB_MAIL: String = "mail"
const HUB_BLESSING: String = "blessing"
const HUB_INN_MEAL: String = "inn_meal"
const HUB_SETTINGS: String = "settings"
const SETTINGS_SIGN_OUT: String = "sign_out"
const SETTINGS_DELETE_ACCOUNT: String = "delete_account"
const SETTINGS_CONTACT_SUPPORT: String = "contact_support"
const SETTINGS_LICENSES: String = "licenses"
const SETTINGS_AD_PRIVACY: String = "ad_privacy"
## Where players write for help (owner decision D-01); the same address is on the web deletion page (server/src/web.ts).
const SUPPORT_EMAIL: String = "unawareofmydemise@gmail.com"
## The game's store page (the Android package of export_presets.cfg): where "Update" sends a build the server no longer accepts.
const STORE_URL: String = "https://play.google.com/store/apps/details?id=io.github.mucaeksi.unawareofmydemise"
## INF-019: after this long in the background the hub asks the server again (another device may have played, a
## maintenance or a required update may have started); shorter switches change nothing.
const RESUME_REFRESH_MS: int = 5 * 60 * 1000
const HUB_DIAGNOSTICS: String = "diagnostics"

const _STOP_REASONS: Dictionary = {
	"silver_crowns": "Not enough Silver Crowns for the next level.",
	"ascension_items": "Ascension materials are needed for the next level.",
	"ascension_account_level": "A higher account level is needed to ascend.",
	"level_cap": "Level cap reached.",
}
const _EQUIPMENT_STOP_REASONS: Dictionary = {
	"milestone_items": "A Blacksmith Rivet upgrade is needed for the next level.",
	"silver_crowns": "Not enough Silver Crowns for the next level.",
	"level_cap": "Level cap reached.",
}
const GENERIC_PROBLEM: String = "Something went wrong; nothing was changed."
const EntryStory = preload("res://scripts/ui/entry/entry_prologue.gd")
const OnboardingPreferences = preload("res://scripts/app/onboarding_preferences.gd")

var shell: AppShell = null
var flow: GameFlow = null
var prologue_seen_path: String = EntryStory.SEEN_PATH
var restart_hint_path: String = EntryRestart.PATH

var _boot_job: WorkerJob = null
## The title on show while the content loads behind it (null once the player has tapped or when it was skipped).
var _title: TitleScreen = null
## The content-loaded flow waiting for the title's tap.
var _loaded_flow: GameFlow = null
## Purchases and ads (INF-036); built on first use. Tests may set their own.
var monetization: Monetization = null
var _startup: StartupSequence = null
var _entry: EntryScreen = null
var _entry_busy: bool = false
var _patch_active: bool = false
var _resume_after_patch: bool = false
var _patch_started_ms: int = 0
var _pending_update: Dictionary = {}
var _automatic_return: bool = false
var login_failure: Outcome = null
var restart_client: Callable = EntryRestart.request
var _battle_job: WorkerJob = null
## When the app went to the background (Time.get_ticks_msec; -1 = in the foreground).
var _backgrounded_at: int = -1
var _battle_stage: String = ""
var _battle_roster: Variant = null


func _ready() -> void:
	set_process(false)
	Game.entry_phase_changed.connect(_on_entry_phase)
	Game.entry_download_progress.connect(_on_entry_download_progress)


## Begins the boot sequence (docs/design/FIRST_LAUNCH_FLOW.md): the title, with the content loading behind it (on a worker unless the
## shell already has a loaded flow); the tap then goes on to the server (release gate, sign-in, snapshot) and the first screen.
## `skip_title`: a retry or a restart after an update goes straight on.
func start(skip_title: bool = false) -> void:
	if _entry_busy:
		return
	_entry = null
	_resume_after_patch = EntryRestart.consume(restart_hint_path)
	_patch_active = false
	if _startup != null:
		_startup.cancel()
		_startup.queue_free()
		_startup = null
	_loaded_flow = null
	# INF-026: the installed content release is mounted before any content is read.
	Game.mount_content()
	if skip_title or _resume_after_patch:
		_title = null
		Audio.play_entry_theme()
		_show_message("Unaware of My Demise", "Loading...")
	else:
		_present_title()
	if shell.flow != null:
		_on_content_loaded(shell.flow)
		return
	_boot_job = WorkerJob.start(func() -> Variant: return GameFlow.create())
	set_process(true)


func _process(_delta: float) -> void:
	if _boot_job != null and _boot_job.is_finished():
		var loaded: GameFlow = _boot_job.finish() as GameFlow
		_boot_job = null
		_on_content_loaded(loaded)
	if _battle_job != null and _battle_job.is_finished():
		var result: BattleService.BattleResult = _battle_job.finish() as BattleService.BattleResult
		_battle_job = null
		_on_battle_finished(result)
	set_process(_boot_job != null or _battle_job != null)


## True while a worker (content load or battle) is running.
func is_busy() -> bool:
	return _boot_job != null or _battle_job != null


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_APPLICATION_FOCUS_OUT:
			if _backgrounded_at < 0:
				_backgrounded_at = Time.get_ticks_msec()
		NOTIFICATION_APPLICATION_RESUMED, NOTIFICATION_APPLICATION_FOCUS_IN:
			if _backgrounded_at >= 0:
				var away: int = Time.get_ticks_msec() - _backgrounded_at
				_backgrounded_at = -1
				handle_resume(away)


## Back from the background after `away_ms`: on the hub, after a long absence, the server's state is fetched again and
## the hub redrawn; an update or a maintenance that started meanwhile shows at once. Battles, story scenes and other
## screens are never interrupted (their next server call meets the same answers).
func handle_resume(away_ms: int) -> void:
	if away_ms < RESUME_REFRESH_MS or flow == null or not (shell.current is HubScreen):
		return
	var hub: Control = shell.current
	var synced: Outcome = await flow.sync()
	if shell.current != hub:
		return
	if synced.is_ok():
		_present_hub()
	elif synced.error_kind == ClientRelease.KIND_UPDATE_REQUIRED:
		_present_update_required(synced.error)
	elif synced.error_kind == ClientRelease.KIND_MAINTENANCE:
		_present_boot_failure("Maintenance", synced.error)


func on_back_unhandled() -> void:
	# Entry consumes Back for utilities and active operations before the shell reaches this root action.
	if shell.current is HubScreen or shell.current is TitleScreen or shell.current is EntryScreen:
		get_tree().quit()


# -- boot ---------------------------------------------------------------------------------------------


func _present_title() -> void:
	_title = TitleScreen.new()
	_title.reduced_motion = shell.reduced_motion
	_title.load_title("build %d" % ClientRelease.version_code())
	_title.start_requested.connect(func() -> void:
		_title = null
		_on_flow_loaded(_loaded_flow), CONNECT_ONE_SHOT)
	_title.support_requested.connect(func() -> void: OS.shell_open(support_mail_uri()))
	shell.show_screen(_title)
	if shell.startup_intro_enabled:
		var presentation: StartupSequence = shell.startup_presentation.instantiate() as StartupSequence
		if shell.reduced_motion:
			presentation.fade_seconds = 0.0
			presentation.title_reveal_seconds = 0.0
		_startup = presentation
		presentation.phase_changed.connect(func(screen_id: String) -> void:
			if screen_id == "ui.title" and _title != null:
				UiPageTransition.reveal(_title, presentation.title_reveal_seconds))
		presentation.completed.connect(func() -> void:
			if _startup != presentation:
				return
			_startup = null
			presentation.queue_free()
			if _title != null and _loaded_flow != null:
				_title.set_ready(true), CONNECT_ONE_SHOT)
		shell.add_child(presentation)
	else:
		Audio.play_entry_theme()


## The content is loaded (or failed to): with the title on show it waits for the tap, otherwise it goes straight on.
func _on_content_loaded(loaded: GameFlow) -> void:
	if _title == null:
		_on_flow_loaded(loaded)
		return
	_loaded_flow = loaded
	if _startup == null:
		_title.set_ready(true)


func _on_flow_loaded(loaded: GameFlow) -> void:
	_entry_busy = false
	# A flow that failed to load is dropped, so "Try again" reloads the content instead of showing the same failure.
	shell.flow = loaded if loaded.is_ready() else null
	if not loaded.is_ready():
		_present_boot_failure("Game data could not be loaded", loaded.error)
		return
	_loaded_flow = loaded
	if not is_instance_valid(_entry) or shell.current != _entry:
		_entry = EntryScreen.new()
		_entry.action_requested.connect(_entry_action)
		_entry.utility_requested.connect(_entry_utility)
		_entry.present("sign_in", Online.has_session())
		shell.show_screen(_entry)
	if _patch_active:
		_connect_entry()
	elif shell.backend != null or Online.has_session():
		_entry.present("ready", Online.has_session() or shell.backend != null)
		_automatic_return = shell.backend == null and Online.has_session() and not Online.is_new_account
		if _resume_after_patch or _automatic_return: _connect_entry()
	elif Online.returning_player() or _resume_after_patch:
		_sign_in_entry()

func _sign_in_entry() -> void:
	if _entry_busy or not is_instance_valid(_entry): return
	_entry_busy = true
	_entry.present("signing_in", false)
	var result: Outcome = await Online.sign_in()
	_entry_busy = false
	if not is_inside_tree() or not is_instance_valid(_entry): return
	login_failure = result if not result.is_ok() else null
	if not result.is_ok():
		_entry.present("sign_in" if result.error_kind == SignInFlow.KIND_CANCELLED else "login_error", false)
		return
	_entry.present("ready", true)
	_automatic_return = not Online.is_new_account
	if _resume_after_patch or _automatic_return: _connect_entry()


func _on_entry_phase(phase: String) -> void:
	if _entry_busy and is_instance_valid(_entry) and shell.current == _entry:
		_entry.present(phase, Online.has_session())

func _on_entry_download_progress(received: int, total: int) -> void:
	if _entry_busy and is_instance_valid(_entry) and shell.current == _entry:
		_entry.set_download_progress(received, total)


func _connect_entry() -> void:
	if _entry_busy or not is_instance_valid(_entry):
		return
	_entry_busy = true
	if not _patch_active:
		_patch_started_ms = Time.get_ticks_msec()
	_patch_active = true
	_entry.close_utility()
	_entry.present("checking", Online.has_session())
	var attached: bool = await Game.attach(_loaded_flow, shell.backend)
	_entry_busy = false
	if not is_instance_valid(_entry) or not is_inside_tree():
		return
	if not attached:
		if Game.boot_error_kind == ClientRelease.KIND_CONTENT_UPDATE:
			_check_content_update()
			return
		if Game.boot_error_kind == ClientRelease.KIND_UPDATE_REQUIRED:
			_entry.present("client_update", Online.has_session(), Game.boot_error)
			return
		_entry.present("offline" if Game.boot_error_kind == GameBackend.KIND_OFFLINE else "error", Online.has_session(), Game.boot_error)
		return
	flow = Game.flow
	_entry_busy = true
	_entry.present("complete", Online.has_session())
	var remaining: float = maxf(0.0, 2.0 - float(Time.get_ticks_msec() - _patch_started_ms) / 1000.0)
	if remaining > 0.0: await get_tree().create_timer(remaining).timeout
	_entry_busy = false
	_enter_game()


func _enter_game() -> void:
	if _entry_busy or not _patch_active or not is_instance_valid(_entry) or _entry.phase != "complete" or not Game.is_ready():
		return
	if flow.is_at_story_start() and _opening_pending():
		_entry_busy = true
		_start_opening_tutorial()
		if is_instance_valid(_entry._onboarding): _entry._onboarding.set_patch_result(Outcome.ok())
		await _entry.wait_for_onboarding()
		if not is_inside_tree() or not is_instance_valid(_entry): return
		_entry.close_onboarding()
		_entry_busy = false
		_entry.present("patch_complete", Online.has_session())
		return
	_entry = null
	if not flow.open_attempt().is_empty():
		_present_unfinished_battle()
	elif flow.is_at_story_start() and not _resume_after_patch and not OnboardingPreferences.completed(Online.onboarding_path, Online.account_id):
		# A new player goes straight into the opening; the story chain takes them on from there.
		Audio.stop_music(1.2)
		_present_current_entry()
	else:
		_present_hub()


## Fetch and validate sizes, compatibility, signature, replay floor and space before asking to download.
func _check_content_update() -> void:
	_entry_busy = true
	_pending_update = {}
	_entry.present("checking", Online.has_session())
	var prepared: Outcome = await Game.prepare_content_update(shell.backend)
	_entry_busy = false
	if not is_inside_tree() or not is_instance_valid(_entry): return
	if not prepared.is_ok():
		_entry.present("offline" if prepared.error_kind == GameBackend.KIND_OFFLINE else "error", Online.has_session(), prepared.error)
		return
	_pending_update = prepared.value
	_entry.set_download_progress(int(_pending_update["total_bytes"]) - int(_pending_update["remaining_bytes"]), int(_pending_update["total_bytes"]))
	_entry.present("update_available", Online.has_session())
	if _automatic_return: _update_content()
	else: _entry.confirm_content_update(_pending_update)


## First-player Start or the returning-account route starts the verified patch.
## No old-process snapshot is adopted after installation.
func _update_content() -> void:
	if _entry_busy or not is_instance_valid(_entry) or _entry.phase != "update_available" or _pending_update.is_empty():
		return
	_entry_busy = true
	var approved: Dictionary = _pending_update
	_pending_update = {}
	_entry.present("checking", Online.has_session())
	var opening: bool = _opening_pending()
	if opening: _start_opening_tutorial()
	var updated: Outcome = await Game.update_content(shell.backend, approved)
	_entry_busy = false
	if not is_inside_tree() or not is_instance_valid(_entry):
		return
	if opening:
		_entry_busy = true
		if is_instance_valid(_entry._onboarding): _entry._onboarding.set_patch_result(updated)
		_entry.set_meta("opening_patch_result",updated)
		await _entry.wait_for_onboarding()
		if not is_inside_tree() or not is_instance_valid(_entry): return
		_entry.close_onboarding()
		_entry_busy = false
	if not updated.is_ok():
		_entry.present("offline" if updated.error_kind == GameBackend.KIND_OFFLINE else "error", Online.has_session(), updated.error)
		return
	_entry_busy = true
	await _entry.wait_for_prologue()
	if not is_inside_tree() or not is_instance_valid(_entry): return
	_entry_busy = false
	_entry.present("patch_complete", Online.has_session())


func _opening_pending() -> bool:
	return OnboardingPreferences.pending(Online.onboarding_path,Online.account_id)


func _start_opening_tutorial() -> void:
	var cursor: Dictionary = OnboardingPreferences.cursor(Online.onboarding_path,Online.account_id)
	if cursor["intro_done"]:
		_begin_opening_tutorial(_entry)
	else:
		_entry.start_prologue(prologue_seen_path)
		var entry: EntryScreen = _entry
		entry._prologue.dismissed.connect(func() -> void: _begin_opening_tutorial(entry),CONNECT_ONE_SHOT)


func _begin_opening_tutorial(entry: EntryScreen) -> void:
	if not is_inside_tree() or not is_instance_valid(entry) or _entry != entry: return
	entry.start_onboarding(_loaded_flow.registry,Online.account_id,Online.onboarding_path)
	if entry.has_meta("opening_patch_result"):
		entry._onboarding.set_patch_result(entry.get_meta("opening_patch_result") as Outcome)
	elif flow != null and Game.is_ready():
		entry._onboarding.set_patch_result(Outcome.ok())


func _entry_action(id: String) -> void:
	if _entry_busy or not is_instance_valid(_entry):
		return
	match id:
		"review_update":
			if not _pending_update.is_empty(): _entry.confirm_content_update(_pending_update)
		"download":
			_update_content()
		"sign_in":
			if _entry.phase in ["sign_in", "login_error"]: _sign_in_entry()
		"retry":
			if _patch_active: _connect_entry()
		"begin":
			if _entry.phase == "ready" and (Online.has_session() or shell.backend != null): _connect_entry()
		"restart":
			if _entry.phase in ["patch_complete", "restart_error"]:
				_entry_busy = true
				_entry.present("restart_required", Online.has_session())
				await get_tree().create_timer(0.65).timeout
				if not is_inside_tree() or not is_instance_valid(_entry): return
				if not restart_client.call():
					_entry_busy = false
					_entry.present("restart_error", Online.has_session())
		"store": OS.shell_open(STORE_URL)
		"sign_out":
			if not Online.has_session() or not _entry._footer.visible: return
			_entry_busy = true
			_entry.present("signing_out", true)
			await Online.log_out()
			_entry_busy = false
			flow = null
			Game.flow = null
			_patch_active = false
			if _loaded_flow != null: _loaded_flow.state = null
			if is_inside_tree() and is_instance_valid(_entry): _entry.present("sign_in", false)


func _entry_utility(id: String) -> void:
	if not is_instance_valid(_entry) or not _entry._footer.visible: return
	if id == "sign_out":
		_entry.confirm_sign_out()
		return
	var page: EntryUtility = EntryUtility.new()
	page.page = id
	page.volumes = {"Music": Audio.volume("Music"), "Voice": Audio.volume("Voice"), "SFX": Audio.volume("SFX")}
	page.frame_rate = shell.frame_rate
	page.allow_120 = FrameRatePolicy.high_refresh_available()
	page.frame_rate_changed.connect(func(value: int) -> void:
		shell.set_frame_rate(value)
		shell.save_ui_preferences())
	page.text_scale = shell.text_scale
	page.reduced_motion = shell.reduced_motion
	page.volume_changed.connect(Audio.set_volume)
	page.text_scale_changed.connect(func(value: float) -> void:
		shell.text_scale = value
		shell.theme = UiTheme.create(value)
		shell.save_ui_preferences())
	page.motion_changed.connect(func(reduced: bool) -> void:
		shell.reduced_motion = reduced
		_entry._refresh_prompt()
		shell.save_ui_preferences())
	page.support_submitted.connect(_entry_support_submit.bind(weakref(page)))
	page.page_requested.connect(_entry_utility)
	_entry.open_utility(page)

func _entry_support_submit(payload: Dictionary, page_ref: WeakRef) -> void:
	var client: SupportClient = SupportClient.new(Online.server_url(), Online.transport)
	var result: Outcome = await client.submit(payload)
	var page: EntryUtility = page_ref.get_ref() as EntryUtility
	if is_instance_valid(page) and page.is_inside_tree():
		page.support_result(result)


## This build is below the server's floor: the only way on is the store (docs/design/FIRST_LAUNCH_FLOW.md step 4).
func _present_update_required(message: String) -> void:
	var screen: MessageScreen = _show_message("Update required", message, [
		{"id": "update", "label": "Update"}, {"id": "retry", "label": "Try again"}] as Array[Dictionary])
	screen.chosen.connect(func(action_id: String) -> void:
		if action_id == "update":
			OS.shell_open(STORE_URL)
		start(true), CONNECT_ONE_SHOT)


func _present_boot_failure(title: String, message: String) -> void:
	var kind: String = "offline" if Game.boot_error_kind == GameBackend.KIND_OFFLINE else "error"
	var screen: MessageScreen = _show_message(title, message, [{"id": "retry", "label": "Try again"}] as Array[Dictionary], kind)
	screen.chosen.connect(func(_action_id: String) -> void: start(true), CONNECT_ONE_SHOT)


# -- hub ----------------------------------------------------------------------------------------------


func _present_hub(status: String = "") -> void:
	var money: Dictionary = flow.wallet()
	var summary: String = "Silver Crowns %d   Eclipse Tokens %d\nFate's Threads %d   Ration %d   Account XP %d" % [int(money.get("silver_crowns", 0)), int(money.get("eclipse_tokens", 0)), int(money.get("fate_threads", 0)), int(money.get("ration", 0)), int(money.get("account_xp", 0))]
	var over: bool = flow.is_finished() and not flow.needs_first_oath_selection()
	var entries: Array[Dictionary] = [
		{"id": HUB_CONTINUE, "label": "Epilogue" if over else "Continue Story"},
		{"id": HUB_TEAM, "label": "Team"},
		{"id": HUB_INVENTORY, "label": "Inventory"},
		{"id": HUB_SUMMON, "label": "Summon"},
		{"id": HUB_QUESTS, "label": "Quests"},
		{"id": HUB_FRIENDS, "label": "Friends"},
		{"id": HUB_MAIL, "label": "Mail"},
		{"id": HUB_BLESSING, "label": "Eclipse Blessing"},
		{"id": HUB_SETTINGS, "label": "Settings"},
	]
	var meal: int = flow.state.inn_meal_amount()
	if meal > 0:
		entries.insert(1, {"id": HUB_INN_MEAL, "label": "Inn Meal (+%d Ration)" % meal})
	if OS.is_debug_build():
		entries.append({"id": HUB_DIAGNOSTICS, "label": "Diagnostics"})
	var hub: HubScreen = HubScreen.new()
	hub.load_hub(summary, entries, status)
	hub.chosen.connect(_on_hub_chosen)
	shell.show_screen(hub)
	Audio.play_flow_cue(AudioCues.FLOW_HUB)


func _on_hub_chosen(entry_id: String) -> void:
	match entry_id:
		HUB_CONTINUE:
			_present_current_entry()
		HUB_TEAM:
			_present_team()
		HUB_INVENTORY:
			_present_inventory()
		HUB_SUMMON:
			_present_gacha()
		HUB_QUESTS:
			_present_quests()
		HUB_FRIENDS:
			_present_friends()
		HUB_MAIL:
			_present_mailbox()
		HUB_BLESSING:
			_present_blessing()
		HUB_INN_MEAL:
			_claim_inn_meal()
		HUB_SETTINGS:
			_present_settings()
		HUB_DIAGNOSTICS:
			_present_diagnostics()


func _present_diagnostics() -> void:
	var scene: PackedScene = load("res://scenes/boot/boot.tscn") as PackedScene
	var diagnostics: Control = scene.instantiate() as Control
	diagnostics.set("embedded", true)
	diagnostics.connect("back_requested", func() -> void: _present_hub())
	shell.show_screen(diagnostics)


# -- the story ----------------------------------------------------------------------------------------


## Checked before the story_order entry: the First Oath Invitation is a one-time gate that has to be resolved before whichever entry is next.
func _present_current_entry() -> void:
	if flow.needs_first_oath_selection():
		_present_first_oath()
		return
	var entry_id: String = flow.current_entry()
	if entry_id.is_empty():
		_present_vn(_END_OF_PREVIEW_SCENE, _present_hub)
		return
	if flow.is_stage(entry_id):
		_present_stage(entry_id)
		return
	_present_vn(flow.story_index.narrative_scene(entry_id), _finish_narrative_entry)


func _present_vn(scene: Dictionary, on_finished: Callable) -> void:
	var screen: VnScreen = VnScreen.new()
	if not screen.load_scene(scene):
		_show_message("This scene cannot be shown", screen.error, [{"id": "hub", "label": "Back to the menu"}] as Array[Dictionary]).chosen.connect(func(_action_id: String) -> void: _present_hub(), CONNECT_ONE_SHOT)
		return
	screen.finished.connect(on_finished, CONNECT_ONE_SHOT)
	shell.show_screen(screen)


func _finish_narrative_entry() -> void:
	var advanced: Outcome = await flow.advance()
	if not advanced.is_ok():
		_present_save_problem(advanced, _finish_narrative_entry)
		return
	_present_current_entry()


func _present_save_problem(outcome: Outcome, retry: Callable) -> void:
	# A lost connection leaves the change unconfirmed: trying again resends the same request, which the server never applies twice (INF-013).
	var advice: String = "It may already be saved; trying again finishes it and never applies it twice." if outcome.error_kind == GameBackend.KIND_OFFLINE \
		else "Nothing was changed; you can try again."
	var screen: MessageScreen = _show_message("Progress could not be saved", "%s\n%s" % [outcome.error, advice], [
		{"id": "retry", "label": "Try again"}, {"id": "hub", "label": "Back to the menu"}] as Array[Dictionary])
	screen.chosen.connect(_on_save_problem_chosen.bind(retry), CONNECT_ONE_SHOT)


func _on_save_problem_chosen(action_id: String, retry: Callable) -> void:
	if action_id == "retry":
		retry.call()
	else:
		_present_hub()


func _present_first_oath() -> void:
	var selector: SelectorScreen = SelectorScreen.new()
	selector.load_choices(flow.first_oath_choices(), "First Oath Invitation: choose one hero")
	selector.confirmed.connect(_confirm_first_oath)
	shell.show_screen(selector)


func _confirm_first_oath(character_id: String) -> void:
	var claimed: Outcome = await flow.claim_first_oath(character_id)
	if not claimed.is_ok():
		var selector: SelectorScreen = shell.current as SelectorScreen
		if selector != null:
			selector.show_error(claimed.error)
		return
	_present_current_entry()


func _present_stage(stage_id: String) -> void:
	var pre: Dictionary = flow.story_index.pre_battle_scene(stage_id)
	if flow.needs_roster_selection(stage_id):
		_present_vn(pre, func() -> void: _present_roster(stage_id))
	else:
		# The tutorial party is fixed (the two free starters): there is nothing to choose.
		_present_vn(pre, func() -> void: _start_battle(stage_id, null))


func _present_roster(stage_id: String, preselected: Variant = null) -> void:
	var start: Array[String] = []
	if preselected == null:
		start = flow.auto_roster(stage_id)
	else:
		for character_id: Variant in preselected:
			start.append(String(character_id))
	var roster: RosterScreen = RosterScreen.new()
	roster.load_stage(stage_id, flow.party_size(), flow.roster_candidates(), flow.guest_display_names(stage_id), start)
	roster.confirmed.connect(func(selected: Array[String]) -> void: _confirm_roster(stage_id, selected))
	shell.show_screen(roster)


func _confirm_roster(stage_id: String, selected: Array[String]) -> void:
	var problem: String = flow.validate_roster_selection(stage_id, selected)
	if not problem.is_empty():
		var roster: RosterScreen = shell.current as RosterScreen
		if roster != null:
			roster.show_error(problem)
		return
	_start_battle(stage_id, selected)


# -- battle -------------------------------------------------------------------------------------------


func _stage_title(stage_id: String) -> String:
	var stage: ContentModels.Stage = flow.stage(stage_id)
	return "%s  %s" % [stage_id, stage.title_en] if stage != null else stage_id


## Opens the server attempt and prepares its frozen encounter on a worker.
## Combat runs live; completion is reported after actual play.
func _start_battle(stage_id: String, roster: Variant) -> void:
	_battle_stage = stage_id
	_battle_roster = roster
	var battle: BattleScreen = BattleScreen.new()
	battle.configure_progress(flow.state.story_state, flow.registry)
	battle.show_loading(_stage_title(stage_id))
	shell.show_screen(battle)
	Audio.play_flow_cue(AudioCues.FLOW_BATTLE_DEFAULT)
	var opened: Outcome = await flow.begin_stage(stage_id, roster)
	if shell.current != battle:
		return
	if not opened.is_ok():
		push_warning("Stage %s could not start: %s" % [stage_id, opened.error])
		_present_defeat(stage_id, roster, BATTLE_ERROR_TITLE, _problem_text(opened))
		return
	_battle_job = flow.start_battle(stage_id, roster, int(flow.attempt["run_seed"]),true)
	set_process(true)


func _on_battle_finished(result: BattleService.BattleResult) -> void:
	if not result.error.is_empty():
		_handle_battle_outcome(_battle_stage,_battle_roster,await flow.complete_battle(result))
		return
	var battle: BattleScreen = shell.current as BattleScreen
	if battle == null: return
	var stage_id: String = _battle_stage
	var roster: Variant = _battle_roster
	var live: BattleScreen.LivePlayback = BattleScreen.LivePlayback.new()
	live.begin(result,flow.registry)
	var scene: Dictionary = flow.story_index.pre_battle_scene(stage_id)
	battle.finished.connect(func() -> void:
		battle._continue_button.disabled = true
		var outcome: GameFlow.StageOutcome = await flow.complete_battle(result)
		if shell.current != battle: return
		if outcome.error_kind == GameBackend.KIND_OFFLINE and flow.unreported != null:
			_present_unreported_victory(stage_id,roster)
		elif not outcome.error.is_empty():
			_present_defeat(stage_id,roster,BATTLE_ERROR_TITLE,outcome.error)
		else: _finish_stage(stage_id,outcome,roster),CONNECT_ONE_SHOT)
	battle.play(live,_stage_title(stage_id),str(scene.get("location_id","")))


func _handle_battle_outcome(stage_id: String, roster: Variant, outcome: GameFlow.StageOutcome) -> void:
	if outcome.error_kind == GameBackend.KIND_OFFLINE and flow.unreported != null:
		_present_unreported_victory(stage_id, roster)
		return
	if not outcome.error.is_empty():
		push_warning("Battle %s failed: %s" % [stage_id, outcome.error])
		_present_defeat(stage_id, roster, BATTLE_ERROR_TITLE, BATTLE_ERROR_MESSAGE % stage_id)
		return
	var battle: BattleScreen = shell.current as BattleScreen
	if battle == null:
		return
	battle.finished.connect(func() -> void: _finish_stage(stage_id, outcome, roster), CONNECT_ONE_SHOT)
	var scene: Dictionary = flow.story_index.pre_battle_scene(stage_id)
	battle.play(BattlePlayback.create(outcome.battle, flow.registry), _stage_title(stage_id), str(scene.get("location_id", "")))


## The victory's report got no reply: it may have been saved. Trying again resends the same report (never paid twice); leaving keeps the
## attempt open on the server, and the next start offers to resume it.
func _present_unreported_victory(stage_id: String, roster: Variant) -> void:
	var screen: MessageScreen = _show_message("Victory not confirmed",
		"The connection dropped while %s was being saved. The result is kept: try again to confirm it." % _stage_title(stage_id), [
		{"id": "retry", "label": "Try again"}, {"id": "hub", "label": "Back to the menu"}] as Array[Dictionary])
	screen.chosen.connect(func(action_id: String) -> void:
		if action_id == "retry":
			var battle: BattleScreen = BattleScreen.new()
			battle.configure_progress(flow.state.story_state, flow.registry)
			battle.show_loading(_stage_title(stage_id))
			shell.show_screen(battle)
			_handle_battle_outcome(stage_id, roster, await flow.report_again())
		else:
			_present_hub(), CONNECT_ONE_SHOT)


## INF-014: the server holds a battle that was started but never reported (the app closed or lost its connection). Resuming plays the same
## battle again from the inputs the server froze; giving up costs nothing.
func _present_unfinished_battle() -> void:
	var open: Dictionary = flow.open_attempt()
	var screen: MessageScreen = _show_message("Unfinished battle",
		"%s was started but its result was never saved. Resume it to finish the battle, or give it up." % _stage_title(String(open["stage_id"])), [
		{"id": "resume", "label": "Resume"}, {"id": "give_up", "label": "Give up"}] as Array[Dictionary])
	screen.chosen.connect(func(action_id: String) -> void:
		if action_id == "resume" and flow.resume_open_attempt():
			_battle_stage = String(flow.attempt["stage_id"])
			_battle_roster = flow.attempt["roster"]
			var battle: BattleScreen = BattleScreen.new()
			battle.configure_progress(flow.state.story_state, flow.registry)
			battle.show_loading(_stage_title(_battle_stage))
			shell.show_screen(battle)
			_battle_job = flow.start_battle(_battle_stage, _battle_roster, int(flow.attempt["run_seed"]),true)
			set_process(true)
		else:
			await flow.abandon_open_attempt()
			_present_hub(), CONNECT_ONE_SHOT)


func _finish_stage(stage_id: String, outcome: GameFlow.StageOutcome, roster: Variant) -> void:
	if not outcome.is_victory():
		_present_defeat(stage_id, roster)
		return
	Audio.play_flow_cue(AudioCues.FLOW_VICTORY)
	# Back to the hub after every cleared stage, so the player can level up and re-gear with what it granted before continuing.
	var post: Dictionary = flow.story_index.post_battle_scene(stage_id)
	if post.is_empty():
		_present_hub()
	else:
		_present_vn(post, _present_hub)


## A defeat reports nothing, so every option is safe to offer.
func _present_defeat(stage_id: String, roster: Variant, title: String = "", message: String = "") -> void:
	var can_change: bool = flow.needs_roster_selection(stage_id)
	var defeat: DefeatScreen = DefeatScreen.new()
	defeat.load_result(stage_id, can_change, title, message)
	defeat.retry.connect(func() -> void: _start_battle(stage_id, roster))
	defeat.change_party.connect(func() -> void: _present_roster(stage_id, roster))
	defeat.retreat.connect(func() -> void: _present_stage(stage_id))
	shell.show_screen(defeat)
	Audio.play_flow_cue(AudioCues.FLOW_DEFEAT)


# -- team, skills, inventory, settings ------------------------------------------------------------------


func _name_of(character_id: String) -> String:
	var character: ContentModels.Character = flow.registry.characters.get(character_id)
	return character.name_en if character != null else character_id


## The line a failed server call shows: the rule that refused it, the lost connection, or a generic one for anything unexpected (the detail
## goes to the log).
func _problem_text(outcome: Outcome) -> String:
	if outcome.error_kind in [Outcome.PROGRESSION, Outcome.EQUIPMENT, GameBackend.KIND_OFFLINE, GameBackend.KIND_INSUFFICIENT_FUNDS]:
		return outcome.error
	push_warning("Service call failed (%s): %s" % [outcome.error_kind, outcome.error])
	return GENERIC_PROBLEM


func _present_team(selected: String = "", status: String = "") -> void:
	var team: TeamScreen = TeamScreen.new()
	team.load_team(flow.team(), flow.xp_items(), "Silver Crowns %d" % int(flow.wallet().get("silver_crowns", 0)), selected, status)
	team.use_item.connect(_level_up)
	team.skills_requested.connect(func(character_id: String) -> void: _present_skills(character_id))
	team.memory_requested.connect(_unlock_memory_node)
	team.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(team)


func _level_up(character_id: String, item_id: String) -> void:
	var result: Outcome = await flow.level_up(character_id, item_id)
	var status: String
	if not result.is_ok():
		status = _problem_text(result)
	else:
		var gained: Dictionary = result.value
		status = "%s: +%d XP" % [_name_of(character_id), int(gained["xp_gained"])]
		if int(gained["level_after"]) > int(gained["level_before"]):
			status += ", Lv %d -> %d" % [int(gained["level_before"]), int(gained["level_after"])]
		var reason: Variant = gained["stopped_reason"]
		if reason != null and _STOP_REASONS.has(reason):
			status += ". " + str(_STOP_REASONS[reason])
	_present_team(character_id, status)


func _unlock_memory_node(character_id: String) -> void:
	var result: Outcome = await flow.unlock_memory_node(character_id)
	var status: String
	if result.is_ok():
		var unlocked: Dictionary = result.value
		status = "Memory Node %d unlocked (%d Shards left)" % [int(unlocked["node"]), int(unlocked["shards_remaining"])]
	else:
		status = _problem_text(result)
	_present_team(character_id, status)


func _present_skills(character_id: String, status: String = "", selected: String = "") -> void:
	var skills: SkillsScreen = SkillsScreen.new()
	skills.load_skills("%s - Skills" % _name_of(character_id), flow.skill_rows(character_id), selected, status)
	skills.upgrade_requested.connect(func(skill_id: String) -> void: _upgrade_skill(character_id, skill_id))
	skills.back_requested.connect(func() -> void: _present_team(character_id))
	shell.show_screen(skills)


func _upgrade_skill(character_id: String, skill_id: String) -> void:
	var result: Outcome = await flow.upgrade_skill(character_id, skill_id)
	var status: String
	if result.is_ok():
		var raised: Dictionary = result.value
		status = "Rank %d -> %d" % [int(raised["rank_before"]), int(raised["rank_after"])]
	else:
		status = _problem_text(result)
	_present_skills(character_id, status, skill_id)


func _present_inventory(selected: String = "", status: String = "") -> void:
	var targets: Array[Dictionary] = []
	for member: GameViews.TeamMember in flow.team():
		targets.append({"id": member.character_id, "name": member.name_en})
	var inventory: InventoryScreen = InventoryScreen.new()
	inventory.load_inventory(flow.inventory(), targets, selected, status)
	inventory.action_requested.connect(_inventory_action)
	inventory.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(inventory)


func _inventory_action(action: String, entry: GameViews.InventoryEntry, target_id: String) -> void:
	var selected: String = entry.instance_id
	var status: String = ""
	var result: Outcome = null
	match action:
		"equip":
			result = await flow.equip(entry.table, entry.instance_id, target_id)
			status = "Equipped %s." % entry.name_en
		"unequip":
			result = await flow.unequip(entry.table, entry.instance_id)
			status = "Unequipped %s." % entry.name_en
		"toggle_lock":
			result = await flow.set_locked(entry.table, entry.instance_id, not entry.locked)
			status = "%s %s." % ["Unlocked" if entry.locked else "Locked", entry.name_en]
		"dismantle":
			result = await flow.dismantle_weapon(entry.instance_id)
			if result.is_ok():
				var parts: PackedStringArray = PackedStringArray()
				var granted: Dictionary = (result.value as Dictionary)["granted"]
				for item_id: String in granted:
					parts.append("+%d %s" % [int(granted[item_id]), flow.item_name(item_id)])
				status = "Dismantled: " + ", ".join(parts)
				selected = ""
		"level_up":
			result = await flow.level_up_equipment(entry.table, entry.instance_id)
			if result.is_ok():
				var leveled: Dictionary = result.value
				if int(leveled["level_after"]) == int(leveled["level_before"]):
					status = "%s: +%d XP stored" % [entry.name_en, int(leveled["xp_spent"])]
				else:
					status = "%s: Lv %d -> %d" % [entry.name_en, int(leveled["level_before"]), int(leveled["level_after"])]
				var reason: Variant = leveled["stopped_reason"]
				if reason != null and _EQUIPMENT_STOP_REASONS.has(reason):
					status += ". " + str(_EQUIPMENT_STOP_REASONS[reason])
		"reroll":
			result = await flow.reroll_accessory(entry.instance_id)
			status = "Rerolled %s." % entry.name_en
	if result != null and not result.is_ok():
		status = _problem_text(result)
	_present_inventory(selected, status)


## The banners come from the server on every visit (pity and odds change with each pull).
func _present_gacha(selected: String = "", results_text: String = "", status: String = "") -> void:
	var listed: Outcome = await flow.gacha_banners()
	if not listed.is_ok():
		_present_hub(_problem_text(listed))
		return
	var gacha: GachaScreen = GachaScreen.new()
	var banners: Array[GameViews.BannerView] = []
	banners.assign(listed.value)
	gacha.load_gacha(banners, int(flow.wallet().get("fate_threads", 0)), selected, results_text, status)
	gacha.set_exchange(int(flow.wallet().get("eclipse_tokens", 0)), flow.fate_thread_token_cost())
	gacha.exchange_requested.connect(func(count: int) -> void: _exchange(gacha, count))
	gacha.pull_requested.connect(func(banner_id: String, count: int, target_id: String) -> void: _pull(gacha, banner_id, count, target_id))
	gacha.history_requested.connect(func() -> void: _present_gacha_history(0, selected))
	gacha.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(gacha)
	Audio.play_flow_cue(AudioCues.FLOW_SUMMON)


func _pull(screen: GachaScreen, banner_id: String, count: int, target_id: String) -> void:
	screen.set_busy(true)
	var result: Outcome = await flow.gacha_pull(banner_id, count, target_id)
	if not result.is_ok():
		_present_gacha(banner_id, "", _problem_text(result))
		return
	_present_gacha(banner_id, pull_results_text(flow.pull_entries(result.value)))


func _exchange(screen: GachaScreen, count: int) -> void:
	screen.set_busy(true)
	var selected: String = screen.selected
	var result: Outcome = await flow.convert_fate_threads(count)
	if not result.is_ok():
		_present_gacha(selected, "", _problem_text(result))
		return
	var converted: Dictionary = result.value
	_present_gacha(selected, "", "Exchanged %d Eclipse Tokens for %d Fate's Thread." % [int(converted.get("eclipse_tokens_spent", 0)), int(converted.get("fate_threads_gained", 0))])


## One line per pull, in the order the server resolved them: "5★ Name  NEW", "4★ Name  duplicate (+10 Memory Shards)".
static func pull_results_text(entries: Array[GameViews.PullEntry]) -> String:
	var lines: PackedStringArray = PackedStringArray()
	for entry: GameViews.PullEntry in entries:
		var line: String = "%d★ %s" % [entry.rarity, entry.name_en]
		if entry.featured:
			line += "  featured"
		if entry.is_new:
			line += "  NEW"
		elif entry.duplicate:
			line += ("  duplicate (+%d Memory Shards)" % entry.memory_shards) if entry.memory_shards > 0 else "  duplicate"
		lines.append(line)
	return "\n".join(lines)


func _present_gacha_history(before: int, selected: String) -> void:
	var page: Outcome = await flow.gacha_history(before)
	if not page.is_ok():
		_present_gacha(selected, "", _problem_text(page))
		return
	var lines: Array = (page.value as Dictionary)["lines"]
	var cursor: int = int((page.value as Dictionary)["next_cursor"])
	var actions: Array[Dictionary] = []
	if cursor > 0:
		actions.append({"id": "older", "label": "Older"})
	actions.append({"id": "back", "label": "Back"})
	var screen: MessageScreen = _show_message("Pull history", "\n".join(lines) if not lines.is_empty() else "No pulls yet.", actions)
	screen.chosen.connect(func(action_id: String) -> void:
		if action_id == "older":
			_present_gacha_history(cursor, selected)
		else:
			_present_gacha(selected), CONNECT_ONE_SHOT)


func _present_quests(selected: String = "", status: String = "") -> void:
	var listed: Outcome = await flow.quest_rows()
	if not listed.is_ok():
		_present_hub(_problem_text(listed))
		return
	var rows: Array[GameViews.QuestRow] = []
	rows.assign(listed.value)
	var quests: QuestsScreen = QuestsScreen.new()
	quests.load_quests(rows, selected, status)
	quests.claim_requested.connect(func(kind: String, task_id: String, period: String) -> void: _claim_quest(quests, kind, task_id, period))
	quests.back_requested.connect(func() -> void: _present_hub())
	quests.ad_requested.connect(func() -> void: _watch_ad(quests))
	shell.show_screen(quests)
	_offer_ad(quests)


func _claim_quest(screen: QuestsScreen, kind: String, task_id: String, period: String) -> void:
	screen.set_busy(true)
	var selected: String = screen.selected
	var result: Outcome = await flow.claim_quest(kind, task_id, period)
	var status: String
	if result.is_ok():
		var claimed: Dictionary = result.value
		var granted: Dictionary = claimed.get("granted", {}) if claimed.get("granted") is Dictionary else {}
		status = ("Already claimed: " if claimed.get("already_claimed") == true else "Claimed: ") + GameFlow.reward_text(granted)
	else:
		status = _problem_text(result)
	_present_quests(selected, status)


# -- the Eclipse Blessing and rewarded ads (INF-036) ------------------------------------------------------------------


func _monetization() -> Monetization:
	if monetization == null or monetization._flow != flow:
		monetization = Monetization.new(Native, flow, str(flow.blessing_rules().get("id", "")))
	return monetization


func _present_blessing(status: String = "") -> void:
	_show_message("Eclipse Blessing", "Loading...")
	var view: Outcome = await _monetization().blessing()
	if not view.is_ok():
		_present_hub("The Eclipse Blessing could not be loaded: %s" % _problem_text(view))
		return
	var can_buy: bool = Native.is_available()
	var price: String = await _monetization().blessing_price() if can_buy else ""
	var screen: BlessingScreen = BlessingScreen.new()
	screen.load_blessing(view.value, flow.blessing_rules(), price, can_buy, status)
	screen.claim_requested.connect(func() -> void: _blessing_action(screen, "claim"))
	screen.buy_requested.connect(func() -> void: _blessing_action(screen, "buy"))
	screen.restore_requested.connect(func() -> void: _blessing_action(screen, "restore"))
	screen.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(screen)


func _blessing_action(screen: BlessingScreen, action: String) -> void:
	screen.set_busy(true)
	var done: Outcome
	match action:
		"claim":
			done = await _monetization().claim_blessing()
		"buy":
			done = await _monetization().buy_blessing(Online.account_id)
		_:
			done = await _monetization().restore_blessing()
	if shell.current != screen:
		return
	_present_blessing(blessing_result_text(action, done))


## What a Blessing action did, in the player's words.
static func blessing_result_text(action: String, done: Outcome) -> String:
	if not done.is_ok():
		return done.error
	var value: Dictionary = done.value
	if action == "claim":
		return "Claimed %d reward(s): +%d Eclipse Tokens." % [int(value.get("windows", 0)), int(value.get("eclipse_tokens", 0))]
	if bool(value.get("pending", false)):
		return "Google Play is still processing the payment; the Blessing starts when it completes."
	var instant: int = int(value.get("instant_eclipse_tokens", 0))
	return "Eclipse Blessing active: +%d Eclipse Tokens." % instant if instant > 0 else "Eclipse Blessing restored."


## Shows the ad button on the quests screen when the server says an ad would pay now.
func _offer_ad(screen: QuestsScreen) -> void:
	if not Native.is_available():
		return
	var status: Outcome = await _monetization().ad_status()
	if shell.current != screen or not status.is_ok():
		return
	if status.value.get("ad_unit_id") is String:
		screen.set_ad(ad_button_text(status.value), Monetization.ad_open(status.value))


static func ad_button_text(counts: Dictionary) -> String:
	return "Watch an ad (+%d)  %d/%d" % [int(counts.get("reward_eclipse_tokens", 0)), int(counts.get("window_views", 0)), int(counts.get("window_cap", 0))]


func _watch_ad(screen: QuestsScreen) -> void:
	screen.set_busy(true)
	var watched: Outcome = await _monetization().watch_ad(Online.account_id)
	if shell.current != screen:
		return
	var text: String = watched.error
	if watched.is_ok():
		var value: Dictionary = watched.value
		if not bool(value.get("rewarded", false)):
			text = "The ad was closed before its end: no reward."
		elif value.get("paid") == true:
			text = "+%d Eclipse Tokens." % int(value.get("eclipse_tokens", 0))
		else:
			text = "Thanks for watching: the reward arrives as soon as Google confirms the ad."
	_present_quests(screen.selected, text)


# -- friends (INF-037) ---------------------------------------------------------------------------------------------

const _FRIEND_DONE: Dictionary = {"add": "Friend request sent.", "accept": "Friend added.", "reject": "Request declined.",
	"cancel": "Request cancelled.", "remove": "Friend removed.", "block": "Player blocked.", "report": "Report sent. Thank you."}


## Everything comes from the server on every visit (requests arrive while the screen is closed).
func _present_friends(selected: String = "", status: String = "") -> void:
	_show_message("Friends", "Loading...")
	var overview: Outcome = await flow.friends_overview()
	if not overview.is_ok():
		_present_hub("Friends could not be loaded: %s" % _problem_text(overview))
		return
	var screen: FriendsScreen = FriendsScreen.new()
	screen.load_friends(overview.value, selected, status)
	screen.action_requested.connect(func(action: String, account_id: String, argument: String) -> void: _friend_action(screen, overview.value, action, account_id, argument))
	screen.rename_requested.connect(func(nickname: String) -> void: _change_profile(screen, {"nickname": nickname}, "Name changed."))
	screen.presence_changed.connect(func(show_presence: bool) -> void:
		_change_profile(screen, {"presence_opt_in": show_presence}, "Friends see when you are online." if show_presence else "Your online status is hidden."))
	screen.blocked_requested.connect(func() -> void: _present_blocked())
	screen.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(screen)


func _friend_action(screen: FriendsScreen, view: GameViews.FriendsView, action: String, account_id: String, argument: String) -> void:
	var row: GameViews.FriendRow = null
	for candidate: GameViews.FriendRow in view.rows:
		if candidate.account_id == account_id:
			row = candidate
	if row == null and action != "add":
		return
	screen.set_busy(true)
	var done: Outcome = await flow.friend_action(action, row, argument)
	if shell.current != screen:
		return
	if not done.is_ok():
		_present_friends(account_id, _friend_problem(done))
		return
	var text: String = str(_FRIEND_DONE.get(action, ""))
	if action == "add" and done.value is Dictionary and str((done.value as Dictionary).get("relationship", "")) == "accepted":
		text = "You are now friends: they had asked you first."
	_present_friends("" if action in ["remove", "block", "reject", "cancel"] else account_id, text)


func _change_profile(screen: FriendsScreen, changes: Dictionary, done_text: String) -> void:
	screen.set_busy(true)
	var done: Outcome = await flow.update_profile(changes)
	if shell.current != screen:
		return
	_present_friends(screen.selected, done_text if done.is_ok() else _friend_problem(done))


## The server's words for a refused social action (they say what to do); the generic line for anything else.
func _friend_problem(outcome: Outcome) -> String:
	if outcome.error_kind in ["not_found", "forbidden", "limit_reached", "nickname_taken", "rate_limited", "invalid_request"]:
		return outcome.error
	return _problem_text(outcome)


func _present_blocked(status: String = "") -> void:
	_show_message("Blocked players", "Loading...")
	var listed: Outcome = await flow.blocked_players()
	if not listed.is_ok():
		_present_friends("", "Blocked players could not be loaded: %s" % _problem_text(listed))
		return
	var screen: BlockedScreen = BlockedScreen.new()
	screen.load_blocked(listed.value, status)
	screen.unblock_requested.connect(func(account_id: String) -> void:
		var done: Outcome = await flow.unblock_player(account_id)
		if shell.current == screen:
			_present_blocked("Unblocked." if done.is_ok() else _friend_problem(done)))
	screen.back_requested.connect(func() -> void: _present_friends())
	shell.show_screen(screen)


# -- mail and notices (INF-035) -------------------------------------------------------------------------------------


func _present_mailbox(status: String = "") -> void:
	_show_message("Mail", "Loading...")
	var loaded: Outcome = await flow.mailbox()
	if not loaded.is_ok():
		_present_hub("Mail could not be loaded: %s" % _problem_text(loaded))
		return
	var screen: MailboxScreen = MailboxScreen.new()
	screen.load_mailbox((loaded.value as Dictionary)["notices"], (loaded.value as Dictionary)["mail"], status)
	screen.claim_requested.connect(func(mail_id: String) -> void: _claim_mail(screen, mail_id))
	screen.back_requested.connect(func() -> void: _present_hub())
	shell.show_screen(screen)


func _claim_mail(screen: MailboxScreen, mail_id: String) -> void:
	screen.set_busy(true)
	var claimed: Outcome = await flow.claim_mail(mail_id)
	if shell.current != screen:
		return
	_present_mailbox(mail_claim_text(flow, claimed))


## The line the mailbox shows after a claim: what was paid, or why nothing was.
static func mail_claim_text(game: GameFlow, claimed: Outcome) -> String:
	if claimed.is_ok():
		var granted: Variant = (claimed.value as Dictionary).get("granted")
		return "Received: %s." % game.mail_reward_text(granted if granted is Dictionary else {})
	if claimed.error_kind == "conflict":
		return "This mail was already claimed."
	if claimed.error_kind == "not_found":
		return "This mail has expired."
	return claimed.error


func _claim_inn_meal() -> void:
	var result: Outcome = await flow.claim_inn_meal()
	if not result.is_ok():
		_present_hub(_problem_text(result))
		return
	var granted: int = int((result.value as Dictionary).get("ration_granted", 0))
	_present_hub("The inn serves a hot meal: +%d Ration." % granted if granted > 0 else "Today's meal is already eaten.")


## `ad_privacy`: Google's consent applies here, so "Ad privacy choices" is offered (checked after the screen shows).
func _present_settings(status: String = "", ad_privacy: bool = false) -> void:
	var version: Dictionary = Engine.get_version_info()
	var info: String = "Unaware of My Demise  (Godot %s, build %d)" % [str(version.get("string", "")), ClientRelease.version_code()]
	var actions: Array[Dictionary] = []
	if Online.server_url().is_empty():
		info += "\nNo game server is configured in this build."
	elif Online.has_session():
		info += "\nSigned in with Google  (account …%s)" % Online.account_id.right(6)
		actions = [{"id": SETTINGS_SIGN_OUT, "label": "Sign out"}, {"id": SETTINGS_DELETE_ACCOUNT, "label": "Delete account"}]
	info += "\nSupport: %s" % SUPPORT_EMAIL
	actions.append({"id": SETTINGS_CONTACT_SUPPORT, "label": "Contact support"})
	actions.append({"id": SETTINGS_LICENSES, "label": "Licenses"})
	if ad_privacy:
		actions.append({"id": SETTINGS_AD_PRIVACY, "label": "Ad privacy choices"})
	var settings: SettingsScreen = SettingsScreen.new()
	settings.load_settings(info, status, actions)
	var volumes: Dictionary = {}
	for bus: String in Audio.BUSES:
		volumes[bus] = Audio.volume(bus)
	settings.load_volumes(volumes)
	settings.volume_changed.connect(func(bus: String, linear: float) -> void: Audio.set_volume(bus, linear))
	settings.back_requested.connect(func() -> void: _present_hub())
	settings.action_requested.connect(func(action_id: String) -> void:
		if action_id == SETTINGS_SIGN_OUT:
			_sign_out()
		elif action_id == SETTINGS_DELETE_ACCOUNT:
			_confirm_account_deletion()
		elif action_id == SETTINGS_CONTACT_SUPPORT:
			OS.shell_open(support_mail_uri())
		elif action_id == SETTINGS_LICENSES:
			_present_licenses()
		elif action_id == SETTINGS_AD_PRIVACY:
			_show_ad_privacy_choices())
	shell.show_screen(settings)
	if not ad_privacy and flow != null and Native.is_available():
		_offer_ad_privacy_choices(settings, status)


## Adds "Ad privacy choices" to the open Settings when Google's consent applies to this player (the EU user consent
## policy requires a way to change or withdraw it at any time).
func _offer_ad_privacy_choices(settings: SettingsScreen, status: String) -> void:
	if await _monetization().privacy_options_required() and shell.current == settings:
		_present_settings(status, true)


func _show_ad_privacy_choices() -> void:
	var shown: Outcome = await _monetization().show_privacy_options()
	_present_settings("Your ad privacy choices were saved." if shown.is_ok() else shown.error, true)


func _present_licenses() -> void:
	var screen: LicensesScreen = LicensesScreen.new()
	screen.load_text(ThirdPartyNotices.text())
	screen.back_requested.connect(func() -> void: _present_settings())
	shell.show_screen(screen)


## A mailto link to support with the build and the account id filled in, so a report can be traced.
static func support_mail_uri() -> String:
	var body: String = "Build: %d" % ClientRelease.version_code()
	if Online.has_session():
		# The random account id (not a secret: it signs nothing in); the admin panel finds the player by it.
		body += "\nAccount: %s" % Online.account_id
	return "mailto:%s?subject=%s&body=%s" % [SUPPORT_EMAIL, "Unaware of My Demise support".uri_encode(), body.uri_encode()]


## INF-019: ends the session here and on the server; the next start shows the account chooser again.
func _sign_out() -> void:
	_show_message("Signing out", "...")
	await Online.log_out()
	_present_signed_out("Signed out", "You are signed out of this device.")


## INF-020: deletion is permanent, so it is confirmed twice: here, and by choosing the Google account again.
func _confirm_account_deletion() -> void:
	var screen: MessageScreen = _show_message("Delete your account?",
		"This permanently deletes your account and all its progress, heroes, items and currencies. It cannot be undone.\n" +
		"You will be asked to confirm with your Google account.", [
		{"id": "delete", "label": "Delete permanently"}, {"id": "cancel", "label": "Cancel"}] as Array[Dictionary])
	screen.chosen.connect(func(action_id: String) -> void:
		if action_id != "delete":
			_present_settings()
			return
		_show_message("Deleting your account", "...")
		var deleted: Outcome = await Online.delete_account()
		if deleted.is_ok():
			_present_signed_out("Account deleted", "Your account and all its data were deleted.")
		else:
			_present_settings("The account was not deleted: %s" % deleted.error), CONNECT_ONE_SHOT)


## After a sign-out or a deletion: nothing of the old session is kept; "Sign in" starts over (account chooser).
func _present_signed_out(title: String, message: String) -> void:
	Game.flow = null
	flow = null
	var screen: MessageScreen = _show_message(title, message, [{"id": "sign_in", "label": "Sign in"}] as Array[Dictionary])
	screen.chosen.connect(func(_action_id: String) -> void: start(true), CONNECT_ONE_SHOT)

# -- helpers ------------------------------------------------------------------------------------------


func _show_message(title: String, message: String, actions: Array[Dictionary] = [], presentation_state: String = "") -> MessageScreen:
	var screen: MessageScreen = MessageScreen.new()
	screen.load_message(title, message, actions, "loading" if presentation_state.is_empty() and actions.is_empty() else presentation_state)
	shell.show_screen(screen)
	return screen
