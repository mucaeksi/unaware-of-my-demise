import { z } from 'zod';
import { Id } from './primitives';

/** One thing a reward can grant. A closed grammar: the server applies these through the ledger / inventory only. */
export const RewardAttachment = z.discriminatedUnion('type', [
  z.object({ type: z.literal('currency'), currency: z.enum(['silver_crowns', 'eclipse_token', 'fates_thread']), amount: z.number().int().min(1).max(1_000_000_000) }).strict(),
  z.object({ type: z.literal('character'), itemId: Id }).strict()
]);
export type RewardAttachment = z.infer<typeof RewardAttachment>;

/** Rewards of a battle node. `first_clear` once per account, `three_star` once when the node first reaches 3 stars, `repeat` on every ration-paid win. */
export const NodeRewards = z
  .object({
    first_clear: z.array(RewardAttachment).max(8).default([]),
    three_star: z.array(RewardAttachment).max(8).default([]),
    repeat: z.array(RewardAttachment).max(8).default([])
  })
  .strict();
export type NodeRewards = z.infer<typeof NodeRewards>;

/** Canon stage ration costs (economy_part1.json): campaign 6, material hunt 8, gear dungeon 10, special boss 10. */
export const RationClass = z.enum(['tutorial', 'campaign', 'material_hunt', 'gear_dungeon', 'special_boss']);
export type RationClass = z.infer<typeof RationClass>;
export const RATION_COST: Record<RationClass, number> = { tutorial: 0, campaign: 6, material_hunt: 8, gear_dungeon: 10, special_boss: 10 };
