extends RefCounted
## Production v001 textures, adapted to the existing UiTheme API. Text and state stay in Controls.
const ROOT: String = "res://assets/ui/production/v001/components/"
const STANDARD: String = "StandardPanel"
const HERO: String = "HeroPanel"
const MODAL: String = "ModalPanel"
const SHEET: String = "SheetPanel"
const CARD: String = "CompanionCard"
const NAV: String = "NavigationPanel"
const BADGE: String = "BadgePanel"
const SUCCESS: String = "SuccessButton"
const ERROR: String = "ErrorButton"
const BUTTON_FONT: Font = preload("res://assets/fonts/production_v001/SourceSans3-Semibold.ttf")


## Example: panel("Hero") preserves the 72 px source corners when the panel grows.
static func panel(kind: String = "Standard") -> StyleBoxTexture:
	return texture_box("Panel_" + kind, Vector4(72, 72, 72, 72), Vector4(36, 36, 36, 36))


## Slices use left/top/right/bottom order from the source manifest; content padding is independent.
## Example: texture_box("Badge_Standard", Vector4(32, 28, 32, 28), Vector4(32, 12, 32, 12)).
static func texture_box(asset: String, slices: Vector4, padding: Vector4) -> StyleBoxTexture:
	var style: StyleBoxTexture = StyleBoxTexture.new()
	style.texture = load(ROOT + "UOMD_UI_" + asset + "_9Slice_v001.png") as Texture2D
	style.texture_margin_left = slices.x
	style.texture_margin_top = slices.y
	style.texture_margin_right = slices.z
	style.texture_margin_bottom = slices.w
	style.content_margin_left = padding.x
	style.content_margin_top = padding.y
	style.content_margin_right = padding.z
	style.content_margin_bottom = padding.w
	return style


## Example: apply(theme) installs all 18 source assets without replacing navigation or data binding.
static func apply(theme: Theme) -> void:
	theme.set_stylebox("panel", "PanelContainer", panel())
	for pair: Array in [[STANDARD, "Standard"], [HERO, "Hero"], [MODAL, "Modal"], [SHEET, "Sheet"], ["FramedPanel", "Hero"]]:
		theme.set_type_variation(pair[0], "PanelContainer")
		theme.set_stylebox("panel", pair[0], panel(pair[1]))
	for pair: Array in [
		[CARD, "Card_Standard", Vector4(64, 96, 64, 96), Vector4(30, 24, 30, 24)],
		[NAV, "Nav_Backplate", Vector4(72, 48, 72, 48), Vector4(18, 18, 18, 18)],
		[BADGE, "Badge_Standard", Vector4(32, 28, 32, 28), Vector4(32, 12, 32, 12)],
	]:
		theme.set_type_variation(pair[0], "PanelContainer")
		theme.set_stylebox("panel", pair[0], texture_box(pair[1], pair[2], pair[3]))
	for pair: Array in [["Button", "Secondary"], ["OptionButton", "Secondary"], ["MenuButton", "Secondary"],
		["PrimaryButton", "Primary"], ["SecondaryButton", "Secondary"], ["DestructiveButton", "Destructive"],
		["IconButton", "Secondary"], ["NavigationButton", "Secondary"], ["ModalActionButton", "Primary"],
		[SUCCESS, "Primary"], [ERROR, "Primary"]]:
		var kind: String = pair[0]
		if kind not in ["Button", "OptionButton", "MenuButton"]:
			theme.set_type_variation(kind, "Button")
		var normal_state: String = "Success" if kind == SUCCESS else ("Error" if kind == ERROR else "Default")
		for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			var file_state: String = "Disabled" if state == "disabled" else ("Pressed" if state in ["pressed", "hover_pressed"] else normal_state)
			var style: StyleBoxTexture = texture_box("Button_%s_%s" % [pair[1], file_state], Vector4(88, 56, 88, 56), Vector4(40, 28, 40, 28))
			if state == "hover":
				style.modulate_color = Color(1.12, 1.12, 1.12)
			theme.set_stylebox(state, kind, style)
		for property: String in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
			theme.set_color(property, kind, Color("#E8DDCC"))
		theme.set_color("font_disabled_color", kind, Color("#A6A2AA"))
		theme.set_font("font", kind, BUTTON_FONT)
		theme.set_font_size("font_size", kind, 42)
	theme.set_font_size("font_size", "NavigationButton", 32)
