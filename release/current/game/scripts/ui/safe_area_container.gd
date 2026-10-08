class_name SafeAreaContainer
extends MarginContainer
## Pads its children by the OS safe area (status and navigation bars, camera cutout). Put screens inside it;
## backgrounds stay outside so they extend under the insets on tall devices (docs/ART_BIBLE.md).
var _source_viewport: Viewport = null


func _ready() -> void:
	_bind_viewport()


func _enter_tree() -> void:
	_bind_viewport.call_deferred()


func _bind_viewport() -> void:
	if not is_inside_tree():
		return
	_source_viewport = get_viewport()
	if not _source_viewport.size_changed.is_connected(_apply):
		_source_viewport.size_changed.connect(_apply)
	_apply()


func _apply() -> void:
	if not is_inside_tree() or not is_instance_valid(_source_viewport):
		return
	var window_size: Vector2i = DisplayServer.window_get_size()
	var safe_area: Rect2i = DisplayServer.get_display_safe_area()
	var insets: Dictionary = SafeAreaMath.margins(window_size, safe_area, _source_viewport.get_visible_rect().size)
	add_theme_constant_override("margin_left", int(insets["left"]))
	add_theme_constant_override("margin_top", int(insets["top"]))
	add_theme_constant_override("margin_right", int(insets["right"]))
	add_theme_constant_override("margin_bottom", int(insets["bottom"]))


func _exit_tree() -> void:
	if is_instance_valid(_source_viewport) and _source_viewport.size_changed.is_connected(_apply):
		_source_viewport.size_changed.disconnect(_apply)
	_source_viewport = null
