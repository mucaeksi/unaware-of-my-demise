import type { Hono, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { JWTVerifyGetKey } from 'jose';
import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import { availablePanels, scheduledProducts } from '../content/presentation';
import { displayCatalog, operationCatalog, releaseScope, gearDefinition } from '../content/runtime-catalog';
import { d1RateLimit } from '../http';
import type { GameEnv } from '../env';
import { activeBanners, disclosure, pullGacha } from '../gacha/service';
import { PlayApi, type PlayClient } from '../billing/play';
import { authenticatePush, handleRtdn } from '../billing/rtdn';
import { billingTag, listProducts, syncSubscriptionMail } from '../billing/service';
import { verifyReceipt } from '../billing/recovery';
import { purchaseHistory } from '../billing/history';
import { adStatus, beginAd, grantAd, AD } from '../ads/service';
import { googleKeyFetcher, verifySsv, type SsvKeyFetcher } from '../ads/ssv';
import { BattleSubmission, getProgress, readSave, startBattle, submitBattle, writeSave } from '../progress/service';
import { completeStory, StoryCompletion } from '../progress/story';
import { listRecruitSelectors, RecruitSelection, selectRecruit } from '../recruitment/service';
import { listLibrary, readLibraryEntry } from '../library/service';
import { ascendGear, characterStats, dismantleGear, GearContext, EquipBody, equipGear, GearLevelBody, GearRequest, levelGear, listGear, LockBody, lockGear, rerollGear, unequipGear } from '../gear/service';
import { ascendCharacter, levelUpCharacter, LevelUpBody, listCharacters, RequestOnly, upgradeSkill } from '../progression/characters';
import { deleteAccount, exportAccount } from '../account/service';
import { EntryBody, getEntry, putEntry } from '../entry/service';
import { activateTeam, deleteTeam, listTeams, saveTeam, TeamBody } from '../teams/service';
import { claimTask, listTasks } from '../tasks/service';
import { claimMail, listMail, markRead } from '../mail/service';
import { issueSession, playerForGoogle, resolveSession, revokeSession, verifyGoogleIdToken } from './auth';
import { operationStatus } from './operations';

type AppEnv = { Bindings: GameEnv; Variables: { playerId: string; tokenHash: string } };
type App = Hono<AppEnv>;

const RequestId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
const SignIn = z.object({ idToken: z.string().min(100).max(8192) }).strict();
const Pull = z
  .object({ releaseId: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/).optional(), bannerId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), count: z.union([z.literal(1), z.literal(10)]), requestId: RequestId, target: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).optional() })
  .strict();

async function body<T>(c: { req: { text(): Promise<string> } }, schema: z.ZodType<T>, max = 8192 + 512, allowEmpty = false): Promise<T> {
  const raw = await c.req.text();
  if (raw.length > max) throw new HttpError(413, 'too_large', 'request body too large');
  try {
    return schema.parse(allowEmpty && !raw.trim() ? {} : JSON.parse(raw));
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

  const ReleaseId = z.string().regex(/^[a-z][a-z0-9_]{1,47}$/);
  const selectedRelease = (value?: string): string | undefined => {
    if (value === undefined) return undefined;
    const parsed = ReleaseId.safeParse(value);
    if (!parsed.success) throw new HttpError(400, 'bad_request', 'invalid release id');
    return parsed.data;
  };

  /** Public catalog: material definitions, gear definitions (compact) and the progression rules, so the client can show costs and names. */
  app.get('/api/v1/catalog', async (c) => {
    const db = c.env.DB;
    const catalog = await displayCatalog(c.env, selectedRelease(c.req.query('releaseId')));
    if (catalog) return c.json({ releaseId: catalog.releaseId, catalogSha256: catalog.sha256,
      items: catalog.data.items.filter((item) => item.status !== 'retired').map((item) => ({ item_id: item.item_id, name_en: item.name_en, kind: item.kind, rarity: item.rarity, xp_value: item.xp_value, consumable: item.consumable ? 1 : 0 })),
      gear: catalog.data.gear.filter((g) => g.status !== 'retired').map((g) => { const row = gearDefinition(g); return { gear_id: row.gear_id, slot: row.slot, name_en: row.name_en, rarity: row.rarity, family: row.family, tier: row.tier, set_id: row.set_id, owner_character_id: row.owner_character_id, level_cap: row.level_cap, base_json: row.base_json, growth_json: row.growth_json }; }),
      config: catalog.data.config }, 200, { 'Cache-Control': 'public, max-age=60' });
    const [items, gear, cfg] = await Promise.all([
      db.prepare("SELECT item_id, name_en, kind, rarity, xp_value, consumable FROM item_defs WHERE status <> 'retired' ORDER BY kind, item_id").all(),
      db.prepare("SELECT gear_id, slot, name_en, rarity, family, tier, set_id, owner_character_id, level_cap, base_json, growth_json FROM gear_defs WHERE status <> 'retired' ORDER BY slot, rarity DESC, gear_id").all(),
      db.prepare('SELECT key, value_json FROM game_config').all<{ key: string; value_json: string }>()
    ]);
    return c.json({ items: items.results, gear: gear.results, config: Object.fromEntries(cfg.results.map((r) => [r.key, JSON.parse(r.value_json)])) }, 200, { 'Cache-Control': 'public, max-age=60' });
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
    const player = await playerForGoogle(c.env.DB, claims, c.env);
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
  app.use('/api/v1/characters/*', authed);
  app.use('/api/v1/stacks', authed);
  app.use('/api/v1/recruitment/*', authed);
  app.use('/api/v1/presentation/*', authed);
  app.use('/api/v1/library', authed);
  app.use('/api/v1/library/*', authed);
  app.use('/api/v1/entry', authed);
  app.use('/api/v1/teams', authed);
  app.use('/api/v1/teams/*', authed);
  app.use('/api/v1/account', authed);
  app.use('/api/v1/account/*', authed);
  app.use('/api/v1/tasks', authed);
  app.use('/api/v1/tasks/*', authed);
  app.use('/api/v1/gear', authed);
  app.use('/api/v1/gear/*', authed);
  app.use('/api/v1/mail', authed);
  app.use('/api/v1/progress', authed);
  app.use('/api/v1/progress/*', authed);
  app.use('/api/v1/save', authed);
  app.use('/api/v1/ads/status', authed);
  app.use('/api/v1/ads/begin', authed);
  app.use('/api/v1/shop/verify', authed);
  app.use('/api/v1/shop/history', authed);
  app.use('/api/v1/mail/*', authed);
  app.use('/api/v1/operations/*', authed);

  app.get('/api/v1/operations/:id', async (c) => {
    const id = RequestId.safeParse(c.req.param('id'));
    const path = c.req.query('path');
    if (!id.success || !path || path.length > 200) throw new HttpError(400, 'bad_request', 'invalid operation identity or path');
    await perMinute(c.env, `operation-status:${c.get('playerId')}`, 60);
    return c.json(await operationStatus(c.env.DB, c.get('playerId'), id.data, path), 200, { 'Cache-Control': 'no-store' });
  });

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
    const catalog = await displayCatalog(c.env, selectedRelease(c.req.query('releaseId')));
    const banners = await activeBanners(c.env.DB, new Date(), catalog);
    return c.json({ banners: banners.map((b) => disclosure(b.row, b.config)), ...(catalog ? { releaseId: catalog.releaseId, catalogSha256: catalog.sha256 } : {}), serverTime: new Date().toISOString() }, 200, { 'Cache-Control': 'public, max-age=30' });
  });

  app.get('/api/v1/gacha/state', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT pity_group, pity5, pity4, lost FROM pity_state WHERE player_id = ?1 ORDER BY pity_group').bind(c.get('playerId')).all();
    return c.json({ pity: results });
  });

  app.post('/api/v1/gacha/pull', async (c) => {
    await requireFlag(c.env, 'gacha.enabled');
    await perMinute(c.env, `pull:${c.get('playerId')}`, 30);
    const input = await body(c, Pull);
    return c.json(await pullGacha(c.env.DB, c.get('playerId'), input, { scope: releaseScope(c.env, input.releaseId) }));
  });

  app.get('/api/v1/gacha/history', async (c) => {
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50) || 50));
    const before = Number(c.req.query('before') ?? 0) || 0;
    const { results } = await c.env.DB
      .prepare(
        `SELECT p.id, p.banner_id, p.request_id, p.seq, p.pull_number, p.rarity, p.item_type, p.item_id, p.outcome, p.upgraded, p.duplicate, p.at,
           json_extract(r.result_json, '$.releaseId') AS releaseId, json_extract(r.result_json, '$.catalogSha256') AS catalogSha256
         FROM gacha_pulls p LEFT JOIN gacha_requests r ON r.player_id = p.player_id AND r.request_id = p.request_id
         WHERE p.player_id = ?1 AND (?2 = 0 OR p.id < ?2) ORDER BY p.id DESC LIMIT ?3`
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
    const input = await body(c, z.object({ requestId: RequestId.optional() }).strict());
    return c.json(await claimMail(c.env.DB, c.get('playerId'), id.data, new Date(), input.requestId));
  });

  app.get('/api/v1/progress', async (c) => c.json(await getProgress(c.env.DB, c.get('playerId'))));
  app.get('/api/v1/library', async (c) => {
    const release = StoryCompletion.shape.releaseId.safeParse(c.req.query('releaseId'));
    if (!release.success) throw new HttpError(400, 'bad_request', 'invalid release id');
    await perMinute(c.env, `library:${c.get('playerId')}`, 60);
    return c.json(await listLibrary(c.env, c.get('playerId'), release.data), 200, { 'Cache-Control': 'no-store' });
  });
  app.get('/api/v1/library/:id', async (c) => {
    const release = StoryCompletion.shape.releaseId.safeParse(c.req.query('releaseId'));
    const entry = StoryCompletion.shape.nodeId.safeParse(c.req.param('id'));
    if (!release.success || !entry.success) throw new HttpError(400, 'bad_request', 'invalid library request');
    await perMinute(c.env, `library:${c.get('playerId')}`, 60);
    return c.json(await readLibraryEntry(c.env, c.get('playerId'), release.data, entry.data), 200, { 'Cache-Control': 'no-store' });
  });

  app.post('/api/v1/progress/story', async (c) => {
    await perMinute(c.env, `story:${c.get('playerId')}`, 60);
    return c.json(await completeStory(c.env, c.get('playerId'), await body(c, StoryCompletion, 4 * 1024)));
  });

  // step 1 of an owned-hero battle: the server freezes the party (team, gear, ranks, story loans) the client must fight with
  app.post('/api/v1/progress/battle/start', async (c) => {
    await perMinute(c.env, `battlestart:${c.get('playerId')}`, 30);
    const input = await body(c, z.object({ releaseId: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/), nodeId: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/) }).strict(), 4 * 1024);
    return c.json(await startBattle(c.env, c.get('playerId'), input));
  });

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
    // a rejected callback is logged with its reason (never the signature or user data) so a misconfigured AdMob setup can be diagnosed
    const ssv = await verifySsv(url.search, opts.admobKeys ?? googleKeyFetcher).catch((e: unknown) => {
      const p = url.searchParams;
      console.warn('ssv_rejected', JSON.stringify({ reason: e instanceof Error ? e.message : String(e), keyId: p.get('key_id'), adUnit: p.get('ad_unit'), params: [...p.keys()].join(','), queryLength: url.search.length }));
      throw e;
    });
    // AdMob's "verify URL" button and test ads are signed with Google's test key: acknowledge, pay nothing
    if (ssv.viaTestKey) return c.json({ granted: false, reason: 'test_callback' });
    // AdMob's callback carries the numeric unit id (the part after the slash of ca-app-pub-<publisher>/<unit>); configuration may hold either form
    const unitId = (u: string): string => u.slice(u.lastIndexOf('/') + 1);
    // AdMob's URL check can use a live verifier key with a placeholder unit (1234567890).
    // Acknowledge verified foreign units without granting or consuming a player's nonce.
    if (!units.some((u) => unitId(u) === unitId(ssv.adUnit))) {
      console.log('ssv_ignored', JSON.stringify({ reason: 'ad_unit_not_ours', adUnit: ssv.adUnit }));
      return c.json({ granted: false, reason: 'ad_unit_not_ours' });
    }
    if (Math.abs(Date.now() - ssv.timestampMs) > AD.maxAgeMs) throw new HttpError(400, 'bad_ssv', 'callback is too old');
    if (!(await flagOn(c.env, 'ads.rewarded.enabled'))) return c.json({ granted: false, reason: 'disabled' });
    // 200 for every verified callback (Google retries other codes); the body says whether the view paid out
    return c.json(await grantAd(c.env.DB, ssv.userId, ssv.adUnit, ssv.transactionId, ssv.customData));
  });

  const playFor = (env: GameEnv): PlayClient => (opts.play ? opts.play(env) : new PlayApi(env));
  const Verify = z.object({ productId: z.string().regex(/^[a-z][a-z0-9_.]{1,99}$/), purchaseToken: z.string().min(10).max(4096) }).strict();

  app.get('/api/v1/shop/products', async (c) => c.json({ products: await flagOn(c.env, 'shop.enabled') ? await scheduledProducts(c.env, await listProducts(c.env.DB), selectedRelease(c.req.query('releaseId'))) : [] }, 200, { 'Cache-Control': 'no-store' }));
  app.get('/api/v1/presentation/panels', async (c) => {
    const releaseId = selectedRelease(c.req.query('releaseId'));
    if (!releaseId) throw new HttpError(400, 'release_required', 'select a content release');
    await perMinute(c.env, `presentation:${c.get('playerId')}`, 60);
    return c.json(await availablePanels(c.env, c.get('playerId'), releaseId));
  });

  app.get('/api/v1/shop/history', async (c) => {
    const limit = z.coerce.number().int().min(1).max(30).safeParse(c.req.query('limit') ?? 30);
    if (!limit.success) throw new HttpError(400, 'bad_request', 'history limit must be between 1 and 30');
    await perMinute(c.env, `purchase-history:${c.get('playerId')}`, 30);
    return c.json(await purchaseHistory(c.env.DB, c.get('playerId'), limit.data), 200, { 'Cache-Control': 'no-store' });
  });

  app.post('/api/v1/shop/verify', async (c) => {
    // A sales kill flag cannot discard an obligation already confirmed by Google Play.
    await perMinute(c.env, `verify:${c.get('playerId')}`, 20);
    const input = await body(c, Verify, 6000);
    return c.json(await verifyReceipt(c.env, playFor(c.env), c.get('playerId'), input));
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

  app.get('/api/v1/characters/mine', async (c) => {
    const catalog = await operationCatalog(c.env.DB, c.get('playerId'), releaseScope(c.env, selectedRelease(c.req.query('releaseId'))));
    return c.json(await listCharacters(c.env.DB, c.get('playerId'), catalog));
  });
  app.get('/api/v1/stacks', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT item_id, qty FROM player_stacks WHERE player_id = ?1 AND qty > 0 ORDER BY item_id').bind(c.get('playerId')).all();
    return c.json({ stacks: results });
  });
  app.get('/api/v1/recruitment/selectors', async (c) => {
    const releaseId = RecruitSelection.shape.releaseId.safeParse(c.req.query('releaseId'));
    if (!releaseId.success) throw new HttpError(400, 'bad_request', 'invalid release id');
    await perMinute(c.env, `selectors:${c.get('playerId')}`, 60);
    return c.json(await listRecruitSelectors(c.env, c.get('playerId'), releaseId.data), 200, { 'Cache-Control': 'no-store' });
  });
  app.post('/api/v1/recruitment/:itemId', async (c) => {
    const itemId = c.req.param('itemId');
    if (!/^[a-z][a-z0-9_]{1,79}$/.test(itemId)) throw new HttpError(400, 'bad_request', 'invalid invitation id');
    await perMinute(c.env, `select-recruit:${c.get('playerId')}`, 30);
    return c.json(await selectRecruit(c.env, c.get('playerId'), itemId, await body(c, RecruitSelection, 4096)));
  });
  const CharId = /^[a-z][a-z0-9_]{1,79}$/;
  app.post('/api/v1/characters/:id/level-up', async (c) => {
    await perMinute(c.env, `levelup:${c.get('playerId')}`, 60);
    const id = c.req.param('id');
    if (!CharId.test(id)) throw new HttpError(400, 'bad_request', 'invalid character id');
    const input = await body(c, LevelUpBody);
    return c.json(await levelUpCharacter(c.env.DB, c.get('playerId'), id, input, releaseScope(c.env, input.releaseId)));
  });
  app.post('/api/v1/characters/:id/ascend', async (c) => {
    await perMinute(c.env, `ascend:${c.get('playerId')}`, 30);
    const id = c.req.param('id');
    if (!CharId.test(id)) throw new HttpError(400, 'bad_request', 'invalid character id');
    const input = await body(c, RequestOnly);
    return c.json(await ascendCharacter(c.env.DB, c.get('playerId'), id, input, releaseScope(c.env, input.releaseId)));
  });
  app.post('/api/v1/characters/:id/skills/:skillId/upgrade', async (c) => {
    await perMinute(c.env, `skill:${c.get('playerId')}`, 60);
    const id = c.req.param('id');
    const skillId = c.req.param('skillId');
    if (!CharId.test(id) || !/^[a-z][a-z0-9_]{1,119}$/.test(skillId)) throw new HttpError(400, 'bad_request', 'invalid id');
    const input = await body(c, RequestOnly);
    return c.json(await upgradeSkill(c.env.DB, c.get('playerId'), id, skillId, input, releaseScope(c.env, input.releaseId)));
  });

  app.get('/api/v1/entry', async (c) => c.json({ ...(await getEntry(c.env.DB, c.get('playerId'))), playerId: c.get('playerId') }));
  app.put('/api/v1/entry', async (c) => c.json({ ...(await putEntry(c.env.DB, c.get('playerId'), await body(c, EntryBody))), playerId: c.get('playerId') }));
  app.get('/api/v1/teams', async (c) => c.json(await listTeams(c.env.DB, c.get('playerId'))));
  app.put('/api/v1/teams/:slot', async (c) => {
    const input = await body(c, TeamBody);
    return c.json(await saveTeam(c.env.DB, c.get('playerId'), Number(c.req.param('slot')), input, releaseScope(c.env, input.releaseId)));
  });
  app.post('/api/v1/teams/:slot/activate', async (c) => {
    const input = await body(c, z.object({ releaseId: ReleaseId.optional() }).strict(), undefined, true);
    return c.json(await activateTeam(c.env.DB, c.get('playerId'), Number(c.req.param('slot')), releaseScope(c.env, input.releaseId)));
  });
  app.delete('/api/v1/teams/:slot', async (c) => c.json(await deleteTeam(c.env.DB, c.get('playerId'), Number(c.req.param('slot')), releaseScope(c.env, selectedRelease(c.req.query('releaseId'))))));
  app.get('/api/v1/account/export', async (c) => c.json(await exportAccount(c.env.DB, c.get('playerId'))));
  app.post('/api/v1/account/delete', async (c) => c.json(await deleteAccount(c.env.DB, c.get('playerId'), (await body(c, z.object({ confirm: z.string().max(20) }).strict())).confirm)));
  app.get('/api/v1/tasks', async (c) => c.json(await listTasks(c.env.DB, c.get('playerId'), Date.now(), releaseScope(c.env, selectedRelease(c.req.query('releaseId'))))));
  app.post('/api/v1/tasks/claim', async (c) => {
    const input = await body(c, z.object({ releaseId: ReleaseId.optional(), periodKey: z.string().regex(/^[dw]:[0-9T:-]{10,13}(:[a-z][a-z0-9_]{1,79})?$/), taskId: z.string().regex(/^_?[a-z][a-z0-9_]{1,79}$/), requestId: RequestId.optional() }).strict());
    return c.json(await claimTask(c.env.DB, c.get('playerId'), input, Date.now(), releaseScope(c.env, input.releaseId)));
  });
  app.get('/api/v1/gear', async (c) => {
    const catalog = await operationCatalog(c.env.DB, c.get('playerId'), releaseScope(c.env, selectedRelease(c.req.query('releaseId'))));
    return c.json({ gear: await listGear(c.env.DB, c.get('playerId'), catalog) });
  });
  app.get('/api/v1/characters/:id/stats', async (c) => {
    const catalog = await operationCatalog(c.env.DB, c.get('playerId'), releaseScope(c.env, selectedRelease(c.req.query('releaseId'))));
    return c.json(await characterStats(c.env.DB, c.get('playerId'), c.req.param('id'), catalog));
  });
  const GearId = (raw: string): number => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'bad_request', 'invalid gear id');
    return n;
  };
  app.post('/api/v1/gear/:id/equip', async (c) => {
    await perMinute(c.env, `gear:${c.get('playerId')}`, 120);
    const input = await body(c, EquipBody);
    return c.json(await equipGear(c.env.DB, c.get('playerId'), GearId(c.req.param('id')), input.characterId, releaseScope(c.env, input.releaseId)));
  });
  app.post('/api/v1/gear/:id/unequip', async (c) => {
    const input = await body(c, GearContext, undefined, true);
    return c.json(await unequipGear(c.env.DB, c.get('playerId'), GearId(c.req.param('id')), releaseScope(c.env, input.releaseId)));
  });
  app.post('/api/v1/gear/:id/lock', async (c) => {
    const input = await body(c, LockBody);
    return c.json(await lockGear(c.env.DB, c.get('playerId'), GearId(c.req.param('id')), input.locked, releaseScope(c.env, input.releaseId)));
  });
  app.post('/api/v1/gear/:id/level-up', async (c) => {
    await perMinute(c.env, `gear:${c.get('playerId')}`, 120);
    const input = await body(c, GearLevelBody);
    return c.json(await levelGear(c.env.DB, c.get('playerId'), GearId(c.req.param('id')), input, releaseScope(c.env, input.releaseId)));
  });
  app.post('/api/v1/gear/:id/ascend', async (c) => {
    const input = await body(c, GearRequest);
    return c.json(await ascendGear(c.env.DB, c.get('playerId'), GearId(c.req.param('id')), input, releaseScope(c.env, input.releaseId)));
  });
  app.post('/api/v1/gear/:id/dismantle', async (c) => {
    const input = await body(c, GearRequest);
    return c.json(await dismantleGear(c.env.DB, c.get('playerId'), GearId(c.req.param('id')), input, releaseScope(c.env, input.releaseId)));
  });
  app.post('/api/v1/gear/:id/reroll', async (c) => {
    const input = await body(c, GearRequest);
    return c.json(await rerollGear(c.env.DB, c.get('playerId'), GearId(c.req.param('id')), input, releaseScope(c.env, input.releaseId)));
  });
}
