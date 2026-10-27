import { z } from 'zod';
import { BattleParty, RewardAttachment } from '@uomd/content-schema';

/** Authoritative wire boundary shared by the provider and Unity contract fixtures. */
export const BattleStartRequest = z.object({
  releaseId: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/),
  nodeId: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/)
}).strict();
export const BattleSubmission = BattleStartRequest.extend({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  sessionId: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  actions: z.array(z.object({ skillId: z.string().max(80), targetId: z.string().max(80).optional() }).strict()).max(600)
}).strict();
export type BattleSubmission = z.infer<typeof BattleSubmission>;
export const BattleStartResult = z.object({
  catalogSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  sessionId: z.string().regex(/^[a-f0-9]{32}$/).nullable(),
  party: BattleParty.nullable(),
  expiresAt: z.iso.datetime().nullable()
}).strict();
export const BattleResult = z.object({
  catalogSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  requestId: z.string(), nodeId: z.string(), stars: z.number().int().min(1).max(3),
  bestStars: z.number().int().min(1).max(3), firstClear: z.boolean(), newThreeStar: z.boolean(),
  turns: z.number().int().nonnegative(), rewards: z.array(RewardAttachment),
  repeatRewardsAllowed: z.boolean().optional(),
  ration: z.object({ spent: z.number().int().nonnegative(), value: z.number().int().nonnegative(), cap: z.number().int().nonnegative(), nextMs: z.number().nonnegative() }).strict(),
  replayed: z.boolean()
}).strict();
export const BattleOperationStatus = z.discriminatedUnion('state', [
  z.object({ requestId: z.string(), path: z.literal('/api/v1/progress/battle'), state: z.literal('unknown'), binding: z.null(), inputHash: z.null(), result: z.null() }).strict(),
  z.object({ requestId: z.string(), path: z.literal('/api/v1/progress/battle'), state: z.literal('confirmed'), binding: z.enum(['exact', 'legacy']), inputHash: z.string().nullable(), result: BattleResult }).strict()
]);
