class_name UiPageTransition
extends Control
## GPU-frozen outgoing page, slow eclipse fade and drifting veil. Routing and verified state commit immediately.
const PAGE_SECONDS: float = 3.2
const UTILITY_SECONDS: float = 2.6
const PHASE_SECONDS: float = 1.4
const VEIL_PATH: String = "res://assets/ui/narrative/v002/page_reveal.gdshader"

var duration: float = PAGE_SECONDS
var progress: float = 0.0
var _target: Control = null
var _veil: ColorRect = null
var _material: ShaderMaterial = null
var _tween: Tween = null
var _previous: Control = null
var _snapshot: SubViewport = null

static func reduced_for(target: Node) -> bool:
	var ancestor: Node = target
	while ancestor != null:
		if bool(ancestor.get_meta("ui_reduced_motion", false)):
			return true
		ancestor = ancestor.get_parent()
	return false

static func is_revealing(target: Node) -> bool:
	var ancestor: Node = target
	while ancestor != null:
		if ancestor.has_meta("ui_page_reveal_id"): return true
		ancestor = ancestor.get_parent()
	return false

static func reveal(target: Control, seconds: float = PAGE_SECONDS, previous: Control = null) -> UiPageTransition:
	if not target.is_inside_tree():
		if previous != null: previous.free()
		return null
	for child: Node in target.get_children():
		if child is UiPageTransition:
			(child as UiPageTransition).finish()
	if reduced_for(target) or seconds <= 0.0:
		if previous != null: previous.free()
		return null
	var effect: UiPageTransition = UiPageTransition.new()
	effect.duration = seconds
	effect._previous = previous
	target.add_child(effect)
	return effect


## Copy native drawing state only. No scripts, signals, player commands or CPU framebuffer readback.
static func visual_copy(source: Control) -> Control:
	var image: Control = source.duplicate(0) as Control
	var ancestor: Node = source
	while ancestor != null:
		if ancestor is Control and (ancestor as Control).theme != null:
			image.theme = (ancestor as Control).theme
			break
		ancestor = ancestor.get_parent()
	_prepare_visual(image)
	image.process_mode = Node.PROCESS_MODE_DISABLED
	return image

static func _prepare_visual(node: Node) -> void:
	if node is Control:
		(node as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
		(node as Control).focus_mode = Control.FOCUS_NONE
	if node is CanvasItem and (node as CanvasItem).material != null:
		(node as CanvasItem).material = (node as CanvasItem).material.duplicate(false)
	for child: Node in node.get_children(true):
		if bool(child.get_meta("ui_transition_layer", false)):
			child.free()
		else:
			_prepare_visual(child)

static func finish_under(root: Node) -> void:
	for child: Node in root.get_children():
		if child is UiPageTransition:
			(child as UiPageTransition).finish()
		else:
			finish_under(child)

func _ready() -> void:
	set_meta("ui_transition_layer", true)
	_target = get_parent() as Control
	_target.set_meta("ui_page_reveal_id",get_instance_id())
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	focus_mode = Control.FOCUS_NONE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_material = ShaderMaterial.new()
	# The short-lived effect owns the shader; global script constants must not retain a GPU resource.
	_material.shader = load(VEIL_PATH) as Shader
	_veil = ColorRect.new()
	_veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_veil.focus_mode = Control.FOCUS_NONE
	_veil.z_index = 100
	_veil.material = _material
	add_child(_veil)
	_target.resized.connect(_resize)
	_resize()
	_set_progress(0.0)
	if _previous != null: _freeze_previous()
	_tween = create_tween()
	_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_tween.tween_method(_set_progress, 0.0, 1.0, duration)
	_tween.tween_callback(finish)

func _freeze_previous() -> void:
	var logical: Vector2i = Vector2i(_target.size)
	if logical.x < 1 or logical.y < 1: logical = Vector2i(_previous.size)
	logical = Vector2i(maxi(1, logical.x), maxi(1, logical.y))
	var scale_factor: Vector2 = _target.get_viewport().get_stretch_transform().get_scale().abs()
	_snapshot = SubViewport.new()
	_snapshot.name = "PreviousPageFrame"
	_snapshot.size = Vector2i(maxi(1, roundi(logical.x * scale_factor.x)), maxi(1, roundi(logical.y * scale_factor.y)))
	_snapshot.size_2d_override = logical
	_snapshot.size_2d_override_stretch = true
	_snapshot.gui_disable_input = true
	_snapshot.render_target_update_mode = SubViewport.UPDATE_ONCE
	_snapshot.render_target_clear_mode = SubViewport.CLEAR_MODE_ONCE
	add_child(_snapshot)
	_previous.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_snapshot.add_child(_previous)
	_material.set_shader_parameter("previous_page", _snapshot.get_texture())
	_material.set_shader_parameter("has_previous", true)
	await RenderingServer.frame_post_draw
	if is_instance_valid(_previous): _previous.queue_free()
	_previous = null
	_snapshot.render_target_update_mode = SubViewport.UPDATE_DISABLED

func _resize() -> void:
	_veil.size = _target.size

func _set_progress(value: float) -> void:
	progress = value
	_material.set_shader_parameter("progress", value)

func finish() -> void:
	_clear_reveal_state()
	if _tween != null and _tween.is_valid():
		_tween.kill()
	if _veil != null:
		_veil.hide()
	queue_free()

func _exit_tree() -> void:
	_clear_reveal_state()
	if _previous != null and not _previous.is_inside_tree(): _previous.free()
	if _tween != null and _tween.is_valid():
		_tween.kill()

func _clear_reveal_state() -> void:
	if is_instance_valid(_target) and int(_target.get_meta("ui_page_reveal_id",0)) == get_instance_id():
		_target.remove_meta("ui_page_reveal_id")
