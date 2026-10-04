// Battle engine parity gates (port of game/tests/parity/test_battle_parity.gd and test_loadouts_parity.gd):
// parity/fixtures/battle_<stage>.json (35 stages x 3 squads x 5 seeds = 525 complete Auto battles, compared on outcome,
// the whole event log, stars, action/cycle counts and final units), loadouts.json and story_loans.json.
//
// BATTLE_PARITY_STAGES (comma list of stage ids) and BATTLE_PARITY_LIMIT (cases per stage) narrow a run while developing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BattleService, BattleSetupError } from "../../src/engine/battle";
import { loadPacks, PACK_FILES, type PackName } from "../../src/engine/content";
import { StoryRules } from "../../src/engine/story";
import { loadFixture } from "./fixtures";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");
const readPack = (name: string): unknown => JSON.parse(readFileSync(join(CONTENT, name), "utf8"));
const registry = loadPacks(Object.fromEntries(PACK_FILES.map((name) => [name, readPack(name)])) as Record<PackName, unknown>);
const story = new StoryRules(registry, readPack("story_script_part1_manifest.json") as Record<string, unknown>);

type Any = Record<string, any>;

const show = (value: unknown): string => {
  const text = value === undefined ? "undefined" : JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
};
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * First difference of `actual` against parsed fixture JSON ("" = equal), like game/tests/parity/parity_compare.gd:
 * numbers by value, strings and bools exactly, arrays item by item, objects with exactly the same key set.
 */
function diff(actual: unknown, expected: unknown, path = "$"): string {
  if (expected === null) return actual === null ? "" : `${path}: expected null, got ${show(actual)}`;
  if (typeof expected === "boolean" || typeof expected === "number" || typeof expected === "string") {
    return actual === expected ? "" : `${path}: expected ${show(expected)}, got ${show(actual)}`;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${path}: expected an array, got ${show(actual)}`;
    if (actual.length !== expected.length) return `${path}: expected ${expected.length} items, got ${actual.length}`;
    for (let index = 0; index < expected.length; index++) {
      const found = diff(actual[index], expected[index], `${path}[${index}]`);
      if (found) return found;
    }
    return "";
  }
  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) return `${path}: expected an object, got ${show(actual)}`;
    for (const key of Object.keys(expected)) if (!Object.hasOwn(actual, key)) return `${path}: missing key ${key}`;
    for (const key of Object.keys(actual)) if (!Object.hasOwn(expected, key)) return `${path}: unexpected key ${key}`;
    for (const key of Object.keys(expected)) {
      const found = diff(actual[key], expected[key], `${path}.${key}`);
      if (found) return found;
    }
    return "";
  }
  return `${path}: unsupported fixture value ${show(expected)}`;
}

const service = BattleService.create(registry, story);

/** First difference of one recorded case against a fresh run ("" = identical). */
function runCase(stageId: string, testCase: Any): string {
  const input = testCase.input as Any;
  const storyState = story.newPlayerState();
  storyState.owned_character_ids = new Set(input.owned_character_ids as string[]);
  const result = service.run(stageId, input.roster, {
    story_state: storyState, player_levels: input.player_levels, equipment: input.equipment,
    skill_ranks: input.skill_ranks, memory_nodes: input.memory_nodes,
    run_seed: BigInt(testCase.seed as string),
  });
  if (result.error) return `run failed: ${result.error}`;
  if (result.outcome !== testCase.outcome) return `outcome ${result.outcome}, expected ${testCase.outcome}`;
  const events = testCase.events as unknown[];
  const actual = result.state!.battle_events;
  for (let index = 0; index < Math.min(actual.length, events.length); index++) {
    const found = diff(actual[index], events[index], `events[${index}]`);
    if (found) return found;
  }
  if (actual.length !== events.length) return `event count ${actual.length}, expected ${events.length}`;
  if (result.stars !== testCase.stars) return `stars ${result.stars}, expected ${testCase.stars}`;
  if (result.actions !== testCase.actions) return `actions ${result.actions}, expected ${testCase.actions}`;
  if (result.cycles !== testCase.cycles) return `cycles ${result.cycles}, expected ${testCase.cycles}`;
  return diff(result.final_units, testCase.final_units, "final_units");
}

describe("deep diff helper", () => {
  it("reports the first differing path and exact key sets", () => {
    expect(diff({ a: 1, b: [1, { c: "x" }] }, { a: 1.0, b: [1, { c: "x" }] })).toBe("");
    expect(diff({ a: 1, b: [1, { c: "y" }] }, { a: 1, b: [1, { c: "x" }] })).toBe('$.b[1].c: expected "x", got "y"');
    expect(diff({ a: 1 }, { a: 1, b: null })).toBe("$: missing key b");
    expect(diff({ a: 1, b: undefined }, { a: 1 })).toBe("$: unexpected key b");
    expect(diff({ a: undefined }, { a: null })).toBe("$.a: expected null, got undefined");
  });
});

describe("BattleService against parity/fixtures/battle_*.json", () => {
  const wanted = (process.env.BATTLE_PARITY_STAGES ?? "").split(",").filter(Boolean);
  const limit = Number(process.env.BATTLE_PARITY_LIMIT ?? 1_000_000);
  const stageIds = [...registry.stages.keys()].filter((stageId) => wanted.length === 0 || wanted.includes(stageId));

  it("replays every recorded battle", () => {
    expect(stageIds.length).toBe(wanted.length === 0 ? 35 : wanted.length);
    let replayed = 0;
    const failures: string[] = [];
    for (const stageId of stageIds) {
      const fixture = loadFixture<Any>(`battle_${stageId}`);
      const cases = fixture.cases as Any[];
      expect(cases.length, `fixture for ${stageId}`).toBeGreaterThan(0);
      for (const testCase of cases.slice(0, limit)) {
        const found = runCase(stageId, testCase);
        replayed++;
        if (found) failures.push(`${stageId} ${testCase.variant} seed ${testCase.seed}: ${found}`);
      }
    }
    expect(failures.slice(0, 8), `${failures.length} battles differ`).toEqual([]);
    if (wanted.length === 0 && limit >= 15) expect(replayed).toBe(525);
  }, 120_000);
});

describe("BattleService loadouts against parity/fixtures/loadouts.json", () => {
  const fixture = (loadFixture<Any>("loadouts").cases as Any[])[0]!;

  it("resolved stats for every character, level and loadout", () => {
    const rows = fixture.resolve as Any[];
    expect(rows.length).toBe(20 * 3 * 7);
    for (const row of rows) {
      const character = registry.characters.get(row.character_id)!;
      const stats = service.resolveEquipment(character, row.base, row.loadout);
      expect(diff(stats, row.stats), `${row.character_id} L${row.level} ${row.loadout_name}`).toBe("");
    }
  });

  it("rejected loadouts", () => {
    const rows = fixture.invalid as Any[];
    expect(rows.length).toBe(4);
    for (const row of rows) {
      const character = registry.characters.get(row.character_id)!;
      expect(() => service.resolveEquipment(character, { hp: 10 }, row.loadout), `${row.loadout_name} (${row.raises})`).toThrow(BattleSetupError);
    }
  });

  it("Memory Nodes", () => {
    const rows = fixture.memory_nodes as Any[];
    expect(rows.length).toBe(20 * 5);
    for (const row of rows) {
      const [stats, startFocus] = service.applyMemoryNodes(row.base, row.unlocked);
      const label = `${row.character_id} with ${row.unlocked} nodes`;
      expect(diff(stats, row.stats), label).toBe("");
      expect(startFocus, label).toBe(row.start_focus);
    }
  });
});

describe("BattleService story loans against parity/fixtures/story_loans.json", () => {
  it("the deterministic 3-star field kit of every story guest", () => {
    const cases = loadFixture<Any>("story_loans").cases as Any[];
    expect(cases.length).toBe(66);
    for (const row of cases) {
      const loadout = service.storyLoanLoadout(registry.characters.get(row.character_id)!, row.stage_id);
      expect(diff(loadout, row.loadout), `${row.character_id} at ${row.stage_id}`).toBe("");
    }
  });
});
