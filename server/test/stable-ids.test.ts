// INF-005/INF-023: shipped content ids never vanish and the story order is append-only. To record ids a new content
// release adds: `UPDATE_STABLE_IDS=1 npx vitest run test/stable-ids.test.ts` (it only ever adds).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { currentStableIds, extendLock, lockViolations, type StableIdLock } from "../src/stable-ids";

const LOCK = join(import.meta.dirname, "..", "..", "game", "data", "stable_ids.lock.json");
const empty = (): StableIdLock => ({
  shipped: { characters: [], skills: [], items: [], weapons: [], armors: [], accessories: [], stages: [], currencies: [], daily_tasks: [], weekly_segments: [] },
  retired: {},
  story_order: [],
});

describe("stable content ids", () => {
  it("every shipped id still exists (or is retired) and the story order only grew", () => {
    const current = currentStableIds();
    if (process.env.UPDATE_STABLE_IDS === "1") {
      let lock = empty();
      try {
        lock = JSON.parse(readFileSync(LOCK, "utf8")) as StableIdLock;
      } catch {
        // first lock
      }
      expect(lockViolations(lock, current), "fix the content before recording it").toEqual([]);
      writeFileSync(LOCK, JSON.stringify(extendLock(lock, current), null, 2) + "\n");
    }
    const lock = JSON.parse(readFileSync(LOCK, "utf8")) as StableIdLock;
    expect(lockViolations(lock, current)).toEqual([]);
    expect(extendLock(lock, current), "new ids must be recorded in the lock (UPDATE_STABLE_IDS=1)").toEqual(lock);
  });

  it("catches a renamed id, a retired one, and a rewritten story order", () => {
    const current = currentStableIds();
    const lock = extendLock(empty(), current);
    const renamed = { ...current, items: current.items.map((id, index) => (index === 0 ? `${id}_v2` : id)) };
    expect(lockViolations(lock, renamed)).toEqual([expect.stringContaining(`items: '${current.items[0]}' was shipped and is gone`)]);
    const retiredLock = { ...lock, retired: { items: [current.items[0]!] } };
    expect(lockViolations(retiredLock, renamed)).toEqual([]);
    const inserted = { ...current, story_order: ["new_prologue", ...current.story_order] };
    expect(lockViolations(lock, inserted)[0]).toContain("story_order[0]");
    const appended = { ...current, story_order: [...current.story_order, "epilogue_2"] };
    expect(lockViolations(lock, appended)).toEqual([]);
  });

  it("covers the ids saved state uses", () => {
    const current = currentStableIds();
    for (const [kind, ids] of Object.entries(current)) expect(ids.length, kind).toBeGreaterThan(0);
    expect(current.characters).toEqual(expect.arrayContaining(["fadyme", "mahmut"]));
    expect(current.currencies).toEqual(expect.arrayContaining(["eclipse_token", "fates_thread", "silver_crowns", "ration"]));
  });
});
