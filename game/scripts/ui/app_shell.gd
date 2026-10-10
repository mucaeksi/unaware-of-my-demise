class_name AppShell
extends Control
## The root of the running game (scene `res://scenes/main/main.tscn`): hosts the one screen on show, applies the theme, and turns the platform
## notification for the Android back button into the right thing. Nothing is kept on the device to flush on pause or close (DEC-0012). What is shown, and in which order, is the
## `StoryDirector`'s business.
##
## Tests and tools set these options before the shell enters the tree: `flow` (an already loaded `GameFlow`; null = load the content on a
## worker thread) and `backend` (a `GameBackend`; null = the one `Online` provides). Battle seeds come from the server's attempts (DEC-0013),
## so a scripted playthrough is repeatable through its backend.

var flow: GameFlow = null
var backend: GameBackend = null
var text_scale: float = 1.0
var frame_rate: int = FrameRatePolicy.DEFAULT
var reduced_motion: bool = false:
	set(value):
		reduced_motion = value
		set_meta("ui_reduced_motion", value)
		if value and is_inside_tree():
			UiPageTransition.finish_under(self)

## Cold-start presentation; tests/tools can bypass it without changing player routing.
@export var startup_intro_enabled: bool = true
@export var startup_presentation: PackedScene = preload("res://scenes/ui/startup/startup_sequence.tscn")

var current: Control = null
var director: StoryDirector = null


func _init() -> void:
	# The shipped interface is English, including locale-sensitive font shaping.
	TranslationServer.set_locale("en")
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var preferences: ConfigFile = ConfigFile.new()
	preferences.load("user://settings.cfg")
	text_scale = clampf(float(preferences.get_value("ui", "text_scale", 1.0)), 1.0, 1.25)
	reduced_motion = bool(preferences.get_value("ui", "reduced_motion", false))
	frame_rate = FrameRatePolicy.apply(int(preferences.get_value("ui", "frame_rate", FrameRatePolicy.DEFAULT)))
	theme = UiTheme.create(text_scale)


func save_ui_preferences(path: String = "user://settings.cfg") -> void:
	var preferences: ConfigFile = ConfigFile.new()
	preferences.load(path)
	preferences.set_value("ui", "text_scale", text_scale)
	preferences.set_value("ui", "reduced_motion", reduced_motion)
	preferences.set_value("ui", "frame_rate", frame_rate)
	preferences.save(path)

func set_frame_rate(value: int) -> void:
	frame_rate = FrameRatePolicy.apply(value)


func _ready() -> void:
	director = StoryDirector.new()
	director.shell = self
	add_child(director)
	director.start()


## Puts `screen` on show and frees the one before it. Safe to call from a signal of the screen being replaced.
func show_screen(screen: Control) -> void:
	var previous: Control = null
	if current != null:
		if current is UiScreen and screen is UiScreen and not reduced_motion:
			previous = UiPageTransition.visual_copy(current)
		remove_child(current)
		current.queue_free()
	current = screen
	add_child(screen)
	if previous != null: UiPageTransition.reveal(screen, UiPageTransition.PAGE_SECONDS, previous)


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_WM_GO_BACK_REQUEST:
			handle_back()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and not event.is_echo():
		handle_back()
		get_viewport().set_input_as_handled()


func handle_back() -> void:
	if current != null and current.has_method("handle_back") and bool(current.call("handle_back")):
		return
	if director != null:
		director.on_back_unhandled()
