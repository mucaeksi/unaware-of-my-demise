import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;
const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};
/** Wednesday 2026-10-07T10:00:00Z: half-day cycle 41466, week 2961 (Monday 2026-10-05), segment cycle_a. */
const NOW = 1791367200;
const app = () => createApp({ connect: () => database.connect(), verifier, nowUnix: () => NOW });

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

async function newPlayer(): Promise<{ token: string; accountId: string }> {
  const issued = (await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const response = await app()(
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `quests-${++counter}|${issued.nonce}` }) }),
  );
  const body = (await response.json()) as { session_token: string; account_id: string };
  return { token: body.session_token, accountId: body.account_id };
}

async function call(token: string, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (method === "POST") headers["idempotency-key"] = crypto.randomUUID();
  const response = await app()(new Request(`https://api.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

const progress = (accountId: string, taskId: string, cycleId: number, value: number) =>
  database.pool.query("INSERT INTO quest_progress (account_id, task_id, cycle_id, progress) VALUES ($1, $2, $3, $4)", [accountId, taskId, cycleId, value]);
const claim = (token: string, kind: string, taskId: string, period?: string) => call(token, "POST", "/v1/quests/claim", { kind, task_id: taskId, period });

describe("GET /v1/quests/status", () => {
  it("reports the server-clock scope, verified progress and last week's mail", async () => {
    const { token, accountId } = await newPlayer();
    await progress(accountId, "win_three_battles", 41466, 2);
    const { status, body } = await call(token, "GET", "/v1/quests/status");
    expect(status).toBe(200);
    expect(body).toMatchObject({
      daily_cycle_id: 41466,
      daily_ends_at_utc: "2026-10-07T12:00:00+00:00",
      weekly_key: "2026-10-05",
      weekly_segment: "cycle_a",
      weekly_ends_at_utc: "2026-10-08T00:00:00+00:00",
      claimed: [],
    });
    expect(body.daily_tasks).toEqual([
      { task_id: "win_three_battles", progress: 2, target: 3 },
      { task_id: "improve_company_kit", progress: 0, target: 1 },
    ]);
    expect(body.mail.map((item: { week_key: string; segment: string }) => `${item.week_key}:${item.segment}`)).toEqual([
      "2026-09-28:cycle_a",
      "2026-09-28:cycle_b",
      "2026-09-28:sun_eclipse",
    ]);
  });
});

describe("POST /v1/quests/claim", () => {
  it("pays a completed daily task once, then the window chest after both tasks", async () => {
    const { token, accountId } = await newPlayer();
    expect((await claim(token, "daily", "win_three_battles")).body.error.message).toBe("win_three_battles is not complete (0/3)");
    await progress(accountId, "win_three_battles", 41466, 3);
    await progress(accountId, "improve_company_kit", 41466, 1);
    expect((await claim(token, "daily", "window_completion")).body.error.message).toBe("Claim win_three_battles, improve_company_kit first");
    const first = await claim(token, "daily", "win_three_battles");
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      claim_key: "daily:41466:win_three_battles",
      already_claimed: false,
      granted: { eclipse_token: 80, silver_crown: 10000, character_xp: 1500, account_xp: 0 },
      eclipse_tokens: first.body.state.wallet.eclipse_tokens,
    });
    expect(first.body.state.items.bound_chronicle, "1500 Character XP as three Bound Chronicles").toBe(3);
    const again = await claim(token, "daily", "win_three_battles");
    expect(again.body.already_claimed).toBe(true);
    expect(again.body.state.wallet).toEqual(first.body.state.wallet);
    expect((await claim(token, "daily", "improve_company_kit")).status).toBe(200);
    const chest = await claim(token, "daily", "window_completion");
    expect(chest.body.granted).toEqual({ eclipse_token: 0, silver_crown: 15000, character_xp: 2000, account_xp: 400 });
    expect(chest.body.state.items.illuminated_chronicle).toBe(1);
    expect((await claim(token, "daily", "watch_rewarded_memory")).body.error.message).toBe("Unknown or non-claimable daily task: 'watch_rewarded_memory'");
  });

  it("pays the active weekly segment and last week's finished segments from the mail", async () => {
    const { token, accountId } = await newPlayer();
    expect((await claim(token, "weekly", "cycle_b")).body.error.message).toBe("Weekly segment 'cycle_b' is not the active one (cycle_a)");
    expect((await claim(token, "weekly", "cycle_a")).body.error.message).toBe("weekly:cycle_a is not complete (0/15)");
    await progress(accountId, "weekly:cycle_a", 2961, 15);
    const active = await claim(token, "weekly", "cycle_a");
    expect(active.body).toMatchObject({ claim_key: "weekly:2026-10-05:cycle_a", granted: { eclipse_token: 320, silver_crown: 26000 } });

    expect((await claim(token, "weekly", "cycle_b", "2026-09-28")).body.error.message).toBe("weekly:cycle_b is not complete (0/5)");
    await progress(accountId, "weekly:cycle_b", 2960, 5);
    const mailed = await claim(token, "weekly", "cycle_b", "2026-09-28");
    expect(mailed.body.claim_key).toBe("weekly:2026-09-28:cycle_b");
    expect((await claim(token, "weekly", "cycle_b", "2026-09-21")).body.error.message).toBe("That weekly reward is not in the mailbox (expired or not finished yet)");
    const status = await call(token, "GET", "/v1/quests/status");
    expect(status.body.claimed).toEqual(["weekly:2026-10-05:cycle_a"]);
    expect(status.body.mail.find((item: { segment: string }) => item.segment === "cycle_b")).toMatchObject({ claimed: true, progress: 5, target: 5 });
  });

  it("rejects malformed requests", async () => {
    const { token } = await newPlayer();
    expect((await claim(token, "monthly", "x")).status).toBe(400);
    expect((await call(token, "POST", "/v1/quests/claim", { kind: "weekly", task_id: "cycle_a", period: "last week" })).status).toBe(400);
  });
});
