extends Node
## Development-only native rehearsal. Run through authenticated game_eval; no network.
const Review = preload("res://scripts/art_review/desktop_game_review.gd")
const Preview = preload("res://scripts/art_review/preview_session.gd")
var output_dir: String = ""
var report: Dictionary = {"status": "RUNNING", "checks": [], "captures": []}
var window: Window
var shell: AppShell

func _ready() -> void:
	call_deferred("_run")

func _frames(count: int = 5) -> void:
	for index: int in range(count): await get_tree().process_frame

func _check(condition: bool, label: String) -> void:
	report["checks"].append({"check": label, "pass": condition})
	_write_report()

func _write_report() -> void:
	var file: FileAccess = FileAccess.open(output_dir + "/runtime.json", FileAccess.WRITE)
	if file != null: file.store_string(JSON.stringify(report, "\t"))

func _capture(label: String) -> void:
	await _frames()
	await RenderingServer.frame_post_draw
	var path: String = output_dir + "/" + label + ".png"
	var code: Error = window.get_texture().get_image().save_png(path)
	report["captures"].append({"name": label, "path": path, "saved": code == OK, "native_size": [window.size.x, window.size.y], "logical_size": [window.content_scale_size.x, window.content_scale_size.y], "shell_size": str(shell.size), "screen_size": str(shell.current.size), "body_size": str(shell.current.body.size) if shell.current is UiScreen else ""})
	_write_report()

func _finish_reader(reader: VnScreen) -> void:
	for step: int in range(reader.line_count() * 2 + 2):
		if reader.get_parent() == null: break
		reader.go_next()

func _wait_for(test: Callable, seconds: float = 6.0) -> bool:
	var deadline: int = Time.get_ticks_msec() + int(seconds * 1000)
	while not test.call() and Time.get_ticks_msec() < deadline: await get_tree().process_frame
	return bool(test.call())

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(output_dir)
	window = Preview.open(get_tree())
	window.title = "UOMD · Full Game Design Review"
	for child: Node in window.get_children():
		window.remove_child(child)
		child.queue_free()
	await _frames()
	for file_name: String in ["onboarding.cfg", "prologue.cfg", "restart.cfg"]:
		DirAccess.remove_absolute("user://native_full_game_qa/" + file_name)
	shell = Review.new()
	shell.review_root = "user://native_full_game_qa"
	shell.review_account = "native-qa"
	shell.startup_intro_enabled = false
	shell.reduced_motion = true
	window.add_child(shell)
	# The rehearsal backend is in-memory; actual desktop launcher uses its own save.
	shell.backend = load("res://scripts/art_review/desktop_story_backend.gd").new(shell.flow)
	await _capture("01-title")
	(shell.current as TitleScreen).tap()
	_check(shell.current is EntryScreen, "title enters Entry")
	await _capture("02-entry")
	var entry: EntryScreen = shell.current as EntryScreen
	entry.primary.pressed.emit()
	var started: bool = await _wait_for(func() -> bool: return is_instance_valid(entry._prologue))
	_check(started, "opening prologue available")
	if started:
		await _capture("03-prologue")
		entry._prologue.advance(120.0)
		entry._prologue.request_continue()
		var opening: EntryScreen.Onboarding = entry._onboarding
		for index: int in range(3):
			await _capture("04-tutorial-%d-before" % index)
			_finish_reader(opening._host.get_child(0) as VnScreen)
			await _wait_for(func() -> bool: return opening._battle != null and opening._battle.playback != null)
			await _capture("05-tutorial-%d-battle" % index)
			opening._battle.advance_time(10000.0)
			opening._battle.advance_time(2.0)
			_check(opening._battle.playback.outcome == "victory", "opening tutorial %d victory" % index)
			opening._battle.press_continue()
			await _capture("06-tutorial-%d-after" % index)
			_finish_reader(opening._host.get_child(0) as VnScreen)
		_check(entry.phase == "patch_complete", "opening reaches verified completion")
		entry.primary.pressed.emit()
	await _wait_for(func() -> bool: return shell.current is HubScreen)
	await _capture("07-shelter")
	_check(shell.current is HubScreen, "restart enters complete game hub")
	(shell.current as HubScreen).press(StoryDirector.HUB_CONTINUE)
	await _capture("08-opening-letter")
	_check(shell.current is VnScreen, "Continue opens main story")
	if shell.current is VnScreen:
		_finish_reader(shell.current)
	await _frames()
	_finish_reader(shell.current as VnScreen)
	await _wait_for(func() -> bool: return shell.current is BattleScreen and (shell.current as BattleScreen).playback != null)
	if shell.current is BattleScreen:
		var battle: BattleScreen = shell.current
		battle.advance_time(2.0)
		await _capture("09-main-battle")
		_check(battle.playback is BattleScreen.LivePlayback, "main battle is actual live combat")
		battle.advance_time(1000.0)
		battle.advance_time(2.0)
		battle.press_continue()
		await _frames()
		if shell.current is VnScreen: shell.current.exit_requested.emit()
	# Review every authored VN wrapper; no progress mutations occur in these fixtures.
	var covered: int = 0
	for id: String in shell.flow.story_index.story_order:
		var scenes: Array[Dictionary] = []
		if shell.flow.is_stage(id):
			scenes.append(shell.flow.story_index.pre_battle_scene(id))
			scenes.append(shell.flow.story_index.post_battle_scene(id))
		else:
			scenes.append(shell.flow.story_index.narrative_scene(id))
		for scene: Dictionary in scenes:
			if scene.is_empty(): continue
			var reader: VnScreen = VnScreen.new()
			reader.audio_enabled = false
			var valid: bool = reader.load_scene(scene)
			_check(valid, "VN loads " + str(scene["scene_id"]))
			shell.show_screen(reader)
			reader.reveal_all()
			await _frames(2)
			covered += 1
			if id in ["3-3", "5-4", "7-5", "part1_emotional_confession", "part1_clockless_reveal"]:
				await _capture("story-" + str(scene["scene_id"]))
	report["authored_vn_wrappers"] = covered
	for screen_id: String in [StoryDirector.HUB_TEAM, StoryDirector.HUB_INVENTORY, StoryDirector.HUB_SETTINGS, StoryDirector.HUB_RECORDS]:
		shell.director._present_hub()
		(shell.current as HubScreen).press(screen_id)
		await _capture("menu-" + screen_id)
		_check(shell.current.handle_back(), "Back handles " + screen_id)
		_check(shell.current is HubScreen, "Back returns " + screen_id + " to Shelter")
	for viewport: Vector2i in [Vector2i(720, 1600), Vector2i(1080, 1920), Vector2i(1080, 2400)]:
		window.content_scale_size = viewport
		window.size = viewport / 2
		shell.text_scale = 1.25
		shell.theme = UiTheme.create(1.25)
		shell.director._present_hub()
		await _capture("large-shelter-%dx%d" % [viewport.x, viewport.y])
		var hub: HubScreen = shell.current as HubScreen
		var continue_action: Button = hub._buttons[StoryDirector.HUB_CONTINUE]
		_check(Rect2(Vector2.ZERO, hub.size).encloses(continue_action.get_global_rect()), "primary action stays inside " + str(viewport))
		var last_action: Button = hub._buttons[StoryDirector.HUB_DIAGNOSTICS]
		last_action.grab_focus()
		await _frames()
		var scroll: ScrollContainer = hub._menu.get_parent() as ScrollContainer
		_check(scroll.get_global_rect().encloses(last_action.get_global_rect()), "last action scrolls into view " + str(viewport))
		await _capture("large-shelter-scrolled-%dx%d" % [viewport.x, viewport.y])
		shell.director._present_settings()
		await _capture("large-settings-%dx%d" % [viewport.x, viewport.y])
		var settings: SettingsScreen = shell.current as SettingsScreen
		var motion_toggle: Button = settings._accessibility.get_child(2) as Button
		motion_toggle.grab_focus()
		await _frames()
		var settings_scroll: ScrollContainer = settings._accessibility.get_parent().get_parent() as ScrollContainer
		_check(settings_scroll.get_global_rect().encloses(motion_toggle.get_global_rect()), "accessibility scrolls into view " + str(viewport))
		await _capture("large-accessibility-%dx%d" % [viewport.x, viewport.y])
		shell.director._present_vn(shell.flow.story_index.pre_battle_scene("1-1"), shell.director._present_hub)
		(shell.current as VnScreen).reveal_all()
		await _capture("large-reader-%dx%d" % [viewport.x, viewport.y])
	window.content_scale_size = Vector2i(1080, 1920)
	window.size = Vector2i(540, 960)
	shell.text_scale = 1.0
	shell.theme = UiTheme.create()
	await _review_effects()
	shell.director._present_hub()
	report["status"] = "PASS"
	for check: Dictionary in report["checks"]:
		if not check["pass"]: report["status"] = "FAIL"
	_write_report()


func _review_effects() -> void:
	var screen: UiScreen = UiScreen.new()
	shell.reduced_motion = false
	shell.show_screen(screen)
	screen.body.add_child(UiKit.label("Fadyme · Runtime animation / VFX review", UiTheme.TITLE))
	var field: BattleField = BattleField.new()
	field.size_flags_vertical = Control.SIZE_EXPAND_FILL
	screen.body.add_child(field)
	var view: BattlePlayback.UnitView = BattlePlayback.UnitView.new()
	view.entity_id = "qa-fadyme"
	view.art_id = "fadyme"
	view.display_name = "Fadyme"
	view.team = "player"
	view.row = "front"
	view.hp = 100
	view.max_hp = 100
	field.populate([view] as Array[BattlePlayback.UnitView])
	await get_tree().create_timer(0.4).timeout
	var actor: BattleActor = field.actors[view.entity_id]
	_check(actor._locomotion != null and actor._locomotion.is_playing(), "drawn idle animation plays")
	await _capture("animation-idle")
	actor.animate("walk", 1.0, false)
	await get_tree().create_timer(0.2).timeout
	_check(actor._locomotion.animation == &"walk" and actor._locomotion.is_playing(), "drawn walk animation plays")
	await _capture("animation-walk")
	for reduced: bool in [false, true]:
		shell.reduced_motion = reduced
		actor.animate("idle", 1.0, false)
		if reduced:
			_check(not actor._locomotion.is_playing() and not actor._locomotion.visible, "Reduced Motion uses static character pose")
		for effect_name: String in ["veilglass_thorn", "borrowed_hour", "a_smile_kept", "bell_that_forgets", "ally_restore", "ally_cleanse"]:
			field._skill_effect(effect_name, field.size * Vector2(0.55, 0.45), 1.0)
			var effect: Node2D = field._effects.back()
			var material: ShaderMaterial = (effect.get_node("Visual") as Sprite2D).material as ShaderMaterial
			_check(bool(material.get_shader_parameter("reduced_motion")) == reduced, effect_name + " motion preference " + str(reduced))
			field.set_pace(0.1)
			_check(is_equal_approx((effect.get_node("AnimationPlayer") as AnimationPlayer).speed_scale, 0.1), effect_name + " follows cinematic slowdown")
			field.set_pace(1.0)
			await get_tree().create_timer(0.2).timeout
			await _capture("fx-" + effect_name + ("-reduced" if reduced else "-normal"))
			await get_tree().create_timer(1.5).timeout
			_check(not is_instance_valid(effect), effect_name + " cleans up " + str(reduced))
		await _capture("fx-cleared-" + str(reduced))
	shell.reduced_motion = true
