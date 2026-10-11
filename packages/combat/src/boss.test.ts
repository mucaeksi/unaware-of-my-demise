import { describe, expect, it } from 'vitest';
import { dmg, dummy, duel, ev, hero, P, E, type UnitSpec } from './testkit';

const phase = (id: string, over: Record<string, unknown> = {}) => ({
  phase_id: id,
  name_en: id,
  transition: 'battle_start',
  transition_hp_percent: null,
  hp_multiplier: 1,
  atk_multiplier: 1,
  def_multiplier: 1,
  weaknesses: [],
  signature_action_id: null,
  tauntable: true,
  objectives: [],
  enter_ops: [],
  passive_ops: [],
  ...over
});
const bossDef = (phases: unknown[]) => ({ phases, preserve_status_ids: ['break'], clear_status_category: 'debuff', control_duration_multiplier: 0.5 });
const second = (over: Record<string, unknown> = {}) => phase('second', { transition: 'at_hp_percent', transition_hp_percent: 0.5, hp_multiplier: 0.5, atk_multiplier: 2, ...over });

/** A boss that only uses its basic strike unless the caller adds skills. */
const boss = (phases: unknown[], over: Partial<UnitSpec> = {}): UnitSpec => ({
  id: 'warden',
  kind: 'enemy',
  hp: 100,
  atk: 10,
  spd: 99,
  skills: [{ id: 'warden_basic', ops: [dmg('single_enemy_default', 1)] }],
  boss: bossDef(phases),
  ...over
});

describe('boss phases', () => {
  it('a phase bar is fresh: crossing 50% starts phase two with its own HP bar and stats', () => {
    const b = duel([hero('slayer', [], { atk: 60, hp: 2000 })], [boss([phase('first'), second()])]);
    b.advance();
    expect(b.unit(E(0, 'warden')).maxHp).toBe(100);
    b.act({ skillId: 'slayer_basic', targetId: E(0, 'warden') }); // 100 -> 40: below 50%
    const changes = ev(b.log, 'phase_change');
    expect(changes.map((c) => c.phase)).toEqual(['first', 'second']);
    expect(changes[1]).toMatchObject({ hp: 50, maxHp: 50 }); // fresh bar: 100 x 0.5
    expect(b.unit(E(0, 'warden')).base.atk).toBe(20); // x2 attack in phase two
    expect(b.unit(E(0, 'warden')).hp).toBeLessThanOrEqual(50);
  });

  it('a hit that would empty the first bar only starts the second phase; the boss falls at the end of the last one', () => {
    const b = duel([hero('slayer', [], { atk: 500, hp: 5000 })], [boss([phase('first'), second()])]);
    b.advance();
    b.act({ skillId: 'slayer_basic', targetId: E(0, 'warden') });
    expect(b.result).toBeNull();
    expect(b.unit(E(0, 'warden')).alive).toBe(true);
    b.act({ skillId: 'slayer_basic', targetId: E(0, 'warden') });
    expect(b.result?.winner).toBe('player');
  });

  it('a phase change clears debuffs except the preserved ones and swaps the weaknesses', () => {
    const b = duel([hero('slayer', [], { atk: 60, hp: 2000 })], [boss([phase('first', { weaknesses: ['Ember'] }), second({ weaknesses: ['Tide'] })], { spd: 1 })]);
    b.advance();
    const w = b.unit(E(0, 'warden'));
    w.statuses.push({ statusId: 'fracture', turnsLeft: 5, sourceId: 'x', seq: 1 }, { statusId: 'break', turnsLeft: 5, sourceId: 'x', seq: 2 });
    expect(w.weaknessOverride).toEqual(['Ember']);
    b.act({ skillId: 'slayer_basic', targetId: E(0, 'warden') });
    expect(w.statuses.map((s) => s.statusId)).toContain('break');
    expect(w.statuses.map((s) => s.statusId)).not.toContain('fracture');
    expect(w.weaknessOverride).toEqual(['Tide']);
  });

  it('control effects on a boss last half as long, never less than one turn', () => {
    const b = duel([hero('binder', [{ op: 'apply_status', target_selector_id: 'single_enemy', status_id: 'taunt', duration_turns: 2 }], {}, { target: 'enemy' })], [boss([phase('first')])]);
    b.advance();
    b.act({ skillId: 'binder_x', targetId: E(0, 'warden') });
    expect(b.unit(E(0, 'warden')).statuses.find((s) => s.statusId === 'taunt')?.turnsLeft).toBeLessThanOrEqual(1);
  });
});

describe('objectives', () => {
  const bell = { objective_id: 'jaw_bell', name_en: 'Jaw Bell', max_hp: 3, targetable_by_player: true, persists_across_phases: true, on_destroyed: [{ op: 'cancel_boss_telegraph', target_selector_id: 'boss', action_id: 'warden_howl' }] };
  const howl = (extra: Record<string, unknown> = {}) => ({ id: 'warden_howl', type: 'signature' as const, cd: 3, telegraph: { player_actions_before_resolution: 1, interrupt_if_objective_destroyed: 'jaw_bell' }, ops: [dmg('all_enemies', 3)], ...extra });
  const mk = () => duel([hero('breaker', [dmg('single_enemy', 1, { hit_count: 3 })], { atk: 5, hp: 1000 }, { target: 'enemy' })], [boss([phase('first', { objectives: [bell] })], { skills: [{ id: 'warden_basic', ops: [dmg('single_enemy_default', 1)] }, howl()], spd: 101 })]);

  it('objectives are legal targets next to the boss, never targets of area attacks, and never count for victory', () => {
    const b = mk();
    const prompt = b.advance().prompt;
    const targets = prompt?.options.find((o) => o.skillId === 'breaker_basic')?.legalTargets ?? [];
    expect(targets.some((t) => t.includes('jaw_bell'))).toBe(true);
    expect(targets).toContain(E(0, 'warden'));
    expect(b.living('enemy')).toHaveLength(1); // the bell is not a unit
  });

  it('each damaging hit removes one point, and destroying the bell cancels the announced intent', () => {
    const b = mk();
    const prompt = b.advance().prompt;
    const bellId = (prompt?.options.find((o) => o.skillId === 'breaker_basic')?.legalTargets ?? []).find((t) => t.includes('jaw_bell')) as string;
    expect(ev(b.log, 'telegraph')).toHaveLength(1); // the boss announced Howl on its first turn
    b.act({ skillId: 'breaker_basic', targetId: bellId }); // one point
    expect(b.unit(bellId).hp).toBe(2);
    expect(ev(b.log, 'skill_used').some((u) => u.skill === 'warden_howl')).toBe(true); // ... too slow: the intent resolved after that action
    const b2 = mk();
    const p2 = b2.advance().prompt;
    const bell2 = (p2?.options.find((o) => o.skillId === 'breaker_x')?.legalTargets ?? []).find((t) => t.includes('jaw_bell')) as string;
    b2.act({ skillId: 'breaker_x', targetId: bell2 }); // three hits in one action break it before the boss resolves
    expect(ev(b2.log, 'objective_destroyed')).toEqual([{ type: 'objective_destroyed', objective: 'jaw_bell', boss: E(0, 'warden') }]);
    expect(ev(b2.log, 'telegraph_cancelled')).toHaveLength(1);
    expect(ev(b2.log, 'skill_used').some((u) => u.skill === 'warden_howl')).toBe(false);
    expect(b2.unit(E(0, 'warden')).cooldowns.warden_howl).toBeGreaterThan(0); // an interrupted signature is spent
  });

  it('an announced intent resolves after the player action when nobody breaks the bell', () => {
    const b = mk();
    b.advance();
    b.act({ skillId: 'breaker_basic', targetId: E(0, 'warden') });
    const used = ev(b.log, 'skill_used').filter((u) => u.skill === 'warden_howl');
    expect(used).toHaveLength(1);
    const telegraphAt = b.log.findIndex((e) => e.type === 'telegraph');
    const usedAt = b.log.findIndex((e) => e.type === 'skill_used' && e.skill === 'warden_howl');
    expect(usedAt).toBeGreaterThan(telegraphAt);
  });

  it('Auto Battle goes for the objective that would cancel the announced intent', () => {
    const b = mk();
    b.advance();
    const action = b.autoAction();
    expect(action.targetId).toContain('jaw_bell');
  });

  it('a ward on the boss holds only while its objective stands (boss_damage_taken_modifier / remove_boss_modifier)', () => {
    const seal = { objective_id: 'wax_seal', name_en: 'Wax Seal', max_hp: 1, targetable_by_player: true, on_destroyed: [{ op: 'remove_boss_modifier', target_selector_id: 'boss', modifier_id: 'wax_ward' }] };
    const ward = { op: 'boss_damage_taken_modifier', target_selector_id: 'self', multiplier: 0.5, modifier_id: 'wax_ward', until_objective_destroyed: 'wax_seal' };
    const b = duel([hero('breaker', [], { atk: 20, hp: 1000 })], [boss([phase('first', { objectives: [seal], passive_ops: [ward] })], { hp: 1000, spd: 1 })]);
    const prompt = b.advance().prompt;
    const sealId = (prompt?.options[0]?.legalTargets ?? []).find((t) => t.includes('wax_seal')) as string;
    const warded = b.act({ skillId: 'breaker_basic', targetId: E(0, 'warden') });
    expect(ev(warded.events, 'damage')[0]?.amount).toBe(10); // 20 x 0.5
    b.act({ skillId: 'breaker_basic', targetId: sealId });
    const open = b.act({ skillId: 'breaker_basic', targetId: E(0, 'warden') });
    expect(ev(open.events, 'damage').find((d) => d.target === E(0, 'warden'))?.amount).toBe(20);
  });
});

describe('reinforcements, pending intents and conditional strength', () => {
  const banner = { objective_id: 'signal_banner', name_en: 'Signal Banner', max_hp: 1, targetable_by_player: true };
  const call = { id: 'warden_call', type: 'signature' as const, cd: 3, telegraph: { player_actions_before_resolution: 1, interrupt_if_objective_destroyed: 'signal_banner' }, ops: [{ op: 'summon_enemies', target_selector_id: 'self', enemy_id: 'hired_blade', count: 2, only_if_objective_alive: 'signal_banner' }] };
  const mk = () => duel([hero('breaker', [], { atk: 5, hp: 5000 })], [boss([phase('first', { objectives: [banner] })], { skills: [call], spd: 101 }), dummy('hired_blade', { hp: 30 })]);

  it('the boss calls two reinforcements when nobody breaks the banner', () => {
    const b = mk();
    b.advance();
    b.act({ skillId: 'breaker_basic', targetId: E(0, 'warden') });
    expect(ev(b.log, 'summon')).toHaveLength(2);
    expect(b.living('enemy')).toHaveLength(4); // boss + the blade that started in slot 1 + 2 called blades
  });

  it('breaking the banner first cancels the call', () => {
    const b = mk();
    const prompt = b.advance().prompt;
    const banner1 = (prompt?.options[0]?.legalTargets ?? []).find((t) => t.includes('signal_banner')) as string;
    b.act({ skillId: 'breaker_basic', targetId: banner1 });
    expect(ev(b.log, 'summon')).toHaveLength(0);
    expect(ev(b.log, 'telegraph_cancelled')).toHaveLength(1);
  });

  it('an announced intent resolves before the phase changes', () => {
    const b = duel(
      [hero('slayer', [], { atk: 60, hp: 5000 })],
      [boss([phase('first'), second()], { skills: [{ id: 'warden_basic', ops: [dmg('single_enemy_default', 1)] }, { id: 'warden_slam', type: 'signature', cd: 3, telegraph: { player_actions_before_resolution: 1 }, ops: [dmg('all_enemies', 1)] }], spd: 101 })]
    );
    b.advance(); // announced
    b.act({ skillId: 'slayer_basic', targetId: E(0, 'warden') });
    const kinds = b.log.map((e) => (e.type === 'skill_used' ? `used:${e.skill}` : e.type)).filter((t) => t === 'phase_change' || t.startsWith('used:warden_slam'));
    expect(kinds).toEqual(['phase_change', 'used:warden_slam', 'phase_change']);
  });

  it('multiplier_if_objective_alive makes an attack stronger while the standard flies', () => {
    const standard = { objective_id: 'standard', name_en: 'Standard', max_hp: 1, targetable_by_player: true };
    const strike = (alive: boolean): number => {
      const b = duel(
        [hero('target', [], { hp: 5000, def: 0 })],
        [boss([phase('first', { objectives: [standard] })], { atk: 100, spd: 101, skills: [{ id: 'warden_basic', ops: [dmg('single_enemy_default', 1, { multiplier_if_objective_alive: { objective_id: 'standard', multiplier: 1.5 } })] }] })]
      );
      if (!alive) b.combatants.find((c) => c.objective)!.alive = false;
      b.advance();
      return ev(b.log, 'damage').find((d) => d.target === P(0, 'target'))?.amount ?? 0;
    };
    expect(strike(true)).toBe(150);
    expect(strike(false)).toBe(100);
  });
});
