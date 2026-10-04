import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { IdentityVerifier } from "../src/identity";
import { innMealKey, rationRules, regenerate, status } from "../src/ration";
import type { SimulatedBattle } from "../src/stages";
import { loadFixture } from "./engine/fixtures";
import { createTestDatabase, type TestDatabase } from "./db";

describe("Ration rules (owner decision: cap 100)", () => {
  const rules = { cap: 100, regen_seconds_per_unit: 300, daily_inn_meal: 30 };

  it("comes from economy_part1.json", () => {
    expect(rationRules()).toEqual(rules);
  });

  it("regenerates whole units, keeps partial progress and stops at the cap", () => {
    expect(regenerate(40, 1000, 1000 + 299, rules)).toEqual({ ration: 40, anchor_unix: 1000 });
    expect(regenerate(40, 1000, 1000 + 650, rules)).toEqual({ ration: 42, anchor_unix: 1600 });
    expect(regenerate(98, 1000, 1000 + 3600, rules)).toEqual({ ration: 100, anchor_unix: 4600 });
    expect(regenerate(130, 1000, 9000, rules), "a granted surplus stays but does not grow").toEqual({ ration: 130, anchor_unix: 9000 });
    expect(regenerate(10, 5000, 4000, rules), "a clock behind the anchor regenerates nothing").toEqual({ ration: 10, anchor_unix: 5000 });
  });

  it("reports when the next unit and a full meter arrive", () => {
    expect(status({ ration: 94, anchor_unix: 1000 }, rules)).toMatchObject({ next_unit_at_unix: 1300, full_at_unix: 1000 + 6 * 300 });
    expect(status({ ration: 100, anchor_unix: 1000 }, rules)).toMatchObject({ next_unit_at_unix: null, full_at_unix: null });
  });
});

describe("Ration through the stage flow", () => {
  let database: TestDatabase;
  let counter = 0;
  let now = 1791367200;
  let verdict: SimulatedBattle = { outcome: "victory", stars: 3, actions: 20, cycles: 3 };
  const verifier: IdentityVerifier = {
    verify: async (credential) => {
      const [subject, nonce] = credential.split("|");
      return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
    },
  };
  const app = () => createApp({ connect: () => database.connect(), verifier, simulate: () => verdict, nowUnix: () => now });

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database?.close();
  });

  async function call(token: string | null, method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    if (method === "POST" && token) headers["idempotency-key"] = crypto.randomUUID();
    const response = await app()(new Request(`https://api.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  }

  async function playerAt(stageId: string) {
    const issued = await call(null, "POST", "/v1/auth/nonce");
    const signed = await call(null, "POST", "/v1/auth/google", { credential: `ration-${++counter}|${issued.body.nonce}` });
    const { session_token: token, account_id: accountId } = signed.body;
    const state = loadFixture<{ cases: { stage_id: string; state: unknown }[] }>("rosters").cases.find((entry) => entry.stage_id === stageId)!.state;
    await database.pool.query("UPDATE story_state SET state = $2 WHERE account_id = $1", [accountId, JSON.stringify(state)]);
    await database.pool.query("UPDATE wallet SET ration_updated_at = to_timestamp($2) WHERE account_id = $1", [accountId, now]);
    return { token: token as string, accountId: accountId as string };
  }

  const ROSTER = ["brin_alder", "fadyme", "mahmut", "tilda_fen"];
  const win = async (token: string, stageId: string) => {
    const begin = await call(token, "POST", `/v1/stages/${stageId}/attempts`, { roster: ROSTER });
    if (begin.status !== 200) return begin;
    return call(token, "POST", `/v1/attempts/${begin.body.attempt.attempt_id}/victory`, { outcome: "victory", stars: 3 });
  };

  it("spends the stage cost on a verified victory only and regenerates on the server clock", async () => {
    const { token, accountId } = await playerAt("1-4");
    const first = await win(token, "1-4");
    expect(first.status).toBe(200);
    expect(first.body.state.wallet.ration).toBe(94);
    expect(first.body.state.ration).toMatchObject({ current: 94, next_unit_at_utc: "2026-10-07T10:05:00+00:00", full_at_utc: "2026-10-07T10:30:00+00:00" });

    verdict = { outcome: "defeat", stars: 0, actions: 40, cycles: 5 };
    const lost = await win(token, "1-2");
    expect(lost.status, "an unverified run is refused").toBe(409);
    verdict = { outcome: "victory", stars: 3, actions: 20, cycles: 3 };
    expect((await call(token, "GET", "/v1/wallet")).body.ration, "a defeat costs nothing").toBe(94);

    now += 7 * 60; // one unit later, with 2 minutes of progress kept
    expect((await call(token, "GET", "/v1/state")).body.ration).toMatchObject({ current: 95, next_unit_at_utc: "2026-10-07T10:10:00+00:00" });
    const replay = await win(token, "1-2");
    expect(replay.body.state.ration, "partial progress survives a spend below the cap").toMatchObject({ current: 89, next_unit_at_utc: "2026-10-07T10:10:00+00:00" });
    const row = await database.pool.query("SELECT ration FROM wallet WHERE account_id = $1", [accountId]);
    expect(Number(row.rows[0].ration)).toBe(89);
  });

  it("refuses to open an attempt without enough Ration; the free tutorial needs none", async () => {
    const { token, accountId } = await playerAt("1-4");
    await database.pool.query("UPDATE wallet SET ration = 5 WHERE account_id = $1", [accountId]);
    const refused = await call(token, "POST", "/v1/stages/1-4/attempts", { roster: ROSTER });
    expect(refused.status).toBe(402);
    expect(refused.body.error).toEqual({ code: "INSUFFICIENT_FUNDS", message: "Not enough Ration (have 5, need 6)" });
    now += 300;
    expect((await call(token, "POST", "/v1/stages/1-4/attempts", { roster: ROSTER })).status, "one regenerated unit later it opens").toBe(200);
    expect((await call(token, "POST", "/v1/stages/1-1/attempts", { roster: [] })).status).toBe(200);
  });

  it("grants the Inn Meal once per UTC day, above the cap if need be", async () => {
    const { token, accountId } = await playerAt("1-4");
    await database.pool.query("UPDATE wallet SET ration = 40, ration_updated_at = to_timestamp($2) WHERE account_id = $1", [accountId, now]);
    expect((await call(token, "GET", "/v1/state")).body.ration.inn_meal).toEqual({ amount: 30, available: true });
    const meal = await call(token, "POST", "/v1/ration/inn-meal");
    expect(meal.status).toBe(200);
    expect(meal.body).toMatchObject({ claim_key: innMealKey(now), already_claimed: false, ration_granted: 30 });
    expect(meal.body.state.ration).toMatchObject({ current: 70, inn_meal: { available: false } });
    const again = await call(token, "POST", "/v1/ration/inn-meal");
    expect(again.body, "a second meal the same day grants nothing").toMatchObject({ already_claimed: true, ration_granted: 0 });
    expect(again.body.state.ration.current).toBe(70);

    now += 86400; // the next UTC day
    await database.pool.query("UPDATE wallet SET ration = 90, ration_updated_at = to_timestamp($2) WHERE account_id = $1", [accountId, now]);
    expect((await call(token, "GET", "/v1/state")).body.ration.inn_meal.available).toBe(true);
    const full = await call(token, "POST", "/v1/ration/inn-meal");
    expect(full.body.state.ration, "the surplus stays and regeneration pauses").toMatchObject({ current: 120, next_unit_at_utc: null, full_at_utc: null });
  });
});
