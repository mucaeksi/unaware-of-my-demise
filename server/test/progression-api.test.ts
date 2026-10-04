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
/** 2026-10-07T10:00:00Z: half-day cycle 41466. */
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
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `progression-${++counter}|${issued.nonce}` }) }),
  );
  const body = (await response.json()) as { session_token: string; account_id: string };
  return { token: body.session_token, accountId: body.account_id };
}

async function post(token: string, path: string, body?: unknown) {
  const response = await app()(
    new Request(`https://api.test${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "idempotency-key": crypto.randomUUID() },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

const sql = (text: string, values: unknown[]) => database.pool.query(text, values);
const give = (accountId: string, itemId: string, quantity: number) =>
  sql("INSERT INTO inventory_items (account_id, item_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (account_id, item_id) DO UPDATE SET quantity = $3", [accountId, itemId, quantity]);
const crowns = (accountId: string, amount: number) => sql("UPDATE wallet SET silver_crowns = $2 WHERE account_id = $1", [accountId, amount]);

describe("POST /v1/roster/{character_id}/level-up", () => {
  it("spends XP items and Silver Crowns, passes the free first ascension and counts the daily task", async () => {
    const { token, accountId } = await newPlayer();
    await give(accountId, "torn_chronicle_page", 12);
    await crowns(accountId, 10000);
    const { status, body } = await post(token, "/v1/roster/mahmut/level-up", { items: { torn_chronicle_page: 10 } });
    expect(status, JSON.stringify(body)).toBe(200);
    // 1000 XP: 122 + 170 + 234 to level 4, then 314 with the level-5 ascension (1000 Crowns, no items).
    expect(body).toMatchObject({
      level_before: 1, level_after: 5, ascension_before: 0, ascension_after: 1, xp_gained: 1000, xp_remaining: 160,
      silver_crowns_spent: 150 + 200 + 250 + 300 + 1000, items_spent: { torn_chronicle_page: 10 }, stopped_reason: null,
    });
    expect(body.state.roster.mahmut).toMatchObject({ level: 5, xp: 160, ascension: 1, xp_to_next: 410, level_up_silver_crowns: 350 });
    expect(body.state.items.torn_chronicle_page).toBe(2);
    expect(body.state.wallet.silver_crowns).toBe(10000 - 1900);
    const quest = await sql("SELECT task_id, cycle_id, progress FROM quest_progress WHERE account_id = $1", [accountId]);
    expect(quest.rows.map((row) => [row.task_id, Number(row.cycle_id), row.progress])).toEqual([["improve_company_kit", 41466, 1]]);
  });

  it("stops at an unmet gate without error and keeps the XP", async () => {
    const { token, accountId } = await newPlayer();
    await sql("UPDATE roster SET level = 9 WHERE account_id = $1 AND character_id = 'fadyme'", [accountId]);
    await give(accountId, "bound_chronicle", 6);
    await crowns(accountId, 50000);
    const blocked = await post(token, "/v1/roster/fadyme/level-up", { items: { bound_chronicle: 2 } });
    expect(blocked.body).toMatchObject({ level_after: 9, xp_remaining: 1000, silver_crowns_spent: 0, stopped_reason: "ascension_account_level" });
    await sql("UPDATE wallet SET account_xp = 1300 WHERE account_id = $1", [accountId]); // account level 5
    const noSeals = await post(token, "/v1/roster/fadyme/level-up", { items: { bound_chronicle: 1 } });
    expect(noSeals.body).toMatchObject({ level_after: 9, xp_remaining: 1500, stopped_reason: "ascension_items" });
    await give(accountId, "iron_oath_seal", 3);
    const passed = await post(token, "/v1/roster/fadyme/level-up", { items: { bound_chronicle: 1 } });
    expect(passed.body).toMatchObject({ level_after: 10, ascension_after: 1, xp_remaining: 2000 - 954, silver_crowns_spent: 550 + 5000 });
    expect(passed.body.items_spent).toEqual({ bound_chronicle: 1, iron_oath_seal: 3 });
    expect(passed.body.state.items.iron_oath_seal ?? 0).toBe(0);
    expect(await sql("SELECT count(*) FROM quest_progress WHERE account_id = $1", [accountId]).then((r) => Number(r.rows[0].count))).toBe(1);
  });

  it("refuses unowned heroes, unknown or missing items and the level cap, writing nothing", async () => {
    const { token, accountId } = await newPlayer();
    await give(accountId, "torn_chronicle_page", 1);
    await crowns(accountId, 10000);
    const cases: [string, unknown, string][] = [
      ["/v1/roster/brin_alder/level-up", { items: { torn_chronicle_page: 1 } }, "'brin_alder' is not owned"],
      ["/v1/roster/mahmut/level-up", { items: { forge_dust: 1 } }, "'forge_dust' is not a character XP item"],
      ["/v1/roster/mahmut/level-up", { items: { torn_chronicle_page: 2 } }, "Not enough torn_chronicle_page: have 1, need 2"],
    ];
    for (const [path, body, message] of cases) expect((await post(token, path, body)).body.error, message).toEqual({ code: "PROGRESSION", message });
    expect((await post(token, "/v1/roster/mahmut/level-up", { items: { torn_chronicle_page: 0 } })).status).toBe(400);
    expect((await post(token, "/v1/roster/mahmut/level-up", { items: {} })).status).toBe(400);
    await sql("UPDATE roster SET level = 20 WHERE account_id = $1 AND character_id = 'mahmut'", [accountId]);
    expect((await post(token, "/v1/roster/mahmut/level-up", { items: { torn_chronicle_page: 1 } })).body.error.message).toBe("'mahmut' is already at the level cap (20)");
    const items = await sql("SELECT quantity FROM inventory_items WHERE account_id = $1 AND item_id = 'torn_chronicle_page'", [accountId]);
    expect(Number(items.rows[0].quantity)).toBe(1);
  });
});

describe("POST /v1/roster/{character_id}/skills/{skill_id}/upgrade", () => {
  it("raises one rank for its level, Crowns and items", async () => {
    const { token, accountId } = await newPlayer();
    const path = "/v1/roster/mahmut/skills/mahmut_active_broken_crest_guard/upgrade";
    expect((await post(token, path)).body.error.message).toBe("Reach character level 5 to raise this skill");
    await sql("UPDATE roster SET level = 5 WHERE account_id = $1 AND character_id = 'mahmut'", [accountId]);
    await crowns(accountId, 1999);
    expect((await post(token, path)).body.error.message).toBe("Not enough Silver Crowns");
    await crowns(accountId, 2500);
    expect((await post(token, path)).body.error.message).toBe("Not enough tactical_notes");
    await give(accountId, "tactical_notes", 4);
    const { status, body } = await post(token, path);
    expect(status).toBe(200);
    expect(body).toMatchObject({ rank_before: 1, rank_after: 2, silver_crowns_spent: 2000, item_id: "tactical_notes", item_quantity: 3 });
    expect(body.state.roster.mahmut.skill_ranks).toEqual({ mahmut_active_broken_crest_guard: 2 });
    expect(body.state.wallet.silver_crowns).toBe(500);
    expect(body.state.items.tactical_notes).toBe(1);
    expect((await post(token, "/v1/roster/mahmut/skills/no_such_skill/upgrade")).body.error.message).toBe("'mahmut' has no skill 'no_such_skill'");
  });
});

describe("POST /v1/roster/{character_id}/memory-nodes", () => {
  it("unlocks the next node with the hero's own shards", async () => {
    const { token, accountId } = await newPlayer();
    expect((await post(token, "/v1/roster/fadyme/memory-nodes")).body.error.message).toBe("Not enough Memory Shards (need 10, have 0)");
    await sql("UPDATE roster SET memory_shards = 30 WHERE account_id = $1 AND character_id = 'fadyme'", [accountId]);
    const first = await post(token, "/v1/roster/fadyme/memory-nodes");
    expect(first.body).toMatchObject({ node: 1, shards_spent: 10, shards_remaining: 20 });
    const second = await post(token, "/v1/roster/fadyme/memory-nodes");
    expect(second.body).toMatchObject({ node: 2, shards_spent: 15, shards_remaining: 5 });
    expect(second.body.state.roster.fadyme).toMatchObject({ memory_shards: 5, memory_nodes: 2 });
    expect((await post(token, "/v1/roster/nixie_vale/memory-nodes")).body.error.code).toBe("PROGRESSION");
  });
});
