class_name SettingsScreen
extends UiScreen
## Settings (port of client/screens/settings_screen.py, offline part): the build line and the offline note. Sign-out and account deletion
## arrive with the online build (G6), which passes their buttons in `load_settings`' `actions`. Volume sliders for the music,
## voice and effect buses (INF-025): the screen reports each change; the Audio autoload applies and saves it.

signal back_requested
signal action_requested(action_id: String)
signal text_scale_changed(value: float)
signal motion_changed(value: bool)

signal volume_changed(bus: String, linear: float)

## Slider order and labels (the Audio autoload's bus names).
const VOLUME_LABELS: Array[Array] = [["Music", "Music"], ["Voice", "Voices"], ["SFX", "Effects"]]

var _info_label: Label = null
var _status_label: Label = null
var _actions: VBoxContainer = null
var _volumes: VBoxContainer = null
var _accessibility: VBoxContainer
var _sliders: Dictionary = {}


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Settings", UiTheme.TITLE))
	var content: VBoxContainer = UiKit.scroll_column(column, 18)
	_info_label = UiKit.label("")
	content.add_child(_info_label)
	_status_label = UiKit.label("", UiTheme.DIM)
	content.add_child(_status_label)
	_volumes = UiKit.column(8)
	content.add_child(_volumes)
	_actions = UiKit.column(16)
	content.add_child(_actions)
	_accessibility = UiKit.column(12)
	content.add_child(_accessibility)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void: back_requested.emit())
	column.add_child(back)


## `info` is the build line (and the offline note); `actions` is a list of {"id", "label"} for extra buttons.
func load_settings(info: String, status: String = "", actions: Array[Dictionary] = []) -> void:
	ensure_built()
	UiKit.clear(_actions)
	_info_label.text = info
	_status_label.text = status
	for action: Dictionary in actions:
		var action_id: String = str(action["id"])
		var button: Button = UiKit.button(str(action["label"]))
		button.pressed.connect(func() -> void: action_requested.emit(action_id))
		_actions.add_child(button)


## `volumes`: {bus: linear 0..1}; buses left out get no slider.
func load_volumes(volumes: Dictionary) -> void:
	ensure_built()
	UiKit.clear(_volumes)
	_sliders.clear()
	for pair: Array in VOLUME_LABELS:
		var bus: String = pair[0]
		if not volumes.has(bus):
			continue
		var caption: Label = UiKit.label("", "", false)
		var slider: HSlider = HSlider.new()
		slider.min_value = 0.0
		slider.max_value = 1.0
		slider.step = 0.05
		slider.custom_minimum_size = Vector2(0, UiTheme.TOUCH_HEIGHT)
		slider.value = clampf(float(volumes[bus]), 0.0, 1.0)
		caption.text = volume_caption(str(pair[1]), slider.value)
		slider.value_changed.connect(func(value: float) -> void:
			caption.text = volume_caption(str(pair[1]), value)
			volume_changed.emit(bus, value))
		_volumes.add_child(caption)
		_volumes.add_child(slider)
		_sliders[bus] = slider


static func volume_caption(label: String, linear: float) -> String:
	return "%s  %d%%" % [label, roundi(linear * 100.0)] if linear > 0.0 else "%s  off" % label


func volume_slider(bus: String) -> HSlider:
	return _sliders.get(bus)


func info_text() -> String:
	return _info_label.text


func status_text() -> String:
	return _status_label.text


func load_accessibility(text_scale: float, reduced_motion: bool) -> void:
	ensure_built()
	UiKit.clear(_accessibility)
	_accessibility.add_child(UiKit.label("Accessibility", UiTheme.TITLE))
	var large: Button = UiKit.button("Large Text", true)
	large.button_pressed = text_scale > 1.0
	large.toggled.connect(func(enabled: bool) -> void: text_scale_changed.emit(1.25 if enabled else 1.0))
	_accessibility.add_child(large)
	var motion: Button = UiKit.button("Reduced Motion", true)
	motion.button_pressed = reduced_motion
	motion.toggled.connect(func(enabled: bool) -> void: motion_changed.emit(enabled))
	_accessibility.add_child(motion)
