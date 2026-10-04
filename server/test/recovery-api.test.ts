// INF-013/INF-014: what a client needs after a lost reply or a restart — the committed result of an operation, the open
// battle attempt in the snapshot, and giving an attempt up.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { IdentityVerifier } from "../src/identity";
import type { SimulatedBattle, Simulate, StoredAttempt } from "../src/stages";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;

const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};

const verdict: SimulatedBattle = { outcome: "victory", stars: 3, actions: 20, cycles: 3 };
const simulated: StoredAttempt[] = [];
const simulate: Simulate = (attempt) => {
  simulated.push(attempt);
  return verdict;
};
const app = () => createApp({ connect: () => database.connect(), verifier, simulate });

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

async function newPlayer(): Promise<string> {
  const issued = (await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const response = await app()(
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `recovery-${++counter}|${issued.nonce}` }) }),
  );
  return ((await response.json()) as { session_token: string }).session_token;
}

async function post(token: string, path: string, body?: unknown, key: string = crypto.randomUUID()) {
  const response = await app()(
    new Request(`https://api.test${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function get(token: string, path: string) {
  const response = await app()(new Request(`https://api.test${path}`, { headers: { authorization: `Bearer ${token}` } }));
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

/** A player whose story cursor is at stage 1-1 (the tutorial: the two free starters). */
async function atFirstStage(): Promise<string> {
  const token = await newPlayer();
  expect((await post(token, "/v1/story/advance")).status).toBe(200);
  return token;
}

describe("GET /v1/operations/{key}", () => {
  it("answers the committed result of a request whose reply was lost", async () => {
    const token = await newPlayer();
    const key = crypto.randomUUID();
    const advanced = await post(token, "/v1/story/advance", undefined, key);
    const { status, body } = await get(token, `/v1/operations/${key}`);
    expect(status).toBe(200);
    expect(body.operation_key).toBe(key);
    expect(body.endpoint).toBe("story_advance");
    expect(body.response).toEqual(advanced.body);
    expect(Date.parse(body.committed_at_utc)).not.toBeNaN();
  });

  it("is 404 for a key that never committed, a rejected request, another account's key and malformed keys", async () => {
    const token = await newPlayer();
    expect((await get(token, `/v1/operations/${crypto.randomUUID()}`)).status).toBe(404);
    const refused = crypto.randomUUID();
    expect((await post(token, "/v1/story/first-oath", { character_id: "fadyme" }, refused)).status).toBeGreaterThanOrEqual(400);
    expect((await get(token, `/v1/operations/${refused}`)).status, "a rolled-back request stores nothing").toBe(404);
    const other = await newPlayer();
    const theirs = crypto.randomUUID();
    expect((await post(other, "/v1/story/advance", undefined, theirs)).status).toBe(200);
    expect((await get(token, `/v1/operations/${theirs}`)).status).toBe(404);
    expect((await get(token, "/v1/operations/not-a-uuid")).status).toBe(404);
    expect((await get("nope", `/v1/operations/${theirs}`)).status).toBe(401);
  });
});

describe("open_attempt in the snapshot", () => {
  it("is null without an open battle and carries the frozen attempt while one is open", async () => {
    const token = await atFirstStage();
    expect((await get(token, "/v1/state")).body.open_attempt).toBeNull();
    const opened = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    const open = opened.body.state.open_attempt;
    expect(open).toEqual({
      attempt_id: opened.body.attempt.attempt_id,
      stage_id: "1-1",
      run_seed: opened.body.attempt.run_seed,
      roster: [],
      inputs: { owned_character_ids: ["fadyme", "mahmut"], player_levels: {}, equipment: {}, skill_ranks: {}, memory_nodes: {} },
    });
    expect((await get(token, "/v1/state")).body.open_attempt).toEqual(open);
  });

  it("holds exactly what the server re-simulates, and clears with the victory", async () => {
    const token = await atFirstStage();
    const opened = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    const open = opened.body.state.open_attempt;
    const won = await post(token, `/v1/attempts/${open.attempt_id}/victory`, { outcome: "victory" });
    expect(won.status).toBe(200);
    const run = simulated.at(-1)!;
    expect({ attempt_id: run.attempt_id, stage_id: run.stage_id, run_seed: run.run_seed, roster: run.roster, inputs: run.inputs }).toEqual(open);
    expect(won.body.state.open_attempt).toBeNull();
  });

  it("shows only the newest attempt: opening another one expires the older", async () => {
    const token = await atFirstStage();
    await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    const second = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    expect(second.body.state.open_attempt.attempt_id).toBe(second.body.attempt.attempt_id);
  });
});

describe("POST /v1/attempts/{attempt_id}/abandon", () => {
  it("gives an open attempt up: it pays nothing and leaves the snapshot", async () => {
    const token = await atFirstStage();
    const opened = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    const attemptId = opened.body.attempt.attempt_id;
    const abandoned = await post(token, `/v1/attempts/${attemptId}/abandon`);
    expect(abandoned.status).toBe(200);
    expect(abandoned.body.attempt_status).toBe("lost");
    expect(abandoned.body.state.open_attempt).toBeNull();
    expect(abandoned.body.state.story_state.story_cursor_entry_id, "nothing advanced").toBe("1-1");
    expect((await post(token, `/v1/attempts/${attemptId}/victory`, { outcome: "victory" })).body.error.code, "a lost attempt cannot pay").toBe("CONFLICT");
    expect((await post(token, `/v1/attempts/${attemptId}/abandon`)).status, "abandoning again changes nothing").toBe(200);
  });

  it("refuses a won attempt, an unknown one and another account's", async () => {
    const token = await atFirstStage();
    const opened = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    const attemptId = opened.body.attempt.attempt_id;
    const other = await atFirstStage();
    expect((await post(other, `/v1/attempts/${attemptId}/abandon`)).status, "not theirs").toBe(404);
    expect((await post(token, `/v1/attempts/${attemptId}/victory`, { outcome: "victory" })).status).toBe(200);
    expect((await post(token, `/v1/attempts/${attemptId}/abandon`)).body.error.code).toBe("CONFLICT");
    expect((await post(token, `/v1/attempts/${crypto.randomUUID()}/abandon`)).status).toBe(404);
    expect((await post(token, "/v1/attempts/not-a-uuid/abandon")).status).toBe(404);
  });
});

describe("rules release of an attempt (INF-022)", () => {
  it("records the rules an attempt opened under; under other rules it is neither offered nor paid", async () => {
    const token = await atFirstStage();
    const opened = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    const attemptId = opened.body.attempt.attempt_id;
    const stored = await database.pool.query("SELECT rules_hash FROM stage_attempts WHERE attempt_id = $1", [attemptId]);
    expect(stored.rows[0].rules_hash).toMatch(/^[0-9a-f]{64}$/);
    await database.pool.query("UPDATE stage_attempts SET rules_hash = $2 WHERE attempt_id = $1", [attemptId, "0".repeat(64)]);
    expect((await get(token, "/v1/state")).body.open_attempt, "not offered for resume").toBeNull();
    const won = await post(token, `/v1/attempts/${attemptId}/victory`, { outcome: "victory" });
    expect([won.status, won.body.error.code]).toEqual([409, "RULES_CHANGED"]);
  });

  it("still pays an attempt opened before the rules were recorded", async () => {
    const token = await atFirstStage();
    const opened = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    await database.pool.query("UPDATE stage_attempts SET rules_hash = NULL WHERE attempt_id = $1", [opened.body.attempt.attempt_id]);
    expect((await post(token, `/v1/attempts/${opened.body.attempt.attempt_id}/victory`, { outcome: "victory" })).status).toBe(200);
  });
});
