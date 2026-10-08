extends Control
## A staged motion-comic shot. UI containers never own animated transforms.
const NEW_ART: String = "res://assets/ui/narrative/prologue_v002/"
const OLD_ART: String = "res://assets/ui/narrative/prologue_v001/"
const BACKGROUNDS: Dictionary = {
	"hours": NEW_ART + "bell_tower.png", "names": NEW_ART + "register.png",
	"ordinary_days": OLD_ART + "living_village.png", "throne_wars": NEW_ART + "war_fields.png",
	"crownfall": OLD_ART + "crownfall.png", "roads": OLD_ART + "crownfall.png",
	"search": NEW_ART + "search_inn.png", "reunion": NEW_ART + "hill_village.png",
	"beginning": OLD_ART + "forest_road.png"}
const CAST: Dictionary = {
	"hours": ["bell"], "names": ["writing_arm_v003"], "ordinary_days": ["market_people"],
	"throne_wars": ["refugees_walk"], "crownfall": [], "roads": ["refugees_walk"],
	"search": ["mahmut_search"], "reunion": ["mahmut_reunion", "fadyme_reunion"],
	"beginning": ["duo_walk"]}
# Planted boot soles measured in the original 627px atlas cells. Transparent
# margins and frame drift are removed at the feet, rather than at the heads.
const WALK_SOLES: Dictionary = {
	"beginning": [
		[Vector2(239, 606), Vector2(443, 605)], [Vector2(243, 606), Vector2(450, 604)],
		[Vector2(238, 585), Vector2(447, 586)], [Vector2(244, 586), Vector2(453, 581)]],
	"refugees": [
		[Vector2(180, 557), Vector2(332, 557), Vector2(460, 562)],
		[Vector2(182, 557), Vector2(322, 557), Vector2(447, 562)],
		[Vector2(186, 557), Vector2(340, 553), Vector2(480, 562)],
		[Vector2(172, 561), Vector2(327, 551), Vector2(448, 559)]]}
# These points are on the painted road, in background-image UV coordinates.
# Perspective size follows distance from the road's horizon, not elapsed time alone.
const ROADS: Dictionary = {
	"throne_wars": {"path": [Vector2(0.52, 0.75), Vector2(0.55, 0.705), Vector2(0.55, 0.66)], "horizon": 0.40, "height": 510.0},
	"roads": {"path": [Vector2(0.50, 0.765), Vector2(0.51, 0.735), Vector2(0.53, 0.705)], "horizon": 0.48, "height": 580.0},
	"beginning": {"path": [Vector2(0.51, 0.735), Vector2(0.47, 0.705), Vector2(0.45, 0.67)], "horizon": 0.53, "height": 480.0}}

var shot_id: String = ""
var local_seconds: float = 0.0
var reduced_motion: bool = false
var focus_area: Rect2 = Rect2(0, 580, 1080, 480)
var _background: TextureRect
var _stage: Node2D
var _aperture: Control
var _actors: Array[Sprite2D] = []
var _base_positions: Array[Vector2] = []
var _textures: Dictionary = {}
var _fog: Array[Sprite2D] = []
var _ink: Line2D
var _veil: Sprite2D
var _rope: Line2D
var _crop: float = 1.0
var _contact_layer: Node2D
var _shadow_texture: Texture2D
var _ground_uvs: Array[Vector2] = []
var _pen_tip: Vector2 = Vector2.ZERO
const WRITING_NIB: Vector2 = Vector2(0.034, 0.394)
const WRITING_TEXT: String = "We were here."
var _written_text: Label

static func paths_for(identifier: String) -> Array[String]:
	var paths: Array[String] = [str(BACKGROUNDS.get(identifier, ""))]
	for actor: String in CAST.get(identifier, []): paths.append(NEW_ART + actor + ".png")
	return paths

func prepare(identifier: String, resources: Dictionary = {}) -> Error:
	shot_id = identifier
	if not BACKGROUNDS.has(identifier): return ERR_INVALID_DATA
	for path: String in paths_for(identifier):
		var texture: Texture2D = resources.get(path) as Texture2D
		if texture == null: texture = load(path) as Texture2D
		if texture == null: return ERR_FILE_NOT_FOUND
		_textures[path] = texture
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_background = TextureRect.new()
	_background.texture = _textures[BACKGROUNDS[identifier]]
	_background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_background)
	_aperture = Control.new()
	_aperture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_aperture.clip_contents = true
	add_child(_aperture)
	_stage = Node2D.new()
	_aperture.add_child(_stage)
	_contact_layer = Node2D.new()
	_stage.add_child(_contact_layer)
	_shadow_texture = _radial(Color(0.025, 0.018, 0.018, 0.40))
	_build_cast()
	_build_atmosphere()
	resized.connect(_layout)
	return OK

func _sprite(key: String, height: float, at: Vector2, region: Rect2 = Rect2()) -> Sprite2D:
	var actor: Sprite2D = Sprite2D.new()
	actor.texture = _textures[NEW_ART + key + ".png"]
	if key in ["mahmut_search", "mahmut_reunion", "fadyme_reunion"]:
		actor.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	actor.centered = false
	if region.has_area():
		actor.region_enabled = true
		actor.region_rect = region
		actor.region_filter_clip_enabled = true
	var dimensions: Vector2 = region.size if region.has_area() else actor.texture.get_size()
	actor.scale = Vector2.ONE * height / dimensions.y
	actor.position = at
	_stage.add_child(actor)
	_actors.append(actor)
	_base_positions.append(at)
	_ground_uvs.append(Vector2.ZERO)
	return actor

func _build_cast() -> void:
	match shot_id:
		"hours":
			var bell: Sprite2D = _sprite("bell", 540.0, Vector2(540, -10))
			bell.offset = Vector2(-bell.texture.get_width() * 0.5, -bell.texture.get_height() * 0.065)
			_rope = Line2D.new()
			_rope.width = 4.0
			_rope.default_color = Color("#6d5742")
			_rope.points = PackedVector2Array([Vector2(640, 35), Vector2(640, 650)])
			_stage.add_child(_rope)
		"names":
			_written_text = Label.new()
			_written_text.text = WRITING_TEXT
			_written_text.add_theme_font_override("font", preload("res://assets/fonts/art_direction_v01/Cinzel.ttf"))
			_written_text.add_theme_color_override("font_color", Color(0.17, 0.10, 0.09, 0.94))
			_written_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
			_stage.add_child(_written_text)
			_ink = Line2D.new()
			_ink.width = 2.2
			_ink.default_color = Color(0.17, 0.10, 0.09, 0.75)
			_stage.add_child(_ink)
			_sprite("writing_arm_v003", 800.0, Vector2(470, 80))
		"ordinary_days":
			# The loaf crosses the image's midpoint. Keep the entire offering intact.
			_sprite("market_people", 620.0, Vector2.ZERO)
		"throne_wars": _walk_atlas("refugees_walk", 650.0, Vector2(170, -10))
		"roads":
			_walk_atlas("refugees_walk", 580.0, Vector2.ZERO)
		"search":
			_sprite("mahmut_search", 1230.0, Vector2(10, 0))
		"reunion":
			_sprite("mahmut_reunion", 1150.0, Vector2(-120, 0))
			_sprite("fadyme_reunion", 1040.0, Vector2(515, 30))
		"beginning": _walk_atlas("duo_walk", 560.0, Vector2(270, 50))

func _walk_atlas(key: String, height: float, at: Vector2) -> void:
	var texture: Texture2D = _textures[NEW_ART + key + ".png"]
	var cell: Vector2 = texture.get_size() * 0.5
	_sprite(key, height, at, Rect2(Vector2.ZERO, cell))

func _radial(color: Color) -> GradientTexture2D:
	var gradient: Gradient = Gradient.new()
	gradient.set_color(0, color)
	gradient.set_color(1, Color(color.r, color.g, color.b, 0))
	var texture: GradientTexture2D = GradientTexture2D.new()
	texture.gradient = gradient
	texture.width = 128
	texture.height = 128
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(0.5, 0)
	return texture

func _build_atmosphere() -> void:
	var smoky: bool = shot_id in ["throne_wars", "crownfall", "roads", "beginning"]
	if smoky:
		var texture: Texture2D = _radial(Color(0.45, 0.44, 0.47, 0.14))
		for index: int in 5:
			var mist: Sprite2D = Sprite2D.new()
			mist.texture = texture
			mist.scale = Vector2(7.0, 1.7)
			_stage.add_child(mist)
			_fog.append(mist)
	_veil = Sprite2D.new()
	_veil.texture = _radial(Color(0.95, 0.56, 0.24, 0.14) if not smoky else Color(0.78, 0.24, 0.12, 0.10))
	_veil.scale = Vector2(9, 7)
	_veil.position = Vector2(800, 180)
	_stage.add_child(_veil)

func set_focus(area: Rect2) -> void:
	focus_area = area
	_layout()

func _layout() -> void:
	if _background == null: return
	# A fixed crop for the entire shot: no fractional whole-screen pan/zoom.
	_crop = 1.16 if shot_id == "crownfall" else (1.06 if shot_id == "roads" else 1.0)
	_background.size = size * _crop
	_background.position = (size - _background.size) * 0.5
	# Reveal the inn's floor and counter together; the previous zoom hid the floor.
	if shot_id == "search": _background.position.y = -size.y * 0.25
	var lowest_uv: Vector2 = Vector2(0.5, 0.0)
	match shot_id:
		"ordinary_days": lowest_uv.y = 0.735
		"search": lowest_uv.y = 0.98
		"reunion": lowest_uv.y = 0.735
		"throne_wars", "roads", "beginning": lowest_uv = ROADS[shot_id]["path"][0]
	# If large subtitles need more space, reframe the painted ground and its cast
	# together. Do not reposition people independently of their background.
	if lowest_uv.y > 0:
		var floor_y: float = _background_pixel(lowest_uv).y
		var ceiling: float = focus_area.end.y - size.y * 0.025
		_background.position.y -= maxf(0.0, floor_y - ceiling)
	_aperture.position = focus_area.position
	_aperture.size = focus_area.size
	_stage.scale = Vector2.ONE * size.x / 1080.0
	_stage.position = -focus_area.position
	if shot_id == "hours" and not _actors.is_empty():
		var height: float = minf(540.0, focus_area.size.y * 1080.0 / maxf(size.x, 1.0))
		_actors[0].scale = Vector2.ONE * height / _actors[0].texture.get_height()
	update_time(local_seconds)

func update_time(seconds: float) -> void:
	local_seconds = maxf(0.0, seconds)
	if _background == null: return
	var t: float = 5.0 if reduced_motion else local_seconds
	var unit: float = _stage.scale.x
	match shot_id:
		"hours":
			var swing: float = 0.0 if reduced_motion else sin(t * 1.55) * 0.11 * (1.0 - smoothstep(8.0, 11.0, t))
			_actors[0].rotation = swing
			_rope.set_point_position(1, Vector2(640 + swing * 90.0, 650))
		"names": _write_name(t)
		"ordinary_days":
			_plant(0, Vector2(0.64, 0.760), 430.0, Vector2(0.50, 0.978),
				[Vector2(0.147, 0.978), Vector2(0.807, 0.975)])
		"throne_wars", "roads", "beginning": _walk(t)
		"search":
			_plant(0, Vector2(0.34, 0.996), 1260.0, Vector2(0.466, 0.984),
				[Vector2(0.466, 0.984), Vector2(0.715, 0.984)])
		"reunion":
			_plant(0, Vector2(0.34, 0.735), 930.0, Vector2(0.466, 0.984),
				[Vector2(0.466, 0.984), Vector2(0.715, 0.984)])
			_plant(1, Vector2(0.68, 0.755), 765.0, Vector2(0.599, 0.991),
				[Vector2(0.599, 0.991), Vector2(0.455, 0.991)])
			_actors[1].modulate.a = smoothstep(1.0, 3.2, t)
			_update_contacts(1)
	for index: int in _fog.size():
		var drift: float = 0.0 if reduced_motion else t * (9.0 + index * 2.0)
		_fog[index].position = Vector2(fposmod(index * 249.0 + drift + 350.0, 1680.0) - 300.0, 100 + index * 92)
	_veil.modulate.a = 1.0 if reduced_motion else 0.83 + sin(t * 0.75) * 0.13
	# Dust and ash occupy the image aperture; UI and faces stay readable.
	if unit > 0: queue_redraw()

func _write_name(t: float) -> void:
	# An anonymous inscription adds no invented name or historical character.
	var phase: float = clampf((t - 1.6) / 7.0, 0.0, 1.0)
	var font_size: int = maxi(18, roundi(33.0 * _height(800.0) / 800.0))
	_written_text.add_theme_font_size_override("font_size", font_size)
	_written_text.position = _image_point(Vector2(0.55, 0.407))
	_written_text.rotation = 0.075
	_written_text.visible_characters = floori(WRITING_TEXT.length() * phase)
	var font: Font = _written_text.get_theme_font("font")
	var prefix: String = WRITING_TEXT.left(_written_text.visible_characters)
	var advance_width: float = font.get_string_size(prefix, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	_pen_tip = _written_text.position + Vector2(advance_width, font_size * 0.86).rotated(_written_text.rotation)
	var points: PackedVector2Array = PackedVector2Array()
	for index: int in 121:
		var f: float = index / 120.0
		if f > phase: break
		points.append(_written_text.position + Vector2(advance_width * f / maxf(phase, 0.001), font_size * 1.15).rotated(_written_text.rotation))
	_ink.points = points
	var hand: Sprite2D = _actors[0]
	hand.scale = Vector2.ONE * _height(800.0) / hand.texture.get_height()
	# The measured nib stays on the ink through wrist rotations.
	hand.offset = -hand.texture.get_size() * WRITING_NIB
	var lift: float = smoothstep(8.6, 10.8, t)
	hand.position = _pen_tip + Vector2(58, -64) * lift
	hand.rotation = sin(phase * TAU * 5) * 0.035 + lerpf(-0.012, 0.018, phase) - lift * 0.08
	_ink.width = 0.65 * _height(800.0) / 800.0
	_ink.antialiased = true

func _stroke_uv(f: float) -> Vector2:
	return Vector2(0.55 + f * 0.115, 0.419 + f * 0.008 + sin(f * TAU * 5) * 0.0025)

func _background_pixel(uv: Vector2) -> Vector2:
	var dimensions: Vector2 = _background.texture.get_size()
	var cover: float = maxf(_background.size.x / dimensions.x, _background.size.y / dimensions.y)
	var rendered: Vector2 = dimensions * cover
	return _background.position + (_background.size - rendered) * 0.5 + uv * rendered

func _image_point(uv: Vector2) -> Vector2:
	return _background_pixel(uv) / maxf(_stage.scale.x, 0.001)

func _height(reference: float) -> float:
	return reference * size.y / 1920.0 / maxf(_stage.scale.x, 0.001)

func _plant(index: int, ground: Vector2, height: float, pivot: Vector2, soles: Array) -> void:
	var actor: Sprite2D = _actors[index]
	var dimensions: Vector2 = actor.region_rect.size if actor.region_enabled else actor.texture.get_size()
	actor.offset = -pivot * dimensions
	actor.scale = Vector2.ONE * _height(height) / dimensions.y
	actor.position = _image_point(ground)
	_ground_uvs[index] = ground
	actor.set_meta("soles", soles)
	actor.set_meta("sole_pivot", pivot)
	if shot_id in ["search", "reunion"] and not actor.has_meta("stance_mesh"):
		_build_stance_mesh(actor, index)
	if not actor.has_meta("contact_shadows"):
		var shadows: Array[Sprite2D] = []
		for sole: Vector2 in soles:
			var shadow: Sprite2D = Sprite2D.new()
			shadow.texture = _shadow_texture
			_contact_layer.add_child(shadow)
			shadows.append(shadow)
		actor.set_meta("contact_shadows", shadows)
	_update_contacts(index)

func _build_stance_mesh(actor: Sprite2D, index: int) -> void:
	# Articulated stance geometry: extend only the raised leg to its support plane.
	# Faces, hands, torso, source textures and character designs remain untouched.
	var feminine: bool = shot_id == "reunion" and index == 1
	var dimensions: Vector2 = actor.texture.get_size()
	var vertices: PackedVector3Array = PackedVector3Array()
	var uvs: PackedVector2Array = PackedVector2Array()
	var indices: PackedInt32Array = PackedInt32Array()
	const COLUMNS: int = 32
	const ROWS: int = 40
	for row: int in ROWS + 1:
		for column: int in COLUMNS + 1:
			var uv: Vector2 = Vector2(float(column) / COLUMNS, float(row) / ROWS)
			var horizontal: float = (smoothstep(0.34, 0.42, uv.x) * (1.0 - smoothstep(0.51, 0.56, uv.x))) if feminine else (smoothstep(0.55, 0.62, uv.x) * (1.0 - smoothstep(0.85, 0.94, uv.x)))
			var drop: float = (0.031 if feminine else 0.054) * smoothstep(0.72, 0.91, uv.y) * horizontal
			var point: Vector2 = (uv + Vector2(0, drop)) * dimensions + actor.offset
			vertices.append(Vector3(point.x, point.y, 0))
			uvs.append(uv)
	for row: int in ROWS:
		for column: int in COLUMNS:
			var a: int = row * (COLUMNS + 1) + column
			indices.append_array(PackedInt32Array([a, a + 1, a + COLUMNS + 1, a + 1, a + COLUMNS + 2, a + COLUMNS + 1]))
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh: ArrayMesh = ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var display: MeshInstance2D = MeshInstance2D.new()
	display.mesh = mesh
	display.texture = actor.texture
	actor.add_child(display)
	actor.self_modulate.a = 0.0
	actor.set_meta("stance_mesh", display)

func _update_contacts(index: int) -> void:
	var actor: Sprite2D = _actors[index]
	var dimensions: Vector2 = actor.region_rect.size if actor.region_enabled else actor.texture.get_size()
	var soles: Array = actor.get_meta("soles")
	var shadows: Array = actor.get_meta("contact_shadows")
	for foot: int in soles.size():
		var shadow: Sprite2D = shadows[foot] as Sprite2D
		shadow.position = actor.transform * ((soles[foot] as Vector2) * dimensions + actor.offset)
		var height: float = dimensions.y * actor.scale.y
		shadow.scale = Vector2(height * 0.13, height * 0.022) / 128.0
		shadow.modulate.a = actor.modulate.a

func _walk(t: float) -> void:
	var actor: Sprite2D = _actors[0]
	var cell: Vector2 = actor.texture.get_size() * 0.5
	var frame: int = 0 if reduced_motion else floori(t * 4.0) % 4
	actor.region_rect = Rect2(Vector2((frame % 2) * cell.x, floori(frame * 0.5) * cell.y), cell)
	var registration: String = "beginning" if shot_id == "beginning" else "refugees"
	var soles: Array = []
	var pivot: Vector2 = Vector2.ZERO
	for sole: Vector2 in WALK_SOLES[registration][frame]:
		var uv: Vector2 = sole / 627.0
		soles.append(uv)
		pivot.x += uv.x
		pivot.y = maxf(pivot.y, uv.y)
	pivot.x /= soles.size()
	var road: Dictionary = ROADS[shot_id]
	var path: Array = road["path"]
	var departure: float = smoothstep(0.8, 13.5 if shot_id == "roads" else 10.5, t)
	var start: Vector2 = path[0]
	var middle: Vector2 = path[1]
	var end: Vector2 = path[2]
	var ground: Vector2 = start.lerp(middle, departure).lerp(middle.lerp(end, departure), departure)
	var perspective: float = (ground.y - float(road["horizon"])) / (start.y - float(road["horizon"]))
	var crown_y: float = ([20.0, 20.0, 22.0, 19.0] if registration == "beginning" else [45.0, 45.0, 41.0, 38.0])[frame] / 627.0
	var visible_reference: float = 586.0 / 627.0 if registration == "beginning" else 517.0 / 627.0
	var frame_height: float = visible_reference / (pivot.y - crown_y)
	_plant(0, ground, float(road["height"]) * perspective * frame_height, pivot, soles)

func _draw() -> void:
	if _background == null: return
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.035, 0.027, 0.028))
	var warm: bool = shot_id in ["hours", "names", "ordinary_days", "reunion"]
	var t: float = 0.0 if reduced_motion else local_seconds
	for index: int in 18:
		var origin: Vector2 = Vector2(fposmod(index * 157.0 + t * (6 + index % 3), size.x),
			focus_area.position.y + fposmod(index * 63.0 - t * 8.0, maxf(1.0, focus_area.size.y)))
		var tint: Color = Color(0.95, 0.74, 0.44, 0.20) if warm else Color(0.68, 0.66, 0.68, 0.24)
		draw_circle(origin, 1.2 + index % 3, tint)

func evidence() -> Dictionary:
	var poses: Array[Dictionary] = []
	for index: int in _actors.size():
		var actor: Sprite2D = _actors[index]
		poses.append({"position": actor.position, "rotation": actor.rotation, "scale": actor.scale,
			"alpha": actor.modulate.a, "region": actor.region_rect, "offset": actor.offset,
			"ground_uv": _ground_uvs[index], "ground_pixel": _background_pixel(_ground_uvs[index])})
	return {"shot_id": shot_id, "seconds": local_seconds, "actor_count": _actors.size(),
		"texture_count": _textures.size(), "background_rect": _background.get_rect(),
		"background_scale": _background.scale, "focus_area": focus_area, "reduced_motion": reduced_motion,
		"poses": poses}
