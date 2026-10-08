// Which banners are open for pulls at an instant (port of LEGACY backend/banner_rotation.py, pure).
//
// Owner decision 2026-09-28: the five limited Oath pairs run one after another, `limited_duration_days` (15) each, in
// `rotation.order` (Oath 1 -> 5), then the cycle starts over (`after_last == "loop"`). A pair's character and weapon
// banner open and close together; the permanent banners are always open. The launch instant (`epoch`) is a deployment
// fact supplied by the server (LEGACY env `UDMD_SERVER_BANNER_EPOCH`), not content, and must be a Monday 00:00 UTC so
// periods line up with the weekly reset. Before the epoch only the permanent banners are open; with no epoch at all
// (development) the first pair is open forever, undated.
//
// JS `Date` has millisecond resolution where Python datetimes have microseconds; the rotation itself only ever moves on
// whole days, so no window boundary depends on the difference. `parseEpoch` accepts the ISO-8601 extended forms a
// deployment writes (Python 3.11 `fromisoformat` accepts a few more exotic spellings, which are refused here).

type Row = Record<string, unknown>;

export class RotationError extends Error {
  /** The reference's exception class (a ValueError: an HTTP 500 there, never a client error). */
  readonly kind = "RotationError";
}

export interface BannerWindow {
  banner_id: string;
  /** null: permanent (or the undated no-epoch fallback). */
  closes_at: Date | null;
}

const DAY_MS = 86_400_000;
const isObject = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const pad = (value: number, width = 2): string => String(value).padStart(width, "0");
const repr = (value: string): string =>
  value.includes("'") && !value.includes('"') ? `"${value}"` : `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

function item(container: unknown, key: string): unknown {
  if (!isObject(container) || !Object.hasOwn(container, key)) throw new RotationError(`economy banners: missing ${repr(key)}`);
  return container[key];
}

/** Python `datetime.isoformat()` of a UTC instant with the given sub-second microseconds, "+00:00" suffix. */
function pythonIsoUtc(date: Date, microsecond: number): string {
  const base =
    `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return `${base}${microsecond ? `.${pad(microsecond, 6)}` : ""}+00:00`;
}

/** `closes_at.isoformat().replace("+00:00", "Z")` as `GET /v1/gacha/banners` renders it. */
export function isoUtc(date: Date): string {
  return pythonIsoUtc(date, date.getUTCMilliseconds() * 1000).replace("+00:00", "Z");
}

const ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2})(?::(\d{2})(?::(\d{2})(?:[.,](\d{1,6}))?)?)?(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?)?$/;

/** `parse_epoch`: an ISO-8601 instant with an explicit offset that is a Monday 00:00:00 UTC. */
export function parseEpoch(value: string): Date {
  const text = value.trim().replace(/Z/g, "+00:00");
  const match = ISO.exec(text);
  const invalid = (): never => {
    throw new RotationError(`Banner epoch is not an ISO-8601 timestamp: ${repr(value)}`);
  };
  if (!match) return invalid();
  const [, y, mo, d, h = "0", mi = "0", s = "0", frac = "", sign, oh, om, os = "0"] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  const microsecond = frac ? Number(frac.padEnd(6, "0")) : 0;
  const local = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(local);
  if (
    year < 1 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day ||
    hour > 23 || minute > 59 || second > 59
  ) {
    return invalid();
  }
  if (sign === undefined) throw new RotationError(`Banner epoch needs an explicit UTC offset (e.g. ...Z): ${repr(value)}`);
  const offsetSeconds = (Number(oh) * 3600 + Number(om) * 60 + Number(os)) * (sign === "-" ? -1 : 1);
  if (Math.abs(offsetSeconds) >= 86_400) return invalid();
  const utc = new Date(local - offsetSeconds * 1000 + Math.floor(microsecond / 1000));
  const monday = utc.getUTCDay() === 1;
  if (!monday || utc.getUTCHours() || utc.getUTCMinutes() || utc.getUTCSeconds() || microsecond) {
    throw new RotationError(`Banner epoch must be a Monday 00:00:00 UTC, got ${pythonIsoUtc(utc, microsecond)}`);
  }
  return utc;
}

/** `open_banner_windows(banners, now, epoch)`: open banners at `now`, permanent ones first. */
export function openBannerWindows(banners: Row, now: Date, epoch: Date | null): BannerWindow[] {
  const rotation = item(banners, "rotation");
  const afterLast = isObject(rotation) && Object.hasOwn(rotation, "after_last") ? rotation.after_last : null;
  if (afterLast !== "loop") {
    throw new RotationError(`Unsupported rotation.after_last: ${typeof afterLast === "string" ? repr(afterLast) : String(afterLast ?? "None")}`);
  }
  const order = item(rotation, "order");
  const period = Math.trunc(Number(item(banners, "limited_duration_days")));
  if (!Array.isArray(order) || order.length === 0 || !(period >= 1)) {
    throw new RotationError("Rotation needs a non-empty order and a positive period");
  }
  const permanent = item(rotation, "permanent_banner_ids");
  const windows: BannerWindow[] = (Array.isArray(permanent) ? permanent : []).map((id) => ({ banner_id: String(id), closes_at: null }));
  let pair: unknown;
  let closes: Date | null;
  if (epoch === null) {
    pair = order[0];
    closes = null;
  } else if (now.getTime() < epoch.getTime()) {
    return windows;
  } else {
    const step = period * DAY_MS;
    const index = Math.floor((now.getTime() - epoch.getTime()) / step);
    pair = order[index % order.length];
    closes = new Date(epoch.getTime() + step * (index + 1));
  }
  windows.push({ banner_id: `character:${String(pair)}`, closes_at: closes });
  windows.push({ banner_id: `weapon:${String(pair)}`, closes_at: closes });
  return windows;
}
