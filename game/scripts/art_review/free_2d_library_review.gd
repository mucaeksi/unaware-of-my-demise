extends "res://scripts/art_review/gdquest_vfx_review.gd"
## Additional licensed 2D sources; no production scene or plugin activation.
const REFERENCES: String = "res://assets/third_party/reference/"

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
	_label(column, "FREE 2D / SOURCE STUDY", 43, Color("eee6ff"))
	_label(column, "9 collections · CC0 / MIT / attributed icons\nReference library · Compatibility renderer", 26, Color("aab4d1"))
	var grid: GridContainer = GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 20)
	grid.add_theme_constant_override("v_separation", 20)
	column.add_child(grid)
	var aura: SubViewport = _tile(grid, "01  Official aura", "MIT shader / our character art")
	var aura_material: ShaderMaterial = _shader("godot-sprite-shaders/aura.gdshader")
	aura_material.set_shader_parameter("aura_width", 7.0)
	aura_material.set_shader_parameter("aura_color", Color("b998ff"))
	_sprite(aura, BattleArt.icon("fadyme"), Color.WHITE, aura_material)
	var spark: SubViewport = _tile(grid, "02  Kenney particles", "CC0 · impacts / skill accents")
	_sprite(spark, load(REFERENCES + "kenney-particles/spark_01.png") as Texture2D, Color("ceb0ff"))
	var smoke: SubViewport = _tile(grid, "03  Kenney smoke", "CC0 · bounded CPU particles")
	var emitter: CPUParticles2D = CPUParticles2D.new()
	emitter.position = Vector2(220, 235)
	emitter.amount = 12
	emitter.lifetime = 2.0
	emitter.preprocess = 1.0
	emitter.texture = load(REFERENCES + "kenney-smoke/PNG/White puff/whitePuff01.png") as Texture2D
	emitter.direction = Vector2.UP
	emitter.spread = 28
	emitter.gravity = Vector2.ZERO
	emitter.initial_velocity_min = 24
	emitter.initial_velocity_max = 55
	emitter.scale_amount_min = 0.30
	emitter.scale_amount_max = 0.65
	emitter.color = Color(0.7,0.68,0.82,0.35)
	var opacity: Gradient = Gradient.new()
	opacity.colors = PackedColorArray([Color(1,1,1,0), Color.WHITE, Color(1,1,1,0)])
	opacity.offsets = PackedFloat32Array([0,0.25,1])
	emitter.color_ramp = opacity
	smoke.add_child(emitter)
	var vortex: SubViewport = _tile(grid, "04  VFX portal shader", "MIT · needs effect composition")
	var vortex_material: ShaderMaterial = _shader("godot-vfx-shaders/portal_vortex.gdshader")
	vortex_material.set_shader_parameter("vortex_speed", 0.55)
	_sprite(vortex, load(REFERENCES + "kenney-particles/twirl_01.png") as Texture2D, Color.WHITE, vortex_material)
	var weapon: SubViewport = _tile(grid, "05  Weapon / skill icons", "Delapouite · CC BY 3.0")
	_sprite(weapon, load(REFERENCES + "game-icons/delapouite/ancient-sword.svg") as Texture2D, Color("dfce9a"))
	var outline: SubViewport = _tile(grid, "06  Official outline", "MIT · silhouette readability")
	var outline_material: ShaderMaterial = _shader("godot-sprite-shaders/outline.gdshader")
	outline_material.set_shader_parameter("outline_width", 6.0)
	outline_material.set_shader_parameter("outline_color", Color("ffda8d"))
	_sprite(outline, BattleArt.icon("mahmut"), Color.WHITE, outline_material)
	_label(column, "Original characters / chibis remain our generated art.\nUnused collections are excluded from AAB and content exports.", 24, Color("98a6c3"))
	var back: Button = Button.new()
	back.text = "Return to character preview"
	back.custom_minimum_size.y = 80
	back.add_theme_font_size_override("font_size", 30)
	back.pressed.connect(_close_review)
	column.add_child(back)

func _process(_delta: float) -> void:
	pass

func _shader(relative: String) -> ShaderMaterial:
	var shader_material: ShaderMaterial = ShaderMaterial.new()
	shader_material.shader = load(REFERENCES + relative) as Shader
	return shader_material

func _sprite(viewport: SubViewport, texture: Texture2D, tint: Color, shader_material: ShaderMaterial = null) -> void:
	var sprite: Sprite2D = Sprite2D.new()
	sprite.texture = texture
	sprite.modulate = tint
	sprite.material = shader_material
	sprite.position = Vector2(TILE_SIZE) * 0.5
	sprite.scale = Vector2.ONE * (235.0 / maxf(texture.get_width(), texture.get_height()))
	viewport.add_child(sprite)
