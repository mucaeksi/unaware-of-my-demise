import { z } from 'zod';
import { RewardAttachment } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import { grantStatements } from '../db/grants';
import { ledgerStatements, type Currency } from '../db/ledger';
import { sendMail } from '../mail/service';
import type { PlayClient } from './play';

export const SubConfig = z
  .object({
    duration_days: z.number().int().min(1).max(366),
    instant: z.array(RewardAttachment).max(8),
    periodic: z
      .object({ every_hours: z.number().int().min(1).max(168), count: z.number().int().min(1).max(400), mail_title: z.string().min(1).max(100), attachments: z.array(RewardAttachment).min(1).max(8), claim_days: z.number().int().min(1).max(60) })
      .strict()
  })
  .strict();
export type SubConfig = z.infer<typeof SubConfig>;

interface ProductRow {
  product_id: string;
  kind: 'consumable' | 'subscription';
  title_en: string;
  grants: string;
  sub_config: string | null;
  active: number;
  updated_at: string;
}

const Fulfillment = z.object({ grants: z.array(RewardAttachment), subscription: SubConfig.nullable(), catalogUpdatedAt: z.string() }).strict();

/** Value passed to Play as obfuscatedExternalAccountId when the purchase flow is launched: binds the purchase to this account. */
export const billingTag = async (playerId: string): Promise<string> => (await sha256Hex(`uomd-billing:${playerId}`)).slice(0, 40);

const tokenHash = (token: string): Promise<string> => sha256Hex(`play-token:${token}`);

async function loadProduct(db: D1Database, productId: string): Promise<ProductRow> {
  const p = await db.prepare('SELECT product_id, kind, title_en, grants, sub_config, active, updated_at FROM shop_products WHERE product_id = ?1').bind(productId).first<ProductRow>();
  if (!p) throw new HttpError(404, 'unknown_product', 'this product is unknown');
  return p;
}

export async function listProducts(db: D1Database): Promise<Record<string, unknown>[]> {
  const { results } = await db.prepare('SELECT product_id, kind, title_en, grants, sub_config FROM shop_products WHERE active = 1 ORDER BY product_id').all<ProductRow>();
  return results.map((r) => ({ productId: r.product_id, kind: r.kind, title: r.title_en, grants: JSON.parse(r.grants), subscription: r.sub_config ? JSON.parse(r.sub_config) : null }));
}

const event = (db: D1Database, source: 'verify' | 'rtdn' | 'system', orderId: string | null, type: string, detail: Record<string, unknown> = {}): D1PreparedStatement =>
  db.prepare('INSERT INTO purchase_events (source, order_id, type, detail) VALUES (?1, ?2, ?3, ?4)').bind(source, orderId, type, JSON.stringify(detail));

export interface VerifyResult {
  status: 'granted' | 'already_granted' | 'pending' | 'not_entitled';
  productId: string;
  orderId?: string;
  periodEnd?: string;
}

/**
 * Verifies a purchase with Google Play (never trusts the client), binds it to the account, grants exactly once per order id
 * (the primary key of `purchases` + ledger idempotency keys) and acknowledges / consumes it afterwards.
 */
export async function verifyPurchase(db: D1Database, play: PlayClient, playerId: string, input: { productId: string; purchaseToken: string }, now = new Date()): Promise<VerifyResult> {
  const player = await db.prepare('SELECT status FROM players WHERE id = ?1').bind(playerId).first<{ status: string }>();
  if (!player || player.status === 'deleted') throw new HttpError(403, 'account_deleted', 'this account cannot receive purchase benefits');
  const product = await loadProduct(db, input.productId);
  const tag = await billingTag(playerId);
  const th = await tokenHash(input.purchaseToken);
  const known = await db.prepare('SELECT kind, fulfillment FROM purchases WHERE token_hash = ?1 AND product_id = ?2 ORDER BY granted_at DESC LIMIT 1').bind(th, input.productId).first<{ kind: ProductRow['kind']; fulfillment: string | null }>();
  const currentKind = product.kind;
  if (known) product.kind = known.kind; // a catalog edit cannot reinterpret an already-paid token

  if (product.kind === 'consumable') {
    const p = await play.getProduct(product.product_id, input.purchaseToken);
    if (p.purchaseState === 'pending') return { status: 'pending', productId: product.product_id };
    if (p.purchaseState !== 'purchased' || !p.orderId) return { status: 'not_entitled', productId: product.product_id };
    if (p.obfuscatedAccountId !== tag) throw new HttpError(403, 'account_mismatch', 'this purchase belongs to another account');
    const existing = await db.prepare('SELECT player_id, acknowledged, state FROM purchases WHERE order_id = ?1').bind(p.orderId).first<{ player_id: string; acknowledged: number; state: string }>();
    if (existing) {
      if (existing.player_id !== playerId) throw new HttpError(409, 'order_owned', 'this order was already granted to another account');
      if (existing.state === 'refunded') return { status: 'not_entitled', productId: product.product_id, orderId: p.orderId };
      if (!existing.acknowledged && !p.consumed) await consume(db, play, product, input.purchaseToken, p.orderId);
      return { status: 'already_granted', productId: product.product_id, orderId: p.orderId };
    }
    const grants = z.array(RewardAttachment).parse(JSON.parse(product.grants));
    try {
      await db.batch([
        db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status <> \'deleted\') THEN 1 ELSE 0 END)').bind(playerId),
        db.prepare("INSERT INTO purchases (order_id, player_id, product_id, kind, token_hash, period_start, granted_at, fulfillment) VALUES (?1, ?2, ?3, 'consumable', ?4, ?5, ?5, ?6)").bind(p.orderId, playerId, product.product_id, th, now.toISOString(), JSON.stringify({ grants, subscription: null, catalogUpdatedAt: product.updated_at })),
        ...(await grantStatements(db, playerId, grants, { keyPrefix: `iap:${p.orderId}`, reason: `purchase:${product.product_id}` })),
        event(db, 'verify', p.orderId, 'granted', { productId: product.product_id }),
        db.prepare('DELETE FROM tx_guard')
      ]);
    } catch (e) {
      if (/CHECK constraint failed: ok = 1/i.test(String(e))) throw new HttpError(403, 'account_deleted', 'this account cannot receive purchase benefits');
      if (/UNIQUE constraint failed: (purchases|ledger)/i.test(String(e instanceof Error ? e.message : e))) return { status: 'already_granted', productId: product.product_id, orderId: p.orderId };
      throw e;
    }
    await consume(db, play, product, input.purchaseToken, p.orderId);
    return { status: 'granted', productId: product.product_id, orderId: p.orderId };
  }

  const s = await play.getSubscription(input.purchaseToken, product.product_id);
  if (s.productId !== product.product_id) throw new HttpError(422, 'product_mismatch', 'the token belongs to a different product');
  if (s.obfuscatedAccountId !== tag) throw new HttpError(403, 'account_mismatch', 'this purchase belongs to another account');
  if (!Number.isFinite(s.expiryTimeMs) || s.expiryTimeMs < 0) throw new HttpError(503, 'billing_invalid_response', 'billing expiry could not be verified');
  await db.prepare("UPDATE purchases SET entitlement_state = ?2, period_end = CASE WHEN order_id = ?3 THEN ?4 ELSE period_end END, entitlement_checked_at = ?5 WHERE token_hash = ?1 AND state = 'granted' AND (entitlement_checked_at IS NULL OR entitlement_checked_at <= ?5)")
    .bind(th, s.state, s.latestOrderId, new Date(s.expiryTimeMs).toISOString(), now.toISOString()).run();
  if (s.state === 'pending') return { status: 'pending', productId: product.product_id };
  if (!['active', 'canceled', 'in_grace'].includes(s.state) || !s.latestOrderId || s.expiryTimeMs <= now.getTime()) return { status: 'not_entitled', productId: product.product_id };
  const old = await db.prepare('SELECT fulfillment FROM purchases WHERE order_id = ?1').bind(s.latestOrderId).first<{ fulfillment: string | null }>();
  if (old && !old.fulfillment) throw new HttpError(409, 'fulfillment_requires_review', 'legacy purchase terms need operator review');
  const frozen = old?.fulfillment ?? (currentKind !== product.kind ? known?.fulfillment : null);
  const cfg = frozen ? Fulfillment.parse(JSON.parse(frozen)).subscription! : SubConfig.parse(JSON.parse(product.sub_config as string));
  const res = await grantSubscriptionPeriod(db, play, playerId, product, cfg, th, s, input.purchaseToken, 'verify', now);
  await syncSubscriptionMail(db, playerId, now);
  return res;
}

async function consume(db: D1Database, play: PlayClient, product: ProductRow, token: string, orderId: string): Promise<void> {
  try {
    await play.consumeProduct(product.product_id, token); // consuming also acknowledges, and lets the item be bought again
    await db.batch([db.prepare('UPDATE purchases SET acknowledged = 1 WHERE order_id = ?1').bind(orderId), event(db, 'system', orderId, 'consumed')]);
  } catch {
    // The grant is durable; subsequent verification retries this work. Scheduled reconciliation is tracked separately.
    await db.batch([event(db, 'system', orderId, 'ack_failed', { code: 'play_consume_failed' })]);
  }
}

async function grantSubscriptionPeriod(
  db: D1Database,
  play: PlayClient,
  playerId: string,
  product: ProductRow,
  cfg: SubConfig,
  th: string,
  s: Awaited<ReturnType<PlayClient['getSubscription']>>,
  token: string,
  source: 'verify' | 'rtdn',
  now: Date
): Promise<VerifyResult> {
  const orderId = s.latestOrderId;
  const existing = await db.prepare('SELECT player_id, acknowledged, state, entitlement_state, period_end FROM purchases WHERE order_id = ?1').bind(orderId).first<{ player_id: string; acknowledged: number; state: string; entitlement_state: string; period_end: string }>();
  if (existing) {
    if (existing.player_id !== playerId) throw new HttpError(409, 'order_owned', 'this order was already granted to another account');
    if (existing.state === 'refunded' || !['active', 'canceled', 'in_grace'].includes(existing.entitlement_state)) return { status: 'not_entitled', productId: product.product_id, orderId };
    if (!existing.acknowledged) await acknowledgeSubscription(db, play, product.product_id, token, orderId, s.acknowledged);
    return { status: 'already_granted', productId: product.product_id, orderId, periodEnd: existing.period_end };
  }
  const order = await play.getOrder(orderId);
  if (order.orderId !== orderId || order.purchaseToken !== token) throw new HttpError(422, 'order_mismatch', 'the order does not match this purchase');
  if (!Number.isSafeInteger(order.createTimeMs) || order.createTimeMs <= 0) throw new HttpError(503, 'billing_invalid_response', 'billing period start could not be verified');
  const start = Math.max(s.startTimeMs, order.createTimeMs);
  if (!Number.isFinite(start) || start >= s.expiryTimeMs) throw new HttpError(409, 'period_requires_review', 'billing period boundaries need reconciliation');
  const periodStart = new Date(start).toISOString();
  const periodEnd = new Date(s.expiryTimeMs).toISOString();
  try {
    await db.batch([
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status <> \'deleted\') THEN 1 ELSE 0 END)').bind(playerId),
      db.prepare("INSERT INTO purchases (order_id, player_id, product_id, kind, token_hash, period_start, period_end, granted_at, fulfillment, entitlement_state, entitlement_checked_at) VALUES (?1, ?2, ?3, 'subscription', ?4, ?5, ?6, ?7, ?8, ?9, ?7)").bind(orderId, playerId, product.product_id, th, periodStart, periodEnd, now.toISOString(), JSON.stringify({ grants: cfg.instant, subscription: cfg, catalogUpdatedAt: product.updated_at }), s.state),
      ...(await grantStatements(db, playerId, cfg.instant, { keyPrefix: `iap:${orderId}:instant`, reason: `subscription:${product.product_id}` })),
      event(db, source, orderId, 'period_granted', { productId: product.product_id, periodEnd }),
      db.prepare('DELETE FROM tx_guard')
    ]);
  } catch (e) {
    if (/CHECK constraint failed: ok = 1/i.test(String(e))) throw new HttpError(403, 'account_deleted', 'this account cannot receive purchase benefits');
    if (/UNIQUE constraint failed: (purchases|ledger)/i.test(String(e instanceof Error ? e.message : e))) return { status: 'already_granted', productId: product.product_id, orderId, periodEnd };
    throw e;
  }
  await acknowledgeSubscription(db, play, product.product_id, token, orderId, s.acknowledged);
  return { status: 'granted', productId: product.product_id, orderId, periodEnd };
}

async function acknowledgeSubscription(db: D1Database, play: PlayClient, productId: string, token: string, orderId: string, acknowledged: boolean): Promise<void> {
  if (!acknowledged) {
    try {
      await play.acknowledgeSubscription(productId, token);
      await db.prepare('UPDATE purchases SET acknowledged = 1 WHERE order_id = ?1').bind(orderId).run();
    } catch {
      await db.batch([event(db, 'system', orderId, 'ack_failed', { code: 'play_ack_failed' })]);
    }
  } else {
    await db.prepare('UPDATE purchases SET acknowledged = 1 WHERE order_id = ?1').bind(orderId).run();
  }
}

/**
 * Subscription entitlements are mail: one per half-day window since the period began (canon: 60 x 187 Eclipse Tokens, 14-day claim grace).
 * Idempotent (mail source keys), so it is safe to call on every mailbox open.
 */
export async function syncSubscriptionMail(db: D1Database, playerId: string, now = new Date()): Promise<number> {
  const { results } = await db
    .prepare("SELECT p.order_id, p.product_id, p.period_start, p.period_end, p.fulfillment FROM purchases p JOIN players u ON u.id = p.player_id WHERE p.player_id = ?1 AND u.status <> 'deleted' AND p.kind = 'subscription' AND p.state = 'granted' AND p.entitlement_state IN ('active', 'canceled', 'in_grace') AND p.period_end > ?2 AND p.period_start <= ?2")
    .bind(playerId, now.toISOString())
    .all<{ order_id: string; product_id: string; period_start: string; period_end: string; fulfillment: string | null }>();
  let created = 0;
  for (const r of results) {
    if (!r.fulfillment) continue; // legacy terms are unknown; never invent them from a later catalog edit
    const cfg = Fulfillment.parse(JSON.parse(r.fulfillment)).subscription!;
    const every = cfg.periodic.every_hours * 3_600_000;
    const due = Math.min(cfg.periodic.count, Math.floor((now.getTime() - Date.parse(r.period_start)) / every) + 1);
    for (let k = 1; k <= due; k++) {
      const at = new Date(Date.parse(r.period_start) + (k - 1) * every);
      const m = await sendMail(db, playerId, { kind: 'subscription', title: cfg.periodic.mail_title, body: `Offering ${k} of ${cfg.periodic.count}`, attachments: cfg.periodic.attachments, expiresInDays: cfg.periodic.claim_days, sourceKey: `sub:${r.order_id}:hd:${k}` }, 'system:subscription', at);
      if (m.created) created++;
    }
  }
  return created;
}

/** Currency refunds use original immutable credits; marker, clawback, shortfall and event commit together. */
export async function refundPurchase(db: D1Database, orderId: string, source: 'rtdn' | 'system', now = new Date()): Promise<{ refunded: boolean; unrecovered: Record<string, number> }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const p = await db.prepare('SELECT player_id, kind, state FROM purchases WHERE order_id = ?1').bind(orderId).first<{ player_id: string; kind: string; state: string }>();
    if (!p || p.state === 'refunded') return { refunded: false, unrecovered: {} };
    const prefix = p.kind === 'subscription' ? `iap:${orderId}:instant:` : `iap:${orderId}:`;
    const credits = (await db.prepare('SELECT currency, SUM(delta) AS amount FROM ledger WHERE player_id = ?1 AND delta > 0 AND substr(idempotency_key, 1, length(?2)) = ?2 GROUP BY currency')
      .bind(p.player_id, prefix).all<{ currency: Currency; amount: number }>()).results;
    const debits: D1PreparedStatement[] = [];
    const unrecovered: Record<string, number> = {};
    for (const [i, credit] of credits.entries()) {
      if (!Number.isSafeInteger(credit.amount) || credit.amount <= 0) throw new HttpError(409, 'refund_requires_review', 'original credit amount needs operator review');
      const wallet = await db.prepare('SELECT balance, version FROM wallets WHERE player_id = ?1 AND currency = ?2')
        .bind(p.player_id, credit.currency).first<{ balance: number; version: number }>();
      const take = Math.min(wallet?.balance ?? 0, credit.amount);
      // A concurrent spend/grant/delete changes the version; retry the whole refund rather than classifying an outage as spending.
      debits.push(db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN COALESCE((SELECT version FROM wallets WHERE player_id = ?1 AND currency = ?2), -1) = ?3 THEN 1 ELSE 0 END)')
        .bind(p.player_id, credit.currency, wallet?.version ?? -1));
      if (take > 0) debits.push(...ledgerStatements(db, { playerId: p.player_id, currency: credit.currency, delta: -take, reason: `refund:${orderId}`, idempotencyKey: `iap:${orderId}:refund:${i}` }));
      if (credit.amount > take) unrecovered[credit.currency] = credit.amount - take;
    }
    try {
      await db.batch([
        db.prepare("UPDATE purchases SET state = 'refunded', refunded_at = ?2, unrecovered = ?3 WHERE order_id = ?1 AND state = 'granted'")
          .bind(orderId, now.toISOString(), JSON.stringify(unrecovered)),
        db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
        ...debits,
        event(db, source, orderId, 'refunded'),
        db.prepare('DELETE FROM tx_guard')
      ]);
      return { refunded: true, unrecovered };
    } catch (e) {
      const message = String(e instanceof Error ? e.message : e);
      if (/CHECK constraint failed: (ok = 1|balance >= 0)/i.test(message)) continue;
      throw e;
    }
  }
  throw new HttpError(409, 'busy', 'concurrent wallet changes; retry this refund');
}
