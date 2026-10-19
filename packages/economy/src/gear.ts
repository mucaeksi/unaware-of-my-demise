import type { GearStats, ProgressionConfig } from './progression';
import { gearStatAt } from './progression';
import type { Roll } from './gacha';

/** Accessory stat generation (canon accessories_part1.json "stat_generation"): weighted per-slot pools, no duplicate sub stats, the main stat is excluded from the sub stats. */
export interface StatPoolEntry {
  stat_id: string;
  weight: number;
  unit: 'percent' | 'flat';
  min_value: number;
  max_value: number;
}
export interface AccessoryDef {
  main: StatPoolEntry[];
  sub: StatPoolEntry[];
  profile?: { substat_count: number; is_rerollable: boolean; reroll_cost: number | { item_id: string; quantity: number } | null } | undefined;
}
export interface RolledStat {
  stat: string;
  value: number;
}
export interface AccessoryStats {
  main: RolledStat;
  subs: RolledStat[];
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

function pickWeighted(pool: StatPoolEntry[], roll: Roll): StatPoolEntry {
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let t = roll() * total;
  for (const e of pool) {
    t -= e.weight;
    if (t < 0) return e;
  }
  return pool[pool.length - 1] as StatPoolEntry;
}
/** attribute, power and armor points with whole-number bounds roll whole numbers (D-27); everything else rolls inside its range */
const WHOLE = /^(str|int|vit|agi|power|def)_flat$/;
const value = (e: StatPoolEntry, roll: Roll): number =>
  WHOLE.test(e.stat_id) && Number.isInteger(e.min_value) && Number.isInteger(e.max_value)
    ? Math.min(e.max_value, e.min_value + Math.floor(roll() * (e.max_value - e.min_value + 1)))
    : round3(e.min_value + roll() * (e.max_value - e.min_value));

export function rollSubstats(def: AccessoryDef, mainStat: string, roll: Roll): RolledStat[] {
  const count = def.profile?.substat_count ?? 2;
  const pool = def.sub.filter((s) => s.stat_id !== mainStat);
  const subs: RolledStat[] = [];
  while (subs.length < count && pool.length > 0) {
    const e = pickWeighted(pool, roll);
    subs.push({ stat: e.stat_id, value: value(e, roll) });
    pool.splice(pool.indexOf(e), 1); // no duplicate sub stat ids
  }
  return subs;
}

export function rollAccessory(def: AccessoryDef, roll: Roll): AccessoryStats {
  const m = pickWeighted(def.main, roll);
  return { main: { stat: m.stat_id, value: value(m, roll) }, subs: rollSubstats(def, m.stat_id, roll) };
}

/** Reroll keeps the main stat (and set, slot, rarity) and replaces only the sub stats. */
export const rerollAccessory = (def: AccessoryDef, current: AccessoryStats, roll: Roll): AccessoryStats => ({ main: current.main, subs: rollSubstats(def, current.main.stat, roll) });

/** weapon / armor base keys that scale with the item level */
const BASE = ['hp', 'atk', 'def', 'spd', 'str', 'int', 'vit', 'agi', 'power'] as const;
type Base = (typeof BASE)[number];

export function emptyGearStats(): GearStats {
  return { flat: {}, pct: {}, other: {} };
}

/** adds one stat id such as vit_flat / hp_pct / atk_flat / effect_res_pct into a GearStats block (attribute points are flat only) */
export function addStat(g: GearStats, statId: string, v: number): void {
  const flat = /^(hp|atk|def|spd|str|int|vit|agi|power)_flat$/.exec(statId);
  const pct = /^(hp|atk|def|spd)_pct$/.exec(statId);
  if (flat) g.flat[flat[1] as Base] = (g.flat[flat[1] as Base] ?? 0) + v;
  else if (pct) g.pct[pct[1] as 'hp'] = (g.pct[pct[1] as 'hp'] ?? 0) + v;
  else g.other[statId] = (g.other[statId] ?? 0) + v;
}

export interface GearPiece {
  slot: 'weapon' | 'armor' | 'necklace' | 'ring';
  setId: string | null;
  level: number;
  ascension: number;
  base: Record<string, number | string>;
  growth: Record<string, number>;
  /** accessory rolled stats */
  rolled?: AccessoryStats | undefined;
}

/** Aggregates the equipped pieces: level-scaled base stats of weapon/armor, rolled accessory stats, then set bonuses. `roleStat` resolves the weapon's "role_stat". */
export function aggregateGear(cfg: ProgressionConfig, pieces: GearPiece[], roleStat: string, sets: Record<string, { piecesForBonus: number; stat: string; pct: number }>): GearStats {
  const g = emptyGearStats();
  for (const p of pieces) {
    if (p.slot === 'weapon' || p.slot === 'armor') {
      for (const [k, v] of Object.entries(p.base)) {
        if (typeof v === 'number' && (BASE as readonly string[]).includes(k)) addStat(g, `${k}_flat`, gearStatAt(cfg, v, p.growth[k] ?? 0, p.level, p.ascension));
      }
      if (p.slot === 'weapon' && typeof p.base.secondary_value === 'number') {
        const stat = p.base.secondary_stat === 'role_stat' ? roleStat : String(p.base.secondary_stat);
        addStat(g, stat, p.base.secondary_value);
      }
    } else if (p.rolled) {
      addStat(g, p.rolled.main.stat, p.rolled.main.value);
      for (const s of p.rolled.subs) addStat(g, s.stat, s.value);
    }
  }
  const counts = new Map<string, number>();
  for (const p of pieces) if (p.setId) counts.set(p.setId, (counts.get(p.setId) ?? 0) + 1);
  for (const [id, n] of counts) {
    const set = sets[id];
    if (set && n >= set.piecesForBonus) addStat(g, set.stat, set.pct);
  }
  return g;
}
