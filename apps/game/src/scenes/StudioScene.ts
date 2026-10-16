import Phaser from 'phaser';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { INTRO_FAST, REF_H, REF_W } from '../config';
import { S } from '../entry/strings';
import { prefs } from '../platform/prefs';
import { Services } from '../services';
import { txt } from '../ui/kit';
import { C, F, T } from '../ui/theme';

const MAIN_THEME_CUE = 'bgm_main_theme';
const NAME_IN = INTRO_FAST ? 80 : 1700;
const PRESENTS_AT = INTRO_FAST ? 60 : 1100;
const HOLD = INTRO_FAST ? 80 : 2100;
const OUT = INTRO_FAST ? 80 : 1500;

/**
 * "SovTaym Studios Presents" card, slow fade-in on deep obsidian. Renders the commissioned `studio_mark` celestial astrolabe emblem
 * framed by counter-rotating gold/silver filigree rings, a hairline shimmer sweep, and rising spark motes.
 * Starts the Main Theme music the exact moment the studio logo appears so it flows seamlessly into the Title screen.
 */
export class StudioScene extends Phaser.Scene {
  constructor() {
    super('Studio');
  }

  async create(): Promise<void> {
    const { art } = Services.ready();
    await Promise.all([
      art.loadUi(this),
      art.loadMusic(this, MAIN_THEME_CUE).catch(() => undefined)
    ]);
    if (!this.sys.isActive()) return;
    this.cameras.main.setBackgroundColor(0x05030a);
    const calm = prefs().reducedMotion;
    const cx = REF_W / 2;
    const cy = REF_H / 2;
    const markY = cy - 142;

    const parts: (Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [];

    // Ambient radial glow behind the studio emblem
    if (this.textures.exists('fx_spark')) {
      const aura = this.add
        .image(cx, markY, 'fx_spark')
        .setScale(6.2)
        .setTint(C.gold)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      parts.push(aura);
      if (!calm) {
        this.tweens.add({
          targets: aura,
          scale: { from: 5.4, to: 6.8 },
          duration: 2600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    }

    // Counter-rotating celestial chronometer rings behind the studio mark
    const outerRing = this.celestialRing(cx, markY, 158, C.gold, 12);
    const innerRing = this.celestialRing(cx, markY, 128, C.silver, 8);
    parts.push(outerRing, innerRing);
    if (!calm) {
      this.tweens.add({ targets: outerRing, angle: 90, duration: NAME_IN + PRESENTS_AT + HOLD + OUT, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: innerRing, angle: -90, duration: NAME_IN + PRESENTS_AT + HOLD + OUT, ease: 'Sine.easeInOut' });
    }

    const markKey = Services.art?.ui('studio_mark');
    if (markKey) {
      const mark = this.add.image(cx, markY, markKey);
      const targetScale = Math.min(248 / mark.width, 248 / mark.height);
      mark.setScale(calm ? targetScale : targetScale * 0.86);
      parts.push(mark);
      if (!calm) {
        this.tweens.add({ targets: mark, scale: targetScale, duration: NAME_IN + 500, ease: 'Cubic.easeOut' });
      }
    }

    const divider = this.ornament(cx, cy - 2, calm);
    const name = txt(this, cx, cy + 56, S.studio.name.toUpperCase(), {
      fontFamily: F.display,
      fontSize: '78px',
      fontStyle: '600',
      color: '#e9e2d4',
      stroke: '#120a18',
      strokeThickness: 5
    })
      .setOrigin(0.5)
      .setLetterSpacing(10);
    const presents = txt(this, cx, cy + 138, S.studio.presents, {
      fontFamily: F.body,
      fontSize: '36px',
      fontStyle: 'italic 500',
      color: T.gold
    })
      .setOrigin(0.5)
      .setLetterSpacing(18);

    parts.push(divider, name);
    [...parts, presents].forEach((o) => o.setAlpha(0));

    // Start Main Theme music the exact moment the SovTaym Studios logo begins appearing
    const playMainTheme = (): void => {
      const m = art.music(MAIN_THEME_CUE);
      if (m) Music.play(this.cache.audio, m.key, m.loopStart, m.duration, 2.4);
    };
    playMainTheme();
    Sfx.bell(330, 0.14, 2.2);
    this.input.once('pointerdown', () => playMainTheme());

    this.tweens.add({ targets: parts, alpha: 1, duration: NAME_IN, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: presents, alpha: 1, duration: NAME_IN, delay: PRESENTS_AT, ease: 'Sine.easeInOut' });
    if (!calm) {
      this.tweens.add({ targets: name, y: cy + 50, duration: NAME_IN + PRESENTS_AT + HOLD + OUT, ease: 'Sine.easeInOut' });
    }
    if (!calm && !INTRO_FAST && this.textures.exists('fx_spark')) this.addAsh();

    this.time.delayedCall(PRESENTS_AT + NAME_IN + HOLD, () => {
      this.tweens.add({
        targets: [...parts, presents],
        alpha: 0,
        duration: OUT,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.time.delayedCall(INTRO_FAST ? 20 : 320, () => this.scene.start('Title'));
        }
      });
    });
  }

  /** Delicate astronomical degree ring with cardinal diamond ticks around the SovTaym emblem. */
  private celestialRing(x: number, y: number, radius: number, color: number, ticks: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.lineStyle(1.5, color, 0.36);
    g.strokeCircle(0, 0, radius);
    for (let i = 0; i < ticks; i++) {
      const rad = (i * Math.PI * 2) / ticks;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const inner = i % 3 === 0 ? radius - 12 : radius - 6;
      const outer = i % 3 === 0 ? radius + 12 : radius + 6;
      g.lineStyle(i % 3 === 0 ? 2 : 1.2, i % 3 === 0 ? C.goldHi : color, i % 3 === 0 ? 0.75 : 0.42);
      g.lineBetween(c * inner, s * inner, c * outer, s * outer);
    }
    return this.add.container(x, y, [g]);
  }

  /** Two hairlines meeting at a diamond with an animated horizontal shimmer sweep. */
  private ornament(x: number, y: number, calm: boolean): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.lineStyle(2, C.gold, 0.82);
    g.lineBetween(-260, 0, -28, 0);
    g.lineBetween(28, 0, 260, 0);
    g.lineStyle(1, C.silver, 0.45);
    g.lineBetween(-180, -5, -36, -5);
    g.lineBetween(36, -5, 180, -5);
    g.fillStyle(C.goldHi, 0.95);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(0, -14),
        new Phaser.Math.Vector2(14, 0),
        new Phaser.Math.Vector2(0, 14),
        new Phaser.Math.Vector2(-14, 0)
      ],
      true
    );
    const items: Phaser.GameObjects.GameObject[] = [g];
    if (!calm && this.textures.exists('fx_spark')) {
      const glint = this.add
        .image(-240, 0, 'fx_spark')
        .setScale(1.8, 0.18)
        .setTint(C.goldHi)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.85);
      items.push(glint);
      this.tweens.add({
        targets: glint,
        x: 240,
        duration: 2100,
        delay: 300,
        ease: 'Sine.easeInOut'
      });
    }
    return this.add.container(x, y, items);
  }

  /** Slow golden and lilac spark motes rising across the dark studio card. */
  private addAsh(): void {
    const emitter = this.add.particles(0, 0, 'fx_spark', {
      x: { min: 0, max: REF_W },
      y: REF_H + 20,
      lifespan: 9000,
      speedY: { min: -52, max: -24 },
      speedX: { min: -12, max: 12 },
      scale: { min: 0.05, max: 0.18 },
      alpha: { start: 0.34, end: 0 },
      frequency: 420,
      tint: [0xc9b6e4, 0xb8975a, 0xe3c37d],
      blendMode: 'ADD'
    });
    emitter.setDepth(-1);
  }
}

