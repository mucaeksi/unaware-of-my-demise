import { HttpError } from '../content/store';
import { balanceOf, ledgerStatements } from '../db/ledger';

/**
 * Owner setting (2026-10-11): at most 5 rewarded views per rolling 12 hours, the same rule configured in AdMob, so the server
 * and the ad network agree. The payout per view is a placeholder until the economy math pass (see docs/DEV_TRACKER.json).
 */
export const AD = { token: 30, perWindow: 5, windowHours: 12, maxAgeMs: 86_400_000 } as const;

const windowStartIso = (now: Date): string => new Date(now.getTime() - AD.windowHours * 3_600_000).toISOString();

export async function adStatus(db: D1Database, playerId: string, now = new Date()): Promise<{ windowViews: number; perWindow: number; reward: number; nextSlotAt: string | null }> {
  const { results } = await db.prepare('SELECT at FROM ad_rewards WHERE player_id = ?1 AND at > ?2 ORDER BY at ASC LIMIT 20').bind(playerId, windowStartIso(now)).all<{ at: string }>();
  const full = results.length >= AD.perWindow;
  const oldest = results[0]?.at;
  return { windowViews: results.length, perWindow: AD.perWindow, reward: AD.token, nextSlotAt: full && oldest ? new Date(Date.parse(oldest) + AD.windowHours * 3_600_000).toISOString() : null };
}

/** Starts one rewarded view: returns the nonce to hand to AdMob as custom_data (valid 30 minutes; at most 20 open per player per day). */
export async function beginAd(db: D1Database, playerId: string, now = new Date()): Promise<{ nonce: string; expiresAt: string; status: Awaited<ReturnType<typeof adStatus>> }> {
  const status = await adStatus(db, playerId, now);
  if (status.windowViews >= AD.perWindow) throw new HttpError(429, 'ad_cap_reached', 'no more rewarded views right now');
  const open = await db.prepare('SELECT COUNT(*) AS n FROM ad_nonces WHERE player_id = ?1 AND created_at > ?2').bind(playerId, new Date(now.getTime() - 86_400_000).toISOString()).first<{ n: number }>();
  if ((open?.n ?? 0) >= 20) throw new HttpError(429, 'too_many_requests', 'too many ad requests today');
  const nonce = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
  await db.prepare('INSERT INTO ad_nonces (nonce, player_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)').bind(nonce, playerId, now.toISOString(), expiresAt).run();
  return { nonce, expiresAt, status };
}

export type AdGrant = { granted: true; balance: number } | { granted: false; reason: 'duplicate' | 'window_cap' | 'unknown_player' | 'bad_nonce' };

export interface AdNonceStatus {
  nonce: string;
  status: 'pending' | 'verified' | 'rejected' | 'test_callback' | 'expired';
  state: 'pending' | 'verified' | 'rejected' | 'test_callback' | 'expired';
  reason: string | null;
  transactionId: string | null;
  reward: number;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
}

export async function recordTestAdNonce(db: D1Database, playerId: string | undefined, nonce: string | undefined, transactionId: string, now = new Date()): Promise<void> {
  if (!playerId || !nonce) return;
  const marker = `test_callback|${now.toISOString()}|${transactionId}`;
  await db.prepare('UPDATE ad_nonces SET used_at = ?3 WHERE nonce = ?1 AND player_id = ?2 AND used_at IS NULL AND expires_at > ?4')
    .bind(nonce, playerId, marker, now.toISOString())
    .run();
}

export async function adNonceStatus(db: D1Database, playerId: string, nonce: string, now = new Date()): Promise<AdNonceStatus> {
  const row = await db.prepare('SELECT nonce, created_at, expires_at, used_at FROM ad_nonces WHERE nonce = ?1 AND player_id = ?2')
    .bind(nonce, playerId)
    .first<{ nonce: string; created_at: string; expires_at: string; used_at: string | null }>();
  if (!row) throw new HttpError(404, 'unknown_nonce', 'this ad nonce is unknown');
  if (row.used_at === null) {
    const expired = row.expires_at <= now.toISOString();
    const st = expired ? 'expired' : 'pending';
    return {
      nonce: row.nonce,
      status: st,
      state: st,
      reason: expired ? 'expired' : null,
      transactionId: null,
      reward: 0,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      resolvedAt: null
    };
  }
  const parts = row.used_at.split('|');
  if (parts[0] === 'test_callback') {
    return {
      nonce: row.nonce,
      status: 'test_callback',
      state: 'test_callback',
      reason: 'test_callback',
      transactionId: parts[2] ?? null,
      reward: 0,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      resolvedAt: parts[1] ?? null
    };
  }
  if (parts[0] === 'rejected') {
    return {
      nonce: row.nonce,
      status: 'rejected',
      state: 'rejected',
      reason: parts[1] ?? 'rejected',
      transactionId: parts[3] ?? null,
      reward: 0,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      resolvedAt: parts[2] ?? null
    };
  }
  if (parts[0] === 'verified') {
    return {
      nonce: row.nonce,
      status: 'verified',
      state: 'verified',
      reason: 'granted',
      transactionId: parts[2] ?? null,
      reward: AD.token,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      resolvedAt: parts[1] ?? null
    };
  }
  return {
    nonce: row.nonce,
    status: 'verified',
    state: 'verified',
    reason: 'granted',
    transactionId: null,
    reward: AD.token,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    resolvedAt: row.used_at
  };
}

/**
 * Grants one verified ad view. Duplicate transaction ids, the window cap and the day cap are enforced INSIDE the batch
 * (conditional insert + guard), so concurrent callbacks cannot exceed the caps.
 */
export async function grantAd(db: D1Database, playerId: string, adUnit: string, transactionId: string, nonce: string | undefined, now = new Date()): Promise<AdGrant> {
  if (!nonce) return { granted: false, reason: 'bad_nonce' };
  const player = await db.prepare("SELECT 1 AS ok FROM players WHERE id = ?1 AND status = 'active'").bind(playerId).first();
  if (!player) return { granted: false, reason: 'unknown_player' };
  const dup = await db.prepare('SELECT 1 AS ok FROM ad_rewards WHERE transaction_id = ?1').bind(transactionId).first();
  if (dup) {
    await db.prepare('UPDATE ad_nonces SET used_at = ?3 WHERE nonce = ?1 AND player_id = ?2 AND used_at IS NULL AND expires_at > ?4')
      .bind(nonce, playerId, `rejected|duplicate|${now.toISOString()}|${transactionId}`, now.toISOString())
      .run();
    return { granted: false, reason: 'duplicate' };
  }
  const dayKey = now.toISOString().slice(0, 10);
  const verifiedMarker = `verified|${now.toISOString()}|${transactionId}`;
  try {
    await db.batch([
      // the nonce is consumed first: it must belong to this player, be alive and unused
      db.prepare('UPDATE ad_nonces SET used_at = ?4 WHERE nonce = ?1 AND player_id = ?2 AND used_at IS NULL AND expires_at > ?3').bind(nonce, playerId, now.toISOString(), verifiedMarker),
      db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)"),
      db
        .prepare(
          `INSERT INTO ad_rewards (transaction_id, player_id, ad_unit, window_start, day, amount) SELECT ?1, ?2, ?3, ?4, ?5, ?6
           WHERE (SELECT COUNT(*) FROM ad_rewards WHERE player_id = ?2 AND at > ?7) < ?8`
        )
        .bind(transactionId, playerId, adUnit, now.toISOString(), dayKey, AD.token, windowStartIso(now), AD.perWindow),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...ledgerStatements(db, { playerId, currency: 'eclipse_token', delta: AD.token, reason: 'rewarded_ad', idempotencyKey: `ad:${transactionId}` }),
      db.prepare('DELETE FROM tx_guard')
    ]);
    return { granted: true, balance: await balanceOf(db, playerId, 'eclipse_token') };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/UNIQUE constraint failed: (ad_rewards|ledger)/i.test(msg)) {
      await db.prepare('UPDATE ad_nonces SET used_at = ?3 WHERE nonce = ?1 AND player_id = ?2 AND used_at IS NULL AND expires_at > ?4')
        .bind(nonce, playerId, `rejected|duplicate|${now.toISOString()}|${transactionId}`, now.toISOString())
        .run();
      return { granted: false, reason: 'duplicate' };
    }
    if (/CHECK constraint failed: ok = 1/i.test(msg)) {
      const live = await db.prepare('SELECT 1 AS ok FROM ad_nonces WHERE nonce = ?1 AND player_id = ?2 AND used_at IS NULL AND expires_at > ?3').bind(nonce, playerId, now.toISOString()).first();
      if (!live) return { granted: false, reason: 'bad_nonce' };
      await db.prepare('UPDATE ad_nonces SET used_at = ?3 WHERE nonce = ?1 AND player_id = ?2 AND used_at IS NULL AND expires_at > ?4')
        .bind(nonce, playerId, `rejected|window_cap|${now.toISOString()}|${transactionId}`, now.toISOString())
        .run();
      return { granted: false, reason: 'window_cap' };
    }
    throw e;
  }
}
