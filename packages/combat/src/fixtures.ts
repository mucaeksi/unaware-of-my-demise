import { readFileSync } from 'node:fs';
import { Encounter, UnitPack, unitStatsAt } from '@uomd/content-schema';

const root = new URL('../../../content/', import.meta.url);
const load = (rel: string): unknown => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));

export const basePack = (): UnitPack => UnitPack.parse(load('base/units/unit_pack.json'));
export const encounterT1 = (): Encounter => Encounter.parse(load('base/encounters/tutorial_t1.json'));
export const encounterT3 = (): Encounter => Encounter.parse(load('base/encounters/tutorial_t3.json'));
export const encounterT2 = (): Encounter => Encounter.parse(load('base/encounters/tutorial_t2.json'));

/**
 * The same units as legacy stat blocks (D-27 attributes derive linearly: HP 4 + 3 VIT, ATK = power, DEF = armor, SPD = AGI), so the
 * battle rules' crit applies again and tests can patch base_stats. Level-1 numbers are identical; growth rounds once instead of per attribute.
 */
export function asLegacy(pack: UnitPack): UnitPack {
  return {
    ...pack,
    units: pack.units.map(({ attributes: a, ...u }) => {
      if (!a) return u;
      const g = a.growth ?? {};
      const s = unitStatsAt({ attributes: a }, 1);
      return { ...u, base_stats: { hp: s.hp, atk: s.atk, def: s.def, spd: s.spd }, growth_per_level: { hp: 3 * (g.vit ?? 0), atk: g[a.power] ?? 0, def: 0, spd: g.agi ?? 0 } };
    })
  };
}

/** Pack with crits disabled so damage numbers are exact in unit tests. */
export function noCrit(pack: UnitPack): UnitPack {
  const legacy = asLegacy(pack);
  return { ...legacy, rules: { ...legacy.rules, crit: { ...legacy.rules.crit, chance: 0 } } };
}

export function patchUnit(pack: UnitPack, unitId: string, f: (u: UnitPack['units'][number]) => UnitPack['units'][number]): UnitPack {
  return { ...pack, units: pack.units.map((u) => (u.unit_id === unitId ? f(u) : u)) };
}
