extends Node
## Development-only captures and independent contact/perspective measurements.
const Player = preload("res://scripts/ui/entry/entry_prologue.gd")
const BEATS: Dictionary = {"names": 12.0, "ordinary_days": 26.0, "throne_wars": 38.0,
	"roads": 66.0, "search": 82.0, "reunion": 96.0, "beginning": 108.0}

func run(directory: String) -> void:
	set_meta("status", "capturing")
	var records: Array[Dictionary] = []
	for configuration: Dictionary in [
		{"name": "normal", "size": Vector2i(1080, 1920), "scale": 1.0},
		{"name": "large", "size": Vector2i(1080, 1920), "scale": 1.25},
		{"name": "tall-large", "size": Vector2i(1080, 2400), "scale": 1.25}]:
		var output: String = directory.path_join(str(configuration["name"]))
		DirAccess.make_dir_recursive_absolute(output)
		var viewport: SubViewport = SubViewport.new()
		viewport.size = configuration["size"]
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		get_tree().root.add_child(viewport)
		var player: Player = Player.new()
		player.theme = UiTheme.create(float(configuration["scale"]))
		viewport.add_child(player)
		for identifier: String in BEATS:
			player.play()
			player.set_process(false)
			player.advance(float(BEATS[identifier]))
			if player._previous_shot != null:
				player._previous_shot.free()
				player._previous_shot = null
			player._shot.modulate.a = 1.0
			player._text.visible_characters = -1
			player._text.modulate.a = 1.0
			player._caption.modulate.a = 1.0
			player.set_transfer(5242880, 20971520)
			for frame: int in 4: await get_tree().process_frame
			for second: float in [0.0, 5.0, 10.0]:
				player._shot.update_time(second)
				await RenderingServer.frame_post_draw
				viewport.get_texture().get_image().save_png(output.path_join(identifier + "-" + str(int(second)) + ".png"))
				var shot: Control = player._shot
				var contacts: Array[Dictionary] = []
				for actor: Sprite2D in shot.get("_actors"):
					if not actor.has_meta("sole_pivot"): continue
					var dimensions: Vector2 = actor.region_rect.size if actor.region_enabled else actor.texture.get_size()
					var pivot: Vector2 = actor.get_meta("sole_pivot")
					var foot: Vector2 = shot.get_global_transform().affine_inverse() * actor.to_global(pivot * dimensions + actor.offset)
					contacts.append({"pixel": foot, "height": dimensions.y * actor.scale.y,
						"visible": (shot.get("focus_area") as Rect2).has_point(foot)})
				records.append({"configuration": configuration["name"], "shot": identifier,
					"seconds": second, "contacts": contacts, "pose": shot.call("evidence"),
					"download_percent": player._progress.value})
		viewport.queue_free()
		await get_tree().process_frame
	var file: FileAccess = FileAccess.open(directory.path_join("contacts.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify({"frames": records}, "\t"))
	file.close()
	set_meta("status", "complete")
