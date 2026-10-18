import Phaser from '../engine';
import { Sfx } from '../audio/Sfx';
import { announce, registerA11yButton } from '../platform/a11y';
import { qualityProfile } from '../platform/graphics';
import { prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { C, DEPTH, F, SIZE, T } from './theme';

type PanelVariant = 'normal' | 'hot' | 'dim' | 'danger';

const PALETTE: Record<PanelVariant, { top: number; bottom: number; edge: number; inner: number; edgeA: number }> = {
  normal: { top: 0x24142e, bottom: 0x0f0914, edge: C.silver, inner: C.gold, edgeA: 0.55 },
  hot: { top: 0x3a1c46, bottom: 0x1a0d22, edge: C.goldHi, inner: C.silver, edgeA: 0.95 },
  dim: { top: 0x1a1220, bottom: 0x0c0810, edge: C.silver, inner: C.gold, edgeA: 0.22 },
  danger: { top: 0x3a1020, bottom: 0x16070d, edge: C.crimsonHi, inner: C.gold, edgeA: 0.8 }
};

const PALETTE_HC: Record<PanelVariant, { top: number; bottom: number; edge: number; inner: number; edgeA: number }> = {
  normal: { top: 0x140b1c, bottom: 0x050208, edge: 0xffffff, inner: C.goldHi, edgeA: 0.92 },
  hot: { top: 0x2a1036, bottom: 0x0a0410, edge: 0xffe680, inner: 0xffffff, edgeA: 1 },
  dim: { top: 0x0f0914, bottom: 0x040206, edge: C.silver, inner: C.gold, edgeA: 0.55 },
  danger: { top: 0x2e0816, bottom: 0x0c0206, edge: 0xff6b8b, inner: 0xffffff, edgeA: 0.98 }
};

/** Baked gothic panel texture (translucent glass-gothic fill, oval/pill geometry for buttons, soft rounded corners for panels). Cached per size+variant+contrast. */
export function panelTexture(scene: Phaser.Scene, w: number, h: number, variant: PanelVariant = 'normal'): string {
  const hc = prefs().highContrast;
  const key = `ui_panel_v2_${variant}_${hc ? 'hc_' : ''}${Math.round(w)}x${Math.round(h)}`;
  if (scene.textures.exists(key)) return key;
  const p = (hc ? PALETTE_HC : PALETTE)[variant];
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const isPill = h <= 140 && w >= h * 1.25;
  const outerR = isPill ? Math.floor((h - 4) / 2) : Math.min(34, Math.max(18, Math.floor(Math.min(w, h) * 0.14)));
  const innerInset = isPill ? 7 : 9;
  const innerR = Math.max(6, outerR - (innerInset - 2));

  // ~50% lower opacity than the legacy 0.97 solid fill so battlefields and art breathe through the UI
  const baseAlpha = hc
    ? 0.92
    : variant === 'dim'
      ? 0.36
      : variant === 'hot'
        ? 0.54
        : variant === 'danger'
          ? 0.52
          : 0.48;
  const sheenAlpha = hc ? 0.5 : variant === 'dim' ? 0.16 : 0.26;

  g.fillStyle(p.bottom, baseAlpha);
  g.fillRoundedRect(2, 2, w - 4, h - 4, outerR);

  const sheenH = Math.max(8, Math.floor((h - innerInset * 2) * 0.5));
  const sheenR = Math.min(innerR, Math.floor(sheenH / 2));
  g.fillStyle(p.top, sheenAlpha);
  g.fillRoundedRect(innerInset, innerInset, w - innerInset * 2, sheenH, sheenR);

  g.lineStyle(hc ? 3.5 : 2, p.edge, p.edgeA * (hc ? 1 : 0.85));
  g.strokeRoundedRect(2, 2, w - 4, h - 4, outerR);

  g.lineStyle(hc ? 1.5 : 1, p.inner, hc ? 0.65 : 0.32);
  g.strokeRoundedRect(innerInset, innerInset, w - innerInset * 2, h - innerInset * 2, innerR);

  if (isPill) {
    // Delicate gothic diamond accents on left & right pill arcs
    const dy = h / 2;
    const dx = Math.min(22, Math.max(13, Math.floor(h * 0.2)));
    const r = Math.min(4.5, Math.max(3, h * 0.045));
    g.fillStyle(p.inner, hc ? 0.85 : 0.62);
    for (const cx of [dx, w - dx]) {
      g.fillPoints(
        [
          new Phaser.Math.Vector2(cx, dy - r),
          new Phaser.Math.Vector2(cx + r, dy),
          new Phaser.Math.Vector2(cx, dy + r),
          new Phaser.Math.Vector2(cx - r, dy)
        ],
        true
      );
    }
  } else {
    // Soft inset corner diamonds for larger modal/dialogue cards (no harsh 90-degree box lines)
    const cInset = Math.max(20, Math.round(outerR * 0.68));
    const r = 5;
    g.fillStyle(p.inner, hc ? 0.85 : 0.65);
    for (const [cx, cy] of [
      [cInset, cInset],
      [w - cInset, cInset],
      [cInset, h - cInset],
      [w - cInset, h - cInset]
    ] as const) {
      g.fillPoints(
        [
          new Phaser.Math.Vector2(cx, cy - r),
          new Phaser.Math.Vector2(cx + r, cy),
          new Phaser.Math.Vector2(cx, cy + r),
          new Phaser.Math.Vector2(cx - r, cy)
        ],
        true
      );
    }
  }

  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, variant: PanelVariant = 'normal'): Phaser.GameObjects.Image {
  return scene.add.image(x, y, panelTexture(scene, w, h, variant)).setOrigin(0.5);
}

function resolveFontSizePx(raw: string | number | undefined, fallback: number): string {
  const base = typeof raw === 'number' ? raw : raw ? Number.parseFloat(String(raw)) || fallback : fallback;
  const scale = prefs().textSize === 'large' ? 1.12 : 1;
  // Scale body/small text for readability without breaking large display headers
  const adjusted = base <= 44 ? Math.round(base * scale) : base;
  return `${adjusted}px`;
}

/** Strips any Turkish-specific characters into strict English ASCII equivalents. */
export function sanitizeEnText(raw: string): string {
  return raw
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'c');
}

/**
 * Strict English ASCII uppercase for Cinzel (`F.display`) headers and labels.
 * Because Cinzel is an all-caps/small-caps display font whose lowercase `'i'` glyph renders with a dot (`İ`),
 * converting all `F.display` text to true ASCII uppercase (`A-Z`, `I` = U+0049) eliminates dotted `İ` (`FİRST` -> `FIRST`).
 */
export function toEnUpper(raw: string): string {
  return sanitizeEnText(raw).replace(/i/g, 'I').toUpperCase();
}

export function txt(scene: Phaser.Scene, x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
  const hc = prefs().highContrast;
  const q = qualityProfile();
  const baseColor = style.color ?? (hc ? '#ffffff' : T.text);
  const resolvedColor = hc && baseColor === T.dim ? '#dfd6ec' : baseColor;
  const isDisplay = style.fontFamily === F.display;
  const formatText = (val: string | string[]): string | string[] => {
    const nonEn = prefs().locale !== 'en';
    if (Array.isArray(val)) return val.map((item) => (isDisplay ? (nonEn ? String(item).toUpperCase() : toEnUpper(String(item))) : (nonEn ? String(item) : sanitizeEnText(String(item)))));
    return isDisplay ? (nonEn ? String(val).toUpperCase() : toEnUpper(String(val))) : (nonEn ? String(val) : sanitizeEnText(String(val)));
  };
  const t = scene.add.text(x, y, formatText(text), {
    fontFamily: F.body,
    resolution: q.textResolution,
    ...(hc ? { stroke: '#050208', strokeThickness: 3 } : {}),
    ...style,
    fontSize: resolveFontSizePx(style.fontSize, SIZE.body),
    color: resolvedColor
  });
  const origSetText = t.setText.bind(t);
  t.setText = ((val: string | string[]) => origSetText(formatText(val))) as typeof t.setText;
  return t;
}

export function title(scene: Phaser.Scene, x: number, y: number, text: string, size: number = SIZE.h2, color: string = T.text): Phaser.GameObjects.Text {
  return txt(scene, x, y, toEnUpper(text), { fontFamily: F.display, fontSize: `${size}px`, fontStyle: '600', color, stroke: '#0a0610', strokeThickness: prefs().highContrast ? 6 : 4 }).setOrigin(0.5);
}

export interface ButtonOptions {
  label: string;
  sub?: string;
  w?: number;
  h?: number;
  variant?: PanelVariant;
  fontSize?: number;
  ariaLabel?: string;
  onClick: () => void;
}

/** Minimum physical-size touch hitbox in 1920x1080 reference coordinates (~48dp on landscape phone). */
const MIN_TOUCH_W = 120;
const MIN_TOUCH_H = 96;

/** Touch-sized gothic button with hover/press/keyboard/TalkBack feedback. Returns a Container you can position and hide. */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Image;
  private readonly focusRing: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly subLabel: Phaser.GameObjects.Text | null;
  private readonly a11y: { id: string; sync: () => void; unregister: () => void };
  private enabled = true;
  private pressed = false;
  private readonly variant: PanelVariant;
  private readonly bw: number;
  private readonly bh: number;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly opts: ButtonOptions) {
    super(scene, x, y);
    this.bw = opts.w ?? 420;
    this.bh = opts.h ?? SIZE.touch;
    this.variant = opts.variant ?? 'normal';
    this.bg = scene.add.image(0, 0, panelTexture(scene, this.bw, this.bh, this.variant));
    this.focusRing = scene.add.graphics();
    this.focusRing.lineStyle(4, C.goldHi, 1);
    const focusR = this.bh <= 140 ? Math.floor((this.bh + 4) / 2) : 28;
    this.focusRing.strokeRoundedRect(-this.bw / 2 - 4, -this.bh / 2 - 4, this.bw + 8, this.bh + 8, focusR);
    this.focusRing.setVisible(false);
    this.label = txt(scene, 0, opts.sub ? -14 : 0, opts.label, { fontFamily: F.display, fontSize: `${opts.fontSize ?? 34}px`, fontStyle: '600', color: T.text }).setOrigin(0.5);
    this.subLabel = opts.sub ? txt(scene, 0, 24, opts.sub, { fontSize: `${SIZE.small - 4}px`, color: T.dim }).setOrigin(0.5) : null;
    this.fitLabels();
    this.add([this.bg, this.focusRing, this.label, ...(this.subLabel ? [this.subLabel] : [])]);
    const hitW = Math.max(this.bw, MIN_TOUCH_W);
    const hitH = Math.max(this.bh, MIN_TOUCH_H);
    this.setSize(hitW, hitH);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => this.enabled && this.hover(true));
    this.on('pointerout', () => {
      this.pressed = false;
      this.hover(false);
    });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.setScale(0.97);
      Sfx.tap();
    });
    this.on('pointerup', () => {
      this.setScale(1);
      // only a press that began on this button counts, so the tap that opened a scene cannot click through
      if (this.enabled && this.pressed) opts.onClick();
      this.pressed = false;
    });
    scene.add.existing(this);

    this.a11y = registerA11yButton({
      getLabel: () => {
        if (this.opts.ariaLabel) return this.opts.ariaLabel;
        const main = this.label.text.trim();
        const sub = this.subLabel?.text.trim();
        return sub ? `${main} — ${sub}` : main;
      },
      isEnabled: () => this.enabled && this.active,
      isVisible: () => this.visible && this.active && Boolean(this.scene?.sys?.isActive()),
      getDepth: () => this.depth || (this.parentContainer?.depth ?? 0),
      getBoundsRef: () => ({ x: this.x, y: this.y, w: Math.max(this.bw, MIN_TOUCH_W), h: Math.max(this.bh, MIN_TOUCH_H) }),
      onFocusChange: (focused) => {
        if (!this.active) return;
        this.focusRing.setVisible(focused);
      },
      onActivate: () => {
        if (!this.enabled || !this.active) return;
        Sfx.tap();
        this.opts.onClick();
      }
    });
  }

  private fitLabels(): void {
    const maxW = this.bw - 48;
    this.label.setScale(1);
    if (this.label.width > maxW && this.label.width > 0) this.label.setScale(maxW / this.label.width);
    if (this.subLabel) {
      this.subLabel.setScale(1);
      if (this.subLabel.width > maxW && this.subLabel.width > 0) this.subLabel.setScale(maxW / this.subLabel.width);
    }
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
    this.a11y.sync();
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    this.fitLabels();
    this.a11y.sync();
    return this;
  }

  setSub(text: string): this {
    this.subLabel?.setText(text);
    this.fitLabels();
    this.a11y.sync();
    return this;
  }

  override setVisible(value: boolean): this {
    super.setVisible(value);
    this.a11y.sync();
    return this;
  }

  override setPosition(x?: number, y?: number, z?: number, w?: number): this {
    super.setPosition(x, y, z, w);
    this.a11y?.sync();
    return this;
  }

  override destroy(fromScene?: boolean): void {
    this.a11y.unregister();
    super.destroy(fromScene);
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
    if (!animate || prefs().reducedMotion) {
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
    g.lineStyle(prefs().highContrast ? 2.5 : 1.5, prefs().highContrast ? 0xffffff : C.silver, prefs().highContrast ? 0.85 : 0.45);
    g.strokeRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, this.bh / 2);
  }
}

export const hpColor = (r: number): number => (r > 0.5 ? C.hpGood : r > 0.25 ? C.hpMid : C.hpLow);

/** Fades a scene in; honours reduced motion. */
export function sceneFadeIn(scene: Phaser.Scene, ms = 450): void {
  if (prefs().reducedMotion) return;
  scene.cameras.main.fadeIn(ms, 10, 6, 16);
}

export function toast(scene: Phaser.Scene, message: string, ms = 2600): void {
  announce(message);
  const insets = safeInsets(scene);
  const w = Math.min(1500, 120 + message.length * 17);
  const bg = panel(scene, 0, 0, w, 96, 'hot');
  const t = txt(scene, 0, 0, message, { fontSize: `${SIZE.small}px`, color: T.text, align: 'center', wordWrap: { width: w - 60 } }).setOrigin(0.5);
  const targetY = 88 + insets.top;
  const box = scene.add.container(960, -80, [bg, t]).setDepth(DEPTH.toast);
  if (prefs().reducedMotion) {
    box.setY(targetY);
    scene.time.delayedCall(ms, () => box.destroy());
    return;
  }
  scene.tweens.add({ targets: box, y: targetY, duration: 320, ease: 'Back.easeOut' });
  scene.time.delayedCall(ms, () => scene.tweens.add({ targets: box, y: -100, alpha: 0, duration: 300, onComplete: () => box.destroy() }));
}

