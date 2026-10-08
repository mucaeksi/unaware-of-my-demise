class_name UiKit
extends RefCounted
## Small builders for the code-built screens, so every screen makes labels, buttons and lists the same way.


## A label. `variation` is one of the `UiTheme` type variations ("" = body text).
static func label(text: String, variation: String = "", wrap: bool = true) -> Label:
	var node: Label = Label.new()
	node.language = "en"
	node.text = text
	if not variation.is_empty():
		node.theme_type_variation = variation
	if wrap:
		node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return node


## A touch-sized button; `toggle` makes it a selectable choice.
static func button(text: String, toggle: bool = false, variation: String = "") -> Button:
	var node: GothicActionButton = GothicActionButton.new()
	node.language = "en"
	node.text = text
	node.toggle_mode = toggle
	if not variation.is_empty():
		node.theme_type_variation = variation
	# Long lines (an accessory's stat list) wrap inside the button instead of widening the whole screen.
	node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.custom_minimum_size = Vector2(0, UiTheme.TOUCH_HEIGHT)
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return node


## Utilities retain a visible caption and tooltip; icon geometry is a bundled SVG.
static func icon_button(icon_name: String, caption: String, variation: String = UiTheme.ICON) -> Button:
	var node: Button = button(caption, false, variation)
	node.icon = UiTheme.GothicTheme.icon(icon_name)
	node.tooltip_text = caption
	node.expand_icon = true
	return node


static func spacer(min_height: int = 0, expand: bool = true) -> Control:
	var node: Control = Control.new()
	node.custom_minimum_size = Vector2(0, min_height)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if expand:
		node.size_flags_vertical = Control.SIZE_EXPAND_FILL
	return node


static func column(separation: int = 16) -> VBoxContainer:
	var node: VBoxContainer = VBoxContainer.new()
	node.add_theme_constant_override("separation", separation)
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return node


static func row(separation: int = 16) -> HBoxContainer:
	var node: HBoxContainer = HBoxContainer.new()
	node.add_theme_constant_override("separation", separation)
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return node


## A scrolling column that fills the remaining height; returns the inner column to add rows to.
static func scroll_column(parent: Control, separation: int = 12) -> VBoxContainer:
	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.follow_focus = true
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(scroll)
	var inner: VBoxContainer = column(separation)
	scroll.add_child(inner)
	return inner


## A card panel around `content`.
static func card(content: Control, variation: String = UiTheme.STANDARD_PANEL) -> PanelContainer:
	var panel: PanelContainer = PanelContainer.new()
	panel.theme_type_variation = variation
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_child(content)
	return panel


## A noninteractive status badge. Example: column.add_child(UiKit.badge(tr("Pending"))).
static func badge(text: String) -> PanelContainer:
	var caption: Label = label(text, UiTheme.SMALL, false)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var panel: PanelContainer = card(caption, UiTheme.BADGE)
	panel.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return panel


## Navigation surface; the owning screen connects action signals. Example: card(row(), UiTheme.NAV_PANEL).
static func navigation(content: Control) -> PanelContainer:
	return card(content, UiTheme.NAV_PANEL)


## Example: var filters = UiKit.tabs([tr("All"), tr("Owned"), tr("Locked")]); connect each Button's pressed signal.
static func tabs(captions: Array[String], selected_index: int = 0) -> HBoxContainer:
	var strip: HBoxContainer = row(12)
	var group: ButtonGroup = ButtonGroup.new()
	for index: int in range(captions.size()):
		var choice: Button = button(captions[index], true, UiTheme.SECONDARY)
		choice.button_group = group
		choice.button_pressed = index == selected_index
		strip.add_child(choice)
	return strip


## Example: column.add_child(UiKit.input(tr("Search companions"))).
static func input(placeholder: String) -> LineEdit:
	var field: LineEdit = LineEdit.new()
	field.placeholder_text = placeholder
	field.custom_minimum_size.y = UiTheme.TOUCH_HEIGHT
	field.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return field


## Marks art that is not final (brief G5: placeholder art is labelled as such).
static func placeholder_tag(text: String = "PLACEHOLDER ART") -> Label:
	return label(text, UiTheme.PLACEHOLDER_TAG, false)


## Removes and frees every child (the list screens rebuild their rows on each load).
static func clear(node: Node) -> void:
	for child: Node in node.get_children():
		node.remove_child(child)
		child.queue_free()


## "Name  (4★ Ember/Striker)": the one line a hero gets on the roster and selector lists.
static func hero_line(candidate: GameFlow.RosterCandidate) -> String:
	return "%s  (%d★ %s/%s)" % [candidate.name_en, candidate.rarity, candidate.element, candidate.combat_role]
