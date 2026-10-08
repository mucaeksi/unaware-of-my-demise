@tool
extends MarginContainer
## Configuration only. No HTTP client and no generation action live in this panel.
const Store = preload("res://scripts/art_review/audio_authoring_store.gd")
var _key: LineEdit
var _status: Label

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side: String in ["left", "right", "top", "bottom"]:
		add_theme_constant_override("margin_" + side, 24)
	var column: VBoxContainer = VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	add_child(column)
	_label(column, "AUDIO AUTHORING", 24)
	_label(column, "All TTS: Chirp3-HD  |  Japanese (ja-JP)\nMusic / requested SFX: Lyria 3.5", 16)
	_label(column, "The narrator voice will be locked after an approved audition and shared by every narration line.", 15)
	_key = _field(column, "Google Cloud API key", "Paste your Google Cloud API key", true)
	_label(column, "One local key for both requested models. No second API key or alternative model is configured.", 15)
	_label(column, "Narrator and character speech will be Japanese. UI and subtitles remain English.", 15)
	var save_button: Button = Button.new()
	save_button.text = "Save local configuration"
	save_button.custom_minimum_size.y = 44
	save_button.pressed.connect(_save)
	column.add_child(save_button)
	_status = _label(column, "", 14)
	_label(column, "Saving does not generate audio. Every API generation requires the owner's explicit approval.", 15)
	_label(column, "Local file: " + Store.path() + "\nExcluded from Git and game exports.", 13)
	var config: ConfigFile = Store.read_config()
	_key.text = str(config.get_value("google_cloud", "api_key", ""))
	_status.text = "Configuration loaded locally." if FileAccess.file_exists(Store.path()) else "No key configured yet."

func _label(parent: Control, value: String, font_size: int) -> Label:
	var label: Label = Label.new()
	label.text = value
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", font_size)
	parent.add_child(label)
	return label

func _field(parent: Control, title: String, placeholder: String, secret: bool = false) -> LineEdit:
	_label(parent, title, 15)
	var field: LineEdit = LineEdit.new()
	field.secret = secret
	field.placeholder_text = placeholder
	field.custom_minimum_size.y = 38
	parent.add_child(field)
	return field

func _save() -> void:
	var result: Error = Store.save(_key.text)
	_status.text = "Saved locally. Generation remains disabled." if result == OK else "Unable to save local configuration: " + error_string(result)
