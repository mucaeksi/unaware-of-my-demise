class_name AssetResolver
extends RefCounted
## Stable asset reference -> texture, with a placeholder when the art is not there (INF-024). Screens ask for
## "character/mahmut/vn_bust" or `catalog.mark_for("ash_wolf")`; they never name a file. Final art is not required: until
## a file is shipped (in the app or a mounted content patch, G5) every reference resolves to its kind's placeholder, and
## the screen keeps its own placeholder label (brief G5: placeholder art is marked as such).
##
## Usage:
##   var assets := AssetResolver.new(AssetCatalog.from_dir("res://data/content"))
##   texture_rect.texture = assets.texture("background/forest_whispering_ash/battle")
##   if not assets.has_art(reference): show_placeholder_label()
##
## Memory: Godot's ResourceLoader already shares a loaded resource while anything holds it; this keeps the last
## `CACHE_LIMIT` textures alive as well, so screens that come and go do not reload them. Missing art is reported once
## per reference (`missing()`, one warning), not on every frame. Single-threaded: call from the main thread; `prefetch`
## starts background loads through ResourceLoader's threaded API.

const CACHE_LIMIT: int = 48
## Placeholder side in pixels: a flat tile that stretches to the slot, tinted per kind so a missing banner and a missing
## icon look different in screenshots.
const PLACEHOLDER_SIZE: int = 8
const PLACEHOLDER_TINTS: Dictionary = {
	"mark": Color(0.30, 0.27, 0.34),
	"character": Color(0.26, 0.22, 0.28),
	"background": Color(0.12, 0.12, 0.15),
	"banner": Color(0.22, 0.16, 0.20),
	"boss": Color(0.20, 0.14, 0.14),
	"villain": Color(0.18, 0.12, 0.18),
	"ui": Color(0.24, 0.24, 0.26),
	"": Color(0.25, 0.25, 0.25),
}

var catalog: AssetCatalog = null

var _exists: Callable
var _load: Callable
var _cache: Dictionary = {}
## Most recently used last.
var _order: Array[String] = []
var _placeholders: Dictionary = {}
var _missing: Dictionary = {}


## `exists` (path -> bool) and `load_resource` (path -> Resource) default to ResourceLoader; tests pass their own.
func _init(asset_catalog: AssetCatalog, exists: Callable = Callable(), load_resource: Callable = Callable()) -> void:
	catalog = asset_catalog
	_exists = exists if exists.is_valid() else func(path: String) -> bool: return ResourceLoader.exists(path, "Texture2D")
	_load = load_resource if load_resource.is_valid() else func(path: String) -> Resource: return ResourceLoader.load(path, "Texture2D")


## The art for `reference`, or its kind's placeholder when the content names no such asset or the file is not there.
func texture(reference: String) -> Texture2D:
	if _cache.has(reference):
		_touch(reference)
		return _cache[reference]
	var art: Texture2D = _load_art(reference)
	if art == null:
		return placeholder(AssetCatalog.kind_of(reference))
	_cache[reference] = art
	_touch(reference)
	while _order.size() > CACHE_LIMIT:
		_cache.erase(_order.pop_front())
	return art


## True when `reference` resolves to real art (not a placeholder).
func has_art(reference: String) -> bool:
	return _cache.has(reference) or (catalog.has(reference) and _exists.call(catalog.path(reference)))


## Starts background loads of the references whose files exist (for the next screen); `texture` then finds them loaded.
func prefetch(references: Array[String]) -> void:
	for reference: String in references:
		if not _cache.has(reference) and has_art(reference):
			ResourceLoader.load_threaded_request(catalog.path(reference), "Texture2D")


## The references asked for that had no art, sorted (diagnostics screen, bug reports).
func missing() -> Array[String]:
	var result: Array[String] = []
	for reference: String in _missing:
		result.append(reference)
	result.sort()
	return result


func cached_count() -> int:
	return _cache.size()


## The flat tile standing in for missing art of `kind` (one shared texture per kind).
func placeholder(kind: String) -> Texture2D:
	if not _placeholders.has(kind):
		var image: Image = Image.create(PLACEHOLDER_SIZE, PLACEHOLDER_SIZE, false, Image.FORMAT_RGBA8)
		image.fill(PLACEHOLDER_TINTS.get(kind, PLACEHOLDER_TINTS[""]))
		_placeholders[kind] = ImageTexture.create_from_image(image)
	return _placeholders[kind]


func _load_art(reference: String) -> Texture2D:
	if not catalog.has(reference):
		_report(reference, "the content names no asset %s" % reference)
		return null
	var path: String = catalog.path(reference)
	if not _exists.call(path):
		_report(reference, "")
		return null
	var loaded: Resource = _load.call(path)
	if not (loaded is Texture2D):
		_report(reference, "%s is not a texture" % path)
		return null
	return loaded


## Records a miss once. Art that is simply not produced yet is the normal state before G5 and is not warned about;
## a reference the content does not know, or a file of the wrong type, is a bug and is.
func _report(reference: String, problem: String) -> void:
	if _missing.has(reference):
		return
	_missing[reference] = true
	if not problem.is_empty():
		push_warning("AssetResolver: " + problem)


func _touch(reference: String) -> void:
	_order.erase(reference)
	_order.append(reference)
