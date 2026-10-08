extends RefCounted
## Development-only native window. Reuse the editor's live game process and this window across revisions.
const SCENE: String = "res://scenes/art_review/entry_preview.tscn"
const WINDOW_NAME: String = "LocalUiPreview"

static func open(tree: SceneTree) -> Window:
	var existing: Window = tree.root.get_node_or_null(WINDOW_NAME) as Window
	if existing != null:
		existing.show()
		return existing
	var window: Window = Window.new()
	window.visible = false
	window.name = WINDOW_NAME
	window.force_native = true
	window.size = Vector2i(540, 960)
	window.min_size = Vector2i(360, 640)
	window.position = Vector2i(30, 40)
	window.content_scale_size = Vector2i(1080, 1920)
	window.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	window.close_requested.connect(window.hide)
	tree.root.add_child(window)
	var scene: PackedScene = load(SCENE) as PackedScene
	window.add_child(scene.instantiate())
	window.show()
	return window

static func refresh(tree: SceneTree) -> void:
	var window: Window = open(tree)
	for child: Node in window.get_children():
		if child is Control and child.has_method("refresh_preview"):
			child.call("refresh_preview")

static func open_fadyme(tree: SceneTree) -> Window:
	var window: Window = open(tree)
	window.title = "UOMD · Local UI Preview · Fadyme"
	var existing: Node = window.get_node_or_null("FadymePilot")
	if existing != null:
		existing.call("refresh_preview")
		return window
	for child: Node in window.get_children():
		window.remove_child(child)
		child.queue_free()
	var pilot: Control = load("res://scripts/art_review/fadyme_pilot.gd").new()
	pilot.name = "FadymePilot"
	window.add_child(pilot)
	return window


static func open_vfx(tree: SceneTree) -> Window:
	var window: Window = open(tree)
	var existing: Control = window.get_node_or_null("GdquestVfxReview") as Control
	if existing != null:
		existing.show()
		return window
	if window.get_node_or_null("FadymePilot") == null:
		window = open_fadyme(tree)
	window.set_meta("vfx_previous_title", window.title)
	window.title = "UOMD · Local UI Preview · GDQuest VFX Study"
	var gallery: Control = load("res://scripts/art_review/gdquest_vfx_review.gd").new()
	gallery.name = "GdquestVfxReview"
	window.add_child(gallery)
	var pilot: Control = window.get_node("FadymePilot") as Control
	pilot.hide()
	return window
