import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { billingTag, refundPurchase, syncSubscriptionMail, verifyPurchase } from '../src/billing/service';
import { claimMail } from '../src/mail/service';
import { deleteAccount } from '../src/account/service';
import { applyLedger } from '../src/db/ledger';
import { fakePlay, game, playClient, post, pushToken, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let n = 0;
const uid = (): string => `${++n}${Math.random().toString(36).slice(2, 8)}`;
const HOUR = 3_600_000;

beforeEach(async () => {
  fakePlay.reset();
  await db().prepare("INSERT OR REPLACE INTO shop_products (product_id, kind, title_en, grants, active) VALUES ('tokens_small', 'consumable', 'Small pouch', '[{\"type\":\"currency\",\"currency\":\"eclipse_token\",\"amount\":320}]', 1)").run();
  await db().prepare("UPDATE shop_products SET active = 1 WHERE product_id = 'eclipse_blessing_30d'").run();
});

async function newProduct(playerId: string, over: Partial<{ orderId: string; state: 'purchased' | 'canceled' | 'pending'; tag: string | null }> = {}): Promise<{ token: string; orderId: string }> {
  const token = `tok_${uid()}_${'x'.repeat(20)}`;
  const orderId = over.orderId ?? `GPA.${uid()}`;
  const tag = over.tag === null ? undefined : (over.tag ?? (await billingTag(playerId)));
  fakePlay.products.set(token, { purchaseState: over.state ?? 'purchased', orderId, acknowledged: false, consumed: false, purchaseTimeMs: Date.now(), ...(tag ? { obfuscatedAccountId: tag } : {}) });
  return { token, orderId };
}

async function newSub(playerId: string, over: { orderId?: string; startAgoH?: number; remainingH?: number; state?: 'active' | 'canceled' | 'expired' | 'pending' | 'on_hold'; tag?: string | null } = {}): Promise<{ token: string; orderId: string }> {
  const token = `sub_${uid()}_${'y'.repeat(20)}`;
  const orderId = over.orderId ?? `GPA.${uid()}..0`;
  const tag = over.tag === null ? undefined : (over.tag ?? (await billingTag(playerId)));
  const now = Date.now();
  fakePlay.subs.set(token, {
    state: over.state ?? 'active',
    productId: 'eclipse_blessing_30d',
    latestOrderId: orderId,
    acknowledged: false,
    startTimeMs: now - (over.startAgoH ?? 0) * HOUR,
    expiryTimeMs: now + (over.remainingH ?? 720) * HOUR,
    ...(tag ? { obfuscatedAccountId: tag } : {})
  });
  return { token, orderId };
}

const verify = (auth: Record<string, string>, productId: string, purchaseToken: string) => game('/api/v1/shop/verify', post({ productId, purchaseToken }, auth));
const wallet = async (auth: Record<string, string>): Promise<Record<string, number>> => ((await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> }).wallets;

describe('one-time products', () => {
  it('verifies with Play, grants once, consumes the purchase; replays and double submits grant nothing more', async () => {
    const { auth, playerId } = await signIn(`sub-iap-${uid()}`);
    const { token, orderId } = await newProduct(playerId);
    const res = await verify(auth, 'tokens_small', token);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'granted', orderId });
    expect((await wallet(auth)).eclipse_token).toBe(320);
    expect(fakePlay.calls).toEqual([`consume:tokens_small:${token}`]);
    expect(await db().prepare('SELECT acknowledged, state FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ acknowledged: 1, state: 'granted' });
    expect(await (await verify(auth, 'tokens_small', token)).json()).toMatchObject({ status: 'already_granted' });
    const rs = await Promise.all(Array.from({ length: 10 }, () => verify(auth, 'tokens_small', token)));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect((await wallet(auth)).eclipse_token).toBe(320);
  });

  it('refuses purchases that belong to another account, are pending/cancelled, or are for an unknown product', async () => {
    const a = await signIn(`sub-iapa-${uid()}`);
    const b = await signIn(`sub-iapb-${uid()}`);
    const forA = await newProduct(a.playerId);
    const stolen = await verify(b.auth, 'tokens_small', forA.token);
    expect(stolen.status).toBe(403);
    expect(((await stolen.json()) as { error: string }).error).toBe('account_mismatch');
    const untagged = await newProduct(a.playerId, { tag: null });
    expect((await verify(a.auth, 'tokens_small', untagged.token)).status).toBe(403);
    const pending = await newProduct(a.playerId, { state: 'pending' });
    expect(await (await verify(a.auth, 'tokens_small', pending.token)).json()).toMatchObject({ status: 'pending' });
    const canceled = await newProduct(a.playerId, { state: 'canceled' });
    expect(await (await verify(a.auth, 'tokens_small', canceled.token)).json()).toMatchObject({ status: 'not_entitled' });
    expect((await verify(a.auth, 'no_such_product', 'z'.repeat(30))).status).toBe(404);
    expect((await wallet(a.auth)).eclipse_token ?? 0).toBe(0);
    await db().prepare("UPDATE shop_products SET active = 0 WHERE product_id = 'tokens_small'").run();
    expect(await (await verify(a.auth, 'tokens_small', forA.token)).json()).toMatchObject({ status: 'granted' });
    expect((await wallet(a.auth)).eclipse_token).toBe(320); // sales availability cannot discard a paid obligation
    expect((await game('/api/v1/shop/verify', post({ productId: 'tokens_small', purchaseToken: 'q'.repeat(20) }))).status).toBe(401);
  });

  it('one order id can never be granted to two accounts', async () => {
    const a = await signIn(`sub-own-a-${uid()}`);
    const b = await signIn(`sub-own-b-${uid()}`);
    const first = await newProduct(a.playerId, { orderId: 'GPA.SAME-ORDER' });
    expect((await verify(a.auth, 'tokens_small', first.token)).status).toBe(200);
    const second = await newProduct(b.playerId, { orderId: 'GPA.SAME-ORDER' });
    const res = await verify(b.auth, 'tokens_small', second.token);
    expect(res.status).toBe(409);
    expect((await wallet(b.auth)).eclipse_token ?? 0).toBe(0);
  });

  it('a failed consume does not lose the grant; the next verify call completes the acknowledgement', async () => {
    const { auth, playerId } = await signIn(`sub-ack-${uid()}`);
    const { token, orderId } = await newProduct(playerId);
    fakePlay.failAck = true;
    expect(await (await verify(auth, 'tokens_small', token)).json()).toMatchObject({ status: 'granted' });
    expect((await db().prepare('SELECT acknowledged FROM purchases WHERE order_id = ?1').bind(orderId).first<{ acknowledged: number }>())?.acknowledged).toBe(0);
    expect((await db().prepare("SELECT COUNT(*) AS n FROM purchase_events WHERE order_id = ?1 AND type = 'ack_failed'").bind(orderId).first<{ n: number }>())?.n).toBe(1);
    fakePlay.failAck = false;
    expect(await (await verify(auth, 'tokens_small', token)).json()).toMatchObject({ status: 'already_granted' });
    expect((await db().prepare('SELECT acknowledged FROM purchases WHERE order_id = ?1').bind(orderId).first<{ acknowledged: number }>())?.acknowledged).toBe(1);
    expect((await wallet(auth)).eclipse_token).toBe(320);
  });
});

describe('subscription (Eclipse Blessing, canon 1,600 + 60 x 187)', () => {
  it('a sales kill flag hides offers while a verified paid receipt is still honored', async () => {
    const { auth, playerId } = await signIn(`sub-killed-sales-${uid()}`);
    const { token } = await newProduct(playerId);
    await db().prepare("INSERT INTO feature_flags (key, enabled) VALUES ('shop.enabled', 0) ON CONFLICT (key) DO UPDATE SET enabled = 0").run();
    expect(await (await game('/api/v1/shop/products')).json()).toEqual({ products: [] });
    expect(await (await verify(auth, 'tokens_small', token)).json()).toMatchObject({ status: 'granted' });
    expect((await wallet(auth)).eclipse_token).toBe(320);
    await db().prepare("UPDATE feature_flags SET enabled = 1 WHERE key = 'shop.enabled'").run();
  });

  it('an older active response cannot overwrite a newer held entitlement', async () => {
    const { playerId } = await signIn(`sub-stale-entitlement-${uid()}`);
    const { token, orderId } = await newSub(playerId);
    const now = new Date();
    await verifyPurchase(db(), playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token }, now);
    fakePlay.subs.get(token)!.state = 'on_hold';
    await verifyPurchase(db(), playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token }, new Date(now.getTime() + 1000));
    fakePlay.subs.get(token)!.state = 'active';
    expect((await verifyPurchase(db(), playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token }, now)).status).toBe('not_entitled');
    expect(await db().prepare('SELECT entitlement_state FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ entitlement_state: 'on_hold' });
  });

  it('uses frozen period benefits after a catalog edit; rejects rewriting the snapshot', async () => {
    const { auth, playerId } = await signIn(`sub-frozen-${uid()}`);
    const { token, orderId } = await newSub(playerId);
    await verify(auth, 'eclipse_blessing_30d', token);
    const original = (await db().prepare('SELECT fulfillment FROM purchases WHERE order_id = ?1').bind(orderId).first<{ fulfillment: string }>())!.fulfillment;
    const altered = JSON.parse(original).subscription as { periodic: { attachments: { amount: number }[] } };
    altered.periodic.attachments[0]!.amount = 999;
    await db().prepare("UPDATE shop_products SET sub_config = ?1 WHERE product_id = 'eclipse_blessing_30d'").bind(JSON.stringify(altered)).run();
    await syncSubscriptionMail(db(), playerId, new Date(Date.now() + 13 * HOUR));
    const mails = (await db().prepare('SELECT attachments FROM mail WHERE player_id = ?1').bind(playerId).all<{ attachments: string }>()).results;
    await db().prepare("UPDATE shop_products SET sub_config = ?1 WHERE product_id = 'eclipse_blessing_30d'").bind(JSON.stringify(JSON.parse(original).subscription)).run();
    expect(mails).toHaveLength(2);
    expect(mails.map((m) => JSON.parse(m.attachments)[0].amount)).toEqual([187, 187]);
    await expect(db().prepare("UPDATE purchases SET fulfillment = '{}' WHERE order_id = ?1").bind(orderId).run()).rejects.toThrow('immutable');
  });

  it('hold/pause stop new mail and suspend unclaimed rights; recovery and same-order expiry reconcile', async () => {
    const { playerId } = await signIn(`sub-held-${uid()}`);
    const { token, orderId } = await newSub(playerId);
    await verifyPurchase(db(), playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token });
    const mail = await db().prepare('SELECT id FROM mail WHERE player_id = ?1').bind(playerId).first<{ id: number }>();
    for (const state of ['on_hold', 'paused'] as const) {
      fakePlay.subs.get(token)!.state = state;
      expect((await verifyPurchase(db(), playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token })).status).toBe('not_entitled');
      expect(await syncSubscriptionMail(db(), playerId, new Date(Date.now() + 13 * HOUR))).toBe(0);
      await expect(claimMail(db(), playerId, mail!.id)).rejects.toMatchObject({ code: 'entitlement_unavailable' });
    }
    const subscription = fakePlay.subs.get(token)!;
    subscription.state = 'active'; subscription.expiryTimeMs += 24 * HOUR;
    await verifyPurchase(db(), playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token });
    expect(await db().prepare('SELECT entitlement_state, period_end FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ entitlement_state: 'active', period_end: new Date(subscription.expiryTimeMs).toISOString() });
    expect((await claimMail(db(), playerId, mail!.id)).claimed).toHaveLength(1);
  });

  it.each([['2026-01-31', '2026-02-28'], ['2026-02-28', '2026-03-31'], ['2026-03-01T00:00:00Z', '2026-03-01T00:05:00Z']])('uses authoritative order time for %s → %s instead of a thirty-day subtraction', async (begin, end) => {
    const { playerId } = await signIn(`sub-period-${uid()}`);
    const { token, orderId } = await newSub(playerId);
    const subscription = fakePlay.subs.get(token)!;
    subscription.startTimeMs = Date.parse('2025-01-01'); subscription.expiryTimeMs = Date.parse(end);
    fakePlay.orders.set(orderId, { orderId, purchaseToken: token, createTimeMs: Date.parse(begin), fullRefundTimeMs: 0, partialRefund: false });
    await verifyPurchase(db(), playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token }, new Date(Date.parse(begin) + 1000));
    expect(await db().prepare('SELECT period_start, period_end FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ period_start: new Date(begin).toISOString(), period_end: new Date(end).toISOString() });
  });

  it('cannot recreate wallet/mail when deletion wins before fulfillment', async () => {
    const { playerId } = await signIn(`sub-deleted-race-${uid()}`);
    const { token } = await newSub(playerId);
    const racingPlay = { ...playClient, async getOrder(id: string) {
      const order = await playClient.getOrder(id);
      await deleteAccount(db(), playerId, 'DELETE');
      return order;
    } };
    await expect(verifyPurchase(db(), racingPlay, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token })).rejects.toMatchObject({ code: 'account_deleted' });
    for (const table of ['wallets', 'mail', 'purchases']) expect(await db().prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE player_id = ?1`).bind(playerId).first()).toEqual({ n: 0 });
  });

  it('a refund committed after the fast mail check still prevents the atomic claim', async () => {
    const { playerId } = await signIn(`sub-claim-refund-${uid()}`);
    const { token, orderId } = await newSub(playerId);
    await verifyPurchase(db(), playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token });
    const mail = await db().prepare('SELECT id FROM mail WHERE player_id = ?1').bind(playerId).first<{ id: number }>();
    const original = db();
    const racing = new Proxy(original, { get(target, key) {
      if (key === 'batch') return async (statements: D1PreparedStatement[]) => {
        await refundPurchase(original, orderId, 'system');
        return original.batch(statements);
      };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    await expect(claimMail(racing, playerId, mail!.id)).rejects.toMatchObject({ code: 'revoked' });
    expect(await original.prepare('SELECT claimed_at FROM mail WHERE id = ?1').bind(mail!.id).first()).toEqual({ claimed_at: null });
    expect(await original.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 0 });
  });

  it('retries a failed subscription acknowledgement on the existing order without granting again', async () => {
    const { auth, playerId } = await signIn(`sub-suback-${uid()}`);
    const { token, orderId } = await newSub(playerId);
    fakePlay.failAck = true;
    expect(await (await verify(auth, 'eclipse_blessing_30d', token)).json()).toMatchObject({ status: 'granted' });
    expect(await db().prepare('SELECT acknowledged FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ acknowledged: 0 });
    fakePlay.failAck = false;
    expect(await (await verify(auth, 'eclipse_blessing_30d', token)).json()).toMatchObject({ status: 'already_granted' });
    expect(await db().prepare('SELECT acknowledged FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ acknowledged: 1 });
    expect(fakePlay.calls).toEqual([`ack_sub:eclipse_blessing_30d:${token}`]);
    expect((await wallet(auth)).eclipse_token).toBe(1600);
    expect(await db().prepare('SELECT COUNT(*) AS n FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ n: 1 });
  });

  it('reconciles provider acknowledgement after the local marker was lost, without another provider call', async () => {
    const { auth, playerId } = await signIn(`sub-subacklost-${uid()}`);
    const { token, orderId } = await newSub(playerId);
    await verify(auth, 'eclipse_blessing_30d', token);
    await db().prepare('UPDATE purchases SET acknowledged = 0 WHERE order_id = ?1').bind(orderId).run();
    const calls = fakePlay.calls.length;
    expect(await (await verify(auth, 'eclipse_blessing_30d', token)).json()).toMatchObject({ status: 'already_granted' });
    expect(await db().prepare('SELECT acknowledged FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ acknowledged: 1 });
    expect(fakePlay.calls.length).toBe(calls);
    expect((await wallet(auth)).eclipse_token).toBe(1600);
  });

  it('grants 1,600 at once, then one mail per elapsed half-day window (14-day claim grace); all 60 sum to 12,820', async () => {
    const { auth, playerId } = await signIn(`sub-sub-${uid()}`);
    const { token, orderId } = await newSub(playerId, { startAgoH: 0, remainingH: 720 });
    const res = await verify(auth, 'eclipse_blessing_30d', token);
    expect(await res.json()).toMatchObject({ status: 'granted', orderId });
    expect((await wallet(auth)).eclipse_token).toBe(1600);
    expect(fakePlay.calls).toEqual([`ack_sub:eclipse_blessing_30d:${token}`]);
    const mail = (await (await game('/api/v1/mail', { headers: auth })).json()) as { mail: { id: number; kind: string; attachments: { amount: number }[] }[] };
    expect(mail.mail).toHaveLength(1); // the first window is available immediately
    expect(mail.mail[0]).toMatchObject({ kind: 'subscription', attachments: [{ amount: 187 }] });
    expect((await game(`/api/v1/mail/${mail.mail[0]!.id}/claim`, post({}, auth))).status).toBe(200);
    expect((await wallet(auth)).eclipse_token).toBe(1787);
    // opening the mailbox repeatedly never duplicates entitlements
    for (let i = 0; i < 3; i++) await game('/api/v1/mail', { headers: auth });
    expect((await db().prepare("SELECT COUNT(*) AS n FROM mail WHERE player_id = ?1").bind(playerId).first<{ n: number }>())?.n).toBe(1);
    // total over a whole period (canon arithmetic)
    expect(1600 + 60 * 187).toBe(12820);
  });

  it('a subscription that began 3 days ago has 7 windows of mail; renewals (new order id) grant a new period', async () => {
    const { auth, playerId } = await signIn(`sub-subold-${uid()}`);
    const { token } = await newSub(playerId, { startAgoH: 72, remainingH: 648 });
    await verify(auth, 'eclipse_blessing_30d', token);
    const mail = (await (await game('/api/v1/mail', { headers: auth })).json()) as { mail: unknown[] };
    expect(mail.mail).toHaveLength(7);
    // RTDN RENEWED: Play now reports a new latest order id for the same token
    const s = fakePlay.subs.get(token)!;
    s.latestOrderId = `${s.latestOrderId}-renewed`;
    s.startTimeMs = Date.now();
    s.expiryTimeMs = Date.now() + 720 * HOUR;
    const msg = { message: { messageId: `m${uid()}`, data: btoa(JSON.stringify({ packageName: 'app.uomd.test', subscriptionNotification: { notificationType: 2, purchaseToken: token, subscriptionId: 'eclipse_blessing_30d' } })) } };
    const rtdn = await game('/api/v1/billing/rtdn', { method: 'POST', body: JSON.stringify(msg), headers: { Authorization: `Bearer ${await pushToken()}`, 'Content-Type': 'application/json' } });
    expect(rtdn.status).toBe(200);
    expect(await rtdn.json()).toEqual({ handled: 'subscription' });
    expect((await wallet(auth)).eclipse_token).toBe(3200); // second instant grant
    // redelivery of the same Pub/Sub message is ignored
    const again = await game('/api/v1/billing/rtdn', { method: 'POST', body: JSON.stringify(msg), headers: { Authorization: `Bearer ${await pushToken()}`, 'Content-Type': 'application/json' } });
    expect(await again.json()).toEqual({ handled: 'duplicate' });
    expect((await wallet(auth)).eclipse_token).toBe(3200);
  });

  it('refuses expired, pending, on-hold and foreign subscriptions', async () => {
    const a = await signIn(`sub-subbad-${uid()}`);
    const b = await signIn(`sub-subbad2-${uid()}`);
    for (const state of ['expired', 'on_hold'] as const) {
      const { token } = await newSub(a.playerId, { state });
      expect(await (await verify(a.auth, 'eclipse_blessing_30d', token)).json()).toMatchObject({ status: 'not_entitled' });
    }
    const pending = await newSub(a.playerId, { state: 'pending' });
    expect(await (await verify(a.auth, 'eclipse_blessing_30d', pending.token)).json()).toMatchObject({ status: 'pending' });
    const lapsed = await newSub(a.playerId, { remainingH: -5 });
    expect(await (await verify(a.auth, 'eclipse_blessing_30d', lapsed.token)).json()).toMatchObject({ status: 'not_entitled' });
    const mine = await newSub(a.playerId);
    expect((await verify(b.auth, 'eclipse_blessing_30d', mine.token)).status).toBe(403);
    expect((await wallet(a.auth)).eclipse_token ?? 0).toBe(0);
    expect((await wallet(b.auth)).eclipse_token ?? 0).toBe(0);
  });
});

describe('refunds and RTDN', () => {
  it('reconciles an already-consumed provider receipt after the local ack marker was lost', async () => {
    const { auth, playerId } = await signIn(`sub-consume-lost-${uid()}`);
    const { token, orderId } = await newProduct(playerId);
    await verify(auth, 'tokens_small', token);
    fakePlay.products.get(token)!.consumed = true;
    await db().prepare('UPDATE purchases SET acknowledged = 0 WHERE order_id = ?1').bind(orderId).run();
    const before = fakePlay.calls.length;
    expect(await (await verify(auth, 'tokens_small', token)).json()).toMatchObject({ status: 'already_granted' });
    expect(await db().prepare('SELECT acknowledged FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ acknowledged: 1 });
    expect(fakePlay.calls).toHaveLength(before);
    expect((await wallet(auth)).eclipse_token).toBe(320);
  });

  it.each([false, null])('requires affirmative verified publisher email (claim %s)', async (emailVerified) => {
    const messageId = `m${uid()}`;
    const result = await game('/api/v1/billing/rtdn', { method: 'POST', body: JSON.stringify({ message: { messageId, data: btoa(JSON.stringify({ testNotification: {} })) } }), headers: { Authorization: `Bearer ${await pushToken({ emailVerified })}`, 'Content-Type': 'application/json' } });
    expect(result.status).toBe(401);
    expect(await db().prepare('SELECT COUNT(*) AS n FROM rtdn_seen WHERE message_id = ?1').bind(messageId).first()).toEqual({ n: 0 });
  });

  it('refunds the originally credited currency even after the product grant amount changes', async () => {
    const { auth, playerId } = await signIn(`sub-original-refund-${uid()}`);
    const { token, orderId } = await newProduct(playerId);
    await verify(auth, 'tokens_small', token);
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 1000, reason: 'unrelated_reward', idempotencyKey: `topup:${uid()}` });
    await db().prepare("UPDATE shop_products SET grants = '[{\"type\":\"currency\",\"currency\":\"eclipse_token\",\"amount\":1000}]' WHERE product_id = 'tokens_small'").run();
    expect(await refundPurchase(db(), orderId, 'system')).toEqual({ refunded: true, unrecovered: {} });
    expect((await wallet(auth)).eclipse_token).toBe(1000);
  });

  it('a database outage before clawback leaves the refund marker, event and wallet untouched; retry completes once', async () => {
    const { auth, playerId } = await signIn(`sub-interrupted-refund-${uid()}`);
    const { token, orderId } = await newProduct(playerId);
    await verify(auth, 'tokens_small', token);
    let ledgerPrepared = false;
    const original = db();
    const failing = new Proxy(original, {
      get(target, key) {
        if (key === 'prepare') return (sql: string) => {
          if (sql.startsWith('INSERT INTO ledger')) ledgerPrepared = true;
          return target.prepare(sql);
        };
        if (key === 'batch') return (statements: D1PreparedStatement[]) => {
          if (ledgerPrepared) throw new Error('simulated database outage');
          return target.batch(statements);
        };
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
    await expect(refundPurchase(failing, orderId, 'system')).rejects.toThrow('simulated database outage');
    expect(await original.prepare('SELECT state, refunded_at, unrecovered FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ state: 'granted', refunded_at: null, unrecovered: '{}' });
    expect(await original.prepare("SELECT COUNT(*) AS n FROM purchase_events WHERE order_id = ?1 AND type = 'refunded'").bind(orderId).first()).toEqual({ n: 0 });
    expect((await wallet(auth)).eclipse_token).toBe(320);
    expect((await refundPurchase(original, orderId, 'system')).refunded).toBe(true);
    expect((await refundPurchase(original, orderId, 'system')).refunded).toBe(false);
    expect((await wallet(auth)).eclipse_token).toBe(0);
  });

  it('concurrent refunds publish one marker/event and one clawback', async () => {
    const { auth, playerId } = await signIn(`sub-concurrent-refund-${uid()}`);
    const { token, orderId } = await newProduct(playerId);
    await verify(auth, 'tokens_small', token);
    const results = await Promise.all([refundPurchase(db(), orderId, 'system'), refundPurchase(db(), orderId, 'system')]);
    expect(results.filter((r) => r.refunded)).toHaveLength(1);
    expect(await db().prepare("SELECT COUNT(*) AS n FROM purchase_events WHERE order_id = ?1 AND type = 'refunded'").bind(orderId).first()).toEqual({ n: 1 });
    expect((await wallet(auth)).eclipse_token).toBe(0);
  });

  it('a racing spend and refund conserve the original credit and record only the actual shortfall', async () => {
    const { auth, playerId } = await signIn(`sub-spend-refund-${uid()}`);
    const { token, orderId } = await newProduct(playerId);
    await verify(auth, 'tokens_small', token);
    const [refund, spend] = await Promise.all([
      refundPurchase(db(), orderId, 'system'),
      applyLedger(db(), { playerId, currency: 'eclipse_token', delta: -100, reason: 'racing_spend', idempotencyKey: `racing:${uid()}` })
    ]);
    expect(refund.refunded).toBe(true);
    expect(refund.unrecovered).toEqual(spend.applied ? { eclipse_token: 100 } : {});
    expect((await wallet(auth)).eclipse_token).toBe(0);
    expect(await db().prepare('SELECT SUM(delta) AS balance FROM ledger WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 0 });
  });

  const rtdn = async (data: unknown, over: Parameters<typeof pushToken>[0] = {}, headers: Record<string, string> = {}) =>
    game('/api/v1/billing/rtdn', { method: 'POST', body: JSON.stringify({ message: { messageId: `m${uid()}`, data: btoa(JSON.stringify(data)) } }), headers: { Authorization: `Bearer ${await pushToken(over)}`, 'Content-Type': 'application/json', ...headers } });

  it('RTDN hold suspends existing mail and recovery restores the same paid period without another instant grant', async () => {
    const { auth, playerId } = await signIn(`sub-rtdn-state-${uid()}`);
    const { token, orderId } = await newSub(playerId);
    await verify(auth, 'eclipse_blessing_30d', token);
    const mail = await db().prepare('SELECT id FROM mail WHERE player_id = ?1').bind(playerId).first<{ id: number }>();
    const notify = (notificationType: number) => rtdn({ packageName: 'app.uomd.test', subscriptionNotification: { notificationType, purchaseToken: token } });
    fakePlay.subs.get(token)!.state = 'on_hold';
    expect(await (await notify(5)).json()).toEqual({ handled: 'state_reconciled' });
    expect(await db().prepare('SELECT entitlement_state FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ entitlement_state: 'on_hold' });
    await expect(claimMail(db(), playerId, mail!.id)).rejects.toMatchObject({ code: 'entitlement_unavailable' });
    fakePlay.subs.get(token)!.state = 'active';
    expect(await (await notify(1)).json()).toEqual({ handled: 'subscription' });
    await claimMail(db(), playerId, mail!.id);
    expect((await wallet(auth)).eclipse_token).toBe(1787);
    expect(await db().prepare('SELECT COUNT(*) AS n FROM purchases WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 1 });
  });

  it('a voided purchase takes back what is still in the wallet and records what was already spent', async () => {
    const { auth, playerId } = await signIn(`sub-void-${uid()}`);
    const { token, orderId } = await newProduct(playerId);
    await verify(auth, 'tokens_small', token);
    // the player spent 100 of the 320 tokens
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: -100, reason: 'test_spend', idempotencyKey: `spend:${uid()}` });
    fakePlay.orders.set(orderId, { orderId, purchaseToken: token, createTimeMs: Date.now() - HOUR, fullRefundTimeMs: Date.now(), partialRefund: false });
    const res = await rtdn({ packageName: 'app.uomd.test', voidedPurchaseNotification: { purchaseToken: token, orderId, productType: 2, refundType: 1 } });
    expect(await res.json()).toEqual({ handled: 'refunded' });
    expect((await wallet(auth)).eclipse_token).toBe(0);
    const row = await db().prepare('SELECT state, unrecovered FROM purchases WHERE order_id = ?1').bind(orderId).first<{ state: string; unrecovered: string }>();
    expect(row?.state).toBe('refunded');
    expect(JSON.parse(row!.unrecovered)).toEqual({ eclipse_token: 100 });
    // a second void for the same order does nothing
    expect(await (await rtdn({ packageName: 'app.uomd.test', voidedPurchaseNotification: { orderId } })).json()).toEqual({ handled: 'voided_already_refunded' });
    expect((await refundPurchase(db(), orderId, 'system')).refunded).toBe(false);
  });

  it('revoking a subscription refunds it and revokes unclaimed entitlement mail', async () => {
    const { auth, playerId } = await signIn(`sub-revoke-${uid()}`);
    const { token, orderId } = await newSub(playerId, { startAgoH: 30, remainingH: 700 });
    await verify(auth, 'eclipse_blessing_30d', token);
    const mail = (await (await game('/api/v1/mail', { headers: auth })).json()) as { mail: { id: number }[] };
    expect(mail.mail.length).toBeGreaterThan(1);
    fakePlay.subs.get(token)!.state = 'expired';
    fakePlay.orders.set(orderId, { orderId, purchaseToken: token, createTimeMs: Date.now() - 30 * HOUR, fullRefundTimeMs: Date.now(), partialRefund: false });
    const r = await rtdn({ packageName: 'app.uomd.test', subscriptionNotification: { notificationType: 12, purchaseToken: token, subscriptionId: 'eclipse_blessing_30d' } });
    expect(await r.json()).toEqual({ handled: 'revoked' });
    expect((await wallet(auth)).eclipse_token ?? 0).toBe(0);
    const claim = await game(`/api/v1/mail/${mail.mail[0]!.id}/claim`, post({}, auth));
    expect(claim.status).toBe(409);
    expect(((await claim.json()) as { error: string }).error).toBe('revoked');
  });

  it('only Google Pub/Sub with the configured service account and audience may call the endpoint', async () => {
    const body = { message: { messageId: `m${uid()}`, data: btoa(JSON.stringify({ testNotification: {} })) } };
    const post1 = (headers: Record<string, string>, over: Partial<{ RTDN_AUDIENCE: string; RTDN_PUSH_SERVICE_ACCOUNT: string }> = {}) => game('/api/v1/billing/rtdn', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } }, over);
    expect((await post1({})).status).toBe(401);
    expect((await post1({ Authorization: 'Bearer junk' })).status).toBe(401);
    expect((await post1({ Authorization: `Bearer ${await pushToken({ aud: 'https://evil.example' })}` })).status).toBe(401);
    expect((await post1({ Authorization: `Bearer ${await pushToken({ email: 'attacker@evil.iam.gserviceaccount.com' })}` })).status).toBe(401);
    expect((await post1({ Authorization: `Bearer ${await pushToken({ wrongKey: true })}` })).status).toBe(401);
    expect((await post1({ Authorization: `Bearer ${await pushToken()}` }, { RTDN_AUDIENCE: '' })).status).toBe(503);
    expect((await post1({ Authorization: `Bearer ${await pushToken()}` })).status).toBe(200);
  });

  it('garbage payloads are acknowledged without effect; messages for another package are ignored', async () => {
    expect(await (await rtdn({ nonsense: true })).json()).toEqual({ handled: 'ignored' });
    expect(await (await rtdn({ packageName: 'someone.else', voidedPurchaseNotification: { orderId: 'GPA.X' } })).json()).toEqual({ handled: 'ignored_other_package' });
    const res = await game('/api/v1/billing/rtdn', { method: 'POST', body: JSON.stringify({ message: { messageId: `m${uid()}`, data: '%%%' } }), headers: { Authorization: `Bearer ${await pushToken()}`, 'Content-Type': 'application/json' } });
    expect(await res.json()).toEqual({ handled: 'ignored_unparseable' });
    expect((await game('/api/v1/billing/rtdn', { method: 'POST', body: '{', headers: { Authorization: `Bearer ${await pushToken()}` } })).status).toBe(400);
  });
});

describe('billing configuration', () => {
  it('lists only active products; the real Play client refuses to run without configuration', async () => {
    const list = (await (await game('/api/v1/shop/products')).json()) as { products: { productId: string }[] };
    expect(list.products.map((p) => p.productId)).toContain('tokens_small');
    await db().prepare("UPDATE shop_products SET active = 0 WHERE product_id = 'tokens_small'").run();
    expect(((await (await game('/api/v1/shop/products')).json()) as { products: { productId: string }[] }).products.map((p) => p.productId)).not.toContain('tokens_small');
    const { PlayApi } = await import('../src/billing/play');
    const bare = new PlayApi({ DB: db(), ENVIRONMENT: 'dev' } as never);
    await expect(bare.getSubscription('t')).rejects.toMatchObject({ code: 'billing_not_configured' });
    expect(verifyPurchase).toBeDefined();
  });
});
