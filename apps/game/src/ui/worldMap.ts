import type { ChapterIndex, WorldMap } from '@uomd/content-schema';

export type RegionState = 'cleared' | 'open' | 'locked' | 'coming_soon' | 'landmark';

/**
 * What the world map shows for each region. A chapter the active content does not ship yet is "coming soon"; a shipped
 * chapter opens when its first node's requirement is cleared (the same gate as the chapter list) and counts as cleared
 * when every node in it is.
 */
export function regionStates(map: WorldMap, index: ChapterIndex, cleared: ReadonlySet<string>): Map<string, RegionState> {
  const chapters = new Map(index.chapters.map((c) => [c.chapter_id, c]));
  return new Map(map.regions.map((r): [string, RegionState] => {
    if (!r.chapter_id) return [r.region_id, 'landmark'];
    // Hard stages (D-29) never decide whether a chapter is open or finished on the map
    const nodes = chapters.get(r.chapter_id)?.nodes.filter((n) => n.difficulty !== 'hard') ?? [];
    if (nodes.length === 0) return [r.region_id, 'coming_soon'];
    if (nodes.every((n) => cleared.has(n.node_id))) return [r.region_id, 'cleared'];
    const first = nodes[0]!;
    return [r.region_id, !first.requires || cleared.has(first.requires) ? 'open' : 'locked'];
  }));
}
