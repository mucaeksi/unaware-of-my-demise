extends Button
## A face portrait is the single Ultimate touch target; rings belong to its element.
const PortraitShader = preload("res://shaders/party_portrait.gdshader")
var focus: int = 0
var tone: Color = BattleHudStyle.LIGHT_EDGE
var mark: Texture2D
var stone: bool = false
var charged: bool = false
var occupied: bool = true
var defeated: bool = false
var _clock: float = 0.0
var _portrait: TextureRect
var _material: ShaderMaterial

func _ready() -> void:
	# At the compact 720-wide fixture five touch targets still fit inside the
	# safe area. The circle itself stays capped by the 144-unit row height.
	custom_minimum_size = Vector2(96,144)
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	for state: String in ["normal","hover","pressed","disabled"]:
		add_theme_stylebox_override(state,StyleBoxEmpty.new())
	add_theme_stylebox_override("focus",StyleBoxEmpty.new())
	_portrait = TextureRect.new()
	_portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_portrait.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_portrait.stretch_mode = TextureRect.STRETCH_SCALE
	_portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_material = ShaderMaterial.new()
	_material.shader = PortraitShader
	_portrait.material = _material
	add_child(_portrait)
	resized.connect(_layout_portrait)
	_layout_portrait()

func _layout_portrait() -> void:
	if _portrait == null: return
	var extent: float = minf(size.x,size.y)*0.77
	_portrait.size = Vector2.ONE*extent
	_portrait.position = (size-_portrait.size)*0.5

func _process(delta: float) -> void:
	_clock += delta
	if _portrait != null:
		_portrait.texture = mark
		_portrait.visible = occupied and mark != null
		_material.set_shader_parameter("brightness",0.35 if defeated else (1.08 if charged else 0.86))
	queue_redraw()

func _draw() -> void:
	var center: Vector2 = size*0.5
	var radius: float = minf(size.x,size.y)*0.40
	var edge: Color = tone if occupied else BattleHudStyle.EDGE.darkened(0.35)
	if charged and not defeated:
		var pulse: float = 0.65 if UiPageTransition.reduced_for(self) else 0.55+sin(_clock*3.5)*0.20
		for ring: int in range(4):
			draw_arc(center,radius+5+ring*3,0,TAU,72,Color(edge,pulse/float(ring+2)),3,true)
	draw_circle(center,radius,Color("#15101f"))
	draw_arc(center,radius,0,TAU,72,Color(edge,0.30 if occupied else 0.18),3,true)
	if focus > 0 and occupied and not defeated:
		draw_arc(center,radius+1,-PI/2,-PI/2+TAU*clampf(float(focus)/100.0,0,1),72,edge,4,true)
	draw_arc(center,radius-5,0,TAU,72,Color(edge,0.35),1,true)
	if not occupied:
		draw_circle(center,3,Color(edge,0.5))
	elif mark == null:
		draw_arc(center,radius*0.35,0,TAU,36,Color(edge,0.65),2,true)
	if has_focus() and not disabled:
		draw_arc(center,radius+10,0,TAU,72,Color(edge,0.9),2,true)
	if is_hovered() and not disabled:
		draw_arc(center,radius+4,0,TAU,72,edge.lightened(0.2),2,true)
