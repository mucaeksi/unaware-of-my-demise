import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { progression, storyRules } from "../src/rules";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

const FREE_START_CHARACTER_IDS = [...storyRules().newPlayerState().owned_character_ids].sort();
const STORY_ORDER = storyRules().storyOrder();

let database: TestDatabase;
let token = "";
let accountId = "";

/** The credential is the nonce itself: enough to sign one test player in. */
const verifier: IdentityVerifier = { verify: async (credential) => ({ provider: "google_oidc", subject: "state-player", nonce: credential }) };

const app = () => createApp({ connect: () => database.connect(), verifier });

beforeAll(async () => {
  database = await createTestDatabase();
  const issued = (await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const signedIn = await app()(
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: issued.nonce }) }),
  );
  ({ session_token: token, account_id: accountId } = (await signedIn.json()) as { session_token: string; account_id: string });
});
afterAll(async () => {
  await database?.close();
});

async function state(): Promise<Record<string, any>> {
  const response = await app()(new Request("https://api.test/v1/state", { headers: { authorization: `Bearer ${token}` } }));
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, any>;
}

describe("player snapshot", () => {
  it("starts a new account where the story starts, owning the free starters", async () => {
    const snapshot = await state();
    expect(FREE_START_CHARACTER_IDS).toEqual(["fadyme", "mahmut"]);
    expect(snapshot.schema_version).toBe(1);
    expect(snapshot.story_state.owned_character_ids).toEqual(FREE_START_CHARACTER_IDS);
    expect(snapshot.story_state.story_cursor).toBe(0);
    expect(snapshot.story_state.story_cursor_entry_id).toBe(STORY_ORDER[0]);
    expect(snapshot.wallet).toEqual({ eclipse_tokens: 0, fate_threads: 0, silver_crowns: 0, ration: 0, account_xp: 0 });
    expect(Object.keys(snapshot.roster)).toEqual(FREE_START_CHARACTER_IDS);
    expect(snapshot.inventory).toEqual({ inventory_weapons: [], inventory_armor: [], inventory_accessories: [] });
  });

  it("matches the contract fixture the Godot client tests read", async () => {
    const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "state_new_account.json"), "utf8"));
    expect(await state()).toEqual(fixture);
  });

  it("reports progress, items and equipment in acquisition order with exact integers", async () => {
    const db = database.pool;
    await db.query("UPDATE wallet SET silver_crowns = 9007199254740991 WHERE account_id = $1", [accountId]);
    await db.query(
      "UPDATE roster SET level = 7, xp = 15, memory_shards = 3, memory_nodes = 1 WHERE account_id = $1 AND character_id = 'mahmut'",
      [accountId],
    );
    await db.query("INSERT INTO skill_ranks (account_id, character_id, skill_id, rank) VALUES ($1, 'mahmut', 'skill_x', 3)", [accountId]);
    await db.query(
      "INSERT INTO inventory_items (account_id, item_id, quantity) VALUES ($1, 'torn_chronicle_page', 4), ($1, 'used_up', 0)",
      [accountId],
    );
    await db.query(
      "INSERT INTO inventory_weapons (instance_id, account_id, weapon_id, level, equipped_character_id) " +
        "VALUES ('w-b', $1, 'weapon_mahmut_signature', 4, 'mahmut'), ('w-a', $1, 'weapon_mahmut_signature', 1, NULL)",
      [accountId],
    );
    await db.query(
      "INSERT INTO inventory_accessories (instance_id, account_id, accessory_id, equip_slot, payload) " +
        "VALUES ('a1', $1, 'acc', 'ring', '{\"is_rerollable\": true}')",
      [accountId],
    );
    const snapshot = await state();
    expect(snapshot.wallet.silver_crowns).toBe(9007199254740991);
    expect(snapshot.roster.mahmut).toEqual({
      level: 7,
      xp: 15,
      ascension: 0,
      memory_shards: 3,
      memory_nodes: 1,
      xp_to_next: progression().xpToNext(7),
      level_cap: 20,
      level_up_silver_crowns: progression().levelUpSilverCrownsCost(7),
      skill_ranks: { skill_x: 3 },
    });
    expect(snapshot.items).toEqual({ torn_chronicle_page: 4 });
    expect(snapshot.inventory.inventory_weapons.map((row: { instance_id: string }) => row.instance_id)).toEqual(["w-b", "w-a"]);
    expect(snapshot.inventory.inventory_weapons[0]).toEqual({
      instance_id: "w-b",
      template_id: "weapon_mahmut_signature",
      level: 4,
      locked: false,
      equipped_character_id: "mahmut",
      equip_slot: "weapon",
      payload: null,
    });
    expect(snapshot.inventory.inventory_accessories[0]).toMatchObject({ level: 1, equip_slot: "ring", payload: { is_rerollable: true } });
  });
});
