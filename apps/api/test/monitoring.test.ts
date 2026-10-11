import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { admin, game, ADMOB_UNIT_NUMERIC, post, pushToken, signIn, ssvPath } from './helpers';
import { applyLedger } from '../src/db/ledger';
import { pruneMonitoring } from '../src/monitoring';

const db = (env as unknown as { DB: D1Database }).DB;
beforeEach(async () => { await db.prepare('DELETE FROM monitor_events').run(); });
const events = async () => (await db.prepare('SELECT * FROM monitor_events ORDER BY at DESC').all()).results;

describe('central monitoring', () => {
  it('requires Access and allows a viewer to read, while validating category filters', async () => {
    expect((await admin('/admin/api/monitoring', { as: null })).status).toBe(401);
    await db.prepare("INSERT OR IGNORE INTO admin_users (email,role,created_by) VALUES ('monitor-viewer@example.com','viewer','test')").run();
    expect((await admin('/admin/api/monitoring', { as: 'monitor-viewer@example.com' })).status).toBe(200);
    expect((await admin('/admin/api/monitoring?category=secret')).status).toBe(400);
  });

  it('records a verified foreign callback with its version and ray, excluding all callback data', async () => {
    const path = await ssvPath({ ad_unit: '1234567890', custom_data: 'PRIVATE_NONCE', user_id: 'PRIVATE_PLAYER', transaction_id: 'PRIVATE_TRANSACTION', reward_item: "Bell's Remains", timestamp: String(Date.now()) }, { rawApostrophe: true });
    const res = await game(path, { headers: { 'CF-Ray': 'a48f781e7c1e6a46' } }, { CF_VERSION_METADATA: { id: 'test-version' } });
    expect(res.status).toBe(200);
    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: 'ssv_ignored', reason: 'ad_unit_not_ours', status: 200, ray_id: 'a48f781e7c1e6a46', version_id: 'test-version' });
    const serialized = JSON.stringify(rows);
    for (const secret of ['PRIVATE_NONCE', 'PRIVATE_PLAYER', 'PRIVATE_TRANSACTION', 'signature=', 'custom_data', 'user_id']) expect(serialized).not.toContain(secret);
  });

  it('keeps the precise known rejection reason without exposing untrusted error messages', async () => {
    const path = await ssvPath({ ad_unit: ADMOB_UNIT_NUMERIC, timestamp: String(Date.now()), transaction_id: 'txmonitor' }, { badSignature: true });
    expect((await game(path)).status).toBe(400);
    expect((await events())[0]).toMatchObject({ event: 'ssv_rejected', status: 400, reason: 'signature does not verify', severity: 'warning' });
  });

  it('records grants and duplicates while leaving the reward and nonce protections intact', async () => {
    const { auth, playerId } = await signIn('monitor-grant-player');
    const { nonce } = await (await game('/api/v1/ads/begin', post({}, auth))).json() as { nonce: string };
    const path = await ssvPath({ ad_unit: ADMOB_UNIT_NUMERIC, user_id: playerId, custom_data: nonce, transaction_id: 'monitor-unique-tx', timestamp: String(Date.now()) });
    expect(await (await game(path)).json()).toMatchObject({ granted: true, balance: 30 });
    expect(await (await game(path)).json()).toEqual({ granted: false, reason: 'duplicate' });
    expect((await events()).map((e) => e.reason).sort()).toEqual(['duplicate', 'granted']);
    const snapshot = await (await admin('/admin/api/monitoring?category=ads')).json() as { ads: { tokens: number }; events: { category: string }[] };
    expect(snapshot.ads.tokens).toBe(30);
    expect(snapshot.events.every((e) => e.category === 'ads')).toBe(true);
  });

  it('uses route templates for errors and discards arbitrary paths and query parameters', async () => {
    await game('/api/v1/private-email@example.com?token=SECRET_TOKEN');
    const row = (await events())[0];
    expect(row).toMatchObject({ route: 'unmatched', status: 404 });
    expect(JSON.stringify(row)).not.toContain('private-email');
    expect(JSON.stringify(row)).not.toContain('SECRET_TOKEN');
    await admin('/admin/api/players/secret-player-id');
    expect((await events()).some((e) => e.route === '/admin/api/players/:id')).toBe(true);
  });

  it('does not fail a callback when the monitoring table cannot be written', async () => {
    const broken = { prepare: (sql: string) => { if (sql.includes('monitor_events')) throw new Error('unavailable'); return db.prepare(sql); } } as D1Database;
    const path = await ssvPath({ ad_unit: '1234567890', timestamp: String(Date.now()), transaction_id: 'test-outage' });
    expect(await (await game(path, {}, { DB: broken })).json()).toEqual({ granted: false, reason: 'ad_unit_not_ours' });
  });

  it('summarizes real balances and rolling money flow without including old ledger activity', async () => {
    const baseline = await (await admin('/admin/api/monitoring')).json() as { economy: { wallets: { balance: number }[]; flows: { earned: number; spent: number }[] } };
    const { playerId } = await signIn('monitor-economy-player');
    await applyLedger(db, { playerId, currency: 'eclipse_token', delta: 200, reason: 'monitor_seed', idempotencyKey: 'monitor-earned' });
    await applyLedger(db, { playerId, currency: 'eclipse_token', delta: -40, reason: 'monitor_spend', idempotencyKey: 'monitor-spent' });
    await db.batch([
      db.prepare("INSERT INTO ledger (player_id,currency,delta,reason,idempotency_key,at) VALUES (?1,'eclipse_token',500,'old_reward','monitor-old','2020-01-01T00:00:00.000Z')").bind(playerId),
      db.prepare("UPDATE wallets SET balance=balance+500 WHERE player_id=?1 AND currency='eclipse_token'").bind(playerId)
    ]);
    const s = await (await admin('/admin/api/monitoring')).json() as typeof baseline;
    expect(s.economy.wallets[0]?.balance).toBe((baseline.economy.wallets[0]?.balance ?? 0) + 660);
    expect(s.economy.flows[0]?.earned).toBe((baseline.economy.flows[0]?.earned ?? 0) + 200);
    expect(s.economy.flows[0]?.spent).toBe((baseline.economy.flows[0]?.spent ?? 0) + 40);
  });


  it('records authenticated RTDN outcomes without persisting push credentials or purchase payloads', async () => {
    const token = await pushToken();
    const message = { message: { messageId: 'monitor-rtdn-test', data: btoa(JSON.stringify({ version: '1.0', packageName: 'app.uomd.test', eventTimeMillis: String(Date.now()), testNotification: { version: '1.0' } })) } };
    const res = await game('/api/v1/billing/rtdn', post(message, { Authorization: `Bearer ${token}` }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ handled: 'test' });
    const row = (await events())[0];
    expect(row).toMatchObject({ category: 'billing', reason: 'test', status: 200 });
    expect(JSON.stringify(row)).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain('monitor-rtdn-test');
  });
  it('expires old events and bounds retained event count', async () => {
    await db.prepare("WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM n WHERE i<10001) INSERT INTO monitor_events (id,at,service,category,event,severity,method,route,status,reason,duration_ms) SELECT 'event-'||i, CASE WHEN i=0 THEN '2020-01-01T00:00:00.000Z' ELSE strftime('%Y-%m-%dT%H:%M:%fZ','now') END, 'game','api','api_error','warning','GET','unmatched',404,'http_404',0 FROM n").run();
    await pruneMonitoring(db);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM monitor_events').first()).toEqual({ n: 10000 });
    expect(await db.prepare("SELECT id FROM monitor_events WHERE id='event-0'").first()).toBeNull();
  });
});
