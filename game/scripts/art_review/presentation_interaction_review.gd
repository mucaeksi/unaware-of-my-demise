extends Node
## Actual native-window touch evidence; development-only, no network or save marker.
const Player = preload("res://scripts/ui/entry/entry_prologue.gd")

func run(directory: String) -> void:
	var window: Window = get_tree().root.get_node_or_null("LocalUiPreview") as Window
	if window == null or window.get_child_count() == 0: return
	var preview: Control = window.get_child(0) as Control
	preview.set("_entry_capture_phase", "prologue")
	preview.call("refresh_preview")
	for frame: int in 4: await get_tree().process_frame
	var host: Control = preview.get("_host") as Control
	var entry: EntryScreen = host.get_child(0) as EntryScreen
	var player: Player = entry._prologue
	UiPageTransition.finish_under(entry)
	await get_tree().process_frame
	player.set_process(false)
	var result: Dictionary = {"native": window.force_native, "skip_initially_hidden": not player._skip.visible}
	# Touch the exact area where Skip will appear, to catch an accidental double action.
	await _touch(window, player.global_position + Vector2(player.size.x - 170, 72))
	result["first_touch_reveals_only"] = player._skip.visible and not entry.body.visible and player.playing
	result["skip_top_right"] = player._skip.get_global_rect().end.x >= player.get_global_rect().end.x - 41 and player._skip.get_global_rect().position.y <= player.global_position.y + 21
	result["skip_touch_height"] = player._skip.size.y
	player.advance(6.0)
	await _capture(window, directory.path_join("skip-revealed.png"))
	await _touch(window, player._skip.get_global_rect().get_center())
	result["second_touch_skips"] = not player.visible and entry.body.visible and player.continue_selected
	result["transfer_after_skip"] = player._progress.value
	entry.start_prologue("")
	UiPageTransition.finish_under(entry)
	player.set_process(false)
	player.advance(120.0)
	for frame: int in 4: await get_tree().process_frame
	result["completion_waits"] = player.visible and not player.continue_selected and player._end_controls.visible
	result["end_has_replay_continue_only"] = player._replay.is_visible_in_tree() and player._continue.is_visible_in_tree() and not player._skip.is_visible_in_tree() and not player._download.is_visible_in_tree() and not player._narration_panel.is_visible_in_tree()
	var actions_center: Vector2 = (player._replay.get_global_rect().get_center() + player._continue.get_global_rect().get_center()) * 0.5
	result["actions_centered"] = actions_center.distance_to(player.get_global_rect().get_center()) < 1.0
	await _capture(window, directory.path_join("completion.png"))
	await _touch(window, player._replay.get_global_rect().get_center())
	player.set_process(false)
	result["touch_replay_restarts"] = player.playing and player.elapsed_seconds < 1.0 and not player._skip.visible
	player.advance(120.0)
	for frame: int in 4: await get_tree().process_frame
	await _touch(window, player._continue.get_global_rect().get_center())
	result["touch_continue_dismisses"] = not player.visible and entry.body.visible and player.continue_selected
	result["transfer_after_continue"] = player._progress.value
	var file: FileAccess = FileAccess.open(directory.path_join("native-touch.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "\t"))
	file.close()
	preview.set("_entry_capture_phase", "prologue")
	preview.call("refresh_preview")
	set_meta("status", "complete")

func _touch(window: Window, position: Vector2) -> void:
	var press: InputEventScreenTouch = InputEventScreenTouch.new()
	press.index = 0
	press.pressed = true
	press.position = position
	window.push_input(press, true)
	await get_tree().process_frame
	var release: InputEventScreenTouch = InputEventScreenTouch.new()
	release.index = 0
	release.position = position
	release.pressed = false
	window.push_input(release, true)
	for frame: int in 3: await get_tree().process_frame

func _capture(window: Window, path: String) -> void:
	await RenderingServer.frame_post_draw
	window.get_texture().get_image().save_png(path)
