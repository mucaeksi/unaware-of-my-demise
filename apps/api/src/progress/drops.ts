import { DropConfig, rollEntries, type DropEntry, type DropPools, type Granted } from '@uomd/economy';
import { cryptoRoll } from '../db/rng';

type Slot = 'weapon' | 'armor' | 'accessory';

export async function loadDropConfig(db: D1Database): Promise<DropConfig | null> {
  const row = await db.prepare("SELECT value_json FROM game_config WHERE key = 'drops'").first<{ value_json: string }>();
  if (!row) return null;
  const parsed = DropConfig.safeParse(JSON.parse(row.value_json));
  return parsed.success ? parsed.data : null;
}

/** Loads exactly the template pools the given entries can need (one query per slot / boss set), then answers synchronously. */
async function loadPools(db: D1Database, entries: readonly DropEntry[], bossSetId: string | undefined): Promise<DropPools> {
  const gear = new Map<string, string[]>();
  const sets = new Map<string, string[]>();
  const slots = new Map<Slot, Set<number>>();
  const bossRarities = new Set<number>();
  for (const e of entries) {
    if (e.kind === 'gear_pool') {
      const s = slots.get(e.slot) ?? new Set<number>();
      e.rarities.forEach((r) => s.add(r));
      slots.set(e.slot, s);
    } else if (e.kind === 'boss_set') bossRarities.add(e.rarity);
  }
  for (const [slot, rs] of slots) {
    const sql =
      slot === 'weapon'
        ? "SELECT gear_id, rarity FROM gear_defs WHERE slot = 'weapon' AND status = 'active' AND owner_character_id IS NULL AND banner_id IS NULL"
        : slot === 'armor'
          ? "SELECT gear_id, rarity FROM gear_defs WHERE slot = 'armor' AND status = 'active'"
          : "SELECT gear_id, rarity FROM gear_defs WHERE slot IN ('necklace','ring') AND status = 'active'";
    const { results } = await db.prepare(sql).all<{ gear_id: string; rarity: number }>();
    for (const r of results) if (rs.has(r.rarity)) gear.set(`${slot}:${r.rarity}`, [...(gear.get(`${slot}:${r.rarity}`) ?? []), r.gear_id]);
  }
  if (bossSetId && bossRarities.size > 0) {
    const { results } = await db.prepare("SELECT gear_id, rarity FROM gear_defs WHERE set_id = ?1 AND slot IN ('necklace','ring') AND status = 'active'").bind(bossSetId).all<{ gear_id: string; rarity: number }>();
    for (const r of results) sets.set(`${bossSetId}:${r.rarity}`, [...(sets.get(`${bossSetId}:${r.rarity}`) ?? []), r.gear_id]);
  }
  return {
    gear: (slot, rarities) => rarities.flatMap((r) => gear.get(`${slot}:${r}`) ?? []),
    bossSet: (setId, rarity) => sets.get(`${setId}:${rarity}`) ?? []
  };
}

/** Rolls a node's drop table with the server CSPRNG. Unknown tables drop nothing (content is validated at publish; config is admin-editable). */
export async function rollNodeDrops(db: D1Database, drop: { table: string; boss_set_id?: string } | undefined, firstClear: boolean): Promise<{ first: Granted[]; repeat: Granted[] }> {
  const none = { first: [], repeat: [] };
  if (!drop) return none;
  const table = (await loadDropConfig(db))?.tables[drop.table];
  if (!table) return none;
  const pools = await loadPools(db, firstClear ? [...table.firstClear, ...table.repeat] : table.repeat, drop.boss_set_id);
  const ctx = drop.boss_set_id ? { bossSetId: drop.boss_set_id } : {};
  return { first: firstClear ? rollEntries(table.firstClear, cryptoRoll, pools, ctx) : [], repeat: rollEntries(table.repeat, cryptoRoll, pools, ctx) };
}
