import Phaser from '../engine';
import { Sfx } from '../audio/Sfx';
import { INTRO_FAST, REF_H, REF_W } from '../config';
import { S } from '../entry/strings';
import { prefs } from '../platform/prefs';
import { txt } from '../ui/kit';
import { C, F, T } from '../ui/theme';

export interface SplashInit {
  /** resolves true when fonts, base content and menu art are loaded; false when the load failed (the boot code already reported it) */
  ready: Promise<boolean>;
}

const FADE_IN = INTRO_FAST ? 80 : 1400;
const HOLD = INTRO_FAST ? 80 : 2000;
const FADE_OUT = INTRO_FAST ? 80 : 1400;

/**
 * The engine credit. Slow fade-in on black, official Phaser wordmark + iconic diagonal prism laser beam & planetary ring,
 * accompanied by the Phaser retro-synth arpeggio chime (`Sfx.phaserLogo()`).
 */
export class SplashScene extends Phaser.Scene {
  private ready!: Promise<boolean>;

  constructor() {
    super('Splash');
  }

  init(data: SplashInit): void {
    this.ready = data.ready;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x030208);
    document.getElementById('boot')?.classList.add('done');

    const cx = REF_W / 2;
    const cy = REF_H / 2;
    const calm = prefs().reducedMotion;

    // Iconic Phaser planetary ring & diagonal neon prism laser beam behind the official wordmark
    const emblem = this.add.graphics();
    // Outer soft aura ring
    emblem.lineStyle(2, 0x00e5ff, 0.28);
    emblem.strokeEllipse(cx, cy + 6, 680, 170);
    emblem.lineStyle(1.5, 0xff2a85, 0.32);
    emblem.strokeEllipse(cx, cy + 6, 560, 132);
    // Diagonal 4-color prism laser beam (Phaser signature motif)
    const beamColors = [0x00e5ff, 0x9b4dff, 0xff2a85, 0xffe066];
    beamColors.forEach((col, i) => {
      const offset = (i - 1.5) * 9;
      emblem.lineStyle(5, col, 0.78);
      emblem.lineBetween(cx - 320 + offset, cy + 128, cx + 320 + offset, cy - 118);
    });

    const glow = this.textures.exists('fx_spark')
      ? this.add.image(cx, cy + 6, 'fx_spark').setScale(7.5, 3.2).setTint(0x9b4dff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
      : null;

    const made = txt(this, cx, cy - 134, S.splash.made, {
      fontFamily: F.body,
      fontSize: '34px',
      fontStyle: '500',
      color: T.dim
    })
      .setOrigin(0.5)
      .setLetterSpacing(16);

    // Official pixel-art Phaser logo at whole-number scale (4x = 832 x 200)
    const word: Phaser.GameObjects.Text = txt(this, cx, cy + 4, S.splash.engine, {
      fontFamily: F.display,
      fontSize: '112px',
      fontStyle: '700',
      color: '#f1ece4'
    })
      .setOrigin(0.5)
      .setLetterSpacing(22);

    const sub = txt(this, cx, cy + 148, 'WEBGL2  ·  GOTHIC DOM UI  ·  v8.0', {
      fontFamily: F.display,
      fontSize: '20px',
      fontStyle: '600',
      color: '#9ecfff'
    })
      .setOrigin(0.5)
      .setLetterSpacing(8);

    const rule = this.add.rectangle(cx, cy + 112, 580, 3, C.silver, 0.78).setScale(0.02, 1);
    const all: Phaser.GameObjects.GameObject[] = [emblem, made, word, sub, rule];
    if (glow) all.push(glow);
    all.forEach((o) => {
      if ('setAlpha' in o && typeof o.setAlpha === 'function') o.setAlpha(0);
    });

    // Play the Phaser retro-synth arpeggio & laser chime (and unlock audio on first tap if browser blocked autoplay)
    Sfx.phaserLogo();
    this.input.once('pointerdown', () => Sfx.phaserLogo());

    this.tweens.add({ targets: [emblem, made, word, sub, rule], alpha: 1, duration: FADE_IN, ease: 'Sine.easeInOut' });
    if (glow) {
      this.tweens.add({ targets: glow, alpha: 0.42, duration: FADE_IN, ease: 'Sine.easeOut' });
    }
    this.tweens.add({ targets: rule, scaleX: 1, duration: FADE_IN + HOLD * 0.75, ease: 'Cubic.easeInOut' });

    if (!calm && this.textures.exists('fx_spark')) {
      const glint = this.add
        .image(cx - 380, cy + 4, 'fx_spark')
        .setScale(2.4, 0.9)
        .setTint(0x00e5ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      this.tweens.add({
        targets: glint,
        x: cx + 380,
        alpha: { from: 0.85, to: 0 },
        duration: 1650,
        delay: Math.round(FADE_IN * 0.55),
        ease: 'Cubic.easeOut',
        onComplete: () => glint.destroy()
      });
    }

    const animation = new Promise<void>((resolve) => {
      this.time.delayedCall(FADE_IN + HOLD, () => {
        this.tweens.add({
          targets: all,
          alpha: 0,
          duration: FADE_OUT,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.time.delayedCall(INTRO_FAST ? 20 : 350, () => resolve());
          }
        });
      });
    });
    void Promise.all([animation, this.ready]).then(([, ok]) => {
      if (!ok) return;
      this.scene.stop('Boot');
      this.scene.start('Studio');
    });
  }
}
