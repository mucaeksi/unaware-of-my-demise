import { HttpError } from '../content/store';

export const MUTABLE_PLAYER_TABLES = [
  'billing_jobs',
  'battle_sessions',
  'sessions',
  'player_entry',
  'player_teams',
  'player_tasks',
  'task_rule_weeks',
  'progression_requests',
  'player_gear',
  'player_chars',
  'player_stacks',
  'player_account',
  'player_progress',
  'player_ration',
  'battle_claims',
  'player_saves',
  'pity_state',
  'gacha_requests',
  'ad_nonces',
  'player_items',
  'wallets'
] as const;

export const DATA_INVENTORY = {
  identityFields: ['players.google_sub', 'players.display_name'],
  erasedOnDelete: ['players.google_sub', 'players.display_name', 'billing_locks', ...MUTABLE_PLAYER_TABLES],
  retainedPseudonymousTables: [
    { table: 'players', fields: ['id', 'created_at', 'status', 'deleted_at'], purpose: 'pseudonymous tombstone preventing orphaned foreign keys', retention: 'indefinite_tombstone' },
    { table: 'ledger', fields: ['id', 'player_id', 'currency', 'delta', 'reason', 'idempotency_key', 'at'], purpose: 'immutable currency accounting and fraud audit', retention: '7_years_statutory' },
    { table: 'purchases', fields: ['order_id', 'player_id', 'product_id', 'kind', 'state', 'granted_at', 'refunded_at', 'unrecovered'], purpose: 'Google Play financial reconciliation, tax and refund defense', retention: '7_years_statutory' },
    { table: 'purchase_events', fields: ['id', 'order_id', 'source', 'type', 'detail', 'at'], purpose: 'append-only billing webhook and verification audit log', retention: '7_years_statutory' },
    { table: 'gacha_pulls', fields: ['id', 'player_id', 'banner_id', 'pull_number', 'rarity', 'item_type', 'item_id', 'outcome', 'duplicate', 'at'], purpose: 'random-draw disclosure and fairness audit trail', retention: '7_years_statutory' },
    { table: 'reward_grants', fields: ['id', 'player_id', 'grant_key', 'reason', 'attachment_json', 'result_json', 'at'], purpose: 'append-only reward provenance journal', retention: '7_years_statutory' },
    { table: 'mail', fields: ['id', 'player_id', 'kind', 'title', 'body', 'attachments', 'created_at', 'expires_at', 'claimed_at'], purpose: 'immutable delivery and subscription-entitlement audit trail', retention: '7_years_statutory' },
    { table: 'ad_rewards', fields: ['transaction_id', 'player_id', 'ad_unit', 'window_start', 'day', 'amount', 'at'], purpose: 'AdMob SSV anti-replay and payout ledger', retention: '7_years_statutory' },
    { table: 'audit_log', fields: ['id', 'at', 'actor', 'action', 'target', 'detail'], purpose: 'append-only security and deletion-on-restore tombstone log (no PII)', retention: '7_years_statutory' }
  ],
  ageAndConsentPolicy: {
    childDirected: false,
    tagForChildDirectedTreatment: false,
    underAgeOfConsentDefault: false,
    maxAdContentRating: 'T',
    consentFramework: 'Google User Messaging Platform (UMP)',
    loginIndependentPrivacyOptions: true,
    offlineConsentRetained: true
  },
  deletionRoutes: {
    inApp: 'Account > Delete Account (confirm DELETE)',
    authenticatedApi: 'POST /api/v1/account/delete',
    publicWebPage: '/account/delete-request',
    publicWebApi: 'POST /api/v1/account/delete-request',
    privacyNotice: '/privacy'
  }
} as const;

/**
 * Everything the game holds about one player, as a plain JSON document (GDPR / Play "data safety" access request).
 * Large histories are bounded (newest first); `truncated` says when.
 */
export async function exportAccount(db: D1Database, playerId: string): Promise<Record<string, unknown>> {
  const q = async (sql: string): Promise<unknown[]> => (await db.prepare(sql).bind(playerId).all()).results;
  const [profile] = await q('SELECT id, created_at, display_name, last_seen_at, status, deleted_at FROM players WHERE id = ?1');
  const sessions = await q('SELECT created_at, expires_at, last_used_at, revoked_at FROM sessions WHERE player_id = ?1 ORDER BY created_at DESC LIMIT 101');
  const ledger = await q('SELECT id, currency, delta, reason, at FROM ledger WHERE player_id = ?1 ORDER BY id DESC LIMIT 2001');
  const pulls = await q('SELECT id, banner_id, pull_number, rarity, item_type, item_id, outcome, duplicate, at FROM gacha_pulls WHERE player_id = ?1 ORDER BY id DESC LIMIT 2001');
  const gachaRequests = await q('SELECT request_id, banner_id, pull_count, at FROM gacha_requests WHERE player_id = ?1 ORDER BY at DESC LIMIT 501');
  const progressionRequests = await q('SELECT request_id, kind, at FROM progression_requests WHERE player_id = ?1 ORDER BY at DESC LIMIT 501');
  const mail = await q('SELECT id, kind, title, body, attachments, grant_catalog, created_at, expires_at, read_at, claimed_at FROM mail WHERE player_id = ?1 ORDER BY id DESC LIMIT 501');
  const billingRecovery = await q('SELECT product_id, kind, order_id, state, next_at, ack_deadline, attempts, last_code, updated_at FROM billing_jobs WHERE player_id = ?1 ORDER BY updated_at DESC LIMIT 501');
  const tasks = await q('SELECT period_key, task_id, progress, claimed_at FROM player_tasks WHERE player_id = ?1 ORDER BY period_key DESC, task_id ASC LIMIT 501');
  const taskRules = await q('SELECT week_start, config_json, grant_catalog FROM task_rule_weeks WHERE player_id = ?1 ORDER BY week_start DESC LIMIT 501');
  const battleSessions = await q('SELECT id, release_id, node_id, party_json, created_at, expires_at, consumed_at FROM battle_sessions WHERE player_id = ?1 ORDER BY created_at DESC LIMIT 501');
  const battleClaims = await q('SELECT request_id, release_id, node_id, result_json, at FROM battle_claims WHERE player_id = ?1 ORDER BY at DESC LIMIT 501');
  const adRewards = await q('SELECT transaction_id, ad_unit, window_start, day, amount, at FROM ad_rewards WHERE player_id = ?1 ORDER BY at DESC LIMIT 501');
  const adNonces = await q('SELECT nonce, created_at, expires_at, used_at FROM ad_nonces WHERE player_id = ?1 ORDER BY created_at DESC LIMIT 501');
  const rewardGrants = await q('SELECT id, grant_key, reason, attachment_json, result_json, at FROM reward_grants WHERE player_id = ?1 ORDER BY id DESC LIMIT 2001');
  return {
    exportedAt: new Date().toISOString(),
    profile,
    sessions: sessions.slice(0, 100),
    wallets: await q('SELECT currency, balance FROM wallets WHERE player_id = ?1'),
    ledger: ledger.slice(0, 2000),
    characters: await q("SELECT item_id, copies, shards, first_at FROM player_items WHERE player_id = ?1 AND item_type = 'character'"),
    weapons: await q("SELECT item_id, copies, shards, first_at FROM player_items WHERE player_id = ?1 AND item_type = 'weapon'"),
    characterGrowth: await q('SELECT character_id, level, xp, ascension, skill_ranks FROM player_chars WHERE player_id = ?1'),
    gear: await q('SELECT id, gear_id, slot, level, xp, ascension, equipped_by, locked, stats_json, created_at FROM player_gear WHERE player_id = ?1'),
    materials: await q('SELECT item_id, qty FROM player_stacks WHERE player_id = ?1'),
    account: await q('SELECT xp FROM player_account WHERE player_id = ?1'),
    ration: await q('SELECT value, at_ms FROM player_ration WHERE player_id = ?1'),
    progress: await q('SELECT node_id, stars, clears, best_turns, first_cleared_at, updated_at FROM player_progress WHERE player_id = ?1'),
    battleSessions: battleSessions.slice(0, 500),
    battleClaims: battleClaims.slice(0, 500),
    teams: await q('SELECT slot, name, members_json, active, updated_at FROM player_teams WHERE player_id = ?1'),
    entry: await q('SELECT phase, prologue, tutorials, updated_at FROM player_entry WHERE player_id = ?1'),
    pityState: await q('SELECT pity_group, pity5, pity4, lost FROM pity_state WHERE player_id = ?1'),
    tasks: tasks.slice(0, 500),
    taskRules: taskRules.slice(0, 500),
    pulls: pulls.slice(0, 2000),
    gachaRequests: gachaRequests.slice(0, 500),
    progressionRequests: progressionRequests.slice(0, 500),
    mail: mail.slice(0, 500),
    purchases: await q('SELECT order_id, product_id, kind, state, entitlement_state, period_start, period_end, granted_at, refunded_at FROM purchases WHERE player_id = ?1'),
    billingRecovery: billingRecovery.slice(0, 500),
    adRewards: adRewards.slice(0, 500),
    adNonces: adNonces.slice(0, 500),
    rewardGrants: rewardGrants.slice(0, 2000),
    cloudSave: await q('SELECT version, data, updated_at FROM player_saves WHERE player_id = ?1'),
    dataInventory: DATA_INVENTORY,
    truncated: {
      sessions: sessions.length > 100,
      tasks: tasks.length > 500,
      taskRules: taskRules.length > 500,
      battleSessions: battleSessions.length > 500,
      battleClaims: battleClaims.length > 500,
      gachaRequests: gachaRequests.length > 500,
      progressionRequests: progressionRequests.length > 500,
      adRewards: adRewards.length > 500,
      adNonces: adNonces.length > 500,
      ledger: ledger.length > 2000,
      pulls: pulls.length > 2000,
      mail: mail.length > 500,
      billingRecovery: billingRecovery.length > 500,
      rewardGrants: rewardGrants.length > 2000
    }
  };
}

function erasureStatements(db: D1Database, playerId: string, recordAudit = true, source: 'in_app' | 'web_request' | 'restore_reconcile' = 'in_app'): D1PreparedStatement[] {
  const own = (t: string): D1PreparedStatement => db.prepare(`DELETE FROM ${t} WHERE player_id = ?1`).bind(playerId);
  return [
    db.prepare("UPDATE players SET status = 'deleted', google_sub = NULL, display_name = NULL, deleted_at = COALESCE(deleted_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?1").bind(playerId),
    ...(recordAudit
      ? [db.prepare("INSERT INTO audit_log (actor, action, target, detail) VALUES ('system:privacy', 'account.delete', ?1, ?2)").bind(playerId, JSON.stringify({ source }))]
      : []),
    db.prepare('DELETE FROM billing_locks WHERE token_hash IN (SELECT token_hash FROM billing_jobs WHERE player_id = ?1)').bind(playerId),
    ...MUTABLE_PLAYER_TABLES.map(own)
  ];
}

/**
 * Deletes the account: the Google link and display name are removed (the same Google user can start over as a NEW player), every session
 * is dropped and all mutable game state is erased. Immutable records that other laws or the audit trail require (the ledger, pull log,
 * purchases, mail) stay, but they now point at a tombstone with no identity. One atomic batch.
 */
export async function deleteAccount(db: D1Database, playerId: string, confirm: string, source: 'in_app' | 'web_request' = 'in_app'): Promise<{ deleted: true; playerId: string }> {
  if (confirm !== 'DELETE') throw new HttpError(400, 'confirmation_required', 'send {"confirm":"DELETE"} to delete the account');
  await db.batch(erasureStatements(db, playerId, true, source));
  return { deleted: true, playerId };
}

/**
 * Re-applies account deletions after a backup restore or with an external tombstone list so a point-in-time restore cannot resurrect
 * deleted accounts, Google subject bindings, sessions or mutable player state.
 */
export async function reapplyAccountDeletions(db: D1Database, extraPlayerIds: string[] = []): Promise<{ reconciled: number; playerIds: string[] }> {
  const [fromAudit, fromPlayers] = await Promise.all([
    db.prepare("SELECT DISTINCT target AS id FROM audit_log WHERE action = 'account.delete' AND target IS NOT NULL").all<{ id: string }>(),
    db.prepare("SELECT id FROM players WHERE status = 'deleted'").all<{ id: string }>()
  ]);
  const ids = [...new Set([...fromAudit.results.map((r) => r.id), ...fromPlayers.results.map((r) => r.id), ...extraPlayerIds.filter((id) => /^p_[a-z0-9_]+$/i.test(id))])];
  if (ids.length === 0) return { reconciled: 0, playerIds: [] };
  const statements = ids.flatMap((id) => erasureStatements(db, id, false, 'restore_reconcile'));
  await db.batch(statements);
  return { reconciled: ids.length, playerIds: ids };
}

