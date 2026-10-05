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

## Where art comes from; null = the app's (`Game.assets`). Tests set their own before the screen is built.
var assets: AssetResolver = null
## True once a tap asked to start (it may have come before the director was ready).
var start_pending: bool = false

var _art: TextureRect = null
var _name_label: Label = null
var _placeholder_tag: Label = null
var _prompt_label: Label = null
var _status_label: Label = null
var _build_label: Label = null
var _ready_to_start: bool = false


func _build(column: VBoxContainer) -> void:
	var resolver: AssetResolver = assets if assets != null else Game.assets
	_art = TextureRect.new()
	_art.set_anchors_preset(Control.PRESET_FULL_RECT)
	_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_art.texture = resolver.texture(ART_REFERENCE)
	add_child(_art)
	move_child(_art, 1)  # above the background colour, below the safe-area column
	var has_art: bool = resolver.has_art(ART_REFERENCE)

	_placeholder_tag = UiKit.placeholder_tag()
	_placeholder_tag.visible = not has_art
	column.add_child(_placeholder_tag)
	column.add_child(UiKit.spacer(0, true))
	# The logo is part of the key art; without the art, the name stands in for it.
	_name_label = UiKit.label(GAME_NAME, UiTheme.TITLE)
	_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name_label.visible = not has_art
	column.add_child(_name_label)
	column.add_child(UiKit.spacer(0, true))
	_prompt_label = UiKit.label("Tap to start")
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_prompt_label)
	_status_label = UiKit.label("", UiTheme.DIM)
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_status_label)
	var footer: HBoxContainer = UiKit.row(16)
	_build_label = UiKit.label("", UiTheme.SMALL, false)
	_build_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_build_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	footer.add_child(_build_label)
	var support: Button = UiKit.button("Support")
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
	_prompt_label.text = "Tap to start" if _ready_to_start or not start_pending else "Preparing…"


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed) \
		or (event is InputEventMouseButton and (event as InputEventMouseButton).pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT)
	if pressed:
		accept_event()
		tap()
