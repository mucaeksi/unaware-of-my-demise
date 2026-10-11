import { z } from 'zod';
import { RewardAttachment } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import { grantStatements } from '../db/grants';
import { balanceOf, ledgerStatements } from '../db/ledger';
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
}

/** Value passed to Play as obfuscatedExternalAccountId when the purchase flow is launched: binds the purchase to this account. */
export const billingTag = async (playerId: string): Promise<string> => (await sha256Hex(`uomd-billing:${playerId}`)).slice(0, 40);

const tokenHash = (token: string): Promise<string> => sha256Hex(`play-token:${token}`);

async function loadProduct(db: D1Database, productId: string): Promise<ProductRow> {
  const p = await db.prepare('SELECT product_id, kind, title_en, grants, sub_config, active FROM shop_products WHERE product_id = ?1').bind(productId).first<ProductRow>();
  if (!p || !p.active) throw new HttpError(404, 'unknown_product', 'this product is not for sale');
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
  const product = await loadProduct(db, input.productId);
  const tag = await billingTag(playerId);
  const th = await tokenHash(input.purchaseToken);

  if (product.kind === 'consumable') {
    const p = await play.getProduct(product.product_id, input.purchaseToken);
    if (p.purchaseState === 'pending') return { status: 'pending', productId: product.product_id };
    if (p.purchaseState !== 'purchased' || !p.orderId) return { status: 'not_entitled', productId: product.product_id };
    if (p.obfuscatedAccountId !== tag) throw new HttpError(403, 'account_mismatch', 'this purchase belongs to another account');
    const existing = await db.prepare('SELECT player_id, acknowledged FROM purchases WHERE order_id = ?1').bind(p.orderId).first<{ player_id: string; acknowledged: number }>();
    if (existing) {
      if (existing.player_id !== playerId) throw new HttpError(409, 'order_owned', 'this order was already granted to another account');
      if (!existing.acknowledged && !p.consumed) await consume(db, play, product, input.purchaseToken, p.orderId);
      return { status: 'already_granted', productId: product.product_id, orderId: p.orderId };
    }
    const grants = z.array(RewardAttachment).parse(JSON.parse(product.grants));
    try {
      await db.batch([
        db.prepare("INSERT INTO purchases (order_id, player_id, product_id, kind, token_hash, period_start, granted_at) VALUES (?1, ?2, ?3, 'consumable', ?4, ?5, ?5)").bind(p.orderId, playerId, product.product_id, th, now.toISOString()),
        ...(await grantStatements(db, playerId, grants, { keyPrefix: `iap:${p.orderId}`, reason: `purchase:${product.product_id}` })),
        event(db, 'verify', p.orderId, 'granted', { productId: product.product_id })
      ]);
    } catch (e) {
      if (/UNIQUE constraint failed: (purchases|ledger)/i.test(String(e instanceof Error ? e.message : e))) return { status: 'already_granted', productId: product.product_id, orderId: p.orderId };
      throw e;
    }
    await consume(db, play, product, input.purchaseToken, p.orderId);
    return { status: 'granted', productId: product.product_id, orderId: p.orderId };
  }

  const cfg = SubConfig.parse(JSON.parse(product.sub_config as string));
  const s = await play.getSubscription(input.purchaseToken);
  if (s.productId !== product.product_id) throw new HttpError(422, 'product_mismatch', 'the token belongs to a different product');
  if (s.state === 'pending') return { status: 'pending', productId: product.product_id };
  if (!['active', 'canceled', 'in_grace'].includes(s.state) || !s.latestOrderId || s.expiryTimeMs <= now.getTime()) return { status: 'not_entitled', productId: product.product_id };
  if (s.obfuscatedAccountId !== tag) throw new HttpError(403, 'account_mismatch', 'this purchase belongs to another account');
  const res = await grantSubscriptionPeriod(db, play, playerId, product, cfg, th, s, input.purchaseToken, 'verify', now);
  await syncSubscriptionMail(db, playerId, now);
  return res;
}

async function consume(db: D1Database, play: PlayClient, product: ProductRow, token: string, orderId: string): Promise<void> {
  try {
    await play.consumeProduct(product.product_id, token); // consuming also acknowledges, and lets the item be bought again
    await db.batch([db.prepare('UPDATE purchases SET acknowledged = 1 WHERE order_id = ?1').bind(orderId), event(db, 'system', orderId, 'consumed')]);
  } catch (e) {
    // the grant is already safe in the database; the acknowledgement is retried by the next verify call or the sweep (Play refunds un-acknowledged purchases after 3 days)
    await db.batch([event(db, 'system', orderId, 'ack_failed', { error: String(e instanceof Error ? e.message : e).slice(0, 200) })]);
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
  const existing = await db.prepare('SELECT player_id FROM purchases WHERE order_id = ?1').bind(orderId).first<{ player_id: string }>();
  if (existing) {
    if (existing.player_id !== playerId) throw new HttpError(409, 'order_owned', 'this order was already granted to another account');
    return { status: 'already_granted', productId: product.product_id, orderId, periodEnd: new Date(s.expiryTimeMs).toISOString() };
  }
  const periodStart = new Date(Math.max(s.startTimeMs, s.expiryTimeMs - cfg.duration_days * 86_400_000)).toISOString();
  const periodEnd = new Date(s.expiryTimeMs).toISOString();
  try {
    await db.batch([
      db.prepare("INSERT INTO purchases (order_id, player_id, product_id, kind, token_hash, period_start, period_end, granted_at) VALUES (?1, ?2, ?3, 'subscription', ?4, ?5, ?6, ?7)").bind(orderId, playerId, product.product_id, th, periodStart, periodEnd, now.toISOString()),
      ...(await grantStatements(db, playerId, cfg.instant, { keyPrefix: `iap:${orderId}:instant`, reason: `subscription:${product.product_id}` })),
      event(db, source, orderId, 'period_granted', { productId: product.product_id, periodEnd })
    ]);
  } catch (e) {
    if (/UNIQUE constraint failed: (purchases|ledger)/i.test(String(e instanceof Error ? e.message : e))) return { status: 'already_granted', productId: product.product_id, orderId, periodEnd };
    throw e;
  }
  if (!s.acknowledged) {
    try {
      await play.acknowledgeSubscription(product.product_id, token);
      await db.prepare('UPDATE purchases SET acknowledged = 1 WHERE order_id = ?1').bind(orderId).run();
    } catch (e) {
      await db.batch([event(db, 'system', orderId, 'ack_failed', { error: String(e instanceof Error ? e.message : e).slice(0, 200) })]);
    }
  } else {
    await db.prepare('UPDATE purchases SET acknowledged = 1 WHERE order_id = ?1').bind(orderId).run();
  }
  return { status: 'granted', productId: product.product_id, orderId, periodEnd };
}

/**
 * Subscription entitlements are mail: one per half-day window since the period began (canon: 60 x 187 Eclipse Tokens, 14-day claim grace).
 * Idempotent (mail source keys), so it is safe to call on every mailbox open.
 */
export async function syncSubscriptionMail(db: D1Database, playerId: string, now = new Date()): Promise<number> {
  const { results } = await db
    .prepare("SELECT p.order_id, p.product_id, p.period_start, p.period_end, s.sub_config FROM purchases p JOIN shop_products s ON s.product_id = p.product_id WHERE p.player_id = ?1 AND p.kind = 'subscription' AND p.state = 'granted' AND p.period_end > ?2 AND p.period_start <= ?2")
    .bind(playerId, now.toISOString())
    .all<{ order_id: string; product_id: string; period_start: string; period_end: string; sub_config: string }>();
  let created = 0;
  for (const r of results) {
    const cfg = SubConfig.parse(JSON.parse(r.sub_config));
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

/** Take back a refunded / revoked purchase: debit what is still in the wallet, record what is not recoverable. */
export async function refundPurchase(db: D1Database, orderId: string, source: 'rtdn' | 'system', now = new Date()): Promise<{ refunded: boolean; unrecovered: Record<string, number> }> {
  const p = await db.prepare('SELECT player_id, product_id, kind, state FROM purchases WHERE order_id = ?1').bind(orderId).first<{ player_id: string; product_id: string; kind: string; state: string }>();
  if (!p || p.state === 'refunded') return { refunded: false, unrecovered: {} };
  const product = await db.prepare('SELECT grants, sub_config FROM shop_products WHERE product_id = ?1').bind(p.product_id).first<{ grants: string; sub_config: string | null }>();
  const atts: RewardAttachment[] = product ? (p.kind === 'subscription' ? SubConfig.parse(JSON.parse(product.sub_config as string)).instant : z.array(RewardAttachment).parse(JSON.parse(product.grants))) : [];
  const marked = await db.batch([
    db.prepare("UPDATE purchases SET state = 'refunded', refunded_at = ?2 WHERE order_id = ?1 AND state = 'granted'").bind(orderId, now.toISOString()),
    event(db, source, orderId, 'refunded')
  ]);
  if (marked[0]?.meta.changes !== 1) return { refunded: false, unrecovered: {} };
  const unrecovered: Record<string, number> = {};
  for (const [i, a] of atts.entries()) {
    if (a.type !== 'currency') continue;
    const have = await balanceOf(db, p.player_id, a.currency);
    const take = Math.min(have, a.amount);
    let taken = 0;
    if (take > 0) {
      try {
        await db.batch(ledgerStatements(db, { playerId: p.player_id, currency: a.currency, delta: -take, reason: `refund:${orderId}`, idempotencyKey: `iap:${orderId}:refund:${i}` }));
        taken = take;
      } catch {
        taken = 0; // spent in the meantime: record it instead
      }
    }
    if (a.amount - taken > 0) unrecovered[a.currency] = (unrecovered[a.currency] ?? 0) + a.amount - taken;
  }
  await db.prepare('UPDATE purchases SET unrecovered = ?2 WHERE order_id = ?1').bind(orderId, JSON.stringify(unrecovered)).run();
  return { refunded: true, unrecovered };
}
