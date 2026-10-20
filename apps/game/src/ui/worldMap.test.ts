import { describe, expect, it } from 'vitest';
import type { ChapterIndex, WorldMap } from '@uomd/content-schema';
import { regionStates } from './worldMap';

const map = {
  schema_version: 1,
  regions: [
    { region_id: 'r1', chapter_id: 'ch1', chapter_number: 1, title_en: 'One', part: 1, x: 300, y: 600 },
    { region_id: 'r2', chapter_id: 'ch2', chapter_number: 2, title_en: 'Two', part: 1, x: 500, y: 500 },
    { region_id: 'r3', chapter_id: 'ch3', chapter_number: 3, title_en: 'Three', part: 1, x: 700, y: 600 },
    { region_id: 'side', title_en: 'Side', part: 1, x: 500, y: 800 }
  ],
  roads: []
} as unknown as WorldMap;
const node = (node_id: string, requires?: string) => ({ node_id, kind: 'battle', ...(requires ? { requires } : {}) });
const index = { schema_version: 1, chapters: [
  { chapter_id: 'ch1', title_en: 'One', nodes: [node('a1'), node('a2', 'a1')] },
  { chapter_id: 'ch2', title_en: 'Two', nodes: [node('b1', 'a2')] }
] } as unknown as ChapterIndex;

describe('regionStates', () => {
  it('opens chapter 1, locks chapter 2 until chapter 1 ends, and marks unshipped chapters coming soon', () => {
    expect(Object.fromEntries(regionStates(map, index, new Set()))).toEqual({ r1: 'open', r2: 'locked', r3: 'coming_soon', side: 'landmark' });
  });
  it('clears a chapter when every node is cleared and opens the next one', () => {
    expect(Object.fromEntries(regionStates(map, index, new Set(['a1', 'a2'])))).toEqual({ r1: 'cleared', r2: 'open', r3: 'coming_soon', side: 'landmark' });
  });
});
