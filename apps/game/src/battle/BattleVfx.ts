import Phaser from '../engine';
import { REF_W } from '../config';
import { qualityProfile } from '../platform/graphics';
import { prefs } from '../platform/prefs';
import { txt } from '../ui/kit';
import { DEPTH, F, T } from '../ui/theme';

export interface ElementPalette {
  primary: number;
  secondary: number;
  core: number;
  hex: string;
}

const PALETTES: Readonly<Record<string, ElementPalette>> = {
  Veil: { primary: 0xb98eff, secondary: 0xe55b8a, core: 0xf4e8ff, hex: '#d7b8ff' },
  Stone: { primary: 0xe8c478, secondary: 0xb88942, core: 0xfff3d1, hex: '#f5d792' },
  Ember: { primary: 0xff6b3d, secondary: 0xffb84d, core: 0xfff0c2, hex: '#ff8a54' },
  Tide: { primary: 0x52c4ff, secondary: 0x3b78ff, core: 0xe0f7ff, hex: '#7dd4ff' },
  Gale: { primary: 0x6ef2b8, secondary: 0x2ec492, core: 0xe8fff5, hex: '#88f7c8' },
  Dawn: { primary: 0xffe48f, secondary: 0xffa8c5, core: 0xffffff, hex: '#fff0b8' },
};

/**
 * Universal procedural Chibi combat VFX & anime cut-in engine for all playable heroes, enemies, and bosses.
 */
export class BattleVfx {
  static palette(element?: string): ElementPalette {
    return (element && PALETTES[element]) || PALETTES.Veil!;
  }

  /** Lazily generates all procedural GPU textures needed for slashes, magic sigils, pillars, and star-flares. */
  static ensureTextures(scene: Phaser.Scene): void {
    const tex = scene.textures;

    if (!tex.exists('fx_spark')) {
      const c = tex.createCanvas('fx_spark', 64, 64);
      if (c) {
        const ctx = c.getContext();
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        c.refresh();
      }
    }

    if (!tex.exists('fx_star')) {
      const c = tex.createCanvas('fx_star', 96, 96);
      if (c) {
        const ctx = c.getContext();
        const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 44);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 96, 96);

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        for (const rot of [0, Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4]) {
          ctx.save();
          ctx.translate(48, 48);
          ctx.rotate(rot);
          const len = rot % (Math.PI / 2) === 0 ? 46 : 26;
          const thick = rot % (Math.PI / 2) === 0 ? 5.5 : 3;
          ctx.beginPath();
          ctx.moveTo(0, -len);
          ctx.quadraticCurveTo(thick, 0, 0, len);
          ctx.quadraticCurveTo(-thick, 0, 0, -len);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        c.refresh();
      }
    }

    if (!tex.exists('fx_slash')) {
      const c = tex.createCanvas('fx_slash', 256, 128);
      if (c) {
        const ctx = c.getContext();
        ctx.save();
        // Outer glow crescent
        const grad = ctx.createLinearGradient(16, 64, 240, 64);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.2, 'rgba(255,255,255,0.75)');
        grad.addColorStop(0.55, 'rgba(255,255,255,1)');
        grad.addColorStop(0.85, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(12, 96);
        ctx.quadraticCurveTo(128, 4, 244, 88);
        ctx.quadraticCurveTo(132, 46, 12, 96);
        ctx.closePath();
        ctx.fill();

        // Razor-bright inner core
        ctx.fillStyle = 'rgba(255,255,255,0.98)';
        ctx.beginPath();
        ctx.moveTo(36, 86);
        ctx.quadraticCurveTo(128, 18, 224, 80);
        ctx.quadraticCurveTo(130, 36, 36, 86);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        c.refresh();
      }
    }

    if (!tex.exists('fx_ring')) {
      const c = tex.createCanvas('fx_ring', 256, 256);
      if (c) {
        const ctx = c.getContext();
        ctx.save();
        ctx.translate(128, 128);
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 114, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 96, 0, Math.PI * 2);
        ctx.stroke();

        // 8-point gothic astrolabe star geometry inside ring
        ctx.strokeStyle = 'rgba(255,255,255,0.48)';
        ctx.lineWidth = 2;
        for (let k = 0; k < 2; k++) {
          ctx.save();
          ctx.rotate((k * Math.PI) / 4);
          ctx.strokeRect(-68, -68, 136, 136);
          ctx.restore();
        }
        // Rune ticks around circumference
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 16; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 8);
          ctx.fillRect(-2, -112, 4, i % 2 === 0 ? 14 : 8);
          ctx.restore();
        }
        ctx.restore();
        c.refresh();
      }
    }

    if (!tex.exists('fx_pillar')) {
      const c = tex.createCanvas('fx_pillar', 128, 512);
      if (c) {
        const ctx = c.getContext();
        const hg = ctx.createLinearGradient(0, 0, 128, 0);
        hg.addColorStop(0, 'rgba(255,255,255,0)');
        hg.addColorStop(0.28, 'rgba(255,255,255,0.55)');
        hg.addColorStop(0.5, 'rgba(255,255,255,1)');
        hg.addColorStop(0.72, 'rgba(255,255,255,0.55)');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(0, 0, 128, 512);

        ctx.globalCompositeOperation = 'destination-in';
        const vg = ctx.createLinearGradient(0, 0, 0, 512);
        vg.addColorStop(0, 'rgba(255,255,255,0)');
        vg.addColorStop(0.18, 'rgba(255,255,255,0.9)');
        vg.addColorStop(0.88, 'rgba(255,255,255,1)');
        vg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, 128, 512);
        ctx.globalCompositeOperation = 'source-over';
        c.refresh();
      }
    }

    if (!tex.exists('fx_shard')) {
      const c = tex.createCanvas('fx_shard', 48, 48);
      if (c) {
        const ctx = c.getContext();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.moveTo(24, 2);
        ctx.lineTo(38, 24);
        ctx.lineTo(24, 46);
        ctx.lineTo(10, 24);
        ctx.closePath();
        ctx.fill();
        c.refresh();
      }
    }
  }

  /** Spawns a spinning perspective-flattened gothic spell sigil under a unit's feet with rising elemental motes. */
  static castSigil(scene: Phaser.Scene, x: number, y: number, element?: string, scale = 1, duration = 680): void {
    if (prefs().reducedMotion || prefs().reduceFlash) return;
    this.ensureTextures(scene);
    const pal = this.palette(element);

    const outer = scene.add
      .image(x, y + 6, 'fx_ring')
      .setTint(pal.primary)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.units - 2)
      .setScale(0.2 * scale, 0.09 * scale)
      .setAlpha(0.95);
    const inner = scene.add
      .image(x, y + 6, 'fx_ring')
      .setTint(pal.core)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.units - 1)
      .setScale(0.12 * scale, 0.055 * scale)
      .setAlpha(0.9);

    scene.tweens.add({
      targets: outer,
      scaleX: 1.15 * scale,
      scaleY: 0.48 * scale,
      angle: 140,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => outer.destroy(),
    });
    scene.tweens.add({
      targets: inner,
      scaleX: 0.78 * scale,
      scaleY: 0.32 * scale,
      angle: -180,
      alpha: 0,
      duration: duration * 0.9,
      ease: 'Cubic.easeOut',
      onComplete: () => inner.destroy(),
    });

    const q = qualityProfile();
    if (q.particles && q.particleDensity > 0) {
      const em = scene.add
        .particles(x, y, 'fx_star', {
          x: { min: -75 * scale, max: 75 * scale },
          y: { min: -16, max: 16 },
          speedY: { min: -220, max: -90 },
          speedX: { min: -30, max: 30 },
          scale: { start: 0.36 * scale, end: 0 },
          alpha: { start: 0.95, end: 0 },
          lifespan: 540,
          tint: [pal.primary, pal.secondary, pal.core],
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(DEPTH.fx);
      em.explode(Math.max(6, Math.round(14 * q.particleDensity)));
      scene.time.delayedCall(620, () => em.destroy());
    }
  }

  /** Fadyme's signature Silver Warding Bell acoustic wave: concentric silver-violet ripple rings + floating bell star motes. */
  static silverBellRipple(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
    if (prefs().reducedMotion || prefs().reduceFlash) return;
    this.ensureTextures(scene);
    const colors = [0xf4e8ff, 0xd7b8ff, 0x9b72f2];
    colors.forEach((col, idx) => {
      scene.time.delayedCall(idx * 65, () => {
        const ring = scene.add
          .image(x, y, 'fx_ring')
          .setTint(col)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH.fx + 16 + idx)
          .setScale(0.18 * scale)
          .setAlpha(0.92);
        scene.tweens.add({
          targets: ring,
          scale: (0.95 + idx * 0.28) * scale,
          angle: idx % 2 === 0 ? 90 : -90,
          alpha: 0,
          duration: 520 + idx * 60,
          ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy(),
        });
      });
    });

    const q = qualityProfile();
    if (q.particles && q.particleDensity > 0) {
      const notes = scene.add
        .particles(x, y, 'fx_star', {
          speed: { min: 70, max: 210 * scale },
          angle: { min: 0, max: 360 },
          scale: { start: 0.42 * scale, end: 0 },
          alpha: { start: 0.95, end: 0 },
          lifespan: 580,
          tint: [0xf4e8ff, 0xd7b8ff, 0xe3c37d],
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(DEPTH.fx + 20);
      notes.explode(Math.max(6, Math.round(14 * q.particleDensity)));
      scene.time.delayedCall(640, () => notes.destroy());
    }
  }

  /** Mahmut's signature Crown Guard Iron Bulwark crest: oxblood-and-gold 8-point geometric shield burst & ground shockwave. */
  static ironBulwarkWave(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
    if (prefs().reducedMotion || prefs().reduceFlash) return;
    this.ensureTextures(scene);
    const crest = scene.add.graphics().setPosition(x, y).setDepth(DEPTH.fx + 18);
    crest.lineStyle(5, 0xe8c478, 0.95);
    crest.strokeCircle(0, 0, 56 * scale);
    crest.lineStyle(3, 0xb83b4a, 0.88);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      crest.lineBetween(
        Math.cos(a) * 26 * scale,
        Math.sin(a) * 26 * scale,
        Math.cos(a) * 76 * scale,
        Math.sin(a) * 76 * scale,
      );
    }
    crest.setScale(0.35);
    scene.tweens.add({
      targets: crest,
      scale: 1.25 * scale,
      angle: 22.5,
      alpha: 0,
      duration: 460,
      ease: 'Back.easeOut',
      onComplete: () => crest.destroy(),
    });
  }

  /** Brief anime hit-stop freeze on heavy/critical/ultimate impacts to give tactile weight to blows. */
  static hitStop(scene: Phaser.Scene, durationMs = 55): void {
    if (prefs().reducedMotion) return;
    const baseScale = scene.time.timeScale || 1;
    scene.tweens.timeScale = 0.06;
    window.setTimeout(() => {
      if (scene.sys?.isActive()) {
        scene.tweens.timeScale = scene.time.timeScale || baseScale;
      }
    }, durationMs);
  }

  /** Fires a glowing elemental projectile with a curved arc and particle contrail from caster to target. */
  static projectile(
    scene: Phaser.Scene,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    element?: string,
    heavy = false,
  ): Promise<void> {
    if (prefs().reducedMotion) return Promise.resolve();
    this.ensureTextures(scene);
    const pal = this.palette(element);
    const sc = heavy ? 1.35 : 1;

    return new Promise((resolve) => {
      const orb = scene.add
        .image(fromX, fromY, 'fx_star')
        .setTint(pal.core)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.65 * sc)
        .setDepth(DEPTH.fx + 20);
      const halo = scene.add
        .image(fromX, fromY, 'fx_spark')
        .setTint(pal.primary)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1.45 * sc)
        .setDepth(DEPTH.fx + 19);

      const q = qualityProfile();
      const trail =
        q.particles && q.particleDensity > 0
          ? scene.add
              .particles(0, 0, 'fx_shard', {
                follow: orb,
                speed: { min: 20, max: 80 },
                scale: { start: 0.34 * sc, end: 0 },
                alpha: { start: 0.85, end: 0 },
                rotate: { min: 0, max: 360 },
                lifespan: 260,
                frequency: 16,
                tint: [pal.primary, pal.secondary, pal.core],
                blendMode: 'ADD',
              })
              .setDepth(DEPTH.fx + 18)
          : null;

      const midX = (fromX + toX) / 2;
      const midY = Math.min(fromY, toY) - (heavy ? 110 : 65);
      const state = { t: 0 };

      scene.tweens.add({
        targets: state,
        t: 1,
        duration: heavy ? 250 : 195,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          const u = 1 - state.t;
          const x = u * u * fromX + 2 * u * state.t * midX + state.t * state.t * toX;
          const y = u * u * fromY + 2 * u * state.t * midY + state.t * state.t * toY;
          orb.setPosition(x, y).setRotation(state.t * Math.PI * 3);
          halo.setPosition(x, y);
        },
        onComplete: () => {
          orb.destroy();
          halo.destroy();
          if (trail) {
            trail.stop();
            scene.time.delayedCall(300, () => trail.destroy());
          }
          resolve();
        },
      });
    });
  }

  /** Renders dynamic multi-layered crescent weapon slashes, cross-cleaves, and impact flares at the target. */
  static slashImpact(
    scene: Phaser.Scene,
    x: number,
    y: number,
    element?: string,
    mode: 'single' | 'cross' | 'heavy' = 'single',
    fromLeft = true,
  ): void {
    if (prefs().reducedMotion || prefs().reduceFlash) return;
    this.ensureTextures(scene);
    const pal = this.palette(element);
    const dir = fromLeft ? 1 : -1;

    const angles =
      mode === 'cross'
        ? [-32 * dir, 34 * dir]
        : mode === 'heavy'
          ? [-24 * dir, 18 * dir, -4 * dir]
          : [-28 * dir];

    angles.forEach((deg, idx) => {
      const delay = idx * 45;
      scene.time.delayedCall(delay, () => {
        // High-contrast procedural Graphics crescent slash + inner core so it renders crisply on every GPU/renderer
        const arc = scene.add.graphics().setPosition(x, y).setDepth(DEPTH.fx + 32 + idx).setAngle(deg);
        const span = mode === 'heavy' ? 175 : mode === 'cross' ? 148 : 130;
        const bow = (mode === 'heavy' ? -64 : -50) * dir;
        arc.fillStyle(idx % 2 === 0 ? pal.primary : pal.secondary, 0.92);
        arc.beginPath();
        arc.moveTo(-span, 24);
        const steps = 16;
        for (let s = 1; s <= steps; s++) {
          const u = s / steps;
          const px = -span + u * span * 2;
          const py = 24 * (1 - u) * (1 - u) + 2 * (1 - u) * u * bow + 24 * u * u;
          arc.lineTo(px, py);
        }
        for (let s = steps - 1; s >= 0; s--) {
          const u = s / steps;
          const px = -span + u * span * 2;
          const py = 24 * (1 - u) * (1 - u) + 2 * (1 - u) * u * (bow * 0.42) + 24 * u * u;
          arc.lineTo(px, py);
        }
        arc.closePath();
        arc.fillPath();

        arc.fillStyle(pal.core, 0.98);
        arc.beginPath();
        const innerSpan = span * 0.84;
        arc.moveTo(-innerSpan, 18);
        for (let s = 1; s <= steps; s++) {
          const u = s / steps;
          const px = -innerSpan + u * innerSpan * 2;
          const py = 18 * (1 - u) * (1 - u) + 2 * (1 - u) * u * (bow * 0.82) + 18 * u * u;
          arc.lineTo(px, py);
        }
        for (let s = steps - 1; s >= 0; s--) {
          const u = s / steps;
          const px = -innerSpan + u * innerSpan * 2;
          const py = 18 * (1 - u) * (1 - u) + 2 * (1 - u) * u * (bow * 0.52) + 18 * u * u;
          arc.lineTo(px, py);
        }
        arc.closePath();
        arc.fillPath();

        arc.setScale(0.45, 0.45);
        const targetScaleX = mode === 'heavy' ? 1.45 : mode === 'cross' ? 1.25 : 1.12;
        const targetScaleY = mode === 'heavy' ? 1.35 : 1.15;

        scene.tweens.add({
          targets: arc,
          scaleX: targetScaleX,
          scaleY: targetScaleY,
          angle: deg + 20 * dir,
          duration: 280,
          ease: 'Back.easeOut',
        });
        scene.tweens.add({
          targets: arc,
          alpha: 0,
          delay: 190,
          duration: 180,
          ease: 'Quad.easeIn',
          onComplete: () => arc.destroy(),
        });
      });
    });

    // Center 4-point star-flare flash
    const flare = scene.add.graphics().setPosition(x, y).setDepth(DEPTH.fx + 42);
    flare.fillStyle(pal.primary, 0.85);
    flare.fillCircle(0, 0, mode === 'heavy' ? 42 : 28);
    flare.fillStyle(pal.core, 0.98);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const len = i % 2 === 0 ? (mode === 'heavy' ? 115 : 82) : (mode === 'heavy' ? 88 : 64);
      flare.beginPath();
      flare.moveTo(Math.cos(a) * len, Math.sin(a) * len);
      flare.lineTo(Math.cos(a + Math.PI / 2) * 10, Math.sin(a + Math.PI / 2) * 10);
      flare.lineTo(-Math.cos(a) * len, -Math.sin(a) * len);
      flare.lineTo(Math.cos(a - Math.PI / 2) * 10, Math.sin(a - Math.PI / 2) * 10);
      flare.closePath();
      flare.fillPath();
    }
    flare.setScale(0.35);
    scene.tweens.add({
      targets: flare,
      scale: mode === 'heavy' ? 1.35 : 1.05,
      angle: 45,
      duration: 240,
      ease: 'Back.easeOut',
    });
    scene.tweens.add({
      targets: flare,
      alpha: 0,
      delay: 170,
      duration: 170,
      ease: 'Quad.easeIn',
      onComplete: () => flare.destroy(),
    });
  }

  /** Erupts a vertical elemental energy pillar + dual ground shockwaves (used on Active & Ultimate skills). */
  static pillarEruption(scene: Phaser.Scene, x: number, groundY: number, element?: string, scale = 1): void {
    if (prefs().reducedMotion || prefs().reduceFlash) return;
    this.ensureTextures(scene);
    const pal = this.palette(element);

    const pillar = scene.add.graphics().setPosition(x, groundY + 18).setDepth(DEPTH.fx + 14);
    pillar.fillStyle(pal.primary, 0.55);
    pillar.fillRect(-72 * scale, -560 * scale, 144 * scale, 560 * scale);
    pillar.fillStyle(pal.secondary, 0.72);
    pillar.fillRect(-44 * scale, -560 * scale, 88 * scale, 560 * scale);
    pillar.fillStyle(pal.core, 0.95);
    pillar.fillRect(-20 * scale, -560 * scale, 40 * scale, 560 * scale);
    pillar.setScale(0.25, 0.35);

    scene.tweens.add({
      targets: pillar,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 240,
      ease: 'Back.easeOut',
    });
    scene.tweens.add({
      targets: pillar,
      scaleX: 0.15,
      alpha: 0,
      delay: 260,
      duration: 280,
      ease: 'Quad.easeIn',
      onComplete: () => pillar.destroy(),
    });

    this.castSigil(scene, x, groundY, element, scale * 1.25, 620);
  }

  /** Rich multi-particle impact burst + radial anime speed spikes on critical/heavy hits. */
  static hitImpact(
    scene: Phaser.Scene,
    x: number,
    y: number,
    element?: string,
    isCrit = false,
    isHeavy = false,
  ): void {
    const q = qualityProfile();
    if (prefs().reducedMotion || prefs().reduceFlash) return;
    this.ensureTextures(scene);
    const pal = this.palette(element);

    // Expanding double shockwave ring
    const ring = scene.add.graphics().setPosition(x, y).setDepth(DEPTH.fx + 22);
    ring.lineStyle(isCrit ? 7 : 5, isCrit ? 0xffe48f : pal.primary, 0.95);
    ring.strokeCircle(0, 0, 72);
    ring.lineStyle(3, pal.core, 0.85);
    ring.strokeCircle(0, 0, 52);
    ring.setScale(0.25);
    scene.tweens.add({
      targets: ring,
      scale: isCrit ? 1.85 : isHeavy ? 1.45 : 1.15,
      duration: isCrit ? 360 : 280,
      ease: 'Cubic.easeOut',
    });
    scene.tweens.add({
      targets: ring,
      alpha: 0,
      delay: 160,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => ring.destroy(),
    });

    // Radial anime impact spikes on crits or heavy hits
    if (isCrit || isHeavy) {
      const g = scene.add.graphics().setDepth(DEPTH.fx + 25);
      g.setPosition(x, y);
      const spikes = isCrit ? 12 : 8;
      for (let i = 0; i < spikes; i++) {
        const a = (i * Math.PI * 2) / spikes + (i % 2 === 0 ? 0.12 : -0.08);
        const r0 = 22;
        const r1 = isCrit ? (i % 2 === 0 ? 165 : 108) : 102;
        g.fillStyle(i % 2 === 0 ? pal.core : pal.primary, 0.95);
        g.beginPath();
        g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        g.lineTo(Math.cos(a - 0.07) * (r0 + 28), Math.sin(a - 0.07) * (r0 + 28));
        g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        g.lineTo(Math.cos(a + 0.07) * (r0 + 28), Math.sin(a + 0.07) * (r0 + 28));
        g.closePath();
        g.fillPath();
      }
      g.setScale(0.5);
      scene.tweens.add({
        targets: g,
        scale: 1.35,
        duration: 240,
        ease: 'Back.easeOut',
      });
      scene.tweens.add({
        targets: g,
        alpha: 0,
        delay: 170,
        duration: 180,
        ease: 'Quad.easeIn',
        onComplete: () => g.destroy(),
      });
    }

    if (q.particles && q.particleDensity > 0) {
      const count = isCrit ? 26 : isHeavy ? 18 : 12;
      const sparks = scene.add
        .particles(x, y, 'fx_spark', {
          speed: { min: 120, max: isCrit ? 460 : 340 },
          angle: { min: 0, max: 360 },
          scale: { start: isCrit ? 0.68 : 0.52, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 480,
          tint: [pal.primary, pal.secondary, pal.core],
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(DEPTH.fx + 24);
      sparks.explode(Math.max(5, Math.round(count * q.particleDensity)));

      const shards = scene.add
        .particles(x, y, 'fx_shard', {
          speed: { min: 90, max: isCrit ? 380 : 260 },
          angle: { min: 0, max: 360 },
          rotate: { min: 0, max: 360 },
          scale: { start: isCrit ? 0.52 : 0.38, end: 0 },
          alpha: { start: 0.95, end: 0 },
          lifespan: 520,
          gravityY: 260,
          tint: [pal.primary, pal.core],
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(DEPTH.fx + 25);
      shards.explode(Math.max(4, Math.round((count * 0.65) * q.particleDensity)));

      scene.time.delayedCall(600, () => {
        sparks.destroy();
        shards.destroy();
      });
    }
  }

  /** Plays a dramatic diagonal Anime Gacha Ultimate Cut-In banner across the screen for ANY character or boss. */
  static ultimateCutIn(
    scene: Phaser.Scene,
    opts: {
      unitName: string;
      skillName: string;
      element?: string;
      side: 'player' | 'enemy';
      portraitKey: string | null;
      flipPortrait?: boolean;
      spriteKey: string;
      spriteFrame: string;
    },
  ): Promise<void> {
    if (prefs().reducedMotion || prefs().reduceFlash) return Promise.resolve();
    this.ensureTextures(scene);
    const pal = this.palette(opts.element);
    const isPlayer = opts.side === 'player';

    return new Promise((resolve) => {
      const root = scene.add.container(0, 0).setDepth(DEPTH.modal - 8);

      // Slanted dark-gothic cut-in strip spanning full screen width with glowing elemental borders
      const bandY = 440;
      const bandH = 260;
      const halfW = REF_W / 2 + 160;
      const slashStrip = scene.add.graphics();
      slashStrip.fillStyle(0x0b0612, 0.94);
      slashStrip.fillRect(-halfW, -bandH / 2, halfW * 2, bandH);
      slashStrip.fillStyle(pal.primary, 0.24);
      slashStrip.fillRect(-halfW, -bandH / 2 + 12, halfW * 2, bandH - 24);
      slashStrip.lineStyle(5, pal.core, 0.95);
      slashStrip.lineBetween(-halfW, -bandH / 2, halfW, -bandH / 2);
      slashStrip.lineStyle(2, pal.primary, 0.85);
      slashStrip.lineBetween(-halfW, -bandH / 2 + 10, halfW, -bandH / 2 + 10);

      // High-speed anime action lines inside the strip
      for (let i = 0; i < 22; i++) {
        const ly = -bandH / 2 + 18 + ((i * 23) % (bandH - 36));
        const lx = ((i * 173) % (REF_W + 200)) - halfW;
        const lw = 220 + (i % 4) * 140;
        slashStrip.fillStyle(i % 2 === 0 ? pal.core : pal.primary, 0.28 + (i % 3) * 0.14);
        slashStrip.fillRect(lx, ly, lw, i % 3 === 0 ? 4 : 2);
      }

      // Character visual (waist-up bust crop if portraitKey is available, otherwise Chibi sprite with echo)
      // Placed inside `band` so the bottom edge is 100% flush with the slanted bottom border!
      const localStartX = isPlayer ? -REF_W / 2 - 320 : REF_W / 2 + 320;
      const localTargetX = isPlayer ? -REF_W / 2 + 430 : REF_W / 2 - 430;
      const localBottomY = bandH / 2 - 2;

      let portraitFrame: string | undefined;
      if (opts.portraitKey && scene.textures.exists(opts.portraitKey)) {
        const pTex = scene.textures.get(opts.portraitKey);
        const baseFrame = pTex.get();
        if (baseFrame && !pTex.has('cutin_bust')) {
          pTex.add('cutin_bust', 0, 0, 0, baseFrame.width, Math.round(baseFrame.height * 0.68));
        }
        if (pTex.has('cutin_bust')) portraitFrame = 'cutin_bust';
      }

      const echo = opts.portraitKey
        ? scene.add.image(localStartX, localBottomY, opts.portraitKey, portraitFrame).setOrigin(0.5, 1)
        : scene.add.image(localStartX, localBottomY, opts.spriteKey, opts.spriteFrame).setOrigin(0.5, 1);
      const mainArt = opts.portraitKey
        ? scene.add.image(localStartX, localBottomY, opts.portraitKey, portraitFrame).setOrigin(0.5, 1)
        : scene.add.image(localStartX, localBottomY, opts.spriteKey, opts.spriteFrame).setOrigin(0.5, 1);

      const artScale = opts.portraitKey ? 450 / Math.max(1, mainArt.height) : 340 / Math.max(1, mainArt.height);
      echo
        .setScale(artScale * 1.08)
        .setTint(pal.primary)
        .setTintMode(Phaser.TintModes.FILL)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.55);
      mainArt.setScale(artScale);
      const shouldFlip = opts.flipPortrait ?? (!isPlayer && Boolean(opts.portraitKey));
      if (shouldFlip) {
        echo.setFlipX(true);
        mainArt.setFlipX(true);
      }

      // Bottom border rule drawn OVER the bottom edge of the bust so it frames the character cleanly
      const bottomRule = scene.add.graphics();
      bottomRule.lineStyle(2, pal.primary, 0.85);
      bottomRule.lineBetween(-halfW, bandH / 2 - 10, halfW, bandH / 2 - 10);
      bottomRule.lineStyle(5, pal.core, 0.95);
      bottomRule.lineBetween(-halfW, bandH / 2, halfW, bandH / 2);

      const band = scene.add.container(REF_W / 2, bandY, [slashStrip, echo, mainArt, bottomRule]).setAngle(isPlayer ? -3.5 : 3.5);
      band.setScale(1, 0.05);
      root.add(band);

      // Typography slam + ornate gothic star sigil behind text
      const textX = isPlayer ? 1140 : 780;
      const sigil = scene.add.graphics().setPosition(textX, bandY + 4);
      sigil.lineStyle(3, pal.primary, 0.65);
      sigil.strokeCircle(0, 0, 92);
      sigil.lineStyle(2, pal.core, 0.8);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        sigil.lineBetween(Math.cos(a) * 32, Math.sin(a) * 32, Math.cos(a) * 112, Math.sin(a) * 112);
      }
      sigil.setScale(0.3);

      const nameTag = txt(scene, textX, bandY - 56, opts.unitName.toUpperCase(), {
        fontFamily: F.display,
        fontSize: '34px',
        fontStyle: '700',
        color: pal.hex,
        stroke: '#07040c',
        strokeThickness: 6,
      })
        .setOrigin(0.5)
        .setAlpha(0);
      const skillTitle = txt(scene, textX, bandY + 18, opts.skillName.toUpperCase(), {
        fontFamily: F.display,
        fontSize: '64px',
        fontStyle: '700',
        color: T.gold,
        stroke: '#07040c',
        strokeThickness: 8,
      })
        .setOrigin(0.5)
        .setScale(1.8)
        .setAlpha(0);

      root.add([sigil, nameTag, skillTitle]);

      scene.tweens.add({
        targets: band,
        scaleY: 1,
        duration: 140,
        ease: 'Back.easeOut',
      });
      scene.tweens.add({
        targets: mainArt,
        x: localTargetX,
        duration: 210,
        ease: 'Cubic.easeOut',
      });
      scene.tweens.add({
        targets: echo,
        x: localTargetX + (isPlayer ? -28 : 28),
        alpha: 0,
        duration: 380,
        ease: 'Cubic.easeOut',
      });
      scene.tweens.add({
        targets: sigil,
        scale: 1.15,
        angle: 60,
        duration: 460,
        delay: 70,
        ease: 'Back.easeOut',
      });
      scene.tweens.add({
        targets: nameTag,
        alpha: 1,
        y: bandY - 46,
        duration: 180,
        delay: 70,
        ease: 'Quad.easeOut',
      });
      scene.tweens.add({
        targets: skillTitle,
        alpha: 1,
        scale: 1,
        duration: 210,
        delay: 90,
        ease: 'Back.easeOut',
      });

      scene.time.delayedCall(620, () => {
        scene.tweens.add({
          targets: root,
          alpha: 0,
          duration: 180,
          ease: 'Quad.easeIn',
          onComplete: () => {
            root.destroy();
            resolve();
          },
        });
      });
    });
  }
}
