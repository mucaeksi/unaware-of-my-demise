import { CONTENT_CAPABILITIES } from '@uomd/content-schema';
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
import { CHARACTER_STAT_COLUMNS, displayCatalog, withAttributes, type CharacterStatRow } from './content/runtime-catalog';
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
      allowHeaders: ['Authorization', 'Content-Type', 'Range'],
      exposeHeaders: ['Content-Range', 'Accept-Ranges', 'ETag'],
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
    return c.json({ ok, service: 'uomd-game', version: c.env.CF_VERSION_METADATA ?? null, environment: c.env.ENVIRONMENT, channel: c.env.CONTENT_CHANNEL, time: new Date().toISOString(), d1, r2, runtime: { catalog_protocol: 1, capabilities: CONTENT_CAPABILITIES }, current_release: current?.releaseId ?? null }, ok ? 200 : 503);
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
    const range = c.req.header('Range'); let offset: number | undefined; let total: number | undefined;
    if (range !== undefined) {
      const info = await c.env.CONTENT.head(ContentStore.objectKey(sha));
      if (!info) throw new HttpError(404, 'not_found', 'no such object');
      total = info.size;
      const match = /^bytes=(0|[1-9][0-9]*)-$/.exec(range); offset = match ? Number(match[1]) : -1;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset >= total) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    }
    const obj = await store.getObject(sha, offset);
    if (!obj) throw new HttpError(404, 'not_found', 'no such object');
    return new Response(obj.body, {
      status: offset === undefined ? 200 : 206,
      headers: {
        'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
        'Content-Length': String(offset === undefined ? obj.size : total! - offset),
        'Accept-Ranges': 'bytes',
        ...(offset === undefined ? {} : { 'Content-Range': `bytes ${offset}-${total! - 1}/${total}` }),
        ETag: `"${sha}"`,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  });

  app.get('/api/v1/characters', async (c) => {
    const selected = c.req.query('releaseId');
    if (selected !== undefined && !/^[a-z][a-z0-9_]{1,47}$/.test(selected)) throw new HttpError(400, 'bad_request', 'invalid release id');
    const catalog = await displayCatalog(c.env, selected);
    if (catalog) return c.json({ releaseId: catalog.releaseId, catalogSha256: catalog.sha256, characters: catalog.data.characters.filter((c) => c.status === 'active').map((r) => ({ id: r.id, name_en: r.name_en, rarity: r.rarity, element: r.element, role: r.role, age: r.age, acquisition: r.acquisition, ...(r.attributes ? { attributes: r.attributes } : { base: r.base }) })) }, 200, { 'Cache-Control': 'public, max-age=60' });
    const { results } = await c.env.DB.prepare(
      `SELECT id, name_en, rarity, element, role, age, acquisition, ${CHARACTER_STAT_COLUMNS} FROM characters WHERE status = 'active' ORDER BY rarity DESC, name_en`
    ).all<CharacterStatRow & Record<string, unknown>>();
    return c.json({ characters: results.map(withAttributes) }, 200, { 'Cache-Control': 'public, max-age=60' });
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
    const encounter = Encounter.parse(JSON.parse(dec.decode(encBytes)));
    // owned-hero stages have no fixed player side: they are only verified through an account's battle session
    if ((encounter.party_mode ?? 'fixed') === 'owned') throw new HttpError(422, 'owned_party_required', 'this stage is verified when you claim it with your own party');
    const out = await replayBattle(UnitPack.parse(JSON.parse(dec.decode(packBytes))), encounter, body.actions);
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

  app.get('/privacy', (c) =>
    c.html(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unaware of My Demise — Privacy &amp; Data Safety</title></head><body style="font-family:Georgia,serif;background:#110d12;color:#f3e9d2;max-width:780px;margin:2rem auto;padding:1.5rem;line-height:1.6"><h1>Unaware of My Demise — Privacy &amp; Data Retention Notice</h1><p>Package: <code>${c.env.PLAY_PACKAGE_NAME ?? 'io.github.mucaeksi.unawareofmydemise'}</code></p><p>Identity is bound exclusively to Google Sign-In (verified Google subject ID and display name). Mutable gameplay data (sessions, wallets, roster, gear, teams, tasks, battle sessions, cloud saves, pending billing tokens and ad nonces) is erased immediately upon account deletion. Financial, randomness and anti-fraud audit ledgers are retained in pseudonymous form (linked only to an unlinked tombstone ID with all Google identifiers removed) for 7 years to satisfy tax, payment-reconciliation and statutory obligations. Deleted accounts are recorded in an append-only tombstone log so backup restoration cannot resurrect erased personal data.</p><p>Audience &amp; Ads Policy: Not directed to children under 13 (<code>tagForChildDirectedTreatment=false</code>, maximum ad content rating <code>T</code>). Ad consent is managed via Google User Messaging Platform (UMP) before any ad SDK request, is retained offline on the device, and can be reviewed or withdrawn at any time from <strong>Account &gt; Privacy Options (Ads)</strong> or <strong>Title &gt; Settings &gt; Privacy Options</strong> without signing in.</p><p>Machine-readable inventory: <a href="/api/v1/privacy" style="color:#d4af37">/api/v1/privacy</a> · Web account deletion request: <a href="/account/delete-request" style="color:#d4af37">/account/delete-request</a></p></body></html>`,
      200,
      { 'Cache-Control': 'public, max-age=300' }
    )
  );

  app.get('/account/delete-request', (c) =>
    c.html(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unaware of My Demise — Delete Account</title></head><body style="font-family:Georgia,serif;background:#110d12;color:#f3e9d2;max-width:780px;margin:2rem auto;padding:1.5rem;line-height:1.6"><h1>Unaware of My Demise — Account Deletion Request</h1><p>You can delete your account and all mutable progression data either inside the app (<strong>Account &gt; Delete Account</strong>) or from the web without reinstalling the app by submitting a verified Google ID token to <code>POST /api/v1/account/delete-request</code> with <code>{"idToken":"&lt;google-id-token&gt;","confirm":"DELETE"}</code>.</p><p>Deleting your game account removes your Google identity link, display name, active sessions, wallet balances, characters, gear, teams, battle sessions and cloud saves immediately. Active Google Play subscriptions must be cancelled separately in <strong>Google Play &gt; Payments &amp; subscriptions</strong>.</p><p>See <a href="/privacy" style="color:#d4af37">Privacy &amp; Data Retention Notice</a> for full details on erased and pseudonymous retained records.</p></body></html>`,
      200,
      { 'Cache-Control': 'public, max-age=300' }
    )
  );

  app.all('/api/*', (c) => c.json({ error: 'not_found', message: 'no such endpoint' }, 404));
  return app;
}
