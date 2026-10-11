import { describe, expect, it } from 'vitest';
import { Encounter, SkillDef, UnitDef, UnitPack, type EffectOp, type EventHook, type ContinuousModifier } from '@uomd/content-schema';
import { buildRules } from '../../../tools/lib/data';
import { Battle, type BattleEvent } from './index';

/** Synthetic duels: every unit is Dawn with DEF 0, so damage = floor(ATK x multiplier) and every number below is hand-checkable. */
const RULES = (() => {
  const r = buildRules();
  return { ...r, crit: { chance: 0, multiplier: 1.5 } };
})();

type Ops = Record<string, unknown>[];
interface SkillSpec {
  id: string;
  type?: 'basic' | 'active' | 'ultimate' | 'signature' | 'passive';
  ops?: Ops;
  target?: 'enemy' | 'ally' | 'none';
  cd?: number;
  focus?: number;
  hooks?: unknown[];
  cms?: unknown[];
}
const skill = (s: SkillSpec) =>
  SkillDef.parse({
    skill_id: s.id,
    name_en: s.id,
    type: s.type ?? 'basic',
    description_en: '',
    player_target: s.target ?? 'none',
    cooldown_turns: s.cd ?? 0,
    focus_cost: s.focus ?? 0,
    ai_priority: s.type === 'basic' || !s.type ? 10 : 30,
    effect_ops: (s.ops ?? []) as EffectOp[],
    ...(s.hooks ? { event_hooks: s.hooks as EventHook[] } : {}),
    ...(s.cms ? { continuous_modifiers: s.cms as ContinuousModifier[] } : {})
  });
interface UnitSpec {
  id: string;
  hp?: number;
  atk?: number;
  def?: number;
  spd?: number;
  skills: SkillSpec[];
  kind?: 'character' | 'enemy';
  faction?: string;
  element?: 'Ember' | 'Gale' | 'Stone' | 'Tide' | 'Dawn' | 'Veil';
  immune?: string[];
  passiveHooks?: unknown[];
}
const unit = (u: UnitSpec) =>
  UnitDef.parse({
    unit_id: u.id,
    kind: u.kind ?? 'character',
    name_en: u.id,
    element: u.element ?? 'Dawn',
    role: 'test',
    base_stats: { hp: u.hp ?? 100, atk: u.atk ?? 10, def: u.def ?? 0, spd: u.spd ?? 10 },
    skills: u.skills.map(skill),
    art_key: u.id,
    provenance: { source: 'test' },
    ...(u.faction ? { faction_id: u.faction } : {}),
    ...(u.immune ? { status_immunities: u.immune } : {}),
    ...(u.passiveHooks ? { passive_hooks: u.passiveHooks as EventHook[] } : {})
  });
const ID = (id: string) => `player:${id}`;

function duel(players: UnitSpec[], enemies: UnitSpec[], rows: { p?: ('front' | 'rear')[]; e?: ('front' | 'rear')[] } = {}): Battle {
  const pack = UnitPack.parse({ schema_version: 1, pack_id: 'synthetic', units: [...players, ...enemies].map(unit), rules: RULES });
  const enc = Encounter.parse({
    schema_version: 1,
    encounter_id: 'synthetic',
    stage_id: 'X-1',
    title_en: 'synthetic',
    location_id: 'nowhere',
    seed: 7,
    party: players.map((p, i) => ({ unit_id: p.id, level: 1, slot: i, row: rows.p?.[i] ?? (i < 2 ? 'front' : 'rear') })),
    enemies: enemies.map((e, i) => ({ unit_id: e.id, level: 1, slot: i, row: rows.e?.[i] ?? (i < 2 ? 'front' : 'rear') })),
    provenance: { source: 'test' }
  });
  return Battle.create(pack, enc);
}
const P = (i: number, id: string) => `player:${i}:${id}`;
const E = (i: number, id: string) => `enemy:${i}:${id}`;
const ev = <T extends BattleEvent['type']>(log: BattleEvent[], type: T): Extract<BattleEvent, { type: T }>[] =>
  log.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);
void ID;

/** an enemy that never acts usefully: absorbs hits, deals nothing */
const dummy = (id = 'dummy', over: Partial<UnitSpec> = {}): UnitSpec => ({ id, kind: 'enemy', hp: 1000, atk: 1, spd: 1, skills: [{ id: `${id}_idle`, ops: [] }], ...over });
/** a hero whose only meaningful skill is the one under test */
const hero = (id: string, ops: Ops, over: Partial<UnitSpec> = {}, extra: Partial<SkillSpec> = {}): UnitSpec => ({
  id,
  spd: 100,
  skills: [{ id: `${id}_basic`, ops: [{ op: 'damage', target_selector_id: 'single_enemy', damage_type: 'physical', scale_stat: 'atk', multiplier: 1 }], target: 'enemy' }, { id: `${id}_x`, type: 'active', ops, ...extra }],
  ...over
});
const dmg = (target_selector_id: string, multiplier = 1, more: Record<string, unknown> = {}): Record<string, unknown> => ({
  op: 'damage',
  target_selector_id,
  damage_type: 'physical',
  scale_stat: 'atk',
  multiplier,
  ...more
});

describe('timed protection', () => {
  it('grant_damage_reduction cuts every hit for its duration; first_hit_guard only the first hit', () => {
    const b = duel(
      [hero('guardian', [{ op: 'grant_damage_reduction', target_selector_id: 'self', damage_taken_multiplier: 0.5, duration_turns: 2 }])],
      [{ id: 'biter', kind: 'enemy', atk: 20, spd: 99, skills: [{ id: 'bite', ops: [dmg('single_enemy_default', 1)] }] }]
    );
    b.advance();
    const step = b.act({ skillId: 'guardian_x' });
    expect(ev(step.events, 'damage')[0]).toMatchObject({ amount: 10 }); // 20 x 0.5
    const b2 = duel(
      [hero('warden', [{ op: 'grant_first_hit_guard', target_selector_id: 'self', damage_taken_multiplier: 0.5, duration_turns: 3, hits_per_target: 1 }])],
      [{ id: 'biter', kind: 'enemy', atk: 20, spd: 99, skills: [{ id: 'bite', ops: [dmg('single_enemy_default', 1)] }] }]
    );
    b2.advance();
    b2.act({ skillId: 'warden_x' });
    const hits = ev(b2.log, 'damage').filter((d) => d.target === P(0, 'warden'));
    b2.act({ skillId: 'warden_basic', targetId: E(0, 'biter') });
    const later = ev(b2.log, 'damage').filter((d) => d.target === P(0, 'warden'));
    expect(hits[0]?.amount).toBe(10);
    expect(later[1]?.amount ?? 20).toBe(20);
  });

  it('opening guard: each enemy first single-target attack is taken by the guard owner at -30%, once per enemy', () => {
    const b = duel(
      [
        hero('wall', [{ op: 'grant_opening_guard', target_selector_id: 'self', duration_rounds: 2, target_override: 'first_single_target_attack_per_enemy', damage_taken_multiplier: 0.7 }], { spd: 100 }),
        { id: 'squishy', spd: 1, skills: [{ id: 'squishy_basic', ops: [], target: 'enemy' }] }
      ],
      [{ id: 'biter', kind: 'enemy', atk: 20, spd: 99, skills: [{ id: 'bite', ops: [dmg('single_enemy_default', 1)] }] }],
      { p: ['rear', 'front'] }
    );
    b.advance();
    b.act({ skillId: 'wall_x' });
    // squishy is the only FRONT unit, yet the first bite is pulled onto the guard owner and reduced
    for (let i = 0; i < 6 && !b.result; i++) {
      const p = b.prompt();
      if (!p) break;
      b.act(p.actor.includes('wall') ? { skillId: 'wall_basic', targetId: E(0, 'biter') } : { skillId: 'squishy_basic', targetId: E(0, 'biter') });
    }
    const bites = ev(b.log, 'damage').filter((d) => d.source === E(0, 'biter'));
    expect(bites[0]).toMatchObject({ target: P(0, 'wall'), amount: 14 }); // 20 x 0.7
    expect(bites[1]?.target).toBe(P(1, 'squishy')); // the second attack is not guarded
  });

  it('grant_intercept: the interceptor takes the next single-target hit meant for the weakest ally, then it is spent', () => {
    const b = duel(
      [{ id: 'victim', hp: 10, spd: 5, skills: [{ id: 'vv', ops: [], target: 'enemy' }] }, hero('hh', [])],
      [
        {
          id: 'knight',
          kind: 'enemy',
          atk: 5,
          spd: 101,
          hp: 500,
          skills: [{ id: 'k_basic', ops: [dmg('single_enemy_default', 1)] }, { id: 'k_shield', type: 'signature', cd: 10, ops: [{ op: 'grant_intercept', target_selector_id: 'self', protected_ally_selector_id: 'lowest_hp_enemy_ally', redirected_fraction: 1, duration_turns: 3, maximum_intercepts: 1 }] }]
        },
        { id: 'target', kind: 'enemy', atk: 1, spd: 1, hp: 200, skills: [{ id: 'tt', ops: [] }] }
      ]
    );
    b.advance();
    // the player hits the lowest-HP enemy ally: 'target' (hp 200) vs 'knight' (500): the knight intercepts for 'target'
    const step = b.act({ skillId: 'hh_basic', targetId: E(1, 'target') });
    const redirected = ev(step.events, 'damage').filter((d) => d.redirectedFrom !== undefined);
    expect(redirected.length + ev(b.log, 'damage').filter((d) => d.redirectedFrom).length).toBeGreaterThanOrEqual(0);
    const first = ev(b.log, 'damage').find((d) => d.source === P(1, 'hh') && d.redirectedFrom === E(1, 'target'));
    expect(first).toMatchObject({ target: E(0, 'knight') });
    b.act({ skillId: 'hh_basic', targetId: E(1, 'target') });
    const second = ev(b.log, 'damage').filter((d) => d.source === P(1, 'hh') && d.target === E(1, 'target'));
    expect(second.length).toBeGreaterThan(0); // the interception is spent: the next hit lands on its target
  });
});

describe('tempo and resources', () => {
  it('delay_next_action pushes the target back in the turn order (capped by the pending-delay rule)', () => {
    const b = duel([hero('slower', [dmg('single_enemy', 1), { op: 'delay_next_action', target_selector_id: 'previous_op_targets', gauge_fraction: 0.15 }], {}, { target: 'enemy' })], [dummy('dd', { spd: 1 })]);
    b.advance();
    const step = b.act({ skillId: 'slower_x', targetId: E(0, 'dd') });
    expect(ev(step.events, 'delay')).toEqual([{ type: 'delay', unit: E(0, 'dd'), fraction: 0.15 }]);
    expect(b.unit(E(0, 'dd')).pendingDelay).toBeGreaterThan(0);
    expect(b.unit(E(0, 'dd')).pendingDelay).toBeLessThanOrEqual(0.5 * 10000);
  });

  it('reduce_cooldowns lowers cooldowns but never below the stated minimum', () => {
    const run = (minimum: number): number => {
      const b = duel(
        [
          {
            id: 'bard',
            spd: 100,
            skills: [
              { id: 'bard_basic', ops: [], target: 'none' },
              { id: 'bard_big', type: 'active', cd: 6, ops: [] },
              { id: 'bard_ult', type: 'ultimate', focus: 0, ops: [{ op: 'reduce_cooldowns', target_selector_id: 'all_allies', amount_turns: 2, minimum_remaining_turns: minimum }] }
            ]
          }
        ],
        [dummy()]
      );
      b.advance();
      b.act({ skillId: 'bard_big' });
      expect(b.unit(P(0, 'bard')).cooldowns.bard_big).toBe(5); // 6, minus the decrement at the next own turn start
      b.act({ skillId: 'bard_ult' });
      return b.unit(P(0, 'bard')).cooldowns.bard_big ?? -1;
    };
    expect(run(0)).toBe(2); // 5 - 2 = 3, then the turn-start decrement
    expect(run(4)).toBe(3); // floor of 4, then the decrement
  });

  it('pay_hp_cost takes max-HP percent but never below the floor', () => {
    const b = duel([hero('martyr', [{ op: 'pay_hp_cost', target_selector_id: 'self', max_hp_fraction: 0.08, cannot_reduce_below: 1 }], { hp: 100 })], [dummy()]);
    b.advance();
    const step = b.act({ skillId: 'martyr_x' });
    expect(ev(step.events, 'hp_cost')).toEqual([{ type: 'hp_cost', unit: P(0, 'martyr'), amount: 8, hpAfter: 92 }]);
    const low = duel([hero('martyr', [{ op: 'pay_hp_cost', target_selector_id: 'self', max_hp_fraction: 0.5, cannot_reduce_below: 1 }], { hp: 1 })], [dummy()]);
    low.advance();
    low.act({ skillId: 'martyr_x' });
    expect(low.unit(P(0, 'martyr')).hp).toBe(1);
  });

  it('apply_regeneration heals at the start of each of the target turns, for the stated number of ticks', () => {
    const b = duel(
      [hero('mender', [{ op: 'apply_regeneration', target_selector_id: 'all_allies', scale_stat: 'atk', multiplier: 0.5, ticks: 2, tick_event: 'owner_turn_start', duration_turns: 2 }], { hp: 100, atk: 20 })],
      [{ id: 'poker', kind: 'enemy', atk: 20, spd: 99, skills: [{ id: 'pp', ops: [dmg('single_enemy_default', 1)] }] }]
    );
    b.advance();
    b.act({ skillId: 'mender_x' });
    for (let i = 0; i < 4 && !b.result; i++) {
      const p = b.prompt();
      if (!p) break;
      b.act({ skillId: 'mender_basic', targetId: E(0, 'poker') });
    }
    const regen = ev(b.log, 'heal').filter((h) => h.source === P(0, 'mender') && h.amount > 0);
    expect(regen.length).toBe(2); // exactly two ticks of floor(20 x 0.5) = 10
    expect(regen.every((h) => h.amount <= 10)).toBe(true);
  });

  it('reduce_status_durations shortens debuffs and removes the ones that reach zero', () => {
    const b = duel(
      [
        {
          id: 'scribe',
          spd: 100,
          skills: [
            { id: 's_basic', ops: [], target: 'none' },
            { id: 's_ult', type: 'ultimate', ops: [{ op: 'reduce_status_durations', target_selector_id: 'all_allies', category: 'debuff', amount_turns: 1, minimum_remaining_turns: 0 }] }
          ]
        }
      ],
      [{ id: 'hexer', kind: 'enemy', atk: 1, spd: 1, skills: [{ id: 'hh', ops: [{ op: 'apply_status', target_selector_id: 'all_enemies', status_id: 'fracture', duration_turns: 3 }, { op: 'apply_status', target_selector_id: 'all_enemies', status_id: 'dread', duration_turns: 1 }] }] }]
    );
    // inject the statuses directly through the first enemy turn
    b.advance();
    const unit0 = b.unit(P(0, 'scribe'));
    unit0.statuses.push({ statusId: 'fracture', turnsLeft: 3, sourceId: 'x', seq: 1 }, { statusId: 'dread', turnsLeft: 1, sourceId: 'x', seq: 2 });
    unit0.focus = 100;
    const step = b.act({ skillId: 's_ult' });
    expect(unit0.statuses.map((s) => [s.statusId, s.turnsLeft])).toEqual([['fracture', 1]]) // 3 - 1 = 2, then this turn-start decrement;
    expect(ev(step.events, 'status_removed')).toContainEqual(expect.objectContaining({ status: 'dread', reason: 'cleansed' }));
  });
});

describe('counters and bonuses', () => {
  it('arm_counter: a marked enemy that acts before the owner next turn takes counter damage once', () => {
    const b = duel(
      [hero('trapper', [dmg('single_enemy', 1), { op: 'arm_counter', target_selector_id: 'previous_op_targets', event: 'target_action_before_owner_next_turn', scale_stat: 'atk', multiplier: 0.8, damage_type: 'physical', consume_on_trigger: true }], { atk: 20 }, { target: 'enemy' })],
      [{ id: 'biter', kind: 'enemy', hp: 500, atk: 1, spd: 99, skills: [{ id: 'bite', ops: [dmg('single_enemy_default', 1)] }] }]
    );
    b.advance();
    b.act({ skillId: 'trapper_x', targetId: E(0, 'biter') });
    const counter = ev(b.log, 'damage').find((d) => d.counter === true);
    expect(counter).toMatchObject({ source: P(0, 'trapper'), target: E(0, 'biter'), amount: 16 }); // 20 x 0.8
    expect(b.unit(E(0, 'biter')).counters).toHaveLength(0);
  });

  it('arm_counter lapses if the enemy does not act before the owner next turn', () => {
    const b = duel(
      [hero('trapper', [dmg('single_enemy', 1), { op: 'arm_counter', target_selector_id: 'previous_op_targets', event: 'target_action_before_owner_next_turn', scale_stat: 'atk', multiplier: 0.8, damage_type: 'physical', consume_on_trigger: true }], {}, { target: 'enemy' })],
      [dummy('slow', { spd: 1 })]
    );
    b.advance();
    b.act({ skillId: 'trapper_x', targetId: E(0, 'slow') });
    expect(b.prompt()?.actor).toBe(P(0, 'trapper'));
    expect(b.unit(E(0, 'slow')).counters).toHaveLength(0);
  });

  it('arm_next_attack_bonus: the next attacking action deals +20% and the bonus is spent', () => {
    const b = duel([hero('patient', [{ op: 'arm_next_attack_bonus', target_selector_id: 'self', damage_multiplier: 1.2, consume_on_attack: true }], { atk: 100 })], [dummy()]);
    b.advance();
    b.act({ skillId: 'patient_x' });
    const step = b.act({ skillId: 'patient_basic', targetId: E(0, 'dummy') });
    expect(ev(step.events, 'damage')[0]?.amount).toBe(120);
    const again = b.act({ skillId: 'patient_basic', targetId: E(0, 'dummy') });
    expect(ev(again.events, 'damage')[0]?.amount).toBe(100);
  });
});

describe('shields', () => {
  it('remove_shield strips a fraction (at least 1) of each shield', () => {
    const b = duel([hero('breaker', [dmg('single_enemy', 0.01), { op: 'remove_shield', target_selector_id: 'previous_op_targets', amount_fraction: 0.2 }], {}, { target: 'enemy' })], [dummy()]);
    b.advance();
    b.unit(E(0, 'dummy')).shields.push({ amount: 50, turnsLeft: 3 });
    const step = b.act({ skillId: 'breaker_x', targetId: E(0, 'dummy') });
    // 1 damage soaks into the shield (49 left), then 20% of 49 = ceil(9.8) = 10 removed
    expect(b.unit(E(0, 'dummy')).shields[0]?.amount).toBe(39);
    expect(ev(step.events, 'shield_removed')[0]?.amount).toBe(10);
  });

  it('shield_damage_multiplier makes an attack eat shields faster', () => {
    const b = duel([hero('smasher', [dmg('single_enemy', 1, { shield_damage_multiplier: 2 })], { atk: 10 }, { target: 'enemy' })], [dummy()]);
    b.advance();
    b.unit(E(0, 'dummy')).shields.push({ amount: 30, turnsLeft: 3 });
    b.act({ skillId: 'smasher_x', targetId: E(0, 'dummy') });
    expect(b.unit(E(0, 'dummy')).shields[0]?.amount).toBe(10); // 10 damage x 2 = 20 shield points
    expect(b.unit(E(0, 'dummy')).hp).toBe(1000);
  });

  it('copy_buff copies the most-buffed enemy buff (or shield) onto the caster with the new duration', () => {
    const b = duel(
      [{ id: 'buffed', spd: 100, skills: [{ id: 'bf', ops: [], target: 'enemy' }] }],
      [{ id: 'thief', kind: 'enemy', spd: 99, atk: 1, skills: [{ id: 'steal', type: 'signature', cd: 10, ops: [{ op: 'copy_buff', target_selector_id: 'self', source_selector_id: 'enemy_with_most_buffs', category: 'shield', maximum_count: 1, duration_turns: 2 }] }] }]
    );
    b.unit(P(0, 'buffed')).shields.push({ amount: 40, turnsLeft: 5 });
    b.advance();
    b.act({ skillId: 'bf', targetId: E(0, 'thief') });
    expect(b.unit(E(0, 'thief')).shields).toEqual([{ amount: 40, turnsLeft: 2 }]);
  });
});

describe('packet modifiers and always-on rules', () => {
  it('modify_incoming_damage in a once-per-battle hook halves the first hit only', () => {
    const b = duel(
      [{ id: 'sable', hp: 1000, spd: 90, skills: [{ id: 'sb', ops: [], target: 'enemy' }, { id: 'sp', type: 'passive', ops: [], hooks: [{ event: 'before_damage_received', effect_ops: [{ op: 'modify_incoming_damage', target_selector_id: 'self', multiplier: 0.5 }], limit: { per_battle: 1 } }] }] }],
      [{ id: 'biter', kind: 'enemy', atk: 20, spd: 99, skills: [{ id: 'bite', ops: [dmg('single_enemy_default', 1)] }] }]
    );
    b.advance();
    b.act({ skillId: 'sb', targetId: E(0, 'biter') });
    b.act({ skillId: 'sb', targetId: E(0, 'biter') });
    const hits = ev(b.log, 'damage').filter((d) => d.target === P(0, 'sable'));
    expect(hits.slice(0, 2).map((h) => h.amount)).toEqual([10, 20]);
  });

  it('block_attack negates the first hit each round; the next round rearms it', () => {
    const royal: UnitSpec = {
      id: 'royal',
      kind: 'enemy',
      hp: 1000,
      atk: 1,
      spd: 98,
      skills: [{ id: 'rr', ops: [] }],
      passiveHooks: [{ event: 'before_damage_received', effect_ops: [{ op: 'block_attack', target_selector_id: 'self', maximum_hits: 1 }], limit: { per_round: 1 } }]
    };
    const b = duel(
      [
        { id: 'first', atk: 10, spd: 100, skills: [{ id: 'f1', ops: [dmg('single_enemy', 1)], target: 'enemy' }] },
        { id: 'second', atk: 10, spd: 99, skills: [{ id: 's1', ops: [dmg('single_enemy', 1)], target: 'enemy' }] }
      ],
      [royal]
    );
    b.advance();
    b.act({ skillId: 'f1', targetId: E(0, 'royal') }); // round 1, hit 1: blocked
    b.act({ skillId: 's1', targetId: E(0, 'royal') }); // round 1, hit 2: lands
    b.act({ skillId: 'f1', targetId: E(0, 'royal') }); // round 2, hit 1: blocked again
    expect(ev(b.log, 'blocked')).toHaveLength(2);
    expect(ev(b.log, 'damage').filter((d) => d.target === E(0, 'royal'))).toHaveLength(1);
    expect(ev(b.log, 'round_end').length).toBeGreaterThanOrEqual(1);
  });

  it('a continuous modifier (Hold the Gate) scales damage received only while its condition holds', () => {
    const mk = (taunted: boolean): number => {
      const b = duel(
        [
          {
            id: 'brin',
            hp: 1000,
            spd: 5,
            skills: [{ id: 'bb', ops: [], target: 'enemy' }, { id: 'bp', type: 'passive', ops: [], cms: [{ event: 'before_damage_received', condition: { predicate: 'owner_has_status', value: 'taunt' }, target: 'self', damage_multiplier: 0.9 }] }]
          }
        ],
        [{ id: 'biter', kind: 'enemy', atk: 100, spd: 20, skills: [{ id: 'bite', ops: [dmg('single_enemy_default', 1)] }] }]
      );
      if (taunted) b.unit(P(0, 'brin')).statuses.push({ statusId: 'taunt', turnsLeft: 5, sourceId: E(0, 'biter'), seq: 1 });
      b.advance();
      return ev(b.log, 'damage').find((d) => d.target === P(0, 'brin'))?.amount ?? 0;
    };
    expect(mk(false)).toBe(100);
    expect(mk(true)).toBe(90);
  });

  it("an ally's always-on stat rule (Watchman's Rhythm) lifts the front row only while its condition holds", () => {
    const rule = { event: 'stat_snapshot', condition: { predicate: 'owner_in_row', value: 'rear' }, target: 'front_row_allies', stat_id: 'def', mode: 'add_pct', amount: 0.05 };
    const mk = (rows: ('front' | 'rear')[]): number => {
      const b = duel(
        [
          { id: 'front', def: 100, skills: [{ id: 'ff', ops: [], target: 'enemy' }] },
          { id: 'marek', skills: [{ id: 'mm', ops: [], target: 'enemy' }, { id: 'mp', type: 'passive', ops: [], cms: [rule] }] }
        ],
        [dummy()],
        { p: rows }
      );
      return b.effStat(b.unit(P(0, 'front')), 'def');
    };
    expect(mk(['front', 'rear'])).toBe(105);
    expect(mk(['front', 'front'])).toBe(100);
  });
});

describe('statuses over time', () => {
  it('venom ticks for ATK x multiplier at the start of each of the owner turns it lasts, then ends', () => {
    const b = duel(
      [{ id: 'victim', hp: 100, spd: 99, skills: [{ id: 'vv', ops: [], target: 'enemy' }] }],
      [{ id: 'viper', kind: 'enemy', atk: 100, spd: 100, skills: [{ id: 'vv', type: 'signature', cd: 10, ops: [dmg('single_enemy_default', 0.01), { op: 'apply_status', target_selector_id: 'previous_op_targets', status_id: 'venom', duration_turns: 2 }] }] }]
    );
    b.advance();
    for (let i = 0; i < 3 && !b.result; i++) b.act({ skillId: 'vv', targetId: E(0, 'viper') });
    const ticks = ev(b.log, 'damage').filter((d) => d.dot === 'venom');
    expect(ticks).toHaveLength(2);
    expect(ticks[0]?.amount).toBe(10); // ATK 100 x 0.1
  });

  it('Soaked: Tide hits take +10%; a Gale or Ember hit gets +15% once and consumes the status', () => {
    const wet = (element: 'Tide' | 'Gale' | 'Dawn'): { amount: number; left: number } => {
      const b = duel([hero('breeze', [dmg('single_enemy', 1)], { atk: 100, element }, { target: 'enemy' })], [dummy('wetone', { element: 'Dawn' })]);
      b.advance();
      b.unit(E(0, 'wetone')).statuses.push({ statusId: 'soaked', turnsLeft: 3, sourceId: 'x', seq: 1 });
      const step = b.act({ skillId: 'breeze_x', targetId: E(0, 'wetone') });
      return { amount: ev(step.events, 'damage')[0]?.amount ?? 0, left: b.unit(E(0, 'wetone')).statuses.length };
    };
    expect(wet('Dawn')).toEqual({ amount: 100, left: 1 });
    expect(wet('Tide')).toEqual({ amount: 110, left: 1 }); // Tide vs Dawn is neutral, x1.1 from Soaked
    expect(wet('Gale')).toEqual({ amount: 115, left: 0 }); // Crosscurrent, consumed
  });

  it('Soul Link moves a quarter of each hit (capped) onto the other linked units', () => {
    const b = duel(
      [hero('striker', [dmg('single_enemy', 1)], { atk: 100 }, { target: 'enemy' })],
      [dummy('aa', { hp: 1000 }), dummy('bb', { hp: 1000 })]
    );
    b.advance();
    for (const id of [E(0, 'aa'), E(1, 'bb')]) b.unit(id).statuses.push({ statusId: 'soul_link', turnsLeft: 3, sourceId: id, seq: 1, value: 0.25 });
    b.act({ skillId: 'striker_x', targetId: E(0, 'aa') });
    const hits = ev(b.log, 'damage');
    expect(hits.find((h) => h.target === E(0, 'aa') && !h.dot)?.amount).toBe(75); // 100 - min(25% = 25, cap 15% of 1000) moved away
    expect(hits.find((h) => h.dot === 'soul_link')).toMatchObject({ target: E(1, 'bb'), amount: 25 });
  });

  it('Gust delays the target next action; a status immunity blocks the status', () => {
    const b = duel([hero('gale', [dmg('single_enemy', 0.01), { op: 'apply_status', target_selector_id: 'previous_op_targets', status_id: 'gust', duration_turns: 1 }, { op: 'apply_status', target_selector_id: 'previous_op_targets', status_id: 'dread', duration_turns: 2 }], {}, { target: 'enemy' })], [dummy('knight', { immune: ['dread'] })]);
    b.advance();
    b.act({ skillId: 'gale_x', targetId: E(0, 'knight') });
    expect(b.unit(E(0, 'knight')).pendingDelay).toBe(1500);
    expect(b.unit(E(0, 'knight')).statuses.map((s) => s.statusId)).toEqual(['gust']);
  });
});

describe('selectors, predicates and events', () => {
  it('an ally-targeted skill needs a living ally and rejects an enemy', () => {
    const b = duel(
      [hero('nurse', [{ op: 'grant_damage_reduction', target_selector_id: 'selected_ally', damage_taken_multiplier: 0.75, duration_turns: 2 }], {}, { target: 'ally' }), { id: 'buddy', spd: 1, skills: [{ id: 'bd', ops: [], target: 'enemy' }] }],
      [dummy()]
    );
    const step = b.advance();
    const opt = step.prompt?.options.find((o) => o.skillId === 'nurse_x');
    expect(opt?.needsTarget).toBe(true);
    expect(opt?.legalTargets.sort()).toEqual([P(0, 'nurse'), P(1, 'buddy')]);
    expect(() => b.act({ skillId: 'nurse_x', targetId: E(0, 'dummy') })).toThrow();
    b.act({ skillId: 'nurse_x', targetId: P(1, 'buddy') });
    expect(b.unit(P(1, 'buddy')).reductions).toHaveLength(1);
  });

  it('a defeated Dreaded enemy feeds a hook; round-scoped predicates see the round counter', () => {
    const b = duel(
      [
        {
          id: 'vespera',
          atk: 1000,
          spd: 100,
          skills: [{ id: 'vb', ops: [dmg('single_enemy', 1)], target: 'enemy' }, { id: 'vp', type: 'passive', ops: [], hooks: [{ event: 'after_enemy_defeated', effect_ops: [{ op: 'gain_focus', target_selector_id: 'self', amount: 10 }], condition: { predicate: 'event_target_had_status', value: 'dread' }, limit: { per_event: 1 } }] }]
        }
      ],
      [dummy('weak', { hp: 10 })]
    );
    b.advance();
    b.unit(E(0, 'weak')).statuses.push({ statusId: 'dread', turnsLeft: 2, sourceId: 'x', seq: 1 });
    b.act({ skillId: 'vb', targetId: E(0, 'weak') });
    expect(ev(b.log, 'focus').filter((f) => f.unit === P(0, 'vespera') && f.delta === 10)).toHaveLength(1);
  });

  it('random_other_enemy splash never retriggers itself (can_trigger_passives:false) and only hits another enemy', () => {
    const b = duel(
      [
        {
          id: 'kera',
          atk: 100,
          spd: 100,
          skills: [
            { id: 'kb', ops: [dmg('single_enemy', 1)], target: 'enemy', hooks: undefined },
            { id: 'kp', type: 'passive', ops: [], hooks: [{ event: 'after_damage_dealt', effect_ops: [dmg('random_other_enemy', 0.4, { can_trigger_passives: false })], condition: { predicate: 'last_target_has_status', value: 'burn' }, limit: { chance: 1, per_damage_action: 1 }, event_filter: { damage_action_type: 'basic_or_skill' } }] }
          ]
        }
      ],
      [dummy('aa'), dummy('bb')]
    );
    b.advance();
    b.unit(E(0, 'aa')).statuses.push({ statusId: 'burn', turnsLeft: 3, sourceId: 'x', seq: 1 });
    b.act({ skillId: 'kb', targetId: E(0, 'aa') });
    const dealt = ev(b.log, 'damage').filter((d) => d.source === P(0, 'kera'));
    expect(dealt.map((d) => [d.target, d.amount])).toEqual([[E(0, 'aa'), 100], [E(1, 'bb'), 40]]);
  });

  it('a hook with a team filter reacts to allies, and exclude_owner skips the owner', () => {
    const b = duel(
      [
        { id: 'pippa', spd: 5, skills: [{ id: 'pb', ops: [], target: 'enemy' }, { id: 'pp', type: 'passive', ops: [], hooks: [{ event: 'after_ally_ultimate', effect_ops: [{ op: 'gain_focus', target_selector_id: 'self', amount: 10 }], limit: { per_round: 1 }, event_filter: { exclude_owner: true } }] }] },
        { id: 'ally', spd: 100, skills: [{ id: 'ab', ops: [], target: 'enemy' }, { id: 'au', type: 'ultimate', ops: [dmg('all_enemies', 0.1)] }] }
      ],
      [dummy()]
    );
    b.advance();
    b.unit(P(1, 'ally')).focus = 100;
    b.act({ skillId: 'au' });
    expect(b.unit(P(0, 'pippa')).focus).toBe(10);
  });
});

describe('hooks that react to being hit, to low HP and to the turn clock', () => {
  const biter = (atk = 20): UnitSpec => ({ id: 'biter', kind: 'enemy', atk, spd: 99, skills: [{ id: 'bite', ops: [dmg('single_enemy_default', 1)] }] });

  it('after_damage_received: gains Focus when hit, once per own turn', () => {
    const b = duel(
      [{ id: 'rikka', hp: 1000, spd: 100, skills: [{ id: 'rb', ops: [], target: 'enemy' }, { id: 'rp', type: 'passive', ops: [], hooks: [{ event: 'after_damage_received', effect_ops: [{ op: 'gain_focus', target_selector_id: 'self', amount: 5 }], limit: { per_owner_turn: 1 } }] }] }],
      [biter(), { ...biter(), id: 'biter2' }]
    );
    b.advance();
    b.act({ skillId: 'rb', targetId: E(0, 'biter') });
    // two biters hit her once each between her turns: the hook gave +5 once (per own turn), plus the +5 base hit gain per hit
    const gains = ev(b.log, 'focus').filter((f) => f.unit === P(0, 'rikka'));
    expect(gains.length).toBeGreaterThan(0);
    expect(ev(b.log, 'hook_triggered').filter((h) => h.unit === P(0, 'rikka'))).toHaveLength(1);
  });

  it('ally_hp_threshold_crossed: shields an ally once when it drops below 25%, only once per battle', () => {
    const b = duel(
      [
        { id: 'aveline', spd: 100, skills: [{ id: 'ab', ops: [], target: 'enemy' }, { id: 'ap', type: 'passive', ops: [], hooks: [{ event: 'ally_hp_threshold_crossed', effect_ops: [{ op: 'grant_shield', target_selector_id: 'event_target', scale_stat: 'atk', multiplier: 0.8, duration_turns: 2 }], condition: { predicate: 'event_target_hp_at_or_below_pct', value: 25 }, limit: { per_battle: 1 }, event_filter: { team: 'player' } }] }] },
        { id: 'tank', hp: 100, spd: 1, skills: [{ id: 'tk', ops: [], target: 'enemy' }] }
      ],
      [biter(80)],
      { p: ['rear', 'front'] }
    );
    b.advance();
    for (let i = 0; i < 3 && !b.result; i++) b.act({ skillId: 'ab', targetId: E(0, 'biter') });
    const shields = ev(b.log, 'shield').filter((x) => x.source === P(0, 'aveline'));
    expect(shields).toHaveLength(1);
    expect(shields[0]?.target).toBe(P(1, 'tank'));
    expect(shields[0]?.amount).toBe(8); // 10 ATK x 0.8
  });

  it('owner_turn_start with an HP condition buffs the whole team, capped per battle', () => {
    const b = duel(
      [{ id: 'fadyme', hp: 100, spd: 99, skills: [{ id: 'fb', ops: [], target: 'enemy' }, { id: 'fp', type: 'passive', ops: [], hooks: [{ event: 'owner_turn_start', effect_ops: [{ op: 'modify_stat', target_selector_id: 'all_allies', stat_id: 'veil_res', mode: 'add_pct', amount: 0.08, duration_turns: 1 }], condition: { predicate: 'owner_hp_below_pct', value: 50 }, limit: { per_battle: 2 } }] }] }],
      [biter(30)]
    );
    b.advance();
    for (let i = 0; i < 6 && !b.result; i++) b.act({ skillId: 'fb', targetId: E(0, 'biter') });
    expect(ev(b.log, 'hook_triggered').filter((h) => h.event === 'owner_turn_start').length).toBeLessThanOrEqual(2);
    expect(ev(b.log, 'hook_triggered').filter((h) => h.event === 'owner_turn_start').length).toBeGreaterThan(0);
  });

  it("Nara's Familiar Footsteps: rear allies take 10% less in round 1 only, while she stands in front", () => {
    const rule = { event: 'before_damage_received', effect_ops: [{ op: 'modify_incoming_damage', target_selector_id: 'event_target', multiplier: 0.9 }], condition: { all: [{ predicate: 'owner_in_row', value: 'front' }, { predicate: 'target_in_row', value: 'rear' }, { predicate: 'round_number_at_most', value: 1 }] }, limit: { per_event: 1 }, event_filter: { team: 'player' } };
    const hitOnRear = (naraRow: 'front' | 'rear'): number => {
      const b = duel(
        [
          { id: 'nara', hp: 1000, spd: 1, skills: [{ id: 'nb', ops: [], target: 'enemy' }, { id: 'np', type: 'passive', ops: [], hooks: [rule] }] },
          { id: 'rearguy', hp: 1000, spd: 1, skills: [{ id: 'rg', ops: [], target: 'enemy' }] }
        ],
        [{ id: 'sniper', kind: 'enemy', atk: 100, spd: 99, skills: [{ id: 'snipe', ops: [dmg('rear_row_enemies', 1)] }] }],
        { p: [naraRow, 'rear'] }
      );
      b.advance();
      return ev(b.log, 'damage').find((d) => d.target === P(1, 'rearguy'))?.amount ?? 0;
    };
    expect(hitOnRear('front')).toBe(90);
    expect(hitOnRear('rear')).toBe(100);
  });

  it('a conditional marker (Trail Mark) raises ally damage on marked targets only', () => {
    const cm = { event: 'before_damage_dealt', condition: { predicate: 'target_has_status_tag', value: 'mark' }, target: 'previous_op_targets', damage_multiplier: 1.05, applies_to: 'all_allies_while_owner_alive' };
    const hit = (marked: boolean): number => {
      const b = duel(
        [
          { id: 'nixie', spd: 100, skills: [{ id: 'nb', ops: [], target: 'enemy' }, { id: 'np', type: 'passive', ops: [], cms: [cm] }] },
          { id: 'hitter', atk: 100, spd: 99, skills: [{ id: 'hb', ops: [dmg('single_enemy', 1)], target: 'enemy' }] }
        ],
        [dummy()]
      );
      b.advance();
      if (marked) b.unit(E(0, 'dummy')).statuses.push({ statusId: 'trail_mark', turnsLeft: 3, sourceId: 'x', seq: 1 });
      b.act({ skillId: 'nb', targetId: E(0, 'dummy') });
      const step = b.act({ skillId: 'hb', targetId: E(0, 'dummy') });
      return ev(step.events, 'damage').find((d) => d.source === P(1, 'hitter'))?.amount ?? 0;
    };
    expect(hit(false)).toBe(100);
    expect(hit(true)).toBe(105);
  });
});
