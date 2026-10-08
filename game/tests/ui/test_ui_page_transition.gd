extends GutTest
## Animation never gates routing, input or verified patch state.

func _host() -> Control:
	var host: Control = Control.new()
	host.size = Vector2(1080, 1920)
	add_child_autofree(host)
	return host

func test_curtain_progresses_and_removes_its_render_layer() -> void:
	var host: Control = _host()
	var effect: UiPageTransition = UiPageTransition.reveal(host, 0.2)
	assert_not_null(effect)
	assert_eq(effect._veil.mouse_filter, Control.MOUSE_FILTER_IGNORE)
	assert_eq(effect._veil.focus_mode, Control.FOCUS_NONE)
	assert_eq(effect._veil.size, host.size)
	assert_eq(effect.progress, 0.0)
	await wait_seconds(0.08)
	assert_gt(effect.progress, 0.0)
	assert_lt(effect.progress, 1.0)
	await wait_seconds(0.25)
	assert_false(is_instance_valid(effect), "completed curtain has no retained texture/node")

func test_new_reveal_replaces_the_previous_effect_and_resize_tracks_the_target() -> void:
	var host: Control = _host()
	var first: UiPageTransition = UiPageTransition.reveal(host)
	var next: UiPageTransition = UiPageTransition.reveal(host)
	assert_false(first._veil.visible, "rapid phase events retire the previous curtain immediately")
	host.size = Vector2(720, 1280)
	assert_eq(next._veil.size, host.size)
	await wait_process_frames(1)
	assert_false(is_instance_valid(first))
	host.queue_free()
	await wait_process_frames(1)
	assert_false(is_instance_valid(next), "navigation removes the effect and cancels its tween")

func test_veil_uses_page_coordinates_inside_an_offset_preview_host() -> void:
	var host: Control = _host()
	var page: Control = Control.new()
	page.position = Vector2(0, 148)
	page.size = Vector2(1080, 1772)
	host.add_child(page)
	var effect: UiPageTransition = UiPageTransition.reveal(page)
	assert_eq(effect._veil.get_global_rect(), page.get_global_rect(), "a transition cannot cover the preview toolbar or escape its page")

func test_reduced_motion_skips_or_finishes_all_descendant_effects() -> void:
	var host: Control = _host()
	var page: Control = Control.new()
	host.add_child(page)
	var effect: UiPageTransition = UiPageTransition.reveal(page)
	assert_not_null(effect)
	host.set_meta("ui_reduced_motion", true)
	UiPageTransition.finish_under(host)
	assert_false(effect._veil.visible)
	assert_null(UiPageTransition.reveal(page))
	await wait_process_frames(1)
	assert_false(is_instance_valid(effect))

func test_patch_phase_and_focus_commit_while_visual_transition_is_active() -> void:
	var entry: EntryScreen = EntryScreen.new()
	entry.present("ready", true)
	add_child_autofree(entry)
	var page: EntryUtility = EntryUtility.new()
	page.page = "settings"
	entry.open_utility(page)
	var focus: Control = get_viewport().gui_get_focus_owner()
	entry.present("downloading", true)
	entry.present("verifying", true)
	assert_eq(entry.phase, "verifying")
	assert_true(entry.busy)
	assert_null(entry._overlay, "patch removes utility overlays at the page boundary")
	assert_false(entry._footer.is_visible_in_tree())
	assert_null(get_viewport().gui_get_focus_owner(), "hidden footer cannot retain focus")
	assert_false(entry.primary.visible, "transition cannot resubmit a hidden command")

func test_new_screens_inherit_reduced_motion_before_ready() -> void:
	var host: Control = _host()
	host.set_meta("ui_reduced_motion", true)
	var page: EntryUtility = EntryUtility.new()
	host.add_child(page)
	assert_null(page.find_child("@Node*", false, false))
	for child: Node in page.get_children():
		assert_false(child is UiPageTransition)

func test_outgoing_visual_has_no_commands_scripts_or_input_and_owns_its_material() -> void:
	var source: EntryScreen = EntryScreen.new()
	source.present("ready", true)
	add_child_autofree(source)
	var effect: UiPageTransition = UiPageTransition.reveal(source)
	var visual: Control = UiPageTransition.visual_copy(source)
	assert_null(visual.get_script(), "a frozen page cannot execute Entry commands")
	assert_eq(visual.process_mode, Node.PROCESS_MODE_DISABLED)
	for node: Node in visual.find_children("*", "", true, false):
		assert_null(node.get_script())
		assert_false(bool(node.get_meta("ui_transition_layer", false)), "no recursive veil snapshots")
		if node is Control:
			assert_eq((node as Control).mouse_filter, Control.MOUSE_FILTER_IGNORE)
			assert_eq((node as Control).focus_mode, Control.FOCUS_NONE)
	var original: CanvasItem = source.get_child(0) as CanvasItem
	var copy: CanvasItem = visual.get_child(0) as CanvasItem
	assert_not_same(original.material, copy.material, "tween uniforms cannot mutate the frozen page")
	visual.free()

func test_reduced_motion_disposes_outgoing_visual_without_allocating_a_snapshot() -> void:
	var source: Control = _host()
	var visual: Control = UiPageTransition.visual_copy(source)
	source.set_meta("ui_reduced_motion", true)
	assert_null(UiPageTransition.reveal(source, UiPageTransition.PAGE_SECONDS, visual))
	assert_false(is_instance_valid(visual))
	assert_eq(source.get_child_count(), 0)

func test_entry_modal_open_and_close_keep_the_outgoing_page_instead_of_a_black_cut() -> void:
	var host: Control = _host()
	var modal: GothicModal = GothicModal.new()
	host.add_child(modal)
	modal.open("Content update", "20 MiB", "Download")
	var opening: UiPageTransition = null
	for node: Node in modal.get_children():
		if node is UiPageTransition: opening = node as UiPageTransition
	assert_not_null(opening)
	assert_not_null(opening._snapshot, "the previous page survives the first frame of opening")
	assert_true(bool(opening._material.get_shader_parameter("has_previous")))
	modal.handle_back()
	var closing: UiPageTransition = null
	for node: Node in host.get_children():
		if node is UiPageTransition: closing = node as UiPageTransition
	assert_not_null(closing)
	assert_not_null(closing._snapshot, "the confirmation survives the first frame of closing")
	assert_true(bool(closing._material.get_shader_parameter("has_previous")))
	assert_false(modal.visible, "visual fade cannot delay cancel state")
