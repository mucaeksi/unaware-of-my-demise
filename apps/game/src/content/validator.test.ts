import { expect, it } from 'vitest';
import { ContentManifest } from '@uomd/content-schema';
import type { BaseContent } from '@uomd/patch';
import shippedManifest from '../../../../content/base/release.json';
import { validatePatch } from './validator';

const manifest = ContentManifest.parse(shippedManifest);
const json = import.meta.glob<string>('../../../../content/base/**/*.json', { eager: true, query: '?raw', import: 'default' });
// Semantic checks need actual JSON and declared media presence, rather than decoded media bytes.
const files = new Map(manifest.files.map((f) => [f.path, f.path.endsWith('.json') ? new TextEncoder().encode(json[`../../../../content/base/${f.path}`]!) : new Uint8Array([0])]));
const base: BaseContent = { releaseId: 'rel_0001', generation: 1, files: Object.fromEntries(manifest.files.map((f) => [f.path, f.sha256])), read: async (path) => files.get(path)! };

it('validates complete snapshots without borrowing missing base references', async () => {
  await expect(validatePatch(files, manifest, base)).resolves.toBeUndefined();
  const incomplete = new Map(files);
  incomplete.delete('units/unit_pack.json');
  await expect(validatePatch(incomplete, manifest, base)).rejects.toThrow('missing file units/unit_pack.json');
});

it('retains embedded-base inheritance only for admitted legacy dependent overlays', async () => {
  const overlay = new Map([['chapters/chapter_index.json', files.get('chapters/chapter_index.json')!]]);
  await expect(validatePatch(overlay, { ...manifest, depends_on: { release_id: base.releaseId, generation: base.generation } }, base)).resolves.toBeUndefined();
});
