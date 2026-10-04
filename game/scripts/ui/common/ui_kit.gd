class_name UiKit
extends RefCounted
## Small builders for the code-built screens, so every screen makes labels, buttons and lists the same way.


## A label. `variation` is one of the `UiTheme` type variations ("" = body text).
static func label(text: String, variation: String = "", wrap: bool = true) -> Label:
	var node: Label = Label.new()
	node.text = text
	if not variation.is_empty():
		node.theme_type_variation = variation
	if wrap:
		node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return node


## A touch-sized button; `toggle` makes it a selectable choice.
static func button(text: String, toggle: bool = false) -> Button:
	var node: Button = Button.new()
	node.text = text
	node.toggle_mode = toggle
	# Long lines (an accessory's stat list) wrap inside the button instead of widening the whole screen.
	node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.custom_minimum_size = Vector2(0, UiTheme.TOUCH_HEIGHT)
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
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
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(scroll)
	var inner: VBoxContainer = column(separation)
	scroll.add_child(inner)
	return inner


## A card panel around `content`.
static func card(content: Control) -> PanelContainer:
	var panel: PanelContainer = PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_child(content)
	return panel


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
