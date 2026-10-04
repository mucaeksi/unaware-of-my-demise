// INF-015: every balance and inventory change is journaled with the request that made it, and the journal explains the
// balances (the deltas of each currency add up to the wallet).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { IdentityVerifier } from "../src/identity";
import { serverRulesHash } from "../src/release";
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
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `journal-${++counter}|${issued.nonce}` }) }),
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

const journal = async (accountId: string) =>
  (await database.pool.query("SELECT * FROM economy_journal WHERE account_id = $1 ORDER BY entry_id", [accountId])).rows;

describe("economy journal", () => {
  it("records the starting heroes of a new account as its creation", async () => {
    const { accountId } = await newPlayer();
    const rows = await journal(accountId);
    expect(rows.map((row) => [row.endpoint, row.resource_kind, row.resource_id, Number(row.delta)])).toEqual([
      ["account_create", "character", "fadyme", 1],
      ["account_create", "character", "mahmut", 1],
    ]);
    expect(rows.every((row) => row.rules_hash === null || typeof row.rules_hash === "string")).toBe(true);
  });

  it("ties every change of a pull to its key, route and rules hash, with the pity before and after", async () => {
    const { token, accountId } = await newPlayer();
    await database.pool.query("UPDATE wallet SET fate_threads = 10 WHERE account_id = $1", [accountId]);
    const key = crypto.randomUUID();
    const pulled = await post(token, "/v1/gacha/pull", { banner_id: "hall_of_ancestors", pull_count: 10 }, key);
    expect(pulled.status).toBe(200);
    const rows = (await journal(accountId)).filter((row) => row.operation_key === key);
    expect(rows.length).toBeGreaterThan(1);
    expect(new Set(rows.map((row) => row.endpoint))).toEqual(new Set(["gacha_pull"]));
    expect(new Set(rows.map((row) => row.rules_hash))).toEqual(new Set([await serverRulesHash()]));
    const spent = rows.find((row) => row.resource_id === "fate_threads")!;
    expect([Number(spent.delta), Number(spent.balance_after)]).toEqual([-10, 0]);
    const pity = rows.find((row) => row.resource_kind === "pity")!;
    expect(pity.detail.after).toEqual(expect.any(Object));
    expect(pity.detail).toHaveProperty("before");

    const before = (await journal(accountId)).length;
    const replay = await post(token, "/v1/gacha/pull", { banner_id: "hall_of_ancestors", pull_count: 10 }, key);
    expect(replay.body).toEqual(pulled.body);
    expect((await journal(accountId)).length, "a replay changes nothing and journals nothing").toBe(before);
  });

  it("records a verified victory's grants under stage_victory", async () => {
    const { token, accountId } = await newPlayer();
    expect((await post(token, "/v1/story/advance")).status).toBe(200);
    const opened = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    const key = crypto.randomUUID();
    const won = await post(token, `/v1/attempts/${opened.body.attempt.attempt_id}/victory`, { outcome: "victory" }, key);
    expect(won.status).toBe(200);
    const rows = (await journal(accountId)).filter((row) => row.operation_key === key);
    expect(won.body.applied.length === 0 || rows.length > 0, "every applied reward is journaled").toBe(true);
    expect(rows.every((row) => row.endpoint === "stage_victory")).toBe(true);
  });

  it("explains every balance: the journaled deltas of each currency add up to the wallet", async () => {
    const { token, accountId } = await newPlayer();
    await database.pool.query("UPDATE wallet SET eclipse_tokens = 1000, fate_threads = 3 WHERE account_id = $1", [accountId]);
    expect((await post(token, "/v1/wallet/convert", { count: 5 })).status).toBe(200);
    expect((await post(token, "/v1/gacha/pull", { banner_id: "hall_of_ancestors", pull_count: 1 })).status).toBe(200);
    expect((await post(token, "/v1/ration/inn-meal", {})).status).toBe(200);
    const wallet = (await database.pool.query("SELECT eclipse_tokens, fate_threads, silver_crowns, account_xp FROM wallet WHERE account_id = $1", [accountId])).rows[0];
    const sums = (
      await database.pool.query(
        "SELECT resource_id, sum(delta)::bigint AS total FROM economy_journal WHERE account_id = $1 AND resource_kind = 'currency' GROUP BY resource_id",
        [accountId],
      )
    ).rows;
    for (const currency of ["eclipse_tokens", "fate_threads", "silver_crowns", "account_xp"]) {
      const total = Number(sums.find((row) => row.resource_id === currency)?.total ?? 0);
      expect(total, currency).toBe(Number(wallet[currency]));
    }
    const items = (await database.pool.query("SELECT item_id, quantity FROM inventory_items WHERE account_id = $1", [accountId])).rows;
    for (const item of items) {
      const total = (await database.pool.query("SELECT sum(delta)::bigint AS total FROM economy_journal WHERE account_id = $1 AND resource_id = $2", [accountId, item.item_id])).rows[0];
      expect(Number(total.total), item.item_id).toBe(Number(item.quantity));
    }
    const converted = (await journal(accountId)).filter((row) => row.endpoint === "wallet_convert").map((row) => [row.resource_id, Number(row.delta)]);
    expect(converted).toEqual([["eclipse_tokens", -800], ["fate_threads", 5]]);
  });
});
