extends SceneTree
## Developer-only mask/size board. Uses Android's real 432px layers at a nominal 72dp window.

const MASK_SHADER := """
shader_type canvas_item;
uniform int mask_kind = 0;
uniform bool themed = false;
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float edge = max(abs(p.x), abs(p.y));
	if (mask_kind == 1) { edge = length(p); }
	if (mask_kind == 2) { vec2 q = abs(p) - vec2(0.72); edge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) + 0.72; }
	if (mask_kind == 3) { edge = pow(pow(abs(p.x), 4.0) + pow(abs(p.y), 4.0), 0.25); }
	float cover = 1.0 - smoothstep(1.0 - fwidth(edge), 1.0, edge);
	vec4 mark = texture(TEXTURE, UV * (2.0 / 3.0) + vec2(1.0 / 6.0));
	vec3 bg = themed ? vec3(0.22, 0.24, 0.29) : vec3(0.043137, 0.050980, 0.066667);
	vec3 fg = themed ? vec3(0.90, 0.85, 0.77) : mark.rgb;
	COLOR = vec4(mix(bg, fg, mark.a), cover);
}
"""

var _repo := ""
var _surface: Control
var _color: Texture2D
var _mono: Texture2D
var _shader: Shader

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--repo="):
			_repo = arg.trim_prefix("--repo=")
	call_deferred("_render")

func _render() -> void:
	if _repo.is_empty():
		push_error("Pass --repo=/absolute/repo")
		quit(1)
		return
	var base := _repo.path_join("narrative/art/app_icon/v01")
	_color = ImageTexture.create_from_image(Image.load_from_file(base.path_join("exports/foreground_432.png")))
	_mono = ImageTexture.create_from_image(Image.load_from_file(base.path_join("exports/monochrome_432.png")))
	_shader = Shader.new()
	_shader.code = MASK_SHADER
	_surface = Control.new()
	_surface.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(_surface)
	var bg := ColorRect.new()
	bg.color = Color("11141b")
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_surface.add_child(bg)
	_label("UNAWARE OF MY DEMISE", Vector2(64, 48), Vector2(952, 72), 44)
	_label("Android app icon / v01", Vector2(64, 122), Vector2(952, 44), 30)
	_card("CIRCLE", Vector2(64, 205), 1, false)
	_card("ROUNDED SQUARE", Vector2(566, 205), 2, false)
	_card("SQUIRCLE", Vector2(64, 730), 3, false)
	_card("ANDROID THEMED", Vector2(566, 730), 2, true)
	_label("ACTUAL PIXEL SIZES", Vector2(64, 1270), Vector2(952, 40), 26)
	for entry in [{"size": 64, "x": 184}, {"size": 48, "x": 512}, {"size": 32, "x": 840}]:
		var s: int = entry.size
		_icon(Vector2(entry.x, 1380 - s / 2), Vector2(s, s), 2, false)
		_label("%d px" % s, Vector2(entry.x - 40, 1435), Vector2(144, 44), 24)
	_label("432px adaptive layers / nominal 72dp visible window", Vector2(64, 1510), Vector2(952, 36), 22)
	_label("Godot mask simulation / device launcher verification pending", Vector2(64, 1550), Vector2(952, 34), 20)
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	var output := base.path_join("previews/app_icon_review_1080x1600.png")
	var image := root.get_texture().get_image()
	if image.get_size() != Vector2i(1080, 1600) or image.save_png(output) != OK:
		push_error("Unexpected capture dimensions or save failure")
		quit(1)
		return
	print("APP_ICON_REVIEW_OK: real 1080x1600 Godot render; circle/rounded/squircle/themed and 32/48/64px")
	quit(0)

func _card(title: String, pos: Vector2, kind: int, themed: bool) -> void:
	var panel := Panel.new()
	panel.position = pos
	panel.size = Vector2(450, 480)
	var style := StyleBoxFlat.new()
	style.bg_color = Color("1b1e26")
	style.set_corner_radius_all(12)
	panel.add_theme_stylebox_override("panel", style)
	_surface.add_child(panel)
	_label(title, pos + Vector2(28, 18), Vector2(394, 42), 24)
	_icon(pos + Vector2(33, 78), Vector2(384, 384), kind, themed)

func _icon(pos: Vector2, dimensions: Vector2, kind: int, themed: bool) -> void:
	var rect := TextureRect.new()
	rect.position = pos
	rect.size = dimensions
	rect.texture = _mono if themed else _color
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_SCALE
	var material := ShaderMaterial.new()
	material.shader = _shader
	material.set_shader_parameter("mask_kind", kind)
	material.set_shader_parameter("themed", themed)
	rect.material = material
	_surface.add_child(rect)

func _label(copy: String, pos: Vector2, dimensions: Vector2, font_size: int) -> void:
	var label := Label.new()
	label.text = copy
	label.position = pos
	label.size = dimensions
	label.add_theme_color_override("font_color", Color("ede3d2"))
	label.add_theme_font_size_override("font_size", font_size)
	_surface.add_child(label)
