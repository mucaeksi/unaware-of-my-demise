// Character progression on the server (port of LEGACY backend/progression_service.py): level-up with XP items
// (including ascension gates), skill rank upgrades and Memory Nodes. Each runs inside the request's transaction:
// everything is validated first, then written, and any failure rolls the whole request back.
//
// A request the rules refuse is a 409 with code PROGRESSION, which the client maps to `Outcome.PROGRESSION` and shows
// with the message.
import { toSafeInt, type Db } from "./db";
import { ApiError, invalid } from "./http";
import { pyRepr } from "./engine/content";
import { recordQuestEvent } from "./rewards";
import { characterXpValues, contentRegistry, progression, questProgress } from "./rules";

const refused = (message: string): ApiError => new ApiError(409, "PROGRESSION", message);

/** Ownership's single source of truth is the persisted story state (LEGACY `owned_character_ids`). */
async function requireOwned(tx: Db, accountId: string, characterId: string): Promise<void> {
  const { rows } = await tx.query<{ owned: boolean }>(
    "SELECT (state -> 'owned_character_ids') ? $2 AS owned FROM story_state WHERE account_id = $1",
    [accountId, characterId],
  );
  if (!rows[0]?.owned) throw refused(`${pyRepr(characterId)} is not owned`);
}

async function rosterRow(tx: Db, accountId: string, characterId: string) {
  const { rows } = await tx.query<{ level: unknown; xp: unknown; ascension: unknown; memory_shards: unknown; memory_nodes: unknown }>(
    "SELECT level, xp, ascension, memory_shards, memory_nodes FROM roster WHERE account_id = $1 AND character_id = $2",
    [accountId, characterId],
  );
  if (!rows[0]) throw refused(`${pyRepr(characterId)} is not owned`);
  const row = rows[0];
  return {
    level: toSafeInt(row.level),
    xp: toSafeInt(row.xp),
    ascension: toSafeInt(row.ascension),
    memoryShards: toSafeInt(row.memory_shards),
    memoryNodes: toSafeInt(row.memory_nodes),
  };
}

async function itemQuantity(tx: Db, accountId: string, itemId: string): Promise<number> {
  const { rows } = await tx.query<{ quantity: unknown }>("SELECT quantity FROM inventory_items WHERE account_id = $1 AND item_id = $2", [accountId, itemId]);
  return rows[0] ? toSafeInt(rows[0].quantity) : 0;
}

/** Spends `quantity` of a stack the caller already checked (the CHECK constraint still refuses going negative). */
async function spendItem(tx: Db, accountId: string, itemId: string, quantity: number): Promise<void> {
  await tx.query("UPDATE inventory_items SET quantity = quantity - $3 WHERE account_id = $1 AND item_id = $2", [accountId, itemId, quantity]);
}

async function walletRow(tx: Db, accountId: string): Promise<{ silverCrowns: number; accountXp: number }> {
  const { rows } = await tx.query<{ silver_crowns: unknown; account_xp: unknown }>("SELECT silver_crowns, account_xp FROM wallet WHERE account_id = $1", [accountId]);
  if (!rows[0]) throw new Error(`account ${accountId} has no wallet`);
  return { silverCrowns: toSafeInt(rows[0].silver_crowns), accountXp: toSafeInt(rows[0].account_xp) };
}

async function spendSilverCrowns(tx: Db, accountId: string, amount: number): Promise<void> {
  if (amount > 0) await tx.query("UPDATE wallet SET silver_crowns = silver_crowns - $2 WHERE account_id = $1", [accountId, amount]);
}

/** The request body's `items`: XP item id -> positive count. */
export function parseXpItems(body: Record<string, unknown>): Record<string, number> {
  const items = body.items;
  if (items === null || typeof items !== "object" || Array.isArray(items) || Object.keys(items).length === 0) {
    throw invalid("items must map at least one XP item id to a count");
  }
  const entries = Object.entries(items as Record<string, unknown>);
  if (entries.length > 16) throw invalid("items lists too many entries");
  for (const [itemId, quantity] of entries) {
    if (itemId.length === 0 || itemId.length > 64) throw invalid("items has an invalid item id");
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) throw invalid(`Quantity for ${pyRepr(itemId)} must be a positive integer`);
  }
  return Object.fromEntries(entries) as Record<string, number>;
}

export interface LevelUpResult {
  character_id: string;
  level_before: number;
  level_after: number;
  ascension_before: number;
  ascension_after: number;
  xp_gained: number;
  xp_remaining: number;
  silver_crowns_spent: number;
  items_spent: Record<string, number>;
  stopped_reason: string | null;
}

/**
 * Spends `items` on `characterId` and applies every affordable level (LEGACY `level_up_character`). A level that cannot
 * be paid (ascension gate not met, missing gate items, not enough Silver Crowns) stops leveling without error; the
 * unspent XP stays in `roster.xp` and `stopped_reason` says why. A call that raised the level records the
 * `successful_level_up` daily-task event under the server clock.
 */
export async function levelUp(tx: Db, accountId: string, characterId: string, items: Record<string, number>, nowUnix: number): Promise<LevelUpResult> {
  const values = characterXpValues();
  for (const itemId of Object.keys(items)) if (!values.has(itemId)) throw refused(`${pyRepr(itemId)} is not a character XP item`);
  await requireOwned(tx, accountId, characterId);
  const rules = progression();
  let { level, xp, ascension } = await rosterRow(tx, accountId, characterId);
  const cap = rules.characterLevelCap();
  if (level >= cap) throw refused(`${pyRepr(characterId)} is already at the level cap (${cap})`);
  for (const [itemId, quantity] of Object.entries(items)) {
    const have = await itemQuantity(tx, accountId, itemId);
    if (have < quantity) throw refused(`Not enough ${itemId}: have ${have}, need ${quantity}`);
  }
  const wallet = await walletRow(tx, accountId);
  const accountLevel = rules.accountLevelForXp(wallet.accountXp);
  const xpGained = Object.entries(items).reduce((sum, [itemId, quantity]) => sum + values.get(itemId)! * quantity, 0);
  xp += xpGained;

  const levelBefore = level;
  const ascensionBefore = ascension;
  let crownsSpent = 0;
  const spentItems: Record<string, number> = { ...items };
  let stopped: string | null = null;
  while (level < cap && xp >= rules.xpToNext(level)) {
    let stepCrowns = rules.levelUpSilverCrownsCost(level);
    const gateItems: Record<string, number> = {};
    const gate = rules.ascensionGate(level, accountLevel);
    const needsAscension = gate.next_cap === level + 1 && ascension < rules.ascensionsRequiredForLevel(level + 1);
    if (needsAscension) {
      if (!gate.account_level_met) {
        stopped = "ascension_account_level";
        break;
      }
      for (const requirement of gate.items) {
        gateItems[requirement.item_id] = requirement.quantity;
        if ((await itemQuantity(tx, accountId, requirement.item_id)) < requirement.quantity) {
          stopped = "ascension_items";
          break;
        }
      }
      if (stopped) break;
      stepCrowns += rules.ascensionSilverCrownsCost(level);
    }
    if (wallet.silverCrowns - crownsSpent < stepCrowns) {
      stopped = "silver_crowns";
      break;
    }
    for (const [itemId, quantity] of Object.entries(gateItems)) {
      await spendItem(tx, accountId, itemId, quantity);
      spentItems[itemId] = (spentItems[itemId] ?? 0) + quantity;
    }
    if (needsAscension) ascension += 1;
    crownsSpent += stepCrowns;
    xp -= rules.xpToNext(level);
    level += 1;
  }
  if (level >= cap && stopped === null) stopped = "level_cap";

  for (const [itemId, quantity] of Object.entries(items)) await spendItem(tx, accountId, itemId, quantity);
  await spendSilverCrowns(tx, accountId, crownsSpent);
  await tx.query("UPDATE roster SET level = $3, xp = $4, ascension = $5 WHERE account_id = $1 AND character_id = $2", [accountId, characterId, level, xp, ascension]);
  if (level > levelBefore) await recordQuestEvent(tx, questProgress(), accountId, nowUnix, "successful_level_up", false);
  return {
    character_id: characterId,
    level_before: levelBefore,
    level_after: level,
    ascension_before: ascensionBefore,
    ascension_after: ascension,
    xp_gained: xpGained,
    xp_remaining: xp,
    silver_crowns_spent: crownsSpent,
    items_spent: spentItems,
    stopped_reason: stopped,
  };
}

export interface SkillUpgradeResult {
  character_id: string;
  skill_id: string;
  rank_before: number;
  rank_after: number;
  silver_crowns_spent: number;
  item_id: string | null;
  item_quantity: number;
}

/** Raises one skill by one rank (LEGACY `upgrade_skill`, draft_v1 costs). */
export async function upgradeSkill(tx: Db, accountId: string, characterId: string, skillId: string): Promise<SkillUpgradeResult> {
  const skill = contentRegistry().characters.get(characterId)?.skills.find((row) => row.skill_id === skillId);
  if (!skill) throw refused(`${pyRepr(characterId)} has no skill ${pyRepr(skillId)}`);
  await requireOwned(tx, accountId, characterId);
  const { rows } = await tx.query<{ rank: number }>("SELECT rank FROM skill_ranks WHERE account_id = $1 AND character_id = $2 AND skill_id = $3", [
    accountId,
    characterId,
    skillId,
  ]);
  const rank = rows[0]?.rank ?? 1;
  const requirement = progression().skillUpgradeRequirement(skill.type, rank);
  if (requirement === null) throw refused("This skill is already at its maximum rank");
  const { level } = await rosterRow(tx, accountId, characterId);
  if (level < requirement.required_character_level) throw refused(`Reach character level ${requirement.required_character_level} to raise this skill`);
  if ((await walletRow(tx, accountId)).silverCrowns < requirement.silver_crowns) throw refused("Not enough Silver Crowns");
  if (requirement.item_id && (await itemQuantity(tx, accountId, requirement.item_id)) < requirement.item_quantity) {
    throw refused(`Not enough ${requirement.item_id}`);
  }
  await spendSilverCrowns(tx, accountId, requirement.silver_crowns);
  const itemQuantitySpent = requirement.item_id ? requirement.item_quantity : 0;
  if (requirement.item_id) await spendItem(tx, accountId, requirement.item_id, itemQuantitySpent);
  await tx.query(
    `INSERT INTO skill_ranks (account_id, character_id, skill_id, rank) VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id, character_id, skill_id) DO UPDATE SET rank = excluded.rank`,
    [accountId, characterId, skillId, requirement.to_rank],
  );
  return {
    character_id: characterId,
    skill_id: skillId,
    rank_before: rank,
    rank_after: requirement.to_rank,
    silver_crowns_spent: requirement.silver_crowns,
    item_id: requirement.item_id,
    item_quantity: itemQuantitySpent,
  };
}

export interface MemoryNodeResult {
  character_id: string;
  node: number;
  shards_spent: number;
  shards_remaining: number;
}

/** Unlocks the character's next Memory Node with that character's Shards (LEGACY `unlock_memory_node`). */
export async function unlockMemoryNode(tx: Db, accountId: string, characterId: string): Promise<MemoryNodeResult> {
  const nodes = progression().memoryNodes();
  await requireOwned(tx, accountId, characterId);
  const { memoryShards, memoryNodes } = await rosterRow(tx, accountId, characterId);
  if (memoryNodes >= nodes.length) throw refused("All Memory Nodes are already unlocked");
  const node = nodes[memoryNodes]!;
  if (memoryShards < node.shard_cost) throw refused(`Not enough Memory Shards (need ${node.shard_cost}, have ${memoryShards})`);
  await tx.query(
    "UPDATE roster SET memory_shards = memory_shards - $3, memory_nodes = memory_nodes + 1 WHERE account_id = $1 AND character_id = $2",
    [accountId, characterId, node.shard_cost],
  );
  return { character_id: characterId, node: node.node, shards_spent: node.shard_cost, shards_remaining: memoryShards - node.shard_cost };
}
