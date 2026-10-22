import * as PIXI from 'pixi.js';
import { Sfx } from '../audio/Sfx';
import { REF_H, REF_W } from '../config';
import { shownIn, type PixiScene } from '../core/PixiScene';
import { announce, registerA11yButton } from '../platform/a11y';
import { qualityProfile } from '../platform/graphics';
import { prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { Services } from '../services';
import { attachLivingBackdrop } from '../vfx/livingBackdrop';
import { C, DEPTH, F, SIZE, T } from './theme';

/**
 * The gothic UI kit drawn directly with PIXI (D-25): same look, rules and accessibility as ui/kit.ts, which serves
 * the scenes still on the Phaser-style engine.
 */

export type PanelVariant = 'normal' | 'hot' | 'active' | 'dim' | 'danger';

const PALETTE: Record<PanelVariant, { top: number; bottom: number; edge: number; inner: number; edgeA: number }> = {
  normal: { top: 0x22132e, bottom: 0x0d0713, edge: C.gold, inner: C.silver, edgeA: 0.76 },
  hot: { top: 0x3e1a44, bottom: 0x18091f, edge: C.goldHi, inner: 0xffe8a3, edgeA: 0.96 },
  active: { top: 0x541b31, bottom: 0x220915, edge: 0xffea9f, inner: C.goldHi, edgeA: 1.0 },
  dim: { top: 0x16101c, bottom: 0x09060d, edge: C.silver, inner: C.gold, edgeA: 0.26 },
  danger: { top: 0x421020, bottom: 0x17060c, edge: C.crimsonHi, inner: C.gold, edgeA: 0.88 }
};

const PALETTE_HC: Record<PanelVariant, { top: number; bottom: number; edge: number; inner: number; edgeA: number }> = {
  normal: { top: 0x140b1c, bottom: 0x050208, edge: 0xffffff, inner: C.goldHi, edgeA: 0.92 },
  hot: { top: 0x2a1036, bottom: 0x0a0410, edge: 0xffe680, inner: 0xffffff, edgeA: 1 },
  active: { top: 0x3d1226, bottom: 0x14040c, edge: 0xfff099, inner: 0xffffff, edgeA: 1 },
  dim: { top: 0x0f0914, bottom: 0x040206, edge: C.silver, inner: C.gold, edgeA: 0.55 },
  danger: { top: 0x2e0816, bottom: 0x0c0206, edge: 0xff6b8b, inner: 0xffffff, edgeA: 0.98 }
};

const rgba = (c: number, a: number): string => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

/** Octagonal chamfered Gothic frame with 45-degree beveled corners (Reverse: 1999 / Gothic Anime RPG style). */
function chamferRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number): void {
  const c = Math.max(2, Math.min(cut, w * 0.28, h * 0.34));
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

const panelCanvases = new Map<string, HTMLCanvasElement>();
const panels = new Map<string, PIXI.Texture>();

const panelKey = (w: number, h: number, variant: PanelVariant): string => `${variant}|${prefs().highContrast ? 1 : 0}|${Math.round(w)}x${Math.round(h)}`;

/** baked glass-gothic plaque (chamfered octagonal frame for buttons and modals), cached per size + variant + contrast */
export function panelTexture(w: number, h: number, variant: PanelVariant = 'normal'): PIXI.Texture {
  const key = panelKey(w, h, variant);
  const hit = panels.get(key);
  if (hit && !hit.destroyed) return hit;
  const tex = PIXI.Texture.from(panelCanvas(w, h, variant));
  panels.set(key, tex);
  return tex;
}

/** the panel drawing itself, shared by the PIXI kit and the DOM kit (CSS background) */
export function panelCanvas(w: number, h: number, variant: PanelVariant = 'normal'): HTMLCanvasElement {
  const key = panelKey(w, h, variant);
  const cached = panelCanvases.get(key);
  if (cached) return cached;
  const hc = prefs().highContrast;
  w = Math.round(w);
  h = Math.round(h);
  const p = (hc ? PALETTE_HC : PALETTE)[variant];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const isBtn = h <= 140 && w >= h * 1.15;
    const outerCut = isBtn ? Math.min(18, Math.max(8, Math.floor(h * 0.22))) : Math.min(24, Math.max(12, Math.floor(Math.min(w, h) * 0.055)));
    const innerInset = isBtn ? 6 : 8;
    const innerCut = Math.max(4, outerCut - 3);
    const baseAlpha = hc ? 0.96 : variant === 'dim' ? 0.56 : variant === 'active' ? 0.92 : variant === 'hot' ? 0.88 : variant === 'danger' ? 0.86 : 0.84;
    const sheenAlpha = hc ? 0.45 : variant === 'dim' ? 0.12 : variant === 'active' ? 0.38 : variant === 'hot' ? 0.32 : 0.22;

    // 1. Deep smoked obsidian-violet glass fill
    const bgGrad = ctx.createLinearGradient(0, 2, 0, h - 2);
    bgGrad.addColorStop(0, rgba(p.top, Math.min(0.98, baseAlpha + 0.08)));
    bgGrad.addColorStop(0.52, rgba(p.bottom, baseAlpha));
    bgGrad.addColorStop(1, rgba(0x050209, Math.min(0.99, baseAlpha + 0.12)));
    ctx.fillStyle = bgGrad;
    chamferRect(ctx, 2, 2, w - 4, h - 4, outerCut);
    ctx.fill();

    // 2. Upper glass reflection band
    const sheenH = Math.max(8, Math.floor((h - innerInset * 2) * 0.44));
    const sheenGrad = ctx.createLinearGradient(0, innerInset, 0, innerInset + sheenH);
    sheenGrad.addColorStop(0, rgba(0xffffff, sheenAlpha * 0.42));
    sheenGrad.addColorStop(1, rgba(p.top, 0));
    ctx.fillStyle = sheenGrad;
    chamferRect(ctx, innerInset, innerInset, w - innerInset * 2, sheenH, innerCut);
    ctx.fill();

    // 3. Inner radial sanctum glow on 'hot' and 'active' states
    if ((variant === 'hot' || variant === 'active') && !hc) {
      const glow = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, Math.max(w, h) * 0.58);
      glow.addColorStop(0, variant === 'active' ? 'rgba(255,222,130,0.34)' : 'rgba(227,195,125,0.22)');
      glow.addColorStop(0.65, variant === 'active' ? 'rgba(212,50,92,0.18)' : 'rgba(180,140,255,0.08)');
      glow.addColorStop(1, 'rgba(212,50,92,0)');
      ctx.fillStyle = glow;
      chamferRect(ctx, innerInset, innerInset, w - innerInset * 2, h - innerInset * 2, innerCut);
      ctx.fill();
    }

    // 4. Outer antique-brass/gold frame
    ctx.lineWidth = hc ? 3.2 : variant === 'active' ? 2.8 : variant === 'hot' ? 2.4 : 1.9;
    ctx.strokeStyle = rgba(p.edge, p.edgeA);
    chamferRect(ctx, 2, 2, w - 4, h - 4, outerCut);
    ctx.stroke();

    // 5. Inset inner hairline frame
    ctx.lineWidth = hc ? 1.5 : variant === 'active' ? 1.5 : 1.1;
    ctx.strokeStyle = rgba(p.inner, hc ? 0.78 : variant === 'active' ? 0.78 : variant === 'hot' ? 0.58 : 0.36);
    chamferRect(ctx, innerInset, innerInset, w - innerInset * 2, h - innerInset * 2, innerCut);
    ctx.stroke();

    // 6. Active state lit top & bottom sanctum indicator bars (replaces ugly checkmarks)
    if (variant === 'active') {
      const barW = Math.max(24, Math.min(w * 0.46, w - outerCut * 3));
      ctx.fillStyle = rgba(0xffea9f, 0.95);
      ctx.fillRect((w - barW) / 2, 2, barW, 3);
      ctx.fillRect((w - barW) / 2, h - 5, barW, 3);
    }

    // 7. Gothic corner & side diamond filigree
    if (isBtn) {
      const dx = Math.min(20, Math.max(12, outerCut + 4));
      const r = Math.min(4.8, Math.max(3, h * 0.048));
      ctx.fillStyle = rgba(variant === 'active' ? 0xfff2ba : p.edge, hc ? 0.95 : variant === 'dim' ? 0.35 : 0.88);
      for (const cx of [dx, w - dx]) {
        diamond(ctx, cx, h / 2, r);
        if ((variant === 'hot' || variant === 'active') && w >= 180) {
          diamond(ctx, cx + (cx < w / 2 ? 8 : -8), h / 2, r * 0.55);
        }
      }
    } else {
      const c = Math.max(14, innerInset + 4);
      ctx.fillStyle = rgba(p.edge, hc ? 0.92 : 0.82);
      for (const [cx, cy] of [[c, c], [w - c, c], [c, h - c], [w - c, h - c]] as const) diamond(ctx, cx, cy, 4.5);
      if (w >= 320 && h >= 150) {
        diamond(ctx, w / 2, innerInset, 5.5);
        diamond(ctx, w / 2, h - innerInset, 5);
      }
    }
  }
  panelCanvases.set(key, canvas);
  return canvas;
}

export function panel(x: number, y: number, w: number, h: number, variant: PanelVariant = 'normal'): PIXI.Sprite {
  const s = new PIXI.Sprite(panelTexture(w, h, variant));
  s.anchor.set(0.5);
  s.position.set(x, y);
  return s;
}

/** Strips Turkish-specific letters into their English ASCII equivalents (English UI text). */
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
 * ASCII uppercase for Cinzel (`F.display`) text: Cinzel draws a lowercase `i` with a dot, so English display text is
 * converted to true uppercase (`FİRST` never appears).
 */
export function toEnUpper(raw: string): string {
  return sanitizeEnText(raw).replace(/i/g, 'I').toUpperCase();
}

/** Text options in the vocabulary every scene uses (Phaser-era names: fontStyle, strokeThickness, wordWrap) */
export interface TextOptions {
  fontFamily?: string;
  fontSize?: number | string;
  /** '600', 'italic', 'italic 500', 'bold' */
  fontStyle?: string;
  color?: string;
  stroke?: string;
  strokeThickness?: number;
  align?: 'left' | 'center' | 'right';
  wordWrap?: { width: number };
  lineSpacing?: number;
  letterSpacing?: number;
  /** drop shadow: offset (x, y), colour and blur */
  shadow?: { x: number; y: number; color: string; blur: number };
}

export function parseFontStyle(raw: string | undefined): { fontStyle: 'normal' | 'italic' | 'oblique'; fontWeight: PIXI.TextStyleFontWeight } {
  let fontStyle: 'normal' | 'italic' | 'oblique' = 'normal';
  let fontWeight: PIXI.TextStyleFontWeight = 'normal';
  for (const token of String(raw ?? '').trim().split(/\s+/)) {
    if (token === 'italic' || token === 'oblique') fontStyle = token;
    else if (token === 'bold' || token === 'bolder' || token === 'lighter') fontWeight = token;
    else if (/^[1-9]00$/.test(token)) fontWeight = token as PIXI.TextStyleFontWeight;
  }
  return { fontStyle, fontWeight };
}

export function fontPx(raw: number | string | undefined): number {
  const base = typeof raw === 'number' ? raw : raw ? Number.parseFloat(raw) || SIZE.body : SIZE.body;
  // body/small text grows for readability; large display headers keep their size
  return base <= 44 && prefs().textSize === 'large' ? Math.round(base * 1.12) : base;
}

/** display (Cinzel) text is ASCII uppercase in English so the font never draws a dotted capital I */
export function formatter(display: boolean): (v: string) => string {
  const en = prefs().locale === 'en';
  if (display) return (v) => (en ? toEnUpper(v) : v.toUpperCase());
  return (v) => (en ? sanitizeEnText(v) : v);
}

/** PIXI Text that applies the kit's locale/casing rules to every assignment of `text` */
export class UiText extends PIXI.Text {
  private fmt: ((v: string) => string) | null = null;

  constructor(text: string, style: PIXI.TextStyleOptions, resolution: number, fmt: (v: string) => string) {
    super({ text: fmt(text), style, resolution });
    this.fmt = fmt;
  }

  override get text(): string {
    return super.text;
  }

  /** the string this text would display for `v` (for measuring before assigning) */
  format(v: string): string {
    return this.fmt ? this.fmt(v) : v;
  }

  /** lines after word wrap, as the text would lay out `v` */
  wrap(v: string): string[] {
    return PIXI.CanvasTextMetrics.measureText(this.format(v), this.style, undefined, this.style.wordWrap).lines;
  }

  /** Phaser-style font style ('italic 500', '600') */
  setFontStyle(raw: string): void {
    const { fontStyle, fontWeight } = parseFontStyle(raw);
    this.style.fontStyle = fontStyle;
    this.style.fontWeight = fontWeight;
  }

  override set text(v: PIXI.TextString) {
    super.text = this.fmt ? this.fmt(String(v)) : String(v);
  }
}

export function txt(x: number, y: number, text: string, o: TextOptions = {}, origin: number | readonly [number, number] = 0): UiText {
  const hc = prefs().highContrast;
  const base = o.color ?? (hc ? '#ffffff' : T.text);
  const size = fontPx(o.fontSize);
  const thick = o.strokeThickness ?? (hc ? 3 : 0);
  const { fontStyle, fontWeight } = parseFontStyle(o.fontStyle);
  const style: PIXI.TextStyleOptions = {
    fontFamily: o.fontFamily ?? F.body,
    fontSize: size,
    fontStyle,
    fontWeight,
    fill: hc && base === T.dim ? '#dfd6ec' : base,
    align: o.align ?? 'left',
    letterSpacing: o.letterSpacing ?? 0,
    lineHeight: size * 1.2 + (o.lineSpacing ?? 0),
    ...(o.wordWrap ? { wordWrap: true, wordWrapWidth: o.wordWrap.width } : {}),
    ...(thick > 0 ? { stroke: { color: o.stroke ?? '#050208', width: thick, join: 'round' as const } } : {}),
    ...(o.shadow ? { dropShadow: { color: o.shadow.color, blur: o.shadow.blur, distance: Math.hypot(o.shadow.x, o.shadow.y), angle: Math.atan2(o.shadow.y, o.shadow.x), alpha: 1 } } : {})
  };
  const t = new UiText(text, style, qualityProfile().textResolution, formatter(o.fontFamily === F.display));
  const [ax, ay] = typeof origin === 'number' ? [origin, origin] : origin;
  t.anchor.set(ax, ay);
  t.position.set(x, y);
  return t;
}

export function title(x: number, y: number, text: string, size: number = SIZE.h2, color: string = T.text): UiText {
  return txt(x, y, text, { fontFamily: F.display, fontSize: size, fontStyle: '600', color, stroke: '#0a0610', strokeThickness: prefs().highContrast ? 6 : 4 }, 0.5);
}

/** shrinks a text to fit `maxW` (labels never overflow their pill) */
export function fitWidth(t: PIXI.Text, maxW: number): void {
  t.scale.set(1);
  if (t.width > maxW && t.width > 0) t.scale.set(maxW / t.width);
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

/** minimum touch hitbox in 1920x1080 reference px (~48dp on a landscape phone) */
const MIN_TOUCH_W = 120;
const MIN_TOUCH_H = 96;

/** Touch-sized gothic button with hover/press feedback and a focusable ARIA mirror (keyboard, TalkBack). */
export class Button extends PIXI.Container {
  private readonly bg: PIXI.Sprite;
  private readonly ring = new PIXI.Graphics();
  private readonly caption: UiText;
  private readonly subLabel: UiText | null;
  private readonly a11y: { sync: () => void; unregister: () => void };
  private readonly unmirror: () => void;
  private readonly bw: number;
  private readonly bh: number;
  private variant: PanelVariant;
  private enabled = true;
  private pressed = false;

  constructor(private readonly scene: PixiScene, x: number, y: number, private readonly opts: ButtonOptions) {
    super();
    this.position.set(x, y);
    this.bw = opts.w ?? 420;
    this.bh = opts.h ?? SIZE.touch;
    this.variant = opts.variant ?? 'normal';
    this.bg = new PIXI.Sprite(panelTexture(this.bw, this.bh, this.variant));
    this.bg.anchor.set(0.5);
    this.ring.roundRect(-this.bw / 2 - 4, -this.bh / 2 - 4, this.bw + 8, this.bh + 8, 12).stroke({ width: 3.5, color: C.goldHi });
    this.ring.visible = false;
    const labelColor = this.variant === 'active' || this.variant === 'hot' ? '#fff3c4' : T.text;
    this.caption = txt(0, opts.sub ? -12 : 0, opts.label, { fontFamily: F.display, fontSize: opts.fontSize ?? 32, fontStyle: '700', color: labelColor, stroke: '#07040c', strokeThickness: 3.5 }, 0.5);
    this.subLabel = opts.sub ? txt(0, 20, opts.sub, { fontSize: Math.max(16, (opts.fontSize ?? 32) * 0.68), color: this.variant === 'active' ? '#ffd98a' : T.dim, stroke: '#07040c', strokeThickness: 2.5 }, 0.5) : null;
    this.fitLabels();
    this.addChild(this.bg, this.ring, this.caption, ...(this.subLabel ? [this.subLabel] : []));
    const hw = Math.max(this.bw, MIN_TOUCH_W);
    const hh = Math.max(this.bh, MIN_TOUCH_H);
    this.hitArea = new PIXI.Rectangle(-hw / 2, -hh / 2, hw, hh);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerover', () => this.enabled && this.hover(true));
    this.on('pointerout', () => {
      this.pressed = false;
      this.hover(false);
    });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.scene.anim.killOf(this);
      this.scale.set(0.95);
      Sfx.tap();
    });
    this.on('pointerup', () => {
      this.scene.anim.killOf(this);
      if (!prefs().reducedMotion) {
        this.scale.set(1.045);
        this.scene.anim.to(this, { scaleX: 1, scaleY: 1 }, { duration: 180, ease: 'back.out' });
      } else {
        this.scale.set(1);
      }
      // only a press that began on this button counts, so the tap that opened a scene cannot click through
      if (this.enabled && this.pressed) opts.onClick();
      this.pressed = false;
    });
    this.on('pointerupoutside', () => {
      this.pressed = false;
      this.scale.set(1);
    });
    this.a11y = registerA11yButton({
      getLabel: () => {
        if (this.opts.ariaLabel) return this.opts.ariaLabel;
        const sub = this.subLabel?.text.trim();
        return sub ? `${this.caption.text.trim()} — ${sub}` : this.caption.text.trim();
      },
      isEnabled: () => this.enabled && !this.destroyed,
      isVisible: () => shownIn(this, this.scene),
      getDepth: () => {
        let d = this.zIndex;
        for (let n = this.parent; n; n = n.parent) d = Math.max(d, n.zIndex);
        return d;
      },
      getBoundsRef: () => {
        const p = this.destroyed ? { x: 0, y: 0 } : this.getGlobalPosition();
        return { x: p.x, y: p.y, w: hw, h: hh };
      },
      onFocusChange: (focused) => {
        if (!this.destroyed) this.ring.visible = focused;
      },
      onActivate: () => {
        if (!this.enabled || this.destroyed) return;
        Sfx.tap();
        this.opts.onClick();
      }
    });
    this.unmirror = scene.mirror(this.a11y);
  }

  private fitLabels(): void {
    fitWidth(this.caption, this.bw - 44);
    if (this.subLabel) fitWidth(this.subLabel, this.bw - 44);
  }

  private hover(on: boolean): void {
    this.bg.texture = panelTexture(this.bw, this.bh, on ? (this.variant === 'active' ? 'active' : 'hot') : this.variant);
    this.scale.set(on ? 1.025 : 1);
  }

  setVariant(v: PanelVariant): this {
    this.variant = v;
    this.bg.texture = panelTexture(this.bw, this.bh, this.enabled ? v : 'dim');
    this.caption.style.fill = v === 'active' || v === 'hot' ? '#fff3c4' : T.text;
    if (this.subLabel) this.subLabel.style.fill = v === 'active' ? '#ffd98a' : T.dim;
    return this;
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.bg.texture = panelTexture(this.bw, this.bh, on ? this.variant : 'dim');
    this.caption.alpha = on ? 1 : 0.45;
    if (this.subLabel) this.subLabel.alpha = on ? 1 : 0.45;
    this.a11y.sync();
    return this;
  }

  setLabel(text: string): this {
    this.caption.text = text;
    this.fitLabels();
    this.a11y.sync();
    return this;
  }

  setSub(text: string): this {
    if (this.subLabel) this.subLabel.text = text;
    this.fitLabels();
    this.a11y.sync();
    return this;
  }

  override destroy(options?: PIXI.DestroyOptions): void {
    this.unmirror();
    this.a11y.unregister();
    super.destroy(options);
  }
}

/** Slim HP/Focus bar with smooth fill, damage-trail ghost bar, and liquid sheen (#6 Approved UI Kit Bar). */
export class Bar extends PIXI.Container {
  private readonly g = new PIXI.Graphics();
  shown = 1;
  ghost = 1;
  private target = 1;

  constructor(private readonly scene: PixiScene, x: number, y: number, private readonly bw: number, private readonly bh: number, private readonly colorFn: (ratio: number) => number) {
    super();
    this.position.set(x, y);
    this.addChild(this.g);
    this.redraw();
  }

  set(ratio: number, animate = true): void {
    const r = Math.min(1, Math.max(0, ratio));
    const prev = this.shown;
    this.target = r;
    this.scene.anim.killOf(this);
    if (!animate || prefs().reducedMotion) {
      this.shown = r;
      this.ghost = r;
      this.redraw();
      return;
    }
    if (r < prev) {
      this.ghost = Math.max(this.ghost, prev);
      this.scene.anim.to(this, { shown: r }, { duration: 260, ease: 'cubic.out', onUpdate: () => this.redraw() });
      this.scene.anim.to(this, { ghost: r }, { duration: 620, delay: 140, ease: 'quad.out', onUpdate: () => this.redraw() });
    } else {
      this.ghost = r;
      this.scene.anim.to(this, { shown: r }, { duration: 380, ease: 'cubic.out', onUpdate: () => this.redraw() });
    }
  }

  private redraw(): void {
    if (this.destroyed) return;
    const { bw, bh } = this;
    const hc = prefs().highContrast;
    const g = this.g.clear();
    // 1. Dark obsidian recessed trough
    g.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2).fill({ color: 0x07040a, alpha: 0.9 });
    // 2. Delayed damage-trail ghost bar when losing HP
    if (this.ghost > this.shown + 0.004) {
      g.roundRect(-bw / 2 + 1, -bh / 2 + 1, Math.max(bh - 2, (bw - 2) * this.ghost), bh - 2, (bh - 2) / 2).fill({ color: 0xffb3c4, alpha: 0.72 });
    }
    // 3. Main liquid fill + top specular sheen
    if (this.shown > 0.001) {
      const fillW = Math.max(bh - 2, (bw - 2) * this.shown);
      const col = this.colorFn(this.target);
      g.roundRect(-bw / 2 + 1, -bh / 2 + 1, fillW, bh - 2, (bh - 2) / 2).fill(col);
      if (bh >= 6) {
        g.roundRect(-bw / 2 + 2, -bh / 2 + 1.5, Math.max(2, fillW - 2), Math.max(1.5, (bh - 2) * 0.42), (bh - 2) / 4).fill({ color: 0xffffff, alpha: 0.28 });
      }
    }
    // 4. Metallic bezel & 100% Focus Ultimate-Ready golden-violet rim
    const isFullFocus = this.target >= 0.995 && this.colorFn(1) === C.focus;
    g.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2).stroke({
      width: hc ? 2.5 : isFullFocus ? 2.2 : 1.5,
      color: hc ? 0xffffff : isFullFocus ? C.goldHi : C.silver,
      alpha: hc ? 0.9 : isFullFocus ? 0.95 : 0.52
    });
  }
}

export const hpColor = (r: number): number => (r > 0.5 ? C.hpGood : r > 0.25 ? C.hpMid : C.hpLow);

/** fades a scene in from the void; honours reduced motion */
export function sceneFadeIn(scene: PixiScene, ms = 450): void {
  if (!prefs().reducedMotion) scene.fadeIn(ms, 0x0a0610);
}

export function toast(scene: PixiScene, message: string, ms = 2600): void {
  announce(message);
  const insets = safeInsets();
  const w = Math.min(1500, 120 + message.length * 17);
  const box = new PIXI.Container();
  box.addChild(panel(0, 0, w, 96, 'hot'), txt(0, 0, message, { fontSize: SIZE.small, color: T.text, align: 'center', wordWrap: { width: w - 60 } }, 0.5));
  box.position.set(REF_W / 2, -80);
  scene.add(box, DEPTH.toast);
  const targetY = 88 + insets.top;
  if (prefs().reducedMotion) {
    box.y = targetY;
    scene.anim.after(ms, () => box.destroy({ children: true }));
    return;
  }
  scene.anim.to(box, { y: targetY }, { duration: 320, ease: 'back.out' });
  scene.anim.after(ms, () => scene.anim.to(box, { y: -100, alpha: 0 }, { duration: 300, onComplete: () => box.destroy({ children: true }) }));
}

/** a rectangle that swallows taps under a modal */
export function blocker(color = 0x000000, alpha = 0.7): PIXI.Graphics {
  const g = new PIXI.Graphics().rect(0, 0, REF_W, REF_H).fill({ color, alpha: 1 });
  g.alpha = alpha;
  g.eventMode = 'static';
  return g;
}

/** soft radial edge darkening over the stage (the previous camera vignette: radius and strength 0..1) */
export function vignette(radius: number, strength: number): PIXI.Graphics {
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  const gradient = new PIXI.FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: clamp(radius * 0.6) * 0.5,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.75,
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: 'rgba(0,0,0,0)' },
      { offset: 1, color: `rgba(0,0,0,${clamp(strength * 1.25)})` }
    ]
  });
  return new PIXI.Graphics().rect(0, 0, REF_W, REF_H).fill(gradient);
}

/** vertical alpha ramp of one colour (screen grading bands) */
export function verticalShade(x: number, y: number, w: number, h: number, color: number, alphaTop: number, alphaBottom: number): PIXI.Graphics {
  const c = (a: number): string => rgba(color, a);
  const gradient = new PIXI.FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local', colorStops: [{ offset: 0, color: c(alphaTop) }, { offset: 1, color: c(alphaBottom) }] });
  return new PIXI.Graphics().rect(x, y, w, h).fill(gradient);
}

/**
 * Full-screen backdrop art behind a scene. The art library is rebuilt after every content patch, so it loads the image
 * itself (a no-op when loaded) and never throws: a missing or failed background leaves the scene's plain dark fill.
 */
export async function backdrop(scene: PixiScene, location: string, depth = -20): Promise<PIXI.Sprite | null> {
  const art = Services.art;
  if (!art) return null;
  try {
    await art.loadBackground(scene, location);
    if (!scene.live) return null;
    const img = scene.add(new PIXI.Sprite(scene.tex(art.background(location))), depth);
    img.anchor.set(0.5);
    img.position.set(REF_W / 2, REF_H / 2);
    const cover = Math.max(REF_W / (img.texture.width || REF_W), REF_H / (img.texture.height || REF_H));
    img.scale.set(cover);
    const fx = attachLivingBackdrop(scene, img, {
      baseScale: cover,
      fxDepth: Math.max(depth + 1, -5),
      mood: 'sanctuary',
      location,
      intensity: 0.98
    });
    img.once('destroyed', () => {
      if (!fx.destroyed) fx.destroy({ children: true });
    });
    return img;
  } catch {
    return null;
  }
}

/** a short notice on whatever screen is showing: HTML screens use their own toast, PIXI scenes this kit's */
export function notify(scene: PixiScene, message: string, ms = 2600): void {
  if (scene.notify) scene.notify(message, ms);
  else toast(scene, message, ms);
}
