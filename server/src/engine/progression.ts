// Compact-stat character progression, equipment levels, skill ranks and Memory Nodes (port of
// core/progression/progression.gd, LEGACY core/progression.py). Every number comes from battle_rules_part1.json. Stat
// maths uses exact decimals (Dec) with a half-up round at the end, like the reference's Decimal.
//
// Invalid input throws ProgressionError for exactly the calls the reference rejects (parity/fixtures/curves.json
// "errors"); the GDScript port reports the same calls through its `error` field.
import type { ContentRegistry } from "./content";
import { Dec } from "./dec";
import { pyRepr } from "./content";

export class ProgressionError extends Error {}

type Json = unknown;
type Rules = Record<string, Json>;

const CORE_STATS = ["hp", "atk", "def", "spd", "res"];
const XP_CURVE = /^\s*xp_to_next\(level\)\s*=\s*(\d+)\s*\+\s*(\d+)\s*\*\s*level\s*\+\s*(\d+)\s*\*\s*level\s*\*\s*level\s*$/;

export interface AscensionRequirement {
  next_cap: number | null;
  required_account_level: number | null;
  items: { item_id: string; quantity: number }[];
  account_level_met: boolean;
}

/** Normalized equipment bonuses: flat values are stat points, percent values fractions (0.10 = +10%). */
export interface EquippedItem {
  flat_stats: Record<string, Dec>;
  percent_stats: Record<string, Dec>;
}

export interface EquipmentMilestone {
  from_level: number;
  item_id: string;
  item_quantity: number;
  bonus_pct: Dec;
}

export interface SkillUpgradeRequirement {
  to_rank: number;
  required_character_level: number;
  item_id: string | null;
  item_quantity: number;
  silver_crowns: number;
}

export interface MemoryNode {
  node: number;
  shard_cost: number;
  effect_type: string;
  stat: string | null;
  value: Dec;
}

const fail = (message: string): never => {
  throw new ProgressionError(message);
};
const isNumber = (value: unknown): value is number => typeof value === "number";
const isObject = (value: unknown): value is Rules => value !== null && typeof value === "object" && !Array.isArray(value);
const intOf = (value: unknown, fallback: number): number => (isNumber(value) ? Math.trunc(value) : fallback);
export const emptyEquipped = (): EquippedItem => ({ flat_stats: {}, percent_stats: {} });

function decimal(value: unknown, context: string): Dec {
  if (value instanceof Dec) return value;
  if (!isNumber(value)) fail(`${context} must be numeric`);
  return Dec.fromNumber(value as number);
}

function positiveLevel(level: number, name = "level"): void {
  if (!Number.isInteger(level) || level < 1) fail(`${name} must be a positive integer`);
}

export class Progression {
  constructor(private readonly battleRules: Rules) {}

  static create(registry: ContentRegistry): Progression {
    return new Progression(registry.battle_rules as Rules);
  }

  private rules(section: string): Rules {
    const rules = this.battleRules[section];
    if (!isObject(rules)) fail(`battle_rules_part1.json is missing ${section}`);
    return rules as Rules;
  }

  // -- character stats -----------------------------------------------------------------------------

  characterLevelCap(): number {
    return intOf(this.rules("character_progression").level_cap ?? 20, 20);
  }

  /** `base + growth * (level - 1)` per stat, half-up at the final value. */
  baseStatAtLevel(base: Rules, growth: Rules, level: number): Record<string, number> {
    positiveLevel(level);
    const cap = this.characterLevelCap();
    if (level > cap) fail(`level ${level} exceeds the Part I level cap (${cap})`);
    const statIds = [...Object.keys(base), ...Object.keys(growth).filter((id) => !Object.hasOwn(base, id))];
    const resolved: Record<string, number> = {};
    for (const statId of statIds) {
      const baseValue = decimal(base[statId] ?? 0, `base stat ${statId}`);
      const growthValue = decimal(growth[statId] ?? 0, `growth stat ${statId}`);
      resolved[statId] = baseValue.add(growthValue.mulInt(level - 1)).roundHalfUp();
    }
    return resolved;
  }

  /** `baseStatAtLevel` with the stage's enemy_stat_multiplier applied to HP and ATK (as doubles) before rounding. */
  enemyStatsAtLevel(base: Rules, growth: Rules, level: number, multiplier = 1.0): Record<string, number> {
    if (multiplier === 1.0) return this.baseStatAtLevel(base, growth, level);
    const scaledBase = { ...base };
    const scaledGrowth = { ...growth };
    for (const stat of ["hp", "atk"]) {
      if (isNumber(scaledBase[stat])) scaledBase[stat] = (scaledBase[stat] as number) * multiplier;
      if (isNumber(scaledGrowth[stat])) scaledGrowth[stat] = (scaledGrowth[stat] as number) * multiplier;
    }
    return this.baseStatAtLevel(scaledBase, scaledGrowth, level);
  }

  private minimumForStat(statId: string): number {
    const rules = isObject(this.battleRules.stat_resolution) ? (this.battleRules.stat_resolution as Rules) : {};
    if (statId === "hp") return intOf(rules.minimum_hp ?? 1, 1);
    if (statId === "def") return intOf(rules.minimum_defense ?? 0, 0);
    if (statId === "spd") return intOf(rules.minimum_speed ?? 1, 1);
    return 0;
  }

  /** `round_half_up((base + flat) * (1 + pct))` per stat, flat and percent summed over all items, clamped to minimums. */
  applyEquipment(base: Record<string, number>, weapon: EquippedItem, armor: EquippedItem, accessories: EquippedItem[]): Record<string, number> {
    const flat: Record<string, Dec> = {};
    const percent: Record<string, Dec> = {};
    for (const item of [weapon, armor, ...accessories]) {
      for (const [statId, value] of Object.entries(item.flat_stats)) flat[statId] = (flat[statId] ?? Dec.fromInt(0)).add(decimal(value, `flat bonus ${statId}`));
      for (const [statId, value] of Object.entries(item.percent_stats)) percent[statId] = (percent[statId] ?? Dec.fromInt(0)).add(decimal(value, `percent bonus ${statId}`));
    }
    const statIds = [...new Set([...Object.keys(base), ...Object.keys(flat), ...Object.keys(percent)])];
    const resolved: Record<string, number> = {};
    for (const statId of statIds) {
      const value = decimal(base[statId] ?? 0, `base stat ${statId}`)
        .add(flat[statId] ?? Dec.fromInt(0))
        .mul(Dec.fromInt(1).add(percent[statId] ?? Dec.fromInt(0)))
        .roundHalfUp();
      resolved[statId] = Math.max(this.minimumForStat(statId), value);
    }
    return resolved;
  }

  /** A weapon/armor row at `level` ({base_stats_level_1, growth_per_level}) or a rolled accessory ({main_stat, sub_stats}). */
  equippedItemFromContent(item: Rules, level = 1): EquippedItem {
    const result = emptyEquipped();
    if (Object.hasOwn(item, "main_stat") || Object.hasOwn(item, "sub_stats")) {
      const rows: unknown[] = [item.main_stat];
      if (Array.isArray(item.sub_stats)) rows.push(...item.sub_stats);
      for (const row of rows) {
        if (!isObject(row)) continue;
        const statId = row.stat_id;
        if (typeof statId !== "string" || statId.length === 0) fail("Accessory stat is missing stat_id");
        const id = statId as string;
        const value = decimal(row.value, `accessory ${id}`);
        if (id.endsWith("_pct") || row.unit === "percent") {
          const target = id.endsWith("_pct") ? id.slice(0, -4) : id;
          result.percent_stats[target] = (result.percent_stats[target] ?? Dec.fromInt(0)).add(value);
        } else {
          const target = id.endsWith("_flat") ? id.slice(0, -5) : id;
          result.flat_stats[target] = (result.flat_stats[target] ?? Dec.fromInt(0)).add(value);
        }
      }
      return result;
    }
    const baseStats = item.base_stats_level_1 ?? {};
    const growth = item.growth_per_level ?? {};
    if (!isObject(baseStats) || !isObject(growth)) fail("Equipment base_stats_level_1 and growth_per_level must be mappings");
    const numericBase: Rules = Object.fromEntries(Object.entries(baseStats as Rules).filter(([, value]) => isNumber(value)));
    const resolved = this.baseStatAtLevel(numericBase, growth as Rules, level);
    const flat: Record<string, Dec> = {};
    for (const [key, value] of Object.entries(resolved)) if (CORE_STATS.includes(key)) flat[key] = Dec.fromInt(value);
    if (level > 1) {
      // Milestone bonus: a fraction of the item's level-1 stats once a milestone level has been passed.
      const bonus = this.equipmentBonusPct(level);
      if (!bonus.isZero()) {
        for (const key of Object.keys(flat)) flat[key] = flat[key]!.add(decimal(numericBase[key] ?? 0, key).mul(bonus));
      }
    }
    result.flat_stats = flat;
    const secondaryStat = (baseStats as Rules).secondary_stat;
    const secondaryValue = (baseStats as Rules).secondary_value;
    if (typeof secondaryStat === "string" && secondaryStat.endsWith("_pct") && isNumber(secondaryValue)) {
      result.percent_stats[secondaryStat.slice(0, -4)] = decimal(secondaryValue, secondaryStat);
    }
    return result;
  }

  // -- XP, costs, ascension ------------------------------------------------------------------------

  /** XP to advance from `level` (the authored curve `xp_to_next(level) = a + b * level + c * level * level`). */
  xpToNext(level: number): number {
    positiveLevel(level);
    const curve = this.rules("character_progression").xp_curve;
    const found = curve === null || curve === undefined ? null : XP_CURVE.exec(String(curve));
    if (!found) fail(`Unsupported character XP curve in content: ${pyRepr(curve ?? null)}`);
    const [, a, b, c] = found!.map(Number);
    return a! + b! * level + c! * level * level;
  }

  ascensionGate(characterLevel: number, accountLevel: number): AscensionRequirement {
    positiveLevel(characterLevel, "character_level");
    positiveLevel(accountLevel, "account_level");
    const progression = this.rules("character_progression");
    const cap = intOf(progression.level_cap ?? 20, 20);
    if (characterLevel > cap) fail(`character_level exceeds the Part I level cap (${cap})`);
    const gates = progression.ascension;
    if (!Array.isArray(gates)) fail("character_progression.ascension must be an array");
    const requirement: AscensionRequirement = { next_cap: null, required_account_level: null, items: [], account_level_met: true };
    for (const gate of gates as Rules[]) {
      const gateCap = Number(gate.cap);
      if (characterLevel < gateCap) {
        const required = Number(gate.account_level);
        requirement.next_cap = gateCap;
        requirement.required_account_level = required;
        requirement.items = ((gate.items ?? []) as Rules[]).map((row) => ({ item_id: String(row.item_id), quantity: Number(row.quantity) }));
        requirement.account_level_met = accountLevel >= required;
        return requirement;
      }
    }
    return requirement;
  }

  /** Silver Crowns to level up from `level` to `level + 1`. */
  levelUpSilverCrownsCost(level: number): number {
    positiveLevel(level);
    const levelUp = this.rules("character_progression").level_up_silver_crowns;
    if (!isObject(levelUp)) fail("character_progression.level_up_silver_crowns must be an object");
    const block = levelUp as Rules;
    return intOf(block.base ?? 100, 100) + level * intOf(block.increment ?? 50, 50);
  }

  /** Silver Crowns of the ascension gate at `characterLevel` (0 if there is none at this level). */
  ascensionSilverCrownsCost(characterLevel: number): number {
    positiveLevel(characterLevel, "character_level");
    const gates = this.rules("character_progression").ascension;
    if (!Array.isArray(gates)) return 0;
    for (const gate of gates as Rules[]) if (characterLevel === Number(gate.cap) - 1) return intOf(gate.silver_crowns_cost ?? 0, 0);
    return 0;
  }

  /** Number of ascension gates a character must have passed to stand at `level`. */
  ascensionsRequiredForLevel(level: number): number {
    positiveLevel(level);
    const gates = this.rules("character_progression").ascension;
    if (!Array.isArray(gates)) return 0;
    return (gates as Rules[]).filter((gate) => Number(gate.cap) <= level).length;
  }

  // -- account level -------------------------------------------------------------------------------

  accountXpToNext(level: number): number {
    positiveLevel(level);
    const curve = this.rules("account_progression").xp_to_next;
    if (!isObject(curve) || (curve as Rules).formula !== "base + (level - 1) * increment") {
      fail(`Unsupported account XP curve in content: ${pyRepr(curve ?? null)}`);
    }
    return Number((curve as Rules).base) + (level - 1) * Number((curve as Rules).increment);
  }

  /** Account level reached with `totalAccountXp` lifetime XP (capped). */
  accountLevelForXp(totalAccountXp: number): number {
    if (!Number.isInteger(totalAccountXp) || totalAccountXp < 0) fail("total_account_xp must be a non-negative integer");
    const cap = intOf(this.rules("account_progression").level_cap ?? 20, 20);
    let level = 1;
    let remaining = totalAccountXp;
    while (level < cap) {
      const needed = this.accountXpToNext(level);
      if (remaining < needed) break;
      remaining -= needed;
      level++;
    }
    return level;
  }

  // -- equipment levels ----------------------------------------------------------------------------

  private linearCost(block: unknown, level: number, name: string): number {
    positiveLevel(level);
    if (!isObject(block) || (block as Rules).formula !== "base + level * increment") {
      fail(`Unsupported equipment ${name} formula: ${pyRepr(block ?? null)}`);
    }
    return Number((block as Rules).base) + level * Number((block as Rules).increment);
  }

  equipmentLevelCap(): number {
    return intOf(this.rules("equipment_progression").level_cap ?? 20, 20);
  }

  /** Weapon Tempering XP to go from `level` to `level + 1`. */
  equipmentXpToNext(level: number): number {
    return this.linearCost(this.rules("equipment_progression").xp_to_next, level, "xp_to_next");
  }

  equipmentLevelUpSilverCrownsCost(level: number): number {
    return this.linearCost(this.rules("equipment_progression").level_up_silver_crowns, level, "level_up_silver_crowns");
  }

  private equipmentMilestones(): EquipmentMilestone[] {
    const rules = this.rules("equipment_progression");
    const itemId = String(rules.milestone_item_id ?? "");
    return ((rules.milestones ?? []) as Rules[]).map((row) => ({
      from_level: Number(row.from_level),
      item_id: itemId,
      item_quantity: Number(row.item_quantity),
      bonus_pct: decimal(row.bonus_pct_of_level_1_stats, "milestone bonus"),
    }));
  }

  /** The milestone paid on the `level` -> `level + 1` step, or null. */
  equipmentMilestoneForStep(level: number): EquipmentMilestone | null {
    return this.equipmentMilestones().find((milestone) => milestone.from_level === level) ?? null;
  }

  /** Milestone bonus (fraction of level-1 stats) active at `level`. */
  equipmentBonusPct(level: number): Dec {
    let best = Dec.fromInt(0);
    for (const milestone of this.equipmentMilestones()) {
      if (level > milestone.from_level && milestone.bonus_pct.greaterThan(best)) best = milestone.bonus_pct;
    }
    return best;
  }

  // -- skill ranks and Memory Nodes ----------------------------------------------------------------

  skillMaxRank(skillType: string): number {
    const byType = this.rules("skill_progression").max_rank_by_skill_type ?? {};
    const maximum = isObject(byType) ? (byType as Rules)[skillType] : null;
    if (!isNumber(maximum) || !Number.isInteger(maximum)) fail(`Unknown skill type for ranks: ${pyRepr(skillType)}`);
    return maximum as number;
  }

  /** Factor on a skill's damage/heal/shield multipliers at `rank`: `1 + bonus * (rank - 1)` as a double. */
  skillRankMultiplier(rank: number): number {
    positiveLevel(rank, "rank");
    const bonus = decimal(this.rules("skill_progression").damage_heal_shield_multiplier_bonus_per_rank, "skill rank bonus");
    return Dec.fromInt(1).add(bonus.mulInt(rank - 1)).toNumber();
  }

  /** What raising `currentRank` -> `currentRank + 1` costs; null at max rank. */
  skillUpgradeRequirement(skillType: string, currentRank: number): SkillUpgradeRequirement | null {
    const maximum = this.skillMaxRank(skillType);
    if (currentRank >= maximum) return null;
    const rules = this.rules("skill_progression") as Record<string, Record<string, Record<string, unknown>>>;
    const toRank = currentRank + 1;
    const item = (rules.upgrade_item_by_skill_type as Rules)[skillType];
    const cost = rules.upgrade_cost![String(toRank)] as Rules;
    return {
      to_rank: toRank,
      required_character_level: Number(rules.unlock_character_level![skillType]![String(toRank)]),
      item_id: typeof item === "string" ? item : null,
      item_quantity: Number(cost.item_quantity),
      silver_crowns: Number(cost.silver_crowns),
    };
  }

  memoryNodes(): MemoryNode[] {
    const rows = this.battleRules.memory_nodes;
    if (!Array.isArray(rows) || rows.length === 0) fail("battle_rules_part1.json is missing memory_nodes");
    const nodes = (rows as Rules[]).map((row) => {
      const effect = row.effect as Rules;
      return {
        node: Number(row.node),
        shard_cost: Number(row.shard_cost),
        effect_type: String(effect.type),
        stat: typeof effect.stat === "string" ? effect.stat : null,
        value: decimal(effect.value, "memory node value"),
      };
    });
    nodes.forEach((node, index) => {
      if (node.node !== index + 1) fail("memory_nodes must be numbered 1..N in order");
    });
    return nodes;
  }
}

export type { Json };
