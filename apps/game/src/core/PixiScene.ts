import * as PIXI from 'pixi.js';
import { REF_H, REF_W } from '../config';
import { Animator } from './anim';
import { Assets } from './assets';
import type { SceneNav } from './scenes';

/** something the scene re-syncs a few times a second (ARIA mirrors follow containers that move or hide) */
export interface Syncable {
  sync(): void;
}

const A11Y_SYNC_MS = 200;

/**
 * A scene drawn directly with PIXI (D-25). `root` is what the camera moves (zoom/shake); the background sits under it
 * and the fade veil over it. Children sort by zIndex (the DEPTH bands of ui/theme). Scenes are created and run by the
 * SceneManager (core/scenes.ts), which hands each one its key and `nav`.
 */
export abstract class PixiScene<D = unknown> {
  readonly view = new PIXI.Container();
  readonly root = new PIXI.Container({ sortableChildren: true });
  readonly anim = new Animator();
  /** 'pause' / 'resume' from the scene manager */
  readonly events = new PIXI.EventEmitter();
  key = '';
  /** scene switching: start/launch/stop/pause/resume/restart/bringToTop (this scene by default) */
  nav!: SceneNav;
  /** what the scene was started with (a context-loss recovery restarts it with the same) */
  data!: D;
  closed = false;
  #active: () => boolean = () => false;
  readonly #bg = new PIXI.Graphics();
  readonly #veil = new PIXI.Graphics();
  readonly #flashVeil = new PIXI.Graphics();
  readonly #cleanups: (() => void)[] = [];
  readonly #tickers: ((dtMs: number) => void)[] = [];
  readonly #mirrors = new Set<Syncable>();
  /** HTML layers of this scene: scene fades reach them too (they sit above the canvas) */
  readonly #dom: HTMLElement[] = [];
  #sinceSync = 0;
  #zoom = 1;
  #shakeLeft = 0;
  #shakeAmp = 0;

  /** `background` null keeps the scene transparent (an overlay over the scenes below it) */
  constructor(background: number | null = 0x0a0610) {
    this.#bg.rect(0, 0, REF_W, REF_H).fill(0xffffff);
    this.#bg.tint = background ?? 0;
    this.#bg.visible = background !== null;
    this.#veil.rect(0, 0, REF_W, REF_H).fill(0xffffff);
    this.#veil.alpha = 0;
    this.#veil.visible = false;
    this.#flashVeil.rect(0, 0, REF_W, REF_H).fill(0xffffff);
    this.#flashVeil.visible = false;
    this.root.position.set(REF_W / 2, REF_H / 2);
    this.root.pivot.set(REF_W / 2, REF_H / 2);
    this.view.addChild(this.#bg, this.root, this.#flashVeil, this.#veil);
  }

  abstract create(data: D): void | Promise<void>;

  /** per-frame logic; `dtMs` is unscaled (the animator applies its own timeScale) */
  update?(dtMs: number): void;

  set background(color: number) {
    this.#bg.tint = color;
  }

  /** adds to the camera root at a DEPTH band */
  add<T extends PIXI.Container>(child: T, depth = 0): T {
    child.zIndex = depth;
    this.root.addChild(child);
    return child;
  }

  /** called by the scene manager before create() */
  attach(key: string, nav: SceneNav, active: () => boolean): void {
    this.key = key;
    this.nav = nav;
    this.#active = active;
  }

  /** a loaded image or one of its frames (EMPTY when it is missing) */
  tex(key: string, frame?: string | number): PIXI.Texture {
    return Assets.texture(key, frame);
  }

  /** still running: not closed, stopped or paused */
  get live(): boolean {
    return !this.closed && this.#active();
  }

  /** shown or hidden with its HTML layers (a paused scene is hidden) */
  setShown(on: boolean): void {
    this.view.visible = on;
    for (const el of this.#dom) el.style.visibility = on ? '' : 'hidden';
  }

  /** moves this scene's HTML layers above the other scenes' (bringToTop) */
  raiseDom(): void {
    for (const el of this.#dom) el.parentElement?.appendChild(el);
  }

  /** true while a scene fade (in or out) is running: screens are settled when it is false */
  get fading(): boolean {
    return this.#veil.visible && this.#veil.alpha > 0 && this.#veil.alpha < 1;
  }

  /** every visible text the scene shows, canvas and HTML (inspection: tests, the live MCP, diagnostics) */
  texts(): string[] {
    const out: string[] = [];
    const walk = (n: PIXI.Container): void => {
      if (!n.visible || n.alpha <= 0) return;
      if (n instanceof PIXI.Text && n.text) out.push(n.text);
      for (const c of n.children) walk(c);
    };
    walk(this.view);
    for (const el of this.#dom) {
      for (const t of el.querySelectorAll<HTMLElement>('.uomd-text, .uomd-btn .label, .uomd-btn .sub')) {
        if (t.textContent && t.closest('[hidden]') === null) out.push(t.textContent);
      }
    }
    return out;
  }

  /** optional on-screen notice for flows that do not know the scene type (HTML screens show a toast) */
  notify?(message: string, ms?: number): void;

  onClose(fn: () => void): void {
    this.#cleanups.push(fn);
  }

  /** runs every frame with the animator-scaled dt (speed-up and hit-stop apply); returns the remover */
  onTick(fn: (dtMs: number) => void): () => void {
    this.#tickers.push(fn);
    return () => {
      const i = this.#tickers.indexOf(fn);
      if (i >= 0) this.#tickers.splice(i, 1);
    };
  }

  mirror(m: Syncable): () => void {
    this.#mirrors.add(m);
    return () => this.#mirrors.delete(m);
  }

  /** registers an HTML layer (a DomStage root) so scene fades include it */
  attachDom(el: HTMLElement): void {
    this.#dom.push(el);
  }

  #fadeDom(ms: number, to: number, from?: number): void {
    for (const el of this.#dom) {
      if (from !== undefined) {
        el.style.transition = 'none';
        el.style.opacity = String(from);
        void el.offsetWidth; // commit the start value before transitioning
      }
      el.style.transition = `opacity ${ms}ms ease`;
      el.style.opacity = String(to);
    }
  }

  fadeIn(ms: number, color = 0x0a0610): void {
    this.#veil.tint = color;
    this.#veil.alpha = 1;
    this.#veil.visible = true;
    this.anim.to(this.#veil, { alpha: 0 }, { duration: ms, onComplete: () => (this.#veil.visible = false) });
    this.#fadeDom(ms, 1, 0);
  }

  fadeOut(ms: number, color = 0x0a0610): Promise<void> {
    this.#veil.tint = color;
    this.#veil.visible = true;
    this.#fadeDom(ms, 0);
    return this.anim.toAsync(this.#veil, { alpha: 1 }, { duration: ms });
  }

  /** a full-screen flash of `color` that fades out over `ms` */
  flash(ms: number, color = 0xffffff): void {
    this.anim.killOf(this.#flashVeil);
    this.#flashVeil.tint = color;
    this.#flashVeil.alpha = 1;
    this.#flashVeil.visible = true;
    this.anim.to(this.#flashVeil, { alpha: 0 }, { duration: ms, onComplete: () => (this.#flashVeil.visible = false) });
  }

  /** `intensity` is a fraction of the stage width, as in the previous camera */
  shake(ms: number, intensity: number): void {
    this.#shakeLeft = Math.max(this.#shakeLeft, ms);
    this.#shakeAmp = intensity * REF_W;
  }

  zoomTo(zoom: number, ms: number): void {
    this.anim.killOf(this.root.scale);
    this.anim.to(this.root.scale, { x: zoom, y: zoom }, { duration: ms, ease: 'sine.inout', onUpdate: () => (this.#zoom = this.root.scale.x) });
  }

  /** called by the scene manager every frame */
  tick(dtMs: number): void {
    if (this.closed) return;
    this.anim.update(dtMs);
    const scaled = dtMs * this.anim.timeScale;
    for (const fn of [...this.#tickers]) fn(scaled);
    this.update?.(dtMs);
    if (this.closed) return;
    let sx = 0;
    let sy = 0;
    if (this.#shakeLeft > 0) {
      this.#shakeLeft -= scaled;
      sx = (Math.random() * 2 - 1) * this.#shakeAmp;
      sy = (Math.random() * 2 - 1) * this.#shakeAmp;
    }
    this.root.position.set(REF_W / 2 + sx, REF_H / 2 + sy);
    this.root.scale.set(this.#zoom);
    this.#sinceSync += dtMs;
    if (this.#sinceSync >= A11Y_SYNC_MS) {
      this.#sinceSync = 0;
      for (const m of this.#mirrors) m.sync();
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.anim.clear();
    for (const fn of this.#cleanups.splice(0)) {
      try {
        fn();
      } catch (e) {
        console.error('scene cleanup failed', e);
      }
    }
    this.#mirrors.clear();
    this.view.destroy({ children: true });
  }
}

/** visible and opaque up to the scene view (PIXI has no world-visibility flag) */
export function shownIn(node: PIXI.Container, scene: PixiScene): boolean {
  if (node.destroyed || !scene.live) return false;
  for (let n: PIXI.Container | null = node; n; n = n.parent) {
    if (!n.visible || n.alpha <= 0) return false;
    if (n === scene.view) return true;
  }
  return false;
}
