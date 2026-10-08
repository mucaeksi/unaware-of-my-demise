// Equipment management on the server (port of LEGACY backend/equipment_service.py): equip, unequip, lock, weapon
// dismantle, weapon/armor level-up and accessory rerolls. Each runs inside the request's transaction: everything is
// validated first, then written. A request the rules refuse is a 409 with code EQUIPMENT (the client's
// `Outcome.EQUIPMENT`).
//
// Plain columns (account_id, locked, equip_slot, equipped_character_id) are authoritative; an accessory payload's copies of
// `locked` / `slot` / `instance_id` are overwritten from them on read and on write.
import { toSafeInt, type Db } from "./db";
import { ApiError, invalid } from "./http";
import { AccessoryError, type AccessoryInstance } from "./engine/accessories";
import { pyRepr } from "./engine/content";
import { CpythonRandom } from "./engine/random";
import { recordQuestEvent } from "./rewards";
import { accessoryRoller, contentRegistry, equipmentRules, itemProgressionRule, progression, questProgress } from "./rules";

export const EQUIPMENT_TABLES = ["inventory_weapons", "inventory_armor", "inventory_accessories"] as const;
export type EquipmentTable = (typeof EQUIPMENT_TABLES)[number];

const TEMPLATE_COLUMN: Record<EquipmentTable, string> = {
  inventory_weapons: "weapon_id",
  inventory_armor: "armor_id",
  inventory_accessories: "accessory_id",
};

const refused = (message: string): ApiError => new ApiError(409, "EQUIPMENT", message);

/** The `:table` path segment: one of the three instance tables. */
export function parseTable(value: string): EquipmentTable {
  if (!(EQUIPMENT_TABLES as readonly string[]).includes(value)) throw refused(`Unsupported equipment table: ${value}`);
  return value as EquipmentTable;
}

interface InstanceRecord {
  template_id: string;
  level: number;
  locked: boolean;
  equip_slot: string;
  equipped_character_id: string | null;
  payload: Record<string, unknown> | null;
}

/** The account's instance, locked for the request. Absent and someone else's read the same (never confirm another's id). */
async function ownedInstance(tx: Db, table: EquipmentTable, accountId: string, instanceId: string): Promise<InstanceRecord> {
  const level = table === "inventory_accessories" ? "1" : "level";
  const slot = table === "inventory_weapons" ? "'weapon'" : "equip_slot";
  const { rows } = await tx.query<{ template_id: string; level: unknown; locked: boolean; equip_slot: string; equipped_character_id: string | null; payload: Record<string, unknown> | null }>(
    `SELECT ${TEMPLATE_COLUMN[table]} AS template_id, ${level} AS level, locked, ${slot} AS equip_slot, equipped_character_id, payload
     FROM ${table} WHERE instance_id = $1 AND account_id = $2 FOR UPDATE`,
    [instanceId, accountId],
  );
  const row = rows[0];
  if (!row) throw refused(`No owned item ${pyRepr(instanceId)}`);
  const payload = row.payload && table === "inventory_accessories" ? { ...row.payload, instance_id: instanceId, locked: row.locked, slot: row.equip_slot } : row.payload;
  return { ...row, level: toSafeInt(row.level), payload };
}

async function isOwnedCharacter(tx: Db, accountId: string, characterId: string): Promise<boolean> {
  const { rows } = await tx.query<{ owned: boolean }>("SELECT (state -> 'owned_character_ids') ? $2 AS owned FROM story_state WHERE account_id = $1", [accountId, characterId]);
  return Boolean(rows[0]?.owned);
}

async function itemQuantity(tx: Db, accountId: string, itemId: string): Promise<number> {
  const { rows } = await tx.query<{ quantity: unknown }>("SELECT quantity FROM inventory_items WHERE account_id = $1 AND item_id = $2", [accountId, itemId]);
  return rows[0] ? toSafeInt(rows[0].quantity) : 0;
}

/** Grants `quantity` of a stack (dismantle outputs are uncapped materials, as in LEGACY). */
async function grantItems(tx: Db, accountId: string, itemId: string, quantity: number): Promise<void> {
  await tx.query(
    `INSERT INTO inventory_items (account_id, item_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (account_id, item_id) DO UPDATE SET quantity = inventory_items.quantity + excluded.quantity`,
    [accountId, itemId, quantity],
  );
}

/** Spends `quantity` of a stack the caller already checked (the CHECK constraint still refuses going negative). */
async function spendItems(tx: Db, accountId: string, itemId: string, quantity: number): Promise<void> {
  await tx.query("UPDATE inventory_items SET quantity = quantity - $3 WHERE account_id = $1 AND item_id = $2", [accountId, itemId, quantity]);
}

/** Equips an owned instance on an owned character, replacing whatever held that slot. */
export async function equip(tx: Db, accountId: string, table: EquipmentTable, instanceId: string, characterId: string): Promise<void> {
  const record = await ownedInstance(tx, table, accountId, instanceId);
  if (!(await isOwnedCharacter(tx, accountId, characterId))) throw refused(`${pyRepr(characterId)} is not owned`);
  const registry = contentRegistry();
  const character = registry.characters.get(characterId);
  if (!character) throw refused(`Unknown character ${pyRepr(characterId)}`);
  if (table === "inventory_weapons") {
    const weapon = registry.weapons.get(record.template_id);
    if (!weapon) throw refused(`Unknown weapon template ${pyRepr(record.template_id)}`);
    if (!equipmentRules().canEquipWeapon(character, weapon)) throw refused(`${character.name_en} cannot equip ${weapon.name_en}`);
  } else if (table === "inventory_armor") {
    const armor = registry.armors.get(record.template_id);
    if (!armor || armor.slot !== "armor" || record.equip_slot !== "armor") throw refused("Armor must occupy the single 'armor' slot");
  } else {
    const template = registry.accessories.get(record.template_id);
    const slots = registry.accessory_slots;
    if (!template || !Array.isArray(slots) || !slots.includes(record.equip_slot) || template.slot !== record.equip_slot) {
      throw refused("Accessory slot does not match its template");
    }
  }
  const sameSlot = table === "inventory_weapons" ? "" : " AND equip_slot = $4";
  const values: unknown[] = [accountId, characterId, instanceId];
  if (sameSlot) values.push(record.equip_slot);
  await tx.query(`UPDATE ${table} SET equipped_character_id = NULL WHERE account_id = $1 AND equipped_character_id = $2 AND instance_id <> $3${sameSlot}`, values);
  await tx.query(`UPDATE ${table} SET equipped_character_id = $3 WHERE account_id = $1 AND instance_id = $2`, [accountId, instanceId, characterId]);
}

export async function unequip(tx: Db, accountId: string, table: EquipmentTable, instanceId: string): Promise<void> {
  const record = await ownedInstance(tx, table, accountId, instanceId);
  if (record.equipped_character_id === null) throw refused(`${pyRepr(instanceId)} is not equipped`);
  await tx.query(`UPDATE ${table} SET equipped_character_id = NULL WHERE account_id = $1 AND instance_id = $2`, [accountId, instanceId]);
}

export async function setLocked(tx: Db, accountId: string, table: EquipmentTable, instanceId: string, locked: boolean): Promise<void> {
  await ownedInstance(tx, table, accountId, instanceId);
  const payload = table === "inventory_accessories" ? ", payload = jsonb_set(payload, '{locked}', to_jsonb($3::boolean))" : "";
  await tx.query(`UPDATE ${table} SET locked = $3${payload} WHERE account_id = $1 AND instance_id = $2`, [accountId, instanceId, locked]);
}

export interface DismantleResult {
  instance_id: string;
  weapon_id: string;
  granted: Record<string, number>;
}

/** Deletes an owned, unequipped, unlocked weapon and grants its outputs in the same transaction. */
export async function dismantleWeapon(tx: Db, accountId: string, instanceId: string): Promise<DismantleResult> {
  const record = await ownedInstance(tx, "inventory_weapons", accountId, instanceId);
  if (record.equipped_character_id !== null) throw refused("Unequip the weapon before dismantling it");
  if (record.locked) throw refused("Unlock the weapon before dismantling it");
  const weapon = contentRegistry().weapons.get(record.template_id);
  if (!weapon) throw refused(`Unknown weapon template ${pyRepr(record.template_id)}`);
  if (!weapon.dismantle_allowed) throw refused(`${weapon.name_en} cannot be dismantled`);
  const granted: Record<string, number> = {};
  for (const row of weapon.dismantle_output) {
    const itemId = String(row.item_id);
    granted[itemId] = (granted[itemId] ?? 0) + Math.trunc(Number(row.quantity));
  }
  if (weapon.dismantle_xp) {
    const resourceId = itemProgressionRule("dismantle_resource_id");
    granted[resourceId] = (granted[resourceId] ?? 0) + Math.trunc(weapon.dismantle_xp);
  }
  await tx.query("DELETE FROM inventory_weapons WHERE account_id = $1 AND instance_id = $2", [accountId, instanceId]);
  for (const [itemId, quantity] of Object.entries(granted)) await grantItems(tx, accountId, itemId, quantity);
  return { instance_id: instanceId, weapon_id: weapon.weapon_id, granted };
}

export interface EquipmentLevelUpResult {
  instance_id: string;
  level_before: number;
  level_after: number;
  xp_spent: number;
  xp_remaining: number;
  silver_crowns_spent: number;
  items_spent: Record<string, number>;
  stopped_reason: string | null;
}

/**
 * Raises an owned weapon or armor by up to `targetLevels` levels, spending only the Weapon Tempering XP those levels still
 * need (XP already stored on the item counts), each step's Silver Crowns and, on milestone steps, Blacksmith Rivets. An
 * unpaid step stops without error and the XP put in stays on the item (`payload.xp`).
 */
export async function levelUpEquipment(tx: Db, accountId: string, table: EquipmentTable, instanceId: string, targetLevels: number, nowUnix: number): Promise<EquipmentLevelUpResult> {
  if (table === "inventory_accessories") throw refused("Only weapons and armor have levels");
  const resource = contentRegistry().battle_rules.equipment_progression;
  const resourceId = resource !== null && typeof resource === "object" && !Array.isArray(resource) ? (resource as Record<string, unknown>).xp_resource_id : null;
  if (typeof resourceId !== "string" || !resourceId) throw new Error("battle_rules.equipment_progression.xp_resource_id is missing");
  const rules = progression();
  const record = await ownedInstance(tx, table, accountId, instanceId);
  let level = record.level;
  const payload: Record<string, unknown> = { ...(record.payload ?? {}) };
  const storedXp = Math.trunc(Number(payload.xp ?? 0));
  const template = table === "inventory_weapons" ? contentRegistry().weapons.get(record.template_id) : contentRegistry().armors.get(record.template_id);
  if (!template) throw refused(`Unknown template ${pyRepr(record.template_id)}`);
  const cap = Math.min(rules.equipmentLevelCap(), template.level_cap);
  if (level >= cap) throw refused("This item is already at its level cap");
  const target = Math.min(cap, level + targetLevels);
  let needed = -storedXp;
  for (let step = level; step < target; step++) needed += rules.equipmentXpToNext(step);
  const available = await itemQuantity(tx, accountId, resourceId);
  const spend = Math.max(0, Math.min(needed, available));
  if (spend === 0 && storedXp < rules.equipmentXpToNext(level)) throw refused("Not enough Weapon Tempering XP");
  const { rows } = await tx.query<{ silver_crowns: unknown }>("SELECT silver_crowns FROM wallet WHERE account_id = $1", [accountId]);
  const crowns = rows[0] ? toSafeInt(rows[0].silver_crowns) : 0;

  let xp = storedXp + spend;
  const levelBefore = level;
  let crownsSpent = 0;
  const itemsSpent: Record<string, number> = {};
  let stopped: string | null = null;
  while (level < target && xp >= rules.equipmentXpToNext(level)) {
    const stepCrowns = rules.equipmentLevelUpSilverCrownsCost(level);
    const milestone = rules.equipmentMilestoneForStep(level);
    if (milestone !== null && (await itemQuantity(tx, accountId, milestone.item_id)) - (itemsSpent[milestone.item_id] ?? 0) < milestone.item_quantity) {
      stopped = "milestone_items";
      break;
    }
    if (crowns - crownsSpent < stepCrowns) {
      stopped = "silver_crowns";
      break;
    }
    if (milestone !== null) itemsSpent[milestone.item_id] = (itemsSpent[milestone.item_id] ?? 0) + milestone.item_quantity;
    crownsSpent += stepCrowns;
    xp -= rules.equipmentXpToNext(level);
    level += 1;
  }
  if (level >= cap) stopped ??= "level_cap";

  if (spend) await spendItems(tx, accountId, resourceId, spend);
  for (const [itemId, quantity] of Object.entries(itemsSpent)) await spendItems(tx, accountId, itemId, quantity);
  if (crownsSpent) await tx.query("UPDATE wallet SET silver_crowns = silver_crowns - $2 WHERE account_id = $1", [accountId, crownsSpent]);
  payload.xp = xp;
  await tx.query(`UPDATE ${table} SET level = $3, payload = $4 WHERE account_id = $1 AND instance_id = $2`, [accountId, instanceId, level, JSON.stringify(payload)]);
  if (level > levelBefore) await recordQuestEvent(tx, questProgress(), accountId, nowUnix, "successful_level_up", false);
  return {
    instance_id: instanceId,
    level_before: levelBefore,
    level_after: level,
    xp_spent: spend,
    xp_remaining: xp,
    silver_crowns_spent: crownsSpent,
    items_spent: itemsSpent,
    stopped_reason: stopped,
  };
}

/** A 64-bit seed from the platform CSPRNG for one reroll (LEGACY rerolled from fresh entropy). */
function newRerollSeed(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]!) << 32n) | BigInt(words[1]!);
}

/**
 * Rerolls an owned accessory's sub-stats, spending its reroll tokens. The rules (3-star cannot reroll, main stat kept,
 * a locked item refused, the token cost) are the ported `AccessoryRoller.reroll`'s, fed the column-authoritative payload.
 */
export async function rerollAccessory(tx: Db, accountId: string, instanceId: string): Promise<{ payload: AccessoryInstance }> {
  const record = await ownedInstance(tx, "inventory_accessories", accountId, instanceId);
  const payload = record.payload as AccessoryInstance | null;
  if (!payload || typeof payload !== "object") throw refused(`Accessory ${pyRepr(instanceId)} has no rolled stats`);
  const tokenId = itemProgressionRule("reroll_token_id");
  const tokensBefore = await itemQuantity(tx, accountId, tokenId);
  let result;
  try {
    result = accessoryRoller().reroll(payload, { items: { [tokenId]: tokensBefore }, equipment: [payload] }, new CpythonRandom(newRerollSeed()));
  } catch (error) {
    if (error instanceof AccessoryError) throw refused(error.message);
    throw error;
  }
  const spent = tokensBefore - Math.trunc(Number(result.inventory.items[tokenId] ?? 0));
  if (spent <= 0) throw refused("Reroll did not consume its token cost");
  await spendItems(tx, accountId, tokenId, spent);
  const updated: AccessoryInstance = { ...result.item, instance_id: instanceId, locked: record.locked, slot: record.equip_slot };
  await tx.query("UPDATE inventory_accessories SET payload = $3 WHERE account_id = $1 AND instance_id = $2", [accountId, instanceId, JSON.stringify(updated)]);
  return { payload: updated };
}

/** `{character_id}` of an equip request. */
export function parseCharacterId(body: Record<string, unknown>): string {
  const characterId = body.character_id;
  if (typeof characterId !== "string" || characterId.length === 0 || characterId.length > 64) throw invalid("character_id is required");
  return characterId;
}

/** `{locked}` of a lock request. */
export function parseLocked(body: Record<string, unknown>): boolean {
  if (typeof body.locked !== "boolean") throw invalid("locked must be a boolean");
  return body.locked;
}

/** `{target_levels}` of a level-up request (default 1). */
export function parseTargetLevels(body: Record<string, unknown>): number {
  const value = body.target_levels ?? 1;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 100) throw invalid("target_levels must be a positive integer");
  return value;
}
