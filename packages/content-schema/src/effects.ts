import { z } from 'zod';
import { Id } from './primitives';

/**
 * The effect grammar is a CLOSED set. Content may only select among operations that the shipped
 * combat engine implements; a patch that mentions any other "op" fails validation and is rejected
 * before download. Adding an op is therefore an engine (binary) change by design.
 */
export const TargetSelector = z.enum([
  'single_enemy',
  'single_enemy_default',
  'all_enemies',
  'front_row_enemies',
  'rear_row_enemies',
  'self',
  'lowest_hp_ally',
  'lowest_hp_allies',
  'self_and_lowest_hp_ally',
  'all_allies',
  'previous_op_targets',
  'event_source'
]);
export type TargetSelector = z.infer<typeof TargetSelector>;

export const DamageType = z.enum(['physical', 'magic', 'elemental']);
export const ScaleStat = z.enum(['atk', 'def', 'hp']);

export const Predicate = z.discriminatedUnion('predicate', [
  z.object({ predicate: z.literal('last_target_has_status'), value: Id }).strict(),
  z.object({ predicate: z.literal('owner_in_row'), value: z.enum(['front', 'rear']) }).strict(),
  z.object({ predicate: z.literal('owner_hp_below_pct'), value: z.number().min(0).max(100) }).strict(),
  z.object({ predicate: z.literal('owner_has_shield') }).strict()
]);
export type Predicate = z.infer<typeof Predicate>;

const base = { target_selector_id: TargetSelector, when: Predicate.optional() };

export const EffectOp = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('damage'),
      ...base,
      damage_type: DamageType,
      scale_stat: ScaleStat,
      multiplier: z.number().positive().max(20),
      no_focus_gain: z.boolean().optional()
    })
    .strict(),
  z
    .object({
      op: z.literal('heal'),
      ...base,
      scale_stat: ScaleStat,
      multiplier: z.number().positive().max(20)
    })
    .strict(),
  z
    .object({
      op: z.literal('apply_status'),
      ...base,
      status_id: Id,
      duration_turns: z.number().int().min(1).max(10),
      chance: z.number().min(0).max(1).optional()
    })
    .strict(),
  z
    .object({
      op: z.literal('remove_status'),
      ...base,
      category: z.enum(['debuff', 'buff']),
      count: z.number().int().min(1).max(5),
      selection: z.enum(['oldest_applied'])
    })
    .strict(),
  z
    .object({
      op: z.literal('grant_shield'),
      ...base,
      scale_stat: ScaleStat,
      multiplier: z.number().positive().max(20),
      duration_turns: z.number().int().min(1).max(10),
      shield_source_id: Id.optional()
    })
    .strict(),
  z
    .object({
      op: z.literal('grant_redirect'),
      ...base,
      protected_ally_selector_id: TargetSelector,
      redirected_fraction: z.number().min(0).max(1),
      duration_turns: z.number().int().min(1).max(10),
      eligible_action_types: z.array(z.enum(['basic', 'active', 'ultimate', 'signature'])).min(1)
    })
    .strict(),
  z
    .object({
      op: z.literal('gain_focus'),
      ...base,
      amount: z.number().int().min(1).max(100)
    })
    .strict(),
  z
    .object({
      op: z.literal('modify_stat'),
      ...base,
      stat_id: z.enum(['atk', 'def', 'spd', 'veil_res', 'res']),
      mode: z.enum(['add_pct', 'add_flat']),
      amount: z.number().min(-1).max(10),
      duration_turns: z.number().int().min(1).max(10)
    })
    .strict(),
  z
    .object({
      op: z.literal('heal_per_removed_status'),
      ...base,
      scale_stat: ScaleStat,
      multiplier: z.number().positive().max(20),
      maximum_targets: z.number().int().min(1).max(5),
      maximum_total_stacks: z.number().int().min(1).max(10),
      requires_successful_cleanse: z.boolean()
    })
    .strict()
]);
export type EffectOp = z.infer<typeof EffectOp>;

export const IMPLEMENTED_OPS = EffectOp.options.map((o) => o.shape.op.value);

export const HookEvent = z.enum(['owner_turn_start', 'before_damage_received']);

export const EventHook = z
  .object({
    event: HookEvent,
    effect_ops: z.array(EffectOp).min(1),
    condition: Predicate.optional(),
    limit: z
      .object({ per_battle: z.number().int().min(1).optional(), per_owner_turn: z.number().int().min(1).optional() })
      .strict()
      .optional(),
    event_filter: z.object({ incoming_action_type: z.enum(['basic', 'active', 'ultimate', 'signature']) }).strict().optional()
  })
  .strict();
export type EventHook = z.infer<typeof EventHook>;
