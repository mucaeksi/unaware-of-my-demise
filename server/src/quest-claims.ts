// Daily and weekly quest rewards (port of LEGACY server/quests.py; owner decision 2026-09-28: server-clock windows, one
// claim per window in the `quest_claims` ledger). LEGACY could not see whether a task was done (battles ran on the
// device) and trusted the claim; here progress comes only from verified victories and level-ups (`quest_progress`), so a
// gameplay task pays only once its progress reached the target. The server grants everything the row authors: Eclipse
// Tokens, Silver Crowns, Account XP and Character XP as Chronicle items.
import { toSafeInt, type Db } from "./db";
import { ApiError, invalid } from "./http";
import { pyRepr } from "./engine/content";
import { halfDayWindow, isoUtcSeconds, weeklyCycleKey, weeklySegment } from "./engine/quests";
import { addItemQuantity } from "./rewards";
import { questProgress, stackCaps } from "./rules";

const DAY = 86400;
const COMPLETION = "window_completion";
type Row = Record<string, unknown>;

const refused = (message: string): ApiError => new ApiError(400, "INVALID_REQUEST", message);

function economy(): { daily: Row; weekly: Row } {
  const pack = questProgress().economyPack();
  return { daily: (pack.daily_schedule ?? {}) as Row, weekly: (pack.weekly_cycle ?? {}) as Row };
}

const segments = (): Row[] => (economy().weekly.segments ?? []) as Row[];

/** A reward row's grant: `eclipse_token`, `silver_crown`, `account_xp`, `character_xp` (absent = 0). */
function grantOf(row: Row): Record<string, number> {
  const amount = (key: string): number => Math.trunc(Number(row[key] ?? 0));
  return { eclipse_token: amount("eclipse_token"), character_xp: amount("character_xp"), silver_crown: amount("silver_crown"), account_xp: amount("account_xp") };
}

export interface ClaimScope {
  daily_cycle_id: number;
  daily_ends_at_utc: string;
  weekly_key: string;
  weekly_segment: string;
  weekly_ends_at_utc: string;
}

/** The server-clock scope: the daily window id and the weekly segment being paid. */
export function currentClaimScope(nowUnix: number): ClaimScope {
  const window = halfDayWindow(nowUnix);
  const segment = weeklySegment(nowUnix);
  return {
    daily_cycle_id: window.cycle_id,
    daily_ends_at_utc: window.ends_at_utc,
    weekly_key: segment.week_start_utc.slice(0, 10),
    weekly_segment: segment.segment_id,
    weekly_ends_at_utc: segment.ends_at_utc,
  };
}

/** Unix seconds of a week key (its Monday, "YYYY-MM-DD") and the weekly cycle id progress is stored under. */
function weekOf(weekKey: string): { mondayUnix: number; weekId: number } {
  const mondayUnix = Date.parse(`${weekKey}T00:00:00Z`) / 1000;
  return { mondayUnix, weekId: weeklyCycleKey(mondayUnix)[0] };
}

function segmentEnd(weekKey: string, segmentId: string): number {
  const row = segments().find((segment) => segment.id === segmentId);
  if (!row) throw refused(`Unknown weekly segment: ${pyRepr(segmentId)}`);
  return weekOf(weekKey).mondayUnix + (Math.trunc(Number(row.start_day)) + Math.trunc(Number(row.duration_days))) * DAY;
}

export interface MailItem {
  week_key: string;
  segment: string;
  expires_at_utc: string;
  claimed: boolean;
}

/** Finished weekly segments still claimable from the mail (`completed_unclaimed_mail_days`); daily windows never carry. */
export async function mailbox(tx: Db, accountId: string, nowUnix: number): Promise<MailItem[]> {
  const days = Math.trunc(Number(economy().weekly.completed_unclaimed_mail_days ?? 0));
  const monday = weeklySegment(nowUnix).week_start_utc.slice(0, 10);
  const { rows } = await tx.query<{ claim_key: string }>("SELECT claim_key FROM quest_claims WHERE account_id = $1 AND claim_key LIKE 'weekly:%'", [accountId]);
  const paid = new Set(rows.map((row) => row.claim_key));
  const items: MailItem[] = [];
  for (const weeksBack of [1, 0]) {
    const weekKey = isoUtcSeconds(weekOf(monday).mondayUnix - 7 * DAY * weeksBack).slice(0, 10);
    for (const segment of segments()) {
      const ends = segmentEnd(weekKey, String(segment.id));
      if (ends <= nowUnix && nowUnix - ends <= days * DAY) {
        items.push({ week_key: weekKey, segment: String(segment.id), expires_at_utc: isoUtcSeconds(ends + days * DAY), claimed: paid.has(`weekly:${weekKey}:${segment.id}`) });
      }
    }
  }
  return items;
}

async function progressOf(tx: Db, accountId: string, taskId: string, cycleId: number): Promise<number> {
  const { rows } = await tx.query<{ progress: number }>("SELECT progress FROM quest_progress WHERE account_id = $1 AND task_id = $2 AND cycle_id = $3", [accountId, taskId, cycleId]);
  return rows[0]?.progress ?? 0;
}

async function claimedKeys(tx: Db, accountId: string, scope: ClaimScope): Promise<string[]> {
  const { rows } = await tx.query<{ claim_key: string }>(
    "SELECT claim_key FROM quest_claims WHERE account_id = $1 AND (claim_key LIKE $2 OR claim_key LIKE $3) ORDER BY claim_key",
    [accountId, `daily:${scope.daily_cycle_id}:%`, `weekly:${scope.weekly_key}:%`],
  );
  return rows.map((row) => row.claim_key);
}

export interface TaskStatus {
  task_id: string;
  progress: number;
  target: number;
}

/** GET /v1/quests/status: the LEGACY scope, claimed keys and mail, plus the verified progress of every counted task. */
export async function questStatus(tx: Db, accountId: string, nowUnix: number) {
  const scope = currentClaimScope(nowUnix);
  const quests = questProgress();
  const [weekId] = weeklyCycleKey(nowUnix);
  const status = async (taskId: string, target: number, cycleId: number): Promise<TaskStatus> => ({ task_id: taskId, progress: await progressOf(tx, accountId, taskId, cycleId), target });
  const daily: TaskStatus[] = [];
  for (const task of quests.dailyTasks()) daily.push(await status(task.task_id, task.target, scope.daily_cycle_id));
  const weekly: TaskStatus[] = [];
  for (const task of quests.weeklyTasks()) weekly.push(await status(task.task_id, task.target, weekId));
  // A mail row carries the verified progress of its own week, so the client can tell a claimable one from an unfinished one.
  const mail: (MailItem & { progress: number; target: number })[] = [];
  for (const item of await mailbox(tx, accountId, nowUnix)) {
    const task = quests.weeklyTasks().find((row) => row.segment_id === item.segment);
    const target = task?.target ?? 0;
    mail.push({ ...item, progress: task ? await progressOf(tx, accountId, task.task_id, weekOf(item.week_key).weekId) : 0, target });
  }
  return { ...scope, claimed: await claimedKeys(tx, accountId, scope), mail, daily_tasks: daily, weekly_tasks: weekly };
}

export interface QuestClaimRequest {
  kind: "daily" | "weekly";
  task_id: string;
  period: string | null;
}

export function parseQuestClaim(body: Record<string, unknown>): QuestClaimRequest {
  const { kind, task_id: taskId, period } = body;
  if (kind !== "daily" && kind !== "weekly") throw invalid("kind must be 'daily' or 'weekly'");
  if (typeof taskId !== "string" || taskId.length === 0 || taskId.length > 64) throw invalid("task_id is required");
  if (period !== undefined && period !== null && (typeof period !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(period))) throw invalid("period must be a week's Monday (YYYY-MM-DD)");
  return { kind, task_id: taskId, period: (period as string | undefined) ?? null };
}

export interface QuestClaimResult {
  claim_key: string;
  already_claimed: boolean;
  granted: Record<string, number>;
  eclipse_tokens: number;
}

/** Claims one reward inside the request's transaction; a repeat claim of the same window pays nothing and returns the original grant. */
export async function claimQuest(tx: Db, accountId: string, request: QuestClaimRequest, nowUnix: number): Promise<QuestClaimResult> {
  const scope = currentClaimScope(nowUnix);
  const quests = questProgress();
  let key: string;
  let reward: Record<string, number>;
  if (request.kind === "daily") {
    key = `daily:${scope.daily_cycle_id}:${request.task_id}`;
    const schedule = economy().daily;
    if (request.task_id === COMPLETION) {
      const completion = (schedule.window_completion ?? {}) as Row;
      reward = grantOf(completion);
      const done = new Set(await claimedKeys(tx, accountId, scope));
      const missing = ((completion.requires ?? []) as string[]).filter((taskId) => !done.has(`daily:${scope.daily_cycle_id}:${taskId}`));
      if (missing.length > 0) throw refused(`Claim ${missing.join(", ")} first`);
    } else {
      // The rewarded-ad task is not claimable here (verified ads are a separate slice).
      const row = ((schedule.tasks ?? []) as Row[]).find((task) => task.id === request.task_id && (task.objective as Row | undefined)?.type !== "verified_rewarded_ad");
      const task = quests.dailyTasks().find((candidate) => candidate.task_id === request.task_id);
      if (!row || !task) throw refused(`Unknown or non-claimable daily task: ${pyRepr(request.task_id)}`);
      reward = grantOf(row);
      const progress = await progressOf(tx, accountId, task.task_id, scope.daily_cycle_id);
      if (progress < task.target) throw refused(`${task.task_id} is not complete (${progress}/${task.target})`);
    }
  } else {
    const row = segments().find((segment) => segment.id === request.task_id);
    if (!row) throw refused(`Unknown weekly segment: ${pyRepr(request.task_id)}`);
    reward = grantOf(row);
    let weekKey: string;
    if (request.period === null || (request.period === scope.weekly_key && request.task_id === scope.weekly_segment)) {
      if (request.task_id !== scope.weekly_segment) throw refused(`Weekly segment ${pyRepr(request.task_id)} is not the active one (${scope.weekly_segment})`);
      weekKey = scope.weekly_key;
    } else {
      // A finished segment claimed from the mailbox.
      const listed = (await mailbox(tx, accountId, nowUnix)).some((item) => item.week_key === request.period && item.segment === request.task_id);
      if (!listed) throw refused("That weekly reward is not in the mailbox (expired or not finished yet)");
      weekKey = request.period;
    }
    key = `weekly:${weekKey}:${request.task_id}`;
    const task = quests.weeklyTasks().find((candidate) => candidate.segment_id === request.task_id);
    if (task) {
      const progress = await progressOf(tx, accountId, task.task_id, weekOf(weekKey).weekId);
      if (progress < task.target) throw refused(`${task.task_id} is not complete (${progress}/${task.target})`);
    }
  }

  const balance = async (): Promise<number> =>
    toSafeInt((await tx.query<{ eclipse_tokens: unknown }>("SELECT eclipse_tokens FROM wallet WHERE account_id = $1", [accountId])).rows[0]?.eclipse_tokens ?? 0);
  const existing = await tx.query<{ granted_json: Record<string, number> }>("SELECT granted_json FROM quest_claims WHERE account_id = $1 AND claim_key = $2", [accountId, key]);
  if (existing.rows[0]) return { claim_key: key, already_claimed: true, granted: existing.rows[0].granted_json, eclipse_tokens: await balance() };

  await tx.query(
    "UPDATE wallet SET eclipse_tokens = eclipse_tokens + $2, silver_crowns = silver_crowns + $3, account_xp = account_xp + $4 WHERE account_id = $1",
    [accountId, reward.eclipse_token, reward.silver_crown, reward.account_xp],
  );
  if (reward.character_xp! > 0) {
    for (const [itemId, quantity] of Object.entries(quests.characterXpItems(reward.character_xp!))) {
      await addItemQuantity(tx, accountId, itemId, quantity, stackCaps().get(itemId) ?? null);
    }
  }
  await tx.query("INSERT INTO quest_claims (account_id, claim_key, granted_json) VALUES ($1, $2, $3)", [accountId, key, JSON.stringify(reward)]);
  return { claim_key: key, already_claimed: false, granted: reward, eclipse_tokens: await balance() };
}
