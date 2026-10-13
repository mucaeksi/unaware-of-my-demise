import { beforeEach, expect, it } from 'vitest';
import { billingTag } from '../src/billing/service';
import { baseEnv, fakePlay, game, post, signIn } from './helpers';

const db = baseEnv.DB;
beforeEach(async () => {
  fakePlay.reset();
  await db.prepare("INSERT OR IGNORE INTO shop_products (product_id, kind, title_en, grants, active) VALUES ('history_pouch', 'consumable', 'History pouch', '[{\"type\":\"currency\",\"currency\":\"eclipse_token\",\"amount\":320}]', 1)").run();
});
async function receipt(state: 'pending' | 'purchased') {
  const identity = await signIn(crypto.randomUUID()); const token = `history-token-${crypto.randomUUID()}`; const orderId = `GPA.${crypto.randomUUID()}`;
  fakePlay.products.set(token, { purchaseState: state, orderId, acknowledged: false, consumed: false, purchaseTimeMs: Date.now(), obfuscatedAccountId: await billingTag(identity.playerId) });
  const response = await game('/api/v1/shop/verify', post({ productId: 'history_pouch', purchaseToken: token }, identity.auth));
  expect(response.status).toBe(200);
  return { ...identity, purchaseToken: token, orderId };
}

it('recovers an owned consumed delivery after its response is lost and Google no longer lists it', async () => {
  const own = await receipt('purchased'); fakePlay.products.delete(own.purchaseToken); fakePlay.calls.length = 0;
  const before = await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1 AND currency = ?2').bind(own.playerId, 'eclipse_token').first();
  const response = await game('/api/v1/shop/history', { headers: own.auth }); expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const data = await response.json() as any;
  expect(data.records).toHaveLength(1);
  expect(data.records[0]).toMatchObject({ productId: 'history_pouch', orderId: own.orderId, deliveryState: 'granted', acknowledged: true });
  expect(JSON.stringify(data)).not.toContain(own.purchaseToken); expect(JSON.stringify(data)).not.toContain('encrypted_token');
  expect(fakePlay.calls).toHaveLength(0);
  expect(await db.prepare('SELECT balance FROM wallets WHERE player_id = ?1 AND currency = ?2').bind(own.playerId, 'eclipse_token').first()).toEqual(before);
  const other = await signIn(crypto.randomUUID());
  expect(await (await game('/api/v1/shop/history', { headers: other.auth })).json()).toMatchObject({ records: [] });
  expect((await game('/api/v1/shop/history')).status).toBe(401);
});

it('reports pending/review work without inventing a completed delivery or leaking receipts', async () => {
  const own = await receipt('pending');
  const response = await game('/api/v1/shop/history', { headers: own.auth }); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ records: [{ deliveryState: 'unconfirmed', recoveryState: 'pending', orderId: null, acknowledged: null }] });
  await db.prepare("UPDATE billing_jobs SET state = 'review' WHERE player_id = ?1").bind(own.playerId).run();
  const review = await (await game('/api/v1/shop/history', { headers: own.auth })).json();
  expect(review).toMatchObject({ records: [{ deliveryState: 'unconfirmed', recoveryState: 'review' }] });
  expect(JSON.stringify(review)).not.toContain(own.purchaseToken);
});

it('limits history and keeps a refunded delivery distinct from a new grant', async () => {
  const own = await receipt('purchased');
  await db.prepare("UPDATE purchases SET state = 'refunded', refunded_at = ?2 WHERE order_id = ?1").bind(own.orderId, new Date().toISOString()).run();
  expect(await (await game('/api/v1/shop/history?limit=1', { headers: own.auth })).json()).toMatchObject({ records: [{ orderId: own.orderId, deliveryState: 'refunded' }] });
  expect((await game('/api/v1/shop/history?limit=1000', { headers: own.auth })).status).toBe(400);
});

it('does not present a legacy default active state as a provider observation', async () => {
  const own = await signIn(crypto.randomUUID()); const orderId = `legacy-${crypto.randomUUID()}`;
  await db.prepare(`INSERT INTO purchases (order_id, player_id, product_id, kind, token_hash, period_start)
    VALUES (?1, ?2, 'eclipse_blessing_30d', 'subscription', ?3, ?4)`)
    .bind(orderId, own.playerId, 'f'.repeat(64), new Date().toISOString()).run();
  const response = await game('/api/v1/shop/history', { headers: own.auth }); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ records: [{ orderId, deliveryState: 'granted', providerState: null, providerCheckedAt: null }] });
});
