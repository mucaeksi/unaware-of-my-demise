// The content ids a player's saved state can point at (INF-005, INF-023). The server stores them in rows (roster,
// inventories, skill ranks, completed stages, claims, the story cursor), so a content release that renames or drops one
// would orphan saved state. `game/data/stable_ids.lock.json` records every id ever shipped; test/stable-ids.test.ts
// fails when one disappears without being listed as retired, and when the story order is not an append of the shipped one.
import economy from "../../game/data/content/economy_part1.json";
import { contentRegistry, storyRules } from "./rules";

export interface StableIds {
  characters: string[];
  skills: string[];
  items: string[];
  weapons: string[];
  armors: string[];
  accessories: string[];
  stages: string[];
  currencies: string[];
  daily_tasks: string[];
  weekly_segments: string[];
  /** In order: the story cursor is an index into it. */
  story_order: string[];
}

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();
const ids = (rows: unknown): string[] => (Array.isArray(rows) ? rows.map((row) => String((row as { id?: unknown }).id ?? "")).filter(Boolean) : []);

/** The ids the bundled content defines now. */
export function currentStableIds(): StableIds {
  const registry = contentRegistry();
  const pack = economy as { currencies?: unknown; daily_schedule?: { tasks?: unknown }; weekly_cycle?: { segments?: unknown } };
  return {
    characters: sorted(registry.characters.keys()),
    skills: sorted(registry.skills.keys()),
    items: sorted(registry.items.keys()),
    weapons: sorted(registry.weapons.keys()),
    armors: sorted(registry.armors.keys()),
    accessories: sorted(registry.accessories.keys()),
    stages: sorted(registry.stages.keys()),
    currencies: sorted(ids(pack.currencies)),
    daily_tasks: sorted(ids(pack.daily_schedule?.tasks)),
    weekly_segments: sorted(ids(pack.weekly_cycle?.segments)),
    story_order: [...storyRules().storyOrder()],
  };
}

export interface StableIdLock {
  /** Every id ever shipped, per kind (sorted; never shrinks). */
  shipped: Omit<StableIds, "story_order">;
  /** Ids deliberately taken out of content; saved state that holds them must be migrated by the release that retires them. */
  retired: Partial<Record<keyof Omit<StableIds, "story_order">, string[]>>;
  /** The shipped story order; a release may only append to it (the cursor is an index). */
  story_order: string[];
}

/** What a content release breaks against the lock: ids that vanished without being retired, and a rewritten story order. */
export function lockViolations(lock: StableIdLock, current: StableIds): string[] {
  const problems: string[] = [];
  for (const [kind, shipped] of Object.entries(lock.shipped) as [keyof StableIdLock["shipped"], string[]][]) {
    const present = new Set(current[kind]);
    const retired = new Set(lock.retired[kind] ?? []);
    for (const id of shipped) {
      if (!present.has(id) && !retired.has(id)) problems.push(`${kind}: '${id}' was shipped and is gone (rename/removal needs a retirement and a state migration)`);
    }
  }
  const order = current.story_order;
  lock.story_order.forEach((entry, index) => {
    if (order[index] !== entry) problems.push(`story_order[${index}] was '${entry}', is '${order[index] ?? "(missing)"}' (only appending keeps saved cursors valid)`);
  });
  return problems;
}

/** The lock with every current id added (nothing is ever removed from it). */
export function extendLock(lock: StableIdLock, current: StableIds): StableIdLock {
  const shipped = { ...lock.shipped };
  for (const kind of Object.keys(current) as (keyof StableIds)[]) {
    if (kind === "story_order") continue;
    shipped[kind] = sorted([...(lock.shipped[kind] ?? []), ...current[kind]]);
  }
  const story = current.story_order.length > lock.story_order.length ? current.story_order : lock.story_order;
  return { shipped, retired: lock.retired, story_order: [...story] };
}
