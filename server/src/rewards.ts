// Writing resolved battle rewards and victory quest progress into the account (port of LEGACY
// backend/battle_reward_service.py `_apply_one`, backend/repository.py grants and backend/quest_service.py
// `record_battle_victory`; docs/LEGACY_AUDIT.md 9.4). Everything runs inside the caller's transaction.
import type { Db } from "./db";
import type { GrantedReward } from "./engine/loot";
import { EVENT_OBJECTIVES, halfDayWindow, weeklyCycleKey, type QuestProgress, type QuestProgressMap, type QuestTask } from "./engine/quests";

export interface AppliedReward extends GrantedReward {
  /** The owned copy's id for weapons, armor and accessories; null for currencies and stackable items. */
  instance_id: string | null;
}

/** drop_tables_part1.json names only these currency item ids; fate_threads is never a battle drop. */
const CURRENCY_WALLET_COLUMNS: Readonly<Record<string, string>> = { silver_crowns: "silver_crowns", eclipse_token: "eclipse_tokens" };

/** `<prefix>_` + 32 lowercase hex characters from the platform CSPRNG (LEGACY `secrets.token_hex(16)`). */
export function newInstanceId(prefix: "wpn" | "arm" | "acc"): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}_${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function addWalletCurrency(tx: Db, accountId: string, column: "silver_crowns" | "eclipse_tokens" | "account_xp", delta: number): Promise<void> {
  const result = await tx.query(`UPDATE wallet SET ${column} = ${column} + $2 WHERE account_id = $1`, [accountId, delta]);
  if (result.rowCount !== 1) throw new Error(`account ${accountId} has no wallet`);
}

/**
 * Adds a granted stack. A grant is clipped at the item's `stack_cap` and the excess is dropped (a full stack never fails
 * the whole victory); a stack already above the cap is never reduced. Items without a cap are unbounded.
 */
export async function addItemQuantity(tx: Db, accountId: string, itemId: string, delta: number, cap: number | null): Promise<void> {
  await tx.query(
    `INSERT INTO inventory_items (account_id, item_id, quantity) VALUES ($1, $2, CASE WHEN $4::bigint IS NULL THEN $3::bigint ELSE LEAST($3::bigint, $4::bigint) END)
     ON CONFLICT (account_id, item_id) DO UPDATE SET quantity = CASE
       WHEN $4::bigint IS NULL THEN inventory_items.quantity + $3::bigint
       ELSE GREATEST(LEAST(inventory_items.quantity + $3::bigint, $4::bigint), inventory_items.quantity) END`,
    [accountId, itemId, delta, cap],
  );
}

/** Persists one resolved reward; `stackCaps` is items_part1.json `stack_cap` per item id. */
async function applyOne(tx: Db, accountId: string, reward: GrantedReward, stackCaps: ReadonlyMap<string, number>): Promise<AppliedReward> {
  const fail = (message: string): never => {
    throw new Error(`${reward.reward_id}: ${message}`);
  };
  switch (reward.kind) {
    case "currency": {
      const column = CURRENCY_WALLET_COLUMNS[reward.item_id ?? ""] ?? fail(`unknown wallet currency ${reward.item_id}`);
      await addWalletCurrency(tx, accountId, column as "silver_crowns" | "eclipse_tokens", reward.quantity);
      return { ...reward, instance_id: null };
    }
    case "account_xp":
      await addWalletCurrency(tx, accountId, "account_xp", reward.quantity);
      return { ...reward, instance_id: null };
    case "item":
    case "item_pool": {
      const itemId = reward.item_id || fail("item reward missing item_id");
      await addItemQuantity(tx, accountId, itemId, reward.quantity, stackCaps.get(itemId) ?? null);
      return { ...reward, instance_id: null };
    }
    case "weapon_pool": {
      const weaponId = reward.item_id || fail("weapon reward missing item_id");
      const instanceId = newInstanceId("wpn");
      await tx.query("INSERT INTO inventory_weapons (instance_id, account_id, weapon_id) VALUES ($1, $2, $3)", [instanceId, accountId, weaponId]);
      return { ...reward, instance_id: instanceId };
    }
    case "armor_pool": {
      const armorId = reward.item_id || fail("armor reward missing item_id");
      // Part I declares a single armor slot (armor_slot_count == 1).
      const instanceId = newInstanceId("arm");
      await tx.query("INSERT INTO inventory_armor (instance_id, account_id, armor_id, equip_slot) VALUES ($1, $2, $3, 'armor')", [instanceId, accountId, armorId]);
      return { ...reward, instance_id: instanceId };
    }
    case "accessory":
    case "accessory_pool":
    case "boss_set_accessory": {
      const payload = reward.payload;
      if (!reward.item_id || !payload) fail("accessory reward requires item_id and a rolled-stat payload");
      if (!payload!.slot) fail("accessory payload has no slot");
      if (!payload!.instance_id) fail("accessory payload has no rolled instance_id");
      await tx.query(
        "INSERT INTO inventory_accessories (instance_id, account_id, accessory_id, equip_slot, payload) VALUES ($1, $2, $3, $4, $5)",
        [payload!.instance_id, accountId, reward.item_id, payload!.slot, JSON.stringify(payload)],
      );
      return { ...reward, instance_id: payload!.instance_id };
    }
    default:
      return fail(`unsupported reward kind ${reward.kind}`);
  }
}

export async function applyRewards(tx: Db, accountId: string, rewards: readonly GrantedReward[], stackCaps: ReadonlyMap<string, number>): Promise<AppliedReward[]> {
  const applied: AppliedReward[] = [];
  for (const reward of rewards) applied.push(await applyOne(tx, accountId, reward, stackCaps));
  return applied;
}

async function loadProgress(tx: Db, accountId: string, cycleId: number): Promise<QuestProgressMap> {
  const { rows } = await tx.query<{ task_id: string; progress: number }>(
    "SELECT task_id, progress FROM quest_progress WHERE account_id = $1 AND cycle_id = $2",
    [accountId, cycleId],
  );
  return Object.fromEntries(rows.map((row) => [row.task_id, row.progress]));
}

/**
 * `record_quest_event`: the daily tasks under the half-day cycle and, with `weekly`, the active weekly segment's task under
 * its week (LEGACY level-ups record the daily bucket only).
 */
export async function recordQuestEvent(
  tx: Db,
  quests: QuestProgress,
  accountId: string,
  nowUnix: number,
  event: keyof typeof EVENT_OBJECTIVES,
  weekly = true,
): Promise<void> {
  const persist = async (tasks: QuestTask[], bucket: number, segment: string | null): Promise<void> => {
    const before = await loadProgress(tx, accountId, bucket);
    const after = quests.applyEvent(before, tasks, event, 1, segment);
    for (const [taskId, progress] of Object.entries(after)) {
      if (before[taskId] === progress) continue;
      await tx.query(
        `INSERT INTO quest_progress (account_id, task_id, cycle_id, progress) VALUES ($1, $2, $3, $4)
         ON CONFLICT (account_id, task_id, cycle_id) DO UPDATE SET progress = excluded.progress`,
        [accountId, taskId, bucket, progress],
      );
    }
  };
  await persist(quests.dailyTasks(), halfDayWindow(nowUnix).cycle_id, null);
  if (!weekly) return;
  const [weekId, segmentId] = weeklyCycleKey(nowUnix);
  await persist(quests.weeklyTasks(), weekId, segmentId);
}

/**
 * The quest events one verified victory raises. Only Ration-costing battles count (owner decision 2026-09-28, so the
 * free 1-1 tutorial counts for nothing); a boss stage adds `boss_win`, three or more stars add `three_star_win`.
 */
export async function recordBattleVictory(
  tx: Db,
  quests: QuestProgress,
  accountId: string,
  nowUnix: number,
  victory: { staminaCost: number; isBoss: boolean; stars: number },
): Promise<string[]> {
  if (victory.staminaCost <= 0) return [];
  const events: (keyof typeof EVENT_OBJECTIVES)[] = ["eligible_win"];
  if (victory.isBoss) events.push("boss_win");
  if (victory.stars >= 3) events.push("three_star_win");
  for (const event of events) await recordQuestEvent(tx, quests, accountId, nowUnix, event);
  return events;
}
