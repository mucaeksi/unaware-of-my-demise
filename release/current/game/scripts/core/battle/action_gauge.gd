class_name ActionGauge
extends RefCounted
## Continuous Action Gauge initiative using exact rational arithmetic (port of core/battle/gauge.py): who acts next,
## spending an action, delaying a unit's next action, and the battle loop `run_battle`.
##
## Gauge overflow stays attached to the unit; `pending_delay_gauge` is a debt added to the next readiness threshold and
## cleared only when that action is spent.


static func effective_speed(unit: BattleUnit, speed_floor: int = 1) -> int:
	return maxi(speed_floor, unit.effective_speed())


static func _delay(unit: BattleUnit, rules: GaugeRules) -> Frac:
	return Frac.minimum(rules.maximum_pending_delay_gauge(), Frac.maximum(Frac.of(0), unit.pending_delay_gauge))


static func ready_threshold(unit: BattleUnit, rules: GaugeRules) -> Frac:
	return Frac.of(rules.gauge_max).add(_delay(unit, rules))


static func alive_units(units: Array) -> Array[BattleUnit]:
	var result: Array[BattleUnit] = []
	for unit: BattleUnit in units:
		if unit.alive and unit.hp > 0:
			result.append(unit)
	return result


## Advances exact gauge time until an actor is ready, then applies the GDD tie-breaks. Null if nobody is alive.
static func next_actor(units: Array, rules: GaugeRules, clock_state: BattleState = null) -> BattleUnit:
	var living: Array[BattleUnit] = alive_units(units)
	if living.is_empty():
		return null
	while true:
		var best: BattleUnit = null
		var best_key: Array = []
		for unit: BattleUnit in living:
			var overshoot: Frac = unit.gauge.sub(ready_threshold(unit, rules))
			if overshoot.num < 0:
				continue
			# Sort key: (-(gauge - threshold), player first, slot index, entity id); the smallest key acts.
			var key: Array = [overshoot.neg(), 0 if unit.team == "player" else 1, unit.slot_index, unit.entity_id]
			if best == null or BattleUtil.key_less(key, best_key):
				best = unit
				best_key = key
		if best != null:
			return best
		var delta: Frac = null
		for unit: BattleUnit in living:
			var candidate: Frac = ready_threshold(unit, rules).sub(unit.gauge).div_int(effective_speed(unit, rules.effective_speed_floor))
			if delta == null or candidate.compare(delta) < 0:
				delta = candidate
		for unit: BattleUnit in living:
			unit.gauge = unit.gauge.add(delta.mul_int(effective_speed(unit, rules.effective_speed_floor)))
		if clock_state != null:
			clock_state.elapsed_gauge_time = clock_state.elapsed_gauge_time.add(delta)
		if Frac.overflowed:
			return null
	return null


## Pays the readiness threshold: overflow stays, the pending delay is cleared. False if the unit was not ready.
static func spend_action(actor: BattleUnit, rules: GaugeRules) -> bool:
	var threshold: Frac = ready_threshold(actor, rules)
	if actor.gauge.compare(threshold) < 0:
		return false
	actor.gauge = actor.gauge.sub(threshold)
	actor.pending_delay_gauge = Frac.of(0)
	return true


## Adds `gauge_max * fraction` to the target's pending delay (capped) and returns the new pending delay.
static func delay_next_action(target: BattleUnit, fraction: Frac, rules: GaugeRules) -> Frac:
	var amount: Frac = fraction if fraction.num >= 0 else Frac.of(0)
	target.pending_delay_gauge = Frac.minimum(
		rules.maximum_pending_delay_gauge(),
		_delay(target, rules).add(amount.mul_int(rules.gauge_max)))
	return target.pending_delay_gauge


## The GDD's queue/orchestration loop. `provider` is a Callable(state, actor) or an object with `choose_action(state, actor)`;
## the state supplies turn, cycle, reaction and phase hooks (a bare BattleState just uses the defaults).
## Returns the number of actions taken; `state.fault` is set if the safety limit is exceeded.
static func run_battle(state: BattleState, provider: Variant, run_seed: int, max_actions: int = 10000, gauge_rules: GaugeRules = null) -> int:
	var rng: CpythonRandom = CpythonRandom.create_from_int(run_seed)
	state.rng = rng
	var rules: GaugeRules = gauge_rules if gauge_rules != null else (state.gauge_rules if state.gauge_rules != null else GaugeRules.new())
	state.gauge_rules = rules
	state.begin_cycle()
	var active_cycle: Array[BattleUnit] = alive_units(state.units)
	var actions: int = 0
	while not state.is_battle_over() and actions < max_actions:
		var actor: BattleUnit = next_actor(active_cycle, rules, state)
		if actor == null:
			break
		state.start_turn(actor)
		if actor.alive and actor.hp > 0:
			var statuses_at_turn_start: Dictionary = state.turn_status_snapshot.get(actor.entity_id, {})
			var stunned: bool = false
			for status_id: String in ["stun", "break"]:
				if actor.has_status(status_id) or statuses_at_turn_start.has(status_id):
					stunned = true
			if stunned:
				# No consume hook on the encounter state: the reference just drops both statuses.
				actor.statuses.erase("stun")
				actor.statuses.erase("break")
			else:
				var action: Variant = (provider as Callable).call(state, actor) if provider is Callable else provider.choose_action(state, actor)
				state.resolve_action(actor, action, rng)
			state.resolve_reactions(actor, rng)
			# A held boss intent is resolved after the next player action opportunity, including a player turn spent
			# under Stun/Break.
			state.resolve_boss_telegraph_if_ready(actor, rng)
			if not spend_action(actor, rules):
				state.report_fault("%s is not ready to spend an Action Gauge" % actor.entity_id)
		state.end_turn(actor)
		state.resolve_phase_transition_if_needed(rng)
		actions += 1
		if not state.fault.is_empty() or Frac.overflowed:
			break
		var everyone_done: bool = true
		for unit: BattleUnit in active_cycle:
			if unit.alive and unit.hp > 0 and not unit.has_acted:
				everyone_done = false
				break
		if everyone_done:
			state.end_cycle()
			active_cycle = alive_units(state.units)
			for unit: BattleUnit in active_cycle:
				unit.has_acted = false
			state.round_number += 1
			state.begin_cycle()
	if actions >= max_actions and not state.is_battle_over():
		state.report_fault("Battle exceeded the %d action safety limit" % max_actions)
	if Frac.overflowed:
		state.report_fault("Action Gauge arithmetic left the int64 range")
	if state.is_battle_over() and state.fault.is_empty():
		var final_units: Array[Dictionary] = []
		for unit: BattleUnit in state.units:
			final_units.append({"entity_id": unit.entity_id, "hp": unit.hp, "max_hp": unit.max_hp, "alive": unit.alive})
		state.emit_event({
			"type": "battle_completed",
			"result": "victory" if not state.living_units("player").is_empty() else "defeat",
			"actions": actions,
			"units": final_units,
		})
	return actions
