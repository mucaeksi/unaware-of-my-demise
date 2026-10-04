// The player snapshot the client renders (game/scripts/app/player_state.gd, DEC-0012), including the derived
// progression numbers of every hero (xp_to_next and level_up_silver_crowns are -1 at the level cap).
import { toSafeInt, type Db } from "./db";
import { isoUtcSeconds } from "./engine/quests";
import { currentRation, innMealAvailable, rationRules } from "./ration";
import { progression } from "./rules";
import { ATTEMPT_TTL_SECONDS } from "./stages";

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

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** The balances, with `ration` as of `nowUnix` (regeneration included). */
export async function wallet(db: Db, accountId: string, nowUnix: number = nowSeconds()): Promise<Record<string, number> | null> {
  const { rows } = await db.query<Record<string, unknown>>(
    "SELECT eclipse_tokens, fate_threads, silver_crowns, ration, account_xp FROM wallet WHERE account_id = $1",
    [accountId],
  );
  if (!rows[0]) return null;
  const balances = Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, toSafeInt(value)]));
  balances.ration = (await currentRation(db, accountId, nowUnix)).ration;
  return balances;
}

/**
 * Marks one committed change of the account's state (INF-012). Called by every mutating route inside its transaction,
 * after the account row was locked, so revisions of one account never repeat or go backwards.
 */
export async function bumpStateRevision(tx: Db, accountId: string): Promise<void> {
  const { rowCount } = await tx.query("UPDATE account SET state_revision = state_revision + 1 WHERE account_id = $1", [accountId]);
  if (rowCount !== 1) throw new Error(`account ${accountId} does not exist`);
}

/**
 * The player snapshot. Its queries must see one consistent database state: call it inside the mutation's transaction or
 * through `consistentRead`.
 */
export async function snapshot(db: Db, accountId: string, nowUnix: number = nowSeconds()): Promise<Record<string, unknown>> {
  const revision = await db.query<{ state_revision: unknown }>("SELECT state_revision FROM account WHERE account_id = $1", [accountId]);
  if (!revision.rows[0]) throw new Error(`account ${accountId} does not exist`);
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

  // The battle opened but not reported (INF-014): after a restart the client re-runs it from these frozen inputs.
  const open = await db.query<{ attempt_id: string; stage_id: string; roster: string[]; run_seed: unknown; inputs: unknown }>(
    "SELECT attempt_id, stage_id, roster, run_seed, inputs FROM stage_attempts " +
      "WHERE account_id = $1 AND status = 'open' AND created_at > now() - make_interval(secs => $2) ORDER BY created_at DESC LIMIT 1",
    [accountId, ATTEMPT_TTL_SECONDS],
  );
  const openRow = open.rows[0];

  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    // Grows by one with every committed mutation; unrelated to `schema_version` (the shape of this object).
    state_revision: toSafeInt(revision.rows[0].state_revision),
    story_state: story.rows[0].state,
    wallet: await wallet(db, accountId, nowUnix),
    ration: await rationSection(db, accountId, nowUnix),
    items,
    roster,
    inventory,
    open_attempt: openRow
      ? { attempt_id: openRow.attempt_id, stage_id: openRow.stage_id, run_seed: toSafeInt(openRow.run_seed), roster: openRow.roster, inputs: openRow.inputs }
      : null,
  };
}

/** The Ration meter the client shows: balance, cap and when the next unit / a full meter arrive (null when full). */
async function rationSection(db: Db, accountId: string, nowUnix: number): Promise<Record<string, unknown>> {
  const ration = await currentRation(db, accountId, nowUnix);
  const iso = (unix: number | null): string | null => (unix === null ? null : isoUtcSeconds(unix));
  return {
    current: ration.ration,
    cap: ration.cap,
    regen_seconds_per_unit: ration.regen_seconds_per_unit,
    next_unit_at_utc: iso(ration.next_unit_at_unix),
    full_at_utc: iso(ration.full_at_unix),
    inn_meal: { amount: rationRules().daily_inn_meal, available: await innMealAvailable(db, accountId, nowUnix) },
  };
}
