import * as PIXI from 'pixi.js';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { INTRO_FAST, REF_H, REF_W } from '../config';
import { hosted } from '../core/host';
import { PixiScene } from '../core/PixiScene';
import { S } from '../entry/strings';
import { prefs } from '../platform/prefs';
import { Services } from '../services';
import { txt } from '../ui/pixiKit';
import { C, F, T } from '../ui/theme';
import { Sparks } from '../vfx/sparks';
import { vfxTextures } from '../vfx/textures';

const NAME_IN = INTRO_FAST ? 80 : 1700;
const PRESENTS_AT = INTRO_FAST ? 60 : 1100;
const HOLD = INTRO_FAST ? 80 : 2100;
const OUT = INTRO_FAST ? 80 : 1500;

/**
 * "SovTaym Studios Presents": slow fade-in on deep obsidian, the commissioned `studio_mark` emblem framed by
 * counter-rotating gold/silver rings, a hairline shimmer sweep and rising sparks. The Main Theme starts the moment the
 * mark appears so it flows into the title.
 */
export class StudioScene extends PixiScene {
  constructor() {
    super(0x05030a);
  }

  async create(): Promise<void> {
    const { art } = Services.ready();
    await Promise.all([art.loadUi(this.host), art.loadMusic(this.host, 'bgm_main_theme').catch(() => undefined)]);
    if (!this.live) return;
    const m = art.music('bgm_main_theme');
    if (m) Music.play(this.host.cache.audio, m.key, m.loopStart, m.duration, 1.8);
    const calm = prefs().reducedMotion;
    const cx = REF_W / 2;
    const cy = REF_H / 2;
    const markY = cy - 156;
    const total = NAME_IN + PRESENTS_AT + HOLD + OUT;
    const spark = vfxTextures().spark;
    const parts: PIXI.Container[] = [];

    // ambient glow behind the emblem
    const aura = this.add(new PIXI.Sprite(spark));
    aura.anchor.set(0.5);
    aura.position.set(cx, markY);
    aura.scale.set(6.2);
    aura.tint = C.gold;
    aura.blendMode = 'add';
    parts.push(aura);
    if (!calm) this.anim.to(aura, { scale: { from: 5.4, to: 6.8 } }, { duration: 2600, yoyo: true, repeat: -1, ease: 'sine.inout' });

    // counter-rotating chronometer rings
    const outer = this.add(this.celestialRing(cx, markY, 158, C.gold, 12));
    const inner = this.add(this.celestialRing(cx, markY, 128, C.silver, 8));
    parts.push(outer, inner);
    if (!calm) {
      this.anim.to(outer, { angle: 90 }, { duration: total, ease: 'sine.inout' });
      this.anim.to(inner, { angle: -90 }, { duration: total, ease: 'sine.inout' });
    }

    const markKey = art.ui('studio_mark');
    if (markKey) {
      const mark = this.add(new PIXI.Sprite(this.tex(markKey)));
      mark.anchor.set(0.5);
      mark.position.set(cx, markY);
      const k = Math.min(248 / (mark.texture.width || 248), 248 / (mark.texture.height || 248));
      mark.scale.set(calm ? k : k * 0.86);
      parts.push(mark);
      if (!calm) this.anim.to(mark, { scale: k }, { duration: NAME_IN + 500, ease: 'cubic.out' });
    }

    const divider = this.add(this.ornament(cx, cy + 28, calm, spark));
    const name = this.add(txt(cx, cy + 92, S.studio.name.toUpperCase(), { fontFamily: F.display, fontSize: 78, fontStyle: '600', color: '#e9e2d4', stroke: '#120a18', strokeThickness: 5, letterSpacing: 10 }, 0.5));
    const presents = this.add(txt(cx, cy + 168, S.studio.presents, { fontFamily: F.body, fontSize: 36, fontStyle: 'italic 500', color: T.gold, letterSpacing: 18 }, 0.5));
    parts.push(divider, name);
    for (const o of [...parts, presents]) o.alpha = 0;

    Sfx.bell(330, 0.14, 2.2);
    for (const o of parts) this.anim.to(o, { alpha: 1 }, { duration: NAME_IN, ease: 'sine.inout' });
    this.anim.to(presents, { alpha: 1 }, { duration: NAME_IN, delay: PRESENTS_AT, ease: 'sine.inout' });
    if (!calm) this.anim.to(name, { y: cy + 86 }, { duration: total, ease: 'sine.inout' });
    if (!calm && !INTRO_FAST) {
      const ash = this.add(new Sparks(spark), -1);
      ash.ambient({ every: 420, area: { x: [0, REF_W], y: [REF_H + 20, REF_H + 20] }, vx: [-12, 12], vy: [-52, -24], look: { lifespan: 9000, scale: [0.05, 0.18], randomScale: true, alpha: [0.34, 0], tint: [0xc9b6e4, 0xb8975a, 0xe3c37d] } });
      this.onTick((dt) => ash.update(dt));
    }

    this.anim.after(PRESENTS_AT + NAME_IN + HOLD, () => {
      for (const o of [...parts, presents]) this.anim.to(o, { alpha: 0 }, { duration: OUT, ease: 'sine.inout' });
      this.anim.after(OUT + (INTRO_FAST ? 20 : 320), () => this.nav.start('Title'));
    });
  }

  /** an astronomical degree ring with cardinal ticks around the emblem */
  private celestialRing(x: number, y: number, radius: number, color: number, ticks: number): PIXI.Graphics {
    const g = new PIXI.Graphics().circle(0, 0, radius).stroke({ width: 1.5, color, alpha: 0.36 });
    for (let i = 0; i < ticks; i++) {
      const rad = (i * Math.PI * 2) / ticks;
      const major = i % 3 === 0;
      const r0 = major ? radius - 12 : radius - 6;
      const r1 = major ? radius + 12 : radius + 6;
      g.moveTo(Math.cos(rad) * r0, Math.sin(rad) * r0).lineTo(Math.cos(rad) * r1, Math.sin(rad) * r1).stroke({ width: major ? 2 : 1.2, color: major ? C.goldHi : color, alpha: major ? 0.75 : 0.42 });
    }
    g.position.set(x, y);
    return g;
  }

  /** two hairlines meeting at a diamond, with a shimmer sweep */
  private ornament(x: number, y: number, calm: boolean, spark: PIXI.Texture): PIXI.Container {
    const c = new PIXI.Container();
    c.position.set(x, y);
    c.addChild(
      new PIXI.Graphics()
        .moveTo(-260, 0)
        .lineTo(-28, 0)
        .moveTo(28, 0)
        .lineTo(260, 0)
        .stroke({ width: 2, color: C.gold, alpha: 0.82 })
        .moveTo(-180, -5)
        .lineTo(-36, -5)
        .moveTo(36, -5)
        .lineTo(180, -5)
        .stroke({ width: 1, color: C.silver, alpha: 0.45 })
        .poly([0, -14, 14, 0, 0, 14, -14, 0])
        .fill({ color: C.goldHi, alpha: 0.95 })
    );
    if (!calm) {
      const glint = new PIXI.Sprite(spark);
      glint.anchor.set(0.5);
      glint.position.set(-240, 0);
      glint.scale.set(1.8, 0.18);
      glint.tint = C.goldHi;
      glint.blendMode = 'add';
      glint.alpha = 0.85;
      c.addChild(glint);
      this.anim.to(glint, { x: 240 }, { duration: 2100, delay: 300, ease: 'sine.inout' });
    }
    return c;
  }
}

export const StudioHost = hosted('Studio', () => new StudioScene());
