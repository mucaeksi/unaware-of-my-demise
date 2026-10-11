import { describe, expect, it } from 'vitest';
import { Rng } from '@uomd/shared';
import { aggregateGear, finalStats, rerollAccessory, rollAccessory, type AccessoryDef, type GearPiece } from './index';
import { CANON_PROGRESSION } from './fixtures';

const def: AccessoryDef = {
  main: [
    { stat_id: 'hp_pct', weight: 40, unit: 'percent', min_value: 0.06, max_value: 0.12 },
    { stat_id: 'def_pct', weight: 25, unit: 'percent', min_value: 0.06, max_value: 0.12 },
    { stat_id: 'effect_res_pct', weight: 15, unit: 'percent', min_value: 0.04, max_value: 0.08 }
  ],
  sub: [
    { stat_id: 'hp_flat', weight: 10, unit: 'flat', min_value: 1, max_value: 2 },
    { stat_id: 'hp_pct', weight: 12, unit: 'percent', min_value: 0.06, max_value: 0.12 },
    { stat_id: 'atk_pct', weight: 10, unit: 'percent', min_value: 0.06, max_value: 0.12 },
    { stat_id: 'spd_flat', weight: 10, unit: 'flat', min_value: 0.2, max_value: 0.4 },
    { stat_id: 'def_pct', weight: 10, unit: 'percent', min_value: 0.06, max_value: 0.12 }
  ],
  profile: { substat_count: 3, is_rerollable: true, reroll_cost: 3 }
};
const seq = (seed: number) => {
  const r = new Rng(seed);
  return () => r.next();
};

describe('accessory stat generation (canon rules)', () => {
  it('rolls a weighted main stat inside its range and distinct sub stats that never repeat the main stat', () => {
    for (let s = 1; s <= 200; s++) {
      const a = rollAccessory(def, seq(s));
      const m = def.main.find((e) => e.stat_id === a.main.stat)!;
      expect(a.main.value).toBeGreaterThanOrEqual(m.min_value);
      expect(a.main.value).toBeLessThanOrEqual(m.max_value);
      expect(a.subs).toHaveLength(3);
      const ids = a.subs.map((x) => x.stat);
      expect(new Set(ids).size).toBe(3);
      expect(ids).not.toContain(a.main.stat);
    }
  });
  it('main stat frequencies follow the weights (40 / 25 / 15)', () => {
    const r = seq(7);
    const c: Record<string, number> = {};
    for (let i = 0; i < 8000; i++) {
      const a = rollAccessory(def, r);
      c[a.main.stat] = (c[a.main.stat] ?? 0) + 1;
    }
    expect((c.hp_pct ?? 0) / 8000).toBeGreaterThan(0.45);
    expect((c.hp_pct ?? 0) / 8000).toBeLessThan(0.55);
    expect((c.effect_res_pct ?? 0) / 8000).toBeGreaterThan(0.14);
  });
  it('reroll keeps the main stat and changes only sub stats; deterministic for a seed', () => {
    const a = rollAccessory(def, seq(11));
    const b = rerollAccessory(def, a, seq(12));
    expect(b.main).toEqual(a.main);
    expect(b.subs.every((x) => x.stat !== a.main.stat)).toBe(true);
    expect(rollAccessory(def, seq(11))).toEqual(a);
  });
});

describe('gear aggregation', () => {
  const sword: GearPiece = { slot: 'weapon', setId: null, level: 11, ascension: 2, base: { atk: 2, secondary_stat: 'role_stat', secondary_value: 0.08 }, growth: { atk: 0.1 } };
  const mail: GearPiece = { slot: 'armor', setId: null, level: 1, ascension: 0, base: { hp: 1.2, def: 0.66 }, growth: { hp: 0.06, def: 0.03 } };
  const neck: GearPiece = { slot: 'necklace', setId: 'ash_maw_hide', level: 1, ascension: 0, base: {}, growth: {}, rolled: { main: { stat: 'hp_pct', value: 0.1 }, subs: [{ stat: 'atk_flat', value: 0.4 }] } };
  const ring: GearPiece = { slot: 'ring', setId: 'ash_maw_hide', level: 1, ascension: 0, base: {}, growth: {}, rolled: { main: { stat: 'atk_pct', value: 0.1 }, subs: [{ stat: 'effect_res_pct', value: 0.05 }] } };
  it('weapon level + milestone bonus, role stat resolution, rolled accessories and the 2-piece set bonus', () => {
    const g = aggregateGear(CANON_PROGRESSION, [sword, mail, neck, ring], 'def_pct', { ash_maw_hide: { piecesForBonus: 2, stat: 'hp_pct', pct: 0.05 } });
    expect(g.flat.atk).toBeCloseTo(2 + 1.0 + 2 * 0.1 + 0.4, 9); // level 11 growth 10 * 0.1 + milestone 2 -> 10 % of 2 + the necklace sub
    expect(g.flat.hp).toBeCloseTo(1.2, 9);
    expect(g.pct.hp).toBeCloseTo(0.1 + 0.05, 9); // necklace main + set bonus
    expect(g.pct.def).toBeCloseTo(0.08, 9); // weapon role stat resolved to def_pct
    expect(g.pct.atk).toBeCloseTo(0.1, 9);
    expect(g.other.effect_res_pct).toBeCloseTo(0.05, 9);
  });
  it('a lone set piece gives no set bonus; final stats feed the combat numbers', () => {
    const g = aggregateGear(CANON_PROGRESSION, [neck], 'atk_pct', { ash_maw_hide: { piecesForBonus: 2, stat: 'hp_pct', pct: 0.05 } });
    expect(g.pct.hp).toBeCloseTo(0.1, 9);
    expect(finalStats({ hp: 14, atk: 2, def: 2, spd: 4 }, { hp: 0.7, atk: 0.12, def: 0.1, spd: 0.16 }, 1, g)).toEqual({ hp: 15, atk: 2, def: 2, spd: 4 });
  });
});
