import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { limitedCharacterBanner } from '@uomd/economy';
import { applyLedger } from '../src/db/ledger';
import { admin, game, post, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let n = 0;
const rid = (): string => `r_${++n}_${Math.random().toString(36).slice(2, 10)}`;
const j = (method: string, body: unknown, as?: string) => ({ method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, ...(as ? { as } : {}) });

beforeAll(async () => {
  const rows: [string, number][] = [['ops_five_a', 5], ['ops_five_b', 5], ['ops_four_a', 4], ['ops_four_b', 4], ['ops_three_a', 3], ['ops_three_b', 3]];
  for (const [id, rarity] of rows)
    await db().prepare("INSERT OR IGNORE INTO characters (id, name_en, rarity, element, role, age, acquisition, base_hp, base_atk, base_def, base_spd) VALUES (?1,?1,?2,'Stone','tank',20,'gacha',10,2,2,4)").bind(id, rarity).run();
  await db().prepare("INSERT OR IGNORE INTO admin_users (email, role, created_by) VALUES ('viewer@example.com','viewer','test'), ('operator@example.com','operator','test')").run();
});

const pools = { four: ['ops_four_a', 'ops_four_b'], three: ['ops_three_a', 'ops_three_b'], fiveStandard: ['ops_five_b'] };
const cfg = (id: string, featured = 'ops_five_a') => limitedCharacterBanner(id, featured, pools);

describe('players', () => {
  it('search and detail show wallets, ledger, pulls, items and sessions; roles and ids are validated', async () => {
    const { playerId } = await signIn(`sub-adm-${rid()}`);
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 3, reason: 'test', idempotencyKey: `t:${rid()}` });
    const list = (await (await admin(`/admin/api/players?q=${playerId.slice(0, 10)}`, { as: 'viewer@example.com' })).json()) as { players: { id: string }[] };
    expect(list.players.map((p) => p.id)).toContain(playerId);
    const detail = (await (await admin(`/admin/api/players/${playerId}`, { as: 'viewer@example.com' })).json()) as { wallets: { currency: string; balance: number }[]; ledger: unknown[]; activeSessions: number };
    expect(detail.wallets).toEqual([{ currency: 'eclipse_token', balance: 3 }]);
    expect(detail.ledger).toHaveLength(1);
    expect(detail.activeSessions).toBe(1);
    expect((await admin('/admin/api/players/not-an-id', { as: 'viewer@example.com' })).status).toBe(400);
    expect((await admin(`/admin/api/players/p_${'0'.repeat(32)}`, { as: 'viewer@example.com' })).status).toBe(404);
    expect((await admin('/admin/api/players', { as: null })).status).toBe(401);
    // LIKE wildcards in the query are literal
    expect(((await (await admin('/admin/api/players?q=%25', { as: 'viewer@example.com' })).json()) as { players: unknown[] }).players).toHaveLength(0);
  });

  it('compensation mail: operator may send, big premium grants need an owner, everything is audited; the player claims it', async () => {
    const { auth, playerId } = await signIn(`sub-comp-${rid()}`);
    const mail = { kind: 'compensation', title: 'Sorry', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 320 }] };
    expect((await admin(`/admin/api/players/${playerId}/mail`, j('POST', { mail, reason: 'downtime 2026-10-11' }, 'viewer@example.com'))).status).toBe(403);
    const ok = await admin(`/admin/api/players/${playerId}/mail`, j('POST', { mail, reason: 'downtime 2026-10-11' }, 'operator@example.com'));
    expect(ok.status).toBe(201);
    const big = { ...mail, attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 9000 }] };
    expect((await admin(`/admin/api/players/${playerId}/mail`, j('POST', { mail: big, reason: 'bigger gift' }, 'operator@example.com'))).status).toBe(403);
    expect((await admin(`/admin/api/players/${playerId}/mail`, j('POST', { mail: big, reason: 'bigger gift' }))).status).toBe(201);
    expect((await admin(`/admin/api/players/${playerId}/mail`, j('POST', { mail, reason: 'x' }))).status).toBe(400); // reason too short
    const { id } = (await ok.json()) as { id: number };
    expect((await game(`/api/v1/mail/${id}/claim`, post({}, auth))).status).toBe(200);
    const audit = (await (await admin('/admin/api/audit?limit=20')).json()) as { entries: { action: string; target: string }[] };
    expect(audit.entries.filter((e) => e.action === 'player.mail' && e.target === playerId)).toHaveLength(2);
  });

  it('owner-only balance adjustment is idempotent, cannot overdraw, and ban revokes sessions at once', async () => {
    const { auth, playerId } = await signIn(`sub-adj-${rid()}`);
    const id = rid();
    const body = { currency: 'eclipse_token', delta: 500, reason: 'manual correction', requestId: id };
    expect((await admin(`/admin/api/players/${playerId}/adjust`, j('POST', body, 'operator@example.com'))).status).toBe(403);
    expect(await (await admin(`/admin/api/players/${playerId}/adjust`, j('POST', body))).json()).toEqual({ applied: true, balance: 500 });
    expect(await (await admin(`/admin/api/players/${playerId}/adjust`, j('POST', body))).json()).toEqual({ applied: false, balance: 500 });
    expect((await admin(`/admin/api/players/${playerId}/adjust`, j('POST', { ...body, delta: 501 }))).status).toBe(409);
    expect((await admin(`/admin/api/players/${playerId}/adjust`, j('POST', { ...body, requestId: rid(), delta: -600 }))).status).toBe(409);
    expect((await game('/api/v1/me', { headers: auth })).status).toBe(200);
    expect((await admin(`/admin/api/players/${playerId}/status`, j('POST', { status: 'banned', reason: 'cheating' }, 'operator@example.com'))).status).toBe(403);
    expect((await admin(`/admin/api/players/${playerId}/status`, j('POST', { status: 'banned', reason: 'cheating' }))).status).toBe(200);
    expect((await game('/api/v1/me', { headers: auth })).status).toBe(401);
    expect((await admin(`/admin/api/players/${playerId}/status`, j('POST', { status: 'active', reason: 'appeal accepted' }))).status).toBe(200);
  });
});

describe('banners', () => {
  it('creates a draft, edits it with optimistic concurrency and lists it with exact analysis', async () => {
    const id = `ops_b_${rid()}`.replace(/-/g, '_').toLowerCase().slice(0, 40);
    const create = await admin(`/admin/api/banners/${id}`, j('PUT', { title_en: 'Test Oath', config: cfg(id), expectedVersion: 0 }, 'operator@example.com'));
    expect(create.status).toBe(200);
    expect((await admin(`/admin/api/banners/${id}`, j('PUT', { title_en: 'Dup', config: cfg(id), expectedVersion: 0 }))).status).toBe(409);
    expect((await admin(`/admin/api/banners/${id}`, j('PUT', { title_en: 'Test Oath 2', config: cfg(id), expectedVersion: 5 }))).status).toBe(409);
    expect((await admin(`/admin/api/banners/${id}`, j('PUT', { title_en: 'Test Oath 2', config: cfg(id), expectedVersion: 1 }))).status).toBe(200);
    expect((await admin(`/admin/api/banners/${id}`, j('PUT', { title_en: 'Test Oath 3', config: cfg(id), expectedVersion: 1 }))).status).toBe(409); // stale
    const list = (await (await admin('/admin/api/banners', { as: 'viewer@example.com' })).json()) as { banners: { id: string; title_en: string; version: number; status: string }[] };
    expect(list.banners.find((b) => b.id === id)).toMatchObject({ title_en: 'Test Oath 2', version: 2, status: 'draft' });
  });

  it('validates configs: ids must exist with the right rarity, rates sane, id matches the URL', async () => {
    const id = `ops_v_${rid()}`.replace(/-/g, '_').toLowerCase().slice(0, 40);
    const put = (config: unknown, ver = 0, url = id) => admin(`/admin/api/banners/${url}`, j('PUT', { title_en: 'Validation', config, expectedVersion: ver }));
    expect((await put({ ...cfg(id), pools: { ...cfg(id).pools, four: ['no_such_hero'] } })).status).toBe(422);
    expect((await put({ ...cfg(id), pools: { ...cfg(id).pools, four: ['ops_three_a'] , three: ['ops_four_a'] } })).status).toBe(422); // wrong rarities
    expect((await put({ ...cfg(id), hardPity: 0 })).status).toBe(422);
    expect((await put(cfg('another_id'))).status).toBe(422); // id mismatch
    expect((await put('nonsense')).status).toBe(422);
    expect((await admin(`/admin/api/banners/${id}`, j('PUT', { title_en: 'x', config: cfg(id), expectedVersion: 0 }, 'viewer@example.com'))).status).toBe(403);
  });

  it('activation makes the banner pullable; a retired or unscheduled banner is not; live banners are not editable', async () => {
    const id = `ops_live_${rid()}`.replace(/-/g, '_').toLowerCase().slice(0, 40);
    await admin(`/admin/api/banners/${id}`, j('PUT', { title_en: 'Live Oath', config: cfg(id), expectedVersion: 0 }));
    const { auth, playerId } = await signIn(`sub-live-${rid()}`);
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 800, reason: 'test', idempotencyKey: `t:${rid()}` });
    const pull = () => game('/api/v1/gacha/pull', post({ bannerId: id, count: 1, requestId: rid() }, auth));
    expect((await pull()).status).toBe(404); // draft
    expect((await admin(`/admin/api/banners/${id}/state`, j('POST', { action: 'activate', startsAt: '2026-01-02T00:00:00.000Z', endsAt: '2026-01-01T00:00:00.000Z' }))).status).toBe(422);
    expect((await admin(`/admin/api/banners/${id}/state`, j('POST', { action: 'activate', startsAt: '2020-01-01T00:00:00.000Z', endsAt: '2999-01-01T00:00:00.000Z' }))).status).toBe(200);
    expect((await pull()).status).toBe(200);
    expect((await admin(`/admin/api/banners/${id}`, j('PUT', { title_en: 'Edit', config: cfg(id), expectedVersion: 2 }))).status).toBe(409);
    const list = (await (await game('/api/v1/banners')).json()) as { banners: { id: string }[] };
    expect(list.banners.map((b) => b.id)).toContain(id);
    expect((await admin(`/admin/api/banners/${id}/state`, j('POST', { action: 'retire' }))).status).toBe(200);
    expect((await pull()).status).toBe(404);
    expect((await admin(`/admin/api/banners/${id}/state`, j('POST', { action: 'retire' }))).status).toBe(409);
    expect((await admin(`/admin/api/banners/${id}/state`, j('POST', { action: 'activate' }))).status).toBe(409);
    expect((await admin('/admin/api/banners/missing_one/state', j('POST', { action: 'retire' }))).status).toBe(404);
  });

  it('the simulator returns exact numbers plus a seeded Monte Carlo run and refuses oversized requests', async () => {
    const id = 'sim_probe';
    const res = await admin('/admin/api/banners/simulate', j('POST', { config: cfg(id), accounts: 300, pullsPerAccount: 100, seed: 7 }, 'viewer@example.com'));
    expect(res.status).toBe(200);
    const out = (await res.json()) as { exact: { expectedPullsPerFiveStar: number; worstCasePullsForTarget: number }; simulated: { rarity: { five: number }; pullsToTarget: { max: number } } };
    expect(out.exact.expectedPullsPerFiveStar).toBeCloseTo(32.97, 1);
    expect(out.exact.worstCasePullsForTarget).toBe(160);
    expect(out.simulated.rarity.five).toBeGreaterThan(0.02);
    expect(out.simulated.pullsToTarget.max).toBeLessThanOrEqual(100);
    expect(((await (await admin('/admin/api/banners/simulate', j('POST', { config: cfg(id), accounts: 300, pullsPerAccount: 100, seed: 7 }))).json()) as { simulated: unknown }).simulated).toEqual(out.simulated);
    expect((await admin('/admin/api/banners/simulate', j('POST', { config: cfg(id), accounts: 20000, pullsPerAccount: 500 }))).status).toBe(422);
    expect((await admin('/admin/api/banners/simulate', j('POST', { bannerId: 'hall_of_ancestors', accounts: 100, pullsPerAccount: 50 }))).status).toBe(404); // not seeded in the test database
  });
});

describe('shop, flags, ads', () => {
  it('products are owner-managed; an active product becomes visible and verifiable, validation rejects bad grants', async () => {
    const put = (id: string, body: unknown, as?: string) => admin(`/admin/api/products/${id}`, j('PUT', body, as));
    const good = { kind: 'consumable', title_en: 'Pouch', grants: [{ type: 'currency', currency: 'eclipse_token', amount: 480 }], active: true };
    expect((await put('ops_pouch', good, 'operator@example.com')).status).toBe(403);
    expect((await put('ops_pouch', good)).status).toBe(200);
    expect((await put('ops_pouch', { ...good, grants: [] })).status).toBe(400);
    expect((await put('ops_pouch', { ...good, grants: [{ type: 'currency', currency: 'gems', amount: 1 }] })).status).toBe(400);
    expect((await put('Bad Id', good)).status).toBe(400);
    expect((await put('ops_sub', { kind: 'subscription', title_en: 'Sub', grants: [], active: false })).status).toBe(400);
    expect((await put('ops_pouch', { ...good, kind: 'subscription', sub_config: undefined })).status).toBe(400);
    expect(((await (await game('/api/v1/shop/products')).json()) as { products: { productId: string }[] }).products.map((p) => p.productId)).toContain('ops_pouch');
    expect(((await (await admin('/admin/api/products', { as: 'viewer@example.com' })).json()) as { products: unknown[] }).products.length).toBeGreaterThan(0);
    expect((await admin('/admin/api/purchases', { as: 'viewer@example.com' })).status).toBe(200);
    expect((await admin('/admin/api/ads/summary', { as: 'viewer@example.com' })).status).toBe(200);
  });

  it('feature flags are brakes: switching gacha, shop and ads off blocks them at once, and back on restores them', async () => {
    const { auth, playerId } = await signIn(`sub-flag-${rid()}`);
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 1600, reason: 'test', idempotencyKey: `t:${rid()}` });
    const flags = (await (await game('/api/v1/flags')).json()) as { flags: Record<string, { enabled: boolean }> };
    expect(flags.flags['gacha.enabled']?.enabled).toBe(true);
    const version = async (key: string) => ((await (await admin('/admin/api/flags', { as: 'viewer@example.com' })).json()) as { flags: { key: string; version: number }[] }).flags.find((f) => f.key === key)!.version;
    const set = async (key: string, enabled: boolean) => admin(`/admin/api/flags/${key}`, j('PUT', { enabled, note: 'test', expectedVersion: await version(key) }, 'operator@example.com'));
    expect((await set('gacha.enabled', false)).status).toBe(200);
    expect((await game('/api/v1/gacha/pull', post({ bannerId: 'hall_x', count: 1, requestId: rid() }, auth))).status).toBe(503);
    expect((await set('shop.enabled', false)).status).toBe(200);
    expect((await game('/api/v1/shop/verify', post({ productId: 'ops_pouch', purchaseToken: 'q'.repeat(20) }, auth))).status).toBe(503);
    expect((await set('ads.rewarded.enabled', false)).status).toBe(200);
    expect((await game('/api/v1/ads/begin', post({}, auth))).status).toBe(503);
    for (const k of ['gacha.enabled', 'shop.enabled', 'ads.rewarded.enabled']) expect((await set(k, true)).status).toBe(200);
    expect((await game('/api/v1/gacha/pull', post({ bannerId: 'hall_x', count: 1, requestId: rid() }, auth))).status).toBe(404); // reaches the banner lookup again
    // stale version -> conflict; new flags need expectedVersion 0
    expect((await admin('/admin/api/flags/gacha.enabled', j('PUT', { enabled: false, expectedVersion: 1 }))).status).toBe(409);
    expect((await admin('/admin/api/flags/exp.new_thing', j('PUT', { enabled: true, value: { n: 3 }, expectedVersion: 0 }))).status).toBe(200);
    expect(((await (await game('/api/v1/flags')).json()) as { flags: Record<string, { value: unknown }> }).flags['exp.new_thing']?.value).toEqual({ n: 3 });
    expect((await admin('/admin/api/flags/Bad Key', j('PUT', { enabled: true, expectedVersion: 0 }))).status).toBe(400);
  });
});

describe('development tracker notes', () => {
  it('anyone with a role can leave feedback; operators move it along; notes are never rewritten or deleted', async () => {
    const mk = (body: unknown, as?: string) => admin('/admin/api/dev/notes', j('POST', body, as));
    const created = await mk({ area: 'Summon', kind: 'change_request', body: 'The result cards should show the rarity glow.' }, 'viewer@example.com');
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };
    expect((await mk({ area: 'x', kind: 'idea', body: 'too short area' })).status).toBe(400);
    expect((await mk({ area: 'Summon', kind: 'nonsense', body: 'x' })).status).toBe(400);
    const open = (await (await admin('/admin/api/dev/notes?status=open', { as: 'viewer@example.com' })).json()) as { notes: { id: number; status: string; created_by: string }[] };
    expect(open.notes.find((n) => n.id === id)).toMatchObject({ status: 'open', created_by: 'viewer@example.com' });
    expect((await admin(`/admin/api/dev/notes/${id}`, j('PATCH', { status: 'done', resolution: 'x' }, 'viewer@example.com'))).status).toBe(403);
    expect((await admin(`/admin/api/dev/notes/${id}`, j('PATCH', { status: 'done', resolution: 'Glow added in commit abc123.' }, 'operator@example.com'))).status).toBe(200);
    const done = (await (await admin('/admin/api/dev/notes?status=done', { as: 'viewer@example.com' })).json()) as { notes: { id: number; resolution: string; updated_by: string }[] };
    expect(done.notes.find((n) => n.id === id)).toMatchObject({ resolution: 'Glow added in commit abc123.', updated_by: 'operator@example.com' });
    expect((await admin('/admin/api/dev/notes/99999', j('PATCH', { status: 'done' }))).status).toBe(404);
    await expect(db().prepare("UPDATE dev_notes SET body = 'edited' WHERE id = ?1").bind(id).run()).rejects.toThrow(/cannot be rewritten/);
    await expect(db().prepare('DELETE FROM dev_notes WHERE id = ?1').bind(id).run()).rejects.toThrow(/design record/);
  });
});

describe('economy model endpoint', () => {
  it('returns the three archetypes and the floor rule; rejects nonsense', async () => {
    const d = (await (await admin('/admin/api/economy/defaults', { as: 'viewer@example.com' })).json()) as { model: { pullCost: number } };
    expect(d.model.pullCost).toBe(160);
    const r = await admin('/admin/api/economy/flow', j('POST', { upgradeStepFee: 150 }, 'viewer@example.com'));
    expect(r.status).toBe(200);
    const out = (await r.json()) as { results: { archetype: string }[]; floorHolds: boolean; recoveryDays: number };
    expect(out.results.map((x) => x.archetype)).toEqual(['all_in_wishes', 'balanced', 'never_wishes']);
    expect(out.floorHolds).toBe(true);
    expect((await admin('/admin/api/economy/flow', j('POST', { days: 0 }))).status).toBe(400);
    expect((await admin('/admin/api/economy/flow', j('POST', { extra: 1 }))).status).toBe(400);
  });
});
