// INF-016: request intake limits and the data lifecycle (retention job, reply tombstones, attempt expiry).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { ApiError, MAX_BODY_BYTES, readBoundedText } from "../src/http";
import type { IdentityVerifier } from "../src/identity";
import { runRetention } from "../src/retention";
import type { Simulate } from "../src/stages";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;

const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};
const simulate: Simulate = () => ({ outcome: "victory", stars: 3, actions: 20, cycles: 3 });
const app = () => createApp({ connect: () => database.connect(), verifier, simulate });

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

async function newPlayer(): Promise<{ token: string; accountId: string }> {
  const issued = (await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const response = await app()(
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `lifecycle-${++counter}|${issued.nonce}` }) }),
  );
  const body = (await response.json()) as { session_token: string; account_id: string };
  return { token: body.session_token, accountId: body.account_id };
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

/** A body stream that never ends (1 KiB per pull) and counts how much was pulled. */
function endlessBody(): { request: Request; pulls: () => number } {
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(1024).fill(0x20));
    },
  });
  return { request: new Request("https://api.test/x", { method: "POST", body: stream, duplex: "half" } as RequestInit), pulls: () => pulls };
}

describe("request intake", () => {
  it("stops reading a body without Content-Length at the size cap", async () => {
    const { request, pulls } = endlessBody();
    await expect(readBoundedText(request)).rejects.toThrow("Request body is too large");
    expect(pulls()).toBeLessThanOrEqual(MAX_BODY_BYTES / 1024 + 2);
  });

  it("refuses a declared oversize body without reading it, and invalid UTF-8", async () => {
    const declared = new Request("https://api.test/x", { method: "POST", body: "{}", headers: { "content-length": String(MAX_BODY_BYTES + 1) } });
    await expect(readBoundedText(declared)).rejects.toBeInstanceOf(ApiError);
    const bad = new Request("https://api.test/x", { method: "POST", body: new Uint8Array([0x7b, 0xff, 0x7d]) });
    await expect(readBoundedText(bad)).rejects.toThrow("UTF-8");
    expect(await readBoundedText(new Request("https://api.test/x", { method: "POST", body: '{"a":"é"}' }))).toBe('{"a":"é"}');
    expect(await readBoundedText(new Request("https://api.test/x"))).toBe("");
  });

  it("answers an endless body on a route with 400", async () => {
    const { token } = await newPlayer();
    const { request } = endlessBody();
    const withHeaders = new Request("https://api.test/v1/story/first-oath", {
      method: "POST",
      body: request.body,
      headers: { authorization: `Bearer ${token}`, "idempotency-key": crypto.randomUUID() },
      duplex: "half",
    } as RequestInit);
    expect((await app()(withHeaders)).status).toBe(400);
  });
});

describe("retention job", () => {
  it("deletes nonces and sessions long past expiry and keeps recent ones", async () => {
    const db = database.pool;
    await db.query("INSERT INTO auth_nonces (nonce, expires_at) VALUES ('old-nonce', now() - interval '2 days'), ('recent-nonce', now() - interval '1 hour')");
    const { accountId } = await newPlayer();
    await db.query(
      "INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ('old-session', $1, now() - interval '8 days'), ('recent-session', $1, now() - interval '1 day')",
      [accountId],
    );
    const report = await runRetention(db);
    expect(report.nonces_deleted).toBeGreaterThanOrEqual(1);
    expect(report.sessions_deleted).toBeGreaterThanOrEqual(1);
    const nonces = (await db.query("SELECT nonce FROM auth_nonces WHERE nonce IN ('old-nonce', 'recent-nonce')")).rows.map((r) => r.nonce);
    expect(nonces).toEqual(["recent-nonce"]);
    const sessions = (await db.query("SELECT token_hash FROM sessions WHERE token_hash IN ('old-session', 'recent-session')")).rows.map((r) => r.token_hash);
    expect(sessions).toEqual(["recent-session"]);
    expect(await runRetention(db), "a second run has nothing left to do").toEqual({ nonces_deleted: 0, sessions_deleted: 0, attempts_expired: 0, replies_purged: 0 });
  });

  it("purges an old reply but keeps its key: a late retry is refused, never executed again", async () => {
    const { token, accountId } = await newPlayer();
    const key = crypto.randomUUID();
    expect((await post(token, "/v1/story/advance", undefined, key)).status).toBe(200);
    await database.pool.query("UPDATE idempotency_keys SET created_at = now() - interval '31 days' WHERE idempotency_key = $1", [key]);
    expect((await runRetention(database.pool)).replies_purged).toBe(1);
    const cursor = (await get(token, "/v1/state")).body.story_state.story_cursor;
    const late = await post(token, "/v1/story/advance", undefined, key);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe("OPERATION_EXPIRED");
    expect((await get(token, "/v1/state")).body.story_state.story_cursor, "nothing ran twice").toBe(cursor);
    const operation = await get(token, `/v1/operations/${key}`);
    expect([operation.status, operation.body.endpoint, operation.body.response]).toEqual([200, "story_advance", null]);
    const row = await database.pool.query("SELECT response_purged_at FROM idempotency_keys WHERE idempotency_key = $1 AND account_id = $2", [key, accountId]);
    expect(row.rows[0].response_purged_at).not.toBeNull();
  });
});

describe("attempt expiry", () => {
  it("an open attempt older than a day can no longer be won or resumed, and the job marks it expired", async () => {
    const { token, accountId } = await newPlayer();
    expect((await post(token, "/v1/story/advance")).status).toBe(200);
    const opened = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    const attemptId = opened.body.attempt.attempt_id;
    await database.pool.query("UPDATE stage_attempts SET created_at = now() - interval '25 hours' WHERE attempt_id = $1", [attemptId]);
    expect((await get(token, "/v1/state")).body.open_attempt, "no longer offered").toBeNull();
    const won = await post(token, `/v1/attempts/${attemptId}/victory`, { outcome: "victory" });
    expect([won.status, won.body.error.message]).toEqual([409, "This battle attempt is already expired"]);
    expect((await runRetention(database.pool)).attempts_expired).toBe(1);
    const row = await database.pool.query("SELECT status FROM stage_attempts WHERE attempt_id = $1 AND account_id = $2", [attemptId, accountId]);
    expect(row.rows[0].status).toBe("expired");
  });

  it("a fresh attempt is untouched by the job", async () => {
    const { token } = await newPlayer();
    expect((await post(token, "/v1/story/advance")).status).toBe(200);
    const opened = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    await runRetention(database.pool);
    expect((await get(token, "/v1/state")).body.open_attempt.attempt_id).toBe(opened.body.attempt.attempt_id);
  });
});
