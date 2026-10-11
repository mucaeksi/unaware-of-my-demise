import { requestMonitoring } from './monitoring';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { Encounter, UnitPack } from '@uomd/content-schema';
import { replayBattle } from '@uomd/combat';
import { sha256Hex } from '@uomd/shared';
import { ContentStore, HttpError } from './content/store';
import { d1RateLimit, onError, securityHeaders } from './http';
import type { Channel } from '@uomd/content-schema';
import type { GameEnv } from './env';
import type { SsvKeyFetcher } from './ads/ssv';
import type { PlayClient } from './billing/play';
import { registerPlayerRoutes } from './player/routes';
import type { JWTVerifyGetKey } from 'jose';

const ChannelParam = z.enum(['dev', 'staging', 'production']);
const VerifyBody = z
  .object({
    releaseId: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/),
    encounterPath: z.string().min(3).max(200),
    actions: z.array(z.object({ skillId: z.string().max(80), targetId: z.string().max(80).optional() }).strict()).max(600),
    clientLogHash: z.string().regex(/^[0-9a-f]{64}$/).optional()
  })
  .strict();

async function limited(env: GameEnv, req: Request, bucket: string, limit: number): Promise<boolean> {
  const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
  const key = `${bucket}:${await sha256Hex(ip)}`.slice(0, 80);
  if (env.API_LIMITER) return (await env.API_LIMITER.limit({ key })).success;
  return d1RateLimit(env.DB, key, limit, 60);
}

/** Public game API. Everything here is safe to call from an untrusted client. */
export function createGameApp(opts: { getGoogleKey?: JWTVerifyGetKey; admobKeys?: SsvKeyFetcher; play?: (env: GameEnv) => PlayClient } = {}): Hono<{ Bindings: GameEnv; Variables: { playerId: string; tokenHash: string } }> {
  const app = new Hono<{ Bindings: GameEnv; Variables: { playerId: string; tokenHash: string } }>();
  app.use('*', securityHeaders);
  app.use('*', requestMonitoring('game'));
  // The Android shell (Capacitor WebView) runs the client from https://localhost and calls this API cross-origin. Auth is a bearer token
  // (no cookies), so an allow-list of exact origins with no credentials is enough; any other origin gets no CORS headers.
  app.use(
    '/api/*',
    cors({
      origin: (origin, c) => (['https://localhost', 'capacitor://localhost', ...(c.env.ALLOWED_ORIGINS ?? '').split(',').map((o: string) => o.trim()).filter(Boolean)].includes(origin) ? origin : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      maxAge: 86_400
    })
  );
  app.onError(onError);

  app.get('/api/v1/health', async (c) => {
    const t0 = Date.now();
    let d1: Record<string, unknown>;
    try {
      const m = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM d1_migrations').first<{ n: number }>();
      const meta = await c.env.DB.prepare('SELECT 1').run();
      d1 = { ok: true, latency_ms: Date.now() - t0, migrations_applied: m?.n ?? 0 };
      void meta;
    } catch (e) {
      // this route is public: error text (table names, SQL) is only exposed in local development
      d1 = { ok: false, ...(c.env.ENVIRONMENT === 'dev' ? { error: String(e instanceof Error ? e.message : e) } : {}) };
    }
    let r2: Record<string, unknown>;
    try {
      await c.env.CONTENT.list({ limit: 1 });
      r2 = { ok: true };
    } catch (e) {
      r2 = { ok: false, ...(c.env.ENVIRONMENT === 'dev' ? { error: String(e instanceof Error ? e.message : e) } : {}) };
    }
    const store = new ContentStore(c.env.DB, c.env.CONTENT);
    const current = await store.publishedManifest(c.env.CONTENT_CHANNEL).catch(() => null);
    const ok = d1.ok === true && r2.ok === true;
    return c.json({ ok, service: 'uomd-game', version: c.env.CF_VERSION_METADATA ?? null, environment: c.env.ENVIRONMENT, channel: c.env.CONTENT_CHANNEL, time: new Date().toISOString(), d1, r2, current_release: current?.releaseId ?? null }, ok ? 200 : 503);
  });

  app.get('/api/v1/content/channels/:channel/manifest', async (c) => {
    const channel = ChannelParam.safeParse(c.req.param('channel'));
    if (!channel.success || channel.data !== c.env.CONTENT_CHANNEL) throw new HttpError(404, 'no_such_channel', 'unknown channel');
    const store = new ContentStore(c.env.DB, c.env.CONTENT);
    const m = await store.publishedManifest(channel.data as Channel);
    if (!m) throw new HttpError(404, 'nothing_published', 'no release is published on this channel');
    const etag = `"${m.releaseId}"`;
    if (c.req.header('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
    return new Response(m.json, { headers: { 'Content-Type': 'application/json', ETag: etag, 'Cache-Control': 'no-cache' } });
  });

  app.get('/api/v1/content/objects/:sha256', async (c) => {
    const sha = c.req.param('sha256');
    if (!/^[0-9a-f]{64}$/.test(sha)) throw new HttpError(400, 'bad_hash', 'sha256 must be 64 lowercase hex characters');
    const store = new ContentStore(c.env.DB, c.env.CONTENT);
    // unpublished objects are indistinguishable from missing ones
    if (!(await store.isServable(sha, c.env.CONTENT_CHANNEL))) throw new HttpError(404, 'not_found', 'no such object');
    const obj = await store.getObject(sha);
    if (!obj) throw new HttpError(404, 'not_found', 'no such object');
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
        'Content-Length': String(obj.size),
        ETag: `"${sha}"`,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  });

  app.get('/api/v1/characters', async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT id, name_en, rarity, element, role, age, acquisition, base_hp, base_atk, base_def, base_spd FROM characters WHERE status = 'active' ORDER BY rarity DESC, name_en"
    ).all();
    return c.json({ characters: results }, 200, { 'Cache-Control': 'public, max-age=60' });
  });

  app.post('/api/v1/battles/verify', async (c) => {
    if (!(await limited(c.env, c.req.raw, 'verify', 30))) throw new HttpError(429, 'rate_limited', 'too many requests');
    const raw = await c.req.text();
    if (raw.length > 64 * 1024) throw new HttpError(413, 'too_large', 'request body too large');
    let body;
    try {
      body = VerifyBody.parse(JSON.parse(raw));
    } catch {
      throw new HttpError(400, 'bad_request', 'invalid request body');
    }
    const store = new ContentStore(c.env.DB, c.env.CONTENT);
    const rel = await store.getRelease(body.releaseId);
    if (!rel || rel.state !== 'published' || rel.channel !== c.env.CONTENT_CHANNEL) throw new HttpError(404, 'unknown_release', 'release is not published on this channel');
    const [packBytes, encBytes] = await Promise.all([store.effectiveBytes(body.releaseId, 'units/unit_pack.json'), store.effectiveBytes(body.releaseId, body.encounterPath)]);
    if (!packBytes || !encBytes) throw new HttpError(404, 'unknown_encounter', 'encounter is not part of that release');
    const dec = new TextDecoder();
    const out = await replayBattle(UnitPack.parse(JSON.parse(dec.decode(packBytes))), Encounter.parse(JSON.parse(dec.decode(encBytes))), body.actions);
    const match = body.clientLogHash === out.logHash;
    const day = new Date().toISOString().slice(0, 10);
    const caller = await sha256Hex(`${c.req.header('CF-Connecting-IP') ?? 'local'}|${day}`);
    await c.env.DB.prepare(
      'INSERT INTO battle_audit (release_id, encounter, valid, complete, winner, stars, turns, log_hash, client_match, caller) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)'
    )
      .bind(body.releaseId, body.encounterPath, out.valid ? 1 : 0, out.complete ? 1 : 0, out.result?.winner ?? null, out.result?.stars ?? null, out.result?.turns ?? null, out.logHash, match ? 1 : 0, caller.slice(0, 32))
      .run();
    return c.json({ valid: out.valid, complete: out.complete, match, result: out.result, logHash: out.logHash, ...(out.error ? { error: out.error } : {}) });
  });

  registerPlayerRoutes(app, opts);

  app.all('/api/*', (c) => c.json({ error: 'not_found', message: 'no such endpoint' }, 404));
  return app;
}
