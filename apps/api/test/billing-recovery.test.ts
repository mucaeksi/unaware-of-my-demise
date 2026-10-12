import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '@uomd/shared';
import { billingTag, syncSubscriptionMail } from '../src/billing/service';
import { claimMail } from '../src/mail/service';
import { reconcileBilling, verifyReceipt } from '../src/billing/recovery';
import { TokenVault } from '../src/billing/vault';
import { deleteAccount, exportAccount } from '../src/account/service';
import { handleRtdn } from '../src/billing/rtdn';
import { PlayApi } from '../src/billing/play';
import gameWorker from '../src/game';
import { admin, baseEnv, fakePlay, playClient, post, signIn } from './helpers';

const db = baseEnv.DB;
const hashToken = (token: string) => sha256Hex(`play-token:${token}`);
let seq = 0;
beforeEach(async () => {
  fakePlay.reset();
  await db.prepare("INSERT OR REPLACE INTO shop_products (product_id, kind, title_en, grants, active) VALUES ('recovery_pouch', 'consumable', 'Pouch', '[{\"type\":\"currency\",\"currency\":\"eclipse_token\",\"amount\":320}]', 1)").run();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function purchase(state: 'purchased' | 'pending' = 'purchased') {
  const id = `recovery-${++seq}`;
  const { playerId } = await signIn(id); const token = `private-token-${id}`; const orderId = `order-${id}`;
  fakePlay.products.set(token, { purchaseState: state, orderId, acknowledged: false, consumed: false, purchaseTimeMs: Date.now(), obfuscatedAccountId: await billingTag(playerId) });
  return { playerId, token, orderId, input: { productId: 'recovery_pouch', purchaseToken: token }, th: await hashToken(token) };
}
const job = (th: string) => db.prepare('SELECT state, attempts, last_code, next_at, encrypted_token, ack_deadline FROM billing_jobs WHERE token_hash = ?1').bind(th).first<{ state: string; attempts: number; last_code: string | null; next_at: string | null; encrypted_token: string | null; ack_deadline: string | null }>();
const balance = (id: string) => db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(id).first<{ balance: number }>();
const due = (th: string) => db.prepare("UPDATE billing_jobs SET next_at = '2000-01-01T00:00:00.000Z' WHERE token_hash = ?1").bind(th).run();

describe('durable billing reconciliation', () => {
  it('Cron repairs an ack/consume failure with no client retry, one grant and no retained consumed token', async () => {
    const p = await purchase(); fakePlay.failAck = true;
    expect(await verifyReceipt(baseEnv, playClient, p.playerId, p.input)).toMatchObject({ status: 'granted' });
    const queued = await job(p.th); expect(queued).toMatchObject({ state: 'pending', attempts: 1, last_code: 'ack_pending' });
    expect(queued!.encrypted_token).not.toContain(p.token);
    expect(await new TokenVault(baseEnv).open(queued!.encrypted_token!, { tokenHash: p.th, playerId: p.playerId, productId: p.input.productId })).toBe(p.token);
    fakePlay.failAck = false; await due(p.th);
    expect(await reconcileBilling(baseEnv, playClient)).toMatchObject({ retried: 1, blocked: 0 });
    expect(await job(p.th)).toMatchObject({ state: 'done', encrypted_token: null });
    expect(await balance(p.playerId)).toEqual({ balance: 320 });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE order_id = ?1').bind(p.orderId).first()).toEqual({ n: 1 });
  });

  it('persists a verified pending obligation and its frozen benefits, then fulfills after the client disappears', async () => {
    const p = await purchase('pending');
    expect(await verifyReceipt(baseEnv, playClient, p.playerId, p.input)).toMatchObject({ status: 'pending' });
    expect(await balance(p.playerId)).toBeNull();
    await db.prepare("UPDATE shop_products SET grants = '[{\"type\":\"currency\",\"currency\":\"eclipse_token\",\"amount\":999}]' WHERE product_id = 'recovery_pouch'").run();
    fakePlay.products.get(p.token)!.purchaseState = 'purchased'; await due(p.th);
    await reconcileBilling(baseEnv, playClient);
    expect(await balance(p.playerId)).toEqual({ balance: 320 });
    expect(await job(p.th)).toMatchObject({ state: 'done', encrypted_token: null });
  });

  it('authentic one-time RTDN completes a previously bound pending receipt', async () => {
    const p = await purchase('pending'); await verifyReceipt(baseEnv, playClient, p.playerId, p.input);
    fakePlay.products.get(p.token)!.purchaseState = 'purchased';
    const msg = { message: { messageId: `message-${seq}`, data: btoa(JSON.stringify({ oneTimeProductNotification: { notificationType: 1, purchaseToken: p.token, sku: p.input.productId } })) } };
    expect(await handleRtdn(db, baseEnv, playClient, msg)).toEqual({ handled: 'one_time_reconciled' });
    expect(await balance(p.playerId)).toEqual({ balance: 320 });
    expect(await handleRtdn(db, baseEnv, playClient, msg)).toEqual({ handled: 'duplicate' });
  });

  it('never persists or grants an unbound receipt and fails closed without the encryption secret', async () => {
    const p = await purchase();
    await expect(verifyReceipt({ ...baseEnv, BILLING_TOKEN_KEYS: '' }, playClient, p.playerId, p.input)).rejects.toMatchObject({ code: 'billing_recovery_not_configured' });
    fakePlay.products.get(p.token)!.obfuscatedAccountId = 'foreign';
    await expect(verifyReceipt(baseEnv, playClient, p.playerId, p.input)).rejects.toMatchObject({ code: 'account_mismatch' });
    expect(await job(p.th)).toBeNull(); expect(await balance(p.playerId)).toBeNull();
    expect(await db.prepare('SELECT COUNT(*) AS n FROM billing_locks WHERE token_hash = ?1').bind(p.th).first()).toEqual({ n: 0 });
  });

  it('deletion erases encrypted recovery work, and a retained financial record cannot recreate gameplay state', async () => {
    const p = await purchase(); fakePlay.failAck = true; await verifyReceipt(baseEnv, playClient, p.playerId, p.input);
    await deleteAccount(db, p.playerId, 'DELETE');
    expect(await job(p.th)).toBeNull();
    expect(await reconcileBilling(baseEnv, playClient)).toMatchObject({ inspected: 0 });
    await expect(verifyReceipt(baseEnv, playClient, p.playerId, p.input)).rejects.toMatchObject({ code: 'account_deleted' });
    expect(await balance(p.playerId)).toBeNull();
    expect(await db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE order_id = ?1').bind(p.orderId).first()).toEqual({ n: 1 });
  });

  it('a corrupt encrypted job is retained for audited operator review without API calls or grants', async () => {
    const p = await purchase('pending'); await verifyReceipt(baseEnv, playClient, p.playerId, p.input);
    const originalCiphertext = (await job(p.th))!.encrypted_token;
    await db.prepare("UPDATE billing_jobs SET encrypted_token = '{}' WHERE token_hash = ?1").bind(p.th).run(); await due(p.th);
    expect(await reconcileBilling(baseEnv, playClient)).toMatchObject({ blocked: 1, retried: 0 });
    expect(await job(p.th)).toMatchObject({ state: 'review', last_code: 'billing_recovery_corrupt' });
    expect(await balance(p.playerId)).toBeNull(); expect(fakePlay.calls).toHaveLength(0);
    const list = await (await admin('/admin/api/billing/jobs?state=review')).text();
    expect(list).toContain(p.th); expect(list).not.toContain('encrypted_token'); expect(list).not.toContain(p.token);
    const path = `/admin/api/billing/jobs/${p.th}/retry`;
    await db.prepare('UPDATE billing_jobs SET encrypted_token = ?2 WHERE token_hash = ?1').bind(p.th, originalCiphertext).run();
    expect((await admin(path, post({ expectedAttempts: 0, reason: 'stale operator copy' }))).status).toBe(409);
    expect((await admin(path, post({ expectedAttempts: 1, reason: 'corrected cause; retry verification' }))).status).toBe(200);
    expect((await admin(path, post({ expectedAttempts: 1, reason: 'duplicate operator request' }))).status).toBe(409);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'billing.job.retry' AND target = ?1").bind(p.th).first()).toEqual({ n: 1 });
    fakePlay.products.get(p.token)!.purchaseState = 'purchased';
    await reconcileBilling(baseEnv, playClient);
    expect(await job(p.th)).toMatchObject({ state: 'done' });
    expect(await balance(p.playerId)).toEqual({ balance: 320 });
    const exported = JSON.stringify(await exportAccount(db, p.playerId));
    expect(exported).not.toContain('encrypted_token'); expect(exported).not.toContain(p.token);
  });

  it('records an overdue sandbox ack for review instead of reporting successful acknowledgement', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
    const p = await purchase(); fakePlay.products.get(p.token)!.testPurchase = true; fakePlay.failAck = true;
    await verifyReceipt(baseEnv, playClient, p.playerId, p.input);
    expect(await job(p.th)).toMatchObject({ ack_deadline: '2026-10-12T12:03:00.000Z', state: 'pending' });
    vi.setSystemTime(new Date('2026-10-12T12:04:00Z')); await reconcileBilling(baseEnv, playClient);
    expect(await job(p.th)).toMatchObject({ state: 'review', last_code: 'ack_deadline_exceeded' });
    expect(await db.prepare('SELECT acknowledged FROM purchases WHERE order_id = ?1').bind(p.orderId).first()).toEqual({ acknowledged: 0 });
    expect(await balance(p.playerId)).toEqual({ balance: 320 });
  });

  it('the real Worker scheduled handler awaits reconciliation and records only safe aggregate results', async () => {
    const p = await purchase(); fakePlay.failAck = true; await verifyReceipt(baseEnv, playClient, p.playerId, p.input);
    fakePlay.failAck = false; await due(p.th);
    vi.spyOn(PlayApi.prototype, 'getProduct').mockImplementation(playClient.getProduct);
    vi.spyOn(PlayApi.prototype, 'consumeProduct').mockImplementation(playClient.consumeProduct);
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
    const promises: Promise<unknown>[] = [];
    gameWorker.scheduled({ cron: '* * * * *' } as ScheduledController, baseEnv, { waitUntil(promise) { promises.push(promise); } } as ExecutionContext);
    await Promise.all(promises);
    expect(promises).toHaveLength(1);
    expect(await job(p.th)).toMatchObject({ state: 'done', encrypted_token: null });
    expect(await balance(p.playerId)).toEqual({ balance: 320 });
    expect(JSON.stringify(logged.mock.calls)).not.toContain(p.token);
    expect(logged).toHaveBeenCalledWith('billing_reconcile', expect.objectContaining({ retried: 1, blocked: 0 }));
  });

  it('a delayed active response cannot mint a new order after a newer worker observes hold', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
    const { playerId } = await signIn(`provider-fence-${++seq}`); const token = `private-fence-token-${seq}`;
    fakePlay.subs.set(token, { state: 'active', productId: 'eclipse_blessing_30d', latestOrderId: `fence-order-${seq}`, acknowledged: true, obfuscatedAccountId: await billingTag(playerId), startTimeMs: Date.now(), expiryTimeMs: Date.now() + 30 * 86_400_000 });
    const input = { productId: 'eclipse_blessing_30d', purchaseToken: token };
    await verifyReceipt(baseEnv, playClient, playerId, input);
    const subscription = fakePlay.subs.get(token)!; subscription.latestOrderId += '-renewal';
    const stale = { ...subscription };
    let enter!: () => void; let release!: () => void;
    const entered = new Promise<void>((resolve) => { enter = resolve; }); const gate = new Promise<void>((resolve) => { release = resolve; });
    const slow = { ...playClient, async getSubscription() { enter(); await gate; return stale; } };
    const result = verifyReceipt(baseEnv, slow, playerId, input).catch((e: unknown) => e);
    try {
      await entered; subscription.state = 'on_hold'; vi.setSystemTime(new Date(Date.now() + 61_000));
      expect(await verifyReceipt(baseEnv, playClient, playerId, input)).toMatchObject({ status: 'not_entitled' });
      release(); expect(await result).toMatchObject({ code: 'billing_lease_lost' });
      expect(await db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE order_id = ?1').bind(stale.latestOrderId).first()).toEqual({ n: 0 });
      expect(await balance(playerId)).toEqual({ balance: 1600 });
      expect(await db.prepare('SELECT entitlement_state FROM purchases WHERE player_id = ?1').bind(playerId).first()).toEqual({ entitlement_state: 'on_hold' });
    } finally { release(); await result; }
  });

  it('a provider consume success followed by a lost local marker is reconciled once without another consume', async () => {
    const p = await purchase(); let consumed = 0; let interrupt = true;
    const play = { ...playClient, async consumeProduct() { consumed++; fakePlay.products.get(p.token)!.consumed = true; } };
    const failingDb = new Proxy(db, { get(target, key) {
      if (key === 'batch') return (statements: D1PreparedStatement[]) => {
        if (consumed && interrupt) { interrupt = false; throw new Error('simulated post-consume marker outage'); }
        return target.batch(statements);
      };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    await verifyReceipt({ ...baseEnv, DB: failingDb }, play, p.playerId, p.input);
    expect(await db.prepare('SELECT acknowledged FROM purchases WHERE order_id = ?1').bind(p.orderId).first()).toEqual({ acknowledged: 0 });
    await due(p.th); await reconcileBilling(baseEnv, play);
    expect(consumed).toBe(1);
    expect(await balance(p.playerId)).toEqual({ balance: 320 });
    expect(await job(p.th)).toMatchObject({ state: 'done', encrypted_token: null });
  });

  it('materializes still-claimable earned windows after expiry without adding windows beyond the paid period', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    const { playerId } = await signIn(`earned-window-${++seq}`); const token = `private-earned-token-${seq}`; const orderId = `earned-order-${seq}`;
    const expiry = Date.now() + 30 * 86_400_000;
    fakePlay.subs.set(token, { state: 'active', productId: 'eclipse_blessing_30d', latestOrderId: orderId, acknowledged: true, obfuscatedAccountId: await billingTag(playerId), startTimeMs: Date.now(), expiryTimeMs: expiry });
    await verifyReceipt(baseEnv, playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token });
    vi.setSystemTime(new Date(expiry + 3_600_000));
    await db.prepare("UPDATE purchases SET entitlement_state = 'expired' WHERE order_id = ?1").bind(orderId).run();
    expect(await syncSubscriptionMail(db, playerId)).toBe(27);
    expect(await syncSubscriptionMail(db, playerId)).toBe(0);
    const mail = await db.prepare('SELECT id FROM mail WHERE player_id = ?1 AND source_key = ?2').bind(playerId, `sub:${orderId}:hd:60`).first<{ id: number }>();
    expect(mail).not.toBeNull(); await claimMail(db, playerId, mail!.id);
    expect(await balance(playerId)).toEqual({ balance: 1787 });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM mail WHERE player_id = ?1 AND source_key = ?2').bind(playerId, `sub:${orderId}:hd:61`).first()).toEqual({ n: 0 });
  });

  it('keeps observing an active subscription after a refund without revocation, and discovers the next paid renewal', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
    const { playerId } = await signIn(`refund-renewal-${++seq}`); const token = `private-refund-renewal-${seq}`; const orderId = `refund-renewal-${seq}`; const th = await hashToken(token);
    const subscription = { state: 'active' as const, productId: 'eclipse_blessing_30d', latestOrderId: orderId, acknowledged: true, obfuscatedAccountId: await billingTag(playerId), startTimeMs: Date.now(), expiryTimeMs: Date.now() + 30 * 86_400_000 };
    fakePlay.subs.set(token, subscription);
    await verifyReceipt(baseEnv, playClient, playerId, { productId: subscription.productId, purchaseToken: token });
    fakePlay.orders.set(orderId, { orderId, purchaseToken: token, createTimeMs: Date.now(), fullRefundTimeMs: Date.now(), partialRefund: false });
    await handleRtdn(db, baseEnv, playClient, { message: { messageId: `refund-still-active-${seq}`, data: btoa(JSON.stringify({ voidedPurchaseNotification: { orderId } })) } });
    await due(th); await reconcileBilling(baseEnv, playClient);
    expect(await job(th)).toMatchObject({ state: 'pending' });
    expect((await job(th))!.encrypted_token).not.toBeNull();
    vi.setSystemTime(new Date(Date.now() + 30 * 86_400_000));
    subscription.latestOrderId += '-next'; subscription.expiryTimeMs = Date.now() + 30 * 86_400_000;
    fakePlay.orders.set(subscription.latestOrderId, { orderId: subscription.latestOrderId, purchaseToken: token, createTimeMs: Date.now(), fullRefundTimeMs: 0, partialRefund: false });
    await reconcileBilling(baseEnv, playClient);
    expect(await balance(playerId)).toEqual({ balance: 1600 });
    expect(await db.prepare('SELECT state FROM purchases WHERE order_id = ?1').bind(subscription.latestOrderId).first()).toEqual({ state: 'granted' });
  });

  it('discovers a full refund from official order history even when its RTDN notification was missed', async () => {
    const { playerId } = await signIn(`missed-refund-${++seq}`); const token = `private-missed-refund-${seq}`; const orderId = `missed-refund-${seq}`; const th = await hashToken(token);
    fakePlay.subs.set(token, { state: 'active', productId: 'eclipse_blessing_30d', latestOrderId: orderId, acknowledged: true, obfuscatedAccountId: await billingTag(playerId), startTimeMs: Date.now(), expiryTimeMs: Date.now() + 30 * 86_400_000 });
    await verifyReceipt(baseEnv, playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token });
    fakePlay.orders.set(orderId, { orderId, purchaseToken: token, createTimeMs: Date.now(), fullRefundTimeMs: Date.now(), partialRefund: false });
    await due(th); await reconcileBilling(baseEnv, playClient);
    expect(await balance(playerId)).toEqual({ balance: 0 });
    expect(await db.prepare('SELECT state FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ state: 'refunded' });
    expect(await job(th)).toMatchObject({ state: 'pending' });
    fakePlay.subs.get(token)!.state = 'expired'; await due(th); await reconcileBilling(baseEnv, playClient);
    expect(await job(th)).toMatchObject({ state: 'done', encrypted_token: null });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM purchase_events WHERE order_id = ?1 AND type = 'refunded'").bind(orderId).first()).toEqual({ n: 1 });
  });
});
