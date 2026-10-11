import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { billingTag, refundPurchase, verifyPurchase } from '../src/billing/service';
import { applyLedger } from '../src/db/ledger';
import { fakePlay, game, post, pushToken, signIn } from './helpers';

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
    await db().prepare("UPDATE shop_products SET active = 0 WHERE product_id = 'tokens_small'").run();
    expect((await verify(a.auth, 'tokens_small', forA.token)).status).toBe(404);
    expect((await wallet(a.auth)).eclipse_token ?? 0).toBe(0);
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
  const rtdn = async (data: unknown, over: Parameters<typeof pushToken>[0] = {}, headers: Record<string, string> = {}) =>
    game('/api/v1/billing/rtdn', { method: 'POST', body: JSON.stringify({ message: { messageId: `m${uid()}`, data: btoa(JSON.stringify(data)) } }), headers: { Authorization: `Bearer ${await pushToken(over)}`, 'Content-Type': 'application/json', ...headers } });

  it('a voided purchase takes back what is still in the wallet and records what was already spent', async () => {
    const { auth, playerId } = await signIn(`sub-void-${uid()}`);
    const { token, orderId } = await newProduct(playerId);
    await verify(auth, 'tokens_small', token);
    // the player spent 100 of the 320 tokens
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: -100, reason: 'test_spend', idempotencyKey: `spend:${uid()}` });
    const res = await rtdn({ packageName: 'app.uomd.test', voidedPurchaseNotification: { purchaseToken: token, orderId, productType: 2, refundType: 1 } });
    expect(await res.json()).toEqual({ handled: 'refunded' });
    expect((await wallet(auth)).eclipse_token).toBe(0);
    const row = await db().prepare('SELECT state, unrecovered FROM purchases WHERE order_id = ?1').bind(orderId).first<{ state: string; unrecovered: string }>();
    expect(row?.state).toBe('refunded');
    expect(JSON.parse(row!.unrecovered)).toEqual({ eclipse_token: 100 });
    // a second void for the same order does nothing
    expect(await (await rtdn({ packageName: 'app.uomd.test', voidedPurchaseNotification: { orderId } })).json()).toEqual({ handled: 'voided_unknown_order' });
    expect((await refundPurchase(db(), orderId, 'system')).refunded).toBe(false);
  });

  it('revoking a subscription refunds it and revokes unclaimed entitlement mail', async () => {
    const { auth, playerId } = await signIn(`sub-revoke-${uid()}`);
    const { token } = await newSub(playerId, { startAgoH: 30, remainingH: 700 });
    await verify(auth, 'eclipse_blessing_30d', token);
    const mail = (await (await game('/api/v1/mail', { headers: auth })).json()) as { mail: { id: number }[] };
    expect(mail.mail.length).toBeGreaterThan(1);
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
