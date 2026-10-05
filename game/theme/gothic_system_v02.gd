extends RefCounted
## Shared art system v02. Candidate art, real runtime Theme; text remains in Controls.
const INK: Color = Color("#0b0d11")
const PANEL: Color = Color("#15181f")
const RAISED: Color = Color("#20242c")
const HOVER: Color = Color("#2d323d")
const BONE: Color = Color("#ede3d2")
const MUTED: Color = Color("#b7b0a6")
const SILVER: Color = Color("#b7bec9")
const BRONZE: Color = Color("#8c755f")
const GOLD: Color = Color("#b59a76")
const WINE: Color = Color("#4b2028")
const WINE_HOVER: Color = Color("#602a34")
const WINE_PRESSED: Color = Color("#35191f")
const DANGER: Color = Color("#ffb9b6")
const TEAL: Color = Color("#86beb7")
const DISABLED: Color = Color("#a4a0a1")
const BODY: int = 36
const SMALL: int = 30
const TOUCH_HEIGHT: int = 144
const PRIMARY: String = "PrimaryButton"
const SECONDARY: String = "SecondaryButton"
const DESTRUCTIVE: String = "DestructiveButton"
const NAVIGATION: String = "NavigationButton"
const ICON: String = "IconButton"
const MODAL_ACTION: String = "ModalActionButton"
const FRAME: String = "FramedPanel"
const ICON_ROOT: String = "res://assets/ui/gothic/v02/icons/"
const BODY_FONT: Font = preload("res://assets/fonts/art_direction_v01/Inter.ttf")
const DISPLAY_FONT: Font = preload("res://assets/fonts/art_direction_v01/Cinzel.ttf")
const FRAME_TEXTURE: Texture2D = preload("res://assets/ui/gothic/v02/panel_frame.svg")
const ATMOSPHERE: Shader = preload("res://assets/ui/gothic/v02/atmosphere.gdshader")


static func box(fill: Color, edge: Color = BRONZE, border_width: int = 2, corner: int = 8, margin_x: int = 32, margin_y: int = 18) -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = edge
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(corner)
	style.content_margin_left = margin_x
	style.content_margin_right = margin_x
	style.content_margin_top = margin_y
	style.content_margin_bottom = margin_y
	return style


static func framed_box() -> StyleBoxTexture:
	var style: StyleBoxTexture = StyleBoxTexture.new()
	style.texture = FRAME_TEXTURE
	style.texture_margin_left = 32
	style.texture_margin_right = 32
	style.texture_margin_top = 32
	style.texture_margin_bottom = 32
	style.content_margin_left = 40
	style.content_margin_right = 40
	style.content_margin_top = 36
	style.content_margin_bottom = 36
	return style


static func icon(name: String) -> Texture2D:
	return load(ICON_ROOT + name + ".svg") as Texture2D


static func background_material() -> ShaderMaterial:
	var material: ShaderMaterial = ShaderMaterial.new()
	material.shader = ATMOSPHERE
	return material


static func create() -> Theme:
	var theme: Theme = Theme.new()
	theme.default_font = BODY_FONT
	theme.default_font_size = BODY
	theme.set_color("font_color", "Label", BONE)
	theme.set_color("default_color", "RichTextLabel", BONE)
	theme.set_font("normal_font", "RichTextLabel", BODY_FONT)
	theme.set_constant("separation", "VBoxContainer", 20)
	theme.set_constant("separation", "HBoxContainer", 20)
	theme.set_stylebox("panel", "PanelContainer", box(PANEL))
	theme.set_type_variation(FRAME, "PanelContainer")
	theme.set_stylebox("panel", FRAME, framed_box())
	_label(theme, "TitleLabel", BONE, 60, DISPLAY_FONT)
	_label(theme, "DisplayLabel", BONE, 64, DISPLAY_FONT)
	_label(theme, "DimLabel", MUTED, BODY)
	_label(theme, "MutedLabel", MUTED, BODY)
	_label(theme, "SmallLabel", MUTED, SMALL)
	_label(theme, "DangerLabel", DANGER, BODY)
	_label(theme, "PlaceholderTag", GOLD, 24)
	for kind: String in ["Button", "OptionButton", "MenuButton"]:
		_buttons(theme, kind, RAISED, HOVER, PANEL, BONE, BRONZE, false)
	_buttons(theme, PRIMARY, WINE, WINE_HOVER, WINE_PRESSED, BONE, GOLD)
	_buttons(theme, SECONDARY, RAISED, HOVER, PANEL, BONE, SILVER)
	_buttons(theme, DESTRUCTIVE, Color("#2a171d"), Color("#42232b"), Color("#211419"), DANGER, DANGER)
	_buttons(theme, NAVIGATION, PANEL, RAISED, WINE_PRESSED, BONE, BRONZE)
	_buttons(theme, ICON, PANEL, HOVER, WINE_PRESSED, BONE, SILVER)
	_buttons(theme, MODAL_ACTION, WINE, WINE_HOVER, WINE_PRESSED, BONE, GOLD)
	theme.set_font_size("font_size", NAVIGATION, SMALL)
	theme.set_constant("h_separation", "Button", 18)
	theme.set_constant("icon_max_width", "Button", 48)
	for kind: String in ["CheckBox", "CheckButton"]:
		for property: String in ["font_color", "font_hover_color", "font_pressed_color"]:
			theme.set_color(property, kind, BONE)
		theme.set_color("font_disabled_color", kind, DISABLED)
		theme.set_constant("h_separation", kind, 20)
	for state: String in ["checked", "checked_disabled"]:
		theme.set_icon(state, "CheckBox", icon("checked"))
	for state: String in ["unchecked", "unchecked_disabled"]:
		theme.set_icon(state, "CheckBox", icon("unchecked"))
	theme.set_stylebox("normal", "LineEdit", box(INK, BRONZE))
	theme.set_stylebox("read_only", "LineEdit", box(PANEL, Color("#45474e")))
	theme.set_stylebox("focus", "LineEdit", _focus())
	theme.set_color("font_color", "LineEdit", BONE)
	theme.set_color("font_placeholder_color", "LineEdit", MUTED)
	theme.set_color("font_uneditable_color", "LineEdit", DISABLED)
	theme.set_color("caret_color", "LineEdit", BONE)
	theme.set_color("selection_color", "LineEdit", WINE)
	theme.set_stylebox("panel", "PopupMenu", box(PANEL, SILVER))
	theme.set_stylebox("hover", "PopupMenu", box(WINE_PRESSED, GOLD))
	theme.set_color("font_color", "PopupMenu", BONE)
	theme.set_color("font_hover_color", "PopupMenu", BONE)
	theme.set_color("font_disabled_color", "PopupMenu", DISABLED)
	theme.set_constant("v_separation", "PopupMenu", 28)
	var trough: StyleBoxFlat = box(INK, BRONZE, 1, 4, 0, 0)
	trough.content_margin_top = 8
	trough.content_margin_bottom = 8
	for kind: String in ["ProgressBar", "HpBarPlayer", "HpBarEnemy"]:
		if kind != "ProgressBar":
			theme.set_type_variation(kind, "ProgressBar")
		theme.set_stylebox("background", kind, trough)
		theme.set_stylebox("fill", kind, box(TEAL if kind != "HpBarEnemy" else Color("#c57980"), Color.TRANSPARENT, 0, 4, 0, 0))
		theme.set_color("font_color", kind, BONE)
	theme.set_stylebox("slider", "HSlider", trough)
	theme.set_stylebox("grabber_area", "HSlider", box(BRONZE, Color.TRANSPARENT, 0, 4, 0, 0))
	theme.set_stylebox("grabber_area_highlight", "HSlider", box(GOLD, Color.TRANSPARENT, 0, 4, 0, 0))
	return theme


static func _label(theme: Theme, kind: String, color: Color, size: int, font: Font = BODY_FONT) -> void:
	theme.set_type_variation(kind, "Label")
	theme.set_color("font_color", kind, color)
	theme.set_font_size("font_size", kind, size)
	theme.set_font("font", kind, font)


static func _focus() -> StyleBoxFlat:
	var style: StyleBoxFlat = box(Color.TRANSPARENT, BONE, 4)
	style.draw_center = false
	style.set_expand_margin_all(5)
	return style


static func _buttons(theme: Theme, kind: String, normal: Color, hover: Color, pressed: Color, text: Color, edge: Color, variation: bool = true) -> void:
	if variation:
		theme.set_type_variation(kind, "Button")
	for pair: Array in [["normal", normal], ["hover", hover], ["pressed", pressed], ["hover_pressed", pressed]]:
		theme.set_stylebox(pair[0], kind, box(pair[1], edge, 2, 8, 40))
	theme.set_stylebox("disabled", kind, box(PANEL, Color("#45474e"), 2, 8, 40))
	theme.set_stylebox("focus", kind, _focus())
	for property: String in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
		theme.set_color(property, kind, text)
	theme.set_color("font_disabled_color", kind, DISABLED)
	theme.set_font_size("font_size", kind, BODY)
