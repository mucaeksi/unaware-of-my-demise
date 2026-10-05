class_name StudioSplashScreen
extends Control
## Raven/hourglass emblem and real wordmark layers. Branding candidate, shipped before any patch.

const SCREEN_ID: String = "ui.studio_splash"


func _ready() -> void:
	theme = UiTheme.create()
