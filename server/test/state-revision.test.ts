// INF-012: the account state revision and the consistent snapshot read.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { DbConnection } from "../src/db";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;

/** The credential is "<subject>|<nonce>": enough to sign test players in. */
const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};

const app = (connect: () => Promise<DbConnection> = () => database.connect()) => createApp({ connect, verifier });

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

async function newPlayer(): Promise<{ token: string; accountId: string }> {
  const issued = (await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const response = await app()(
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `revision-${++counter}|${issued.nonce}` }) }),
  );
  const body = (await response.json()) as { session_token: string; account_id: string };
  return { token: body.session_token, accountId: body.account_id };
}

async function post(token: string, path: string, key: string, body?: unknown) {
  const response = await app()(
    new Request(`https://api.test${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function state(token: string, connect?: () => Promise<DbConnection>): Promise<Record<string, any>> {
  const response = await app(connect)(new Request("https://api.test/v1/state", { headers: { authorization: `Bearer ${token}` } }));
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, any>;
}

describe("state_revision", () => {
  it("starts at 0 and grows by one with every committed mutation", async () => {
    const { token } = await newPlayer();
    expect((await state(token)).state_revision).toBe(0);
    const first = await post(token, "/v1/story/advance", crypto.randomUUID());
    expect(first.status).toBe(200);
    expect(first.body.state.state_revision).toBe(1);
    // The next story entry is a stage; the Inn Meal is a mutation that is always accepted.
    const second = await post(token, "/v1/ration/inn-meal", crypto.randomUUID(), {});
    expect(second.status).toBe(200);
    expect(second.body.state.state_revision).toBe(2);
    expect((await state(token)).state_revision).toBe(2);
  });

  it("is not raised by a replay, which answers the stored (older) revision", async () => {
    const { token } = await newPlayer();
    const key = crypto.randomUUID();
    expect((await post(token, "/v1/story/advance", key)).body.state.state_revision).toBe(1);
    expect((await post(token, "/v1/ration/inn-meal", crypto.randomUUID(), {})).status).toBe(200);
    const replay = await post(token, "/v1/story/advance", key);
    expect(replay.status).toBe(200);
    expect(replay.body.state.state_revision, "the stored response, older than the current state").toBe(1);
    expect((await state(token)).state_revision).toBe(2);
  });

  it("is not raised by a rejected mutation (it rolls back)", async () => {
    const { token } = await newPlayer();
    // The First Oath is not open before stage 1-2 is cleared.
    const refused = await post(token, "/v1/story/first-oath", crypto.randomUUID(), { character_id: "fadyme" });
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect((await state(token)).state_revision).toBe(0);
  });

  it("is per account", async () => {
    const one = await newPlayer();
    const two = await newPlayer();
    await post(one.token, "/v1/story/advance", crypto.randomUUID());
    expect((await state(one.token)).state_revision).toBe(1);
    expect((await state(two.token)).state_revision).toBe(0);
  });
});

describe("GET /v1/state consistency", () => {
  it("reads one database state even when a mutation commits halfway through the snapshot", async () => {
    const { token, accountId } = await newPlayer();
    let release!: () => void;
    const paused = new Promise<void>((resolve) => (release = resolve));
    let reachedStory!: () => void;
    const atStory = new Promise<void>((resolve) => (reachedStory = resolve));
    // Pause the snapshot right after its story query; the account revision was read before it, the wallet comes after.
    const pausing = async (): Promise<DbConnection> => {
      const connection = await database.connect();
      const query = connection.query.bind(connection);
      return Object.assign(connection, {
        query: async (text: string, values?: unknown[]) => {
          const result = await query(text, values);
          if (text.includes("FROM story_state")) {
            reachedStory();
            await paused;
          }
          return result;
        },
      }) as DbConnection;
    };
    const reading = state(token, pausing);
    await atStory;
    // A concurrent mutation commits: it changes the wallet and raises the revision.
    await database.pool.query("UPDATE wallet SET silver_crowns = 777 WHERE account_id = $1", [accountId]);
    await database.pool.query("UPDATE account SET state_revision = state_revision + 1 WHERE account_id = $1", [accountId]);
    release();
    const snapshot = await reading;
    expect(snapshot.state_revision).toBe(0);
    expect(snapshot.wallet.silver_crowns, "the wallet as of the snapshot's revision, not the later commit").toBe(0);
    const after = await state(token);
    expect([after.state_revision, after.wallet.silver_crowns]).toEqual([1, 777]);
  });
});
