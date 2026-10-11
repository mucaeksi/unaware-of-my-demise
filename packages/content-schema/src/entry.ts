import { z } from 'zod';
import { Id, LineId, SafeAssetPath } from './primitives';

/**
 * The first-install interlude "Before the Road": a timed motion comic of full-screen plates with one narration line each.
 * Source of truth is narrative/09_VN_Scripts/.../prologue_v001.json (the build copies it verbatim; never edited here).
 */
export const PrologueScene = z
  .object({
    id: Id,
    duration_seconds: z.number().min(4).max(40),
    /** which plate the scene shows (art manifest ui entry `prologue_<visual>`; a painted stand-in is drawn when the plate is absent) */
    visual: Id,
    caption_en: z.string().min(1).max(60),
    line_id: LineId,
    text_en: z.string().min(1).max(400),
    /** art direction for the plate artist; never shown to the player */
    direction: z.string().max(600).optional(),
    audio_cue: Id.optional()
  })
  .strict();
export type PrologueScene = z.infer<typeof PrologueScene>;

export const Prologue = z
  .object({
    schema: z.literal(1),
    story_id: Id,
    title_en: z.string().min(1).max(60),
    locale: z.literal('en'),
    duration_seconds: z.number().min(10).max(600),
    voice_status: z.enum(['unrecorded', 'recorded']),
    visual_presentation: z.string().max(60),
    sources: z.array(z.string().max(200)).max(20),
    scenes: z.array(PrologueScene).min(1).max(24)
  })
  .strict()
  .superRefine((p, ctx) => {
    const total = p.scenes.reduce((n, s) => n + s.duration_seconds, 0);
    if (Math.abs(total - p.duration_seconds) > 0.01) ctx.addIssue({ code: 'custom', path: ['duration_seconds'], message: `scene durations add up to ${total}s, not ${p.duration_seconds}s` });
    const ids = new Set<string>();
    const lines = new Set<string>();
    for (const [i, s] of p.scenes.entries()) {
      if (ids.has(s.id)) ctx.addIssue({ code: 'custom', path: ['scenes', i, 'id'], message: `duplicate scene id ${s.id}` });
      if (lines.has(s.line_id)) ctx.addIssue({ code: 'custom', path: ['scenes', i, 'line_id'], message: `duplicate line_id ${s.line_id}` });
      ids.add(s.id);
      lines.add(s.line_id);
    }
  });
export type Prologue = z.infer<typeof Prologue>;

/** What the first-install flow plays, in order. It ships in the app (base release); everything after it comes by patch. */
export const EntryIndex = z
  .object({
    schema_version: z.literal(1),
    prologue: SafeAssetPath,
    /** tutorial stages in play order; each is an encounter file whose `pre_story` / `post_story` are the cutscenes around the fight */
    tutorial: z.array(z.object({ stage_id: Id, encounter: SafeAssetPath }).strict()).min(1).max(5)
  })
  .strict();
export type EntryIndex = z.infer<typeof EntryIndex>;
