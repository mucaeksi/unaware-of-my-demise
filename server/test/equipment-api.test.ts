import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { IdentityVerifier } from "../src/identity";
import { accessoryRoller } from "../src/rules";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;
const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};
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
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `equipment-${++counter}|${issued.nonce}` }) }),
  );
  const body = (await response.json()) as { session_token: string; account_id: string };
  return { token: body.session_token, accountId: body.account_id };
}

async function post(token: string, path: string, body: unknown = {}) {
  const response = await app()(
    new Request(`https://api.test${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

const sql = (text: string, values: unknown[] = []) => database.pool.query(text, values);
const weapon = (accountId: string, instanceId: string, weaponId: string, extra = "") =>
  sql(`INSERT INTO inventory_weapons (instance_id, account_id, weapon_id${extra ? ", locked" : ""}) VALUES ($1, $2, $3${extra ? ", true" : ""})`, [instanceId, accountId, weaponId]);
const give = (accountId: string, itemId: string, quantity: number) =>
  sql("INSERT INTO inventory_items (account_id, item_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (account_id, item_id) DO UPDATE SET quantity = $3", [accountId, itemId, quantity]);
const equippedBy = async (instanceId: string) => (await sql("SELECT equipped_character_id FROM inventory_weapons WHERE instance_id = $1", [instanceId])).rows[0]?.equipped_character_id;

describe("equip / unequip / lock", () => {
  it("equips a legal weapon, replaces the slot's holder and refuses illegal requests", async () => {
    const { token, accountId } = await newPlayer();
    await weapon(accountId, "wpn_a", "weapon_arming_sword_3_01");
    await weapon(accountId, "wpn_b", "weapon_arming_sword_3_02");
    await weapon(accountId, "wpn_sig", "weapon_mahmut_signature");
    const first = await post(token, "/v1/inventory/inventory_weapons/wpn_a/equip", { character_id: "mahmut" });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.state.inventory.inventory_weapons.find((row: { instance_id: string }) => row.instance_id === "wpn_a").equipped_character_id).toBe("mahmut");
    expect((await post(token, "/v1/inventory/inventory_weapons/wpn_b/equip", { character_id: "mahmut" })).status).toBe(200);
    expect([await equippedBy("wpn_a"), await equippedBy("wpn_b")]).toEqual([null, "mahmut"]);

    const refusals: [string, unknown, string][] = [
      ["/v1/inventory/inventory_weapons/wpn_sig/equip", { character_id: "fadyme" }, "Fadyme cannot equip"],
      ["/v1/inventory/inventory_weapons/wpn_a/equip", { character_id: "brin_alder" }, "'brin_alder' is not owned"],
      ["/v1/inventory/inventory_weapons/wpn_nope/equip", { character_id: "mahmut" }, "No owned item 'wpn_nope'"],
      ["/v1/inventory/inventory_weapons/wpn_a/unequip", {}, "'wpn_a' is not equipped"],
      ["/v1/inventory/inventory_pets/wpn_a/unequip", {}, "Unsupported equipment table: inventory_pets"],
    ];
    for (const [path, body, message] of refusals) {
      const refused = await post(token, path, body);
      expect(refused.body.error?.code, path).toBe("EQUIPMENT");
      expect(refused.body.error.message, path).toContain(message);
    }
    const other = await newPlayer();
    expect((await post(other.token, "/v1/inventory/inventory_weapons/wpn_b/unequip")).body.error.message, "another player's item reads as absent").toBe("No owned item 'wpn_b'");
    expect((await post(token, "/v1/inventory/inventory_weapons/wpn_b/unequip")).status).toBe(200);
    expect(await equippedBy("wpn_b")).toBeNull();
  });

  it("locks an accessory and keeps its payload copy in sync", async () => {
    const { token, accountId } = await newPlayer();
    const rolled = accessoryRoller().rollDropSeeded("accessory_ash_maw_hide_ring_4", 3);
    await sql("INSERT INTO inventory_accessories (instance_id, account_id, accessory_id, equip_slot, payload) VALUES ($1, $2, $3, 'ring', $4)", [
      rolled.instance_id, accountId, rolled.accessory_id, JSON.stringify(rolled),
    ]);
    expect((await post(token, `/v1/inventory/inventory_accessories/${rolled.instance_id}/lock`, { locked: true })).status).toBe(200);
    const row = (await sql("SELECT locked, payload FROM inventory_accessories WHERE instance_id = $1", [rolled.instance_id])).rows[0];
    expect([row.locked, row.payload.locked]).toEqual([true, true]);
    expect((await post(token, `/v1/inventory/inventory_accessories/${rolled.instance_id}/lock`, { locked: "yes" })).status).toBe(400);
    expect((await post(token, `/v1/inventory/inventory_accessories/${rolled.instance_id}/equip`, { character_id: "fadyme" })).status).toBe(200);
  });
});

describe("dismantle, level-up, reroll", () => {
  it("dismantles only an unequipped, unlocked weapon and grants its outputs", async () => {
    const { token, accountId } = await newPlayer();
    await weapon(accountId, "wpn_keep", "weapon_arming_sword_3_01", "locked");
    await weapon(accountId, "wpn_sig2", "weapon_mahmut_signature");
    await weapon(accountId, "wpn_scrap", "weapon_arming_sword_3_03");
    expect((await post(token, "/v1/inventory/inventory_weapons/wpn_keep/dismantle")).body.error.message).toBe("Unlock the weapon before dismantling it");
    expect((await post(token, "/v1/inventory/inventory_weapons/wpn_sig2/dismantle")).body.error.message).toContain("cannot be dismantled");
    const { status, body } = await post(token, "/v1/inventory/inventory_weapons/wpn_scrap/dismantle");
    expect(status).toBe(200);
    expect(body.granted).toEqual({ forge_dust: 1, weapon_tempering_xp: 30 });
    expect(body.state.items).toMatchObject({ forge_dust: 1, weapon_tempering_xp: 30 });
    expect((await sql("SELECT count(*) FROM inventory_weapons WHERE instance_id = 'wpn_scrap'")).rows[0].count).toBe("0");
    expect((await post(token, "/v1/inventory/inventory_weapons/wpn_scrap/dismantle")).body.error.code, "never twice").toBe("EQUIPMENT");
  });

  it("levels a weapon with Tempering XP, Crowns and the milestone rivet", async () => {
    const { token, accountId } = await newPlayer();
    await weapon(accountId, "wpn_lvl", "weapon_arming_sword_3_01");
    await give(accountId, "weapon_tempering_xp", 1000);
    await sql("UPDATE wallet SET silver_crowns = 10000 WHERE account_id = $1", [accountId]);
    expect((await post(token, "/v1/inventory/inventory_accessories/acc_x/level-up")).body.error.message).toBe("Only weapons and armor have levels");
    const toFive = await post(token, "/v1/inventory/inventory_weapons/wpn_lvl/level-up", { target_levels: 5 });
    // 25 + 30 + 35 + 40 XP and 75 + 100 + 125 + 150 Crowns to level 5; 5 -> 6 needs a Blacksmith Rivet.
    expect(toFive.body).toMatchObject({ level_before: 1, level_after: 5, xp_spent: 175, xp_remaining: 45, silver_crowns_spent: 450, stopped_reason: "milestone_items" });
    expect(toFive.body.state.items.weapon_tempering_xp).toBe(825);
    await give(accountId, "blacksmith_rivet", 1);
    const six = await post(token, "/v1/inventory/inventory_weapons/wpn_lvl/level-up", {});
    expect(six.body).toMatchObject({ level_before: 5, level_after: 6, xp_spent: 0, xp_remaining: 0, items_spent: { blacksmith_rivet: 1 }, silver_crowns_spent: 175 });
    const quest = await sql("SELECT task_id, progress FROM quest_progress WHERE account_id = $1", [accountId]);
    expect(quest.rows).toEqual([{ task_id: "improve_company_kit", progress: 1 }]);
  });

  it("rerolls a 4-star accessory's sub-stats for its tokens", async () => {
    const { token, accountId } = await newPlayer();
    const rolled = accessoryRoller().rollDropSeeded("accessory_ash_maw_hide_ring_4", 11);
    await sql("INSERT INTO inventory_accessories (instance_id, account_id, accessory_id, equip_slot, payload) VALUES ($1, $2, $3, 'ring', $4)", [
      rolled.instance_id, accountId, rolled.accessory_id, JSON.stringify(rolled),
    ]);
    const path = `/v1/inventory/inventory_accessories/${rolled.instance_id}/reroll`;
    expect((await post(token, path)).body.error.message).toBe("Insufficient reroll token: unwritten_hour_cinder.");
    await give(accountId, "unwritten_hour_cinder", 4);
    const { status, body } = await post(token, path);
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.payload.main_stat).toEqual(rolled.main_stat);
    expect(body.payload.reroll_count).toBe(1);
    expect(body.payload.sub_stats.length).toBe(rolled.sub_stats.length);
    expect(body.state.items.unwritten_hour_cinder).toBe(1);
    const stored = (await sql("SELECT payload FROM inventory_accessories WHERE instance_id = $1", [rolled.instance_id])).rows[0].payload;
    expect(stored).toEqual(body.payload);
    await post(token, `/v1/inventory/inventory_accessories/${rolled.instance_id}/lock`, { locked: true });
    await give(accountId, "unwritten_hour_cinder", 9);
    expect((await post(token, path)).body.error.message).toBe("Unlock the accessory before rerolling it.");
  });
});
