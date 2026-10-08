import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccount } from "../src/accounts";
import type { Db } from "../src/db";
import type { GrantedReward } from "../src/engine/loot";
import { applyRewards } from "../src/rewards";
import { stackCaps } from "../src/rules";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

const reward = (fields: Partial<GrantedReward>): GrantedReward => ({
  reward_id: "r", kind: "item", quantity: 1, item_id: null, rarity: null, payload: null, is_first_clear: false, ...fields,
});

describe("applyRewards", () => {
  it("clips a stack at its stack_cap, keeps an over-cap stack and leaves uncapped items unbounded", async () => {
    const db = database.pool as unknown as Db;
    const accountId = await createAccount(db, "google_oidc", `rewards-${Date.now()}`);
    const quantity = async (itemId: string) =>
      Number((await database.pool.query("SELECT quantity FROM inventory_items WHERE account_id = $1 AND item_id = $2", [accountId, itemId])).rows[0]?.quantity ?? 0);
    expect(stackCaps().get("first_oath_invitation")).toBe(1);
    await applyRewards(db, accountId, [reward({ item_id: "first_oath_invitation", quantity: 5 })], stackCaps());
    expect(await quantity("first_oath_invitation"), "a first grant is clipped").toBe(1);
    await applyRewards(db, accountId, [reward({ item_id: "first_oath_invitation", quantity: 2 })], stackCaps());
    expect(await quantity("first_oath_invitation"), "a full stack drops the excess").toBe(1);
    await database.pool.query("UPDATE inventory_items SET quantity = 3 WHERE account_id = $1 AND item_id = 'first_oath_invitation'", [accountId]);
    await applyRewards(db, accountId, [reward({ item_id: "first_oath_invitation", quantity: 1 })], stackCaps());
    expect(await quantity("first_oath_invitation"), "an over-cap stack is never reduced").toBe(3);
    await applyRewards(db, accountId, [reward({ kind: "item_pool", item_id: "uncapped_test_item", quantity: 70000 })], stackCaps());
    expect(await quantity("uncapped_test_item")).toBe(70000);
  });

  it("maps currencies to wallet columns and mints equipment instances", async () => {
    const db = database.pool as unknown as Db;
    const accountId = await createAccount(db, "google_oidc", `rewards-wallet-${Date.now()}`);
    const before = (await database.pool.query("SELECT silver_crowns, eclipse_tokens, account_xp FROM wallet WHERE account_id = $1", [accountId])).rows[0];
    const applied = await applyRewards(db, accountId, [
      reward({ kind: "currency", item_id: "silver_crowns", quantity: 70 }),
      reward({ kind: "currency", item_id: "eclipse_token", quantity: 2 }),
      reward({ kind: "account_xp", quantity: 15 }),
      reward({ kind: "weapon_pool", item_id: "weapon_axe_shield_3_01", rarity: 3 }),
      reward({ kind: "armor_pool", item_id: "armor_padded_3_01", rarity: 3 }),
    ], stackCaps());
    const after = (await database.pool.query("SELECT silver_crowns, eclipse_tokens, account_xp FROM wallet WHERE account_id = $1", [accountId])).rows[0];
    expect([Number(after.silver_crowns) - Number(before.silver_crowns), Number(after.eclipse_tokens) - Number(before.eclipse_tokens), Number(after.account_xp) - Number(before.account_xp)]).toEqual([70, 2, 15]);
    expect(applied[3]!.instance_id).toMatch(/^wpn_[0-9a-f]{32}$/);
    expect(applied[4]!.instance_id).toMatch(/^arm_[0-9a-f]{32}$/);
    const armor = await database.pool.query("SELECT equip_slot, level FROM inventory_armor WHERE instance_id = $1", [applied[4]!.instance_id]);
    expect(armor.rows[0]).toEqual({ equip_slot: "armor", level: 1 });
    await expect(applyRewards(db, accountId, [reward({ kind: "currency", item_id: "fate_threads", quantity: 1 })], stackCaps())).rejects.toThrow("unknown wallet currency");
  });
});
