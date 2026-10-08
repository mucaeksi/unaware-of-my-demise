class_name EntryUtility
extends UiScreen
## Public utility overlay. Removing it never removes the entry screen or its operation.
signal closed
signal volume_changed(bus: String, value: float)
signal text_scale_changed(value: float)
signal motion_changed(reduced: bool)
signal frame_rate_changed(value: int)
signal support_submitted(payload: Dictionary)
signal focus_targets_changed
signal page_requested(page_id: String)
const Masthead: GDScript = preload("res://scripts/ui/entry/entry_masthead.gd")
var _logo: TextureRect
var page: String = "help"
var volumes: Dictionary = {}
var text_scale: float = 1.0
var frame_rate: int = FrameRatePolicy.DEFAULT
var allow_120: bool = false
var fps_buttons: Dictionary = {}
var sliders: Dictionary = {}
var text_toggle: Button
var motion_toggle: Button
var faq_buttons: Array[Button] = []
var reply_field: LineEdit
var subject_field: LineEdit
var message_field: TextEdit
var consent: CheckBox
var submit_button: Button
var status_label: Label
var topic: OptionButton
var _count_label: Label
var _sending: bool = false
var reduced_motion: bool = false:
	set(value):
		reduced_motion = value
		set_meta("ui_reduced_motion", value)
		if value and is_inside_tree():
			UiPageTransition.finish_under(self)

func _build(column: VBoxContainer) -> void:
	var branding: VBoxContainer = UiKit.column(Masthead.SEPARATION)
	column.add_child(branding)
	branding.add_child(UiKit.spacer(Masthead.TOP_SPACE))
	_logo = Masthead.logo()
	branding.add_child(_logo)
	column.add_child(UiKit.label(tr("Settings") if page == "settings" else (tr("Licenses") if page == "licenses" else (tr("Contact Us") if page == "contact" else tr("Help"))), "EntryHeading"))
	if page == "licenses":
		var text: TextEdit = TextEdit.new()
		text.editable = false
		text.context_menu_enabled = false
		text.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
		text.size_flags_vertical = Control.SIZE_EXPAND_FILL
		text.text = ThirdPartyNotices.text()
		column.add_child(text)
		_add_back(column)
		return
	var list: VBoxContainer = UiKit.scroll_column(column, 20)
	if page == "settings":
		_build_settings(list)
	elif page == "contact":
		_build_contact(list)
	else:
		_build_help(list)
	_add_back(column)

func _build_help(list: VBoxContainer) -> void:
	list.add_child(UiKit.label(tr("Frequently asked questions"), UiTheme.DIM))
	for index: int in EntryHelpContent.FAQ.size():
		var item: Array = EntryHelpContent.FAQ[index]
		var content: VBoxContainer = UiKit.column(16)
		var question: Button = UiKit.button("%02d  %s" % [index + 1, tr(item[0])], true, "FaqButton")
		question.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var answer: Label = UiKit.label(tr(item[1]))
		answer.visible = index == 0
		question.button_pressed = answer.visible
		question.toggled.connect(func(open: bool) -> void: answer.visible = open)
		faq_buttons.append(question)
		content.add_child(question)
		content.add_child(answer)
		list.add_child(UiKit.card(content))
	var licenses: Button = UiKit.button(tr("Licenses"), false, "QuietButton")
	licenses.pressed.connect(func() -> void: page_requested.emit("licenses"))
	list.add_child(licenses)
	var contact: VBoxContainer = _section(list, "Still need help?", "mail")
	contact.add_child(UiKit.label(tr("Tell us what happened. You can contact us even if Google sign-in is unavailable."), UiTheme.DIM))
	var support: Button = UiKit.button(tr("Contact Us"), false, UiTheme.PRIMARY)
	support.pressed.connect(func() -> void: page_requested.emit("contact"))
	contact.add_child(support)

func _build_contact(list: VBoxContainer) -> void:
	list.add_child(UiKit.label(tr("Send a message to the game team. We use your contact email to reply."), UiTheme.DIM))
	var form: VBoxContainer = _section(list, "Your message", "mail")
	form.add_child(UiKit.label(tr("Contact email")))
	reply_field = UiKit.input(tr("Your email address"))
	reply_field.max_length = 254
	form.add_child(reply_field)
	form.add_child(UiKit.label(tr("Topic")))
	topic = OptionButton.new()
	topic.custom_minimum_size.y = UiTheme.TOUCH_HEIGHT
	topic.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for caption: String in ["Google sign-in", "Content update", "Account", "Gameplay", "Performance", "Other"]:
		topic.add_item(tr(caption))
	form.add_child(topic)
	form.add_child(UiKit.label(tr("Subject")))
	subject_field = UiKit.input(tr("A short summary"))
	subject_field.max_length = 80
	form.add_child(subject_field)
	form.add_child(UiKit.label(tr("What happened?")))
	message_field = TextEdit.new()
	message_field.theme_type_variation = "EntryMessage"
	message_field.placeholder_text = tr("Describe what you were doing and what went wrong.")
	message_field.custom_minimum_size.y = 360
	message_field.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	message_field.context_menu_enabled = false
	form.add_child(message_field)
	_count_label = UiKit.label("0 / 3,000", UiTheme.SMALL)
	form.add_child(_count_label)
	consent = CheckBox.new()
	consent.text = tr("Use my contact email to reply")
	consent.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	consent.custom_minimum_size.y = UiTheme.TOUCH_HEIGHT
	form.add_child(consent)
	status_label = UiKit.label("", UiTheme.DIM)
	status_label.hide()
	form.add_child(status_label)
	submit_button = UiKit.button(tr("Send Message"), false, UiTheme.PRIMARY)
	submit_button.pressed.connect(_submit)
	form.add_child(submit_button)
	reply_field.text_changed.connect(func(_value: String) -> void: _refresh_submit())
	subject_field.text_changed.connect(func(_value: String) -> void: _refresh_submit())
	message_field.text_changed.connect(_refresh_submit)
	consent.toggled.connect(func(_value: bool) -> void: _refresh_submit())
	topic.item_selected.connect(func(_index: int) -> void: _refresh_submit())
	_refresh_submit()

func support_payload() -> Dictionary:
	return {"reply_email": reply_field.text.strip_edges(), "subject": subject_field.text.strip_edges(), "message": message_field.text.strip_edges(), "category": SupportClient.CATEGORIES[topic.selected], "consent": consent.button_pressed, "client_version": "versionCode " + str(ProjectSettings.get_setting("uomd/release/version_code", 1))}

func _refresh_submit() -> void:
	_count_label.text = "%d / 3,000 · 20 minimum" % message_field.text.length()
	submit_button.disabled = _sending or not SupportClient.validation_error(support_payload()).is_empty()
	focus_targets_changed.emit()

func _submit() -> void:
	if _sending: return
	var payload: Dictionary = support_payload()
	var error: String = SupportClient.validation_error(payload)
	if not error.is_empty():
		status_label.text = tr(error)
		status_label.show()
		return
	_sending = true
	_set_form_enabled(false)
	status_label.text = tr("Submitting your message…")
	status_label.show()
	support_submitted.emit(payload)

func _set_form_enabled(enabled: bool) -> void:
	reply_field.editable = enabled
	subject_field.editable = enabled
	message_field.editable = enabled
	topic.disabled = not enabled
	consent.disabled = not enabled
	submit_button.text = tr("Send Message") if enabled else tr("Submitting…")
	_refresh_submit()

func support_result(result: Outcome) -> void:
	_sending = false
	_set_form_enabled(true)
	if result.is_ok():
		message_field.text = ""
		consent.button_pressed = false
		status_label.text = tr("Message submitted. We will reply to your contact email.") + "\n" + tr("Reference: ") + str((result.value as Dictionary).get("reference", ""))
	else:
		status_label.text = tr(result.error)
	status_label.show()
	status_label.get_parent().get_parent().queue_sort()


func _section(list: VBoxContainer, title: String, icon: String) -> VBoxContainer:
	var content: VBoxContainer = UiKit.column(16)
	var row: HBoxContainer = UiKit.row(18)
	var picture: TextureRect = TextureRect.new()
	picture.texture = load("res://assets/ui/narrative/v002/icons/" + icon + ".svg") as Texture2D
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.custom_minimum_size = Vector2(54, 54)
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(picture)
	row.add_child(UiKit.label(tr(title), UiTheme.TITLE))
	content.add_child(row)
	list.add_child(UiKit.card(content))
	return content

func _build_settings(list: VBoxContainer) -> void:
	var performance: VBoxContainer = _section(list, "Performance", "speed")
	performance.add_child(UiKit.label(tr("Frame rate")))
	var choices: HBoxContainer = UiKit.row(18)
	var group: ButtonGroup = ButtonGroup.new()
	for rate: int in [30, 60]:
		var choice: Button = UiKit.button(str(rate) + " FPS", true, "SettingButton")
		choice.button_group = group
		choice.button_pressed = frame_rate == rate
		choice.pressed.connect(func() -> void:
			frame_rate = rate
			frame_rate_changed.emit(rate))
		fps_buttons[rate] = choice
		choices.add_child(choice)
	performance.add_child(choices)
	var future: Button = UiKit.button("120 FPS" if allow_120 else tr("120 FPS · Coming later"), true, "SettingButton")
	future.disabled = not allow_120
	future.button_group = group
	future.button_pressed = frame_rate == 120 and allow_120
	future.pressed.connect(func() -> void:
		if allow_120:
			frame_rate = 120
			frame_rate_changed.emit(120))
	fps_buttons[120] = future
	performance.add_child(future)
	performance.add_child(UiKit.label(tr("60 FPS is recommended. Choose 30 FPS to reduce battery use and heat. Your display may limit the actual frame rate."), UiTheme.DIM))
	var sound: VBoxContainer = _section(list, "Audio", "music")
	for pair: Array in SettingsScreen.VOLUME_LABELS:
		var bus: String = pair[0]
		var caption: Label = UiKit.label(SettingsScreen.volume_caption(tr(pair[1]), float(volumes.get(bus, 1.0))))
		sound.add_child(caption)
		var slider: HSlider = HSlider.new()
		slider.custom_minimum_size.y = UiTheme.TOUCH_HEIGHT
		slider.max_value = 1.0
		slider.step = 0.05
		slider.value = float(volumes.get(bus, 1.0))
		slider.theme_type_variation = "EntrySlider"
		slider.tooltip_text = tr(pair[1])
		sliders[bus] = slider
		slider.value_changed.connect(func(value: float) -> void:
			caption.text = SettingsScreen.volume_caption(tr(pair[1]), value)
			volume_changed.emit(bus, value))
		sound.add_child(slider)
	var access: VBoxContainer = _section(list, "Accessibility", "text")
	var large: Button = UiKit.button(tr("Large Text"), true, "SettingButton")
	text_toggle = large
	large.button_pressed = text_scale > 1.0
	large.toggled.connect(func(enabled: bool) -> void: text_scale_changed.emit(1.25 if enabled else 1.0))
	access.add_child(large)
	var motion: Button = UiKit.button(tr("Reduced Motion"), true, "SettingButton")
	motion_toggle = motion
	motion.button_pressed = reduced_motion
	motion.toggled.connect(func(enabled: bool) -> void: motion_changed.emit(enabled))
	access.add_child(motion)
	access.add_child(UiKit.label(tr("Reduced Motion removes decorative screen transitions. Large Text enlarges interface text."), UiTheme.DIM))

func _add_back(column: VBoxContainer) -> void:
	var back: Button = UiKit.button(tr("Back"), false, UiTheme.SECONDARY)
	back.pressed.connect(func() -> void: handle_back())
	column.add_child(back)

func handle_back() -> bool:
	if _sending:
		return true
	if page in ["contact", "licenses"]:
		page_requested.emit("help")
		return true
	closed.emit()
	return true
