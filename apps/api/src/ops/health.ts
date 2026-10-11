import type { OpsEnv } from './env';

export interface HealthResult {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}

/** Probes the deployed Workers from the outside plus the freshness of the last good backup. */
export async function runHealth(env: OpsEnv, now = new Date()): Promise<HealthResult> {
  const checks: HealthResult['checks'] = [];
  const probe = async (name: string, f: () => Promise<{ ok: boolean; detail: string }>): Promise<void> => {
    try {
      checks.push({ name, ...(await f()) });
    } catch (e) {
      checks.push({ name, ok: false, detail: e instanceof Error ? e.message.slice(0, 120) : 'failed' });
    }
  };
  await probe('game', async () => {
    const r = await env.GAME.fetch('https://game.internal/api/v1/health', { headers: { 'User-Agent': 'uomd-ops' } });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean };
    return { ok: r.status === 200 && j.ok === true, detail: `HTTP ${r.status}` };
  });
  await probe('admin_protected', async () => {
    // A service binding bypasses the Access edge, so this proves the Worker's OWN check: no Access JWT, no data
    const r = await env.ADMIN.fetch('https://admin.internal/admin/api/system', { redirect: 'manual', headers: { 'User-Agent': 'uomd-ops' } });
    return { ok: [401, 403].includes(r.status), detail: `HTTP ${r.status}` };
  });
  await probe('backup_fresh', async () => {
    const last = await env.DB.prepare("SELECT at FROM ops_runs WHERE kind = 'backup' AND ok = 1 ORDER BY id DESC LIMIT 1").first<{ at: string }>();
    if (!last) return { ok: false, detail: 'no backup yet' };
    const hours = (now.getTime() - Date.parse(last.at)) / 3_600_000;
    return { ok: hours < 36, detail: `${hours.toFixed(1)} h old` };
  });
  return { ok: checks.every((c) => c.ok), checks };
}
