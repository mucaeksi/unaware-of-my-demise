class_name TitleScreen
extends UiScreen
## The title (docs/design/FIRST_LAUNCH_FLOW.md step 3): the key art with the logo, "Tap to start", the build line and a
## Support button. It is on show while the content loads and the server is asked behind it; a tap is taken at once and
## `start_requested` fires when the director allows it (`set_ready(true)`), so an early tap is never lost. Until the
## title art is promoted into the game (`ui/title_key_art`) a placeholder panel and the game's name stand in,
## marked as placeholder. R02+R01 is historical; the owner authorized a new candidate art system (v02).

signal start_requested
signal support_requested

const ART_REFERENCE: String = "ui/title_key_art"
const GAME_NAME: String = "Unaware of My Demise"
const Masthead = preload("res://scripts/ui/entry/entry_masthead.gd")

## Where art comes from; null = the app's (`Game.assets`). Tests set their own before the screen is built.
var assets: AssetResolver = null
## True once a tap asked to start (it may have come before the director was ready).
var start_pending: bool = false
var reduced_motion: bool = false:
	set(value):
		reduced_motion = value
		set_meta("ui_reduced_motion", value)
		if value and is_inside_tree():
			UiPageTransition.finish_under(self)
var _pulse_time: float = 0.0

var _art: TextureRect = null
var _name_label: Label = null
var _placeholder_tag: Label = null
var _prompt_label: Label = null
var _start_button: Button = null
var _status_label: Label = null
var _build_label: Label = null
var _support_button: Button = null
var _logo: TextureRect = null
var _ready_to_start: bool = false


func _ready() -> void:
	super._ready()
	# Decorative containers must not consume a tap over the artwork or lettering.
	for node: Node in find_children("*", "Control", true, false):
		var control: Control = node as Control
		if not control is BaseButton:
			control.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_start_button.focus_next = _start_button.get_path_to(_support_button)
	_start_button.focus_previous = _start_button.get_path_to(_support_button)
	_support_button.focus_next = _support_button.get_path_to(_start_button)
	_support_button.focus_previous = _support_button.get_path_to(_start_button)
	_start_button.grab_focus()


func _process(delta: float) -> void:
	if _start_button == null:
		return
	_pulse_time += delta
	# Slow breathing remains readable throughout; Reduced Motion keeps it still.
	_start_button.modulate.a = 1.0 if reduced_motion or start_pending else 0.40 + 0.60 * (0.5 + 0.5 * cos(_pulse_time * TAU / 2.8))


func _build(column: VBoxContainer) -> void:
	var resolver: AssetResolver = assets if assets != null else Game.assets
	_art = TextureRect.new()
	_art.set_anchors_preset(Control.PRESET_FULL_RECT)
	_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_art.texture = resolver.texture(ART_REFERENCE)
	add_child(_art)
	move_child(_art, 2)  # above ambient illustration, below the safe-area column
	var readability: ColorRect = ColorRect.new()
	readability.color = Color(0.015, 0.008, 0.015, 0.28)
	readability.mouse_filter = Control.MOUSE_FILTER_IGNORE
	readability.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(readability)
	move_child(readability, 3)
	var has_art: bool = resolver.has_art(ART_REFERENCE)
	_art.visible = has_art
	if not has_art:
		var pilot: EntryBackdrop = EntryBackdrop.new()
		add_child(pilot)
		move_child(pilot, 1)

	_placeholder_tag = UiKit.placeholder_tag()
	_placeholder_tag.text = tr("Part I")
	_placeholder_tag.visible = not has_art
	_placeholder_tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_placeholder_tag)
	# Wordmark is separate from the illustration, so it survives tall screens.
	var branding: VBoxContainer = UiKit.column(Masthead.SEPARATION)
	# Title key art needs a lower wordmark than the account/patch masthead.
	branding.add_child(UiKit.spacer(Masthead.TOP_SPACE + 204, false))
	column.add_child(branding)
	_name_label = UiKit.label(GAME_NAME, UiTheme.TITLE)
	_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name_label.visible = not has_art
	branding.add_child(_name_label)
	_logo = Masthead.logo()
	_logo.visible = has_art
	branding.add_child(_logo)
	var part: Label = UiKit.label(tr("Part I: Unaware, I Fade"), "EntrySubtitle", false)
	part.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	part.visible = has_art
	branding.add_child(part)
	var list: VBoxContainer = UiKit.scroll_column(column, 24)
	list.alignment = BoxContainer.ALIGNMENT_CENTER
	var prompt_area: VBoxContainer = UiKit.column(24)
	prompt_area.custom_minimum_size.y = 380
	prompt_area.alignment = BoxContainer.ALIGNMENT_CENTER
	list.add_child(prompt_area)
	_prompt_label = UiKit.label("Tap to start")
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	# Keep the existing prompt accessor, while the player gets a real touch/focus action.
	_start_button = UiKit.button(tr("Tap to start"), false, "TitlePromptButton")
	_start_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_start_button.custom_minimum_size.x = 640
	_start_button.pressed.connect(tap)
	prompt_area.add_child(_start_button)
	_prompt_label.visible = false
	prompt_area.add_child(_prompt_label)
	_status_label = UiKit.label("", UiTheme.DIM)
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.hide()
	prompt_area.add_child(_status_label)
	list.add_child(UiKit.spacer(264, false))
	var footer: HBoxContainer = UiKit.row(16)
	_build_label = UiKit.label("", UiTheme.SMALL, false)
	_build_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_build_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	footer.add_child(_build_label)
	var support: Button = UiKit.button(tr("Support"), false, "QuietButton")
	_support_button = support
	support.size_flags_horizontal = Control.SIZE_SHRINK_END
	support.custom_minimum_size.x = 300
	support.pressed.connect(func() -> void: support_requested.emit())
	footer.add_child(support)
	column.add_child(footer)


## `build_line` is the small text at the bottom ("build 12"); `status` the line under the prompt (what is happening).
func load_title(build_line: String, status: String = "") -> void:
	ensure_built()
	_build_label.text = build_line
	set_status(status)


func set_status(status: String) -> void:
	ensure_built()
	_status_label.text = status
	_status_label.visible = not status.is_empty()


## While false, a tap is remembered and the prompt reads "Preparing…"; becoming ready with a tap pending starts at once.
func set_ready(ready_to_start: bool) -> void:
	ensure_built()
	_ready_to_start = ready_to_start
	_refresh_prompt()
	if ready_to_start and start_pending:
		start_pending = false
		start_requested.emit()


## A tap anywhere on the title (also what tests call).
func tap() -> void:
	if _ready_to_start:
		start_requested.emit()
	else:
		start_pending = true
		_refresh_prompt()


func prompt_text() -> String:
	return _prompt_label.text


func status_text() -> String:
	return _status_label.text


func shows_placeholder() -> bool:
	return _placeholder_tag.visible


func _refresh_prompt() -> void:
	_prompt_label.text = tr("Tap to start") if _ready_to_start or not start_pending else tr("Preparing…")
	_start_button.text = _prompt_label.text


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed) \
		or (event is InputEventMouseButton and (event as InputEventMouseButton).pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT)
	if pressed:
		accept_event()
		tap()
