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
import { filter, likeSubstring, pageLimit, pageOf, readCursor } from './admin/page';

type Ctx = { Bindings: AdminEnv; Variables: { admin: AdminIdentity } };

const Sha = z.string().regex(/^[0-9a-f]{64}$/);
const ReleaseId = z.string().regex(/^[a-z][a-z0-9_]{1,47}$/);
/** D-27 attribute columns of `characters` (migration 0029) */
const point = z.number().min(0).max(1000);
const growth = z.number().min(0).max(100);
const AttributeColumns = z.object({
  power_stat: z.enum(['str', 'int']), base_str: point, base_int: point, base_vit: z.number().min(1).max(1000), base_agi: z.number().min(1).max(1000),
  growth_str: growth, growth_int: growth, growth_vit: growth, growth_agi: growth, armor: z.number().int().min(0).max(100)
});
const CharacterPatch = z
  .object({
    expectedVersion: z.number().int().min(1),
    name_en: z.string().min(1).max(60).optional(),
    status: z.enum(['active', 'hidden', 'retired']).optional(),
    rarity: z.number().int().min(1).max(5).optional(),
    element: z.string().min(1).max(40).optional(),
    role: z.string().min(1).max(40).optional(),
    age: z.number().int().min(0).max(9999).optional(),
    acquisition: z.string().min(1).max(40).optional(),
    ...AttributeColumns.partial().shape
  })
  .strict();
const CharacterCreate = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/),
    name_en: z.string().min(1).max(60),
    rarity: z.number().int().min(1).max(5).default(5),
    element: z.string().min(1).max(40).default('Veil'),
    role: z.string().min(1).max(40).default('dps'),
    // no default: a character's (adult) age is canon/provenance, never something the API may invent
    age: z.number().int().min(0).max(9999),
    acquisition: z.string().min(1).max(40).default('gacha'),
    ...AttributeColumns.shape,
    growth_str: growth.default(0), growth_int: growth.default(0), growth_vit: growth.default(0), growth_agi: growth.default(0), armor: AttributeColumns.shape.armor.default(0),
    status: z.enum(['active', 'hidden', 'retired']).default('active')
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
const AssetPatch = z
  .object({
    kind: z.string().min(2).max(40).optional(),
    source: z.string().min(3).max(300).optional(),
    license: z.string().min(2).max(100).optional(),
    status: z.enum(['candidate', 'approved', 'retired']).optional()
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
    files: z.array(z.object({ path: SafeAssetPath, sha256: Sha }).strict()).min(1).max(768)
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
      auth: { access_configured: Boolean(c.env.ACCESS_TEAM_DOMAIN && c.env.ACCESS_AUD), signing_configured: Boolean(c.env.CONTENT_SIGNING_KEY && c.env.CONTENT_SIGNING_KID), mfa_enforced: c.env.ACCESS_REQUIRE_MFA === '1' }
    });
  });

  // ------------------------------------------------------------------ characters
  app.get('/admin/api/characters', need('viewer'), async (c) => {
    const status = filter(c.req.query('status'), z.enum(['active', 'hidden', 'retired']), 'status');
    const rarity = filter(c.req.query('rarity'), z.coerce.number().int().min(1).max(5), 'rarity');
    const q = (c.req.query('q') ?? '').trim().slice(0, 60);
    const limit = pageLimit(c.req.query('limit'), 100);
    const after = readCursor(c.req.query('cursor'), z.tuple([z.number().int(), z.string(), z.string()]));
    const { results } = await c.env.DB
      .prepare(
        `SELECT * FROM characters
         WHERE (?1 IS NULL OR status = ?1) AND (?2 IS NULL OR rarity = ?2) AND (?3 = '' OR id LIKE ?4 ESCAPE '\\' OR name_en LIKE ?4 ESCAPE '\\')
           AND (?5 IS NULL OR rarity < ?5 OR (rarity = ?5 AND (name_en > ?6 OR (name_en = ?6 AND id > ?7))))
         ORDER BY rarity DESC, name_en, id LIMIT ?8`
      )
      .bind(status ?? null, rarity ?? null, q, likeSubstring(q), after?.[0] ?? null, after?.[1] ?? null, after?.[2] ?? null, limit + 1)
      .all<{ id: string; name_en: string; rarity: number }>();
    const page = pageOf(results, limit, (r) => [r.rarity, r.name_en, r.id]);
    return c.json({ characters: page.rows, nextCursor: page.nextCursor });
  });

  app.get('/admin/api/characters/:id', need('viewer'), async (c) => {
    const character = await c.env.DB.prepare('SELECT * FROM characters WHERE id = ?1').bind(c.req.param('id')).first();
    if (!character) throw new HttpError(404, 'no_such_character', 'character not found');
    return c.json({ character });
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

  app.post('/admin/api/characters', need('operator'), async (c) => {
    const ch = await json(c, CharacterCreate);
    const who = c.get('admin').identity;
    const res = await c.env.DB.batch([
      c.env.DB
        .prepare(
          `INSERT INTO characters (id, name_en, rarity, element, role, age, acquisition, power_stat, base_str, base_int, base_vit, base_agi, growth_str, growth_int, growth_vit, growth_agi, armor, status, updated_by)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
           ON CONFLICT (id) DO NOTHING`
        )
        .bind(ch.id, ch.name_en, ch.rarity, ch.element, ch.role, ch.age, ch.acquisition, ch.power_stat, ch.base_str, ch.base_int, ch.base_vit, ch.base_agi, ch.growth_str, ch.growth_int, ch.growth_vit, ch.growth_agi, ch.armor, ch.status, who),
      auditIfChanged(c.env.DB, who, 'character.create', ch.id, { name_en: ch.name_en, rarity: ch.rarity, role: ch.role })
    ]);
    if ((res[0]?.meta.changes ?? 0) !== 1) throw new HttpError(409, 'exists', `character ${ch.id} already exists`);
    const row = await c.env.DB.prepare('SELECT * FROM characters WHERE id = ?1').bind(ch.id).first();
    return c.json(row, 201);
  });

  // ------------------------------------------------------------------ asset catalog
  app.get('/admin/api/assets', need('viewer'), async (c) => {
    const kind = filter(c.req.query('kind'), z.string().min(2).max(40), 'kind');
    const status = filter(c.req.query('status'), z.enum(['candidate', 'approved', 'retired']), 'status');
    const q = (c.req.query('q') ?? '').trim().slice(0, 120);
    const limit = pageLimit(c.req.query('limit'), 100);
    const after = readCursor(c.req.query('cursor'), z.tuple([z.string(), z.string()]));
    const { results } = await c.env.DB
      .prepare(
        `SELECT * FROM assets
         WHERE (?1 IS NULL OR kind = ?1) AND (?2 IS NULL OR status = ?2) AND (?3 = '' OR path LIKE ?4 ESCAPE '\\')
           AND (?5 IS NULL OR (kind, path) > (?5, ?6))
         ORDER BY kind, path LIMIT ?7`
      )
      .bind(kind ?? null, status ?? null, q, likeSubstring(q), after?.[0] ?? null, after?.[1] ?? null, limit + 1)
      .all<{ kind: string; path: string }>();
    const page = pageOf(results, limit, (r) => [r.kind, r.path]);
    return c.json({ assets: page.rows, nextCursor: page.nextCursor });
  });

  app.get('/admin/api/assets/:id{[0-9]{1,15}}', need('viewer'), async (c) => {
    const asset = await c.env.DB
      .prepare('SELECT a.*, EXISTS (SELECT 1 FROM content_objects o WHERE o.sha256 = a.sha256) AS object_stored FROM assets a WHERE a.id = ?1')
      .bind(Number(c.req.param('id')))
      .first();
    if (!asset) throw new HttpError(404, 'no_such_asset', 'asset not found');
    return c.json({ asset });
  });

  app.post('/admin/api/assets', need('operator'), async (c) => {
    const a = await json(c, AssetBody);
    const who = c.get('admin').identity;
    // approval is only granted by POST /assets/:id/approve, which verifies the exact R2 object first
    if (a.status === 'approved') throw new HttpError(409, 'approve_via_r2', 'register the asset as a candidate, upload its object, then approve it');
    await c.env.DB.batch([
      c.env.DB
        .prepare(
          `INSERT INTO assets (path, sha256, bytes, media_type, kind, source, license, status, created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
           ON CONFLICT (path) DO UPDATE SET sha256 = excluded.sha256, bytes = excluded.bytes, media_type = excluded.media_type, kind = excluded.kind, source = excluded.source, license = excluded.license, status = excluded.status, created_by = excluded.created_by`
        )
        .bind(a.path, a.sha256, a.bytes, a.media_type, a.kind, a.source, a.license, a.status, who),
      auditStatement(c.env.DB, who, 'asset.upsert', a.path, { sha256: a.sha256, status: a.status })
    ]);
    return c.json({ ok: true, path: a.path }, 201);
  });

  app.patch('/admin/api/assets/:id{[0-9]{1,15}}', need('operator'), async (c) => {
    const id = Number(c.req.param('id'));
    const patch = await json(c, AssetPatch);
    const keys = Object.keys(patch) as (keyof typeof patch)[];
    if (keys.length === 0) throw new HttpError(400, 'no_changes', 'nothing to update');
    const who = c.get('admin').identity;
    const existing = await c.env.DB.prepare('SELECT id, path, status FROM assets WHERE id = ?1').bind(id).first<{ id: number; path: string; status: string }>();
    if (!existing) throw new HttpError(404, 'no_such_asset', 'asset not found');
    if (patch.status === 'approved' && existing.status !== 'approved') {
      throw new HttpError(409, 'approve_via_r2', 'use POST /admin/api/assets/:id/approve so the stored R2 object is verified');
    }
    // keys come from the strict zod schema above, never from the request text; created_by keeps the original author
    const sets = keys.map((k, i) => `${k} = ?${i + 2}`).join(', ');
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE assets SET ${sets} WHERE id = ?1`).bind(id, ...keys.map((k) => patch[k] as string)),
      auditStatement(c.env.DB, who, 'asset.update', existing.path, { id, ...patch })
    ]);
    const updated = await c.env.DB.prepare('SELECT * FROM assets WHERE id = ?1').bind(id).first();
    return c.json({ asset: updated });
  });

  app.post('/admin/api/assets/:id{[0-9]{1,15}}/approve', need('owner'), async (c) => {
    const id = Number(c.req.param('id'));
    const asset = await c.env.DB
      .prepare('SELECT id, path, sha256, bytes, media_type, kind, source, license, status FROM assets WHERE id = ?1')
      .bind(id)
      .first<{ id: number; path: string; sha256: string; bytes: number; media_type: string; kind: string; source: string; license: string; status: string }>();
    if (!asset) throw new HttpError(404, 'no_such_asset', 'asset not found');
    const objRow = await c.env.DB
      .prepare('SELECT bytes, media_type FROM content_objects WHERE sha256 = ?1')
      .bind(asset.sha256)
      .first<{ bytes: number; media_type: string }>();
    const head = objRow ? await c.env.CONTENT.head(ContentStore.objectKey(asset.sha256)) : null;
    if (!objRow || !head || objRow.bytes !== asset.bytes || head.size !== asset.bytes || objRow.media_type !== asset.media_type) {
      throw new HttpError(409, 'object_not_stored', 'cannot approve an asset before its exact R2 object is stored and verified');
    }
    const who = c.get('admin').identity;
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE assets SET status = 'approved' WHERE id = ?1").bind(id),
      auditStatement(c.env.DB, who, 'asset.approve', asset.path, { id, sha256: asset.sha256, bytes: asset.bytes, media_type: asset.media_type, source: asset.source, license: asset.license })
    ]);
    return c.json({ id, path: asset.path, status: 'approved', verifiedSha256: asset.sha256, verifiedBytes: asset.bytes });
  });

  // ------------------------------------------------------------------ content releases
  app.get('/admin/api/releases', need('viewer'), async (c) => {
    const channel = filter(c.req.query('channel'), Channel, 'channel');
    const state = filter(c.req.query('state'), z.enum(['draft', 'published', 'retired']), 'state');
    const limit = pageLimit(c.req.query('limit'), 100);
    const after = readCursor(c.req.query('cursor'), z.tuple([z.string(), z.number().int()]));
    const rows = await store(c.env).listReleases({ ...(channel ? { channel } : {}), ...(state ? { state } : {}), after, limit: limit + 1 });
    const page = pageOf(rows, limit, (r) => [r.channel, r.generation]);
    return c.json({ releases: page.rows, nextCursor: page.nextCursor });
  });

  app.get('/admin/api/releases/:id', need('viewer'), async (c) => {
    const s = store(c.env);
    const r = await s.getRelease(c.req.param('id'));
    if (!r) throw new HttpError(404, 'no_such_release', 'release not found');
    const files = await s.effectiveFiles(r.id).catch(() => new Map<string, string>());
    const mediaProvenance = await s.mediaProvenance(files);
    return c.json({ ...r, manifest: JSON.parse(r.manifest_json), mediaProvenance });
  });

  app.get('/admin/api/releases/:id/diff', need('viewer'), async (c) => {
    const s = store(c.env);
    const r = await s.getRelease(c.req.param('id'));
    if (!r) throw new HttpError(404, 'no_such_release', 'release not found');
    const againstParam = c.req.query('against');
    const current = againstParam
      ? { release_id: againstParam }
      : await c.env.DB.prepare('SELECT release_id FROM channel_pointers WHERE channel = ?1').bind(r.channel).first<{ release_id: string }>();
    const targetFiles = await s.effectiveFiles(r.id);
    const baseFiles = current?.release_id && current.release_id !== r.id ? await s.effectiveFiles(current.release_id) : new Map<string, string>();
    const added: { path: string; sha256: string }[] = [];
    const changed: { path: string; beforeSha256: string; afterSha256: string }[] = [];
    const removed: { path: string; sha256: string }[] = [];
    for (const [path, sha256] of targetFiles) {
      const prev = baseFiles.get(path);
      if (!prev) added.push({ path, sha256 });
      else if (prev !== sha256) changed.push({ path, beforeSha256: prev, afterSha256: sha256 });
    }
    for (const [path, sha256] of baseFiles) {
      if (!targetFiles.has(path)) removed.push({ path, sha256 });
    }
    const mediaProvenance = await s.mediaProvenance(targetFiles);
    return c.json({
      releaseId: r.id,
      channel: r.channel,
      againstId: current?.release_id ?? null,
      added,
      changed,
      removed,
      unchangedCount: targetFiles.size - added.length - changed.length,
      mediaProvenance
    });
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

  app.get('/admin/api/objects/:sha256', need('viewer'), async (c) => {
    const sha = Sha.safeParse(c.req.param('sha256'));
    if (!sha.success) throw new HttpError(400, 'bad_hash', 'sha256 must be 64 lowercase hex characters');
    const obj = await c.env.CONTENT.get(ContentStore.objectKey(sha.data));
    if (!obj) throw new HttpError(404, 'no_such_object', 'object not stored in R2');
    // preview only: never let stored bytes run as a document on the admin origin
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, max-age=300'
      }
    });
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
    const rel = await store(c.env).getRelease(c.req.param('id'));
    if (rel?.channel === 'production' && who.role !== 'owner') throw new HttpError(403, 'owner_required', 'publishing to production needs the owner role');
    await requireGameRuntime(c.env, rel);
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
      // same bar as publish: only the owner moves the production pointer (rollback) or kills it
      if (channel.data === 'production' && who.role !== 'owner') throw new HttpError(403, 'owner_required', `${mode} on production needs the owner role`);
      if (mode === 'rollback') await requireGameRuntime(c.env, await store(c.env).getRelease(body.releaseId));
      const signer = await loadSigner(c.env.CONTENT_SIGNING_KEY, c.env.CONTENT_SIGNING_KID);
      const row = await store(c.env).republish({ channel: channel.data, sourceId: body.releaseId, mode, actor: who.identity, role: who.role === 'owner' ? 'owner' : 'operator', signer });
      return c.json({ id: row.id, generation: row.generation, channel: row.channel, state: row.state });
    });
  }

  // ------------------------------------------------------------------ audit + approvals + users
  app.get('/admin/api/audit', need('viewer'), async (c) => {
    const actor = filter(c.req.query('actor'), z.string().max(200), 'actor');
    const action = filter(c.req.query('action'), z.string().max(80), 'action');
    const target = filter(c.req.query('target'), z.string().max(200), 'target');
    const limit = pageLimit(c.req.query('limit'), 50);
    const after = readCursor(c.req.query('cursor'), z.tuple([z.number().int().min(1)]));
    const { results } = await c.env.DB
      .prepare(
        `SELECT id, at, actor, action, target, detail FROM audit_log
         WHERE (?1 IS NULL OR actor = ?1) AND (?2 IS NULL OR action = ?2) AND (?3 IS NULL OR target = ?3) AND (?4 IS NULL OR id < ?4)
         ORDER BY id DESC LIMIT ?5`
      )
      .bind(actor ?? null, action ?? null, target ?? null, after?.[0] ?? null, limit + 1)
      .all<{ id: number }>();
    const page = pageOf(results, limit, (r) => [r.id]);
    return c.json({ entries: page.rows, nextCursor: page.nextCursor });
  });

  app.get('/admin/api/audit/:id{[0-9]{1,15}}', need('viewer'), async (c) => {
    const entry = await c.env.DB.prepare('SELECT id, at, actor, action, target, detail FROM audit_log WHERE id = ?1').bind(Number(c.req.param('id'))).first();
    if (!entry) throw new HttpError(404, 'no_such_entry', 'audit entry not found');
    return c.json({ entry });
  });

  app.get('/admin/api/approvals', need('viewer'), async (c) => {
    const limit = pageLimit(c.req.query('limit'), 50);
    const after = readCursor(c.req.query('cursor'), z.tuple([z.number().int().min(1)]));
    const { results } = await c.env.DB
      .prepare(
        `SELECT a.id, a.at, a.actor, COALESCE(u.role, 'owner') AS actor_role, a.action, a.target, a.detail
         FROM audit_log a
         LEFT JOIN admin_users u ON u.email = a.actor
         WHERE a.action IN ('release.publish', 'release.rollback', 'release.kill_switch', 'asset.approve', 'player.mail', 'player.adjust', 'product.set', 'admin.set_role', 'economic_policy.set')
           AND (?1 IS NULL OR a.id < ?1)
         ORDER BY a.id DESC LIMIT ?2`
      )
      .bind(after?.[0] ?? null, limit + 1)
      .all<{ id: number }>();
    const page = pageOf(results, limit, (r) => [r.id]);
    return c.json({ approvals: page.rows, nextCursor: page.nextCursor, singleOwnerModel: true });
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
