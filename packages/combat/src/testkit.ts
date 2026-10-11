import { Encounter, type BattleParty, SkillDef, UnitDef, UnitPack, type EffectOp, type EventHook, type ContinuousModifier } from '@uomd/content-schema';
import { buildRules } from '../../../tools/lib/data';
import { Battle, type BattleEvent } from './index';

/** Test kit for synthetic battles: every unit is Dawn with DEF 0, so damage = floor(ATK x multiplier) and every number below is hand-checkable. */
export const RULES = (() => {
  const r = buildRules();
  return { ...r, crit: { chance: 0, multiplier: 1.5 } };
})();

export type Ops = Record<string, unknown>[];
export interface SkillSpec {
  id: string;
  type?: 'basic' | 'active' | 'ultimate' | 'signature' | 'passive';
  ops?: Ops;
  target?: 'enemy' | 'ally' | 'none';
  cd?: number;
  focus?: number;
  hooks?: unknown[];
  cms?: unknown[];
  telegraph?: unknown;
  phases?: string[];
}
export const skill = (s: SkillSpec) =>
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
    ...(s.cms ? { continuous_modifiers: s.cms as ContinuousModifier[] } : {}),
    ...(s.telegraph ? { telegraph: s.telegraph } : {}),
    ...(s.phases ? { phase_ids: s.phases } : {})
  });
export interface UnitSpec {
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
  boss?: unknown;
}
export const unit = (u: UnitSpec) =>
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
    ...(u.passiveHooks ? { passive_hooks: u.passiveHooks as EventHook[] } : {}),
    ...(u.boss ? { boss: u.boss } : {})
  });

export function duel(players: UnitSpec[], enemies: UnitSpec[], rows: { p?: ('front' | 'rear')[]; e?: ('front' | 'rear')[] } = {}, opts: { party?: BattleParty; tuning?: Encounter['enemy_stat_multiplier'] } = {}): Battle {
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
    ...(opts.tuning ? { enemy_stat_multiplier: opts.tuning } : {}),
    provenance: { source: 'test' }
  });
  return Battle.create(pack, enc, opts.party);
}
export const P = (i: number, id: string) => `player:${i}:${id}`;
export const E = (i: number, id: string) => `enemy:${i}:${id}`;
export const ev = <T extends BattleEvent['type']>(log: BattleEvent[], type: T): Extract<BattleEvent, { type: T }>[] =>
  log.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

/** an enemy that never acts usefully: absorbs hits, deals nothing */
export const dummy = (id = 'dummy', over: Partial<UnitSpec> = {}): UnitSpec => ({ id, kind: 'enemy', hp: 1000, atk: 1, spd: 1, skills: [{ id: `${id}_idle`, ops: [] }], ...over });
/** a hero whose only meaningful skill is the one under test */
export const hero = (id: string, ops: Ops, over: Partial<UnitSpec> = {}, extra: Partial<SkillSpec> = {}): UnitSpec => ({
  id,
  spd: 100,
  skills: [{ id: `${id}_basic`, ops: [{ op: 'damage', target_selector_id: 'single_enemy', damage_type: 'physical', scale_stat: 'atk', multiplier: 1 }], target: 'enemy' }, { id: `${id}_x`, type: 'active', ops, ...extra }],
  ...over
});
export const dmg = (target_selector_id: string, multiplier = 1, more: Record<string, unknown> = {}): Record<string, unknown> => ({
  op: 'damage',
  target_selector_id,
  damage_type: 'physical',
  scale_stat: 'atk',
  multiplier,
  ...more
});

