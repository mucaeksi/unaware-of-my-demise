import { describe, expect, it } from 'vitest';
import { BattleParty } from '@uomd/content-schema';
import { dmg, duel, dummy, E, ev, hero, P } from './testkit';

const party = (effects: Record<string, unknown> = {}) => [{ unit_id: 'healer', level: 1, slot: 0, row: 'front' as const, equipment_effects: { version: 1, ...effects } }];
const battle = (effects: Record<string, unknown> = {}) => duel([hero('healer', [{ op: 'heal', target_selector_id: 'self', scale_stat: 'atk', multiplier: 1 }], { atk: 10 })], [dummy()], {}, { party: party(effects) as BattleParty });

describe('frozen equipment healing and action Focus', () => {
  it('adds outgoing healing, rounds once at the final bonus and clips to missing HP', () => {
    const b = battle({ heal_bonus_pct: 0.25 });
    b.unit(P(0, 'healer')).hp = 80;
    b.advance(); b.act({ skillId: 'healer_x' });
    expect(ev(b.log, 'heal')[0]?.amount).toBe(12);
    b.unit(P(0, 'healer')).hp = 98;
    b.advance(); b.act({ skillId: 'healer_x' });
    expect(ev(b.log, 'heal')[1]?.amount).toBe(2);
  });

  it('multiplies normal action Focus before integer rounding and honors its maximum', () => {
    const normal = battle(); const equipped = battle({ focus_gain_pct: 0.5 });
    for (const b of [normal, equipped]) { b.advance(); b.act({ skillId: 'healer_x' }); }
    expect(equipped.unit(P(0, 'healer')).focus).toBe(Math.floor(normal.unit(P(0, 'healer')).focus * 1.5));
    equipped.unit(P(0, 'healer')).focus = 99;
    equipped.advance(); equipped.act({ skillId: 'healer_x' });
    expect(equipped.unit(P(0, 'healer')).focus).toBe(100);
  });

  it('does not amplify an explicit fixed Focus grant', () => {
    const b = duel([hero('healer', [{ op: 'gain_focus', target_selector_id: 'self', amount: 7 }], {}, { type: 'ultimate', focus: 0 })], [dummy()], {}, { party: party({ focus_gain_pct: 0.5 }) as BattleParty });
    b.advance(); b.act({ skillId: 'healer_x' });
    expect(b.unit(P(0, 'healer')).focus).toBe(7);
  });

  it('copies the snapshot so later caller edits cannot change the battle', () => {
    const members = party({ heal_bonus_pct: 0.5 });
    const b = duel([hero('healer', [{ op: 'heal', target_selector_id: 'self', scale_stat: 'atk', multiplier: 1 }])], [dummy()], {}, { party: members as BattleParty });
    Object.assign(members[0]!.equipment_effects, { heal_bonus_pct: 0 });
    b.unit(P(0, 'healer')).hp = 50; b.advance(); b.act({ skillId: 'healer_x' });
    expect(ev(b.log, 'heal')[0]?.amount).toBe(15);
  });

  it('applies the source bonus to regeneration ticks without amplifying damage', () => {
    const b = duel([hero('healer', [{ op: 'apply_regeneration', target_selector_id: 'self', scale_stat: 'atk', multiplier: 0.5, ticks: 2, tick_event: 'owner_turn_start', duration_turns: 2 }], { atk: 20 })],
      [{ id: 'poker', kind: 'enemy', atk: 20, spd: 99, skills: [{ id: 'poke', ops: [dmg('single_enemy_default', 1)] }] }], {}, { party: party({ heal_bonus_pct: 0.5 }) as BattleParty });
    b.advance(); b.act({ skillId: 'healer_x' });
    b.act({ skillId: 'healer_basic', targetId: E(0, 'poker') });
    expect(ev(b.log, 'heal').map((h) => h.amount)).toEqual([15, 15]);
    expect(ev(b.log, 'damage').filter((d) => d.source === P(0, 'healer'))[0]?.amount).toBe(20);
  });

  it('rejects unknown effects/versions, negative, nonfinite and oversized bonuses', () => {
    for (const effects of [{ version: 2 }, { heal_bonus_pct: -1 }, { focus_gain_pct: Infinity }, { heal_bonus_pct: 6 }, { arbitrary_proc: 1 }]) expect(BattleParty.safeParse(party(effects)).success).toBe(false);
    expect(BattleParty.safeParse(party({ heal_bonus_pct: 0.5 })).success).toBe(true);
  });
});
