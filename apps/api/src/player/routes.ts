import type { Hono, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { JWTVerifyGetKey } from 'jose';
import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import { d1RateLimit } from '../http';
import type { GameEnv } from '../env';
import { activeBanners, convertEclipseToFates, disclosure, pullGacha } from '../gacha/service';
import { issueSession, playerForGoogle, resolveSession, revokeSession, verifyGoogleIdToken } from './auth';

type AppEnv = { Bindings: GameEnv; Variables: { playerId: string; tokenHash: string } };
type App = Hono<AppEnv>;

const RequestId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
const SignIn = z.object({ idToken: z.string().min(100).max(8192) }).strict();
const Pull = z
  .object({ bannerId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), count: z.union([z.literal(1), z.literal(10)]), requestId: RequestId, target: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).optional() })
  .strict();
const Convert = z.object({ count: z.number().int().min(1).max(100), requestId: RequestId }).strict();

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
export function registerPlayerRoutes(app: App, opts: { getGoogleKey?: JWTVerifyGetKey } = {}): void {
  const perMinute = async (env: GameEnv, key: string, limit: number): Promise<void> => {
    if (!(await d1RateLimit(env.DB, `${key}`.slice(0, 80), limit, 60))) throw new HttpError(429, 'rate_limited', 'too many requests');
  };

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
  app.use('/api/v1/economy/*', authed);

  app.post('/api/v1/auth/logout', async (c) => {
    await revokeSession(c.env.DB, c.get('tokenHash'));
    return c.json({ ok: true });
  });

  app.get('/api/v1/me', async (c) => {
    const p = await c.env.DB.prepare('SELECT id, display_name, created_at FROM players WHERE id = ?1').bind(c.get('playerId')).first<{ id: string; display_name: string | null; created_at: string }>();
    return c.json({ id: p?.id, displayName: p?.display_name ?? null, createdAt: p?.created_at });
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

  app.post('/api/v1/economy/convert-fates', async (c) => {
    await perMinute(c.env, `convert:${c.get('playerId')}`, 30);
    const input = await body(c, Convert);
    return c.json(await convertEclipseToFates(c.env.DB, c.get('playerId'), input.count, input.requestId));
  });
}
