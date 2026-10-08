extends GutTest
## G3.6: GUT counterparts of tests/test_battle_interpreter.py, test_battle_timing.py and test_battle_event_stream.py
## (interpreter operations, selectors, conditions, redirects, soul link, the Action Gauge, run_battle, turn timing and the
## presentation event stream).

var _registry: ContentModels.ContentRegistry = null


func before_all() -> void:
	_registry = BattleTestHelpers.registry()


func _units(list: Array) -> Array[BattleUnit]:
	var typed: Array[BattleUnit] = []
	typed.assign(list)
	return typed


func test_mahmut_ultimate_seeded_against_three_enemies_has_expected_damage_and_statuses() -> void:
	var interpreter: EffectInterpreter = BattleTestHelpers.interpreter(_registry, 20260927)
	var skill: ContentModels.Skill = _registry.skills["mahmut_ultimate_last_wall_at_dusk"]
	var ops: Array = []
	ops.assign(skill.effect_ops)
	assert_eq(interpreter.validate_effect_ops(ops).size(), 3)
	var mahmut: BattleUnit = BattleTestHelpers.make_unit("mahmut", "player", 0, 1000, 99, 95, 100, "Stone")
	mahmut.stats["crit_rate"] = 0.05
	var ally_one: BattleUnit = BattleTestHelpers.make_unit("ally_one", "player", 1)
	var ally_two: BattleUnit = BattleTestHelpers.make_unit("ally_two", "player", 2, 1000, 50, 50, 100, "Stone", "rear")
	var front_one: BattleUnit = BattleTestHelpers.make_unit("enemy_front_1", "enemy", 0, 500, 50, 50, 100, "Tide", "front")
	var front_two: BattleUnit = BattleTestHelpers.make_unit("enemy_front_2", "enemy", 1, 500, 50, 50, 100, "Tide", "front")
	var rear: BattleUnit = BattleTestHelpers.make_unit("enemy_rear", "enemy", 2, 500, 50, 50, 100, "Tide", "rear")
	var state: BattleState = BattleState.make(_units([mahmut, ally_one, ally_two, front_one, front_two, rear]))

	var results: Array[EffectInterpreter.OperationResult] = interpreter.execute_skill(skill, state, mahmut, "ultimate")

	assert_eq(state.fault, "")
	var damages: Array = []
	var defense_stats: Array = []
	var multipliers: Array = []
	for hit: Dictionary in results[0].damage:
		damages.append(hit["damage"])
		defense_stats.append(hit["defense_stat"])
		multipliers.append(hit["element_multiplier"])
	assert_eq(damages, [43, 43])
	assert_eq([front_one.hp, front_two.hp, rear.hp], [457, 457, 500])
	assert_eq(defense_stats, ["def", "def"])
	assert_eq(multipliers, [1.2, 1.2])
	for enemy: BattleUnit in [front_one, front_two, rear]:
		assert_true(enemy.has_status("taunt"), enemy.entity_id)
	assert_eq([mahmut.shield_total(), ally_one.shield_total(), ally_two.shield_total()], [114, 114, 114])


func test_damage_type_defense_and_element_chart_are_independent() -> void:
	var defender: BattleUnit = BattleTestHelpers.make_unit("defender", "enemy", 0, 1000, 50, 80, 100, "Gale")
	defender.stats["res"] = 25
	assert_eq(Damage.defense_stat_for_damage_type("physical", defender, {}), ["def", 80])
	assert_eq(Damage.defense_stat_for_damage_type("magic", defender, {}), ["res", 25])
	assert_eq(Damage.defense_stat_for_damage_type("elemental", defender, {}), ["res", 25])
	var no_resistance: BattleUnit = BattleTestHelpers.make_unit("no_res", "enemy", 1, 1000, 50, 80)
	assert_eq(Damage.defense_stat_for_damage_type("magic", no_resistance, {}), ["def", 80])
	# Ember's chart advantage against Gale does not change the chosen defense stat.
	var none: Array[String] = []
	assert_eq(Damage.element_multiplier("Ember", "Gale", none, none, {}), 1.2)
	assert_eq(Damage.element_multiplier("Dawn", "Veil", none, none, {}), 1.2)


func test_all_authored_operation_lists_validate_and_all_31_selectors_resolve() -> void:
	var interpreter: EffectInterpreter = BattleTestHelpers.interpreter(_registry, 4)
	var pack: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/content/battle_effects_part1.json"))
	var operation_count: int = 0
	for section: String in ["player_skill_effects", "enemy_actions", "enemy_passives", "boss_actions", "boss_phases"]:
		for entry: Dictionary in pack[section]:
			for field: String in ["effect_ops", "enter_ops", "passive_ops"]:
				var ops: Array = entry.get(field, [])
				if not ops.is_empty():
					interpreter.error = ""
					interpreter.validate_effect_ops(ops)
					assert_eq(interpreter.error, "", "%s.%s" % [entry.get("skill_id", entry.get("phase_id", section)), field])
					operation_count += ops.size()
	assert_gte(operation_count, 200)
	assert_eq(interpreter.selector_rules.size(), 31)

	var actor: BattleUnit = BattleTestHelpers.make_unit("actor", "player", 0)
	var ally: BattleUnit = BattleTestHelpers.make_unit("ally", "player", 1, 400)
	var enemy: BattleUnit = BattleTestHelpers.make_unit("enemy", "enemy", 0, 300, 50, 50, 100, "Stone", "front")
	enemy.statuses["duel_mark"] = {"duration_turns": 2, "tags": ["mark", "duel"]}
	enemy.statuses["stoneguard"] = {"duration_turns": 1, "tags": ["buff"]}
	var boss: BattleUnit = BattleTestHelpers.make_unit("boss", "enemy", 1, 1000, 50, 50, 100, "Stone", "rear")
	boss.is_boss = true
	var state: BattleState = BattleState.make(_units([actor, ally, enemy, boss]))
	state.actor = actor
	state.boss = boss
	state.event = {"source": actor, "target": enemy}
	state.previous_operation_targets = _units([enemy])
	state.previous_successful_heal_targets = _units([ally])
	state.last_target = enemy
	for selector_id: String in interpreter.selector_rules:
		interpreter.error = ""
		interpreter.resolve_selector(selector_id, state)
		assert_eq(interpreter.error, "", "selector " + selector_id)


func test_gust_status_adds_gauge_debt_capped_by_action_queue_rule() -> void:
	var interpreter: EffectInterpreter = BattleTestHelpers.interpreter(_registry)
	var actor: BattleUnit = BattleTestHelpers.make_unit("caster", "player", 0)
	var target: BattleUnit = BattleTestHelpers.make_unit("target", "enemy", 0)
	var state: BattleState = BattleTestHelpers.state_of(_units([actor, target]), actor)
	interpreter.execute_effect_ops([{
		"op": "apply_status", "target_selector_id": "single_enemy_default", "status_id": "gust", "duration_turns": 1,
	}], state, actor)
	assert_eq(state.fault, "")
	assert_true(target.pending_delay_gauge.equals(Frac.of(1500)))
	assert_true(target.has_status("gust"))


func test_taunt_on_actor_forces_single_target_to_status_source() -> void:
	var interpreter: EffectInterpreter = BattleTestHelpers.interpreter(_registry)
	var mahmut: BattleUnit = BattleTestHelpers.make_unit("mahmut", "player", 0)
	var ally: BattleUnit = BattleTestHelpers.make_unit("ally", "player", 1, 1000, 50, 50, 100, "Stone", "rear")
	var taunted: BattleUnit = BattleTestHelpers.make_unit("taunted_enemy", "enemy", 0)
	taunted.statuses["taunt"] = {"duration_turns": 2, "source_id": mahmut.entity_id, "tags": ["buff", "control"]}
	var state: BattleState = BattleTestHelpers.state_of(_units([mahmut, ally, taunted]), taunted)
	var picked: Array[BattleUnit] = interpreter.resolve_selector("single_enemy_default", state)
	assert_eq(BattleUtil.names_of(picked), ["mahmut"])


func test_conditions_support_all_any_not_and_unknown_predicates_fail() -> void:
	var interpreter: EffectInterpreter = BattleTestHelpers.interpreter(_registry)
	var actor: BattleUnit = BattleTestHelpers.make_unit("actor", "player", 0)
	actor.statuses["taunt"] = {"duration_turns": 1, "tags": ["buff", "control"]}
	var enemy: BattleUnit = BattleTestHelpers.make_unit("enemy", "enemy", 0)
	var state: BattleState = BattleTestHelpers.state_of(_units([actor, enemy]), actor)
	state.round_number = 1
	var condition: Dictionary = {"all": [
		{"predicate": "owner_has_status", "value": "taunt"},
		{"any": [{"predicate": "round_number_at_most", "value": 1}, {"not": {"predicate": "owner_hp_below_pct", "value": 1}}]},
	]}
	assert_true(interpreter.evaluate_condition(condition, state))
	interpreter.error = ""
	interpreter.validate_effect_ops([{"op": "gain_focus", "target_selector_id": "self", "amount": 10, "when": {"predicate": "invented_predicate"}}])
	assert_true(interpreter.error.contains("unknown predicate"), interpreter.error)
	interpreter.error = ""
	interpreter.validate_effect_ops([{"op": "gain_focus", "target_selector_id": "self", "amount": 10, "silent_fallback": true}])
	assert_true(interpreter.error.contains("unknown fields"), interpreter.error)


func test_redirect_operation_selects_another_ally_and_splits_single_target_hit() -> void:
	var interpreter: EffectInterpreter = BattleTestHelpers.interpreter(_registry, 3)
	var mahmut: BattleUnit = BattleTestHelpers.make_unit("mahmut", "player", 0, 1000, 50, 95)
	var protected: BattleUnit = BattleTestHelpers.make_unit("protected", "player", 1, 400, 50, 50)
	var rear_ally: BattleUnit = BattleTestHelpers.make_unit("rear_ally", "player", 2, 600, 50, 40, 100, "Stone", "rear")
	var enemy: BattleUnit = BattleTestHelpers.make_unit("enemy_attacker", "enemy", 0, 1000, 100, 50)
	var state: BattleState = BattleTestHelpers.state_of(_units([mahmut, protected, rear_ally, enemy]), mahmut)

	interpreter.execute_effect_ops([{
		"op": "grant_redirect", "target_selector_id": "self", "protected_ally_selector_id": "lowest_hp_ally",
		"redirected_fraction": 0.5, "duration_turns": 2, "eligible_action_types": ["basic"],
	}], state, mahmut)
	assert_eq(mahmut.redirects[0]["protected_ids"], ["protected"])

	state.actor = enemy
	var results: Array[EffectInterpreter.OperationResult] = interpreter.execute_effect_ops([{
		"op": "damage", "target_selector_id": "single_enemy", "damage_type": "physical", "scale_stat": "atk", "multiplier": 1.0,
	}], state, enemy, "basic", {"single_enemy": "protected"})
	var pairs: Array = []
	for hit: Dictionary in results[0].damage:
		pairs.append([hit["recipient_id"], hit["damage"]])
	assert_eq(pairs, [["protected", 8], ["mahmut", 4]])
	assert_eq([protected.hp, mahmut.hp], [392, 996])


func test_soul_link_shares_resolved_hp_damage_with_its_living_source() -> void:
	var interpreter: EffectInterpreter = BattleTestHelpers.interpreter(_registry, 11)
	var attacker: BattleUnit = BattleTestHelpers.make_unit("attacker", "player", 0, 1000, 100)
	var linked: BattleUnit = BattleTestHelpers.make_unit("linked", "enemy", 0, 1000, 50, 50)
	var source: BattleUnit = BattleTestHelpers.make_unit("chain_cultist", "enemy", 1, 1000, 50, 50, 100, "Stone", "front")
	linked.statuses["soul_link"] = {"duration_turns": 2, "source_id": source.entity_id, "shared_damage_fraction": 0.25, "tags": ["buff"]}
	var state: BattleState = BattleTestHelpers.state_of(_units([attacker, linked, source]), attacker)

	var result: Array[EffectInterpreter.OperationResult] = interpreter.execute_effect_ops([{
		"op": "damage", "target_selector_id": "single_enemy_default", "damage_type": "physical", "scale_stat": "atk", "multiplier": 1.0,
	}], state, attacker)

	assert_eq(result[0].damage[0]["damage"], 16)
	assert_eq(result[0].damage[0]["shared_damage"], 4)
	assert_eq([linked.hp, source.hp], [988, 996])


func test_action_gauge_uses_fraction_overflow_and_capped_delay() -> void:
	var rules: GaugeRules = _registry_gauge_rules()
	var player: BattleUnit = BattleTestHelpers.make_unit("player_fast", "player", 0, 1000, 50, 50, 101)
	var enemy: BattleUnit = BattleTestHelpers.make_unit("enemy_fast", "enemy", 0, 1000, 50, 50, 101)
	var speedless: BattleUnit = BattleTestHelpers.make_unit("speedless", "player", 2, 1000, 50, 50, 0, "Stone", "rear")
	assert_eq(ActionGauge.effective_speed(speedless), 1)
	assert_eq(ActionGauge.next_actor([enemy, player], rules), player, "equal ready overflow -> player team")
	player.gauge = Frac.of(0)
	enemy.gauge = Frac.of(0)
	var first: BattleUnit = ActionGauge.next_actor([player, enemy], rules)
	assert_eq(first, player)
	player.gauge = Frac.of(GaugeRules.GAUGE_MAX + 1500)
	ActionGauge.delay_next_action(player, Frac.of(15, 100), rules)
	assert_eq(player.pending_delay_gauge.num, 1500)
	assert_true(ActionGauge.spend_action(player, rules))
	assert_true(player.gauge.is_zero())
	assert_true(player.pending_delay_gauge.is_zero())
	ActionGauge.delay_next_action(player, Frac.of(40, 100), rules)
	assert_true(ActionGauge.delay_next_action(player, Frac.of(30, 100), rules).equals(Frac.of(5000)), "capped at half a gauge")


func _registry_gauge_rules() -> GaugeRules:
	return GaugeRules.from_mapping(_registry.battle_rules["turn_queue"])


class FinisherState extends BattleState:
	var action_trace: Array = []

	func resolve_action(turn_actor: BattleUnit, action: Variant, random_stream: CpythonRandom) -> void:
		action_trace.append([turn_actor.entity_id, action, random_stream.random()])
		var target: BattleUnit = living_units(opposing_team(turn_actor))[0]
		target.hp = 0
		target.alive = false


func test_run_battle_uses_seeded_random_stream_and_resolves_action_callback() -> void:
	var player: BattleUnit = BattleTestHelpers.make_unit("player", "player", 0)
	var enemy: BattleUnit = BattleTestHelpers.make_unit("enemy", "enemy", 0)
	var state: FinisherState = FinisherState.new()
	state.units = _units([player, enemy])

	ActionGauge.run_battle(state, func(_battle: BattleState, _actor: BattleUnit) -> String: return "finish", 77)

	assert_eq(state.fault, "")
	assert_eq(state.action_trace.size(), 1)
	assert_eq(state.action_trace[0][0], "player")
	assert_eq(state.action_trace[0][1], "finish")
	assert_eq(state.action_trace[0][2], CpythonRandom.create_from_int(77).random())
	assert_true(state.is_battle_over())


class EffectState extends BattleState:
	var interpreter: EffectInterpreter = null

	func resolve_action(turn_actor: BattleUnit, _action: Variant, _random_stream: CpythonRandom) -> void:
		interpreter.execute_effect_ops([{
			"op": "apply_status", "target_selector_id": "self", "status_id": "stoneguard", "duration_turns": 1, "chance": 0.5,
		}], self, turn_actor)
		var target: BattleUnit = living_units(opposing_team(turn_actor))[0]
		target.hp = 0
		target.alive = false


func test_run_battle_seed_is_shared_with_effect_chance_rolls() -> void:
	var player: BattleUnit = BattleTestHelpers.make_unit("player", "player", 0)
	var enemy: BattleUnit = BattleTestHelpers.make_unit("enemy", "enemy", 0)
	var state: EffectState = EffectState.new()
	state.interpreter = BattleTestHelpers.interpreter(_registry, 999)
	state.units = _units([player, enemy])
	ActionGauge.run_battle(state, func(_battle: BattleState, _actor: BattleUnit) -> String: return "skill", 1)
	assert_eq(state.fault, "")
	assert_true(player.has_status("stoneguard"), "the first Random(1) roll is below 0.5")


func _timing_unit(entity_id: String, team: String, speed: int = 1) -> BattleUnit:
	return BattleUnit.build({"entity_id": entity_id, "team": team, "slot_index": 0, "stats": {"hp": 10, "atk": 1, "def": 0, "spd": speed}})


func test_status_duration_expires_at_owner_turn_start_and_dot_gets_final_tick() -> void:
	var actor: BattleUnit = _timing_unit("hero", "player")
	actor.statuses["burn"] = {"duration_turns": 2, "tick_damage": 1, "ticks_at_owner_turn_start": true, "source_id": "enemy"}
	var state: BattleState = BattleState.make(_units([actor]))

	state.start_turn(actor)
	assert_eq(actor.statuses["burn"]["duration_turns"], 1)
	assert_eq(actor.hp, 9)
	state.end_turn(actor)

	state.start_turn(actor)
	assert_false(actor.statuses.has("burn"))
	assert_eq(actor.hp, 8)
	var hp_values: Array = []
	for event: Dictionary in state.battle_events:
		if event.get("type") == "damage_dealt" and event.get("status_id") == "burn":
			hp_values.append(event["hp"])
	assert_eq(hp_values, [9, 8])


class OneOpportunityState extends BattleState:
	func is_battle_over() -> bool:
		return actor != null

	func resolve_action(_turn_actor: BattleUnit, _action: Variant, _random_stream: CpythonRandom) -> void:
		report_fault("the broken hero must not execute an action")


func test_one_turn_break_expiring_at_start_still_interrupts_that_action() -> void:
	var hero: BattleUnit = _timing_unit("hero", "player", 2)
	hero.statuses["break"] = {"duration_turns": 1, "tags": ["control", "break"]}
	var enemy: BattleUnit = _timing_unit("enemy", "enemy")
	var state: OneOpportunityState = OneOpportunityState.new()
	state.units = _units([hero, enemy])
	var asked: Array = []
	ActionGauge.run_battle(state, func(_battle: BattleState, _actor: BattleUnit) -> String:
		asked.append(true)
		return "unexpected", 42)
	assert_eq(state.fault, "")
	assert_eq(asked.size(), 0, "the broken hero must not request an Auto action")
	assert_true(hero.has_acted)
	assert_false(hero.statuses.has("break"))


func test_battle_state_event_subscription_is_removable_and_not_added_to_replay_log() -> void:
	var state: BattleState = BattleState.make(_units([BattleUnit.build({"entity_id": "hero", "team": "player", "slot_index": 0, "stats": {"hp": 100}})]))
	var received: Array = []
	var listener: Callable = func(event: Dictionary) -> void: received.append(event)
	state.event_emitted.connect(listener)

	state.emit_event({"type": "damage_dealt", "target_id": "hero", "hp": 75})
	state.event_emitted.disconnect(listener)
	assert_false(state.event_emitted.is_connected(listener), "removal is idempotent: a second check is safe")
	state.emit_event({"type": "status_applied", "target_id": "hero", "status_id": "burn"})

	assert_eq(received, [{"type": "damage_dealt", "target_id": "hero", "hp": 75}])
	assert_eq(state.log.size(), 0)


func test_interpreter_publishes_damage_and_status_events_for_client_subscribers() -> void:
	var skill: ContentModels.Skill = _registry.skills["mahmut_ultimate_last_wall_at_dusk"]
	var mahmut: BattleUnit = BattleUnit.build({"entity_id": "mahmut", "team": "player", "slot_index": 0, "element": "Stone",
		"stats": {"hp": 1000, "atk": 99, "def": 95, "spd": 100, "crit_rate": 0.0}})
	var enemies: Array[BattleUnit] = []
	for index: int in range(3):
		enemies.append(BattleUnit.build({"entity_id": "enemy_%d" % index, "team": "enemy", "slot_index": index, "element": "Tide",
			"row": "front" if index < 2 else "rear", "stats": {"hp": 500, "atk": 50, "def": 50, "spd": 80}}))
	var all_units: Array[BattleUnit] = [mahmut]
	all_units.append_array(enemies)
	var state: BattleState = BattleState.make(all_units)
	var received: Array = []
	state.event_emitted.connect(func(event: Dictionary) -> void: received.append(event))

	BattleTestHelpers.interpreter(_registry, 20260927).execute_skill(skill, state, mahmut, "ultimate")

	var damage_events: int = 0
	var status_events: int = 0
	var status_targets: Dictionary = {}
	for event: Dictionary in received:
		assert_true(event.has("hp") and event.has("max_hp"), "every event carries hp and max_hp: " + str(event.get("type")))
		if event["type"] == "damage_dealt":
			damage_events += 1
		if event["type"] == "status_applied":
			status_events += 1
			status_targets[event["target_id"]] = true
	assert_eq(damage_events, 2)
	assert_eq(status_events, 3)
	assert_eq(status_targets.keys().size(), 3)
	for enemy: BattleUnit in enemies:
		assert_true(status_targets.has(enemy.entity_id))
