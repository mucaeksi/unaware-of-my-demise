extends RefCounted
## Candidate v01 only. Explicitly consumed by the art review scene; active UiTheme is unchanged.
## Palette/spec: narrative/design/ART_SYSTEM_V01.md.

const INK: Color = Color("#0b0d11")
const PANEL: Color = Color("#15181f")
const RAISED: Color = Color("#20242c")
const BONE: Color = Color("#ede3d2")
const MUTED: Color = Color("#b7b0a6")
const SILVER: Color = Color("#b7bec9")
const BRONZE: Color = Color("#8c755f")
const WINE: Color = Color("#4b2028")
const WINE_HOVER: Color = Color("#602a34")
const WINE_PRESSED: Color = Color("#35191f")
const DANGER: Color = Color("#ffb9b6")
const TEAL: Color = Color("#86beb7")
## 48 dp at a 360 dp-wide phone on the 1080-wide logical canvas.
const TOUCH_HEIGHT: int = 144
const BODY_SIZE: int = 36
const SMALL_SIZE: int = 30
const TITLE_SIZE: int = 58


static func box(fill: Color, edge: Color, border_width: int = 2) -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = edge
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(8)
	style.content_margin_left = 32
	style.content_margin_right = 32
	style.content_margin_top = 18
	style.content_margin_bottom = 18
	return style


static func create() -> Theme:
	var theme: Theme = Theme.new()
	var body: Font = load("res://assets/fonts/art_direction_v01/Inter.ttf") as Font
	var display: Font = load("res://assets/fonts/art_direction_v01/Cinzel.ttf") as Font
	theme.default_font = body
	theme.default_font_size = BODY_SIZE
	theme.set_color("font_color", "Label", BONE)
	theme.set_color("default_color", "RichTextLabel", BONE)
	theme.set_stylebox("panel", "PanelContainer", box(PANEL, BRONZE))
	theme.set_constant("separation", "VBoxContainer", 20)
	theme.set_constant("separation", "HBoxContainer", 20)

	theme.set_type_variation("DisplayLabel", "Label")
	theme.set_font("font", "DisplayLabel", display)
	theme.set_font_size("font_size", "DisplayLabel", TITLE_SIZE)
	theme.set_type_variation("SmallLabel", "Label")
	theme.set_font_size("font_size", "SmallLabel", SMALL_SIZE)
	theme.set_color("font_color", "SmallLabel", MUTED)
	theme.set_type_variation("MutedLabel", "Label")
	theme.set_color("font_color", "MutedLabel", MUTED)

	_buttons(theme, "Button", RAISED, Color("#2d323d"), PANEL, BONE, BRONZE)
	_buttons(theme, "PrimaryButton", WINE, WINE_HOVER, WINE_PRESSED, BONE, BRONZE)
	_buttons(theme, "SecondaryButton", RAISED, Color("#2d323d"), PANEL, BONE, SILVER)
	_buttons(theme, "DestructiveButton", Color("#2a171d"), Color("#42232b"), Color("#211419"), DANGER, DANGER)
	return theme


static func _buttons(theme: Theme, kind: String, normal: Color, hover: Color, pressed: Color, text: Color, edge: Color) -> void:
	if kind != "Button":
		theme.set_type_variation(kind, "Button")
	theme.set_stylebox("normal", kind, box(normal, edge))
	theme.set_stylebox("hover", kind, box(hover, edge))
	theme.set_stylebox("pressed", kind, box(pressed, edge))
	theme.set_stylebox("hover_pressed", kind, box(pressed, edge))
	theme.set_stylebox("disabled", kind, box(PANEL, Color("#45474e")))
	var focus: StyleBoxFlat = box(Color(0, 0, 0, 0), BONE, 4)
	focus.draw_center = false
	focus.expand_margin_left = 4
	focus.expand_margin_right = 4
	focus.expand_margin_top = 4
	focus.expand_margin_bottom = 4
	theme.set_stylebox("focus", kind, focus)
	for property: String in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
		theme.set_color(property, kind, text)
	theme.set_color("font_disabled_color", kind, Color("#a4a0a1"))
	theme.set_font_size("font_size", kind, BODY_SIZE)
