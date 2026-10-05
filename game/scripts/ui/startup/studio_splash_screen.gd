class_name StudioSplashScreen
extends Control
## Raven/hourglass emblem and real wordmark layers. Branding candidate, shipped before any patch.

const SCREEN_ID: String = "ui.studio_splash"
const CandidateTheme = preload("res://theme/gothic_candidate_v01.gd")


func _ready() -> void:
	theme = CandidateTheme.create()
