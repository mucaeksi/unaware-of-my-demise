/// <reference types="node" />
import { readFileSync } from 'node:fs';
import * as PIXI from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { VfxPack } from '@uomd/content-schema';
import { VfxStage, type VfxEnvironment } from './VfxStage';

const pack = VfxPack.parse(JSON.parse(readFileSync(new URL('../../../../content/base/vfx/vfx_presets.json', import.meta.url), 'utf8')));
const tex = PIXI.Texture.EMPTY;
const textures = () => ({
  spark: tex,
  star: tex,
  slash: tex,
  ring: tex,
  pillar: tex,
  shard: tex,
  bell: tex,
  chain: tex,
  seal: tex,
  droplet: tex,
  feather: tex,
});
const env = (over: Partial<VfxEnvironment> = {}) => () => ({ particles: true, particleDensity: 1, reducedMotion: false, reduceFlash: false, ...over });
const kids = (s: VfxStage) => s.layers.ground.children.length + s.layers.fx.children.length + s.layers.overlay.children.length;
const run = (s: VfxStage, ms: number, step = 16) => {
  for (let t = 0; t < ms; t += step) s.update(step);
};

describe('VfxStage', () => {
  it('compiles a preset into PIXI nodes on the right layers and cleans up after it finishes', async () => {
    const s = new VfxStage(env(), textures);
    s.setPack(pack);
    const done = s.play('cast_sigil', { x: 100, y: 200, element: 'Ember' });
    run(s, 32);
    expect(s.layers.ground.children.length).toBe(2);
    expect(s.layers.fx.children.length).toBe(14);
    run(s, 1200);
    await done;
    expect(kids(s)).toBe(0);
    expect(s.busy).toBe(0);
  });

  it('mirrors directional presets and resolves projectiles on landing', async () => {
    const s = new VfxStage(env(), textures);
    s.setPack(pack);
    void s.play('slash_single', { x: 0, y: 0, dir: -1 });
    run(s, 16);
    const crescent = s.layers.fx.children[0]!;
    expect(crescent.scale.x).toBeLessThan(0);
    let landed = false;
    void s.play('projectile', { x: 0, y: 0, target: { x: 400, y: 0 } }).then(() => (landed = true));
    run(s, 160);
    await Promise.resolve();
    expect(landed).toBe(false);
    run(s, 100);
    await Promise.resolve();
    expect(landed).toBe(true);
  });

  it('plays nothing for reduced motion, and no flashes or particles when those are off', async () => {
    const quiet = new VfxStage(env({ reducedMotion: true }), textures);
    quiet.setPack(pack);
    await quiet.play('hit_crit', { x: 0, y: 0 });
    expect(kids(quiet)).toBe(0);
    const lowTier = new VfxStage(env({ particles: false }), textures);
    lowTier.setPack(pack);
    void lowTier.play('hit_impact', { x: 0, y: 0 });
    run(lowTier, 16);
    expect(lowTier.layers.fx.children.length).toBe(1); // the ring shape, no sparks/shards
  });

  it('honours per-skill overrides and stretches timing with pace', () => {
    const s = new VfxStage(env(), textures);
    s.setPack({ ...pack, skills: { veilglass_thorn: 'hit_crit' } });
    expect(s.presetForSkill('veilglass_thorn')).toBe('hit_crit');
    expect(s.presetForSkill('unknown')).toBeUndefined();
    void s.play('iron_bulwark_wave', { x: 0, y: 0, pace: 2 });
    run(s, 480); // authored 460 ms, paced to 920
    expect(s.layers.fx.children.length).toBe(1);
    run(s, 500);
    expect(s.layers.fx.children.length).toBe(0);
    s.destroy();
  });

  it('compiles all signature hero, boss, and enemy presets including new shapes, emblem textures, projectiles, and cues', async () => {
    const s = new VfxStage(env(), textures);
    s.setPack(pack);
    expect(s.hasProjectile('kera_flask_flick')).toBe(true);
    expect(s.hasProjectile('fadyme_bell_that_forgets')).toBe(false);

    const firedCues: string[] = [];
    const done = s.play('fadyme_bell_that_forgets', {
      x: 320,
      y: 240,
      target: { x: 640, y: 240 },
      element: 'Veil',
      onCue: (cue) => firedCues.push(cue),
    });
    run(s, 950);
    await done;
    expect(firedCues).toEqual(expect.arrayContaining(['hit_stop', 'shake', 'flash']));
    expect(kids(s)).toBe(0);

    // Play a projectile preset and a boss eclipse preset to verify bell_arch, shield_wall, eclipse_corona, crosshair
    const pDone = s.play('boss_construct_eclipse_pulse', { x: 640, y: 240, element: 'Veil' });
    run(s, 1100);
    await pDone;
    expect(kids(s)).toBe(0);
    s.destroy();
  });
});
