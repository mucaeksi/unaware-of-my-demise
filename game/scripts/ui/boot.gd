extends Control
## The diagnostics screen (it was the first screen until G5; the hub opens it in debug builds). Placeholder UI, marked as such on screen. It
## proves on a device that the app starts, the autoloads exist, the portrait canvas and safe area work and the AndroidKeyStore plugin responds
## (skipped while no native plugin ships), and shows cold-start time, FPS and memory. The report is also saved to user://smoke_report.txt.
## Run as the main scene it is the headless boot smoke; shown from the hub (`embedded`) it has a Back button.

signal back_requested

## Set before the node enters the tree when the hub shows this screen.
var embedded: bool = false

@onready var _info: Label = %InfoLabel
@onready var _smoke: Label = %SmokeLabel
@onready var _stats: Label = %StatsLabel
@onready var _back: Button = %BackButton

var _elapsed: float = 0.0
var _battle_job: WorkerJob = null
var _slowest_frame_ms: float = 0.0
var _frames_with_job: int = 0


func _ready() -> void:
	_back.visible = embedded
	_back.pressed.connect(func() -> void: back_requested.emit())
	var startup_ms: int = Time.get_ticks_msec()
	var info: Dictionary = Game.engine_info()
	_info.text = "Godot %s | %s | %s" % [info["godot"], info["renderer"], info["platform"]]
	var results: Array[Dictionary] = DeviceSmoke.run_all()
	var text: String = DeviceSmoke.report_text(results)
	text += "\nstartup to first screen: %d ms" % startup_ms
	_smoke.text = text
	var report: FileAccess = FileAccess.open(DeviceSmoke.REPORT_PATH, FileAccess.WRITE)
	if report != null:
		report.store_string(text + "\n")
		report.close()
	print("SMOKE_REPORT\n", text)
	# G3 measurement: the final-boss battle runs on a worker thread while this screen keeps drawing.
	_battle_job = WorkerJob.start(func() -> Dictionary: return DeviceSmoke.battle_benchmark())


func _process(delta: float) -> void:
	if _battle_job != null:
		# The first frame's delta also covers `_ready` (smoke checks), not the worker: leave it out.
		if _frames_with_job > 0:
			_slowest_frame_ms = maxf(_slowest_frame_ms, delta * 1000.0)
		_frames_with_job += 1
		if _battle_job.is_finished():
			_show_battle_result()
	_elapsed += delta
	if _elapsed < 0.5:
		return
	_elapsed = 0.0
	_stats.text = "%d FPS | static memory %.1f MB | video memory %.1f MB" % [
		Engine.get_frames_per_second(),
		float(OS.get_static_memory_usage()) / 1048576.0,
		Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0,
	]


func _show_battle_result() -> void:
	var result: Dictionary = _battle_job.finish()
	var line: String = DeviceSmoke.report_text([result] as Array[Dictionary])
	line += " | worker %d ms | slowest frame meanwhile %d ms" % [roundi(float(_battle_job.elapsed_usec) / 1000.0), roundi(_slowest_frame_ms)]
	_battle_job = null
	_smoke.text += "\n" + line
	var report: FileAccess = FileAccess.open(DeviceSmoke.REPORT_PATH, FileAccess.READ_WRITE)
	if report != null:
		report.seek_end()
		report.store_string(line + "\n")
		report.close()
	print("SMOKE_REPORT_BATTLE\n", line)
