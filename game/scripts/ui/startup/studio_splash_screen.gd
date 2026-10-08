class_name StudioSplashScreen
extends Control
## Raven/hourglass emblem and real wordmark layers. Branding candidate, shipped before any patch.

const SCREEN_ID: String = "ui.studio_splash"
var _brand_tween: Tween = null


func _ready() -> void:
	theme = UiTheme.create()
	var atmosphere: NarrativeBackdrop = NarrativeBackdrop.new()
	atmosphere.strength = 0.12
	add_child(atmosphere)
	move_child(atmosphere, 1)
	if not UiPageTransition.reduced_for(self):
		UiPageTransition.reveal(self, 1.6)
		_reveal_brand.call_deferred()

func _reveal_brand() -> void:
	var brand: Control = find_child("Brand", true, false) as Control
	if brand == null or UiPageTransition.reduced_for(self):
		return
	brand.pivot_offset = brand.size * 0.5
	brand.scale = Vector2(0.97, 0.97)
	_brand_tween = create_tween()
	_brand_tween.tween_property(brand, "scale", Vector2.ONE, 3.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
