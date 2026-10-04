class_name UnitCard
extends PanelContainer
## One unit on the battle screen: a placeholder portrait (tinted square with the unit's initial; the chibi atlases arrive with the art), name,
## HP bar and status line. `refresh` copies what a `BattlePlayback.UnitView` says; nothing here knows the rules.

const CARD_WIDTH: int = 300
const SPRITE_SIZE: int = 104

var entity_id: String = ""

var _name_label: Label = null
var _initial: Label = null
var _bar: ProgressBar = null
var _hp_label: Label = null
var _status_label: Label = null
var _flash: Tween = null


static func create(view: BattlePlayback.UnitView) -> UnitCard:
	var card: UnitCard = UnitCard.new()
	card.entity_id = view.entity_id
	card.custom_minimum_size = Vector2(CARD_WIDTH, 0)
	card._build(view)
	card.refresh(view)
	return card


func _build(view: BattlePlayback.UnitView) -> void:
	var content: VBoxContainer = UiKit.column(6)
	add_child(content)
	_name_label = UiKit.label("", UiTheme.SMALL, false)
	_name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
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
	_bar = ProgressBar.new()
	_bar.theme_type_variation = UiTheme.BAR_PLAYER if view.team == "player" else UiTheme.BAR_ENEMY
	_bar.show_percentage = false
	_bar.custom_minimum_size = Vector2(0, 22)
	content.add_child(_bar)
	_hp_label = UiKit.label("", UiTheme.SMALL, false)
	content.add_child(_hp_label)
	_status_label = UiKit.label("", UiTheme.SMALL, false)
	_status_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	content.add_child(_status_label)


func refresh(view: BattlePlayback.UnitView) -> void:
	visible = view.on_field
	_name_label.text = "%s  Lv %d" % [view.display_name, view.level] if not view.is_objective else "◆ %s" % view.display_name
	_initial.text = view.display_name.left(1).to_upper()
	_bar.max_value = view.max_hp
	_bar.value = view.hp
	_hp_label.text = "HP %d / %d" % [view.hp, view.max_hp]
	_status_label.text = ", ".join(view.statuses)
	modulate.a = 1.0 if view.alive else 0.35


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
