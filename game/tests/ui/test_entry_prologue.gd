extends GutTest
const Story = preload("res://scripts/ui/entry/entry_prologue.gd")
const Data = preload("res://scripts/ui/entry/entry_prologue_script.gd")
const SEEN: String = "user://test_entry_prologue_ui.cfg"

func after_each() -> void:
	DirAccess.remove_absolute(SEEN)

func _player(reduced: bool = true) -> Story:
	var viewport: SubViewport = SubViewport.new()
	viewport.size = Vector2i(1080, 1920)
	add_child_autofree(viewport)
	var player: Story = Story.new()
	player.theme = UiTheme.create()
	viewport.add_child(player)
	player.reduced_motion = reduced
	player.play()
	player.set_process(false)
	return player

func test_authored_timeline_is_120_seconds_with_unique_english_lines() -> void:
	var result: Outcome = Data.load_timeline()
	assert_true(result.is_ok())
	var data: Dictionary = result.value
	assert_eq(data["duration_seconds"], 120.0)
	assert_eq((data["scenes"] as Array).size(), 9)
	var total: float = 0.0
	for scene: Dictionary in data["scenes"]:
		total += float(scene["duration_seconds"])
		for character: int in str(scene["text_en"]).to_utf32_buffer():
			assert_lt(character, 128, "narration uses English ASCII characters")
	assert_eq(total, 120.0)
	var malformed: Dictionary = data.duplicate(true)
	malformed["scenes"][1]["line_id"] = malformed["scenes"][0]["line_id"]
	assert_false(Data.validate(malformed).is_ok())
	malformed = data.duplicate(true)
	malformed["scenes"][0]["duration_seconds"] = 0
	assert_false(Data.validate(malformed).is_ok())

func test_scene_clock_visits_every_line_and_finishes_once_at_120_seconds() -> void:
	var player: Story = _player()
	watch_signals(player)
	var boundaries: Array[float] = [12.0, 14.0, 12.0, 12.0, 16.0, 16.0, 14.0, 12.0]
	for seconds: float in boundaries: player.advance(seconds)
	assert_eq(player._scene_index, 8)
	assert_eq(player.elapsed_seconds, 108.0)
	assert_signal_not_emitted(player, "finished")
	player.advance(11.99)
	assert_true(player.playing)
	player.advance(0.01)
	assert_false(player.playing)
	assert_eq(player.elapsed_seconds, 120.0)
	assert_signal_emitted_with_parameters(player, "finished", [false])
	assert_signal_emit_count(player, "scene_presented", 8)
	player.advance(20.0)
	player.skip()
	assert_signal_emit_count(player, "finished", 1)

func test_story_clock_never_changes_verified_transfer_percentage() -> void:
	var player: Story = _player()
	player.set_transfer(1048576, 4194304)
	player.advance(50.0)
	assert_eq(player._progress.value, 25.0)
	assert_string_contains(player._bytes.text, "1.0 MiB / 4.0 MiB")
	player.set_transfer(-100, 0)
	assert_eq(player._progress.value, 0.0)
	assert_eq(player._bytes.text, "Waiting for download...")
	player.set_transfer(9000000, 4194304)
	assert_eq(player._progress.value, 100.0)

func test_ending_fades_to_black_once_and_replay_restores_the_image() -> void:
	var player: Story = _player(false)
	watch_signals(player)
	player.advance(117.0)
	assert_signal_emitted_with_parameters(player, "ending_started", [3.0])
	assert_eq(player._ending_veil.color.a, 0.0)
	player.advance(1.5)
	assert_almost_eq(player._ending_veil.color.a, 0.5, 0.01)
	assert_true(player.playing)
	player.advance(1.5)
	assert_eq(player._ending_veil.color.a, 1.0)
	assert_signal_emit_count(player, "ending_started", 1)
	assert_true(player._continue.visible)
	player.play()
	player.set_process(false)
	assert_eq(player._ending_veil.color.a, 0.0)

func test_reduced_motion_removes_camera_motion_and_dissolve() -> void:
	var player: Story = _player()
	player.advance(50.0)
	assert_eq(player._shot._background.scale, Vector2.ONE)
	assert_null(player._previous_shot)
	var frozen: Array = player._shot.evidence()["poses"]
	player.advance(4.0)
	assert_eq(player._shot.evidence()["poses"], frozen, "Reduced Motion freezes actors as well as the camera")
	assert_eq(player._text.modulate.a, 1.0)
	assert_eq(player._text.language, "en")
	assert_gte(player._text.get_theme_font_size("font_size"), 40, "narration must remain readable at the base scale")

func test_skip_replay_and_natural_finish_are_separate_from_game_actions() -> void:
	var player: Story = _player()
	watch_signals(player)
	player.advance(15.0)
	player.skip()
	assert_signal_emitted_with_parameters(player, "finished", [true])
	assert_signal_emit_count(player, "dismissed", 1)
	player.play()
	player.set_process(false)
	assert_eq(player.elapsed_seconds, 0.0)
	assert_eq(player._scene_index, 0)
	assert_true(player.playing)
	player.advance(120.0)
	assert_signal_emit_count(player, "finished", 2)
	player.skip()
	assert_signal_emit_count(player, "finished", 2, "closing the finished story is not another completion")

func test_entry_aborts_on_error_without_marking_seen_and_preserves_retry() -> void:
	var viewport: SubViewport = SubViewport.new()
	viewport.size = Vector2i(1080, 1920)
	add_child_autofree(viewport)
	var entry: EntryScreen = EntryScreen.new()
	entry.theme = UiTheme.create()
	entry.set_meta("ui_reduced_motion", true)
	viewport.add_child(entry)
	entry.present("downloading", true)
	entry.start_prologue(SEEN)
	assert_true(entry._prologue.visible)
	assert_false(entry.body.visible)
	assert_false(Story.was_seen(SEEN))
	entry.present("offline", true)
	assert_false(entry._prologue.visible)
	assert_false(entry._prologue.playing)
	assert_true(entry.body.visible)
	assert_true(entry.primary.visible)
	assert_eq(entry.primary.text, "Retry")
	assert_eq(entry.primary.focus_mode, Control.FOCUS_ALL)
	assert_false(Story.was_seen(SEEN))

func test_seen_marker_is_written_only_after_finish_or_explicit_skip() -> void:
	assert_false(Story.was_seen(SEEN))
	assert_eq(Story.mark_seen(SEEN), OK)
	assert_true(Story.was_seen(SEEN))

func test_large_text_changes_narration_through_the_shared_theme() -> void:
	var player: Story = _player()
	var original: int = player._text.get_theme_font_size("font_size")
	player.theme = UiTheme.create(1.25)
	await wait_process_frames(3)
	assert_gt(player._text.get_theme_font_size("font_size"), original)
	assert_eq(player._text.get_theme_font_size("font_size"), 55)

func test_skip_is_hidden_until_revealed_and_completion_requires_continue() -> void:
	var player: Story = _player(false)
	watch_signals(player)
	assert_false(player._skip.visible)
	assert_eq(player._skip.focus_mode, Control.FOCUS_NONE)
	assert_false(player._end_controls.visible)
	player.reveal_skip()
	assert_true(player._skip.visible)
	assert_signal_not_emitted(player, "dismissed")
	player.advance(120.0)
	assert_false(player._skip.visible)
	assert_false(player._narration_panel.visible)
	assert_false(player._download.visible)
	assert_true(player._end_controls.visible)
	assert_true(player._replay.is_visible_in_tree())
	assert_true(player._continue.is_visible_in_tree())
	assert_false(player.continue_selected)
	assert_signal_not_emitted(player, "dismissed")
	player.request_continue()
	player.request_continue()
	assert_true(player.continue_selected)
	assert_signal_emit_count(player, "dismissed", 1)

func test_typewriter_uses_story_time_and_keeps_full_paragraph_layout() -> void:
	var player: Story = _player(false)
	assert_eq(player._text.visible_characters, 0)
	var complete_text: String = player._text.text
	player.advance(1.0)
	var characters: int = player._text.visible_characters
	assert_gt(characters, 0)
	assert_lt(characters, complete_text.length())
	assert_eq(player._text.text, complete_text)
	player.advance(7.0)
	assert_eq(player._text.visible_characters, complete_text.length())
	player.advance(4.0)
	assert_eq(player._text.visible_characters, 0, "each line starts its own reveal")
	player.narration_duration_seconds = 8.0
	player.advance(4.0)
	assert_eq(player._text.visible_characters, floori(player._text.text.length() * 0.5), "approved VO duration drives reveal")
	var reduced: Story = _player(true)
	assert_eq(reduced._text.visible_characters, -1, "Reduced Motion reads the whole line immediately")

func test_watermark_subtitles_and_small_transfer_are_at_safe_screen_edges() -> void:
	var player: Story = _player()
	await wait_process_frames(4)
	var screen: Rect2 = player.get_global_rect()
	assert_eq(player._logo.modulate.a, Color(1, 1, 1, 0.42).a)
	assert_lt(player._logo.get_global_rect().end.x, screen.get_center().x)
	assert_lt(player._logo.get_global_rect().end.y, 200.0)
	assert_gte(player._skip.size.y, float(UiTheme.TOUCH_HEIGHT), "small text keeps a full touch target")
	assert_almost_eq(screen.end.y - player._narration_panel.get_global_rect().end.y, 12.0, 1.0)
	assert_lt(player._download.get_global_rect().end.y, player._narration_panel.get_global_rect().position.y)
	assert_eq(player._download.modulate.a, Color(1, 1, 1, 0.58).a)
	assert_lt((player._narration_panel.get_theme_stylebox("panel") as StyleBoxFlat).bg_color.a, 0.5)

func test_camera_stays_fixed_while_the_bell_moves_and_transfer_is_unchanged() -> void:
	var player: Story = _player(false)
	player.set_transfer(1, 4)
	await wait_process_frames(3)
	var camera: Rect2 = player._shot._background.get_rect()
	var angle: float = player._shot._actors[0].rotation
	player.advance(1.0)
	assert_eq(player._shot._background.get_rect(), camera)
	assert_ne(player._shot._actors[0].rotation, angle)
	assert_eq(player._progress.value, 25.0)
	player.advance(11.0)
	assert_not_null(player._previous_shot)
	player.advance(1.2)
	assert_almost_eq(player._previous_shot.modulate.a, 0.5, 0.01)
	player.advance(1.2)
	assert_null(player._previous_shot, "outgoing shot releases its textures after the dissolve")

func test_each_shot_has_valid_assets_and_writing_has_a_visible_ordered_action() -> void:
	var player: Story = _player(false)
	var data: Dictionary = Data.load_timeline().value
	for scene: Dictionary in data["scenes"]:
		for path: String in player.Shot.paths_for(str(scene["id"])):
			assert_true(ResourceLoader.exists(path), path)
	player.advance(14.0)
	var start_points: int = player._shot._ink.points.size()
	player.advance(3.0)
	assert_gt(player._shot._ink.points.size(), start_points)
	var malformed: Dictionary = data.duplicate(true)
	malformed["scenes"][1]["id"] = "hours"
	assert_false(Data.validate(malformed).is_ok())

func test_walk_atlas_uses_distinct_cells_and_reduced_motion_is_still() -> void:
	var player: Story = _player(false)
	player.advance(39.0)
	var first: Rect2 = player._shot._actors[0].region_rect
	player.advance(0.34)
	var second: Rect2 = player._shot._actors[0].region_rect
	assert_ne(second.position, first.position)
	assert_eq(second.size, first.size)
	assert_true(Rect2(Vector2.ZERO, player._shot._actors[0].texture.get_size()).encloses(second))
	player.advance(0.34) # Visit the next, non-reference cell; frame zero intentionally has no offset.
	assert_ne(player._shot._actors[0].offset, Vector2.ZERO, "frame registration removes the measured atlas drift")
	player._shot.reduced_motion = true
	player._shot.update_time(4.0)
	var still: Array = player._shot.evidence()["poses"]
	player._shot.update_time(8.0)
	assert_eq(player._shot.evidence()["poses"], still)

func test_boot_pivots_follow_painted_roads_and_shrink_toward_the_horizon() -> void:
	var player: Story = _player(false)
	for beat: float in [38.0, 66.0, 108.0]:
		player.play()
		player.set_process(false)
		player.advance(beat)
		await wait_process_frames(4)
		var shot: Control = player._shot
		var actor: Sprite2D = player._shot._actors[0]
		player._shot.update_time(0.0)
		var start_height: float = actor.scale.y * actor.region_rect.size.y
		var previous_y: float = actor.position.y
		# Include every atlas phase throughout departure, not just the first pose.
		for sample: int in 41:
			player._shot.update_time(sample * 0.25)
			var sole_pivot: Vector2 = actor.get_meta("sole_pivot")
			var planted: Vector2 = actor.to_global(sole_pivot * actor.region_rect.size + actor.offset)
			var scene_pixel: Vector2 = shot.get_global_transform().affine_inverse() * planted
			var expected: Vector2 = player._shot._background_pixel(player._shot._ground_uvs[0])
			assert_almost_eq(scene_pixel.x, expected.x, 0.001, "boot contact follows the painted path, including cover crop")
			assert_almost_eq(scene_pixel.y, expected.y, 0.001, "scaling never lifts the foot pivot off the road")
			assert_true(player._shot.focus_area.has_point(scene_pixel), "feet remain visible above subtitles")
			assert_lte(actor.position.y, previous_y, "the route recedes continuously")
			previous_y = actor.position.y
		assert_lt(actor.scale.y * actor.region_rect.size.y, start_height * 0.90)

func test_market_loaf_is_never_split_and_standing_actors_keep_their_feet() -> void:
	var player: Story = _player(false)
	for beat: float in [26.0, 82.0, 96.0]:
		player.play()
		player.set_process(false)
		player.advance(beat)
		await wait_process_frames(4)
		if beat == 26.0:
			assert_eq(player._shot._actors.size(), 1, "the offering and loaf have one continuous transform")
			assert_false(player._shot._actors[0].region_enabled, "no midpoint crop can cut the bread")
		for actor: Sprite2D in player._shot._actors:
			var start: Vector2 = actor.position
			for time: float in [0.0, 2.0, 5.0, 10.0]:
				player._shot.update_time(time)
				assert_eq(actor.position, start, "standing people cannot slide across the ground")
				var pivot: Vector2 = actor.get_meta("sole_pivot")
				var foot: Vector2 = player._shot.get_global_transform().affine_inverse() * actor.to_global(pivot * actor.texture.get_size() + actor.offset)
				assert_true(player._shot.focus_area.has_point(foot), "standing soles are visible")

func test_quill_tip_touches_the_ink_then_lifts_after_writing() -> void:
	var player: Story = _player(false)
	player.advance(12.0)
	await wait_process_frames(4)
	for time: float in [2.0, 3.5, 5.0, 7.5, 8.2]:
		player._shot.update_time(time)
		var hand: Sprite2D = player._shot._actors[0]
		var nib: Vector2 = hand.texture.get_size() * player.Shot.WRITING_NIB
		var point: Vector2 = hand.transform * (nib + hand.offset)
		assert_almost_eq(point.x, player._shot._pen_tip.x, 0.001)
		assert_almost_eq(point.y, player._shot._pen_tip.y, 0.001)
	player._shot.update_time(11.0)
	assert_lt(player._shot._actors[0].position.y, player._shot._pen_tip.y)
	assert_eq(player._shot._written_text.text, "We were here.")
	assert_eq(player._shot._written_text.visible_characters, "We were here.".length(), "the inscription finishes before the hand lifts")

func test_reunion_keeps_fadyme_shorter_and_on_the_near_road() -> void:
	var player: Story = _player(false)
	player.advance(102.0)
	await wait_process_frames(4)
	var mahmut: Sprite2D = player._shot._actors[0]
	var fadyme: Sprite2D = player._shot._actors[1]
	assert_lt(fadyme.texture.get_height() * fadyme.scale.y, mahmut.texture.get_height() * mahmut.scale.y * 0.88)
	assert_gt(fadyme.position.y, mahmut.position.y, "the shorter companion stands on the near road rather than the raised backdrop")

func test_stance_correction_plants_the_raised_boot_without_warping_faces_or_hands() -> void:
	var player: Story = _player(false)
	for beat: float in [82.0, 96.0]:
		player.play()
		player.set_process(false)
		player.advance(beat)
		await wait_process_frames(4)
		for index: int in player._shot._actors.size():
			var actor: Sprite2D = player._shot._actors[index]
			assert_true(actor.has_meta("stance_mesh"))
			var display: MeshInstance2D = actor.get_meta("stance_mesh") as MeshInstance2D
			var arrays: Array = (display.mesh as ArrayMesh).surface_get_arrays(0)
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var uvs: PackedVector2Array = arrays[Mesh.ARRAY_TEX_UV]
			var boot_found: bool = false
			var feminine: bool = beat == 96.0 and index == 1
			for vertex: int in vertices.size():
				var uv: Vector2 = uvs[vertex]
				var original: Vector2 = uv * actor.texture.get_size() + actor.offset
				var actual: Vector2 = Vector2(vertices[vertex].x, vertices[vertex].y)
				if uv.y <= 0.70:
					assert_eq(actual, original, "face, hands and upper body keep their original geometry")
				var sole_column: float = 14.0 / 32.0 if feminine else 23.0 / 32.0
				if uv == Vector2(sole_column, 38.0 / 40.0):
					var expected_drop: float = (0.031 if feminine else 0.054) * actor.texture.get_height()
					assert_almost_eq(actual.y - original.y, expected_drop, 0.001, "raised boot reaches the support plane")
					boot_found = true
			assert_true(boot_found)
