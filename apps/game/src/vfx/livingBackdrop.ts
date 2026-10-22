import * as PIXI from 'pixi.js';
import { REF_H, REF_W } from '../config';
import type { PixiScene } from '../core/PixiScene';
import { qualityProfile } from '../platform/graphics';
import { prefs } from '../platform/prefs';
import { Sparks } from './sparks';
import { vfxTextures } from './textures';

export type LivingBiome =
  | 'forest'
  | 'cathedral'
  | 'forge'
  | 'coast'
  | 'village'
  | 'undercity'
  | 'bridge'
  | 'estate'
  | 'altar'
  | 'world_map';

export interface LivingBackdropOptions {
  /** Base cover scale of the sprite (computed automatically if omitted). */
  baseScale?: number;
  /** Depth for the atmospheric mist/god-rays/sparks overlay (defaults to sprite.zIndex + 1). */
  fxDepth?: number;
  /** Visual mood tint ('ash' | 'eclipse' | 'sanctuary' | 'battle'). */
  mood?: 'ash' | 'eclipse' | 'sanctuary' | 'battle';
  /** Location ID (e.g. 'forest_whispering_ash', 'undercity_cistern', 'altar_first_eclipse') for biome-specific world animation. */
  location?: string;
  /** Motion intensity multiplier (default 1). */
  intensity?: number;
}

let mistTex: PIXI.Texture | null = null;
let rayTex: PIXI.Texture | null = null;
let leafTex: PIXI.Texture | null = null;
let windTex: PIXI.Texture | null = null;

function getMistTexture(): PIXI.Texture {
  if (mistTex && !mistTex.destroyed) return mistTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(256, 80, 12, 256, 80, 240);
    g.addColorStop(0, 'rgba(226, 214, 244, 0.44)');
    g.addColorStop(0.55, 'rgba(184, 162, 216, 0.20)');
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
    g.addColorStop(0, 'rgba(255, 232, 184, 0.38)');
    g.addColorStop(0.45, 'rgba(227, 195, 125, 0.16)');
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

function getLeafTexture(): PIXI.Texture {
  if (leafTex && !leafTex.destroyed) return leafTex;
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 24;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(4, 12, 44, 12);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0.92)');
    g.addColorStop(1, 'rgba(220, 205, 240, 0.15)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.quadraticCurveTo(24, 1, 44, 12);
    ctx.quadraticCurveTo(24, 23, 4, 12);
    ctx.closePath();
    ctx.fill();
  }
  leafTex = PIXI.Texture.from(c);
  return leafTex;
}

function getWindTexture(): PIXI.Texture {
  if (windTex && !windTex.destroyed) return windTex;
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 24;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 12, 384, 12);
    g.addColorStop(0, 'rgba(255, 255, 255, 0)');
    g.addColorStop(0.35, 'rgba(240, 234, 255, 0.42)');
    g.addColorStop(0.7, 'rgba(220, 210, 245, 0.25)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 6, 384, 12);
  }
  windTex = PIXI.Texture.from(c);
  return windTex;
}

/** Resolves a canonical location ID (or mood fallback) to its environmental biome. */
export function resolveLivingBiome(location?: string, mood?: LivingBackdropOptions['mood']): LivingBiome {
  const loc = (location ?? '').toLowerCase();
  if (loc.includes('world_map')) return 'world_map';
  if (loc.includes('altar') || loc.includes('eclipse')) return 'altar';
  if (loc.includes('estate')) return 'estate';
  if (loc.includes('bridge') || loc.includes('mountain') || loc.includes('ravine') || loc.includes('highland_ridge') || loc.includes('highland_road')) return 'bridge';
  if (loc.includes('undercity') || loc.includes('cistern') || loc.includes('red_vial') || loc.includes('antidote') || loc.includes('archive_room')) return 'undercity';
  if (loc.includes('forge') || loc.includes('kiln')) return 'forge';
  if (loc.includes('coast') || loc.includes('river')) return 'coast';
  if (loc.includes('oakhaven')) return 'village';
  if (loc.includes('cathedral') || loc.includes('highland_village') || loc.includes('village_square')) return 'cathedral';
  if (loc.includes('forest') || loc.includes('ash') || loc.includes('crossing') || loc.includes('shelter') || loc.includes('lowland') || loc.includes('orchard')) return 'forest';
  if (mood === 'eclipse') return 'altar';
  if (mood === 'sanctuary') return 'cathedral';
  return 'forest';
}

interface BiomeVisuals {
  rayTint: number;
  mistTint: number;
  sparkTints: number[];
  vx: [number, number];
  vy: [number, number];
  rayCount: number;
  mistCount: number;
}

const BIOME_VISUALS: Record<LivingBiome, BiomeVisuals> = {
  forest: {
    rayTint: 0xe8d8b4,
    mistTint: 0xc9b6e4,
    sparkTints: [0xe6ddf5, 0xc9b6e4, 0xf2dfad, 0x9be8c3],
    vx: [-26, 20],
    vy: [-42, -12],
    rayCount: 4,
    mistCount: 3,
  },
  cathedral: {
    rayTint: 0xffdf9a,
    mistTint: 0xe6d2b5,
    sparkTints: [0xffe8a8, 0xe3c37d, 0xd8c2f0, 0xfff4d4],
    vx: [-14, 14],
    vy: [-36, -10],
    rayCount: 4,
    mistCount: 3,
  },
  forge: {
    rayTint: 0xff9452,
    mistTint: 0xd49b84,
    sparkTints: [0xff6b2b, 0xffaa44, 0xffe07d, 0xff4949],
    vx: [-32, 34],
    vy: [-88, -32],
    rayCount: 3,
    mistCount: 3,
  },
  coast: {
    rayTint: 0xa8dcff,
    mistTint: 0xb8d8f0,
    sparkTints: [0x8cd4ff, 0xcceeff, 0xe0d4f5, 0x9be8c3],
    vx: [18, 64],
    vy: [-28, -6],
    rayCount: 3,
    mistCount: 4,
  },
  village: {
    rayTint: 0xffcf86,
    mistTint: 0xdec8b8,
    sparkTints: [0xffb86c, 0xe3c37d, 0xff8a65, 0xf4ede2],
    vx: [-24, 24],
    vy: [-46, -14],
    rayCount: 3,
    mistCount: 3,
  },
  undercity: {
    rayTint: 0x6ce8d4,
    mistTint: 0x88c8d0,
    sparkTints: [0x5ce6d0, 0xff5c8a, 0x9be8c3, 0xc9b6e4],
    vx: [-16, 16],
    vy: [-48, -14],
    rayCount: 3,
    mistCount: 4,
  },
  bridge: {
    rayTint: 0xc8b8e8,
    mistTint: 0xb8a8d8,
    sparkTints: [0xd8ccf0, 0xe3c37d, 0xff8a65, 0xffffff],
    vx: [38, 96],
    vy: [-58, -16],
    rayCount: 3,
    mistCount: 4,
  },
  estate: {
    rayTint: 0xb898f0,
    mistTint: 0x9c82c8,
    sparkTints: [0x8c78f0, 0xc9b6e4, 0x70d6ff, 0xff7a96],
    vx: [-22, 22],
    vy: [-44, -12],
    rayCount: 4,
    mistCount: 4,
  },
  altar: {
    rayTint: 0xff6b8b,
    mistTint: 0xd998c8,
    sparkTints: [0xff5c82, 0xe3c37d, 0xd988f0, 0xffb36b],
    vx: [-24, 24],
    vy: [-96, -38],
    rayCount: 4,
    mistCount: 3,
  },
  world_map: {
    rayTint: 0xf4dc9c,
    mistTint: 0xd8c8e8,
    sparkTints: [0xffe6a3, 0xe3c37d, 0xc9b6e4, 0xffffff],
    vx: [-18, 22],
    vy: [-30, -8],
    rayCount: 3,
    mistCount: 3,
  },
};

/**
 * Brings any background plate, battlefield, story location, hub sanctuary, or world map to life with
 * biome-specific weather, lighting, drifting foliage/ash, water caustics, acoustic bell rings, and organic camera motion.
 */
export function attachLivingBackdrop(scene: PixiScene, bg: PIXI.Sprite, opts: LivingBackdropOptions = {}): PIXI.Container {
  const fx = new PIXI.Container();
  const depth = opts.fxDepth ?? (bg.zIndex || 0) + 1;
  scene.add(fx, depth);

  const cover = opts.baseScale ?? Math.max(REF_W / (bg.texture.width || REF_W), REF_H / (bg.texture.height || REF_H));
  const mult = opts.intensity ?? 1;
  const startScale = cover * 1.06;
  bg.scale.set(startScale);

  if (prefs().reducedMotion) return fx;

  const biome = resolveLivingBiome(opts.location, opts.mood);
  const vis = BIOME_VISUALS[biome];

  // 1. Multi-axis organic camera drift + breathing zoom on the background plate
  const dx = (biome === 'world_map' ? 22 : 40) * mult;
  const dy = (biome === 'world_map' ? 10 : 16) * mult;
  bg.position.set(REF_W / 2 - dx * 0.5, REF_H / 2 - dy * 0.3);
  scene.anim.to(
    bg,
    {
      x: REF_W / 2 + dx * 0.5,
      y: REF_H / 2 + dy * 0.3,
      scaleX: cover * (1.06 + 0.055 * mult),
      scaleY: cover * (1.06 + 0.055 * mult),
      angle: (biome === 'world_map' ? 0.18 : 0.45) * mult,
    },
    { duration: 8800, yoyo: true, repeat: -1, ease: 'sine.inout' },
  );

  // 2. Swaying atmospheric light shafts / eclipse beams / stained-glass rays
  const rTex = getRayTexture();
  for (let i = 0; i < vis.rayCount; i++) {
    const ray = new PIXI.Sprite(rTex);
    ray.anchor.set(0.5, 0);
    const spacing = REF_W / Math.max(1, vis.rayCount);
    ray.position.set(spacing * (i + 0.5), -50);
    ray.scale.set(2.3 + (i % 2) * 0.5, 2.25);
    ray.angle = -15 + i * 7;
    ray.tint = vis.rayTint;
    ray.blendMode = 'add';
    ray.alpha = 0.09 + (i % 2) * 0.05;
    fx.addChild(ray);
    scene.anim.to(
      ray,
      {
        angle: ray.angle + (i % 2 === 0 ? 7 : -7),
        alpha: ray.alpha + 0.10,
        x: ray.x + (i % 2 === 0 ? 56 : -56),
      },
      { duration: 4800 + i * 1100, yoyo: true, repeat: -1, ease: 'sine.inout' },
    );
  }

  // 3. Multi-layered drifting Gothic mist / fog / sea-spray / cavern vapor veils
  const mTex = getMistTexture();
  for (let i = 0; i < vis.mistCount; i++) {
    const mist = new PIXI.Sprite(mTex);
    mist.anchor.set(0.5);
    const y = 460 + i * 155;
    const dir = i % 2 === 0 ? 1 : -1;
    mist.position.set(REF_W / 2 - dir * 240, y);
    mist.scale.set(4.4 + i * 0.55, 1.5 + i * 0.32);
    mist.tint = vis.mistTint;
    mist.blendMode = 'add';
    mist.alpha = 0.09 + (i % 2) * 0.04;
    fx.addChild(mist);
    scene.anim.to(
      mist,
      { x: REF_W / 2 + dir * 240, alpha: mist.alpha + 0.08, scaleX: mist.scale.x * 1.09 },
      { duration: 7600 + i * 1700, yoyo: true, repeat: -1, ease: 'sine.inout' },
    );
  }

  // 4. Biome-specific living world actors (foliage, bell rings, water ripples, wind squalls, eclipse corona, wraiths)
  const q = qualityProfile();
  const vTex = vfxTextures();

  if (biome === 'forest' || biome === 'village') {
    // Tumbling silver-ash / autumn leaves drifting across the wind
    const lTex = getLeafTexture();
    const leafCount = q.particles ? 9 : 4;
    const leaves: { sp: PIXI.Sprite; vx: number; vy: number; swaySpeed: number; phase: number; rotSpeed: number }[] = [];
    for (let i = 0; i < leafCount; i++) {
      const sp = new PIXI.Sprite(lTex);
      sp.anchor.set(0.5);
      sp.position.set((REF_W / leafCount) * i + 80, (i * 137) % REF_H);
      const sc = 0.42 + (i % 3) * 0.18;
      sp.scale.set(sc, sc * 0.75);
      sp.tint = biome === 'village' ? (i % 2 === 0 ? 0xffb870 : 0xe39b6d) : i % 2 === 0 ? 0xe4daf2 : 0xc9b6e4;
      sp.alpha = 0.48 + (i % 3) * 0.14;
      fx.addChild(sp);
      leaves.push({
        sp,
        vx: (biome === 'village' ? -38 : -46) - (i % 4) * 12,
        vy: 22 + (i % 3) * 11,
        swaySpeed: 1.8 + (i % 3) * 0.6,
        phase: i * 1.3,
        rotSpeed: (i % 2 === 0 ? 1.4 : -1.4) * (0.8 + (i % 3) * 0.3),
      });
    }
    let elapsed = 0;
    scene.onTick((dt) => {
      if (fx.destroyed) return;
      const sec = dt / 1000;
      elapsed += sec;
      for (const l of leaves) {
        l.sp.x += (l.vx + Math.sin(elapsed * l.swaySpeed + l.phase) * 24) * sec;
        l.sp.y += (l.vy + Math.cos(elapsed * l.swaySpeed + l.phase) * 10) * sec;
        l.sp.rotation += l.rotSpeed * sec;
        if (l.sp.x < -60) l.sp.x = REF_W + 50;
        if (l.sp.x > REF_W + 60) l.sp.x = -50;
        if (l.sp.y > REF_H + 50) l.sp.y = -40;
      }
    });
  } else if (biome === 'cathedral') {
    // Acoustic golden bell-resonance rings expanding from the upper cathedral belfry
    for (let i = 0; i < 2; i++) {
      const ring = new PIXI.Sprite(vTex.ring);
      ring.anchor.set(0.5);
      ring.position.set(REF_W * (0.35 + i * 0.3), 240 + i * 40);
      ring.tint = 0xffdf94;
      ring.blendMode = 'add';
      ring.scale.set(0.18);
      ring.alpha = 0.36;
      fx.addChild(ring);
      scene.anim.to(
        ring,
        { scaleX: 1.65 + i * 0.35, scaleY: 0.95 + i * 0.2, alpha: 0 },
        { duration: 4600 + i * 1400, repeat: -1, ease: 'quad.out' },
      );
    }
  } else if (biome === 'undercity' || biome === 'coast') {
    // Expanding water-droplet / tide ripple rings on the floor & shimmering caustic bands
    for (let i = 0; i < 3; i++) {
      const ripple = new PIXI.Sprite(vTex.ring);
      ripple.anchor.set(0.5);
      ripple.position.set(360 + i * 580, 760 + (i % 2) * 90);
      ripple.tint = biome === 'undercity' ? (i % 2 === 0 ? 0x5ce6d0 : 0xff5c8a) : 0x8cd4ff;
      ripple.blendMode = 'add';
      ripple.scale.set(0.12, 0.04);
      ripple.alpha = 0.42;
      fx.addChild(ripple);
      scene.anim.to(
        ripple,
        { scaleX: 0.95, scaleY: 0.28, alpha: 0 },
        { duration: 3400 + i * 950, repeat: -1, ease: 'sine.out' },
      );
    }
  } else if (biome === 'bridge') {
    // High-velocity diagonal wind-squall streaks sweeping across the chasm & mountains
    const wTex = getWindTexture();
    const streaks: { sp: PIXI.Sprite; speed: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const sp = new PIXI.Sprite(wTex);
      sp.anchor.set(0.5);
      sp.position.set((i * 420) % REF_W, 180 + i * 165);
      sp.scale.set(1.2 + (i % 3) * 0.4, 0.9);
      sp.angle = -8;
      sp.tint = 0xd8ccf0;
      sp.blendMode = 'add';
      sp.alpha = 0.22 + (i % 2) * 0.08;
      fx.addChild(sp);
      streaks.push({ sp, speed: 340 + i * 75 });
    }
    scene.onTick((dt) => {
      if (fx.destroyed) return;
      const sec = dt / 1000;
      for (const s of streaks) {
        s.sp.x += s.speed * sec;
        s.sp.y -= s.speed * 0.14 * sec;
        if (s.sp.x > REF_W + 260) {
          s.sp.x = -260;
          s.sp.y = 160 + ((s.sp.y + 310) % (REF_H - 220));
        }
      }
    });
  } else if (biome === 'estate') {
    // Orbiting spectral wraith flames & glinting mirror shards
    const wisps: { sp: PIXI.Sprite; baseX: number; baseY: number; phase: number; speed: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const sp = new PIXI.Sprite(vTex.star);
      sp.anchor.set(0.5);
      const bx = 280 + i * 340;
      const by = 320 + (i % 2) * 220;
      sp.position.set(bx, by);
      sp.scale.set(0.32 + (i % 2) * 0.12);
      sp.tint = i % 2 === 0 ? 0x8c78f0 : 0x70d6ff;
      sp.blendMode = 'add';
      sp.alpha = 0.48;
      fx.addChild(sp);
      wisps.push({ sp, baseX: bx, baseY: by, phase: i * 1.4, speed: 1.5 + (i % 3) * 0.4 });
    }
    let t = 0;
    scene.onTick((dt) => {
      if (fx.destroyed) return;
      t += dt / 1000;
      for (const w of wisps) {
        w.sp.x = w.baseX + Math.sin(t * w.speed + w.phase) * 55;
        w.sp.y = w.baseY + Math.cos(t * w.speed * 1.3 + w.phase) * 32;
        w.sp.alpha = 0.32 + 0.26 * Math.sin(t * 2.4 + w.phase);
      }
    });
  } else if (biome === 'altar' || biome === 'forge') {
    // Pulsing Eclipse Corona / Forge Heart & expanding ritual/heat shockwaves
    const core = new PIXI.Sprite(vTex.ring);
    core.anchor.set(0.5);
    core.position.set(REF_W / 2, biome === 'altar' ? 230 : 720);
    core.tint = biome === 'altar' ? 0xff5c82 : 0xff7b38;
    core.blendMode = 'add';
    core.scale.set(biome === 'altar' ? 0.55 : 0.45);
    core.alpha = 0.34;
    fx.addChild(core);
    scene.anim.to(
      core,
      { scaleX: 1.85, scaleY: biome === 'altar' ? 1.85 : 0.75, alpha: 0, angle: 90 },
      { duration: 4200, repeat: -1, ease: 'sine.out' },
    );
  } else if (biome === 'world_map') {
    // Rotating celestial astrolabe ring over the map center
    const astro = new PIXI.Sprite(vTex.ring);
    astro.anchor.set(0.5);
    astro.position.set(REF_W / 2, REF_H / 2 - 20);
    astro.tint = 0xe3c37d;
    astro.blendMode = 'add';
    astro.scale.set(2.2, 1.25);
    astro.alpha = 0.11;
    fx.addChild(astro);
    scene.anim.to(astro, { angle: 360 }, { duration: 48000, repeat: -1 });
  }

  // 5. Continuous biome-tuned particle stream (ash motes, rising embers, alchemical spores, sea spray)
  if (q.particles && q.particleDensity > 0) {
    const sparks = new Sparks(vTex.spark);
    fx.addChild(sparks);
    sparks.ambient({
      every: Math.max(95, Math.round(200 / q.particleDensity)),
      area: { x: [0, REF_W], y: [140, REF_H + 10] },
      vx: vis.vx,
      vy: vis.vy,
      look: {
        lifespan: 7200,
        scale: [0.06, 0.18],
        randomScale: true,
        alpha: [0.42, 0],
        tint: vis.sparkTints,
      },
    });
    scene.onTick((dt) => {
      if (!fx.destroyed) sparks.update(dt);
    });
  }

  return fx;
}
