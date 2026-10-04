// UTC reset windows and daily / weekly task progress (port of core/quest/reset_clock.gd and quest_progress.gd, LEGACY
// core/reset_clock.py, core/quest_progress.py and the content helpers of backend/quest_service.py).
//
// Pure: no persistence, no rewards. The caller supplies UTC unix seconds (the Worker's own clock, never the client's)
// and persists the returned progress. Failures the reference raises as ValueError throw QuestError.
import { pyRepr } from "./content";

export class QuestError extends Error {}

type Row = Record<string, unknown>;

const SECONDS_PER_DAY = 86400;
const HALF_DAY_SECONDS = 43200;
/** 1970-01-01 was a Thursday (weekday 3, Monday = 0); the first Monday after the epoch is day 4 (1970-01-05). */
const EPOCH_WEEKDAY = 3;
const FIRST_MONDAY_DAY = 4;

const floorDiv = (numerator: number, denominator: number): number => Math.floor(numerator / denominator);
const posmod = (value: number, modulus: number): number => ((value % modulus) + modulus) % modulus;
const pad = (value: number, width = 2): string => String(value).padStart(width, "0");

/** Proleptic Gregorian [year, month, day] of a day count since 1970-01-01 (Hinnant's civil_from_days). */
export function civilFromDays(dayCount: number): [number, number, number] {
  const shifted = dayCount + 719468;
  const era = floorDiv(shifted, 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.trunc((dayOfEra - Math.trunc(dayOfEra / 1460) + Math.trunc(dayOfEra / 36524) - Math.trunc(dayOfEra / 146096)) / 365);
  const year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.trunc(yearOfEra / 4) - Math.trunc(yearOfEra / 100));
  const monthIndex = Math.trunc((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.trunc((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  return [year + (month <= 2 ? 1 : 0), month, day];
}

/** `datetime.isoformat()` of a UTC time: `YYYY-MM-DDTHH:MM:SS+00:00` (whole seconds). */
export function isoUtcSeconds(unixSeconds: number): string {
  const days = floorDiv(unixSeconds, SECONDS_PER_DAY);
  const secondOfDay = unixSeconds - days * SECONDS_PER_DAY;
  const [year, month, day] = civilFromDays(days);
  return (
    `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(Math.trunc(secondOfDay / 3600))}:` +
    `${pad(Math.trunc((secondOfDay % 3600) / 60))}:${pad(secondOfDay % 60)}+00:00`
  );
}

export interface HalfDayWindow {
  cycle_id: number;
  starts_at_utc: string;
  ends_at_utc: string;
  server_now_utc: string;
}

/** The active 00:00/12:00 UTC half-day window. */
export function halfDayWindow(nowUnix: number): HalfDayWindow {
  const cycleId = floorDiv(nowUnix, HALF_DAY_SECONDS);
  const starts = cycleId * HALF_DAY_SECONDS;
  return {
    cycle_id: cycleId,
    starts_at_utc: isoUtcSeconds(starts),
    ends_at_utc: isoUtcSeconds(starts + HALF_DAY_SECONDS),
    server_now_utc: isoUtcSeconds(nowUnix),
  };
}

export type WeeklySegmentId = "cycle_a" | "cycle_b" | "sun_eclipse";

export interface WeeklySegment {
  week_start_utc: string;
  segment_id: WeeklySegmentId;
  starts_at_utc: string;
  ends_at_utc: string;
  server_now_utc: string;
}

/** The active Monday-based 3-3-1 weekly segment. */
export function weeklySegment(nowUnix: number): WeeklySegment {
  const days = floorDiv(nowUnix, SECONDS_PER_DAY);
  const weekday = posmod(days + EPOCH_WEEKDAY, 7);
  const monday = (days - weekday) * SECONDS_PER_DAY;
  const [segment, startDay, endDay]: [WeeklySegmentId, number, number] =
    weekday < 3 ? ["cycle_a", 0, 3] : weekday < 6 ? ["cycle_b", 3, 6] : ["sun_eclipse", 6, 7];
  return {
    week_start_utc: isoUtcSeconds(monday),
    segment_id: segment,
    starts_at_utc: isoUtcSeconds(monday + startDay * SECONDS_PER_DAY),
    ends_at_utc: isoUtcSeconds(monday + endDay * SECONDS_PER_DAY),
    server_now_utc: isoUtcSeconds(nowUnix),
  };
}

/** [week number since the epoch's first Monday, active segment id]: the cycle id weekly progress is stored under. */
export function weeklyCycleKey(nowUnix: number): [number, WeeklySegmentId] {
  const days = floorDiv(nowUnix, SECONDS_PER_DAY);
  const mondayDay = days - posmod(days + EPOCH_WEEKDAY, 7);
  return [floorDiv(mondayDay - FIRST_MONDAY_DAY, 7), weeklySegment(nowUnix).segment_id];
}

export const WEEKLY_PREFIX = "weekly:";

/** Gameplay event name -> the objective `type` it advances. One victory can raise several events. */
export const EVENT_OBJECTIVES: Readonly<Record<string, string>> = {
  eligible_win: "eligible_wins",
  boss_win: "boss_wins",
  three_star_win: "three_star_wins",
  successful_level_up: "successful_level_up",
};

export interface QuestTask {
  task_id: string;
  objective_type: string;
  target: number;
  /** Weekly tasks only advance while their segment is the active one; null for daily tasks. */
  segment_id: string | null;
}

export type QuestProgressMap = Record<string, number>;

const isObject = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const isPositiveWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;

function countedRows(rows: unknown, weekly: boolean): QuestTask[] {
  const tasks: QuestTask[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const objective = isObject(row) ? (row.objective ?? {}) : {};
    const count = isObject(objective) ? objective.count : null;
    if (!isPositiveWhole(count) || !isObject(row) || !isObject(objective)) continue;
    const id = String(row.id);
    tasks.push({
      task_id: weekly ? WEEKLY_PREFIX + id : id,
      objective_type: String(objective.type),
      target: count,
      segment_id: weekly ? id : null,
    });
  }
  return tasks;
}

/** Counted objectives of `daily_schedule.tasks` (`verified_rewarded_ad` has no count and is never tracked here). */
export const countedTasks = (dailySchedule: Row): QuestTask[] => countedRows(dailySchedule.tasks, false);

/** Counted objectives of `weekly_cycle.segments` as `weekly:<segment>` tasks. */
export const countedWeeklyTasks = (weeklyCycle: Row): QuestTask[] => countedRows(weeklyCycle.segments, true);

/** Ids of the tasks whose progress reached the target, sorted. */
export const completedTasks = (progress: QuestProgressMap, tasks: readonly QuestTask[]): string[] =>
  tasks.filter((task) => (progress[task.task_id] ?? 0) >= task.target).map((task) => task.task_id).sort();

export class QuestProgress {
  /** `economy` = economy_part1.json, `items` = items_part1.json. */
  constructor(
    private readonly economy: Row,
    private readonly items: Row,
  ) {}

  dailyTasks(): QuestTask[] {
    return countedTasks(isObject(this.economy.daily_schedule) ? this.economy.daily_schedule : {});
  }

  weeklyTasks(): QuestTask[] {
    return countedWeeklyTasks(isObject(this.economy.weekly_cycle) ? this.economy.weekly_cycle : {});
  }

  /** Daily tasks followed by weekly tasks. */
  allTasks(): QuestTask[] {
    return [...this.dailyTasks(), ...this.weeklyTasks()];
  }

  /** New progress after `event`, capped at each task's target; segment tasks only advance in `activeSegment`. */
  applyEvent(progress: QuestProgressMap, tasks: readonly QuestTask[], event: string, amount: unknown = 1, activeSegment: string | null = null): QuestProgressMap {
    const objective = Object.hasOwn(EVENT_OBJECTIVES, event) ? EVENT_OBJECTIVES[event]! : null;
    if (objective === null) throw new QuestError(`Unknown quest event ${pyRepr(event)}`);
    if (!isPositiveWhole(amount)) throw new QuestError("amount must be a positive integer");
    const updated = { ...progress };
    for (const task of tasks) {
      if (task.segment_id !== null && task.segment_id !== activeSegment) continue;
      if (task.objective_type === objective) updated[task.task_id] = Math.min(task.target, (updated[task.task_id] ?? 0) + amount);
    }
    return updated;
  }

  /** Pays `amount` Character XP as Chronicle items, largest first: `{item_id: count}`. */
  characterXpItems(amount: number): Record<string, number> {
    const rules = this.items.progression_rules;
    const characterXp = isObject(rules) ? rules.character_xp : null;
    if (!isObject(characterXp) || Object.keys(characterXp).length === 0) {
      throw new QuestError("items_part1.json progression_rules.character_xp is missing");
    }
    // Array.prototype.sort is stable, like the reference's sorted().
    const ordered = Object.entries(characterXp)
      .map(([itemId, xp]) => [itemId, Math.trunc(Number(xp))] as const)
      .sort((left, right) => right[1] - left[1]);
    const result: Record<string, number> = {};
    let remaining = amount;
    for (const [itemId, xp] of ordered) {
      const count = Math.trunc(remaining / xp);
      remaining %= xp;
      if (count !== 0) result[itemId] = count;
    }
    if (remaining !== 0) throw new QuestError(`${amount} Character XP is not a multiple of the smallest XP item`);
    return result;
  }
}
