import { Sfx } from '../audio/Sfx';
import { REF_H, REF_W } from '../config';
import { announce } from '../platform/a11y';
import { prefs } from '../platform/prefs';
import { fontPx, formatter, panelCanvas, parseFontStyle, type ButtonOptions, type PanelVariant, type TextOptions } from './pixiKit';
import { C, DEPTH, F, SIZE, T } from './theme';

/**
 * The gothic UI kit as HTML (R10, D-25): screens lay out in the same 1920×1080 reference frame as the stage, and the
 * DOM stage scales with the fitted canvas, so a screen's coordinates mean the same thing in both. Controls are real
 * buttons (focus, keyboard, screen readers and Escape work natively); panels reuse the PIXI kit's baked drawing.
 */

const CSS = `
.uomd-stage{position:absolute;left:0;top:0;width:${REF_W}px;height:${REF_H}px;transform-origin:0 0;pointer-events:none;overflow:hidden;font-family:${F.body};color:${T.text}}
.uomd-stage *{box-sizing:border-box}
.uomd-node{position:absolute;margin:0}
.uomd-text{white-space:pre;pointer-events:none;paint-order:stroke fill;user-select:none;-webkit-user-select:none}
.uomd-text.wrap{white-space:pre-wrap;overflow-wrap:anywhere}
.uomd-btn{pointer-events:auto;border:0;padding:0;background:transparent center/100% 100% no-repeat;color:${T.text};cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;transition:transform .12s cubic-bezier(.34,1.56,.64,1),filter .15s ease-out;outline:none;border-radius:999px;overflow:hidden}
.uomd-btn:hover:not(:disabled){transform:var(--uomd-t) scale(1.022);filter:drop-shadow(0 0 12px rgba(227,195,125,.28))}
.uomd-btn:active:not(:disabled){transform:var(--uomd-t) scale(.965)!important}
.uomd-btn:focus-visible{box-shadow:0 0 0 4px ${'#' + C.goldHi.toString(16)}}
.uomd-btn:disabled{cursor:default}
.uomd-btn.hot::after{content:'';position:absolute;inset:0;background:linear-gradient(112deg,transparent 30%,rgba(255,244,212,.22) 48%,rgba(227,195,125,.35) 52%,transparent 68%);transform:translateX(-130%);animation:uomd-sheen 3.6s ease-in-out infinite;pointer-events:none}
@keyframes uomd-sheen{0%,28%{transform:translateX(-130%)}68%,100%{transform:translateX(130%)}}
.uomd-btn .label{font-family:${F.display};font-weight:600;letter-spacing:.02em;white-space:nowrap;line-height:1.1;position:relative;z-index:1}
.uomd-btn .sub{color:${T.dim};white-space:nowrap;line-height:1.1;position:relative;z-index:1}
.uomd-btn:disabled .label,.uomd-btn:disabled .sub{opacity:.45}
.uomd-panel{pointer-events:none;background:center/100% 100% no-repeat}
.uomd-panel.tap{pointer-events:auto;cursor:pointer;outline:none;border-radius:28px}
.uomd-panel.tap:focus-visible{box-shadow:0 0 0 4px ${'#' + C.goldHi.toString(16)}}
.uomd-box{pointer-events:none}
.uomd-box.block{pointer-events:auto}
.uomd-group{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}
.uomd-btn.bare{background:none!important}
.uomd-btn.bare .label,.uomd-btn.bare .sub{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.uomd-blink{animation:uomd-blink 2.3s ease-in-out infinite}
@keyframes uomd-blink{0%,100%{opacity:1;scale:1.02}50%{opacity:.24;scale:.98}}
@media (prefers-reduced-motion: reduce){.uomd-btn{transition:none}.uomd-btn.hot::after,.uomd-blink{animation:none}}
`;

function ensureCss(): void {
  if (document.getElementById('uomd-dom-kit')) return;
  const style = document.createElement('style');
  style.id = 'uomd-dom-kit';
  style.textContent = CSS;
  document.head.appendChild(style);
}

const urls = new Map<string, string>();
/** the PIXI kit's panel drawing as a CSS background */
function panelUrl(w: number, h: number, variant: PanelVariant): string {
  const key = `${variant}|${prefs().highContrast ? 1 : 0}|${Math.round(w)}x${Math.round(h)}`;
  let url = urls.get(key);
  if (!url) {
    url = `url(${panelCanvas(w, h, variant).toDataURL()})`;
    urls.set(key, url);
  }
  return url;
}

/** a positioned element in reference px; origin like the stage objects it replaces (0..1 of its own box) */
export class DomNode<E extends HTMLElement = HTMLElement> {
  private ox = 0;
  private oy = 0;
  private sx = 1;
  private sy = 1;
  private dead = false;

  constructor(readonly el: E, public x: number, public y: number) {
    el.classList.add('uomd-node');
    this.place();
  }

  private place(): void {
    const t = `translate(${-this.ox * 100}%, ${-this.oy * 100}%)`;
    this.el.style.left = `${this.x}px`;
    this.el.style.top = `${this.y}px`;
    this.el.style.transformOrigin = `${this.ox * 100}% ${this.oy * 100}%`;
    this.el.style.setProperty('--uomd-t', t);
    this.el.style.transform = this.sx === 1 && this.sy === 1 ? t : `${t} scale(${this.sx}, ${this.sy})`;
  }

  setOrigin(ox: number, oy = ox): this {
    this.ox = ox;
    this.oy = oy;
    this.place();
    return this;
  }

  setPosition(x: number, y = this.y): this {
    this.x = x;
    this.y = y;
    this.place();
    return this;
  }

  setY(y: number): this {
    return this.setPosition(this.x, y);
  }

  setScale(sx: number, sy = sx): this {
    this.sx = sx;
    this.sy = sy;
    this.place();
    return this;
  }

  setVisible(on: boolean): this {
    this.el.hidden = !on;
    return this;
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  setAlpha(a: number): this {
    this.el.style.opacity = String(a);
    return this;
  }

  setDepth(z: number): this {
    this.el.style.zIndex = String(Math.round(z));
    return this;
  }

  /** unscaled layout size in reference px */
  get width(): number {
    return this.el.offsetWidth;
  }

  get height(): number {
    return this.el.offsetHeight;
  }

  get active(): boolean {
    return !this.dead && this.el.isConnected;
  }

  /** called once the element is in the document (layout can be measured) */
  mounted(): void {}

  destroy(): void {
    this.dead = true;
    this.el.remove();
  }
}

/** applies the kit's text options to an element (shared by text nodes and button labels) */
function styleText(el: HTMLElement, o: TextOptions): void {
  const hc = prefs().highContrast;
  const base = o.color ?? (hc ? '#ffffff' : T.text);
  const size = fontPx(o.fontSize);
  const { fontStyle, fontWeight } = parseFontStyle(o.fontStyle);
  const thick = o.strokeThickness ?? (hc ? 3 : 0);
  const s = el.style;
  s.fontFamily = o.fontFamily ?? F.body;
  s.fontSize = `${size}px`;
  s.fontStyle = fontStyle;
  s.fontWeight = String(fontWeight);
  s.color = hc && base === T.dim ? '#dfd6ec' : base;
  s.lineHeight = `${size * 1.2 + (o.lineSpacing ?? 0)}px`;
  s.letterSpacing = o.letterSpacing ? `${o.letterSpacing}px` : '';
  s.textAlign = o.align ?? 'left';
  s.setProperty('-webkit-text-stroke', thick > 0 ? `${thick}px ${o.stroke ?? '#050208'}` : '');
  s.textShadow = o.shadow ? `${o.shadow.x}px ${o.shadow.y}px ${o.shadow.blur}px ${o.shadow.color}` : '';
}

export class DomText extends DomNode<HTMLDivElement> {
  private readonly fmt: (v: string) => string;
  private raw = '';

  constructor(x: number, y: number, text: string, o: TextOptions = {}) {
    super(document.createElement('div'), x, y);
    this.el.className += ' uomd-text';
    if (o.wordWrap) {
      this.el.classList.add('wrap');
      this.el.style.width = `${o.wordWrap.width}px`;
    }
    styleText(this.el, o);
    this.fmt = formatter(o.fontFamily === F.display);
    this.setText(text);
  }

  get text(): string {
    return this.raw;
  }

  setText(v: string | string[]): this {
    this.raw = Array.isArray(v) ? v.join('\n') : v;
    this.el.textContent = this.fmt(this.raw);
    return this;
  }

  setColor(c: string): this {
    this.el.style.color = c;
    return this;
  }

  /** Phaser-style font style ('italic 500', '600') */
  setFontStyle(raw: string): this {
    const { fontStyle, fontWeight } = parseFontStyle(raw);
    this.el.style.fontStyle = fontStyle;
    this.el.style.fontWeight = String(fontWeight);
    return this;
  }

  /** shrinks to fit `maxW` reference px (labels never overflow their card) */
  fit(maxW: number): this {
    this.setScale(1);
    if (this.width > maxW && this.width > 0) this.setScale(maxW / this.width);
    return this;
  }
}

/** minimum touch target in reference px (~48dp on a landscape phone) */
const MIN_TOUCH_W = 120;
const MIN_TOUCH_H = 96;

export interface DomButtonOptions extends ButtonOptions {
  /** activated by Escape when it is the top screen's dismiss action (BACK / CLOSE) */
  escape?: boolean;
  /** no visible panel or label: a focusable, labelled hit area over artwork drawn elsewhere */
  bare?: boolean;
}

export class DomButton extends DomNode<HTMLButtonElement> {
  private readonly label: HTMLSpanElement;
  private readonly sub: HTMLSpanElement | null;
  private readonly bw: number;
  private readonly bh: number;
  private readonly variant: PanelVariant;
  private readonly fmtLabel = formatter(true);
  private readonly fmtSub = formatter(false);

  constructor(x: number, y: number, private readonly opts: DomButtonOptions) {
    super(document.createElement('button'), x, y);
    const b = this.el;
    b.type = 'button';
    b.className += ' uomd-btn';
    this.bw = opts.w ?? 420;
    this.bh = opts.h ?? SIZE.touch;
    this.variant = opts.variant ?? 'normal';
    b.style.width = `${Math.max(this.bw, MIN_TOUCH_W)}px`;
    b.style.height = `${Math.max(this.bh, MIN_TOUCH_H)}px`;
    b.style.backgroundSize = `${this.bw}px ${this.bh}px`;
    b.style.borderRadius = this.bh <= 140 ? '999px' : '28px';
    if (opts.escape) b.dataset.escape = '1';
    if (opts.bare) b.classList.add('bare');
    if (this.variant === 'hot' && !opts.bare) b.classList.add('hot');
    if (opts.ariaLabel) b.setAttribute('aria-label', opts.ariaLabel);
    this.label = document.createElement('span');
    this.label.className = 'label';
    styleText(this.label, { fontFamily: F.display, fontSize: opts.fontSize ?? 34, fontStyle: '600', color: T.text });
    this.sub = opts.sub !== undefined ? document.createElement('span') : null;
    if (this.sub) {
      this.sub.className = 'sub';
      styleText(this.sub, { fontSize: SIZE.small - 4, color: T.dim });
    }
    b.append(this.label, ...(this.sub ? [this.sub] : []));
    this.setLabel(opts.label);
    if (opts.sub !== undefined) this.setSub(opts.sub);
    this.paint(this.variant);
    b.addEventListener('pointerenter', () => !b.disabled && this.paint('hot'));
    b.addEventListener('pointerleave', () => this.paint(b.disabled ? 'dim' : this.variant));
    b.addEventListener('pointerdown', () => !b.disabled && Sfx.tap());
    b.addEventListener('click', () => {
      if (b.disabled) return;
      if (b.matches(':focus-visible')) Sfx.tap(); // keyboard activation has no pointerdown
      opts.onClick();
    });
    this.setOrigin(0.5);
  }

  private paint(v: PanelVariant): void {
    this.el.style.backgroundImage = panelUrl(this.bw, this.bh, v);
  }

  override mounted(): void {
    this.fitLabels();
  }

  private fitLabels(): void {
    const maxW = this.bw - 48;
    for (const span of [this.label, this.sub]) {
      if (!span) continue;
      span.style.transform = '';
      const w = span.offsetWidth;
      if (w > maxW && w > 0) span.style.transform = `scale(${maxW / w})`;
    }
  }

  setEnabled(on: boolean): this {
    this.el.disabled = !on;
    this.paint(on ? this.variant : 'dim');
    return this;
  }

  setLabel(text: string): this {
    this.label.textContent = this.fmtLabel(text);
    this.fitLabels();
    return this;
  }

  setSub(text: string): this {
    if (this.sub) this.sub.textContent = this.fmtSub(text);
    this.fitLabels();
    return this;
  }
}

/** a baked gothic card; `onTap` makes the whole card a button (role, focus, Enter/Space) */
export class DomPanel extends DomNode<HTMLDivElement> {
  constructor(x: number, y: number, w: number, h: number, variant: PanelVariant = 'normal') {
    super(document.createElement('div'), x, y);
    this.el.className += ' uomd-panel';
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    this.el.style.backgroundImage = panelUrl(w, h, variant);
    this.setOrigin(0.5);
  }

  onTap(fn: () => void, label: string): this {
    const el = this.el;
    el.classList.add('tap');
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', label);
    el.addEventListener('pointerdown', () => Sfx.tap());
    el.addEventListener('click', fn);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      Sfx.tap();
      fn();
    });
    return this;
  }
}

/** a flat colour box (dimmers, rules, simple bars); `block` makes it swallow taps under a modal */
export class DomBox extends DomNode<HTMLDivElement> {
  constructor(x: number, y: number, w: number, h: number, color: number, alpha = 1, block = false) {
    super(document.createElement('div'), x, y);
    this.el.className += ` uomd-box${block ? ' block' : ''}`;
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    this.setFill(color, alpha);
  }

  setFill(color: number, alpha = 1): this {
    this.el.style.background = `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
    return this;
  }

  setSize(w: number, h: number): this {
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    return this;
  }
}

/** a slim value bar (HP-style), filled with `colorFn(ratio)` */
export class DomBar extends DomNode<HTMLDivElement> {
  private readonly fill = document.createElement('div');

  constructor(x: number, y: number, bw: number, bh: number, private readonly colorFn: (ratio: number) => number) {
    super(document.createElement('div'), x, y);
    const hc = prefs().highContrast;
    const s = this.el.style;
    s.width = `${bw}px`;
    s.height = `${bh}px`;
    s.borderRadius = `${bh / 2}px`;
    s.background = 'rgba(7,4,10,.85)';
    s.border = `${hc ? 2.5 : 1.5}px solid ${hc ? 'rgba(255,255,255,.85)' : 'rgba(201,182,228,.45)'}`;
    s.overflow = 'hidden';
    this.fill.style.cssText = `height:100%;border-radius:${bh / 2}px;transition:width .38s cubic-bezier(.33,1,.68,1)`;
    if (prefs().reducedMotion) this.fill.style.transition = 'none';
    this.el.appendChild(this.fill);
    this.el.setAttribute('role', 'progressbar');
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('aria-valuemax', '100');
    this.setOrigin(0.5);
    this.set(0);
  }

  set(ratio: number): void {
    const r = Math.min(1, Math.max(0, ratio));
    this.fill.style.width = `${r * 100}%`;
    const c = this.colorFn(r);
    const hex = `#${c.toString(16).padStart(6, '0')}`;
    this.fill.style.background = `linear-gradient(180deg, rgba(255,255,255,.32) 0%, ${hex} 48%, ${hex} 100%)`;
    this.fill.style.boxShadow = r > 0.02 ? `0 0 12px ${hex}88` : 'none';
    this.el.setAttribute('aria-valuenow', String(Math.round(r * 100)));
  }
}

/** a clearable layer of nodes (a screen's body) */
export class DomGroup extends DomNode<HTMLDivElement> {
  private readonly kids = new Set<DomNode>();

  constructor() {
    super(document.createElement('div'), 0, 0);
    this.el.className += ' uomd-group';
  }

  add<N extends DomNode>(node: N): N {
    this.kids.add(node);
    this.el.appendChild(node.el);
    node.mounted();
    return node;
  }

  removeAll(): void {
    for (const k of this.kids) k.destroy();
    this.kids.clear();
  }

  override destroy(): void {
    this.removeAll();
    super.destroy();
  }
}

/** a natively scrolling area (touch, wheel, keyboard); children use coordinates inside its content */
export class DomScroll extends DomGroup {
  private readonly spacer = document.createElement('div');

  constructor(x: number, y: number, w: number, h: number) {
    super();
    const s = this.el.style;
    s.left = `${x}px`;
    s.top = `${y}px`;
    s.width = `${w}px`;
    s.height = `${h}px`;
    s.overflowY = 'auto';
    s.overflowX = 'hidden';
    s.pointerEvents = 'auto';
    s.overscrollBehavior = 'contain';
    s.setProperty('scrollbar-width', 'thin');
    s.setProperty('scrollbar-color', 'rgba(227,195,125,.5) transparent');
    this.spacer.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:0;pointer-events:none';
    this.el.appendChild(this.spacer);
    this.el.tabIndex = 0;
  }

  /** total content height (sets the scroll range) */
  setContentHeight(h: number): this {
    this.spacer.style.height = `${h}px`;
    return this;
  }

  scrollTo(y: number): void {
    this.el.scrollTop = y;
  }
}

/** a still from a loaded texture, copied onto a canvas (the DOM has no access to GPU textures) */
export class DomImage extends DomNode<HTMLCanvasElement> {
  constructor(x: number, y: number, source: CanvasImageSource, frame: { x: number; y: number; width: number; height: number }, w: number, h: number) {
    super(document.createElement('canvas'), x, y);
    const c = this.el;
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    c.style.pointerEvents = 'none';
    c.getContext('2d')?.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, c.width, c.height);
    this.setOrigin(0.5);
  }
}

const stages: DomStage[] = [];
let escapeInstalled = false;

function onEscape(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  const top = stages[stages.length - 1];
  const target = top ? [...top.root.querySelectorAll<HTMLButtonElement>('button[data-escape]')].filter((b) => !b.disabled && b.offsetParent !== null && !b.closest('[inert]')).pop() : undefined;
  if (!target) return;
  e.preventDefault();
  target.click();
}

/** One screen's HTML layer, in reference px, scaled with the fitted stage. */
export class DomStage {
  readonly root = document.createElement('div');
  private readonly resize: ResizeObserver | null;

  constructor(private readonly parent: HTMLElement, depth = 0) {
    ensureCss();
    this.root.className = 'uomd-stage';
    this.root.style.zIndex = String(depth);
    parent.appendChild(this.root);
    const fit = (): void => {
      this.root.style.transform = `scale(${(parent.clientWidth || REF_W) / REF_W})`;
    };
    fit();
    this.resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    this.resize?.observe(parent);
    stages.push(this);
    if (!escapeInstalled) {
      escapeInstalled = true;
      window.addEventListener('keydown', onEscape);
    }
  }

  private mount<N extends DomNode>(node: N, into?: DomGroup): N {
    if (into) return into.add(node);
    this.root.appendChild(node.el);
    node.mounted();
    return node;
  }

  text(x: number, y: number, text: string, o: TextOptions = {}, into?: DomGroup): DomText {
    return this.mount(new DomText(x, y, text, o), into);
  }

  button(x: number, y: number, opts: DomButtonOptions, into?: DomGroup): DomButton {
    return this.mount(new DomButton(x, y, opts), into);
  }

  panel(x: number, y: number, w: number, h: number, variant: PanelVariant = 'normal', into?: DomGroup): DomPanel {
    return this.mount(new DomPanel(x, y, w, h, variant), into);
  }

  box(x: number, y: number, w: number, h: number, color: number, alpha = 1, into?: DomGroup): DomBox {
    return this.mount(new DomBox(x, y, w, h, color, alpha), into);
  }

  bar(x: number, y: number, w: number, h: number, colorFn: (ratio: number) => number, into?: DomGroup): DomBar {
    return this.mount(new DomBar(x, y, w, h, colorFn), into);
  }

  group(into?: DomGroup): DomGroup {
    return this.mount(new DomGroup(), into);
  }

  scroll(x: number, y: number, w: number, h: number, into?: DomGroup): DomScroll {
    return this.mount(new DomScroll(x, y, w, h), into);
  }

  image(x: number, y: number, source: CanvasImageSource, frame: { x: number; y: number; width: number; height: number }, w: number, h: number, into?: DomGroup): DomImage {
    return this.mount(new DomImage(x, y, source, frame, w, h), into);
  }

  /** a full-screen dimmer that swallows taps under a modal */
  blocker(alpha = 0.7, into?: DomGroup, color = 0x000000): DomBox {
    return this.mount(new DomBox(0, 0, REF_W, REF_H, color, alpha, true), into);
  }

  /** makes everything but `el` inert (no focus, no taps, hidden from screen readers) while a modal is open; null restores */
  setModal(el: HTMLElement | null): void {
    for (const child of Array.from(this.root.children)) (child as HTMLElement).inert = el !== null && child !== el;
    el?.setAttribute('role', 'dialog');
    el?.setAttribute('aria-modal', 'true');
  }

  /** short message at the top; also read by screen readers */
  toast(message: string, ms = 2600, top = 88): void {
    announce(message);
    const w = Math.min(1500, 120 + message.length * 17);
    const g = this.group();
    g.setDepth(DEPTH.toast);
    g.add(new DomPanel(REF_W / 2, top, w, 96, 'hot'));
    g.add(new DomText(REF_W / 2, top, message, { fontSize: SIZE.small, color: T.text, align: 'center', wordWrap: { width: w - 60 } }).setOrigin(0.5));
    const reduced = prefs().reducedMotion;
    g.el.style.transition = reduced ? '' : 'transform .32s cubic-bezier(.34,1.56,.64,1), opacity .3s';
    if (!reduced) {
      g.el.style.transform = 'translateY(-180px)';
      requestAnimationFrame(() => (g.el.style.transform = ''));
    }
    window.setTimeout(() => {
      if (reduced) return g.destroy();
      g.el.style.transform = 'translateY(-200px)';
      g.el.style.opacity = '0';
      window.setTimeout(() => g.destroy(), 320);
    }, ms);
  }

  destroy(): void {
    this.resize?.disconnect();
    this.root.remove();
    const i = stages.indexOf(this);
    if (i >= 0) stages.splice(i, 1);
  }
}
