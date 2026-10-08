extends GutTest
const Tutorial = preload("res://scripts/ui/entry/tutorial_battle.gd")
const Preferences = preload("res://scripts/app/onboarding_preferences.gd")
var _registry: ContentModels.ContentRegistry
const Onboarding = preload("res://scripts/ui/entry/entry_onboarding.gd")

func before_all() -> void:
	_registry = ContentLoader.new().load_dir("res://data/content")

func test_engine_clock_records_tied_readiness_without_changing_canonical_events() -> void:
	var chapter: Dictionary = Tutorial.data()["chapters"][0]
	var result: BattleService.BattleResult = Tutorial.run(_registry,chapter)
	assert_eq(result.error,"")
	assert_eq(result.outcome,"victory")
	assert_eq(result.state.replay_frames.size(),result.state.battle_events.size())
	var previous: float = -1.0
	var seen: Dictionary = {}
	var tied: bool = false
	for index: int in range(result.state.battle_events.size()):
		var event: Dictionary = result.state.battle_events[index]
		var clock: float = result.state.replay_frames[index]["gauge_time"]
		assert_gte(clock,previous)
		assert_false(event.has("gauge_time"),"presentation sidecars do not change the canonical log")
		previous = clock
		if event.get("type") == "action_started":
			var key: String = str(clock)
			if seen.has(key) and seen[key] != event["actor_id"]: tied = true
			seen[key] = event["actor_id"]
	assert_true(tied,"two ready actors have one shared timestamp, not queued animation intervals")

func test_shared_clock_replays_a_batch_and_speed_only_changes_wall_time() -> void:
	var pilot: GDScript = load("res://scripts/art_review/fadyme_pilot.gd") as GDScript
	var slow: BattlePlayback = pilot.sample_formation()
	var fast: BattlePlayback = pilot.sample_formation()
	assert_eq(slow.advance(3.0).size(),0)
	var cues: Array[BattlePlayback.Cue] = slow.advance(0.7)
	var actions: int = 0
	for cue: BattlePlayback.Cue in cues:
		if cue.kind == BattlePlayback.CUE_ACTION: actions += 1
	assert_eq(actions,10,"all ten actors can begin inside the same half-second window")
	fast.advance(3.7)
	assert_eq(fast.cursor(),slow.cursor())
	for index: int in range(600):
		slow.advance(0.1)
		fast.advance(0.2)
		if slow.is_finished() and fast.is_finished(): break
	assert_true(slow.is_finished())
	assert_true(fast.is_finished())
	for view: BattlePlayback.UnitView in slow.units:
		assert_eq(fast.unit(view.entity_id).hp,view.hp)
		assert_eq(fast.unit(view.entity_id).focus,view.focus)

func test_all_three_reward_free_tutorials_preserve_main_story_records() -> void:
	var stages: Array = _registry.stages.keys().duplicate()
	for chapter: Dictionary in Tutorial.data()["chapters"]:
		var result: BattleService.BattleResult = Tutorial.run(_registry,chapter)
		assert_eq(result.error,"")
		assert_eq(result.outcome,"victory")
		assert_eq(result.stage_id,chapter["stage_id"])
		assert_eq(result.state.living_units("player").size(),2)
		for unit: BattleUnit in result.state.units:
			if unit.team == "player": assert_true(unit.entity_id in ["mahmut","fadyme"])
			else: assert_true(unit.enemy_id in ["bellbound_dead","hollow_pilgrim"])
	assert_eq(_registry.stages.keys(),stages)
	assert_false(_registry.stages.has("T-1"),"tutorial stage records never enter the main-story registry")

func test_account_preferences_use_server_creation_and_isolate_accounts() -> void:
	var path: String = "user://test_onboarding_preferences.cfg"
	DirAccess.remove_absolute(path)
	assert_eq(Preferences.register(path,"old-on-new-device",false),OK)
	assert_false(Preferences.pending(path,"old-on-new-device"))
	assert_eq(Preferences.register(path,"new-account",true),OK)
	assert_true(Preferences.pending(path,"new-account"))
	assert_eq(Preferences.checkpoint(path,"new-account",1,"after"),OK)
	Preferences.register(path,"new-account",false)
	assert_eq(Preferences.cursor(path,"new-account")["index"],1)
	assert_eq(Preferences.cursor(path,"new-account")["phase"],"after")
	assert_false(Preferences.pending(path,"other-account"))
	Preferences.checkpoint(path,"new-account",2,"complete",true)
	assert_false(Preferences.pending(path,"new-account"))
	assert_false(FileAccess.get_file_as_string(path).contains("token"))
	DirAccess.remove_absolute(path)

func test_fadyme_skill_readouts_and_hit_layer_keep_a_cast_alive() -> void:
	var pilot: GDScript = load("res://scripts/art_review/fadyme_pilot.gd") as GDScript
	var replay: BattlePlayback = pilot.sample_battle()
	var active: int = 0
	for skill: ContentModels.Skill in replay.unit("fadyme").skills:
		if skill.type == "active": active += 1
	assert_eq(active,1)
	var battle: BattleScreen = add_child_autofree(BattleScreen.new())
	battle.play(replay)
	battle._timer.stop()
	assert_eq(battle._skill_tray.get_child_count(),5)
	var actor: BattleActor = battle._arena.actors["fadyme"]
	actor.animate("active")
	actor.animate("hit")
	assert_eq(actor.animation_state,"active","a concurrent hit cannot replace the cast pose")
	await wait_seconds(1.3)
	assert_eq(actor.animation_state,"idle")

func test_cutscene_reveals_once_and_uses_the_local_fadyme_reference_art() -> void:
	var opening: Onboarding = add_child_autofree(Onboarding.new())
	opening.start(_registry)
	var reader: VnScreen = opening._host.get_child(0) as VnScreen
	# The opening narration has no character bust. Reach Fadyme's first reply.
	for click: int in range(4): reader.go_next()
	await wait_seconds(3.5)
	assert_gt(reader.modulate.a,0.99,"a second reveal cannot capture alpha zero and keep the scene invisible")
	assert_true(reader._bust.visible)
	assert_not_null(reader._bust.texture)
	assert_true(reader._background.visible)
	assert_false(reader.audio_enabled)
	assert_eq(reader.find_children("*","UiPageTransition",true,false).size(),0)
