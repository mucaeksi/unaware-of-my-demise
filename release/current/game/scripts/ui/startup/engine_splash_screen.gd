class_name EngineSplashScreen
extends StartupSplashScreen
## Game-controlled screen, after the native/system splash; this is where scripting/audio can run.

const SCREEN_ID: String = "ui.engine_splash"


func _init() -> void:
	heading = "Godot"
	subtitle = "ENGINE"
	use_display_font = false
