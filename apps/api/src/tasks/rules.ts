import { TaskConfig, type RewardAttachment } from '@uomd/content-schema';
import { weekStart } from '@uomd/economy';
import { canonicalJson, sha256Hex } from '@uomd/shared';
import { GrantCatalog, freezeGrantCatalog } from '../content/grant-catalog';
import type { RuntimeCatalog } from '../content/runtime-catalog';
import { HttpError } from '../content/store';

export interface TaskRules { config: TaskConfig; catalog?: GrantCatalog; hash: string }
const weekKey = (ms: number) => new Date(weekStart(ms)).toISOString().slice(0, 10);
export async function taskRules(db: D1Database, playerId: string, nowMs: number, proposed?: TaskConfig, catalog?: RuntimeCatalog, create = true): Promise<TaskRules | null> {
  const key = weekKey(nowMs);
  const read = () => db.prepare('SELECT config_json, grant_catalog FROM task_rule_weeks WHERE player_id = ?1 AND week_start = ?2').bind(playerId, key).first<{ config_json: string; grant_catalog: string | null }>();
  let row = await read();
  if (!row && create) {
    const source = proposed ?? await db.prepare("SELECT value_json FROM game_config WHERE key = 'tasks'").first<{ value_json: string }>().then((r) => r ? JSON.parse(r.value_json) as unknown : undefined);
    const parsed = TaskConfig.safeParse(source); if (!parsed.success) return null;
    const rewards: RewardAttachment[] = [...parsed.data.daily.tasks.flatMap((t) => t.rewards), ...parsed.data.daily.completion.rewards, ...parsed.data.weekly.segments.flatMap((s) => s.rewards)];
    const frozen = freezeGrantCatalog(catalog, rewards);
    await db.prepare("INSERT OR IGNORE INTO task_rule_weeks (player_id, week_start, config_json, grant_catalog) SELECT ?1, ?2, ?3, ?4 FROM players WHERE id = ?1 AND status = 'active'").bind(playerId, key, canonicalJson(parsed.data), frozen ? JSON.stringify(frozen) : null).run();
    row = await read();
    if (!row) throw new HttpError(403, 'account_blocked', 'this account cannot receive task progress');
  }
  if (!row) return null;
  const parsed = TaskConfig.safeParse(JSON.parse(row.config_json));
  if (!parsed.success) throw new HttpError(503, 'task_rules_invalid', 'recorded task terms need operator review');
  return { config: parsed.data, ...(row.grant_catalog ? { catalog: GrantCatalog.parse(JSON.parse(row.grant_catalog)) } : {}), hash: await sha256Hex(canonicalJson(parsed.data)) };
}
export function taskPeriodTime(periodKey: string): number {
  const day = periodKey.slice(2, 12); const hour = periodKey.startsWith('d:') ? periodKey.slice(13, 15) : '00';
  const ms = Date.parse(`${day}T${hour}:00:00Z`);
  if (!Number.isFinite(ms)) throw new HttpError(400, 'bad_request', 'invalid task period');
  return ms;
}
