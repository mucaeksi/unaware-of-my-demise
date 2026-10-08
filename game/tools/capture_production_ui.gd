extends Node
## Exact-size offscreen render avoids desktop window clamping on portrait/tall QA captures.
## godot --path game res://tools/capture_production_ui.tscn -- --ui-size=720x1600 --ui-page=components --ui-capture=F:/.../review.png
func _ready() -> void:
	var target: Vector2i = Vector2i(1080, 1920)
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--ui-size="):
			var parts: PackedStringArray = argument.trim_prefix("--ui-size=").split("x")
			if parts.size() == 2:
				target = Vector2i(int(parts[0]), int(parts[1]))
	assert(target.x > 0 and target.y > 0)
	var viewport: SubViewport = SubViewport.new()
	viewport.size = target
	var scale: float = minf(float(target.x) / 1080.0, float(target.y) / 1920.0)
	viewport.size_2d_override = Vector2i(roundi(target.x / scale), roundi(target.y / scale))
	viewport.size_2d_override_stretch = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var scene: PackedScene = load("res://scenes/art_review/production_ui_preview.tscn") as PackedScene
	viewport.add_child(scene.instantiate())
	var display: TextureRect = TextureRect.new()
	display.texture = viewport.get_texture()
	display.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	display.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	display.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(display)
