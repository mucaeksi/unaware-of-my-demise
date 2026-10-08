@tool
extends EditorScript
## Open in the Godot Script Editor, then File > Run (Ctrl+Shift+X).
const AudioPanel = preload("res://scripts/art_review/audio_authoring_panel.gd")

func _run() -> void:
	var editor: Control = EditorInterface.get_base_control()
	var existing: Window = editor.get_node_or_null("AudioAuthoring") as Window
	if existing != null:
		existing.show()
		existing.grab_focus()
		return
	var window: Window = Window.new()
	window.hide()
	window.name = "AudioAuthoring"
	window.title = "Audio Authoring - Local Configuration"
	window.size = Vector2i(560, 720)
	window.min_size = Vector2i(520, 700)
	window.force_native = true
	window.theme = editor.theme
	window.close_requested.connect(window.hide)
	editor.add_child(window)
	window.add_child(AudioPanel.new())
	window.popup_centered()
