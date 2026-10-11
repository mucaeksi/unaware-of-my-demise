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

/** the base release alone: the first-install flow (prologue + tutorials T-1..T-3) */
const overlay = (): Map<string, Uint8Array> => load(join(ROOT, 'base'));
const campaign = (): Map<string, Uint8Array> => {
  const m = load(join(ROOT, 'base'));
  for (const [k, v] of load(join(ROOT, 'patches/rel_0003_part1_campaign'))) m.set(k, v);
  return m;
};
const enc = new TextEncoder();

describe('validateContentSet', () => {
  it('accepts the base release', () => {
    expect(validateContentSet(load(join(ROOT, 'base')))).toMatchObject({ nodes: 3, units: 4 });
  });
  it('accepts base + the Part I campaign (35 stages, the full cast, placeholder art) as one effective set', () => {
    expect(validateContentSet(campaign())).toMatchObject({ chapters: 8, nodes: 38, units: 47 });
  });
  it('rejects a campaign stage that names a guest the unit pack does not contain', () => {
    const m = campaign();
    const bad = JSON.parse(new TextDecoder().decode(m.get('encounters/stage_1_2.json')));
    bad.guests = ['ghost_hero'];
    m.set('encounters/stage_1_2.json', enc.encode(JSON.stringify(bad)));
    expect(() => validateContentSet(m)).toThrow(/unknown guest ghost_hero/);
  });
  it('rejects an encounter whose enemy unit does not exist', () => {
    const m = overlay();
    const bad = JSON.parse(new TextDecoder().decode(m.get('encounters/tutorial_t2.json')));
    bad.enemies[0].unit_id = 'ghost_unit';
    m.set('encounters/tutorial_t2.json', enc.encode(JSON.stringify(bad)));
    expect(() => validateContentSet(m)).toThrow(ContentValidationError);
  });
  it('rejects a chapter node whose encounter file is absent', () => {
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
  it('rejects boss references that point nowhere: summons of unknown units, objectives no phase defines', () => {
    const m = overlay();
    const pack = JSON.parse(new TextDecoder().decode(m.get('units/unit_pack.json')));
    pack.units[0].skills[0].effect_ops.push({ op: 'summon_enemies', target_selector_id: 'self', enemy_id: 'ghost_unit', count: 1 });
    m.set('units/unit_pack.json', enc.encode(JSON.stringify(pack)));
    expect(() => validateContentSet(m)).toThrow(/summons unknown unit ghost_unit/);
    const pack2 = JSON.parse(new TextDecoder().decode(overlay().get('units/unit_pack.json')));
    pack2.units[0].skills[0].telegraph = { player_actions_before_resolution: 1, interrupt_if_objective_destroyed: 'no_such_bell' };
    const m2 = overlay();
    m2.set('units/unit_pack.json', enc.encode(JSON.stringify(pack2)));
    expect(() => validateContentSet(m2)).toThrow(/no_such_bell/);
  });
  it('rejects an entry index that points at a missing or broken tutorial stage, and a prologue whose timing does not add up', () => {
    const m = overlay();
    m.delete('encounters/tutorial_t3.json');
    expect(() => validateContentSet(m)).toThrow(/missing file encounters\/tutorial_t3.json/);
    const m2 = overlay();
    const prologue = JSON.parse(new TextDecoder().decode(m2.get('entry/prologue.json')));
    prologue.scenes[0].duration_seconds += 3;
    m2.set('entry/prologue.json', enc.encode(JSON.stringify(prologue)));
    expect(() => validateContentSet(m2)).toThrow(/scene durations add up/);
    const m3 = overlay();
    const entry = JSON.parse(new TextDecoder().decode(m3.get('entry/entry_index.json')));
    entry.tutorial.push({ stage_id: 't1', encounter: 'encounters/tutorial_t1.json' });
    m3.set('entry/entry_index.json', enc.encode(JSON.stringify(entry)));
    expect(() => validateContentSet(m3)).toThrow(/duplicate stage t1/);
  });
  it('rejects art that points at a file the release does not contain', () => {
    const m = overlay();
    m.delete('art/atlas_hollow_pilgrim.webp');
    expect(() => validateContentSet(m)).toThrow(/missing file art\/atlas_hollow_pilgrim.webp/);
  });
});
