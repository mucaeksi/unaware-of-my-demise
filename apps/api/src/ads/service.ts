import { HttpError } from '../content/store';
import { balanceOf, ledgerStatements } from '../db/ledger';

/** Canon (economy_part1.json): 30 Eclipse Tokens per verified view, 4 views per 12 h window (00:00 / 12:00 UTC), 8 per UTC day. */
export const AD = { token: 30, perWindow: 4, perDay: 8, windowHours: 12, maxAgeMs: 86_400_000 } as const;

export function windowOf(now: Date): { windowStart: string; day: string; nextWindow: string } {
  const h = now.getUTCHours() >= AD.windowHours ? AD.windowHours : 0;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h));
  return { windowStart: start.toISOString(), day: now.toISOString().slice(0, 10), nextWindow: new Date(start.getTime() + AD.windowHours * 3_600_000).toISOString() };
}

export async function adStatus(db: D1Database, playerId: string, now = new Date()): Promise<{ windowViews: number; dayViews: number; perWindow: number; perDay: number; reward: number; nextWindow: string }> {
  const w = windowOf(now);
  const a = await db.prepare('SELECT COUNT(*) AS n FROM ad_rewards WHERE player_id = ?1 AND window_start = ?2').bind(playerId, w.windowStart).first<{ n: number }>();
  const d = await db.prepare('SELECT COUNT(*) AS n FROM ad_rewards WHERE player_id = ?1 AND day = ?2').bind(playerId, w.day).first<{ n: number }>();
  return { windowViews: a?.n ?? 0, dayViews: d?.n ?? 0, perWindow: AD.perWindow, perDay: AD.perDay, reward: AD.token, nextWindow: w.nextWindow };
}

/** Starts one rewarded view: returns the nonce to hand to AdMob as custom_data (valid 30 minutes; at most 20 open per player per day). */
export async function beginAd(db: D1Database, playerId: string, now = new Date()): Promise<{ nonce: string; expiresAt: string; status: Awaited<ReturnType<typeof adStatus>> }> {
  const status = await adStatus(db, playerId, now);
  if (status.windowViews >= AD.perWindow || status.dayViews >= AD.perDay) throw new HttpError(429, 'ad_cap_reached', 'no more rewarded views in this window');
  const open = await db.prepare('SELECT COUNT(*) AS n FROM ad_nonces WHERE player_id = ?1 AND created_at > ?2').bind(playerId, new Date(now.getTime() - 86_400_000).toISOString()).first<{ n: number }>();
  if ((open?.n ?? 0) >= 20) throw new HttpError(429, 'too_many_requests', 'too many ad requests today');
  const nonce = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
  await db.prepare('INSERT INTO ad_nonces (nonce, player_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)').bind(nonce, playerId, now.toISOString(), expiresAt).run();
  return { nonce, expiresAt, status };
}

export type AdGrant = { granted: true; balance: number } | { granted: false; reason: 'duplicate' | 'window_cap' | 'day_cap' | 'unknown_player' | 'bad_nonce' };

/**
 * Grants one verified ad view. Duplicate transaction ids, the window cap and the day cap are enforced INSIDE the batch
 * (conditional insert + guard), so concurrent callbacks cannot exceed the caps.
 */
export async function grantAd(db: D1Database, playerId: string, adUnit: string, transactionId: string, nonce: string | undefined, now = new Date()): Promise<AdGrant> {
  if (!nonce) return { granted: false, reason: 'bad_nonce' };
  const player = await db.prepare("SELECT 1 AS ok FROM players WHERE id = ?1 AND status = 'active'").bind(playerId).first();
  if (!player) return { granted: false, reason: 'unknown_player' };
  const dup = await db.prepare('SELECT 1 AS ok FROM ad_rewards WHERE transaction_id = ?1').bind(transactionId).first();
  if (dup) return { granted: false, reason: 'duplicate' };
  const w = windowOf(now);
  try {
    await db.batch([
      // the nonce is consumed first: it must belong to this player, be alive and unused
      db.prepare('UPDATE ad_nonces SET used_at = ?3 WHERE nonce = ?1 AND player_id = ?2 AND used_at IS NULL AND expires_at > ?3').bind(nonce, playerId, now.toISOString()),
      db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)"),
      db
        .prepare(
          `INSERT INTO ad_rewards (transaction_id, player_id, ad_unit, window_start, day, amount) SELECT ?1, ?2, ?3, ?4, ?5, ?6
           WHERE (SELECT COUNT(*) FROM ad_rewards WHERE player_id = ?2 AND window_start = ?4) < ?7
             AND (SELECT COUNT(*) FROM ad_rewards WHERE player_id = ?2 AND day = ?5) < ?8`
        )
        .bind(transactionId, playerId, adUnit, w.windowStart, w.day, AD.token, AD.perWindow, AD.perDay),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...ledgerStatements(db, { playerId, currency: 'eclipse_token', delta: AD.token, reason: 'rewarded_ad', idempotencyKey: `ad:${transactionId}` }),
      db.prepare('DELETE FROM tx_guard')
    ]);
    return { granted: true, balance: await balanceOf(db, playerId, 'eclipse_token') };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/UNIQUE constraint failed: (ad_rewards|ledger)/i.test(msg)) return { granted: false, reason: 'duplicate' };
    if (/CHECK constraint failed: ok = 1/i.test(msg)) {
      const live = await db.prepare('SELECT 1 AS ok FROM ad_nonces WHERE nonce = ?1 AND player_id = ?2 AND used_at IS NULL AND expires_at > ?3').bind(nonce, playerId, now.toISOString()).first();
      if (!live) return { granted: false, reason: 'bad_nonce' };
      const s = await adStatus(db, playerId, now);
      return { granted: false, reason: s.windowViews >= AD.perWindow ? 'window_cap' : 'day_cap' };
    }
    throw e;
  }
}
