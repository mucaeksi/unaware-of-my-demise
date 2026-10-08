extends GutTest
## Screen replacement must not leave a callback on a viewport after detaching.

func test_detach_resize_and_reattach_keeps_a_single_live_connection() -> void:
	var host: Control = Control.new()
	add_child_autofree(host)
	var safe: SafeAreaContainer = SafeAreaContainer.new()
	host.add_child(safe)
	await get_tree().process_frame
	var viewport: Viewport = host.get_viewport()
	assert_true(viewport.size_changed.is_connected(safe._apply))
	host.remove_child(safe)
	viewport.size_changed.emit()
	assert_false(viewport.size_changed.is_connected(safe._apply), "A detached screen must not receive resize callbacks")
	host.add_child(safe)
	await get_tree().process_frame
	assert_true(viewport.size_changed.is_connected(safe._apply), "A returning screen must restore its resize callback")
	viewport.size_changed.emit()
	assert_gte(safe.get_theme_constant("margin_top"), 0)

func test_moving_to_another_viewport_disconnects_the_original() -> void:
	var host: Control = Control.new()
	add_child_autofree(host)
	var safe: SafeAreaContainer = SafeAreaContainer.new()
	host.add_child(safe)
	await get_tree().process_frame
	var old_viewport: Viewport = host.get_viewport()
	var next_viewport: SubViewport = SubViewport.new()
	next_viewport.size = Vector2i(360, 640)
	host.add_child(next_viewport)
	host.remove_child(safe)
	next_viewport.add_child(safe)
	await get_tree().process_frame
	assert_false(old_viewport.size_changed.is_connected(safe._apply))
	assert_true(next_viewport.size_changed.is_connected(safe._apply))
	old_viewport.size_changed.emit()
	next_viewport.size_changed.emit()
	assert_gte(safe.get_theme_constant("margin_left"), 0)
