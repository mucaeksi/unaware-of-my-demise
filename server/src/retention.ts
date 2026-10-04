// Data lifecycle (INF-016), run by the Worker's scheduled trigger (wrangler.jsonc `triggers.crons`). Every step is bounded
// (batches, a batch limit per run) and idempotent, so a run cut short is simply continued by the next one. Nothing that
// proves an economic outcome is deleted: stored replies are purged but their keys stay as tombstones (a late retry is
// refused, never re-executed), and resolved attempts, claims and pull history are kept.
import type { Db } from "./db";
import { ATTEMPT_TTL_SECONDS } from "./stages";

/** Spent or expired sign-in nonces are kept a day past expiry (diagnosing a failed sign-in), then deleted. */
export const NONCE_RETENTION_SECONDS = 24 * 3600;
/** Sessions are kept a week past expiry (support questions about a sign-in), then deleted. */
export const SESSION_RETENTION_SECONDS = 7 * 24 * 3600;
/**
 * How long a committed mutation can still be replayed (its stored reply kept). Clients hold an uncertain key only for one
 * app session (DEC-0017), far below this; afterwards the key answers 409 OPERATION_EXPIRED.
 */
export const REPLY_RETENTION_SECONDS = 30 * 24 * 3600;

const BATCH = 5000;
const MAX_BATCHES = 20;

export interface RetentionReport {
  nonces_deleted: number;
  sessions_deleted: number;
  attempts_expired: number;
  replies_purged: number;
}

/** Runs `statement` (which must affect at most BATCH rows) until it affects fewer, at most MAX_BATCHES times. */
async function inBatches(db: Db, statement: string, values: unknown[]): Promise<number> {
  let total = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { rowCount } = await db.query(statement, [...values, BATCH]);
    total += rowCount ?? 0;
    if ((rowCount ?? 0) < BATCH) break;
  }
  return total;
}

export async function runRetention(db: Db): Promise<RetentionReport> {
  return {
    nonces_deleted: await inBatches(
      db,
      "DELETE FROM auth_nonces WHERE nonce IN (SELECT nonce FROM auth_nonces WHERE expires_at < now() - make_interval(secs => $1) LIMIT $2)",
      [NONCE_RETENTION_SECONDS],
    ),
    sessions_deleted: await inBatches(
      db,
      "DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at < now() - make_interval(secs => $1) LIMIT $2)",
      [SESSION_RETENTION_SECONDS],
    ),
    attempts_expired: await inBatches(
      db,
      "UPDATE stage_attempts SET status = 'expired', resolved_at = now() WHERE attempt_id IN " +
        "(SELECT attempt_id FROM stage_attempts WHERE status = 'open' AND created_at <= now() - make_interval(secs => $1) LIMIT $2)",
      [ATTEMPT_TTL_SECONDS],
    ),
    replies_purged: await inBatches(
      db,
      "UPDATE idempotency_keys SET response_json = NULL, response_purged_at = now() WHERE idempotency_key IN " +
        "(SELECT idempotency_key FROM idempotency_keys WHERE response_purged_at IS NULL AND created_at < now() - make_interval(secs => $1) LIMIT $2)",
      [REPLY_RETENTION_SECONDS],
    ),
  };
}
