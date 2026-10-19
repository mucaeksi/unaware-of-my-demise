import { beforeEach, describe, expect, it } from 'vitest';
import { limitedCharacterBanner } from '@uomd/economy';
import { accessToken, admin, adminEnv, AUD, baseEnv, game, signIn, TEAM } from './helpers';

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  await baseEnv.DB.batch([
    baseEnv.DB.prepare("DELETE FROM admin_users WHERE email <> 'x'"),
    baseEnv.DB.prepare("DELETE FROM characters"),
    baseEnv.DB.prepare("INSERT INTO characters (id, name_en, rarity, element, role, age, acquisition, base_vit, base_str, base_int, base_agi) VALUES ('fadyme','Fadyme',5,'Veil','support_dps',22,'free_start',11,3,1,5)")
  ]);
});

describe('Cloudflare Access authentication (fails closed)', () => {
  it('health is public; everything else is not', async () => {
    const h = await admin('/admin/api/health', { as: null });
    expect(h.status).toBe(200);
    expect(await h.json()).toMatchObject({ ok: true, auth_configured: true });
    expect((await admin('/admin/api/me', { as: null })).status).toBe(401);
  });

  it('503s everywhere when Access is not configured', async () => {
    const res = await admin('/admin/api/system', { env: adminEnv({ ACCESS_AUD: undefined }) });
    expect(res.status).toBe(503);
    expect((await res.json<{ error: string }>()).error).toBe('admin_auth_not_configured');
  });

  it('rejects tokens with the wrong audience, issuer, signature or expiry', async () => {
    const ask = async (over: Parameters<typeof accessToken>[1]) =>
      admin('/admin/api/me', { as: null, headers: { 'Cf-Access-Jwt-Assertion': await accessToken({ email: 'owner@example.com' }, over) } });
    expect((await ask({ aud: 'other' })).status).toBe(401);
    expect((await ask({ iss: 'https://evil.example.com' })).status).toBe(401);
    expect((await ask({ wrongKey: true })).status).toBe(401);
    expect((await ask({ expired: true })).status).toBe(401);
    expect((await ask({})).status).toBe(200);
  });

  it('only bootstrap owners or stored admins get in, and the bootstrap is audited', async () => {
    expect((await admin('/admin/api/me', { as: 'stranger@example.com' })).status).toBe(403);
    const me = await admin('/admin/api/me', { as: 'owner@example.com' });
    expect(await me.json()).toEqual({ identity: 'owner@example.com', role: 'owner' });
    const log = await baseEnv.DB.prepare("SELECT action FROM audit_log WHERE action = 'admin.bootstrap_owner' ORDER BY id DESC LIMIT 1").first();
    expect(log).not.toBeNull();
    void AUD;
    void TEAM;
  });

  it('service tokens map to svc:<client id> and need an explicit role', async () => {
    const token = await accessToken({ commonName: 'abc123.access' });
    const denied = await admin('/admin/api/me', { as: null, headers: { 'Cf-Access-Jwt-Assertion': token } });
    expect(denied.status).toBe(403);
    await baseEnv.DB.prepare("INSERT INTO admin_users (email, role, created_by) VALUES ('svc:abc123.access', 'operator', 'test')").run();
    const ok = await admin('/admin/api/me', { as: null, headers: { 'Cf-Access-Jwt-Assertion': token } });
    expect(await ok.json()).toEqual({ identity: 'svc:abc123.access', role: 'operator' });
  });
});

describe('cross-site request protection', () => {
  it('refuses state-changing browser requests that are not same-origin, allows service clients and same-origin', async () => {
    const patch = (headers: Record<string, string>) =>
      admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json({ expectedVersion: 1, name_en: 'Fadyme Veyr' }), headers: { 'Content-Type': 'application/json', ...headers } });
    const cross = await patch({ 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example.com' });
    expect(cross.status).toBe(403);
    expect((await cross.json<{ error: string }>()).error).toBe('cross_site_request');
    expect((await patch({ Origin: 'https://evil.example.com' })).status).toBe(403);
    expect((await patch({ 'Sec-Fetch-Site': 'same-site' })).status).toBe(403);
    expect((await patch({ 'Sec-Fetch-Site': 'same-origin', Origin: 'https://admin.test' })).status).toBe(200);
    // a version bump above means the refused calls changed nothing
    const row = await baseEnv.DB.prepare("SELECT version FROM characters WHERE id = 'fadyme'").first<{ version: number }>();
    expect(row?.version).toBe(2);
  });
});

describe('role based access', () => {
  it('viewers read, operators write, owners manage users', async () => {
    await baseEnv.DB.batch([
      baseEnv.DB.prepare("INSERT INTO admin_users (email, role, created_by) VALUES ('viewer@example.com','viewer','t')"),
      baseEnv.DB.prepare("INSERT INTO admin_users (email, role, created_by) VALUES ('operator@example.com','operator','t')")
    ]);
    expect((await admin('/admin/api/characters', { as: 'viewer@example.com' })).status).toBe(200);
    expect((await admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json({ expectedVersion: 1, name_en: 'X' }), as: 'viewer@example.com' })).status).toBe(403);
    expect((await admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json({ expectedVersion: 1, name_en: 'Fadyme Veyr' }), as: 'operator@example.com' })).status).toBe(200);
    expect((await admin('/admin/api/users', { as: 'operator@example.com' })).status).toBe(403);
    expect((await admin('/admin/api/users', { as: 'owner@example.com' })).status).toBe(200);
    const set = await admin('/admin/api/users', { method: 'PUT', ...json({ email: 'New@Example.com', role: 'viewer' }) });
    expect(await set.json()).toEqual({ email: 'new@example.com', role: 'viewer' });
    const self = await admin('/admin/api/users', { method: 'PUT', ...json({ email: 'owner@example.com', role: 'viewer' }) });
    expect(self.status).toBe(409);
  });
});

describe('character management', () => {
  it('uses optimistic concurrency and writes an audit entry per change', async () => {
    const ok = await admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json({ expectedVersion: 1, base_vit: 12, status: 'active' }) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ base_vit: 12, version: 2, updated_by: 'owner@example.com' });
    const stale = await admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json({ expectedVersion: 1, base_vit: 99 }) });
    expect(stale.status).toBe(409);
    expect((await stale.json<{ error: string }>()).error).toBe('version_conflict');
    expect((await admin('/admin/api/characters/nobody', { method: 'PATCH', ...json({ expectedVersion: 1, base_vit: 5 }) })).status).toBe(404);
    const log = await baseEnv.DB.prepare("SELECT actor, detail FROM audit_log WHERE action = 'character.update' ORDER BY id DESC LIMIT 1").first<{ actor: string; detail: string }>();
    expect(log?.actor).toBe('owner@example.com');
    expect(JSON.parse(log?.detail ?? '{}')).toMatchObject({ fields: { base_vit: 12 } });
  });

  it('validates input strictly (unknown fields, ranges, injection attempts)', async () => {
    for (const body of [{ expectedVersion: 1, rarity: 9 }, { expectedVersion: 1, base_vit: -1 }, { expectedVersion: 1, hacked: true }, { expectedVersion: 1 }, { expectedVersion: 1, status: "active'; DROP TABLE characters;--" }]) {
      expect((await admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json(body) })).status).toBe(400);
    }
    expect((await baseEnv.DB.prepare('SELECT COUNT(*) AS n FROM characters').first<{ n: number }>())?.n).toBe(1);
  });

  it('the public roster only lists active characters', async () => {
    await baseEnv.DB.prepare("UPDATE characters SET status='hidden' WHERE id='fadyme'").run();
    expect(((await (await game('/api/v1/characters')).json()) as { characters: unknown[] }).characters).toHaveLength(0);
    await baseEnv.DB.prepare("UPDATE characters SET status='active' WHERE id='fadyme'").run();
    expect(((await (await game('/api/v1/characters')).json()) as { characters: { id: string }[] }).characters[0]?.id).toBe('fadyme');
  });
});

describe('asset catalog, system status, audit trail', () => {
  it('registers assets with provenance and upserts by path', async () => {
    const body = { path: 'art/atlas_fadyme.webp', sha256: 'a'.repeat(64), bytes: 1234, media_type: 'image/webp', kind: 'atlas_image', source: 'git:25dc0b2:game/assets/characters/fadyme/chibi_poses_v003.png', license: 'project-owned', status: 'candidate' };
    expect((await admin('/admin/api/assets', { method: 'POST', ...json(body) })).status).toBe(201);
    expect((await admin('/admin/api/assets', { method: 'POST', ...json({ ...body, status: 'retired' }) })).status).toBe(201);
    const list = (await (await admin('/admin/api/assets')).json()) as { assets: { path: string; status: string }[] };
    expect(list.assets.filter((a) => a.path === body.path)).toHaveLength(1);
    expect(list.assets.find((a) => a.path === body.path)?.status).toBe('retired');
    expect((await admin('/admin/api/assets', { method: 'POST', ...json({ ...body, path: '../etc/passwd.json' }) })).status).toBe(400);
    expect((await admin('/admin/api/assets', { method: 'POST', ...json({ ...body, path: 'run.js' }) })).status).toBe(400);
  });

  it('reports D1 connectivity, table counts, migrations and R2 reachability', async () => {
    const res = await admin('/admin/api/system');
    expect(res.status).toBe(200);
    const s = (await res.json()) as { d1: { ok: boolean; counts: Record<string, number>; migrations: { name: string }[] }; r2: { ok: boolean }; limits: { d1_rows_read_per_day: number }; auth: { access_configured: boolean } };
    expect(s.d1.ok).toBe(true);
    expect(s.d1.counts.characters).toBe(1);
    expect(s.d1.migrations.map((m) => m.name)).toEqual(['0001_core.sql', '0002_economy_ledger.sql', '0003_player_core.sql', '0004_mail.sql', '0005_progress.sql', '0006_ads.sql', '0007_billing.sql', '0008_flags.sql', '0009_single_currency.sql', '0010_dev_notes.sql', '0011_currency_name.sql', '0012_catalog.sql', '0013_player_progression.sql', '0014_tasks.sql', '0015_teams.sql', '0016_ops.sql', '0017_battle_sessions.sql', '0018_monitoring.sql', '0019_entry_checkpoint.sql', '0020_purchase_entitlements.sql', '0021_rtdn_processing.sql', '0022_billing_reconciliation.sql', '0023_release_economic_authority.sql', '0024_reward_grant_journal.sql', '0025_operation_input_binding.sql', '0026_catalog_identities.sql', '0027_release_obligations.sql', '0028_admin_hardening.sql', '0029_attribute_stats.sql']);
    expect(s.r2.ok).toBe(true);
    expect(s.limits.d1_rows_read_per_day).toBe(5_000_000);
    expect(s.auth.access_configured).toBe(true);
  });

  it('audit log is append-only and listable', async () => {
    await admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json({ expectedVersion: 1, base_str: 4 }) });
    const entries = ((await (await admin('/admin/api/audit?limit=5')).json()) as { entries: { action: string }[] }).entries;
    expect(entries.some((e) => e.action === 'character.update')).toBe(true);
    await expect(baseEnv.DB.prepare('DELETE FROM audit_log').run()).rejects.toThrow(/append-only/);
    await expect(baseEnv.DB.prepare("UPDATE audit_log SET actor = 'x'").run()).rejects.toThrow(/append-only/);
  });

  it('game health reports D1 + R2', async () => {
    const res = await game('/api/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, d1: { ok: true, migrations_applied: 29 }, r2: { ok: true }, environment: 'dev' });
  });

  it('public health never leaks internal error text outside dev', async () => {
    const broken = { prepare: () => { throw new Error('no such table: d1_migrations (secret detail)'); } } as unknown as D1Database;
    const prod = await (await game('/api/v1/health', {}, { DB: broken, ENVIRONMENT: 'staging' })).text();
    expect(prod).not.toContain('secret detail');
    const dev = await (await game('/api/v1/health', {}, { DB: broken, ENVIRONMENT: 'dev' })).text();
    expect(dev).toContain('secret detail');
  });

  it('unknown API paths 404 as JSON with security headers', async () => {
    const res = await game('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

// ---------------------------------------------------------------------------------------------- R13 hardening
const OPERATOR = 'operator@example.com';
const db = baseEnv.DB;
const tag = (): string => crypto.randomUUID().replace(/-/g, '').slice(0, 12);
const send = (method: string, body: unknown, as?: string): RequestInit & { as?: string } => ({ method, ...json(body), ...(as ? { as } : {}) });
const errorOf = async (r: Response): Promise<string> => ((await r.json()) as { error: string }).error;
const count = async (sql: string, ...binds: unknown[]): Promise<number> => (await db.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const token = (amount: number) => ({ type: 'currency', currency: 'eclipse_token', amount });
const staff = async (): Promise<void> => {
  await db.prepare("INSERT OR IGNORE INTO admin_users (email, role, created_by) VALUES (?1, 'operator', 'test')").bind(OPERATOR).run();
};
/** Temporarily makes every UPDATE on `table` match nothing, i.e. a concurrent change between validation and write. */
async function withLostRace(table: string, run: () => Promise<void>): Promise<void> {
  await db.prepare(`CREATE TRIGGER r13_lost_race BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(IGNORE); END`).run();
  try {
    await run();
  } finally {
    await db.prepare('DROP TRIGGER r13_lost_race').run();
  }
}

describe('R13 compensation mail: summed owner threshold, atomic grant + audit, request replay', () => {
  beforeEach(staff);
  const mails = (playerId: string) => count('SELECT COUNT(*) AS n FROM mail WHERE player_id = ?1', playerId);
  const audits = (playerId: string) => count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'player.mail' AND target = ?1", playerId);

  it('two 4,000-token attachments (8,000 total) need an owner; the refusal writes nothing', async () => {
    const { playerId } = await signIn(`sub-split-${tag()}`);
    const url = `/admin/api/players/${playerId}/mail`;
    const split = { kind: 'compensation', title: 'Split', attachments: [token(4000), token(4000)] };
    const refused = await admin(url, send('POST', { mail: split, reason: 'split bypass attempt' }, OPERATOR));
    expect(refused.status).toBe(403);
    expect(await errorOf(refused)).toBe('insufficient_role');
    expect(await mails(playerId)).toBe(0);
    expect(await audits(playerId)).toBe(0);
    // exactly the threshold in total stays operator-level; non-currency attachments do not count toward it
    const atLimit = { ...split, attachments: [token(2500), token(2500), { type: 'account_xp', amount: 90_000 }] };
    expect((await admin(url, send('POST', { mail: atLimit, reason: 'at the limit' }, OPERATOR))).status).toBe(201);
    expect((await admin(url, send('POST', { mail: { ...split, attachments: [token(2500), token(2501)] }, reason: 'one over' }, OPERATOR))).status).toBe(403);
    expect((await admin(url, send('POST', { mail: split, reason: 'owner approved split' }))).status).toBe(201);
    expect(await mails(playerId)).toBe(2);
    expect(await audits(playerId)).toBe(2);
  });

  it('commits mail, audit and replay record together; a retried requestId returns the original mail', async () => {
    const { playerId } = await signIn(`sub-replay-${tag()}`);
    const url = `/admin/api/players/${playerId}/mail`;
    const requestId = `mail_${tag()}`;
    const payload = { mail: { kind: 'compensation', title: 'Outage', attachments: [token(300)] }, reason: 'outage 2026-10-14', requestId };
    const first = await admin(url, send('POST', payload, OPERATOR));
    expect(first.status).toBe(201);
    const sent = (await first.json()) as { id: number; created: boolean };
    expect(sent).toEqual({ id: expect.any(Number), created: true });
    const again = await admin(url, send('POST', payload, OPERATOR));
    expect(again.status).toBe(201);
    expect(await again.json()).toEqual({ id: sent.id, created: true, replayed: true });
    expect(await mails(playerId)).toBe(1);
    const rows = (await db.prepare("SELECT detail FROM audit_log WHERE action = 'player.mail' AND target = ?1").bind(playerId).all<{ detail: string }>()).results;
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]?.detail ?? '{}')).toMatchObject({ mailId: sent.id, premiumTotal: 300, requestId, reason: 'outage 2026-10-14' });
    expect(await db.prepare('SELECT actor, action, target, status FROM admin_requests WHERE request_id = ?1').bind(requestId).first()).toEqual({ actor: OPERATOR, action: 'player.mail', target: playerId, status: 201 });
    const reused = await admin(url, send('POST', { ...payload, reason: 'something else' }, OPERATOR));
    expect([reused.status, await errorOf(reused)]).toEqual([409, 'request_id_reused']);
    // another admin cannot replay (or hijack) someone else's request id
    expect((await admin(url, send('POST', payload))).status).toBe(409);
    expect(await mails(playerId)).toBe(1);
  });

  it('rolls the whole batch back when the grant cannot be written; source-key no-ops are not reported as new grants', async () => {
    const { playerId } = await signIn(`sub-rollback-${tag()}`);
    const url = `/admin/api/players/${playerId}/mail`;
    await db.prepare("UPDATE players SET status = 'deleted' WHERE id = ?1").bind(playerId).run();
    const requestId = `gone_${tag()}`;
    const gone = await admin(url, send('POST', { mail: { kind: 'compensation', title: 'Gone', attachments: [token(100)] }, reason: 'deleted player', requestId }, OPERATOR));
    expect(gone.status).toBe(404);
    expect(await mails(playerId)).toBe(0);
    expect(await audits(playerId)).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM admin_requests WHERE request_id = ?1', requestId)).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM tx_guard')).toBe(0);

    await db.prepare("UPDATE players SET status = 'active' WHERE id = ?1").bind(playerId).run();
    const keyed = { mail: { kind: 'compensation', title: 'Keyed', attachments: [token(50)], sourceKey: `incident:${tag()}` }, reason: 'incident payout' };
    const made = await admin(url, send('POST', keyed, OPERATOR));
    expect(made.status).toBe(201);
    const { id } = (await made.json()) as { id: number };
    const dup = await admin(url, send('POST', keyed, OPERATOR));
    expect(dup.status).toBe(200);
    expect(await dup.json()).toEqual({ id, created: false });
    expect(await mails(playerId)).toBe(1);
    expect(await audits(playerId)).toBe(1);
  });
});

describe('R13 product writes: truthful CAS, immutable kind, atomic audit and replay', () => {
  const put = (id: string, body: unknown) => admin(`/admin/api/products/${id}`, send('PUT', body));
  const pouch = { kind: 'consumable', title_en: 'Pouch', grants: [token(480)], active: true };
  const subConfig = { duration_days: 30, instant: [token(100)], periodic: { every_hours: 12, count: 2, mail_title: 'Half-day', attachments: [token(10)], claim_days: 14 } };
  const audits = (id: string) => count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'product.set' AND target = ?1", id);

  it('creates at version 1, updates only from the loaded version and never audits a refused or no-op write', async () => {
    const id = `r13_pouch_${tag()}`;
    const created = await put(id, pouch);
    expect(created.status).toBe(200);
    expect(await created.json()).toEqual({ product_id: id, version: 1 });
    const dup = await put(id, pouch);
    expect([dup.status, await errorOf(dup)]).toEqual([409, 'exists']);
    const updated = await put(id, { ...pouch, title_en: 'Big Pouch', expectedVersion: 1 });
    expect(await updated.json()).toEqual({ product_id: id, version: 2 });
    const stale = await put(id, { ...pouch, title_en: 'Stale', expectedVersion: 1 });
    expect([stale.status, await errorOf(stale)]).toEqual([409, 'version_conflict']);
    const same = await put(id, { ...pouch, title_en: 'Big Pouch', expectedVersion: 2 });
    expect([same.status, await errorOf(same)]).toEqual([409, 'no_change']);
    const missing = await put(`r13_none_${tag()}`, { ...pouch, expectedVersion: 3 });
    expect([missing.status, await errorOf(missing)]).toEqual([404, 'no_such_product']);
    expect((await put(id, { ...pouch, sub_config: subConfig, expectedVersion: 2 })).status).toBe(400); // a consumable cannot carry sub_config
    expect((await put(id, { ...pouch, kind: 'bundle', expectedVersion: 2 })).status).toBe(400);
    const subscription = `r13_sub_${tag()}`;
    expect((await put(subscription, { kind: 'subscription', title_en: 'Sub', sub_config: subConfig, active: false })).status).toBe(200);
    const flip = await put(subscription, { ...pouch, expectedVersion: 1 });
    expect([flip.status, await errorOf(flip)]).toEqual([409, 'kind_immutable']);
    expect(await db.prepare('SELECT kind, title_en, version FROM shop_products WHERE product_id = ?1').bind(id).first()).toEqual({ kind: 'consumable', title_en: 'Big Pouch', version: 2 });
    expect(await audits(id)).toBe(2);
    expect(await audits(subscription)).toBe(1);
    const products = ((await (await admin('/admin/api/products')).json()) as { products: { product_id: string; version: number }[] }).products;
    expect(products.find((p) => p.product_id === id)?.version).toBe(2);
  });

  it('replays a product write by requestId without re-applying it; refused writes leave no replay record', async () => {
    const id = `r13_replay_${tag()}`;
    const requestId = `prod_${tag()}`;
    expect(await (await put(id, { ...pouch, requestId })).json()).toEqual({ product_id: id, version: 1 });
    const again = await put(id, { ...pouch, requestId });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ product_id: id, version: 1, replayed: true });
    expect(await audits(id)).toBe(1);
    const reused = await put(id, { ...pouch, title_en: 'Other', requestId });
    expect([reused.status, await errorOf(reused)]).toEqual([409, 'request_id_reused']);
    const refusedId = `prod_${tag()}`;
    expect((await put(id, { ...pouch, title_en: 'Nope', expectedVersion: 9, requestId: refusedId })).status).toBe(409);
    expect(await count('SELECT COUNT(*) AS n FROM admin_requests WHERE request_id = ?1', refusedId)).toBe(0);
    // a write that loses a race after validation rolls back its audit and replay rows together
    const racedId = `prod_${tag()}`;
    await withLostRace('shop_products', async () => {
      const raced = await put(id, { ...pouch, title_en: 'Raced', expectedVersion: 1, requestId: racedId });
      expect(raced.status).toBe(409);
    });
    expect(await count('SELECT COUNT(*) AS n FROM admin_requests WHERE request_id = ?1', racedId)).toBe(0);
    expect(await audits(id)).toBe(1);
    expect(await count('SELECT COUNT(*) AS n FROM tx_guard')).toBe(0);
  });
});

describe('R13 banner state: CAS, explicit no-change, atomic audit and replay', () => {
  beforeEach(async () => {
    await staff();
    for (const [id, rarity] of [['r13_five_a', 5], ['r13_five_b', 5], ['r13_four_a', 4], ['r13_four_b', 4], ['r13_three_a', 3], ['r13_three_b', 3]] as const) {
      await db.prepare("INSERT OR IGNORE INTO characters (id, name_en, rarity, element, role, age, acquisition, base_vit, base_str, base_int, base_agi) VALUES (?1,?1,?2,'Stone','tank',20,'gacha',10,2,2,4)").bind(id, rarity).run();
    }
  });
  const newBanner = async (): Promise<string> => {
    const id = `r13_banner_${tag()}`;
    const cfg = limitedCharacterBanner(id, 'r13_five_a', { four: ['r13_four_a', 'r13_four_b'], three: ['r13_three_a', 'r13_three_b'], fiveStandard: ['r13_five_b'] });
    await db.prepare("INSERT INTO banners (id, title_en, config_json, status, updated_by) VALUES (?1, 'R13', ?2, 'draft', 'test')").bind(id, JSON.stringify(cfg)).run();
    return id;
  };
  const state = (id: string, body: unknown) => admin(`/admin/api/banners/${id}/state`, send('POST', body, OPERATOR));
  const audits = (id: string, action: string) => count('SELECT COUNT(*) AS n FROM audit_log WHERE action = ?1 AND target = ?2', action, id);
  const window = { startsAt: '2020-01-01T00:00:00.000Z', endsAt: '2999-01-01T00:00:00.000Z' };

  it('activates and retires from the loaded version, replays by requestId and refuses no-op transitions', async () => {
    const id = await newBanner();
    const stale = await state(id, { action: 'activate', ...window, expectedVersion: 5 });
    expect([stale.status, await errorOf(stale)]).toEqual([409, 'version_conflict']);
    expect(await db.prepare('SELECT status, version FROM banners WHERE id = ?1').bind(id).first()).toEqual({ status: 'draft', version: 1 });
    const requestId = `ban_${tag()}`;
    const on = await state(id, { action: 'activate', ...window, expectedVersion: 1, requestId });
    expect(await on.json()).toEqual({ id, status: 'active', version: 2 });
    const replay = await state(id, { action: 'activate', ...window, expectedVersion: 1, requestId });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ id, status: 'active', version: 2, replayed: true });
    const again = await state(id, { action: 'activate', ...window });
    expect([again.status, await errorOf(again)]).toEqual([409, 'no_change']);
    const moved = await state(id, { action: 'activate', startsAt: window.startsAt, endsAt: '2998-01-01T00:00:00.000Z', expectedVersion: 2 });
    expect(await moved.json()).toEqual({ id, status: 'active', version: 3 });
    const off = await state(id, { action: 'retire' });
    expect(await off.json()).toEqual({ id, status: 'retired', version: 4 });
    const twice = await state(id, { action: 'retire' });
    expect([twice.status, await errorOf(twice)]).toEqual([409, 'no_change']);
    expect(await audits(id, 'banner.activate')).toBe(2);
    expect(await audits(id, 'banner.retire')).toBe(1);
    expect(await count('SELECT COUNT(*) AS n FROM admin_requests WHERE target = ?1', id)).toBe(1);
  });

  it('rolls back the audit and replay row when the banner changes between validation and write', async () => {
    const id = await newBanner();
    const requestId = `race_${tag()}`;
    await withLostRace('banners', async () => {
      const raced = await state(id, { action: 'activate', ...window, requestId });
      expect([raced.status, await errorOf(raced)]).toEqual([409, 'version_conflict']);
    });
    expect(await audits(id, 'banner.activate')).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM admin_requests WHERE request_id = ?1', requestId)).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM tx_guard')).toBe(0);
    // the same request id is free to succeed once the race is gone
    expect(await (await state(id, { action: 'activate', ...window, requestId })).json()).toEqual({ id, status: 'active', version: 2 });
  });
});

describe('R13 bounded cursor pagination for admin collections', () => {
  type Row = Record<string, unknown>;
  /** Follows nextCursor to the end, asserting every page is bounded and only the last page is short. */
  async function walk(path: string, key: string, limit: number): Promise<Row[]> {
    const rows: Row[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 100; i++) {
      const res = await admin(`${path}${path.includes('?') ? '&' : '?'}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      expect(res.status, await res.clone().text()).toBe(200);
      const page = (await res.json()) as Record<string, unknown>;
      const items = page[key] as Row[];
      expect(items.length).toBeLessThanOrEqual(limit);
      rows.push(...items);
      cursor = page.nextCursor as string | null;
      if (!cursor) return rows;
      expect(items).toHaveLength(limit);
    }
    throw new Error('pagination did not terminate');
  }
  const ids = (rows: Row[], k = 'id'): unknown[] => rows.map((r) => r[k]);

  it('every collection clamps limit to 1..100, rejects malformed cursors and filters, and keeps its envelope', async () => {
    for (const [path, key] of [['/admin/api/characters', 'characters'], ['/admin/api/assets', 'assets'], ['/admin/api/releases', 'releases'], ['/admin/api/players', 'players'], ['/admin/api/audit', 'entries'], ['/admin/api/purchases', 'purchases']] as const) {
      const low = (await (await admin(`${path}?limit=0`)).json()) as Record<string, unknown[]>;
      expect(low[key]?.length ?? -1, path).toBeLessThanOrEqual(1);
      expect(low, path).toHaveProperty('nextCursor');
      const high = (await (await admin(`${path}?limit=100000`)).json()) as Record<string, unknown[]>;
      expect(high[key]?.length ?? -1, path).toBeLessThanOrEqual(100);
      const bad = await admin(`${path}?cursor=not-a-cursor`);
      expect([bad.status, await errorOf(bad)], path).toEqual([400, 'bad_cursor']);
    }
    for (const path of ['/admin/api/characters?rarity=9', '/admin/api/assets?status=gone', '/admin/api/releases?channel=moon', '/admin/api/players?status=x', '/admin/api/purchases?player=nobody']) {
      const res = await admin(path);
      expect([res.status, await errorOf(res)], path).toEqual([400, 'bad_filter']);
    }
  });

  it('characters: rarity/name/id order with deterministic ties, filters, cursor traversal and detail', async () => {
    const rows: [string, string, number, string][] = [['ch_b', 'Bryn', 5, 'active'], ['ch_a', 'Bryn', 5, 'hidden'], ['ch_c', 'Ash', 4, 'active'], ['ch_d', 'Cole', 4, 'active'], ['ch_e', 'Ash', 3, 'retired'], ['ch_f', 'Zed', 5, 'active'], ['ch_g', 'Dawn', 1, 'active']];
    for (const [id, name, rarity, status] of rows) {
      await db.prepare("INSERT INTO characters (id, name_en, rarity, element, role, age, acquisition, base_vit, base_str, base_int, base_agi, status) VALUES (?1,?2,?3,'Stone','tank',20,'gacha',10,2,2,4,?4)").bind(id, name, rarity, status).run();
    }
    expect(ids(await walk('/admin/api/characters', 'characters', 3))).toEqual(['ch_a', 'ch_b', 'fadyme', 'ch_f', 'ch_c', 'ch_d', 'ch_e', 'ch_g']);
    expect(ids(await walk('/admin/api/characters?rarity=4', 'characters', 1))).toEqual(['ch_c', 'ch_d']);
    expect(ids(await walk('/admin/api/characters?status=hidden', 'characters', 5))).toEqual(['ch_a']);
    expect(ids(await walk('/admin/api/characters?q=bry', 'characters', 1))).toEqual(['ch_a', 'ch_b']);
    expect((await (await admin('/admin/api/characters')).json()) as { nextCursor: unknown }).toMatchObject({ nextCursor: null });
    expect(await (await admin('/admin/api/characters/ch_c')).json()).toMatchObject({ character: { id: 'ch_c', name_en: 'Ash' } });
    expect((await admin('/admin/api/characters/nobody')).status).toBe(404);
  });

  it('assets: kind/path order, filters, cursor traversal and detail with stored-object evidence', async () => {
    const kind = `r13kind${tag()}`;
    const paths = ['e.webp', 'a.webp', 'c.webp', 'b.webp', 'd.webp'].map((p) => `r13/${kind}/${p}`);
    for (const [i, path] of paths.entries()) {
      await db.prepare("INSERT INTO assets (path, sha256, bytes, media_type, kind, source, status, created_by) VALUES (?1, ?2, 10, 'image/webp', ?3, 'test', ?4, 'test')").bind(path, String(i).repeat(64), kind, i === 0 ? 'approved' : 'candidate').run();
    }
    const all = await walk(`/admin/api/assets?kind=${kind}`, 'assets', 2);
    expect(ids(all, 'path')).toEqual([...paths].sort());
    expect(ids(await walk(`/admin/api/assets?kind=${kind}&status=approved`, 'assets', 2), 'path')).toEqual([paths[0]]);
    expect(ids(await walk(`/admin/api/assets?q=${kind}/c`, 'assets', 2), 'path')).toEqual([paths[2]]);
    const detail = (await (await admin(`/admin/api/assets/${String(all[0]?.id)}`)).json()) as { asset: { path: string; object_stored: number } };
    expect(detail.asset).toMatchObject({ path: all[0]?.path, object_stored: 0 });
    expect((await admin('/admin/api/assets/999999999')).status).toBe(404);
  });

  it('releases: channel then newest generation, filters and cursor traversal', async () => {
    const prefix = `r13_rel_${tag()}`;
    const base = 1_000_000 + Math.floor(Math.random() * 1_000_000) * 10;
    const made: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = `${prefix}_${i}`;
      made.push(id);
      await db.prepare("INSERT INTO content_releases (id, generation, channel, state, manifest_json, created_by) VALUES (?1, ?2, 'production', 'retired', '{}', 'test')").bind(id, base + i).run();
    }
    const filtered = await walk('/admin/api/releases?channel=production&state=retired', 'releases', 2);
    expect(ids(filtered).filter((id) => String(id).startsWith(prefix))).toEqual([...made].reverse());
    expect(new Set(ids(filtered)).size).toBe(filtered.length);
    const everything = await walk('/admin/api/releases', 'releases', 3);
    expect(new Set(ids(everything)).size).toBe(everything.length);
    const channels = everything.map((r) => String(r.channel));
    expect(channels).toEqual([...channels].sort());
    expect(ids(everything)).toEqual(expect.arrayContaining(made));
  });

  it('players: newest first with id tie-break, search/status filters and cursor traversal', async () => {
    const name = `r13pager_${tag()}`;
    const hex = (): string => crypto.randomUUID().replace(/-/g, '');
    const made: { id: string; at: string }[] = [];
    for (const at of ['2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z', '2026-09-30T00:00:00.000Z']) {
      const id = `p_${hex()}`;
      made.push({ id, at });
      await db.prepare('INSERT INTO players (id, created_at, display_name) VALUES (?1, ?2, ?3)').bind(id, at, `${name}_${made.length}`).run();
    }
    const expected = [...made].sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1)).map((p) => p.id);
    expect(ids(await walk(`/admin/api/players?q=${name}`, 'players', 2))).toEqual(expected);
    await db.prepare("UPDATE players SET status = 'banned' WHERE id = ?1").bind(made[1]?.id).run();
    expect(ids(await walk(`/admin/api/players?q=${name}&status=banned`, 'players', 2))).toEqual([made[1]?.id]);
  });

  it('audit: newest first, actor/action/target filters, cursor traversal and detail', async () => {
    const actor = `r13-audit-${tag()}@example.com`;
    for (let i = 0; i < 7; i++) {
      await db.prepare('INSERT INTO audit_log (actor, action, target, detail) VALUES (?1, ?2, ?3, ?4)').bind(actor, i % 2 ? 'r13.odd' : 'r13.even', `t${i % 3}`, JSON.stringify({ i })).run();
    }
    const all = await walk(`/admin/api/audit?actor=${encodeURIComponent(actor)}`, 'entries', 3);
    expect(all.map((e) => JSON.parse(String(e.detail)).i)).toEqual([6, 5, 4, 3, 2, 1, 0]);
    expect(await walk(`/admin/api/audit?actor=${encodeURIComponent(actor)}&action=r13.odd`, 'entries', 2)).toHaveLength(3);
    expect(await walk(`/admin/api/audit?actor=${encodeURIComponent(actor)}&target=t0`, 'entries', 2)).toHaveLength(3);
    expect(await (await admin(`/admin/api/audit/${String(all[0]?.id)}`)).json()).toMatchObject({ entry: { id: all[0]?.id, actor } });
    expect((await admin('/admin/api/audit/999999999')).status).toBe(404);
  });

  it('purchases: newest first with order-id tie-break, filters, cursor traversal and detail', async () => {
    const { playerId } = await signIn(`sub-purchases-${tag()}`);
    const t = tag();
    const made: { order: string; at: string; state: string }[] = [];
    for (const [i, at] of ['2026-10-01T00:00:00.000Z', '2026-10-03T00:00:00.000Z', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z', '2026-10-01T00:00:00.000Z'].entries()) {
      const order = `GPA.r13-${t}-${i}`;
      const state = i === 3 ? 'refunded' : 'granted';
      made.push({ order, at, state });
      await db.prepare("INSERT INTO purchases (order_id, player_id, product_id, kind, token_hash, state, period_start, granted_at) VALUES (?1, ?2, 'eclipse_blessing_30d', 'subscription', ?3, ?4, ?5, ?5)").bind(order, playerId, `h${t}${i}`, state, at).run();
    }
    const expected = [...made].sort((a, b) => (a.at === b.at ? (a.order < b.order ? 1 : -1) : a.at < b.at ? 1 : -1)).map((p) => p.order);
    expect(ids(await walk(`/admin/api/purchases?player=${playerId}`, 'purchases', 2), 'order_id')).toEqual(expected);
    expect(ids(await walk(`/admin/api/purchases?player=${playerId}&state=refunded`, 'purchases', 2), 'order_id')).toEqual([made[3]?.order]);
    const first = (await (await admin(`/admin/api/purchases?player=${playerId}&limit=1`)).json()) as { purchases: unknown[]; nextCursor: string | null; refundsWithUnrecovered: number };
    expect(first.purchases).toHaveLength(1);
    expect(typeof first.nextCursor).toBe('string');
    expect(typeof first.refundsWithUnrecovered).toBe('number');
    expect(await (await admin(`/admin/api/purchases/${made[0]?.order}`)).json()).toMatchObject({ purchase: { order_id: made[0]?.order, player_id: playerId, entitlement_state: 'active' } });
    expect((await admin('/admin/api/purchases/GPA.none')).status).toBe(404);
  });

  it('verifies Access MFA policy when ACCESS_REQUIRE_MFA=1, enforces R2 provenance for approved assets, and exposes release diff and sensitive approvals', async () => {
    await staff();
    const mfaEnv = adminEnv({ ACCESS_REQUIRE_MFA: '1' });
    const noMfa = await admin('/admin/api/me', { as: null, env: mfaEnv, headers: { 'Cf-Access-Jwt-Assertion': await accessToken({ email: 'owner@example.com' }) } });
    expect([noMfa.status, await errorOf(noMfa)]).toEqual([403, 'mfa_required']);
    const withMfa = await admin('/admin/api/me', { as: null, env: mfaEnv, headers: { 'Cf-Access-Jwt-Assertion': await accessToken({ email: 'owner@example.com' }, { amr: ['pwd', 'totp'] }) } });
    expect(withMfa.status).toBe(200);
    expect(await withMfa.json()).toEqual({ identity: 'owner@example.com', role: 'owner', mfaVerified: true });

    // Nobody (not even the owner) can mark an asset approved without the R2-verifying /approve route
    const assetPath = `art/r13_prov_${tag()}.webp`;
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const opApproveAttempt = await admin('/admin/api/assets', send('POST', { path: assetPath, sha256, bytes: bytes.byteLength, media_type: 'image/webp', kind: 'portrait', source: 'model:imagen-3:prompt-hash', license: 'project-owned', status: 'approved' }, OPERATOR));
    expect([opApproveAttempt.status, await errorOf(opApproveAttempt)]).toEqual([409, 'approve_via_r2']);
    const ownerApproveAttempt = await admin('/admin/api/assets', send('POST', { path: assetPath, sha256, bytes: bytes.byteLength, media_type: 'image/webp', kind: 'portrait', source: 'model:imagen-3:prompt-hash', license: 'project-owned', status: 'approved' }));
    expect([ownerApproveAttempt.status, await errorOf(ownerApproveAttempt)]).toEqual([409, 'approve_via_r2']);

    // Operator registers candidate; owner cannot approve until R2 object is uploaded
    const cand = await admin('/admin/api/assets', send('POST', { path: assetPath, sha256, bytes: bytes.byteLength, media_type: 'image/webp', kind: 'portrait', source: 'model:imagen-3:prompt-hash', license: 'project-owned', status: 'candidate' }, OPERATOR));
    expect(cand.status).toBe(201);
    const assetList = (await (await admin(`/admin/api/assets?q=${encodeURIComponent(assetPath)}`)).json()) as { assets: { id: number }[] };
    const assetId = assetList.assets[0]!.id;
    const patchApprove = await admin(`/admin/api/assets/${assetId}`, send('PATCH', { status: 'approved' }));
    expect([patchApprove.status, await errorOf(patchApprove)]).toEqual([409, 'approve_via_r2']);
    const relabel = await admin(`/admin/api/assets/${assetId}`, send('PATCH', { license: 'project-owned-v2' }));
    expect(relabel.status).toBe(200);
    // metadata edits keep the original author (provenance), the editor is recorded in the audit log
    expect(((await relabel.json()) as { asset: { created_by: string; license: string } }).asset).toMatchObject({ license: 'project-owned-v2', created_by: expect.stringContaining('operator') });
    const beforeUpload = await admin(`/admin/api/assets/${assetId}/approve`, send('POST', {}));
    expect([beforeUpload.status, await errorOf(beforeUpload)]).toEqual([409, 'object_not_stored']);

    // Upload the actual object to R2, then owner approves
    const putObj = await admin(`/admin/api/objects/${sha256}`, { method: 'PUT', body: bytes, headers: { 'Content-Type': 'image/webp' } });
    expect([200, 201]).toContain(putObj.status);
    const served = await admin(`/admin/api/objects/${sha256}`);
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');
    expect(served.headers.get('content-security-policy')).toContain('sandbox');
    const approved = await admin(`/admin/api/assets/${assetId}/approve`, send('POST', {}));
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ id: assetId, path: assetPath, status: 'approved', verifiedSha256: sha256 });

    // Sensitive approvals endpoint lists the owner approval with singleOwnerModel: true
    const approvals = (await (await admin('/admin/api/approvals?limit=10')).json()) as { approvals: { action: string; target: string; actor_role: string }[]; singleOwnerModel: boolean };
    expect(approvals.singleOwnerModel).toBe(true);
    expect(approvals.approvals.some((a) => a.action === 'asset.approve' && a.target === assetPath && a.actor_role === 'owner')).toBe(true);
  });
});
