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
    if (payload.email !== env.RTDN_PUSH_SERVICE_ACCOUNT || payload.email_verified === false) throw new Error('wrong service account');
  } catch {
    throw new HttpError(401, 'unauthenticated', 'push token rejected');
  }
}

const Push = z.object({ message: z.object({ data: z.string().min(2).max(20_000), messageId: z.string().min(1).max(100) }).passthrough(), subscription: z.string().optional() }).passthrough();
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
  const seen = await db.prepare('INSERT OR IGNORE INTO rtdn_seen (message_id) VALUES (?1)').bind(push.data.message.messageId).run();
  if (seen.meta.changes !== 1) return { handled: 'duplicate' };
  let note: z.infer<typeof Notification>;
  try {
    note = Notification.parse(JSON.parse(atob(push.data.message.data)));
  } catch {
    return { handled: 'ignored_unparseable' }; // acknowledge garbage so Pub/Sub does not redeliver it forever
  }
  if (env.PLAY_PACKAGE_NAME && note.packageName && note.packageName !== env.PLAY_PACKAGE_NAME) return { handled: 'ignored_other_package' };
  const log = (type: string, orderId: string | null, detail: Record<string, unknown>) =>
    db.prepare("INSERT INTO purchase_events (source, order_id, type, detail) VALUES ('rtdn', ?1, ?2, ?3)").bind(orderId, type, JSON.stringify(detail)).run();

  try {
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
      if (GRANTING.has(sub.notificationType)) {
        // same code path as the client's verify call: Play is asked again and the grant is idempotent per order id
        await verifyPurchase(db, play, known.player_id, { productId: known.product_id, purchaseToken: sub.purchaseToken }, now).catch((e: unknown) => {
          if (e instanceof HttpError && (e.code === 'account_mismatch' || e.code === 'unknown_product')) return;
          throw e;
        });
        await log('subscription', null, { type: sub.notificationType });
        return { handled: 'subscription' };
      }
      await log('subscription_state', null, { type: sub.notificationType });
      return { handled: 'state_noted' };
    }
    if (note.oneTimeProductNotification) {
      await log('one_time', null, { type: note.oneTimeProductNotification.notificationType }); // grants happen on the client's verify call
      return { handled: 'noted' };
    }
    return { handled: 'ignored' };
  } catch (e) {
    // let Pub/Sub redeliver: forget the message id so the retry is processed
    await db.prepare('DELETE FROM rtdn_seen WHERE message_id = ?1').bind(push.data.message.messageId).run();
    throw e;
  }
}
