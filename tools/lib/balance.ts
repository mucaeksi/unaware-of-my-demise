/**
 * D-27 balance layer (docs/combat/STAT_MATH.md): turns the narrative's legacy stat blocks into STR / INT / VIT / AGI content.
 * Units come from content/balance/attributes.json (archetype + rarity points). Gear keeps the narrative's tier ordering and is
 * converted by fixed rules: weapons give power points, armor gives VIT + DEF, accessory / set percentages become whole points.
 * The narrative files stay the canon of names, skills and tiers; these numbers are engineering-owned.
 */
import { AttributeBlock } from '../../packages/economy/src/index';
import { readJson } from './fsutil';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const BALANCE = readJson<Json>('content/balance/attributes.json');
const r2 = (x: number): number => Math.round(x * 100) / 100;

/** A unit's attribute block, or undefined when the balance file does not list it (it then keeps its legacy base_stats). */
export function balanceAttributes(id: string, rarity?: number): AttributeBlock | undefined {
  const entry = BALANCE.units[id] as string | Json | undefined;
  if (entry === undefined) return undefined;
  const { archetype, ...over } = typeof entry === 'string' ? { archetype: entry } : entry;
  const shape = BALANCE.archetypes[archetype] as Json | undefined;
  if (!shape) throw new Error(`balance: unit ${id} names unknown archetype ${archetype}`);
  const bonus = (rarity === undefined ? {} : BALANCE.rarity_bonus[String(rarity)] ?? {}) as Partial<Record<'power' | 'str' | 'int' | 'vit' | 'agi', number>>;
  const block = { ...shape, ...over } as AttributeBlock;
  const base = { ...block.base };
  for (const k of ['str', 'int', 'vit', 'agi'] as const) base[k] += (bonus[k] ?? 0) + (k === block.power ? (bonus.power ?? 0) : 0);
  return AttributeBlock.parse({ ...block, base });
}

/** weapon: power points (x1.25 at level 1, x3 growth: a level-20 5★ adds ~8) and a whole-point role stat */
export function weaponStats(w: { rarity: number; base_stats_level_1: Json; growth_per_level: Json }): { base: Json; growth: Json } {
  return {
    base: { power: r2(w.base_stats_level_1.atk * 1.25), secondary_stat: 'role_stat', secondary_value: w.rarity >= 5 ? 2 : 1 },
    growth: { power: r2(w.growth_per_level.atk * 3) }
  };
}

/** armor: VIT (the old HP value, x1.5 growth) and DEF (x1.2, x2 growth: 1 DEF at level 1, 2-4 at level 20) */
export function armorStats(a: { base_stats_level_1: Json; growth_per_level: Json }): { base: Json; growth: Json } {
  return {
    base: { vit: r2(a.base_stats_level_1.hp), def: r2(a.base_stats_level_1.def * 1.2) },
    growth: { vit: r2(a.growth_per_level.hp * 1.5), def: r2(a.growth_per_level.def * 2) }
  };
}

/** derived-stat ids of the narrative pools -> whole attribute points; special percentages (heal, focus, resistances) stay */
const POINTS: Record<string, string> = { hp_pct: 'vit_flat', hp_flat: 'vit_flat', atk_pct: 'power_flat', atk_flat: 'power_flat', def_pct: 'def_flat', def_flat: 'def_flat', spd_pct: 'agi_flat', spd_flat: 'agi_flat' };
const RANGE: Record<'main' | 'sub', Record<number, [number, number]>> = { main: { 3: [1, 1], 4: [1, 2], 5: [2, 2] }, sub: { 3: [1, 1], 4: [1, 1], 5: [1, 2] } };
interface PoolStat { stat_id: string; weight: number; unit: 'percent' | 'flat'; min_value: number; max_value: number }
export function accessoryPool(pool: PoolStat[], rarity: number, kind: 'main' | 'sub'): PoolStat[] {
  const out = new Map<string, PoolStat>();
  for (const s of pool) {
    const id = POINTS[s.stat_id];
    const [min, max] = RANGE[kind][rarity] ?? [1, 1];
    const row = id ? { stat_id: id, weight: s.weight, unit: 'flat' as const, min_value: min, max_value: max } : s;
    const seen = out.get(row.stat_id);
    if (seen) seen.weight += row.weight;
    else out.set(row.stat_id, { ...row });
  }
  return [...out.values()];
}

/** set bonus: a converted percentage becomes 1 point (the schema's `pct` field holds the amount in the stat's own unit) */
export function setBonus(s: { bonus_stat_id: string; bonus_value_pct: number; bonus_en: string }): { stat: string; pct: number; text: string } {
  const id = POINTS[s.bonus_stat_id];
  if (!id) return { stat: s.bonus_stat_id, pct: s.bonus_value_pct, text: s.bonus_en };
  const label = { vit_flat: 'VIT', power_flat: 'power (STR or INT)', def_flat: 'DEF', agi_flat: 'AGI' }[id];
  return { stat: id, pct: 1, text: `2 pieces: +1 ${label}.` };
}

/** weapon role stat by the first matching word of the combat role: front-liners and healers VIT, everyone else AGI */
export const ROLE_STAT = { roleStat: { tank: 'vit_flat', guard: 'vit_flat', vanguard: 'vit_flat', templar: 'vit_flat', healer: 'vit_flat', default: 'agi_flat' } };
export const GEAR_NOTE = 'D-27: the role_stat of a weapon resolves by the first matching word of the character role into whole attribute points (front-liners and healers VIT, everyone else AGI).';
