extends Control
## Development-only gallery of the actual shared runtime Controls. No player or server data.
var _page: String = "identity"
var _column: VBoxContainer = null
var _modal: GothicModal = null
var _status: Label = null
var _capture_path: String = ""


func _ready() -> void:
	theme = UiTheme.create()
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--system-page="):
			_page = argument.trim_prefix("--system-page=")
		if argument.begins_with("--system-capture="):
			_capture_path = argument.trim_prefix("--system-capture=")
	var background: ColorRect = ColorRect.new()
	background.material = UiTheme.GothicTheme.background_material()
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	var safe: SafeAreaContainer = SafeAreaContainer.new()
	safe.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(safe)
	var inset: MarginContainer = MarginContainer.new()
	for side: String in ["left", "right", "top", "bottom"]:
		inset.add_theme_constant_override("margin_" + side, 64)
	safe.add_child(inset)
	_column = UiKit.column(16)
	inset.add_child(_column)
	if _page == "identity":
		_identity()
	else:
		_components()
	_modal = GothicModal.new()
	add_child(_modal)
	_modal.confirmed.connect(func() -> void: _status.text = "Confirmed · preview only")
	_modal.canceled.connect(func() -> void: _status.text = "Canceled · preview only")
	if _page == "modal":
		_open_modal()
	if not _capture_path.is_empty():
		_capture()


func _heading(title: String, caption: String) -> void:
	_column.add_child(UiKit.label("UNAWARE OF MY DEMISE  /  ART SYSTEM 02", UiTheme.SMALL, false))
	_column.add_child(UiKit.label(title, "DisplayLabel"))
	_column.add_child(UiKit.label(caption, UiTheme.DIM))


func _identity() -> void:
	_heading("A name worth keeping", "Silver bells. Witnessed names. A small light in the dark.")
	_column.add_child(UiKit.spacer(12, false))
	var seal: GameLogo = GameLogo.new()
	seal.display_scale = 0.8
	_column.add_child(seal)
	_column.add_child(UiKit.label("01  /  SEAL LOCKUP", UiTheme.SMALL, false))
	_column.add_child(UiKit.spacer(12, false))
	var compact: GameLogo = GameLogo.new()
	compact.arrangement = GameLogo.Arrangement.COMPACT
	compact.display_scale = 0.8
	_column.add_child(compact)
	_column.add_child(UiKit.label("02  /  COMPACT LOCKUP", UiTheme.SMALL, false))
	_column.add_child(UiKit.spacer(12, false))
	var palette: HBoxContainer = UiKit.row(16)
	_column.add_child(palette)
	for pair: Array in [["INK", UiTheme.BACKGROUND], ["BONE", UiTheme.TEXT], ["WINE", UiTheme.GothicTheme.WINE], ["SILVER", UiTheme.GothicTheme.SILVER], ["BRONZE", UiTheme.GothicTheme.BRONZE], ["TEAL", UiTheme.GothicTheme.TEAL]]:
		var swatch: VBoxContainer = UiKit.column(10)
		swatch.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		palette.add_child(swatch)
		var tile: PanelContainer = PanelContainer.new()
		tile.custom_minimum_size.y = 72
		tile.add_theme_stylebox_override("panel", UiTheme.GothicTheme.box(pair[1], UiTheme.GothicTheme.BRONZE, 1))
		swatch.add_child(tile)
		var name_label: Label = UiKit.label(pair[0], UiTheme.SMALL, false)
		name_label.add_theme_font_size_override("font_size", 24)
		swatch.add_child(name_label)
	var material: VBoxContainer = UiKit.column(16)
	material.add_child(UiKit.label("Ink, cloth & tarnished silver", "DisplayLabel"))
	material.get_child(0).add_theme_font_size_override("font_size", 42)
	material.add_child(UiKit.label("Fine contours for faces. Worn edges for metal. Quiet texture around clear, readable words.", UiTheme.DIM))
	var frame: PanelContainer = UiKit.card(material)
	frame.theme_type_variation = UiTheme.FRAME
	_column.add_child(frame)
	_column.add_child(UiKit.spacer())
	var next: Button = UiKit.button("View component library", false, UiTheme.PRIMARY)
	next.pressed.connect(func() -> void: _change_page("components"))
	_column.add_child(next)
	_status = UiKit.label("Candidate identity · actual Godot render", UiTheme.SMALL, false)
	_column.add_child(_status)


func _components() -> void:
	_heading("Written in the dark", "One visual language, from the first tap to the last page.")
	_column.add_child(UiKit.label("ACTIONS & STATES", UiTheme.SMALL, false))
	var grid: GridContainer = GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 20)
	grid.add_theme_constant_override("v_separation", 20)
	_column.add_child(grid)
	var primary: Button = UiKit.button("Continue", false, UiTheme.PRIMARY)
	primary.pressed.connect(func() -> void: _status.text = "Continue pressed · preview only")
	grid.add_child(primary)
	var selected: Button = UiKit.button("Selected", true, UiTheme.NAVIGATION)
	selected.button_pressed = true
	grid.add_child(selected)
	var secondary: Button = UiKit.icon_button("settings", "Settings", UiTheme.SECONDARY)
	secondary.pressed.connect(func() -> void: _status.text = "Settings pressed · preview only")
	grid.add_child(secondary)
	var locked: Button = UiKit.icon_button("lock", "Unavailable", UiTheme.SECONDARY)
	locked.disabled = true
	grid.add_child(locked)
	var destructive: Button = UiKit.button("Sign out", false, UiTheme.DESTRUCTIVE)
	destructive.pressed.connect(_open_modal)
	grid.add_child(destructive)
	var busy: GothicActionButton = UiKit.button("Continue", false, UiTheme.PRIMARY) as GothicActionButton
	busy.set_busy(true)
	grid.add_child(busy)
	_column.add_child(UiKit.label("NAVIGATION", UiTheme.SMALL, false))
	var navigation: HBoxContainer = UiKit.row(16)
	_column.add_child(navigation)
	for pair: Array in [["home", "Shelter"], ["journey", "Journey"], ["summon", "Summon"]]:
		var button: Button = UiKit.icon_button(pair[0], pair[1], UiTheme.NAVIGATION)
		button.toggle_mode = true
		button.button_pressed = pair[0] == "home"
		navigation.add_child(button)
	var content: VBoxContainer = UiKit.column(20)
	content.add_child(UiKit.label("A witnessed name", "DisplayLabel"))
	content.get_child(0).add_theme_font_size_override("font_size", 50)
	content.add_child(UiKit.label("A small warm light survives the weathered stone. Names remain legible in the ledger.", UiTheme.DIM))
	var framed: PanelContainer = UiKit.card(content)
	framed.theme_type_variation = UiTheme.FRAME
	_column.add_child(framed)
	_column.add_child(UiKit.label("ENTRY CONTROLS", UiTheme.SMALL, false))
	var input: LineEdit = LineEdit.new()
	input.placeholder_text = "Enter a name"
	input.custom_minimum_size.y = 120
	_column.add_child(input)
	var check: CheckBox = CheckBox.new()
	check.text = "Remember this choice"
	check.button_pressed = true
	check.custom_minimum_size.y = UiTheme.TOUCH_HEIGHT
	_column.add_child(check)
	var utilities: HBoxContainer = UiKit.row(20)
	for pair: Array in [["back", "Back"], ["help", "Help"]]:
		var utility: Button = UiKit.icon_button(pair[0], pair[1])
		if pair[0] == "back":
			utility.pressed.connect(func() -> void: _change_page("identity"))
		else:
			utility.pressed.connect(func() -> void: _status.text = "Help pressed · preview only")
		utilities.add_child(utility)
	_column.add_child(utilities)
	_status = UiKit.label("Interactive samples · no account or download", UiTheme.SMALL)
	_column.add_child(_status)
	_column.add_child(UiKit.spacer())
	if _page != "modal":
		primary.grab_focus.call_deferred()


func _open_modal() -> void:
	_modal.open("Leave this session?", "Your journey will be here when you return. This is a component preview; no account is signed out.", "Sign out", true)


func _change_page(page: String) -> void:
	_page = page
	UiKit.clear(_column)
	if page == "identity":
		_identity()
	else:
		_components()


func _capture() -> void:
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var result: Error = get_viewport().get_texture().get_image().save_png(_capture_path)
	var controls: Array[Dictionary] = []
	for node: Node in find_children("*", "BaseButton", true, false):
		var control: Control = node as Control
		controls.append({"text": node.get("text"), "rect": str(control.get_global_rect()), "visible": control.is_visible_in_tree(), "disabled": node.get("disabled"), "variation": str(control.theme_type_variation)})
	var record: FileAccess = FileAccess.open(_capture_path + ".json", FileAccess.WRITE)
	record.store_string(JSON.stringify({"page": _page, "engine": Engine.get_version_info()["string"], "viewport": str(get_viewport().get_visible_rect()), "controls": controls, "account_requested": false}, "  ") + "\n")
	get_tree().quit(int(result))
