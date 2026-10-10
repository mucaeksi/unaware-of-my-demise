import { z } from 'zod';
import { Id, SafeAssetPath } from './primitives';

export const UNIT_ANIM_STATES = ['idle', 'walk', 'basic', 'active', 'ultimate', 'hit', 'defeat', 'victory'] as const;
export type UnitAnimState = (typeof UNIT_ANIM_STATES)[number];

const Region = z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int().min(1), z.number().int().min(1)]);

/** Phaser "JSON hash" atlas frames: name -> [x, y, w, h] in the packed texture. */
export const AtlasDef = z
  .object({
    image: SafeAssetPath,
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
    frames: z.record(z.string().min(1).max(40), Region)
  })
  .strict();

export const UnitArt = z
  .object({
    atlas: Id,
    /** direction the artwork faces; the battle scene mirrors when a unit must face the other way. */
    facing: z.enum(['left', 'right']),
    /** Display height in reference pixels of the idle pose; other poses use per-state scale. */
    height_px: z.number().min(40).max(900),
    states: z.record(
      z.enum(UNIT_ANIM_STATES),
      z.object({ frame: z.string(), scale: z.number().min(0.2).max(3), foot_y: z.number().min(0.5).max(1), pivot_x: z.number().min(0).max(1).default(0.5) }).strict()
    )
  })
  .strict();

export const ArtManifest = z
  .object({
    schema_version: z.literal(1),
    atlases: z.record(Id, AtlasDef),
    units: z.record(Id, UnitArt),
    portraits: z.record(Id, z.object({ emotions: z.record(z.string(), Id), images: z.record(Id, SafeAssetPath) }).strict()),
    backgrounds: z.record(Id, SafeAssetPath),
    music: z.record(Id, z.object({ file: SafeAssetPath, loop_start_s: z.number().min(0), duration_s: z.number().positive() }).strict()).default({}),
    ui: z.record(Id, SafeAssetPath).default({})
  })
  .strict()
  .superRefine((art, ctx) => {
    for (const [key, u] of Object.entries(art.units)) {
      const atlas = art.atlases[u.atlas];
      if (!atlas) {
        ctx.addIssue({ code: 'custom', path: ['units', key], message: `unknown atlas ${u.atlas}` });
        continue;
      }
      for (const [st, s] of Object.entries(u.states)) {
        if (!atlas.frames[s.frame]) ctx.addIssue({ code: 'custom', path: ['units', key, 'states', st], message: `unknown frame ${s.frame}` });
      }
      if (!u.states.idle) ctx.addIssue({ code: 'custom', path: ['units', key], message: 'idle state is required' });
    }
    for (const [cid, p] of Object.entries(art.portraits)) {
      for (const [emo, img] of Object.entries(p.emotions)) {
        if (!p.images[img]) ctx.addIssue({ code: 'custom', path: ['portraits', cid, 'emotions', emo], message: `emotion maps to unknown image ${img}` });
      }
    }
  });
export type ArtManifest = z.infer<typeof ArtManifest>;
