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
  'event_source',
  'event_target',
  'selected_ally',
  'last_heal_target',
  'ally_with_lowest_focus',
  'front_row_allies',
  'random_other_enemy',
  'enemy_with_lowest_def',
  'enemy_with_highest_atk',
  'enemy_with_most_buffs',
  'lowest_hp_enemy',
  'lowest_hp_front_enemy',
  'lowest_hp_rear_enemy',
  'all_enemy_allies',
  'lowest_hp_enemy_ally',
  'most_injured_enemy_ally',
  'boss',
  'duel_marked_enemy',
  'self_and_enemy_guards',
  'boss_and_enemy_guards'
]);
export type TargetSelector = z.infer<typeof TargetSelector>;

export const DamageType = z.enum(['physical', 'magic', 'elemental']);
export const ScaleStat = z.enum(['atk', 'def', 'hp']);

const PredicateLeaf = z.discriminatedUnion('predicate', [
  z.object({ predicate: z.literal('last_target_has_status'), value: Id }).strict(),
  z.object({ predicate: z.literal('owner_in_row'), value: z.enum(['front', 'rear']) }).strict(),
  z.object({ predicate: z.literal('owner_hp_below_pct'), value: z.number().min(0).max(100) }).strict(),
  z.object({ predicate: z.literal('owner_hp_above_pct'), value: z.number().min(0).max(100) }).strict(),
  z.object({ predicate: z.literal('owner_has_shield') }).strict(),
  z.object({ predicate: z.literal('owner_has_status'), value: Id }).strict(),
  z.object({ predicate: z.literal('owner_action_type'), value: z.enum(['basic', 'active', 'ultimate', 'signature']) }).strict(),
  z.object({ predicate: z.literal('owner_took_no_damage_this_round') }).strict(),
  z.object({ predicate: z.literal('target_has_status'), value: Id }).strict(),
  z.object({ predicate: z.literal('target_has_status_tag'), value: Id }).strict(),
  /** value "a_or_b": the target carries a status tagged a, or one tagged b. */
  z.object({ predicate: z.literal('target_has_any_status_tag'), value: z.string().regex(/^[a-z]+(_or_[a-z]+)+$/) }).strict(),
  z.object({ predicate: z.literal('target_in_row'), value: z.enum(['front', 'rear']) }).strict(),
  z.object({ predicate: z.literal('target_has_acted_this_battle') }).strict(),
  z.object({ predicate: z.literal('round_number_at_most'), value: z.number().int().min(1) }).strict(),
  z.object({ predicate: z.literal('last_target_defeated') }).strict(),
  z.object({ predicate: z.literal('last_primary_target_defeated') }).strict(),
  z.object({ predicate: z.literal('event_target_hp_at_or_below_pct'), value: z.number().min(0).max(100) }).strict(),
  z.object({ predicate: z.literal('event_target_had_status'), value: Id }).strict(),
  z.object({ predicate: z.literal('event_actor_has_any_buff') }).strict(),
  z.object({ predicate: z.literal('enemy_ally_hp_below_pct'), value: z.number().min(0).max(100) }).strict(),
  z.object({ predicate: z.literal('no_enemy_ally_below_pct'), value: z.number().min(0).max(100) }).strict(),
  z.object({ predicate: z.literal('damage_dealt_at_least_pct_of_target_hp'), value: z.number().min(0).max(100) }).strict(),
  z.object({ predicate: z.literal('count_enemies_with_status'), value: Id }).strict()
]);
export type Predicate = z.infer<typeof PredicateLeaf> | { all: Predicate[] } | { any: Predicate[] };
export const Predicate: z.ZodType<Predicate> = z.lazy(() =>
  z.union([PredicateLeaf, z.object({ all: z.array(Predicate).min(1).max(6) }).strict(), z.object({ any: z.array(Predicate).min(1).max(6) }).strict()])
);

const base = { target_selector_id: TargetSelector, when: Predicate.optional() };
const ActionType = z.enum(['basic', 'active', 'ultimate', 'signature']);
const Mult = z.number().positive().max(20);
const Turns = z.number().int().min(1).max(10);

/** Conditional multiplier applied to one damage packet (per target). */
const DamageModifier = z.union([
  z.object({ condition: Predicate, multiplier: z.number().positive().max(5) }).strict(),
  z.object({ condition: Predicate, add_multiplier_per_count: z.number().positive().max(2), maximum_count: z.number().int().min(1).max(10) }).strict()
]);

export const EffectOp = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('damage'),
      ...base,
      damage_type: DamageType,
      scale_stat: ScaleStat,
      multiplier: Mult,
      no_focus_gain: z.boolean().optional(),
      /** Independent hits (each rolls its own crit); default 1. */
      hit_count: z.number().int().min(1).max(5).optional(),
      /** false = this packet fires no passive hooks (splash / counters that must not chain). */
      can_trigger_passives: z.boolean().optional(),
      /** Damage that hits a shield depletes it this many times faster. */
      shield_damage_multiplier: z.number().min(1).max(5).optional(),
      modifiers: z.array(DamageModifier).max(4).optional(),
      /** Boss mechanics: stronger while a named objective still stands / while every objective of the phase still stands. */
      multiplier_if_objective_alive: z.object({ objective_id: Id, multiplier: z.number().positive().max(5) }).strict().optional(),
      multiplier_if_all_objectives_alive: z.object({ multiplier: z.number().positive().max(5) }).strict().optional()
    })
    .strict(),
  z.object({ op: z.literal('heal'), ...base, scale_stat: ScaleStat, multiplier: Mult }).strict(),
  z
    .object({
      op: z.literal('apply_status'),
      ...base,
      status_id: Id,
      duration_turns: Turns,
      chance: z.number().min(0).max(1).optional(),
      /** soul_link only: fraction of each hit shared with the other linked units. */
      shared_damage_fraction: z.number().min(0).max(1).optional()
    })
    .strict(),
  z
    .object({
      op: z.literal('remove_status'),
      ...base,
      category: z.enum(['debuff', 'buff']),
      count: z.number().int().min(1).max(5),
      selection: z.enum(['oldest_applied', 'random_applied_buff'])
    })
    .strict(),
  z
    .object({
      op: z.literal('grant_shield'),
      ...base,
      scale_stat: ScaleStat,
      multiplier: Mult,
      duration_turns: Turns,
      shield_source_id: Id.optional()
    })
    .strict(),
  z
    .object({
      op: z.literal('grant_redirect'),
      ...base,
      protected_ally_selector_id: TargetSelector,
      redirected_fraction: z.number().min(0).max(1),
      duration_turns: Turns,
      eligible_action_types: z.array(ActionType).min(1)
    })
    .strict(),
  z.object({ op: z.literal('gain_focus'), ...base, amount: z.number().int().min(1).max(100) }).strict(),
  z
    .object({
      op: z.literal('modify_stat'),
      ...base,
      stat_id: z.enum(['atk', 'def', 'spd', 'veil_res', 'res', 'effect_res']),
      mode: z.enum(['add_pct', 'add_flat']),
      amount: z.number().min(-1).max(10),
      duration_turns: Turns
    })
    .strict(),
  z
    .object({
      op: z.literal('heal_per_removed_status'),
      ...base,
      scale_stat: ScaleStat,
      multiplier: Mult,
      maximum_targets: z.number().int().min(1).max(5),
      maximum_total_stacks: z.number().int().min(1).max(10),
      requires_successful_cleanse: z.boolean()
    })
    .strict(),
  // ---- packet modifiers (valid inside before_damage_* hooks; ignored elsewhere)
  z.object({ op: z.literal('modify_incoming_damage'), ...base, multiplier: z.number().min(0).max(5) }).strict(),
  z.object({ op: z.literal('modify_outgoing_damage'), ...base, multiplier: z.number().min(0).max(5) }).strict(),
  z.object({ op: z.literal('block_attack'), ...base, maximum_hits: z.number().int().min(1).max(5) }).strict(),
  // ---- timed protection
  z.object({ op: z.literal('grant_damage_reduction'), ...base, damage_taken_multiplier: z.number().min(0).max(1), duration_turns: Turns }).strict(),
  z
    .object({
      op: z.literal('grant_first_hit_guard'),
      ...base,
      damage_taken_multiplier: z.number().min(0).max(1),
      duration_turns: Turns,
      hits_per_target: z.number().int().min(1).max(5)
    })
    .strict(),
  z
    .object({
      op: z.literal('grant_opening_guard'),
      ...base,
      duration_rounds: Turns,
      target_override: z.literal('first_single_target_attack_per_enemy'),
      damage_taken_multiplier: z.number().min(0).max(1)
    })
    .strict(),
  z
    .object({
      op: z.literal('grant_intercept'),
      ...base,
      protected_ally_selector_id: TargetSelector,
      redirected_fraction: z.number().min(0).max(1),
      duration_turns: Turns,
      maximum_intercepts: z.number().int().min(1).max(5)
    })
    .strict(),
  // ---- over time / tempo / resources
  z
    .object({
      op: z.literal('apply_regeneration'),
      ...base,
      scale_stat: ScaleStat,
      multiplier: Mult,
      ticks: z.number().int().min(1).max(10),
      tick_event: z.literal('owner_turn_start'),
      duration_turns: Turns
    })
    .strict(),
  z
    .object({
      op: z.literal('reduce_status_durations'),
      ...base,
      category: z.enum(['debuff', 'buff']),
      amount_turns: z.number().int().min(1).max(5),
      minimum_remaining_turns: z.number().int().min(0).max(5)
    })
    .strict(),
  z
    .object({ op: z.literal('reduce_cooldowns'), ...base, amount_turns: z.number().int().min(1).max(5), minimum_remaining_turns: z.number().int().min(0).max(5) })
    .strict(),
  z.object({ op: z.literal('delay_next_action'), ...base, gauge_fraction: z.number().min(0).max(1) }).strict(),
  z.object({ op: z.literal('pay_hp_cost'), ...base, max_hp_fraction: z.number().min(0).max(1), cannot_reduce_below: z.number().int().min(1) }).strict(),
  // ---- counters / bonuses
  z
    .object({
      op: z.literal('arm_counter'),
      ...base,
      event: z.literal('target_action_before_owner_next_turn'),
      scale_stat: ScaleStat,
      multiplier: Mult,
      damage_type: DamageType,
      consume_on_trigger: z.literal(true)
    })
    .strict(),
  z.object({ op: z.literal('arm_next_attack_bonus'), ...base, damage_multiplier: z.number().min(1).max(5), consume_on_attack: z.literal(true) }).strict(),
  // ---- shields
  z
    .object({
      op: z.literal('copy_buff'),
      ...base,
      source_selector_id: TargetSelector,
      category: z.enum(['buff', 'shield']),
      maximum_count: z.number().int().min(1).max(3),
      duration_turns: Turns
    })
    .strict(),
  z
    .object({ op: z.literal('remove_shield'), ...base, amount_fraction: z.number().min(0).max(1).optional(), shield_source_id: Id.optional() })
    .strict()
    .refine((o) => (o.amount_fraction === undefined) !== (o.shield_source_id === undefined), 'remove_shield needs exactly one of amount_fraction / shield_source_id'),
  // ---- boss mechanics (objectives, telegraphs, wards, reinforcements)
  z.object({ op: z.literal('cancel_boss_telegraph'), ...base, action_id: Id }).strict(),
  z.object({ op: z.literal('remove_boss_modifier'), ...base, modifier_id: Id }).strict(),
  z
    .object({
      op: z.literal('boss_damage_taken_modifier'),
      ...base,
      multiplier: z.number().min(0).max(1),
      modifier_id: Id,
      until_objective_destroyed: Id.optional(),
      while_any_objective_alive: z.array(Id).min(1).max(6).optional()
    })
    .strict(),
  z.object({ op: z.literal('summon_enemies'), ...base, enemy_id: Id, count: z.number().int().min(1).max(4), only_if_objective_alive: Id.optional() }).strict(),
  z.object({ op: z.literal('remove_copied_statuses'), ...base, category: z.enum(['buff', 'shield']) }).strict(),
  z.object({ op: z.literal('clear_status_if_all_objectives_destroyed'), ...base, objective_ids: z.array(Id).min(1).max(6), status_id: Id }).strict()
]);
export type EffectOp = z.infer<typeof EffectOp>;

export const IMPLEMENTED_OPS = EffectOp.options.map((o) => o.shape.op.value);

export const HookEvent = z.enum([
  'owner_turn_start',
  'before_damage_received',
  'before_damage_dealt',
  'after_damage_dealt',
  'after_damage_received',
  'ally_damaged',
  'ally_hp_threshold_crossed',
  'after_ally_healed',
  'after_ally_action',
  'after_ally_ultimate',
  'after_enemy_defeated',
  'after_round_end'
]);
export type HookEvent = z.infer<typeof HookEvent>;

export const HookLimit = z
  .object({
    per_battle: z.number().int().min(1).optional(),
    per_owner_turn: z.number().int().min(1).optional(),
    per_round: z.number().int().min(1).optional(),
    per_damage_action: z.number().int().min(1).optional(),
    per_event: z.number().int().min(1).optional(),
    per_target_per_battle: z.number().int().min(1).optional(),
    /** Probability the hook fires when everything else matches. */
    chance: z.number().min(0).max(1).optional(),
    /** Do not re-arm while a bonus armed by this hook is still pending. */
    one_pending_bonus: z.boolean().optional()
  })
  .strict();

export const EventFilter = z
  .object({
    incoming_action_type: ActionType.optional(),
    /** The action that dealt the damage: a Basic/Active/Ultimate/Signature skill (never a counter or hook). */
    damage_action_type: z.literal('basic_or_skill').optional(),
    /** The acting unit used an attacking skill of this kind. */
    owner_action_type: z.literal('any_attack').optional(),
    /** 'player' = the event's subject stands on the player side. */
    team: z.literal('player').optional(),
    source_is_owner: z.boolean().optional(),
    exclude_owner: z.boolean().optional(),
    ally_action_type: ActionType.optional(),
    event_target_faction_is: Id.optional()
  })
  .strict();

export const EventHook = z
  .object({
    event: HookEvent,
    effect_ops: z.array(EffectOp).min(1).max(4),
    condition: Predicate.optional(),
    limit: HookLimit.optional(),
    event_filter: EventFilter.optional()
  })
  .strict();
export type EventHook = z.infer<typeof EventHook>;

/**
 * Always-on rule of a passive: multiplies damage packets or adds a stat bonus while its condition
 * holds. `applies_to` decides whose packets are touched (the owner's, or every ally's while the owner lives).
 */
export const ContinuousModifier = z.union([
  z
    .object({
      event: z.enum(['before_damage_received', 'before_damage_dealt']),
      condition: Predicate.optional(),
      target: z.enum(['self', 'previous_op_targets']),
      damage_multiplier: z.number().positive().max(5),
      applies_to: z.enum(['self', 'all_allies_while_owner_alive']).optional()
    })
    .strict(),
  z
    .object({
      event: z.literal('stat_snapshot'),
      condition: Predicate.optional(),
      target: z.enum(['front_row_allies', 'all_allies', 'self']),
      stat_id: z.enum(['atk', 'def', 'spd', 'res']),
      mode: z.literal('add_pct'),
      amount: z.number().min(-1).max(5)
    })
    .strict()
]);
export type ContinuousModifier = z.infer<typeof ContinuousModifier>;
