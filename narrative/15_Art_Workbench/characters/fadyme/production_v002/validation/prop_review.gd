extends SceneTree
func _initialize() -> void:
	_run.call_deferred()
func _run() -> void:
	root.size = Vector2i(1080,720)
	var bg: ColorRect = ColorRect.new()
	bg.size = Vector2(1080,720)
	bg.color = Color(0.08,0.08,0.12)
	root.add_child(bg)
	var results: Array[Dictionary] = []
	for group: String in ["props", "ui"]:
		var file: String = "prop_regions.json" if group == "props" else "skill_icon_regions.json"
		var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://%s/%s" % [group,file]))
		var nodes: Array[Node] = []
		var i: int = 0
		for row: Dictionary in data["entries"]:
			var texture: AtlasTexture = load("res://%s/%s" % [group,row["atlas_texture"]])
			assert(texture != null)
			var sprite: Sprite2D = Sprite2D.new()
			sprite.texture = texture
			var cap: float = 230.0 if group == "props" else 240.0
			var scale_factor: float = cap/maxf(texture.get_width(),texture.get_height())
			sprite.scale = Vector2.ONE*scale_factor
			sprite.position = Vector2(140.0+float(i%4)*265.0,190.0+float(floori(float(i)/4.0))*330.0)
			root.add_child(sprite)
			nodes.append(sprite)
			results.append({"resource": row["atlas_texture"], "loaded": true})
			i += 1
		await process_frame
		await RenderingServer.frame_post_draw
		assert(root.get_texture().get_image().save_png("user://fadyme-review-evidence/%s_atlas_native.png" % group) == OK)
		for n: Node in nodes:
			n.queue_free()
		await process_frame
	var icon_data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://ui/skill_icon_regions.json"))
	for cap: float in [48.0, 96.0]:
		var small_nodes: Array[Node] = []
		var n: int = 0
		for row: Dictionary in icon_data["entries"]:
			var texture: AtlasTexture = load("res://ui/%s" % row["atlas_texture"])
			var sprite: Sprite2D = Sprite2D.new()
			sprite.texture = texture
			sprite.scale = Vector2.ONE*(cap/maxf(texture.get_width(),texture.get_height()))
			sprite.position = Vector2(140+n*265,360)
			root.add_child(sprite)
			small_nodes.append(sprite)
			n += 1
		await process_frame
		await RenderingServer.frame_post_draw
		assert(root.get_texture().get_image().save_png("user://fadyme-review-evidence/icons_%dpx.png" % int(cap)) == OK)
		for node: Node in small_nodes:
			node.queue_free()
		await process_frame
	var f: FileAccess = FileAccess.open("user://fadyme-review-evidence/prop_review.json",FileAccess.WRITE)
	f.store_string(JSON.stringify({"loaded_atlas_resources":results,"runtime_integration":false},"\t"))
	f.close()
	print("FADYME_PROP_REVIEW_OK")
	quit()
