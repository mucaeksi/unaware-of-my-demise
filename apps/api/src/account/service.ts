import { HttpError } from '../content/store';

/**
 * Everything the game holds about one player, as a plain JSON document (GDPR / Play "data safety" access request).
 * Large histories are bounded (newest first); `truncated` says when.
 */
export async function exportAccount(db: D1Database, playerId: string): Promise<Record<string, unknown>> {
  const q = async (sql: string): Promise<unknown[]> => (await db.prepare(sql).bind(playerId).all()).results;
  const [profile] = await q('SELECT id, created_at, display_name, last_seen_at, status FROM players WHERE id = ?1');
  const ledger = await q('SELECT id, currency, delta, reason, at FROM ledger WHERE player_id = ?1 ORDER BY id DESC LIMIT 2001');
  const pulls = await q('SELECT id, banner_id, pull_number, rarity, item_type, item_id, outcome, duplicate, at FROM gacha_pulls WHERE player_id = ?1 ORDER BY id DESC LIMIT 2001');
  const mail = await q('SELECT id, kind, title, body, attachments, created_at, read_at, claimed_at FROM mail WHERE player_id = ?1 ORDER BY id DESC LIMIT 501');
  return {
    exportedAt: new Date().toISOString(),
    profile,
    wallets: await q('SELECT currency, balance FROM wallets WHERE player_id = ?1'),
    ledger: ledger.slice(0, 2000),
    characters: await q("SELECT item_id, copies, shards FROM player_items WHERE player_id = ?1 AND item_type = 'character'"),
    characterGrowth: await q('SELECT character_id, level, xp, ascension, skill_ranks FROM player_chars WHERE player_id = ?1'),
    gear: await q('SELECT id, gear_id, slot, level, xp, ascension, equipped_by, locked, stats_json FROM player_gear WHERE player_id = ?1'),
    materials: await q('SELECT item_id, qty FROM player_stacks WHERE player_id = ?1'),
    account: await q('SELECT xp FROM player_account WHERE player_id = ?1'),
    progress: await q('SELECT node_id, stars, clears, best_turns FROM player_progress WHERE player_id = ?1'),
    teams: await q('SELECT slot, name, members_json, active FROM player_teams WHERE player_id = ?1'),
    pulls: pulls.slice(0, 2000),
    mail: mail.slice(0, 500),
    purchases: await q('SELECT order_id, product_id, kind, state, granted_at, refunded_at FROM purchases WHERE player_id = ?1'),
    cloudSave: await q('SELECT version, data, updated_at FROM player_saves WHERE player_id = ?1'),
    truncated: { ledger: ledger.length > 2000, pulls: pulls.length > 2000, mail: mail.length > 500 }
  };
}

/**
 * Deletes the account: the Google link and display name are removed (the same Google user can start over as a NEW player), every session
 * is dropped and all mutable game state is erased. Immutable records that other laws or the audit trail require (the ledger, pull log,
 * purchases, mail) stay, but they now point at a tombstone with no identity. One atomic batch.
 */
export async function deleteAccount(db: D1Database, playerId: string, confirm: string): Promise<{ deleted: true }> {
  if (confirm !== 'DELETE') throw new HttpError(400, 'confirmation_required', 'send {"confirm":"DELETE"} to delete the account');
  const own = (t: string): D1PreparedStatement => db.prepare(`DELETE FROM ${t} WHERE player_id = ?1`).bind(playerId);
  await db.batch([
    db.prepare("UPDATE players SET status = 'deleted', google_sub = NULL, display_name = NULL, deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1 AND status = 'active'").bind(playerId),
    ...['sessions', 'player_teams', 'player_tasks', 'progression_requests', 'player_gear', 'player_chars', 'player_stacks', 'player_account', 'player_progress', 'player_ration', 'battle_claims', 'player_saves', 'pity_state', 'gacha_requests', 'ad_nonces', 'player_items', 'wallets'].map(own)
  ]);
  return { deleted: true };
}
