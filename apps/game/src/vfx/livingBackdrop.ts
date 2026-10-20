import * as PIXI from 'pixi.js';
import { REF_H, REF_W } from '../config';
import type { PixiScene } from '../core/PixiScene';
import { qualityProfile } from '../platform/graphics';
import { prefs } from '../platform/prefs';
import { Sparks } from './sparks';
import { vfxTextures } from './textures';

export interface LivingBackdropOptions {
  /** Base cover scale of the sprite (computed automatically if omitted). */
  baseScale?: number;
  /** Depth for the atmospheric mist/god-rays/sparks overlay (defaults to sprite.zIndex + 1). */
  fxDepth?: number;
  /** Visual mood tint ('ash' | 'eclipse' | 'sanctuary' | 'battle'). */
  mood?: 'ash' | 'eclipse' | 'sanctuary' | 'battle';
  /** Motion intensity multiplier (default 1). */
  intensity?: number;
}

let mistTex: PIXI.Texture | null = null;
let rayTex: PIXI.Texture | null = null;

function getMistTexture(): PIXI.Texture {
  if (mistTex && !mistTex.destroyed) return mistTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(256, 80, 12, 256, 80, 240);
    g.addColorStop(0, 'rgba(226, 214, 244, 0.42)');
    g.addColorStop(0.55, 'rgba(184, 162, 216, 0.18)');
    g.addColorStop(1, 'rgba(18, 10, 28, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 160);
  }
  mistTex = PIXI.Texture.from(c);
  return mistTex;
}

function getRayTexture(): PIXI.Texture {
  if (rayTex && !rayTex.destroyed) return rayTex;
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, 'rgba(255, 232, 184, 0.36)');
    g.addColorStop(0.45, 'rgba(227, 195, 125, 0.14)');
    g.addColorStop(1, 'rgba(227, 195, 125, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(64, 0);
    ctx.lineTo(128, 0);
    ctx.lineTo(192, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();
  }
  rayTex = PIXI.Texture.from(c);
  return rayTex;
}

/**
 * Brings any static background plate or CG to life with:
 * 1. Continuous organic camera breathing, horizontal/vertical pan, and subtle pendulum sway.
 * 2. Multi-layered drifting Gothic mist ribbons across the horizon and foreground.
 * 3. Swaying eclipse/sanctuary god-rays and ambient light pulsing.
 * 4. Rising silver ash and warm golden ember motes.
 */
export function attachLivingBackdrop(scene: PixiScene, bg: PIXI.Sprite, opts: LivingBackdropOptions = {}): PIXI.Container {
  const fx = new PIXI.Container();
  const depth = opts.fxDepth ?? (bg.zIndex || 0) + 1;
  scene.add(fx, depth);

  const cover = opts.baseScale ?? Math.max(REF_W / (bg.texture.width || REF_W), REF_H / (bg.texture.height || REF_H));
  const mult = opts.intensity ?? 1;
  const startScale = cover * 1.055;
  bg.scale.set(startScale);

  if (prefs().reducedMotion) return fx;

  // 1. Noticeable, fluid multi-axis camera motion on the background plate
  const dx = 36 * mult;
  const dy = 14 * mult;
  bg.position.set(REF_W / 2 - dx * 0.5, REF_H / 2 - dy * 0.3);
  scene.anim.to(
    bg,
    {
      x: REF_W / 2 + dx * 0.5,
      y: REF_H / 2 + dy * 0.3,
      scaleX: cover * (1.055 + 0.055 * mult),
      scaleY: cover * (1.055 + 0.055 * mult),
      angle: 0.42 * mult
    },
    { duration: 9200, yoyo: true, repeat: -1, ease: 'sine.inout' }
  );

  const q = qualityProfile();
  const mood = opts.mood ?? 'ash';
  const rayTint = mood === 'eclipse' ? 0xff7a96 : mood === 'battle' ? 0xe3c37d : 0xf2dfad;
  const mistTint = mood === 'eclipse' ? 0xd9b8ee : mood === 'sanctuary' ? 0xe8d9c0 : 0xc9b6e4;

  // 2. Swaying atmospheric god-rays / eclipse shafts from above
  const rTex = getRayTexture();
  for (let i = 0; i < 3; i++) {
    const ray = new PIXI.Sprite(rTex);
    ray.anchor.set(0.5, 0);
    ray.position.set(360 + i * 580, -40);
    ray.scale.set(2.4 + i * 0.4, 2.2);
    ray.angle = -14 + i * 7;
    ray.tint = rayTint;
    ray.blendMode = 'add';
    ray.alpha = 0.08 + (i % 2) * 0.05;
    fx.addChild(ray);
    scene.anim.to(
      ray,
      { angle: ray.angle + (i % 2 === 0 ? 6 : -6), alpha: ray.alpha + 0.09, x: ray.x + (i % 2 === 0 ? 48 : -48) },
      { duration: 5400 + i * 1300, yoyo: true, repeat: -1, ease: 'sine.inout' }
    );
  }

  // 3. Drifting horizontal mist / fog veils across the mid and lower ground
  const mTex = getMistTexture();
  for (let i = 0; i < 3; i++) {
    const mist = new PIXI.Sprite(mTex);
    mist.anchor.set(0.5);
    const y = 520 + i * 165;
    const dir = i % 2 === 0 ? 1 : -1;
    mist.position.set(REF_W / 2 - dir * 220, y);
    mist.scale.set(4.2 + i * 0.6, 1.5 + i * 0.35);
    mist.tint = mistTint;
    mist.blendMode = 'add';
    mist.alpha = 0.09 + (i % 2) * 0.04;
    fx.addChild(mist);
    scene.anim.to(
      mist,
      { x: REF_W / 2 + dir * 220, alpha: mist.alpha + 0.07, scaleX: mist.scale.x * 1.08 },
      { duration: 8400 + i * 1900, yoyo: true, repeat: -1, ease: 'sine.inout' }
    );
  }

  // 4. Drifting ash motes & rising golden embers
  if (q.particles && q.particleDensity > 0) {
    const sparks = new Sparks(vfxTextures().spark);
    fx.addChild(sparks);
    sparks.ambient({
      every: Math.max(120, Math.round(240 / q.particleDensity)),
      area: { x: [0, REF_W], y: [180, REF_H + 10] },
      vx: [-22, 18],
      vy: [-54, -18],
      look: {
        lifespan: 7500,
        scale: [0.05, 0.16],
        randomScale: true,
        alpha: [0.38, 0],
        tint: [0xc9b6e4, 0xe3c37d, 0xff9eb5, 0xf4ede2]
      }
    });
    scene.onTick((dt) => {
      if (!fx.destroyed) sparks.update(dt);
    });
  }

  return fx;
}
