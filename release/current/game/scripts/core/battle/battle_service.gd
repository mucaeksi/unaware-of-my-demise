class_name BattleService
extends RefCounted
## Constructs and runs a Part I stage from its authored content contracts (port of core/battle/service.py): roster and
## loadout resolution (levels, gear, story loans, Memory Nodes, skill ranks), wave spawning and the Auto battle loop.
##
## Failures the reference raises as exceptions (unknown stage, an invalid roster or loadout, a battle fault) are returned
## in `BattleResult.error`; a failed run has no meaningful outcome.

const _MAX_ACTIONS_DEFAULT: int = 10000


## The outcome of one run: result, stars, counts, final units and the state that holds the full event log.
class BattleResult extends RefCounted:
	var stage_id: String = ""
	var outcome: String = ""
	var stars: int = 0
	var run_seed: int = 0
	var actions: int = 0
	var cycles: int = 0
	var final_units: Array[Dictionary] = []
	## The units on the field before the first event (heroes and wave-0 enemies): what a replay of the event log starts from.
	var initial_units: Array[Dictionary] = []
	var state: EncounterState = null
	## Non-empty when the run could not be set up or faulted.
	var error: String = ""
	var combat_mode: String = ""
	var manual_commands: Array[Dictionary] = []


var registry: ContentModels.ContentRegistry = null
var interpreter: EffectInterpreter = null
var rules: Dictionary = {}
var victory_stars: VictoryStarRules = null
var statuses: Dictionary = {}
var accessory_roller: AccessoryRoller = null
var story: StoryState = null
var progression: Progression = null
var equipment_rules: Equipment = null

## Construction problem ("" = ready) or the last rejected call.
var error: String = ""


static func create(content_registry: ContentModels.ContentRegistry, story_state_service: StoryState) -> BattleService:
	var service: BattleService = BattleService.new()
	service.registry = content_registry
	service.story = story_state_service
	service.interpreter = EffectInterpreter.create(content_registry)
	if not service.interpreter.error.is_empty():
		service.error = service.interpreter.error
		return service
	service.rules = content_registry.battle_rules
	service.victory_stars = VictoryStarRules.from_mapping(service.rules.get("victory_stars", {}))
	if not service.victory_stars.error.is_empty():
		service.error = service.victory_stars.error
		return service
	service.statuses = service.interpreter.status_definitions
	service.accessory_roller = AccessoryRoller.new(content_registry.accessories)
	service.progression = Progression.create(content_registry)
	service.equipment_rules = Equipment.new(content_registry)
	return service


## Runs one stage. `options` (all optional): player_levels {id: level}, story_state (PlayerStoryState), automatic,
## action_provider (AutoBattleProvider), run_seed (int), equipment {id: loadout}, skill_ranks {id: {skill: rank}},
## memory_nodes {id: unlocked}, max_actions, on_encounter_ready (Callable(state)).
func run(stage_id: String, roster: Array = [], options: Dictionary = {}) -> BattleResult:
	error = ""
	# Every run starts the shared interpreter stream afresh: anything drawn before `run_battle` seeds the state (battle_start
	# hooks) must not depend on earlier runs, so the server's re-run of an attempt (DEC-0013) matches this one.
	interpreter.rng = CpythonRandom.new()
	var result: BattleResult = BattleResult.new()
	result.stage_id = stage_id
	if not registry.stages.has(stage_id):
		result.error = "Unknown stage_id %s" % ContentLoader.py_repr(stage_id)
		return result
	var stage: ContentModels.Stage = registry.stages[stage_id]
	var selected: Array = roster.duplicate() if not roster.is_empty() else ["mahmut", "fadyme"]
	var story_state: StoryState.PlayerStoryState = options.get("story_state")
	if story_state == null:
		story_state = story.new_player_state()
		story_state.owned_character_ids = {}
		for character_id: Variant in selected:
			story_state.owned_character_ids[String(character_id)] = true
		story_state.owned_character_ids["mahmut"] = true
		story_state.owned_character_ids["fadyme"] = true
	var slots: Array[StoryState.BattleSlot] = story.resolve_battle_roster(story_state, stage, selected)
	if not story.error.is_empty():
		result.error = story.error
		return result
	var made: Array = _make_players(slots, options.get("player_levels", {}), options.get("equipment", {}), stage_id, options.get("skill_ranks", {}), options.get("memory_nodes", {}))
	if not error.is_empty():
		result.error = error
		return result
	var players: Array[BattleUnit] = made[0]
	var state: EncounterState = EncounterState.create(players, self, stage, made[1])
	var automatic: bool = bool(options.get("automatic", true))
	state.automatic = automatic
	var provider: AutoBattleProvider = options.get("action_provider")
	if provider == null:
		if not automatic:
			result.error = "manual battle requires an action_provider"
			return result
		provider = AutoBattleProvider.from_rules(rules)
	spawn_wave(state, 0)
	state.next_wave_index = 1
	if state.boss != null:
		state.load_boss_phase(0, false)
	for unit: BattleUnit in state.units:
		result.initial_units.append({
			"entity_id": unit.entity_id, "team": unit.team, "row": unit.row, "slot_index": unit.slot_index, "level": unit.level,
			"hp": unit.hp, "max_hp": unit.max_hp, "is_boss": unit.is_boss, "is_objective": unit.is_objective,
			"enemy_id": unit.enemy_id, "objective_id": unit.objective_id, "temporary": unit.temporary,
			"focus": unit.focus,
		})
	var on_ready: Variant = options.get("on_encounter_ready")
	if on_ready is Callable:
		# Called synchronously after the initial roster/wave-0 units exist but strictly before any event is emitted, so a
		# subscriber attached here observes every event of this run.
		(on_ready as Callable).call(state)
	state.dispatch_battle_event("battle_start", {
		"actor": null, "source": null, "target": state.boss,
		"action_type": "battle_start", "source_action_type": "battle_start",
	}, interpreter)
	state.refresh_stat_auras()
	var run_seed: int = int(options.get("run_seed", 0))
	result.state = state
	result.run_seed = run_seed
	result.combat_mode = str(options.get("combat_mode", ""))
	if bool(options.get("deferred", false)):
		return result
	ActionGauge.run_battle(state, provider, run_seed, int(options.get("max_actions", _MAX_ACTIONS_DEFAULT)), interpreter.gauge_rules)
	return finalize_result(result)

## Shared finalization for a legacy run and an input-driven live encounter.
func finalize_result(result: BattleResult) -> BattleResult:
	var state: EncounterState = result.state
	var stage: ContentModels.Stage = state.stage
	state.reset_defeated_focus()
	if not state.fault.is_empty():
		result.error = state.fault
		return result
	var outcome: String = "victory" if not state.living_units("player").is_empty() else "defeat"
	var stars: int = victory_stars.stars(outcome, state.units)
	if stars < 0:
		result.error = "No victory_stars tier matches the number of fallen heroes"
		return result
	for unit: BattleUnit in state.units:
		result.final_units.append({
			"entity_id": unit.entity_id, "team": unit.team, "hp": unit.hp, "max_hp": unit.max_hp,
			"alive": unit.alive, "level": unit.level, "temporary": unit.temporary, "focus": unit.focus,
			"statuses": BattleUtil.sorted_keys(unit.statuses),
		})
	state.record_event({"type": "battle_reward_ready", "stage_id": stage.stage_id, "outcome": outcome, "stars": stars, "drop_table_id": stage.drop_table_id})
	var actions: int = 0
	for event: Dictionary in state.battle_events:
		if event.get("type") == "action_started":
			actions += 1
	result.outcome = outcome
	result.stars = stars
	result.actions = actions
	result.cycles = maxi(0, state.round_number - 1)
	return result


func _make_players(slots: Array[StoryState.BattleSlot], levels: Dictionary, equipment: Dictionary, stage_id: String, skill_ranks: Dictionary, memory_nodes: Dictionary) -> Array:
	var units: Array[BattleUnit] = []
	var records: Dictionary = {}
	for slot: StoryState.BattleSlot in slots:
		var character: ContentModels.Character = registry.characters[slot.character_id]
		var level: int = int(slot.level) if slot.temporary and slot.level != null else int(levels.get(slot.character_id, 1))
		var stats: Dictionary = progression.base_stat_at_level(character.base_stats_level_1, character.growth_per_level, level)
		if not progression.error.is_empty():
			error = progression.error
			return [units, records]
		var loadout: Variant = equipment.get(slot.character_id)
		if slot.temporary and loadout == null:
			loadout = story_loan_loadout(character, stage_id)
			if not error.is_empty():
				return [units, records]
		if loadout != null:
			stats = resolve_equipment(character, stats, loadout)
			if not error.is_empty():
				return [units, records]
		# Ranks and Memory Nodes belong to the player's own copy only: a temporary story loan never carries them.
		var own: bool = not slot.temporary
		var start_focus: int = 0
		if own and int(memory_nodes.get(slot.character_id, 0)) > 0:
			var applied: Array = apply_memory_nodes(stats, int(memory_nodes[slot.character_id]))
			stats = applied[0]
			start_focus = applied[1]
			if not error.is_empty():
				return [units, records]
		var unit: BattleUnit = BattleUnit.build({
			"entity_id": character.character_id, "team": "player", "slot_index": slot.slot_index, "row": slot.position,
			"stats": stats, "element": character.element, "tags": [character.class_id, character.combat_role],
			"level": level, "temporary": slot.temporary,
			"stat_resolution_rules": rules["stat_resolution"], "status_definitions": statuses,
		})
		for skill: ContentModels.Skill in character.skills:
			unit.cooldowns[skill.skill_id] = 0
		if own:
			var ranks: Dictionary = skill_ranks.get(slot.character_id, {})
			for skill_id: String in ranks:
				unit.skill_ranks[skill_id] = int(ranks[skill_id])
		unit.focus = start_focus
		units.append(unit)
		records[unit.entity_id] = character
	if units.size() != 2 and units.size() != 5:
		error = "Party must use the 1-1 two-hero exception or five heroes"
		return [units, records]
	if units.size() == 5:
		var front: int = 0
		var rear: int = 0
		for unit: BattleUnit in units:
			if unit.row == "front":
				front += 1
			if unit.row == "rear":
				rear += 1
		if front != 2 or rear != 3:
			error = "A five-hero party must use 2 Front and 3 Rear slots"
	return [units, records]


## Applies the unlocked Memory Nodes (battle_rules.memory_nodes) to final stats: [stats, start_focus].
func apply_memory_nodes(stats: Dictionary, unlocked: int) -> Array:
	var percent: Dictionary = {}
	var start_focus: int = 0
	var nodes: Array[Progression.MemoryNode] = progression.memory_nodes()
	for index: int in range(mini(unlocked, nodes.size())):
		var node: Progression.MemoryNode = nodes[index]
		# Only stats the character actually has: apply_equipment would otherwise add e.g. "res": 0 and switch damage
		# off its missing-res fallback for characters without a RES stat.
		if node.effect_type == "stat_pct" and not node.stat.is_empty() and stats.has(node.stat):
			percent[node.stat] = (percent.get(node.stat, Dec.from_int(0)) as Dec).add(node.value)
		elif node.effect_type == "start_focus":
			start_focus += node.value.to_int_truncated()
	if percent.is_empty():
		return [stats.duplicate(), start_focus]
	var boosted_item: Progression.EquippedItem = Progression.EquippedItem.new()
	boosted_item.percent_stats = percent
	var boosted: Dictionary = progression.apply_equipment(stats.duplicate(), boosted_item, Progression.EquippedItem.new(), [] as Array[Progression.EquippedItem])
	if not progression.error.is_empty():
		error = progression.error
	return [boosted, start_focus]


## The authored deterministic 3-star field kit for a temporary guest.
func story_loan_loadout(character: ContentModels.Character, stage_id: String) -> Dictionary:
	var loan_rules: Dictionary = rules.get("story_loan_equipment", {})
	var rarity: int = int(loan_rules.get("rarity", 3))
	var weapon: ContentModels.Weapon = null
	for item: ContentModels.Weapon in registry.weapons.values():
		if item.rarity == rarity and item.weapon_type == character.equip_weapon_type:
			if weapon == null or item.weapon_id < weapon.weapon_id:
				weapon = item
	var armor_id: String = str(loan_rules.get("armor_id", ""))
	var set_id: String = str(loan_rules.get("accessory_set_id", ""))
	var necklace: ContentModels.AccessoryTemplate = null
	var ring: ContentModels.AccessoryTemplate = null
	for item: ContentModels.AccessoryTemplate in registry.accessories.values():
		if item.rarity != rarity or item.set_id != set_id:
			continue
		if item.slot == "necklace" and (necklace == null or item.accessory_id < necklace.accessory_id):
			necklace = item
		elif item.slot == "ring" and (ring == null or item.accessory_id < ring.accessory_id):
			ring = item
	if weapon == null or not registry.armors.has(armor_id) or necklace == null or ring == null:
		error = "Invalid story-loan equipment recipe for %s" % character.character_id
		return {}
	var rolled: Array[Dictionary] = []
	for template: ContentModels.AccessoryTemplate in [necklace, ring]:
		var seed_value: int = Crc32.of_text("%s:%s:%s" % [character.character_id, stage_id, template.accessory_id])
		rolled.append(accessory_roller.roll_drop_seeded(template.accessory_id, seed_value))
	return {
		"weapon_id": weapon.weapon_id,
		"armor_id": armor_id,
		"accessory_ids": [necklace.accessory_id, ring.accessory_id],
		"rolled_accessories": rolled,
	}


## Applies a (possibly partial) loadout to `base` stats. Keys: weapon_id (absent = the signature weapon, explicit null =
## none), weapon_level, armor_id (absent/null = none), armor_level, accessory_ids (0-2, one per slot), rolled_accessories
## (payloads parallel to accessory_ids; a length mismatch means "no rolled stats"). Levels default to 1.
func resolve_equipment(character: ContentModels.Character, base: Dictionary, loadout: Dictionary) -> Dictionary:
	var weapon_id: Variant = loadout.get("weapon_id", character.signature_weapon_id)
	var weapon: ContentModels.Weapon = null
	if weapon_id != null:
		if not registry.weapons.has(str(weapon_id)):
			error = "Unknown weapon %s" % ContentLoader.py_repr(weapon_id)
			return {}
		weapon = registry.weapons[str(weapon_id)]
	if weapon != null and not equipment_rules.can_equip_weapon(character, weapon):
		error = "%s cannot equip %s" % [character.character_id, weapon.weapon_id]
		return {}
	var armor_id: Variant = loadout.get("armor_id")
	var armor: ContentModels.Armor = null
	if armor_id != null:
		if not registry.armors.has(str(armor_id)):
			error = "Unknown armor %s" % ContentLoader.py_repr(armor_id)
			return {}
		armor = registry.armors[str(armor_id)]
	if armor != null and armor.slot != "armor":
		error = "Invalid loadout: the armor item must occupy the 'armor' slot"
		return {}
	var accessory_ids: Array = loadout.get("accessory_ids", [])
	if accessory_ids.size() > 2:
		error = "Loadout allows at most one necklace and one ring"
		return {}
	var accessories: Array[ContentModels.AccessoryTemplate] = []
	for item_id: Variant in accessory_ids:
		if not registry.accessories.has(str(item_id)):
			error = "Unknown accessory %s" % ContentLoader.py_repr(item_id)
			return {}
		accessories.append(registry.accessories[str(item_id)])
	var slot_names: Array[String] = []
	var distinct: bool = true
	for item: ContentModels.AccessoryTemplate in accessories:
		if item.slot != "necklace" and item.slot != "ring":
			distinct = false
		if slot_names.has(item.slot):
			distinct = false
		slot_names.append(item.slot)
	if not distinct:
		error = "Loadout accessory slots must be at most one necklace and one ring"
		return {}
	var necklace: ContentModels.AccessoryTemplate = null
	var ring: ContentModels.AccessoryTemplate = null
	for item: ContentModels.AccessoryTemplate in accessories:
		if item.slot == "necklace" and necklace == null:
			necklace = item
		elif item.slot == "ring" and ring == null:
			ring = item
	if weapon != null and armor != null and necklace != null and ring != null:
		var problems: Array[String] = equipment_rules.validate_loadout(character, weapon, armor, necklace, ring)
		if not problems.is_empty():
			error = "Invalid loadout: " + "; ".join(problems)
			return {}
	var rolls: Array = loadout.get("rolled_accessories", []).duplicate()
	if rolls.size() != accessories.size():
		rolls = []
		for _item: ContentModels.AccessoryTemplate in accessories:
			rolls.append({"main_stat": null, "sub_stats": []})
	var weapon_item: Progression.EquippedItem = Progression.EquippedItem.new()
	if weapon != null:
		weapon_item = progression.equipped_item_from_content({
			"base_stats_level_1": weapon.base_stats_level_1, "growth_per_level": weapon.growth_per_level,
		}, int(loadout.get("weapon_level", 1)))
	var armor_item: Progression.EquippedItem = Progression.EquippedItem.new()
	if armor != null:
		armor_item = progression.equipped_item_from_content({
			"base_stats_level_1": armor.base_stats_level_1, "growth_per_level": armor.growth_per_level,
		}, int(loadout.get("armor_level", 1)))
	var rolled_items: Array[Progression.EquippedItem] = []
	for row: Dictionary in rolls:
		rolled_items.append(progression.equipped_item_from_content(row))
	if not progression.error.is_empty():
		error = progression.error
		return {}
	var gear: Dictionary = progression.apply_equipment(base.duplicate(), weapon_item, armor_item, rolled_items)
	if not progression.error.is_empty():
		error = progression.error
		return {}
	if necklace != null and ring != null:
		var bonus: Equipment.StatModifier = equipment_rules.resolve_set_bonus(necklace, ring)
		if bonus != null:
			var bonus_item: Progression.EquippedItem = Progression.EquippedItem.new()
			bonus_item.percent_stats = {bonus.stat_id: bonus.value_pct}
			gear = progression.apply_equipment(gear.duplicate(), bonus_item, Progression.EquippedItem.new(), [] as Array[Progression.EquippedItem])
			if not progression.error.is_empty():
				error = progression.error
				return {}
	return gear


func spawn_wave(state: EncounterState, wave_index: int) -> void:
	if wave_index >= state.stage.enemy_waves.size():
		return
	state.wave_index = wave_index
	for entry: ContentModels.EnemyWaveEntry in state.stage.enemy_waves[wave_index]:
		var enemy: ContentModels.Enemy = registry.enemies[entry.enemy_id]
		for index: int in range(entry.count):
			var serial: int = 0
			for unit: BattleUnit in state.units:
				if unit.enemy_id == enemy.enemy_id:
					serial += 1
			var entity_id: String = "%s:%d:%s:%d" % [state.stage.stage_id, wave_index, enemy.enemy_id, serial + index]
			var stats: Dictionary = progression.enemy_stats_at_level(enemy.base_stats_level_1, enemy.growth_per_level, state.stage.enemy_level, state.stage.enemy_stat_multiplier)
			var is_boss: bool = not state.stage.boss_id.is_empty() and enemy.boss_id == state.stage.boss_id
			var immunities: Array[String] = enemy.status_immunities.duplicate()
			if is_boss:
				for item: Variant in (rules.get("targeting", {}) as Dictionary).get("boss_control_immunities_default", []):
					if not immunities.has(String(item)):
						immunities.append(String(item))
			var unit: BattleUnit = BattleUnit.build({
				"entity_id": entity_id, "team": "enemy", "slot_index": state.units.size(),
				"row": "front" if serial % 2 == 0 else "rear", "stats": stats, "element": enemy.element,
				"weaknesses": enemy.weaknesses, "resistances": enemy.resistances, "status_immunities": immunities,
				"faction_id": enemy.faction_id, "tags": [enemy.role], "is_boss": is_boss, "enemy_id": enemy.enemy_id,
				"level": state.stage.enemy_level, "stat_resolution_rules": rules["stat_resolution"], "status_definitions": statuses,
			})
			for skill: ContentModels.Skill in enemy.skills:
				unit.cooldowns[skill.skill_id] = 0
			state.units.append(unit)
			state.records[entity_id] = enemy
			if is_boss:
				if state.boss != null:
					state.report_fault("Stage contains more than one active boss")
					return
				state.boss = unit
	state.refresh_stat_auras()


func summon_factory(enemy_id: String, count: int, state: EncounterState) -> Array[BattleUnit]:
	var enemy: ContentModels.Enemy = registry.enemies[enemy_id]
	var result: Array[BattleUnit] = []
	for _draw: int in range(count):
		state.summon_serial += 1
		var stats: Dictionary = progression.enemy_stats_at_level(enemy.base_stats_level_1, enemy.growth_per_level, state.stage.enemy_level, state.stage.enemy_stat_multiplier)
		var unit: BattleUnit = BattleUnit.build({
			"entity_id": "%s:summon:%s:%d" % [state.stage.stage_id, enemy_id, state.summon_serial],
			"team": "enemy", "slot_index": state.units.size(), "row": "rear", "stats": stats, "element": enemy.element,
			"weaknesses": enemy.weaknesses, "resistances": enemy.resistances, "status_immunities": enemy.status_immunities,
			"faction_id": enemy.faction_id, "tags": [enemy.role], "enemy_id": enemy.enemy_id, "level": state.stage.enemy_level,
			"stat_resolution_rules": rules["stat_resolution"], "status_definitions": statuses,
		})
		for skill: ContentModels.Skill in enemy.skills:
			unit.cooldowns[skill.skill_id] = 0
		state.records[unit.entity_id] = enemy
		result.append(unit)
	return result
