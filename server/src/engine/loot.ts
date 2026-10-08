// Part I battle drops from the drop-table contracts (port of core/loot/loot_resolver.gd, LEGACY backend/loot_service.py
// `resolve_battle_rewards`).
//
// The order of `random.Random` draws is the contract: per reward row one chance draw, then quantity, rarity, template
// choice, and for accessories a 64-bit sub-seed for the accessory roller (parity/fixtures/loot.json pins the sequence).
// Failures throw LootError carrying the reference's exception class name in `kind`; nothing partial is returned.
//
// The first-clear ledger is the caller's: `claimFirstClear(accountId, claimType)` returns true when the claim is new. It is
// called only when the table has first-clear rows and must run inside the caller's transaction, so a later failure rolls
// the claim back, exactly as the reference's transaction does.
import { AccessoryError, AccessoryRoller, type AccessoryInstance } from "./accessories";
import { pyRepr, type AccessoryTemplate, type ContentRegistry, type Stage } from "./content";
import type { CpythonRandom } from "./random";

export type LootErrorKind = "LootResolutionError" | "ValueError" | "TypeError";

export class LootError extends Error {
  constructor(
    message: string,
    readonly kind: LootErrorKind = "LootResolutionError",
  ) {
    super(message);
  }
}

type Row = Record<string, unknown>;

/** One resolved reward; `item_id`, `rarity` and `payload` are null where the reference has None. */
export interface GrantedReward {
  reward_id: string;
  kind: string;
  quantity: number;
  item_id: string | null;
  rarity: number | null;
  payload: AccessoryInstance | null;
  is_first_clear: boolean;
}

export type ClaimFirstClear = (accountId: string, claimType: string) => boolean | Promise<boolean>;

const isObject = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const isNumber = (value: unknown): value is number => typeof value === "number";
const fail = (message: string, kind?: LootErrorKind): never => {
  throw new LootError(message, kind);
};

const stageHasEnemy = (stage: Stage, enemyId: string): boolean => stage.enemy_waves.some((wave) => wave.some((entry) => entry.enemy_id === enemyId));

/** `{stage.boss_id} | {enemy ids of every wave}`. */
function stageBossIds(stage: Stage): string[] {
  const ids: string[] = stage.boss_id ? [stage.boss_id] : [];
  for (const wave of stage.enemy_waves) for (const entry of wave) if (!ids.includes(entry.enemy_id)) ids.push(entry.enemy_id);
  return ids;
}

export class LootResolver {
  private readonly roller: AccessoryRoller;

  constructor(private readonly registry: ContentRegistry) {
    this.roller = new AccessoryRoller(registry.accessories);
  }

  private dropPackRows(field: string): Row[] {
    const raw = this.registry.drop_pack[field];
    if (!Array.isArray(raw) || !raw.every(isObject)) fail(`drop_tables_part1.json/${field} must be an array of objects`);
    return raw as Row[];
  }

  /**
   * Repeatable loot and, when the table has first-clear rows and `isFirstClear` is set, the first-clear loot of a claim
   * that `claimFirstClear` reports as new. `rng` is consumed in the reference's draw order.
   */
  async resolveBattleRewards(
    dropTableId: string,
    isFirstClear: boolean,
    accountId: string,
    claimFirstClear: ClaimFirstClear,
    rng: CpythonRandom,
    stageId: string | null = null,
    bossId: string | null = null,
  ): Promise<GrantedReward[]> {
    if (!rng) fail("rng must be an instance of random.Random", "TypeError");
    if (!accountId) fail("account_id must be a non-empty string", "ValueError");
    const table = this.registry.drop_tables.get(dropTableId) ?? fail(`Unknown drop table: ${dropTableId}`);
    const rawTable = this.dropPackRows("drop_tables").find((row) => row.drop_table_id === dropTableId) ?? fail(`Unknown drop table in JSON pack: ${dropTableId}`);

    const firstClearRows = isFirstClear ? table.first_clear_rewards : [];
    const needsBoss = [...table.repeatable_rewards, ...firstClearRows].some((row) => row.kind === "boss_set_accessory");
    const [stage, resolvedBossId] = this.tableContext(dropTableId, stageId || null, bossId || null, needsBoss, firstClearRows.length > 0);

    const rewards = this.resolveRows(table.repeatable_rewards, rng, false, stage, resolvedBossId);
    if (firstClearRows.length > 0) {
      const claimKeys = this.registry.drop_pack.claim_keys ?? {};
      if (rawTable.first_clear_claim_scope !== "account_id+stage_id" || !isObject(claimKeys) || claimKeys.first_clear !== "account_id+stage_id") {
        fail(`${dropTableId}: first-clear claim scope must be account_id+stage_id`);
      }
      if (stage === null) fail(`${dropTableId}: first-clear rewards require a stage_id`);
      // The first-clear rows are resolved only for a claim that is new: a duplicate claim grants nothing and draws nothing.
      if (await claimFirstClear(accountId, `first_clear_stage:${stage!.stage_id}`)) {
        rewards.push(...this.resolveRows(firstClearRows, rng, true, stage, resolvedBossId));
      }
    }
    return rewards;
  }

  /** The encounter context; shared boss tables require an explicit stage. Returns [stage | null, boss id | null]. */
  private tableContext(dropTableId: string, stageId: string | null, bossId: string | null, needsBoss: boolean, requireStage: boolean): [Stage | null, string | null] {
    const matchingStages = [...this.registry.stages.values()].filter((candidate) => candidate.drop_table_id === dropTableId);
    let stage: Stage | null = null;
    if (stageId !== null) {
      stage = this.registry.stages.get(stageId) ?? fail(`Unknown stage_id: ${stageId}`);
      if (stage.drop_table_id !== dropTableId) fail(`Stage ${pyRepr(stageId)} uses ${pyRepr(stage.drop_table_id)}, not ${pyRepr(dropTableId)}`);
    } else if (bossId !== null) {
      const matches = matchingStages.filter((candidate) => candidate.boss_id === bossId || stageHasEnemy(candidate, bossId));
      if (matches.length !== 1) {
        fail(`boss_id ${pyRepr(bossId)} does not uniquely identify a stage using ${pyRepr(dropTableId)}; pass stage_id explicitly`);
      }
      stage = matches[0]!;
    } else if (matchingStages.length === 1) {
      stage = matchingStages[0]!;
    } else if (needsBoss || (requireStage && matchingStages.length > 1)) {
      fail(`Drop table ${pyRepr(dropTableId)} is shared by multiple stages; pass stage_id (and optionally boss_id) to preserve stage-scoped rewards`);
    }
    if (stage === null) return [null, bossId];

    if (bossId !== null && !stageBossIds(stage).includes(bossId)) fail(`boss_id ${pyRepr(bossId)} does not belong to stage ${pyRepr(stage.stage_id)}`);
    let resolvedBossId = bossId;
    if (resolvedBossId === null) {
      const bossEnemies = stage.enemy_waves.flatMap((wave) => wave.map((entry) => entry.enemy_id)).filter((enemyId) => enemyId.startsWith("boss_"));
      resolvedBossId = bossEnemies.length === 1 ? bossEnemies[0]! : stage.boss_id;
    }
    return [stage, resolvedBossId];
  }

  private resolveRows(rows: readonly Row[], rng: CpythonRandom, isFirstClear: boolean, stage: Stage | null, bossId: string | null): GrantedReward[] {
    const result: GrantedReward[] = [];
    for (const row of rows) {
      const reward = this.resolveEntry(row, rng, isFirstClear, stage, bossId);
      if (reward !== null) result.push(reward);
    }
    return result;
  }

  /** One reward row; null when the chance roll fails. */
  private resolveEntry(row: Row, rng: CpythonRandom, isFirstClear: boolean, stage: Stage | null, bossId: string | null): GrantedReward | null {
    const rewardId = row.reward_id;
    const kind = row.kind;
    if (typeof rewardId !== "string" || rewardId.length === 0 || typeof kind !== "string") fail("Reward row requires non-empty reward_id and kind");
    const context = rewardId as string;
    if (!this.chancePasses(row, rng, context)) return null;
    const quantity = this.quantity(row, rng, context);
    let itemId: unknown = row.item_id ?? null;
    let rarity: number | null = null;
    let payload: AccessoryInstance | null = null;

    switch (kind) {
      case "currency":
      case "item":
      case "account_xp":
        if (kind !== "account_xp" && (typeof itemId !== "string" || itemId.length === 0)) fail(`${context}: ${kind} reward requires item_id`);
        break;
      case "item_pool": {
        const itemIds = row.item_ids;
        if (!Array.isArray(itemIds) || itemIds.length === 0 || !itemIds.every((value) => typeof value === "string" && value.length > 0)) {
          fail(`${context}: item_pool requires a non-empty item_ids list`);
        }
        itemId = rng.choice(itemIds as string[]);
        break;
      }
      case "accessory": {
        if (typeof itemId !== "string") fail(`${context}: accessory reward requires item_id`);
        const template = this.registry.accessories.get(itemId as string) ?? fail(`${context}: unknown accessory template ${pyRepr(itemId)}`);
        rarity = template.rarity;
        payload = this.rollAccessory(template.accessory_id, rng);
        break;
      }
      case "accessory_pool": {
        rarity = this.rarity(row, rng, context);
        const slot = row.slot ?? null;
        if (slot !== null && typeof slot !== "string") fail(`${context}: slot must be a string when specified`);
        const [template, rolled] = this.chooseAccessory(rarity, rng, (slot as string | null) || null, null);
        payload = rolled;
        itemId = template.accessory_id;
        break;
      }
      case "boss_set_accessory": {
        const guarantee = this.bossSetGuarantee(stage, bossId);
        rarity = guarantee.guaranteed_rarity as number;
        const equipmentResolution = this.registry.drop_pack.equipment_resolution;
        const resolution = isObject(equipmentResolution) ? equipmentResolution.boss_set_accessory : null;
        if (typeof resolution !== "string" || !resolution.includes("equal weight")) fail("Boss-set slot resolution must specify equal-weight slot choice");
        // The slot draw comes first (it is an argument of the reference's call), then the template choice.
        const bossSlot = rng.choice(["necklace", "ring"]);
        const [template, rolled] = this.chooseAccessory(rarity, rng, bossSlot, String(guarantee.accessory_set_id));
        payload = rolled;
        itemId = template.accessory_id;
        break;
      }
      case "weapon_pool": {
        const weaponRarity = this.rarity(row, rng, context);
        rarity = weaponRarity;
        const wantedType = row.weapon_type ?? null;
        if (wantedType !== null && typeof wantedType !== "string") fail(`${context}: weapon_type must be a string`);
        const signatureIds = new Set([...this.registry.characters.values()].map((character) => character.signature_weapon_id));
        const candidates = [...this.registry.weapons.values()].filter(
          (weapon) =>
            weapon.rarity === weaponRarity &&
            !weapon.owner_character_id &&
            !signatureIds.has(weapon.weapon_id) &&
            (wantedType === null || weapon.weapon_type === wantedType),
        );
        if (candidates.length === 0) fail(`${context}: no non-signature weapon exists at rarity ${weaponRarity}`);
        itemId = rng.choice(candidates).weapon_id;
        break;
      }
      case "armor_pool": {
        const armorRarity = this.rarity(row, rng, context);
        rarity = armorRarity;
        const wantedType = row.armor_type ?? null;
        if (wantedType !== null && typeof wantedType !== "string") fail(`${context}: armor_type must be a string`);
        const candidates = [...this.registry.armors.values()].filter(
          (armor) => armor.rarity === armorRarity && (wantedType === null || armor.armor_type === wantedType),
        );
        if (candidates.length === 0) fail(`${context}: no armor template exists at rarity ${armorRarity}`);
        itemId = rng.choice(candidates).armor_id;
        break;
      }
      default:
        fail(`${context}: unsupported reward kind ${pyRepr(kind)}`);
    }
    return {
      reward_id: context,
      kind: kind as string,
      quantity,
      item_id: itemId === null ? null : String(itemId),
      rarity,
      payload,
      is_first_clear: isFirstClear,
    };
  }

  /** Each reward row makes exactly one independent draw from the supplied RNG (even at chance 1.0). */
  private chancePasses(row: Row, rng: CpythonRandom, context: string): boolean {
    const chance = "chance" in row ? row.chance : 1.0;
    if (!isNumber(chance) || chance < 0 || chance > 1) fail(`${context}: chance must be a number between 0 and 1`);
    return rng.random() < (chance as number);
  }

  private quantity(row: Row, rng: CpythonRandom, context: string): number {
    const quantity = row.quantity ?? null;
    if (quantity !== null) {
      if (!isWhole(quantity) || quantity < 0) fail(`${context}: quantity must be a non-negative integer`);
      return quantity as number;
    }
    const minimum = "quantity_min" in row ? row.quantity_min : 1;
    const maximum = "quantity_max" in row ? row.quantity_max : minimum;
    if (!isWhole(minimum) || !isWhole(maximum) || minimum < 0 || maximum < minimum) fail(`${context}: invalid quantity_min/quantity_max range`);
    return rng.randint(minimum as number, maximum as number);
  }

  private rarity(row: Row, rng: CpythonRandom, context: string): number {
    const rarities = row.rarities;
    if (!Array.isArray(rarities) || rarities.length === 0) fail(`${context}: rarities must be a non-empty list`);
    if (!(rarities as unknown[]).every((value) => isWhole(value) && value >= 1)) fail(`${context}: rarities must contain positive integers`);
    return rng.choice(rarities as number[]);
  }

  /** The loot RNG seeds its local accessory roller with 64 bits, so seeded replays stay deterministic. */
  private rollAccessory(accessoryId: string, rng: CpythonRandom): AccessoryInstance {
    const seed = rng.getrandbitsBig(64);
    try {
      return this.roller.rollDropSeeded(accessoryId, seed);
    } catch (error) {
      if (error instanceof AccessoryError) throw new LootError(error.message, "ValueError");
      throw error;
    }
  }

  /** [template, rolled accessory]; the slot draw (when no slot is given) precedes the template choice. */
  private chooseAccessory(rarity: number, rng: CpythonRandom, slot: string | null, setId: string | null): [AccessoryTemplate, AccessoryInstance] {
    const packSlots = this.registry.accessory_slots;
    if (!Array.isArray(packSlots) || packSlots.length === 0 || !packSlots.every((value) => typeof value === "string")) {
      fail("accessories_part1.json/accessory_slots is invalid");
    }
    const slots = packSlots as string[];
    const chosenSlot = slot ?? rng.choice(slots);
    if (!slots.includes(chosenSlot)) fail(`Unknown accessory slot: ${pyRepr(chosenSlot)}`);
    const candidates = [...this.registry.accessories.values()].filter(
      (template) => template.rarity === rarity && template.slot === chosenSlot && (setId === null || template.set_id === setId),
    );
    if (candidates.length === 0) {
      fail(`No accessory template matches rarity ${rarity}, slot ${pyRepr(chosenSlot)}${setId === null ? "" : `, set ${pyRepr(setId)}`}`);
    }
    const template = rng.choice(candidates); // All matching templates have equal weight.
    return [template, this.rollAccessory(template.accessory_id, rng)];
  }

  private bossSetGuarantee(stage: Stage | null, bossId: string | null): Row {
    if (stage === null) fail("Boss-set drops require stage_id or uniquely resolvable boss context");
    const raw = this.registry.drop_pack.boss_set_guarantees;
    if (!Array.isArray(raw) || !raw.every(isObject)) fail("drop_tables_part1.json/boss_set_guarantees is invalid");
    let matches = (raw as Row[]).filter((row) => row.stage_id === stage!.stage_id);
    if (bossId !== null) {
      const exact = matches.filter((row) => row.enemy_id === bossId);
      if (exact.length > 0) matches = exact;
      else if (!stageBossIds(stage!).includes(bossId)) matches = [];
    }
    if (matches.length !== 1) fail(`No unique boss_set_guarantees entry matches stage ${pyRepr(stage!.stage_id)}`);
    const guarantee = matches[0]!;
    if (typeof guarantee.accessory_set_id !== "string") fail("Boss set guarantee is missing accessory_set_id");
    if (!isWhole(guarantee.guaranteed_rarity) || guarantee.guaranteed_rarity < 1) fail("Boss set guarantee has invalid guaranteed_rarity");
    return guarantee;
  }
}
