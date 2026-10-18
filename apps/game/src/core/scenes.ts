import type * as PIXI from 'pixi.js';
import type { PixiScene } from './PixiScene';

/** What a scene can do to scenes, its own by default (start replaces the calling scene, like a page change). */
export interface SceneNav {
  start(key: string, data?: unknown): void;
  launch(key: string, data?: unknown): void;
  stop(key?: string): void;
  pause(key?: string): void;
  resume(key?: string): void;
  bringToTop(key?: string): void;
  restart(data?: unknown): void;
  isActive(key: string): boolean;
  isPaused(key: string): boolean;
  get(key: string): PixiScene<unknown> | undefined;
}

/** a scene of any data type (each scene declares its own; the manager only passes data through) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyScene = PixiScene<any>;

interface Entry {
  key: string;
  scene: AnyScene;
  data: unknown;
  paused: boolean;
}

/**
 * The running scenes, bottom to top. Several run at once (an overlay strip, a story over a paused battle); a paused
 * scene is neither updated nor shown. Scenes are created fresh on every start and closed on stop.
 */
export class SceneManager {
  private readonly factories = new Map<string, () => AnyScene>();
  private list: Entry[] = [];

  constructor(private readonly stage: PIXI.Container) {}

  register(key: string, make: () => AnyScene): void {
    this.factories.set(key, make);
  }

  private find(key: string): Entry | undefined {
    return this.list.find((e) => e.key === key);
  }

  private order(): void {
    this.list.forEach((e, i) => {
      if (e.scene.view.parent === this.stage) this.stage.setChildIndex(e.scene.view, i);
    });
  }

  private nav(key: string): SceneNav {
    return {
      start: (k, data) => this.start(k, data, key),
      launch: (k, data) => this.launch(k, data),
      stop: (k = key) => this.stop(k),
      pause: (k = key) => this.pause(k),
      resume: (k = key) => this.resume(k),
      bringToTop: (k = key) => this.bringToTop(k),
      restart: (data) => this.restart(key, data),
      isActive: (k) => this.isActive(k),
      isPaused: (k) => this.isPaused(k),
      get: (k) => this.getScene(k)
    };
  }

  /** stops `from` (a scene changing to another) and starts `key` */
  start(key: string, data?: unknown, from?: string): void {
    if (from && from !== key) this.stop(from);
    this.launch(key, data);
  }

  /** starts `key` alongside the running scenes (on top); a running instance is replaced */
  launch(key: string, data?: unknown, at?: number): void {
    const make = this.factories.get(key);
    if (!make) {
      console.error(`unknown scene ${key}`);
      return;
    }
    const prev = this.find(key);
    if (prev) this.stop(key);
    const scene = make();
    const entry: Entry = { key, scene, data, paused: false };
    if (at !== undefined && at >= 0 && at <= this.list.length) this.list.splice(at, 0, entry);
    else this.list.push(entry);
    this.stage.addChild(scene.view);
    this.order();
    scene.attach(key, this.nav(key), () => this.isActive(key));
    scene.data = data;
    const fail = (e: unknown): void => console.error(`Error in ${key}.create:`, e);
    try {
      void Promise.resolve(scene.create(data)).catch(fail);
    } catch (e) {
      fail(e);
    }
  }

  stop(key: string): void {
    const e = this.find(key);
    if (!e) return;
    this.list = this.list.filter((x) => x !== e);
    e.scene.close();
  }

  pause(key: string): void {
    const e = this.find(key);
    if (!e || e.paused) return;
    e.paused = true;
    e.scene.setShown(false);
    e.scene.events.emit('pause');
  }

  resume(key: string): void {
    const e = this.find(key);
    if (!e || !e.paused) return;
    e.paused = false;
    e.scene.setShown(true);
    e.scene.events.emit('resume');
  }

  bringToTop(key: string): void {
    const e = this.find(key);
    if (!e) return;
    this.list = [...this.list.filter((x) => x !== e), e];
    this.order();
    e.scene.raiseDom();
  }

  /** a fresh instance in the same place, with new data or the data it was started with */
  restart(key: string, data?: unknown): void {
    const e = this.find(key);
    const at = e ? this.list.indexOf(e) : undefined;
    this.launch(key, data === undefined ? e?.data : data, at);
  }

  isActive(key: string): boolean {
    const e = this.find(key);
    return Boolean(e && !e.paused);
  }

  isPaused(key: string): boolean {
    return Boolean(this.find(key)?.paused);
  }

  getScene(key: string): PixiScene<unknown> | undefined {
    return this.find(key)?.scene;
  }

  /** running scenes bottom to top (only the unpaused ones by default) */
  getScenes(activeOnly = true): PixiScene<unknown>[] {
    return this.list.filter((e) => !activeOnly || !e.paused).map((e) => e.scene);
  }

  update(dtMs: number): void {
    for (const e of [...this.list]) if (!e.paused) e.scene.tick(dtMs);
  }
}
