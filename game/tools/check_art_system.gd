extends SceneTree
## Local resource/catalog proof only, no account request or content publication.


func _initialize() -> void:
	_check.call_deferred()


func _check() -> void:
	var catalog: AssetCatalog = AssetCatalog.from_dir("res://data/content")
	assert(catalog.error.is_empty(), catalog.error)
	var resolver: AssetResolver = AssetResolver.new(catalog)
	var references: Array[String] = ["ui/game_emblem", "ui/panel_frame_gothic"]
	for name: String in ["back", "close", "chevron", "check", "help", "settings", "home", "journey", "companions", "summon", "records", "lock", "waiting", "checked", "unchecked"]:
		references.append("ui/icon_" + name)
	for reference: String in references:
		assert(resolver.has_art(reference), reference)
		assert(resolver.texture(reference) != null, reference)
	assert(resolver.missing().is_empty())
	var shared: Theme = UiTheme.create()
	assert(shared.default_font != null)
	assert(shared.get_stylebox("panel", UiTheme.FRAME) is StyleBoxTexture)
	print("ART_SYSTEM_RESOURCES_OK: 17 catalog textures, bundled fonts, shared Theme and 9-slice frame")
	quit()
