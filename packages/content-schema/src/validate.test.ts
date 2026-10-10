import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ContentValidationError, validateContentSet } from './index';

const ROOT = new URL('../../../content/', import.meta.url).pathname;
const walk = (dir: string, rel = ''): string[] =>
  readdirSync(join(dir, rel)).flatMap((n) => {
    const r = rel ? `${rel}/${n}` : n;
    return statSync(join(dir, r)).isDirectory() ? walk(dir, r) : [r];
  });
const load = (dir: string): Map<string, Uint8Array> => new Map(walk(dir).map((p) => [p, new Uint8Array(readFileSync(join(dir, p)))]));

const overlay = (): Map<string, Uint8Array> => {
  const m = load(join(ROOT, 'base'));
  for (const [k, v] of load(join(ROOT, 'patches/rel_0002_road_forgotten'))) m.set(k, v);
  return m;
};
const enc = new TextEncoder();

describe('validateContentSet', () => {
  it('accepts the base release', () => {
    expect(validateContentSet(load(join(ROOT, 'base')))).toMatchObject({ nodes: 1, units: 3 });
  });
  it('accepts base + patch rel_0002 as one effective set', () => {
    expect(validateContentSet(overlay())).toMatchObject({ nodes: 2, units: 4, scenes: 4 });
  });
  it('rejects an encounter whose enemy unit does not exist', () => {
    const m = overlay();
    const bad = JSON.parse(new TextDecoder().decode(m.get('encounters/tutorial_t2.json')));
    bad.enemies[0].unit_id = 'ghost_unit';
    m.set('encounters/tutorial_t2.json', enc.encode(JSON.stringify(bad)));
    expect(() => validateContentSet(m)).toThrow(ContentValidationError);
  });
  it('rejects a chapter node that needs a patch-only encounter file that is absent', () => {
    const m = overlay();
    m.delete('encounters/tutorial_t2.json');
    expect(() => validateContentSet(m)).toThrow(/missing file encounters\/tutorial_t2.json/);
  });
  it('rejects unknown effect ops smuggled in a unit pack', () => {
    const m = overlay();
    const pack = JSON.parse(new TextDecoder().decode(m.get('units/unit_pack.json')));
    pack.units[0].skills[0].effect_ops.push({ op: 'run_script', code: 'alert(1)' });
    m.set('units/unit_pack.json', enc.encode(JSON.stringify(pack)));
    expect(() => validateContentSet(m)).toThrow(ContentValidationError);
  });
  it('rejects art that points at a file the release does not contain', () => {
    const m = overlay();
    m.delete('art/atlas_hollow_pilgrim.webp');
    expect(() => validateContentSet(m)).toThrow(/missing file art\/atlas_hollow_pilgrim.webp/);
  });
});
