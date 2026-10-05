// Client-supplied Idempotency-Key for mutating requests (LEGACY server/idempotency.py): the first request's response is
// stored with the key, and a retry replays it verbatim instead of acting twice. Reusing a key for another account,
// endpoint or request body is a conflict, never a silent replay.
//
// The whole request is one transaction that first locks the account row, so every mutation of one account is
// serialized. A request whose action fails rolls back and stores nothing, so it can be retried with the same key.
import { transaction, type Db } from "./db";
import { ApiError, invalid } from "./http";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The request's `Idempotency-Key` header: required, a UUIDv4. */
export function idempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim().toLowerCase();
  if (!key) throw invalid("Idempotency-Key header is required");
  if (!UUID_V4.test(key)) throw invalid("Idempotency-Key must be a UUIDv4");
  return key;
}

const expired = (key: string): ApiError =>
  new ApiError(409, "OPERATION_EXPIRED", `Idempotency-Key '${key}' belongs to a request too old to replay; refresh the state and act again`);

const reused = (key: string): ApiError =>
  new ApiError(409, "INVALID_REQUEST", `Idempotency-Key '${key}' was already used for a different account, endpoint or request body`);

export async function runIdempotent<T>(
  db: Db,
  key: string,
  accountId: string,
  endpoint: string,
  fingerprint: string,
  action: (tx: Db) => Promise<T>,
): Promise<{ response: T; replayed: boolean }> {
  try {
    return await transaction(db, async (tx) => {
      // Serializes the account's mutations. NO KEY UPDATE (not UPDATE): another account's transaction that references
      // this one through a foreign key (a friend request, a report: KEY SHARE) is not blocked by it, so two players
      // acting on each other at once cannot deadlock (DEC-0037). Deleting the account still waits (FOR UPDATE).
      await tx.query("SELECT 1 FROM account WHERE account_id = $1 FOR NO KEY UPDATE", [accountId]);
      const existing = await tx.query<{ account_id: string; endpoint: string; request_fingerprint: string; response_json: T | null }>(
        "SELECT account_id, endpoint, request_fingerprint, response_json FROM idempotency_keys WHERE idempotency_key = $1",
        [key],
      );
      const stored = existing.rows[0];
      if (stored) {
        if (stored.account_id !== accountId || stored.endpoint !== endpoint || stored.request_fingerprint !== fingerprint) {
          throw reused(key);
        }
        // The reply was purged by the retention job (INF-016): the request did commit, so it must not run again.
        if (stored.response_json === null) throw expired(key);
        return { response: stored.response_json, replayed: true };
      }
      const response = await action(tx);
      await tx.query(
        "INSERT INTO idempotency_keys (idempotency_key, account_id, endpoint, request_fingerprint, response_json) VALUES ($1, $2, $3, $4, $5)",
        [key, accountId, endpoint, fingerprint, JSON.stringify(response)],
      );
      return { response, replayed: false };
    });
  } catch (error) {
    // Another request inserted the same key concurrently (for another account: the lock above is per account).
    if ((error as { constraint?: string }).constraint === "idempotency_keys_pkey") throw reused(key);
    throw error;
  }
}

/**
 * The committed result of the account's request with `key`, or null when no such request committed (INF-013). A request
 * still running holds the account lock and is not visible yet; resending it with the same key is always safe.
 */
export async function committedOperation(
  db: Db,
  accountId: string,
  key: string,
): Promise<{ operation_key: string; endpoint: string; committed_at_utc: string; response: unknown } | null> {
  // `response` is null once the retention job purged it; the operation still counts as committed.
  if (!UUID_V4.test(key)) return null;
  const { rows } = await db.query<{ endpoint: string; created_at: Date; response_json: unknown }>(
    "SELECT endpoint, created_at, response_json FROM idempotency_keys WHERE idempotency_key = $1 AND account_id = $2",
    [key, accountId],
  );
  const row = rows[0];
  return row ? { operation_key: key, endpoint: row.endpoint, committed_at_utc: row.created_at.toISOString(), response: row.response_json } : null;
}
