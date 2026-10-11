import { beforeEach, describe, expect, it } from 'vitest';
import { accessToken, admin, adminEnv, AUD, baseEnv, game, TEAM } from './helpers';

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  await baseEnv.DB.batch([
    baseEnv.DB.prepare("DELETE FROM admin_users WHERE email <> 'x'"),
    baseEnv.DB.prepare("DELETE FROM characters"),
    baseEnv.DB.prepare("INSERT INTO characters (id, name_en, rarity, element, role, age, acquisition, base_hp, base_atk, base_def, base_spd) VALUES ('fadyme','Fadyme',5,'Veil','support_dps',22,'free_start',11,3,1,5)")
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
    const ok = await admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json({ expectedVersion: 1, base_hp: 12, status: 'active' }) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ base_hp: 12, version: 2, updated_by: 'owner@example.com' });
    const stale = await admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json({ expectedVersion: 1, base_hp: 99 }) });
    expect(stale.status).toBe(409);
    expect((await stale.json<{ error: string }>()).error).toBe('version_conflict');
    expect((await admin('/admin/api/characters/nobody', { method: 'PATCH', ...json({ expectedVersion: 1, base_hp: 5 }) })).status).toBe(404);
    const log = await baseEnv.DB.prepare("SELECT actor, detail FROM audit_log WHERE action = 'character.update' ORDER BY id DESC LIMIT 1").first<{ actor: string; detail: string }>();
    expect(log?.actor).toBe('owner@example.com');
    expect(JSON.parse(log?.detail ?? '{}')).toMatchObject({ fields: { base_hp: 12 } });
  });

  it('validates input strictly (unknown fields, ranges, injection attempts)', async () => {
    for (const body of [{ expectedVersion: 1, rarity: 9 }, { expectedVersion: 1, base_hp: -1 }, { expectedVersion: 1, hacked: true }, { expectedVersion: 1 }, { expectedVersion: 1, status: "active'; DROP TABLE characters;--" }]) {
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
    const body = { path: 'art/atlas_fadyme.webp', sha256: 'a'.repeat(64), bytes: 1234, media_type: 'image/webp', kind: 'atlas_image', source: 'git:25dc0b2:game/assets/characters/fadyme/chibi_poses_v003.png', license: 'project-owned', status: 'approved' };
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
    expect(s.d1.migrations.map((m) => m.name)).toEqual(['0001_core.sql', '0002_economy_ledger.sql', '0003_player_core.sql', '0004_mail.sql', '0005_progress.sql']);
    expect(s.r2.ok).toBe(true);
    expect(s.limits.d1_rows_read_per_day).toBe(5_000_000);
    expect(s.auth.access_configured).toBe(true);
  });

  it('audit log is append-only and listable', async () => {
    await admin('/admin/api/characters/fadyme', { method: 'PATCH', ...json({ expectedVersion: 1, base_atk: 4 }) });
    const entries = ((await (await admin('/admin/api/audit?limit=5')).json()) as { entries: { action: string }[] }).entries;
    expect(entries.some((e) => e.action === 'character.update')).toBe(true);
    await expect(baseEnv.DB.prepare('DELETE FROM audit_log').run()).rejects.toThrow(/append-only/);
    await expect(baseEnv.DB.prepare("UPDATE audit_log SET actor = 'x'").run()).rejects.toThrow(/append-only/);
  });

  it('game health reports D1 + R2', async () => {
    const res = await game('/api/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, d1: { ok: true, migrations_applied: 5 }, r2: { ok: true }, environment: 'dev' });
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
