class_name LicensesScreen
extends UiScreen
## Third-party licenses (INF-040): ThirdPartyNotices.text() in a read-only text view (it is long: a TextEdit draws only
## the visible lines), with Back.

signal back_requested

var _text: TextEdit = null


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Licenses", UiTheme.TITLE))
	_text = TextEdit.new()
	_text.editable = false
	_text.context_menu_enabled = false
	_text.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	_text.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_text.add_theme_font_size_override("font_size", UiTheme.FONT_SMALL)
	column.add_child(_text)
	var back: Button = UiKit.button("Back")
	back.pressed.connect(func() -> void: back_requested.emit())
	column.add_child(back)


func load_text(text: String) -> void:
	ensure_built()
	_text.text = text
	_text.scroll_vertical = 0


func shown_text() -> String:
	return _text.text
