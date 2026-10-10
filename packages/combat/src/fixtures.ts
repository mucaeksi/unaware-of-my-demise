import { readFileSync } from 'node:fs';
import { Encounter, UnitPack } from '@uomd/content-schema';

const root = new URL('../../../content/', import.meta.url);
const load = (rel: string): unknown => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));

export const basePack = (): UnitPack => UnitPack.parse(load('base/units/unit_pack.json'));
export const patchPack = (): UnitPack => UnitPack.parse(load('patches/rel_0002_road_forgotten/units/unit_pack.json'));
export const encounterT1 = (): Encounter => Encounter.parse(load('base/encounters/tutorial_t1.json'));
export const encounterT2 = (): Encounter => Encounter.parse(load('patches/rel_0002_road_forgotten/encounters/tutorial_t2.json'));

/** Pack with crits disabled so damage numbers are exact in unit tests. */
export function noCrit(pack: UnitPack): UnitPack {
  return { ...pack, rules: { ...pack.rules, crit: { ...pack.rules.crit, chance: 0 } } };
}

export function patchUnit(pack: UnitPack, unitId: string, f: (u: UnitPack['units'][number]) => UnitPack['units'][number]): UnitPack {
  return { ...pack, units: pack.units.map((u) => (u.unit_id === unitId ? f(u) : u)) };
}
