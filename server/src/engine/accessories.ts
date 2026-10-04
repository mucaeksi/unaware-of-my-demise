// Accessory main/sub-stat rolling and atomic reroll-token consumption (port of core/loot/accessory_roller.gd, LEGACY
// game_logic/accessory_rng.py).
//
// Draw order is part of the contract (parity/fixtures/accessories.json): main stat choice, then per sub-stat a choice
// and a value, then the 128-bit instance id, then the main stat value. Value rule:
// `min + (max - min) * Decimal(str(random()))` rounded half up to 0.01, in exact decimals.
import type { AccessoryTemplate } from "./content";
import { Dec } from "./dec";
import { CpythonRandom } from "./random";

export class AccessoryError extends Error {}

type Row = Record<string, unknown>;

export interface RolledStat {
  stat_id: string;
  value: number;
  unit: string;
}

export interface AccessoryInstance {
  instance_id: string;
  accessory_id: string;
  name_en: string;
  rarity: number;
  slot: string;
  set_id: string;
  brand_mark_id: string | null;
  main_stat: RolledStat;
  sub_stats: RolledStat[];
  reroll_count: number;
  is_rerollable: boolean;
  locked: boolean;
}

export interface Inventory {
  items: Record<string, number>;
  equipment: AccessoryInstance[];
}

/** One weighted pick: `mark = random() * sum(weights)`, then subtract weights until the mark turns negative. */
export function weightedChoice(rows: Row[], rng: CpythonRandom): Row {
  const total = rows.reduce((sum, row) => sum + Number(row.weight), 0);
  if (total <= 0) throw new AccessoryError("Stat pool must have a positive total weight.");
  let mark = rng.random() * total;
  for (const row of rows) {
    mark -= Number(row.weight);
    if (mark < 0) return { ...row };
  }
  return { ...rows[rows.length - 1]! };
}

/** `_roll_value` for one random() draw: `low + (high - low) * Decimal(str(r))` quantized half up to 0.01. */
export function rollValueFrom(row: Row, randomValue: number): RolledStat {
  const low = Dec.fromNumber(Number(row.min_value));
  const high = Dec.fromNumber(Number(row.max_value));
  const value = low.add(high.sub(low).mul(Dec.fromNumber(randomValue)));
  return { stat_id: String(row.stat_id), value: value.quantizeHalfUp(2).toNumber(), unit: String(row.unit) };
}

export class AccessoryRoller {
  constructor(private readonly templates: ReadonlyMap<string, AccessoryTemplate>) {}

  private template(accessoryId: unknown): AccessoryTemplate {
    const template = typeof accessoryId === "string" ? this.templates.get(accessoryId) : undefined;
    if (!template) throw new AccessoryError(`Unknown accessory template: ${String(accessoryId)}`);
    return template;
  }

  private static profile(template: AccessoryTemplate, rarity: unknown): Row {
    const key = typeof rarity === "number" ? String(Math.trunc(rarity)) : String(rarity);
    const profile = template.rarity_profiles[key];
    return profile !== null && typeof profile === "object" && !Array.isArray(profile) ? (profile as Row) : {};
  }

  private rollSubstats(template: AccessoryTemplate, count: number, rng: CpythonRandom, mainStatId: string): RolledStat[] {
    let available = template.possible_sub_stats.filter((row) => String(row.stat_id) !== mainStatId);
    if (available.length < count) throw new AccessoryError("Substat pool has too few distinct choices.");
    const result: RolledStat[] = [];
    for (let draw = 0; draw < count; draw++) {
      const row = weightedChoice(available, rng);
      available = available.filter((candidate) => String(candidate.stat_id) !== String(row.stat_id));
      result.push(rollValueFrom(row, rng.random()));
    }
    return result;
  }

  /** A newly rolled accessory instance from a template, drawing from `rng`. */
  rollDrop(accessoryId: string, rng: CpythonRandom): AccessoryInstance {
    const template = this.template(accessoryId);
    const profile = AccessoryRoller.profile(template, template.rarity);
    const main = weightedChoice(template.possible_main_stats, rng);
    const subStats = this.rollSubstats(template, Number(profile.substat_count), rng, String(main.stat_id));
    const instanceId = `acc_${rng.getrandbitsBig(128).toString(16).padStart(32, "0")}`;
    const mainStat = rollValueFrom(main, rng.random());
    return {
      instance_id: instanceId,
      accessory_id: accessoryId,
      name_en: template.name_en,
      rarity: template.rarity,
      slot: template.slot,
      set_id: template.set_id,
      brand_mark_id: template.brand_mark_id,
      main_stat: mainStat,
      sub_stats: subStats,
      reroll_count: 0,
      is_rerollable: Boolean(profile.is_rerollable),
      locked: false,
    };
  }

  /** `roll_drop(accessory_id, seed=seed)`. */
  rollDropSeeded(accessoryId: string, seed: bigint | number): AccessoryInstance {
    return this.rollDrop(accessoryId, new CpythonRandom(seed));
  }

  /** Rerolls only the sub-stats and consumes the token cost; throws (inputs untouched) on any violation. */
  reroll(item: AccessoryInstance, inventory: Inventory, rng: CpythonRandom): { item: AccessoryInstance; inventory: Inventory } {
    const requested = structuredClone(item);
    const inv = structuredClone(inventory);
    const template = this.template(requested.accessory_id);
    const profile = AccessoryRoller.profile(template, requested.rarity);
    if (!profile.is_rerollable || requested.is_rerollable === false) throw new AccessoryError("This accessory cannot be rerolled.");
    const slot = (inv.equipment ?? []).findIndex((owned) => owned.instance_id === requested.instance_id);
    if (slot < 0) throw new AccessoryError("The accessory instance is not present in this inventory.");
    const owned = inv.equipment[slot]!;
    if (owned.accessory_id !== requested.accessory_id || owned.rarity !== requested.rarity) {
      throw new AccessoryError("The requested item does not match the owned accessory instance.");
    }
    const current = structuredClone(owned);
    if (current.locked) throw new AccessoryError("Unlock the accessory before rerolling it.");
    const cost = profile.reroll_cost as Row;
    const tokenId = String(cost.item_id);
    const quantity = Number(cost.quantity);
    inv.items ??= {};
    if (Number(inv.items[tokenId] ?? 0) < quantity) throw new AccessoryError(`Insufficient reroll token: ${tokenId}.`);
    const replacement = this.rollSubstats(template, Number(profile.substat_count), rng, current.main_stat.stat_id);
    // Commit on the copies only after every validation and roll succeeded.
    inv.items[tokenId] = inv.items[tokenId]! - quantity;
    if (inv.items[tokenId] === 0) delete inv.items[tokenId];
    current.sub_stats = replacement;
    current.reroll_count = (current.reroll_count ?? 0) + 1;
    inv.equipment[slot] = structuredClone(current);
    return { item: current, inventory: inv };
  }

  rerollSeeded(item: AccessoryInstance, inventory: Inventory, seed: bigint | number) {
    return this.reroll(item, inventory, new CpythonRandom(seed));
  }
}
