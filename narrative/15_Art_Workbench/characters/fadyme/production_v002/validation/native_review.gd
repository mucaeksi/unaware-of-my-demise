extends SceneTree

func _initialize() -> void:
	_run.call_deferred()

func _capture(path: String) -> void:
	await process_frame
	await RenderingServer.frame_post_draw
	var shot: Image = root.get_texture().get_image()
	assert(shot.save_png(path) == OK)

func _run() -> void:
	root.size = Vector2i(1080, 720)
	var backdrop: ColorRect = ColorRect.new()
	backdrop.color = Color(0.09, 0.085, 0.12, 1.0)
	backdrop.size = Vector2(1080, 720)
	root.add_child(backdrop)
	DirAccess.make_dir_recursive_absolute("user://fadyme-review-evidence")
	var packed: PackedScene = load("res://animation/fadyme_animation_v002.tscn")
	assert(packed != null)
	var actor: Node2D = packed.instantiate()
	actor.position = Vector2(540, 560)
	root.add_child(actor)
	var player: AnimationPlayer = actor.get_node("AnimationPlayer")
	var checked: Array[Dictionary] = []
	for name: StringName in player.get_animation_list():
		var clip: Animation = player.get_animation(name)
		assert(clip.get_track_count() == 5)
		for track: int in range(clip.get_track_count()):
			assert(clip.track_get_type(track) == Animation.TYPE_VALUE)
		player.play(name)
		for phase: float in [0.0, 0.33, 0.65, 1.0]:
			player.seek(clip.length * phase, true)
			player.pause()
			var sprite: Sprite2D = actor.get_node("Motion/Sprite")
			assert(sprite.texture != null)
			assert(sprite.scale.x > 0.0)
			await process_frame
		player.play(name)
		player.seek(clip.length * 0.55, true)
		player.pause()
		await _capture("user://fadyme-review-evidence/animation_%s.png" % name)
		checked.append({"clip": str(name), "duration": clip.length, "phases_sampled": 4})
	# Interruption simulation: explicit defeat wins, no scheduled return callbacks.
	player.play("ultimate")
	player.seek(0.52, true)
	player.play("defeat")
	player.seek(0.68, true)
	player.pause()
	assert(player.assigned_animation == &"defeat")
	actor.queue_free()
	await process_frame
	var effects: Array[Dictionary] = []
	for name: String in ["veilglass_thorn", "borrowed_hour", "a_smile_kept", "bell_that_forgets", "ally_restore", "ally_cleanse"]:
		var scene: PackedScene = load("res://vfx/%s_v002.tscn" % name)
		assert(scene != null)
		var effect: Node2D = scene.instantiate()
		effect.position = Vector2(540, 360)
		root.add_child(effect)
		var anim: AnimationPlayer = effect.get_node("AnimationPlayer")
		var mat: ShaderMaterial = effect.get_node("Visual").material
		var sec: float = anim.get_animation("effect").length
		for reduced: bool in [false, true]:
			mat.set_shader_parameter("reduced_motion", reduced)
			anim.play("effect")
			anim.seek(sec * 0.45, true)
			anim.pause()
			assert(abs(float(mat.get_shader_parameter("progress")) - 0.45) < 0.001)
			await _capture("user://fadyme-review-evidence/vfx_%s_%s.png" % [name, "reduced" if reduced else "normal"])
		anim.play("effect")
		anim.seek(sec, true)
		anim.pause()
		assert(float(mat.get_shader_parameter("progress")) > 0.999)
		assert(effect.get_node("Spark").modulate.a < 0.001)
		await _capture("user://fadyme-review-evidence/vfx_%s_end.png" % name)
		effects.append({"effect": name, "duration": sec, "normal_and_reduced_rendered": true, "end_progress": mat.get_shader_parameter("progress")})
		effect.queue_free()
		await process_frame
	var locomotion_scene: PackedScene = load("res://animation/fadyme_locomotion_v002.tscn")
	var locomotion: Node2D = locomotion_scene.instantiate()
	locomotion.position = Vector2(540, 560)
	root.add_child(locomotion)
	var animated: AnimatedSprite2D = locomotion.get_node("AnimatedSprite2D")
	var frame_checks: Array[Dictionary] = []
	for state: StringName in [&"walk", &"idle"]:
		animated.animation = state
		animated.pause()
		var frames: SpriteFrames = animated.sprite_frames
		for index: int in range(frames.get_frame_count(state)):
			animated.frame = index
			var texture: AtlasTexture = frames.get_frame_texture(state, index)
			assert(texture.get_size() == Vector2(360, 350))
			var source: Image = texture.atlas.get_image()
			var bottom: int = int(texture.region.end.y) - 4
			var foot_global: float = animated.position.y + (texture.margin.position.y + float(bottom) - texture.region.position.y + 1.0) * animated.scale.y
			assert(abs(foot_global) < 1.1)
			await _capture("user://fadyme-review-evidence/frame_%s_%02d.png" % [state, index])
			frame_checks.append({"animation": str(state), "frame": index, "core_ground_delta_px": foot_global})
	# Direct last-to-first seam review evidence; drawings remain candidate.
	locomotion.queue_free()
	await process_frame
	var result: Dictionary = {"godot": Engine.get_version_info(), "renderer": ProjectSettings.get_setting("rendering/renderer/rendering_method"), "animation_clips": checked, "locomotion_frames": frame_checks, "effect_scenes": effects, "interruption_fixture": "ultimate interrupted by terminal defeat; no method tracks", "runtime_integration": false, "android_device_acceptance": "not_measured"}
	var output: FileAccess = FileAccess.open("user://fadyme-review-evidence/native_review.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(result, "\t"))
	output.close()
	print("FADYME_NATIVE_REVIEW_OK: %d clips; %d effects; normal/reduced/end snapshots" % [checked.size(), effects.size()])
	quit(0)
