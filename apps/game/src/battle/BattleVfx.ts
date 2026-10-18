import * as PIXI from 'pixi.js';
import type { PixiScene } from '../core/PixiScene';
import { REF_W } from '../config';
import { qualityProfile } from '../platform/graphics';
import { prefs } from '../platform/prefs';
import { Services } from '../services';
import { DEPTH, F, T } from '../ui/theme';
import { playCutIn } from '../vfx/cutIn';
import { vfxTextures } from '../vfx/textures';
import { VfxStage, type PlayOptions } from '../vfx/VfxStage';

export interface ElementPalette {
  primary: number;
  secondary: number;
  core: number;
  hex: string;
}

/** UI colours for units/HUD (the effect palettes themselves are data in vfx/vfx_presets.json) */
const PALETTES: Readonly<Record<string, ElementPalette>> = {
  Veil: { primary: 0xb98eff, secondary: 0xe55b8a, core: 0xf4e8ff, hex: '#d7b8ff' },
  Stone: { primary: 0xe8c478, secondary: 0xb88942, core: 0xfff3d1, hex: '#f5d792' },
  Ember: { primary: 0xff6b3d, secondary: 0xffb84d, core: 0xfff0c2, hex: '#ff8a54' },
  Tide: { primary: 0x52c4ff, secondary: 0x3b78ff, core: 0xe0f7ff, hex: '#7dd4ff' },
  Gale: { primary: 0x6ef2b8, secondary: 0x2ec492, core: 0xe8fff5, hex: '#88f7c8' },
  Dawn: { primary: 0xffe48f, secondary: 0xffa8c5, core: 0xffffff, hex: '#fff0b8' }
};

const HIT_STOP_SCALE = 0.06;
const stages = new WeakMap<PixiScene, VfxStage>();

/** one pure-PIXI VFX stage per scene: ground layer under the units, fx over them, overlay for cut-ins */
function stageFor(scene: PixiScene): VfxStage {
  const existing = stages.get(scene);
  if (existing) return existing;
  const stage = new VfxStage(() => {
    const q = qualityProfile();
    const p = prefs();
    return { particles: q.particles, particleDensity: q.particleDensity, reducedMotion: p.reducedMotion, reduceFlash: p.reduceFlash };
  });
  scene.add(stage.layers.ground, DEPTH.units - 2);
  scene.add(stage.layers.fx, DEPTH.fx + 1);
  scene.add(stage.layers.overlay, DEPTH.modal - 8);
  scene.onTick((dt) => stage.update(dt));
  scene.onClose(() => {
    stages.delete(scene);
    stage.destroy();
  });
  stages.set(scene, stage);
  void (Services.content?.vfx() ?? Promise.resolve(null))
    .then((pack) => stage.setPack(pack))
    .catch((e: unknown) => console.warn('vfx presets unavailable; effects are skipped', e));
  return stage;
}

/**
 * Battle VFX facade (D-25): the same calls BattleScene always made, now played by the data-driven pure-PIXI
 * VfxStage from content presets (vfx/vfx_presets.json). Hit-stop stays a scene-level time effect.
 */
export class BattleVfx {
  static palette(element?: string): ElementPalette {
    return (element && PALETTES[element]) || PALETTES.Veil!;
  }

  /** creates the scene's VFX stage, loads the presets and warms the procedural textures */
  static ensureTextures(scene: PixiScene): void {
    stageFor(scene);
    vfxTextures();
  }

  /** preset the content pack assigns to this skill, if any */
  static skillPreset(scene: PixiScene, skillId: string): string | undefined {
    return stageFor(scene).presetForSkill(skillId);
  }

  static playPreset(scene: PixiScene, id: string, o: PlayOptions): Promise<void> {
    return stageFor(scene).play(id, o);
  }

  /** durationMs stretches the authored 680 ms sigil (ultimates use a slower one) */
  static castSigil(scene: PixiScene, x: number, y: number, element?: string, scale = 1, durationMs = 680): void {
    void stageFor(scene).play('cast_sigil', { x, y, element, scale, pace: durationMs / 680 });
  }

  static silverBellRipple(scene: PixiScene, x: number, y: number, scale = 1): void {
    void stageFor(scene).play('silver_bell_ripple', { x, y, scale });
  }

  static ironBulwarkWave(scene: PixiScene, x: number, y: number, scale = 1): void {
    void stageFor(scene).play('iron_bulwark_wave', { x, y, scale });
  }

  /** brief anime hit-stop: slows the scene's animator (and with it the VFX stage) for a few real-time frames */
  static hitStop(scene: PixiScene, durationMs = 55): void {
    if (prefs().reducedMotion) return;
    const base = scene.anim.timeScale;
    if (base <= HIT_STOP_SCALE) return;
    scene.anim.timeScale = HIT_STOP_SCALE;
    window.setTimeout(() => {
      // a speed change or the pause menu during the stop owns the scale now
      if (scene.live && scene.anim.timeScale === HIT_STOP_SCALE) scene.anim.timeScale = base;
    }, durationMs);
  }

  static projectile(scene: PixiScene, fromX: number, fromY: number, toX: number, toY: number, element?: string, heavy = false): Promise<void> {
    return stageFor(scene).play(heavy ? 'projectile_heavy' : 'projectile', { x: fromX, y: fromY, target: { x: toX, y: toY }, element });
  }

  static slashImpact(scene: PixiScene, x: number, y: number, element?: string, mode: 'single' | 'cross' | 'heavy' = 'single', fromLeft = true): void {
    void stageFor(scene).play(`slash_${mode}`, { x, y, element, dir: fromLeft ? 1 : -1 });
  }

  static pillarEruption(scene: PixiScene, x: number, groundY: number, element?: string, scale = 1): void {
    void stageFor(scene).play('pillar_eruption', { x, y: groundY, element, scale });
  }

  static hitImpact(scene: PixiScene, x: number, y: number, element?: string, isCrit = false, isHeavy = false): void {
    void stageFor(scene).play(isCrit ? 'hit_crit' : isHeavy ? 'hit_heavy' : 'hit_impact', { x, y, element });
  }

  /** anime ultimate cut-in for any hero or boss (pure PIXI, see vfx/cutIn.ts) */
  static ultimateCutIn(
    scene: PixiScene,
    opts: { unitName: string; skillName: string; element?: string; side: 'player' | 'enemy'; portraitKey: string | null; flipPortrait?: boolean; poseTexture: PIXI.Texture }
  ): Promise<void> {
    if (prefs().reducedMotion || prefs().reduceFlash) return Promise.resolve();
    const stage = stageFor(scene);
    let art: PIXI.Texture = opts.poseTexture;
    let isPortrait = false;
    const base = opts.portraitKey ? scene.tex(opts.portraitKey) : PIXI.Texture.EMPTY;
    if (base !== PIXI.Texture.EMPTY) {
      // waist-up bust: top 68 % of the knee-up portrait, so the band's bottom edge frames it
      art = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(base.frame.x, base.frame.y, base.frame.width, Math.round(base.frame.height * 0.68)) });
      isPortrait = true;
    }
    if (art === PIXI.Texture.EMPTY) return Promise.resolve();
    const pal = BattleVfx.palette(opts.element);
    const ownsArt = isPortrait ? art : null;
    return playCutIn(stage.layers.overlay, stage.animator, {
      unitName: opts.unitName,
      skillName: opts.skillName,
      side: opts.side,
      palette: pal,
      art,
      isPortrait,
      flip: opts.flipPortrait ?? (opts.side !== 'player' && isPortrait),
      stageWidth: REF_W,
      fonts: { display: F.display },
      gold: T.gold
    }).finally(() => ownsArt?.destroy(false));
  }
}
