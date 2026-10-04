// The player snapshot the client renders (game/scripts/app/player_state.gd, DEC-0012), including the derived
// progression numbers of every hero (xp_to_next and level_up_silver_crowns are -1 at the level cap).
import { toSafeInt, type Db } from "./db";
import { progression } from "./rules";

export const SNAPSHOT_SCHEMA_VERSION = 1;

const EQUIPMENT_QUERIES: Record<string, string> = {
  inventory_weapons:
    "SELECT instance_id, weapon_id AS template_id, level, locked, equipped_character_id, 'weapon' AS equip_slot, payload " +
    "FROM inventory_weapons WHERE account_id = $1 ORDER BY acquired_seq",
  inventory_armor:
    "SELECT instance_id, armor_id AS template_id, level, locked, equipped_character_id, equip_slot, payload " +
    "FROM inventory_armor WHERE account_id = $1 ORDER BY acquired_seq",
  inventory_accessories:
    "SELECT instance_id, accessory_id AS template_id, 1 AS level, locked, equipped_character_id, equip_slot, payload " +
    "FROM inventory_accessories WHERE account_id = $1 ORDER BY acquired_seq",
};

export async function wallet(db: Db, accountId: string): Promise<Record<string, number> | null> {
  const { rows } = await db.query<Record<string, unknown>>(
    "SELECT eclipse_tokens, fate_threads, silver_crowns, ration, account_xp FROM wallet WHERE account_id = $1",
    [accountId],
  );
  if (!rows[0]) return null;
  return Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, toSafeInt(value)]));
}

export async function snapshot(db: Db, accountId: string): Promise<Record<string, unknown>> {
  const story = await db.query<{ state: unknown }>("SELECT state FROM story_state WHERE account_id = $1", [accountId]);
  if (!story.rows[0]) throw new Error(`account ${accountId} has no story state`);

  const items: Record<string, number> = {};
  const itemRows = await db.query<{ item_id: string; quantity: unknown }>(
    "SELECT item_id, quantity FROM inventory_items WHERE account_id = $1 AND quantity > 0 ORDER BY item_id",
    [accountId],
  );
  for (const row of itemRows.rows) items[row.item_id] = toSafeInt(row.quantity);

  const roster: Record<string, Record<string, unknown>> = {};
  const rosterRows = await db.query<Record<string, unknown> & { character_id: string }>(
    "SELECT character_id, level, xp, ascension, memory_shards, memory_nodes FROM roster WHERE account_id = $1 ORDER BY character_id",
    [accountId],
  );
  const rules = progression();
  const cap = rules.characterLevelCap();
  for (const { character_id, ...progress } of rosterRows.rows) {
    const level = toSafeInt(progress.level);
    roster[character_id] = {
      ...progress,
      xp_to_next: level < cap ? rules.xpToNext(level) : -1,
      level_cap: cap,
      level_up_silver_crowns: level < cap ? rules.levelUpSilverCrownsCost(level) : -1,
      skill_ranks: {},
    };
  }
  const rankRows = await db.query<{ character_id: string; skill_id: string; rank: number }>(
    "SELECT character_id, skill_id, rank FROM skill_ranks WHERE account_id = $1",
    [accountId],
  );
  for (const row of rankRows.rows) {
    const entry = roster[row.character_id];
    if (entry) (entry.skill_ranks as Record<string, number>)[row.skill_id] = row.rank;
  }

  const inventory: Record<string, unknown[]> = {};
  for (const [table, query] of Object.entries(EQUIPMENT_QUERIES)) inventory[table] = (await db.query(query, [accountId])).rows;

  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    story_state: story.rows[0].state,
    wallet: await wallet(db, accountId),
    items,
    roster,
    inventory,
  };
}
