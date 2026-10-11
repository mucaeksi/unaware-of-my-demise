import type { Hono, MiddlewareHandler } from 'hono';
import type { AdminEnv } from '../env';
import type { AdminIdentity, Role } from '../auth/access';
import { HttpError } from '../content/store';

type Ctx = { Bindings: AdminEnv; Variables: { admin: AdminIdentity } };
function operationDetail(raw: string): unknown {
  try { return JSON.parse(raw) as unknown; } catch { return { unavailable: true }; }
}
export function registerMonitoring(app: Hono<Ctx>, need: (role: Role) => MiddlewareHandler<Ctx>): void {
  app.get('/admin/api/monitoring', need('viewer'), async (c) => {
    const category = c.req.query('category') ?? 'all';
    if (!['all', 'ads', 'billing', 'api'].includes(category)) throw new HttpError(400, 'bad_request', 'unknown monitoring category');
    const db = c.env.DB;
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const [players, wallets, flows, breakdown, pulls, ads, purchases, events, counts, ops, notes, audit] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END) AS new24h, SUM(CASE WHEN last_seen_at >= ?1 AND status = 'active' THEN 1 ELSE 0 END) AS active24h, SUM(CASE WHEN status = 'banned' THEN 1 ELSE 0 END) AS banned FROM players").bind(since).first(),
      db.prepare('SELECT currency, SUM(balance) AS balance FROM wallets GROUP BY currency').all(),
      db.prepare('SELECT currency, SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS earned, SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS spent, COUNT(*) AS transactions FROM ledger WHERE at >= ?1 GROUP BY currency').bind(since).all(),
      db.prepare("SELECT CASE WHEN instr(reason, ':') > 0 THEN substr(reason, 1, instr(reason, ':') - 1) ELSE reason END AS source, SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS earned, SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS spent FROM ledger WHERE at >= ?1 GROUP BY source ORDER BY earned + spent DESC LIMIT 15").bind(since).all(),
      db.prepare('SELECT COUNT(*) AS pulls, COUNT(DISTINCT player_id) AS players FROM gacha_pulls WHERE at >= ?1').bind(since).first(),
      db.prepare('SELECT COUNT(*) AS grants, COALESCE(SUM(amount),0) AS tokens, COUNT(DISTINCT player_id) AS players FROM ad_rewards WHERE at >= ?1').bind(since).first(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN granted_at >= ?1 THEN 1 ELSE 0 END) AS new24h, SUM(CASE WHEN state = 'granted' AND acknowledged = 0 THEN 1 ELSE 0 END) AS unacknowledged, SUM(CASE WHEN state = 'refunded' AND unrecovered <> '{}' THEN 1 ELSE 0 END) AS unrecovered FROM purchases").bind(since).first(),
      db.prepare('SELECT * FROM monitor_events WHERE (?1 = \'all\' OR category = ?1) ORDER BY at DESC, id DESC LIMIT 100').bind(category).all(),
      db.prepare('SELECT category, severity, COUNT(*) AS count FROM monitor_events WHERE at >= ?1 GROUP BY category, severity').bind(since).all(),
      db.prepare("SELECT id, at, kind, ok, detail_json FROM ops_runs WHERE id IN (SELECT MAX(id) FROM ops_runs GROUP BY kind) OR id = (SELECT MAX(id) FROM ops_runs WHERE kind = 'backup' AND ok = 1) ORDER BY id DESC").all<{ id: number; at: string; kind: string; ok: number; detail_json: string }>(),
      db.prepare('SELECT status, COUNT(*) AS count FROM dev_notes GROUP BY status').all(),
      db.prepare('SELECT at, action, target FROM audit_log ORDER BY id DESC LIMIT 10').all()
    ]);
    let game: unknown = { available: false, reason: 'service_not_bound' };
    if (c.env.GAME) {
      try {
        const res = await c.env.GAME.fetch('https://game.internal/api/v1/health', { signal: AbortSignal.timeout(5000) });
        const health = await res.json() as { ok: boolean; version?: unknown; time?: string; d1?: unknown; r2?: unknown };
        game = { available: true, status: res.status, ok: health.ok === true, version: health.version ?? null, time: health.time, d1: health.d1, r2: health.r2 };
      } catch { game = { available: false, reason: 'probe_failed' }; }
    }
    return c.json({ updatedAt: new Date().toISOString(), windowStart: since, retentionDays: 30, maxEvents: 10000, players, economy: { wallets: wallets.results, flows: flows.results, breakdown: breakdown.results, pulls }, ads, purchases, events: events.results, counts: counts.results, operations: ops.results.map(({ detail_json, ...r }) => ({ ...r, detail: operationDetail(detail_json) })), development: notes.results, audit: audit.results, versions: { admin: c.env.CF_VERSION_METADATA ?? null, game }, environment: c.env.ENVIRONMENT });
  });
}
