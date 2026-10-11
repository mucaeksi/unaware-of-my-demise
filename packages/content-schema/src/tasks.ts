import { z } from 'zod';
import { Id } from './primitives';
import { RewardAttachment } from './rewards';

/**
 * Task engine configuration (game_config key 'tasks'). Canon economy_part1.json: UTC-authoritative 12-hour windows (00:00 / 12:00) that
 * do not carry over, and a Monday-based weekly cycle of segments. Payouts are PLACEHOLDERS until the final math pass.
 * Objectives count server-verified events only: a Ration-consuming win ('eligible_wins', 'boss_wins', 'three_star_wins') or a
 * successful character / gear level-up ('level_ups').
 */
export const TaskObjective = z.object({ type: z.enum(['eligible_wins', 'boss_wins', 'three_star_wins', 'level_ups']), count: z.number().int().min(1).max(999) }).strict();
export type TaskObjective = z.infer<typeof TaskObjective>;

const Rewards = z.array(RewardAttachment).min(1).max(8);

export const TaskConfig = z
  .object({
    note: z.string().max(600).optional(),
    windowHours: z.number().int().min(1).max(24).refine((h) => 24 % h === 0, 'must divide 24'),
    daily: z
      .object({
        tasks: z.array(z.object({ id: Id, title_en: z.string().max(80), objective: TaskObjective, rewards: Rewards }).strict()).min(1).max(8),
        completion: z.object({ requires: z.array(Id).min(1).max(8), rewards: Rewards }).strict()
      })
      .strict(),
    weekly: z
      .object({
        /** days after a segment ends in which a completed segment can still be claimed (canon: 7) */
        claimGraceDays: z.number().int().min(0).max(30),
        segments: z
          .array(z.object({ id: Id, title_en: z.string().max(80), startDay: z.number().int().min(0).max(6), durationDays: z.number().int().min(1).max(7), objective: TaskObjective, rewards: Rewards }).strict())
          .min(1)
          .max(7)
      })
      .strict()
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = new Set(c.daily.tasks.map((t) => t.id));
    if (ids.size !== c.daily.tasks.length) ctx.addIssue({ code: 'custom', message: 'duplicate daily task id' });
    for (const r of c.daily.completion.requires) if (!ids.has(r)) ctx.addIssue({ code: 'custom', message: `completion requires unknown task ${r}` });
    for (const s of c.weekly.segments) if (s.startDay + s.durationDays > 7) ctx.addIssue({ code: 'custom', message: `segment ${s.id} runs past the end of the week` });
  });
export type TaskConfig = z.infer<typeof TaskConfig>;
