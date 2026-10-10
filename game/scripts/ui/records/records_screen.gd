class_name RecordsScreen
extends UiScreen
## Previously seen journey scenes and authored, spoiler-gated companion stories.
signal replay_requested(scene: Dictionary)
signal back_requested
var _list: VBoxContainer
var _hint: Label
var _rows: Array[Dictionary] = []

func _build(column: VBoxContainer) -> void:
	column.add_child(UiKit.label("Story Records", UiTheme.TITLE))
	_hint = UiKit.label("Replay your journey and read unlocked companion stories. Replays do not change progress.", UiTheme.DIM)
	column.add_child(_hint)
	_list = UiKit.scroll_column(column, 16)
	var back: Button = UiKit.button("Back to Shelter", false, UiTheme.SECONDARY)
	back.pressed.connect(func() -> void: back_requested.emit())
	column.add_child(back)

func load_records(rows: Array[Dictionary]) -> void:
	ensure_built()
	UiKit.clear(_list)
	_rows = rows
	if rows.is_empty():
		_list.add_child(UiKit.label("Continue your journey to unlock records."))
	for row: Dictionary in rows:
		var button: Button = UiKit.button(str(row["label"]), false, UiTheme.SECONDARY)
		button.disabled = bool(row["locked"])
		button.pressed.connect(func() -> void: replay_requested.emit(row["scene"]))
		_list.add_child(button)
