extends RefCounted
const AudioPanel = preload("res://scripts/art_review/audio_authoring_panel.gd")

static func open(tree: SceneTree) -> Window:
	var existing: Window = tree.root.get_node_or_null("AudioAuthoring") as Window
	if existing != null:
		existing.show()
		return existing
	var window: Window = Window.new()
	window.hide()
	window.name = "AudioAuthoring"
	window.title = "Audio Authoring - Local Configuration"
	window.size = Vector2i(560, 720)
	window.min_size = Vector2i(520, 700)
	window.position = Vector2i(590, 90)
	window.content_scale_size = Vector2i(560, 720)
	window.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	window.force_native = true
	window.theme = ThemeDB.get_default_theme()
	window.close_requested.connect(window.hide)
	tree.root.add_child(window)
	window.add_child(AudioPanel.new())
	window.show()
	return window
