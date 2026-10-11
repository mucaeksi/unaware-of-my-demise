import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { derToRaw } from '../src/ads/ssv';
import { ADMOB_UNIT, ADMOB_UNIT_NUMERIC, game, post, signIn, ssvPath } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let n = 0;
const uid = (): string => `${++n}${Math.random().toString(36).slice(2, 10)}`;

async function view(auth: Record<string, string>, playerId: string, over: Record<string, string> = {}, opts: Parameters<typeof ssvPath>[1] = {}): Promise<Response> {
  const begin = (await (await game('/api/v1/ads/begin', post({}, auth))).json()) as { nonce: string };
  const path = await ssvPath({ ad_network: '5450213213286189855', ad_unit: ADMOB_UNIT_NUMERIC, custom_data: begin.nonce, reward_amount: '1', reward_item: 'token', timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: playerId, ...over }, opts);
  return game(path);
}

describe('rewarded ads (AdMob server-side verification)', () => {
  it("accepts a callback whose reward name contains an apostrophe sent literally (the URL parser escapes it to %27 before the Worker sees it)", async () => {
    const { auth, playerId } = await signIn(`sub-adapo-${uid()}`);
    const begin = (await (await game('/api/v1/ads/begin', post({}, auth))).json()) as { nonce: string };
    const path = await ssvPath({ ad_network: '5450213213286189855', ad_unit: ADMOB_UNIT_NUMERIC, custom_data: begin.nonce, reward_amount: '1', reward_item: "Bell's Remains", timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: playerId }, { rawApostrophe: true });
    expect(path).toContain("Bell's");
    const res = await game(path);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ granted: true });
    // the same, signed by the TEST key (AdMob's "verify URL" button): acknowledged, never paid
    const t = await game(await ssvPath({ ad_network: '5450213213286189855', ad_unit: '1234567890', reward_amount: '20', reward_item: "Bell's Remains", timestamp: String(Date.now()), transaction_id: '123456789' }, { test: true, rawApostrophe: true }));
    expect(t.status).toBe(200);
    expect(await t.json()).toEqual({ granted: false, reason: 'test_callback' });
    // a tampered message is still refused
    const bad = await game(await ssvPath({ ad_unit: ADMOB_UNIT_NUMERIC, reward_item: "Bell's Remains", timestamp: String(Date.now()), transaction_id: `tx${uid()}` }, { rawApostrophe: true, badSignature: true }));
    expect(bad.status).toBe(400);
  });

  it('der -> raw conversion handles short integers and padding bytes', () => {
    const der = Uint8Array.from([0x30, 0x08, 0x02, 0x02, 0x00, 0xff, 0x02, 0x02, 0x01, 0x02]);
    const raw = derToRaw(der);
    expect(raw).toHaveLength(64);
    expect(raw[31]).toBe(0xff);
    expect(raw[62]).toBe(0x01);
    expect(raw[63]).toBe(0x02);
    expect(() => derToRaw(Uint8Array.from([0x31, 0x00]))).toThrow();
  });

  it('a Google-signed callback with a live nonce pays 30 Eclipse Tokens exactly once per transaction', async () => {
    const { auth, playerId } = await signIn(`sub-ad-${uid()}`);
    const tx = `tx${uid()}`;
    const res = await view(auth, playerId, { transaction_id: tx });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ granted: true, balance: 30 });
    // the same transaction again (even with a fresh nonce): no second payout
    const dup = await view(auth, playerId, { transaction_id: tx });
    expect(await dup.json()).toEqual({ granted: false, reason: 'duplicate' });
    expect(((await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> }).wallets.eclipse_token).toBe(30);
    expect(await (await game('/api/v1/ads/status', { headers: auth })).json()).toMatchObject({ windowViews: 1, perWindow: 5, reward: 30 });
  });

  it('enforces 5 per rolling 12 hours; the 6th view is refused before it starts and in the callback', async () => {
    const { auth, playerId } = await signIn(`sub-adcap-${uid()}`);
    const paid: number[] = [];
    for (let i = 0; i < 5; i++) paid.push(((await (await view(auth, playerId)).json()) as { granted: boolean }).granted ? 1 : 0);
    expect(paid).toEqual([1, 1, 1, 1, 1]);
    const begin = await game('/api/v1/ads/begin', post({}, auth));
    expect(begin.status).toBe(429);
    expect(((await begin.json()) as { error: string }).error).toBe('ad_cap_reached');
    // a nonce obtained earlier cannot be used to exceed the cap either
    await db().prepare("INSERT INTO ad_nonces (nonce, player_id, expires_at) VALUES ('0123456789abcdef0123', ?1, '2999-01-01T00:00:00.000Z')").bind(playerId).run();
    const extra = await game(await ssvPath({ ad_unit: ADMOB_UNIT_NUMERIC, custom_data: '0123456789abcdef0123', timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: playerId }));
    expect(await extra.json()).toEqual({ granted: false, reason: 'window_cap' });
    expect(((await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> }).wallets.eclipse_token).toBe(150);
  });

  it('parallel callbacks cannot exceed the cap', async () => {
    const { auth, playerId } = await signIn(`sub-adpar-${uid()}`);
    const nonces: string[] = [];
    for (let i = 0; i < 5; i++) nonces.push(((await (await game('/api/v1/ads/begin', post({}, auth))).json()) as { nonce: string }).nonce);
    for (let i = 0; i < 5; i++) nonces.push(`ffffffffffffffffffff${i}`.slice(0, 24));
    await db().batch(nonces.slice(5).map((x) => db().prepare("INSERT INTO ad_nonces (nonce, player_id, expires_at) VALUES (?1, ?2, '2999-01-01T00:00:00.000Z')").bind(x, playerId)));
    const rs = await Promise.all(nonces.map(async (nonce) => game(await ssvPath({ ad_unit: ADMOB_UNIT, custom_data: nonce, timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: playerId }))));
    const out = (await Promise.all(rs.map((r) => r.json()))) as { granted: boolean }[];
    expect(out.filter((o) => o.granted)).toHaveLength(5);
    expect(((await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> }).wallets.eclipse_token).toBe(150);
  });

  it('rejects tampering, wrong key, wrong order, foreign ad units, old callbacks and unknown/foreign/used nonces', async () => {
    const a = await signIn(`sub-adbad-${uid()}`);
    const b = await signIn(`sub-adbad2-${uid()}`);
    const okParams = async () => ({ ad_unit: ADMOB_UNIT, custom_data: ((await (await game('/api/v1/ads/begin', post({}, a.auth))).json()) as { nonce: string }).nonce, timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: a.playerId });
    expect((await game(await ssvPath(await okParams(), { badSignature: true }))).status).toBe(400);
    expect((await game(await ssvPath(await okParams(), { keyId: '1' }))).status).toBe(400);
    expect((await game(await ssvPath(await okParams(), { reorder: true }))).status).toBe(400);
    expect((await game(await ssvPath({ ...(await okParams()), ad_unit: 'ca-app-pub-1/2' }))).status).toBe(400);
    expect((await game(await ssvPath({ ...(await okParams()), timestamp: String(Date.now() - 3 * 86_400_000) }))).status).toBe(400);
    expect((await game('/api/v1/ads/ssv')).status).toBe(400);
    // a nonce of player A cannot pay player B, and a missing/unknown nonce pays nobody
    const foreign = await game(await ssvPath({ ...(await okParams()), user_id: b.playerId }));
    expect(await foreign.json()).toEqual({ granted: false, reason: 'bad_nonce' });
    const unknown = await game(await ssvPath({ ad_unit: ADMOB_UNIT, custom_data: 'doesnotexistdoesnotexist', timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: a.playerId }));
    expect(await unknown.json()).toEqual({ granted: false, reason: 'bad_nonce' });
    const noNonce = await game(await ssvPath({ ad_unit: ADMOB_UNIT, timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: a.playerId }));
    expect(await noNonce.json()).toEqual({ granted: false, reason: 'bad_nonce' });
    // a used nonce cannot be reused with another transaction
    const p = await okParams();
    expect(((await (await game(await ssvPath(p))).json()) as { granted: boolean }).granted).toBe(true);
    expect(await (await game(await ssvPath({ ...p, transaction_id: `tx${uid()}` }))).json()).toEqual({ granted: false, reason: 'bad_nonce' });
    expect(((await (await game('/api/v1/wallet', { headers: a.auth })).json()) as { wallets: Record<string, number> }).wallets.eclipse_token).toBe(30);
    expect(((await (await game('/api/v1/wallet', { headers: b.auth })).json()) as { wallets: Record<string, number> }).wallets.eclipse_token ?? 0).toBe(0);
  });

  it('fails closed when no ad unit is configured, and an expired nonce pays nothing', async () => {
    const { auth, playerId } = await signIn(`sub-adcfg-${uid()}`);
    const path = await ssvPath({ ad_unit: ADMOB_UNIT, custom_data: 'x'.repeat(20), timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: playerId });
    expect((await game(path, {}, { ADMOB_AD_UNIT_IDS: '' })).status).toBe(503);
    await db().prepare("INSERT INTO ad_nonces (nonce, player_id, expires_at) VALUES ('expirednonce0000000000', ?1, '2000-01-01T00:00:00.000Z')").bind(playerId).run();
    const r = await game(await ssvPath({ ad_unit: ADMOB_UNIT, custom_data: 'expirednonce0000000000', timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: playerId }));
    expect(await r.json()).toEqual({ granted: false, reason: 'bad_nonce' });
    expect((await game('/api/v1/ads/status')).status).toBe(401);
    expect(auth).toBeTruthy();
  });
});

describe('AdMob URL verification and test callbacks', () => {
  it('the "verify URL" request (no user_id, no custom_data, Google test key) is answered 200 and pays nothing', async () => {
    const path = await ssvPath({ ad_network: '5450213213286189855', ad_unit: ADMOB_UNIT_NUMERIC, reward_amount: '1', reward_item: 'token', timestamp: String(Date.now()), transaction_id: `tx${uid()}` }, { test: true });
    const res = await game(path);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ granted: false, reason: 'test_callback' });
  });
  it('a test-key callback never pays even with a valid player and nonce; a live-key callback without user_id is acknowledged without payout', async () => {
    const { auth, playerId } = await signIn(`sub-adtest-${uid()}`);
    const begin = (await (await game('/api/v1/ads/begin', post({}, auth))).json()) as { nonce: string };
    const test = await game(await ssvPath({ ad_unit: ADMOB_UNIT_NUMERIC, custom_data: begin.nonce, timestamp: String(Date.now()), transaction_id: `tx${uid()}`, user_id: playerId }, { test: true }));
    expect(await test.json()).toEqual({ granted: false, reason: 'test_callback' });
    const live = await game(await ssvPath({ ad_unit: ADMOB_UNIT_NUMERIC, timestamp: String(Date.now()), transaction_id: `tx${uid()}` }));
    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ granted: false, reason: 'bad_nonce' });
    expect(((await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> }).wallets.eclipse_token ?? 0).toBe(0);
  });
});

describe('currency name', () => {
  it('the main currency is called Bell\'s Remains and the name is served as data', async () => {
    expect(await (await game('/api/v1/currency')).json()).toEqual({ id: 'eclipse_token', name: "Bell's Remains" });
  });
});
