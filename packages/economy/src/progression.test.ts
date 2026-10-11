import { describe, expect, it } from 'vitest';
import { CANON_PROGRESSION } from './fixtures';
import {
  accountLevelFromXp,
  applyCharacterXp,
  characterLevelCap,
  characterLevelFee,
  characterXpToNext,
  feeForLevels,
  finalStats,
  gearLevelCap,
  gearStatAt,
  statAtLevel,
  xpToReach
} from './index';

const C = CANON_PROGRESSION;

describe('character progression (canon formulas)', () => {
  it('xp_to_next(level) = 90 + 24 L + 8 L^2', () => {
    expect(characterXpToNext(C, 1)).toBe(122);
    expect(characterXpToNext(C, 10)).toBe(90 + 240 + 800);
    expect(characterXpToNext(C, 19)).toBe(90 + 456 + 2888);
  });
  it('level-up fees in the main currency are small against a 160-pull (about 5-6 pulls to cap 20 from fees plus ascensions)', () => {
    expect(characterLevelFee(C, 1)).toBe(2);
    const all = Array.from({ length: 19 }, (_, i) => i + 1);
    const total = feeForLevels(C, all) + C.character.ascension.reduce((s, a) => s + a.fee, 0);
    expect(total).toBeGreaterThan(500);
    expect(total / 160).toBeLessThan(8);
  });
  it('level cap follows ascension and account level; xp stops at a cap and the overflow is reported as wasted', () => {
    expect(characterLevelCap(C, 0, 20)).toBe(5);
    expect(characterLevelCap(C, 1, 20)).toBe(10);
    expect(characterLevelCap(C, 3, 20)).toBe(20);
    expect(characterLevelCap(C, 3, 7)).toBe(7); // the character can never pass the account level
    const r = applyCharacterXp(C, { level: 1, xp: 0, ascension: 0 }, 100_000, 5);
    expect(r.state).toEqual({ level: 5, xp: 0, ascension: 0 });
    expect(r.levelsGained).toBe(4);
    expect(r.wasted).toBeGreaterThan(90_000);
    const part = applyCharacterXp(C, { level: 1, xp: 0, ascension: 0 }, 200, 5);
    expect(part.state).toEqual({ level: 2, xp: 78, ascension: 0 });
    expect(part.feeLevels).toEqual([1]);
    expect(xpToReach(C, { level: 1, xp: 0, ascension: 0 }, 2)).toBe(122);
    expect(xpToReach(C, part.state, 3)).toBe(characterXpToNext(C, 2) - 78);
  });
  it('account level from lifetime xp (250 + 50 per level)', () => {
    expect(accountLevelFromXp(C, 0)).toEqual({ level: 1, into: 0, toNext: 250 });
    expect(accountLevelFromXp(C, 250)).toMatchObject({ level: 2, into: 0, toNext: 300 });
    expect(accountLevelFromXp(C, 10_000_000).level).toBe(20);
  });
  it('stats: base + growth * (level - 1), rounded half up; gear adds flat first, percentages after', () => {
    expect(statAtLevel(14, 0.7, 20)).toBe(27); // 14 + 13.3
    const f = finalStats({ hp: 14, atk: 2, def: 2, spd: 4 }, { hp: 0.7, atk: 0.12, def: 0.1, spd: 0.16 }, 20, { flat: { atk: 5, hp: 10 }, pct: { atk: 0.1 }, other: {} });
    expect(f).toEqual({ hp: 37, atk: 10, def: 4, spd: 7 });
  });
  it('gear: milestones add a percentage of the level-1 value and gate the level cap (rivets)', () => {
    expect(gearLevelCap(C, 0)).toBe(5);
    expect(gearLevelCap(C, 1)).toBe(10);
    expect(gearLevelCap(C, 3)).toBe(20);
    expect(gearStatAt(C, 2, 0.1, 5, 0)).toBeCloseTo(2.4, 9);
    expect(gearStatAt(C, 2, 0.1, 15, 3)).toBeCloseTo(2 + 1.4 + 0.3, 9);
  });
});
