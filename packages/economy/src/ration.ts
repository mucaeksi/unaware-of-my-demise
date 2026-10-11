/** Ration (energy), canon economy_part1.json: cap 100, +1 per 300 s, not purchasable, not lost on a failed battle. */
export const RATION_CAP = 100;
export const RATION_REGEN_MS = 300_000;

export interface RationState {
  value: number;
  /** reference time of `value`: advances in whole regen steps so the partial step is never lost */
  atMs: number;
}

/** Lazy regeneration: the state is only written when it is spent. */
export function rationNow(s: RationState, nowMs: number): RationState {
  if (s.value >= RATION_CAP) return { value: s.value, atMs: nowMs };
  const steps = Math.max(0, Math.floor((nowMs - s.atMs) / RATION_REGEN_MS));
  const value = Math.min(RATION_CAP, s.value + steps);
  return { value, atMs: value >= RATION_CAP ? nowMs : s.atMs + steps * RATION_REGEN_MS };
}

/** Returns the new state after paying `cost`, or null when there is not enough. */
export function rationSpend(s: RationState, cost: number, nowMs: number): RationState | null {
  const cur = rationNow(s, nowMs);
  if (cost < 0 || cur.value < cost) return null;
  // spending from a full tank starts the regeneration clock now
  return { value: cur.value - cost, atMs: s.value >= RATION_CAP && cur.value >= RATION_CAP ? nowMs : cur.atMs };
}

/** Milliseconds until the next point (0 when full). */
export function rationNextMs(s: RationState, nowMs: number): number {
  const cur = rationNow(s, nowMs);
  return cur.value >= RATION_CAP ? 0 : Math.max(0, cur.atMs + RATION_REGEN_MS - nowMs);
}
