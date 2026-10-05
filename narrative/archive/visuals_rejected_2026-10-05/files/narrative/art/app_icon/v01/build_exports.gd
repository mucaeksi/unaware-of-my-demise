extends SceneTree
## Technical Android canvas packing and size exports; original generated art is retained.
## Run with an empty Godot project to avoid game/autoload/network startup.

const INK := Color("0b0d11")
const CANVAS := 1728 # High-resolution composition; never upscale a 432px Android layer into the master.
const ADAPTIVE_SIZE := 432
const CONTENT_CENTER := Vector2(627, 625)
const CONTENT_RADIUS := 532.0 # Source pixels with alpha > 8, including circlet/clapper.
const SAFE_RADIUS_DP := 30.0 # 3dp inward from the Android 66dp safe-circle boundary.

func _initialize() -> void:
	var repo := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--repo="):
			repo = arg.trim_prefix("--repo=")
	if repo.is_empty():
		push_error("Pass --repo=/absolute/path/to/unaware-of-my-demise")
		quit(1)
		return
	var base := repo.path_join("narrative/art/app_icon/v01")
	var source := Image.load_from_file(base.path_join("source/foreground.png"))
	if source == null or source.is_empty():
		push_error("Generated source foreground is missing")
		quit(1)
		return
	source.convert(Image.FORMAT_RGBA8)
	var ratio := float(CANVAS) * SAFE_RADIUS_DP / 108.0 / CONTENT_RADIUS
	var packed_size := Vector2i(roundi(source.get_width() * ratio), roundi(source.get_height() * ratio))
	var packed := source.duplicate() as Image
	packed.resize(packed_size.x, packed_size.y, Image.INTERPOLATE_LANCZOS)
	var offset := Vector2i(roundi(CANVAS / 2.0 - CONTENT_CENTER.x * ratio), roundi(CANVAS / 2.0 - CONTENT_CENTER.y * ratio))
	var foreground := Image.create_empty(CANVAS, CANVAS, false, Image.FORMAT_RGBA8)
	foreground.fill(Color.TRANSPARENT)
	foreground.blit_rect(packed, Rect2i(Vector2i.ZERO, packed_size), offset)
	var background := Image.create_empty(CANVAS, CANVAS, false, Image.FORMAT_RGBA8)
	background.fill(INK)
	var monochrome := Image.new()
	var svg_error := monochrome.load_svg_from_string(FileAccess.get_file_as_string(base.path_join("source/monochrome.svg")), float(CANVAS) / ADAPTIVE_SIZE)
	if svg_error != OK:
		push_error("Monochrome SVG load failed")
		quit(1)
		return
	var full := background.duplicate() as Image
	full.blend_rect(foreground, Rect2i(Vector2i.ZERO, Vector2i(CANVAS, CANVAS)), Vector2i.ZERO)
	# Android's nominal visible viewport is the central 72dp of the 108dp layers.
	var inset := CANVAS / 6
	var visible_size := CANVAS * 2 / 3
	var visible := full.get_region(Rect2i(inset, inset, visible_size, visible_size))
	var exports := base.path_join("exports")
	DirAccess.make_dir_recursive_absolute(exports)
	var adaptive := repo.path_join("game/assets/marks/game/mark_game_adaptive_icon_v001")
	DirAccess.make_dir_recursive_absolute(adaptive)
	for entry in [{"name": "foreground", "image": foreground}, {"name": "background", "image": background}, {"name": "monochrome", "image": monochrome}]:
		var img: Image = entry.image.duplicate()
		img.resize(ADAPTIVE_SIZE, ADAPTIVE_SIZE, Image.INTERPOLATE_LANCZOS)
		if not _save(img, exports.path_join(entry.name + "_432.png")) or not _save(img, adaptive.path_join(entry.name + ".png")):
			quit(1)
			return
	for size in [1024, 512, 192, 64, 48, 32]:
		var icon := visible.duplicate() as Image
		icon.resize(size, size, Image.INTERPOLATE_LANCZOS)
		icon.convert(Image.FORMAT_RGB8) # Opaque, square, no baked launcher radius/shadow.
		if not _save(icon, exports.path_join("app_icon_%d.png" % size)):
			quit(1)
			return
		if size == 512:
			if not _save(icon, repo.path_join("game/assets/marks/game/mark_game_app_icon_v001.png")):
				quit(1)
				return
		if size == 192:
			if not _save(icon, adaptive.path_join("legacy.png")):
				quit(1)
				return
	var record := {"engine": Engine.get_version_info().string, "source_px": source.get_size(), "composition_canvas_px": CANVAS, "adaptive_canvas_px": ADAPTIVE_SIZE, "master_input_viewport_px": visible_size, "source_content_center_px": CONTENT_CENTER, "source_visible_radius_px": CONTENT_RADIUS, "visible_alpha_threshold": 8, "safe_radius_dp": SAFE_RADIUS_DP, "packed_image_px": packed_size, "offset_px": offset, "source_scale": ratio, "nominal_android_viewport": {"layer_dp": 108, "visible_dp": 72, "safe_diameter_dp": 66}, "legacy_composition": "central 72dp of the high-resolution adaptive composition on Ink; 1152px downsampled to 1024px", "generation_source_unchanged": true, "art_retouch": false, "technical_export": "Godot Image Lanczos canvas placement, normal Android resampling and opaque backdrop composition", "note": "Very faint generated alpha <=8 is retained rather than retouched; identifying motif alpha>8 is tested in the 66dp safe circle. 1024 master is not enlarged from any 432/512px file."}
	var f := FileAccess.open(base.path_join("EXPORT_GEOMETRY.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(record, "  ") + "\n")
	f.close()
	print("APP_ICON_EXPORTS_OK: 1024 master, opaque Play 512, legacy 192, adaptive foreground/background/monochrome 432 and 32/48/64 previews")
	quit(0)

func _save(img: Image, path: String) -> bool:
	var error := img.save_png(path)
	if error != OK:
		push_error("Failed to save %s: %s" % [path, error_string(error)])
		return false
	return true
