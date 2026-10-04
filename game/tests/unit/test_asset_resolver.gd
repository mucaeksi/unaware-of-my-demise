extends GutTest
## INF-024: stable asset references from the content packs, and their resolution to art or a placeholder.

const CONTENT_DIR: String = "res://data/content"


func _catalog() -> AssetCatalog:
	return AssetCatalog.from_packs({
		AssetCatalog.BRAND_PACK: {"characters": [{"entity_id": "mahmut", "logo_id": "mark_character_mahmut", "file": "assets/marks/m.svg"}]},
		AssetCatalog.CHARACTER_PACK: {"characters": [{"id": "mahmut", "planned_files": {"vn_bust": "assets/characters/mahmut/bust.webp"}}]},
		AssetCatalog.VISUAL_PACK: {"chapter_environments": [{"id": "forest", "master": "assets/bg/f.webp", "battle": "assets/bg/fb.webp"}]},
	})


func _texture() -> Texture2D:
	return ImageTexture.create_from_image(Image.create(2, 2, false, Image.FORMAT_RGBA8))


func test_shipped_content_names_every_kind_of_art() -> void:
	var catalog: AssetCatalog = AssetCatalog.from_dir(CONTENT_DIR)
	assert_eq(catalog.error, "", "the shipped packs index cleanly")
	assert_gt(catalog.size(), 300, "marks, character art, backgrounds, banners")
	assert_eq(catalog.path("character/mahmut/vn_bust"), "res://assets/characters/mahmut/vn_bust_v001.webp")
	assert_eq(catalog.path("background/forest_whispering_ash/battle"), "res://assets/backgrounds/forest_whispering_ash/battle_plate_v001.webp")
	assert_eq(catalog.mark_for("mahmut"), "mark/mark_character_mahmut")
	assert_true(catalog.has("banner/oath_01_aveline"))
	for kind: String in AssetCatalog.KINDS:
		var found: bool = false
		for reference: String in catalog.references():
			found = found or AssetCatalog.kind_of(reference) == kind
		assert_true(found, "some %s art is named" % kind)
	for reference: String in catalog.references():
		assert_true(catalog.path(reference).begins_with("res://assets/"), reference)


func test_catalog_rejects_paths_outside_assets_and_conflicting_entries() -> void:
	var escaping: AssetCatalog = AssetCatalog.from_packs({AssetCatalog.VISUAL_PACK: {"shared_ui": [{"id": "x", "file": "assets/../project.godot"}]}})
	assert_string_contains(escaping.error, "invalid file")
	assert_false(escaping.has("ui/x"))
	var absolute: AssetCatalog = AssetCatalog.from_packs({AssetCatalog.VISUAL_PACK: {"shared_ui": [{"id": "x", "file": "res://x.png"}]}})
	assert_string_contains(absolute.error, "invalid file")
	var twice: AssetCatalog = AssetCatalog.from_packs({AssetCatalog.VISUAL_PACK: {"boss_art": [
		{"id": "b", "file": "assets/a.webp"}, {"id": "b", "file": "assets/b.webp"}]}})
	assert_string_contains(twice.error, "declared twice")
	assert_eq(twice.path("boss/b"), "res://assets/a.webp", "the first declaration stays")


func test_missing_art_resolves_to_the_kind_placeholder_and_is_reported_once() -> void:
	var assets: AssetResolver = AssetResolver.new(_catalog(), func(_path: String) -> bool: return false)
	var first: Texture2D = assets.texture("character/mahmut/vn_bust")
	assert_not_null(first)
	assert_same(first, assets.placeholder("character"))
	assert_same(assets.texture("character/mahmut/vn_bust"), first)
	assert_false(assets.has_art("character/mahmut/vn_bust"))
	assert_ne(assets.placeholder("character"), assets.placeholder("background"), "kinds look different")
	assert_same(assets.texture("character/nobody/vn_bust"), assets.placeholder("character"), "unknown reference")
	assert_eq(assets.missing(), ["character/mahmut/vn_bust", "character/nobody/vn_bust"])
	assert_eq(assets.cached_count(), 0, "placeholders are not cached as art")


func test_present_art_is_loaded_once_and_kept_in_the_cache() -> void:
	var loads: Array[String] = []
	var art: Texture2D = _texture()
	var assets: AssetResolver = AssetResolver.new(_catalog(),
		func(path: String) -> bool: return path == "res://assets/bg/fb.webp",
		func(path: String) -> Resource:
			loads.append(path)
			return art)
	assert_true(assets.has_art("background/forest/battle"))
	assert_same(assets.texture("background/forest/battle"), art)
	assert_same(assets.texture("background/forest/battle"), art)
	assert_eq(loads, ["res://assets/bg/fb.webp"], "loaded once")
	assert_same(assets.texture("background/forest/story"), assets.placeholder("background"), "another variant is not there")
	assert_eq(assets.missing(), ["background/forest/story"])


func test_a_file_that_is_not_a_texture_falls_back_to_the_placeholder() -> void:
	var assets: AssetResolver = AssetResolver.new(_catalog(), func(_path: String) -> bool: return true, func(_path: String) -> Resource: return Resource.new())
	assert_same(assets.texture("mark/mark_character_mahmut"), assets.placeholder("mark"))
	assert_eq(assets.missing(), ["mark/mark_character_mahmut"])


func test_cache_keeps_the_most_recently_used_textures() -> void:
	var files: Array = []
	for index: int in AssetResolver.CACHE_LIMIT + 2:
		files.append({"id": "icon_%d" % index, "file": "assets/ui/icon_%d.webp" % index})
	var catalog: AssetCatalog = AssetCatalog.from_packs({AssetCatalog.VISUAL_PACK: {"shared_ui": files}})
	var loads: Array[String] = []
	var assets: AssetResolver = AssetResolver.new(catalog, func(_path: String) -> bool: return true, func(path: String) -> Resource:
		loads.append(path)
		return _texture())
	assets.texture("ui/icon_0")
	for index: int in range(1, AssetResolver.CACHE_LIMIT + 2):
		assets.texture("ui/icon_%d" % index)
		assets.texture("ui/icon_0")
	assert_eq(assets.cached_count(), AssetResolver.CACHE_LIMIT)
	assert_eq(loads.count("res://assets/ui/icon_0.webp"), 1, "a texture in use stays cached")
	loads.clear()
	assets.texture("ui/icon_1")
	assert_eq(loads, ["res://assets/ui/icon_1.webp"], "the least recently used one was evicted and loads again")
