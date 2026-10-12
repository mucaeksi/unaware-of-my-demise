import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import type { GameEnv } from '../env';
import { googleKeyResolver } from '../player/auth';
import type { PlayClient } from './play';
import { refundPurchase, verifyPurchase } from './service';

/**
 * Pub/Sub push authentication: the push subscription is configured with an OIDC token (audience = RTDN_AUDIENCE, signed by the
 * service account RTDN_PUSH_SERVICE_ACCOUNT). Anything else is refused; the endpoint fails closed when unconfigured.
 */
export async function authenticatePush(req: Request, env: GameEnv, getKey?: JWTVerifyGetKey): Promise<void> {
  if (!env.RTDN_AUDIENCE || !env.RTDN_PUSH_SERVICE_ACCOUNT) throw new HttpError(503, 'rtdn_not_configured', 'RTDN is not configured for this environment');
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '');
  if (!m?.[1]) throw new HttpError(401, 'unauthenticated', 'missing push token');
  try {
    const { payload } = await jwtVerify(m[1], getKey ?? googleKeyResolver(env), { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: env.RTDN_AUDIENCE, algorithms: ['RS256'] });
    if (payload.email !== env.RTDN_PUSH_SERVICE_ACCOUNT || payload.email_verified !== true) throw new Error('wrong service account');
  } catch {
    throw new HttpError(401, 'unauthenticated', 'push token rejected');
  }
}

const Push = z.object({ message: z.object({ data: z.string().min(2).max(20_000), messageId: z.string().regex(/^[A-Za-z0-9._:-]{1,100}$/) }).passthrough(), subscription: z.string().optional() }).passthrough();
const Notification = z
  .object({
    packageName: z.string().optional(),
    testNotification: z.object({}).passthrough().optional(),
    subscriptionNotification: z.object({ notificationType: z.number().int(), purchaseToken: z.string().min(1), subscriptionId: z.string().optional() }).passthrough().optional(),
    oneTimeProductNotification: z.object({ notificationType: z.number().int(), purchaseToken: z.string().min(1), sku: z.string().optional() }).passthrough().optional(),
    voidedPurchaseNotification: z.object({ purchaseToken: z.string().optional(), orderId: z.string().min(1), productType: z.number().int().optional() }).passthrough().optional()
  })
  .passthrough();

/** Subscription notification types that should (re)grant the current period; 12 = revoked is handled as a refund. */
const GRANTING = new Set([1, 2, 4, 7]); // RECOVERED, RENEWED, PURCHASED, RESTARTED
const REVOKED = 12;

export async function handleRtdn(db: D1Database, env: GameEnv, play: PlayClient, raw: unknown, now = new Date()): Promise<{ handled: string }> {
  const push = Push.safeParse(raw);
  if (!push.success) throw new HttpError(400, 'bad_request', 'not a Pub/Sub push message');
  const messageId = push.data.message.messageId;
  const payloadHash = await sha256Hex(push.data.message.data);
  const owner = crypto.randomUUID();
  const leaseUntil = new Date(now.getTime() + 60_000).toISOString();
  const claim = await db.prepare(`INSERT INTO rtdn_seen (message_id, state, payload_hash, owner, lease_until, attempts)
    VALUES (?1, 'processing', ?2, ?3, ?4, 1)
    ON CONFLICT (message_id) DO UPDATE SET state = 'processing', payload_hash = excluded.payload_hash,
      owner = excluded.owner, lease_until = excluded.lease_until, attempts = rtdn_seen.attempts + 1
    WHERE (rtdn_seen.payload_hash IS NULL OR rtdn_seen.payload_hash = excluded.payload_hash)
      AND rtdn_seen.attempts < 10 AND (rtdn_seen.state IN ('legacy', 'pending') OR
        (rtdn_seen.state = 'processing' AND rtdn_seen.lease_until <= ?5)) RETURNING attempts`)
    .bind(messageId, payloadHash, owner, leaseUntil, now.toISOString()).first<{ attempts: number }>();
  if (!claim) {
    const row = await db.prepare('SELECT state, payload_hash FROM rtdn_seen WHERE message_id = ?1').bind(messageId).first<{ state: string; payload_hash: string | null }>();
    if (row?.payload_hash && row.payload_hash !== payloadHash) throw new HttpError(409, 'rtdn_message_conflict', 'notification id was reused with different content');
    if (row?.state === 'done') return { handled: 'duplicate' };
    if (row?.state === 'dead_letter') throw new HttpError(503, 'rtdn_dead_letter', 'notification needs operator replay');
    // A termination on the final attempt also becomes visible operator work after its lease expires.
    await db.prepare("UPDATE rtdn_seen SET state = 'dead_letter', owner = NULL, lease_until = NULL, last_code = 'attempts_exhausted' WHERE message_id = ?1 AND state = 'processing' AND attempts >= 10 AND lease_until <= ?2")
      .bind(messageId, now.toISOString()).run();
    throw new HttpError(503, 'rtdn_busy', 'notification is still being processed; retry delivery');
  }
  try {
    const result = await processNotification(db, env, play, push.data.message.data, messageId, now);
    const done = await db.prepare("UPDATE rtdn_seen SET state = 'done', completed_at = ?3, outcome = ?4, last_code = NULL, owner = NULL, lease_until = NULL WHERE message_id = ?1 AND state = 'processing' AND owner = ?2")
      .bind(messageId, owner, now.toISOString(), result.handled).run();
    if (done.meta.changes !== 1) throw new HttpError(503, 'rtdn_lease_lost', 'notification processing ownership changed; retry delivery');
    return result;
  } catch (e) {
    await db.prepare("UPDATE rtdn_seen SET state = CASE WHEN attempts >= 10 THEN 'dead_letter' ELSE 'pending' END, last_code = ?3, owner = NULL, lease_until = NULL WHERE message_id = ?1 AND state = 'processing' AND owner = ?2")
      .bind(messageId, owner, e instanceof HttpError ? e.code : 'processing_failed').run();
    throw e;
  }
}

async function processNotification(db: D1Database, env: GameEnv, play: PlayClient, data: string, messageId: string, now: Date): Promise<{ handled: string }> {
  let note: z.infer<typeof Notification>;
  try {
    note = Notification.parse(JSON.parse(atob(data)));
  } catch {
    return { handled: 'ignored_unparseable' }; // acknowledge garbage so Pub/Sub does not redeliver it forever
  }
  if (env.PLAY_PACKAGE_NAME && note.packageName && note.packageName !== env.PLAY_PACKAGE_NAME) return { handled: 'ignored_other_package' };
  const log = (type: string, orderId: string | null, detail: Record<string, unknown>) =>
    db.prepare("INSERT INTO purchase_events (source, order_id, type, detail) VALUES ('rtdn', ?1, ?2, ?3) ON CONFLICT DO NOTHING").bind(orderId, type, JSON.stringify({ ...detail, messageId })).run();

  if (note.testNotification) {
    await log('test', null, {});
    return { handled: 'test' };
  }
  if (note.voidedPurchaseNotification) {
    const r = await refundPurchase(db, note.voidedPurchaseNotification.orderId, 'rtdn', now);
    await log('voided', note.voidedPurchaseNotification.orderId, { refunded: r.refunded, unrecovered: r.unrecovered });
    return { handled: r.refunded ? 'refunded' : 'voided_unknown_order' };
  }
  const sub = note.subscriptionNotification;
  if (sub) {
    const th = await sha256Hex(`play-token:${sub.purchaseToken}`);
    const known = await db.prepare('SELECT player_id, product_id FROM purchases WHERE token_hash = ?1 ORDER BY granted_at DESC LIMIT 1').bind(th).first<{ player_id: string; product_id: string }>();
    if (!known) {
      await log('subscription_unmatched', null, { type: sub.notificationType }); // the first purchase is granted by the client's verify call
      return { handled: 'unmatched' };
    }
    if (sub.notificationType === REVOKED) {
      const { results } = await db.prepare("SELECT order_id FROM purchases WHERE token_hash = ?1 AND state = 'granted'").bind(th).all<{ order_id: string }>();
      for (const o of results) await refundPurchase(db, o.order_id, 'rtdn', now);
      await log('revoked', null, { orders: results.length });
      return { handled: 'revoked' };
    }
    // Play is asked again for every state change; grants remain idempotent per order id.
    try {
      await verifyPurchase(db, play, known.player_id, { productId: known.product_id, purchaseToken: sub.purchaseToken }, now);
    } catch (e) {
      if (e instanceof HttpError && ['account_mismatch', 'unknown_product', 'account_deleted'].includes(e.code)) {
        await log('subscription_rejected', null, { type: sub.notificationType, code: e.code });
        return { handled: 'subscription_rejected' };
      }
      throw e;
    }
    await log('subscription', null, { type: sub.notificationType });
    return { handled: GRANTING.has(sub.notificationType) ? 'subscription' : 'state_reconciled' };
  }
  if (note.oneTimeProductNotification) {
    await log('one_time', null, { type: note.oneTimeProductNotification.notificationType }); // grants happen on the client's verify call
    return { handled: 'noted' };
  }
  return { handled: 'ignored' };
}
