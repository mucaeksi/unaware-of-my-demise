import { z } from 'zod';
import { AttributeBlock, attributesAt, deriveStats } from '@uomd/economy';
import { Element, Id, SafeAssetPath } from './primitives';
import { ContinuousModifier, EffectOp, EventHook } from './effects';

export const SkillType = z.enum(['basic', 'active', 'passive', 'ultimate', 'signature']);
export type SkillType = z.infer<typeof SkillType>;

/** A telegraphed action: announced on the boss's turn, resolved on its next one unless interrupted. */
export const Telegraph = z
  .object({
    player_actions_before_resolution: z.number().int().min(0).max(3),
    interruptible_by_control: z.boolean().optional(),
    interrupt_if_objective_destroyed: Id.optional(),
    interrupt_if_all_objectives_destroyed: z.array(Id).min(1).max(6).optional(),
    remove_copied_shields_if_objective_destroyed: Id.optional()
  })
  .strict();
export type Telegraph = z.infer<typeof Telegraph>;

export const SkillDef = z
  .object({
    skill_id: Id,
    name_en: z.string().min(1).max(60),
    type: SkillType,
    /** Overrides the unit element for this skill's damage; absent = the unit's own element. */
    element: Element.optional(),
    description_en: z.string().max(400),
    /** Who the player must pick: a single enemy, a single ally, or nothing (the effect selectors resolve the rest). */
    player_target: z.enum(['enemy', 'ally', 'none']),
    cooldown_turns: z.number().int().min(0).max(10),
    focus_cost: z.number().int().min(0).max(100),
    /** Higher = preferred by enemy AI / Auto Battle when several skills are ready. */
    ai_priority: z.number().int().min(0).max(100),
    effect_ops: z.array(EffectOp).max(8),
    event_hooks: z.array(EventHook).max(4).optional(),
    continuous_modifiers: z.array(ContinuousModifier).max(4).optional(),
    /** Boss skills: only usable in these phases (absent = every phase). */
    phase_ids: z.array(Id).max(4).optional(),
    telegraph: Telegraph.optional(),
    icon: z.string().max(80).optional()
  })
  .strict();
export type SkillDef = z.infer<typeof SkillDef>;

export const Stats = z
  .object({
    hp: z.number().positive(),
    atk: z.number().nonnegative(),
    def: z.number().nonnegative(),
    spd: z.number().positive(),
    res: z.number().nonnegative().optional()
  })
  .strict();
export type Stats = z.infer<typeof Stats>;

export const Growth = z
  .object({ hp: z.number().nonnegative(), atk: z.number().nonnegative(), def: z.number().nonnegative(), spd: z.number().nonnegative(), res: z.number().nonnegative() })
  .partial()
  .strict();

/** A breakable thing on the boss side (Jaw Bell, Wax Seal ...). Every damaging hit aimed at it removes one point. */
export const BossObjective = z
  .object({
    objective_id: Id,
    name_en: z.string().min(1).max(60),
    max_hp: z.number().int().min(1).max(12),
    targetable_by_player: z.boolean(),
    /** stays when the next phase begins (default: removed with its phase) */
    persists_across_phases: z.boolean().optional(),
    on_destroyed: z.array(EffectOp).max(4).optional()
  })
  .strict();
export type BossObjective = z.infer<typeof BossObjective>;

export const BossPhase = z
  .object({
    phase_id: Id,
    name_en: z.string().min(1).max(60),
    /** battle_start = the first phase; at_hp_percent = begins when the previous phase bar falls to that fraction of itself */
    transition: z.enum(['battle_start', 'at_hp_percent']),
    transition_hp_percent: z.number().min(0.05).max(0.95).nullable(),
    /** fresh bar: max HP of this phase = level-scaled base HP x this */
    hp_multiplier: z.number().positive().max(5),
    atk_multiplier: z.number().positive().max(5),
    def_multiplier: z.number().positive().max(5),
    /** replaces the unit weaknesses while this phase lasts */
    weaknesses: z.array(Element).max(4),
    signature_action_id: Id.nullable(),
    tauntable: z.boolean(),
    objectives: z.array(BossObjective).max(4),
    enter_ops: z.array(EffectOp).max(4),
    passive_ops: z.array(EffectOp).max(4)
  })
  .strict();
export type BossPhase = z.infer<typeof BossPhase>;

export const BossDef = z
  .object({
    phases: z.array(BossPhase).min(1).max(4),
    /** status ids that survive a phase change (everything of `clear_status_category` is cleared except these) */
    preserve_status_ids: z.array(Id).max(4),
    clear_status_category: z.enum(['debuff']),
    /** control effects on the boss last this fraction of their base duration (minimum 1 turn) */
    control_duration_multiplier: z.number().min(0.1).max(1)
  })
  .strict();
export type BossDef = z.infer<typeof BossDef>;

export const UnitDef = z
  .object({
    unit_id: Id,
    kind: z.enum(['character', 'enemy']),
    name_en: z.string().min(1).max(60),
    element: Element,
    role: z.string().max(40),
    rarity: z.number().int().min(1).max(5).optional(),
    formation_affinity: z.enum(['front', 'rear']).optional(),
    /** legacy stat contract (content before D-27); new content uses `attributes` */
    base_stats: Stats.optional(),
    growth_per_level: Growth.optional(),
    /** STR / INT / VIT / AGI; the combat stats are derived from them (capability attributes_v1) */
    attributes: AttributeBlock.optional(),
    weaknesses: z.array(Element).optional(),
    resistances: z.array(Element).optional(),
    /** Fractional resistance [0, 1] reducing the probability of hostile status application. */
    effect_res: z.number().min(0).max(1).optional(),
    /** Per-element fractional damage resistance [-1, 1] (positive reduces incoming damage, negative increases it). */
    element_res: z.partialRecord(Element, z.number().min(-1).max(1)).optional(),
    skills: z.array(SkillDef).min(1).max(8),
    /** Hooks / always-on rules that belong to the unit rather than to one of its skills (enemy passives). */
    passive_hooks: z.array(EventHook).max(4).optional(),
    continuous_modifiers: z.array(ContinuousModifier).max(4).optional(),
    faction_id: Id.optional(),
    boss: BossDef.optional(),
    status_immunities: z.array(Id).max(8).optional(),
    /** Enemy intent shown to the player before the action resolves. */
    intent_skill_id: Id.optional(),
    /** Key into the art manifest. */
    art_key: Id,
    provenance: z.object({ source: z.string(), source_sha256: z.string().optional() }).strict()
  })
  .strict()
  .refine((u) => (u.base_stats === undefined) !== (u.attributes === undefined), { message: 'a unit has either base_stats (legacy) or attributes', path: ['attributes'] });
export type UnitDef = z.infer<typeof UnitDef>;

export interface UnitLevelStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** legacy magic defense; attribute units have none (DEF covers every damage type) */
  res: number | null;
  crit_rate?: number;
  crit_damage?: number;
  effect_hit?: number;
}

/** A unit's own stats at a level, without gear: derived from its attributes, or the legacy base + growth curve rounded half up. */
export function unitStatsAt(u: Pick<UnitDef, 'base_stats' | 'growth_per_level' | 'attributes'>, level: number): UnitLevelStats {
  if (u.attributes) {
    const d = deriveStats(u.attributes, attributesAt(u.attributes, level));
    return { ...d, res: null };
  }
  const base = u.base_stats!;
  // the engine's half-up rounding (with its epsilon), so legacy battles replay unchanged
  const grow = (k: 'hp' | 'atk' | 'def' | 'spd' | 'res', v: number): number => Math.floor(v + (u.growth_per_level?.[k] ?? 0) * (level - 1) + 0.5 + 1e-9);
  return {
    hp: Math.max(1, grow('hp', base.hp)),
    atk: grow('atk', base.atk),
    def: Math.max(0, grow('def', base.def)),
    spd: Math.max(1, grow('spd', base.spd)),
    res: base.res === undefined ? null : Math.max(0, grow('res', base.res))
  };
}

export const StatusDef = z
  .object({
    status_id: Id,
    name_en: z.string(),
    kind: z.string(),
    category: z.enum(['buff', 'debuff', 'control', 'mark']),
    default_duration_turns: z.number().int().min(1),
    outgoing_damage_multiplier: z.number().positive().optional(),
    damage_taken_multiplier: z.number().positive().optional(),
    healing_received_multiplier: z.number().positive().optional(),
    def_multiplier: z.number().positive().optional(),
    focus_gain_multiplier: z.number().positive().optional(),
    skip_next_action: z.boolean().optional(),
    redirects_single_target_attacks: z.boolean().optional(),
    res_multiplier: z.number().positive().optional(),
    tags: z.array(Id).max(6).optional(),
    /** Damage over time: source ATK x this, dealt at the owner's turn start (shields absorb, no focus, no hooks). */
    dot_atk_multiplier: z.number().positive().optional(),
    /** Per element, extra damage taken while the status lasts. */
    element_damage_taken_multiplier: z.partialRecord(Element, z.number().positive()).optional(),
    /** Hit by one of these elements: +bonus damage and (optionally) the status is consumed. */
    reactions: z.array(z.object({ element: Element, name_en: z.string(), bonus_damage_multiplier: z.number().min(0).max(1), consume_status: z.boolean() }).strict()).max(4).optional(),
    /** Applying it delays the target's next action by this fraction of the gauge. */
    next_action_gauge_delay_fraction: z.number().min(0).max(1).optional(),
    immune_status_ids: z.array(Id).max(4).optional(),
    /** soul_link: cap on the damage shared per hit, as a fraction of the damaged unit's max HP. */
    shared_damage_cap_fraction: z.number().min(0).max(1).optional()
  })
  .strict();
export type StatusDef = z.infer<typeof StatusDef>;

export const StoryLoanEquipment = z.object({
  template_id: Id, rarity: z.number().int().min(3).max(5), armor_id: Id,
  weapon_selection: z.literal('lowest_weapon_id_matching_character_equip_weapon_type'),
  accessory_set_id: Id, accessory_slots: z.array(z.enum(['necklace', 'ring'])).max(2).refine((slots) => new Set(slots).size === slots.length, 'duplicate accessory slot'),
  accessory_roll_seed: z.literal('crc32(character_id:stage_id:accessory_id)'),
  level: z.number().int().min(1).max(20).default(1), ascension: z.literal(0).default(0)
}).strict();
export type StoryLoanEquipment = z.infer<typeof StoryLoanEquipment>;

export const RulesDef = z
  .object({
    schema_version: z.literal(1),
    gauge_max: z.number().int().positive(),
    max_pending_delay_fraction: z.number().min(0).max(1),
    defense_scale: z.number().positive(),
    focus: z
      .object({
        maximum: z.number().int(),
        basic_gain: z.number().int(),
        active_gain: z.number().int(),
        hit_gain: z.number().int(),
        hit_gain_cap_per_turn: z.number().int(),
        ultimate_cost: z.number().int()
      })
      .strict(),
    crit: z.object({ chance: z.number().min(0).max(1), multiplier: z.number().min(1) }).strict(),
    element: z
      .object({
        cycle: z.array(Element).length(4),
        advantage: z.number(),
        disadvantage: z.number(),
        neutral: z.number(),
        weakness: z.number(),
        resistance: z.number(),
        mutual_pairs: z.array(z.tuple([Element, Element]))
      })
      .strict(),
    auto_battle: z.object({ heal_priority_hp_percent: z.number(), save_ultimate_until_boss: z.boolean() }).strict(),
    /** each skill rank above 1 multiplies the damage / heal / shield amounts of that skill by (1 + this x (rank - 1)) */
    skill_rank_bonus: z.number().min(0).max(1).optional(),
    story_loan_equipment: StoryLoanEquipment.optional(),
    statuses: z.array(StatusDef)
  })
  .strict();
export type RulesDef = z.infer<typeof RulesDef>;

export const UnitPack = z
  .object({
    schema_version: z.literal(1),
    pack_id: Id,
    units: z.array(UnitDef).min(1),
    rules: RulesDef
  })
  .strict();
export type UnitPack = z.infer<typeof UnitPack>;

export const PackRef = SafeAssetPath;
