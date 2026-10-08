class_name GameLogo
extends VBoxContainer
## Two candidate lockups with one generated emblem and real, editable English lettering.
enum Arrangement { SEAL, COMPACT }
@export var arrangement: Arrangement = Arrangement.SEAL
@export_range(0.5, 1.5) var display_scale: float = 1.0
const EMBLEM: Texture2D = preload("res://assets/branding/uomd/v01/emblem.png")


func _init() -> void:
	name = "GameLogo"


func _ready() -> void:
	add_theme_constant_override("separation", 12)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var emblem: TextureRect = TextureRect.new()
	emblem.texture = EMBLEM
	emblem.custom_minimum_size = Vector2(0, (300 if arrangement == Arrangement.SEAL else 120) * display_scale)
	emblem.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	emblem.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	emblem.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(emblem)
	var main: Label = UiKit.label("UNAWARE", "DisplayLabel", false)
	main.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	main.add_theme_font_size_override("font_size", int((116 if arrangement == Arrangement.SEAL else 70) * display_scale))
	add_child(main)
	var subtitle: Label = UiKit.label("OF MY DEMISE", "DisplayLabel", false)
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", int((46 if arrangement == Arrangement.SEAL else 32) * display_scale))
	var spaced: FontVariation = FontVariation.new()
	spaced.base_font = UiTheme.GothicTheme.DISPLAY_FONT
	spaced.spacing_glyph = 6 if arrangement == Arrangement.SEAL else 4
	subtitle.add_theme_font_override("font", spaced)
	add_child(subtitle)
	var rule: ColorRect = ColorRect.new()
	rule.color = UiTheme.GothicTheme.BRONZE
	rule.custom_minimum_size = Vector2((560 if arrangement == Arrangement.SEAL else 460) * display_scale, 2)
	rule.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(rule)
