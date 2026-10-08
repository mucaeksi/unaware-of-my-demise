extends Node
## Real-time animation evidence inside the existing editor runtime; never changes player state.
const Story = preload("res://scripts/ui/entry/entry_prologue.gd")
const Data = preload("res://scripts/ui/entry/entry_prologue_script.gd")
const Preview = preload("res://scripts/art_review/preview_session.gd")

func run(directory: String, capture_frames: bool = false) -> void:
	DirAccess.make_dir_recursive_absolute(directory)
	set_meta("status", "starting")
	var window: Window = Preview.open(get_tree())
	var preview: Control = window.get_child(0) as Control
	preview.set("_entry_capture_phase", "prologue")
	preview.call("refresh_preview")
	for frame: int in 6: await get_tree().process_frame
	var host: Control = preview.get("_host") as Control
	if host == null or host.get_child_count() == 0:
		set_meta("status", "missing_host")
		return
	var entry: EntryScreen = host.get_child(0) as EntryScreen
	if entry == null or entry._prologue == null:
		set_meta("status", "missing_story")
		return
	var player: Story = entry._prologue
	UiPageTransition.finish_under(entry)
	player.play()
	var samples: Array[float] = []
	var cpu_samples: Array[float] = []
	var shots: Array[Dictionary] = []
	var start: int = Time.get_ticks_usec()
	var previous: int = start
	var peak_texture: float = 0.0
	var peak_draws: int = 0
	var last_shot: int = -1
	var stable_camera: Rect2
	var camera_changes: int = 0
	var captured: Array[String] = []
	var stalls: Array[Dictionary] = []
	set_meta("status", "watching_120_seconds")
	while is_instance_valid(player) and player.playing and player.visible:
		await get_tree().process_frame
		var now: int = Time.get_ticks_usec()
		samples.append((now - previous) / 1000.0)
		previous = now
		cpu_samples.append(Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0)
		if samples.back() > 25.0:
			stalls.append({"elapsed": player.elapsed_seconds, "frame_ms": samples.back(),
				"cpu_ms": cpu_samples.back(), "scene_index": player._scene_index})
		peak_texture = maxf(peak_texture, Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED))
		peak_draws = maxi(peak_draws, int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)))
		if player._shot == null: break
		if player._scene_index != last_shot:
			last_shot = player._scene_index
			stable_camera = player._shot._background.get_rect()
			var record: Dictionary = player._shot.evidence()
			record["frame_ms"] = samples.back()
			shots.append(record)
		elif player._shot._background.get_rect() != stable_camera: camera_changes += 1
		var beat: float = player.elapsed_seconds - player._scene_start
		for moment: float in ([1.0, 5.0, 9.0] if capture_frames else []):
			var id: String = "%s-%02d" % [player._shot.shot_id, int(moment)]
			if beat >= moment and not id in captured:
				captured.append(id)
				await RenderingServer.frame_post_draw
				window.get_texture().get_image().save_png(directory.path_join(id + ".png"))
	var wall: float = (Time.get_ticks_usec() - start) / 1000000.0
	samples.sort()
	cpu_samples.sort()
	var result: Dictionary = {"wall_seconds": wall, "frames": samples.size(),
		"median_ms": _percentile(samples, 0.5), "p95_ms": _percentile(samples, 0.95),
		"max_ms": samples.back() if not samples.is_empty() else 0.0,
		"cpu_p95_ms": _percentile(cpu_samples, 0.95), "cpu_max_ms": cpu_samples.back() if not cpu_samples.is_empty() else 0.0,
		"peak_texture_mib_all_windows": peak_texture / 1048576.0,
		"peak_draw_calls_all_windows": peak_draws, "camera_changes_within_shots": camera_changes,
		"shots": shots, "captures": captured.size(), "runtime_pid": OS.get_process_id(),
		"stalls_over_25_ms": stalls,
		"timeline_seconds": player.elapsed_seconds if is_instance_valid(player) else -1.0,
		"download_percent": player._progress.value if is_instance_valid(player) else -1.0,
		"hardware_scope": "Windows desktop editor runtime; Android not measured"}
	var file: FileAccess = FileAccess.open(directory.path_join("playback.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "\t"))
	file.close()
	set_meta("status", "complete")

func _percentile(values: Array[float], fraction: float) -> float:
	return values[floori((values.size() - 1) * fraction)] if not values.is_empty() else 0.0
