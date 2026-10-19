import * as PIXI from 'pixi.js';
import { Sfx } from '../audio/Sfx';
import { INTRO_FAST, REF_H, REF_W } from '../config';
import { PixiScene } from '../core/PixiScene';
import { S } from '../entry/strings';
import { prefs } from '../platform/prefs';
import { txt } from '../ui/pixiKit';
import { C, F, T } from '../ui/theme';
import { createEclipseCorona } from '../vfx/gothicUiVfx';
import { vfxTextures } from '../vfx/textures';
import { app } from '../core/app';

export interface SplashInit {
  /** resolves true when fonts, base content and menu art are loaded; false when the load failed (the boot code already reported it) */
  ready: Promise<boolean>;
}

const FADE_IN = INTRO_FAST ? 80 : 1400;
const HOLD = INTRO_FAST ? 80 : 2000;
const FADE_OUT = INTRO_FAST ? 80 : 1400;

/** The engine credit: a slow fade-in on black, the PixiJS wordmark over a ring and a four-colour prism beam, with a synth chime. */
export class SplashScene extends PixiScene<SplashInit> {
  constructor() {
    super(0x030208);
  }

  create(data: SplashInit): void {
    document.getElementById('boot')?.classList.add('done');
    const cx = REF_W / 2;
    const cy = REF_H / 2;
    const spark = vfxTextures().spark;
    const corona = createEclipseCorona(this, cx, cy + 6, 178, -1, false);
    corona.alpha = 0;

    // aura ellipses and the diagonal prism beam behind the wordmark
    const emblem = new PIXI.Graphics()
      .ellipse(cx, cy + 6, 340, 85)
      .stroke({ width: 2, color: 0x00e5ff, alpha: 0.28 })
      .ellipse(cx, cy + 6, 280, 66)
      .stroke({ width: 1.5, color: 0xff2a85, alpha: 0.32 });
    [0x00e5ff, 0x9b4dff, 0xff2a85, 0xffe066].forEach((col, i) => {
      const o = (i - 1.5) * 9;
      emblem.moveTo(cx - 320 + o, cy + 128).lineTo(cx + 320 + o, cy - 118).stroke({ width: 5, color: col, alpha: 0.78 });
    });
    const glow = new PIXI.Sprite(spark);
    glow.anchor.set(0.5);
    glow.position.set(cx, cy + 6);
    glow.scale.set(7.5, 3.2);
    glow.tint = 0x9b4dff;
    glow.blendMode = 'add';
    const made = txt(cx, cy - 134, S.splash.made, { fontFamily: F.body, fontSize: 34, fontStyle: '500', color: T.dim, letterSpacing: 16 }, 0.5);
    const word = txt(cx, cy + 4, S.splash.engine, { fontFamily: F.display, fontSize: 112, fontStyle: '700', color: '#f1ece4', letterSpacing: 22 }, 0.5);
    const sub = txt(cx, cy + 148, 'WEBGL2  ·  GOTHIC DOM UI  ·  v8.0', { fontFamily: F.display, fontSize: 20, fontStyle: '600', color: '#9ecfff', letterSpacing: 8 }, 0.5);
    const rule = new PIXI.Graphics().rect(-290, -1.5, 580, 3).fill({ color: C.silver, alpha: 0.78 });
    rule.position.set(cx, cy + 112);
    rule.scale.x = 0.02;
    const all: PIXI.Container[] = [emblem, made, word, sub, rule, glow];
    for (const o of all) {
      o.alpha = 0;
      this.add(o);
    }
    all.push(corona);

    // the chime, and once more on the first tap when the browser blocked autoplay
    Sfx.phaserLogo();
    const canvas = app().canvas;
    const replay = (): void => Sfx.phaserLogo();
    canvas.addEventListener('pointerdown', replay, { once: true });
    this.onClose(() => canvas.removeEventListener('pointerdown', replay));

    for (const o of [emblem, made, word, sub, rule, corona]) this.anim.to(o, { alpha: 1 }, { duration: FADE_IN, ease: 'sine.inout' });
    this.anim.to(glow, { alpha: 0.42 }, { duration: FADE_IN, ease: 'sine.out' });
    this.anim.to(rule, { scaleX: 1 }, { duration: FADE_IN + HOLD * 0.75, ease: 'cubic.inout' });
    if (!prefs().reducedMotion) {
      const glint = this.add(new PIXI.Sprite(spark));
      glint.anchor.set(0.5);
      glint.position.set(cx - 380, cy + 4);
      glint.scale.set(2.4, 0.9);
      glint.tint = 0x00e5ff;
      glint.blendMode = 'add';
      glint.alpha = 0;
      this.anim.to(glint, { x: cx + 380, alpha: { from: 0.85, to: 0 } }, { duration: 1650, delay: Math.round(FADE_IN * 0.55), ease: 'cubic.out', onComplete: () => glint.destroy() });
    }

    const animation = new Promise<void>((resolve) => {
      this.anim.after(FADE_IN + HOLD, () => {
        for (const o of all) this.anim.to(o, { alpha: 0 }, { duration: FADE_OUT, ease: 'sine.inout' });
        this.anim.after(FADE_OUT + (INTRO_FAST ? 20 : 350), resolve);
      });
    });
    void Promise.all([animation, data.ready]).then(([, ok]) => {
      if (!ok || !this.live) return;
      this.nav.stop('Boot');
      this.nav.start('Studio');
    });
  }
}

