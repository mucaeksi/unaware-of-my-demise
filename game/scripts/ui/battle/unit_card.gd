class_name UnitCard
extends PanelContainer
## One unit's HP/status HUD. The compact variant sits below a grounded BattleActor;
## the original standalone card remains available for tools. This class owns no rules.

const CARD_WIDTH: int = 300
const SPRITE_SIZE: int = 104

var entity_id: String = ""

var _name_label: Label = null
var _level_label: Label = null
var _initial: Label = null
var _bar: ProgressBar = null
var _hp_label: Label = null
var _status_label: Label = null
var _flash: Tween = null
var _compact: bool = false
var _boss: bool = false
var _accent: Color = BattleHudStyle.EDGE
var _stone: bool = false


static func create(view: BattlePlayback.UnitView, compact: bool = false) -> UnitCard:
	var card: UnitCard = UnitCard.new()
	card._compact = compact
	card._boss = view.is_boss
	card.entity_id = view.entity_id
	card._accent = BattleHudStyle.accent(view)
	card._stone = view.art_id == "mahmut" or view.element == "Stone"
	# Battle HUD is compact; the tall CompanionCard texture reserves a separate portrait slot.
	card.theme_type_variation = UiTheme.STANDARD_PANEL
	card.custom_minimum_size = Vector2((264 if view.is_boss else BattleHudStyle.CARD_WIDTH) if compact else CARD_WIDTH, 0)
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if compact:
		card.add_theme_stylebox_override("panel", BattleHudStyle.card(card._accent))
	card._build(view)
	card.refresh(view)
	return card


func _build(view: BattlePlayback.UnitView) -> void:
	var content: VBoxContainer = UiKit.column(5 if _compact else 6)
	add_child(content)
	_name_label = UiKit.label("", UiTheme.SMALL, false)
	_name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	if _compact:
		var plaque: PanelContainer = PanelContainer.new()
		plaque.add_theme_stylebox_override("panel", BattleHudStyle.nameplate(_accent, _stone))
		content.add_child(plaque)
		var name_row: HBoxContainer = UiKit.row(2)
		plaque.add_child(name_row)
		BattleHudStyle.label(_name_label, 30, BattleHudStyle.BONE)
		_name_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		_name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_row.add_child(_name_label)
		var level_badge: PanelContainer = PanelContainer.new()
		level_badge.add_theme_stylebox_override("panel", BattleHudStyle.level_badge(_accent))
		level_badge.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		name_row.add_child(level_badge)
		_level_label = UiKit.label("", "", false)
		BattleHudStyle.label(_level_label, 18, _accent.lightened(0.1))
		_level_label.size_flags_horizontal = Control.SIZE_SHRINK_END
		level_badge.add_child(_level_label)
	else:
		content.add_child(_name_label)
	var portrait: Control = Control.new()
	portrait.custom_minimum_size = Vector2(0, SPRITE_SIZE)
	var tint: ColorRect = ColorRect.new()
	tint.color = (UiTheme.PLAYER_TINT if view.team == "player" else UiTheme.ENEMY_TINT).darkened(0.35)
	tint.set_anchors_preset(Control.PRESET_FULL_RECT)
	tint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	portrait.add_child(tint)
	_initial = UiKit.label("", "", false)
	_initial.add_theme_font_size_override("font_size", 72)
	_initial.set_anchors_preset(Control.PRESET_FULL_RECT)
	_initial.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_initial.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	portrait.add_child(_initial)
	content.add_child(portrait)
	portrait.visible = not _compact
	_bar = ProgressBar.new()
	_bar.theme_type_variation = UiTheme.BAR_PLAYER if view.team == "player" else UiTheme.BAR_ENEMY
	_bar.show_percentage = false
	_bar.custom_minimum_size = Vector2(0, BattleHudStyle.BAR_HEIGHT if _compact else 22)
	if _compact:
		BattleHudStyle.health(_bar, view.team == "player")
	content.add_child(_bar)
	_hp_label = UiKit.label("", UiTheme.SMALL, false)
	content.add_child(_hp_label)
	_status_label = UiKit.label("", UiTheme.SMALL, false)
	_status_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	if _compact:
		BattleHudStyle.label(_hp_label, 28, BattleHudStyle.MUTED)
		_hp_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_hp_label.visible = _boss
		BattleHudStyle.label(_status_label, 22, BattleHudStyle.ALLY if view.team == "player" else BattleHudStyle.ENEMY)
	content.add_child(_status_label)
	if _compact:
		_bar.resized.connect(queue_redraw)

func _draw() -> void:
	if not _compact or _bar == null or not _bar.is_inside_tree():
		return
	# Tiny metal end caps keep the health rail recognisable at phone size without
	# introducing a large illustrated card or covering the chibi silhouette.
	var rail: Rect2 = get_global_transform().affine_inverse() * _bar.get_global_rect()
	for x: float in [rail.position.x - 1.0, rail.end.x + 1.0]:
		var center: Vector2 = Vector2(x, rail.get_center().y)
		var points: PackedVector2Array = PackedVector2Array([center + Vector2(-4,0), center + Vector2(0,-5), center + Vector2(4,0), center + Vector2(0,5)])
		draw_colored_polygon(points, BattleHudStyle.INK)
		points.append(points[0])
		draw_polyline(points, _accent, 1.0, true)
		if not _stone:
			draw_arc(center, 6, -PI * 0.65, PI * 0.65, 14, Color(_accent, 0.65), 1.0, true)


func refresh(view: BattlePlayback.UnitView) -> void:
	visible = view.on_field
	_name_label.text = "%s  Lv %d" % [view.display_name, view.level] if not view.is_objective else "◆ %s" % view.display_name
	if _compact:
		# Compact encounter labels retain the full canonical name in the tooltip.
		_name_label.text = "Bellbound" if view.art_id == "bellbound_dead" else ("Pilgrim" if view.art_id == "hollow_pilgrim" else view.display_name)
		_name_label.add_theme_font_size_override("font_size", 22 if view.art_id == "bellbound_dead" else 28)
		_level_label.text = "Lv.%d" % view.level if not view.is_objective else "◆"
		tooltip_text = "%s · Level %d · HP %d / %d" % [view.display_name, view.level, view.hp, view.max_hp]
	_initial.text = view.display_name.left(1).to_upper()
	_bar.max_value = view.max_hp
	_bar.value = view.hp
	_hp_label.text = "HP %d / %d" % [view.hp, view.max_hp]
	_status_label.text = ", ".join(view.statuses)
	if _compact:
		_status_label.visible = not view.statuses.is_empty()
		if is_inside_tree():
			call_deferred("reset_size")
	modulate.a = 1.0 if view.alive else 0.4
	queue_redraw()


func hp_text() -> String:
	return _hp_label.text


func status_text() -> String:
	return _status_label.text


func bar_value() -> float:
	return _bar.value


## A quick brightening: the unit was hit, healed or afflicted.
func flash(color: Color) -> void:
	if not is_inside_tree():
		return
	if _flash != null and _flash.is_valid():
		_flash.kill()
	var alpha: float = modulate.a
	modulate = Color(color.r, color.g, color.b, alpha)
	_flash = create_tween()
	_flash.tween_property(self, "modulate", Color(1, 1, 1, alpha), 0.25)
