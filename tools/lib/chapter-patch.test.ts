import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateContentSet, type ChapterIndex } from '@uomd/content-schema';
import { describe, expect, it } from 'vitest';
import { CHAPTER_INDEX_PATH, chapterPatch } from './chapter-patch';
import { ROOT } from './fsutil';

const load = (dir: string): Map<string, Uint8Array> => {
  const out = new Map<string, Uint8Array>();
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      // the release manifest is not content
      else if (e.name !== 'release.json') out.set(relative(dir, p).replaceAll('\\', '/'), new Uint8Array(readFileSync(p)));
    }
  };
  walk(dir);
  return out;
};
const base = load(join(ROOT, 'content/base'));
const campaign = load(join(ROOT, 'content/patches/rel_0003_part1_campaign'));
const chapterCount = (JSON.parse(new TextDecoder().decode(campaign.get(CHAPTER_INDEX_PATH))) as ChapterIndex).chapters.filter((c) => c.chapter_id !== 'tutorial').length;

describe('per-chapter campaign patches (D-29 A3)', () => {
  for (let n = 1; n <= chapterCount; n++) {
    it(`chapters 1..${n} form a valid release over the base and carry nothing from later chapters`, () => {
      const patch = chapterPatch(campaign, n);
      expect(() => validateContentSet(new Map([...base, ...patch]))).not.toThrow();
      const index = JSON.parse(new TextDecoder().decode(patch.get(CHAPTER_INDEX_PATH))) as ChapterIndex;
      expect(index.chapters.filter((c) => c.chapter_id !== 'tutorial')).toHaveLength(n);
      for (const path of patch.keys()) {
        const stage = /^encounters\/stage_(\d+)_/.exec(path) ?? /^story\/vn_(\d+)_/.exec(path);
        if (stage) expect(Number(stage[1]), path).toBeLessThanOrEqual(n);
      }
    });
  }
  it('the last chapter patch is the whole campaign', () => {
    expect([...chapterPatch(campaign, chapterCount).keys()].sort()).toEqual([...campaign.keys()].sort());
  });
});
