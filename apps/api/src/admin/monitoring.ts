import type { Hono, MiddlewareHandler } from 'hono';
import type { AdminEnv } from '../env';
import type { AdminIdentity, Role } from '../auth/access';
import { HttpError } from '../content/store';
import { MONITOR_RETENTION } from '../monitoring';

type Ctx = { Bindings: AdminEnv; Variables: { admin: AdminIdentity } };
function operationDetail(raw: string): unknown {
  try { return JSON.parse(raw) as unknown; } catch { return { unavailable: true }; }
}
/** Health runs every 15 minutes and a good backup at least daily (catch-up after 30 h): older evidence is reported as stale. */
const HEALTH_STALE_MINUTES = 45;
const BACKUP_STALE_HOURS = 30;
const LIMITS = { events: 100, audit: 10, flowSources: 15 } as const;

export function registerMonitoring(app: Hono<Ctx>, need: (role: Role) => MiddlewareHandler<Ctx>): void {
  app.get('/admin/api/monitoring', need('viewer'), async (c) => {
    const category = c.req.query('category') ?? 'all';
    if (!['all', 'ads', 'billing', 'api'].includes(category)) throw new HttpError(400, 'bad_request', 'unknown monitoring category');
    const db = c.env.DB;
    const now = Date.now();
    const since = new Date(now - 86_400_000).toISOString();
    // Every windowed count is a range on an `at`/`created_at`-style index; whole-table totals are single COUNT(*)s over the smallest index.
    const [players, wallets, flows, breakdown, pulls, ads, purchases, events, counts, ops, notes, audit, recentBattles, recentLedger, recentPulls] = await Promise.all([
      db.prepare("SELECT (SELECT COUNT(*) FROM players) AS total, (SELECT COUNT(*) FROM players WHERE created_at >= ?1) AS new24h, (SELECT COUNT(*) FROM players WHERE last_seen_at >= ?1 AND status = 'active') AS active24h, (SELECT COUNT(*) FROM players WHERE status = 'banned') AS banned").bind(since).first(),
      db.prepare('SELECT currency, SUM(balance) AS balance FROM wallets GROUP BY currency').all(),
      db.prepare('SELECT currency, SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS earned, SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS spent, COUNT(*) AS transactions FROM ledger WHERE at >= ?1 GROUP BY currency').bind(since).all(),
      db.prepare("SELECT CASE WHEN instr(reason, ':') > 0 THEN substr(reason, 1, instr(reason, ':') - 1) ELSE reason END AS source, SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS earned, SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS spent FROM ledger WHERE at >= ?1 GROUP BY source ORDER BY earned + spent DESC LIMIT ?2").bind(since, LIMITS.flowSources).all(),
      db.prepare('SELECT COUNT(*) AS pulls, COUNT(DISTINCT player_id) AS players FROM gacha_pulls WHERE at >= ?1').bind(since).first(),
      db.prepare('SELECT COUNT(*) AS grants, COALESCE(SUM(amount),0) AS tokens, COUNT(DISTINCT player_id) AS players FROM ad_rewards WHERE at >= ?1').bind(since).first(),
      db.prepare("SELECT (SELECT COUNT(*) FROM purchases) AS total, (SELECT COUNT(*) FROM purchases WHERE granted_at >= ?1) AS new24h, (SELECT COUNT(*) FROM purchases WHERE state = 'granted' AND acknowledged = 0) AS unacknowledged, (SELECT COUNT(*) FROM purchases WHERE state = 'refunded' AND unrecovered <> '{}') AS unrecovered").bind(since).first(),
      (category === 'all'
        ? db.prepare('SELECT * FROM monitor_events ORDER BY at DESC, id DESC LIMIT ?1').bind(LIMITS.events)
        : db.prepare('SELECT * FROM monitor_events WHERE category = ?1 ORDER BY at DESC, id DESC LIMIT ?2').bind(category, LIMITS.events)
      ).all<{ at: string }>(),
      db.prepare('SELECT category, severity, COUNT(*) AS count FROM monitor_events WHERE at >= ?1 GROUP BY category, severity').bind(since).all(),
      db.prepare("SELECT id, at, kind, ok, detail_json FROM ops_runs WHERE id IN (SELECT MAX(id) FROM ops_runs GROUP BY kind) OR id = (SELECT MAX(id) FROM ops_runs WHERE kind = 'backup' AND ok = 1) ORDER BY id DESC").all<{ id: number; at: string; kind: string; ok: number; detail_json: string }>(),
      db.prepare('SELECT status, COUNT(*) AS count FROM dev_notes GROUP BY status').all(),
      db.prepare('SELECT id, at, actor, action, target, detail FROM audit_log ORDER BY id DESC LIMIT ?1').bind(25).all(),
      db.prepare('SELECT id, at, release_id, encounter, valid, complete, winner, stars, turns, log_hash, client_match FROM battle_audit ORDER BY id DESC LIMIT 20').all(),
      db.prepare('SELECT id, at, currency, delta, reason FROM ledger ORDER BY id DESC LIMIT 25').all(),
      db.prepare('SELECT id, at, banner_id, pull_number, rarity, item_id, outcome, duplicate FROM gacha_pulls ORDER BY id DESC LIMIT 20').all()
    ]);
    let game: unknown = { available: false, reason: 'service_not_bound' };
    if (c.env.GAME) {
      try {
        const res = await c.env.GAME.fetch('https://game.internal/api/v1/health', { signal: AbortSignal.timeout(5000) });
        const health = await res.json() as { ok: boolean; version?: unknown; time?: string; d1?: unknown; r2?: unknown };
        game = { available: true, status: res.status, ok: health.ok === true, version: health.version ?? null, time: health.time, d1: health.d1, r2: health.r2 };
      } catch { game = { available: false, reason: 'probe_failed' }; }
    }
    const lastHealthAt = ops.results.find((r) => r.kind === 'health')?.at ?? null;
    const lastBackupAt = ops.results.find((r) => r.kind === 'backup')?.at ?? null;
    const lastGoodBackupAt = ops.results.find((r) => r.kind === 'backup' && r.ok === 1)?.at ?? null;
    const olderThan = (at: string | null, ms: number): boolean => at === null || now - Date.parse(at.endsWith('Z') ? at : `${at}Z`) > ms;
    const freshness = {
      source: 'd1',
      generatedAt: new Date(now).toISOString(),
      windowStart: since,
      newestEventAt: events.results[0]?.at ?? null,
      lastHealthAt,
      lastBackupAt,
      lastGoodBackupAt,
      healthStale: olderThan(lastHealthAt, HEALTH_STALE_MINUTES * 60_000),
      backupStale: olderThan(lastGoodBackupAt, BACKUP_STALE_HOURS * 3_600_000),
      limits: LIMITS
    };
    return c.json({
      updatedAt: freshness.generatedAt,
      windowStart: since,
      retentionDays: MONITOR_RETENTION.days,
      maxEvents: MONITOR_RETENTION.maxEvents,
      freshness,
      players,
      economy: { wallets: wallets.results, flows: flows.results, breakdown: breakdown.results, pulls },
      ads,
      purchases,
      events: events.results,
      counts: counts.results,
      operations: ops.results.map(({ detail_json, ...r }) => ({ ...r, detail: operationDetail(detail_json) })),
      development: notes.results,
      audit: audit.results,
      recentBattles: recentBattles.results,
      recentLedger: recentLedger.results,
      recentPulls: recentPulls.results,
      versions: { admin: c.env.CF_VERSION_METADATA ?? null, game },
      environment: c.env.ENVIRONMENT
    });
  });

  app.post('/admin/api/monitoring/probe', need('operator'), async (c) => {
    const db = c.env.DB;
    const t0 = Date.now();
    const checks: { name: string; ok: boolean; detail: string }[] = [];
    try {
      await db.prepare('SELECT 1').run();
      checks.push({ name: 'd1', ok: true, detail: `${Date.now() - t0} ms` });
    } catch {
      checks.push({ name: 'd1', ok: false, detail: 'query_failed' });
    }
    try {
      const l = await c.env.CONTENT.list({ limit: 5, prefix: 'objects/' });
      checks.push({ name: 'r2', ok: true, detail: `${l.objects.length} objects probed` });
    } catch {
      checks.push({ name: 'r2', ok: false, detail: 'list_failed' });
    }
    if (c.env.GAME) {
      try {
        const res = await c.env.GAME.fetch('https://game.internal/api/v1/health', { signal: AbortSignal.timeout(4000) });
        checks.push({ name: 'game_worker', ok: res.ok, detail: `HTTP ${res.status}` });
      } catch {
        checks.push({ name: 'game_worker', ok: false, detail: 'probe_failed' });
      }
    }
    const ok = checks.every((ch) => ch.ok);
    const detail = { checks, version: c.env.CF_VERSION_METADATA ?? null };
    const at = new Date().toISOString();
    await db.batch([
      db.prepare("INSERT INTO ops_runs (kind, ok, detail_json, at) VALUES ('health', ?1, ?2, ?3)").bind(ok ? 1 : 0, JSON.stringify(detail), at),
      db.prepare("INSERT INTO monitor_events (id, at, service, category, event, severity, method, route, status, reason, duration_ms) VALUES (?1, ?2, 'admin', 'api', 'health_probe', ?3, 'POST', '/admin/api/monitoring/probe', ?4, ?5, ?6)")
        .bind(crypto.randomUUID(), at, ok ? 'info' : 'warning', ok ? 200 : 503, ok ? 'ok' : 'degraded', Date.now() - t0)
    ]);
    return c.json({ ok, at, checks });
  });
}
