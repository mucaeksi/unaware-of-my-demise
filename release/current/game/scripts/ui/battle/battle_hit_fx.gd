extends Node2D
## Two CC0 sprite layers, allocated once per actor; no gameplay timing or damage changes.
const SPARK: Texture2D = preload("res://assets/vfx/kenney_impacts/spark_01.png")
const LIGHT: Texture2D = preload("res://assets/vfx/kenney_impacts/light_01.png")
const DURATION: float = 0.34
var _spark: Sprite2D
var _halo: Sprite2D
var _age: float = 0.0
var _pace: float = 1.0
var _span: float = 1.0

func _ready() -> void:
	var additive: CanvasItemMaterial = CanvasItemMaterial.new()
	additive.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_halo = Sprite2D.new()
	_halo.texture = LIGHT
	_halo.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_halo.material = additive
	add_child(_halo)
	_spark = Sprite2D.new()
	_spark.texture = SPARK
	_spark.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_spark.material = additive
	add_child(_spark)
	hide()
	set_process(false)

func burst(span: float, pace: float) -> void:
	if not is_inside_tree():
		return
	_span = clampf(span, 0.7, 1.8)
	_age = 0.0
	set_pace(pace)
	show()
	set_process(true)
	_update_layers()

func set_pace(pace: float) -> void:
	_pace = maxf(0.01, pace)

func _process(delta: float) -> void:
	_age += delta * _pace
	if _age >= DURATION:
		hide()
		set_process(false)
		return
	_update_layers()

func _update_layers() -> void:
	var progress: float = _age / DURATION
	var opacity: float = pow(1.0 - progress, 2.0)
	_halo.scale = Vector2.ONE * lerpf(32.0, 84.0, progress) * _span / LIGHT.get_width()
	_halo.modulate = Color(0.9, 0.72, 0.48, opacity * 0.55)
	_spark.scale = Vector2.ONE * lerpf(62.0, 88.0, progress) * _span / SPARK.get_width()
	_spark.modulate = Color(1.0, 0.89, 0.68, opacity * 0.8)
