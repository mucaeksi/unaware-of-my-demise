extends RefCounted
## Input-driven encounter; Basic/Active automate, player ultimates are explicit.
## Commands record deterministic action boundaries for authoritative re-simulation.
const MODE: String = "manual_ultimate_v1"
var result: BattleService.BattleResult
var state: EncounterState
var provider: AutoBattleProvider
var active_cycle: Array[BattleUnit] = []
var automatic_actions: int = 0
var completed: bool = false
var seconds: float = 0.0

func start(prepared: BattleService.BattleResult) -> void:
	result = prepared
	state = result.state
	provider = AutoBattleProvider.from_rules(state.service.rules)
	provider.manual_ultimates = true
	provider.nearest_default = true
	state.gauge_rules = state.interpreter().gauge_rules
	state.rng = CpythonRandom.create_from_int(result.run_seed)
	state.begin_cycle()
	active_cycle = ActionGauge.alive_units(state.units)
	result.combat_mode = MODE
	if state.is_battle_over(): finish()

func next_time() -> float:
	var delta: Frac = null
	for unit: BattleUnit in ActionGauge.alive_units(active_cycle):
		var candidate: Frac = Frac.maximum(Frac.of(0),ActionGauge.ready_threshold(unit,state.gauge_rules).sub(unit.gauge)).div_int(ActionGauge.effective_speed(unit,state.gauge_rules.effective_speed_floor))
		if delta == null or candidate.compare(delta) < 0: delta = candidate
	if delta == null: return INF
	var time: Frac = state.elapsed_gauge_time.add(delta)
	return 0.8 + float(time.num) / float(time.den) * 17.0 / float(state.gauge_rules.gauge_max)

func advance(amount: float) -> void:
	if completed: return
	seconds += maxf(0.0,amount)
	if ActionGauge.alive_units(active_cycle).is_empty():
		if not state.is_battle_over(): state.report_fault("Live battle has no active actors")
		finish()
	while not completed and next_time() <= seconds + 0.000001:
		step()

func step() -> void:
	if completed: return
	var actor: BattleUnit = ActionGauge.next_actor(active_cycle,state.gauge_rules,state)
	if actor == null:
		if not state.is_battle_over(): state.report_fault("Live battle has no active actors")
		finish()
		return
	state.start_turn(actor)
	if actor.alive and actor.hp > 0:
		var snapshot: Dictionary = state.turn_status_snapshot.get(actor.entity_id,{})
		if actor.has_status("stun") or actor.has_status("break") or snapshot.has("stun") or snapshot.has("break"):
			actor.statuses.erase("stun")
			actor.statuses.erase("break")
		else: state.resolve_action(actor,provider.choose_action(state,actor),state.rng)
		state.resolve_reactions(actor,state.rng)
		state.resolve_boss_telegraph_if_ready(actor,state.rng)
		if not ActionGauge.spend_action(actor,state.gauge_rules): state.report_fault("Live actor was not gauge-ready")
	state.end_turn(actor)
	state.resolve_phase_transition_if_needed(state.rng)
	automatic_actions += 1
	var everyone_done: bool = true
	for unit: BattleUnit in active_cycle:
		if unit.alive and unit.hp > 0 and not unit.has_acted: everyone_done = false
	if everyone_done:
		state.end_cycle()
		active_cycle = ActionGauge.alive_units(state.units)
		for unit: BattleUnit in active_cycle: unit.has_acted = false
		state.round_number += 1
		state.begin_cycle()
	if state.is_battle_over() or not state.fault.is_empty() or Frac.overflowed or automatic_actions >= 10000: finish()

func ultimate(entity_id: String) -> ContentModels.Skill:
	for unit: BattleUnit in state.units:
		if unit.entity_id != entity_id or unit.team != "player": continue
		if completed or not unit.alive or unit.hp <= 0 or unit.has_status("stun") or unit.has_status("break"): return null
		for skill: ContentModels.Skill in state.records[entity_id].skills:
			if skill.type == "ultimate" and unit.focus >= skill.focus_cost and int(unit.cooldowns.get(skill.skill_id,0)) == 0: return skill
	return null

func cast(entity_id: String) -> bool:
	var skill: ContentModels.Skill = ultimate(entity_id)
	if skill == null: return false
	var actor: BattleUnit = null
	for unit: BattleUnit in state.units:
		if unit.entity_id == entity_id: actor = unit
	result.manual_commands.append({"after_actions":automatic_actions,"actor_id":entity_id})
	state.actor = actor
	var first: int = state.replay_frames.size()
	state.resolve_action(actor,provider._action(state,actor,skill),state.rng)
	state.resolve_reactions(actor,state.rng)
	state.resolve_phase_transition_if_needed(state.rng)
	for index: int in range(first,state.replay_frames.size()): state.replay_frames[index]["seconds"] = seconds
	if state.is_battle_over() or not state.fault.is_empty(): finish()
	return true

func finish() -> void:
	if completed: return
	completed = true
	if automatic_actions >= 10000 and not state.is_battle_over(): state.report_fault("Live battle action limit exceeded")
	if Frac.overflowed: state.report_fault("Action Gauge arithmetic left the int64 range")
	if state.fault.is_empty():
		var final: Array[Dictionary] = []
		for unit: BattleUnit in state.units: final.append({"entity_id":unit.entity_id,"hp":unit.hp,"max_hp":unit.max_hp,"alive":unit.alive})
		state.emit_event({"type":"battle_completed","result":"victory" if not state.living_units("player").is_empty() else "defeat","actions":automatic_actions + result.manual_commands.size(),"units":final})
	state.service.finalize_result(result)
