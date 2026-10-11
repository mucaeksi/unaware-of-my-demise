import type { Context, Hono, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { analyzeBanner, analyzeFlow, BannerConfig, DEFAULT_FLOW, ProgressionConfig, simulateBanner } from '@uomd/economy';
import { atLeast, type AdminIdentity, type Role } from '../auth/access';
import { HttpError } from '../content/store';
import { audit, auditIfChanged, auditStatement } from '../db/audit';
import { applyLedger } from '../db/ledger';
import type { AdminEnv } from '../env';
import { NewMail, sendMail } from '../mail/service';
import { SubConfig } from '../billing/service';
import { RewardAttachment } from '@uomd/content-schema';

type Ctx = { Bindings: AdminEnv; Variables: { admin: AdminIdentity } };
type Guard = (min: Role) => MiddlewareHandler<Ctx>;

const PlayerId = z.string().regex(/^p_[0-9a-f]{32}$/);
const Reason = z.string().min(3).max(200);

async function body<T>(c: Context<Ctx>, schema: z.ZodType<T>, max = 64 * 1024): Promise<T> {
  const raw = await c.req.text();
  if (raw.length > max) throw new HttpError(413, 'too_large', 'request body too large');
  try {
    return schema.parse(JSON.parse(raw));
  } catch (e) {
    throw new HttpError(400, 'bad_request', e instanceof z.ZodError ? e.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : 'invalid JSON');
  }
}

/** Players, banners (+ simulator), shop, flags. Every write is role-gated, validated and audited in the same batch. */
export function registerOps(app: Hono<Ctx>, need: Guard): void {
  // ------------------------------------------------------------------ players
  app.get('/admin/api/players', need('viewer'), async (c) => {
    const q = (c.req.query('q') ?? '').trim().slice(0, 60);
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const { results } = await c.env.DB
      .prepare(
        `SELECT id, display_name, status, created_at, last_seen_at FROM players
         WHERE (?1 = '' OR id LIKE ?2 ESCAPE '\\' OR display_name LIKE ?2 ESCAPE '\\') ORDER BY created_at DESC LIMIT 25`
      )
      .bind(q, like)
      .all();
    return c.json({ players: results });
  });

  app.get('/admin/api/players/:id', need('viewer'), async (c) => {
    const id = PlayerId.safeParse(c.req.param('id'));
    if (!id.success) throw new HttpError(400, 'bad_request', 'invalid player id');
    const db = c.env.DB;
    const player = await db.prepare('SELECT id, display_name, status, created_at, last_seen_at FROM players WHERE id = ?1').bind(id.data).first();
    if (!player) throw new HttpError(404, 'no_such_player', 'player not found');
    const [wallets, items, ledger, pulls, pity, purchases, progress, sessions, mail] = await Promise.all([
      db.prepare('SELECT currency, balance FROM wallets WHERE player_id = ?1').bind(id.data).all(),
      db.prepare('SELECT item_type, item_id, copies, shards FROM player_items WHERE player_id = ?1 ORDER BY item_id').bind(id.data).all(),
      db.prepare('SELECT id, at, currency, delta, reason FROM ledger WHERE player_id = ?1 ORDER BY id DESC LIMIT 25').bind(id.data).all(),
      db.prepare('SELECT id, at, banner_id, pull_number, rarity, item_id, outcome, duplicate FROM gacha_pulls WHERE player_id = ?1 ORDER BY id DESC LIMIT 25').bind(id.data).all(),
      db.prepare('SELECT pity_group, pity5, pity4, lost FROM pity_state WHERE player_id = ?1').bind(id.data).all(),
      db.prepare('SELECT order_id, product_id, kind, state, period_end, unrecovered, granted_at FROM purchases WHERE player_id = ?1 ORDER BY granted_at DESC LIMIT 25').bind(id.data).all(),
      db.prepare('SELECT node_id, stars, clears FROM player_progress WHERE player_id = ?1 ORDER BY node_id').bind(id.data).all(),
      db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?1 AND revoked_at IS NULL AND expires_at > ?2').bind(id.data, new Date().toISOString()).first<{ n: number }>(),
      db.prepare('SELECT id, kind, title, created_at, claimed_at FROM mail WHERE player_id = ?1 ORDER BY id DESC LIMIT 25').bind(id.data).all()
    ]);
    return c.json({ player, wallets: wallets.results, items: items.results, ledger: ledger.results, pulls: pulls.results, pity: pity.results, purchases: purchases.results, progress: progress.results, activeSessions: sessions?.n ?? 0, mail: mail.results });
  });

  const Compensation = z.object({ mail: NewMail, reason: Reason }).strict();
  app.post('/admin/api/players/:id/mail', need('operator'), async (c) => {
    const id = PlayerId.safeParse(c.req.param('id'));
    if (!id.success) throw new HttpError(400, 'bad_request', 'invalid player id');
    const b = await body(c, Compensation);
    const who = c.get('admin').identity;
    if (!(await c.env.DB.prepare('SELECT 1 AS ok FROM players WHERE id = ?1').bind(id.data).first())) throw new HttpError(404, 'no_such_player', 'player not found');
    // grants above this size need an owner (compensation is real money's worth)
    const big = b.mail.attachments.some((a) => a.type === 'currency' && a.amount > 5000);
    if (big && !atLeast(c.get('admin').role, 'owner')) throw new HttpError(403, 'insufficient_role', 'premium grants above 5000 need an owner');
    const sent = await sendMail(c.env.DB, id.data, b.mail, who);
    await audit(c.env.DB, who, 'player.mail', id.data, { mailId: sent.id, reason: b.reason, attachments: b.mail.attachments });
    return c.json(sent, 201);
  });

  const Adjust = z.object({ currency: z.literal('eclipse_token'), delta: z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0), reason: Reason, requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }).strict();
  app.post('/admin/api/players/:id/adjust', need('owner'), async (c) => {
    const id = PlayerId.safeParse(c.req.param('id'));
    if (!id.success) throw new HttpError(400, 'bad_request', 'invalid player id');
    const b = await body(c, Adjust);
    const who = c.get('admin').identity;
    if (!(await c.env.DB.prepare('SELECT 1 AS ok FROM players WHERE id = ?1').bind(id.data).first())) throw new HttpError(404, 'no_such_player', 'player not found');
    const r = await applyLedger(c.env.DB, { playerId: id.data, currency: b.currency, delta: b.delta, reason: `admin:${b.reason}`.slice(0, 200), idempotencyKey: `admin:${id.data}:${b.requestId}` });
    if (!r.applied && r.reason === 'insufficient_funds') throw new HttpError(409, 'insufficient_funds', 'the balance would become negative');
    if (!r.applied && r.reason === 'idempotency_conflict') throw new HttpError(409, 'request_id_reused', 'this requestId was used for a different adjustment');
    if (r.applied) await audit(c.env.DB, who, 'player.adjust', id.data, { currency: b.currency, delta: b.delta, reason: b.reason });
    return c.json({ applied: r.applied, balance: r.balance });
  });

  const Status = z.object({ status: z.enum(['active', 'banned']), reason: Reason }).strict();
  app.post('/admin/api/players/:id/status', need('owner'), async (c) => {
    const id = PlayerId.safeParse(c.req.param('id'));
    if (!id.success) throw new HttpError(400, 'bad_request', 'invalid player id');
    const b = await body(c, Status);
    const who = c.get('admin').identity;
    const db = c.env.DB;
    const res = await db.batch([
      db.prepare("UPDATE players SET status = ?2 WHERE id = ?1 AND status IN ('active','banned')").bind(id.data, b.status),
      auditIfChanged(db, who, `player.${b.status === 'banned' ? 'ban' : 'unban'}`, id.data, { reason: b.reason }),
      db.prepare("UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE player_id = ?1 AND ?2 = 'banned' AND revoked_at IS NULL").bind(id.data, b.status)
    ]);
    if (res[0]?.meta.changes !== 1) throw new HttpError(404, 'no_such_player', 'player not found or already deleted');
    return c.json({ id: id.data, status: b.status });
  });

  // ------------------------------------------------------------------ banners
  const itemsExist = async (db: D1Database, cfg: BannerConfig): Promise<void> => {
    const ids = [...cfg.pools.fiveFeatured, ...cfg.pools.fiveOther, ...cfg.pools.four, ...cfg.pools.three];
    const results: { id: string; rarity: number; status: string }[] = [];
    // D1 allows at most 100 bound variables per statement: weapon pools have 160+ ids, so look them up in chunks
    for (let i = 0; i < ids.length; i += 80) {
      const part = ids.slice(i, i + 80);
      const marks = part.map(() => '?').join(',');
      const q = cfg.kind === 'character' ? `SELECT id AS id, rarity, status FROM characters WHERE id IN (${marks})` : `SELECT gear_id AS id, rarity, status FROM gear_defs WHERE slot = 'weapon' AND gear_id IN (${marks})`;
      results.push(...(await db.prepare(q).bind(...part).all<{ id: string; rarity: number; status: string }>()).results);
    }
    const known = new Map(results.map((r) => [r.id, r]));
    const bad = ids.filter((i) => !known.has(i) || known.get(i)?.status === 'retired');
    if (bad.length) throw new HttpError(422, 'unknown_items', `unknown or retired ${cfg.kind === 'character' ? 'characters' : 'weapons'}: ${bad.slice(0, 5).join(', ')}`);
    const wrong = [
      ...cfg.pools.fiveFeatured.concat(cfg.pools.fiveOther).filter((i) => known.get(i)?.rarity !== 5).map((i) => `${i} is not 5★`),
      ...cfg.pools.four.filter((i) => known.get(i)?.rarity !== 4).map((i) => `${i} is not 4★`),
      ...cfg.pools.three.filter((i) => known.get(i)?.rarity !== 3).map((i) => `${i} is not 3★`)
    ];
    if (wrong.length) throw new HttpError(422, 'wrong_rarity', wrong.slice(0, 5).join('; '));
  };

  app.get('/admin/api/banners', need('viewer'), async (c) => {
    const { results } = await c.env.DB.prepare('SELECT id, title_en, config_json, starts_at, ends_at, status, version, updated_at, updated_by FROM banners ORDER BY id').all<{ id: string; config_json: string } & Record<string, unknown>>();
    return c.json({
      banners: results.map(({ config_json, ...rest }) => {
        const config = BannerConfig.parse(JSON.parse(config_json));
        const a = analyzeBanner(config);
        return { ...rest, config, analysis: { consolidatedFiveStarRate: a.consolidatedFiveStarRate, expectedPullsPerFiveStar: a.expectedPullsPerFiveStar, expectedPullsPerTarget: a.expectedPullsPerTarget, worstCasePullsForTarget: a.worstCasePullsForTarget } };
      })
    });
  });

  const BannerBody = z
    .object({ title_en: z.string().min(2).max(80), config: z.unknown(), expectedVersion: z.number().int().min(0) })
    .strict();
  app.put('/admin/api/banners/:id', need('operator'), async (c) => {
    const id = c.req.param('id');
    const b = await body(c, BannerBody);
    const cfg = BannerConfig.safeParse(b.config);
    if (!cfg.success) throw new HttpError(422, 'invalid_banner', cfg.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    if (cfg.data.id !== id) throw new HttpError(422, 'invalid_banner', 'config.id must equal the URL id');
    await itemsExist(c.env.DB, cfg.data);
    const who = c.get('admin').identity;
    const db = c.env.DB;
    const text = JSON.stringify(cfg.data);
    const res =
      b.expectedVersion === 0
        ? await db.batch([
            db.prepare("INSERT INTO banners (id, title_en, config_json, status, updated_by) VALUES (?1, ?2, ?3, 'draft', ?4) ON CONFLICT (id) DO NOTHING").bind(id, b.title_en, text, who),
            auditIfChanged(db, who, 'banner.create', id, { title: b.title_en })
          ])
        : await db.batch([
            // only drafts are editable: a live banner's rates must never change under players' feet (clone it instead)
            db.prepare("UPDATE banners SET title_en = ?2, config_json = ?3, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_by = ?4 WHERE id = ?1 AND version = ?5 AND status = 'draft'").bind(id, b.title_en, text, who, b.expectedVersion),
            auditIfChanged(db, who, 'banner.update', id, { expectedVersion: b.expectedVersion })
          ]);
    if (res[0]?.meta.changes !== 1) {
      const row = await db.prepare('SELECT version, status FROM banners WHERE id = ?1').bind(id).first<{ version: number; status: string }>();
      if (b.expectedVersion === 0 && row) throw new HttpError(409, 'exists', 'a banner with this id already exists');
      if (!row) throw new HttpError(404, 'no_such_banner', 'banner not found');
      if (row.status !== 'draft') throw new HttpError(409, 'not_editable', `a ${row.status} banner cannot be edited; clone it as a new draft`);
      throw new HttpError(409, 'version_conflict', `banner changed since version ${b.expectedVersion} (now ${row.version})`);
    }
    return c.json({ id, version: b.expectedVersion + 1 });
  });

  const Schedule = z.object({ action: z.enum(['activate', 'retire']), startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional() }).strict();
  app.post('/admin/api/banners/:id/state', need('operator'), async (c) => {
    const id = c.req.param('id');
    const b = await body(c, Schedule);
    const db = c.env.DB;
    const who = c.get('admin').identity;
    const row = await db.prepare('SELECT config_json, status FROM banners WHERE id = ?1').bind(id).first<{ config_json: string; status: string }>();
    if (!row) throw new HttpError(404, 'no_such_banner', 'banner not found');
    if (b.action === 'activate') {
      if (row.status === 'retired') throw new HttpError(409, 'retired', 'a retired banner cannot be reactivated; clone it');
      if (b.startsAt && b.endsAt && b.endsAt <= b.startsAt) throw new HttpError(422, 'bad_window', 'endsAt must be after startsAt');
      const cfg = BannerConfig.parse(JSON.parse(row.config_json));
      await itemsExist(db, cfg);
    }
    const res = await db.batch([
      b.action === 'activate'
        ? db.prepare("UPDATE banners SET status = 'active', starts_at = ?2, ends_at = ?3, version = version + 1, updated_by = ?4 WHERE id = ?1 AND status IN ('draft','active')").bind(id, b.startsAt ?? null, b.endsAt ?? null, who)
        : db.prepare("UPDATE banners SET status = 'retired', version = version + 1, updated_by = ?2 WHERE id = ?1 AND status <> 'retired'").bind(id, who),
      auditIfChanged(db, who, `banner.${b.action}`, id, { startsAt: b.startsAt ?? null, endsAt: b.endsAt ?? null })
    ]);
    if (res[0]?.meta.changes !== 1) throw new HttpError(409, 'no_change', 'banner is already in that state');
    return c.json({ id, status: b.action === 'activate' ? 'active' : 'retired' });
  });

  const Sim = z
    .object({ config: z.unknown().optional(), bannerId: z.string().optional(), accounts: z.number().int().min(1).max(20_000).default(2000), pullsPerAccount: z.number().int().min(1).max(500).default(200), seed: z.number().int().min(0).max(2 ** 31).default(1), target: z.string().optional() })
    .strict();
  app.post('/admin/api/banners/simulate', need('viewer'), async (c) => {
    const b = await body(c, Sim);
    if (b.accounts * b.pullsPerAccount > 1_500_000) throw new HttpError(422, 'too_large', 'accounts x pulls is limited to 1,500,000 per request');
    let raw = b.config;
    if (!raw && b.bannerId) {
      const row = await c.env.DB.prepare('SELECT config_json FROM banners WHERE id = ?1').bind(b.bannerId).first<{ config_json: string }>();
      if (!row) throw new HttpError(404, 'no_such_banner', 'banner not found');
      raw = JSON.parse(row.config_json);
    }
    const cfg = BannerConfig.safeParse(raw);
    if (!cfg.success) throw new HttpError(422, 'invalid_banner', cfg.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    return c.json({ exact: analyzeBanner(cfg.data), simulated: simulateBanner(cfg.data, { accounts: b.accounts, pullsPerAccount: b.pullsPerAccount, seed: b.seed, ...(b.target ? { target: b.target } : {}) }) });
  });

  // ------------------------------------------------------------------ economy model (single currency, D-17)
  const Flow = z
    .object({
      days: z.number().int().min(1).max(365).default(30),
      startBalance: z.number().min(0).max(1e9).default(0),
      income: z.object({ tasks: z.number().min(0).max(1e6), weekly: z.number().min(0).max(1e6), ads: z.number().min(0).max(1e6), subscription: z.number().min(0).max(1e6) }).strict().default(DEFAULT_FLOW.income),
      pullCost: z.number().int().min(1).max(1e6).default(DEFAULT_FLOW.pullCost),
      upgradeStepFee: z.number().min(0).max(1e9).default(DEFAULT_FLOW.upgradeStepFee),
      upgradeStepsWantedPerDay: z.number().min(0).max(1000).default(DEFAULT_FLOW.upgradeStepsWantedPerDay),
      upgradeStepsAvailable: z.number().int().min(0).max(1e6).default(DEFAULT_FLOW.upgradeStepsAvailable),
      shopSpendPerDay: z.number().min(0).max(1e9).default(0)
    })
    .strict();
  app.get('/admin/api/economy/defaults', need('viewer'), (c) => c.json({ model: DEFAULT_FLOW }));
  app.post('/admin/api/economy/flow', need('viewer'), async (c) => c.json(analyzeFlow(await body(c, Flow))));

  // ------------------------------------------------------------------ catalog and tunable rules
  app.get('/admin/api/catalog/summary', need('viewer'), async (c) => {
    const db = c.env.DB;
    const [items, gear, sets] = await Promise.all([
      db.prepare('SELECT kind, COUNT(*) AS n FROM item_defs GROUP BY kind ORDER BY kind').all(),
      db.prepare('SELECT slot, rarity, COUNT(*) AS n FROM gear_defs GROUP BY slot, rarity ORDER BY slot, rarity').all(),
      db.prepare('SELECT set_id, name_en, pieces_for_bonus FROM accessory_sets ORDER BY set_id').all()
    ]);
    return c.json({ items: items.results, gear: gear.results, sets: sets.results });
  });
  app.get('/admin/api/catalog/items', need('viewer'), async (c) => c.json({ items: (await c.env.DB.prepare('SELECT item_id, name_en, kind, rarity, stack_cap, xp_value, consumable, status, version FROM item_defs ORDER BY kind, item_id').all()).results }));
  app.get('/admin/api/catalog/gear', need('viewer'), async (c) => {
    const slot = c.req.query('slot');
    const { results } = await c.env.DB
      .prepare('SELECT gear_id, slot, name_en, rarity, family, tier, set_id, owner_character_id, banner_id, level_cap, status, version FROM gear_defs WHERE (?1 IS NULL OR slot = ?1) ORDER BY slot, rarity DESC, gear_id LIMIT 400')
      .bind(slot && ['weapon', 'armor', 'necklace', 'ring'].includes(slot) ? slot : null)
      .all();
    return c.json({ gear: results });
  });
  const ItemPatch = z.object({ expectedVersion: z.number().int().min(1), name_en: z.string().min(1).max(80).optional(), status: z.enum(['active', 'hidden', 'retired']).optional(), xp_value: z.number().int().min(0).max(10_000_000).nullable().optional() }).strict();
  app.patch('/admin/api/catalog/items/:id', need('operator'), async (c) => {
    const id = c.req.param('id');
    const p = await body(c, ItemPatch);
    const who = c.get('admin').identity;
    const db = c.env.DB;
    const res = await db.batch([
      db
        .prepare("UPDATE item_defs SET name_en = COALESCE(?3, name_en), status = COALESCE(?4, status), xp_value = CASE WHEN ?5 = 1 THEN ?6 ELSE xp_value END, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_by = ?7 WHERE item_id = ?1 AND version = ?2")
        .bind(id, p.expectedVersion, p.name_en ?? null, p.status ?? null, p.xp_value !== undefined ? 1 : 0, p.xp_value ?? null, who),
      auditIfChanged(db, who, 'catalog.item', id, { ...p })
    ]);
    if (res[0]?.meta.changes !== 1) throw new HttpError(409, 'version_conflict', 'item not found or changed since you loaded it');
    return c.json({ item_id: id });
  });

  const CONFIG_SCHEMAS: Record<string, z.ZodType<unknown>> = { progression: ProgressionConfig, gear: z.object({ note: z.string().max(400).default(''), roleStat: z.record(z.string(), z.string()), equipSlots: z.array(z.enum(['weapon', 'armor', 'necklace', 'ring'])).min(1), rerollCost: z.object({ itemId: z.string(), quantityByRarity: z.record(z.string(), z.number().int().min(1)) }).strict() }).strict() };
  app.get('/admin/api/config/:key', need('viewer'), async (c) => {
    const row = await c.env.DB.prepare('SELECT key, value_json, version, updated_at, updated_by FROM game_config WHERE key = ?1').bind(c.req.param('key')).first<{ key: string; value_json: string; version: number; updated_at: string; updated_by: string }>();
    if (!row) throw new HttpError(404, 'no_such_config', 'unknown config key');
    return c.json({ key: row.key, value: JSON.parse(row.value_json), version: row.version, updated_at: row.updated_at, updated_by: row.updated_by });
  });
  app.put('/admin/api/config/:key', need('operator'), async (c) => {
    const key = c.req.param('key');
    const schema = CONFIG_SCHEMAS[key];
    if (!schema) throw new HttpError(404, 'no_such_config', 'unknown config key');
    const b = await body(c, z.object({ value: z.unknown(), expectedVersion: z.number().int().min(1) }).strict(), 100_000);
    const parsed = schema.safeParse(b.value);
    if (!parsed.success) throw new HttpError(422, 'invalid_config', parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    const who = c.get('admin').identity;
    const db = c.env.DB;
    const res = await db.batch([
      db.prepare("UPDATE game_config SET value_json = ?2, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_by = ?3 WHERE key = ?1 AND version = ?4").bind(key, JSON.stringify(parsed.data), who, b.expectedVersion),
      auditIfChanged(db, who, 'config.update', key, { expectedVersion: b.expectedVersion })
    ]);
    if (res[0]?.meta.changes !== 1) throw new HttpError(409, 'version_conflict', 'config changed since you loaded it');
    return c.json({ key, version: b.expectedVersion + 1 });
  });

  // ------------------------------------------------------------------ shop
  app.get('/admin/api/products', need('viewer'), async (c) => {
    const { results } = await c.env.DB.prepare('SELECT product_id, kind, title_en, grants, sub_config, active, updated_at, updated_by FROM shop_products ORDER BY product_id').all();
    return c.json({ products: results });
  });

  const Product = z
    .object({ kind: z.enum(['consumable', 'subscription']), title_en: z.string().min(2).max(80), grants: z.array(RewardAttachment).max(8).default([]), sub_config: SubConfig.optional(), active: z.boolean() })
    .strict()
    .refine((p) => (p.kind === 'subscription' ? Boolean(p.sub_config) : p.grants.length > 0), { message: 'a consumable needs grants; a subscription needs sub_config' });
  app.put('/admin/api/products/:id', need('owner'), async (c) => {
    const id = c.req.param('id');
    if (!/^[a-z][a-z0-9_.]{1,99}$/.test(id)) throw new HttpError(400, 'bad_request', 'invalid product id');
    const p = await body(c, Product);
    const who = c.get('admin').identity;
    const db = c.env.DB;
    await db.batch([
      db
        .prepare(
          `INSERT INTO shop_products (product_id, kind, title_en, grants, sub_config, active, updated_by) VALUES (?1,?2,?3,?4,?5,?6,?7)
           ON CONFLICT (product_id) DO UPDATE SET title_en = excluded.title_en, grants = excluded.grants, sub_config = excluded.sub_config, active = excluded.active, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_by = excluded.updated_by
           WHERE shop_products.kind = excluded.kind`
        )
        .bind(id, p.kind, p.title_en, JSON.stringify(p.grants), p.sub_config ? JSON.stringify(p.sub_config) : null, p.active ? 1 : 0, who),
      auditStatement(db, who, 'product.set', id, { kind: p.kind, active: p.active, grants: p.grants })
    ]);
    return c.json({ product_id: id });
  });

  app.get('/admin/api/purchases', need('viewer'), async (c) => {
    const { results } = await c.env.DB.prepare("SELECT order_id, player_id, product_id, kind, state, period_end, unrecovered, granted_at, refunded_at FROM purchases ORDER BY granted_at DESC LIMIT 100").all();
    const refunds = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM purchases WHERE state = 'refunded' AND unrecovered <> '{}'").first<{ n: number }>();
    return c.json({ purchases: results, refundsWithUnrecovered: refunds?.n ?? 0 });
  });

  app.get('/admin/api/ads/summary', need('viewer'), async (c) => {
    const { results } = await c.env.DB.prepare('SELECT day, COUNT(*) AS views, COUNT(DISTINCT player_id) AS players, SUM(amount) AS tokens FROM ad_rewards GROUP BY day ORDER BY day DESC LIMIT 14').all();
    return c.json({ days: results });
  });

  // ------------------------------------------------------------------ feature flags
  app.get('/admin/api/flags', need('viewer'), async (c) => {
    const { results } = await c.env.DB.prepare('SELECT key, enabled, value_json, note, version, updated_at, updated_by FROM feature_flags ORDER BY key').all();
    return c.json({ flags: results });
  });
  const Flag = z.object({ enabled: z.boolean(), value: z.unknown().optional(), note: z.string().max(200).default(''), expectedVersion: z.number().int().min(0) }).strict();
  app.put('/admin/api/flags/:key', need('operator'), async (c) => {
    const key = c.req.param('key');
    if (!/^[a-z][a-z0-9_.]{1,63}$/.test(key)) throw new HttpError(400, 'bad_request', 'invalid flag key');
    const b = await body(c, Flag);
    const value = JSON.stringify(b.value ?? null);
    if (value.length > 2000) throw new HttpError(413, 'too_large', 'flag value is limited to 2000 characters');
    const who = c.get('admin').identity;
    const db = c.env.DB;
    const res =
      b.expectedVersion === 0
        ? await db.batch([db.prepare('INSERT INTO feature_flags (key, enabled, value_json, note, updated_by) VALUES (?1,?2,?3,?4,?5) ON CONFLICT (key) DO NOTHING').bind(key, b.enabled ? 1 : 0, value, b.note, who), auditIfChanged(db, who, 'flag.create', key, { enabled: b.enabled })])
        : await db.batch([
            db.prepare("UPDATE feature_flags SET enabled = ?2, value_json = ?3, note = ?4, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_by = ?5 WHERE key = ?1 AND version = ?6").bind(key, b.enabled ? 1 : 0, value, b.note, who, b.expectedVersion),
            auditIfChanged(db, who, 'flag.update', key, { enabled: b.enabled, expectedVersion: b.expectedVersion })
          ]);
    if (res[0]?.meta.changes !== 1) throw new HttpError(409, 'version_conflict', 'flag changed or already exists; reload and retry');
    return c.json({ key, version: b.expectedVersion + 1 });
  });

  // ------------------------------------------------------------------ development tracker (design feedback loop)
  app.get('/admin/api/dev/notes', need('viewer'), async (c) => {
    const st = c.req.query('status');
    const { results } = await c.env.DB
      .prepare("SELECT id, area, kind, body, status, resolution, created_by, created_at, updated_by, updated_at FROM dev_notes WHERE (?1 IS NULL OR status = ?1) ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, id DESC LIMIT 200")
      .bind(st && ['open', 'in_progress', 'done', 'wontfix'].includes(st) ? st : null)
      .all();
    return c.json({ notes: results });
  });

  const NewNote = z.object({ area: z.string().min(2).max(60), kind: z.enum(['feedback', 'change_request', 'approved', 'question', 'idea']), body: z.string().min(1).max(4000) }).strict();
  app.post('/admin/api/dev/notes', need('viewer'), async (c) => {
    const b = await body(c, NewNote);
    const who = c.get('admin').identity;
    const row = await c.env.DB.prepare('INSERT INTO dev_notes (area, kind, body, created_by) VALUES (?1, ?2, ?3, ?4) RETURNING id').bind(b.area, b.kind, b.body, who).first<{ id: number }>();
    await audit(c.env.DB, who, 'devnote.create', String(row?.id), { area: b.area, kind: b.kind });
    return c.json({ id: row?.id }, 201);
  });

  const NoteState = z.object({ status: z.enum(['open', 'in_progress', 'done', 'wontfix']), resolution: z.string().max(2000).default('') }).strict();
  app.patch('/admin/api/dev/notes/:id', need('operator'), async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'bad_request', 'invalid note id');
    const b = await body(c, NoteState);
    const who = c.get('admin').identity;
    const db = c.env.DB;
    const res = await db.batch([
      db.prepare("UPDATE dev_notes SET status = ?2, resolution = ?3, updated_by = ?4, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1").bind(id, b.status, b.resolution, who),
      auditIfChanged(db, who, 'devnote.status', String(id), { status: b.status })
    ]);
    if (res[0]?.meta.changes !== 1) throw new HttpError(404, 'no_such_note', 'note not found');
    return c.json({ id, status: b.status });
  });
}
