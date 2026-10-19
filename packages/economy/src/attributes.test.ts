import { describe, expect, it } from 'vitest';
import { aggregateGear, attributeStats, attributesAt, deriveStats, emptyGearStats, rollAccessory, type AttributeBlock, type GearPiece } from './index';
import { CANON_PROGRESSION } from './fixtures';

const caster: AttributeBlock = { power: 'int', base: { str: 1, int: 3, vit: 2, agi: 3 }, growth: { int: 0.5, vit: 0.25, agi: 0.25 } };

describe('attribute math (D-27)', () => {
  it('derives small level-1 numbers: VIT 2 -> 10 HP, the power attribute is ATK, DEF is armor only', () => {
    const a = attributesAt(caster, 1);
    expect(a).toEqual({ str: 1, int: 3, vit: 2, agi: 3 });
    expect(deriveStats(caster, a)).toEqual({ hp: 10, atk: 3, def: 0, spd: 3, crit_rate: 0.06, crit_damage: 1.5, effect_hit: 0.03 });
    expect(deriveStats({ ...caster, power: 'str' }, a, 2).atk).toBe(1);
    expect(deriveStats({ ...caster, armor: 3 }, a, 2).def).toBe(5);
  });
  it('grows linearly and rounds attributes half up (level 20)', () => {
    expect(attributesAt(caster, 20)).toEqual({ str: 1, int: 13, vit: 7, agi: 8 });
    expect(deriveStats(caster, attributesAt(caster, 20)).hp).toBe(25);
  });
  it('caps crit at 40% (AGI 20); AGI past the cap becomes crit damage', () => {
    const fast = (agi: number) => deriveStats(caster, { str: 1, int: 1, vit: 1, agi });
    expect(fast(20)).toMatchObject({ crit_rate: 0.4, crit_damage: 1.5 });
    expect(fast(30)).toMatchObject({ crit_rate: 0.4, crit_damage: 2 });
  });
  it('gear adds attribute points before the derivation; power points follow the power attribute', () => {
    const weapon: GearPiece = { slot: 'weapon', setId: null, level: 1, ascension: 0, base: { power: 2, secondary_stat: 'agi_flat', secondary_value: 1 }, growth: { power: 0.25 } };
    const armor: GearPiece = { slot: 'armor', setId: null, level: 1, ascension: 0, base: { vit: 2, def: 1 }, growth: { vit: 0.1, def: 0.05 } };
    const gear = aggregateGear(CANON_PROGRESSION, [weapon, armor], 'atk_pct', {});
    expect(gear.flat).toMatchObject({ power: 2, agi: 1, vit: 2, def: 1 });
    const s = attributeStats(caster, 1, gear);
    expect(s.attributes).toEqual({ str: 1, int: 5, vit: 4, agi: 4 });
    expect(s).toMatchObject({ hp: 16, atk: 5, def: 1, spd: 4, crit_rate: 0.08 });
    expect(attributeStats(caster, 1, emptyGearStats(), { vit: 1 }).hp).toBe(13);
  });
  it('rolls whole attribute points for whole-number ranges', () => {
    let x = 0;
    const roll = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    const def = { main: [{ stat_id: 'vit_flat', weight: 1, unit: 'flat' as const, min_value: 1, max_value: 2 }], sub: [{ stat_id: 'agi_flat', weight: 1, unit: 'flat' as const, min_value: 1, max_value: 2 }, { stat_id: 'heal_bonus_pct', weight: 1, unit: 'percent' as const, min_value: 0.04, max_value: 0.07 }], profile: { substat_count: 2, is_rerollable: false, reroll_cost: null } };
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const a = rollAccessory(def, roll);
      seen.add(a.main.value);
      expect(a.subs.find((s) => s.stat === 'heal_bonus_pct')!.value % 1).not.toBe(0);
    }
    expect([...seen].sort()).toEqual([1, 2]);
  });
});
