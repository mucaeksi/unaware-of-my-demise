extends Node
## Development-only bounded evidence; no production capture or player-state writes.
const Player = preload("res://scripts/ui/entry/entry_prologue.gd")
const Data = preload("res://scripts/ui/entry/entry_prologue_script.gd")
const Preview = preload("res://scripts/art_review/preview_session.gd")

func run(directory: String) -> void:
	set_meta("status", "matrix")
	var records: Array[Dictionary] = []
	for configuration: Dictionary in [
		{"name": "normal", "physical": Vector2i(1080, 1920), "logical": Vector2i(1080, 1920), "scale": 1.0},
		{"name": "compact-large", "physical": Vector2i(720, 1280), "logical": Vector2i(1080, 1920), "scale": 1.25},
		{"name": "tall-large", "physical": Vector2i(1080, 2400), "logical": Vector2i(1080, 2400), "scale": 1.25}]:
		records.append(await capture(configuration, directory))
	_write(directory.path_join("matrix.json"), {"configurations": records})
	var window: Window = Preview.open(get_tree())
	if window.get_child_count() == 0:
		set_meta("status", "missing_preview")
		return
	var preview: Control = window.get_child(0) as Control
	preview.set("_entry_capture_phase", "prologue")
	preview.call("refresh_preview")
	for frame: int in 4: await get_tree().process_frame
	var host: Control = preview.get("_host") as Control
	if host == null or host.get_child_count() == 0 or not host.get_child(0) is EntryScreen:
		set_meta("status", "missing_entry")
		return
	var entry: EntryScreen = host.get_child(0) as EntryScreen
	if entry._prologue == null:
		set_meta("status", "missing_player")
		return
	var player: Player = entry._prologue
	player.play()
	var lines: Array[String] = ["entry_past_001"]
	player.scene_presented.connect(func(line: String, _cue: String) -> void: lines.append(line))
	set_meta("status", "watching_120_seconds")
	var samples: Array[float] = []
	var max_draw_calls: int = 0
	var started: int = Time.get_ticks_usec()
	var previous: int = started
	while is_instance_valid(player) and player.playing:
		await get_tree().process_frame
		var now: int = Time.get_ticks_usec()
		samples.append((now - previous) / 1000.0)
		previous = now
		max_draw_calls = maxi(max_draw_calls, int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)))
	var elapsed: float = (Time.get_ticks_usec() - started) / 1000000.0
	samples.sort()
	var summary: Dictionary = {"wall_seconds": elapsed, "timeline_seconds": player.elapsed_seconds,
		"line_ids": lines, "frame_samples": samples.size(), "median_ms": samples[floori(samples.size() / 2.0)],
		"p95_ms": samples[floori((samples.size() - 1) * 0.95)], "max_ms": samples.back(),
		"max_draw_calls_all_windows": max_draw_calls, "fps": Engine.get_frames_per_second(),
		"native_window_id": window.get_window_id(), "runtime_pid": OS.get_process_id(),
		"font_size": player._text.get_theme_font_size("font_size"), "marker_written": Player.was_seen(),
		"download_percent": player._progress.value, "preview": true}
	_write(directory.path_join("native-playback.json"), summary)
	await RenderingServer.frame_post_draw
	window.get_texture().get_image().save_png(directory.path_join("native-complete.png"))
	player.play()
	set_meta("status", "complete")

func run_matrices_only(directory: String) -> void:
	set_meta("status", "matrix")
	var records: Array[Dictionary] = []
	for configuration: Dictionary in [
		{"name": "normal", "physical": Vector2i(1080, 1920), "logical": Vector2i(1080, 1920), "scale": 1.0},
		{"name": "compact-large", "physical": Vector2i(720, 1280), "logical": Vector2i(1080, 1920), "scale": 1.25},
		{"name": "tall-large", "physical": Vector2i(1080, 2400), "logical": Vector2i(1080, 2400), "scale": 1.25}]:
		records.append(await capture(configuration, directory))
	_write(directory.path_join("matrix.json"), {"configurations": records})
	var window: Window = Preview.open(get_tree())
	if window.get_child_count() > 0:
		var preview: Control = window.get_child(0) as Control
		preview.set("_entry_capture_phase", "prologue")
		preview.call("refresh_preview")
	set_meta("status", "complete")

func capture(configuration: Dictionary, directory: String) -> Dictionary:
	var output: String = directory.path_join(str(configuration["name"]))
	DirAccess.make_dir_recursive_absolute(output)
	var viewport: SubViewport = SubViewport.new()
	viewport.size = configuration["physical"]
	viewport.size_2d_override = configuration["logical"]
	viewport.size_2d_override_stretch = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	get_tree().root.add_child(viewport)
	var entry: EntryScreen = EntryScreen.new()
	entry.theme = UiTheme.create(float(configuration["scale"]))
	entry.set_meta("ui_reduced_motion", true)
	entry.present("downloading", true)
	viewport.add_child(entry)
	for frame: int in 4: await get_tree().process_frame
	entry.set_download_progress(5242880, 20971520)
	entry.start_prologue("")
	var player: Player = entry._prologue
	player.set_process(false)
	UiPageTransition.finish_under(entry)
	var result: Dictionary = {"name": configuration["name"], "text_scale": configuration["scale"], "scenes": []}
	var data: Dictionary = Data.load_timeline().value
	for scene: Dictionary in data["scenes"]:
		for frame: int in 4: await get_tree().process_frame
		await RenderingServer.frame_post_draw
		var rect: Rect2 = player.get_global_rect()
		var text_rect: Rect2 = player._text.get_global_rect()
		var controls_fit: bool = rect.encloses(player._skip.get_global_rect())
		var text_fits: bool = text_rect.size.y >= player._text.get_minimum_size().y and rect.encloses(text_rect)
		var watermark: Rect2 = player._logo.get_global_rect()
		var watermark_fits: bool = rect.encloses(watermark) and watermark.end.x < rect.get_center().x and watermark.end.y < rect.position.y + 200 and is_equal_approx(player._logo.modulate.a, 0.42)
		(result["scenes"] as Array).append({"line_id": scene["line_id"], "controls_fit": controls_fit,
			"text_fits": text_fits, "font_size": player._text.get_theme_font_size("font_size"),
			"watermark_fits": watermark_fits, "subtitle_at_bottom": rect.end.y - player._narration_panel.get_global_rect().end.y <= 13.0,
			"download_above_subtitle": player._download.get_global_rect().end.y < player._narration_panel.get_global_rect().position.y,
			"download_percent": player._progress.value})
		viewport.get_texture().get_image().save_png(output.path_join(str(scene["id"]) + ".png"))
		player.advance(float(scene["duration_seconds"]))
	viewport.queue_free()
	await get_tree().process_frame
	return result

func _write(path: String, value: Dictionary) -> void:
	var file: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	file.store_string(JSON.stringify(value, "\t"))
	file.close()
