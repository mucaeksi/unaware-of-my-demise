// Constructs and runs a Part I stage from its authored content contracts (port of core/battle/battle_service.gd, LEGACY
// core/battle/service.py): roster and loadout resolution (levels, gear, story loans, Memory Nodes, skill ranks), wave
// spawning and the Auto battle loop.
//
// Failures the reference raises (unknown stage, an invalid roster or loadout, a battle fault) end `run` with
// `BattleResult.error` set, as in the GDScript port; a failed run has no meaningful outcome. The loadout helpers
// (`resolveEquipment`, `storyLoanLoadout`, `applyMemoryNodes`) throw BattleSetupError instead.
import { AccessoryRoller, type AccessoryInstance } from "../accessories";
import { pyRepr, type AccessoryTemplate, type Character, type ContentRegistry, type Weapon } from "../content";
import { crc32Text } from "../crc32";
import { Dec } from "../dec";
import { CpythonRandom } from "../random";
import { Equipment } from "../equipment";
import { emptyEquipped, Progression, type EquippedItem } from "../progression";
import type { BattleSlot, PlayerStoryState, StoryRules } from "../story";
import { AutoBattleProvider } from "./auto";
import { EncounterState, type UnitRecord } from "./encounter";
import { BattleSetupError } from "./errors";
import { runBattle, type ActionProvider } from "./gauge";
import { EffectInterpreter } from "./interpreter";
import { VictoryStarRules } from "./rules";
import { BattleUnit } from "./unit";
import { dget, dgetArray, dgetDict, sortedKeys, toInt, type Dict } from "./util";

const MAX_ACTIONS_DEFAULT = 10000;

/** A (possibly partial) equipment loadout; see `resolveEquipment`. */
export type Loadout = Dict;

export interface RunOptions {
  player_levels?: Record<string, number>;
  story_state?: PlayerStoryState | null;
  automatic?: boolean;
  action_provider?: ActionProvider<EncounterState> | null;
  run_seed?: bigint | number;
  equipment?: Record<string, Loadout | null>;
  skill_ranks?: Record<string, Record<string, number>>;
  memory_nodes?: Record<string, number>;
  max_actions?: number;
  /** Called after the initial roster/wave-0 units exist and strictly before any event is emitted. */
  on_encounter_ready?: (state: EncounterState) => void;
}

/** The outcome of one run: result, stars, counts, final units and the state that holds the full event log. */
export class BattleResult {
  stage_id = "";
  outcome = "";
  stars = 0;
  run_seed: bigint | number = 0;
  actions = 0;
  cycles = 0;
  final_units: Dict[] = [];
  /** The units on the field before the first event (heroes and wave-0 enemies): what a replay starts from. */
  initial_units: Dict[] = [];
  state: EncounterState | null = null;
  /** Non-empty when the run could not be set up or faulted. */
  error = "";
}

export interface StoryLoanLoadout {
  weapon_id: string;
  armor_id: string;
  accessory_ids: string[];
  rolled_accessories: AccessoryInstance[];
}

export class BattleService {
  registry!: ContentRegistry;
  interpreter!: EffectInterpreter;
  rules: Dict = {};
  victory_stars!: VictoryStarRules;
  statuses: Dict = {};
  accessory_roller!: AccessoryRoller;
  story!: StoryRules;
  progression!: Progression;
  equipment_rules!: Equipment;

  /** Throws BattleSetupError where the GDScript port sets `error` (invalid effect contract or victory star rules). */
  static create(registry: ContentRegistry, story: StoryRules): BattleService {
    const service = new BattleService();
    service.registry = registry;
    service.story = story;
    service.interpreter = EffectInterpreter.create(registry);
    service.rules = registry.battle_rules as Dict;
    service.victory_stars = VictoryStarRules.fromMapping(dgetDict(service.rules, "victory_stars"));
    service.statuses = service.interpreter.status_definitions;
    service.accessory_roller = new AccessoryRoller(registry.accessories);
    service.progression = Progression.create(registry);
    service.equipment_rules = new Equipment(registry);
    return service;
  }

  /** Runs one stage. Every option is optional; see RunOptions. */
  run(stageId: string, roster: readonly unknown[] = [], options: RunOptions = {}): BattleResult {
    const result = new BattleResult();
    result.stage_id = stageId;
    try {
      this.runInto(result, stageId, roster, options);
    } catch (error) {
      if (result.error.length === 0) result.error = error instanceof Error ? error.message : String(error);
    }
    return result;
  }

  private runInto(result: BattleResult, stageId: string, roster: readonly unknown[], options: RunOptions): void {
    // Every run starts the shared interpreter stream afresh: anything drawn before `runBattle` seeds the state (battle_start
    // hooks) must not depend on earlier runs, so a re-run of an attempt matches the client's run (DEC-0013).
    this.interpreter.rng = new CpythonRandom();
    const stage = this.registry.stages.get(stageId);
    if (stage === undefined) {
      result.error = `Unknown stage_id ${pyRepr(stageId)}`;
      return;
    }
    const selected: unknown[] = roster.length > 0 ? [...roster] : ["mahmut", "fadyme"];
    let storyState = options.story_state ?? null;
    if (storyState === null) {
      storyState = this.story.newPlayerState();
      storyState.owned_character_ids = new Set([...selected.map(String), "mahmut", "fadyme"]);
    }
    const slots = this.story.resolveBattleRoster(storyState, stage, selected);
    const [players, records] = this.makePlayers(
      slots, options.player_levels ?? {}, options.equipment ?? {}, stageId, options.skill_ranks ?? {}, options.memory_nodes ?? {},
    );
    const state = EncounterState.create(players, this, stage, records);
    const automatic = options.automatic ?? true;
    state.automatic = automatic;
    let provider = options.action_provider ?? null;
    if (provider === null) {
      if (!automatic) {
        result.error = "manual battle requires an action_provider";
        return;
      }
      provider = AutoBattleProvider.fromRules(this.rules);
    }
    this.spawnWave(state, 0);
    state.next_wave_index = 1;
    if (state.boss !== null) state.loadBossPhase(0, false);
    for (const unit of state.units) {
      result.initial_units.push({
        entity_id: unit.entity_id, team: unit.team, row: unit.row, slot_index: unit.slot_index, level: unit.level,
        hp: unit.hp, max_hp: unit.max_hp, is_boss: unit.is_boss, is_objective: unit.is_objective,
        enemy_id: unit.enemy_id, objective_id: unit.objective_id, temporary: unit.temporary,
      });
    }
    // Called synchronously after the initial roster/wave-0 units exist but strictly before any event is emitted, so a
    // subscriber attached here observes every event of this run.
    options.on_encounter_ready?.(state);
    state.dispatchBattleEvent("battle_start", {
      actor: null, source: null, target: state.boss,
      action_type: "battle_start", source_action_type: "battle_start",
    }, this.interpreter);
    state.refreshStatAuras();
    const runSeed = options.run_seed ?? 0;
    runBattle(state, provider, runSeed, options.max_actions ?? MAX_ACTIONS_DEFAULT, this.interpreter.gauge_rules);
    state.resetDefeatedFocus();
    result.state = state;
    result.run_seed = runSeed;
    if (state.fault.length > 0) {
      result.error = state.fault;
      return;
    }
    const outcome = state.livingUnits("player").length > 0 ? "victory" : "defeat";
    const stars = this.victory_stars.stars(outcome, state.units);
    if (stars < 0) {
      result.error = "No victory_stars tier matches the number of fallen heroes";
      return;
    }
    for (const unit of state.units) {
      result.final_units.push({
        entity_id: unit.entity_id, team: unit.team, hp: unit.hp, max_hp: unit.max_hp,
        alive: unit.alive, level: unit.level, temporary: unit.temporary, focus: unit.focus,
        statuses: sortedKeys(unit.statuses),
      });
    }
    state.recordEvent({ type: "battle_reward_ready", stage_id: stage.stage_id, outcome, stars, drop_table_id: stage.drop_table_id });
    result.outcome = outcome;
    result.stars = stars;
    result.actions = state.battle_events.filter((event) => dget(event, "type") === "action_started").length;
    result.cycles = Math.max(0, state.round_number - 1);
  }

  private makePlayers(
    slots: readonly BattleSlot[],
    levels: Record<string, number>,
    equipment: Record<string, Loadout | null>,
    stageId: string,
    skillRanks: Record<string, Record<string, number>>,
    memoryNodes: Record<string, number>,
  ): [BattleUnit[], Map<string, UnitRecord>] {
    const units: BattleUnit[] = [];
    const records = new Map<string, UnitRecord>();
    for (const slot of slots) {
      const character = this.registry.characters.get(slot.character_id)!;
      const level = slot.temporary && slot.level !== null ? Math.trunc(slot.level) : toInt(dget(levels, slot.character_id, 1));
      let stats: Dict = this.progression.baseStatAtLevel(character.base_stats_level_1, character.growth_per_level, level);
      let loadout = (dget(equipment, slot.character_id) as Loadout | null) ?? null;
      if (slot.temporary && loadout === null) loadout = this.storyLoanLoadout(character, stageId) as unknown as Loadout;
      if (loadout !== null) stats = this.resolveEquipment(character, stats as Record<string, number>, loadout);
      // Ranks and Memory Nodes belong to the player's own copy only: a temporary story loan never carries them.
      const own = !slot.temporary;
      let startFocus = 0;
      if (own && toInt(dget(memoryNodes, slot.character_id, 0)) > 0) {
        [stats, startFocus] = this.applyMemoryNodes(stats as Record<string, number>, toInt(memoryNodes[slot.character_id]));
      }
      const unit = BattleUnit.build({
        entity_id: character.character_id, team: "player", slot_index: slot.slot_index, row: slot.position,
        stats, element: character.element, tags: [character.class_id, character.combat_role],
        level, temporary: slot.temporary,
        stat_resolution_rules: this.rules.stat_resolution as Dict, status_definitions: this.statuses,
      });
      for (const skill of character.skills) unit.cooldowns.set(skill.skill_id, 0);
      if (own) {
        const ranks = (dget(skillRanks, slot.character_id, {}) ?? {}) as Record<string, number>;
        for (const [skillId, rank] of Object.entries(ranks)) unit.skill_ranks.set(skillId, toInt(rank));
      }
      unit.focus = startFocus;
      units.push(unit);
      records.set(unit.entity_id, character);
    }
    if (units.length !== 2 && units.length !== 5) throw new BattleSetupError("Party must use the 1-1 two-hero exception or five heroes");
    if (units.length === 5) {
      const front = units.filter((unit) => unit.row === "front").length;
      const rear = units.filter((unit) => unit.row === "rear").length;
      if (front !== 2 || rear !== 3) throw new BattleSetupError("A five-hero party must use 2 Front and 3 Rear slots");
    }
    return [units, records];
  }

  /** Applies the unlocked Memory Nodes (battle_rules.memory_nodes) to final stats: [stats, start_focus]. */
  applyMemoryNodes(stats: Record<string, number>, unlocked: number): [Record<string, number>, number] {
    const percent: Record<string, Dec> = {};
    let startFocus = 0;
    const nodes = this.progression.memoryNodes();
    for (let index = 0; index < Math.min(unlocked, nodes.length); index++) {
      const node = nodes[index]!;
      // Only stats the character actually has: apply_equipment would otherwise add e.g. "res": 0 and switch damage off
      // its missing-res fallback for characters without a RES stat.
      if (node.effect_type === "stat_pct" && node.stat !== null && node.stat.length > 0 && Object.hasOwn(stats, node.stat)) {
        percent[node.stat] = (percent[node.stat] ?? Dec.fromInt(0)).add(node.value);
      } else if (node.effect_type === "start_focus") {
        startFocus += node.value.toIntTruncated();
      }
    }
    if (Object.keys(percent).length === 0) return [{ ...stats }, startFocus];
    const boosted: EquippedItem = { flat_stats: {}, percent_stats: percent };
    return [this.progression.applyEquipment({ ...stats }, boosted, emptyEquipped(), []), startFocus];
  }

  /** The authored deterministic 3-star field kit for a temporary guest. */
  storyLoanLoadout(character: Character, stageId: string): StoryLoanLoadout {
    const loanRules = dgetDict(this.rules, "story_loan_equipment");
    const rarity = toInt(dget(loanRules, "rarity", 3));
    let weapon: Weapon | null = null;
    for (const item of this.registry.weapons.values()) {
      if (item.rarity === rarity && item.weapon_type === character.equip_weapon_type) {
        if (weapon === null || item.weapon_id < weapon.weapon_id) weapon = item;
      }
    }
    const armorId = String(dget(loanRules, "armor_id", ""));
    const setId = String(dget(loanRules, "accessory_set_id", ""));
    let necklace: AccessoryTemplate | null = null;
    let ring: AccessoryTemplate | null = null;
    for (const item of this.registry.accessories.values()) {
      if (item.rarity !== rarity || item.set_id !== setId) continue;
      if (item.slot === "necklace" && (necklace === null || item.accessory_id < necklace.accessory_id)) necklace = item;
      else if (item.slot === "ring" && (ring === null || item.accessory_id < ring.accessory_id)) ring = item;
    }
    if (weapon === null || !this.registry.armors.has(armorId) || necklace === null || ring === null) {
      throw new BattleSetupError(`Invalid story-loan equipment recipe for ${character.character_id}`);
    }
    const rolled = [necklace, ring].map((template) =>
      this.accessory_roller.rollDropSeeded(template.accessory_id, crc32Text(`${character.character_id}:${stageId}:${template.accessory_id}`)),
    );
    return {
      weapon_id: weapon.weapon_id,
      armor_id: armorId,
      accessory_ids: [necklace.accessory_id, ring.accessory_id],
      rolled_accessories: rolled,
    };
  }

  /**
   * Applies a (possibly partial) loadout to `base` stats. Keys: weapon_id (absent = the signature weapon, explicit
   * null = none), weapon_level, armor_id (absent/null = none), armor_level, accessory_ids (0-2, one per slot),
   * rolled_accessories (payloads parallel to accessory_ids; a length mismatch means "no rolled stats"). Levels default
   * to 1. Throws BattleSetupError for an invalid loadout.
   */
  resolveEquipment(character: Character, base: Record<string, number>, loadout: Loadout): Record<string, number> {
    const weaponId = dget(loadout, "weapon_id", character.signature_weapon_id);
    let weapon: Weapon | null = null;
    if (weaponId !== null) {
      weapon = this.registry.weapons.get(String(weaponId)) ?? null;
      if (weapon === null) throw new BattleSetupError(`Unknown weapon ${pyRepr(weaponId)}`);
    }
    if (weapon !== null && !this.equipment_rules.canEquipWeapon(character, weapon)) {
      throw new BattleSetupError(`${character.character_id} cannot equip ${weapon.weapon_id}`);
    }
    const armorId = dget(loadout, "armor_id");
    const armor = armorId !== null ? (this.registry.armors.get(String(armorId)) ?? null) : null;
    if (armorId !== null && armor === null) throw new BattleSetupError(`Unknown armor ${pyRepr(armorId)}`);
    if (armor !== null && armor.slot !== "armor") throw new BattleSetupError("Invalid loadout: the armor item must occupy the 'armor' slot");
    const accessoryIds = dget(loadout, "accessory_ids", []) as unknown[];
    if (accessoryIds.length > 2) throw new BattleSetupError("Loadout allows at most one necklace and one ring");
    const accessories: AccessoryTemplate[] = accessoryIds.map((itemId) => {
      const template = this.registry.accessories.get(String(itemId));
      if (template === undefined) throw new BattleSetupError(`Unknown accessory ${pyRepr(itemId)}`);
      return template;
    });
    const slotNames: string[] = [];
    let distinct = true;
    for (const item of accessories) {
      if (item.slot !== "necklace" && item.slot !== "ring") distinct = false;
      if (slotNames.includes(item.slot)) distinct = false;
      slotNames.push(item.slot);
    }
    if (!distinct) throw new BattleSetupError("Loadout accessory slots must be at most one necklace and one ring");
    const necklace = accessories.find((item) => item.slot === "necklace") ?? null;
    const ring = accessories.find((item) => item.slot === "ring") ?? null;
    if (weapon !== null && armor !== null && necklace !== null && ring !== null) {
      const problems = this.equipment_rules.validateLoadout(character, weapon, armor, necklace, ring);
      if (problems.length > 0) throw new BattleSetupError(`Invalid loadout: ${problems.join("; ")}`);
    }
    let rolls = [...dgetArray(loadout, "rolled_accessories")] as Dict[];
    if (rolls.length !== accessories.length) rolls = accessories.map(() => ({ main_stat: null, sub_stats: [] }));
    const weaponItem = weapon !== null
      ? this.progression.equippedItemFromContent(
        { base_stats_level_1: weapon.base_stats_level_1, growth_per_level: weapon.growth_per_level }, toInt(dget(loadout, "weapon_level", 1)))
      : emptyEquipped();
    const armorItem = armor !== null
      ? this.progression.equippedItemFromContent(
        { base_stats_level_1: armor.base_stats_level_1, growth_per_level: armor.growth_per_level }, toInt(dget(loadout, "armor_level", 1)))
      : emptyEquipped();
    const rolledItems = rolls.map((row) => this.progression.equippedItemFromContent(row));
    let gear = this.progression.applyEquipment({ ...base }, weaponItem, armorItem, rolledItems);
    if (necklace !== null && ring !== null) {
      const bonus = this.equipment_rules.resolveSetBonus(necklace, ring);
      if (bonus !== null) {
        const bonusItem: EquippedItem = { flat_stats: {}, percent_stats: { [bonus.stat_id]: Dec.fromNumber(bonus.value_pct) } };
        gear = this.progression.applyEquipment({ ...gear }, bonusItem, emptyEquipped(), []);
      }
    }
    return gear;
  }

  spawnWave(state: EncounterState, waveIndex: number): void {
    if (waveIndex >= state.stage.enemy_waves.length) return;
    state.wave_index = waveIndex;
    for (const entry of state.stage.enemy_waves[waveIndex]!) {
      const enemy = this.registry.enemies.get(entry.enemy_id)!;
      for (let index = 0; index < entry.count; index++) {
        const serial = state.units.filter((unit) => unit.enemy_id === enemy.enemy_id).length;
        const entityId = `${state.stage.stage_id}:${waveIndex}:${enemy.enemy_id}:${serial + index}`;
        const stats = this.progression.enemyStatsAtLevel(enemy.base_stats_level_1, enemy.growth_per_level, state.stage.enemy_level, state.stage.enemy_stat_multiplier);
        const isBoss = state.stage.boss_id !== null && state.stage.boss_id.length > 0 && enemy.boss_id === state.stage.boss_id;
        const immunities = [...enemy.status_immunities];
        if (isBoss) {
          for (const item of dgetArray(dgetDict(this.rules, "targeting"), "boss_control_immunities_default")) {
            if (!immunities.includes(String(item))) immunities.push(String(item));
          }
        }
        const unit = BattleUnit.build({
          entity_id: entityId, team: "enemy", slot_index: state.units.length,
          row: serial % 2 === 0 ? "front" : "rear", stats, element: enemy.element,
          weaknesses: enemy.weaknesses, resistances: enemy.resistances, status_immunities: immunities,
          faction_id: enemy.faction_id, tags: [enemy.role], is_boss: isBoss, enemy_id: enemy.enemy_id,
          level: state.stage.enemy_level, stat_resolution_rules: this.rules.stat_resolution as Dict, status_definitions: this.statuses,
        });
        for (const skill of enemy.skills) unit.cooldowns.set(skill.skill_id, 0);
        state.units.push(unit);
        state.records.set(entityId, enemy);
        if (isBoss) {
          if (state.boss !== null) {
            state.reportFault("Stage contains more than one active boss");
            return;
          }
          state.boss = unit;
        }
      }
    }
    state.refreshStatAuras();
  }

  summonFactory(enemyId: string, count: number, state: EncounterState): BattleUnit[] {
    const enemy = this.registry.enemies.get(enemyId)!;
    const result: BattleUnit[] = [];
    for (let draw = 0; draw < count; draw++) {
      state.summon_serial += 1;
      const stats = this.progression.enemyStatsAtLevel(enemy.base_stats_level_1, enemy.growth_per_level, state.stage.enemy_level, state.stage.enemy_stat_multiplier);
      const unit = BattleUnit.build({
        entity_id: `${state.stage.stage_id}:summon:${enemyId}:${state.summon_serial}`,
        team: "enemy", slot_index: state.units.length, row: "rear", stats, element: enemy.element,
        weaknesses: enemy.weaknesses, resistances: enemy.resistances, status_immunities: enemy.status_immunities,
        faction_id: enemy.faction_id, tags: [enemy.role], enemy_id: enemy.enemy_id, level: state.stage.enemy_level,
        stat_resolution_rules: this.rules.stat_resolution as Dict, status_definitions: this.statuses,
      });
      for (const skill of enemy.skills) unit.cooldowns.set(skill.skill_id, 0);
      state.records.set(unit.entity_id, enemy);
      result.push(unit);
    }
    return result;
  }
}
