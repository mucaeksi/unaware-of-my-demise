extends GutTest

var _registry: ContentModels.ContentRegistry = null

func before_all() -> void:
	_registry = ContentLoader.new().load_dir("res://data/content")

func _unit(id: String, team: String, row: String, slot: int) -> BattlePlayback.UnitView:
	var view: BattlePlayback.UnitView = BattlePlayback.UnitView.new()
	view.entity_id = id
	view.art_id = "fadyme" if team == "player" else "bellbound_dead"
	view.display_name = id
	view.team = team
	view.row = row
	view.slot_index = slot
	view.hp = 100
	view.max_hp = 100
	return view

func test_full_formation_faces_opponents_and_keeps_front_nearer_the_center() -> void:
	var views: Array[BattlePlayback.UnitView] = []
	for team: String in ["player", "enemy"]:
		for slot: int in range(5):
			views.append(_unit("%s_%d" % [team,slot], team, "front" if slot < 2 else "rear", slot))
	var field: BattleField = BattleField.new()
	field.size = Vector2(996, 1100)
	add_child_autofree(field)
	field.populate(views)
	await get_tree().process_frame
	await get_tree().process_frame
	for view: BattlePlayback.UnitView in views:
		var actor: BattleActor = field.actors[view.entity_id]
		assert_eq(actor.facing_right, view.team == "player")
		assert_true(actor.position.x < field.size.x * 0.5 if view.team == "player" else actor.position.x > field.size.x * 0.5)
		assert_true(actor.position.y - BattleActor.ART_SIZE > 0)
		assert_true(actor.position.y + actor.card.size.y + 14 < field.size.y, "%s foot=%s HUD=%s arena=%s" % [view.entity_id, actor.position, actor.card.size, field.size])
	var front: BattleActor = field.actors["player_0"]
	var rear: BattleActor = field.actors["player_2"]
	assert_gt(front.position.x, rear.position.x)
	# Same-column bodies + HUD must not overlap at the target portrait size.
	assert_gt((field.actors["player_3"] as BattleActor).position.y - rear.position.y, 245.0)

func test_later_wave_keeps_existing_ground_anchors_and_enters_in_its_slot() -> void:
	var first: BattlePlayback.UnitView = _unit("first", "enemy", "front", 0)
	var later: BattlePlayback.UnitView = _unit("later", "enemy", "front", 0)
	later.on_field = false
	var views: Array[BattlePlayback.UnitView] = [first,later]
	var field: BattleField = BattleField.new()
	field.size = Vector2(996, 1100)
	add_child_autofree(field)
	field.populate(views)
	var before: Vector2 = (field.actors["first"] as BattleActor).position
	assert_false((field.actors["later"] as BattleActor).visible)
	first.on_field = false
	later.on_field = true
	field.refresh(views)
	assert_eq((field.actors["later"] as BattleActor).position, before)
	assert_false((field.actors["first"] as BattleActor).visible)
	assert_true((field.actors["later"] as BattleActor).visible)

func test_dead_actor_cannot_return_to_idle_or_victory_from_late_cues() -> void:
	var view: BattlePlayback.UnitView = _unit("fadyme", "player", "rear", 2)
	var actor: BattleActor = BattleActor.create(view)
	add_child_autofree(actor)
	actor.animate("active")
	view.hp = 0
	view.alive = false
	actor.refresh(view)
	actor.animate("victory")
	await wait_seconds(0.8)
	assert_eq(actor.animation_state, "defeat")
	assert_eq(actor.card.hp_text(), "HP 0 / 100")

func test_replay_retains_action_type_and_enemy_art_identity() -> void:
	var initial: Array[Dictionary] = [{"entity_id":"wave:0:bellbound_dead:0","enemy_id":"bellbound_dead","team":"enemy","hp":10,"max_hp":10,"alive":true}]
	var events: Array[Dictionary] = [{"type":"action_started","actor_id":"wave:0:bellbound_dead:0","skill_id":"some_skill","action_type":"active"}]
	var playback: BattlePlayback = BattlePlayback.from_records(initial, initial, events, initial, null)
	assert_eq(playback.units[0].art_id, "bellbound_dead")
	var cue: BattlePlayback.Cue = playback.apply_next()[0]
	assert_eq(cue.action_type, "active")
	assert_eq(cue.skill_id, "some_skill")

func test_fadyme_expression_uses_authoring_emotion_and_healthy_composed_fallback() -> void:
	assert_not_null(BattleArt.portrait("fadyme", "composed"))
	assert_ne(BattleArt.portrait("fadyme", "soft_smile"), BattleArt.portrait("fadyme", "frightened"))
	assert_eq(BattleArt.portrait("fadyme", "unknown"), BattleArt.portrait("fadyme", "composed"))
	assert_null(BattleArt.portrait("narration", "sad"))

func test_auto_reader_waits_for_voice_and_manual_next_still_cuts_it() -> void:
	var reader: VnScreen = VnScreen.new()
	add_child_autofree(reader)
	var long_voice: AudioStreamGenerator = AudioStreamGenerator.new()
	reader.voice_stream_resolver = func(_speaker: String, line: String) -> AudioStream: return long_voice if line == "long" else null
	reader.load_scene({"scene_id":"audition_test","title_en":"Voice lifecycle","lines":[
		{"line_id":"long","speaker_id":"fadyme","text_en":"First line"},
		{"line_id":"silent","speaker_id":"fadyme","text_en":"Second line"}
	]})
	UiPageTransition.finish_under(reader)
	reader.advance_reader(0)
	await get_tree().process_frame
	assert_true(reader.voiced)
	assert_eq(reader.auto_speed(), 1)
	reader._auto_tick()
	assert_eq(reader._index, 0, "Auto must wait while the voice is still playing")
	reader.go_next()
	assert_eq(reader._index,0,"Next reveals before interrupting the line")
	reader.go_next()
	assert_eq(reader._index, 1, "Explicit Next can interrupt a performance")
	assert_false(reader.voiced)
	assert_false(Audio.is_voice_playing())

func _cleared_chapter_three() -> StoryState.PlayerStoryState:
	var story: StoryState.PlayerStoryState = StoryState.PlayerStoryState.new()
	for stage: ContentModels.Stage in _registry.stages.values():
		if stage.chapter_id == BattleSpeedPolicy.CHAPTER_ID:
			story.completed_stage_ids[stage.stage_id] = true
	return story

func test_speed_unlock_requires_saved_completion_of_the_whole_chapter() -> void:
	var story: StoryState.PlayerStoryState = _cleared_chapter_three()
	assert_true(BattleSpeedPolicy.double_speed_unlocked(story, _registry))
	story.completed_stage_ids.erase("3-5")
	assert_false(BattleSpeedPolicy.double_speed_unlocked(story, _registry), "reaching the final stage is not completion")
	story.completed_stage_ids = {"3-5":true}
	assert_false(BattleSpeedPolicy.double_speed_unlocked(story, _registry), "one completed boss cannot substitute for the whole chapter")
	assert_false(BattleSpeedPolicy.double_speed_unlocked(_cleared_chapter_three(), null), "an AAB without Chapter 3 content stays at x1")

func test_speed_is_frozen_before_reward_save_and_only_toggles_one_or_two() -> void:
	var story: StoryState.PlayerStoryState = _cleared_chapter_three()
	story.completed_stage_ids.erase("3-5")
	var battle: BattleScreen = add_child_autofree(BattleScreen.new())
	battle.configure_progress(story, _registry)
	story.completed_stage_ids["3-5"] = true
	var pilot_script: GDScript = load("res://scripts/art_review/fadyme_pilot.gd") as GDScript
	battle.play(pilot_script.sample_battle())
	battle.cycle_speed()
	assert_eq(battle.speed(), 1, "victory saved before replay cannot unlock speed during that battle")
	assert_true(battle._speed_button.disabled)
	assert_false(battle.has_method("skip"))
	battle.configure_progress(story, _registry)
	battle.play(pilot_script.sample_battle())
	assert_false(battle._speed_button.disabled)
	for index: int in range(6):
		battle.cycle_speed()
		assert_eq(battle.speed(), 2 if index % 2 == 0 else 1)
		assert_almost_eq(battle._timer.wait_time, BattleScreen.BASE_INTERVAL, 0.001, "speed scales the shared clock, never the timer/event count")
	assert_gte(battle._speed_button.custom_minimum_size.y, float(UiTheme.TOUCH_HEIGHT))
	await get_tree().process_frame

func _body_rect(actor: BattleActor) -> Rect2:
	return actor._sprite.get_global_transform() * actor._sprite.get_rect()

func test_small_party_full_party_and_large_boss_fit_in_short_and_tall_arenas() -> void:
	var pilot_script: GDScript = load("res://scripts/art_review/fadyme_pilot.gd") as GDScript
	for arena_size: Vector2 in [Vector2(996,1100),Vector2(996,780),Vector2(824,920)]:
		for mode_index: int in range(3):
			var replay: BattlePlayback = pilot_script.sample_battle() if mode_index == 0 else pilot_script.sample_formation(mode_index == 2)
			var field: BattleField = BattleField.new()
			field.size = arena_size
			add_child_autofree(field)
			field.populate(replay.units)
			await get_tree().process_frame
			await get_tree().process_frame
			var bounds: Rect2 = field.get_global_rect()
			for view: BattlePlayback.UnitView in replay.units:
				var actor: BattleActor = field.actors[view.entity_id]
				assert_true(bounds.encloses(_body_rect(actor)), "%s sprite fits %s" % [view.entity_id,arena_size])
				assert_true(bounds.encloses(actor.card.get_global_rect()), "%s HUD fits %s" % [view.entity_id,arena_size])
				assert_eq(actor.card.bar_value(), float(view.hp))
				for other: BattlePlayback.UnitView in replay.units:
					if other.entity_id == view.entity_id:
						continue
					var neighbor: BattleActor = field.actors[other.entity_id]
					assert_false(actor.card.get_global_rect().intersects(neighbor.card.get_global_rect()), "HUDs do not overlap")
					assert_false(actor.card.get_global_rect().intersects(_body_rect(neighbor)), "HUD does not cover another sprite")
			if mode_index == 2:
				assert_gt((field.actors["enemy_slot_2"] as BattleActor).art_size, (field.actors["player_slot_0"] as BattleActor).art_size * 1.5)

func test_visual_review_defers_audio_without_replacing_source_takes() -> void:
	var reader: VnScreen = add_child_autofree(VnScreen.new())
	reader.audio_enabled = false
	reader.voice_stream_resolver = func(_speaker: String, _line: String) -> AudioStream:
		fail_test("visual review must not load a take")
		return null
	reader.load_scene({"scene_id":"silent_review","title_en":"Visual review","lines":[{"line_id":"opening_012","speaker_id":"fadyme","text_en":"The visual remains available."}]})
	assert_false(reader.voiced)
	assert_false(Audio.is_voice_playing())
	assert_eq(reader.dialogue_text(), "The visual remains available.")

func test_wide_boss_sprite_is_constrained_to_its_reserved_side() -> void:
	var pilot_script: GDScript = load("res://scripts/art_review/fadyme_pilot.gd") as GDScript
	var replay: BattlePlayback = pilot_script.sample_formation(true)
	var field: BattleField = BattleField.new()
	field.size = Vector2(996, 1100)
	add_child_autofree(field)
	field.populate(replay.units)
	await get_tree().process_frame
	var boss: BattleActor = field.actors["enemy_slot_2"]
	# A generated-in-memory test texture simulates a wide future silhouette.
	# No asset or source image is edited by this test.
	var wide: GradientTexture2D = GradientTexture2D.new()
	wide.width = 800
	wide.height = 240
	boss._sprite.texture = wide
	boss._process(0.0)
	assert_lte(_body_rect(boss).size.x, field.size.x * 0.42 + 0.001)
	assert_true(field.get_global_rect().encloses(_body_rect(boss)))
