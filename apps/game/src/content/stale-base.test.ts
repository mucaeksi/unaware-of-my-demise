import { describe, expect, it } from 'vitest';
import type { ManifestFile } from '@uomd/content-schema';
import { builtOnOlderBase } from './stale-base';

const sha = (c: string) => c.repeat(64);
const base = { 'presentation/presentation.json': sha('a'), 'entry/prologue.json': sha('b'), 'voices/entry_past_001.ogg': sha('c'), 'art/bg_forgotten_stone_crossing.webp': sha('d') };
const file = (path: string, hash: string): ManifestFile => ({ path, sha256: hash, bytes: 1, kind: 'other_data', media_type: path.endsWith('.ogg') ? 'audio/ogg' : path.endsWith('.webp') ? 'image/webp' : 'application/json' });
const snapshot = (files: Record<string, string>, dependsOn?: { release_id: string; generation: number }) => ({ files: Object.entries(files).map(([p, h]) => file(p, h)), ...(dependsOn ? { depends_on: dependsOn } : {}) });

describe('stale-base snapshot decision', () => {
  it('honours a current-base snapshot that intentionally overrides base files', () => {
    expect(builtOnOlderBase(snapshot({ ...base, 'presentation/presentation.json': sha('e'), 'entry/prologue.json': sha('f'), 'locales/tr.json': sha('9') }), base)).toBe(false);
  });
  it('flags a snapshot composed on an older base that lacks newer base files', () => {
    const { 'voices/entry_past_001.ogg': _voice, 'art/bg_forgotten_stone_crossing.webp': _bg, ...older } = base;
    expect(builtOnOlderBase(snapshot(older), base)).toBe(true);
    expect(builtOnOlderBase(snapshot({ ...older, 'art/bg_forgotten_stone_crossing.webp': sha('d') }), base)).toBe(true);
  });
  it('never flags a legacy dependent overlay, which inherits undeclared base paths', () => {
    expect(builtOnOlderBase(snapshot({ 'presentation/presentation.json': sha('e') }, { release_id: 'rel_0001', generation: 1 }), base)).toBe(false);
  });
});
