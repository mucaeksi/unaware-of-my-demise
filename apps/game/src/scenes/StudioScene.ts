import Phaser from 'phaser';
import { INTRO_FAST, REF_H, REF_W } from '../config';
import { S } from '../entry/strings';
import { prefs } from '../platform/prefs';
import { Services } from '../services';
import { txt } from '../ui/kit';
import { C, F, T } from '../ui/theme';

const NAME_IN = INTRO_FAST ? 80 : 1300;
const PRESENTS_AT = INTRO_FAST ? 60 : 1000;
const HOLD = INTRO_FAST ? 80 : 1700;
const OUT = INTRO_FAST ? 80 : 1000;

/**
 * "SovTaym Studios Presents" card, ~4.5 s, ink on black. The studio mark comes from the art manifest (`ui` entry `studio_mark`) when
 * the active content carries one; until then a hairline ornament stands in. Tapping does not skip.
 */
export class StudioScene extends Phaser.Scene {
  constructor() {
    super('Studio');
  }

  async create(): Promise<void> {
    await Services.ready().art.loadUi(this);
    if (!this.sys.isActive()) return;
    this.cameras.main.setBackgroundColor(0x05030a);
    const calm = prefs().reducedMotion;
    const cx = REF_W / 2;
    const cy = REF_H / 2;

    const parts: (Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [];
    const markKey = Services.art?.ui('studio_mark');
    if (markKey) {
      const mark = this.add.image(cx, cy - 170, markKey);
      mark.setScale(Math.min(260 / mark.width, 260 / mark.height));
      parts.push(mark);
    } else {
      parts.push(this.ornament(cx, cy - 120));
    }
    const name = txt(this, cx, cy - 10, S.studio.name, { fontFamily: F.display, fontSize: '88px', fontStyle: '600', color: '#e9e2d4' }).setOrigin(0.5).setLetterSpacing(10);
    const presents = txt(this, cx, cy + 92, S.studio.presents, { fontFamily: F.body, fontSize: '36px', fontStyle: 'italic 500', color: T.dim }).setOrigin(0.5).setLetterSpacing(18);
    parts.push(name);
    [...parts, presents].forEach((o) => o.setAlpha(0));

    this.tweens.add({ targets: parts, alpha: 1, duration: NAME_IN, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: presents, alpha: 1, duration: NAME_IN, delay: PRESENTS_AT, ease: 'Sine.easeOut' });
    if (!calm) this.tweens.add({ targets: name, y: cy - 16, duration: NAME_IN + PRESENTS_AT + HOLD + OUT, ease: 'Sine.easeInOut' });
    if (!calm && !INTRO_FAST && this.textures.exists('fx_spark')) this.addAsh();

    this.time.delayedCall(PRESENTS_AT + NAME_IN + HOLD, () => {
      this.tweens.add({ targets: [...parts, presents], alpha: 0, duration: OUT, ease: 'Sine.easeIn', onComplete: () => this.scene.start('Title') });
    });
  }

  /** Two hairlines meeting at a diamond: the same ornament vocabulary as the UI panels. */
  private ornament(x: number, y: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.lineStyle(2, C.gold, 0.8);
    g.lineBetween(-210, 0, -26, 0);
    g.lineBetween(26, 0, 210, 0);
    g.fillStyle(C.goldHi, 0.95);
    g.fillPoints([new Phaser.Math.Vector2(0, -16), new Phaser.Math.Vector2(16, 0), new Phaser.Math.Vector2(0, 16), new Phaser.Math.Vector2(-16, 0)], true);
    return this.add.container(x, y, [g]);
  }

  /** A few slow motes, built-in Phaser particles on the shared soft-dot texture. */
  private addAsh(): void {
    const emitter = this.add.particles(0, 0, 'fx_spark', {
      x: { min: 0, max: REF_W },
      y: REF_H + 20,
      lifespan: 9000,
      speedY: { min: -46, max: -22 },
      speedX: { min: -10, max: 10 },
      scale: { min: 0.05, max: 0.16 },
      alpha: { start: 0.28, end: 0 },
      frequency: 520,
      tint: [0xc9b6e4, 0xb8975a],
      blendMode: 'ADD'
    });
    emitter.setDepth(-1);
  }
}
