import { DropConfig, rollEntries, type DropEntry, type DropPools, type Granted } from '@uomd/economy';
import { cryptoRoll } from '../db/rng';
import { HttpError } from '../content/store';
import type { RuntimeCatalog } from '../content/runtime-catalog';

type Slot = 'weapon' | 'armor' | 'accessory';

export async function loadDropConfig(db: D1Database): Promise<DropConfig | null> {
  const row = await db.prepare("SELECT value_json FROM game_config WHERE key = 'drops'").first<{ value_json: string }>();
  if (!row) return null;
  const parsed = DropConfig.safeParse(JSON.parse(row.value_json));
  return parsed.success ? parsed.data : null;
}

/** Loads exactly the template pools the given entries can need (one query per slot / boss set), then answers synchronously. */
async function loadPools(db: D1Database, entries: readonly DropEntry[], bossSetId: string | undefined, catalog?: RuntimeCatalog): Promise<DropPools> {
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
    const results = catalog ? catalog.data.gear.filter((g) => g.status === 'active' && (slot === 'accessory' ? g.slot === 'necklace' || g.slot === 'ring' : g.slot === slot) && (slot !== 'weapon' || !g.owner_character_id && !g.source_banner_id)) : (await db.prepare(sql).all<{ gear_id: string; rarity: number }>()).results;
    for (const r of results) if (rs.has(r.rarity)) gear.set(`${slot}:${r.rarity}`, [...(gear.get(`${slot}:${r.rarity}`) ?? []), r.gear_id]);
  }
  if (bossSetId && bossRarities.size > 0) {
    const results = catalog ? catalog.data.gear.filter((g) => g.set_id === bossSetId && (g.slot === 'necklace' || g.slot === 'ring') && g.status === 'active') : (await db.prepare("SELECT gear_id, rarity FROM gear_defs WHERE set_id = ?1 AND slot IN ('necklace','ring') AND status = 'active'").bind(bossSetId).all<{ gear_id: string; rarity: number }>()).results;
    for (const r of results) sets.set(`${bossSetId}:${r.rarity}`, [...(sets.get(`${bossSetId}:${r.rarity}`) ?? []), r.gear_id]);
  }
  return {
    gear: (slot, rarities) => rarities.flatMap((r) => gear.get(`${slot}:${r}`) ?? []),
    bossSet: (setId, rarity) => sets.get(`${setId}:${rarity}`) ?? []
  };
}

/** Server CSPRNG; unknown tables fail for release catalogs and keep the legacy no-drop contract otherwise. */
export async function rollNodeDrops(db: D1Database, drop: { table: string; boss_set_id?: string } | undefined, firstClear: boolean, repeatAllowed = true, catalog?: RuntimeCatalog): Promise<{ first: Granted[]; repeat: Granted[] }> {
  const none = { first: [], repeat: [] };
  if (!drop || !firstClear && !repeatAllowed) return none;
  const config = catalog?.data.config.drops ?? await loadDropConfig(db);
  const table = config && Object.hasOwn(config.tables, drop.table) ? config.tables[drop.table] : undefined;
  if (!table) {
    if (catalog) throw new HttpError(503, 'release_catalog_invalid', 'the drop table is unavailable in this release');
    return none;
  }
  const eligible = [...(firstClear ? table.firstClear : []), ...(repeatAllowed ? table.repeat : [])];
  const pools = await loadPools(db, eligible, drop.boss_set_id, catalog);
  const ctx = drop.boss_set_id ? { bossSetId: drop.boss_set_id } : {};
  return { first: firstClear ? rollEntries(table.firstClear, cryptoRoll, pools, ctx) : [], repeat: repeatAllowed ? rollEntries(table.repeat, cryptoRoll, pools, ctx) : [] };
}
