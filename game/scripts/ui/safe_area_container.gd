class_name SafeAreaContainer
extends MarginContainer
## Pads its children by the OS safe area (status and navigation bars, camera cutout). Put screens inside it;
## backgrounds stay outside so they extend under the insets on tall devices (docs/ART_BIBLE.md).


func _ready() -> void:
	get_viewport().size_changed.connect(_apply)
	_apply()


func _apply() -> void:
	var window_size: Vector2i = DisplayServer.window_get_size()
	var safe_area: Rect2i = DisplayServer.get_display_safe_area()
	var insets: Dictionary = SafeAreaMath.margins(window_size, safe_area, get_viewport().get_visible_rect().size)
	add_theme_constant_override("margin_left", int(insets["left"]))
	add_theme_constant_override("margin_top", int(insets["top"]))
	add_theme_constant_override("margin_right", int(insets["right"]))
	add_theme_constant_override("margin_bottom", int(insets["bottom"]))
