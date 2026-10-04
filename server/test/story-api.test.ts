import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { storyRules } from "../src/rules";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

const FIRST_OATH_POOL = storyRules().firstOathChoices();
const STORY_ORDER = storyRules().storyOrder();

let database: TestDatabase;
let counter = 0;

/** The credential is "<subject>|<nonce>": enough to sign test players in. */
const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};

const app = () => createApp({ connect: () => database.connect(), verifier });

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

async function newPlayer(): Promise<{ token: string; accountId: string }> {
  const issued = (await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const response = await app()(
    new Request("https://api.test/v1/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential: `player-${++counter}|${issued.nonce}` }),
    }),
  );
  const body = (await response.json()) as { session_token: string; account_id: string };
  return { token: body.session_token, accountId: body.account_id };
}

async function post(token: string, path: string, key: string | null, body?: unknown) {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (key !== null) headers["idempotency-key"] = key;
  const response = await app()(
    new Request(`https://api.test${path}`, { method: "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function cursor(accountId: string): Promise<number> {
  const { rows } = await database.pool.query("SELECT state FROM story_state WHERE account_id = $1", [accountId]);
  return rows[0].state.story_cursor;
}

describe("POST /v1/story/advance", () => {
  it("requires a session and a UUIDv4 Idempotency-Key", async () => {
    const { token } = await newPlayer();
    expect((await post("nope", "/v1/story/advance", crypto.randomUUID())).status).toBe(401);
    expect((await post(token, "/v1/story/advance", null)).body.error).toEqual({
      code: "INVALID_REQUEST",
      message: "Idempotency-Key header is required",
    });
    expect((await post(token, "/v1/story/advance", "not-a-uuid")).status).toBe(400);
    expect((await post(token, "/v1/story/advance", "00000000-0000-1000-8000-000000000000")).status).toBe(400);
  });

  it("moves past a narrative entry and answers with the new snapshot", async () => {
    const { token, accountId } = await newPlayer();
    const { status, body } = await post(token, "/v1/story/advance", crypto.randomUUID());
    expect(status).toBe(200);
    expect(body.state.schema_version).toBe(1);
    expect(body.state.story_state.story_cursor).toBe(1);
    expect(body.state.story_state.story_cursor_entry_id).toBe(STORY_ORDER[1]);
    expect(await cursor(accountId)).toBe(1);
  });

  it("replays a retried request instead of advancing twice", async () => {
    const { token, accountId } = await newPlayer();
    const key = crypto.randomUUID();
    const first = await post(token, "/v1/story/advance", key);
    const retry = await post(token, "/v1/story/advance", key.toUpperCase());
    expect(retry).toEqual(first);
    expect(await cursor(accountId)).toBe(1);
  });

  it("refuses a key reused by another account or for another endpoint", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const key = crypto.randomUUID();
    expect((await post(a.token, "/v1/story/advance", key)).status).toBe(200);
    expect((await post(b.token, "/v1/story/advance", key)).status).toBe(409);
    expect((await post(a.token, "/v1/story/first-oath", key, { character_id: FIRST_OATH_POOL[0] })).status).toBe(409);
    expect(await cursor(b.accountId)).toBe(0);
  });

  it("never moves a stage entry and stores nothing for a refused request", async () => {
    const { token, accountId } = await newPlayer();
    await post(token, "/v1/story/advance", crypto.randomUUID()); // opening scene -> stage 1-1
    const key = crypto.randomUUID();
    const refused = await post(token, "/v1/story/advance", key);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("CONFLICT");
    expect(await cursor(accountId)).toBe(1);
    const stored = await database.pool.query("SELECT 1 FROM idempotency_keys WHERE idempotency_key = $1", [key]);
    expect(stored.rowCount).toBe(0);
  });

  it("serializes concurrent requests of one account", async () => {
    const { token, accountId } = await newPlayer();
    const results = await Promise.all([1, 2, 3].map(() => post(token, "/v1/story/advance", crypto.randomUUID())));
    expect(results.map((result) => result.status).sort()).toEqual([200, 409, 409]);
    expect(await cursor(accountId)).toBe(1);
  });
});

describe("POST /v1/story/first-oath", () => {
  async function invitationAvailable(accountId: string): Promise<void> {
    await database.pool.query(
      "UPDATE story_state SET state = state || '{\"first_oath_invitation_available\": true}'::jsonb WHERE account_id = $1",
      [accountId],
    );
  }

  it("is refused until the invitation is granted", async () => {
    const { token } = await newPlayer();
    const response = await post(token, "/v1/story/first-oath", crypto.randomUUID(), { character_id: FIRST_OATH_POOL[0] });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("First Oath Invitation is not available yet");
  });

  it("grants the chosen hero once and records the claim", async () => {
    const { token, accountId } = await newPlayer();
    await invitationAvailable(accountId);
    const hero = FIRST_OATH_POOL[2]!;
    const { status, body } = await post(token, "/v1/story/first-oath", crypto.randomUUID(), { character_id: hero });
    expect(status).toBe(200);
    expect(body.state.story_state.owned_character_ids).toContain(hero);
    expect(body.state.story_state.first_oath_invitation_selection).toBe(hero);
    expect(body.state.story_state.first_oath_invitation_available).toBe(false);
    expect(body.state.roster[hero]).toMatchObject({ level: 1 });
    const claims = await database.pool.query("SELECT character_id FROM story_claims WHERE account_id = $1", [accountId]);
    expect(claims.rows).toEqual([{ character_id: hero }]);

    await invitationAvailable(accountId); // even a tampered flag cannot buy a second pick
    const second = await post(token, "/v1/story/first-oath", crypto.randomUUID(), { character_id: FIRST_OATH_POOL[3] });
    expect(second.status).toBe(409);
  });

  it("rejects a hero outside the pool and a missing character_id", async () => {
    const { token, accountId } = await newPlayer();
    await invitationAvailable(accountId);
    expect((await post(token, "/v1/story/first-oath", crypto.randomUUID(), { character_id: "mahmut" })).status).toBe(400);
    expect((await post(token, "/v1/story/first-oath", crypto.randomUUID(), {})).status).toBe(400);
  });
});
