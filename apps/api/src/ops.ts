import { runBackup } from './ops/backup';
import type { OpsEnv } from './ops/env';
import { runHealth } from './ops/health';

/** Cron Worker: nightly encrypted D1 backup and a health probe every 15 minutes. Results go to the ops_runs table (Control Center). */
export const CRON_BACKUP = '17 3 * * *';
export const CRON_HEALTH = '*/15 * * * *';

async function record(env: OpsEnv, kind: 'backup' | 'health', ok: boolean, detail: unknown): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO ops_runs (kind, ok, detail_json) VALUES (?1, ?2, ?3)').bind(kind, ok ? 1 : 0, JSON.stringify(detail).slice(0, 3900)),
    env.DB.prepare("DELETE FROM ops_runs WHERE at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')")
  ]);
}

async function backupAndRecord(env: OpsEnv): Promise<void> {
  try {
    const r = await runBackup(env);
    await record(env, 'backup', true, r);
  } catch (e) {
    await record(env, 'backup', false, { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** A good backup older than this (or none at all) makes the next health tick take one itself: a missed nightly cron must not go unnoticed. */
const CATCH_UP_AFTER_HOURS = 30;
/** After any backup attempt, wait this long before another catch-up (a failing backup must not be retried every 15 minutes). */
const CATCH_UP_COOLDOWN_MINUTES = 90;

export async function backupIsOverdue(env: OpsEnv, now = new Date()): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT (SELECT at FROM ops_runs WHERE kind = 'backup' AND ok = 1 ORDER BY id DESC LIMIT 1) AS good, (SELECT at FROM ops_runs WHERE kind = 'backup' ORDER BY id DESC LIMIT 1) AS attempt"
  ).first<{ good: string | null; attempt: string | null }>();
  if (row?.attempt && now.getTime() - Date.parse(row.attempt) < CATCH_UP_COOLDOWN_MINUTES * 60_000) return false;
  if (!row?.good) return true;
  return now.getTime() - Date.parse(row.good) > CATCH_UP_AFTER_HOURS * 3_600_000;
}

export async function runScheduled(cron: string, env: OpsEnv): Promise<void> {
  if (cron === CRON_HEALTH) {
    const h = await runHealth(env);
    await record(env, 'health', h.ok, h);
    if (await backupIsOverdue(env)) await backupAndRecord(env);
  } else {
    // the nightly schedule, or any one-off schedule an operator sets to run a backup now
    await backupAndRecord(env);
  }
}

export default {
  async scheduled(event: ScheduledController, env: OpsEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduled(event.cron, env));
  },
  // nothing is served: this Worker only runs on its schedule
  fetch(): Response {
    return new Response('not found', { status: 404 });
  }
};
