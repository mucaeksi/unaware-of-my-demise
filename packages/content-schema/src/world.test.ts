import { describe, expect, it } from 'vitest';
import { requiredContentCapabilities } from './presentation';
import { WORLD_MAP_PATH, WorldMap } from './world';

const map = {
  schema_version: 1,
  regions: [
    { region_id: 'forest_whispering_ash', chapter_id: 'ch01_whispering_ash_forest', chapter_number: 1, title_en: 'Whispering Ash Forest', part: 1, x: 260, y: 640 },
    { region_id: 'cathedral_saint_luthos', chapter_id: 'ch02_ruined_cathedral_of_saint_luthos', chapter_number: 2, title_en: 'The Ruined Cathedral of Saint Luthos', part: 1, x: 470, y: 520 },
    { region_id: 'lowland_refuge', title_en: 'Lowland Refuge', part: 1, x: 520, y: 800 }
  ],
  roads: [{ from: 'forest_whispering_ash', to: 'cathedral_saint_luthos', kind: 'main' }, { from: 'cathedral_saint_luthos', to: 'lowland_refuge', kind: 'side' }]
};

describe('WorldMap', () => {
  it('accepts chapter regions, landmarks and roads between them', () => {
    expect(WorldMap.parse(map).regions).toHaveLength(3);
  });
  it('rejects duplicate regions, dangling roads and a chapter without its number', () => {
    expect(WorldMap.safeParse({ ...map, regions: [...map.regions, map.regions[0]] }).success).toBe(false);
    expect(WorldMap.safeParse({ ...map, roads: [{ from: 'forest_whispering_ash', to: 'nowhere', kind: 'main' }] }).success).toBe(false);
    expect(WorldMap.safeParse({ ...map, regions: [{ ...map.regions[0], chapter_number: undefined }] }).success).toBe(false);
    expect(WorldMap.safeParse({ ...map, regions: [{ ...map.regions[0], x: 2400 }] }).success).toBe(false);
  });
  it('requires the world_map_v1 capability, so an older app refuses the patch instead of breaking', () => {
    const files = new Map([[WORLD_MAP_PATH, new TextEncoder().encode(JSON.stringify(map))]]);
    expect(requiredContentCapabilities(files)).toContain('world_map_v1');
  });
});
