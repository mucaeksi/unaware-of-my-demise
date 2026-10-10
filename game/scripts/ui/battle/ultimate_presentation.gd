extends Control
## Real presentation time; the encounter and its actors run at 0.1 during this.
signal impact(entity_id: String)
const DURATION: float = 1.8
var _portrait: TextureRect
var _title: Label
var _speaker: Label
var _tone: Color
var _entity_id: String
var _stone: bool
var _elapsed: float = 0.0
var _active: bool = false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	_portrait = TextureRect.new()
	_portrait.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_portrait)
	_speaker = UiKit.label("","",false)
	BattleHudStyle.label(_speaker,34)
	add_child(_speaker)
	_title = UiKit.label("","",true)
	BattleHudStyle.label(_title,48)
	add_child(_title)

func begin(view: BattlePlayback.UnitView) -> void:
	_entity_id = view.entity_id
	_tone = BattleHudStyle.accent(view)
	_stone = view.art_id == "mahmut"
	_speaker.text = view.display_name.to_upper()
	_title.text = ""
	for skill: ContentModels.Skill in view.skills:
		if skill.type == "ultimate": _title.text = skill.name_en
	_portrait.texture = BattleArt.ultimate(view.art_id)
	_elapsed = 0
	_active = true
	visible = true
	set_process(true)
	_layout()

func cancel() -> void:
	_active = false
	visible = false
	set_process(false)

func _layout() -> void:
	var reveal: float = 1.0 if UiPageTransition.reduced_for(self) else clampf(_elapsed/0.32,0,1)
	var eased: float = 1.0 if UiPageTransition.reduced_for(self) else 1.0-pow(1.0-reveal,3)
	_portrait.position = Vector2(size.x*(0.12+(1.0-eased)*0.28),size.y*0.12)
	_portrait.size = Vector2(size.x*0.76,size.y*0.62)
	_portrait.modulate.a = minf(reveal*1.5,1)
	_speaker.position = Vector2(size.x*0.10,size.y*0.72)
	_speaker.size = Vector2(size.x*0.80,60)
	_speaker.modulate = _tone
	_title.position = Vector2(size.x*0.10,size.y*0.76)
	_title.size = Vector2(size.x*0.80,size.y*0.13)
	modulate.a = clampf((DURATION-_elapsed)/0.22,0,1)

func _process(delta: float) -> void:
	if not _active: return
	_elapsed += delta
	_layout()
	queue_redraw()
	if _elapsed >= DURATION:
		var id: String = _entity_id
		cancel()
		impact.emit(id)

func _draw() -> void:
	if not _active: return
	draw_rect(Rect2(Vector2.ZERO,size),Color(0.018,0.01,0.035,0.78))
	if UiPageTransition.reduced_for(self): return
	var center: Vector2 = size*Vector2(0.5,0.42)
	var radius: float = size.x*(0.30+clampf(_elapsed/DURATION,0,1)*0.10)
	if _stone:
		var corners: PackedVector2Array = PackedVector2Array([center+Vector2(-radius,-radius*0.8),center+Vector2(radius,-radius*0.8),center+Vector2(radius*0.72,radius*0.5),center+Vector2(0,radius),center+Vector2(-radius*0.72,radius*0.5),center+Vector2(-radius,-radius*0.8)])
		draw_polyline(corners,Color(_tone,0.65),4,true)
	else:
		for ring: int in range(3):
			draw_arc(center,radius+ring*22,_elapsed*0.28+ring,_elapsed*0.28+ring+TAU*0.80,80,Color(_tone,0.48-ring*0.10),3,true)
	draw_line(Vector2(size.x*0.1,size.y*0.705),Vector2(size.x*0.9,size.y*0.705),Color(_tone,0.7),2,true)
