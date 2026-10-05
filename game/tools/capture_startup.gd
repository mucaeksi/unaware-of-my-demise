extends Node
## Developer-only capture of the real cold-start scene, without a title tap or server/account request.
## godot --path game res://tools/startup_capture.tscn -- --startup-capture-dir=/absolute/output
var _directory: String = ""
var _shell: AppShell = null
var _captures: Array[Dictionary] = []


func _ready() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--startup-capture-dir="):
			_directory = argument.trim_prefix("--startup-capture-dir=")
	if _directory.is_empty():
		push_error("Supply --startup-capture-dir=/absolute/output")
		get_tree().quit(1)
		return
	_run.call_deferred()


func _run() -> void:
	if DisplayServer.get_name() == "headless":
		push_error("Viewport captures require a graphical renderer")
		get_tree().quit(1)
		return
	DirAccess.make_dir_recursive_absolute(_directory)
	var root: Window = get_tree().root
	var main: PackedScene = load("res://scenes/main/main.tscn") as PackedScene
	_shell = main.instantiate() as AppShell
	root.add_child(_shell)
	var intro: StartupSequence = _shell.director._startup
	await get_tree().create_timer(intro.fade_seconds + 0.25).timeout
	await _capture("studio", intro)
	await intro.completed
	await get_tree().process_frame
	await _capture("title", null)
	var audio: AudioDirector = root.get_node("Audio") as AudioDirector
	var record: Dictionary = {
		"engine": Engine.get_version_info()["string"],
		"source": "Uncomposited Godot viewport captures of the real main scene",
		"title_tapped": false, "account_requested": false,
		"music_cue": audio.music_cue(), "missing_audio": audio.missing(),
		"captures": _captures,
	}
	var output: FileAccess = FileAccess.open(_directory.path_join("capture.json"), FileAccess.WRITE)
	output.store_string(JSON.stringify(record, "  ") + "\n")
	_shell.queue_free()
	await get_tree().process_frame
	get_tree().quit()


func _capture(phase_name: String, intro: StartupSequence) -> void:
	await RenderingServer.frame_post_draw
	var captured: Image = get_tree().root.get_texture().get_image()
	var size: Vector2i = captured.get_size()
	var file_name: String = "%s_%dx%d.png" % [phase_name, size.x, size.y]
	var result: Error = captured.save_png(_directory.path_join(file_name))
	assert(result == OK, "Cannot save startup capture")
	var marks: Array[Dictionary] = []
	if intro != null:
		for node: Node in intro.find_children("Wordmark", "Label", true, false):
			var label: Label = node as Label
			marks.append({"text": label.text, "rect": str(label.get_global_rect()), "visible": label.is_visible_in_tree()})
	_captures.append({"file": file_name, "phase": intro.phase if intro != null else "ui.title", "wordmarks": marks,
		"title_ready": (_shell.current as TitleScreen)._ready_to_start})
