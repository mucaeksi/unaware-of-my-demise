import type { RewardAttachment } from '@uomd/content-schema';
import { CANON, rollAccessory, type AccessoryDef } from '@uomd/economy';
import { HttpError } from '../content/store';
import { ledgerStatements } from './ledger';
import { cryptoRoll } from './rng';

/**
 * The one place that turns reward attachments (currency, character, material item, account XP) into D1 statements, so mail claims,
 * stage rewards, purchases and quests all grant exactly the same way. The caller puts the statements into its own transactional
 * batch (together with its idempotency guard). `keyPrefix` + attachment index form the ledger idempotency keys.
 */
export async function grantStatements(db: D1Database, playerId: string, atts: readonly RewardAttachment[], o: { keyPrefix: string; reason: string }): Promise<D1PreparedStatement[]> {
  const out: D1PreparedStatement[] = [];
  for (const [i, a] of atts.entries()) {
    if (a.type === 'currency') {
      out.push(...ledgerStatements(db, { playerId, currency: a.currency, delta: a.amount, reason: o.reason, idempotencyKey: `${o.keyPrefix}:${i}` }));
    } else if (a.type === 'character') {
      const c = await db.prepare("SELECT rarity FROM characters WHERE id = ?1 AND status <> 'retired'").bind(a.itemId).first<{ rarity: number }>();
      if (!c) throw new HttpError(422, 'unknown_item', `character ${a.itemId} does not exist`);
      const shards = CANON.duplicateShards[c.rarity as 3 | 4 | 5] ?? 2;
      out.push(
        db
          .prepare("INSERT INTO player_items (player_id, item_type, item_id, copies, shards) VALUES (?1, 'character', ?2, 1, 0) ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET copies = copies + 1, shards = shards + ?3")
          .bind(playerId, a.itemId, shards)
      );
    } else if (a.type === 'item') {
      const def = await db.prepare("SELECT stack_cap FROM item_defs WHERE item_id = ?1 AND status <> 'retired'").bind(a.itemId).first<{ stack_cap: number }>();
      if (!def) throw new HttpError(422, 'unknown_item', `item ${a.itemId} does not exist`);
      out.push(stackAdd(db, playerId, a.itemId, a.quantity, def.stack_cap));
    } else if (a.type === 'gear') {
      out.push(await gearInstanceStatement(db, playerId, a.gearId));
    } else {
      out.push(db.prepare('INSERT INTO player_account (player_id, xp) VALUES (?1, ?2) ON CONFLICT (player_id) DO UPDATE SET xp = xp + ?2').bind(playerId, a.amount));
    }
  }
  return out;
}

/** Adds to a material stack, clamped to the item's stack cap. */
export const stackAdd = (db: D1Database, playerId: string, itemId: string, qty: number, cap: number): D1PreparedStatement =>
  db
    .prepare('INSERT INTO player_stacks (player_id, item_id, qty) VALUES (?1, ?2, MIN(?3, ?4)) ON CONFLICT (player_id, item_id) DO UPDATE SET qty = MIN(?3, qty + ?4)')
    .bind(playerId, itemId, cap, qty);

/** Spends from a material stack; the CHECK (qty >= 0) aborts the whole batch when the player does not have enough. */
export const stackSpend = (db: D1Database, playerId: string, itemId: string, qty: number): D1PreparedStatement =>
  db.prepare('UPDATE player_stacks SET qty = qty - ?3 WHERE player_id = ?1 AND item_id = ?2').bind(playerId, itemId, qty);

/** Creates one gear instance. Accessories roll their main/sub stats NOW (server CSPRNG) and keep them in the instance. */
export async function gearInstanceStatement(db: D1Database, playerId: string, gearId: string): Promise<D1PreparedStatement> {
  const def = await db.prepare("SELECT slot, extra_json FROM gear_defs WHERE gear_id = ?1 AND status <> 'retired'").bind(gearId).first<{ slot: string; extra_json: string }>();
  if (!def) throw new HttpError(422, 'unknown_item', `gear ${gearId} does not exist`);
  const stats = def.slot === 'necklace' || def.slot === 'ring' ? JSON.stringify(rollAccessory(JSON.parse(def.extra_json) as AccessoryDef, cryptoRoll)) : '{}';
  return db.prepare('INSERT INTO player_gear (player_id, gear_id, slot, stats_json) VALUES (?1, ?2, ?3, ?4)').bind(playerId, gearId, def.slot, stats);
}
