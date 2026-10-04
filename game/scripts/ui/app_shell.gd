class_name AppShell
extends Control
## The root of the running game (scene `res://scenes/main/main.tscn`): hosts the one screen on show, applies the theme, and turns the platform
## notification for the Android back button into the right thing. Nothing is kept on the device to flush on pause or close (DEC-0012). What is shown, and in which order, is the
## `StoryDirector`'s business.
##
## Tests and tools set these options before the shell enters the tree: `flow` (an already loaded `GameFlow`; null = load the content on a
## worker thread), `backend` (a `GameBackend`; null = the one `Online` provides), and `battle_seed` (>= 0 = every battle uses that seed, so a
## scripted playthrough is repeatable; -1 = a fresh seed per attempt, as in play).

var flow: GameFlow = null
var backend: GameBackend = null
var battle_seed: int = -1

var current: Control = null
var director: StoryDirector = null


func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = UiTheme.create()


func _ready() -> void:
	director = StoryDirector.new()
	director.shell = self
	add_child(director)
	director.start()


## Puts `screen` on show and frees the one before it. Safe to call from a signal of the screen being replaced.
func show_screen(screen: Control) -> void:
	if current != null:
		remove_child(current)
		current.queue_free()
	current = screen
	add_child(screen)


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_WM_GO_BACK_REQUEST:
			if current != null and current.has_method("handle_back") and bool(current.call("handle_back")):
				return
			if director != null:
				director.on_back_unhandled()
