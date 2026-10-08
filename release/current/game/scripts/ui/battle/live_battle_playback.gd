extends BattlePlayback
const Session = preload("res://scripts/core/battle/live_battle.gd")
var session: Session

func begin(prepared: BattleService.BattleResult, registry: ContentModels.ContentRegistry) -> void:
	_registry = registry
	session = Session.new()
	session.start(prepared)
	_build(prepared.initial_units,[],prepared.state.battle_events,prepared.final_units,"",0)
	configure_timeline(prepared.state.replay_frames,prepared.state.gauge_rules.gauge_max)

func _can_finish_log() -> bool:
	return session.completed

func can_cast_ultimate(entity_id: String) -> bool:
	return session.ultimate(entity_id) != null

func cast_ultimate(entity_id: String) -> bool:
	return session.cast(entity_id)

func advance(amount: float) -> Array[Cue]:
	session.advance(amount)
	for actor: BattleUnit in session.state.units:
		if unit(actor.entity_id) != null: continue
		_add_unit({"entity_id":actor.entity_id,"team":actor.team,"row":actor.row,"slot_index":actor.slot_index,"level":actor.level,"hp":actor.max_hp,"max_hp":actor.max_hp,"enemy_id":actor.enemy_id,"objective_id":actor.objective_id,"is_boss":actor.is_boss,"is_objective":actor.is_objective,"temporary":actor.temporary},false)
	if event_times.size() != _events.size(): configure_timeline(session.state.replay_frames,session.state.gauge_rules.gauge_max)
	outcome = session.result.outcome
	stars = session.result.stars
	var cues: Array[Cue] = super.advance(amount)
	for actor: BattleUnit in session.state.units:
		var view: UnitView = unit(actor.entity_id)
		if view == null: continue
		var delta: Frac = Frac.maximum(Frac.of(0),ActionGauge.ready_threshold(actor,session.state.gauge_rules).sub(actor.gauge)).div_int(ActionGauge.effective_speed(actor))
		var time: Frac = session.state.elapsed_gauge_time.add(delta)
		view.next_action_at = OPENING_SECONDS + float(time.num) / float(time.den) * REFERENCE_SPEED * BASE_ACTION_SECONDS / float(session.state.gauge_rules.gauge_max)
	return cues
