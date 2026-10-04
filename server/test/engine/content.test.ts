import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContentLoadError, loadPacks, PACK_FILES, type ContentRegistry, type PackName } from "../../src/engine/content";
import { loadFixture } from "./fixtures";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");

function packs(): Record<PackName, unknown> {
  return Object.fromEntries(PACK_FILES.map((name) => [name, JSON.parse(readFileSync(join(CONTENT, name), "utf8"))])) as Record<
    PackName,
    unknown
  >;
}

type Table = "accessories" | "armors" | "boss_objectives" | "boss_phases" | "characters" | "drop_tables" | "enemies" | "items" | "skills" | "stages" | "statuses" | "weapons";

const registryFixture = loadFixture<{ counts: Record<Table, number>; catalogs: Record<string, unknown> } & Record<Table, { id: string; record: unknown }[]>>(
  "content_registry",
);

describe("content loader against parity/fixtures/content_registry.json", () => {
  const registry: ContentRegistry = loadPacks(packs());

  for (const table of Object.keys(registryFixture.counts) as Table[]) {
    it(`${table}: same records, same order, field by field`, () => {
      const actual = registry[table] as Map<string, unknown>;
      expect(actual.size).toBe(registryFixture.counts[table]);
      expect([...actual.keys()]).toEqual(registryFixture[table].map((row) => row.id));
      for (const row of registryFixture[table]) expect(actual.get(row.id), `${table}[${row.id}]`).toEqual(row.record);
    });
  }

  it("catalogs", () => {
    for (const [name, expected] of Object.entries(registryFixture.catalogs)) {
      expect(registry[name as keyof ContentRegistry], name).toEqual(expected);
    }
  });

  it("keeps the numbers the battle code reads", () => {
    expect(registry.stages.get("1-1")!.enemy_stat_multiplier).toBe(1.0);
    expect(registry.stages.get("1-2")!.enemy_stat_multiplier).toBe(2.5);
    expect(registry.skills.get("mahmut_basic_oathless_cut")!.effect_ops[0]!.op).toBe("damage");
  });
});

interface Mutation {
  op: "set" | "delete" | "append_copy" | "replace_root";
  path?: (string | number)[];
  value?: unknown;
}

function apply(document: unknown, mutation: Mutation): unknown {
  if (mutation.op === "replace_root") return mutation.value;
  const path = mutation.path!;
  let parent = document as Record<string | number, unknown>;
  for (const step of path.slice(0, -1)) parent = parent[step] as Record<string | number, unknown>;
  const key = path.at(-1)!;
  if (mutation.op === "set") parent[key] = mutation.value;
  else if (mutation.op === "delete") delete parent[key];
  else (parent as unknown as unknown[]).push(structuredClone(parent[key]));
  return document;
}

describe("content loader against parity/fixtures/content_errors.json", () => {
  const errors = loadFixture<{ cases: { name: string; pack: PackName; mutations: Mutation[]; error: string }[] }>("content_errors");

  it("has the error cases", () => {
    expect(errors.cases.length).toBeGreaterThan(40);
  });

  for (const errorCase of errors.cases) {
    it(errorCase.name, () => {
      const broken = packs();
      broken[errorCase.pack] = errorCase.mutations.reduce(apply, broken[errorCase.pack]);
      let thrown: unknown = null;
      try {
        loadPacks(broken);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ContentLoadError);
      expect((thrown as Error).message).toBe(errorCase.error);
    });
  }
});
