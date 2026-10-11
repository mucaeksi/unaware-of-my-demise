import Phaser from 'phaser';
import { INTRO_FAST, REF_H, REF_W } from '../config';
import { S } from '../entry/strings';
import { prefs } from '../platform/prefs';
import { txt } from '../ui/kit';
import { C, F, T } from '../ui/theme';

export interface SplashInit {
  /** resolves true when fonts, base content and menu art are loaded; false when the load failed (the boot code already reported it) */
  ready: Promise<boolean>;
}

const FADE_IN = INTRO_FAST ? 80 : 700;
const HOLD = INTRO_FAST ? 80 : 1150;
const FADE_OUT = INTRO_FAST ? 80 : 700;

/**
 * The engine credit. Black card, "MADE WITH / PHASER", ~2.5 s. It also covers the loading time: the scene ends when both the
 * animation and the boot loader are done. Tapping does not skip (it is a licence-style credit, kept short instead).
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
    this.cameras.main.setBackgroundColor(0x000000);
    document.getElementById('boot')?.classList.add('done');

    const made = txt(this, REF_W / 2, REF_H / 2 - 112, S.splash.made, { fontFamily: F.body, fontSize: '34px', fontStyle: '500', color: T.dim }).setOrigin(0.5).setLetterSpacing(14);
    // the official pixel-art logo at a whole-number scale (4x = 832 x 200); the text wordmark if the file could not load
    const word: Phaser.GameObjects.Image | Phaser.GameObjects.Text = this.textures.exists('phaser_logo')
      ? this.add.image(REF_W / 2, REF_H / 2 + 6, 'phaser_logo').setScale(4).setTint(0xf1ece4)
      : txt(this, REF_W / 2, REF_H / 2 + 6, S.splash.engine, { fontFamily: F.display, fontSize: '128px', fontStyle: '700', color: '#f1ece4' }).setOrigin(0.5).setLetterSpacing(22);
    const rule = this.add.rectangle(REF_W / 2, REF_H / 2 + 112, 520, 3, C.silver, 0.7).setScale(0.02, 1);
    const all = [made, word, rule];
    all.forEach((o) => o.setAlpha(0));

    const calm = prefs().reducedMotion;
    this.tweens.add({ targets: all, alpha: 1, duration: FADE_IN, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: rule, scaleX: 1, duration: FADE_IN + HOLD, ease: 'Cubic.easeInOut' });
    // no scale drift on the pixel logo: a non-integer scale would blur it
    void calm;

    const animation = new Promise<void>((resolve) => {
      this.time.delayedCall(FADE_IN + HOLD, () => {
        this.tweens.add({ targets: all, alpha: 0, duration: FADE_OUT, ease: 'Sine.easeIn', onComplete: () => resolve() });
      });
    });
    void Promise.all([animation, this.ready]).then(([, ok]) => {
      if (!ok) return;
      this.scene.stop('Boot');
      this.scene.start('Studio');
    });
  }
}
