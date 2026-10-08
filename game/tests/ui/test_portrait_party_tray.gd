extends GutTest
const Pilot = preload("res://scripts/art_review/fadyme_pilot.gd")

func test_five_slots_keep_real_formation_positions_and_empty_slots_cannot_cast() -> void:
	var battle: BattleScreen = add_child_autofree(BattleScreen.new())
	battle.play(Pilot.sample_live(),"Party portraits")
	battle._timer.stop()
	assert_eq(battle._skill_tray.get_child_count(),5)
	var occupied: int = 0
	for slot: int in range(5):
		var tile: Node = battle._skill_tray.get_child(slot)
		var button: Button = tile.get("ultimate") as Button
		if bool(button.get("occupied")):
			occupied += 1
			assert_not_null(button.get("mark"),"An occupied slot has a face texture")
			assert_eq((tile.get("view") as BattlePlayback.UnitView).slot_index,slot)
		else:
			assert_true(button.disabled)
			assert_eq(button.focus_mode,Control.FOCUS_NONE)
	assert_eq(occupied,2)

func test_ready_portrait_emits_its_character_and_all_inputs_lock_during_cut_in() -> void:
	var battle: BattleScreen = add_child_autofree(BattleScreen.new())
	battle.play(Pilot.sample_live(),"Party portraits")
	battle._timer.stop()
	battle.advance_time(26)
	var mahmut: Button = battle._skill_tray.get_child(0).get("ultimate") as Button
	var fadyme: Button = battle._skill_tray.get_child(2).get("ultimate") as Button
	assert_false(mahmut.disabled)
	assert_false(fadyme.disabled)
	mahmut.pressed.emit()
	assert_eq(battle._cinematic._entity_id,"mahmut")
	assert_true(mahmut.disabled)
	assert_true(fadyme.disabled)
	assert_almost_eq(battle.effective_pace(),0.1,0.0001)
