class_name DefeatScreen
extends UiScreen
## Shown after a lost stage (or a battle that could not run): retry, change party, or retreat (port of client/screens/defeat_screen.py).
## A defeat persists nothing, so every option is safe: nothing can be granted twice and the story cursor never moves.

signal retry
signal change_party
signal retreat

var _title_label: Label = null
var _subtitle_label: Label = null
var _retry_button: Button = null
var _change_party_button: Button = null
var _retreat_button: Button = null


func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.spacer(0, true))
	_title_label = UiKit.label("Defeat", UiTheme.TITLE)
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_title_label)
	_subtitle_label = UiKit.label("")
	_subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_subtitle_label)
	column.add_child(UiKit.spacer(0, true))
	_retry_button = UiKit.button(tr("Retry (same party)"), false, UiTheme.PRIMARY)
	_retry_button.pressed.connect(func() -> void: retry.emit())
	column.add_child(_retry_button)
	_change_party_button = UiKit.button("Change Party")
	_change_party_button.pressed.connect(func() -> void: change_party.emit())
	column.add_child(_change_party_button)
	_retreat_button = UiKit.button("Retreat")
	_retreat_button.pressed.connect(func() -> void: retreat.emit())
	column.add_child(_retreat_button)
	column.add_child(UiKit.spacer(0, true))


## `can_change_party` is false for a stage whose party is fixed (the tutorial): the button is then hidden. `title` / `message` override the
## defaults so a battle that failed with an error goes through the same choices.
func load_result(stage_id: String, can_change_party: bool, title: String = "", message: String = "") -> void:
	ensure_built()
	_title_label.text = title if not title.is_empty() else "Defeat"
	_subtitle_label.text = message if not message.is_empty() else "Stage %s was not cleared." % stage_id
	_change_party_button.visible = can_change_party
	_change_party_button.disabled = not can_change_party


func title_text() -> String:
	return _title_label.text


func message_text() -> String:
	return _subtitle_label.text


func can_change_party() -> bool:
	return _change_party_button.visible
