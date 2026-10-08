extends RefCounted
## Shared Controls derived from the approved Narrative board. Illustration never contains UI text.
const ROOT: String = "res://assets/ui/narrative/v002/"
const DISPLAY_FONT: Font = preload("res://assets/fonts/art_direction_v01/Cinzel.ttf")
const BODY_FONT: Font = preload("res://assets/fonts/production_v001/SourceSans3-Semibold.ttf")
const BONE: Color = Color("#eee1cb")
const BRASS: Color = Color("#b8996e")
const WEIGHT_AXIS: int = 0x77676874  # OpenType 'wght'; Godot TextServer requires the numeric tag.

static func surface(asset: String, button: bool = false, padding: int = 36) -> StyleBoxTexture:
	var style: StyleBoxTexture = StyleBoxTexture.new()
	style.texture = load(ROOT + asset + ".svg") as Texture2D
	style.texture_margin_left = 80
	style.texture_margin_right = 80
	style.texture_margin_top = 72 if button else 80
	style.texture_margin_bottom = 72 if button else 80
	style.content_margin_left = padding
	style.content_margin_right = padding
	style.content_margin_top = 24 if button else padding
	style.content_margin_bottom = 24 if button else padding
	return style

static func panel(kind: String = "Standard") -> StyleBoxTexture:
	return surface("panel_hero" if kind == "Hero" else "panel")

static func focus() -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.draw_center = false
	style.border_color = BONE
	style.set_border_width_all(3)
	style.set_corner_radius_all(6)
	style.set_expand_margin_all(4)
	return style

static func apply(theme: Theme) -> void:
	var utility_font: FontVariation = FontVariation.new()
	utility_font.base_font = DISPLAY_FONT
	utility_font.variation_opentype = {WEIGHT_AXIS: 800.0}
	theme.set_stylebox("panel", "PanelContainer", panel())
	for kind: String in ["StandardPanel", "HeroPanel", "ModalPanel", "SheetPanel", "FramedPanel", "CompanionCard", "NavigationPanel", "BadgePanel"]:
		theme.set_type_variation(kind, "PanelContainer")
		theme.set_stylebox("panel", kind, surface("panel_hero" if kind in ["HeroPanel", "FramedPanel"] else "panel", false, 18 if kind in ["NavigationPanel", "BadgePanel"] else 36))
	for kind: String in ["Button", "OptionButton", "MenuButton", "PrimaryButton", "SecondaryButton", "DestructiveButton", "IconButton", "NavigationButton", "ModalActionButton", "SuccessButton", "ErrorButton"]:
		if kind not in ["Button", "OptionButton", "MenuButton"]:
			theme.set_type_variation(kind, "Button")
		var primary: bool = kind in ["PrimaryButton", "ModalActionButton", "SuccessButton", "ErrorButton", "DestructiveButton"]
		for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			var asset: String = "primary" if primary else "secondary"
			if state == "disabled":
				asset = "disabled"
			elif state in ["pressed", "hover_pressed"]:
				asset = "primary_pressed" if primary else "secondary"
			elif state == "hover":
				asset += "_hover"
			theme.set_stylebox(state, kind, surface(asset, true, 40))
		for property: String in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
			theme.set_color(property, kind, Color("#ffb9b6") if kind in ["DestructiveButton", "ErrorButton"] else BONE)
		theme.set_color("font_disabled_color", kind, Color("#a49a90"))
		theme.set_stylebox("focus", kind, focus())
		theme.set_font("font", kind, BODY_FONT if kind in ["IconButton", "NavigationButton", "OptionButton", "MenuButton"] else DISPLAY_FONT)
		theme.set_font_size("font_size", kind, 40)
	theme.set_font_size("font_size", "NavigationButton", 32)
	for kind: String in ["QuietButton", "TitlePromptButton"]:
		theme.set_type_variation(kind, "Button")
		for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			var empty: StyleBoxEmpty = StyleBoxEmpty.new()
			empty.content_margin_left = 20
			empty.content_margin_right = 20
			theme.set_stylebox(state, kind, empty)
		var indicator: StyleBoxFlat = StyleBoxFlat.new()
		indicator.draw_center = false
		indicator.border_color = BRASS
		indicator.border_width_bottom = 2
		theme.set_stylebox("focus", kind, indicator)
		theme.set_font("font", kind, utility_font)
		theme.set_font_size("font_size", kind, 52 if kind == "TitlePromptButton" else 44)
		theme.set_color("font_shadow_color", kind, Color(0.01, 0.008, 0.015, 1.0))
		theme.set_color("font_outline_color", kind, Color(0.01, 0.008, 0.015, 1.0))
		theme.set_constant("shadow_offset_y", kind, 3)
		theme.set_constant("outline_size", kind, 3 if kind == "TitlePromptButton" else 2)
		for property: String in ["font_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
			theme.set_color(property, kind, BONE)
		theme.set_color("font_hover_color", kind, Color.WHITE)
		theme.set_color("font_disabled_color", kind, Color("#a49a90"))

	# Official Google identity stays distinct and legible within the narrative frame.
	theme.set_type_variation("EntrySignInButton", "PrimaryButton")
	theme.set_font("font", "EntrySignInButton", utility_font)
	theme.set_font_size("font_size", "EntrySignInButton", 52)
	theme.set_type_variation("EntryHeading", "TitleLabel")
	theme.set_font("font", "EntryHeading", utility_font)
	var quote_font: FontVariation = FontVariation.new()
	quote_font.base_font = DISPLAY_FONT
	quote_font.variation_opentype = {WEIGHT_AXIS: 600.0}
	theme.set_type_variation("EntryQuote", "Label")
	theme.set_font("font", "EntryQuote", quote_font)
	theme.set_font_size("font_size", "EntryQuote", 30)
	theme.set_color("font_color", "EntryQuote", BONE)
	theme.set_color("font_shadow_color", "EntryQuote", Color(0.02, 0.015, 0.02, 0.95))
	theme.set_constant("shadow_offset_y", "EntryQuote", 2)
	theme.set_color("font_outline_color", "EntryQuote", Color(0.01, 0.008, 0.015, 1.0))
	theme.set_constant("outline_size", "EntryQuote", 1)
	theme.set_type_variation("EntrySubtitle", "SmallLabel")
	theme.set_font("font", "EntrySubtitle", utility_font)
	theme.set_color("font_outline_color", "EntrySubtitle", Color(0.01, 0.008, 0.015, 1.0))
	theme.set_constant("outline_size", "EntrySubtitle", 2)
	theme.set_type_variation("EntryStatus", "DimLabel")
	theme.set_font("font", "EntryStatus", BODY_FONT)
	theme.set_color("font_color", "EntryStatus", BONE)
	theme.set_type_variation("EntryNarration", "EntryStatus")
	theme.set_font("font", "EntryNarration", quote_font)
	theme.set_font_size("font_size", "EntryNarration", 44)
	theme.set_color("font_shadow_color", "EntryNarration", Color(0.02, 0.015, 0.02, 1.0))
	theme.set_constant("shadow_offset_y", "EntryNarration", 2)
	theme.set_color("font_outline_color", "EntryNarration", Color(0.02, 0.015, 0.02, 0.85))
	theme.set_constant("outline_size", "EntryNarration", 1)
	theme.set_type_variation("PrologueSkipButton", "QuietButton")
	theme.set_font_size("font_size", "PrologueSkipButton", 30)
	theme.set_type_variation("PrologueTransfer", "SmallLabel")
	theme.set_font_size("font_size", "PrologueTransfer", 26)
	theme.set_type_variation("EntryProgress", "ProgressBar")
	for kind: String in ["background", "fill"]:
		var progress_style: StyleBoxFlat = StyleBoxFlat.new()
		progress_style.bg_color = Color("#b63849") if kind == "fill" else Color("#24141e")
		progress_style.set_corner_radius_all(12)
		theme.set_stylebox(kind, "EntryProgress", progress_style)
	var google_font: FontVariation = FontVariation.new()
	google_font.base_font = preload("res://assets/fonts/google_signin/GoogleSans.ttf")
	google_font.variation_opentype = {WEIGHT_AXIS: 500.0}
	theme.set_type_variation("GoogleButton", "Button")
	theme.set_font("font", "GoogleButton", google_font)
	theme.set_font_size("font_size", "GoogleButton", 42)
	theme.set_constant("icon_max_width", "GoogleButton", 54)
	theme.set_constant("h_separation", "GoogleButton", 30)
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		var google_style: StyleBoxFlat = StyleBoxFlat.new()
		google_style.bg_color = Color("#ffffff") if state == "normal" else Color("#eef0f4")
		google_style.border_color = Color("#747775")
		google_style.set_border_width_all(3)
		google_style.set_corner_radius_all(12)
		google_style.content_margin_left = 36
		google_style.content_margin_right = 36
		google_style.content_margin_top = 24
		google_style.content_margin_bottom = 24
		theme.set_stylebox(state, "GoogleButton", google_style)
	for property: String in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color"]:
		theme.set_color(property, "GoogleButton", Color("#1f1f1f"))
	theme.set_stylebox("focus", "GoogleButton", focus())

	theme.set_type_variation("EntrySlider", "HSlider")
	var red: Color = Color("#b63849")
	var track: StyleBoxFlat = StyleBoxFlat.new()
	track.bg_color = Color("#241821")
	track.set_corner_radius_all(5)
	track.content_margin_top = 7
	track.content_margin_bottom = 7
	theme.set_stylebox("slider", "EntrySlider", track)
	var filled: StyleBoxFlat = track.duplicate() as StyleBoxFlat
	filled.bg_color = red
	theme.set_stylebox("grabber_area", "EntrySlider", filled)
	theme.set_stylebox("grabber_area_highlight", "EntrySlider", filled)
	for state: String in ["grabber", "grabber_highlight", "grabber_disabled"]:
		theme.set_icon(state, "EntrySlider", load(ROOT + "icons/slider_grip.svg") as Texture2D)
	theme.set_type_variation("SettingButton", "Button")
	theme.set_font("font", "SettingButton", utility_font)
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		var setting: StyleBoxFlat = StyleBoxFlat.new()
		setting.bg_color = Color("#702635") if state in ["pressed", "hover_pressed"] else Color("#19111b")
		setting.border_color = red if state in ["pressed", "hover_pressed"] else Color("#6c4b4a")
		if state == "disabled":
			setting.bg_color = Color("#151217")
			setting.border_color = Color("#383039")
		setting.set_border_width_all(3 if state in ["pressed", "hover_pressed"] else 1)
		setting.set_corner_radius_all(12)
		setting.set_content_margin_all(24)
		theme.set_stylebox(state, "SettingButton", setting)
	theme.set_stylebox("focus", "SettingButton", focus())

	theme.set_type_variation("FaqButton", "Button")
	theme.set_font("font", "FaqButton", BODY_FONT)
	theme.set_font_size("font_size", "FaqButton", 40)
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		var faq_style: StyleBoxEmpty = StyleBoxEmpty.new()
		faq_style.content_margin_left = 36
		faq_style.content_margin_right = 12
		theme.set_stylebox(state, "FaqButton", faq_style)
	theme.set_stylebox("focus", "FaqButton", focus())
	theme.set_type_variation("EntryMessage", "TextEdit")
	theme.set_font("font", "EntryMessage", BODY_FONT)
	theme.set_font_size("font_size", "EntryMessage", 36)
	var entry_field: StyleBoxFlat = StyleBoxFlat.new()
	entry_field.bg_color = Color("#100c13")
	entry_field.border_color = BRASS
	entry_field.set_border_width_all(2)
	entry_field.set_content_margin_all(20)
	theme.set_stylebox("normal", "EntryMessage", entry_field)
	theme.set_stylebox("read_only", "EntryMessage", entry_field)
	theme.set_stylebox("focus", "EntryMessage", focus())
	theme.set_color("font_color", "EntryMessage", BONE)
	theme.set_color("font_placeholder_color", "EntryMessage", Color("#aaa193"))
	theme.set_color("caret_color", "EntryMessage", BONE)
	theme.set_color("selection_color", "EntryMessage", Color("#632d40"))
