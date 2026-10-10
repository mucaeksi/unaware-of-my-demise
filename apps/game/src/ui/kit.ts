import Phaser from 'phaser';
import { Sfx } from '../audio/Sfx';
import { C, DEPTH, F, SIZE, T } from './theme';

type PanelVariant = 'normal' | 'hot' | 'dim' | 'danger';

const PALETTE: Record<PanelVariant, { top: number; bottom: number; edge: number; inner: number; edgeA: number }> = {
  normal: { top: 0x24142e, bottom: 0x0f0914, edge: C.silver, inner: C.gold, edgeA: 0.55 },
  hot: { top: 0x3a1c46, bottom: 0x1a0d22, edge: C.goldHi, inner: C.silver, edgeA: 0.95 },
  dim: { top: 0x1a1220, bottom: 0x0c0810, edge: C.silver, inner: C.gold, edgeA: 0.22 },
  danger: { top: 0x3a1020, bottom: 0x16070d, edge: C.crimsonHi, inner: C.gold, edgeA: 0.8 }
};

/** Baked gothic panel texture (gradient, double rule, corner diamonds). Cached per size+variant. */
export function panelTexture(scene: Phaser.Scene, w: number, h: number, variant: PanelVariant = 'normal'): string {
  const key = `ui_panel_${variant}_${Math.round(w)}x${Math.round(h)}`;
  if (scene.textures.exists(key)) return key;
  const p = PALETTE[variant];
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Phaser's gradient fills only apply to rect/triangle paths, so: solid rounded base + gradient sheen
  g.fillStyle(p.bottom, 0.97);
  g.fillRoundedRect(2, 2, w - 4, h - 4, 12);
  g.fillGradientStyle(p.top, p.top, p.top, p.top, 0.85, 0.85, 0, 0);
  g.fillRect(8, 8, w - 16, Math.max(4, (h - 16) * 0.62));
  g.lineStyle(3, p.edge, p.edgeA);
  g.strokeRoundedRect(2, 2, w - 4, h - 4, 12);
  g.lineStyle(1, p.inner, 0.38);
  g.strokeRoundedRect(10, 10, w - 20, h - 20, 7);
  // corner ornaments: diamond + two tapered rules
  const corner = (cx: number, cy: number, sx: number, sy: number): void => {
    g.fillStyle(p.inner, 0.85);
    g.fillPoints(
      [new Phaser.Math.Vector2(cx, cy - 7 * sy), new Phaser.Math.Vector2(cx + 7 * sx, cy), new Phaser.Math.Vector2(cx, cy + 7 * sy), new Phaser.Math.Vector2(cx - 7 * sx, cy)],
      true
    );
    g.lineStyle(2, p.inner, 0.6);
    g.lineBetween(cx + 12 * sx, cy, cx + 44 * sx, cy);
    g.lineBetween(cx, cy + 12 * sy, cx, cy + 44 * sy);
  };
  corner(18, 18, 1, 1);
  corner(w - 18, 18, -1, 1);
  corner(18, h - 18, 1, -1);
  corner(w - 18, h - 18, -1, -1);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, variant: PanelVariant = 'normal'): Phaser.GameObjects.Image {
  return scene.add.image(x, y, panelTexture(scene, w, h, variant)).setOrigin(0.5);
}

export function txt(scene: Phaser.Scene, x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: F.body,
    fontSize: `${SIZE.body}px`,
    color: T.text,
    resolution: 2,
    ...style
  });
  return t;
}

export function title(scene: Phaser.Scene, x: number, y: number, text: string, size: number = SIZE.h2, color: string = T.text): Phaser.GameObjects.Text {
  return txt(scene, x, y, text, { fontFamily: F.display, fontSize: `${size}px`, fontStyle: '600', color, stroke: '#0a0610', strokeThickness: 4 }).setOrigin(0.5);
}

export interface ButtonOptions {
  label: string;
  sub?: string;
  w?: number;
  h?: number;
  variant?: PanelVariant;
  fontSize?: number;
  onClick: () => void;
}

/** Touch-sized gothic button with hover/press feedback. Returns a Container you can position and hide. */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly subLabel: Phaser.GameObjects.Text | null;
  private enabled = true;
  private readonly variant: PanelVariant;
  private readonly bw: number;
  private readonly bh: number;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly opts: ButtonOptions) {
    super(scene, x, y);
    this.bw = opts.w ?? 420;
    this.bh = opts.h ?? SIZE.touch;
    this.variant = opts.variant ?? 'normal';
    this.bg = scene.add.image(0, 0, panelTexture(scene, this.bw, this.bh, this.variant));
    this.label = txt(scene, 0, opts.sub ? -14 : 0, opts.label, { fontFamily: F.display, fontSize: `${opts.fontSize ?? 34}px`, fontStyle: '600', color: T.text }).setOrigin(0.5);
    this.subLabel = opts.sub ? txt(scene, 0, 24, opts.sub, { fontSize: `${SIZE.small - 4}px`, color: T.dim }).setOrigin(0.5) : null;
    const maxW = this.bw - 56;
    if (this.label.width > maxW) this.label.setScale(maxW / this.label.width);
    this.add([this.bg, this.label, ...(this.subLabel ? [this.subLabel] : [])]);
    this.setSize(this.bw, this.bh);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => this.enabled && this.hover(true));
    this.on('pointerout', () => this.hover(false));
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.setScale(0.97);
      Sfx.tap();
    });
    this.on('pointerup', () => {
      this.setScale(1);
      if (this.enabled) opts.onClick();
    });
    scene.add.existing(this);
  }

  private hover(on: boolean): void {
    this.bg.setTexture(panelTexture(this.scene, this.bw, this.bh, on ? 'hot' : this.variant));
    this.setScale(on ? 1.02 : 1);
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.bg.setTexture(panelTexture(this.scene, this.bw, this.bh, on ? this.variant : 'dim'));
    this.label.setAlpha(on ? 1 : 0.45);
    this.subLabel?.setAlpha(on ? 1 : 0.45);
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  setSub(text: string): this {
    this.subLabel?.setText(text);
    return this;
  }
}

/** Slim HP/Focus bar with smooth fill. */
export class Bar extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private shown = 1;
  private target = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly bw: number, private readonly bh: number, private readonly colorFn: (ratio: number) => number) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.add(this.g);
    scene.add.existing(this);
    this.redraw();
  }

  set(ratio: number, animate = true): void {
    const r = Phaser.Math.Clamp(ratio, 0, 1);
    this.target = r;
    if (!animate) {
      this.shown = r;
      this.redraw();
      return;
    }
    this.scene.tweens.add({
      targets: this,
      shown: r,
      duration: 380,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.redraw()
    });
  }

  private redraw(): void {
    const g = this.g;
    g.clear();
    g.fillStyle(0x07040a, 0.85);
    g.fillRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, this.bh / 2);
    if (this.shown > 0.001) {
      g.fillStyle(this.colorFn(this.target), 1);
      g.fillRoundedRect(-this.bw / 2 + 1, -this.bh / 2 + 1, Math.max(this.bh - 2, (this.bw - 2) * this.shown), this.bh - 2, (this.bh - 2) / 2);
    }
    g.lineStyle(1.5, C.silver, 0.45);
    g.strokeRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, this.bh / 2);
  }
}

export const hpColor = (r: number): number => (r > 0.5 ? C.hpGood : r > 0.25 ? C.hpMid : C.hpLow);

/** Fades a scene in; honours reduced motion. */
export function sceneFadeIn(scene: Phaser.Scene, ms = 450): void {
  scene.cameras.main.fadeIn(ms, 10, 6, 16);
}

export function toast(scene: Phaser.Scene, message: string, ms = 2600): void {
  const w = Math.min(1500, 120 + message.length * 17);
  const bg = panel(scene, 0, 0, w, 96, 'hot');
  const t = txt(scene, 0, 0, message, { fontSize: `${SIZE.small}px`, color: T.text, align: 'center' }).setOrigin(0.5);
  const box = scene.add.container(960, -80, [bg, t]).setDepth(DEPTH.toast);
  scene.tweens.add({ targets: box, y: 88, duration: 320, ease: 'Back.easeOut' });
  scene.time.delayedCall(ms, () => scene.tweens.add({ targets: box, y: -100, alpha: 0, duration: 300, onComplete: () => box.destroy() }));
}
