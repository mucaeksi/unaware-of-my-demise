import { requireGameRuntime } from './content/runtime-ready';
import { registerMonitoring } from './admin/monitoring';
import { requestMonitoring } from './monitoring';
import { Hono, type MiddlewareHandler } from 'hono';
import type { JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { Channel, MEDIA_TYPE_BY_EXTENSION, MIN_SNAPSHOT_CLIENT_VERSION, SafeAssetPath, Semver } from '@uomd/content-schema';
import { atLeast, authenticate, AuthError, type AdminIdentity, type Role } from './auth/access';
import { ContentStore, HttpError, loadSigner, MAX_OBJECT_BYTES } from './content/store';
import { audit, auditIfChanged, auditStatement } from './db/audit';
import { onError, securityHeaders } from './http';
import type { AdminEnv } from './env';
import { registerOps } from './admin/ops';
import { registerBillingOps } from './admin/billing';
import { setEconomicPolicy } from './content/authority';

type Ctx = { Bindings: AdminEnv; Variables: { admin: AdminIdentity } };

const Sha = z.string().regex(/^[0-9a-f]{64}$/);
const ReleaseId = z.string().regex(/^[a-z][a-z0-9_]{1,47}$/);
const CharacterPatch = z
  .object({
    expectedVersion: z.number().int().min(1),
    name_en: z.string().min(1).max(60).optional(),
    status: z.enum(['active', 'hidden', 'retired']).optional(),
    rarity: z.number().int().min(1).max(5).optional(),
    base_hp: z.number().positive().max(100000).optional(),
    base_atk: z.number().min(0).max(100000).optional(),
    base_def: z.number().min(0).max(100000).optional(),
    base_spd: z.number().positive().max(1000).optional()
  })
  .strict();
const AssetBody = z
  .object({
    path: SafeAssetPath,
    sha256: Sha,
    bytes: z.number().int().min(1).max(MAX_OBJECT_BYTES),
    media_type: z.enum(Object.values(MEDIA_TYPE_BY_EXTENSION) as [string, ...string[]]),
    kind: z.string().min(2).max(40),
    source: z.string().min(3).max(300),
    license: z.string().min(2).max(100).default('project-owned'),
    status: z.enum(['candidate', 'approved', 'retired']).default('candidate')
  })
  .strict();
const DraftBody = z
  .object({
    id: ReleaseId,
    channel: Channel,
    notes: z.string().max(400).default(''),
    minClient: Semver.default(MIN_SNAPSHOT_CLIENT_VERSION),
    maxClient: Semver.optional(),
    contentSchema: z.number().int().min(1).optional(),
    dependsOn: ReleaseId.optional(),
    rolloutPercent: z.number().int().min(0).max(100).optional(),
    files: z.array(z.object({ path: SafeAssetPath, sha256: Sha }).strict()).min(1).max(512)
  })
  .strict();
const UserBody = z.object({ email: z.string().email().max(120), role: z.enum(['owner', 'operator', 'viewer']) }).strict();

async function json<T>(c: { req: { text(): Promise<string> } }, schema: z.ZodType<T>, max = 256 * 1024): Promise<T> {
  const raw = await c.req.text();
  if (raw.length > max) throw new HttpError(413, 'too_large', 'request body too large');
  try {
    return schema.parse(JSON.parse(raw));
  } catch (e) {
    throw new HttpError(400, 'bad_request', e instanceof z.ZodError ? e.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : 'invalid JSON');
  }
}

export interface AdminDeps {
  /** test seam: supply JWT verification keys instead of fetching Access' JWKS */
  getKey?: (teamDomain: string) => JWTVerifyGetKey;
}

export function createAdminApp(deps: AdminDeps = {}): Hono<Ctx> {
  const app = new Hono<Ctx>();
  app.use('*', securityHeaders);
  app.use('*', requestMonitoring('admin'));
  app.onError((e, c) => {
    if (e instanceof AuthError) return c.json({ error: e.code, message: e.message }, e.status);
    return onError(e, c);
  });
  // The Access cookie travels with any request a browser makes to this origin, so state-changing requests must be
  // same-origin. Non-browser clients (CI with an Access service token) send neither header and are unaffected.
  app.use('/admin/api/*', async (c, next) => {
    const method = c.req.method;
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const site = c.req.header('Sec-Fetch-Site');
      const origin = c.req.header('Origin');
      if ((site && site !== 'same-origin' && site !== 'none') || (origin && origin !== new URL(c.req.url).origin)) {
        throw new AuthError(403, 'cross_site_request', 'state-changing requests must be same-origin');
      }
    }
    await next();
  });

  const need = (min: Role): MiddlewareHandler<Ctx> => async (c, next) => {
    const who = await authenticate(c.req.raw, c.env, deps.getKey);
    if (!atLeast(who.role, min)) throw new AuthError(403, 'insufficient_role', `requires ${min}`);
    c.set('admin', who);
    await next();
  };
  const store = (env: AdminEnv): ContentStore => new ContentStore(env.DB, env.CONTENT);
  registerBillingOps(app, need);

  // public, reveals nothing sensitive: lets the SPA show "auth not configured" without a login
  app.get('/admin/api/health', (c) => c.json({ ok: true, service: 'uomd-admin', version: c.env.CF_VERSION_METADATA ?? null, environment: c.env.ENVIRONMENT, auth_configured: Boolean(c.env.ACCESS_TEAM_DOMAIN && c.env.ACCESS_AUD), signing_configured: Boolean(c.env.CONTENT_SIGNING_KEY && c.env.CONTENT_SIGNING_KID) }));

  app.get('/admin/api/me', need('viewer'), (c) => c.json(c.get('admin')));

  // ------------------------------------------------------------------ system status
  app.get('/admin/api/system', need('viewer'), async (c) => {
    const db = c.env.DB;
    const t0 = Date.now();
    const probe = await db.prepare('SELECT 1').run();
    const latency = Date.now() - t0;
    const counts: Record<string, number> = {};
    for (const t of ['characters', 'assets', 'content_objects', 'content_releases', 'release_files', 'battle_audit', 'audit_log', 'admin_users', 'players', 'ledger', 'gacha_pulls', 'banners'] as const) {
      const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>();
      counts[t] = r?.n ?? 0;
    }
    const migrations = await db.prepare('SELECT name, applied_at FROM d1_migrations ORDER BY id').all();
    const pointers = await db.prepare('SELECT channel, release_id, version, updated_at, updated_by FROM channel_pointers ORDER BY channel').all();
    let r2: Record<string, unknown>;
    try {
      const l = await c.env.CONTENT.list({ limit: 1000, prefix: 'objects/' });
      r2 = { ok: true, objects_listed: l.objects.length, truncated: l.truncated, bytes_listed: l.objects.reduce((n, o) => n + o.size, 0) };
    } catch (e) {
      r2 = { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
    return c.json({
      environment: c.env.ENVIRONMENT,
      time: new Date().toISOString(),
      d1: { ok: true, latency_ms: latency, size_bytes: probe.meta.size_after, counts, migrations: migrations.results },
      r2,
      pointers: pointers.results,
      // Free-plan ceilings (README): shown for context; live usage needs the Cloudflare analytics API (not connected)
      limits: { d1_rows_read_per_day: 5_000_000, d1_rows_written_per_day: 100_000, d1_storage_bytes_total: 5 * 1024 ** 3, d1_bytes_per_database: 500 * 1024 ** 2 },
      usage_source: 'not_connected',
      auth: { access_configured: Boolean(c.env.ACCESS_TEAM_DOMAIN && c.env.ACCESS_AUD), signing_configured: Boolean(c.env.CONTENT_SIGNING_KEY && c.env.CONTENT_SIGNING_KID) }
    });
  });

  // ------------------------------------------------------------------ characters
  app.get('/admin/api/characters', need('viewer'), async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM characters ORDER BY rarity DESC, name_en').all();
    return c.json({ characters: results });
  });

  app.patch('/admin/api/characters/:id', need('operator'), async (c) => {
    const id = c.req.param('id');
    const patch = await json(c, CharacterPatch);
    const { expectedVersion, ...fields } = patch;
    const keys = Object.keys(fields) as (keyof typeof fields)[];
    if (keys.length === 0) throw new HttpError(400, 'no_changes', 'nothing to update');
    const who = c.get('admin').identity;
    const sets = keys.map((k, i) => `${k} = ?${i + 3}`).join(', ');
    const res = await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE characters SET ${sets}, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_by = '${who.replace(/'/g, "''")}' WHERE id = ?1 AND version = ?2`).bind(id, expectedVersion, ...keys.map((k) => fields[k] as string | number)),
      auditIfChanged(c.env.DB, who, 'character.update', id, { fields, expectedVersion })
    ]);
    if ((res[0]?.meta.changes ?? 0) !== 1) {
      const exists = await c.env.DB.prepare('SELECT version FROM characters WHERE id = ?1').bind(id).first<{ version: number }>();
      if (!exists) throw new HttpError(404, 'no_such_character', `character ${id} not found`);
      throw new HttpError(409, 'version_conflict', `character changed since version ${expectedVersion} (now ${exists.version})`);
    }
    const row = await c.env.DB.prepare('SELECT * FROM characters WHERE id = ?1').bind(id).first();
    return c.json(row);
  });

  // ------------------------------------------------------------------ asset catalog
  app.get('/admin/api/assets', need('viewer'), async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM assets ORDER BY kind, path').all();
    return c.json({ assets: results });
  });

  app.post('/admin/api/assets', need('operator'), async (c) => {
    const a = await json(c, AssetBody);
    const who = c.get('admin').identity;
    await c.env.DB.batch([
      c.env.DB
        .prepare(
          `INSERT INTO assets (path, sha256, bytes, media_type, kind, source, license, status, created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
           ON CONFLICT (path) DO UPDATE SET sha256 = excluded.sha256, bytes = excluded.bytes, media_type = excluded.media_type, kind = excluded.kind, source = excluded.source, license = excluded.license, status = excluded.status`
        )
        .bind(a.path, a.sha256, a.bytes, a.media_type, a.kind, a.source, a.license, a.status, who),
      auditStatement(c.env.DB, who, 'asset.upsert', a.path, { sha256: a.sha256, status: a.status })
    ]);
    return c.json({ ok: true, path: a.path }, 201);
  });

  // ------------------------------------------------------------------ content releases
  app.get('/admin/api/releases', need('viewer'), async (c) => c.json({ releases: await store(c.env).listReleases() }));

  app.get('/admin/api/releases/:id', need('viewer'), async (c) => {
    const r = await store(c.env).getRelease(c.req.param('id'));
    if (!r) throw new HttpError(404, 'no_such_release', 'release not found');
    return c.json({ ...r, manifest: JSON.parse(r.manifest_json) });
  });

  app.get('/admin/api/releases/:id/economic-policy', need('viewer'), async (c) => {
    const release = await store(c.env).getRelease(c.req.param('id'));
    if (!release) throw new HttpError(404, 'no_such_release', 'release not found');
    const [policy, pointer] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM release_economic_policy WHERE release_id = ?1').bind(release.id).first(),
      c.env.DB.prepare('SELECT release_id, economic_floor FROM channel_pointers WHERE channel = ?1').bind(release.channel).first()
    ]);
    return c.json({ releaseId: release.id, channel: release.channel, policy, pointer });
  });
  const EconomicPolicy = z.object({ mode: z.enum(['allowlisted', 'grace', 'revoked']), expectedVersion: z.number().int().min(0), validUntil: z.string().datetime().optional(), reason: z.string().trim().min(5).max(300) }).strict();
  app.post('/admin/api/releases/:id/economic-policy', need('operator'), async (c) => {
    const id = ReleaseId.safeParse(c.req.param('id'));
    if (!id.success) throw new HttpError(400, 'bad_release', 'invalid release id');
    const who = c.get('admin');
    await setEconomicPolicy(c.env.DB, id.data, who.identity, who.role === 'owner' ? 'owner' : 'operator', await json(c, EconomicPolicy, 2048));
    return c.json({ ok: true });
  });

  app.put('/admin/api/objects/:sha256', need('operator'), async (c) => {
    const sha = Sha.safeParse(c.req.param('sha256'));
    if (!sha.success) throw new HttpError(400, 'bad_hash', 'sha256 must be 64 lowercase hex characters');
    const mediaType = (c.req.header('Content-Type') ?? '').split(';')[0]?.trim() ?? '';
    if (!(Object.values(MEDIA_TYPE_BY_EXTENSION) as string[]).includes(mediaType)) throw new HttpError(400, 'bad_media_type', `media type ${mediaType || '(none)'} is not allowed for patch content`);
    const len = Number(c.req.header('Content-Length') ?? '0');
    if (len > MAX_OBJECT_BYTES) throw new HttpError(413, 'too_large', 'object too large');
    const out = await store(c.env).putObject(sha.data, await c.req.arrayBuffer(), mediaType);
    if (out.created) await audit(c.env.DB, c.get('admin').identity, 'object.upload', sha.data.slice(0, 16), { media_type: mediaType });
    return c.json({ sha256: sha.data, created: out.created }, out.created ? 201 : 200);
  });

  app.post('/admin/api/releases', need('operator'), async (c) => {
    const b = await json(c, DraftBody);
    const draft = await store(c.env).createDraft({ ...b, actor: c.get('admin').identity });
    return c.json({ ...draft, manifest: JSON.parse(draft.manifest_json) }, 201);
  });

  app.post('/admin/api/releases/:id/publish', need('operator'), async (c) => {
    const who = c.get('admin');
    await requireGameRuntime(c.env, await store(c.env).getRelease(c.req.param('id')));
    const signer = await loadSigner(c.env.CONTENT_SIGNING_KEY, c.env.CONTENT_SIGNING_KID);
    const row = await store(c.env).publish(c.req.param('id'), who.identity, who.role === 'owner' ? 'owner' : 'operator', signer);
    return c.json({ id: row.id, generation: row.generation, channel: row.channel, state: row.state, published_at: row.published_at });
  });

  const Source = z.object({ releaseId: ReleaseId }).strict();
  for (const mode of ['rollback', 'kill'] as const) {
    app.post(`/admin/api/channels/:channel/${mode}`, need('operator'), async (c) => {
      const channel = Channel.safeParse(c.req.param('channel'));
      if (!channel.success) throw new HttpError(400, 'bad_channel', 'unknown channel');
      const body = await json(c, Source);
      const who = c.get('admin');
      if (mode === 'rollback') await requireGameRuntime(c.env, await store(c.env).getRelease(body.releaseId));
      const signer = await loadSigner(c.env.CONTENT_SIGNING_KEY, c.env.CONTENT_SIGNING_KID);
      const row = await store(c.env).republish({ channel: channel.data, sourceId: body.releaseId, mode, actor: who.identity, role: who.role === 'owner' ? 'owner' : 'operator', signer });
      return c.json({ id: row.id, generation: row.generation, channel: row.channel, state: row.state });
    });
  }

  // ------------------------------------------------------------------ audit + users
  app.get('/admin/api/audit', need('viewer'), async (c) => {
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
    const { results } = await c.env.DB.prepare('SELECT id, at, actor, action, target, detail FROM audit_log ORDER BY id DESC LIMIT ?1').bind(limit).all();
    return c.json({ entries: results });
  });

  app.get('/admin/api/users', need('owner'), async (c) => {
    const { results } = await c.env.DB.prepare('SELECT email, role, created_at, created_by FROM admin_users ORDER BY email').all();
    return c.json({ users: results });
  });

  app.put('/admin/api/users', need('owner'), async (c) => {
    const b = await json(c, UserBody);
    const who = c.get('admin').identity;
    const email = b.email.toLowerCase();
    if (email === who && b.role !== 'owner') throw new HttpError(409, 'last_owner', 'owners cannot demote themselves');
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO admin_users (email, role, created_by) VALUES (?1, ?2, ?3) ON CONFLICT (email) DO UPDATE SET role = excluded.role').bind(email, b.role, who),
      auditStatement(c.env.DB, who, 'admin.set_role', email, { role: b.role })
    ]);
    return c.json({ email, role: b.role });
  });

  registerOps(app, need);
  registerMonitoring(app, need);

  app.all('/admin/api/*', (c) => c.json({ error: 'not_found', message: 'no such endpoint' }, 404));
  return app;
}
