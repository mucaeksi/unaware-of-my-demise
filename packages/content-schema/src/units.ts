import { z } from 'zod';
import { Element, Id, SafeAssetPath } from './primitives';
import { EffectOp, EventHook } from './effects';

export const SkillType = z.enum(['basic', 'active', 'passive', 'ultimate', 'signature']);
export type SkillType = z.infer<typeof SkillType>;

export const SkillDef = z
  .object({
    skill_id: Id,
    name_en: z.string().min(1).max(60),
    type: SkillType,
    /** Overrides the unit element for this skill's damage; absent = the unit's own element. */
    element: Element.optional(),
    description_en: z.string().max(400),
    /** Who the player must pick: a single enemy, or nothing (the effect selectors resolve the rest). */
    player_target: z.enum(['enemy', 'none']),
    cooldown_turns: z.number().int().min(0).max(10),
    focus_cost: z.number().int().min(0).max(100),
    /** Higher = preferred by enemy AI / Auto Battle when several skills are ready. */
    ai_priority: z.number().int().min(0).max(100),
    effect_ops: z.array(EffectOp).max(8),
    event_hooks: z.array(EventHook).max(4).optional(),
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

export const UnitDef = z
  .object({
    unit_id: Id,
    kind: z.enum(['character', 'enemy']),
    name_en: z.string().min(1).max(60),
    element: Element,
    role: z.string().max(40),
    rarity: z.number().int().min(1).max(5).optional(),
    formation_affinity: z.enum(['front', 'rear']).optional(),
    base_stats: Stats,
    growth_per_level: Growth.optional(),
    weaknesses: z.array(Element).optional(),
    resistances: z.array(Element).optional(),
    skills: z.array(SkillDef).min(1).max(8),
    /** Enemy intent shown to the player before the action resolves. */
    intent_skill_id: Id.optional(),
    /** Key into the art manifest. */
    art_key: Id,
    provenance: z.object({ source: z.string(), source_sha256: z.string().optional() }).strict()
  })
  .strict();
export type UnitDef = z.infer<typeof UnitDef>;

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
    redirects_single_target_attacks: z.boolean().optional()
  })
  .strict();
export type StatusDef = z.infer<typeof StatusDef>;

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
