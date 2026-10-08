class_name NarrativeBackdrop
extends Control
## Ambient UI illustration, never a story location or a gameplay background.
const ATMOSPHERE: Texture2D = preload("res://assets/ui/narrative/v002/entry_atmosphere.png")
var strength: float = 0.18

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var art: TextureRect = TextureRect.new()
	art.texture = ATMOSPHERE
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	art.modulate = Color(1, 1, 1, strength)
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(art)
