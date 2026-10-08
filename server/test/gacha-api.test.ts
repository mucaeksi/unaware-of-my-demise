import { afterAll, beforeAll, describe, expect, it } from "vitest";
import characters from "../../game/data/content/characters_part1.json";
import { createApp } from "../src/app";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

describe("gacha routes", () => {
  let database: TestDatabase;
  let counter = 0;
  const now = 1791367200;
  const verifier: IdentityVerifier = {
    verify: async (credential) => {
      const [subject, nonce] = credential.split("|");
      return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
    },
  };
  const app = () => createApp({ connect: () => database.connect(), verifier, nowUnix: () => now });

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database?.close();
  });

  async function call(token: string | null, method: string, path: string, body?: unknown, key: string = crypto.randomUUID()) {
    const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    if (method === "POST" && token) headers["idempotency-key"] = key;
    const response = await app()(new Request(`https://api.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  }

  async function player(fateThreads: number) {
    const issued = await call(null, "POST", "/v1/auth/nonce");
    const signed = await call(null, "POST", "/v1/auth/google", { credential: `gacha-${++counter}|${issued.body.nonce}` });
    const { session_token: token, account_id: accountId } = signed.body;
    await database.pool.query("UPDATE wallet SET fate_threads = $2 WHERE account_id = $1", [accountId, fateThreads]);
    return { token: token as string, accountId: accountId as string };
  }

  const fateThreads = async (accountId: string) =>
    Number((await database.pool.query("SELECT fate_threads FROM wallet WHERE account_id = $1", [accountId])).rows[0].fate_threads);

  it("lists the open banners with odds and pity", async () => {
    const { token } = await player(0);
    const listed = await call(token, "GET", "/v1/gacha/banners");
    expect(listed.status).toBe(200);
    expect(listed.body.banners.map((banner: { banner_id: string }) => banner.banner_id)).toEqual([
      "hall_of_ancestors",
      "hall_of_armaments",
      "character:oath_01_aveline",
      "weapon:oath_01_aveline",
    ]);
    expect(listed.body.banners[0]).toMatchObject({ banner_type: "standard_character", pull_cost: 1, pity: 0, hard_pity: 80 });
    expect((await call(token, "GET", "/v1/gacha/pity")).body).toEqual({ banner_types: { character: {}, weapon: {}, standard_character: {} } });
  });

  it("debits Fate's Threads, grants every result and saves pity in one transaction", async () => {
    const { token, accountId } = await player(15);
    const pulled = await call(token, "POST", "/v1/gacha/pull", { banner_id: "character:oath_01_aveline", pull_count: 10 });
    expect(pulled.status).toBe(200);
    const results = pulled.body.pull.results as { pull_id: string; rarity: number; reward_id: string; grant: Record<string, any> | null }[];
    expect(results).toHaveLength(10);
    expect(results.some((result) => result.rarity >= 4), "ten pulls guarantee a 4★ or better").toBe(true);
    expect(await fateThreads(accountId)).toBe(5);
    expect(pulled.body.state.wallet.fate_threads).toBe(5);

    const weapons = await database.pool.query<{ instance_id: string; weapon_id: string }>("SELECT instance_id, weapon_id FROM inventory_weapons WHERE account_id = $1", [accountId]);
    const story = (await database.pool.query("SELECT state FROM story_state WHERE account_id = $1", [accountId])).rows[0].state;
    for (const { grant } of results) {
      expect(grant).not.toBeNull();
      if (grant!.kind === "weapon") expect(weapons.rows).toContainEqual({ instance_id: grant!.instance_id, weapon_id: grant!.item_id });
      else {
        const roster = await database.pool.query("SELECT copies FROM roster WHERE account_id = $1 AND character_id = $2", [accountId, grant!.item_id]);
        expect(roster.rows[0].copies).toBeGreaterThanOrEqual(grant!.copies);
        expect(story.owned_character_ids).toContain(grant!.item_id);
      }
    }
    const history = await database.pool.query("SELECT rng_seed FROM pull_history WHERE account_id = $1", [accountId]);
    expect(history.rows).toHaveLength(10);
    expect(new Set(history.rows.map((row) => row.rng_seed)).size, "one audited seed per request").toBe(1);

    const pity = (await call(token, "GET", "/v1/gacha/pity")).body.banner_types;
    expect(pity.character).toHaveProperty("character_five_star_pity");
    expect(pity.weapon).toEqual({});
  });

  it("refuses a pull the wallet cannot pay without writing anything", async () => {
    const { token, accountId } = await player(9);
    const refused = await call(token, "POST", "/v1/gacha/pull", { banner_id: "hall_of_ancestors", pull_count: 10 });
    expect(refused.status).toBe(402);
    expect(refused.body.error.code).toBe("INSUFFICIENT_FUNDS");
    expect(await fateThreads(accountId)).toBe(9);
    expect((await database.pool.query("SELECT 1 FROM pull_history WHERE account_id = $1", [accountId])).rowCount).toBe(0);
  });

  it("rejects closed banners, bad counts and a missing Hall of Armaments target as request errors", async () => {
    const { token } = await player(100);
    expect((await call(token, "POST", "/v1/gacha/pull", { banner_id: "character:oath_02_nobody", pull_count: 1 })).status).toBe(400);
    expect((await call(token, "POST", "/v1/gacha/pull", { banner_id: "hall_of_ancestors", pull_count: 3 })).status).toBe(400);
    expect((await call(token, "POST", "/v1/gacha/pull", { banner_id: "hall_of_armaments", pull_count: 1 })).status).toBe(400);
    expect((await call(token, "POST", "/v1/gacha/pull", { banner_id: "nope", pull_count: 1 })).status).toBe(400);
  });

  it("turns duplicates into Memory Shards and honors hard pity", async () => {
    const { token, accountId } = await player(1);
    for (const row of (characters as { characters: { character_id: string }[] }).characters) {
      await database.pool.query("INSERT INTO roster (account_id, character_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [accountId, row.character_id]);
    }
    await database.pool.query("INSERT INTO gacha_pity (account_id, banner_type, state) VALUES ($1, 'standard_character', $2)", [
      accountId,
      JSON.stringify({ standard_five_star_pity: 79, standard_four_star_pity: 0 }),
    ]);
    const pulled = await call(token, "POST", "/v1/gacha/pull", { banner_id: "hall_of_ancestors", pull_count: 1 });
    expect(pulled.status).toBe(200);
    const [result] = pulled.body.pull.results;
    expect(result).toMatchObject({ rarity: 5, hard_pity_triggered: true, grant: { kind: "character", duplicate: true } });
    expect(result.grant.memory_shards).toBeGreaterThan(0);
    const roster = await database.pool.query("SELECT copies, memory_shards FROM roster WHERE account_id = $1 AND character_id = $2", [accountId, result.reward_id]);
    expect(roster.rows[0]).toEqual({ copies: 2, memory_shards: result.grant.memory_shards });
    expect((await call(token, "GET", "/v1/gacha/pity")).body.banner_types.standard_character.standard_five_star_pity).toBe(0);
  });

  it("replays an Idempotency-Key without pulling twice", async () => {
    const { token, accountId } = await player(2);
    const key = crypto.randomUUID();
    const first = await call(token, "POST", "/v1/gacha/pull", { banner_id: "hall_of_ancestors" }, key);
    const again = await call(token, "POST", "/v1/gacha/pull", { banner_id: "hall_of_ancestors" }, key);
    expect(again.body).toEqual(first.body);
    expect(await fateThreads(accountId)).toBe(1);
    const reused = await call(token, "POST", "/v1/gacha/pull", { banner_id: "hall_of_ancestors", pull_count: 10 }, key);
    expect(reused.status, "the same key for a different pull is a conflict").toBe(409);
  });

  it("pages the history newest first", async () => {
    const { token } = await player(12);
    await call(token, "POST", "/v1/gacha/pull", { banner_id: "hall_of_ancestors", pull_count: 10 });
    await call(token, "POST", "/v1/gacha/pull", { banner_id: "hall_of_ancestors" });
    const first = await call(token, "GET", "/v1/gacha/history?limit=8");
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(8);
    expect(first.body.items[0].created_at_utc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    const rest = await call(token, "GET", `/v1/gacha/history?limit=8&before=${first.body.next_cursor}`);
    expect(rest.body.items).toHaveLength(3);
    expect(rest.body.next_cursor).toBeNull();
    const ids = [...first.body.items, ...rest.body.items].map((item: { pull_id: string }) => item.pull_id);
    expect(new Set(ids).size).toBe(11);
    expect((await call(token, "GET", "/v1/gacha/history?limit=0")).status).toBe(400);
  });

  it("converts Eclipse Tokens into Fate's Threads at the authored rate", async () => {
    const { token, accountId } = await player(0);
    await database.pool.query("UPDATE wallet SET eclipse_tokens = 400 WHERE account_id = $1", [accountId]);
    const converted = await call(token, "POST", "/v1/wallet/convert", { count: 2 });
    expect(converted.status).toBe(200);
    expect(converted.body).toMatchObject({ fate_threads_gained: 2, eclipse_tokens_spent: 320 });
    expect(converted.body.state.wallet).toMatchObject({ fate_threads: 2, eclipse_tokens: 80 });
    expect((await call(token, "POST", "/v1/wallet/convert", { count: 1 })).status).toBe(402);
  });
});
