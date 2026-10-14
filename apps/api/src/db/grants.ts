import type { RewardAttachment } from '@uomd/content-schema';
import { CANON, rollAccessory, type AccessoryDef } from '@uomd/economy';
import { HttpError } from '../content/store';
import { ledgerStatements } from './ledger';
import { cryptoRoll } from './rng';
import { identityStatement } from './identities';
import { catalogCharacter, catalogGear, type RuntimeCatalog } from '../content/runtime-catalog';

/**
 * The one place that turns reward attachments (currency, character, material item, account XP) into D1 statements, so mail claims,
 * stage rewards, purchases and quests all grant exactly the same way. The caller puts the statements into its own transactional
 * batch (together with its idempotency guard). `keyPrefix` + attachment index form the ledger idempotency keys.
 */
export async function grantStatements(db: D1Database, playerId: string, atts: readonly RewardAttachment[], o: { keyPrefix: string; reason: string; catalog?: RuntimeCatalog }): Promise<D1PreparedStatement[]> {
  const out: D1PreparedStatement[] = [];
  for (const [i, a] of atts.entries()) {
    const key = `${o.keyPrefix}:${i}`;
    if (a.type === 'currency') {
      out.push(...ledgerStatements(db, { playerId, currency: a.currency, delta: a.amount, reason: o.reason, idempotencyKey: key }),
        grantJournalStatement(db, playerId, a, key, o.reason, "json_object('amountAdded', ?5, 'balanceAfter', (SELECT balance FROM wallets WHERE player_id = ?1 AND currency = 'eclipse_token'))", [a.amount]));
    } else if (a.type === 'character') {
      const c = o.catalog ? catalogCharacter(o.catalog, a.itemId) : await db.prepare("SELECT rarity FROM characters WHERE id = ?1 AND status <> 'retired'").bind(a.itemId).first<{ rarity: number }>();
      if (!c) throw new HttpError(422, 'unknown_item', `character ${a.itemId} does not exist`);
      const shards = CANON.duplicateShards[c.rarity as 3 | 4 | 5] ?? 2;
      out.push(
        ...(o.catalog ? [identityStatement(db, 'character', a.itemId)] : []),
        characterGrantStatement(db, playerId, a.itemId, shards),
        characterGrantJournalStatement(db, playerId, a.itemId, shards, key, o.reason)
      );
    } else if (a.type === 'item') {
      const def = o.catalog ? o.catalog.data.items.find((item) => item.item_id === a.itemId && item.status !== 'retired') : await db.prepare("SELECT stack_cap FROM item_defs WHERE item_id = ?1 AND status <> 'retired'").bind(a.itemId).first<{ stack_cap: number }>();
      if (!def) throw new HttpError(422, 'unknown_item', `item ${a.itemId} does not exist`);
      // Record the actual clamped addition inside the same transaction, before changing the stack.
      out.push(...(o.catalog ? [identityStatement(db, 'item', a.itemId)] : []), grantJournalStatement(db, playerId, a, key, o.reason,
        "json_object('quantityBefore', COALESCE((SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?5), 0), 'quantityAdded', MIN(?7 - COALESCE((SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?5), 0), ?6))", [a.itemId, a.quantity, def.stack_cap]),
        stackAdd(db, playerId, a.itemId, a.quantity, def.stack_cap));
    } else if (a.type === 'gear') {
      out.push(...(o.catalog ? [identityStatement(db, 'gear', a.gearId)] : []), await gearInstanceStatement(db, playerId, a.gearId, o.catalog), gearGrantJournalStatement(db, playerId, a.gearId, key, o.reason));
    } else {
      out.push(db.prepare('INSERT INTO player_account (player_id, xp) VALUES (?1, ?2) ON CONFLICT (player_id) DO UPDATE SET xp = xp + ?2').bind(playerId, a.amount),
        grantJournalStatement(db, playerId, a, key, o.reason, "json_object('xpAdded', ?5, 'xpAfter', (SELECT xp FROM player_account WHERE player_id = ?1))", [a.amount]));
    }
  }
  return out;
}

/** Both pulls and attachment grants classify the existing copy in their committed transaction. */
export const characterGrantStatement = (db: D1Database, playerId: string, characterId: string, duplicateShards: number): D1PreparedStatement =>
  db.prepare("INSERT INTO player_items (player_id, item_type, item_id, copies, shards) VALUES (?1, 'character', ?2, 1, 0) ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET copies = copies + 1, shards = shards + ?3")
    .bind(playerId, characterId, duplicateShards);

function grantJournalStatement(db: D1Database, playerId: string, attachment: RewardAttachment, key: string, reason: string, result: string, bindings: (string | number)[]): D1PreparedStatement {
  return db.prepare(`INSERT INTO reward_grants (player_id, grant_key, reason, attachment_json, result_json) VALUES (?1, ?2, ?3, ?4, ${result})`)
    .bind(playerId, key, reason, JSON.stringify(attachment), ...bindings);
}

export const characterGrantJournalStatement = (db: D1Database, playerId: string, characterId: string, duplicateShards: number, key: string, reason: string): D1PreparedStatement =>
  grantJournalStatement(db, playerId, { type: 'character', itemId: characterId }, key, reason,
    "(SELECT json_object('copiesAdded', 1, 'shardsAdded', CASE WHEN copies > 1 THEN ?6 ELSE 0 END, 'copiesAfter', copies, 'shardsAfter', shards) FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?5)", [characterId, duplicateShards]);

/** Must immediately follow the instance INSERT in its batch; last_insert_rowid identifies that exact gear. */
export const gearGrantJournalStatement = (db: D1Database, playerId: string, gearId: string, key: string, reason: string): D1PreparedStatement =>
  grantJournalStatement(db, playerId, { type: 'gear', gearId }, key, reason, "json_object('instanceId', last_insert_rowid(), 'gearId', ?5)", [gearId]);

/** Adds to a material stack, clamped to the item's stack cap. */
export const stackAdd = (db: D1Database, playerId: string, itemId: string, qty: number, cap: number): D1PreparedStatement =>
  db
    .prepare('INSERT INTO player_stacks (player_id, item_id, qty) VALUES (?1, ?2, MIN(?3, ?4)) ON CONFLICT (player_id, item_id) DO UPDATE SET qty = MIN(?3, qty + ?4)')
    .bind(playerId, itemId, cap, qty);

/** Missing stacks also propose a negative quantity, so CHECK (qty >= 0) aborts the complete batch. */
export const stackSpend = (db: D1Database, playerId: string, itemId: string, qty: number): D1PreparedStatement =>
  db
    .prepare('INSERT INTO player_stacks (player_id, item_id, qty) VALUES (?1, ?2, COALESCE((SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?2), 0) - ?3) ON CONFLICT (player_id, item_id) DO UPDATE SET qty = player_stacks.qty - ?3')
    .bind(playerId, itemId, qty);

/** Creates one gear instance. Accessories roll their main/sub stats NOW (server CSPRNG) and keep them in the instance. */
export async function gearInstanceStatement(db: D1Database, playerId: string, gearId: string, catalog?: RuntimeCatalog): Promise<D1PreparedStatement> {
  const row = catalog ? catalogGear(catalog, gearId) : undefined;
  const def = row ? { slot: row.slot, extra_json: JSON.stringify(row.extra) } : await db.prepare("SELECT slot, extra_json FROM gear_defs WHERE gear_id = ?1 AND status <> 'retired'").bind(gearId).first<{ slot: string; extra_json: string }>();
  if (!def) throw new HttpError(422, 'unknown_item', `gear ${gearId} does not exist`);
  const stats = def.slot === 'necklace' || def.slot === 'ring' ? JSON.stringify(rollAccessory(JSON.parse(def.extra_json) as AccessoryDef, cryptoRoll)) : '{}';
  return db.prepare('INSERT INTO player_gear (player_id, gear_id, slot, stats_json) VALUES (?1, ?2, ?3, ?4)').bind(playerId, gearId, def.slot, stats);
}
