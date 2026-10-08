extends Control
## Local, interactive review of real runtime Controls. Excluded from all player exports.
## godot --path game res://scenes/art_review/production_ui_preview.tscn -- --ui-page=components
const PAGES: Array[String] = ["components", "surfaces", "states", "controls", "entry", "hub", "formation", "battle", "results"]
const ENTRY_PHASES: Array[String] = ["title", "sign_in", "offline", "update_available", "downloading", "prologue", "story_hours", "story_names", "story_ordinary_days", "story_throne_wars", "story_crownfall", "story_roads", "story_search", "story_reunion", "story_beginning", "verifying", "installing", "snapshot_sync", "ready", "restart_required"]
const STORY_BEATS: Dictionary = {"story_hours": 0.0, "story_names": 12.0, "story_ordinary_days": 26.0,
	"story_throne_wars": 38.0, "story_crownfall": 50.0, "story_roads": 66.0,
	"story_search": 82.0, "story_reunion": 96.0, "story_beginning": 108.0}
var _host: Control = null
var _page: String = "components"
var _capture_path: String = ""
var capture_exit_after: bool = true
var _text_scale: float = 1.0
var _picker: OptionButton = null
var _registry: ContentModels.ContentRegistry = null
var _modal_capture: bool = false
var _scroll_end: bool = false
var _entry_capture_phase: String = "title"
var _entry_only: bool = false
var _entry_capture_utility: String = ""


func _ready() -> void:
	get_window().title = "UOMD · Local UI Preview · Production v001"
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--ui-page="):
			_page = argument.trim_prefix("--ui-page=")
		if argument.begins_with("--ui-capture="):
			_capture_path = argument.trim_prefix("--ui-capture=")
		if argument == "--ui-large-text":
			_text_scale = 1.25
		if argument == "--ui-modal":
			_modal_capture = true
		if argument == "--ui-scroll=end":
			_scroll_end = true
		if argument.begins_with("--entry-phase="):
			_entry_capture_phase = argument.trim_prefix("--entry-phase=")
		if argument == "--entry-only":
			_entry_only = true
		if argument.begins_with("--entry-utility="):
			_entry_capture_utility = argument.trim_prefix("--entry-utility=")
		if argument == "--ui-save-theme":
			ResourceSaver.save(UiTheme.create(), "res://theme/uomd_production_v001.tres")
	if _entry_only:
		get_window().title = "UOMD · Local UI Preview · Entry"
	theme = UiTheme.create(_text_scale)
	var layout: VBoxContainer = UiKit.column(0)
	layout.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(layout)
	if _capture_path.is_empty():
		var toolbar: HBoxContainer = UiKit.row(12)
		layout.add_child(toolbar)
		_picker = OptionButton.new()
		_picker.custom_minimum_size.y = 100
		_picker.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if _entry_only:
			for phase: String in ENTRY_PHASES:
				_picker.add_item(phase.capitalize())
			_picker.item_selected.connect(func(index: int) -> void:
				_entry_capture_phase = ENTRY_PHASES[index]
				_show("entry"))
		else:
			for page: String in PAGES:
				_picker.add_item(page.capitalize())
			_picker.item_selected.connect(func(index: int) -> void: _show(PAGES[index]))
		toolbar.add_child(_picker)
		var large: Button = UiKit.button("Aa +", true, UiTheme.ICON)
		large.tooltip_text = "Large Text · 125%"
		large.button_pressed = _text_scale > 1.0
		large.custom_minimum_size = Vector2(180, 100)
		large.size_flags_horizontal = Control.SIZE_SHRINK_END
		large.toggled.connect(func(enabled: bool) -> void:
			_text_scale = 1.25 if enabled else 1.0
			theme = UiTheme.create(_text_scale)
			_show(_page))
		toolbar.add_child(large)
		var refresh: Button = UiKit.button("Refresh", false, UiTheme.ICON)
		refresh.custom_minimum_size = Vector2(220, 100)
		refresh.size_flags_horizontal = Control.SIZE_SHRINK_END
		refresh.tooltip_text = "Refresh the current preview · F5"
		refresh.pressed.connect(refresh_preview)
		toolbar.add_child(refresh)
		layout.add_child(UiKit.label("LOCAL PREVIEW · sample data · no account / server requests", UiTheme.SMALL))
	_host = Control.new()
	_host.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_host.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	layout.add_child(_host)
	_show(_page)
	if _modal_capture:
		var modal: GothicModal = GothicModal.new()
		add_child(modal)
		modal.open("Leave this session?", "This is a local component preview. Your game progress is unchanged. Long English copy remains readable when Large Text is enabled.", "Sign out", true)
	if not _capture_path.is_empty():
		_capture.call_deferred()

func refresh_preview() -> void:
	# Scripts are reloaded through the editor bridge; this rebuilds controls and theme without replacing the window.
	theme = UiTheme.create(_text_scale)
	_show(_page)

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and (event as InputEventKey).pressed and not (event as InputEventKey).echo \
			and (event as InputEventKey).keycode == KEY_F5:
		get_viewport().set_input_as_handled()
		refresh_preview()


func _show(page: String) -> void:
	var outgoing: Control = null
	if _entry_only and _host.get_child_count() > 0 and not UiPageTransition.reduced_for(_host):
		outgoing = UiPageTransition.visual_copy(_host.get_child(0) as Control)
	_page = page if PAGES.has(page) else "components"
	UiKit.clear(_host)
	if _picker != null and not _entry_only:
		_picker.select(PAGES.find(_page))
	elif _picker != null:
		for index: int in _picker.item_count:
			if _picker.get_item_text(index) == _entry_capture_phase.capitalize():
				_picker.select(index)
				break
	match _page:
		"components", "surfaces": _gallery()
		"states": _states()
		"controls": _controls()
		"entry": _entry()
		"hub": _hub()
		"formation": _formation()
		"battle": _battle()
		"results": _results()
	if outgoing != null and _host.get_child_count() > 0:
		UiPageTransition.reveal(_host.get_child(0) as Control, UiPageTransition.PAGE_SECONDS, outgoing)


func _gallery() -> void:
	var screen: UiScreen = UiScreen.new()
	_host.add_child(screen)
	screen.body.add_child(UiKit.label("Component Kit" if _page == "components" else "Surfaces", UiTheme.TITLE))
	screen.body.add_child(UiKit.label("PRODUCTION v001 · actual Godot Controls", UiTheme.SMALL))
	var list: VBoxContainer = UiKit.scroll_column(screen.body, 24)
	if _page == "components":
		for pair: Array in [["Primary", UiTheme.PRIMARY], ["Secondary", UiTheme.SECONDARY], ["Destructive", UiTheme.DESTRUCTIVE]]:
			list.add_child(UiKit.label(pair[0].to_upper(), UiTheme.SMALL))
			var row: HBoxContainer = UiKit.row(16)
			list.add_child(row)
			for state: String in ["Default", "Pressed", "Disabled"]:
				var button: Button = UiKit.button(state, state == "Pressed", pair[1])
				button.button_pressed = state == "Pressed"
				button.disabled = state == "Disabled"
				row.add_child(button)
		list.add_child(UiKit.label("FEEDBACK · copy + icon + surface", UiTheme.SMALL))
		var feedback: HBoxContainer = UiKit.row()
		list.add_child(feedback)
		feedback.add_child(UiKit.icon_button("checked", "Confirmed", UiTheme.SUCCESS))
		feedback.add_child(UiKit.icon_button("help", "Try again", UiTheme.ERROR))
		var busy: GothicActionButton = UiKit.button("Continue", false, UiTheme.PRIMARY) as GothicActionButton
		busy.set_busy(true, "Preparing…")
		list.add_child(busy)
		var long_copy: Button = UiKit.button("Long English copy wraps, and the touch target grows with Large Text", false, UiTheme.SECONDARY)
		list.add_child(long_copy)
		var modal: GothicModal = GothicModal.new()
		screen.add_child(modal)
		var open: Button = UiKit.button("Open confirmation", false, UiTheme.PRIMARY)
		open.pressed.connect(func() -> void: modal.open("Leave this session?", "This is a local component preview. Your game progress is unchanged.", "Sign out", true))
		list.add_child(open)
	else:
		for pair: Array in [["Standard", UiTheme.STANDARD_PANEL], ["Hero", UiTheme.HERO_PANEL], ["Modal", UiTheme.MODAL_PANEL], ["Sheet", UiTheme.SHEET_PANEL]]:
			var content: VBoxContainer = UiKit.column(12)
			content.add_child(UiKit.label(pair[0], UiTheme.TITLE))
			content.add_child(UiKit.label("Text remains a Control. Corners retain their shape as this surface grows.", UiTheme.DIM))
			list.add_child(UiKit.card(content, pair[1]))
		var card_scene: PackedScene = load("res://scenes/ui/common/card.tscn") as PackedScene
		var companion: PanelContainer = card_scene.instantiate() as PanelContainer
		companion.theme = null  # inherit the preview's text scale
		companion.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		(companion.get_node("Content/Title") as Label).text = "Companion card"
		(companion.get_node("Content/Details") as VBoxContainer).add_child(UiKit.label("Portrait slot", UiTheme.SMALL))
		list.add_child(companion)
		list.add_child(UiKit.badge("Pending"))
		var nav: UiBottomNav = UiBottomNav.new()
		nav.select_route("shelter")
		nav.set_available(["shelter", "journey", "companions", "summon", "records"])
		nav.route_requested.connect(func(id: String) -> void: nav.select_route(id))
		list.add_child(nav)


func _states() -> void:
	var screen: UiScreen = UiScreen.new()
	_host.add_child(screen)
	screen.body.add_child(UiKit.label("Shared UI States", UiTheme.TITLE))
	var list: VBoxContainer = UiKit.scroll_column(screen.body, 24)
	for pair: Array in [
		["loading", "Loading…", "Preparing the screen.", "", ""],
		["empty", "No items yet", "Your collection will appear here.", "", ""],
		["locked", "Locked", "Complete the required stage to unlock.", "Continue", "continue"],
		["disabled", "Unavailable", "This action is currently unavailable.", "Continue", "continue"],
		["error", "Something went wrong", "Please try again.", "Retry", "retry"],
		["offline", "You are offline", "Check your connection.", "Retry", "retry"],
		["insufficient_resource", "Not enough resources", "Review the required resources before continuing.", "Go to obtain", "obtain"],
		["pending", "Processing…", "Please wait for confirmation.", "Submit", "submit"],
		["confirmed", "Confirmed", "Display only the result verified by the runtime.", "Continue", "continue"],
	]:
		var state_view: UiStateView = UiStateView.new()
		state_view.present(pair[0], pair[1], pair[2], pair[3], pair[4])
		state_view.action_requested.connect(func(_id: String) -> void: state_view.present("confirmed", "Preview confirmed", "No request was sent."))
		list.add_child(state_view)


func _controls() -> void:
	var screen: UiScreen = UiScreen.new()
	_host.add_child(screen)
	screen.body.add_child(UiKit.label("Controls", UiTheme.TITLE))
	var list: VBoxContainer = UiKit.scroll_column(screen.body, 24)
	list.add_child(UiKit.label("Tabs", UiTheme.SMALL))
	list.add_child(UiKit.tabs(["All", "Owned", "Locked"]))
	list.add_child(UiKit.label("Search / input", UiTheme.SMALL))
	list.add_child(UiKit.input("Search companions"))
	list.add_child(UiKit.label("Toggle / slider", UiTheme.SMALL))
	var toggle: CheckBox = CheckBox.new()
	toggle.text = "Reduced Motion · static kit"
	toggle.custom_minimum_size.y = UiTheme.TOUCH_HEIGHT
	list.add_child(toggle)
	var slider: HSlider = HSlider.new()
	slider.custom_minimum_size.y = UiTheme.TOUCH_HEIGHT
	slider.value = 60
	list.add_child(slider)
	var progress: ProgressBar = ProgressBar.new()
	progress.value = 60
	progress.custom_minimum_size.y = 48
	list.add_child(progress)
	list.add_child(UiKit.badge("Owned"))
	var help: Button = UiKit.icon_button("help", "Help")
	help.tooltip_text = "Tooltip remains runtime text"
	list.add_child(help)


func _entry() -> void:
	if _entry_capture_phase != "title":
		_entry_preview(_entry_capture_phase)
		return
	var title: TitleScreen = TitleScreen.new()
	title.load_title("build %d · local preview" % ClientRelease.version_code())
	title.set_ready(true)
	title.start_requested.connect(func() -> void:
		_entry_capture_phase = "sign_in"
		_show("entry"))
	title.support_requested.connect(func() -> void:
		var modal: GothicModal = GothicModal.new()
		title.add_child(modal)
		modal.open("Support", "Local UI preview. No support request is sent.", "Close")
		modal.confirmed.connect(modal.queue_free)
		modal.canceled.connect(modal.queue_free))
	_host.add_child(title)


func _entry_preview(phase: String) -> void:
	var entry: EntryScreen = EntryScreen.new()
	_present_entry_preview(entry, phase, phase not in ["sign_in", "signing_in", "login_error", "offline", "error"])
	_host.add_child(entry)
	# Deterministic review fixtures, never used by the production director.
	if phase in ["downloading", "prologue"] or STORY_BEATS.has(phase): entry.set_download_progress(5242880, 20971520)
	if phase == "prologue" or STORY_BEATS.has(phase):
		entry.start_prologue("")
		if STORY_BEATS.has(phase): entry._prologue.advance(float(STORY_BEATS[phase]))
	if phase == "update_available": entry.confirm_content_update({"total_bytes": 20971520, "remaining_bytes": 20971520})
	entry.action_requested.connect(_entry_preview_action.bind(entry))
	entry.utility_requested.connect(_entry_preview_utility.bind(entry))
	if not _entry_capture_utility.is_empty():
		_entry_preview_utility(_entry_capture_utility, entry)


func _entry_preview_utility(id: String, entry: EntryScreen) -> void:
	if id == "sign_out":
		entry.confirm_sign_out()
		return
	var utility: EntryUtility = EntryUtility.new()
	utility.page = id
	utility.text_scale = _text_scale
	utility.frame_rate_changed.connect(func(value: int) -> void: FrameRatePolicy.apply(value))
	utility.motion_changed.connect(func(value: bool) -> void:
		utility.reduced_motion = value
		entry.set_meta("ui_reduced_motion", value)
		if value: UiPageTransition.finish_under(entry)
		entry._refresh_prompt())
	utility.volumes = {"Music": 1.0, "Voice": 1.0, "SFX": 1.0}
	utility.support_submitted.connect(func(_payload: Dictionary) -> void:
		utility.support_result(Outcome.ok({"reference": "LOCAL PREVIEW · no message sent"})))
	utility.page_requested.connect(_entry_preview_utility.bind(entry))
	utility.text_scale_changed.connect(func(value: float) -> void:
		_text_scale = value
		theme = UiTheme.create(value))
	entry.open_utility(utility)


func _present_entry_preview(entry: EntryScreen, phase: String, signed_in: bool) -> void:
	_entry_capture_phase = phase
	entry.present("downloading" if phase == "prologue" or STORY_BEATS.has(phase) else phase, signed_in)
	if _entry_only and _picker != null:
		for index: int in _picker.item_count:
			if _picker.get_item_text(index) == phase.capitalize():
				_picker.select(index)
				break


func _entry_preview_action(id: String, entry: EntryScreen) -> void:
	match id:
		"sign_in": _present_entry_preview(entry, "ready", true)
		"begin", "retry":
			_present_entry_preview(entry, "checking", true)
			await get_tree().create_timer(1.0).timeout
			if not is_instance_valid(entry) or not entry.is_inside_tree(): return
			_present_entry_preview(entry, "update_available", true)
			entry.confirm_content_update({"total_bytes": 20971520, "remaining_bytes": 20971520})
		"review_update":
			entry.confirm_content_update({"total_bytes": 20971520, "remaining_bytes": 20971520})
		"download":
			_present_entry_preview(entry, "downloading", true)
			entry.start_prologue("")
			for received: int in [0, 5242880, 10485760, 15728640, 20971520]:
				entry.set_download_progress(received, 20971520)
				await get_tree().create_timer(3.0).timeout
				if not is_instance_valid(entry) or not entry.is_inside_tree(): return
			for next_phase: String in ["verifying", "installing", "snapshot_sync", "complete"]:
				if next_phase == "snapshot_sync": await entry.wait_for_prologue()
				_present_entry_preview(entry, next_phase, true)
				await get_tree().create_timer(0.8).timeout
				if not is_instance_valid(entry) or not entry.is_inside_tree(): return
		"enter":
			var modal: GothicModal = GothicModal.new()
			entry.add_child(modal)
			modal.open("Entry preview complete", "This preview ends here. No account or server request was made.", "Close")
			modal.confirmed.connect(modal.queue_free)
			modal.canceled.connect(modal.queue_free)
		"sign_out": _present_entry_preview(entry, "sign_in", false)


func _hub() -> void:
	var hub: HubScreen = HubScreen.new()
	hub.load_hub("Silver Crowns 1200   Eclipse Tokens 80\nFate's Threads 5   Ration 40", [
		{"id": "formation", "label": "Continue Story"}, {"id": "formation", "label": "Team"},
		{"id": "components", "label": "Inventory"}, {"id": "components", "label": "Summon"},
		{"id": "components", "label": "Quests"}, {"id": "components", "label": "Friends"},
		{"id": "components", "label": "Mail"}, {"id": "components", "label": "Eclipse Blessing"},
		{"id": "components", "label": "Settings"},
	] as Array[Dictionary], "Sample wallet · visual review only")
	hub.chosen.connect(_show)
	_host.add_child(hub)


func _formation() -> void:
	if _registry == null:
		_registry = ContentLoader.new().load_dir("res://data/content")
	var roster: RosterScreen = RosterScreen.new()
	var candidates: Array[GameFlow.RosterCandidate] = []
	for id: String in ["mahmut", "fadyme", "brin_alder", "kera_voss", "clem_marr"]:
		var character: ContentModels.Character = _registry.characters[id]
		var candidate: GameFlow.RosterCandidate = GameFlow.RosterCandidate.new()
		candidate.character_id = character.character_id
		candidate.name_en = character.name_en
		candidate.rarity = character.rarity
		candidate.element = character.element
		candidate.combat_role = character.combat_role
		candidate.class_id = character.class_id
		candidates.append(candidate)
	roster.load_stage("1-1", 5, candidates, [], ["mahmut", "fadyme"])
	roster.confirmed.connect(func(_selected: Array[String]) -> void: _show("battle"))
	_host.add_child(roster)


func _battle() -> void:
	if _registry == null:
		_registry = ContentLoader.new().load_dir("res://data/content")
	var records: Array[Dictionary] = []
	for pair: Array in [["mahmut", "front", 0], ["fadyme", "rear", 0]]:
		records.append({"entity_id": pair[0], "team": "player", "row": pair[1], "slot_index": pair[2], "level": 3, "hp": 80, "max_hp": 100})
	records.append({"entity_id": "preview:wolf", "enemy_id": "wolf", "team": "enemy", "row": "front", "slot_index": 0, "level": 2, "hp": 60, "max_hp": 60})
	var final_units: Array[Dictionary] = records.duplicate(true)
	var events: Array[Dictionary] = [{"type": "action_started", "actor_id": "mahmut", "round": 1, "skill_id": "basic_attack", "action_type": "basic"}]
	var playback: BattlePlayback = BattlePlayback.from_records(records, records, events, final_units, _registry, "victory", 3)
	var battle: BattleScreen = BattleScreen.new()
	_host.add_child(battle)
	battle.play(playback, "1-1 · preview battle")
	battle._timer.stop()
	battle.finished.connect(func() -> void: _show("results"))


func _results() -> void:
	var result: DefeatScreen = DefeatScreen.new()
	result.load_result("1-1", true)
	result.retry.connect(func() -> void: _show("battle"))
	result.change_party.connect(func() -> void: _show("formation"))
	result.retreat.connect(func() -> void: _show("hub"))
	_host.add_child(result)


func _capture() -> void:
	# Capture the settled scene; animated intermediate frames are reviewed separately in runtime.
	await get_tree().create_timer(UiPageTransition.PAGE_SECONDS + 0.1).timeout
	await get_tree().process_frame
	await get_tree().process_frame
	if _scroll_end:
		var scroll_root: Node = _host
		if not _entry_capture_utility.is_empty():
			for child: Node in _host.get_children():
				if child is EntryScreen and is_instance_valid((child as EntryScreen)._overlay):
					scroll_root = (child as EntryScreen)._overlay
		var scrolls: Array[Node] = scroll_root.find_children("*", "ScrollContainer", true, false)
		if not scrolls.is_empty():
			var scroll: ScrollContainer = scrolls[0] as ScrollContainer
			scroll.scroll_vertical = roundi(scroll.get_v_scroll_bar().max_value)
		await get_tree().process_frame
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	if not is_inside_tree():
		return
	var result: Error = get_viewport().get_texture().get_image().save_png(_capture_path)
	var controls: Array[Dictionary] = []
	for node: Node in _host.find_children("*", "BaseButton", true, false):
		var control: Control = node as Control
		controls.append({"text": node.get("text"), "rect": str(control.get_global_rect()), "visible": control.is_visible_in_tree(), "disabled": node.get("disabled")})
	var output: FileAccess = FileAccess.open(_capture_path + ".json", FileAccess.WRITE)
	output.store_string(JSON.stringify({"page": _page, "text_scale": _text_scale, "viewport": str(get_viewport().get_visible_rect()), "controls": controls, "account_requested": false}, "  ") + "\n")
	output.close()
	if not capture_exit_after:
		return
	# Standalone capture owns this sample flow and its Controls; release them before quitting.
	UiKit.clear(_host)
	await get_tree().process_frame
	_registry = null
	await get_tree().process_frame
	get_tree().quit(int(result))
