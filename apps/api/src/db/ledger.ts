export type Currency = 'silver_crowns' | 'eclipse_tokens' | 'fate_threads';

export interface LedgerEntry {
  playerId: string;
  currency: Currency;
  /** positive = credit, negative = debit; never 0 */
  delta: number;
  reason: string;
  /** unique per logical operation; replays return the original result instead of applying twice */
  idempotencyKey: string;
}

export type LedgerResult =
  | { applied: true; balance: number }
  | { applied: false; reason: 'duplicate'; balance: number }
  | { applied: false; reason: 'insufficient_funds'; balance: number }
  | { applied: false; reason: 'idempotency_conflict'; balance: number };

async function balanceOf(db: D1Database, playerId: string, currency: Currency): Promise<number> {
  const row = await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1 AND currency = ?2').bind(playerId, currency).first<{ balance: number }>();
  return row?.balance ?? 0;
}

/**
 * The only way a balance changes. One D1 batch = one transaction:
 *   1. ensure the wallet row, 2. guarded balance update (CHECK balance >= 0 aborts on overdraft),
 *   3. immutable ledger row with a UNIQUE idempotency key (aborts on replay).
 * Any failing statement rolls the whole batch back, so a rejected debit leaves no trace.
 */
export async function applyLedger(db: D1Database, e: LedgerEntry): Promise<LedgerResult> {
  if (!Number.isSafeInteger(e.delta) || e.delta === 0) throw new Error('ledger delta must be a non-zero safe integer');
  try {
    await db.batch([
      db.prepare('INSERT INTO wallets (player_id, currency, balance, version) VALUES (?1, ?2, 0, 0) ON CONFLICT (player_id, currency) DO NOTHING').bind(e.playerId, e.currency),
      db.prepare('UPDATE wallets SET balance = balance + ?3, version = version + 1 WHERE player_id = ?1 AND currency = ?2').bind(e.playerId, e.currency, e.delta),
      db
        .prepare('INSERT INTO ledger (player_id, currency, delta, reason, idempotency_key) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(e.playerId, e.currency, e.delta, e.reason, e.idempotencyKey)
    ]);
    return { applied: true, balance: await balanceOf(db, e.playerId, e.currency) };
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    const balance = await balanceOf(db, e.playerId, e.currency);
    if (/CHECK constraint failed/i.test(msg)) return { applied: false, reason: 'insufficient_funds', balance };
    if (/UNIQUE constraint failed: ledger\.idempotency_key/i.test(msg)) {
      const prior = await db
        .prepare('SELECT player_id, currency, delta FROM ledger WHERE idempotency_key = ?1')
        .bind(e.idempotencyKey)
        .first<{ player_id: string; currency: string; delta: number }>();
      const same = prior && prior.player_id === e.playerId && prior.currency === e.currency && prior.delta === e.delta;
      return { applied: false, reason: same ? 'duplicate' : 'idempotency_conflict', balance };
    }
    throw err;
  }
}
