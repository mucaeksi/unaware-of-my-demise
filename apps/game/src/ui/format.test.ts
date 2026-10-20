import { describe, expect, it } from 'vitest';
import { gearStat, idLabel } from './format';

describe('idLabel', () => {
  it('turns server ids into player text, keeping short joining words lower case', () => {
    expect(idLabel('wayfarer_of_ash')).toBe('Wayfarer of Ash');
    expect(idLabel('gold_bell')).toBe('Gold Bell');
    expect(idLabel('of_the_demise')).toBe('Of the Demise');
  });
});

describe('gearStat', () => {
  it('reads whole points as +N NAME and percentages as NAME +N%', () => {
    expect(gearStat('vit_flat', 2)).toBe('+2 VIT');
    expect(gearStat('power_flat', 1)).toBe('+1 POWER');
    expect(gearStat('heal_bonus_pct', 0.055)).toBe('HEAL +5.5%');
    expect(gearStat('hp_pct', 0.08)).toBe('HP +8%');
    expect(gearStat('mystery', 3)).toBe('+3 MYSTERY');
  });
});
