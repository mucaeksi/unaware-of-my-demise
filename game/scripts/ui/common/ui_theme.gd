class_name UiTheme
extends RefCounted
## The look every screen shares. Placeholder art direction (the real one is docs/ART_BIBLE.md and the art calendar, brief 8/5): flat dark panels,
## one gold accent, large touch targets for a 1080x1920 portrait canvas. Built in code so it is reviewable as text and testable.

const BACKGROUND: Color = Color(0.113, 0.102, 0.169)
const PANEL: Color = Color(0.165, 0.149, 0.243)
const PANEL_RAISED: Color = Color(0.235, 0.212, 0.345)
const PANEL_HOVER: Color = Color(0.29, 0.262, 0.42)
const PANEL_SELECTED: Color = Color(0.36, 0.29, 0.14)
const ACCENT: Color = Color(0.788, 0.635, 0.29)
const TEXT: Color = Color(0.93, 0.92, 0.96)
const TEXT_DIM: Color = Color(0.64, 0.62, 0.74)
const DANGER: Color = Color(0.93, 0.4, 0.4)
const HEAL: Color = Color(0.45, 0.85, 0.55)
const PLAYER_TINT: Color = Color(0.3, 0.5, 0.75)
const ENEMY_TINT: Color = Color(0.72, 0.3, 0.32)

const FONT_BODY: int = 36
const FONT_SMALL: int = 28
const FONT_TITLE: int = 60
const CORNER: int = 20
## 48 dp on a phone of about 411 dp width, on the 1080-wide canvas.
const TOUCH_HEIGHT: int = 120

## Theme type variations (`control.theme_type_variation = ...`).
const TITLE: String = "TitleLabel"
const DIM: String = "DimLabel"
const SMALL: String = "SmallLabel"
const DANGER_LABEL: String = "DangerLabel"
const PLACEHOLDER_TAG: String = "PlaceholderTag"
const BAR_PLAYER: String = "HpBarPlayer"
const BAR_ENEMY: String = "HpBarEnemy"


static func box(color: Color, corner: int = CORNER, border: Color = Color(0, 0, 0, 0), border_width: int = 0, margin_x: int = 28, margin_y: int = 16) -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = color
	style.set_corner_radius_all(corner)
	style.border_color = border
	style.set_border_width_all(border_width)
	style.content_margin_left = margin_x
	style.content_margin_right = margin_x
	style.content_margin_top = margin_y
	style.content_margin_bottom = margin_y
	return style


static func create() -> Theme:
	var theme: Theme = Theme.new()
	theme.default_font_size = FONT_BODY
	theme.set_color("font_color", "Label", TEXT)

	theme.set_stylebox("normal", "Button", box(PANEL_RAISED))
	theme.set_stylebox("hover", "Button", box(PANEL_HOVER))
	theme.set_stylebox("pressed", "Button", box(PANEL_SELECTED, CORNER, ACCENT, 4))
	theme.set_stylebox("hover_pressed", "Button", box(PANEL_SELECTED, CORNER, ACCENT, 4))
	theme.set_stylebox("disabled", "Button", box(PANEL))
	var focus: StyleBoxFlat = box(Color(0, 0, 0, 0), CORNER, ACCENT, 3)
	focus.draw_center = false
	theme.set_stylebox("focus", "Button", focus)
	theme.set_color("font_color", "Button", TEXT)
	theme.set_color("font_hover_color", "Button", TEXT)
	theme.set_color("font_pressed_color", "Button", ACCENT)
	theme.set_color("font_hover_pressed_color", "Button", ACCENT)
	theme.set_color("font_disabled_color", "Button", TEXT_DIM)

	theme.set_stylebox("panel", "PanelContainer", box(PANEL))

	theme.set_type_variation(TITLE, "Label")
	theme.set_font_size("font_size", TITLE, FONT_TITLE)
	theme.set_color("font_color", TITLE, ACCENT)
	theme.set_type_variation(DIM, "Label")
	theme.set_color("font_color", DIM, TEXT_DIM)
	theme.set_type_variation(SMALL, "Label")
	theme.set_font_size("font_size", SMALL, FONT_SMALL)
	theme.set_color("font_color", SMALL, TEXT_DIM)
	theme.set_type_variation(DANGER_LABEL, "Label")
	theme.set_color("font_color", DANGER_LABEL, DANGER)
	theme.set_type_variation(PLACEHOLDER_TAG, "Label")
	theme.set_font_size("font_size", PLACEHOLDER_TAG, 22)
	theme.set_color("font_color", PLACEHOLDER_TAG, ACCENT)

	var trough: StyleBoxFlat = box(Color(0.06, 0.055, 0.1), 10, Color(0, 0, 0, 0), 0, 0, 0)
	for variation: String in [BAR_PLAYER, BAR_ENEMY]:
		theme.set_type_variation(variation, "ProgressBar")
		theme.set_stylebox("background", variation, trough)
	theme.set_stylebox("fill", BAR_PLAYER, box(Color(0.35, 0.78, 0.5), 10, Color(0, 0, 0, 0), 0, 0, 0))
	theme.set_stylebox("fill", BAR_ENEMY, box(Color(0.85, 0.36, 0.34), 10, Color(0, 0, 0, 0), 0, 0, 0))
	return theme
