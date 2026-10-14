import { TaskConfig, type RewardAttachment } from '@uomd/content-schema';
import { segmentsAt, weekStart, windowOf, type Period } from '@uomd/economy';
import { HttpError } from '../content/store';
import { grantStatements } from '../db/grants';
import { operationStatement, recordedOperation, type OperationInput } from '../db/operations';

export type TaskEvent = 'eligible_wins' | 'boss_wins' | 'three_star_wins' | 'level_ups';

export async function loadTaskConfig(db: D1Database): Promise<TaskConfig | null> {
  const row = await db.prepare("SELECT value_json FROM game_config WHERE key = 'tasks'").first<{ value_json: string }>();
  if (!row) return null;
  const parsed = TaskConfig.safeParse(JSON.parse(row.value_json));
  return parsed.success ? parsed.data : null;
}

interface Slot {
  period: Period;
  taskId: string;
  title: string;
  objective: { type: TaskEvent; count: number };
  rewards: RewardAttachment[];
  scope: 'daily' | 'weekly';
}

/** Every task that can count progress or be claimed right now (current window; running weekly segments and finished ones in their claim grace). */
function slots(cfg: TaskConfig, nowMs: number): Slot[] {
  const win = windowOf(nowMs, cfg.windowHours);
  const daily = cfg.daily.tasks.map((t): Slot => ({ period: win, taskId: t.id, title: t.title_en, objective: t.objective, rewards: t.rewards, scope: 'daily' }));
  const weekly = segmentsAt(nowMs, cfg.weekly.segments, cfg.weekly.claimGraceDays).map((s): Slot => ({ period: s.period, taskId: s.id, title: s.title_en, objective: s.objective, rewards: s.rewards, scope: 'weekly' }));
  return [...daily, ...weekly];
}

/**
 * Statements that count server-verified events toward the open tasks. Appended to the SAME atomic batch as the action that caused the
 * event (battle win, level-up), so progress can never be claimed without the action having happened. Progress is capped at the target.
 * A weekly segment only counts while it is running (not during its claim grace).
 */
export async function taskEventStatements(db: D1Database, playerId: string, events: Partial<Record<TaskEvent, number>>, nowMs = Date.now(), config?: TaskConfig): Promise<D1PreparedStatement[]> {
  const cfg = config ?? await loadTaskConfig(db);
  if (!cfg) return [];
  const out: D1PreparedStatement[] = [];
  for (const s of slots(cfg, nowMs)) {
    const inc = events[s.objective.type];
    if (!inc || nowMs >= s.period.endMs) continue;
    out.push(
      db
        .prepare(
          `INSERT INTO player_tasks (player_id, period_key, task_id, progress, target) VALUES (?1, ?2, ?3, MIN(?5, ?4), ?5)
           ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET progress = MIN(target, progress + ?4) WHERE claimed = 0`
        )
        .bind(playerId, s.period.key, s.taskId, inc, s.objective.count)
    );
  }
  return out;
}

interface Row {
  period_key: string;
  task_id: string;
  progress: number;
  target: number;
  claimed: number;
}

const COMPLETION = '_window_complete';

export async function listTasks(db: D1Database, playerId: string, nowMs = Date.now()): Promise<Record<string, unknown>> {
  const cfg = await loadTaskConfig(db);
  if (!cfg) return { windowHours: 12, daily: null, weekly: [], serverTimeMs: nowMs };
  const win = windowOf(nowMs, cfg.windowHours);
  const sl = slots(cfg, nowMs);
  const keys = [...new Set(sl.map((s) => s.period.key))];
  const rows = (await db.prepare(`SELECT period_key, task_id, progress, target, claimed FROM player_tasks WHERE player_id = ?1 AND period_key IN (${keys.map(() => '?').join(',')})`).bind(playerId, ...keys).all<Row>()).results;
  const rowOf = (key: string, id: string): Row | undefined => rows.find((r) => r.period_key === key && r.task_id === id);
  const view = (s: Slot) => {
    const r = rowOf(s.period.key, s.taskId);
    const progress = r?.progress ?? 0;
    return { id: s.taskId, title: s.title, objective: s.objective, progress: Math.min(progress, s.objective.count), done: progress >= s.objective.count, claimed: r?.claimed === 1, rewards: s.rewards };
  };
  const daily = sl.filter((s) => s.scope === 'daily').map(view);
  const completion = rowOf(win.key, COMPLETION);
  const weekly = sl
    .filter((s) => s.scope === 'weekly')
    .map((s) => ({ ...view(s), periodKey: s.period.key, startsAtMs: s.period.startMs, endsAtMs: s.period.endMs, running: nowMs < s.period.endMs }))
    // a finished segment is only worth showing while there is something to claim
    .filter((w) => w.running || (w.done && !w.claimed));
  return {
    serverTimeMs: nowMs,
    windowHours: cfg.windowHours,
    weekStartMs: weekStart(nowMs),
    daily: {
      periodKey: win.key,
      endsAtMs: win.endMs,
      tasks: daily,
      completion: { requires: cfg.daily.completion.requires, rewards: cfg.daily.completion.rewards, ready: cfg.daily.completion.requires.every((id) => daily.find((t) => t.id === id)?.done), claimed: completion?.claimed === 1 }
    },
    weekly
  };
}

export async function claimTask(db: D1Database, playerId: string, input: { periodKey: string; taskId: string; requestId?: string }, nowMs = Date.now()): Promise<Record<string, unknown>> {
  const operation = input.requestId ? { ...input, requestId: input.requestId } : null;
  if (operation) {
    const recorded = await recordedOperation(db, playerId, `task_claim:${input.periodKey}:${input.taskId}`, operation);
    if (recorded) return recorded;
  }
  const cfg = await loadTaskConfig(db);
  if (!cfg) throw new HttpError(404, 'no_tasks', 'tasks are not configured');
  const sl = slots(cfg, nowMs);
  const key = `${playerId}:${input.periodKey}:${input.taskId}`;
  const reason = `task:${input.taskId}`;
  if (input.taskId === COMPLETION) {
    const win = windowOf(nowMs, cfg.windowHours);
    if (input.periodKey !== win.key) throw new HttpError(409, 'period_closed', 'that window is over; missed windows do not carry over');
    const rows = (await db.prepare(`SELECT task_id, progress, target FROM player_tasks WHERE player_id = ?1 AND period_key = ?2`).bind(playerId, win.key).all<Row>()).results;
    const ready = cfg.daily.completion.requires.every((id) => {
      const r = rows.find((x) => x.task_id === id);
      const t = cfg.daily.tasks.find((x) => x.id === id);
      return r && t && r.progress >= t.objective.count;
    });
    if (!ready) throw new HttpError(409, 'not_done', 'finish the required tasks first');
    return claimBatch(db, playerId, { periodKey: win.key, taskId: COMPLETION, target: 1, progress: 1, create: true }, cfg.daily.completion.rewards, key, reason, operation);
  }
  const slot = sl.find((s) => s.period.key === input.periodKey && s.taskId === input.taskId);
  if (!slot) throw new HttpError(409, 'period_closed', 'that task is not open any more');
  const row = await db.prepare('SELECT progress, target, claimed FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = ?3').bind(playerId, input.periodKey, input.taskId).first<Row>();
  if (!row || row.progress < row.target) throw new HttpError(409, 'not_done', 'this task is not finished yet');
  if (row.claimed === 1) {
    const replay = operation ? await recordedOperation(db, playerId, `task_claim:${input.periodKey}:${input.taskId}`, operation) : null;
    if (replay) return replay;
    throw new HttpError(409, 'already_claimed', 'already claimed');
  }
  return claimBatch(db, playerId, { periodKey: input.periodKey, taskId: input.taskId, target: row.target, progress: row.progress, create: false }, slot.rewards, key, reason, operation);
}

async function claimBatch(db: D1Database, playerId: string, t: { periodKey: string; taskId: string; target: number; progress: number; create: boolean }, rewards: RewardAttachment[], key: string, reason: string, operation: OperationInput | null): Promise<Record<string, unknown>> {
  const kind = `task_claim:${t.periodKey}:${t.taskId}`;
  const result = { periodKey: t.periodKey, taskId: t.taskId, rewards, ...(operation ? { requestId: operation.requestId } : {}) };
  const stmts = await grantStatements(db, playerId, rewards, { keyPrefix: `task:${key}`, reason });
  const mark = t.create
    ? [db.prepare("INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed, claimed_at) VALUES (?1, ?2, ?3, 1, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(playerId, t.periodKey, t.taskId)]
    : [
        db.prepare("UPDATE player_tasks SET claimed = 1, claimed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE player_id = ?1 AND period_key = ?2 AND task_id = ?3 AND claimed = 0 AND progress >= target").bind(playerId, t.periodKey, t.taskId),
        db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
      ];
  try {
    await db.batch([
      db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status = 'active') THEN 1 ELSE 0 END)").bind(playerId),
      ...mark, ...stmts, ...(operation ? [operationStatement(db, playerId, kind, operation, result)] : []), db.prepare('DELETE FROM tx_guard')
    ]);
  } catch (e) {
    const replay = operation ? await recordedOperation(db, playerId, kind, operation) : null;
    if (replay) return replay;
    const msg = String(e instanceof Error ? e.message : e);
    if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: (player_tasks|ledger)/i.test(msg)) throw new HttpError(409, 'already_claimed', 'already claimed');
    throw e;
  }
  return { ...result, ...(operation ? { replayed: false } : {}) };
}
