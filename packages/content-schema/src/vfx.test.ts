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
    expect(one({ kind: 'sprite', texture: 'bell', duration_ms: 100 })).toBe(true);
    expect(one({ kind: 'shape', shape: 'bell_arch', size: 120, duration_ms: 100 })).toBe(true);
    expect(one({ kind: 'shape', shape: 'eclipse_corona', size: 140, duration_ms: 100 })).toBe(true);
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

  it('maps every non-passive skill across all 25 heroes, 7 bosses, and 20 enemies to a valid signature preset', () => {
    const pack = VfxPack.parse(base);
    const campaignUnits = JSON.parse(
      readFileSync(new URL('../../../content/patches/rel_0003_part1_campaign/units/unit_pack.json', import.meta.url), 'utf8'),
    ) as { units: Array<{ unit_id: string; kind: string; skills: Array<{ skill_id: string; type: string }> }> };
    expect(campaignUnits.units.length).toBe(52);
    for (const u of campaignUnits.units) {
      for (const sk of u.skills) {
        if (sk.type === 'passive') continue;
        const presetId = pack.skills[sk.skill_id];
        expect(presetId, `${u.unit_id}.${sk.skill_id}`).toBeDefined();
        expect(pack.presets[presetId!], `preset ${presetId} for ${u.unit_id}.${sk.skill_id}`).toBeDefined();
      }
    }
  });
});
