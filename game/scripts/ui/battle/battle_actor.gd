class_name BattleActor
extends Control
## Grounded pose animation driven by replay cues. Key poses + procedural motion;
## this is deliberately not represented as a finished frame-by-frame animation set.

const ART_SIZE: float = 176.0
const HitFx = preload("res://scripts/ui/battle/battle_hit_fx.gd")
var entity_id: String = ""
var art_id: String = ""
var facing_right: bool = true
var animation_state: String = "idle"
var alive: bool = true
var art_size: float = ART_SIZE
var max_visual_width: float = INF
var is_objective: bool = false
var card: UnitCard = null
var _locomotion: AnimatedSprite2D
var _sprite: Sprite2D = null
var _fallback: Label = null
var _motion: Tween = null
var _reaction: Tween = null
var _pace: float = 1.0
var _clock: float = 0.0
var _fx: float = 0.0
var _hit_fx: HitFx = null

static func create(view: BattlePlayback.UnitView) -> BattleActor:
	var actor: BattleActor = BattleActor.new()
	actor.entity_id = view.entity_id
	actor.art_id = view.art_id
	actor.facing_right = view.team == "player"
	actor.is_objective = view.is_objective
	actor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	actor.size = Vector2(180, 320)
	actor._build(view)
	return actor

func _build(view: BattlePlayback.UnitView) -> void:
	_sprite = Sprite2D.new()
	_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	add_child(_sprite)
	var locomotion_path: String = str(BattleArt.actor_data(art_id).get("locomotion", ""))
	if not locomotion_path.is_empty():
		_locomotion = AnimatedSprite2D.new()
		_locomotion.sprite_frames = load(locomotion_path) as SpriteFrames
		_locomotion.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		_locomotion.centered = false
		add_child(_locomotion)
	_hit_fx = HitFx.new()
	_hit_fx.name = "ImpactFx"
	_hit_fx.position = Vector2(0, -80)
	add_child(_hit_fx)
	_fallback = UiKit.label(view.display_name.left(1).to_upper(), "", false)
	_fallback.add_theme_font_size_override("font_size", 72)
	_fallback.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_fallback.position = Vector2(-40, -160)
	_fallback.size = Vector2(80, 100)
	add_child(_fallback)
	card = UnitCard.create(view, true)
	card.position = Vector2(-card.custom_minimum_size.x * 0.5, 14)
	card.size = Vector2(card.custom_minimum_size.x, 0)
	add_child(card)
	_set_pose("idle")
	refresh(view)

func _ready() -> void:
	_set_pose(animation_state)
	call_deferred("_fit_hud")

func _fit_hud() -> void:
	# Controls can grow before their font/theme overrides settle; explicitly shrink
	# the absolute-positioned HUD once its final minimum size has been computed.
	card.reset_size()
	card.position.x = -card.size.x * 0.5

func _process(delta: float) -> void:
	_clock += delta * _pace
	_fx = maxf(0.0, _fx - delta * _pace * 1.7)
	if animation_state == "idle" and _sprite.texture != null and not UiPageTransition.reduced_for(self) and (_locomotion == null or not _locomotion.visible):
		var scalar: float = _render_size() / _sprite.texture.get_height()
		var breath: float = 1.0 + sin(_clock * 2.1) * 0.009
		_sprite.scale = Vector2(scalar, scalar * breath)
		_sprite.position.y = -_render_size() * (_foot_y() - 0.5) * breath
	queue_redraw()

func set_art_size(pixels: float) -> void:
	art_size = pixels
	_set_pose(animation_state)

func _foot_y() -> float:
	var spec: Dictionary = BattleArt.actor_data(art_id)
	return float(spec.get("foot_y_by_state", {}).get(animation_state, spec.get("foot_y", 0.88)))

func _render_size() -> float:
	var pixels: float = art_size * float(BattleArt.actor_data(art_id).get("pose_scale_by_state", {}).get(animation_state, 1.0))
	if _sprite != null and _sprite.texture != null:
		pixels = minf(pixels, max_visual_width * _sprite.texture.get_height() / maxf(1.0, _sprite.texture.get_width()))
	return pixels

func _draw() -> void:
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(1.0, 0.30))
	draw_circle(Vector2.ZERO, 43.0, Color(0.015, 0.01, 0.025, 0.40))
	draw_set_transform(Vector2.ZERO)
	if _fx > 0.0:
		var tone: Color = Color(0.81,0.69,0.42,_fx*0.8) if art_id == "mahmut" else (Color(0.76,0.60,1.0,_fx*0.8) if facing_right else Color(0.9,0.44,0.35,_fx*0.8))
		var radius: float = 40+(1.0-_fx)*55
		if art_id == "mahmut":
			var center: Vector2 = Vector2(0,-80)
			draw_polyline(PackedVector2Array([center+Vector2(-radius,-radius),center+Vector2(radius,-radius),center+Vector2(radius*0.7,radius*0.5),center+Vector2(0,radius),center+Vector2(-radius*0.7,radius*0.5),center+Vector2(-radius,-radius)]),tone,3,true)
		else: draw_arc(Vector2(0,-80),radius,0,TAU,40,tone,3,true)

func _set_pose(state: String) -> void:
	animation_state = state
	if _locomotion != null:
		_locomotion.visible = state in ["idle", "walk"] and not UiPageTransition.reduced_for(self)
		if _locomotion.visible:
			_locomotion.play(state)
			_locomotion.speed_scale = _pace
			_locomotion.flip_h = not facing_right
			var frame_scale: float = art_size / 350.0
			_locomotion.scale = Vector2.ONE * frame_scale
			_locomotion.position = Vector2(-180.0, -347.0) * frame_scale
		else:
			_locomotion.stop()
	var art: AtlasTexture = BattleArt.pose(art_id, state)
	_sprite.texture = art
	_sprite.rotation = 0.0
	_sprite.visible = art != null and (_locomotion == null or not _locomotion.visible)
	_fallback.visible = art == null and not is_objective
	if art == null:
		_fallback.position = Vector2(-art_size * 0.25, -art_size * 0.8)
		_fallback.size = Vector2(art_size * 0.5, art_size * 0.6)
		_fallback.add_theme_font_size_override("font_size", clampi(int(art_size * 0.35), 24, 88))
		return
	var spec: Dictionary = BattleArt.actor_data(art_id)
	var source_right: bool = str(spec.get("facing", "right")) == "right"
	_sprite.flip_h = source_right != facing_right
	var scalar: float = _render_size() / art.get_height()
	_sprite.scale = Vector2(scalar, scalar)
	# Origin is the feet, so resizing and any mirrored animation keep ground contact.
	_sprite.position = Vector2(0, -_render_size() * (_foot_y() - 0.5))
	var pivot_x: float = float(spec.get("pivot_x_by_state", {}).get(state, 0.5))
	_sprite.position.x = (0.5 - pivot_x) * art.get_width() * scalar * (1.0 if not _sprite.flip_h else -1.0)

func refresh(view: BattlePlayback.UnitView) -> void:
	visible = view.on_field
	var was_alive: bool = alive
	alive = view.alive
	card.refresh(view)
	if not alive and was_alive:
		_cancel_motion()
		if _reaction != null and _reaction.is_valid(): _reaction.kill()
		modulate = Color.WHITE
		_sprite.modulate = Color(0.72, 0.70, 0.76, 0.85)
		animate("defeat",_pace,false)

func animate(state: String, pace: float = 1.0, return_to_idle: bool = true) -> void:
	if not alive and state != "defeat":
		return
	set_pace(pace)
	if UiPageTransition.reduced_for(self):
		_cancel_motion()
		_set_pose(state)
		return
	if state == "hit" and _hit_fx != null:
		_hit_fx.position.y = -art_size * 0.42
		_hit_fx.burst(art_size / ART_SIZE, pace)
	if state == "hit" and _motion != null and _motion.is_valid() and animation_state in ["basic", "active", "ultimate"]:
		# Hit feedback is a separate layer; another ready actor cannot cancel this cast.
		if _reaction != null and _reaction.is_valid(): _reaction.kill()
		modulate = Color(1.3, 0.75, 0.8)
		_reaction = create_tween()
		_reaction.set_speed_scale(pace)
		_reaction.tween_property(self, "modulate", Color.WHITE, 0.28)
		return
	_cancel_motion()
	_set_pose(state)
	if not is_inside_tree():
		return
	var direction: float = 1.0 if facing_right else -1.0
	var base_position: Vector2 = _sprite.position
	var base_scale: Vector2 = _sprite.scale
	var duration: float = 1.5 if state == "ultimate" else (1.15 if state == "active" else 1.0)
	_motion = create_tween()
	_motion.set_speed_scale(pace)
	if state == "walk":
		for stride: int in range(2):
			_motion.tween_property(_sprite,"position",base_position+Vector2(direction*12,-5),duration*0.15).set_trans(Tween.TRANS_SINE)
			_motion.tween_property(_sprite,"position",base_position,duration*0.15).set_trans(Tween.TRANS_SINE)
	elif state == "basic":
		var melee: bool = art_id == "mahmut"
		_motion.tween_property(_sprite,"position:x",base_position.x-direction*(9 if melee else 3),duration*0.16).set_trans(Tween.TRANS_SINE)
		_motion.parallel().tween_property(_sprite,"rotation",-direction*(0.05 if melee else 0.025),duration*0.16)
		_motion.tween_property(_sprite,"position",base_position+Vector2(direction*(30 if melee else 8),-3 if melee else -5),duration*0.14).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		_motion.parallel().tween_property(_sprite,"rotation",direction*(0.06 if melee else 0.025),duration*0.14)
	elif state == "hit":
		_motion.tween_property(_sprite, "position:x", base_position.x - direction * 13.0, duration * 0.25)
		_motion.parallel().tween_property(_sprite,"rotation",-direction*0.045,duration*0.25)
	elif state == "defeat":
		_motion.tween_property(_sprite,"position:y",base_position.y+7,duration*0.6).set_trans(Tween.TRANS_SINE)
		_motion.parallel().tween_property(_sprite,"modulate:a",0.64,duration*0.6)
		return
	elif state in ["active", "ultimate"]:
		_fx = 1.0
		var stone: bool = art_id == "mahmut"
		_motion.tween_property(_sprite,"position:y",base_position.y+(5 if stone else -7),duration*0.25).set_trans(Tween.TRANS_SINE)
		_motion.parallel().tween_property(_sprite,"scale",base_scale*Vector2(1.02,0.98 if stone else 1.02),duration*0.25)
		_motion.parallel().tween_property(_sprite,"modulate",Color(1.35,1.19,0.96) if stone else Color(1.25,1.1,1.45),duration*0.25)
	elif state == "victory":
		_motion.tween_property(_sprite,"position:y",base_position.y-6,duration*0.3).set_trans(Tween.TRANS_SINE)
	else:
		_motion.tween_interval(duration * 0.3)
	_motion.tween_property(_sprite, "position", base_position, duration * 0.7)
	_motion.parallel().tween_property(_sprite, "modulate", Color.WHITE, duration * 0.7)
	_motion.parallel().tween_property(_sprite,"rotation",0.0,duration*0.7)
	_motion.parallel().tween_property(_sprite,"scale",base_scale,duration*0.7)
	if state != "victory" and return_to_idle:
		_motion.tween_callback(func() -> void:
			if alive:
				_set_pose("idle")
		)

func set_pace(value: float) -> void:
	_pace = maxf(0.01,value)
	if _locomotion != null: _locomotion.speed_scale = _pace
	if _hit_fx != null: _hit_fx.set_pace(_pace)
	if _motion != null and _motion.is_valid(): _motion.set_speed_scale(_pace)
	if _reaction != null and _reaction.is_valid(): _reaction.set_speed_scale(_pace)

func _cancel_motion() -> void:
	_fx = 0.0
	if _motion != null and _motion.is_valid():
		_motion.kill()
	if _sprite != null and _sprite.texture != null:
		_sprite.position.x = 0

func _exit_tree() -> void:
	_cancel_motion()
	if _reaction != null and _reaction.is_valid(): _reaction.kill()
