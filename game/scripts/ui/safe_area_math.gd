class_name SafeAreaMath
extends RefCounted
## Converts the OS safe area (window pixels) into margins in canvas pixels (brief G2.2).
## Pure math, no Node, so it is unit-tested headless.


## Margins {"left", "top", "right", "bottom"} in canvas pixels. An empty safe area (headless, some
## desktops) means "no insets".
static func margins(window_size: Vector2i, safe_area: Rect2i, canvas_size: Vector2) -> Dictionary:
	var none: Dictionary = {"left": 0, "top": 0, "right": 0, "bottom": 0}
	if window_size.x <= 0 or window_size.y <= 0 or safe_area.size.x <= 0 or safe_area.size.y <= 0:
		return none
	var scale_x: float = canvas_size.x / float(window_size.x)
	var scale_y: float = canvas_size.y / float(window_size.y)
	var left: int = maxi(0, safe_area.position.x)
	var top: int = maxi(0, safe_area.position.y)
	var right: int = maxi(0, window_size.x - (safe_area.position.x + safe_area.size.x))
	var bottom: int = maxi(0, window_size.y - (safe_area.position.y + safe_area.size.y))
	return {
		"left": ceili(float(left) * scale_x),
		"top": ceili(float(top) * scale_y),
		"right": ceili(float(right) * scale_x),
		"bottom": ceili(float(bottom) * scale_y),
	}
