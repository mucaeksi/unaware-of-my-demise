extends Control
## Isolated development gallery. Uses MIT shaders and procedural Godot textures only.
const LIBRARY: String = "res://assets/vfx/gdquest_reference/shaders/"
const TILE_SIZE: Vector2i = Vector2i(440, 300)
var _burst: ShaderMaterial
var _ring: ShaderMaterial
var _elapsed: float = 0.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var background: ColorRect = ColorRect.new()
	background.color = Color("0c1020")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	var margin: MarginContainer = MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side: String in ["left", "top", "right", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 46)
	add_child(margin)
	var column: VBoxContainer = VBoxContainer.new()
	column.add_theme_constant_override("separation", 20)
	margin.add_child(column)
	_label(column, "GDQUEST / VFX STUDY", 43, Color("eee6ff"))
	_label(column, "Reference only · Compatibility renderer\nMIT shaders + procedural textures", 26, Color("aab4d1"))
	var grid: GridContainer = GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 20)
	grid.add_theme_constant_override("v_separation", 20)
	column.add_child(grid)
	var vortex: SubViewport = _tile(grid, "01  Vortex", "Ultimate / area spell")
	var vortex_material: ShaderMaterial = _material("effects/2d_vortex/source/2d_vortex.gdshader")
	vortex_material.set_shader_parameter("speed", 0.6)
	_quad(vortex, vortex_material, Color("9c5dff"), Vector2(280, 280))
	var trail: SubViewport = _tile(grid, "02  Star trail", "Weapon / projectile motion")
	var trail_material: ShaderMaterial = _material("effects/2d_trail/preview/material/star_trail.gdshader")
	trail_material.set_shader_parameter("alpha_curve", _gradient([Color(1,1,1), Color(0,0,0)]))
	trail_material.set_shader_parameter("base_color", _gradient([Color("bffbff"), Color("3d65b0")]))
	trail_material.set_shader_parameter("band_gradient", _gradient([Color.BLACK, Color.WHITE, Color.BLACK]))
	var line: Line2D = Line2D.new()
	line.width = 25
	line.texture_mode = Line2D.LINE_TEXTURE_STRETCH
	line.texture = _gradient([Color.WHITE, Color.WHITE])
	line.material = trail_material
	line.begin_cap_mode = Line2D.LINE_CAP_ROUND
	line.end_cap_mode = Line2D.LINE_CAP_ROUND
	for index: int in range(64):
		var progress: float = float(index) / 63.0
		line.add_point(Vector2(45 + 350 * progress, 150 + sin(progress * TAU) * 65))
	trail.add_child(line)
	var burst: SubViewport = _tile(grid, "03  Explosion core", "Layered impact foundation")
	_burst = _material("effects/2d_explosion/source/materials/explosion.gdshader")
	var noise: FastNoiseLite = FastNoiseLite.new()
	noise.seed = 241
	noise.frequency = 0.035
	var noise_texture: NoiseTexture2D = NoiseTexture2D.new()
	noise_texture.width = 256
	noise_texture.height = 256
	noise_texture.seamless = true
	noise_texture.noise = noise
	_burst.set_shader_parameter("noise_sampler", noise_texture)
	_burst.set_shader_parameter("gradient", _gradient([Color("ffd67d"), Color("ff8c57"), Color("ffdfab")]))
	_burst.set_shader_parameter("edge_gradient", _gradient([Color.WHITE, Color.WHITE, Color.BLACK], PackedFloat32Array([0, 0.35, 1])))
	_quad(burst, _burst, Color.WHITE, Vector2(300, 300))
	var ring: SubViewport = _tile(grid, "04  Shockwave ring", "Ultimate impact accent")
	_ring = _material("effects/2d_explosion/source/materials/explosion_red_circle.gdshader")
	_ring.set_shader_parameter("color", Vector3(0.5, 0.95, 0.82))
	_ring.set_shader_parameter("edge_gradient", _gradient([Color.BLACK, Color.BLACK, Color.WHITE, Color.WHITE, Color.BLACK], PackedFloat32Array([0, 0.32, 0.36, 0.40, 0.44])))
	_quad(ring, _ring, Color.WHITE, Vector2(290, 290))
	var eye: SubViewport = _tile(grid, "05  Procedural eye", "Creature detail / study")
	var eye_material: ShaderMaterial = _material("effects/2d_eyeball/source/eyeball.gdshader")
	eye_material.set_shader_parameter("eye_color", Vector3(0.9, 0.9, 0.95))
	eye_material.set_shader_parameter("light_color", Vector3(1.0, 0.9, 0.7))
	eye_material.set_shader_parameter("shadow_color", Vector3(0.28, 0.25, 0.4))
	eye_material.set_shader_parameter("iris_color", Vector3(0.65, 0.25, 0.85))
	_quad(eye, eye_material, Color.WHITE, Vector2(255, 255))
	var vignette: SubViewport = _tile(grid, "06  Vignette", "Novel / ultimate framing")
	var base: ColorRect = ColorRect.new()
	base.size = Vector2(TILE_SIZE)
	base.color = Color("426777")
	vignette.add_child(base)
	var vignette_material: ShaderMaterial = _material("to_sort/shaders/vignette.gdshader")
	vignette_material.set_shader_parameter("vignette_gradient", _gradient([Color.BLACK, Color.BLACK, Color.WHITE], PackedFloat32Array([0, 0.22, 0.7])))
	_quad(vignette, vignette_material, Color.BLACK, Vector2(TILE_SIZE))
	_label(column, "NOT CONNECTED TO BATTLES · EXCLUDED FROM AAB / PATCH\nOriginal art remains in the separate reference project.", 24, Color("98a6c3"))
	var back: Button = Button.new()
	back.text = "Return to character preview"
	back.custom_minimum_size.y = 80
	back.add_theme_font_size_override("font_size", 30)
	back.pressed.connect(_close_review)
	column.add_child(back)

func _process(delta: float) -> void:
	_elapsed += delta
	var phase: float = fmod(_elapsed, 2.4) / 2.4
	_burst.set_shader_parameter("time", phase * 1.5)
	_burst.set_shader_parameter("offset", 1.25 - phase * 0.72)
	_ring.set_shader_parameter("opacity", (1.0 - phase) * 0.9)

func _tile(grid: GridContainer, title: String, note: String) -> SubViewport:
	var panel: PanelContainer = PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = Color("171e33")
	style.set_corner_radius_all(16)
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 14
	style.content_margin_bottom = 16
	panel.add_theme_stylebox_override("panel", style)
	grid.add_child(panel)
	var column: VBoxContainer = VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	panel.add_child(column)
	var viewport: SubViewport = SubViewport.new()
	viewport.size = TILE_SIZE
	viewport.transparent_bg = true
	viewport.disable_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	column.add_child(viewport)
	var image: TextureRect = TextureRect.new()
	image.texture = viewport.get_texture()
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	image.custom_minimum_size = Vector2(420, 300)
	column.add_child(image)
	_label(column, title, 30, Color("e9eaff"))
	_label(column, note, 23, Color("9daeca"))
	return viewport

func _quad(viewport: SubViewport, shader_material: ShaderMaterial, tint: Color, dimensions: Vector2) -> void:
	var quad: ColorRect = ColorRect.new()
	quad.position = (Vector2(TILE_SIZE) - dimensions) * 0.5
	quad.size = dimensions
	quad.color = tint
	quad.material = shader_material
	viewport.add_child(quad)

func _material(relative: String) -> ShaderMaterial:
	var shader_material: ShaderMaterial = ShaderMaterial.new()
	shader_material.shader = load(LIBRARY + relative) as Shader
	return shader_material

func _gradient(colors: Array[Color], offsets: PackedFloat32Array = PackedFloat32Array()) -> GradientTexture1D:
	var gradient: Gradient = Gradient.new()
	if offsets.is_empty():
		for index: int in range(colors.size()):
			offsets.append(float(index) / float(colors.size() - 1))
	gradient.offsets = offsets
	gradient.colors = PackedColorArray(colors)
	var texture: GradientTexture1D = GradientTexture1D.new()
	texture.gradient = gradient
	texture.width = 256
	return texture

func _label(parent: Node, text: String, font_size: int, tint: Color) -> void:
	var label: Label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", tint)
	parent.add_child(label)

func _close_review() -> void:
	var window: Window = get_window()
	var pilot: Control = window.get_node_or_null("FadymePilot") as Control
	if pilot != null:
		pilot.show()
	window.title = str(window.get_meta("vfx_previous_title", "UOMD · Local UI Preview"))
	queue_free()
