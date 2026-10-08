class_name EntryScreen
extends UiScreen
## Entry presentation only. The director supplies verified phase/session facts and owns every command.
signal action_requested(action_id: String)
signal utility_requested(utility_id: String)
const PHASES: Array[String] = ["checking", "update_available", "downloading", "verifying", "installing", "snapshot_sync", "ready"]
const CAPTIONS: Array[String] = ["Client check", "Game content", "Saved progress"]
const QUOTE_SECONDS: float = 10.0
const Masthead = preload("res://scripts/ui/entry/entry_masthead.gd")
const Prologue = preload("res://scripts/ui/entry/entry_prologue.gd")
const Onboarding = preload("res://scripts/ui/entry/entry_onboarding.gd")
var phase: String = "sign_in"
var session_present: bool = false
var busy: bool = false
var primary: Button
var heading: Label
var message: Label
var session_label: Label
var _header: Label
var _logo: TextureRect
var _logo_space: Control
var _opening_quote: Label
var _action_space: Control
var _mark: Label
var _steps: VBoxContainer
var _sign_out: Button
var _action_id: String = ""
var _overlay: EntryUtility = null
var _modal: GothicModal = null
var _patch_modal: GothicModal = null
var _backdrop: EntryBackdrop
var _panel: PanelContainer
var _help_button: Button
var _settings_button: Button
var _base_controls: Array[Control] = []
var _utility_previous_focus: WeakRef = null
var _footer: HBoxContainer
var _prompt_tween: Tween = null
var _download: VBoxContainer
var _progress: ProgressBar
var _progress_label: Label
var _download_quote: Label
var _quote_timer: Timer
var _quote_tween: Tween = null
var _quotes: EntryQuotes = null
var _received_bytes: int = 0
var _total_bytes: int = 0
var _prologue: Prologue = null
var _onboarding: Onboarding = null
var _prologue_seen_path: String = ""

func _ready() -> void:
	super._ready()
	if heading.text.is_empty(): present(phase, session_present)
	_refresh_download()
	_configure_focus()
	_focus_default()

func _build(column: VBoxContainer) -> void:
	var backdrop: EntryBackdrop = EntryBackdrop.new()
	_backdrop = backdrop
	add_child(backdrop)
	move_child(backdrop, 1)
	var titles: VBoxContainer = UiKit.column(Masthead.SEPARATION)
	titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_header = UiKit.label(tr("Unaware of My Demise"), UiTheme.SMALL)
	_header.hide()
	_logo = Masthead.logo()
	_logo_space = UiKit.spacer(Masthead.TOP_SPACE, false)
	titles.add_child(_logo_space)
	titles.add_child(_logo)
	_opening_quote = UiKit.label("Some bells ring for the living\nOthers... for the forgotten", "EntryQuote")
	_opening_quote.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_opening_quote.mouse_filter = Control.MOUSE_FILTER_IGNORE
	titles.add_child(_opening_quote)
	titles.add_child(_header)
	session_label = UiKit.label("", UiTheme.SMALL)
	session_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	titles.add_child(session_label)
	column.add_child(titles)
	var list: VBoxContainer = UiKit.scroll_column(column, 24)
	list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	list.alignment = BoxContainer.ALIGNMENT_CENTER
	list.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var content: VBoxContainer = UiKit.column(32)
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	heading = UiKit.label("", "EntryHeading")
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(heading)
	message = UiKit.label("", "EntryStatus")
	message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(message)
	_mark = UiKit.label("", UiTheme.TITLE, false)
	_mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_mark.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_mark.custom_minimum_size.y = 180
	_mark.add_theme_font_size_override("font_size", 96)
	content.add_child(_mark)
	_steps = UiKit.column(18)
	content.add_child(_steps)
	for caption: String in CAPTIONS:
		var step: Label = UiKit.label(tr(caption), UiTheme.SMALL)
		step.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_steps.add_child(step)
	_download = UiKit.column(24)
	content.add_child(_download)
	_progress = ProgressBar.new()
	_progress.theme_type_variation = "EntryProgress"
	BattleHudStyle.health(_progress,false)
	_progress.custom_minimum_size.y = 28
	_progress.show_percentage = false
	_progress.step = 0.0
	_progress.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_download.add_child(_progress)
	_progress_label = UiKit.label("", UiTheme.SMALL)
	_progress_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_download.add_child(_progress_label)
	_download_quote = UiKit.label("", "EntryQuote")
	_download_quote.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_download_quote.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_download_quote.custom_minimum_size.y = 160
	_download.add_child(_download_quote)
	_quote_timer = Timer.new()
	_quote_timer.wait_time = QUOTE_SECONDS
	_quote_timer.timeout.connect(_rotate_quote)
	add_child(_quote_timer)
	content.add_child(UiKit.spacer(16, false))
	primary = UiKit.button("", false, UiTheme.PRIMARY)
	primary.pressed.connect(func() -> void:
		if not busy and not _action_id.is_empty():
			action_requested.emit(_action_id))
	content.add_child(primary)
	_panel = UiKit.card(content, UiTheme.STANDARD_PANEL)
	var clear_panel: StyleBoxEmpty = StyleBoxEmpty.new()
	clear_panel.set_content_margin_all(36)
	_panel.add_theme_stylebox_override("panel", clear_panel)
	_panel.custom_minimum_size.y = 380
	list.add_child(_panel)
	# Balance the taller masthead so the main touch target stays near screen centre.
	_action_space = UiKit.spacer(192, false)
	list.add_child(_action_space)
	var footer: HBoxContainer = UiKit.row(24)
	_footer = footer
	var help: Button = UiKit.button(tr("Help"), false, "QuietButton")
	help.pressed.connect(func() -> void: utility_requested.emit("help"))
	footer.add_child(help)
	_help_button = help
	_sign_out = UiKit.button(tr("Logout"), false, "QuietButton")
	_sign_out.pressed.connect(func() -> void:
		if session_present and not busy and _footer.visible: utility_requested.emit("sign_out"))
	footer.add_child(_sign_out)
	var settings: Button = UiKit.button(tr("Settings"), false, "QuietButton")
	_settings_button = settings
	settings.pressed.connect(func() -> void: utility_requested.emit("settings"))
	footer.add_child(settings)
	column.add_child(footer)
	_base_controls.assign([primary, help, _sign_out, settings])

func _uses_ambient_backdrop() -> bool:
	# Entry already draws its full-screen illustration and atmosphere.
	return false

func present(next_phase: String, has_session: bool, detail: String = "") -> void:
	ensure_built()
	var old_page: String = _page_kind(phase)
	var page_changed: bool = old_page != _page_kind(next_phase)
	var previous: Control = UiPageTransition.visual_copy(self) if page_changed and is_inside_tree() and not UiPageTransition.reduced_for(self) else null
	phase = next_phase
	if phase not in ["checking", "downloading", "verifying", "installing"]:
		_close_prologue()
	if phase != "update_available" and _patch_modal != null and _patch_modal.visible:
		_patch_modal._close()
	session_present = has_session
	busy = phase in ["checking", "signing_in", "downloading", "verifying", "installing", "snapshot_sync", "signing_out", "restart_required", "complete"]
	var copy: Dictionary = {
		"sign_in": ["", "", "SIGN IN", "sign_in"],
		"signing_in": ["", tr("Signing in…"), "", ""],
		"login_error": ["", tr("Failed to login"), tr("Retry"), "sign_in"],
		"checking": [tr("Checking…"), tr("Checking available game content."), "", ""],
		"update_available": [tr("Update available"), tr("Review the update to continue."), tr("Review Update"), "review_update"],
		"downloading": [tr("Downloading…"), tr("Keep the game open while the update downloads."), "", ""],
		"verifying": [tr("Verifying…"), tr("Checking the downloaded files."), "", ""],
		"installing": [tr("Installing…"), tr("Applying the verified update."), "", ""],
		"snapshot_sync": [tr("Syncing your account…"), tr("Loading your saved progress."), "", ""],
		"ready": ["", "", tr("Tap to fulfill your destiny"), "begin"],
		"offline": [tr("You are offline"), tr("Check your connection and try again."), tr("Retry"), "retry"],
		"error": [tr("Unable to continue"), tr("Please try again."), tr("Retry"), "retry"],
		"client_update": [tr("Update required"), tr("Install the latest app version to continue."), tr("Open Store"), "store"],
		"restart_required": [tr("Update installed"), tr("Restarting…"), "", ""],
		"patch_complete": [tr("The road is ready"), tr("All game content has been verified and installed. Restart to enter the game."), tr("Restart & Enter Game"), "restart"],
		"restart_error": [tr("Update installed"), tr("Restart is available in the Android or desktop build."), tr("Restart"), "restart"],
		"complete": [tr("Loading game…"), "", "", ""],
		"signing_out": [tr("Signing out…"), "", "", ""],
	}
	var lines: Array = copy.get(phase, copy["error"])
	heading.text = lines[0]
	message.text = detail if not detail.is_empty() else lines[1]
	heading.visible = not heading.text.is_empty()
	message.visible = not message.text.is_empty()
	primary.text = lines[2]
	_action_id = lines[3]
	primary.visible = not _action_id.is_empty()
	primary.disabled = busy
	primary.theme_type_variation = "EntrySignInButton" if phase == "sign_in" else ("TitlePromptButton" if phase == "ready" else UiTheme.PRIMARY)
	primary.icon = null
	primary.size_flags_horizontal = Control.SIZE_EXPAND_FILL if phase == "ready" else Control.SIZE_SHRINK_CENTER
	primary.custom_minimum_size.x = 640 if phase == "sign_in" else (0 if phase == "ready" else 480)
	primary.expand_icon = true
	var account_view: bool = phase in ["sign_in", "signing_in", "login_error", "ready", "signing_out"]
	_logo.custom_minimum_size.y = Masthead.HEIGHT
	_logo_space.custom_minimum_size.y = Masthead.TOP_SPACE
	_opening_quote.visible = phase == "sign_in"
	_action_space.visible = account_view
	_header.text = tr("Unaware of My Demise") if account_view else tr("Content Update")
	session_label.text = ""
	session_label.hide()
	_footer.visible = account_view
	_panel.custom_minimum_size.y = 380 if account_view else 720
	if account_view:
		_panel.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	else:
		var patch_panel: StyleBoxFlat = BattleHudStyle.frame(Color("#b48072"),0.93,48)
		_panel.add_theme_stylebox_override("panel", patch_panel)
	_sign_out.visible = has_session and account_view
	_sign_out.disabled = busy
	_backdrop.account_view = account_view
	_steps.visible = not account_view and phase in ["checking", "update_available", "verifying", "installing", "snapshot_sync", "complete"]
	_refresh_download()
	if is_instance_valid(_prologue) and _prologue.visible:
		_prologue.set_status(message.text)
	_mark.visible = false
	_mark.text = ""
	_mark.custom_minimum_size.y = 180
	var stage: int = 0 if phase == "checking" else (2 if phase == "snapshot_sync" else (3 if phase == "complete" else 1))
	for index: int in _steps.get_child_count():
		var step: Label = _steps.get_child(index) as Label
		var active: bool = index == stage
		var completed: bool = index < stage
		step.text = ("◆  " if active else ("●  " if completed else "○  ")) + tr(CAPTIONS[index])
		step.add_theme_color_override("font_color", Color("#e2606c") if active else (UiTheme.TEXT if completed else UiTheme.TEXT_DIM))
		step.modulate.a = 1.0
	if is_inside_tree():
		# Only a page boundary gets a curtain. A status change never covers or moves the controls.
		if page_changed:
			close_utility()
			UiPageTransition.reveal(self, UiPageTransition.PAGE_SECONDS, previous)
		_refresh_prompt()
		_configure_focus()
		if not is_instance_valid(_overlay) and (_modal == null or not _modal.visible):
			_focus_default()

static func _page_kind(value: String) -> String:
	if value in ["sign_in", "signing_in", "login_error", "signing_out"]: return "account"
	return "gateway" if value == "ready" else "patch"

func _refresh_prompt() -> void:
	if _prompt_tween != null and _prompt_tween.is_valid():
		_prompt_tween.kill()
	primary.modulate.a = 1.0
	if phase != "ready" or UiPageTransition.reduced_for(self):
		return
	_prompt_tween = create_tween().set_loops()
	_prompt_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_prompt_tween.tween_property(primary, "modulate:a", 0.40, 1.4)
	_prompt_tween.tween_property(primary, "modulate:a", 1.0, 1.4)


func set_download_progress(received: int, total: int) -> void:
	ensure_built()
	_total_bytes = maxi(0, total)
	_received_bytes = clampi(received, 0, _total_bytes)
	_progress.value = 100.0 * _received_bytes / _total_bytes if _total_bytes > 0 else 0.0
	_progress_label.text = "%d%%  ·  %s / %s" % [floori(_progress.value), format_bytes(_received_bytes), format_bytes(_total_bytes)] if _total_bytes > 0 else "Waiting for download…"
	if is_instance_valid(_prologue): _prologue.set_transfer(_received_bytes, _total_bytes)
	if is_instance_valid(_onboarding): _onboarding.set_transfer(_received_bytes, _total_bytes)

func start_onboarding(registry: ContentModels.ContentRegistry, account: String, preferences: String) -> void:
	if is_instance_valid(_onboarding): return
	_onboarding = Onboarding.new()
	add_child(_onboarding)
	_onboarding.finished.connect(close_onboarding, CONNECT_ONE_SHOT)
	body.hide()
	_backdrop.hide()
	_quote_timer.stop()
	for control: Control in _base_controls: control.focus_mode = Control.FOCUS_NONE
	_onboarding.start(registry,account,preferences)
	_onboarding.set_transfer(_received_bytes,_total_bytes)

func wait_for_onboarding() -> void:
	if is_instance_valid(_prologue) and _prologue.visible and not _prologue.continue_selected:
		await _prologue.dismissed
	if is_instance_valid(_onboarding) and not _onboarding.completed:
		await _onboarding.finished

func close_onboarding() -> void:
	if not is_instance_valid(_onboarding): return
	var previous: Control = UiPageTransition.visual_copy(_onboarding) if is_inside_tree() and not UiPageTransition.reduced_for(self) else null
	remove_child(_onboarding)
	_onboarding.queue_free()
	_onboarding = null
	body.show()
	_backdrop.show()
	_refresh_download()
	if previous != null: UiPageTransition.reveal(self, 2.4, previous)

func start_prologue(seen_path: String = Prologue.SEEN_PATH) -> void:
	if not is_inside_tree(): return
	_prologue_seen_path = seen_path
	if not is_instance_valid(_prologue):
		_prologue = Prologue.new()
		add_child(_prologue)
		_prologue.finished.connect(_on_prologue_finished)
		_prologue.dismissed.connect(_close_prologue)
		_prologue.scene_presented.connect(_on_prologue_line)
		_prologue.ending_started.connect(func(seconds: float) -> void: Audio.stop_music(seconds))
	_prologue.reduced_motion = UiPageTransition.reduced_for(self)
	_prologue.set_transfer(_received_bytes, _total_bytes)
	_prologue.set_status(message.text)
	_prologue.play()
	if not _prologue.error.is_empty():
		_close_prologue()
		return
	body.hide()
	_backdrop.hide()
	_quote_timer.stop()
	for control: Control in _base_controls: control.focus_mode = Control.FOCUS_NONE
	UiPageTransition.reveal(_prologue, UiPageTransition.PAGE_SECONDS)

func _on_prologue_finished(_skipped: bool) -> void:
	Audio.stop_voice()
	if not _prologue_seen_path.is_empty():
		var saved: Error = Prologue.mark_seen(_prologue_seen_path)
		if saved != OK: push_warning("The opening story viewing preference could not be saved: " + error_string(saved))

func _on_prologue_line(line_id: String, _cue: String) -> void:
	# Approved local recordings only; generation belongs to editor authoring.
	if Audio.play_voice("narrator", line_id):
		_prologue.narration_duration_seconds = Audio.voice_duration_seconds()

func wait_for_prologue() -> void:
	if is_instance_valid(_prologue) and _prologue.visible and not _prologue.continue_selected:
		_prologue.set_status("Update installed")
		await _prologue.dismissed

func _close_prologue() -> void:
	if not is_instance_valid(_prologue): return
	Audio.stop_voice()
	_prologue.abort()
	body.show()
	_backdrop.show()
	_refresh_download()
	_configure_focus()
	_focus_default()


func _refresh_download() -> void:
	_download.visible = phase == "downloading"
	if is_instance_valid(_prologue) and _prologue.visible:
		_quote_timer.stop()
		return
	if phase != "downloading":
		_quote_timer.stop()
		if _quote_tween != null and _quote_tween.is_valid(): _quote_tween.kill()
		_download_quote.modulate.a = 1.0
		return
	set_download_progress(_received_bytes, _total_bytes)
	if _quote_timer.is_stopped():
		if _quotes == null: _quotes = EntryQuotes.new()
		_download_quote.text = _quotes.next()
		_download_quote.modulate.a = 1.0
		if is_inside_tree(): _quote_timer.start()


func _rotate_quote() -> void:
	if phase != "downloading" or _quotes == null: return
	if _quote_tween != null and _quote_tween.is_valid(): _quote_tween.kill()
	var next_quote: String = _quotes.next()
	if UiPageTransition.reduced_for(self):
		_download_quote.text = next_quote
		_download_quote.modulate.a = 1.0
		return
	_quote_tween = create_tween()
	_quote_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_quote_tween.tween_property(_download_quote, "modulate:a", 0.0, 0.4)
	_quote_tween.tween_callback(func() -> void: _download_quote.text = next_quote)
	_quote_tween.tween_property(_download_quote, "modulate:a", 1.0, 0.5)

func close_utility() -> void:
	if is_instance_valid(_overlay):
		_overlay.hide()
		_overlay.queue_free()
		_overlay = null
	_utility_previous_focus = null

func _wire_focus(controls: Array[Control]) -> void:
	var available: Array[Control] = []
	for control: Control in controls:
		var enabled: bool = control.is_visible_in_tree() and not (control is BaseButton and (control as BaseButton).disabled)
		control.focus_mode = Control.FOCUS_ALL if enabled else Control.FOCUS_NONE
		if enabled:
			available.append(control)
	for index: int in available.size():
		var current: Control = available[index]
		var next: Control = available[(index + 1) % available.size()]
		var previous: Control = available[(index + available.size() - 1) % available.size()]
		current.focus_next = current.get_path_to(next)
		current.focus_previous = current.get_path_to(previous)
		current.focus_neighbor_bottom = current.get_path_to(next)
		current.focus_neighbor_top = current.get_path_to(previous)

func _configure_focus() -> void:
	_wire_focus(_base_controls)
	if is_instance_valid(_overlay) or (_patch_modal != null and _patch_modal.visible) or (is_instance_valid(_prologue) and _prologue.visible):
		for control: Control in _base_controls:
			control.focus_mode = Control.FOCUS_NONE

func _focus_default() -> void:
	if not is_inside_tree() or is_instance_valid(_overlay) or (_patch_modal != null and _patch_modal.visible) or (is_instance_valid(_prologue) and _prologue.visible):
		return
	var focus: Control = get_viewport().gui_get_focus_owner()
	if focus != null and is_ancestor_of(focus) and focus.is_visible_in_tree() and focus.focus_mode != Control.FOCUS_NONE:
		return
	if primary.visible and not primary.disabled:
		primary.grab_focus()
	elif _help_button.is_visible_in_tree():
		_help_button.grab_focus()

func open_utility(page: EntryUtility) -> void:
	if not _footer.visible:
		page.queue_free()
		return
	var outgoing: Control = UiPageTransition.visual_copy(self) if not UiPageTransition.reduced_for(self) else null
	if not is_instance_valid(_overlay):
		var focus: Control = get_viewport().gui_get_focus_owner()
		_utility_previous_focus = weakref(focus) if focus != null else null
	if is_instance_valid(_overlay):
		_overlay.queue_free()
	_overlay = page
	add_child(page)
	UiPageTransition.reveal(page, UiPageTransition.UTILITY_SECONDS, outgoing)
	_configure_focus()
	page.focus_targets_changed.connect(_refresh_utility_focus.bind(page))
	_refresh_utility_focus(page)
	var controls: Array[Control] = _utility_controls(page)
	if not controls.is_empty():
		controls[0].grab_focus()
	page.closed.connect(func() -> void:
		var closing: Control = UiPageTransition.visual_copy(self) if not UiPageTransition.reduced_for(self) else null
		_overlay = null
		page.hide()
		page.queue_free()
		UiPageTransition.reveal(self, UiPageTransition.UTILITY_SECONDS, closing)
		_configure_focus()
		var previous: Control = _utility_previous_focus.get_ref() as Control if _utility_previous_focus != null else null
		_utility_previous_focus = null
		if is_instance_valid(previous) and previous.is_visible_in_tree() and previous.focus_mode != Control.FOCUS_NONE:
			previous.grab_focus()
		else:
			_focus_default())

func _utility_controls(page: EntryUtility) -> Array[Control]:
	var controls: Array[Control] = []
	for node: Node in page.find_children("*", "Control", true, false):
		var control: Control = node as Control
		if not control.has_meta("ui_focus_capable"):
			control.set_meta("ui_focus_capable", control.focus_mode != Control.FOCUS_NONE)
		if bool(control.get_meta("ui_focus_capable")):
			controls.append(control)
	return controls

func _refresh_utility_focus(page: EntryUtility) -> void:
	var controls: Array[Control] = _utility_controls(page)
	_wire_focus(controls)

func confirm_sign_out() -> void:
	if not session_present or busy or not _footer.visible:
		return
	if _modal == null:
		_modal = GothicModal.new()
		add_child(_modal)
		_modal.confirmed.connect(func() -> void:
			if session_present and not busy:
				action_requested.emit("sign_out"))
	_modal.open(tr("Sign out?"), tr("Your progress is saved to your Google account. You will need to sign in again on this device."), tr("Sign Out"), true)

func handle_back() -> bool:
	if is_instance_valid(_onboarding): return true
	if is_instance_valid(_prologue) and _prologue.visible:
		_prologue.reveal_skip()
		return true
	if _patch_modal != null and _patch_modal.handle_back():
		return true
	if _modal != null and _modal.handle_back():
		return true
	if is_instance_valid(_overlay):
		return _overlay.handle_back()
	return busy


static func format_bytes(bytes: int) -> String:
	if bytes < 1024: return "%d B" % bytes
	if bytes < 1048576: return "%.1f KiB" % (bytes / 1024.0)
	if bytes < 1073741824: return "%.1f MiB" % (bytes / 1048576.0)
	return "%.2f GiB" % (bytes / 1073741824.0)


func confirm_content_update(update: Dictionary) -> void:
	if phase != "update_available" or busy or int(update.get("total_bytes", 0)) <= 0: return
	if _patch_modal == null:
		_patch_modal = GothicModal.new()
		add_child(_patch_modal)
		_patch_modal.confirmed.connect(func() -> void:
			_configure_focus()
			if phase == "update_available" and not busy: action_requested.emit("download"))
		_patch_modal.canceled.connect(func() -> void:
			_configure_focus()
			_focus_default())
	var pack_bytes: int = int(update["total_bytes"])
	var remaining: int = int(update.get("remaining_bytes", pack_bytes))
	var text: String = "A game content update is available.\n\nUpdate size: %s (%s bytes)\nDownload remaining: %s\n\nDownload and install this update to continue. The game will restart when it is ready." % [format_bytes(pack_bytes), String.num_int64(pack_bytes), format_bytes(remaining)]
	_patch_modal.open("Content Update", text, "Download" if remaining > 0 else "Install")
	_configure_focus()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and handle_back():
		get_viewport().set_input_as_handled()
