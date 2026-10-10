class_name BattleArt
extends RefCounted
## Presentation assets only. Battle rules and replay data never depend on these files.

const MANIFEST: String = "res://data/presentation/battle_art_v001.json"
const STATES: Array[String] = ["idle", "walk", "basic", "active", "ultimate", "hit", "defeat", "victory"]
const MAX_CACHED_TEXTURES: int = 24
static var _manifest: Dictionary = {}
static var _textures: Dictionary = {}

static func data() -> Dictionary:
	if _manifest.is_empty() and FileAccess.file_exists(MANIFEST):
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))
		if parsed is Dictionary:
			_manifest = parsed
	return _manifest

static func reset_cache() -> void:
	_manifest.clear()
	_textures.clear()

static func texture(path: String) -> Texture2D:
	if path.is_empty(): return null
	if not _textures.has(path):
		var loaded: Texture2D = load(path) as Texture2D if ResourceLoader.exists(path,"Texture2D") else null
		# The existing editor runtime can precede a newly scanned PNG import.
		# Local preview can read it now; exported builds use the imported resource.
		if loaded == null and OS.has_feature("editor") and FileAccess.file_exists(path):
			var source: Image = Image.load_from_file(path)
			if source != null and not source.is_empty():
				source.generate_mipmaps()
				loaded = ImageTexture.create_from_image(source)
		if loaded == null: return null
		if _textures.size() >= MAX_CACHED_TEXTURES:
			_textures.erase(_textures.keys()[0])
		_textures[path] = loaded
	return _textures[path]

static func actor_data(art_id: String) -> Dictionary:
	return data().get("actors", {}).get(art_id, {})

static func pose(art_id: String, state: String) -> AtlasTexture:
	var spec: Dictionary = actor_data(art_id)
	var separate: String = str(spec.get("pose_files", {}).get(state, ""))
	var atlas: Texture2D = texture(separate if not separate.is_empty() else str(spec.get("atlas", "")))
	if atlas == null:
		return null
	if not separate.is_empty():
		var single: AtlasTexture = AtlasTexture.new()
		single.atlas = atlas
		single.region = Rect2(Vector2.ZERO, atlas.get_size())
		return single
	var index: int = STATES.find(state)
	if index < 0:
		index = 0
	index = int(spec.get("pose_indices", {}).get(state, index))
	var grid: Vector2 = Vector2(float(spec.get("columns", 4)), float(spec.get("rows", 2)))
	var cell: Vector2 = atlas.get_size() / grid
	var result: AtlasTexture = AtlasTexture.new()
	result.atlas = atlas
	result.region = Rect2(Vector2(float(index % int(grid.x)), floorf(float(index) / grid.x)) * cell, cell)
	var regions: Array = spec.get("regions", [])
	if index < regions.size():
		var region: Array = regions[index]
		result.region = Rect2(float(region[0]), float(region[1]), float(region[2]), float(region[3]))
	result.filter_clip = true
	return result

static func background(environment: String) -> Texture2D:
	var path: String = str(data().get("environments", {}).get(environment, ""))
	return texture(path)

static func portrait(character_id: String, emotion: String) -> Texture2D:
	var spec: Dictionary = data().get("portraits", {}).get(character_id, {})
	var alias: String = str(spec.get("emotions", {}).get(emotion, "composed"))
	return texture(str(spec.get("files", {}).get(alias, "")))

static func illustration(illustration_id: String) -> Texture2D:
	return texture(str(data().get("illustrations", {}).get(illustration_id, "")))

static func ultimate(character_id: String) -> Texture2D:
	var art: Texture2D = texture(str(data().get("ultimates", {}).get(character_id,"")))
	if art != null: return art
	art = portrait(character_id,"composed")
	return art if art != null else pose(character_id,"ultimate")

static func icon(art_id: String) -> Texture2D:
	var selected: Texture2D = texture(str(data().get("icons", {}).get(art_id,"")))
	if selected != null: return selected
	var portrait_art: Texture2D = portrait(art_id,"composed")
	if portrait_art == null: return null
	var cropped: AtlasTexture = AtlasTexture.new()
	cropped.atlas = portrait_art
	var dimensions: Vector2 = portrait_art.get_size()
	var edge: float = minf(dimensions.x,dimensions.y*0.45)
	cropped.region = Rect2(Vector2((dimensions.x-edge)*0.5,dimensions.y*0.03),Vector2.ONE*edge)
	cropped.filter_clip = true
	return cropped


static func story_portrait(character_id: String, emotion: String, scene_id: String, line_id: String, after_stage: String = "") -> Texture2D:
	if character_id != "fadyme": return portrait(character_id, emotion)
	var spec: Dictionary = data().get("portraits", {}).get("fadyme", {})
	var state: String = ""
	# Scene context, rather than the current account cursor, also keeps old replays spoiler-safe.
	if after_stage == "7-5" or scene_id == "vn_7_5_post" or scene_id in ["part1_emotional_confession", "part1_clockless_reveal"]:
		state = "late_debt_hands"
	elif (not after_stage.is_empty() and after_stage >= "5-4") or scene_id == "vn_5_4_post" or scene_id.begins_with("vn_5_5") or scene_id.begins_with("vn_6_") or scene_id.begins_with("vn_7_") or scene_id in ["ch5_camp", "ch6_road", "ch6_camp", "ch7_road"]:
		state = "bone_white_lock"
	elif line_id == "node_3_3_pre_004" or line_id == "node_3_3_post_003":
		state = "hidden_blood_scarf"
	if not state.is_empty():
		var state_art: Texture2D = texture(str(spec.get("story_states", {}).get(state, "")))
		if state_art != null: return state_art
	var alias: String = str(spec.get("line_overrides", {}).get(line_id, spec.get("emotions", {}).get(emotion, "composed")))
	return texture(str(spec.get("files", {}).get(alias, "")))


static func scene_illustration(scene_id: String) -> Texture2D:
	return texture(str(data().get("scene_illustrations", {}).get(scene_id, "")))


static func story_background(location: String) -> Texture2D:
	return texture(str(data().get("story_environments", {}).get(location, "")))
