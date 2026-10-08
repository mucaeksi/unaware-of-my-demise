import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPacks, PACK_FILES, type ContentRegistry, type PackName, type Stage } from "../../src/engine/content";
import { LootError, LootResolver, type ClaimFirstClear } from "../../src/engine/loot";
import { CpythonRandom } from "../../src/engine/random";
import { loadFixture } from "./fixtures";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");
const registry = loadPacks(
  Object.fromEntries(PACK_FILES.map((name) => [name, JSON.parse(readFileSync(join(CONTENT, name), "utf8"))])) as Record<PackName, unknown>,
);
const resolver = new LootResolver(registry);
const ACCOUNT = "parity_account";
const SYNTHETIC_TABLE = "synthetic_table";
const alwaysNew: ClaimFirstClear = () => true;

type Any = Record<string, any>;
const fixture = loadFixture<Any>("loot");

const resolve = (stage: Stage, firstClear: boolean, rng: CpythonRandom, claim: ClaimFirstClear) =>
  resolver.resolveBattleRewards(stage.drop_table_id, firstClear, ACCOUNT, claim, rng, stage.stage_id, stage.boss_id);

async function failure(promise: Promise<unknown>): Promise<LootError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof LootError) return error;
    throw error;
  }
  throw new Error("expected a LootError");
}

describe("LootResolver against parity/fixtures/loot.json", () => {
  it("every stage, first clear on/off, 12 seeds", async () => {
    expect(fixture.cases.length).toBe(35 * 2 * 12);
    for (const entry of fixture.cases) {
      const stage = registry.stages.get(entry.stage_id)!;
      const rng = new CpythonRandom(BigInt(entry.seed));
      const label = `${entry.stage_id} first_clear=${entry.first_clear} seed=${entry.seed}`;
      expect(await resolve(stage, entry.first_clear, rng, alwaysNew), label).toEqual(entry.rewards);
      expect(rng.randomU53(), `${label} (draws consumed)`).toBe(entry.rng_next_u53);
      expect(stage.drop_table_id).toBe(entry.drop_table_id);
    }
  });

  it("the same stage cleared twice pays first-clear rows once", async () => {
    expect(fixture.replays.length).toBe(35);
    for (const entry of fixture.replays) {
      const stage = registry.stages.get(entry.stage_id)!;
      const rng = new CpythonRandom(BigInt(entry.seed));
      const claimed = new Set<string>();
      const ledger: ClaimFirstClear = (accountId, claimType) => {
        const key = `${accountId}|${claimType}`;
        if (claimed.has(key)) return false;
        claimed.add(key);
        return true;
      };
      expect(await resolve(stage, true, rng, ledger), `${stage.stage_id} first`).toEqual(entry.first);
      expect(await resolve(stage, true, rng, ledger), `${stage.stage_id} second`).toEqual(entry.second);
    }
  });

  it("failures carry the reference's exception class", async () => {
    const shared = [...registry.stages.values()].find((stage) => stage.boss_id)!;
    const calls: Record<string, () => Promise<unknown>> = {
      shared_boss_table_without_stage: () => resolver.resolveBattleRewards(shared.drop_table_id, true, ACCOUNT, alwaysNew, new CpythonRandom(1)),
      unknown_drop_table: () => resolver.resolveBattleRewards("no_such_table", false, ACCOUNT, alwaysNew, new CpythonRandom(1)),
      empty_account: () => resolver.resolveBattleRewards([...registry.drop_tables.keys()][0]!, false, "", alwaysNew, new CpythonRandom(1)),
    };
    expect(fixture.failures.length).toBe(Object.keys(calls).length);
    for (const row of fixture.failures) expect((await failure(calls[row.name]!())).kind, row.name).toBe(row.raises);
  });

  it("asks the claim ledger only for first-clear rows", async () => {
    const asked: [string, string][] = [];
    const ledger: ClaimFirstClear = (accountId, claimType) => {
      asked.push([accountId, claimType]);
      return true;
    };
    const stage = registry.stages.get("1-1")!;
    await resolve(stage, false, new CpythonRandom(1), ledger);
    expect(asked).toEqual([]);
    await resolve(stage, true, new CpythonRandom(1), ledger);
    expect(asked).toEqual([[ACCOUNT, "first_clear_stage:1-1"]]);
    // A refused (duplicate) claim grants and draws nothing beyond the repeatable rows.
    const refusedRng = new CpythonRandom(1);
    const plainRng = new CpythonRandom(1);
    const refused = await resolve(stage, true, refusedRng, () => false);
    const plain = await resolve(stage, false, plainRng, () => false);
    expect(refused.length).toBe(plain.length);
    expect(refusedRng.randomU53()).toBe(plainRng.randomU53());
  });

  it("hand-made tables reach every validation branch", async () => {
    expect(fixture.synthetic.length).toBeGreaterThan(70);
    let raised = 0;
    let succeeded = 0;
    for (const { scenario, result: expected } of fixture.synthetic) {
      const firstClearRows = scenario.first_clear ?? [];
      const bound: string = scenario.bind_stage ?? "";
      // A registry copy carrying the synthetic table (the shared one stays untouched).
      const stages = new Map(registry.stages);
      if (bound) stages.set(bound, { ...registry.stages.get(bound)!, drop_table_id: SYNTHETIC_TABLE });
      const patched: ContentRegistry = {
        ...registry,
        stages,
        drop_tables: new Map(registry.drop_tables).set(SYNTHETIC_TABLE, {
          drop_table_id: SYNTHETIC_TABLE,
          repeatable_rewards: scenario.repeatable,
          first_clear_rewards: firstClearRows,
          extra: {},
        }),
        drop_pack: {
          ...registry.drop_pack,
          drop_tables: [
            ...(registry.drop_pack.drop_tables as unknown[]),
            {
              drop_table_id: SYNTHETIC_TABLE,
              repeatable_rewards: scenario.repeatable,
              first_clear_rewards: firstClearRows,
              first_clear_claim_scope: scenario.claim_scope ?? "account_id+stage_id",
            },
          ],
        } as ContentRegistry["drop_pack"],
      };
      const rng = new CpythonRandom(scenario.seed);
      const run = new LootResolver(patched).resolveBattleRewards(
        SYNTHETIC_TABLE, scenario.is_first_clear ?? false, ACCOUNT, alwaysNew, rng, scenario.stage_id ?? bound, scenario.boss_id ?? null,
      );
      if (expected.raises !== null) {
        raised += 1;
        const error = await failure(run);
        expect(error.kind, scenario.name).toBe(expected.raises);
        expect(error.message, scenario.name).toBe(expected.message);
      } else {
        succeeded += 1;
        expect(await run, scenario.name).toEqual(expected.rewards);
        expect(rng.randomU53(), `${scenario.name} (draws consumed)`).toBe(expected.rng_next_u53);
      }
    }
    expect(raised).toBeGreaterThan(40);
    expect(succeeded).toBeGreaterThan(20);
  });
});
