class_name EntryBackdrop
extends Control
## Non-canon UI atmosphere derived from the approved Narrative palette and architecture.
const PORTRAIT: Texture2D = preload("res://assets/ui/narrative/v002/entry_atmosphere.png")
var account_view: bool = true:
	set(value):
		account_view = value
		if _art != null:
			_art.modulate = Color(0.9, 0.84, 0.8, 0.85 if value else 0.6)
var _art: TextureRect

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)
	var art: TextureRect = TextureRect.new()
	_art = art
	art.texture = PORTRAIT
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(art)
	account_view = account_view
