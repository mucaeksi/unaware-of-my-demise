class_name StartupSequence
extends Control
## Covers the title while content loads. Its completed signal opens the title's readiness gate.
## One AudioDirector owns entry music throughout; this node never owns a player.
signal completed
signal phase_changed(screen_id: String)

const ENGINE_SCENE: PackedScene = preload("res://scenes/ui/startup/engine_splash_screen.tscn")
const STUDIO_SCENE: PackedScene = preload("res://scenes/ui/startup/studio_splash_screen.tscn")
const CandidateTheme = preload("res://theme/gothic_candidate_v01.gd")

@export_range(0.0, 5.0) var fade_seconds: float = 1.0
@export_range(0.0, 10.0) var engine_hold_seconds: float = 1.8
@export_range(0.0, 10.0) var studio_hold_seconds: float = 2.2
@export_range(0.0, 5.0) var title_reveal_seconds: float = 1.2
@export_range(0.0, 10.0) var music_fade_seconds: float = 5.0
@export var auto_start: bool = true

var phase: String = ""
var music_available: bool = false
var _screen: Control = null
var _timeline: Tween = null
var _begun: bool = false
var _finished: bool = false
var _suspended: bool = false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var background: ColorRect = ColorRect.new()
	background.color = CandidateTheme.INK
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	if auto_start:
		begin()


func begin() -> void:
	if _begun:
		return
	_begun = true
	_show_engine()
	music_available = Audio.play_entry_theme(music_fade_seconds)
	_timeline = create_tween()
	_timeline.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_timeline.tween_property(_screen, "modulate:a", 1.0, fade_seconds)
	_timeline.tween_interval(engine_hold_seconds)
	_timeline.tween_property(_screen, "modulate:a", 0.0, fade_seconds)
	_timeline.tween_callback(_show_studio)
	# Callbacks read the newly installed screen; the engine screen is freed between phases.
	_timeline.tween_method(_set_screen_alpha, 0.0, 1.0, fade_seconds)
	_timeline.tween_interval(studio_hold_seconds)
	_timeline.tween_method(_set_screen_alpha, 1.0, 0.0, fade_seconds)
	_timeline.tween_callback(_reveal_title)
	_timeline.tween_property(self, "modulate:a", 0.0, title_reveal_seconds)
	_timeline.tween_callback(_complete)
	if _suspended:
		_timeline.pause()


func cancel() -> void:
	if _timeline != null and _timeline.is_valid():
		_timeline.kill()
	_finished = true


func _exit_tree() -> void:
	cancel()


func _notification(what: int) -> void:
	if what in [NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_APPLICATION_FOCUS_OUT]:
		_suspended = true
		if _timeline != null and _timeline.is_valid():
			_timeline.pause()
	elif what in [NOTIFICATION_APPLICATION_RESUMED, NOTIFICATION_APPLICATION_FOCUS_IN]:
		_suspended = false
		if _timeline != null and _timeline.is_valid():
			_timeline.play()


func _replace(packed: PackedScene, screen_id: String) -> void:
	if _screen != null:
		remove_child(_screen)
		_screen.queue_free()
	_screen = packed.instantiate() as Control
	_screen.modulate.a = 0.0
	add_child(_screen)
	phase = screen_id
	phase_changed.emit(phase)


func _show_engine() -> void:
	_replace(ENGINE_SCENE, EngineSplashScreen.SCREEN_ID)


func _show_studio() -> void:
	_replace(STUDIO_SCENE, StudioSplashScreen.SCREEN_ID)


func _set_screen_alpha(value: float) -> void:
	_screen.modulate.a = value


func _reveal_title() -> void:
	phase = "ui.title"
	phase_changed.emit(phase)


func _complete() -> void:
	if _finished:
		return
	_finished = true
	completed.emit()
