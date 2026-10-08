extends GutTest
const Tutorial = preload("res://scripts/ui/entry/tutorial_battle.gd")
const Live = preload("res://scripts/ui/battle/live_battle_playback.gd")
var registry: ContentModels.ContentRegistry

func before_all() -> void:
	registry = ContentLoader.new().load_dir("res://data/content")

func prepared() -> BattleService.BattleResult:
	var result: BattleService.BattleResult = Tutorial.run(registry,Tutorial.data()["chapters"][2],true)
	# Long-lived local sample, so readiness and deliberate player waiting can be tested.
	for unit: BattleUnit in result.state.units:
		unit.hp = 100000
		unit.max_hp = 100000
	for record: Dictionary in result.initial_units:
		record["hp"] = 100000
		record["max_hp"] = 100000
	return result

func test_full_focus_waits_for_player_and_commands_are_real_actions() -> void:
	var result: BattleService.BattleResult = prepared()
	var live: Live = Live.new()
	live.begin(result,registry)
	live.advance(150.0)
	assert_true(live.can_cast_ultimate("fadyme"))
	assert_eq(live.unit("fadyme").focus,100)
	for event: Dictionary in result.state.battle_events:
		if event.get("actor_id") in ["fadyme","mahmut"]: assert_ne(event.get("action_type"),"ultimate")
	var before: int = result.state.battle_events.size()
	assert_true(live.cast_ultimate("fadyme"))
	live.advance(0)
	assert_eq(result.manual_commands.size(),1)
	assert_gt(result.state.battle_events.size(),before)
	assert_lt(live.unit("fadyme").focus,100)
	assert_false(live.cast_ultimate("fadyme"),"Second click cannot spend the same Focus")
	assert_false(live.cast_ultimate("missing"))

func test_cinematic_slows_the_battle_clock_and_restores_the_selected_speed() -> void:
	var result: BattleService.BattleResult = prepared()
	var live: Live = Live.new()
	live.begin(result,registry)
	live.advance(150.0)
	var battle: BattleScreen = add_child_autofree(BattleScreen.new())
	battle._double_speed_unlocked = true
	battle.play(live,"Manual Ultimate")
	battle._timer.stop()
	battle.cycle_speed()
	assert_eq(battle.speed(),2)
	var commands: int = result.manual_commands.size()
	battle.request_ultimate("fadyme")
	assert_almost_eq(battle.effective_pace(),0.1,0.0001)
	assert_eq(result.manual_commands.size(),commands,"Effect waits for portrait animation")
	battle.request_ultimate("mahmut")
	assert_eq(battle._cinematic._entity_id,"fadyme","One presentation owns input")
	await wait_seconds(2.0)
	assert_almost_eq(battle.effective_pace(),2.0,0.0001)
	assert_eq(result.manual_commands.size(),commands+1)
	assert_eq(Engine.time_scale,1.0,"Reading/buttons and the rest of the game keep their own clock")

func test_nearest_default_preserves_authored_non_manual_selectors() -> void:
	var result: BattleService.BattleResult = prepared()
	var state: EncounterState = result.state
	var actor: BattleUnit = state.units[0]
	var nearest: BattleUnit = AutoBattleProvider.nearest_enemy(state,actor)
	assert_eq(nearest.row,"front")
	for enemy: BattleUnit in state.living_units("enemy"):
		if enemy != nearest: enemy.hp = 1
	assert_same(AutoBattleProvider.nearest_enemy(state,actor),nearest,"Default is distance, not low HP")
	var provider: AutoBattleProvider = AutoBattleProvider.from_rules(state.service.rules)
	provider.nearest_default = true
	var skill: ContentModels.Skill = state.records[actor.entity_id].skills[0]
	var action: AutoBattleProvider.BattleAction = provider._action(state,actor,skill)
	for op: ContentModels.EffectOp in skill.effect_ops:
		if op.target_selector_id == null or op.target_selector_id.is_empty(): continue
		var rule: Dictionary = state.interpreter().selector_rules[op.target_selector_id]
		if rule.get("kind") == "manual_single" and rule.get("side") == "opposing":
			assert_eq(action.targets[op.target_selector_id],[nearest.entity_id])

func test_manual_ultimate_rejects_controlled_or_defeated_actors() -> void:
	var result: BattleService.BattleResult = prepared()
	var live: Live = Live.new()
	live.begin(result,registry)
	live.advance(150.0)
	var actor: BattleUnit = result.state.units[1]
	actor.alive = false
	assert_false(live.can_cast_ultimate(actor.entity_id))
	assert_false(live.cast_ultimate(actor.entity_id))

func test_first_line_and_voice_wait_until_page_reveal_is_finished() -> void:
	var reader: VnScreen = add_child_autofree(VnScreen.new())
	var voice: AudioStreamGenerator = AudioStreamGenerator.new()
	reader.voice_stream_resolver = func(_speaker: String,_line: String) -> AudioStream: return voice
	reader.load_scene({"lines":[{"speaker_id":"mahmut","line_id":"test_reveal","text_en":"A long enough sentence to see the typewriter after the page opens."}]})
	reader.advance_reader(10)
	assert_eq(reader.visible_dialogue_text(),"")
	assert_false(reader.voiced)
	UiPageTransition.finish_under(reader)
	reader.advance_reader(0.1)
	assert_true(reader.voiced)
	assert_true(Audio.is_voice_playing())
	assert_gt(reader.visible_dialogue_text().length(),0)
