class_name StartupSplashScreen
extends Control
## Text-based startup candidate. Fonts ship with the app; no patched asset or account dependency.
const CandidateTheme = preload("res://theme/gothic_candidate_v01.gd")

@export var heading: String = ""
@export var subtitle: String = ""
@export var use_display_font: bool = true


func _ready() -> void:
	theme = CandidateTheme.create()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var background: ColorRect = ColorRect.new()
	background.color = CandidateTheme.INK
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	var safe: SafeAreaContainer = SafeAreaContainer.new()
	safe.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	safe.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(safe)
	var inset: MarginContainer = MarginContainer.new()
	for side: String in ["left", "right"]:
		inset.add_theme_constant_override("margin_" + side, 80)
	safe.add_child(inset)
	var center: CenterContainer = CenterContainer.new()
	inset.add_child(center)
	var column: VBoxContainer = VBoxContainer.new()
	column.add_theme_constant_override("separation", 24)
	center.add_child(column)
	var title: Label = Label.new()
	title.name = "Wordmark"
	title.text = heading
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.theme_type_variation = "DisplayLabel" if use_display_font else ""
	title.add_theme_font_size_override("font_size", 96)
	column.add_child(title)
	var rule: ColorRect = ColorRect.new()
	rule.color = CandidateTheme.BRONZE
	rule.custom_minimum_size = Vector2(180, 2)
	rule.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(rule)
	var detail: Label = Label.new()
	detail.text = subtitle
	detail.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	detail.theme_type_variation = "SmallLabel"
	detail.add_theme_font_size_override("font_size", 34)
	column.add_child(detail)
