import type { Hono, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { JWTVerifyGetKey } from 'jose';
import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import { d1RateLimit } from '../http';
import type { GameEnv } from '../env';
import { activeBanners, disclosure, pullGacha } from '../gacha/service';
import { PlayApi, type PlayClient } from '../billing/play';
import { authenticatePush, handleRtdn } from '../billing/rtdn';
import { billingTag, listProducts, syncSubscriptionMail, verifyPurchase } from '../billing/service';
import { adStatus, beginAd, grantAd, AD } from '../ads/service';
import { googleKeyFetcher, verifySsv, type SsvKeyFetcher } from '../ads/ssv';
import { BattleSubmission, getProgress, readSave, submitBattle, writeSave } from '../progress/service';
import { claimMail, listMail, markRead } from '../mail/service';
import { issueSession, playerForGoogle, resolveSession, revokeSession, verifyGoogleIdToken } from './auth';

type AppEnv = { Bindings: GameEnv; Variables: { playerId: string; tokenHash: string } };
type App = Hono<AppEnv>;

const RequestId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
const SignIn = z.object({ idToken: z.string().min(100).max(8192) }).strict();
const Pull = z
  .object({ bannerId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), count: z.union([z.literal(1), z.literal(10)]), requestId: RequestId, target: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).optional() })
  .strict();

async function body<T>(c: { req: { text(): Promise<string> } }, schema: z.ZodType<T>, max = 8192 + 512): Promise<T> {
  const raw = await c.req.text();
  if (raw.length > max) throw new HttpError(413, 'too_large', 'request body too large');
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    throw new HttpError(400, 'bad_request', 'invalid request body');
  }
}

/** Account, session, wallet and gacha endpoints. Authenticated routes use the opaque bearer session (see auth.ts). */
export function registerPlayerRoutes(app: App, opts: { getGoogleKey?: JWTVerifyGetKey; admobKeys?: SsvKeyFetcher; play?: (env: GameEnv) => PlayClient } = {}): void {
  const perMinute = async (env: GameEnv, key: string, limit: number): Promise<void> => {
    if (!(await d1RateLimit(env.DB, `${key}`.slice(0, 80), limit, 60))) throw new HttpError(429, 'rate_limited', 'too many requests');
  };

  /** Feature flags are the emergency brakes: a missing flag counts as ON so a fresh database is not locked out. */
  const flagOn = async (env: GameEnv, key: string): Promise<boolean> => {
    const r = await env.DB.prepare('SELECT enabled FROM feature_flags WHERE key = ?1').bind(key).first<{ enabled: number }>();
    return r ? r.enabled === 1 : true;
  };
  const requireFlag = async (env: GameEnv, key: string): Promise<void> => {
    if (!(await flagOn(env, key))) throw new HttpError(503, 'feature_disabled', 'this feature is temporarily switched off');
  };

  /** Display name of the single main currency (data, renameable without a client release). */
  app.get('/api/v1/currency', async (c) => {
    const r = await c.env.DB.prepare("SELECT id, display_name FROM currencies WHERE retired = 0 AND kind = 'premium_earnable' LIMIT 1").first<{ id: string; display_name: string }>();
    return c.json({ id: r?.id ?? 'eclipse_token', name: r?.display_name ?? "Bell's Remains" }, 200, { 'Cache-Control': 'public, max-age=300' });
  });

  app.get('/api/v1/flags', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT key, enabled, value_json FROM feature_flags ORDER BY key').all<{ key: string; enabled: number; value_json: string }>();
    return c.json({ flags: Object.fromEntries(results.map((r) => [r.key, { enabled: r.enabled === 1, value: JSON.parse(r.value_json) }])) }, 200, { 'Cache-Control': 'public, max-age=15' });
  });

  app.post('/api/v1/auth/google', async (c) => {
    const ip = c.req.header('CF-Connecting-IP') ?? 'local';
    await perMinute(c.env, `signin:${(await sha256Hex(ip)).slice(0, 32)}`, 20);
    const { idToken } = await body(c, SignIn);
    const claims = await verifyGoogleIdToken(idToken, c.env, opts.getGoogleKey);
    const player = await playerForGoogle(c.env.DB, claims);
    const session = await issueSession(c.env.DB, player.id);
    return c.json({ token: session.token, expiresAt: session.expiresAt, player: { id: player.id, displayName: player.displayName, isNew: player.isNew } });
  });

  const authed: MiddlewareHandler<AppEnv> = async (c, next) => {
    const s = await resolveSession(c.env.DB, c.req.header('Authorization'));
    c.set('playerId', s.playerId);
    c.set('tokenHash', s.tokenHash);
    await next();
  };
  app.use('/api/v1/me', authed);
  app.use('/api/v1/auth/logout', authed);
  app.use('/api/v1/wallet', authed);
  app.use('/api/v1/inventory', authed);
  app.use('/api/v1/gacha/*', authed);
  app.use('/api/v1/mail', authed);
  app.use('/api/v1/progress', authed);
  app.use('/api/v1/progress/*', authed);
  app.use('/api/v1/save', authed);
  app.use('/api/v1/ads/status', authed);
  app.use('/api/v1/ads/begin', authed);
  app.use('/api/v1/shop/verify', authed);
  app.use('/api/v1/mail/*', authed);

  app.post('/api/v1/auth/logout', async (c) => {
    await revokeSession(c.env.DB, c.get('tokenHash'));
    return c.json({ ok: true });
  });

  app.get('/api/v1/me', async (c) => {
    const p = await c.env.DB.prepare('SELECT id, display_name, created_at FROM players WHERE id = ?1').bind(c.get('playerId')).first<{ id: string; display_name: string | null; created_at: string }>();
    return c.json({ id: p?.id, displayName: p?.display_name ?? null, createdAt: p?.created_at, billingTag: await billingTag(c.get('playerId')) });
  });

  app.get('/api/v1/wallet', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT currency, balance FROM wallets WHERE player_id = ?1 ORDER BY currency').bind(c.get('playerId')).all<{ currency: string; balance: number }>();
    return c.json({ wallets: Object.fromEntries(results.map((r) => [r.currency, r.balance])) });
  });

  app.get('/api/v1/inventory', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT item_type, item_id, copies, shards FROM player_items WHERE player_id = ?1 ORDER BY item_type, item_id').bind(c.get('playerId')).all();
    return c.json({ items: results });
  });

  app.get('/api/v1/banners', async (c) => {
    const banners = await activeBanners(c.env.DB);
    return c.json({ banners: banners.map((b) => disclosure(b.row, b.config)), serverTime: new Date().toISOString() }, 200, { 'Cache-Control': 'public, max-age=30' });
  });

  app.get('/api/v1/gacha/state', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT pity_group, pity5, pity4, lost FROM pity_state WHERE player_id = ?1 ORDER BY pity_group').bind(c.get('playerId')).all();
    return c.json({ pity: results });
  });

  app.post('/api/v1/gacha/pull', async (c) => {
    await requireFlag(c.env, 'gacha.enabled');
    await perMinute(c.env, `pull:${c.get('playerId')}`, 30);
    const input = await body(c, Pull);
    return c.json(await pullGacha(c.env.DB, c.get('playerId'), input));
  });

  app.get('/api/v1/gacha/history', async (c) => {
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50) || 50));
    const before = Number(c.req.query('before') ?? 0) || 0;
    const { results } = await c.env.DB
      .prepare(
        `SELECT id, banner_id, request_id, seq, pull_number, rarity, item_type, item_id, outcome, upgraded, duplicate, at FROM gacha_pulls
         WHERE player_id = ?1 AND (?2 = 0 OR id < ?2) ORDER BY id DESC LIMIT ?3`
      )
      .bind(c.get('playerId'), before, limit)
      .all();
    return c.json({ pulls: results, next: results.length === limit ? (results[results.length - 1] as { id: number }).id : null });
  });

  app.get('/api/v1/mail', async (c) => {
    await syncSubscriptionMail(c.env.DB, c.get('playerId')); // subscription half-day entitlements arrive as mail
    return c.json({ mail: await listMail(c.env.DB, c.get('playerId')) });
  });

  const MailId = z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
  app.post('/api/v1/mail/:id/read', async (c) => {
    const id = MailId.safeParse(c.req.param('id'));
    if (!id.success) throw new HttpError(400, 'bad_request', 'invalid mail id');
    await markRead(c.env.DB, c.get('playerId'), id.data);
    return c.json({ ok: true });
  });
  app.post('/api/v1/mail/:id/claim', async (c) => {
    await perMinute(c.env, `claim:${c.get('playerId')}`, 60);
    const id = MailId.safeParse(c.req.param('id'));
    if (!id.success) throw new HttpError(400, 'bad_request', 'invalid mail id');
    return c.json(await claimMail(c.env.DB, c.get('playerId'), id.data));
  });

  app.get('/api/v1/progress', async (c) => c.json(await getProgress(c.env.DB, c.get('playerId'))));

  app.post('/api/v1/progress/battle', async (c) => {
    await perMinute(c.env, `battle:${c.get('playerId')}`, 20);
    const input = await body(c, BattleSubmission, 64 * 1024);
    return c.json(await submitBattle(c.env, c.get('playerId'), input));
  });

  app.get('/api/v1/save', async (c) => c.json(await readSave(c.env.DB, c.get('playerId'))));
  app.put('/api/v1/save', async (c) => {
    await perMinute(c.env, `save:${c.get('playerId')}`, 30);
    const raw = await c.req.text();
    if (raw.length > 70_000) throw new HttpError(413, 'save_too_large', 'cloud save is limited to 64 KB');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'bad_request', 'invalid JSON');
    }
    return c.json(await writeSave(c.env.DB, c.get('playerId'), parsed));
  });

  app.get('/api/v1/ads/status', async (c) => c.json(await adStatus(c.env.DB, c.get('playerId'))));

  // step 1 of a rewarded view: the client gets a one-time nonce and passes it to AdMob as ServerSideVerificationOptions.customData
  app.post('/api/v1/ads/begin', async (c) => {
    await requireFlag(c.env, 'ads.rewarded.enabled');
    await perMinute(c.env, `adbegin:${c.get('playerId')}`, 10);
    return c.json(await beginAd(c.env.DB, c.get('playerId')));
  });

  // Google calls this URL after a rewarded ad; the signature (ECDSA, Google's key) proves it. Only OUR ad units may grant.
  app.get('/api/v1/ads/ssv', async (c) => {
    const units = (c.env.ADMOB_AD_UNIT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (units.length === 0) throw new HttpError(503, 'ads_not_configured', 'rewarded ads are not configured for this environment');
    const url = new URL(c.req.url);
    const ssv = await verifySsv(url.search, opts.admobKeys ?? googleKeyFetcher);
    // AdMob's "verify URL" button and test ads are signed with Google's test key: acknowledge, pay nothing
    if (ssv.viaTestKey) return c.json({ granted: false, reason: 'test_callback' });
    // AdMob's callback carries the numeric unit id (the part after the slash of ca-app-pub-<publisher>/<unit>); configuration may hold either form
    const unitId = (u: string): string => u.slice(u.lastIndexOf('/') + 1);
    if (!units.some((u) => unitId(u) === unitId(ssv.adUnit))) throw new HttpError(400, 'bad_ssv', 'ad unit is not ours');
    if (Math.abs(Date.now() - ssv.timestampMs) > AD.maxAgeMs) throw new HttpError(400, 'bad_ssv', 'callback is too old');
    if (!(await flagOn(c.env, 'ads.rewarded.enabled'))) return c.json({ granted: false, reason: 'disabled' });
    // 200 for every verified callback (Google retries other codes); the body says whether the view paid out
    return c.json(await grantAd(c.env.DB, ssv.userId, ssv.adUnit, ssv.transactionId, ssv.customData));
  });

  const playFor = (env: GameEnv): PlayClient => (opts.play ? opts.play(env) : new PlayApi(env));
  const Verify = z.object({ productId: z.string().regex(/^[a-z][a-z0-9_.]{1,99}$/), purchaseToken: z.string().min(10).max(4096) }).strict();

  app.get('/api/v1/shop/products', async (c) => c.json({ products: await listProducts(c.env.DB) }, 200, { 'Cache-Control': 'public, max-age=60' }));

  app.post('/api/v1/shop/verify', async (c) => {
    await requireFlag(c.env, 'shop.enabled');
    await perMinute(c.env, `verify:${c.get('playerId')}`, 20);
    const input = await body(c, Verify, 6000);
    return c.json(await verifyPurchase(c.env.DB, playFor(c.env), c.get('playerId'), input));
  });

  // Google Pub/Sub push (RTDN): refunds, revocations, renewals. Authenticated by the push OIDC token, never by the body.
  app.post('/api/v1/billing/rtdn', async (c) => {
    await authenticatePush(c.req.raw, c.env, opts.getGoogleKey);
    const raw = await c.req.text();
    if (raw.length > 64 * 1024) throw new HttpError(413, 'too_large', 'request body too large');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'bad_request', 'invalid JSON');
    }
    return c.json(await handleRtdn(c.env.DB, c.env, playFor(c.env), parsed));
  });
}
