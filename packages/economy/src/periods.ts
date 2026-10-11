/** UTC period math for the task engine. Server time is authoritative; the client only displays. */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MONDAY_OFFSET = 4 * DAY; // 1970-01-01 was a Thursday: Mondays are at 4 days + n weeks

export interface Period {
  key: string;
  startMs: number;
  endMs: number;
}

const iso = (ms: number): string => new Date(ms).toISOString();

/** The `hours`-long window containing `nowMs` (12 h: starts 00:00 and 12:00 UTC). */
export function windowOf(nowMs: number, hours: number): Period {
  const len = hours * HOUR;
  const startMs = Math.floor(nowMs / len) * len;
  return { key: `d:${iso(startMs).slice(0, 13)}`, startMs, endMs: startMs + len };
}

/** Monday 00:00 UTC of the week containing `nowMs`. */
export function weekStart(nowMs: number): number {
  return Math.floor((nowMs - MONDAY_OFFSET) / (7 * DAY)) * 7 * DAY + MONDAY_OFFSET;
}

/** A weekly segment instance within the week that starts at `week`. */
export function segmentPeriod(week: number, seg: { id: string; startDay: number; durationDays: number }): Period {
  const startMs = week + seg.startDay * DAY;
  return { key: `w:${iso(week).slice(0, 10)}:${seg.id}`, startMs, endMs: startMs + seg.durationDays * DAY };
}

/** Segments of this week and last week that are running now, or ended within `graceDays` (claim period). */
export function segmentsAt<S extends { id: string; startDay: number; durationDays: number }>(nowMs: number, segs: readonly S[], graceDays: number): (S & { period: Period; running: boolean })[] {
  const out: (S & { period: Period; running: boolean })[] = [];
  for (const week of [weekStart(nowMs) - 7 * DAY, weekStart(nowMs)]) {
    for (const s of segs) {
      const period = segmentPeriod(week, s);
      if (nowMs >= period.startMs && nowMs < period.endMs + graceDays * DAY) out.push({ ...s, period, running: nowMs < period.endMs });
    }
  }
  return out;
}

export const MS = { HOUR, DAY };
