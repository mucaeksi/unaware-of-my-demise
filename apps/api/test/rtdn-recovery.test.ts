import { beforeEach, describe, expect, it, vi } from 'vitest';
import { billingTag, verifyPurchase } from '../src/billing/service';
import { handleRtdn } from '../src/billing/rtdn';
import { deleteAccount } from '../src/account/service';
import { claimMail } from '../src/mail/service';
import { admin, baseEnv, fakePlay, playClient, post, signIn } from './helpers';

const db = baseEnv.DB;
const at = new Date('2026-10-12T12:00:00Z');
const notification = (messageId: string, token: string, notificationType = 2) => ({ message: { messageId, data: btoa(JSON.stringify({ subscriptionNotification: { purchaseToken: token, notificationType } })) } });

async function renewal(id: string): Promise<{ token: string; playerId: string; orderId: string }> {
  const { playerId } = await signIn(`rtdn-recovery-${id}`);
  const token = `test-token-${id}`;
  fakePlay.subs.set(token, { state: 'active', productId: 'eclipse_blessing_30d', latestOrderId: `test-order-${id}`, acknowledged: true, obfuscatedAccountId: await billingTag(playerId), startTimeMs: at.getTime(), expiryTimeMs: at.getTime() + 30 * 86_400_000 });
  await verifyPurchase(db, playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token }, at);
  const orderId = `test-order-${id}-renewal`;
  fakePlay.subs.get(token)!.latestOrderId = orderId;
  return { token, playerId, orderId };
}

beforeEach(() => fakePlay.reset());

describe('durable RTDN delivery', () => {
  it('recovers a worker termination immediately after recording the processing marker', async () => {
    const { token, playerId } = await renewal('termination');
    const msg = notification('rtdn-termination', token);
    let crash = true;
    const interrupted = new Proxy(db, { get(target, key) {
      if (key === 'prepare') return (sql: string) => {
        const stmt = target.prepare(sql);
        if (!/^INSERT.*rtdn_seen/s.test(sql)) return stmt;
        const wrap = (bound: D1PreparedStatement): D1PreparedStatement => new Proxy(bound, { get(st, method) {
          if (method === 'bind') return (...args: unknown[]) => wrap(st.bind(...args));
          if (method === 'run' || method === 'first') return async (...args: unknown[]) => {
            const result = await Reflect.apply(Reflect.get(st, method), st, args);
            if (crash) { crash = false; throw new Error('simulated worker termination'); }
            return result;
          };
          const value = Reflect.get(st, method); return typeof value === 'function' ? value.bind(st) : value;
        } });
        return wrap(stmt);
      };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    await expect(handleRtdn(interrupted, baseEnv, playClient, msg, at)).rejects.toThrow('simulated worker termination');
    expect(await handleRtdn(db, baseEnv, playClient, msg, new Date(at.getTime() + 61_000))).toEqual({ handled: 'subscription' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 3200 });
  });

  it('does not acknowledge a concurrent redelivery while its first worker is still processing', async () => {
    const { token, playerId } = await renewal('concurrent');
    let enter!: () => void; let release!: () => void;
    const entered = new Promise<void>((resolve) => { enter = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const slow = { ...playClient, async getSubscription(t: string) { enter(); await gate; return playClient.getSubscription(t); } };
    const msg = notification('rtdn-concurrent', token);
    const first = handleRtdn(db, baseEnv, slow, msg, at);
    await entered;
    try { await expect(handleRtdn(db, baseEnv, playClient, msg, at)).rejects.toMatchObject({ code: 'rtdn_busy', status: 503 }); }
    finally { release(); await first; }
    expect(await handleRtdn(db, baseEnv, playClient, msg, at)).toEqual({ handled: 'duplicate' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 3200 });
  });

  it('rechecks a legacy marker whose old process had no durable completion proof', async () => {
    const { token, playerId } = await renewal('legacy');
    await db.prepare("INSERT INTO rtdn_seen (message_id) VALUES ('rtdn-legacy')").run();
    expect(await handleRtdn(db, baseEnv, playClient, notification('rtdn-legacy', token), at)).toEqual({ handled: 'subscription' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 3200 });
  });

  it('a revoked notification with recovered current Google state cannot refund earlier periods', async () => {
    const { token, playerId } = await renewal('stale-revoke');
    expect(await handleRtdn(db, baseEnv, playClient, notification('rtdn-stale-revoke', token, 12), at)).toEqual({ handled: 'state_reconciled' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 1600 });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM purchases WHERE player_id = ?1 AND state = 'refunded'").bind(playerId).first()).toEqual({ n: 0 });
  });

  it('a verified current-period refund preserves earlier paid periods on the same token', async () => {
    const { token, playerId, orderId } = await renewal('current-refund');
    await verifyPurchase(db, playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token }, at);
    fakePlay.subs.get(token)!.state = 'expired';
    fakePlay.orders.set(orderId, { orderId, purchaseToken: token, createTimeMs: at.getTime(), fullRefundTimeMs: at.getTime() + 1000, partialRefund: false });
    expect(await handleRtdn(db, baseEnv, playClient, notification('rtdn-current-refund', token, 12), new Date(at.getTime() + 2000))).toEqual({ handled: 'revoked' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 1600 });
    expect(await db.prepare('SELECT order_id, state FROM purchases WHERE player_id = ?1 ORDER BY order_id').bind(playerId).all()).toMatchObject({ results: [{ order_id: 'test-order-current-refund', state: 'granted' }, { order_id: orderId, state: 'refunded' }] });
  });

  it('an unconfirmed voided order stays retryable and partial refunds require review without clawback', async () => {
    const { token, playerId } = await renewal('unconfirmed-refund');
    const orderId = 'test-order-unconfirmed-refund';
    const message = { message: { messageId: 'rtdn-unconfirmed-refund', data: btoa(JSON.stringify({ voidedPurchaseNotification: { orderId } })) } };
    fakePlay.orders.set(orderId, { orderId, purchaseToken: token, createTimeMs: at.getTime(), fullRefundTimeMs: 0, partialRefund: false });
    await expect(handleRtdn(db, baseEnv, playClient, message, at)).rejects.toMatchObject({ code: 'refund_unconfirmed' });
    fakePlay.orders.get(orderId)!.partialRefund = true;
    await expect(handleRtdn(db, baseEnv, playClient, message, at)).rejects.toMatchObject({ code: 'refund_requires_review' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 1600 });
    expect(await db.prepare('SELECT state FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ state: 'granted' });
    fakePlay.orders.get(orderId)!.fullRefundTimeMs = at.getTime() + 1000;
    expect(await handleRtdn(db, baseEnv, playClient, message, new Date(at.getTime() + 2000))).toEqual({ handled: 'refunded' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 0 });
  });

  it('does not grant a new period whose official order is already fully refunded', async () => {
    const { token, playerId, orderId } = await renewal('refunded-before-verify');
    fakePlay.orders.set(orderId, { orderId, purchaseToken: token, createTimeMs: at.getTime(), fullRefundTimeMs: at.getTime() + 1000, partialRefund: false });
    expect(await verifyPurchase(db, playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token }, new Date(at.getTime() + 2000))).toMatchObject({ status: 'not_entitled' });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ n: 0 });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 1600 });
  });

  it('suspends current-period mail while a revoked refund awaits Google proof, preserving earlier periods', async () => {
    const { token, playerId, orderId } = await renewal('refund-propagation');
    await verifyPurchase(db, playClient, playerId, { productId: 'eclipse_blessing_30d', purchaseToken: token }, at);
    const mail = await db.prepare('SELECT id FROM mail WHERE player_id = ?1 AND source_key = ?2').bind(playerId, `sub:${orderId}:hd:1`).first<{ id: number }>();
    fakePlay.subs.get(token)!.state = 'expired';
    const msg = notification('rtdn-refund-propagation', token, 12);
    await expect(handleRtdn(db, baseEnv, playClient, msg, at)).rejects.toMatchObject({ code: 'refund_unconfirmed' });
    await expect(claimMail(db, playerId, mail!.id, at)).rejects.toMatchObject({ code: 'entitlement_unavailable' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 3200 });
    fakePlay.orders.set(orderId, { orderId, purchaseToken: token, createTimeMs: at.getTime(), fullRefundTimeMs: at.getTime() + 1000, partialRefund: false });
    expect(await handleRtdn(db, baseEnv, playClient, msg, new Date(at.getTime() + 2000))).toEqual({ handled: 'revoked' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 1600 });
  });

  it('replays after fulfillment committed but both completion and failure-record writes were unavailable', async () => {
    const { token, playerId } = await renewal('lost-completion');
    const msg = notification('rtdn-lost-completion', token);
    const failing = new Proxy(db, { get(target, key) {
      if (key === 'prepare') return (sql: string) => {
        if (sql.startsWith('UPDATE rtdn_seen')) throw new Error('simulated completion outage');
        return target.prepare(sql);
      };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    await expect(handleRtdn(failing, baseEnv, playClient, msg, at)).rejects.toThrow('simulated completion outage');
    expect(await handleRtdn(db, baseEnv, playClient, msg, new Date(at.getTime() + 61_000))).toEqual({ handled: 'subscription' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 3200 });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM purchase_events WHERE source = 'rtdn' AND json_extract(detail, '$.messageId') = ?1").bind(msg.message.messageId).first()).toEqual({ n: 1 });
  });

  it('an expired worker cannot mark or release the succeeding delivery owner', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at);
    let unblock: (() => void) | undefined;
    let settled: Promise<unknown> | undefined;
    try {
      const { token, playerId } = await renewal('ownership');
      let enter!: () => void; let release!: () => void;
      const entered = new Promise<void>((resolve) => { enter = resolve; });
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const slow = { ...playClient, async getSubscription(t: string) { enter(); await gate; return playClient.getSubscription(t); } };
      const msg = notification('rtdn-ownership', token);
      const first = handleRtdn(db, baseEnv, slow, msg, at);
      // Attach the rejection handler before unblocking to avoid an unhandled rejection.
      const firstResult = first.catch((e: unknown) => e);
      unblock = release; settled = firstResult;
      await entered;
      vi.setSystemTime(new Date(at.getTime() + 61_000));
      expect(await handleRtdn(db, baseEnv, playClient, msg, new Date(at.getTime() + 61_000))).toEqual({ handled: 'subscription' });
      release();
      expect(await firstResult).toMatchObject({ code: 'billing_lease_lost' });
      expect(await db.prepare('SELECT state, attempts, owner FROM rtdn_seen WHERE message_id = ?1').bind(msg.message.messageId).first()).toEqual({ state: 'done', attempts: 2, owner: null });
      expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 3200 });
    } finally {
      unblock?.(); await settled;
      vi.useRealTimers();
    }
  });

  it('bounds failed processing, retains safe dead-letter evidence and never records exception secrets', async () => {
    const { token, playerId } = await renewal('dead-letter');
    const msg = notification('rtdn-dead-letter', token);
    let calls = 0;
    const failing = { ...playClient, async getSubscription() { calls++; throw new Error('private-purchase-token: must never be persisted'); } };
    for (let i = 0; i < 10; i++) await expect(handleRtdn(db, baseEnv, failing, msg, at)).rejects.toThrow('must never be persisted');
    await expect(handleRtdn(db, baseEnv, failing, msg, at)).rejects.toMatchObject({ code: 'rtdn_dead_letter' });
    expect(calls).toBe(10);
    expect(await db.prepare('SELECT state, attempts, last_code FROM rtdn_seen WHERE message_id = ?1').bind(msg.message.messageId).first()).toEqual({ state: 'dead_letter', attempts: 10, last_code: 'processing_failed' });
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 1600 });
  });

  it('rejects a reused message id with different content even after completion', async () => {
    const { token } = await renewal('conflict');
    await handleRtdn(db, baseEnv, playClient, notification('rtdn-conflict', token), at);
    await expect(handleRtdn(db, baseEnv, playClient, notification('rtdn-conflict', token, 5), at)).rejects.toMatchObject({ code: 'rtdn_message_conflict' });
  });

  it('records deleted-account renewal as rejected without recreating a wallet or adding mail', async () => {
    const { token, playerId, orderId } = await renewal('deleted');
    await deleteAccount(db, playerId, 'DELETE');
    const previousMail = await db.prepare('SELECT COUNT(*) AS n FROM mail WHERE player_id = ?1').bind(playerId).first();
    const msg = notification('rtdn-deleted', token);
    expect(await handleRtdn(db, baseEnv, playClient, msg, at)).toEqual({ handled: 'subscription_rejected' });
    expect(await db.prepare('SELECT state, outcome FROM rtdn_seen WHERE message_id = ?1').bind(msg.message.messageId).first()).toEqual({ state: 'done', outcome: 'subscription_rejected' });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE order_id = ?1').bind(orderId).first()).toEqual({ n: 0 });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM mail WHERE player_id = ?1').bind(playerId).first()).toEqual(previousMail);
  });

  it('allows one audited operator reset with a matching attempt count and authentic redelivery', async () => {
    const { token, playerId } = await renewal('operator-replay');
    const msg = notification('rtdn-operator-replay', token);
    await db.prepare("INSERT INTO rtdn_seen (message_id, state, attempts) VALUES (?1, 'dead_letter', 10)").bind(msg.message.messageId).run();
    await db.prepare("INSERT OR IGNORE INTO admin_users (email, role, created_by) VALUES ('rtdn-viewer@example.com', 'viewer', 'test')").run();
    const path = `/admin/api/billing/notifications/${msg.message.messageId}/retry`;
    const request = post({ expectedAttempts: 10, reason: 'provider recovered; replay authentic delivery' });
    expect((await admin(path, { ...request, as: 'rtdn-viewer@example.com' })).status).toBe(403);
    expect((await admin(path, post({ expectedAttempts: 9, reason: 'stale operator record' }))).status).toBe(409);
    expect(await (await admin(path, request)).json()).toEqual({ state: 'pending', requiresAuthenticatedRedelivery: true });
    expect((await admin(path, request)).status).toBe(409);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'billing.notification.retry' AND target = ?1").bind(msg.message.messageId).first()).toEqual({ n: 1 });
    expect(await handleRtdn(db, baseEnv, playClient, msg, at)).toEqual({ handled: 'subscription' });
    expect((await admin(path, post({ expectedAttempts: 1, reason: 'must not replay done record' }))).status).toBe(409);
    expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ balance: 3200 });
    const list = await (await admin('/admin/api/billing/notifications?state=done', { as: 'rtdn-viewer@example.com' })).text();
    expect(list).toContain(msg.message.messageId);
    expect(list).not.toContain(token);
    for (const row of (JSON.parse(list) as { notifications: Record<string, unknown>[] }).notifications) {
      expect(row).not.toHaveProperty('payload_hash');
      expect(row).not.toHaveProperty('owner');
    }
    expect((await admin('/admin/api/billing/notifications?state=invalid')).status).toBe(400);
    expect((await admin('/admin/api/billing/notifications', { as: null })).status).toBe(401);
  });

  it('a legacy zero-attempt reset cannot be repeated before authentic delivery', async () => {
    const id = 'rtdn-legacy-zero-reset';
    await db.prepare('INSERT INTO rtdn_seen (message_id) VALUES (?1)').bind(id).run();
    const path = `/admin/api/billing/notifications/${id}/retry`;
    const request = post({ expectedAttempts: 0, reason: 'reconcile legacy completion ambiguity' });
    expect((await admin(path, request)).status).toBe(200);
    expect((await admin(path, request)).status).toBe(409);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'billing.notification.retry' AND target = ?1").bind(id).first()).toEqual({ n: 1 });
  });
});
