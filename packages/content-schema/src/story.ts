import { z } from 'zod';
import { Id, LineId, SafeAssetPath } from './primitives';
import { NodeRewards, RationClass } from './rewards';

/**
 * Declarative story commands. The runtime (packages/story) is the only interpreter; scenes are pure
 * data and can be delivered by content patches. Every op is implemented and unit tested.
 */
const speaker = z.union([z.literal('narration'), Id]);
const label = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);

export const StoryCommand = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('say'),
      line_id: LineId,
      speaker: Id,
      speaker_display: z.string().min(1).max(40),
      text: z.string().min(1).max(600),
      emotion: z.string().max(40).optional(),
      hold_seconds: z.number().min(0).max(30).optional()
    })
    .strict(),
  z
    .object({
      op: z.literal('narrate'),
      line_id: LineId,
      text: z.string().min(1).max(600),
      hold_seconds: z.number().min(0).max(30).optional()
    })
    .strict(),
  z.object({ op: z.literal('show'), character: Id, side: z.enum(['left', 'right']) }).strict(),
  z.object({ op: z.literal('hide'), character: Id }).strict(),
  z.object({ op: z.literal('background'), location_id: Id }).strict(),
  z.object({ op: z.literal('music'), cue_id: Id.or(z.literal('stop')) }).strict(),
  z.object({ op: z.literal('fade'), direction: z.enum(['in', 'out']), seconds: z.number().min(0).max(5) }).strict(),
  z.object({ op: z.literal('flash'), seconds: z.number().min(0).max(2) }).strict(),
  z.object({ op: z.literal('shake'), seconds: z.number().min(0).max(2), intensity: z.number().min(0).max(1) }).strict(),
  z.object({ op: z.literal('wait'), seconds: z.number().min(0).max(10) }).strict(),
  z
    .object({
      op: z.literal('choice'),
      prompt: z.string().max(200).optional(),
      options: z.array(z.object({ id: Id, text: z.string().min(1).max(120), goto: label }).strict()).min(2).max(4)
    })
    .strict(),
  z.object({ op: z.literal('label'), name: label }).strict(),
  z.object({ op: z.literal('goto'), label }).strict(),
  z.object({ op: z.literal('checkpoint'), checkpoint_id: Id }).strict(),
  z.object({ op: z.literal('end') }).strict()
]);
export type StoryCommand = z.infer<typeof StoryCommand>;
export const STORY_OPS = StoryCommand.options.map((o) => o.shape.op.value);
void speaker;

export const StoryScene = z
  .object({
    schema_version: z.literal(1),
    scene_id: Id,
    title_en: z.string().max(80),
    location_id: Id,
    commands: z.array(StoryCommand).min(1).max(400),
    provenance: z.object({ source: z.string(), source_sha256: z.string().optional(), note: z.string().optional() }).strict()
  })
  .strict()
  .superRefine((scene, ctx) => {
    const labels = new Set<string>();
    const seenLines = new Set<string>();
    for (const [i, c] of scene.commands.entries()) {
      if (c.op === 'label') {
        if (labels.has(c.name)) ctx.addIssue({ code: 'custom', path: ['commands', i], message: `duplicate label ${c.name}` });
        labels.add(c.name);
      }
      if (c.op === 'say' || c.op === 'narrate') {
        if (seenLines.has(c.line_id)) ctx.addIssue({ code: 'custom', path: ['commands', i], message: `duplicate line_id ${c.line_id}` });
        seenLines.add(c.line_id);
      }
    }
    for (const [i, c] of scene.commands.entries()) {
      if (c.op === 'goto' && !labels.has(c.label)) ctx.addIssue({ code: 'custom', path: ['commands', i], message: `goto unknown label ${c.label}` });
      if (c.op === 'choice') {
        for (const o of c.options) if (!labels.has(o.goto)) ctx.addIssue({ code: 'custom', path: ['commands', i], message: `choice goto unknown label ${o.goto}` });
      }
    }
  });
export type StoryScene = z.infer<typeof StoryScene>;

export const Encounter = z
  .object({
    schema_version: z.literal(1),
    encounter_id: Id,
    stage_id: z.string().max(20),
    title_en: z.string().max(80),
    location_id: Id,
    seed: z.number().int().min(0).max(0xffffffff),
    music_cue: Id.optional(),
    /** Narrative runtime allows a 2-unit tutorial party; every other encounter is 5v5. */
    party: z
      .array(z.object({ unit_id: Id, level: z.number().int().min(1).max(20), slot: z.number().int().min(0).max(4), row: z.enum(['front', 'rear']) }).strict())
      .min(1)
      .max(5),
    enemies: z
      .array(z.object({ unit_id: Id, level: z.number().int().min(1).max(20), slot: z.number().int().min(0).max(4), row: z.enum(['front', 'rear']) }).strict())
      .min(1)
      .max(5),
    pre_story: SafeAssetPath.optional(),
    post_story: SafeAssetPath.optional(),
    provenance: z.object({ source: z.string(), source_sha256: z.string().optional() }).strict()
  })
  .strict();
export type Encounter = z.infer<typeof Encounter>;

const ChapterNode = z
  .object({
    node_id: Id,
    title_en: z.string().max(80),
    kind: z.enum(['story', 'battle']),
    story: SafeAssetPath.optional(),
    encounter: SafeAssetPath.optional(),
    requires: Id.optional(),
    /** battle nodes: what a win costs (Ration) and grants; the server reads this from the published release, never from the client */
    ration_class: RationClass.optional(),
    /** a boss encounter: counts toward boss-hunt tasks */
    boss: z.boolean().optional(),
    rewards: NodeRewards.optional(),
    /** random loot: a drop table (game_config 'drops') rolled by the server on every win; `boss_set_id` names the accessory set boss-set entries resolve to */
    drop: z.object({ table: Id, boss_set_id: Id.optional() }).strict().optional()
  })
  .strict();

const Chapter = z
  .object({
    chapter_id: Id,
    title_en: z.string().max(80),
    nodes: z.array(ChapterNode).min(1)
  })
  .strict();

export const ChapterIndex = z
  .object({
    schema_version: z.literal(1),
    chapters: z.array(Chapter).min(1)
  })
  .strict();
export type ChapterIndex = z.infer<typeof ChapterIndex>;
