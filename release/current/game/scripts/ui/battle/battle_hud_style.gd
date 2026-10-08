class_name BattleHudStyle
extends RefCounted
## Small native Godot styles: reuse the game's bronze/bone palette, with no new
## bitmap/UI atlas or dependency outside the AAB's local presentation assets.

const INK: Color = Color("#100f17")
const EDGE: Color = Color("#8c684b")
const LIGHT_EDGE: Color = Color("#d3ad78")
const BONE: Color = Color("#f1e5ce")
const MUTED: Color = Color("#b8a68c")
const ALLY: Color = Color("#92d0bf")
const ENEMY: Color = Color("#e38992")
const BAR_HEIGHT: int = 18
const CARD_WIDTH: int = 176

static func panel() -> StyleBoxFlat:
	var style: StyleBoxFlat = UiTheme.box(Color(0.063, 0.058, 0.085, 0.94), 10, EDGE, 1, 22, 14)
	style.shadow_color = Color(0, 0, 0, 0.3)
	style.shadow_size = 4
	return style

## Quiet metal framing shared by the opening reader, arena and party HUD.
static func frame(tone: Color = EDGE, opacity: float = 0.94, padding: int = 24) -> StyleBoxFlat:
	var style: StyleBoxFlat = UiTheme.box(Color(INK, opacity), 8, Color(tone, 0.55), 1, padding, padding)
	style.border_width_top = 2
	style.shadow_color = Color(0, 0, 0, 0.28)
	style.shadow_size = 4
	return style

static func text_scale(control: Control) -> float:
	return clampf(float(control.get_theme_default_font_size()) / UiTheme.FONT_BODY, 1.0, 1.25)

## Focus is a transparent overlay over the normal/pressed surface.
static func action(button: Button, primary: bool = false, font_size: int = 32) -> void:
	button.custom_minimum_size = Vector2(0, UiTheme.TOUCH_HEIGHT)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.add_theme_font_override("font", UiTheme.GothicTheme.DISPLAY_FONT)
	button.add_theme_font_size_override("font_size", font_size)
	button.add_theme_color_override("font_color", BONE if primary else MUTED)
	button.add_theme_color_override("font_hover_color", BONE)
	button.add_theme_color_override("font_pressed_color", BONE)
	button.add_theme_color_override("font_disabled_color", Color("#807782"))
	button.add_theme_constant_override("icon_max_width", 28)
	button.add_theme_constant_override("h_separation", 12)
	for state: String in ["normal", "hover", "pressed", "disabled"]:
		var selected: bool = state == "pressed"
		var fill: Color = Color("#36202d") if selected or primary else INK
		if state == "hover": fill = fill.lightened(0.08)
		var edge: Color = LIGHT_EDGE if primary or selected else EDGE
		if state == "disabled": edge = edge.darkened(0.55)
		var style: StyleBoxFlat = UiTheme.box(fill, 8, Color(edge, 0.8), 2 if primary else 1, 18, 18)
		button.add_theme_stylebox_override(state, style)
	var focus: StyleBoxFlat = UiTheme.box(Color.TRANSPARENT, 8, BONE, 2, 0, 0)
	focus.draw_center = false
	focus.set_expand_margin_all(4)
	button.add_theme_stylebox_override("focus", focus)

static func accent(view: BattlePlayback.UnitView) -> Color:
	if view.team != "player": return ENEMY if view.art_id != "hollow_pilgrim" else Color("#bba4b3")
	if view.art_id == "fadyme" or view.element == "Veil": return Color("#bda5e3")
	if view.art_id == "mahmut" or view.element == "Stone": return Color("#d1b57f")
	return ALLY

static func card(tone: Color = EDGE) -> StyleBoxFlat:
	var style: StyleBoxFlat = UiTheme.box(Color(0.045, 0.039, 0.060, 0.94), 5, Color(tone, 0.5), 1, 6, 5)
	style.border_width_top = 0
	style.border_width_bottom = 0
	return style

static func nameplate(tone: Color, stone: bool = false) -> StyleBoxFlat:
	var style: StyleBoxFlat = UiTheme.box(INK.lerp(tone, 0.07), 3 if stone else 7, tone.darkened(0.28), 1, 4, 5)
	style.border_width_top = 2
	style.shadow_color = Color(0, 0, 0, 0.35)
	style.shadow_size = 2
	return style

static func level_badge(tone: Color) -> StyleBoxFlat:
	return UiTheme.box(INK.lerp(tone, 0.22), 3, Color(tone, 0.6), 1, 3, 1)

static func label(control: Label, pixels: int, color: Color = BONE) -> void:
	control.add_theme_font_size_override("font_size", pixels)
	control.add_theme_color_override("font_color", color)
	control.add_theme_color_override("font_outline_color", Color(0.035, 0.024, 0.04, 0.95))
	control.add_theme_constant_override("outline_size", 3)

static func health(bar: ProgressBar, ally: bool) -> void:
	bar.show_percentage = false
	bar.custom_minimum_size.y = BAR_HEIGHT
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var background: StyleBoxFlat = UiTheme.box(Color("#17121d"), 3, EDGE, 1, 0, 0)
	background.border_width_top = 2
	bar.add_theme_stylebox_override("background", background)
	var gradient: Gradient = Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.32, 0.47, 1.0])
	gradient.colors = PackedColorArray([Color("#264d4c"), ALLY, Color("#74b9a6"), Color("#3e7f74")]) if ally else PackedColorArray([Color("#5d293b"), ENEMY, Color("#bb6174"), Color("#803a52")])
	var texture: GradientTexture2D = GradientTexture2D.new()
	texture.gradient = gradient
	texture.width = 8
	texture.height = BAR_HEIGHT
	texture.fill_from = Vector2(0.5, 0.0)
	texture.fill_to = Vector2(0.5, 1.0)
	var fill: StyleBoxTexture = StyleBoxTexture.new()
	fill.texture = texture
	fill.expand_margin_top = -3
	fill.expand_margin_bottom = -3
	fill.expand_margin_left = -3
	fill.expand_margin_right = -3
	bar.add_theme_stylebox_override("fill", fill)

static func speed(button: Button) -> void:
	button.custom_minimum_size = Vector2(236, UiTheme.TOUCH_HEIGHT)
	button.size_flags_horizontal = Control.SIZE_SHRINK_END
	button.autowrap_mode = TextServer.AUTOWRAP_OFF
	button.add_theme_font_override("font", UiTheme.GothicTheme.DISPLAY_FONT)
	button.add_theme_font_size_override("font_size", 38)
	button.add_theme_color_override("font_color", BONE)
	button.add_theme_color_override("font_disabled_color", MUTED)
	button.add_theme_constant_override("h_separation", 14)
	button.add_theme_constant_override("icon_max_width", 30)
	for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
		var edge: Color = LIGHT_EDGE if state in ["hover", "focus"] else EDGE
		var fill: Color = Color("#28212b") if state == "hover" else INK
		var style: StyleBoxFlat = UiTheme.box(fill, 10, edge, 2, 28, 14)
		if state == "pressed":
			style.bg_color = Color("#321f2c")
		if state == "disabled":
			style.border_color = EDGE.darkened(0.3)
		button.add_theme_stylebox_override(state, style)
	var focus: StyleBoxFlat = UiTheme.box(Color.TRANSPARENT, 10, BONE, 2, 0, 0)
	focus.draw_center = false
	focus.set_expand_margin_all(4)
	button.add_theme_stylebox_override("focus", focus)
