// Ration, the stamina currency (owner decision 2026-10-04, DEC-0014; economy_part1.json `ration`): capped balance that
// regenerates one unit every `regen_seconds_per_unit`, spent only by a verified victory of a Ration-costing stage
// (`loss_on_failure: false`: a defeat or an abandoned attempt costs nothing).
//
// No timer runs anywhere. `wallet.ration` is the balance as of `wallet.ration_updated_at`; reading or spending adds the
// whole units regenerated since then. Regeneration stops at the cap (a balance raised above it by a grant stays, but
// does not grow) and restarts from the moment a spend takes the balance below the cap again.
import { toSafeInt, type Db } from "./db";
import { ApiError } from "./http";
import { questProgress } from "./rules";

export interface RationRules {
  cap: number;
  regen_seconds_per_unit: number;
  /** Ration the once-a-day Inn Meal grants (`daily_inn_meal`; 0 = none). */
  daily_inn_meal: number;
}

export function rationRules(): RationRules {
  const ration = questProgress().economyPack().ration as Record<string, unknown> | undefined;
  const cap = Number(ration?.cap);
  const regen = Number(ration?.regen_seconds_per_unit);
  const meal = Number(ration?.daily_inn_meal ?? 0);
  if (!Number.isSafeInteger(cap) || cap <= 0 || !Number.isSafeInteger(regen) || regen <= 0 || !Number.isSafeInteger(meal) || meal < 0) {
    throw new Error("economy_part1.json ration.cap / regen_seconds_per_unit / daily_inn_meal are invalid");
  }
  return { cap, regen_seconds_per_unit: regen, daily_inn_meal: meal };
}

export interface RationState {
  /** The balance now, regeneration included. */
  ration: number;
  /** The instant regeneration counts from (unix seconds); equal to `now` while at or above the cap. */
  anchor_unix: number;
}

/** The balance at `nowUnix` of a stored balance and its timestamp. */
export function regenerate(stored: number, updatedUnix: number, nowUnix: number, rules: RationRules = rationRules()): RationState {
  if (stored >= rules.cap) return { ration: stored, anchor_unix: nowUnix };
  const elapsed = Math.max(0, nowUnix - updatedUnix);
  const units = Math.floor(elapsed / rules.regen_seconds_per_unit);
  const ration = Math.min(rules.cap, stored + units);
  return { ration, anchor_unix: ration >= rules.cap ? nowUnix : updatedUnix + units * rules.regen_seconds_per_unit };
}

export interface RationStatus extends RationState {
  cap: number;
  regen_seconds_per_unit: number;
  /** When the next unit arrives; null at or above the cap. */
  next_unit_at_unix: number | null;
  /** When the balance reaches the cap; null at or above the cap. */
  full_at_unix: number | null;
}

export function status(state: RationState, rules: RationRules = rationRules()): RationStatus {
  const below = state.ration < rules.cap;
  return {
    ...state,
    cap: rules.cap,
    regen_seconds_per_unit: rules.regen_seconds_per_unit,
    next_unit_at_unix: below ? state.anchor_unix + rules.regen_seconds_per_unit : null,
    full_at_unix: below ? state.anchor_unix + (rules.cap - state.ration) * rules.regen_seconds_per_unit : null,
  };
}

/** The account's Ration now (a read; nothing is written). */
export async function currentRation(db: Db, accountId: string, nowUnix: number): Promise<RationStatus> {
  const { rows } = await db.query<{ ration: unknown; updated: unknown }>(
    "SELECT ration, extract(epoch FROM ration_updated_at) AS updated FROM wallet WHERE account_id = $1",
    [accountId],
  );
  if (!rows[0]) throw new Error(`account ${accountId} has no wallet`);
  return status(regenerate(toSafeInt(rows[0].ration), Math.floor(Number(rows[0].updated)), nowUnix));
}

/** Refuses with 402 INSUFFICIENT_FUNDS when the account cannot pay `cost` now. */
export async function requireRation(db: Db, accountId: string, cost: number, nowUnix: number): Promise<void> {
  if (cost <= 0) return;
  const { ration } = await currentRation(db, accountId, nowUnix);
  if (ration < cost) throw new ApiError(402, "INSUFFICIENT_FUNDS", `Not enough Ration (have ${ration}, need ${cost})`);
}

/** Spends `cost` inside the caller's transaction (the account row is locked), materializing regeneration first. */
export async function spendRation(tx: Db, accountId: string, cost: number, nowUnix: number): Promise<RationStatus> {
  const rules = rationRules();
  const now = await currentRation(tx, accountId, nowUnix);
  if (cost <= 0) return now;
  if (now.ration < cost) throw new ApiError(402, "INSUFFICIENT_FUNDS", `Not enough Ration (have ${now.ration}, need ${cost})`);
  const ration = now.ration - cost;
  // Below the cap regeneration keeps its partial progress; leaving the cap starts it now.
  const anchor = now.ration >= rules.cap ? nowUnix : now.anchor_unix;
  await tx.query("UPDATE wallet SET ration = $2, ration_updated_at = to_timestamp($3) WHERE account_id = $1", [accountId, ration, anchor]);
  return status({ ration, anchor_unix: anchor }, rules);
}

/** The `quest_claims` key of the Inn Meal of the UTC day containing `nowUnix` ("inn_meal:YYYY-MM-DD"). */
export function innMealKey(nowUnix: number): string {
  return `inn_meal:${new Date(Math.floor(nowUnix / 86400) * 86400 * 1000).toISOString().slice(0, 10)}`;
}

/** Whether today's Inn Meal is still unclaimed (always false when the content authors no meal). */
export async function innMealAvailable(db: Db, accountId: string, nowUnix: number): Promise<boolean> {
  if (rationRules().daily_inn_meal <= 0) return false;
  const { rowCount } = await db.query("SELECT 1 FROM quest_claims WHERE account_id = $1 AND claim_key = $2", [accountId, innMealKey(nowUnix)]);
  return rowCount === 0;
}

export interface InnMealResult {
  claim_key: string;
  already_claimed: boolean;
  ration_granted: number;
}

/**
 * The daily Inn Meal (DEC-0014): `daily_inn_meal` Ration once per UTC day of the server clock, recorded in `quest_claims`
 * (a repeat the same day grants nothing and says so). Like any grant it may lift the balance above the cap; regeneration
 * then pauses until spending takes it below the cap again. Runs inside the caller's transaction (account row locked).
 */
export async function claimInnMeal(tx: Db, accountId: string, nowUnix: number): Promise<InnMealResult> {
  const rules = rationRules();
  if (rules.daily_inn_meal <= 0) throw new ApiError(409, "CONFLICT", "There is no Inn Meal");
  const key = innMealKey(nowUnix);
  const done = await tx.query("SELECT 1 FROM quest_claims WHERE account_id = $1 AND claim_key = $2", [accountId, key]);
  if (done.rowCount !== 0) return { claim_key: key, already_claimed: true, ration_granted: 0 };
  const now = await currentRation(tx, accountId, nowUnix);
  const ration = now.ration + rules.daily_inn_meal;
  const anchor = ration >= rules.cap ? nowUnix : now.anchor_unix;
  await tx.query("UPDATE wallet SET ration = $2, ration_updated_at = to_timestamp($3) WHERE account_id = $1", [accountId, ration, anchor]);
  await tx.query("INSERT INTO quest_claims (account_id, claim_key, granted_json) VALUES ($1, $2, $3)", [accountId, key, JSON.stringify({ ration: rules.daily_inn_meal })]);
  return { claim_key: key, already_claimed: false, ration_granted: rules.daily_inn_meal };
}
