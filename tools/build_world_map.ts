/**
 * Writes the Part I world map (D-29) into the campaign patch: the west-to-east Bell Road of canon
 * (narrative/08_Locations/WORLD_ATLAS_AND_GENIE_BIBLE_TR.md §2) with the seven chapter regions and the four side roads.
 * Part II/III regions are added by their own patches (their names are spoilers today).
 * Run: npx tsx tools/build_world_map.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WorldMap } from '@uomd/content-schema';
import { ROOT } from './lib/fsutil';

const OUT = join(ROOT, 'content/patches/rel_0003_part1_campaign/world/world_map.json');

// x/y keep the nodes (190 px wide) clear of the hub columns (x < 250, x > 1670) and the bottom button row (y > 950)
const CHAPTERS = [
  ['forest_whispering_ash', 'ch01_whispering_ash_forest', 'Whispering Ash Forest', 390, 690],
  ['cathedral_saint_luthos', 'ch02_ruined_cathedral_of_saint_luthos', 'The Ruined Cathedral of Saint Luthos', 580, 520],
  ['village_oakhaven', 'ch03_oakhaven_red_harvest', 'Oakhaven, the Red Harvest', 770, 680],
  ['undercity_subterranean', 'ch04_subterranean_undercity', 'The Subterranean Undercity', 960, 500],
  ['bridge_forsaken', 'ch05_bridge_forsaken', 'The Bridge of the Forsaken', 1150, 660],
  ['estate_ashen_lord', 'ch06_ashen_lord_estate', "The Ashen Lord's Estate", 1340, 480],
  ['altar_first_eclipse', 'ch07_altar_first_eclipse', 'The Altar of the First Eclipse', 1530, 640]
] as const;
const SIDE_ROADS = [
  ['lowland_refuge', 'Lowland Refuge', 600, 820, 'cathedral_saint_luthos'],
  ['kiln_town', 'Kiln Town', 790, 340, 'village_oakhaven'],
  ['salt_road_coast', 'Salt Road Coast', 1000, 820, 'undercity_subterranean'],
  ['highland_ridge', 'Highland Ridge', 1360, 310, 'estate_ashen_lord']
] as const;

const map = WorldMap.parse({
  schema_version: 1,
  regions: [
    ...CHAPTERS.map(([region_id, chapter_id, title_en, x, y], i) => ({ region_id, chapter_id, chapter_number: i + 1, title_en, part: 1, x, y })),
    ...SIDE_ROADS.map(([region_id, title_en, x, y]) => ({ region_id, title_en, part: 1, x, y }))
  ],
  roads: [
    ...CHAPTERS.slice(1).map(([to], i) => ({ from: CHAPTERS[i]![0], to, kind: 'main' as const })),
    ...SIDE_ROADS.map(([to, , , , from]) => ({ from, to, kind: 'side' as const }))
  ]
});

mkdirSync(join(OUT, '..'), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(map, null, 2)}\n`);
console.log(`world map: ${map.regions.length} regions, ${map.roads.length} roads -> ${OUT}`);
