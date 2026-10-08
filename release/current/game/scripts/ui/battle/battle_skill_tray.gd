extends HBoxContainer
## Five stable formation slots. Basic/Active have thin bars, Ultimate has a face button.
signal ultimate_requested(entity_id: String)
const UltimateButton = preload("res://scripts/ui/battle/ultimate_button.gd")
const SLOT_COUNT: int = 5
var _playback: BattlePlayback
var casting: bool = false

class ReadinessBars extends Control:
	var values: Vector2 = Vector2.ONE
	var tone: Color
	func _draw() -> void:
		for index: int in range(2):
			var rect: Rect2 = Rect2(8,index*7,maxf(0,size.x-16),3)
			draw_style_box(UiTheme.box(Color(tone,0.12),2),rect)
			var fill: Rect2 = rect
			fill.size.x *= values[index]
			draw_style_box(UiTheme.box(Color(tone,0.85),2),fill)

class SkillTile extends VBoxContainer:
	signal requested(entity_id: String)
	var view: BattlePlayback.UnitView
	var ultimate: UltimateButton
	var meter: Label
	var bars: ReadinessBars
	var heading: Label

	func build(unit: BattlePlayback.UnitView, slot: int) -> void:
		view = unit
		name = "PartySlot_%d" % slot
		size_flags_horizontal = Control.SIZE_EXPAND_FILL
		add_theme_constant_override("separation",2)
		var tone: Color = BattleHudStyle.accent(view) if view != null else BattleHudStyle.MUTED
		ultimate = UltimateButton.new()
		ultimate.name = "Ultimate_%s" % view.entity_id if view != null else "Empty_%d" % slot
		ultimate.tone = tone
		ultimate.occupied = view != null
		ultimate.disabled = true
		ultimate.focus_mode = Control.FOCUS_ALL if view != null else Control.FOCUS_NONE
		ultimate.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if view != null:
			ultimate.mark = BattleArt.icon(view.art_id)
			ultimate.pressed.connect(func() -> void: requested.emit(view.entity_id))
			for skill: ContentModels.Skill in view.skills:
				if skill.type == "ultimate":
					ultimate.tooltip_text = "%s · %s\n%s\nTap when Focus is full." % [view.display_name,skill.name_en,skill.description_en]
		add_child(ultimate)
		heading = UiKit.label(view.display_name if view != null else "","",false)
		heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		heading.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		BattleHudStyle.label(heading,24,tone.lightened(0.15) if view != null else Color(tone,0.4))
		add_child(heading)
		heading.custom_minimum_size.y = 30
		meter = UiKit.label("","",false)
		meter.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		BattleHudStyle.label(meter,20,tone)
		add_child(meter)
		bars = ReadinessBars.new()
		bars.custom_minimum_size.y = 11
		bars.tone = tone
		bars.visible = view != null
		add_child(bars)

	func refresh(model: BattlePlayback, is_casting: bool) -> void:
		if view == null: return
		ultimate.focus = view.focus
		ultimate.defeated = not view.alive
		ultimate.charged = model.can_cast_ultimate(view.entity_id)
		ultimate.disabled = not ultimate.charged or is_casting
		meter.text = "READY" if ultimate.charged else "%d / 100" % view.focus
		if not view.alive: meter.text = "DEFEATED"
		var details: PackedStringArray = PackedStringArray()
		for index: int in range(2):
			var kind: String = "basic" if index == 0 else "active"
			bars.values[index] = 0.0
			for skill: ContentModels.Skill in view.skills:
				if skill.type != kind: continue
				var remaining: float = model.skill_remaining(view,skill)
				var duration: float = BattlePlayback.BASE_ACTION_SECONDS*BattlePlayback.REFERENCE_SPEED/float(maxi(1,view.speed))*maxi(1,skill.cooldown_turns)
				bars.values[index] = clampf(1.0-remaining/maxf(0.01,duration),0,1) if view.alive else 0.0
				details.append("%s · %s" % [skill.name_en,"%.1fs" % remaining if remaining > 0.05 else "Ready"])
		bars.tooltip_text = "\n".join(details)
		bars.queue_redraw()
		ultimate.queue_redraw()

func setup(model: BattlePlayback) -> void:
	_playback = model
	casting = false
	UiKit.clear(self)
	add_theme_constant_override("separation",12)
	var slots: Array[BattlePlayback.UnitView] = []
	slots.resize(SLOT_COUNT)
	for view: BattlePlayback.UnitView in model.field("player"):
		if view.is_objective: continue
		var index: int = view.slot_index
		if index < 0 or index >= SLOT_COUNT or slots[index] != null:
			index = slots.find(null)
		if index >= 0: slots[index] = view
	for index: int in range(SLOT_COUNT):
		var tile: SkillTile = SkillTile.new()
		tile.build(slots[index],index)
		tile.requested.connect(func(id: String) -> void: ultimate_requested.emit(id))
		add_child(tile)
	refresh()
	apply_text_scale(BattleHudStyle.text_scale(self))

func apply_text_scale(font_scale: float) -> void:
	for child: Node in get_children():
		var tile: SkillTile = child as SkillTile
		if tile == null: continue
		tile.heading.add_theme_font_size_override("font_size",roundi(24*font_scale))
		tile.meter.add_theme_font_size_override("font_size",roundi(22*font_scale))

func refresh() -> void:
	if _playback == null: return
	for child: Node in get_children():
		(child as SkillTile).refresh(_playback,casting)
