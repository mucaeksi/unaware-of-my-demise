import * as PIXI from 'pixi.js';
import type Phaser from '../engine';
import { REF_H, REF_W } from '../config';
import { Animator } from './anim';

/** something the scene re-syncs a few times a second (ARIA mirrors follow containers that move or hide) */
export interface Syncable {
  sync(): void;
}

const A11Y_SYNC_MS = 200;

/**
 * A scene drawn directly with PIXI (D-25). `root` is what the camera moves (zoom/shake); the background sits under it
 * and the fade veil over it. Children sort by zIndex (the DEPTH bands of ui/theme).
 *
 * Transitional: until the Phaser-style engine is deleted (D-25 step 4) a scene runs inside a host engine scene
 * (see core/host.ts), which still owns loading, textures, audio and scene switching.
 */
export abstract class PixiScene<D = unknown> {
  readonly view = new PIXI.Container();
  readonly root = new PIXI.Container({ sortableChildren: true });
  readonly anim = new Animator();
  host!: Phaser.Scene;
  data!: D;
  closed = false;
  readonly #bg = new PIXI.Graphics();
  readonly #veil = new PIXI.Graphics();
  readonly #flashVeil = new PIXI.Graphics();
  readonly #cleanups: (() => void)[] = [];
  readonly #tickers: ((dtMs: number) => void)[] = [];
  readonly #mirrors = new Set<Syncable>();
  #sinceSync = 0;
  #zoom = 1;
  #shakeLeft = 0;
  #shakeAmp = 0;

  constructor(background = 0x0a0610) {
    this.#bg.rect(0, 0, REF_W, REF_H).fill(0xffffff);
    this.#bg.tint = background;
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

  /** a frame of a texture the host engine loaded (EMPTY when it is missing) */
  tex(key: string, frame?: string | number): PIXI.Texture {
    if (!this.host.textures.exists(key)) return PIXI.Texture.EMPTY;
    const t = this.host.textures.get(key);
    return t.pixiFrame(t.get(frame)) ?? PIXI.Texture.EMPTY;
  }

  /** scene switching (start/launch/stop/pause/resume/restart/bringToTop) */
  get nav(): Phaser.ScenePlugin {
    return this.host.scene;
  }

  /** still running: not closed and not stopped by the scene manager */
  get live(): boolean {
    return !this.closed && this.host.sys.isActive();
  }

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

  fadeIn(ms: number, color = 0x0a0610): void {
    this.#veil.tint = color;
    this.#veil.alpha = 1;
    this.#veil.visible = true;
    this.anim.to(this.#veil, { alpha: 0 }, { duration: ms, onComplete: () => (this.#veil.visible = false) });
  }

  fadeOut(ms: number, color = 0x0a0610): Promise<void> {
    this.#veil.tint = color;
    this.#veil.visible = true;
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

  /** called by the host every frame */
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
