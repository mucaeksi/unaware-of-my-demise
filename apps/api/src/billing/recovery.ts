import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import type { GameEnv } from '../env';
import { PlayApi, type PlayClient } from './play';
import { Fulfillment, verifyPurchase, type PurchaseRecovery, type VerifyResult } from './service';
import { TokenVault, type TokenIdentity } from './vault';

type Fence = () => D1PreparedStatement;
type Job = { token_hash: string; player_id: string; product_id: string; kind: 'consumable' | 'subscription'; order_id: string | null; fulfillment: string | null; encrypted_token: string | null; ack_deadline: string | null; attempts: number };
const hashToken = (token: string) => sha256Hex(`play-token:${token}`);

/** Shared by client, RTDN and Cron. Fences must join the batch that mutates rights or fulfillment. */
export async function withBillingLock<T>(db: D1Database, tokenHash: string, work: (fence: Fence) => Promise<T>): Promise<T> {
  const owner = crypto.randomUUID();
  const acquiredAt = new Date();
  const claimed = await db.prepare(`INSERT INTO billing_locks (token_hash, owner, lease_until) VALUES (?1, ?2, ?3)
    ON CONFLICT (token_hash) DO UPDATE SET owner = excluded.owner, lease_until = excluded.lease_until
    WHERE billing_locks.lease_until <= ?4 RETURNING owner`)
    .bind(tokenHash, owner, new Date(acquiredAt.getTime() + 60_000).toISOString(), acquiredAt.toISOString()).first();
  if (!claimed) throw new HttpError(503, 'billing_busy', 'another billing operation is processing this token; retry later');
  const fence = () => db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM billing_locks WHERE token_hash = ?1 AND owner = ?2 AND lease_until > ?3) THEN 1 ELSE 0 END)")
    .bind(tokenHash, owner, new Date().toISOString());
  try { return await work(fence); }
  catch (e) {
    if (/CHECK constraint failed: ok = 1/i.test(String(e))) throw new HttpError(503, 'billing_lease_lost', 'billing processing ownership expired; retry later');
    throw e;
  } finally {
    await db.prepare('DELETE FROM billing_locks WHERE token_hash = ?1 AND owner = ?2').bind(tokenHash, owner).run();
  }
}

async function updateJob(db: D1Database, th: string, fence: Fence, state: 'pending' | 'done' | 'review', code: string | null, next: Date | null, now: Date, failure = false): Promise<void> {
  await db.batch([
    fence(),
    db.prepare("UPDATE billing_jobs SET state = ?2, next_at = ?3, last_code = ?4, updated_at = ?5, attempts = CASE WHEN ?6 THEN attempts + 1 ELSE 0 END, encrypted_token = CASE WHEN ?2 = 'done' THEN NULL ELSE encrypted_token END WHERE token_hash = ?1")
      .bind(th, state, next?.toISOString() ?? null, code, now.toISOString(), failure ? 1 : 0),
    db.prepare('DELETE FROM tx_guard')
  ]);
}

async function retryJob(db: D1Database, th: string, fence: Fence, code: string, now: Date, review = false): Promise<void> {
  const job = await db.prepare('SELECT j.attempts, j.ack_deadline, p.acknowledged, p.state FROM billing_jobs j LEFT JOIN purchases p ON p.order_id = j.order_id WHERE j.token_hash = ?1').bind(th).first<Pick<Job, 'attempts' | 'ack_deadline'> & { acknowledged: number | null; state: string | null }>();
  if (!job) return; // Unbound/unconfirmed client tokens must never become durable recovery work.
  const needsAck = job.state !== 'refunded' && job.acknowledged !== 1;
  const deadline = needsAck && job.ack_deadline && job.ack_deadline <= now.toISOString();
  const terminal = review || job.attempts >= 9 || !!deadline;
  const urgent = needsAck && job.ack_deadline && Date.parse(job.ack_deadline) - now.getTime() < 600_000;
  const delay = urgent ? 60 : Math.min(3600, 60 * 2 ** Math.min(job.attempts, 6));
  await updateJob(db, th, fence, terminal ? 'review' : 'pending', deadline ? 'ack_deadline_exceeded' : code, terminal ? null : new Date(now.getTime() + delay * 1000), now, true);
}

/** Real entry point: persist only provider-bound tokens before any new grant, then reconcile work independently. */
export async function verifyReceipt(env: GameEnv, play: PlayClient, playerId: string, input: { productId: string; purchaseToken: string }, now = new Date()): Promise<VerifyResult> {
  const db = env.DB;
  const player = await db.prepare('SELECT status FROM players WHERE id = ?1').bind(playerId).first<{ status: string }>();
  if (!player || player.status === 'deleted') throw new HttpError(403, 'account_deleted', 'this account cannot receive purchase benefits');
  const th = await hashToken(input.purchaseToken);
  const cached = await db.prepare("SELECT player_id, order_id, state FROM purchases WHERE token_hash = ?1 AND product_id = ?2 AND kind = 'consumable' AND acknowledged = 1 ORDER BY granted_at DESC LIMIT 1")
    .bind(th, input.productId).first<{ player_id: string; order_id: string; state: string }>();
  if (cached) {
    if (cached.player_id !== playerId) throw new HttpError(403, 'account_mismatch', 'this purchase belongs to another account');
    await db.prepare("UPDATE billing_jobs SET state = 'done', next_at = NULL, last_code = NULL, encrypted_token = NULL, updated_at = ?3 WHERE token_hash = ?1 AND player_id = ?2 AND (state <> 'done' OR encrypted_token IS NOT NULL)")
      .bind(th, playerId, now.toISOString()).run();
    return { status: cached.state === 'refunded' ? 'not_entitled' : 'already_granted', productId: input.productId, orderId: cached.order_id };
  }
  const vault = new TokenVault(env);
  const identity: TokenIdentity = { tokenHash: th, playerId, productId: input.productId };
  return withBillingLock(db, th, async (fence) => {
    const prior = await db.prepare('SELECT kind FROM billing_jobs WHERE token_hash = ?1 AND player_id = ?2 AND product_id = ?3').bind(th, playerId, input.productId).first<Pick<Job, 'kind'>>();
    const recovery: PurchaseRecovery = {
      kind: prior?.kind,
      fence,
      async confirmed(kind, orderId, proposed, purchaseTimeMs, test) {
        const previous = await db.prepare('SELECT player_id, order_id, fulfillment, ack_deadline FROM billing_jobs WHERE token_hash = ?1').bind(th).first<Pick<Job, 'player_id' | 'order_id' | 'fulfillment' | 'ack_deadline'>>();
        if (previous && previous.player_id !== playerId) throw new HttpError(403, 'account_mismatch', 'this purchase belongs to another account');
        const samePeriod = previous && (previous.order_id === orderId || previous.order_id === null);
        const fulfillment = samePeriod && previous.fulfillment ? previous.fulfillment : proposed;
        if (fulfillment) Fulfillment.parse(JSON.parse(fulfillment));
        if (purchaseTimeMs !== null && (!Number.isSafeInteger(purchaseTimeMs) || purchaseTimeMs <= 0)) throw new HttpError(503, 'billing_invalid_response', 'purchase time could not be verified');
        const deadline = samePeriod && previous.ack_deadline ? previous.ack_deadline : purchaseTimeMs === null ? null : new Date(purchaseTimeMs + (test ? 3 * 60_000 : 3 * 86_400_000)).toISOString();
        const sealed = await vault.seal(input.purchaseToken, identity);
        await db.batch([
          fence(),
          db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status <> 'deleted') THEN 1 ELSE 0 END)").bind(playerId),
          db.prepare(`INSERT INTO billing_jobs (token_hash, player_id, product_id, kind, order_id, fulfillment, encrypted_token, state, next_at, ack_deadline, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?9, ?8)
            ON CONFLICT (token_hash) DO UPDATE SET product_id = excluded.product_id, kind = excluded.kind, order_id = excluded.order_id,
              fulfillment = excluded.fulfillment, encrypted_token = excluded.encrypted_token, state = 'pending', next_at = excluded.next_at,
              ack_deadline = excluded.ack_deadline, updated_at = excluded.updated_at`)
            .bind(th, playerId, input.productId, kind, orderId, fulfillment, sealed, now.toISOString(), deadline),
          db.prepare('DELETE FROM tx_guard')
        ]);
        return fulfillment;
      }
    };
    try {
      const result = await verifyPurchase(db, play, playerId, input, now, recovery);
      const purchase = await db.prepare('SELECT acknowledged, kind, state FROM purchases WHERE token_hash = ?1 AND product_id = ?2 ORDER BY granted_at DESC LIMIT 1').bind(th, input.productId).first<{ acknowledged: number; kind: Job['kind']; state: string }>();
      const consumableDone = (purchase?.kind ?? prior?.kind) === 'consumable' && (purchase?.acknowledged === 1 || result.status === 'not_entitled');
      const revokedSubscription = purchase?.kind === 'subscription' && purchase.state === 'refunded' && recovery.subscriptionState === 'expired';
      if (consumableDone || revokedSubscription) await updateJob(db, th, fence, 'done', null, null, now);
      else if (purchase?.state !== 'refunded' && purchase && !purchase.acknowledged) await retryJob(db, th, fence, 'ack_pending', now);
      else await updateJob(db, th, fence, 'pending', null, new Date(now.getTime() + (result.status === 'pending' ? 60_000 : 86_400_000)), now);
      return result;
    } catch (e) {
      const code = e instanceof HttpError ? e.code : 'processing_failed';
      await retryJob(db, th, fence, code, now, ['fulfillment_requires_review', 'refund_requires_review', 'period_requires_review', 'account_mismatch', 'order_mismatch'].includes(code));
      throw e;
    }
  });
}

/** Bounded local batch; RTDN is primary, Cron repairs ack/consume and missed state/renewal work. */
export async function reconcileBilling(env: GameEnv, play: PlayClient = new PlayApi(env), now = new Date()): Promise<{ inspected: number; retried: number; blocked: number }> {
  const vault = new TokenVault(env);
  const db = env.DB;
  const { results } = await db.prepare("SELECT token_hash, player_id, product_id, encrypted_token FROM billing_jobs j WHERE state = 'pending' AND next_at <= ?1 AND NOT EXISTS (SELECT 1 FROM billing_locks l WHERE l.token_hash = j.token_hash AND l.lease_until > ?2) ORDER BY next_at, token_hash LIMIT 5").bind(now.toISOString(), new Date().toISOString()).all<Job>();
  const summary = { inspected: results.length, retried: 0, blocked: 0 };
  for (const job of results) {
    try {
      const token = await vault.open(job.encrypted_token ?? '', { tokenHash: job.token_hash, playerId: job.player_id, productId: job.product_id });
      if (await hashToken(token) !== job.token_hash) throw new HttpError(409, 'billing_recovery_corrupt', 'stored billing token needs operator review');
      await verifyReceipt(env, play, job.player_id, { productId: job.product_id, purchaseToken: token }, now);
      summary.retried++;
    } catch (e) {
      summary.blocked++;
      const code = e instanceof HttpError ? e.code : 'processing_failed';
      if (['billing_busy', 'billing_lease_lost'].includes(code)) continue;
      // Decryption/configuration failures precede verifyReceipt and need durable, safe review evidence.
      if (['billing_recovery_corrupt', 'billing_recovery_key_missing', 'account_deleted'].includes(code)) {
        await withBillingLock(db, job.token_hash, (fence) => retryJob(db, job.token_hash, fence, code, now, true)).catch(() => { console.warn('billing_review_record_failed'); });
      }
    }
  }
  await db.prepare('DELETE FROM billing_locks WHERE token_hash IN (SELECT token_hash FROM billing_locks WHERE lease_until < ?1 LIMIT 1000)').bind(new Date(Date.now() - 3_600_000).toISOString()).run();
  return summary;
}
