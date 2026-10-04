class_name AssetCatalog
extends RefCounted
## Stable asset references -> project paths, read from the content packs (INF-024). Content names art by stable id and
## records where its file lives ("assets/..."); nothing else in the client hardcodes an art path.
##
## A reference is "<kind>/<id>" or "<kind>/<id>/<variant>":
##   mark/<logo_id>                          brand_assets_part1.json, every section (characters, items, skills, ...);
##                                           `mark_for(entity_id)` finds an entity's mark
##   character/<character_id>/<variant>      character_visuals_part1.json planned_files: vn_bust, battle_atlas, model_sheet,
##                                           banner_cutout, weapon
##   background/<environment_id>/<variant>   visual_assets_part1.json chapter_environments: story (the master plate), battle, map
##   banner/<id>                             visual_assets_part1.json banner_key_art and weapon_banner_key_art
##   boss/<id>, villain/<id>, ui/<id>        visual_assets_part1.json boss_art, villain_art, shared_ui
##
## Usage:
##   var catalog := AssetCatalog.from_dir("res://data/content")
##   if not catalog.error.is_empty(): push_error(catalog.error)
##   catalog.path("character/mahmut/vn_bust")  # "res://assets/characters/mahmut/vn_bust_v001.webp"
##
## Paths are "res://" + the authored file, so the same reference resolves to a file shipped in the app or mounted later
## from a content patch (G5). Whether the file exists is the resolver's business (AssetResolver), not the catalog's.

const BRAND_PACK: String = "brand_assets_part1.json"
const VISUAL_PACK: String = "visual_assets_part1.json"
const CHARACTER_PACK: String = "character_visuals_part1.json"
const KINDS: Array[String] = ["mark", "character", "background", "banner", "boss", "villain", "ui"]

## The first problem found ("" = none). An entry with a problem is left out; the others are still indexed.
var error: String = ""

var _paths: Dictionary = {}
var _marks: Dictionary = {}


static func from_dir(content_dir: String) -> AssetCatalog:
	var catalog: AssetCatalog = AssetCatalog.new()
	var packs: Dictionary = {}
	for file_name: String in [BRAND_PACK, VISUAL_PACK, CHARACTER_PACK]:
		var path: String = content_dir.path_join(file_name)
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path)) if FileAccess.file_exists(path) else null
		if not (parsed is Dictionary):
			catalog._fail("%s: missing or not a JSON object" % file_name)
			continue
		packs[file_name] = parsed
	catalog._index(packs)
	return catalog


## Builds the catalog from already parsed packs (`{file name: Dictionary}`); tests feed their own through here.
static func from_packs(packs: Dictionary) -> AssetCatalog:
	var catalog: AssetCatalog = AssetCatalog.new()
	catalog._index(packs)
	return catalog


## The project path of `reference`, or "" when the content names no such asset.
func path(reference: String) -> String:
	return String(_paths.get(reference, ""))


func has(reference: String) -> bool:
	return _paths.has(reference)


## The mark (icon) reference of a content entity (character, enemy, item, skill, currency, ...; brand_assets_part1.json
## entity_id), or "" when it has none.
func mark_for(entity_id: String) -> String:
	return String(_marks.get(entity_id, ""))


## Every reference, sorted.
func references() -> Array[String]:
	var result: Array[String] = []
	for reference: String in _paths:
		result.append(reference)
	result.sort()
	return result


func size() -> int:
	return _paths.size()


## The kind of `reference` (its first segment), "" when it is not one of `KINDS`.
static func kind_of(reference: String) -> String:
	var kind: String = reference.get_slice("/", 0)
	return kind if KINDS.has(kind) else ""


func _index(packs: Dictionary) -> void:
	var brand: Dictionary = packs.get(BRAND_PACK, {})
	for section: String in brand:
		if brand[section] is Array:
			for row: Variant in brand[section]:
				if row is Dictionary and row.has("logo_id") and row.has("file"):
					var reference: String = "mark/%s" % str(row["logo_id"])
					_add(reference, row["file"], BRAND_PACK)
					var entity: String = str(row.get("entity_id", ""))
					if not entity.is_empty() and _paths.has(reference):
						if _marks.has(entity) and _marks[entity] != reference:
							_fail("%s: entity %s has two marks" % [BRAND_PACK, entity])
						else:
							_marks[entity] = reference
	var characters: Dictionary = packs.get(CHARACTER_PACK, {})
	for row: Variant in characters.get("characters", []):
		if row is Dictionary and row.get("planned_files") is Dictionary:
			var files: Dictionary = row["planned_files"]
			for variant: String in files:
				_add("character/%s/%s" % [str(row.get("id", "")), variant], files[variant], CHARACTER_PACK)
	var visual: Dictionary = packs.get(VISUAL_PACK, {})
	for row: Variant in visual.get("chapter_environments", []):
		if row is Dictionary:
			for variant: String in ["master", "battle", "map"]:
				if row.has(variant):
					_add("background/%s/%s" % [str(row.get("id", "")), "story" if variant == "master" else variant], row[variant], VISUAL_PACK)
	for section: String in ["banner_key_art", "weapon_banner_key_art"]:
		_add_rows(visual.get(section, []), "banner")
	_add_rows(visual.get("boss_art", []), "boss")
	_add_rows(visual.get("villain_art", []), "villain")
	_add_rows(visual.get("shared_ui", []), "ui")


func _add_rows(rows: Variant, kind: String) -> void:
	if not (rows is Array):
		return
	for row: Variant in rows:
		if row is Dictionary and row.has("file"):
			_add("%s/%s" % [kind, str(row.get("id", ""))], row["file"], VISUAL_PACK)


func _add(reference: String, file: Variant, pack: String) -> void:
	var relative: String = str(file) if file is String else ""
	if reference.contains("//") or reference.ends_with("/"):
		_fail("%s: an asset has no id (%s)" % [pack, reference])
		return
	if not relative.begins_with("assets/") or relative.contains("..") or relative.contains("\\"):
		_fail("%s: %s has an invalid file %s (must be a relative path under assets/)" % [pack, reference, str(file)])
		return
	var resolved: String = "res://" + relative
	if _paths.has(reference) and _paths[reference] != resolved:
		_fail("%s: %s is declared twice with different files" % [pack, reference])
		return
	_paths[reference] = resolved


func _fail(message: String) -> void:
	if error.is_empty():
		error = message
