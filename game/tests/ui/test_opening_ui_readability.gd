extends GutTest
## Real container bounds and preference changes, independent of style values.
const Pilot = preload("res://scripts/art_review/fadyme_pilot.gd")
const Prologue = preload("res://scripts/ui/entry/entry_prologue.gd")

func _viewport(size: Vector2i) -> SubViewport:
	var viewport: SubViewport = SubViewport.new()
	viewport.size = size
	add_child_autofree(viewport)
	return viewport

func _reader(viewport: SubViewport) -> VnScreen:
	var reader: VnScreen = VnScreen.new()
	reader.theme = UiTheme.create()
	reader.audio_enabled = false
	viewport.add_child(reader)
	reader.load_scene({"lines":[{"speaker_id":"fadyme","text_en":"Hold still. The road can wait while we decide what comes next."},{"speaker_id":"mahmut","text_en":"For once, I agree."}]})
	reader.set_process(false)
	reader._auto_timer.stop()
	return reader

func _assert_inside(control: Control, viewport: SubViewport) -> void:
	var rect: Rect2 = control.get_global_rect()
	assert_gte(rect.position.x,0.0)
	assert_lte(rect.end.x,float(viewport.size.x)+1.0)
	assert_lte(rect.end.y,float(viewport.size.y)+1.0)

func test_compact_reader_controls_fit_and_large_text_reflows_after_theme_change() -> void:
	var viewport: SubViewport = _viewport(Vector2i(720,1600))
	var reader: VnScreen = _reader(viewport)
	await wait_process_frames(8)
	var before: int = reader._dialogue_label.get_theme_font_size("font_size")
	reader.theme = UiTheme.create(1.25)
	await wait_process_frames(8)
	assert_gt(reader._dialogue_label.get_theme_font_size("font_size"),before)
	for button: Button in [reader._back_button,reader._auto_button,reader._log_button,reader._next_button]:
		_assert_inside(button,viewport)
		assert_gte(button.size.y,96.0)
	_assert_inside(reader._dialogue_panel,viewport)

func test_compact_party_has_five_contained_touch_targets_including_empty_slots() -> void:
	var viewport: SubViewport = _viewport(Vector2i(720,1600))
	var battle: BattleScreen = BattleScreen.new()
	battle.theme = UiTheme.create(1.25)
	viewport.add_child(battle)
	battle.play(Pilot.sample_live(),"The First Step")
	battle._timer.stop()
	await wait_process_frames(8)
	assert_eq(battle._skill_tray.get_child_count(),5)
	for tile: Node in battle._skill_tray.get_children():
		var target: Button = tile.get("ultimate") as Button
		_assert_inside(target,viewport)
		assert_gte(target.size.x,96.0)
		assert_gte(target.size.y,96.0)
	_assert_inside(battle._controls,viewport)

func test_reduced_motion_changes_portrait_without_removing_the_speaker_pause() -> void:
	var reader: VnScreen = _reader(_viewport(Vector2i(1080,1920)))
	reader.set_meta("ui_reduced_motion",true)
	UiPageTransition.finish_under(reader)
	reader.reveal_all()
	reader.go_next()
	reader.advance_reader(0.01)
	assert_false(reader._outgoing_bust.visible)
	assert_eq(reader._bust.modulate.a,1.0)
	assert_eq(reader.visible_dialogue_text(),"")
	reader.advance_reader(1.1)
	assert_false(reader.visible_dialogue_text().is_empty())

func test_log_pauses_reader_and_android_back_restores_current_line() -> void:
	var reader: VnScreen = _reader(_viewport(Vector2i(1080,1920)))
	UiPageTransition.finish_under(reader)
	reader.advance_reader(0.1)
	var before: String = reader.visible_dialogue_text()
	reader.toggle_log()
	reader.advance_reader(30.0)
	reader._auto_tick()
	assert_eq(reader.visible_dialogue_text(),before)
	assert_eq(reader.line_index(),0)
	assert_true(reader.handle_back())
	assert_false(reader.is_log_open())
	assert_false(reader._log_button.button_pressed)

func test_compact_prologue_completion_keeps_both_actions_inside_the_screen() -> void:
	var viewport: SubViewport = _viewport(Vector2i(720,1600))
	var opening: Prologue = Prologue.new()
	opening.theme = UiTheme.create(1.25)
	opening.reduced_motion = true
	viewport.add_child(opening)
	opening.play()
	opening.set_process(false)
	opening.advance(120.0)
	await wait_process_frames(8)
	_assert_inside(opening._continue,viewport)
	_assert_inside(opening._replay,viewport)
	assert_false(opening._download.get_parent().visible)
	assert_false(opening.continue_selected)
