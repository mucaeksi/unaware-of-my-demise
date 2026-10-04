extends GutTest
## G5: the screens on their own (ports of the behaviour tests of tests/test_vn_screen.py, test_selector_screen.py, test_defeat_screen.py,
## test_hub_screens.py and the roster and battle screen tests): what each shows and which signal each button raises. No game rule here; the
## whole flow against a server backend returns with the backend phase (DEC-0012).

var _count: int = 0


func _bump() -> void:
	_count += 1


func _candidate(character_id: String, display_name: String, rarity: int = 4) -> GameFlow.RosterCandidate:
	var candidate: GameFlow.RosterCandidate = GameFlow.RosterCandidate.new()
	candidate.character_id = character_id
	candidate.name_en = display_name
	candidate.rarity = rarity
	candidate.element = "Ember"
	candidate.class_id = "striker"
	candidate.combat_role = "Striker"
	return candidate


func _candidates(count: int) -> Array[GameFlow.RosterCandidate]:
	var list: Array[GameFlow.RosterCandidate] = []
	for index: int in range(count):
		list.append(_candidate("hero_%d" % index, "Hero %d" % index))
	return list


func _scene(lines: int, extra: Dictionary = {}) -> Dictionary:
	var rows: Array[Dictionary] = []
	for index: int in range(lines):
		rows.append({"line_id": "l%d" % index, "speaker_id": "mahmut", "speaker_display": "Mahmut", "text_en": "Line %d" % index, "emotion": "calm"})
	var scene: Dictionary = {"scene_id": "s", "title_en": "A Scene", "lines": rows}
	scene.merge(extra, true)
	return scene


# -- VN ---------------------------------------------------------------------------------------------------


func test_vn_shows_the_first_line_and_walks_forward_and_back() -> void:
	var vn: VnScreen = add_child_autofree(VnScreen.new())
	assert_true(vn.load_scene(_scene(3)))
	assert_eq(vn.line_count(), 3)
	assert_eq(vn.speaker_text(), "Mahmut")
	assert_eq(vn.dialogue_text(), "Line 0")
	assert_true(vn._back_button.disabled, "no Back on the first line")
	assert_eq(vn._next_button.text, "Next")
	vn.go_next()
	vn.go_next()
	assert_eq(vn.dialogue_text(), "Line 2")
	assert_eq(vn._next_button.text, "Finish", "the last line offers Finish")
	vn.go_back()
	assert_eq(vn.dialogue_text(), "Line 1")
	assert_false(vn._back_button.disabled)


func test_vn_finishes_exactly_once_and_can_be_reused() -> void:
	var vn: VnScreen = add_child_autofree(VnScreen.new())
	watch_signals(vn)
	vn.load_scene(_scene(2))
	vn.go_next()
	assert_signal_not_emitted(vn, "finished")
	vn.go_next()
	vn.go_next()
	assert_signal_emit_count(vn, "finished", 1)
	vn.load_scene(_scene(1))
	vn.go_next()
	assert_signal_emit_count(vn, "finished", 2, "a fresh scene can finish again")


func test_vn_plays_pre_lines_then_lines_then_post_lines() -> void:
	var vn: VnScreen = add_child_autofree(VnScreen.new())
	var stage_scene: Dictionary = {"scene_id": "vn_1_1", "title_en": "T", "pre_battle_lines": _scene(1)["lines"], "post_battle_lines": [{"speaker_id": "narrator", "text_en": "After"}]}
	assert_true(vn.load_scene(stage_scene))
	assert_eq(vn.line_count(), 2)
	vn.go_next()
	assert_eq(vn.dialogue_text(), "After")
	assert_eq(vn.speaker_text(), "narrator", "no display name: the speaker id is shown")


func test_vn_refuses_a_scene_it_cannot_show_and_keeps_what_it_had() -> void:
	var vn: VnScreen = add_child_autofree(VnScreen.new())
	vn.load_scene(_scene(2))
	vn.go_next()
	assert_false(vn.load_scene({"scene_id": "empty", "lines": []}))
	assert_string_contains(vn.error, "no English dialogue lines")
	assert_false(vn.load_scene({"lines": [{"speaker_id": "x"}]}))
	assert_string_contains(vn.error, "missing text_en")
	assert_false(vn.load_scene({"lines": "text"}))
	assert_string_contains(vn.error, "must be a list")
	assert_false(vn.load_scene({"lines": [5]}))
	assert_string_contains(vn.error, "must be an object")
	assert_eq(vn.dialogue_text(), "Line 1", "the scene that was showing is untouched")
	assert_true(vn.load_scene(_scene(1)))
	assert_eq(vn.error, "")


func test_vn_auto_play_cycles_speeds_and_finishes_the_scene() -> void:
	var vn: VnScreen = add_child_autofree(VnScreen.new())
	watch_signals(vn)
	vn.load_scene(_scene(3))
	assert_eq(vn.auto_speed(), 0)
	vn.cycle_auto_speed()
	assert_eq(vn.auto_speed(), 1)
	assert_eq(vn._auto_button.text, "Auto: 1x")
	assert_false(vn._auto_timer.is_stopped())
	assert_almost_eq(vn._auto_timer.wait_time, VnScreen.BASE_AUTO_SECONDS, 0.001)
	vn.cycle_auto_speed()
	assert_almost_eq(vn._auto_timer.wait_time, VnScreen.BASE_AUTO_SECONDS / 2.0, 0.001)
	vn.cycle_auto_speed()
	vn.cycle_auto_speed()
	assert_eq(vn.auto_speed(), 0, "the fourth press turns it off")
	assert_true(vn._auto_timer.is_stopped())
	vn.cycle_auto_speed()
	vn._auto_tick()
	vn._auto_tick()
	assert_eq(vn.dialogue_text(), "Line 2")
	vn._auto_tick()
	assert_signal_emit_count(vn, "finished", 1)
	assert_eq(vn.auto_speed(), 0, "auto play stops with the scene")


func test_vn_log_lists_the_lines_read_so_far_and_closes_before_going_back() -> void:
	var vn: VnScreen = add_child_autofree(VnScreen.new())
	vn.load_scene(_scene(3))
	vn.go_next()
	vn.toggle_log()
	assert_true(vn.is_log_open())
	assert_string_contains(vn._log_text.text, "Line 0")
	assert_string_contains(vn._log_text.text, "Line 1")
	assert_false(vn._log_text.text.contains("Line 2"), "lines not read yet are not in the log")
	assert_true(vn.handle_back(), "back closes the log first")
	assert_false(vn.is_log_open())
	assert_true(vn.handle_back(), "then goes back one line")
	assert_eq(vn.dialogue_text(), "Line 0")
	assert_false(vn.handle_back(), "on the first line the shell decides")


# -- selector -----------------------------------------------------------------------------------------------


func test_selector_needs_a_pick_before_confirm() -> void:
	var selector: SelectorScreen = add_child_autofree(SelectorScreen.new())
	watch_signals(selector)
	selector.load_choices(_candidates(7), "Pick")
	assert_eq(selector.choice_count(), 7)
	assert_true(selector._confirm_button.disabled)
	selector.confirm()
	assert_signal_not_emitted(selector, "confirmed")
	selector.choose("hero_3")
	assert_false(selector._confirm_button.disabled)
	assert_eq(selector.selected, "hero_3")
	assert_string_contains(selector._selection_label.text, "Hero 3")
	selector.choose("hero_5")
	assert_eq(selector.selected, "hero_5", "one choice at a time")
	assert_false((selector._buttons["hero_3"] as Button).button_pressed, "the earlier choice was released")
	selector.confirm()
	assert_signal_emitted_with_parameters(selector, "confirmed", ["hero_5"])


func test_selector_starts_over_on_every_load() -> void:
	var selector: SelectorScreen = add_child_autofree(SelectorScreen.new())
	selector.load_choices(_candidates(3))
	selector.choose("hero_1")
	selector.load_choices(_candidates(2))
	assert_eq(selector.selected, "")
	assert_true(selector._confirm_button.disabled)
	assert_eq(selector.choice_count(), 2)
	selector.show_error("nope")
	assert_eq(selector._error_label.text, "nope")


# -- roster -------------------------------------------------------------------------------------------------


func test_roster_starts_from_the_preselected_party_in_order() -> void:
	var roster: RosterScreen = add_child_autofree(RosterScreen.new())
	roster.load_stage("1-3", 5, _candidates(6), ["Kera"] as Array[String], ["hero_2", "hero_0", "not_owned"] as Array[String])
	assert_eq(roster.selected, ["hero_2", "hero_0"] as Array[String], "unknown ids are dropped, the order is kept")
	assert_string_contains(roster.selection_text(), "1. Hero 2 > 2. Hero 0")
	assert_string_contains(roster.selection_text(), "Selected 2/5")
	assert_string_contains(roster._guests_label.text, "Kera")
	assert_string_contains(roster._title_label.text, "1-3")


func test_roster_toggles_in_pick_order_and_caps_at_the_party_size() -> void:
	var roster: RosterScreen = add_child_autofree(RosterScreen.new())
	roster.load_stage("1-3", 2, _candidates(4))
	roster.toggle("hero_3")
	roster.toggle("hero_1")
	assert_eq(roster.selected, ["hero_3", "hero_1"] as Array[String])
	roster.toggle("hero_0")
	assert_eq(roster.selected.size(), 2, "a third pick is refused")
	assert_string_contains(roster.error_text(), "at most 2")
	assert_false((roster._buttons["hero_0"] as Button).button_pressed, "and its button springs back")
	roster.toggle("hero_3")
	assert_eq(roster.selected, ["hero_1"] as Array[String])
	assert_eq(roster.error_text(), "", "a valid change clears the error")
	roster.toggle("hero_0")
	assert_eq(roster.selected, ["hero_1", "hero_0"] as Array[String], "a new pick goes last")


func test_roster_confirm_hands_over_a_copy_and_shows_the_callers_error() -> void:
	var roster: RosterScreen = add_child_autofree(RosterScreen.new())
	watch_signals(roster)
	roster.load_stage("2-1", 5, _candidates(3), [] as Array[String], ["hero_0"] as Array[String])
	roster.confirm()
	assert_signal_emitted_with_parameters(roster, "confirmed", [["hero_0"] as Array[String]])
	roster.show_error("Select 4 more owned hero(s).")
	assert_eq(roster.error_text(), "Select 4 more owned hero(s).")
	roster.load_stage("2-2", 5, _candidates(2))
	assert_eq(roster.error_text(), "", "a new stage starts clean")
	assert_string_contains(roster.selection_text(), "none selected")


# -- defeat -------------------------------------------------------------------------------------------------


func test_defeat_offers_retry_change_party_and_retreat() -> void:
	var defeat: DefeatScreen = add_child_autofree(DefeatScreen.new())
	watch_signals(defeat)
	defeat.load_result("3-2", true)
	assert_eq(defeat.title_text(), "Defeat")
	assert_eq(defeat.message_text(), "Stage 3-2 was not cleared.")
	assert_true(defeat.can_change_party())
	defeat._retry_button.pressed.emit()
	defeat._change_party_button.pressed.emit()
	defeat._retreat_button.pressed.emit()
	assert_signal_emit_count(defeat, "retry", 1)
	assert_signal_emit_count(defeat, "change_party", 1)
	assert_signal_emit_count(defeat, "retreat", 1)


func test_defeat_hides_change_party_for_a_fixed_party_and_takes_an_error_text() -> void:
	var defeat: DefeatScreen = add_child_autofree(DefeatScreen.new())
	defeat.load_result("1-1", false, "Something went wrong", "Stage 1-1 could not be completed.")
	assert_false(defeat.can_change_party())
	assert_true(defeat._change_party_button.disabled)
	assert_eq(defeat.title_text(), "Something went wrong")
	assert_eq(defeat.message_text(), "Stage 1-1 could not be completed.")
	defeat.load_result("1-2", true)
	assert_true(defeat.can_change_party(), "the next load brings it back")
	assert_eq(defeat.title_text(), "Defeat")


# -- hub and message ----------------------------------------------------------------------------------------


func test_hub_lists_the_given_entries_and_reports_the_pressed_one() -> void:
	var hub: HubScreen = add_child_autofree(HubScreen.new())
	watch_signals(hub)
	hub.load_hub("Silver Crowns 5", [{"id": "continue", "label": "Continue Story"}, {"id": "diagnostics", "label": "Diagnostics"}] as Array[Dictionary], "Welcome back")
	assert_eq(hub.entry_ids(), ["continue", "diagnostics"] as Array[String])
	assert_eq(hub.label_of("continue"), "Continue Story")
	assert_eq(hub.summary_text(), "Silver Crowns 5")
	assert_eq(hub.status_text(), "Welcome back")
	hub.press("diagnostics")
	assert_signal_emitted_with_parameters(hub, "chosen", ["diagnostics"])
	hub.load_hub("x", [{"id": "continue", "label": "Epilogue"}] as Array[Dictionary])
	assert_eq(hub.entry_ids(), ["continue"] as Array[String], "a reload replaces the menu")
	assert_eq(hub.label_of("continue"), "Epilogue")


func test_message_screen_shows_text_and_actions() -> void:
	var message: MessageScreen = add_child_autofree(MessageScreen.new())
	watch_signals(message)
	message.load_message("Update required", "Newer save.", [{"id": "retry", "label": "Try again"}] as Array[Dictionary])
	assert_eq(message.title_text(), "Update required")
	assert_eq(message.message_text(), "Newer save.")
	assert_true(message.has_action("retry"))
	message.press("retry")
	assert_signal_emitted_with_parameters(message, "chosen", ["retry"])
	message.load_message("Loading...", "")
	assert_false(message.has_action("retry"))


# -- battle -------------------------------------------------------------------------------------------------


func _unit(entity_id: String, team: String, hp: int, row: String = "front") -> Dictionary:
	return {"entity_id": entity_id, "team": team, "row": row, "slot_index": 0, "level": 4, "hp": hp, "max_hp": hp, "is_boss": false, "is_objective": false, "enemy_id": "", "objective_id": "", "temporary": false}


func _small_playback(stars: int = 3, outcome: String = "victory") -> BattlePlayback:
	var units: Array[Dictionary] = [_unit("mahmut", "player", 40), _unit("fadyme", "player", 30, "rear"), _unit("1-1:0:wolf:0", "enemy", 20)]
	var events: Array[Dictionary] = [
		{"type": "action_started", "actor_id": "mahmut", "round": 1, "skill_id": "strike", "action_type": "basic"},
		{"type": "damage_dealt", "source_id": "mahmut", "target_id": "1-1:0:wolf:0", "amount": 12, "hp": 8, "max_hp": 20, "alive": true, "critical": true, "blocked": false},
		{"type": "damage_dealt", "source_id": "mahmut", "target_id": "1-1:0:wolf:0", "amount": 8, "hp": 0, "max_hp": 20, "alive": false, "critical": false, "blocked": false},
	]
	var final_units: Array[Dictionary] = [
		{"entity_id": "mahmut", "team": "player", "hp": 40, "max_hp": 40, "alive": true, "level": 4, "temporary": false, "focus": 0, "statuses": []},
		{"entity_id": "fadyme", "team": "player", "hp": 30, "max_hp": 30, "alive": true, "level": 4, "temporary": false, "focus": 0, "statuses": []},
		{"entity_id": "1-1:0:wolf:0", "team": "enemy", "hp": 0, "max_hp": 20, "alive": false, "level": 4, "temporary": false, "focus": 0, "statuses": []},
	]
	return BattlePlayback.from_records(units, units, events, final_units, null, outcome, stars)


func test_battle_screen_shows_loading_then_replays_event_by_event() -> void:
	var battle: BattleScreen = add_child_autofree(BattleScreen.new())
	battle.show_loading("1-1  The Road That Whispers")
	assert_true(battle._loading_label.visible)
	assert_false(battle._field.visible)
	assert_false(battle.can_continue())

	battle.play(_small_playback())
	assert_false(battle._loading_label.visible)
	assert_true(battle._field.visible)
	assert_not_null(battle.card("mahmut"))
	assert_eq(battle.card("1-1:0:wolf:0").hp_text(), "HP 20 / 20")
	assert_true(battle.is_playing())
	battle.step()
	assert_eq(battle.log_text(), "mahmut uses strike.")
	battle.step()
	assert_eq(battle.card("1-1:0:wolf:0").hp_text(), "HP 8 / 20")
	assert_almost_eq(battle.card("1-1:0:wolf:0").bar_value(), 8.0, 0.001)
	assert_false(battle.can_continue(), "the result waits for the last event")
	battle.step()
	assert_eq(battle.card("1-1:0:wolf:0").hp_text(), "HP 0 / 20")
	assert_true(battle.can_continue())
	assert_eq(battle.result_text(), "Victory!  ★★★")
	assert_false(battle.is_playing())


func test_battle_screen_skip_speed_and_continue() -> void:
	var battle: BattleScreen = add_child_autofree(BattleScreen.new())
	watch_signals(battle)
	battle.play(_small_playback(2))
	assert_eq(battle.speed(), 1)
	battle.cycle_speed()
	assert_eq(battle.speed(), 2)
	assert_almost_eq(battle._timer.wait_time, BattleScreen.BASE_INTERVAL / 2.0, 0.001)
	battle.cycle_speed()
	battle.cycle_speed()
	assert_eq(battle.speed(), 1, "1x, 2x, 4x, back to 1x")
	battle.press_continue()
	assert_signal_not_emitted(battle, "finished", "Continue is not there before the result")
	battle.skip()
	assert_true(battle._timer.is_stopped())
	assert_eq(battle.card("1-1:0:wolf:0").hp_text(), "HP 0 / 20", "skip shows the final state")
	assert_eq(battle.result_text(), "Victory!  ★★")
	battle.press_continue()
	assert_signal_emit_count(battle, "finished", 1)
	assert_true(battle.handle_back(), "the battle cannot be backed out of")


func test_battle_screen_reports_a_defeat_and_the_floaters_do_not_pile_up() -> void:
	var battle: BattleScreen = add_child_autofree(BattleScreen.new())
	battle.play(_small_playback(0, "defeat"))
	battle.skip()
	assert_eq(battle.result_text(), "Defeat")
	battle.play(_small_playback())
	assert_eq(battle._floaters.get_child_count(), 0, "a new replay starts with a clear floating-text layer")
	assert_eq(battle.card("mahmut").status_text(), "")


func test_battle_screen_replays_on_its_own_timer() -> void:
	var battle: BattleScreen = add_child_autofree(BattleScreen.new())
	battle.play(_small_playback())
	battle.cycle_speed()
	battle.cycle_speed()
	assert_eq(battle.speed(), 4)
	await wait_until(battle.can_continue, 5.0, "the timer plays every event and shows the result by itself")
	assert_eq(battle.result_text(), "Victory!  ★★★")
	assert_true(battle._timer.is_stopped())
