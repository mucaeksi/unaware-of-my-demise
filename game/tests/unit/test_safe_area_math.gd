extends GutTest
## SafeAreaMath: OS safe area (window pixels) to margins in canvas pixels.


func test_no_insets_when_the_safe_area_is_the_whole_window() -> void:
	var m: Dictionary = SafeAreaMath.margins(Vector2i(1080, 1920), Rect2i(0, 0, 1080, 1920), Vector2(1080, 1920))
	assert_eq(m, {"left": 0, "top": 0, "right": 0, "bottom": 0})


func test_status_bar_and_gesture_bar_become_top_and_bottom_margins() -> void:
	var m: Dictionary = SafeAreaMath.margins(Vector2i(1080, 2400), Rect2i(0, 96, 1080, 2208), Vector2(1080, 2400))
	assert_eq(m["top"], 96)
	assert_eq(m["bottom"], 96)
	assert_eq(m["left"], 0)


func test_margins_scale_to_the_canvas_and_round_up() -> void:
	# A 540 x 960 window showing a 1080 x 1920 canvas: every window pixel is two canvas pixels.
	var m: Dictionary = SafeAreaMath.margins(Vector2i(540, 960), Rect2i(0, 25, 540, 900), Vector2(1080, 1920))
	assert_eq(m["top"], 50)
	assert_eq(m["bottom"], 70)  # 960 - (25 + 900) = 35 window px -> 70 canvas px
	assert_eq(SafeAreaMath.margins(Vector2i(300, 600), Rect2i(0, 1, 300, 598), Vector2(1080, 1920))["top"], 4)  # ceil(3.6)


func test_a_cutout_on_the_left_is_respected() -> void:
	var m: Dictionary = SafeAreaMath.margins(Vector2i(1000, 500), Rect2i(60, 0, 940, 500), Vector2(1000, 500))
	assert_eq(m["left"], 60)
	assert_eq(m["right"], 0)


func test_an_empty_safe_area_or_window_means_no_insets() -> void:
	var none: Dictionary = {"left": 0, "top": 0, "right": 0, "bottom": 0}
	assert_eq(SafeAreaMath.margins(Vector2i(1080, 1920), Rect2i(), Vector2(1080, 1920)), none)
	assert_eq(SafeAreaMath.margins(Vector2i(0, 0), Rect2i(0, 0, 10, 10), Vector2(1080, 1920)), none)
