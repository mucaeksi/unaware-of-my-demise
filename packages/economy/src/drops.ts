import { z } from 'zod';

/**
 * Drop tables (canon drop_tables_part1.json). Pure: given a table, a [0,1) random source and the item pools it returns what a win
 * grants. The server owns the randomness and records the resolved result; the client never decides loot.
 * All chance rolls are independent. `firstClear` entries are only rolled on a node's first clear; boss-set guarantees live there.
 */
const Chance = z.number().min(0).max(1);
const Qty = { min: z.number().int().min(1).max(9999), max: z.number().int().min(1).max(9999) };
const Id = z.string().regex(/^[a-z][a-z0-9_]{1,79}$/);

export const DropEntry = z.discriminatedUnion('kind', [
  /** the single main currency (D-17) */
  z.object({ kind: z.literal('currency'), min: z.number().int().min(1).max(1_000_000), max: z.number().int().min(1).max(1_000_000), chance: Chance }).strict(),
  z.object({ kind: z.literal('item'), itemId: Id, ...Qty, chance: Chance }).strict(),
  z.object({ kind: z.literal('item_pool'), itemIds: z.array(Id).min(1).max(40), ...Qty, chance: Chance }).strict(),
  /** a concrete gear template (e.g. a final-boss accessory) */
  z.object({ kind: z.literal('gear'), gearId: Id, chance: Chance }).strict(),
  /** one random template of the slot at one of the rarities ('accessory' = necklace or ring) */
  z.object({ kind: z.literal('gear_pool'), slot: z.enum(['weapon', 'armor', 'accessory']), rarities: z.array(z.number().int().min(1).max(5)).min(1).max(5), chance: Chance }).strict(),
  /** necklace or ring of the node's boss set at equal weight */
  z.object({ kind: z.literal('boss_set'), rarity: z.number().int().min(1).max(5), chance: Chance }).strict(),
  z.object({ kind: z.literal('account_xp'), amount: z.number().int().min(1).max(1_000_000), chance: Chance }).strict()
]);
export type DropEntry = z.infer<typeof DropEntry>;

export const DropTable = z.object({ repeat: z.array(DropEntry).max(24).default([]), firstClear: z.array(DropEntry).max(24).default([]) }).strict();
export type DropTable = z.infer<typeof DropTable>;

export const DropConfig = z
  .object({
    note: z.string().max(600).optional(),
    tables: z.record(Id, DropTable)
  })
  .strict()
  .superRefine((c, ctx) => {
    for (const [id, t] of Object.entries(c.tables)) {
      for (const e of [...t.repeat, ...t.firstClear]) {
        if ('min' in e && 'max' in e && e.min > e.max) ctx.addIssue({ code: 'custom', message: `table ${id}: min > max`, path: ['tables', id] });
      }
    }
  });
export type DropConfig = z.infer<typeof DropConfig>;

export type Granted =
  | { type: 'currency'; currency: 'eclipse_token'; amount: number }
  | { type: 'item'; itemId: string; quantity: number }
  | { type: 'gear'; gearId: string }
  | { type: 'account_xp'; amount: number };

/** Candidate templates the caller loaded from the catalog. Empty arrays simply drop nothing. */
export interface DropPools {
  gear(slot: 'weapon' | 'armor' | 'accessory', rarities: readonly number[]): readonly string[];
  bossSet(setId: string, rarity: number): readonly string[];
}

const between = (min: number, max: number, rng: () => number): number => min + Math.floor(rng() * (max - min + 1));
const pick = <T>(xs: readonly T[], rng: () => number): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))] as T;

export function rollEntries(entries: readonly DropEntry[], rng: () => number, pools: DropPools, ctx: { bossSetId?: string } = {}): Granted[] {
  const out: Granted[] = [];
  for (const e of entries) {
    if (e.chance < 1 && rng() >= e.chance) continue;
    switch (e.kind) {
      case 'currency':
        out.push({ type: 'currency', currency: 'eclipse_token', amount: between(e.min, e.max, rng) });
        break;
      case 'item':
        out.push({ type: 'item', itemId: e.itemId, quantity: between(e.min, e.max, rng) });
        break;
      case 'item_pool':
        out.push({ type: 'item', itemId: pick(e.itemIds, rng), quantity: between(e.min, e.max, rng) });
        break;
      case 'gear':
        out.push({ type: 'gear', gearId: e.gearId });
        break;
      case 'gear_pool': {
        const pool = pools.gear(e.slot, e.rarities);
        if (pool.length > 0) out.push({ type: 'gear', gearId: pick(pool, rng) });
        break;
      }
      case 'boss_set': {
        const pool = ctx.bossSetId ? pools.bossSet(ctx.bossSetId, e.rarity) : [];
        if (pool.length > 0) out.push({ type: 'gear', gearId: pick(pool, rng) });
        break;
      }
      case 'account_xp':
        out.push({ type: 'account_xp', amount: e.amount });
        break;
    }
  }
  return out;
}
