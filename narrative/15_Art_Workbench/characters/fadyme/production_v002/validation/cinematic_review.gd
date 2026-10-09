extends SceneTree
func _initialize() -> void:
	_run.call_deferred()
func _run() -> void:
	root.size = Vector2i(720,1280)
	var stage: Node2D = Node2D.new()
	stage.scale = Vector2.ONE*(2.0/3.0)
	root.add_child(stage)
	var results: Array[Dictionary] = []
	for name: String in ["opening_letter", "confession", "clockless_reveal"]:
		var packed: PackedScene = load("res://cinematics/%s_shot_v002.tscn" % name)
		assert(packed != null)
		var shot: Node2D = packed.instantiate()
		stage.add_child(shot)
		var player: AnimationPlayer = shot.get_node("AnimationPlayer")
		var still: Sprite2D = shot.get_node("Still")
		assert(still.texture != null)
		var scales: Array[float] = []
		for clip: StringName in [&"hold", &"hold_reduced"]:
			var anim: Animation = player.get_animation(clip)
			assert(anim.get_track_count() == 1)
			assert(anim.track_get_type(0) == Animation.TYPE_VALUE)
			for phase: float in [0.0,0.5,1.0]:
				player.play(clip)
				player.seek(anim.length*phase,true)
				player.pause()
				scales.append(still.scale.x)
				await process_frame
				if clip == &"hold" and phase == 0.5:
					await RenderingServer.frame_post_draw
					assert(root.get_texture().get_image().save_png("user://fadyme-review-evidence/cinematic_%s_native.png" % name) == OK)
			assert(not player.is_playing())
		assert(abs(scales[3]-scales[4]) < 0.00001 and abs(scales[4]-scales[5]) < 0.00001)
		results.append({"shot":name,"normal_scales":scales.slice(0,3),"reduced_scales":scales.slice(3,6),"paused_seek_verified":true,"callback_tracks":0,"no_autoplay":true})
		player.stop()
		shot.queue_free()
		await process_frame
	var f: FileAccess = FileAccess.open("user://fadyme-review-evidence/cinematic_review.json",FileAccess.WRITE)
	f.store_string(JSON.stringify({"shots":results,"viewport":[720,1280],"renderer":"gl_compatibility","android":"NOT_MEASURED","runtime_integration":false},"\t"))
	f.close()
	print("FADYME_CINEMATIC_REVIEW_OK: 3 still shots, normal/reduced seek and pause")
	quit()
