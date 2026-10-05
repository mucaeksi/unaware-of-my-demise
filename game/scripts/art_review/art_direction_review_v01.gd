extends Control
## Development-only art review. No GameFlow, account, patch, wallet or music calls.
## Toggle between key art and real Control/button samples. Does not replace TitleScreen.
const CandidateTheme = preload("res://theme/gothic_candidate_v01.gd")
const KEY_ART: String = "res://assets/art_review/v02/key_art.png"

var _samples: PanelContainer = null
var _status: Label = null


func _ready() -> void:
	theme = CandidateTheme.create()
	_build()
	for argument: String in OS.get_cmdline_user_args():
		if argument == "--components":
			_samples.show()
		if argument.begins_with("--art-review-capture="):
			_capture(argument.trim_prefix("--art-review-capture="))


func _build() -> void:
	var background: ColorRect = ColorRect.new()
	background.color = CandidateTheme.INK
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	var artwork: TextureRect = TextureRect.new()
	artwork.texture = load(KEY_ART) as Texture2D
	artwork.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	# Preserve all five faces on taller devices; review artwork must not crop a companion's face.
	artwork.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	artwork.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	artwork.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(artwork)

	var footer_shade: ColorRect = ColorRect.new()
	footer_shade.color = Color(0.043, 0.051, 0.067, 0.9)
	footer_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	footer_shade.anchor_top = 0.72
	footer_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(footer_shade)

	var margin: MarginContainer = MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side: String in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 64)
	add_child(margin)
	var column: VBoxContainer = VBoxContainer.new()
	margin.add_child(column)

	var badge: Label = _label("ART DIRECTION 01 · CANDIDATE", "SmallLabel")
	badge.add_theme_color_override("font_color", CandidateTheme.BONE)
	column.add_child(badge)
	var spacer: Control = Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(spacer)
	var game_name: Label = _label("Unaware\nof My Demise", "DisplayLabel")
	game_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	game_name.add_theme_font_size_override("font_size", 76)
	column.add_child(game_name)
	var caption: Label = _label("World and character study · provisional artwork", "SmallLabel")
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(caption)
	var samples_button: Button = _button("View style samples", "PrimaryButton")
	samples_button.pressed.connect(func() -> void: _samples.show())
	column.add_child(samples_button)

	_samples = PanelContainer.new()
	_samples.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_samples.offset_left = 64
	_samples.offset_top = 250
	_samples.offset_right = -64
	_samples.offset_bottom = -64
	add_child(_samples)
	_samples.hide()
	var samples_column: VBoxContainer = VBoxContainer.new()
	samples_column.add_theme_constant_override("separation", 16)
	_samples.add_child(samples_column)
	samples_column.add_child(_label("A witnessed name", "DisplayLabel"))
	var paragraph: Label = _label("Warm silver, worn stone, and a small light in the dark. Art and UI share a palette; text stays readable.", "")
	paragraph.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	samples_column.add_child(paragraph)
	samples_column.add_child(_label("Button states · development preview", "SmallLabel"))
	var primary: Button = _button("Continue", "PrimaryButton")
	primary.pressed.connect(func() -> void: _status.text = "Primary action pressed")
	samples_column.add_child(primary)
	var secondary: Button = _button("Settings", "SecondaryButton")
	secondary.pressed.connect(func() -> void: _status.text = "Secondary action pressed")
	samples_column.add_child(secondary)
	var pressed: Button = _button("Selected sample", "PrimaryButton")
	pressed.toggle_mode = true
	pressed.button_pressed = true
	samples_column.add_child(pressed)
	var disabled: Button = _button("Unavailable", "SecondaryButton")
	disabled.disabled = true
	samples_column.add_child(disabled)
	var destructive: Button = _button("Delete sample", "DestructiveButton")
	destructive.pressed.connect(func() -> void: _status.text = "Destructive sample pressed · no data operation")
	samples_column.add_child(destructive)
	var loading: Button = _button("Preparing…", "SecondaryButton")
	loading.disabled = true
	samples_column.add_child(loading)
	_status = _label("Keyboard focus and pressed states use real Godot controls.", "SmallLabel")
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	samples_column.add_child(_status)
	var space: Control = Control.new()
	space.size_flags_vertical = Control.SIZE_EXPAND_FILL
	samples_column.add_child(space)
	var close: Button = _button("Back to artwork", "SecondaryButton")
	close.pressed.connect(func() -> void: _samples.hide())
	samples_column.add_child(close)
	primary.grab_focus()


func _label(value: String, variation: String) -> Label:
	var label: Label = Label.new()
	label.text = value
	label.theme_type_variation = variation
	return label


func _button(value: String, variation: String) -> Button:
	var button: Button = Button.new()
	button.text = value
	button.theme_type_variation = variation
	button.custom_minimum_size.y = CandidateTheme.TOUCH_HEIGHT
	return button


func _capture(path: String) -> void:
	# Capture the actual viewport after layout and two rendered frames, without image compositing.
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var error: Error = get_viewport().get_texture().get_image().save_png(path)
	if error != OK:
		push_error("Art review capture failed: %s" % error_string(error))
	get_tree().quit(int(error))
