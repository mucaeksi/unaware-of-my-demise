class_name UiScreen
extends Control
## Base of every screen: a full-rect background, the OS safe-area insets, some padding and one column (`body`) for the subclass to fill.
## Screens are built in code, lazily and once (`ensure_built`, called by `_ready` and by every `load_*`), so a screen can be loaded before it
## enters the tree. A screen never decides what happens next: it emits signals and the story director listens.

const PADDING_SIDE: int = 40
const PADDING_VERTICAL: int = 32

var body: VBoxContainer = null

var _built: bool = false


func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)


func _ready() -> void:
	ensure_built()
	UiPageTransition.reveal(self)


func ensure_built() -> void:
	if _built:
		return
	_built = true
	var background: ColorRect = ColorRect.new()
	# The shared shader supplies the ink palette; white avoids multiplying it twice.
	background.color = Color.WHITE
	background.material = UiTheme.GothicTheme.background_material()
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	if _uses_ambient_backdrop():
		var atmosphere: NarrativeBackdrop = NarrativeBackdrop.new()
		add_child(atmosphere)
	var safe: SafeAreaContainer = SafeAreaContainer.new()
	safe.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(safe)
	var padding: MarginContainer = MarginContainer.new()
	padding.add_theme_constant_override("margin_left", PADDING_SIDE)
	padding.add_theme_constant_override("margin_right", PADDING_SIDE)
	padding.add_theme_constant_override("margin_top", PADDING_VERTICAL)
	padding.add_theme_constant_override("margin_bottom", PADDING_VERTICAL)
	safe.add_child(padding)
	body = VBoxContainer.new()
	body.add_theme_constant_override("separation", 24)
	padding.add_child(body)
	_build(body)


## Subclasses add their widgets to `column` (the same node as `body`).
func _build(_column: VBoxContainer) -> void:
	pass


## Menu atmosphere is decoration. Story and battle screens supply their own world art.
func _uses_ambient_backdrop() -> bool:
	return true


## The Android back button while this screen is showing: true = handled here, false = let the shell decide.
func handle_back() -> bool:
	if has_signal("back_requested"):
		emit_signal("back_requested")
		return true
	return false
