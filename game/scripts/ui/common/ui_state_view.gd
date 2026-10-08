class_name UiStateView
extends PanelContainer
## Shared state presentation. Only signals leave this view; no player data or transaction is changed.
signal action_requested(action_id: String)
const KINDS: Array[String] = ["loading", "empty", "locked", "disabled", "error", "offline", "insufficient_resource", "pending", "confirmed"]
const ICONS: Dictionary = {"loading": "waiting", "empty": "records", "locked": "lock", "disabled": "close", "error": "help", "offline": "offline", "insufficient_resource": "summon", "pending": "waiting", "confirmed": "checked"}
var content: VBoxContainer = null
var title_label: Label = null
var message_label: Label = null
var action: Button = null
var state: String = "empty"
var _mark: TextureRect = null
var _action_id: String = ""


func _init() -> void:
	theme_type_variation = UiTheme.STANDARD_PANEL
	size_flags_horizontal = Control.SIZE_EXPAND_FILL


func _ready() -> void:
	ensure_built()


func ensure_built() -> void:
	if content != null:
		return
	content = UiKit.column(24)
	add_child(content)
	_mark = TextureRect.new()
	_mark.custom_minimum_size = Vector2(80, 80)
	_mark.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_mark.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_mark.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mark.hide()
	content.add_child(_mark)
	title_label = UiKit.label("", UiTheme.TITLE)
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(title_label)
	message_label = UiKit.label("")
	message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(message_label)
	action = UiKit.button("", false, UiTheme.PRIMARY)
	action.hide()
	action.pressed.connect(_request_action)
	content.add_child(action)


## Example: view.present("offline", tr("You are offline"), tr("Check your connection."), tr("Retry"), "retry").
## Callers supply localized copy. Pending/loading suppress submission until a new presentation arrives.
func present(kind: String, heading: String, message: String, caption: String = "", action_id: String = "") -> void:
	assert(KINDS.has(kind), "Unknown UI state: " + kind)
	ensure_built()
	state = kind
	title_label.text = heading
	message_label.text = message
	var icon_name: String = ICONS[kind]
	_mark.texture = load("res://assets/ui/production/v001/icons/offline.svg") as Texture2D if icon_name == "offline" else UiTheme.GothicTheme.icon(icon_name)
	_mark.visible = true
	_action_id = action_id
	action.text = caption
	action.visible = not caption.is_empty() and not action_id.is_empty()
	action.disabled = kind in ["pending", "loading", "locked", "disabled"]
	action.theme_type_variation = UiTheme.ERROR if kind in ["error", "offline"] else (UiTheme.SUCCESS if kind == "confirmed" else UiTheme.PRIMARY)


func _request_action() -> void:
	if action.disabled or not action.visible or _action_id.is_empty():
		return
	action_requested.emit(_action_id)


## Example: clear_presentation() keeps the text labels but removes the state mark/action for plain copy.
func clear_presentation() -> void:
	ensure_built()
	_mark.hide()
	action.hide()
	_action_id = ""
