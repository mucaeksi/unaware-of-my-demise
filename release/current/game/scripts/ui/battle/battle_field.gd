class_name BattleField
extends Control
## Portrait-phone arena: player left -> right; enemy right -> left.
## Logical Front/Rear slots remain engine-owned. Later waves share their slot.

var actors: Dictionary = {}
var _views: Array[BattlePlayback.UnitView] = []
var _background: TextureRect = null

func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(_layout)

func populate(views: Array[BattlePlayback.UnitView], environment: String = "forest_whispering_ash") -> void:
	for child: Node in get_children():
		remove_child(child)
		child.queue_free()
	actors.clear()
	_views = views
	_background = TextureRect.new()
	_background.texture = BattleArt.background(environment)
	if _background.texture == null and Game.assets != null:
		var reference: String = "background/%s/battle" % environment
		if Game.assets.has_art(reference):
			_background.texture = Game.assets.texture(reference)
	_background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_background)
	for view: BattlePlayback.UnitView in views:
		var actor: BattleActor = BattleActor.create(view)
		actors[view.entity_id] = actor
		add_child(actor)
	_layout()

func ensure_views(views: Array[BattlePlayback.UnitView]) -> void:
	_views = views
	var added: bool = false
	for view: BattlePlayback.UnitView in views:
		if actors.has(view.entity_id): continue
		var actor: BattleActor = BattleActor.create(view)
		actors[view.entity_id] = actor
		add_child(actor)
		added = true
	if added: _layout()

static func slot_position(view: BattlePlayback.UnitView, views: Array[BattlePlayback.UnitView]) -> Vector2:
	# A large boss receives the middle of its side. Up to four regular escorts
	# occupy the upper/lower corners, rather than sharing the boss silhouette.
	var bosses: Array[int] = []
	for other: BattlePlayback.UnitView in views:
		if other.team == view.team and other.is_boss and not bosses.has(other.slot_index):
			bosses.append(other.slot_index)
	if not bosses.is_empty():
		bosses.sort()
		var mirrored: bool = view.team == "player"
		var objectives: Array[int] = []
		for other: BattlePlayback.UnitView in views:
			if other.team == view.team and other.is_objective and not objectives.has(other.slot_index):
				objectives.append(other.slot_index)
		objectives.sort()
		if view.is_boss:
			var boss_rank: int = maxi(0, bosses.find(view.slot_index))
			var boss_y: float = (0.61 if objectives.is_empty() else 0.65) if bosses.size() == 1 else lerpf(0.44, 0.84, float(boss_rank) / float(bosses.size() - 1))
			return Vector2(0.23 if mirrored else 0.77, boss_y)
		if view.is_objective:
			var objective_rank: int = maxi(0, objectives.find(view.slot_index))
			var objective_x: float = 0.64 + 0.22 * float(objective_rank % 2)
			return Vector2(1.0 - objective_x if mirrored else objective_x, 0.035 + 0.065 * floorf(float(objective_rank) / 2.0))
		var escorts: Array[int] = []
		for other: BattlePlayback.UnitView in views:
			if other.team == view.team and other.row == view.row and not other.is_boss and not other.is_objective and not escorts.has(other.slot_index):
				escorts.append(other.slot_index)
		escorts.sort()
		var escort_rank: int = maxi(0, escorts.find(view.slot_index))
		var top_y: float = 0.22 if objectives.is_empty() else 0.29 + 0.06 * maxf(0.0, ceilf(float(objectives.size()) / 2.0) - 1.0)
		var escort_y: float = top_y if escort_rank == 0 else 0.91
		var escort_x: float = 0.85 if view.row == "rear" else 0.62
		return Vector2(1.0 - escort_x if mirrored else escort_x, escort_y)
	var rear: bool = view.row == "rear"
	var slot: int = view.slot_index
	var same_row: Array[int] = []
	for other: BattlePlayback.UnitView in views:
		if other.team == view.team and (other.row == "rear") == rear and not other.is_objective and not same_row.has(other.slot_index):
			same_row.append(other.slot_index)
	same_row.sort()
	var rank: int = maxi(0, same_row.find(slot))
	var count: int = maxi(1, same_row.size())
	var y: float = 0.56 if count == 1 else lerpf(0.28, 0.84, float(rank) / float(count - 1))
	if not rear and count == 2:
		y = lerpf(0.42, 0.70, float(rank))
	if view.is_objective:
		y = 0.84
	var x: float = 0.17 if rear else 0.35
	if view.team != "player":
		x = 1.0 - x
	return Vector2(x, y)

func _layout() -> void:
	if _background != null:
		var has_boss: bool = false
		var slots: Dictionary = {}
		for view: BattlePlayback.UnitView in _views:
			has_boss = has_boss or view.is_boss
			if not view.is_objective:
				slots["%s:%d" % [view.team,view.slot_index]] = true
		# Reframe the same local plate so upper formation slots stand on ground,
		# rather than in the forest horizon. Field clipping crops the raised plate.
		_background.offset_top = -size.y * (0.26 if has_boss else (0.18 if slots.size() > 4 else 0.0))
	for view: BattlePlayback.UnitView in _views:
		var actor: BattleActor = actors.get(view.entity_id)
		if actor != null:
			actor.position = slot_position(view, _views) * size
			var team_slots: Array[int] = []
			for other: BattlePlayback.UnitView in _views:
				if other.team == view.team and not team_slots.has(other.slot_index):
					team_slots.append(other.slot_index)
			var pixels: float = 210.0 if team_slots.size() <= 2 else BattleActor.ART_SIZE
			if view.is_boss:
				var boss_count: int = 0
				var objective_count: int = 0
				for other: BattlePlayback.UnitView in _views:
					if other.team == view.team and other.is_boss:
						boss_count += 1
					if other.team == view.team and other.is_objective:
						objective_count += 1
				pixels = (330.0 if objective_count == 0 else (300.0 if objective_count <= 2 else 270.0)) if boss_count == 1 else 238.0
			elif view.is_objective:
				pixels = 72.0
			actor.scale = Vector2.ONE * minf(1.0, minf(size.y / 1100.0, size.x / 996.0))
			actor.max_visual_width = size.x * 0.42 / maxf(0.01, actor.scale.x) if view.is_boss else INF
			actor.set_art_size(pixels)
			actor.z_index = int(actor.position.y)

func refresh(views: Array[BattlePlayback.UnitView]) -> void:
	for view: BattlePlayback.UnitView in views:
		var actor: BattleActor = actors.get(view.entity_id)
		if actor != null:
			actor.refresh(view)

func cue(cue_data: BattlePlayback.Cue, pace: float) -> void:
	var actor: BattleActor = actors.get(cue_data.unit_id)
	if actor == null:
		return
	match cue_data.kind:
		BattlePlayback.CUE_ACTION:
			actor.animate(cue_data.action_type if cue_data.action_type in ["active", "ultimate"] else "basic", pace)
		BattlePlayback.CUE_DAMAGE, BattlePlayback.CUE_BLOCKED:
			actor.animate("hit" if actor.alive else "defeat", pace)
			var source: BattleActor = actors.get(cue_data.source_id)
			if source != null and source.art_id == "fadyme" and source != actor:
				_magic_trace(source, actor, pace)
		BattlePlayback.CUE_JOIN:
			actor.animate("walk", pace)

func _magic_trace(source: BattleActor, target: BattleActor, pace: float) -> void:
	if not is_inside_tree():
		return
	var trace: Line2D = Line2D.new()
	trace.z_index = 1500
	trace.width = 5.0
	trace.default_color = Color(0.8, 0.63, 1.0, 0.75)
	trace.add_point(source.position + Vector2(0, -source.art_size * 0.5))
	trace.add_point(target.position + Vector2(0, -target.art_size * 0.5))
	add_child(trace)
	var tween: Tween = trace.create_tween()
	tween.tween_property(trace, "modulate:a", 0.0, 0.3 / maxf(1.0, pace))
	tween.tween_callback(trace.queue_free)

func finish(outcome: String) -> void:
	for value: Variant in actors.values():
		var actor: BattleActor = value
		if actor.alive:
			actor.animate("victory" if outcome == "victory" and actor.facing_right else "idle")
