import { z } from 'zod';
import { Id } from './primitives';

export const WORLD_MAP_PATH = 'world/world_map.json';

/**
 * The world map that is the game's main menu (D-29). Layout is data so chapter patches reveal regions without code:
 * a region with a `chapter_id` opens that campaign chapter (or reads "coming soon" while the chapter is not in the
 * active chapter index); a region without one is a landmark (side road). Coordinates are 1920x1080 reference pixels.
 */
export const WorldMap = z
  .object({
    schema_version: z.literal(1),
    /** art_manifest background id painted under the map; absent = the drawn road on the hub backdrop */
    background_id: Id.optional(),
    regions: z
      .array(
        z
          .object({
            region_id: Id,
            chapter_id: Id.optional(),
            /** 1-based chapter number shown on the map ("Chapter 3") */
            chapter_number: z.number().int().min(1).max(99).optional(),
            title_en: z.string().min(1).max(60),
            part: z.number().int().min(1).max(9),
            x: z.number().min(0).max(1920),
            y: z.number().min(0).max(1080)
          })
          .strict()
      )
      .min(1)
      .max(64),
    roads: z.array(z.object({ from: Id, to: Id, kind: z.enum(['main', 'side']) }).strict()).max(128)
  })
  .strict()
  .superRefine((map, ctx) => {
    const ids = new Set<string>();
    const chapters = new Set<string>();
    for (const r of map.regions) {
      if (ids.has(r.region_id)) ctx.addIssue({ code: 'custom', message: `duplicate region ${r.region_id}` });
      ids.add(r.region_id);
      if (r.chapter_id) {
        if (chapters.has(r.chapter_id)) ctx.addIssue({ code: 'custom', message: `chapter ${r.chapter_id} on two regions` });
        chapters.add(r.chapter_id);
      }
      if (!r.chapter_id !== (r.chapter_number === undefined)) ctx.addIssue({ code: 'custom', message: `region ${r.region_id}: chapter_id and chapter_number go together` });
    }
    for (const road of map.roads) if (!ids.has(road.from) || !ids.has(road.to) || road.from === road.to) ctx.addIssue({ code: 'custom', message: `road ${road.from} -> ${road.to} needs two known regions` });
  });
export type WorldMap = z.infer<typeof WorldMap>;
