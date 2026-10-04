// BattleService, progression wiring and passive hook unit tests (port of game/tests/parity/test_battle_service_unit.gd,
// test_battle_wiring_unit.gd and test_battle_hooks_unit.gd).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BattleService, BattleUnit, EncounterState, type BattleResult, type RunOptions, type UnitRecord } from "../../src/engine/battle";
import type { Dict } from "../../src/engine/battle/util";
import { loadPacks, PACK_FILES, type PackName } from "../../src/engine/content";
import { CpythonRandom } from "../../src/engine/random";
import { StoryRules } from "../../src/engine/story";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");
const readPack = (name: string): unknown => JSON.parse(readFileSync(join(CONTENT, name), "utf8"));
const registry = loadPacks(Object.fromEntries(PACK_FILES.map((name) => [name, readPack(name)])) as Record<PackName, unknown>);
const story = new StoryRules(registry, readPack("story_script_part1_manifest.json") as Record<string, unknown>);
const service = BattleService.create(registry, story);

const STARTER_FIVE = ["mahmut", "fadyme", "brin_alder", "nixie_vale", "kera_voss"];
const levels = (level: number): Record<string, number> => Object.fromEntries(STARTER_FIVE.map((id) => [id, level]));

function run(stageId: string, roster: string[], options: RunOptions = {}): BattleResult {
  const result = service.run(stageId, roster, options);
  expect(result.error, `battle ${stageId} must not fault`).toBe("");
  return result;
}

const eventsOfType = (result: BattleResult, type: string): Dict[] => result.state!.battle_events.filter((event) => event.type === type);
const party = (result: BattleResult): BattleUnit[] => result.state!.units.filter((unit) => unit.team === "player");
const fingerprint = (result: BattleResult): unknown => [result.outcome, result.stars, result.actions, result.final_units, result.state!.battle_events];
const unitOf = (result: BattleResult, id: string): BattleUnit => result.state!.units.find((unit) => unit.entity_id === id)!;

describe("BattleService", () => {
  it("tutorial and story-loan Auto parties are five-slot safe", () => {
    const tutorial = run("1-1", ["mahmut", "fadyme"], { run_seed: 20260927 });
    const loan = run("1-2", ["mahmut", "fadyme"], { run_seed: 20260927 });
    expect(tutorial.outcome).toBe("victory");
    expect(eventsOfType(tutorial, "damage_dealt").length).toBeGreaterThan(0);
    expect(party(tutorial)).toEqual(tutorial.state!.livingUnits("player"));
    expect(tutorial.state!.livingUnits("player").length).toBe(2);
    expect(loan.outcome).toBe("victory");
    const units = party(loan);
    expect(units.map((unit) => [unit.row, unit.slot_index])).toEqual([["front", 0], ["front", 1], ["rear", 2], ["rear", 3], ["rear", 4]]);
    for (const unit of units) {
      expect(unit.level).toBe(1);
      expect(unit.temporary, unit.entity_id).toBe(["brin_alder", "nixie_vale", "kera_voss"].includes(unit.entity_id));
    }
    expect(units.map((unit) => unit.entity_id).sort()).toEqual([...STARTER_FIVE].sort());
    const brin = unitOf(loan, "brin_alder");
    const record = registry.characters.get("brin_alder")!;
    const brinBase = service.progression.baseStatAtLevel(record.base_stats_level_1, record.growth_per_level, 1);
    expect(brin.stats.hp as number, "story loan gear raises HP above the bare level-1 stats").toBeGreaterThan(brinBase.hp!);
    expect(unitOf(run("1-2", ["mahmut", "fadyme"], { run_seed: 20260927 }), "brin_alder").stats).toEqual(brin.stats);
  });

  it("a seeded Auto replay produces an identical event trace", () => {
    const options = (): RunOptions => {
      const storyState = story.newPlayerState();
      storyState.owned_character_ids = new Set(STARTER_FIVE);
      return { story_state: storyState, player_levels: levels(20), run_seed: 88421 };
    };
    const first = run("7-5", STARTER_FIVE, options());
    const second = run("7-5", STARTER_FIVE, options());
    expect(first.outcome).toBe("victory");
    expect(second.outcome).toBe("victory");
    expect(second.state!.battle_events).toEqual(first.state!.battle_events);
    expect(second.final_units).toEqual(first.final_units);
  });

  it("Auto uses boss break targets and applies both boss phases", () => {
    const result = run("1-5", STARTER_FIVE, { player_levels: levels(3), run_seed: 340 });
    expect(result.outcome).toBe("victory");
    for (const type of ["boss_phase_changed", "boss_objective_destroyed", "boss_telegraph_interrupted"]) {
      expect(eventsOfType(result, type).length, type).toBeGreaterThan(0);
    }
    expect(result.state!.phase_index).toBe(1);
  });

  it("eclipse pylons remove the ward and the decay status", () => {
    const result = run("7-5", STARTER_FIVE, { player_levels: levels(20), run_seed: 2026 });
    const state = result.state!;
    expect(result.outcome).toBe("victory");
    expect(state.phase_index).toBe(1);
    for (const objectiveId of ["altar_pylon_left", "altar_pylon_center", "altar_pylon_right"]) {
      expect(state.objectives.get(objectiveId)!.hp, objectiveId).toBe(0);
    }
    for (const modifier of state.boss_modifiers) expect(modifier.modifier_id).not.toBe("aether_ward");
    expect(state.boss!.statuses.has("decay")).toBe(false);
    expect(eventsOfType(result, "boss_telegraph_interrupted").some((event) => event.action_id === "boss_eclipse_construct_eclipse_pulse")).toBe(true);
  });

  it("the same (wide) seed reproduces the same battle and is recorded", () => {
    const seed = 987_654_321_012_345n;
    const first = run("1-1", [], { run_seed: seed });
    const second = run("1-1", [], { run_seed: seed });
    expect(first.run_seed).toBe(seed);
    expect(fingerprint(second)).toEqual(fingerprint(first));
    const explicit = run("1-1", [], { run_seed: 4242 });
    expect(explicit.run_seed).toBe(4242);
    expect(fingerprint(run("1-1", [], { run_seed: 4242 }))).toEqual(fingerprint(explicit));
  });

  it("reports setup problems in the result", () => {
    expect(service.run("9-9").error).toBe("Unknown stage_id '9-9'");
    expect(service.run("1-2", ["mahmut", "mahmut"]).error).toContain("duplicate");
  });
});

describe("BattleService progression wiring", () => {
  const runTutorial = (options: RunOptions): BattleResult => service.run("1-1", [], { story_state: story.newPlayerState(), run_seed: 3, ...options });

  it("a saved level 10 changes battle stats with the same seed", () => {
    const levelOne = unitOf(runTutorial({ run_seed: 5 }), "mahmut").stats;
    const levelTen = unitOf(runTutorial({ run_seed: 5, player_levels: { mahmut: 10 } }), "mahmut").stats;
    const character = registry.characters.get("mahmut")!;
    expect(levelTen).toEqual(service.progression.baseStatAtLevel(character.base_stats_level_1, character.growth_per_level, 10));
    expect(levelTen).not.toEqual(levelOne);
    expect(levelTen.hp as number).toBeGreaterThan(levelOne.hp as number);
  });

  it("an equipped weapon reaches the battle and a partial loadout is valid", () => {
    const bare = unitOf(runTutorial({}), "mahmut").stats;
    const result = runTutorial({ equipment: { mahmut: { weapon_id: "weapon_arming_sword_4_01", weapon_level: 1, armor_id: null, accessory_ids: [], rolled_accessories: [] } } });
    expect(result.error).toBe("");
    const armed = unitOf(result, "mahmut").stats;
    expect(armed.atk as number).toBeGreaterThan(bare.atk as number);
    expect(armed.hp).toBe(bare.hp);
  });

  it("item level scales the weapon contribution", () => {
    const atk = (level: number): number => {
      const result = runTutorial({ equipment: { mahmut: { weapon_id: "weapon_arming_sword_4_01", weapon_level: level } } });
      expect(result.error).toBe("");
      return unitOf(result, "mahmut").stats.atk as number;
    };
    const [atk1, atk20] = [atk(1), atk(20)];
    expect(atk20).toBeGreaterThanOrEqual(atk1);
    const weapon = registry.weapons.get("weapon_arming_sword_4_01")!;
    const numeric = Object.fromEntries(Object.entries(weapon.base_stats_level_1).filter(([, value]) => typeof value !== "string"));
    const grown = service.progression.baseStatAtLevel(numeric, weapon.growth_per_level, 20);
    const base = service.progression.baseStatAtLevel(numeric, weapon.growth_per_level, 1);
    expect(atk20 > atk1).toBe(grown.atk! > base.atk!);
  });

  it("the set bonus needs both accessories", () => {
    const statsWith = (accessoryIds: string[]): Dict => {
      const loadout = { weapon_id: null, accessory_ids: accessoryIds, rolled_accessories: accessoryIds.map(() => ({ main_stat: null, sub_stats: [] })) };
      const result = runTutorial({ equipment: { mahmut: loadout } });
      expect(result.error).toBe("");
      return unitOf(result, "mahmut").stats;
    };
    const bare = statsWith([]);
    expect(statsWith(["accessory_ash_maw_hide_ring_4"]), "empty rolls + no set bonus -> no change").toEqual(bare);
    // Pinned reference defect (parity/README.md, "Reference behavior" 1): the set bonus keeps its `_pct` key and lands
    // as a junk `hp_pct: 0` stat, so `both != bare` holds only because of that key.
    expect(statsWith(["accessory_ash_maw_hide_necklace_4", "accessory_ash_maw_hide_ring_4"])).not.toEqual(bare);
  });

  it("invalid partial loadouts are rejected", () => {
    const tooMany = runTutorial({ run_seed: 1, equipment: { mahmut: { weapon_id: null, accessory_ids: ["accessory_ash_maw_hide_ring_4", "accessory_ash_maw_hide_ring_3"] } } });
    expect(tooMany.error).toContain("at most one necklace and one ring");
    const wrongType = runTutorial({ run_seed: 1, equipment: { mahmut: { weapon_id: "weapon_bell_focus_3_01" } } });
    expect(wrongType.error).toContain("cannot equip");
  });
});

describe("EncounterState passive hooks", () => {
  /** An encounter with every character plus four enemies on stage 7-5. Characters keyed by id, enemies by enemy id. */
  function makeHookState(): { state: EncounterState; units: Record<string, BattleUnit> } {
    const units: BattleUnit[] = [];
    const records = new Map<string, UnitRecord>();
    const actors: Record<string, BattleUnit> = {};
    let index = 0;
    for (const character of registry.characters.values()) {
      const unit = BattleUnit.build({
        entity_id: character.character_id, team: "player", slot_index: index, row: index < 2 ? "front" : "rear",
        stats: service.progression.baseStatAtLevel(character.base_stats_level_1, character.growth_per_level, 1),
        element: character.element, tags: [character.class_id, character.combat_role],
        stat_resolution_rules: service.rules.stat_resolution as Dict, status_definitions: service.statuses,
      });
      units.push(unit);
      records.set(unit.entity_id, character);
      actors[unit.entity_id] = unit;
      index++;
    }
    index = 0;
    for (const enemyId of ["hollow_pilgrim", "ash_wolf", "choir_knight", "royal_hollow"]) {
      const enemy = registry.enemies.get(enemyId)!;
      const unit = BattleUnit.build({
        entity_id: `test:${enemyId}`, team: "enemy", slot_index: index, row: "front",
        stats: service.progression.baseStatAtLevel(enemy.base_stats_level_1, enemy.growth_per_level, 1), element: enemy.element,
        weaknesses: enemy.weaknesses, resistances: enemy.resistances, status_immunities: enemy.status_immunities,
        faction_id: enemy.faction_id, tags: [enemy.role], enemy_id: enemy.enemy_id,
        stat_resolution_rules: service.rules.stat_resolution as Dict, status_definitions: service.statuses,
      });
      units.push(unit);
      records.set(unit.entity_id, enemy);
      actors[enemyId] = unit;
      index++;
    }
    const state = EncounterState.create(units, service, registry.stages.get("7-5")!, records);
    state.rng = new CpythonRandom(31); // the first passive-chance roll is < 10%.
    state.action_type = "basic";
    return { state, units: actors };
  }

  function dispatch(state: EncounterState, eventName: string, actor: BattleUnit, source: BattleUnit | null, target: BattleUnit, extra: Dict = {}): void {
    state.actor = actor;
    state.dispatchBattleEvent(eventName, {
      actor, source: source ?? actor, target, action_type: "basic", source_action_type: "basic", ...extra,
    }, service.interpreter);
  }

  const passiveEvents = (state: EncounterState): Dict[] => state.battle_events.filter((event) => event.type === "passive_triggered");
  const hasDamageModifier = (unit: BattleUnit, sourceId: string | null, multiplier: number): boolean =>
    unit.damage_modifiers.some((modifier) => (sourceId === null || modifier.source_id === sourceId) && Math.abs(Number(modifier.multiplier ?? -1) - multiplier) < 1e-9);

  it("authored event hooks dispatch with conditions and limits", () => {
    const { state, units } = makeHookState();
    const attacker = units.ash_wolf!;
    const otherEnemy = units.choir_knight!;
    const pilgrim = units.hollow_pilgrim!;
    const mahmut = units.mahmut!;
    mahmut.shields.push({ amount: 2, source_id: "test" });
    const attackerHpBefore = attacker.hp;
    dispatch(state, "before_damage_received", attacker, attacker, mahmut, { incoming_action_type: "basic" });
    expect(attacker.hp, "mahmut's shield-guarded passive reflects damage").toBeLessThan(attackerHpBefore);
    expect(mahmut.focus).toBe(5);

    const sable = units.sable_wren!;
    dispatch(state, "before_damage_received", attacker, attacker, sable, { incoming_action_type: "basic" });
    expect(hasDamageModifier(sable, null, 0.5)).toBe(true);

    const naraTarget = units.brin_alder!;
    naraTarget.row = "rear";
    units.nara_vell!.row = "front";
    dispatch(state, "before_damage_received", attacker, attacker, naraTarget, { incoming_action_type: "basic", team: "player" });
    expect(hasDamageModifier(naraTarget, "nara_vell", 0.9)).toBe(true);

    const fadyme = units.fadyme!;
    fadyme.hp = Math.max(1, Math.trunc(fadyme.max_hp * 0.4));
    dispatch(state, "owner_turn_start", fadyme, fadyme, fadyme);
    expect(state.units.some((unit) => unit.stat_modifiers.some((modifier) => modifier.source_id === "fadyme" && modifier.stat_id === "veil_res"))).toBe(true);

    const thistle = units.thistle_roe!;
    thistle.hp = Math.trunc(thistle.max_hp * 0.9);
    dispatch(state, "owner_turn_start", thistle, thistle, thistle);
    expect(state.livingUnits("player").some((unit) => unit.shieldTotal() > 0), "thistle grants a shield").toBe(true);

    const lowAlly = units.brin_alder!;
    lowAlly.max_hp = 10;
    lowAlly.hp = 2;
    dispatch(state, "ally_hp_threshold_crossed", attacker, attacker, lowAlly, { team: "player", target_hp_before_pct: 40, target_hp_after_pct: 20 });
    expect(lowAlly.shieldTotal()).toBeGreaterThan(0);
    expect(passiveEvents(state).some((event) => event.owner_id === "iona_mist")).toBe(true);

    const tilda = units.tilda_fen!;
    dispatch(state, "after_ally_healed", tilda, tilda, lowAlly, { team: "player", healing: 1 });
    expect(lowAlly.hasStatus("soaked_immunity")).toBe(true);

    const rikka = units.rikka_ember!;
    dispatch(state, "after_damage_received", attacker, attacker, rikka, { team: "player", damage: 1 });
    expect(rikka.focus).toBe(5);

    mahmut.statuses.set("stoneguard", { duration_turns: 1, tags: ["buff"] });
    dispatch(state, "after_ally_action", mahmut, mahmut, mahmut, { ally_action_type: "basic" });
    expect(units.mirel_quill!.focus).toBe(5);
    dispatch(state, "after_ally_ultimate", mahmut, mahmut, mahmut, { ally_action_type: "ultimate" });
    expect(units.pippa_bell!.focus).toBe(10);

    const clem = units.clem_marr!;
    pilgrim.statuses.set("dread", { duration_turns: 2, tags: ["debuff"] });
    state.last_target = pilgrim;
    dispatch(state, "before_damage_dealt", clem, clem, pilgrim, { owner_action_type: "any_attack" });
    expect(hasDamageModifier(clem, "clem_marr", 1.08)).toBe(true);

    const vespera = units.vespera_wisp!;
    dispatch(state, "after_enemy_defeated", mahmut, mahmut, pilgrim, { target_statuses_before: ["dread"], target_defeated: true });
    expect(vespera.focus).toBe(10);

    const hana = units.hana_birch!;
    dispatch(state, "after_round_end", mahmut, mahmut, mahmut);
    expect(hana.next_attack_bonuses.length).toBeGreaterThan(0);
    expect(hana.next_attack_bonuses[0]!.damage_multiplier as number).toBeCloseTo(1.2, 12);

    const kera = makeHookState();
    const keraUnit = kera.units.kera_voss!;
    const keraPilgrim = kera.units.hollow_pilgrim!;
    keraPilgrim.statuses.set("burn", { duration_turns: 2, tags: ["debuff", "damage_over_time"] });
    kera.state.last_target = keraPilgrim;
    kera.state.last_primary_target = keraPilgrim;
    kera.state.rng = new CpythonRandom(31); // deterministic successful 10% passive roll.
    dispatch(kera.state, "after_damage_dealt", keraUnit, keraUnit, keraPilgrim, { damage_action_id: 7, damage_action_type: "basic_or_skill" });
    expect(passiveEvents(kera.state).some((event) => event.owner_id === "kera_voss" && event.skill_id === "kera_voss_passive_measure_twice"),
      "kera's 10% passive fires with seed 31").toBe(true);

    const nixie = units.nixie_vale!;
    state.last_target = pilgrim;
    state.last_primary_target = pilgrim;
    dispatch(state, "after_damage_dealt", nixie, nixie, pilgrim, { damage_action_id: 8, owner_action_type: "any_attack" });
    const marked = [...otherEnemy.statuses.values()].some((status) => ((status.tags ?? []) as unknown[]).includes("mark"))
      || state.livingUnits("enemy").some((unit) => unit.hasStatus("trail_mark"));
    expect(marked, "nixie marks an enemy").toBe(true);

    state.last_target = pilgrim;
    dispatch(state, "ally_damaged", mahmut, mahmut, pilgrim, { event_target_faction_is: "hollow_host", damage: 1 });
    expect(passiveEvents(state).some((event) => event.owner_id === "test:choir_knight")).toBe(true);

    const royal = units.royal_hollow!;
    dispatch(state, "before_damage_received", mahmut, mahmut, royal, { incoming_action_type: "basic" });
    expect(royal.blocked_attack_hits).toBe(1);
    expect(passiveEvents(state).length).toBeGreaterThanOrEqual(15);
    expect(state.fault).toBe("");
    expect(kera.state.fault).toBe("");
  });

  it("continuous modifiers follow the damage direction and the stat snapshot", () => {
    const { state, units } = makeHookState();
    const brin = units.brin_alder!;
    brin.statuses.set("taunt", { duration_turns: 1, tags: ["buff", "control"] });
    expect(state.continuousDamageMultiplier("before_damage_received", { actor: units.ash_wolf, target: brin }, service.interpreter)).toBe(0.9);

    const pilgrim = units.hollow_pilgrim!;
    pilgrim.statuses.set("trail_mark", { duration_turns: 2, tags: ["mark"] });
    expect(state.continuousDamageMultiplier("before_damage_dealt", { actor: units.mahmut, target: pilgrim }, service.interpreter)).toBe(1.05);

    // Isolate Odelia's soaked-target modifier from Nixie's trail-mark aura.
    pilgrim.statuses.delete("trail_mark");
    pilgrim.statuses.set("soaked", { duration_turns: 2, tags: ["debuff"] });
    expect(state.continuousDamageMultiplier("before_damage_dealt", { actor: units.odelia_pike, target: pilgrim }, service.interpreter)).toBe(1.1);

    const jori = units.jori_flint!;
    jori.shields.push({ amount: 1, source_id: "test" });
    state.action_type = "basic";
    expect(state.continuousDamageMultiplier("before_damage_dealt", { actor: jori, target: pilgrim }, service.interpreter)).toBe(1.15);

    state.refreshStatAuras();
    expect(units.mahmut!.stat_modifiers.some((modifier) =>
      String(modifier.source_id ?? "").startsWith("continuous_aura:marek_vane") && modifier.stat_id === "def" && Math.abs(Number(modifier.amount) - 0.05) < 1e-9,
    ), "marek's def aura on the front row").toBe(true);
  });
});
