import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VFX_PATH, VfxPack, requiredContentCapabilities } from './index';

const base = JSON.parse(readFileSync(new URL('../../../content/base/vfx/vfx_presets.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const enc = (v: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(v));

describe('data-driven VFX presets', () => {
  it('accepts the base presets the battle plays', () => {
    const pack = VfxPack.parse(base);
    for (const id of ['cast_sigil', 'silver_bell_ripple', 'iron_bulwark_wave', 'slash_single', 'slash_cross', 'slash_heavy', 'pillar_eruption', 'hit_impact', 'hit_heavy', 'hit_crit', 'projectile', 'projectile_heavy']) {
      expect(pack.presets[id], id).toBeDefined();
    }
  });

  it('keeps the grammar closed: no unknown primitives, fields, textures or colour expressions', () => {
    const one = (el: Record<string, unknown>) => VfxPack.safeParse({ schema_version: 1, presets: { pp: { elements: [el] } } }).success;
    expect(one({ kind: 'sprite', texture: 'ring', duration_ms: 100 })).toBe(true);
    expect(one({ kind: 'shader', source: 'void main(){}' })).toBe(false);
    expect(one({ kind: 'sprite', texture: 'https://example.com/a.png', duration_ms: 100 })).toBe(false);
    expect(one({ kind: 'sprite', texture: 'ring', duration_ms: 100, onComplete: 'alert(1)' })).toBe(false);
    expect(one({ kind: 'sprite', texture: 'ring', duration_ms: 100, tint: 'rgb(1,2,3)' })).toBe(false);
    expect(one({ kind: 'burst', texture: 'spark', count: 500, speed: [0, 1], scale: { start: 1, end: 0 }, lifespan_ms: 100, tints: ['core'] })).toBe(false);
  });

  it('rejects skill mappings to presets that do not exist', () => {
    const r = VfxPack.safeParse({ schema_version: 1, presets: { a: { elements: [{ kind: 'sprite', texture: 'ring', duration_ms: 10 }] } }, skills: { some_skill: 'missing' } });
    expect(r.success).toBe(false);
  });

  it('requires the vfx_v1 capability so older binaries refuse such patches before downloading', () => {
    expect(requiredContentCapabilities(new Map([[VFX_PATH, enc(base)]]))).toContain('vfx_v1');
    expect(requiredContentCapabilities(new Map([['story/x.json', enc({})]]))).not.toContain('vfx_v1');
  });
});
