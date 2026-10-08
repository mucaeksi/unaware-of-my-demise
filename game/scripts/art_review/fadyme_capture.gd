extends Node
## Deferred runtime capture avoids long synchronous MCP evals. Local sample only.
var done: bool = false
var result: Dictionary = {}
const OUT: String = "F:/unaware-of-my-demise/build/fadyme-pilot-20261008/"

func _ready() -> void:
	_run.call_deferred()

func _save(pilot: Control, filename: String) -> void:
	pilot.get_viewport().get_texture().get_image().save_png(OUT + filename)

func _run() -> void:
	var pilot: Control = get_tree().root.get_node("LocalUiPreview/FadymePilot")
	pilot.show_mode("arena")
	var battle: BattleScreen = pilot._battle
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	_save(pilot, "battle-idle-final.png")
	var moments: Dictionary = {3:"basic",7:"active",13:"ultimate",16:"victory"}
	var seen: Dictionary = {}
	var samples: Array[Dictionary] = []
	var deadline: int = Time.get_ticks_msec() + 15000
	while Time.get_ticks_msec() < deadline:
		await get_tree().process_frame
		var cursor: int = battle.playback.cursor()
		if moments.has(cursor) and not seen.has(cursor):
			seen[cursor] = true
			await RenderingServer.frame_post_draw
			_save(pilot, "battle-%s.png" % str(moments[cursor]))
			var actor: BattleActor = battle._arena.actors["fadyme"]
			samples.append({"cursor":cursor,"expected":moments[cursor],"state":actor.animation_state,"hp":battle.card("fadyme").hp_text(),"ground":str(actor.position),"result":battle.result_text()})
		if battle.playback.is_finished():
			break
	result["battle"] = samples
	var initial: Array[Dictionary] = []
	for team: String in ["player","enemy"]:
		for slot: int in range(5):
			initial.append({"entity_id":"%s_slot_%d" % [team,slot],"team":team,"row":"front" if slot < 2 else "rear","slot_index":slot,"hp":100,"max_hp":100,"alive":true})
	var model: BattlePlayback = BattlePlayback.from_records(initial,initial,[],initial,null)
	for view: BattlePlayback.UnitView in model.units:
		view.art_id = ("mahmut" if view.row == "front" else "fadyme") if view.team == "player" else ("bellbound_dead" if view.row == "front" else "hollow_pilgrim")
		view.display_name = "Slot %d" % (view.slot_index + 1)
	battle.play(model,"Formation capacity · Local layout test")
	battle._timer.stop()
	await get_tree().process_frame
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	_save(pilot,"formation-5v5.png")
	var positions: Array[Dictionary] = []
	for view: BattlePlayback.UnitView in model.units:
		var actor: BattleActor = battle._arena.actors[view.entity_id]
		positions.append({"id":view.entity_id,"team":view.team,"row":view.row,"ground":str(actor.position),"hud":str(actor.card.get_global_rect()),"facing_right":actor.facing_right,"texture":actor._sprite.texture != null})
	result["formation"] = positions
	# Real animation on every pose, held long enough for art review.
	pilot.show_mode("poses")
	pilot._pose_timer.stop()
	for index: int in range(8):
		pilot.show_pose(index)
		await get_tree().create_timer(0.10).timeout
		await RenderingServer.frame_post_draw
		_save(pilot,"pose-%s.png" % BattleArt.STATES[index])
	var file: FileAccess = FileAccess.open(OUT + "capture-final.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(result,"\t"))
	done = true
	pilot.show_mode("poses")
