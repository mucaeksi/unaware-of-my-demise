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

export async function runScheduled(cron: string, env: OpsEnv): Promise<void> {
  if (cron === CRON_BACKUP) {
    try {
      const r = await runBackup(env);
      await record(env, 'backup', true, r);
    } catch (e) {
      await record(env, 'backup', false, { error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  } else if (cron === CRON_HEALTH) {
    const h = await runHealth(env);
    await record(env, 'health', h.ok, h);
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
