// Battle engine unit tests (port of game/tests/parity/test_battle_interpreter_unit.gd): interpreter operations,
// selectors, conditions, redirects, soul link, the Action Gauge, runBattle, turn timing and the presentation event stream.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BattleState, BattleUnit, defenseStatForDamageType, delayNextAction, EffectInterpreter, effectiveSpeed, elementMultiplier,
  GaugeRules, nextActor, runBattle, spendAction,
} from "../../src/engine/battle";
import type { Dict } from "../../src/engine/battle/util";
import { loadPacks, PACK_FILES, type PackName } from "../../src/engine/content";
import { Frac } from "../../src/engine/frac";
import { CpythonRandom } from "../../src/engine/random";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");
const readPack = (name: string): unknown => JSON.parse(readFileSync(join(CONTENT, name), "utf8"));
const registry = loadPacks(Object.fromEntries(PACK_FILES.map((name) => [name, readPack(name)])) as Record<PackName, unknown>);

const makeInterpreter = (seed = 0): EffectInterpreter => EffectInterpreter.create(registry, new CpythonRandom(seed));

function makeUnit(entityId: string, team: string, slot: number, hp = 1000, atk = 50, defense = 50, speed = 100, element = "Stone", row = ""): BattleUnit {
  return BattleUnit.build({
    entity_id: entityId, team, slot_index: slot,
    stats: { hp, atk, def: defense, spd: speed, crit_rate: 0.0 },
    hp, max_hp: hp, element, ...(row ? { row } : {}),
  });
}

const stateOf = (units: BattleUnit[], actor: BattleUnit | null = null): BattleState => {
  const state = BattleState.make(units);
  state.actor = actor;
  return state;
};

const gaugeRules = (): GaugeRules => GaugeRules.fromMapping(registry.battle_rules.turn_queue as Dict);

describe("EffectInterpreter", () => {
  it("Mahmut's ultimate, seeded, against three enemies", () => {
    const interpreter = makeInterpreter(20260927);
    const skill = registry.skills.get("mahmut_ultimate_last_wall_at_dusk")!;
    expect(interpreter.validateEffectOps(skill.effect_ops).length).toBe(3);
    const mahmut = makeUnit("mahmut", "player", 0, 1000, 99, 95, 100, "Stone");
    mahmut.stats.crit_rate = 0.05;
    const allyOne = makeUnit("ally_one", "player", 1);
    const allyTwo = makeUnit("ally_two", "player", 2, 1000, 50, 50, 100, "Stone", "rear");
    const frontOne = makeUnit("enemy_front_1", "enemy", 0, 500, 50, 50, 100, "Tide", "front");
    const frontTwo = makeUnit("enemy_front_2", "enemy", 1, 500, 50, 50, 100, "Tide", "front");
    const rear = makeUnit("enemy_rear", "enemy", 2, 500, 50, 50, 100, "Tide", "rear");
    const state = BattleState.make([mahmut, allyOne, allyTwo, frontOne, frontTwo, rear]);

    const results = interpreter.executeSkill(skill, state, mahmut, "ultimate");

    expect(state.fault).toBe("");
    expect(results[0]!.damage.map((hit) => hit.damage)).toEqual([43, 43]);
    expect([frontOne.hp, frontTwo.hp, rear.hp]).toEqual([457, 457, 500]);
    expect(results[0]!.damage.map((hit) => hit.defense_stat)).toEqual(["def", "def"]);
    expect(results[0]!.damage.map((hit) => hit.element_multiplier)).toEqual([1.2, 1.2]);
    for (const enemy of [frontOne, frontTwo, rear]) expect(enemy.hasStatus("taunt"), enemy.entity_id).toBe(true);
    expect([mahmut.shieldTotal(), allyOne.shieldTotal(), allyTwo.shieldTotal()]).toEqual([114, 114, 114]);
  });

  it("damage type defense and the element chart are independent", () => {
    const defender = makeUnit("defender", "enemy", 0, 1000, 50, 80, 100, "Gale");
    defender.stats.res = 25;
    expect(defenseStatForDamageType("physical", defender, {})).toEqual(["def", 80]);
    expect(defenseStatForDamageType("magic", defender, {})).toEqual(["res", 25]);
    expect(defenseStatForDamageType("elemental", defender, {})).toEqual(["res", 25]);
    expect(defenseStatForDamageType("magic", makeUnit("no_res", "enemy", 1, 1000, 50, 80), {})).toEqual(["def", 80]);
    expect(elementMultiplier("Ember", "Gale", [], [], {})).toBe(1.2);
    expect(elementMultiplier("Dawn", "Veil", [], [], {})).toBe(1.2);
  });

  it("every authored operation list validates and all 31 selectors resolve", () => {
    const interpreter = makeInterpreter(4);
    const pack = readPack("battle_effects_part1.json") as Record<string, Dict[]>;
    let operationCount = 0;
    for (const section of ["player_skill_effects", "enemy_actions", "enemy_passives", "boss_actions", "boss_phases"]) {
      for (const entry of pack[section]!) {
        for (const field of ["effect_ops", "enter_ops", "passive_ops"]) {
          const ops = (entry[field] ?? []) as Dict[];
          if (ops.length === 0) continue;
          interpreter.error = "";
          interpreter.validateEffectOps(ops);
          expect(interpreter.error, `${String(entry.skill_id ?? entry.phase_id ?? section)}.${field}`).toBe("");
          operationCount += ops.length;
        }
      }
    }
    expect(operationCount).toBeGreaterThanOrEqual(200);
    expect(Object.keys(interpreter.selector_rules).length).toBe(31);

    const actor = makeUnit("actor", "player", 0);
    const ally = makeUnit("ally", "player", 1, 400);
    const enemy = makeUnit("enemy", "enemy", 0, 300, 50, 50, 100, "Stone", "front");
    enemy.statuses.set("duel_mark", { duration_turns: 2, tags: ["mark", "duel"] });
    enemy.statuses.set("stoneguard", { duration_turns: 1, tags: ["buff"] });
    const boss = makeUnit("boss", "enemy", 1, 1000, 50, 50, 100, "Stone", "rear");
    boss.is_boss = true;
    const state = BattleState.make([actor, ally, enemy, boss]);
    state.actor = actor;
    state.boss = boss;
    state.event = { source: actor, target: enemy };
    state.previous_operation_targets = [enemy];
    state.previous_successful_heal_targets = [ally];
    state.last_target = enemy;
    for (const selectorId of Object.keys(interpreter.selector_rules)) {
      interpreter.error = "";
      interpreter.resolveSelector(selectorId, state);
      expect(interpreter.error, `selector ${selectorId}`).toBe("");
    }
  });

  it("gust adds gauge debt capped by the action queue rule", () => {
    const interpreter = makeInterpreter();
    const actor = makeUnit("caster", "player", 0);
    const target = makeUnit("target", "enemy", 0);
    const state = stateOf([actor, target], actor);
    interpreter.executeEffectOps([{ op: "apply_status", target_selector_id: "single_enemy_default", status_id: "gust", duration_turns: 1 }], state, actor);
    expect(state.fault).toBe("");
    expect(target.pending_delay_gauge.equals(Frac.of(1500))).toBe(true);
    expect(target.hasStatus("gust")).toBe(true);
  });

  it("taunt on the actor forces a single target to the status source", () => {
    const interpreter = makeInterpreter();
    const mahmut = makeUnit("mahmut", "player", 0);
    const ally = makeUnit("ally", "player", 1, 1000, 50, 50, 100, "Stone", "rear");
    const taunted = makeUnit("taunted_enemy", "enemy", 0);
    taunted.statuses.set("taunt", { duration_turns: 2, source_id: mahmut.entity_id, tags: ["buff", "control"] });
    const state = stateOf([mahmut, ally, taunted], taunted);
    expect(interpreter.resolveSelector("single_enemy_default", state).map((unit) => unit.entity_id)).toEqual(["mahmut"]);
  });

  it("conditions support all/any/not and unknown predicates or fields fail", () => {
    const interpreter = makeInterpreter();
    const actor = makeUnit("actor", "player", 0);
    actor.statuses.set("taunt", { duration_turns: 1, tags: ["buff", "control"] });
    const state = stateOf([actor, makeUnit("enemy", "enemy", 0)], actor);
    state.round_number = 1;
    const condition = { all: [
      { predicate: "owner_has_status", value: "taunt" },
      { any: [{ predicate: "round_number_at_most", value: 1 }, { not: { predicate: "owner_hp_below_pct", value: 1 } }] },
    ] };
    expect(interpreter.evaluateCondition(condition, state)).toBe(true);
    interpreter.error = "";
    interpreter.validateEffectOps([{ op: "gain_focus", target_selector_id: "self", amount: 10, when: { predicate: "invented_predicate" } }]);
    expect(interpreter.error).toContain("unknown predicate");
    interpreter.error = "";
    interpreter.validateEffectOps([{ op: "gain_focus", target_selector_id: "self", amount: 10, silent_fallback: true }]);
    expect(interpreter.error).toContain("unknown fields");
  });

  it("a redirect selects another ally and splits a single-target hit", () => {
    const interpreter = makeInterpreter(3);
    const mahmut = makeUnit("mahmut", "player", 0, 1000, 50, 95);
    const protectedUnit = makeUnit("protected", "player", 1, 400, 50, 50);
    const rearAlly = makeUnit("rear_ally", "player", 2, 600, 50, 40, 100, "Stone", "rear");
    const enemy = makeUnit("enemy_attacker", "enemy", 0, 1000, 100, 50);
    const state = stateOf([mahmut, protectedUnit, rearAlly, enemy], mahmut);
    interpreter.executeEffectOps([{
      op: "grant_redirect", target_selector_id: "self", protected_ally_selector_id: "lowest_hp_ally",
      redirected_fraction: 0.5, duration_turns: 2, eligible_action_types: ["basic"],
    }], state, mahmut);
    expect(mahmut.redirects[0]!.protected_ids).toEqual(["protected"]);

    state.actor = enemy;
    const results = interpreter.executeEffectOps(
      [{ op: "damage", target_selector_id: "single_enemy", damage_type: "physical", scale_stat: "atk", multiplier: 1.0 }],
      state, enemy, "basic", new Map([["single_enemy", "protected"]]),
    );
    expect(results[0]!.damage.map((hit) => [hit.recipient_id, hit.damage])).toEqual([["protected", 8], ["mahmut", 4]]);
    expect([protectedUnit.hp, mahmut.hp]).toEqual([392, 996]);
  });

  it("soul link shares resolved HP damage with its living source", () => {
    const interpreter = makeInterpreter(11);
    const attacker = makeUnit("attacker", "player", 0, 1000, 100);
    const linked = makeUnit("linked", "enemy", 0, 1000, 50, 50);
    const source = makeUnit("chain_cultist", "enemy", 1, 1000, 50, 50, 100, "Stone", "front");
    linked.statuses.set("soul_link", { duration_turns: 2, source_id: source.entity_id, shared_damage_fraction: 0.25, tags: ["buff"] });
    const state = stateOf([attacker, linked, source], attacker);
    const result = interpreter.executeEffectOps(
      [{ op: "damage", target_selector_id: "single_enemy_default", damage_type: "physical", scale_stat: "atk", multiplier: 1.0 }], state, attacker,
    );
    expect(result[0]!.damage[0]!.damage).toBe(16);
    expect(result[0]!.damage[0]!.shared_damage).toBe(4);
    expect([linked.hp, source.hp]).toEqual([988, 996]);
  });

  it("publishes damage and status events for client subscribers", () => {
    const skill = registry.skills.get("mahmut_ultimate_last_wall_at_dusk")!;
    const mahmut = BattleUnit.build({ entity_id: "mahmut", team: "player", slot_index: 0, element: "Stone", stats: { hp: 1000, atk: 99, def: 95, spd: 100, crit_rate: 0.0 } });
    const enemies = [0, 1, 2].map((index) => BattleUnit.build({
      entity_id: `enemy_${index}`, team: "enemy", slot_index: index, element: "Tide",
      row: index < 2 ? "front" : "rear", stats: { hp: 500, atk: 50, def: 50, spd: 80 },
    }));
    const state = BattleState.make([mahmut, ...enemies]);
    const received: Dict[] = [];
    state.eventListeners.push((event) => received.push(event));
    makeInterpreter(20260927).executeSkill(skill, state, mahmut, "ultimate");
    for (const event of received) expect(Object.hasOwn(event, "hp") && Object.hasOwn(event, "max_hp"), String(event.type)).toBe(true);
    expect(received.filter((event) => event.type === "damage_dealt").length).toBe(2);
    const statusTargets = new Set(received.filter((event) => event.type === "status_applied").map((event) => event.target_id));
    expect(received.filter((event) => event.type === "status_applied").length).toBe(3);
    expect([...statusTargets].sort()).toEqual(enemies.map((enemy) => enemy.entity_id));
  });
});

describe("Action Gauge and the battle loop", () => {
  it("uses fraction overflow and a capped delay", () => {
    const rules = gaugeRules();
    const player = makeUnit("player_fast", "player", 0, 1000, 50, 50, 101);
    const enemy = makeUnit("enemy_fast", "enemy", 0, 1000, 50, 50, 101);
    const speedless = makeUnit("speedless", "player", 2, 1000, 50, 50, 0, "Stone", "rear");
    expect(effectiveSpeed(speedless)).toBe(1);
    expect(nextActor([enemy, player], rules), "equal ready overflow -> player team").toBe(player);
    player.gauge = Frac.of(0);
    enemy.gauge = Frac.of(0);
    expect(nextActor([player, enemy], rules)).toBe(player);
    player.gauge = Frac.of(GaugeRules.GAUGE_MAX + 1500);
    delayNextAction(player, Frac.of(15, 100), rules);
    expect(player.pending_delay_gauge.num).toBe(1500n);
    expect(spendAction(player, rules)).toBe(true);
    expect(player.gauge.isZero()).toBe(true);
    expect(player.pending_delay_gauge.isZero()).toBe(true);
    delayNextAction(player, Frac.of(40, 100), rules);
    expect(delayNextAction(player, Frac.of(30, 100), rules).equals(Frac.of(5000)), "capped at half a gauge").toBe(true);
  });

  it("runBattle uses the seeded random stream and the action callback", () => {
    const trace: unknown[][] = [];
    class FinisherState extends BattleState {
      override resolveAction(turnActor: BattleUnit, action: unknown, random: CpythonRandom): void {
        trace.push([turnActor.entity_id, action, random.random()]);
        const target = this.livingUnits(this.opposingTeam(turnActor))[0]!;
        target.hp = 0;
        target.alive = false;
      }
    }
    const state = new FinisherState();
    state.units = [makeUnit("player", "player", 0), makeUnit("enemy", "enemy", 0)];
    runBattle(state, () => "finish", 77);
    expect(state.fault).toBe("");
    expect(trace).toEqual([["player", "finish", new CpythonRandom(77).random()]]);
    expect(state.isBattleOver()).toBe(true);
  });

  it("the run seed is shared with effect chance rolls", () => {
    const interpreter = makeInterpreter(999);
    class EffectState extends BattleState {
      override resolveAction(turnActor: BattleUnit): void {
        interpreter.executeEffectOps([{ op: "apply_status", target_selector_id: "self", status_id: "stoneguard", duration_turns: 1, chance: 0.5 }], this, turnActor);
        const target = this.livingUnits(this.opposingTeam(turnActor))[0]!;
        target.hp = 0;
        target.alive = false;
      }
    }
    const player = makeUnit("player", "player", 0);
    const state = new EffectState();
    state.units = [player, makeUnit("enemy", "enemy", 0)];
    runBattle(state, () => "skill", 1);
    expect(state.fault).toBe("");
    expect(player.hasStatus("stoneguard"), "the first Random(1) roll is below 0.5").toBe(true);
  });

  const timingUnit = (entityId: string, team: string, speed = 1): BattleUnit =>
    BattleUnit.build({ entity_id: entityId, team, slot_index: 0, stats: { hp: 10, atk: 1, def: 0, spd: speed } });

  it("a status expires at owner turn start and a DOT gets its final tick", () => {
    const actor = timingUnit("hero", "player");
    actor.statuses.set("burn", { duration_turns: 2, tick_damage: 1, ticks_at_owner_turn_start: true, source_id: "enemy" });
    const state = BattleState.make([actor]);
    state.startTurn(actor);
    expect(actor.statuses.get("burn")!.duration_turns).toBe(1);
    expect(actor.hp).toBe(9);
    state.endTurn(actor);
    state.startTurn(actor);
    expect(actor.statuses.has("burn")).toBe(false);
    expect(actor.hp).toBe(8);
    expect(state.battle_events.filter((event) => event.type === "damage_dealt" && event.status_id === "burn").map((event) => event.hp)).toEqual([9, 8]);
  });

  it("a one-turn break expiring at turn start still interrupts that action", () => {
    class OneOpportunityState extends BattleState {
      override isBattleOver(): boolean {
        return this.actor !== null;
      }

      override resolveAction(): void {
        this.reportFault("the broken hero must not execute an action");
      }
    }
    const hero = timingUnit("hero", "player", 2);
    hero.statuses.set("break", { duration_turns: 1, tags: ["control", "break"] });
    const state = new OneOpportunityState();
    state.units = [hero, timingUnit("enemy", "enemy")];
    let asked = 0;
    runBattle(state, () => {
      asked++;
      return "unexpected";
    }, 42);
    expect(state.fault).toBe("");
    expect(asked, "the broken hero must not request an Auto action").toBe(0);
    expect(hero.has_acted).toBe(true);
    expect(hero.statuses.has("break")).toBe(false);
  });

  it("event subscriptions are removable and emitted events stay out of the replay log", () => {
    const state = BattleState.make([BattleUnit.build({ entity_id: "hero", team: "player", slot_index: 0, stats: { hp: 100 } })]);
    const received: Dict[] = [];
    const listener = (event: Dict): void => {
      received.push(event);
    };
    state.eventListeners.push(listener);
    state.emitEvent({ type: "damage_dealt", target_id: "hero", hp: 75 });
    state.eventListeners = state.eventListeners.filter((item) => item !== listener);
    state.emitEvent({ type: "status_applied", target_id: "hero", status_id: "burn" });
    expect(received).toEqual([{ type: "damage_dealt", target_id: "hero", hp: 75 }]);
    expect(state.log.length).toBe(0);
    expect(state.battle_events.length).toBe(0);
  });
});
