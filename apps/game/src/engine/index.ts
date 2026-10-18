/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-explicit-any */
import * as PIXI from 'pixi.js';
import { GlowFilter } from 'pixi-filters/glow';

export { PIXI };

export namespace Phaser {
type Listener = { fn: (...args: any[]) => void; ctx?: any; once?: boolean };

export class EventEmitter {
  private _events = new Map<string, Listener[]>();

  on(event: string, fn: (...args: any[]) => void, context?: any): this {
    const list = this._events.get(event) ?? [];
    list.push({ fn, ctx: context, once: false });
    this._events.set(event, list);
    return this;
  }

  once(event: string, fn: (...args: any[]) => void, context?: any): this {
    const list = this._events.get(event) ?? [];
    list.push({ fn, ctx: context, once: true });
    this._events.set(event, list);
    return this;
  }

  off(event: string, fn?: (...args: any[]) => void, context?: any): this {
    if (!fn) {
      this._events.delete(event);
      return this;
    }
    const list = this._events.get(event);
    if (!list) return this;
    this._events.set(
      event,
      list.filter((l) => l.fn !== fn || (context !== undefined && l.ctx !== context))
    );
    return this;
  }

  removeListener(event: string, fn?: (...args: any[]) => void, context?: any): this {
    return this.off(event, fn, context);
  }

  removeAllListeners(event?: string): this {
    if (event) this._events.delete(event);
    else this._events.clear();
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this._events.get(event);
    if (!list || list.length === 0) return false;
    const copy = [...list];
    const remaining = list.filter((l) => !l.once);
    if (remaining.length > 0) this._events.set(event, remaining);
    else this._events.delete(event);
    for (const item of copy) {
      try {
        item.fn.apply(item.ctx ?? this, args);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    }
    return true;
  }
}

export namespace Events {
  export class EventEmitter extends Phaser.EventEmitter {}
}

export namespace Math {
  export class Vector2 {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    set(x: number, y = x): this {
      this.x = x;
      this.y = y;
      return this;
    }
  }

  export function Clamp(value: number, min: number, max: number): number {
    return globalThis.Math.max(min, globalThis.Math.min(max, value));
  }

  export function Between(min: number, max: number): number {
    return globalThis.Math.floor(globalThis.Math.random() * (max - min + 1)) + min;
  }

  export function FloatBetween(min: number, max: number): number {
    return min + globalThis.Math.random() * (max - min);
  }

  export function DegToRad(deg: number): number {
    return (deg * globalThis.Math.PI) / 180;
  }

  export function RadToDeg(rad: number): number {
    return (rad * 180) / globalThis.Math.PI;
  }

  export function Linear(p0: number, p1: number, t: number): number {
    return (p1 - p0) * t + p0;
  }

  export namespace Distance {
    export function Between(x1: number, y1: number, x2: number, y2: number): number {
      return globalThis.Math.hypot(x2 - x1, y2 - y1);
    }
  }

  export namespace Easing {
    export namespace Sine {
      export const In = (t: number): number => 1 - globalThis.Math.cos((t * globalThis.Math.PI) / 2);
      export const Out = (t: number): number => globalThis.Math.sin((t * globalThis.Math.PI) / 2);
      export const InOut = (t: number): number => -(globalThis.Math.cos(globalThis.Math.PI * t) - 1) / 2;
    }
    export namespace Quadratic {
      export const In = (t: number): number => t * t;
      export const Out = (t: number): number => t * (2 - t);
      export const InOut = (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    }
    export namespace Cubic {
      export const In = (t: number): number => t * t * t;
      export const Out = (t: number): number => --t * t * t + 1;
      export const InOut = (t: number): number =>
        t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }
    export namespace Back {
      export const Out = (t: number): number => {
        const s = 1.70158;
        return --t * t * ((s + 1) * t + s) + 1;
      };
      export const InOut = (t: number): number => {
        const s = 1.70158 * 1.525;
        if ((t *= 2) < 1) return 0.5 * (t * t * ((s + 1) * t - s));
        return 0.5 * ((t -= 2) * t * ((s + 1) * t + s) + 2);
      };
    }
  }
}

export namespace Geom {
  export class Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
    }
    static Contains(rect: Rectangle, x: number, y: number): boolean {
      return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
    contains(x: number, y: number): boolean {
      return Rectangle.Contains(this, x, y);
    }
  }

  export class Circle {
    x: number;
    y: number;
    radius: number;
    constructor(x = 0, y = 0, radius = 0) {
      this.x = x;
      this.y = y;
      this.radius = radius;
    }
    static Contains(circle: Circle, x: number, y: number): boolean {
      return globalThis.Math.hypot(x - circle.x, y - circle.y) <= circle.radius;
    }
    contains(x: number, y: number): boolean {
      return Circle.Contains(this, x, y);
    }
  }
}

export enum BlendModes {
  NORMAL = 0,
  ADD = 1,
  MULTIPLY = 2,
  SCREEN = 3
}

export enum TintModes {
  MULTIPLY = 0,
  FILL = 1,
  ADD = 2
}

export namespace Scale {
  export const FIT = 'FIT';
  export const NONE = 'NONE';
  export const CENTER_BOTH = 'CENTER_BOTH';

  export class ScaleManager extends EventEmitter {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      super();
      this.width = width;
      this.height = height;
    }
  }
}

export namespace Core {
  export const Events = {
    READY: 'ready',
    STEP: 'step',
    POST_STEP: 'poststep',
    PRE_RENDER: 'prerender',
    POST_RENDER: 'postrender',
    BLUR: 'blur',
    FOCUS: 'focus',
    HIDDEN: 'hidden',
    VISIBLE: 'visible',
    DESTROY: 'destroy',
    CONTEXT_LOST: 'contextlost'
  } as const;
}

export namespace Scenes {
  export const Events = {
    INIT: 'init',
    PRELOAD: 'preload',
    CREATE: 'create',
    UPDATE: 'update',
    RENDER: 'render',
    WAKE: 'wake',
    SLEEP: 'sleep',
    PAUSE: 'pause',
    RESUME: 'resume',
    SHUTDOWN: 'shutdown',
    DESTROY: 'destroy',
    ADDED_TO_SCENE: 'addedtoscene'
  } as const;

  export const INIT = 1;
  export const LOADING = 2;
  export const CREATING = 3;
  export const RUNNING = 5;
  export const PAUSED = 6;
  export const SLEEPING = 7;
  export const SHUTDOWN = 8;
  export const DESTROYED = 9;
}

export namespace Loader {
  export interface File {
    key: string;
    url?: string;
    type?: string;
    error?: any;
  }

  export const Events = {
    COMPLETE: 'complete',
    FILE_LOAD_ERROR: 'loaderror',
    PROGRESS: 'progress'
  } as const;

  export class LoaderPlugin extends EventEmitter {
    scene: Scene;
    private queue: Array<{ type: 'image' | 'audio' | 'spritesheet'; key: string; url: string; config?: { frameWidth: number; frameHeight: number } }> = [];
    private inflightBatches = 0;

    constructor(scene: Scene) {
      super();
      this.scene = scene;
    }

    image(key: string, url: string): this {
      this.queue.push({ type: 'image', key, url });
      return this;
    }

    audio(key: string, url: string): this {
      this.queue.push({ type: 'audio', key, url });
      return this;
    }

    spritesheet(key: string, url: string, config: { frameWidth: number; frameHeight: number }): this {
      this.queue.push({ type: 'spritesheet', key, url, config });
      return this;
    }

    start(): void {
      const batch = this.queue.splice(0, this.queue.length);
      if (batch.length === 0) {
        if (this.inflightBatches === 0) {
          queueMicrotask(() => this.emit(Events.COMPLETE));
        }
        return;
      }
      this.inflightBatches++;
      void (async () => {
        try {
          await Promise.all(
            batch.map(async (item) => {
              try {
                if (item.type === 'image' || item.type === 'spritesheet') {
                  const img = await loadImageElement(item.url);
                  if (item.type === 'spritesheet' && item.config) {
                    this.scene.textures.addSpriteSheet(item.key, img, item.config);
                  } else {
                    this.scene.textures.addImage(item.key, img);
                  }
                  this.emit(`filecomplete-${item.type}-${item.key}`, item.key, item.type);
                  this.emit('filecomplete', item.key, item.type);
                } else if (item.type === 'audio') {
                  const res = await fetch(item.url);
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const buf = await res.arrayBuffer();
                  const ctx = this.scene.sound.context;
                  if (ctx && typeof ctx.decodeAudioData === 'function') {
                    try {
                      const decoded = await ctx.decodeAudioData(buf.slice(0));
                      this.scene.cache.audio.add(item.key, decoded);
                    } catch {
                      const sampleRate = 44100;
                      const length = 4410;
                      if (typeof ctx.createBuffer === 'function') {
                        this.scene.cache.audio.add(item.key, ctx.createBuffer(1, length, sampleRate));
                      } else {
                        this.scene.cache.audio.add(item.key, {
                          duration: 0.1,
                          length,
                          sampleRate,
                          numberOfChannels: 1,
                          getChannelData: () => new Float32Array(length)
                        });
                      }
                    }
                  } else {
                    this.scene.cache.audio.add(item.key, { duration: 1, length: buf.byteLength });
                  }
                  this.emit(`filecomplete-audio-${item.key}`, item.key, item.type);
                  this.emit('filecomplete', item.key, item.type);
                }
              } catch (err) {
                this.emit(Events.FILE_LOAD_ERROR, { key: item.key, url: item.url, error: err });
              }
            })
          );
        } finally {
          this.inflightBatches = globalThis.Math.max(0, this.inflightBatches - 1);
          if (this.inflightBatches === 0) {
            this.emit(Events.COMPLETE);
          }
        }
      })();
    }
  }
}

const staticImageCache = new Map<string, HTMLImageElement>();

function loadImageElement(url: string): Promise<HTMLImageElement> {
  const isStatic = !url.startsWith('blob:') && !url.startsWith('data:');
  if (isStatic) {
    const cached = staticImageCache.get(url);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      return Promise.resolve(cached);
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isStatic) {
        staticImageCache.set(url, img);
        while (staticImageCache.size > 64) {
          const first = staticImageCache.keys().next().value;
          if (first) staticImageCache.delete(first);
        }
      }
      resolve(img);
    };
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

export namespace Textures {
  export enum FilterMode {
    LINEAR = 0,
    NEAREST = 1
  }

  export class Frame {
    name: string | number;
    cutX: number;
    cutY: number;
    cutWidth: number;
    cutHeight: number;
    width: number;
    height: number;
    realWidth: number;
    realHeight: number;
    source: { image: HTMLImageElement | HTMLCanvasElement | null; width: number; height: number };
    constructor(
      name: string | number,
      x: number,
      y: number,
      w: number,
      h: number,
      source: { image: HTMLImageElement | HTMLCanvasElement | null; width: number; height: number } = { image: null, width: w, height: h }
    ) {
      this.name = name;
      this.cutX = x;
      this.cutY = y;
      this.cutWidth = w;
      this.cutHeight = h;
      this.width = w;
      this.height = h;
      this.realWidth = w;
      this.realHeight = h;
      this.source = source;
    }
  }

  export class Texture {
    key: string;
    source: Array<{ image: HTMLImageElement | HTMLCanvasElement | null; width: number; height: number }>;
    frames = new Map<string | number, Frame>();
    frameTotal = 1;
    /** GPU-side base texture, created on first draw (never through PIXI's global cache, so removal frees it) */
    pixiTexture: PIXI.Texture | null = null;
    destroyed = false;
    private pixiFrames = new Map<string, PIXI.Texture>();

    constructor(key: string, sourceImg: HTMLImageElement | HTMLCanvasElement | null, width = 64, height = 64) {
      this.key = key;
      const w = sourceImg ? (sourceImg.width || width) : width;
      const h = sourceImg ? (sourceImg.height || height) : height;
      const src = { image: sourceImg, width: w, height: h };
      this.source = [src];
      this.frames.set('__BASE', new Frame('__BASE', 0, 0, w, h, src));
      this.frames.set(0, new Frame(0, 0, 0, w, h, src));
    }

    /** PIXI texture for a frame's cut rectangle, or null when there is nothing drawable */
    pixiFrame(frame: Frame): PIXI.Texture | null {
      const img = this.source[0]?.image;
      if (this.destroyed || !img || frame.width <= 0 || frame.height <= 0) return null;
      const sw = img.width;
      const sh = img.height;
      if (sw <= 0 || sh <= 0) return null;
      if (!this.pixiTexture) {
        const source = img instanceof HTMLCanvasElement ? new PIXI.CanvasSource({ resource: img }) : new PIXI.ImageSource({ resource: img });
        this.pixiTexture = new PIXI.Texture({ source });
      }
      const x = Math.Clamp(frame.cutX, 0, sw - 1);
      const y = Math.Clamp(frame.cutY, 0, sh - 1);
      const w = globalThis.Math.min(frame.width, sw - x);
      const h = globalThis.Math.min(frame.height, sh - y);
      const key = `${x},${y},${w},${h}`;
      let tex = this.pixiFrames.get(key);
      if (!tex) {
        tex = x === 0 && y === 0 && w === sw && h === sh ? this.pixiTexture : new PIXI.Texture({ source: this.pixiTexture.source, frame: new PIXI.Rectangle(x, y, w, h) });
        this.pixiFrames.set(key, tex);
      }
      return tex;
    }

    /** drop GPU textures (the source image stays); the next draw re-uploads */
    protected releasePixi(): void {
      for (const t of this.pixiFrames.values()) if (t !== this.pixiTexture) t.destroy(false);
      this.pixiFrames.clear();
      this.pixiTexture?.destroy(true);
      this.pixiTexture = null;
    }

    has(name: string | number): boolean {
      return this.frames.has(name) || this.frames.has(Number(name));
    }

    add(name: string | number, _sourceIndex: number, x: number, y: number, width: number, height: number): Frame {
      const f = new Frame(name, x, y, width, height, this.source[0]);
      this.frames.set(name, f);
      this.frames.set(String(name), f);
      this.frameTotal = this.frames.size;
      return f;
    }

    setFilter(_mode: number): this {
      return this;
    }

    get(name?: string | number): Frame {
      if (name === undefined) return this.frames.get('__BASE')!;
      return this.frames.get(name) ?? this.frames.get(Number(name)) ?? this.frames.get('__BASE')!;
    }

    getSourceImage(): HTMLImageElement | HTMLCanvasElement | null {
      return this.source[0]?.image ?? null;
    }

    destroy(): void {
      this.destroyed = true;
      this.releasePixi();
      this.frames.clear();
    }
  }

  export class CanvasTexture extends Texture {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    width: number;
    height: number;

    constructor(key: string, canvas: HTMLCanvasElement, width: number, height: number) {
      super(key, canvas, width, height);
      this.canvas = canvas;
      this.context = canvas.getContext('2d')!;
      this.width = width;
      this.height = height;
    }

    getContext(): CanvasRenderingContext2D {
      return this.context;
    }

    refresh(): this {
      const resized = this.source[0]?.width !== this.canvas.width || this.source[0]?.height !== this.canvas.height;
      this.source[0] = { image: this.canvas, width: this.canvas.width, height: this.canvas.height };
      this.frames.set('__BASE', new Frame('__BASE', 0, 0, this.canvas.width, this.canvas.height, this.source[0]));
      // same size: re-upload the pixels in place; new size: the GPU texture and every sub-frame must be rebuilt
      if (resized) this.releasePixi();
      else this.pixiTexture?.source.update();
      return this;
    }
  }

  export class TextureManager extends EventEmitter {
    private map = new Map<string, Texture>();

    constructor() {
      super();
      const def = document.createElement('canvas');
      def.width = 4;
      def.height = 4;
      const ctx = def.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 4, 4);
      }
      this.map.set('__DEFAULT', new Texture('__DEFAULT', def, 4, 4));
    }

    exists(key: string): boolean {
      return this.map.has(key);
    }

    get(key: string): Texture {
      return this.map.get(key) ?? this.map.get('__DEFAULT')!;
    }

    getFrame(key: string, frame?: string | number): Frame | undefined {
      return this.map.get(key)?.get(frame);
    }

    addImage(key: string, source: HTMLImageElement | HTMLCanvasElement): Texture {
      const tex = new Texture(key, source, source.width || 64, source.height || 64);
      this.map.set(key, tex);
      return tex;
    }

    addCanvas(key: string, source: HTMLCanvasElement): CanvasTexture {
      const tex = new CanvasTexture(key, source, source.width || 64, source.height || 64);
      this.map.set(key, tex);
      return tex;
    }

    createCanvas(key: string, width = 256, height = 256): CanvasTexture | null {
      const canvas = document.createElement('canvas');
      canvas.width = globalThis.Math.max(1, width);
      canvas.height = globalThis.Math.max(1, height);
      return this.addCanvas(key, canvas);
    }

    addSpriteSheet(
      key: string,
      source: HTMLImageElement | HTMLCanvasElement | Texture,
      config: { frameWidth: number; frameHeight: number }
    ): Texture {
      const img = source instanceof Texture ? source.getSourceImage() : source;
      const w = img ? img.width : config.frameWidth;
      const h = img ? img.height : config.frameHeight;
      const tex = new Texture(key, img, w, h);
      const fw = globalThis.Math.max(1, config.frameWidth);
      const fh = globalThis.Math.max(1, config.frameHeight);
      const cols = globalThis.Math.max(1, globalThis.Math.floor(w / fw));
      const rows = globalThis.Math.max(1, globalThis.Math.floor(h / fh));
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const frame = new Frame(idx, c * fw, r * fh, fw, fh, tex.source[0]);
          tex.frames.set(idx, frame);
          tex.frames.set(String(idx), frame);
          idx++;
        }
      }
      tex.frameTotal = globalThis.Math.max(1, idx);
      this.map.set(key, tex);
      return tex;
    }

    remove(key: string): this {
      const tex = this.map.get(key);
      if (tex) {
        tex.destroy();
        this.map.delete(key);
      }
      return this;
    }
  }
}

export interface AnimFrameConfig {
  key: string;
  frame: number | string;
}

export interface AnimConfig {
  key: string;
  frames: AnimFrameConfig[];
  frameRate?: number;
  repeat?: number;
  yoyo?: boolean;
}

export class AnimationManager extends EventEmitter {
  private anims = new Map<string, AnimConfig>();
  private textures: Textures.TextureManager;

  constructor(textures: Textures.TextureManager) {
    super();
    this.textures = textures;
  }

  exists(key: string): boolean {
    return this.anims.has(key);
  }

  get(key: string): AnimConfig | undefined {
    return this.anims.get(key);
  }

  getAnimsFromTexture(key: string): string[] {
    const out: string[] = [];
    for (const [animKey, anim] of this.anims.entries()) {
      if (anim.frames.some((f) => f.key === key)) {
        out.push(animKey);
      }
    }
    return out;
  }

  create(config: AnimConfig): AnimConfig {
    this.anims.set(config.key, config);
    return config;
  }

  remove(key: string): void {
    this.anims.delete(key);
  }

  generateFrameNumbers(key: string, config?: { start?: number; end?: number; frames?: number[] }): AnimFrameConfig[] {
    if (config?.frames) {
      return config.frames.map((f) => ({ key, frame: f }));
    }
    const tex = this.textures.get(key);
    const start = config?.start ?? 0;
    const end = config?.end ?? globalThis.Math.max(0, tex.frameTotal - 1);
    const out: AnimFrameConfig[] = [];
    for (let i = start; i <= end; i++) {
      out.push({ key, frame: i });
    }
    return out;
  }
}

export namespace Sound {
  export class BaseSound extends EventEmitter {
    key: string;
    isPlaying = false;
    constructor(key: string) {
      super();
      this.key = key;
    }
    play(): boolean {
      this.isPlaying = true;
      return true;
    }
    stop(): boolean {
      this.isPlaying = false;
      return true;
    }
    destroy(): void {
      this.isPlaying = false;
    }
  }

  export class BaseSoundManager extends EventEmitter {
    protected _mute = false;
    volume = 1;
    get mute(): boolean {
      return this._mute;
    }
    set mute(v: boolean) {
      this._mute = Boolean(v);
    }
  }

  export class WebAudioSoundManager extends BaseSoundManager {
    context: AudioContext;
    masterVolumeNode: GainNode;

    constructor() {
      super();
      const Ctx =
        globalThis.AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        try {
          this.context = new Ctx();
        } catch {
          this.context = createMockAudioContext();
        }
      } else {
        this.context = createMockAudioContext();
      }
      this.masterVolumeNode = this.context.createGain();
      try {
        this.masterVolumeNode.connect(this.context.destination);
      } catch {
        /* ignore in mock context */
      }
      if (typeof window !== 'undefined') {
        const unlock = (): void => {
          if (this.context.state === 'suspended') {
            void this.context.resume().catch(() => undefined);
          }
        };
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
      }
    }

    override get mute(): boolean {
      return this._mute;
    }

    override set mute(v: boolean) {
      this._mute = Boolean(v);
      try {
        this.masterVolumeNode.gain.value = this._mute ? 0 : this.volume;
      } catch {
        /* ignore */
      }
    }

    add(key: string): BaseSound {
      return new BaseSound(key);
    }

    stopAll(): void {
      /* handled by Music/Sfx services */
    }
  }
}

function createMockAudioContext(): AudioContext {
  return {
    state: 'running',
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    resume: async () => undefined,
    suspend: async () => undefined,
    createGain: () =>
      ({
        gain: {
          value: 1,
          setValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
          cancelScheduledValues: () => undefined
        },
        connect: () => undefined,
        disconnect: () => undefined
      }) as unknown as GainNode,
    createOscillator: () =>
      ({
        type: 'sine',
        frequency: {
          value: 440,
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined
        },
        connect: () => undefined,
        disconnect: () => undefined,
        start: () => undefined,
        stop: () => undefined
      }) as unknown as OscillatorNode,
    createBufferSource: () =>
      ({
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        playbackRate: { value: 1 },
        connect: () => undefined,
        disconnect: () => undefined,
        start: () => undefined,
        stop: () => undefined
      }) as unknown as AudioBufferSourceNode,
    createBiquadFilter: () =>
      ({
        type: 'lowpass',
        frequency: { value: 1000, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        Q: { value: 1 },
        connect: () => undefined,
        disconnect: () => undefined
      }) as unknown as BiquadFilterNode,
    createBuffer: (_channels: number, length: number, sampleRate: number) =>
      ({
        duration: length / (sampleRate || 44100),
        length,
        sampleRate: sampleRate || 44100,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(length)
      }) as unknown as AudioBuffer,
    decodeAudioData: async () =>
      ({
        duration: 1.5,
        length: 66150,
        sampleRate: 44100,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(66150)
      }) as unknown as AudioBuffer
  } as unknown as AudioContext;
}

export class AudioCache {
  private map = new Map<string, any>();
  exists(key: string): boolean {
    return this.map.has(key);
  }
  get(key: string): any {
    return this.map.get(key);
  }
  add(key: string, data: any): this {
    this.map.set(key, data);
    return this;
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

export namespace Cache {
  export class BaseCache extends AudioCache {}
}

export namespace Time {
  export interface TimerEventConfig {
    delay: number;
    callback: () => void;
    callbackScope?: any;
    loop?: boolean;
    repeat?: number;
    paused?: boolean;
  }

  export class TimerEvent {
    delay: number;
    callback: () => void;
    callbackScope?: any;
    loop: boolean;
    repeat: number;
    repeatCount: number;
    paused: boolean;
    elapsed = 0;
    hasDispatched = false;
    destroyed = false;

    constructor(config: TimerEventConfig) {
      this.delay = globalThis.Math.max(0, config.delay);
      this.callback = config.callback;
      this.callbackScope = config.callbackScope;
      this.loop = Boolean(config.loop);
      this.repeat = config.repeat ?? 0;
      this.repeatCount = this.repeat;
      this.paused = Boolean(config.paused);
    }

    remove(dispatchCallback = false): void {
      if (this.destroyed) return;
      this.destroyed = true;
      if (dispatchCallback) {
        this.callback.call(this.callbackScope);
      }
    }

    destroy(): void {
      this.remove(false);
    }
  }

  export class Clock {
    scene: Scene;
    now = 0;
    paused = false;
    timeScale = 1;
    private events: TimerEvent[] = [];

    constructor(scene: Scene) {
      this.scene = scene;
    }

    addEvent(config: TimerEventConfig | TimerEvent): TimerEvent {
      const ev = config instanceof TimerEvent ? config : new TimerEvent(config);
      this.events.push(ev);
      return ev;
    }

    delayedCall(delay: number, callback: (...args: any[]) => void, args?: any[], callbackScope?: any): TimerEvent {
      return this.addEvent({
        delay,
        callback: () => callback.apply(callbackScope, args ?? []),
        callbackScope
      });
    }

    removeAllEvents(): void {
      for (const e of this.events) e.destroyed = true;
      this.events.length = 0;
    }

    step(deltaMs: number): void {
      if (this.paused) return;
      const dt = deltaMs * this.timeScale;
      this.now += dt;
      const snapshot = [...this.events];
      for (const ev of snapshot) {
        if (ev.destroyed || ev.paused) continue;
        ev.elapsed += dt;
        while (!ev.destroyed && !ev.paused && ev.elapsed >= ev.delay) {
          try {
            ev.callback.call(ev.callbackScope);
          } catch (err) {
            console.error('Error in TimerEvent callback:', err);
          }
          if (ev.destroyed) break;
          if (ev.loop) {
            if (ev.delay <= 0) break;
            ev.elapsed -= ev.delay;
          } else if (ev.repeatCount > 0) {
            ev.repeatCount--;
            if (ev.delay <= 0) break;
            ev.elapsed -= ev.delay;
          } else {
            ev.destroyed = true;
            break;
          }
        }
      }
      this.events = this.events.filter((e) => !e.destroyed);
    }
  }
}

export namespace Tweens {
  type EaseFn = (t: number) => number;

  function resolveEase(ease?: string | EaseFn): EaseFn {
    if (typeof ease === 'function') return ease;
    switch (ease) {
      case 'Linear':
        return (t) => t;
      case 'Sine.easeIn':
      case 'Sine.In':
        return Math.Easing.Sine.In;
      case 'Sine.easeOut':
      case 'Sine.Out':
        return Math.Easing.Sine.Out;
      case 'Sine.easeInOut':
      case 'Sine.InOut':
        return Math.Easing.Sine.InOut;
      case 'Quad.easeIn':
      case 'Quadratic.In':
        return Math.Easing.Quadratic.In;
      case 'Quad.easeOut':
      case 'Quadratic.Out':
        return Math.Easing.Quadratic.Out;
      case 'Quad.easeInOut':
      case 'Quadratic.InOut':
        return Math.Easing.Quadratic.InOut;
      case 'Cubic.easeIn':
      case 'Cubic.In':
        return Math.Easing.Cubic.In;
      case 'Cubic.easeOut':
      case 'Cubic.Out':
        return Math.Easing.Cubic.Out;
      case 'Cubic.easeInOut':
      case 'Cubic.InOut':
        return Math.Easing.Cubic.InOut;
      case 'Back.easeOut':
      case 'Back.Out':
        return Math.Easing.Back.Out;
      case 'Back.easeInOut':
      case 'Back.InOut':
        return Math.Easing.Back.InOut;
      default:
        return Math.Easing.Sine.Out;
    }
  }

  const RESERVED_KEYS = new Set([
    'targets',
    'duration',
    'delay',
    'ease',
    'yoyo',
    'repeat',
    'hold',
    'onStart',
    'onUpdate',
    'onComplete',
    'onStop',
    'onYoyo',
    'onRepeat',
    'callbackScope',
    'paused'
  ]);

  export class Tween {
    targets: any[];
    duration: number;
    delay: number;
    ease: EaseFn;
    yoyo: boolean;
    repeat: number;
    repeatLeft: number;
    hold: number;
    onStart?: (tween: Tween, targets: any[]) => void;
    onUpdate?: (tween: Tween, target: any) => void;
    onComplete?: (tween: Tween, targets: any[]) => void;
    paused = false;
    destroyed = false;
    private rawProps: Record<string, any> = {};
    private targetProps: Array<Record<string, { start: number; end: number }>> = [];
    private started = false;
    private elapsed = 0;
    private inYoyo = false;

    constructor(config: Record<string, any>) {
      const t = config.targets;
      this.targets = Array.isArray(t) ? t.filter(Boolean) : t ? [t] : [];
      this.duration = globalThis.Math.max(1, config.duration ?? 1000);
      this.delay = globalThis.Math.max(0, config.delay ?? 0);
      this.ease = resolveEase(config.ease);
      this.yoyo = Boolean(config.yoyo);
      this.repeat = config.repeat ?? 0;
      this.repeatLeft = this.repeat;
      this.hold = globalThis.Math.max(0, config.hold ?? 0);
      this.onStart = config.onStart;
      this.onUpdate = config.onUpdate;
      this.onComplete = config.onComplete;
      this.paused = Boolean(config.paused);

      for (const [k, v] of Object.entries(config)) {
        if (!RESERVED_KEYS.has(k) && v !== undefined) {
          this.rawProps[k] = v;
        }
      }

      if (this.delay === 0) {
        this.initTargets();
      }
    }

    private initTargets(): void {
      if (this.started) return;
      this.started = true;
      this.targetProps = this.targets.map((target) => {
        const map: Record<string, { start: number; end: number }> = {};
        if (!target) return map;
        for (const [prop, spec] of Object.entries(this.rawProps)) {
          const cur = Number(target[prop] ?? 0);
          let start = cur;
          let end = cur;
          if (typeof spec === 'number') {
            end = spec;
          } else if (typeof spec === 'function') {
            end = Number(spec(target, prop));
          } else if (spec && typeof spec === 'object') {
            if (typeof spec.from === 'number') {
              start = spec.from;
              target[prop] = start;
            }
            if (typeof spec.to === 'number') {
              end = spec.to;
            } else if (typeof spec.value === 'number') {
              end = spec.value;
            }
          }
          map[prop] = { start, end };
        }
        return map;
      });
      this.onStart?.(this, this.targets);
    }

    step(dt: number): void {
      if (this.destroyed || this.paused) return;
      if (this.targets.length === 0) {
        this.destroyed = true;
        this.onComplete?.(this, []);
        return;
      }
      if (this.delay > 0) {
        if (dt < this.delay) {
          this.delay -= dt;
          return;
        }
        dt -= this.delay;
        this.delay = 0;
      }
      if (!this.started) {
        this.initTargets();
      }
      this.elapsed += dt;
      const rawT = globalThis.Math.min(1, this.elapsed / this.duration);
      const t = this.inYoyo ? 1 - rawT : rawT;
      const eased = this.ease(t);

      for (let i = 0; i < this.targets.length; i++) {
        const target = this.targets[i];
        if (!target || target.active === false) continue;
        const pmap = this.targetProps[i];
        if (!pmap) continue;
        for (const [prop, { start, end }] of Object.entries(pmap)) {
          const val = start + (end - start) * eased;
          if (prop === 'scale') {
            target.scaleX = val;
            target.scaleY = val;
          } else if (prop === 'angle') {
            target.angle = val;
            target.rotation = (val * globalThis.Math.PI) / 180;
          } else if (prop === 'rotation') {
            target.rotation = val;
            target.angle = (val * 180) / globalThis.Math.PI;
          } else {
            target[prop] = val;
          }
        }
        this.onUpdate?.(this, target);
      }

      if (this.elapsed >= this.duration) {
        if (this.yoyo && !this.inYoyo) {
          this.inYoyo = true;
          this.elapsed = 0;
          return;
        }
        this.inYoyo = false;
        if (this.repeatLeft === -1 || this.repeatLeft > 0) {
          if (this.repeatLeft > 0) this.repeatLeft--;
          this.elapsed = 0;
          return;
        }
        this.destroyed = true;
        this.onComplete?.(this, this.targets);
      }
    }

    stop(): this {
      this.destroyed = true;
      return this;
    }

    remove(): this {
      this.destroyed = true;
      return this;
    }
  }

  export class TweenManager {
    scene: Scene;
    timeScale = 1;
    private tweens: Tween[] = [];
    private paused = false;

    constructor(scene: Scene) {
      this.scene = scene;
    }

    add(config: Record<string, any>): Tween {
      const tw = new Tween(config);
      this.tweens.push(tw);
      return tw;
    }

    addCounter(config: {
      from?: number;
      to?: number;
      duration?: number;
      delay?: number;
      ease?: string | EaseFn;
      onUpdate?: (tween: { getValue: () => number }) => void;
      onComplete?: () => void;
    }): Tween {
      const holder = { value: config.from ?? 0 };
      return this.add({
        targets: holder,
        value: { from: config.from ?? 0, to: config.to ?? 1 },
        duration: config.duration ?? 1000,
        delay: config.delay ?? 0,
        ease: config.ease ?? 'Linear',
        onUpdate: () => config.onUpdate?.({ getValue: () => holder.value }),
        onComplete: () => config.onComplete?.()
      });
    }

    killTweensOf(targets: any): this {
      const list = Array.isArray(targets) ? targets : [targets];
      const set = new Set(list);
      for (const tw of this.tweens) {
        tw.targets = tw.targets.filter((t) => !set.has(t));
        if (tw.targets.length === 0) tw.destroyed = true;
      }
      return this;
    }

    pauseAll(): this {
      this.paused = true;
      return this;
    }

    resumeAll(): this {
      this.paused = false;
      return this;
    }

    killAll(): void {
      for (const tw of this.tweens) tw.destroyed = true;
      this.tweens.length = 0;
    }

    step(deltaMs: number): void {
      if (this.paused) return;
      const dt = deltaMs * this.timeScale;
      const snapshot = [...this.tweens];
      for (const tw of snapshot) {
        if (!tw.destroyed) tw.step(dt);
      }
      this.tweens = this.tweens.filter((t) => !t.destroyed);
    }
  }
}

export namespace Display {
  export namespace Color {
    export function ValueToColor(color: number): { r: number; g: number; b: number } {
      return {
        r: (color >> 16) & 0xff,
        g: (color >> 8) & 0xff,
        b: color & 0xff
      };
    }

    export namespace Interpolate {
      export function ColorWithColor(
        c1: { r: number; g: number; b: number },
        c2: { r: number; g: number; b: number },
        length: number,
        index: number
      ): { r: number; g: number; b: number } {
        const t = length <= 0 ? 1 : Math.Clamp(index / length, 0, 1);
        return {
          r: globalThis.Math.round(c1.r + (c2.r - c1.r) * t),
          g: globalThis.Math.round(c1.g + (c2.g - c1.g) * t),
          b: globalThis.Math.round(c1.b + (c2.b - c1.b) * t)
        };
      }
    }

    export function GetColor(r: number, g: number, b: number): number {
      return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
    }
  }
}

/** colour-matrix calls that a PIXI.ColorMatrixFilter replays in order */
type ColorMatrixOp = ['saturate' | 'brightness' | 'contrast' | 'night', number, boolean] | ['sepia' | 'lsd', boolean] | ['setValues', number[]];

export class FilterController {
  type: string;
  active = true;
  strength = 1;
  color = 0xffffff;
  radius = 0.5;
  matrix: number[] = [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0
  ];
  colorMatrix: FilterController;
  /** recorded ColorMatrix operations; `version` changes whenever they do so the stage rebuilds the PIXI filter */
  ops: ColorMatrixOp[] = [];
  version = 0;

  constructor(type: string) {
    this.type = type;
    this.colorMatrix = this;
  }

  private record(op: ColorMatrixOp): this {
    this.ops.push(op);
    this.version++;
    return this;
  }

  reset(): this {
    this.matrix = [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0
    ];
    this.ops.length = 0;
    this.version++;
    return this;
  }

  saturate(amount = 0, multiply = false): this {
    return this.record(['saturate', amount, multiply]);
  }

  brightness(amount = 1, multiply = false): this {
    return this.record(['brightness', amount, multiply]);
  }

  contrast(amount = 0, multiply = false): this {
    return this.record(['contrast', amount, multiply]);
  }

  sepia(multiply = false): this {
    return this.record(['sepia', multiply]);
  }

  night(intensity = 0.1, multiply = false): this {
    return this.record(['night', intensity, multiply]);
  }

  lsd(multiply = false): this {
    return this.record(['lsd', multiply]);
  }

  setValues(values: number[]): this {
    this.matrix = [...values];
    return this.record(['setValues', [...values]]);
  }

  destroy(): void {
    this.active = false;
  }
}

export namespace Filters {
  export type Controller = FilterController;
  export type ColorMatrix = FilterController;
  export type Blur = FilterController;
  export type Glow = FilterController;
  export type Blend = FilterController;
  export type Mask = FilterController;
  export type Vignette = FilterController;
}

export class FilterList {
  list: FilterController[] = [];
  private owner: any;

  constructor(owner?: any) {
    this.owner = owner;
  }

  addColorMatrix(): FilterController {
    const f = new FilterController('ColorMatrix');
    this.list.push(f);
    return f;
  }

  addBlur(_quality = 0, _x = 2, _y = 2, strength = 1, color = 0xffffff, _steps = 4): FilterController {
    const f = new FilterController('Blur');
    f.strength = strength;
    f.color = color;
    this.list.push(f);
    return f;
  }

  addGlow(color = 0xffffff, outerStrength = 4, _innerStrength = 0, _scale = 1, _knockout = false): FilterController {
    const f = new FilterController('Glow');
    f.color = color;
    f.strength = outerStrength;
    this.list.push(f);
    return f;
  }

  addBlend(_texture?: string, _mode = 0, amount = 1, color?: number[]): FilterController {
    const f = new FilterController('Blend');
    f.strength = amount;
    if (color && color.length >= 3) {
      f.color = Display.Color.GetColor(
        globalThis.Math.round((color[0] ?? 1) * 255),
        globalThis.Math.round((color[1] ?? 1) * 255),
        globalThis.Math.round((color[2] ?? 1) * 255)
      );
    }
    this.list.push(f);
    return f;
  }

  addMask(maskObject: GameObjects.GameObject, invert = false, _viewCamera?: any, _layer?: string): FilterController {
    const f = new FilterController('Mask');
    if (this.owner) {
      this.owner.maskObj = maskObject;
      this.owner.invertMask = invert;
    }
    this.list.push(f);
    return f;
  }

  addVignette(x = 0.5, y = 0.5, radius = 0.5, strength = 0.5): FilterController {
    const f = new FilterController('Vignette');
    f.radius = radius;
    f.strength = strength;
    void x;
    void y;
    this.list.push(f);
    return f;
  }

  remove(filter: FilterController, _forceDestroy = false): this {
    const idx = this.list.indexOf(filter);
    if (idx >= 0) this.list.splice(idx, 1);
    return this;
  }

  clear(): this {
    this.list.length = 0;
    if (this.owner) {
      this.owner.maskObj = null;
    }
    return this;
  }
}

export namespace Cameras {
  export namespace Scene2D {
    export const Events = {
      FADE_IN_COMPLETE: 'camerafadeincomplete',
      FADE_OUT_COMPLETE: 'camerafadeoutcomplete',
      FLASH_COMPLETE: 'cameraflashcomplete',
      SHAKE_COMPLETE: 'camerashakecomplete',
      PAN_COMPLETE: 'camerapancomplete',
      ZOOM_COMPLETE: 'camerazoomcomplete'
    } as const;

    export class Camera extends EventEmitter {
      scene: Scene;
      x = 0;
      y = 0;
      width: number;
      height: number;
      scrollX = 0;
      scrollY = 0;
      zoom = 1;
      backgroundColor = 0x05030a;
      bounds: Geom.Rectangle | null = null;
      filters: { internal: FilterList; external: FilterList };
      fadeEffect = { isRunning: false, alpha: 0, r: 0, g: 0, b: 0 };
      flashEffect = { isRunning: false, alpha: 0, r: 255, g: 255, b: 255 };
      shakeEffect = { isRunning: false, offsetX: 0, offsetY: 0 };

      constructor(scene: Scene, width: number, height: number) {
        super();
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.filters = {
          internal: new FilterList(this),
          external: new FilterList(this)
        };
      }

      get centerX(): number {
        return this.width / 2;
      }

      get centerY(): number {
        return this.height / 2;
      }

      setBackgroundColor(color: number | string): this {
        if (typeof color === 'string') {
          this.backgroundColor = Number.parseInt(color.replace('#', ''), 16) || 0x05030a;
        } else {
          this.backgroundColor = color;
        }
        return this;
      }

      setBounds(x: number, y: number, width: number, height: number): this {
        this.bounds = new Geom.Rectangle(x, y, width, height);
        return this;
      }

      setZoom(zoom: number): this {
        this.zoom = zoom;
        return this;
      }

      setScroll(x: number, y = x): this {
        this.scrollX = x;
        this.scrollY = y;
        return this;
      }

      fadeIn(duration = 1000, r = 0, g = 0, b = 0, callback?: (cam: Camera, progress: number) => void): this {
        this.fadeEffect = { isRunning: true, alpha: 1, r, g, b };
        this.scene.tweens.add({
          targets: this.fadeEffect,
          alpha: 0,
          duration: globalThis.Math.max(1, duration),
          ease: 'Linear',
          onUpdate: () => callback?.(this, 1 - this.fadeEffect.alpha),
          onComplete: () => {
            this.fadeEffect.isRunning = false;
            this.fadeEffect.alpha = 0;
            this.emit(Events.FADE_IN_COMPLETE, this);
          }
        });
        return this;
      }

      fadeOut(duration = 1000, r = 0, g = 0, b = 0, callback?: (cam: Camera, progress: number) => void): this {
        this.fadeEffect = { isRunning: true, alpha: 0, r, g, b };
        this.scene.tweens.add({
          targets: this.fadeEffect,
          alpha: 1,
          duration: globalThis.Math.max(1, duration),
          ease: 'Linear',
          onUpdate: () => callback?.(this, this.fadeEffect.alpha),
          onComplete: () => {
            this.fadeEffect.isRunning = false;
            this.fadeEffect.alpha = 1;
            this.emit(Events.FADE_OUT_COMPLETE, this);
          }
        });
        return this;
      }

      flash(duration = 250, r = 255, g = 255, b = 255, _force = false, callback?: (cam: Camera, progress: number) => void): this {
        this.flashEffect = { isRunning: true, alpha: 1, r, g, b };
        this.scene.tweens.add({
          targets: this.flashEffect,
          alpha: 0,
          duration: globalThis.Math.max(1, duration),
          ease: 'Cubic.easeOut',
          onUpdate: () => callback?.(this, 1 - this.flashEffect.alpha),
          onComplete: () => {
            this.flashEffect.isRunning = false;
            this.flashEffect.alpha = 0;
            this.emit(Events.FLASH_COMPLETE, this);
          }
        });
        return this;
      }

      shake(duration = 100, intensity: number | { x?: number; y?: number } = 0.01): this {
        const ix = typeof intensity === 'number' ? intensity : (intensity.x ?? 0.01);
        const iy = typeof intensity === 'number' ? intensity : (intensity.y ?? 0.01);
        this.shakeEffect.isRunning = true;
        const holder = { t: 1 };
        this.scene.tweens.add({
          targets: holder,
          t: 0,
          duration: globalThis.Math.max(1, duration),
          ease: 'Linear',
          onUpdate: () => {
            this.shakeEffect.offsetX = (globalThis.Math.random() * 2 - 1) * ix * this.width * holder.t;
            this.shakeEffect.offsetY = (globalThis.Math.random() * 2 - 1) * iy * this.height * holder.t;
          },
          onComplete: () => {
            this.shakeEffect.isRunning = false;
            this.shakeEffect.offsetX = 0;
            this.shakeEffect.offsetY = 0;
            this.emit(Events.SHAKE_COMPLETE, this);
          }
        });
        return this;
      }

      pan(x: number, y: number, duration = 1000, ease: string | ((t: number) => number) = 'Linear', _force = false, callback?: (cam: Camera, progress: number, sx: number, sy: number) => void): this {
        const targetScrollX = x - this.width / 2;
        const targetScrollY = y - this.height / 2;
        if (duration <= 0) {
          this.scrollX = targetScrollX;
          this.scrollY = targetScrollY;
          callback?.(this, 1, this.scrollX, this.scrollY);
          this.emit(Events.PAN_COMPLETE, this);
          return this;
        }
        this.scene.tweens.add({
          targets: this,
          scrollX: targetScrollX,
          scrollY: targetScrollY,
          duration,
          ease,
          onUpdate: () => callback?.(this, 0.5, this.scrollX, this.scrollY),
          onComplete: () => {
            callback?.(this, 1, this.scrollX, this.scrollY);
            this.emit(Events.PAN_COMPLETE, this);
          }
        });
        return this;
      }

      zoomTo(zoom: number, duration = 1000, ease: string | ((t: number) => number) = 'Linear', _force = false, callback?: (cam: Camera, progress: number, z: number) => void): this {
        if (duration <= 0) {
          this.zoom = zoom;
          callback?.(this, 1, this.zoom);
          this.emit(Events.ZOOM_COMPLETE, this);
          return this;
        }
        this.scene.tweens.add({
          targets: this,
          zoom,
          duration,
          ease,
          onUpdate: () => callback?.(this, 0.5, this.zoom),
          onComplete: () => {
            callback?.(this, 1, this.zoom);
            this.emit(Events.ZOOM_COMPLETE, this);
          }
        });
        return this;
      }
    }

    export class CameraManager {
      main: Camera;
      constructor(scene: Scene, width: number, height: number) {
        this.main = new Camera(scene, width, height);
      }
    }
  }
}

export namespace Input {
  export interface Pointer {
    x: number;
    y: number;
    worldX: number;
    worldY: number;
    isDown: boolean;
    id: number;
  }

  export class KeyboardPlugin extends EventEmitter {}

  export class InputPlugin extends EventEmitter {
    scene: Scene;
    keyboard = new KeyboardPlugin();
    activePointer: Pointer = { x: 0, y: 0, worldX: 0, worldY: 0, isDown: false, id: 0 };

    constructor(scene: Scene) {
      super();
      this.scene = scene;
    }

    setDraggable(gameObjects: GameObjects.GameObject | GameObjects.GameObject[], value = true): this {
      const list = Array.isArray(gameObjects) ? gameObjects : [gameObjects];
      for (const obj of list) {
        if (obj.input) obj.input.draggable = value;
      }
      return this;
    }
  }
}

export namespace Types {
  export namespace Tweens {
    export type TweenBuilderConfig = Record<string, any>;
  }
  export namespace GameObjects {
    export namespace Text {
      export interface TextStyle {
        fontFamily?: string;
        fontSize?: string | number;
        fontStyle?: string;
        color?: string;
        stroke?: string;
        strokeThickness?: number;
        align?: string;
        wordWrap?: { width?: number; useAdvancedWrap?: boolean };
        lineSpacing?: number;
        letterSpacing?: number;
        backgroundColor?: string;
        resolution?: number;
        padding?: { x?: number; y?: number; left?: number; right?: number; top?: number; bottom?: number };
        shadow?: Record<string, any>;
      }
    }
    export namespace Particles {
      export type ParticleEmitterConfig = Record<string, any>;
    }
  }
  export namespace Input {
    export type InputConfiguration = {
      useHandCursor?: boolean;
      hitArea?: Geom.Rectangle | Geom.Circle;
      hitAreaCallback?: (hitArea: any, x: number, y: number) => boolean;
      draggable?: boolean;
    };
  }
}

const sharedMeasureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const sharedMeasureCtx = sharedMeasureCanvas ? sharedMeasureCanvas.getContext('2d') : null;

export namespace GameObjects {
  export class GameObject extends EventEmitter {
    scene: Scene;
    type: string;
    name = '';
    active = true;
    visible = true;
    x = 0;
    y = 0;
    scaleX = 1;
    scaleY = 1;
    alpha = 1;
    angle = 0;
    rotation = 0;
    depth = 0;
    originX = 0.5;
    originY = 0.5;
    scrollFactorX = 1;
    scrollFactorY = 1;
    blendMode: number | string = BlendModes.NORMAL;
    tintTopLeft = 0xffffff;
    tintFill = false;
    tintMode: number = TintModes.MULTIPLY;
    parentContainer: Container | null = null;
    maskObj: GameObject | null = null;
    invertMask = false;
    filters: { internal: FilterList; external: FilterList };
    input: {
      enabled: boolean;
      cursor?: string;
      hitArea?: Geom.Rectangle | Geom.Circle;
      hitAreaCallback?: (area: any, x: number, y: number) => boolean;
      draggable?: boolean;
    } | null = null;
    domElement: HTMLElement | null = null;
    /** retained PIXI display node mirroring this object (owned by the Game's stage sync) */
    _px: PIXI.Container | null = null;
    /** camera wrapper for a scene-root object; the rectangle node when this object masks another */
    _pxWrap: PIXI.Container | null = null;
    _pxMask: PIXI.Graphics | null = null;
    private _data = new Map<string, any>();

    constructor(scene: Scene, type: string) {
      super();
      this.scene = scene;
      this.type = type;
      this.filters = {
        internal: new FilterList(this),
        external: new FilterList(this)
      };
    }

    get scale(): number {
      return this.scaleX;
    }

    set scale(v: number) {
      this.scaleX = v;
      this.scaleY = v;
    }

    setName(name: string): this {
      this.name = name;
      return this;
    }

    setData(key: string, value: any): this {
      this._data.set(key, value);
      return this;
    }

    getData(key: string): any {
      return this._data.get(key);
    }

    setPosition(x = 0, y = x, _z?: number, _w?: number): this {
      this.x = x;
      this.y = y;
      return this;
    }

    setX(x = 0): this {
      this.x = x;
      return this;
    }

    setY(y = 0): this {
      this.y = y;
      return this;
    }

    setScale(x = 1, y = x): this {
      this.scaleX = x;
      this.scaleY = y;
      return this;
    }

    setOrigin(x = 0.5, y = x): this {
      this.originX = x;
      this.originY = y;
      return this;
    }

    setAlpha(alpha = 1): this {
      this.alpha = alpha;
      return this;
    }

    setDepth(depth = 0): this {
      this.depth = depth;
      return this;
    }

    setVisible(visible: boolean): this {
      this.visible = visible;
      if (this.domElement) {
        this.domElement.style.display = visible ? '' : 'none';
      }
      return this;
    }

    setActive(active: boolean): this {
      this.active = active;
      return this;
    }

    setAngle(degrees = 0): this {
      this.angle = degrees;
      this.rotation = (degrees * globalThis.Math.PI) / 180;
      return this;
    }

    setRotation(radians = 0): this {
      this.rotation = radians;
      this.angle = (radians * 180) / globalThis.Math.PI;
      return this;
    }

    setScrollFactor(x: number, y = x): this {
      this.scrollFactorX = x;
      this.scrollFactorY = y;
      return this;
    }

    setBlendMode(mode: number | string): this {
      this.blendMode = mode;
      return this;
    }

    setTint(color = 0xffffff): this {
      this.tintTopLeft = color;
      this.tintFill = false;
      return this;
    }

    setTintFill(color = 0xffffff): this {
      this.tintTopLeft = color;
      this.tintFill = true;
      return this;
    }

    setTintMode(mode: number): this {
      this.tintMode = mode;
      this.tintFill = mode === TintModes.FILL;
      return this;
    }

    clearTint(): this {
      this.tintTopLeft = 0xffffff;
      this.tintFill = false;
      return this;
    }

    enableFilters(): this {
      return this;
    }

    setInteractive(
      config?: Types.Input.InputConfiguration | Geom.Rectangle | Geom.Circle,
      callback?: (area: any, x: number, y: number) => boolean
    ): this {
      if (config instanceof Geom.Rectangle || config instanceof Geom.Circle) {
        this.input = {
          enabled: true,
          hitArea: config,
          hitAreaCallback: callback
        };
      } else {
        this.input = {
          enabled: true,
          cursor: config?.useHandCursor ? 'pointer' : 'default',
          hitArea: config?.hitArea,
          hitAreaCallback: config?.hitAreaCallback ?? callback,
          draggable: config?.draggable
        };
      }
      return this;
    }

    disableInteractive(): this {
      if (this.input) this.input.enabled = false;
      return this;
    }

    removeInteractive(): this {
      this.input = null;
      return this;
    }

    getWorldTransform(): { x: number; y: number; scaleX: number; scaleY: number; alpha: number; visible: boolean; scrollFactorX: number; scrollFactorY: number } {
      let x = this.x;
      let y = this.y;
      let sx = this.scaleX;
      let sy = this.scaleY;
      let alpha = this.alpha;
      let visible = this.visible && this.active;
      let sfx = this.scrollFactorX;
      let sfy = this.scrollFactorY;
      let p = this.parentContainer;
      while (p) {
        x = p.x + x * p.scaleX;
        y = p.y + y * p.scaleY;
        sx *= p.scaleX;
        sy *= p.scaleY;
        alpha *= p.alpha;
        if (!p.visible || !p.active) visible = false;
        if (p.scrollFactorX === 0) sfx = 0;
        if (p.scrollFactorY === 0) sfy = 0;
        p = p.parentContainer;
      }
      return { x, y, scaleX: sx, scaleY: sy, alpha, visible, scrollFactorX: sfx, scrollFactorY: sfy };
    }

    getBounds(): Geom.Rectangle {
      const wt = this.getWorldTransform();
      const rawW = (this as unknown as { width?: number }).width ?? 0;
      const rawH = (this as unknown as { height?: number }).height ?? 0;
      const w = globalThis.Math.abs(rawW * wt.scaleX);
      const h = globalThis.Math.abs(rawH * wt.scaleY);
      return new Geom.Rectangle(wt.x - w * this.originX, wt.y - h * this.originY, w, h);
    }

    destroy(_fromScene?: boolean): void {
      if (!this.active) {
        this.releasePixi();
        return;
      }
      this.active = false;
      this.visible = false;
      if (this.domElement) {
        this.domElement.remove();
        this.domElement = null;
      }
      if (this.parentContainer) {
        this.parentContainer.remove(this, false);
      }
      if (this.scene?.children) {
        this.scene.children.remove(this);
      }
      this.emit('destroy', this);
      this.removeAllListeners();
      this.releasePixi();
    }

    releasePixi(): void {
      // children are released by their own GameObject; destroying them here would double-free
      this._px?.destroy({ children: false });
      this._pxWrap?.destroy({ children: false });
      this._pxMask?.destroy();
      this._px = null;
      this._pxWrap = null;
      this._pxMask = null;
    }
  }

  export class Container extends GameObject {
    list: GameObject[] = [];
    width = 0;
    height = 0;

    get length(): number {
      return this.list.length;
    }

    constructor(scene: Scene, x = 0, y = 0, children?: GameObject[]) {
      super(scene, 'Container');
      this.x = x;
      this.y = y;
      this.originX = 0;
      this.originY = 0;
      if (children) this.add(children);
    }

    add(child: GameObject | GameObject[]): this {
      const arr = Array.isArray(child) ? child : [child];
      for (const c of arr) {
        if (!c) continue;
        if (c.parentContainer && c.parentContainer !== this) {
          c.parentContainer.remove(c, false);
        }
        if (this.scene?.children) {
          this.scene.children.remove(c);
        }
        c.parentContainer = this;
        if (!this.list.includes(c)) {
          this.list.push(c);
        }
      }
      return this;
    }

    remove(child: GameObject | GameObject[], destroyChild = false): this {
      const arr = Array.isArray(child) ? child : [child];
      for (const c of arr) {
        const idx = this.list.indexOf(c);
        if (idx >= 0) {
          this.list.splice(idx, 1);
          c.parentContainer = null;
        }
        if (destroyChild) c.destroy();
      }
      return this;
    }

    removeAll(destroyChildren = false): this {
      const copy = [...this.list];
      this.list.length = 0;
      for (const c of copy) {
        c.parentContainer = null;
        if (destroyChildren) c.destroy();
      }
      return this;
    }

    setSize(w: number, h: number): this {
      this.width = w;
      this.height = h;
      return this;
    }

    sort(property: string): this {
      this.list.sort((a: any, b: any) => Number(a[property] ?? 0) - Number(b[property] ?? 0));
      return this;
    }

    override getBounds(): Geom.Rectangle {
      const wt = this.getWorldTransform();
      if (this.input?.hitArea instanceof Geom.Rectangle) {
        const ha = this.input.hitArea;
        return new Geom.Rectangle(
          wt.x + ha.x * wt.scaleX,
          wt.y + ha.y * wt.scaleY,
          ha.width * wt.scaleX,
          ha.height * wt.scaleY
        );
      }
      if (this.width > 0 && this.height > 0) {
        const w = this.width * wt.scaleX;
        const h = this.height * wt.scaleY;
        return new Geom.Rectangle(wt.x - w * 0.5, wt.y - h * 0.5, w, h);
      }
      if (this.list.length === 0) {
        return new Geom.Rectangle(wt.x, wt.y, 0, 0);
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const child of this.list) {
        if (!child.active || !child.visible) continue;
        const b = child.getBounds();
        if (b.width <= 0 && b.height <= 0 && child.type === 'Graphics') continue;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
      }
      if (!Number.isFinite(minX)) {
        return new Geom.Rectangle(wt.x, wt.y, 0, 0);
      }
      return new Geom.Rectangle(minX, minY, maxX - minX, maxY - minY);
    }

    override destroy(fromScene?: boolean): void {
      const copy = [...this.list];
      this.list.length = 0;
      for (const c of copy) {
        c.parentContainer = null;
        c.destroy(fromScene);
      }
      super.destroy(fromScene);
    }
  }

  export class Image extends GameObject {
    texture: Textures.Texture;
    frame: Textures.Frame;
    width: number;
    height: number;
    flipX = false;
    flipY = false;

    constructor(scene: Scene, x: number, y: number, key: string, frame?: string | number) {
      super(scene, 'Image');
      this.x = x;
      this.y = y;
      this.texture = scene.textures.get(key);
      this.frame = this.texture.get(frame);
      this.width = this.frame.width;
      this.height = this.frame.height;
    }

    get displayWidth(): number {
      return globalThis.Math.abs(this.width * this.scaleX);
    }

    set displayWidth(w: number) {
      if (this.width > 0) this.scaleX = w / this.width;
    }

    get displayHeight(): number {
      return globalThis.Math.abs(this.height * this.scaleY);
    }

    set displayHeight(h: number) {
      if (this.height > 0) this.scaleY = h / this.height;
    }

    setTexture(key: string, frame?: string | number): this {
      this.texture = this.scene.textures.get(key);
      this.frame = this.texture.get(frame);
      this.width = this.frame.width;
      this.height = this.frame.height;
      return this;
    }

    setFrame(frame: string | number): this {
      this.frame = this.texture.get(frame);
      this.width = this.frame.width;
      this.height = this.frame.height;
      return this;
    }

    setFlipX(value: boolean): this {
      this.flipX = value;
      return this;
    }

    setFlipY(value: boolean): this {
      this.flipY = value;
      return this;
    }

    setDisplaySize(w: number, h: number): this {
      this.displayWidth = w;
      this.displayHeight = h;
      return this;
    }
  }

  export class AnimationState {
    parent: Sprite;
    isPlaying = false;
    currentAnim: AnimConfig | null = null;
    currentFrame: { index: number; frame: AnimFrameConfig } | null = null;
    private timer: Time.TimerEvent | null = null;
    private frameIdx = 0;

    constructor(parent: Sprite) {
      this.parent = parent;
    }

    play(key: string, ignoreIfPlaying = false): Sprite {
      if (ignoreIfPlaying && this.isPlaying && this.currentAnim?.key === key) {
        return this.parent;
      }
      this.stop();
      const anim = this.parent.scene.anims.get(key);
      if (!anim || anim.frames.length === 0) {
        return this.parent;
      }
      this.currentAnim = anim;
      this.isPlaying = true;
      this.frameIdx = 0;
      this.applyFrame(0);
      const fps = globalThis.Math.max(1, anim.frameRate ?? 10);
      this.timer = this.parent.scene.time.addEvent({
        delay: 1000 / fps,
        loop: true,
        callback: () => {
          if (!this.parent.active || !this.isPlaying || !this.currentAnim) {
            this.stop();
            return;
          }
          this.frameIdx++;
          if (this.frameIdx >= this.currentAnim.frames.length) {
            if (this.currentAnim.repeat === -1) {
              this.frameIdx = 0;
            } else {
              this.stop();
              return;
            }
          }
          this.applyFrame(this.frameIdx);
        }
      });
      return this.parent;
    }

    private applyFrame(index: number): void {
      const f = this.currentAnim?.frames[index];
      if (!f) return;
      this.currentFrame = { index, frame: f };
      this.parent.setTexture(f.key, f.frame);
    }

    stop(): Sprite {
      this.isPlaying = false;
      this.timer?.remove(false);
      this.timer = null;
      return this.parent;
    }
  }

  export class Sprite extends Image {
    anims: AnimationState;

    constructor(scene: Scene, x: number, y: number, key: string, frame?: string | number) {
      super(scene, x, y, key, frame);
      this.type = 'Sprite';
      this.anims = new AnimationState(this);
    }

    play(key: string, ignoreIfPlaying = false): this {
      this.anims.play(key, ignoreIfPlaying);
      return this;
    }

    stop(): this {
      this.anims.stop();
      return this;
    }

    override destroy(fromScene?: boolean): void {
      this.anims.stop();
      super.destroy(fromScene);
    }
  }

  export class Text extends GameObject {
    text = '';
    style: Required<Pick<Types.GameObjects.Text.TextStyle, 'fontFamily' | 'fontSize' | 'fontStyle' | 'color' | 'stroke' | 'strokeThickness' | 'align'>> &
      Types.GameObjects.Text.TextStyle;
    width = 0;
    height = 0;
    letterSpacing = 0;
    lineSpacing = 0;
    padding = { left: 0, right: 0, top: 0, bottom: 0 };
    shadow = { x: 0, y: 0, color: '#000000', blur: 0, stroke: false, fill: false };

    constructor(scene: Scene, x: number, y: number, text: string | string[], style?: Types.GameObjects.Text.TextStyle) {
      super(scene, 'Text');
      this.x = x;
      this.y = y;
      this.originX = 0;
      this.originY = 0;
      this.style = {
        fontFamily: style?.fontFamily ?? 'sans-serif',
        fontSize: style?.fontSize ?? '24px',
        fontStyle: style?.fontStyle ?? 'normal',
        color: style?.color ?? '#ffffff',
        stroke: style?.stroke ?? '#000000',
        strokeThickness: style?.strokeThickness ?? 0,
        align: style?.align ?? 'left',
        wordWrap: style?.wordWrap,
        lineSpacing: style?.lineSpacing ?? 0,
        letterSpacing: style?.letterSpacing ?? 0,
        backgroundColor: style?.backgroundColor
      };
      this.lineSpacing = style?.lineSpacing ?? 0;
      this.letterSpacing = style?.letterSpacing ?? 0;
      this.setText(text);
    }

    setText(value: string | string[]): this {
      this.text = Array.isArray(value) ? value.join('\n') : String(value ?? '');
      this.updateMetrics();
      return this;
    }

    setStyle(style: Types.GameObjects.Text.TextStyle): this {
      Object.assign(this.style, style);
      if (style.lineSpacing !== undefined) this.lineSpacing = style.lineSpacing;
      if (style.letterSpacing !== undefined) this.letterSpacing = style.letterSpacing;
      this.updateMetrics();
      return this;
    }

    setColor(color: string): this {
      this.style.color = color;
      return this;
    }

    setFontSize(size: number | string): this {
      this.style.fontSize = typeof size === 'number' ? `${size}px` : size;
      this.updateMetrics();
      return this;
    }

    setFontFamily(family: string): this {
      this.style.fontFamily = family;
      this.updateMetrics();
      return this;
    }

    setFontStyle(style: string): this {
      this.style.fontStyle = style;
      this.updateMetrics();
      return this;
    }

    setAlign(align: string): this {
      this.style.align = align;
      return this;
    }

    setWordWrapWidth(width: number, useAdvancedWrap = false): this {
      this.style.wordWrap = { width, useAdvancedWrap };
      this.updateMetrics();
      return this;
    }

    setLetterSpacing(spacing: number): this {
      this.letterSpacing = spacing;
      this.style.letterSpacing = spacing;
      this.updateMetrics();
      return this;
    }

    setLineSpacing(spacing: number): this {
      this.lineSpacing = spacing;
      this.style.lineSpacing = spacing;
      this.updateMetrics();
      return this;
    }

    setStroke(color: string, thickness: number): this {
      this.style.stroke = color;
      this.style.strokeThickness = thickness;
      return this;
    }

    setShadow(x = 0, y = 0, color = '#000000', blur = 0, shadowStroke = false, shadowFill = true): this {
      this.shadow = { x, y, color, blur, stroke: shadowStroke, fill: shadowFill };
      return this;
    }

    setPadding(
      left: number | { x?: number; y?: number; left?: number; right?: number; top?: number; bottom?: number } = 0,
      top = 0,
      right = left as number,
      bottom = top
    ): this {
      if (typeof left === 'object') {
        const px = left.x ?? 0;
        const py = left.y ?? 0;
        this.padding = {
          left: left.left ?? px,
          right: left.right ?? px,
          top: left.top ?? py,
          bottom: left.bottom ?? py
        };
      } else {
        this.padding = { left, top, right, bottom };
      }
      this.updateMetrics();
      return this;
    }

    getWrappedText(text?: string): string[] {
      if (text !== undefined) {
        const prev = this.text;
        this.text = text;
        const lines = this.getWrappedLines();
        this.text = prev;
        return lines;
      }
      return this.getWrappedLines();
    }

    getWrappedLines(): string[] {
      if (!this.text) return [''];
      const rawLines = this.text.split('\n');
      const wrapW = this.style.wordWrap?.width;
      if (!wrapW || wrapW <= 0) return rawLines;
      const fontPx = this.getFontSizePx();
      const avgCharW = fontPx * 0.54 + this.letterSpacing;
      const out: string[] = [];
      for (const raw of rawLines) {
        if (!raw) {
          out.push('');
          continue;
        }
        const words = raw.split(' ');
        let current = '';
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          const w = this.measureLineWidth(candidate, fontPx, avgCharW);
          if (current && w > wrapW) {
            out.push(current);
            current = word;
          } else {
            current = candidate;
          }
        }
        if (current) out.push(current);
      }
      return out.length > 0 ? out : [''];
    }

    getFontSizePx(): number {
      const fs = this.style.fontSize;
      if (typeof fs === 'number') return fs;
      const n = Number.parseFloat(String(fs));
      return Number.isFinite(n) && n > 0 ? n : 24;
    }

    private measureLineWidth(line: string, fontPx: number, avgCharW: number): number {
      if (sharedMeasureCtx) {
        try {
          sharedMeasureCtx.font = `${this.style.fontStyle} ${fontPx}px ${this.style.fontFamily}`;
          const ctx2d = sharedMeasureCtx as CanvasRenderingContext2D & { letterSpacing?: string };
          if (typeof ctx2d.letterSpacing === 'string') {
            ctx2d.letterSpacing = `${this.letterSpacing}px`;
            const m = ctx2d.measureText(line);
            ctx2d.letterSpacing = '0px';
            return globalThis.Math.max(0, m.width - (line.length > 0 && this.letterSpacing > 0 ? this.letterSpacing : 0));
          }
          const m = ctx2d.measureText(line);
          return m.width + globalThis.Math.max(0, line.length - 1) * this.letterSpacing;
        } catch {
          /* fallback below */
        }
      }
      return line.length * avgCharW;
    }

    private updateMetrics(): void {
      const fontPx = this.getFontSizePx();
      const avgCharW = fontPx * 0.54 + this.letterSpacing;
      const lines = this.getWrappedLines();
      let maxW = 0;
      for (const line of lines) {
        const w = this.measureLineWidth(line, fontPx, avgCharW);
        if (w > maxW) maxW = w;
      }
      const lineH = fontPx * 1.2 + this.lineSpacing;
      const rawH = lines.length * (fontPx * 1.2) + globalThis.Math.max(0, lines.length - 1) * this.lineSpacing;
      void lineH;
      this.width = globalThis.Math.ceil(maxW + this.padding.left + this.padding.right);
      this.height = globalThis.Math.ceil(rawH + this.padding.top + this.padding.bottom);
    }
  }

  export class Shape extends GameObject {
    width = 0;
    height = 0;
    fillColor = 0xffffff;
    fillAlpha = 1;
    isFilled = false;
    strokeColor = 0xffffff;
    strokeAlpha = 1;
    lineWidth = 0;
    isStroked = false;

    constructor(scene: Scene, type: string, x: number, y: number, width: number, height: number, fillColor?: number, fillAlpha = 1) {
      super(scene, type);
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      if (fillColor !== undefined) {
        this.fillColor = fillColor;
        this.fillAlpha = fillAlpha;
        this.isFilled = true;
      }
    }

    setFillStyle(color?: number, alpha = 1): this {
      if (color === undefined) {
        this.isFilled = false;
      } else {
        this.fillColor = color;
        this.fillAlpha = alpha;
        this.isFilled = true;
      }
      return this;
    }

    setStrokeStyle(lineWidth?: number, color = 0xffffff, alpha = 1): this {
      if (!lineWidth || lineWidth <= 0) {
        this.isStroked = false;
        this.lineWidth = 0;
      } else {
        this.lineWidth = lineWidth;
        this.strokeColor = color;
        this.strokeAlpha = alpha;
        this.isStroked = true;
      }
      return this;
    }

    setSize(width: number, height: number): this {
      this.width = width;
      this.height = height;
      return this;
    }
  }

  export class Rectangle extends Shape {
    constructor(scene: Scene, x = 0, y = 0, width = 128, height = 128, fillColor?: number, fillAlpha = 1) {
      super(scene, 'Rectangle', x, y, width, height, fillColor, fillAlpha);
    }
  }

  export class Ellipse extends Shape {
    constructor(scene: Scene, x = 0, y = 0, width = 128, height = 128, fillColor?: number, fillAlpha = 1) {
      super(scene, 'Ellipse', x, y, width, height, fillColor, fillAlpha);
    }
  }

  export class Arc extends Shape {
    radius: number;
    startAngle: number;
    endAngle: number;
    anticlockwise: boolean;

    constructor(scene: Scene, x = 0, y = 0, radius = 64, startAngle = 0, endAngle = 360, anticlockwise = false, fillColor?: number, fillAlpha = 1) {
      super(scene, 'Arc', x, y, radius * 2, radius * 2, fillColor, fillAlpha);
      this.radius = radius;
      this.startAngle = startAngle;
      this.endAngle = endAngle;
      this.anticlockwise = anticlockwise;
    }

    setRadius(r: number): this {
      this.radius = r;
      this.width = r * 2;
      this.height = r * 2;
      return this;
    }
  }

  export class Zone extends Shape {
    constructor(scene: Scene, x = 0, y = 0, width = 1, height = 1) {
      super(scene, 'Zone', x, y, width, height);
    }
  }

  /** resolved paint for one draw op (captured when the op is recorded, like Phaser's command buffer) */
  export interface FillSpec {
    color: number;
    alpha: number;
    /** vertical gradient (Phaser fillGradientStyle top-left → bottom-left) */
    grad?: { top: number; topAlpha: number; bottom: number; bottomAlpha: number };
  }
  export interface LineSpec {
    width: number;
    color: number;
    alpha: number;
  }
  type Pt = { x: number; y: number };
  export type DrawOp =
    | { k: 'rect'; x: number; y: number; w: number; h: number; r: number; fill?: FillSpec; line?: LineSpec }
    | { k: 'circle'; x: number; y: number; r: number; fill?: FillSpec; line?: LineSpec }
    | { k: 'ellipse'; x: number; y: number; rx: number; ry: number; fill?: FillSpec; line?: LineSpec }
    | { k: 'poly'; pts: Pt[]; close: boolean; fill?: FillSpec; line?: LineSpec }
    | { k: 'begin' }
    | { k: 'moveTo'; x: number; y: number }
    | { k: 'lineTo'; x: number; y: number }
    | { k: 'arc'; x: number; y: number; r: number; a0: number; a1: number; ccw: boolean }
    | { k: 'slice'; x: number; y: number; r: number; a0: number; a1: number; ccw: boolean }
    | { k: 'close' }
    | { k: 'fillPath'; fill: FillSpec }
    | { k: 'strokePath'; line: LineSpec };

  function pixiFill(f: FillSpec): PIXI.FillInput {
    if (!f.grad) return { color: f.color, alpha: f.alpha };
    return new PIXI.FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: hexToRgba(f.grad.top, f.grad.topAlpha) },
        { offset: 1, color: hexToRgba(f.grad.bottom, f.grad.bottomAlpha) }
      ]
    });
  }

  function pixiStroke(l: LineSpec): PIXI.StrokeInput {
    return { width: l.width, color: l.color, alpha: l.alpha, join: 'round' };
  }

  /** replays recorded ops into a PIXI.Graphics (local coordinates) */
  export function drawOpsToPixi(g: PIXI.Graphics, ops: readonly DrawOp[]): void {
    g.clear();
    const paint = (fill?: FillSpec, line?: LineSpec): void => {
      if (fill && fill.alpha > 0) g.fill(pixiFill(fill));
      if (line && line.width > 0 && line.alpha > 0) g.stroke(pixiStroke(line));
    };
    for (const op of ops) {
      switch (op.k) {
        case 'rect':
          g.beginPath();
          if (op.r > 0) g.roundRect(op.x, op.y, op.w, op.h, globalThis.Math.min(op.r, globalThis.Math.abs(op.w) / 2, globalThis.Math.abs(op.h) / 2));
          else g.rect(op.x, op.y, op.w, op.h);
          paint(op.fill, op.line);
          break;
        case 'circle':
          g.beginPath();
          g.circle(op.x, op.y, globalThis.Math.max(0, op.r));
          paint(op.fill, op.line);
          break;
        case 'ellipse':
          g.beginPath();
          g.ellipse(op.x, op.y, globalThis.Math.max(0, op.rx), globalThis.Math.max(0, op.ry));
          paint(op.fill, op.line);
          break;
        case 'poly':
          if (op.pts.length < 2) break;
          g.beginPath();
          g.poly(op.pts.flatMap((p) => [p.x, p.y]), op.close || Boolean(op.fill));
          paint(op.fill, op.line);
          break;
        case 'begin':
          g.beginPath();
          break;
        case 'moveTo':
          g.moveTo(op.x, op.y);
          break;
        case 'lineTo':
          g.lineTo(op.x, op.y);
          break;
        case 'arc':
          g.arc(op.x, op.y, globalThis.Math.max(0, op.r), op.a0, op.a1, op.ccw);
          break;
        case 'slice':
          g.beginPath();
          g.moveTo(op.x, op.y);
          g.arc(op.x, op.y, globalThis.Math.max(0, op.r), op.a0, op.a1, op.ccw);
          g.closePath();
          break;
        case 'close':
          g.closePath();
          break;
        case 'fillPath':
          if (op.fill.alpha > 0) g.fill(pixiFill(op.fill));
          break;
        case 'strokePath':
          if (op.line.width > 0 && op.line.alpha > 0) g.stroke(pixiStroke(op.line));
          break;
      }
    }
  }

  function canvasFill(ctx: CanvasRenderingContext2D, f: FillSpec, y: number, h: number): void {
    if (!f.grad) {
      ctx.fillStyle = hexToRgba(f.color, f.alpha);
      return;
    }
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hexToRgba(f.grad.top, f.grad.topAlpha));
    g.addColorStop(1, hexToRgba(f.grad.bottom, f.grad.bottomAlpha));
    ctx.fillStyle = g;
  }

  /** the same ops onto a 2D canvas: only used to bake generateTexture() into a CanvasTexture */
  export function drawOpsToCanvas(ctx: CanvasRenderingContext2D, ops: readonly DrawOp[]): void {
    const paint = (fill: FillSpec | undefined, line: LineSpec | undefined, y: number, h: number): void => {
      if (fill) {
        canvasFill(ctx, fill, y, h);
        ctx.fill();
      }
      if (line && line.width > 0) {
        ctx.lineWidth = line.width;
        ctx.strokeStyle = hexToRgba(line.color, line.alpha);
        ctx.stroke();
      }
    };
    for (const op of ops) {
      switch (op.k) {
        case 'rect':
          drawRoundRectPath(ctx, op.x, op.y, op.w, op.h, op.r);
          paint(op.fill, op.line, op.y, op.h);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.arc(op.x, op.y, globalThis.Math.max(0, op.r), 0, globalThis.Math.PI * 2);
          paint(op.fill, op.line, op.y - op.r, op.r * 2);
          break;
        case 'ellipse':
          ctx.beginPath();
          ctx.ellipse(op.x, op.y, globalThis.Math.max(0, op.rx), globalThis.Math.max(0, op.ry), 0, 0, globalThis.Math.PI * 2);
          paint(op.fill, op.line, op.y - op.ry, op.ry * 2);
          break;
        case 'poly': {
          if (op.pts.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(op.pts[0]!.x, op.pts[0]!.y);
          for (let i = 1; i < op.pts.length; i++) ctx.lineTo(op.pts[i]!.x, op.pts[i]!.y);
          if (op.close) ctx.closePath();
          const ys = op.pts.map((p) => p.y);
          const top = globalThis.Math.min(...ys);
          paint(op.fill, op.line, top, globalThis.Math.max(...ys) - top);
          break;
        }
        case 'begin':
          ctx.beginPath();
          break;
        case 'moveTo':
          ctx.moveTo(op.x, op.y);
          break;
        case 'lineTo':
          ctx.lineTo(op.x, op.y);
          break;
        case 'arc':
          ctx.arc(op.x, op.y, globalThis.Math.max(0, op.r), op.a0, op.a1, op.ccw);
          break;
        case 'slice':
          ctx.beginPath();
          ctx.moveTo(op.x, op.y);
          ctx.arc(op.x, op.y, globalThis.Math.max(0, op.r), op.a0, op.a1, op.ccw);
          ctx.closePath();
          break;
        case 'close':
          ctx.closePath();
          break;
        case 'fillPath':
          canvasFill(ctx, op.fill, 0, ctx.canvas.height);
          ctx.fill();
          break;
        case 'strokePath':
          ctx.lineWidth = op.line.width;
          ctx.strokeStyle = hexToRgba(op.line.color, op.line.alpha);
          ctx.stroke();
          break;
      }
    }
  }

  export class Graphics extends GameObject {
    ops: DrawOp[] = [];
    /** bumped on every recorded change so the stage sync rebuilds the PIXI geometry only when needed */
    version = 0;
    private curFillColor = 0xffffff;
    private curFillAlpha = 1;
    private curLineWidth = 1;
    private curLineColor = 0xffffff;
    private curLineAlpha = 1;
    private curGradient: FillSpec['grad'] | null = null;

    constructor(scene: Scene, options?: { x?: number; y?: number }) {
      super(scene, 'Graphics');
      this.x = options?.x ?? 0;
      this.y = options?.y ?? 0;
      this.originX = 0;
      this.originY = 0;
    }

    private push(op: DrawOp): this {
      this.ops.push(op);
      this.version++;
      return this;
    }

    private fill(): FillSpec {
      return this.curGradient ? { color: this.curFillColor, alpha: this.curFillAlpha, grad: { ...this.curGradient } } : { color: this.curFillColor, alpha: this.curFillAlpha };
    }

    /** gradients apply to rectangles only, as in Phaser */
    private solidFill(): FillSpec {
      return { color: this.curFillColor, alpha: this.curFillAlpha };
    }

    private line(): LineSpec {
      return { width: this.curLineWidth, color: this.curLineColor, alpha: this.curLineAlpha };
    }

    clear(): this {
      this.ops.length = 0;
      this.curGradient = null;
      this.version++;
      return this;
    }

    fillStyle(color: number, alpha = 1): this {
      this.curFillColor = color;
      this.curFillAlpha = alpha;
      this.curGradient = null;
      return this;
    }

    fillGradientStyle(
      topLeft: number,
      _topRight: number,
      bottomLeft: number,
      _bottomRight: number,
      alphaTopLeft = 1,
      _alphaTopRight = alphaTopLeft,
      alphaBottomLeft = alphaTopLeft,
      _alphaBottomRight = alphaTopLeft
    ): this {
      this.curGradient = { top: topLeft, topAlpha: alphaTopLeft, bottom: bottomLeft, bottomAlpha: alphaBottomLeft };
      return this;
    }

    lineStyle(lineWidth: number, color: number, alpha = 1): this {
      this.curLineWidth = lineWidth;
      this.curLineColor = color;
      this.curLineAlpha = alpha;
      return this;
    }

    fillRect(x: number, y: number, w: number, h: number): this {
      return this.push({ k: 'rect', x, y, w, h, r: 0, fill: this.fill() });
    }

    strokeRect(x: number, y: number, w: number, h: number): this {
      return this.push({ k: 'rect', x, y, w, h, r: 0, line: this.line() });
    }

    fillRoundedRect(x: number, y: number, w: number, h: number, radius = 0): this {
      return this.push({ k: 'rect', x, y, w, h, r: typeof radius === 'number' ? radius : 8, fill: this.fill() });
    }

    strokeRoundedRect(x: number, y: number, w: number, h: number, radius = 0): this {
      return this.push({ k: 'rect', x, y, w, h, r: typeof radius === 'number' ? radius : 8, line: this.line() });
    }

    fillCircle(x: number, y: number, r: number): this {
      return this.push({ k: 'circle', x, y, r, fill: this.solidFill() });
    }

    strokeCircle(x: number, y: number, r: number): this {
      return this.push({ k: 'circle', x, y, r, line: this.line() });
    }

    fillEllipse(x: number, y: number, w: number, h: number): this {
      return this.push({ k: 'ellipse', x, y, rx: w / 2, ry: h / 2, fill: this.solidFill() });
    }

    strokeEllipse(x: number, y: number, w: number, h: number): this {
      return this.push({ k: 'ellipse', x, y, rx: w / 2, ry: h / 2, line: this.line() });
    }

    fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
      return this.push({ k: 'poly', pts: [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }], close: true, fill: this.solidFill() });
    }

    strokeTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
      return this.push({ k: 'poly', pts: [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }], close: true, line: this.line() });
    }

    lineBetween(x1: number, y1: number, x2: number, y2: number): this {
      return this.push({ k: 'poly', pts: [{ x: x1, y: y1 }, { x: x2, y: y2 }], close: false, line: this.line() });
    }

    beginPath(): this {
      return this.push({ k: 'begin' });
    }

    moveTo(x: number, y: number): this {
      return this.push({ k: 'moveTo', x, y });
    }

    lineTo(x: number, y: number): this {
      return this.push({ k: 'lineTo', x, y });
    }

    arc(x: number, y: number, r: number, startAngle: number, endAngle: number, anticlockwise = false): this {
      return this.push({ k: 'arc', x, y, r, a0: startAngle, a1: endAngle, ccw: anticlockwise });
    }

    slice(x: number, y: number, r: number, startAngle: number, endAngle: number, anticlockwise = false): this {
      return this.push({ k: 'slice', x, y, r, a0: startAngle, a1: endAngle, ccw: anticlockwise });
    }

    closePath(): this {
      return this.push({ k: 'close' });
    }

    fillPath(): this {
      return this.push({ k: 'fillPath', fill: this.solidFill() });
    }

    strokePath(): this {
      return this.push({ k: 'strokePath', line: this.line() });
    }

    fillPoints(points: Array<{ x: number; y: number }>, closeShape = false): this {
      return this.push({ k: 'poly', pts: points.map((p) => ({ x: p.x, y: p.y })), close: closeShape, fill: this.solidFill() });
    }

    strokePoints(points: Array<{ x: number; y: number }>, closeShape = false): this {
      return this.push({ k: 'poly', pts: points.map((p) => ({ x: p.x, y: p.y })), close: closeShape, line: this.line() });
    }

    generateTexture(key: string, width = 64, height = 64): this {
      const canvas = document.createElement('canvas');
      canvas.width = globalThis.Math.max(1, width);
      canvas.height = globalThis.Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (ctx) drawOpsToCanvas(ctx, this.ops);
      this.scene.textures.addCanvas(key, canvas);
      return this;
    }
  }

  export namespace Particles {
    interface LiveParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      gx: number;
      gy: number;
      scaleStart: number;
      scaleEnd: number;
      alphaStart: number;
      alphaEnd: number;
      tint: number;
      age: number;
      life: number;
    }

    export class ParticleEmitter extends GameObject {
      textureKey: string;
      config: Record<string, any>;
      emitting: boolean;
      particles: LiveParticle[] = [];
      private accumMs = 0;

      constructor(scene: Scene, x: number, y: number, textureKey: string, config?: Record<string, any>) {
        super(scene, 'Particles');
        this.x = x;
        this.y = y;
        this.textureKey = textureKey;
        this.config = config ?? {};
        this.emitting = config?.emitting ?? true;
        if (config?.blendMode === 'ADD' || config?.blendMode === BlendModes.ADD) {
          this.blendMode = BlendModes.ADD;
        }
      }

      explode(count = 8, x?: number, y?: number): this {
        for (let i = 0; i < count; i++) {
          this.spawnOne(x, y);
        }
        return this;
      }

      start(): this {
        this.emitting = true;
        return this;
      }

      stop(): this {
        this.emitting = false;
        return this;
      }

      private sampleRange(spec: any, fallback: number): number {
        if (typeof spec === 'number') return spec;
        if (Array.isArray(spec) && spec.length > 0) {
          return spec[globalThis.Math.floor(globalThis.Math.random() * spec.length)] ?? fallback;
        }
        if (spec && typeof spec === 'object') {
          if (typeof spec.min === 'number' && typeof spec.max === 'number') {
            return spec.min + globalThis.Math.random() * (spec.max - spec.min);
          }
          if (typeof spec.start === 'number') return spec.start;
        }
        return fallback;
      }

      private spawnOne(overrideX?: number, overrideY?: number): void {
        if (this.particles.length >= 96) return;
        const cfg = this.config;
        const px = overrideX ?? (this.x + this.sampleRange(cfg.x, 0));
        const py = overrideY ?? (this.y + this.sampleRange(cfg.y, 0));
        let vx = 0;
        let vy = 0;
        if (cfg.speedX !== undefined || cfg.speedY !== undefined) {
          vx = this.sampleRange(cfg.speedX, 0);
          vy = this.sampleRange(cfg.speedY, 0);
        } else if (cfg.speed !== undefined) {
          const spd = this.sampleRange(cfg.speed, 40);
          const angDeg = this.sampleRange(cfg.angle, globalThis.Math.random() * 360);
          const rad = (angDeg * globalThis.Math.PI) / 180;
          vx = globalThis.Math.cos(rad) * spd;
          vy = globalThis.Math.sin(rad) * spd;
        }
        const scaleStart = cfg.scale && typeof cfg.scale === 'object' && typeof cfg.scale.start === 'number'
          ? cfg.scale.start
          : this.sampleRange(cfg.scale, 0.2);
        const scaleEnd = cfg.scale && typeof cfg.scale === 'object' && typeof cfg.scale.end === 'number'
          ? cfg.scale.end
          : scaleStart;
        const alphaStart = cfg.alpha && typeof cfg.alpha === 'object' && typeof cfg.alpha.start === 'number'
          ? cfg.alpha.start
          : this.sampleRange(cfg.alpha, 0.8);
        const alphaEnd = cfg.alpha && typeof cfg.alpha === 'object' && typeof cfg.alpha.end === 'number'
          ? cfg.alpha.end
          : 0;
        const life = globalThis.Math.max(100, this.sampleRange(cfg.lifespan, 1000));
        const tint = this.sampleRange(cfg.tint, 0xffffff);
        this.particles.push({
          x: px,
          y: py,
          vx,
          vy,
          gx: Number(cfg.gravityX ?? 0),
          gy: Number(cfg.gravityY ?? 0),
          scaleStart,
          scaleEnd,
          alphaStart,
          alphaEnd,
          tint,
          age: 0,
          life
        });
      }

      step(dtMs: number): void {
        if (!this.active || !this.visible) return;
        const freq = Number(this.config.frequency ?? 250);
        if (this.emitting && freq > 0) {
          this.accumMs += dtMs;
          while (this.accumMs >= freq) {
            this.accumMs -= freq;
            const qty = globalThis.Math.max(1, Number(this.config.quantity ?? 1));
            for (let i = 0; i < qty; i++) this.spawnOne();
          }
        }
        const dtSec = dtMs / 1000;
        for (const p of this.particles) {
          p.age += dtMs;
          p.vx += p.gx * dtSec;
          p.vy += p.gy * dtSec;
          p.x += p.vx * dtSec;
          p.y += p.vy * dtSec;
        }
        this.particles = this.particles.filter((p) => p.age < p.life);
      }
    }
  }
}

function hexToRgba(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r},${g},${b},${Math.Clamp(alpha, 0, 1)})`;
}

function drawRoundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = globalThis.Math.max(0, globalThis.Math.min(r, globalThis.Math.abs(w) / 2, globalThis.Math.abs(h) / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rad);
  } else {
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
}

export class DisplayList {
  list: GameObjects.GameObject[] = [];

  add<T extends GameObjects.GameObject>(obj: T): T {
    if (!this.list.includes(obj)) {
      this.list.push(obj);
    }
    return obj;
  }

  remove(obj: GameObjects.GameObject): void {
    const idx = this.list.indexOf(obj);
    if (idx >= 0) this.list.splice(idx, 1);
  }

  removeAll(destroy = false): void {
    const copy = [...this.list];
    this.list.length = 0;
    if (destroy) {
      for (const c of copy) c.destroy();
    }
  }
}

export class GameObjectFactory {
  scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  private register<T extends GameObjects.GameObject>(obj: T): T {
    this.scene.children.add(obj);
    return obj;
  }

  existing<T extends GameObjects.GameObject>(child: T): T {
    return this.register(child);
  }

  container(x = 0, y = 0, children?: GameObjects.GameObject[]): GameObjects.Container {
    return this.register(new GameObjects.Container(this.scene, x, y, children));
  }

  image(x: number, y: number, key: string, frame?: string | number): GameObjects.Image {
    return this.register(new GameObjects.Image(this.scene, x, y, key, frame));
  }

  sprite(x: number, y: number, key: string, frame?: string | number): GameObjects.Sprite {
    return this.register(new GameObjects.Sprite(this.scene, x, y, key, frame));
  }

  text(x: number, y: number, text: string | string[], style?: Types.GameObjects.Text.TextStyle): GameObjects.Text {
    return this.register(new GameObjects.Text(this.scene, x, y, text, style));
  }

  graphics(options?: { x?: number; y?: number }): GameObjects.Graphics {
    return this.register(new GameObjects.Graphics(this.scene, options));
  }

  rectangle(x = 0, y = 0, width = 128, height = 128, fillColor?: number, fillAlpha = 1): GameObjects.Rectangle {
    return this.register(new GameObjects.Rectangle(this.scene, x, y, width, height, fillColor, fillAlpha));
  }

  ellipse(x = 0, y = 0, width = 128, height = 128, fillColor?: number, fillAlpha = 1): GameObjects.Ellipse {
    return this.register(new GameObjects.Ellipse(this.scene, x, y, width, height, fillColor, fillAlpha));
  }

  circle(x = 0, y = 0, radius = 64, fillColor?: number, fillAlpha = 1): GameObjects.Arc {
    return this.register(new GameObjects.Arc(this.scene, x, y, radius, 0, 360, false, fillColor, fillAlpha));
  }

  zone(x = 0, y = 0, width = 1, height = 1): GameObjects.Zone {
    return this.register(new GameObjects.Zone(this.scene, x, y, width, height));
  }

  particles(x = 0, y = 0, textureKey = 'fx_spark', config?: Record<string, any>): GameObjects.Particles.ParticleEmitter {
    return this.register(new GameObjects.Particles.ParticleEmitter(this.scene, x, y, textureKey, config));
  }
}

export class ScenePlugin {
  scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  get key(): string {
    return this.scene.sys.settings.key;
  }

  start(key: string, data?: any): ScenePlugin {
    this.scene.game.scene.startFrom(this.key, key, data);
    return this;
  }

  restart(data?: any): ScenePlugin {
    this.scene.game.scene.startFrom(this.key, this.key, data !== undefined ? data : this.scene.sys.settings.data);
    return this;
  }

  launch(key: string, data?: any): ScenePlugin {
    this.scene.game.scene.launchScene(key, data);
    return this;
  }

  stop(key?: string): ScenePlugin {
    this.scene.game.scene.stopScene(key ?? this.key);
    return this;
  }

  pause(key?: string): ScenePlugin {
    this.scene.game.scene.pauseScene(key ?? this.key);
    return this;
  }

  resume(key?: string): ScenePlugin {
    this.scene.game.scene.resumeScene(key ?? this.key);
    return this;
  }

  bringToTop(key?: string): ScenePlugin {
    this.scene.game.scene.bringToTop(key ?? this.key);
    return this;
  }

  isActive(key?: string): boolean {
    return this.scene.game.scene.isActive(key ?? this.key);
  }

  isPaused(key?: string): boolean {
    return this.scene.game.scene.isPaused(key ?? this.key);
  }

  get(key: string): Scene {
    return this.scene.game.scene.getScene(key)!;
  }
}

export class SceneSystems {
  scene: Scene;
  settings: { key: string; active: boolean; visible: boolean; status: number; data: any };

  constructor(scene: Scene, key: string) {
    this.scene = scene;
    this.settings = {
      key,
      active: false,
      visible: false,
      status: Scenes.SHUTDOWN,
      data: undefined
    };
  }

  isActive(): boolean {
    return this.settings.active && this.settings.status === Scenes.RUNNING;
  }

  isPaused(): boolean {
    return this.settings.status === Scenes.PAUSED;
  }
}

export class Scene {
  game!: Game;
  sys: SceneSystems;
  scene: ScenePlugin;
  events = new EventEmitter();
  children = new DisplayList();
  add: GameObjectFactory;
  make: { graphics: (options?: { x?: number; y?: number; add?: boolean }, add?: boolean) => GameObjects.Graphics };
  time: Time.Clock;
  tweens: Tweens.TweenManager;
  cameras!: Cameras.Scene2D.CameraManager;
  input: Input.InputPlugin;
  load: Loader.LoaderPlugin;
  textures!: Textures.TextureManager;
  anims!: AnimationManager;
  sound!: Sound.WebAudioSoundManager;
  cache!: { audio: AudioCache };
  scale!: Scale.ScaleManager;

  constructor(config?: string | { key?: string }) {
    const key = typeof config === 'string' ? config : (config?.key ?? 'Scene');
    this.sys = new SceneSystems(this, key);
    this.scene = new ScenePlugin(this);
    this.add = new GameObjectFactory(this);
    this.make = {
      graphics: (options?: { x?: number; y?: number; add?: boolean }, add?: boolean) => {
        const g = new GameObjects.Graphics(this, options);
        if (options?.add ?? add) this.children.add(g);
        return g;
      }
    };
    this.time = new Time.Clock(this);
    this.tweens = new Tweens.TweenManager(this);
    this.input = new Input.InputPlugin(this);
    this.load = new Loader.LoaderPlugin(this);
  }
}

export class SceneManager {
  game: Game;
  scenes: Scene[] = [];
  private byKey = new Map<string, Scene>();

  constructor(game: Game, sceneClasses: Array<new () => Scene>) {
    this.game = game;
    for (const Cls of sceneClasses) {
      const instance = new Cls();
      this.register(instance);
    }
  }

  private register(scene: Scene): void {
    scene.game = this.game;
    scene.textures = this.game.textures;
    scene.anims = this.game.anims;
    scene.sound = this.game.sound;
    scene.cache = this.game.cache;
    scene.scale = this.game.scale;
    scene.cameras = new Cameras.Scene2D.CameraManager(scene, this.game.scale.width, this.game.scale.height);
    this.scenes.push(scene);
    this.byKey.set(scene.sys.settings.key, scene);
  }

  getScene(key: string): Scene | undefined {
    return this.byKey.get(key);
  }

  getScenes(isActive = true): Scene[] {
    if (!isActive) return [...this.scenes];
    return this.scenes.filter((s) => s.sys.isActive());
  }

  isActive(key: string): boolean {
    const s = this.byKey.get(key);
    return Boolean(s && s.sys.isActive());
  }

  isPaused(key: string): boolean {
    const s = this.byKey.get(key);
    return Boolean(s && s.sys.isPaused());
  }

  getIndex(key: string): number {
    const s = this.byKey.get(key);
    return s ? this.scenes.indexOf(s) : -1;
  }

  bringToTop(key: string): void {
    const s = this.byKey.get(key);
    if (!s) return;
    const idx = this.scenes.indexOf(s);
    if (idx >= 0) {
      this.scenes.splice(idx, 1);
      this.scenes.push(s);
    }
  }

  startFrom(fromKey: string, toKey: string, data?: any): void {
    if (fromKey && fromKey !== toKey) {
      this.stopScene(fromKey);
    } else if (fromKey === toKey) {
      this.stopScene(fromKey);
    }
    this.launchScene(toKey, data);
  }

  start(key: string, data?: any): this {
    this.launchScene(key, data);
    return this;
  }

  stop(key: string): this {
    this.stopScene(key);
    return this;
  }

  pause(key: string): this {
    this.pauseScene(key);
    return this;
  }

  resume(key: string): this {
    this.resumeScene(key);
    return this;
  }

  launchScene(key: string, data?: any): void {
    const s = this.byKey.get(key);
    if (!s) return;
    if (s.sys.settings.active) {
      this.stopScene(key);
    }
    s.cameras = new Cameras.Scene2D.CameraManager(s, this.game.scale.width, this.game.scale.height);
    s.sys.settings.data = data;
    s.sys.settings.active = true;
    s.sys.settings.visible = true;
    s.sys.settings.status = Scenes.RUNNING;
    s.time.paused = false;
    s.time.timeScale = 1;
    s.tweens.timeScale = 1;
    s.tweens.resumeAll();
    const lc = s as unknown as { init?: (d?: any) => void; create?: (d?: any) => void | Promise<void> };
    try {
      lc.init?.(data ?? {});
    } catch (err) {
      console.error(`Error in ${key}.init:`, err);
    }
    try {
      const res = lc.create?.(data ?? {});
      if (res && typeof (res as Promise<void>).catch === 'function') {
        (res as Promise<void>).catch((err) => console.error(`Error in ${key}.create:`, err));
      }
    } catch (err) {
      console.error(`Error in ${key}.create:`, err);
    }
  }

  stopScene(key: string): void {
    const s = this.byKey.get(key);
    if (!s || !s.sys.settings.active) return;
    s.sys.settings.active = false;
    s.sys.settings.visible = false;
    s.sys.settings.status = Scenes.SHUTDOWN;
    s.events.emit(Scenes.Events.SHUTDOWN);
    s.time.removeAllEvents();
    s.tweens.killAll();
    s.input.removeAllListeners();
    s.input.keyboard.removeAllListeners();
    s.children.removeAll(true);
    s.events.removeAllListeners();
  }

  pauseScene(key: string): void {
    const s = this.byKey.get(key);
    if (!s || !s.sys.settings.active) return;
    s.sys.settings.status = Scenes.PAUSED;
    s.events.emit(Scenes.Events.PAUSE);
  }

  resumeScene(key: string): void {
    const s = this.byKey.get(key);
    if (!s || !s.sys.settings.active) return;
    s.sys.settings.status = Scenes.RUNNING;
    s.events.emit(Scenes.Events.RESUME);
  }
}

export interface GameConfig {
  type?: number;
  parent?: string | HTMLElement;
  backgroundColor?: number | string;
  width?: number;
  height?: number;
  scale?: {
    mode?: string;
    autoCenter?: string;
    width?: number;
    height?: number;
  };
  fps?: {
    target?: number;
    smoothStep?: boolean;
  };
  render?: {
    antialias?: boolean;
    powerPreference?: string;
    roundPixels?: boolean;
    /** upper bound for the backing-store resolution (quality tier) */
    resolution?: number;
  };
  input?: Record<string, any>;
  banner?: boolean;
  scene?: Array<new () => Scene>;
}

/** per-scene retained PIXI layer: background, objects (sorted by depth) and the camera overlays */
interface SceneLayer {
  root: PIXI.Container;
  bg: PIXI.Graphics;
  vignette: PIXI.Graphics;
  flash: PIXI.Graphics;
  fade: PIXI.Graphics;
  bgKey: string;
  vignetteKey: string;
}

export type RendererName = 'pending' | 'webgl' | 'webgpu' | 'canvas' | 'failed';

function pixiBlend(mode: number | string): PIXI.BLEND_MODES {
  if (mode === BlendModes.ADD || mode === 'ADD') return 'add';
  if (mode === BlendModes.MULTIPLY || mode === 'MULTIPLY') return 'multiply';
  if (mode === BlendModes.SCREEN || mode === 'SCREEN') return 'screen';
  return 'normal';
}

/** Phaser fontStyle strings ('700', 'italic 500', 'bold') → PIXI fontStyle + fontWeight */
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

function setChildren(parent: PIXI.Container, desired: PIXI.Container[]): void {
  const cur = parent.children;
  if (cur.length === desired.length && desired.every((c, i) => cur[i] === c)) return;
  parent.removeChildren();
  if (desired.length > 0) parent.addChild(...desired);
}

/** constant-colour silhouette for setTintFill (PIXI tint only multiplies) */
function fillTintFilter(color: number): PIXI.ColorMatrixFilter {
  const f = new PIXI.ColorMatrixFilter();
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  f.matrix = [0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 1, 0];
  return f;
}

export class Game {
  canvas: HTMLCanvasElement;
  /** DOM overlay host above the stage (video dialog, accessibility mirrors); sized to the fitted canvas */
  uiLayer: HTMLDivElement;
  /** Phaser-compatible descriptor filled from the live PIXI renderer: type 2 = GPU (WebGL/WebGPU), 1 = canvas fallback */
  renderer: { type: number; name: RendererName; gl: WebGLRenderingContext | WebGL2RenderingContext | null; pixiVersion: string; pixi: PIXI.Renderer | null };
  /** resolves once PIXI picked and initialised a renderer; rejects when the device has none */
  ready: Promise<void>;
  events = new EventEmitter();
  textures = new Textures.TextureManager();
  anims: AnimationManager;
  sound = new Sound.WebAudioSoundManager();
  cache = { audio: new AudioCache() };
  scale: Scale.ScaleManager;
  scene: SceneManager;
  private stage = new PIXI.Container();
  private layers = new Map<Scene, SceneLayer>();
  private nodeKeys = new WeakMap<PIXI.Container, string | number>();
  private tintFilters = new WeakMap<GameObjects.GameObject, { color: number; filter: PIXI.ColorMatrixFilter }>();
  // shortcut: filters of destroyed objects are left to GC (programs are shared/cached by PIXI); add explicit
  // destroy if profiling shows GPU memory growth on long sessions
  private pixiFilters = new WeakMap<FilterController, { type: string; version: number; filter: PIXI.Filter }>();
  private maxResolution: number;
  private frameIntervalMs: number;
  private rafId = 0;
  private lastTime = 0;
  private draggedObj: GameObjects.GameObject | null = null;
  private hoveredObj: GameObjects.GameObject | null = null;

  constructor(config: GameConfig) {
    const w = config.scale?.width ?? config.width ?? 1920;
    const h = config.scale?.height ?? config.height ?? 1080;
    this.scale = new Scale.ScaleManager(w, h);
    this.anims = new AnimationManager(this.textures);
    this.maxResolution = globalThis.Math.max(0.5, config.render?.resolution ?? 2);
    const target = config.fps?.target ?? 60;
    // a 30 FPS tier renders every other display frame; 60+ follows requestAnimationFrame untouched
    this.frameIntervalMs = target > 0 && target < 55 ? 1000 / target : 0;

    const parentEl =
      typeof config.parent === 'string'
        ? (document.getElementById(config.parent) ?? document.body)
        : (config.parent ?? document.body);

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.display = 'block';
    parentEl.appendChild(this.canvas);

    this.uiLayer = document.createElement('div');
    this.uiLayer.id = 'uomd-ui-layer';
    this.uiLayer.className = 'uomd-ui-layer';
    this.uiLayer.style.cssText =
      'position:fixed;pointer-events:none;overflow:hidden;z-index:2;user-select:none;-webkit-user-select:none;';
    parentEl.appendChild(this.uiLayer);

    this.canvas.addEventListener('webglcontextlost', (ev) => {
      ev.preventDefault();
      this.events.emit(Core.Events.CONTEXT_LOST);
    });

    this.renderer = { type: 0, name: 'pending', gl: null, pixiVersion: PIXI.VERSION, pixi: null };
    this.ready = PIXI.autoDetectRenderer({
      canvas: this.canvas,
      width: w,
      height: h,
      resolution: this.displayResolution(),
      autoDensity: false,
      antialias: config.render?.antialias ?? true,
      roundPixels: config.render?.roundPixels ?? false,
      powerPreference: config.render?.powerPreference === 'low-power' ? 'low-power' : 'high-performance',
      background: 0x05030a,
      // WebGL first: it is the most mature path on Android System WebView; WebGPU and canvas are fallbacks
      preference: ['webgl', 'webgpu', 'canvas']
    }).then(
      (r) => {
        this.renderer.pixi = r;
        this.renderer.name = r.name as RendererName;
        this.renderer.type = r.name === 'canvas' ? CANVAS : WEBGL;
        this.renderer.gl = (r as unknown as { gl?: WebGL2RenderingContext }).gl ?? null;
        this.uiLayer.setAttribute('data-engine', `pixi-${PIXI.VERSION}-${r.name}`);
        this.updateFitLayout();
      },
      (err: unknown) => {
        this.renderer.name = 'failed';
        throw err instanceof Error ? err : new Error(String(err));
      }
    );

    this.updateFitLayout();
    window.addEventListener('resize', () => this.updateFitLayout());

    this.bindInputEvents();
    this.scene = new SceneManager(this, config.scene ?? []);

    if (this.scene.scenes.length > 0) {
      const firstKey = this.scene.scenes[0]!.sys.settings.key;
      this.scene.launchScene(firstKey);
    }

    this.lastTime = performance.now();
    const tick = (now: number): void => {
      this.rafId = requestAnimationFrame(tick);
      if (this.frameIntervalMs > 0 && now - this.lastTime < this.frameIntervalMs - 2) return;
      const dt = Math.Clamp(now - this.lastTime, 1, 2000);
      this.lastTime = now;
      this.step(now, dt);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /** backing-store scale so the 1920×1080 stage maps 1:1 onto device pixels (capped by the quality tier) */
  private displayResolution(): number {
    const vw = window.innerWidth || this.scale.width;
    const vh = window.innerHeight || this.scale.height;
    const cssScale = globalThis.Math.min(vw / this.scale.width, vh / this.scale.height);
    const dpr = window.devicePixelRatio || 1;
    return Math.Clamp(cssScale * dpr, 0.5, this.maxResolution);
  }

  private updateFitLayout(): void {
    const vw = window.innerWidth || this.scale.width;
    const vh = window.innerHeight || this.scale.height;
    const scale = globalThis.Math.min(vw / this.scale.width, vh / this.scale.height);
    const cw = globalThis.Math.round(this.scale.width * scale);
    const ch = globalThis.Math.round(this.scale.height * scale);
    const left = globalThis.Math.round((vw - cw) / 2);
    const top = globalThis.Math.round((vh - ch) / 2);
    this.renderer?.pixi?.resize(this.scale.width, this.scale.height, this.displayResolution());
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.style.marginLeft = `${left}px`;
    this.canvas.style.marginTop = `${top}px`;
    this.uiLayer.style.left = `${left}px`;
    this.uiLayer.style.top = `${top}px`;
    this.uiLayer.style.width = `${cw}px`;
    this.uiLayer.style.height = `${ch}px`;
    this.scale.emit('resize');
  }

  private clientToRef(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.scale.width;
    const h = rect.height || this.scale.height;
    return {
      x: ((clientX - rect.left) * this.scale.width) / w,
      y: ((clientY - rect.top) * this.scale.height) / h
    };
  }

  private collectInteractiveObjects(scene: Scene): GameObjects.GameObject[] {
    const out: GameObjects.GameObject[] = [];
    const visit = (obj: GameObjects.GameObject, inheritedDepth: number): void => {
      if (!obj.active || !obj.visible || obj.alpha <= 0) return;
      const d = obj.parentContainer ? inheritedDepth : obj.depth;
      if (obj.input?.enabled) {
        out.push(obj);
      }
      if (obj instanceof GameObjects.Container) {
        for (const child of obj.list) {
          visit(child, d);
        }
      }
    };
    const sortedRoot = [...scene.children.list].sort((a, b) => a.depth - b.depth);
    for (const root of sortedRoot) {
      visit(root, root.depth);
    }
    return out;
  }

  private hitTestObject(obj: GameObjects.GameObject, refX: number, refY: number, cam: Cameras.Scene2D.Camera): boolean {
    const wt = obj.getWorldTransform();
    if (!wt.visible || wt.alpha <= 0) return false;
    const testX = refX + cam.scrollX * wt.scrollFactorX;
    const testY = refY + cam.scrollY * wt.scrollFactorY;

    if (obj.input?.hitArea) {
      const localX = (testX - wt.x) / (wt.scaleX || 1);
      const localY = (testY - wt.y) / (wt.scaleY || 1);
      if (obj.input.hitAreaCallback) {
        return obj.input.hitAreaCallback(obj.input.hitArea, localX, localY);
      }
      if (obj.input.hitArea instanceof Geom.Rectangle) {
        return obj.input.hitArea.contains(localX, localY);
      }
      if (obj.input.hitArea instanceof Geom.Circle) {
        return obj.input.hitArea.contains(localX, localY);
      }
    }

    const b = obj.getBounds();
    return testX >= b.x && testX <= b.x + b.width && testY >= b.y && testY <= b.y + b.height;
  }

  private bindInputEvents(): void {
    const getPointer = (ev: PointerEvent | MouseEvent | WheelEvent, isDown: boolean): Input.Pointer => {
      const { x, y } = this.clientToRef(ev.clientX, ev.clientY);
      return { x, y, worldX: x, worldY: y, isDown, id: 1 };
    };

    this.canvas.addEventListener('pointerdown', (ev) => {
      const ptr = getPointer(ev, true);
      const activeScenes = [...this.scene.getScenes(true)].reverse();
      for (const sc of activeScenes) {
        sc.input.activePointer = {
          ...ptr,
          worldX: ptr.x + sc.cameras.main.scrollX,
          worldY: ptr.y + sc.cameras.main.scrollY
        };
        sc.input.emit('pointerdown', sc.input.activePointer);
      }
      for (const sc of activeScenes) {
        const list = this.collectInteractiveObjects(sc);
        for (let i = list.length - 1; i >= 0; i--) {
          const obj = list[i]!;
          if (this.hitTestObject(obj, ptr.x, ptr.y, sc.cameras.main)) {
            obj.emit('pointerdown', sc.input.activePointer, ptr.x, ptr.y);
            if (obj.input?.draggable) {
              this.draggedObj = obj;
            }
            return;
          }
        }
      }
    });

    window.addEventListener('pointermove', (ev) => {
      const isDown = (ev.buttons & 1) === 1;
      const ptr = getPointer(ev, isDown);
      const activeScenes = [...this.scene.getScenes(true)].reverse();
      for (const sc of activeScenes) {
        sc.input.activePointer = {
          ...ptr,
          worldX: ptr.x + sc.cameras.main.scrollX,
          worldY: ptr.y + sc.cameras.main.scrollY
        };
        sc.input.emit('pointermove', sc.input.activePointer);
      }
      if (this.draggedObj && isDown) {
        const sc = this.draggedObj.scene;
        const wx = ptr.x + sc.cameras.main.scrollX * this.draggedObj.scrollFactorX;
        const wy = ptr.y + sc.cameras.main.scrollY * this.draggedObj.scrollFactorY;
        sc.input.emit('drag', sc.input.activePointer, this.draggedObj, wx, wy);
      }
      let nextHover: GameObjects.GameObject | null = null;
      for (const sc of activeScenes) {
        const list = this.collectInteractiveObjects(sc);
        for (let i = list.length - 1; i >= 0; i--) {
          const obj = list[i]!;
          if (this.hitTestObject(obj, ptr.x, ptr.y, sc.cameras.main)) {
            nextHover = obj;
            break;
          }
        }
        if (nextHover) break;
      }
      if (this.hoveredObj !== nextHover) {
        if (this.hoveredObj?.active) {
          this.hoveredObj.emit('pointerout', ptr);
        }
        this.hoveredObj = nextHover;
        if (this.hoveredObj?.active) {
          this.hoveredObj.emit('pointerover', ptr);
          this.canvas.style.cursor = this.hoveredObj.input?.cursor ?? 'default';
        } else {
          this.canvas.style.cursor = 'default';
        }
      }
    });

    window.addEventListener('pointerup', (ev) => {
      if (ev.target !== this.canvas && !(ev.target instanceof HTMLElement && this.canvas.contains(ev.target))) {
        if (this.draggedObj) {
          const sc = this.draggedObj.scene;
          const ptr = getPointer(ev, false);
          sc.input.emit('dragend', ptr, this.draggedObj);
          this.draggedObj = null;
        }
        return;
      }
      const ptr = getPointer(ev, false);
      const activeScenes = [...this.scene.getScenes(true)].reverse();
      for (const sc of activeScenes) {
        sc.input.activePointer = {
          ...ptr,
          worldX: ptr.x + sc.cameras.main.scrollX,
          worldY: ptr.y + sc.cameras.main.scrollY
        };
        sc.input.emit('pointerup', sc.input.activePointer);
      }
      if (this.draggedObj) {
        const sc = this.draggedObj.scene;
        sc.input.emit('dragend', sc.input.activePointer, this.draggedObj);
        this.draggedObj = null;
      }
      for (const sc of activeScenes) {
        const list = this.collectInteractiveObjects(sc);
        for (let i = list.length - 1; i >= 0; i--) {
          const obj = list[i]!;
          if (this.hitTestObject(obj, ptr.x, ptr.y, sc.cameras.main)) {
            obj.emit('pointerup', sc.input.activePointer, ptr.x, ptr.y);
            return;
          }
        }
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (ev) => {
        const ptr = getPointer(ev, false);
        const activeScenes = [...this.scene.getScenes(true)].reverse();
        for (const sc of activeScenes) {
          sc.input.emit('wheel', ptr, [], ev.deltaX, ev.deltaY, ev.deltaZ);
        }
      },
      { passive: true }
    );

    window.addEventListener('keydown', (ev) => {
      const keyUpper = ev.key === ' ' ? 'SPACE' : ev.key.toUpperCase();
      const codeName = ev.code.startsWith('Key')
        ? ev.code.slice(3).toUpperCase()
        : ev.code.startsWith('Digit')
          ? ev.code.slice(5).toUpperCase()
          : ev.code.toUpperCase();
      for (const sc of this.scene.getScenes(true)) {
        sc.input.keyboard.emit('keydown', ev);
        sc.input.keyboard.emit(`keydown-${codeName}`, ev);
        if (keyUpper !== codeName) {
          sc.input.keyboard.emit(`keydown-${keyUpper}`, ev);
        }
      }
    });
  }

  private step(now: number, dt: number): void {
    this.events.emit(Core.Events.STEP, now, dt);
    const active = this.scene.getScenes(true);
    for (const sc of active) {
      sc.time.step(dt);
      sc.tweens.step(dt);
      for (const child of sc.children.list) {
        if (child instanceof GameObjects.Particles.ParticleEmitter) {
          child.step(dt);
        }
      }
      try {
        (sc as unknown as { update?: (t: number, d: number) => void }).update?.(now, dt);
      } catch (err) {
        console.error(`Error in ${sc.sys.settings.key}.update:`, err);
      }
    }
    this.events.emit(Core.Events.PRE_RENDER);
    const r = this.renderer.pixi;
    if (r) {
      this.syncStage(active);
      r.render(this.stage);
    }
    this.events.emit(Core.Events.POST_RENDER);
  }

  // ------------------------------------------------------------------ retained PIXI stage sync

  private layerFor(sc: Scene): SceneLayer {
    let l = this.layers.get(sc);
    if (!l) {
      l = { root: new PIXI.Container(), bg: new PIXI.Graphics(), vignette: new PIXI.Graphics(), flash: new PIXI.Graphics(), fade: new PIXI.Graphics(), bgKey: '', vignetteKey: '' };
      const W = this.scale.width;
      const H = this.scale.height;
      // flash/fade are white quads recoloured through tint, so they never re-tessellate
      l.flash.rect(0, 0, W, H).fill(0xffffff);
      l.fade.rect(0, 0, W, H).fill(0xffffff);
      this.layers.set(sc, l);
    }
    return l;
  }

  private syncStage(active: Scene[]): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const roots: PIXI.Container[] = [];
    for (let i = 0; i < active.length; i++) {
      const sc = active[i]!;
      const l = this.layerFor(sc);
      roots.push(l.root);
      const cam = sc.cameras.main;

      // every scene but the PatchBar overlay paints its camera background (an opaque screen, as before)
      const paintBg = i === 0 || sc.sys.settings.key !== 'PatchBar';
      l.bg.visible = paintBg;
      const bgKey = `${cam.backgroundColor}`;
      if (paintBg && l.bgKey !== bgKey) {
        l.bg.clear().rect(0, 0, W, H).fill(cam.backgroundColor);
        l.bgKey = bgKey;
      }

      const kids: PIXI.Container[] = [l.bg];
      const sorted = sc.children.list.map((item, idx) => ({ item, idx })).sort((a, b) => a.item.depth - b.item.depth || a.idx - b.idx);
      for (const { item } of sorted) {
        const wrap = this.syncRoot(item, cam);
        if (wrap) kids.push(wrap);
      }

      const vig = cam.filters.external.list.find((f) => f.type === 'Vignette' && f.active);
      l.vignette.visible = Boolean(vig);
      if (vig) {
        const key = `${vig.radius}|${vig.strength}`;
        if (l.vignetteKey !== key) {
          const gradient = new PIXI.FillGradient({
            type: 'radial',
            center: { x: 0.5, y: 0.5 },
            innerRadius: Math.Clamp(vig.radius * 0.6, 0, 1) * 0.5,
            outerCenter: { x: 0.5, y: 0.5 },
            outerRadius: 0.75,
            textureSpace: 'local',
            colorStops: [
              { offset: 0, color: 'rgba(0,0,0,0)' },
              { offset: 1, color: `rgba(0,0,0,${Math.Clamp(vig.strength * 1.25, 0, 1)})` }
            ]
          });
          l.vignette.clear().rect(0, 0, W, H).fill(gradient);
          l.vignetteKey = key;
        }
        kids.push(l.vignette);
      }

      l.flash.visible = cam.flashEffect.isRunning && cam.flashEffect.alpha > 0;
      if (l.flash.visible) {
        l.flash.tint = Display.Color.GetColor(cam.flashEffect.r, cam.flashEffect.g, cam.flashEffect.b);
        l.flash.alpha = Math.Clamp(cam.flashEffect.alpha, 0, 1);
      }
      l.fade.visible = cam.fadeEffect.isRunning || cam.fadeEffect.alpha > 0;
      if (l.fade.visible) {
        l.fade.tint = Display.Color.GetColor(cam.fadeEffect.r, cam.fadeEffect.g, cam.fadeEffect.b);
        l.fade.alpha = Math.Clamp(cam.fadeEffect.alpha, 0, 1);
      }
      kids.push(l.flash, l.fade);
      setChildren(l.root, kids);
    }
    setChildren(this.stage, roots);
    for (const [sc, l] of this.layers) {
      if (!sc.sys.settings.active) {
        l.root.destroy({ children: false });
        l.bg.destroy();
        l.vignette.destroy();
        l.flash.destroy();
        l.fade.destroy();
        this.layers.delete(sc);
      }
    }
  }

  /** a scene-root object sits in a wrapper that carries the camera scroll/zoom/shake for its scroll factor */
  private syncRoot(obj: GameObjects.GameObject, cam: Cameras.Scene2D.Camera): PIXI.Container | null {
    if (!obj.active || (!obj.visible && !obj._pxWrap)) return null;
    const wrap = (obj._pxWrap ??= new PIXI.Container());
    wrap.visible = obj.visible;
    if (!obj.visible) return wrap;
    const sx = (cam.scrollX - cam.shakeEffect.offsetX) * obj.scrollFactorX;
    const sy = (cam.scrollY - cam.shakeEffect.offsetY) * obj.scrollFactorY;
    if (cam.zoom !== 1 && obj.scrollFactorX !== 0) {
      wrap.position.set(cam.width / 2, cam.height / 2);
      wrap.scale.set(cam.zoom);
      wrap.pivot.set(cam.width / 2 + sx, cam.height / 2 + sy);
    } else {
      wrap.position.set(0, 0);
      wrap.scale.set(1);
      wrap.pivot.set(sx, sy);
    }
    this.syncChildren(wrap, [obj]);
    return wrap;
  }

  /** syncs objects into parent in list order; a rectangle mask becomes a sibling node in the same space */
  private syncChildren(parent: PIXI.Container, objs: readonly GameObjects.GameObject[]): void {
    const out: PIXI.Container[] = [];
    for (const obj of objs) {
      const node = this.syncObject(obj);
      if (!node) continue;
      const m = obj.maskObj;
      if (m && !obj.invertMask && m instanceof GameObjects.Shape) {
        const g = (obj._pxMask ??= new PIXI.Graphics());
        const mw = m.width * m.scaleX;
        const mh = m.height * m.scaleY;
        const key = `${m.x}|${m.y}|${mw}|${mh}|${m.originX}|${m.originY}`;
        if (this.nodeKeys.get(g) !== key) {
          g.clear().rect(m.x - mw * m.originX, m.y - mh * m.originY, mw, mh).fill(0xffffff);
          this.nodeKeys.set(g, key);
        }
        if (node.mask !== g) node.mask = g;
        out.push(g);
      } else if (node.mask) {
        node.mask = null;
      }
      out.push(node);
    }
    setChildren(parent, out);
  }

  private createNode(obj: GameObjects.GameObject): PIXI.Container {
    if (obj instanceof GameObjects.Image) return new PIXI.Sprite(PIXI.Texture.EMPTY);
    if (obj instanceof GameObjects.Text) return new PIXI.Text({ text: '' });
    if (obj instanceof GameObjects.Graphics || obj instanceof GameObjects.Rectangle || obj instanceof GameObjects.Ellipse || obj instanceof GameObjects.Arc) return new PIXI.Graphics();
    return new PIXI.Container();
  }

  private syncObject(obj: GameObjects.GameObject): PIXI.Container | null {
    if (!obj.active || (!obj.visible && !obj._px)) return null;
    const node = (obj._px ??= this.createNode(obj));
    node.visible = obj.visible && obj.alpha > 0;
    if (!node.visible) return node;
    node.alpha = Math.Clamp(obj.alpha, 0, 1);
    node.position.set(obj.x, obj.y);
    node.rotation = obj.rotation;
    node.scale.set(obj.scaleX, obj.scaleY);
    node.blendMode = pixiBlend(obj.blendMode);
    const effects = this.filtersFor([...obj.filters.internal.list, ...obj.filters.external.list]);

    if (obj instanceof GameObjects.Container) {
      this.syncChildren(node, obj.list);
    } else if (obj instanceof GameObjects.Image) {
      this.syncSprite(obj, node as PIXI.Sprite);
    } else if (obj instanceof GameObjects.Text) {
      this.syncText(obj, node as PIXI.Text);
    } else if (obj instanceof GameObjects.Graphics) {
      if (this.nodeKeys.get(node) !== obj.version) {
        GameObjects.drawOpsToPixi(node as PIXI.Graphics, obj.ops);
        this.nodeKeys.set(node, obj.version);
      }
    } else if (obj instanceof GameObjects.Rectangle || obj instanceof GameObjects.Ellipse || obj instanceof GameObjects.Arc) {
      this.syncShape(obj, node as PIXI.Graphics);
    } else if (obj instanceof GameObjects.Particles.ParticleEmitter) {
      this.syncParticles(obj, node);
    }
    const tintFill = obj instanceof GameObjects.Image ? this.tintFillFilter(obj) : null;
    const wanted = tintFill ? [...effects, tintFill] : effects;
    const current = node.filters ?? [];
    if (wanted.length !== current.length || wanted.some((f, i) => current[i] !== f)) node.filters = wanted.length ? wanted : null;
    return node;
  }

  /** ColorMatrix / Blur / Glow controllers → live PIXI filters (masks and the camera vignette are handled elsewhere) */
  private filtersFor(list: readonly FilterController[]): PIXI.Filter[] {
    const out: PIXI.Filter[] = [];
    for (const f of list) {
      if (!f.active || (f.type !== 'ColorMatrix' && f.type !== 'Blur' && f.type !== 'Glow')) continue;
      let e = this.pixiFilters.get(f);
      if (!e || e.type !== f.type) {
        const filter = f.type === 'ColorMatrix' ? new PIXI.ColorMatrixFilter() : f.type === 'Blur' ? new PIXI.BlurFilter() : new GlowFilter({ quality: 0.2 });
        e = { type: f.type, version: -1, filter };
        this.pixiFilters.set(f, e);
      }
      if (e.filter instanceof PIXI.ColorMatrixFilter && e.version !== f.version) {
        const cm = e.filter;
        cm.reset();
        for (const op of f.ops) {
          switch (op[0]) {
            case 'setValues':
              cm.matrix = op[1] as PIXI.ColorMatrix;
              break;
            case 'sepia':
            case 'lsd':
              cm[op[0]](op[1]);
              break;
            default:
              cm[op[0]](op[1], op[2]);
          }
        }
        e.version = f.version;
      } else if (e.filter instanceof PIXI.BlurFilter) {
        e.filter.strength = f.strength;
      } else if (e.filter instanceof GlowFilter) {
        e.filter.outerStrength = f.strength;
        e.filter.color = f.color;
      }
      out.push(e.filter);
    }
    return out;
  }

  private syncSprite(obj: GameObjects.Image, s: PIXI.Sprite): void {
    const tex = obj.texture.pixiFrame(obj.frame) ?? PIXI.Texture.EMPTY;
    if (s.texture !== tex) s.texture = tex;
    s.anchor.set(obj.originX, obj.originY);
    s.scale.set(obj.scaleX * (obj.flipX ? -1 : 1), obj.scaleY * (obj.flipY ? -1 : 1));
    s.tint = obj.tintFill ? 0xffffff : obj.tintTopLeft;
  }

  private tintFillFilter(obj: GameObjects.Image): PIXI.ColorMatrixFilter | null {
    if (!obj.tintFill) return null;
    let entry = this.tintFilters.get(obj);
    if (!entry || entry.color !== obj.tintTopLeft) {
      entry?.filter.destroy();
      entry = { color: obj.tintTopLeft, filter: fillTintFilter(obj.tintTopLeft) };
      this.tintFilters.set(obj, entry);
    }
    return entry.filter;
  }

  private syncText(obj: GameObjects.Text, t: PIXI.Text): void {
    const st = obj.style;
    const fontPx = obj.getFontSizePx();
    const stroke = st.strokeThickness > 0 ? st.strokeThickness : 0;
    const sh = obj.shadow;
    const hasShadow = sh && (sh.blur > 0 || sh.x !== 0 || sh.y !== 0);
    const key = [st.fontFamily, fontPx, st.fontStyle, st.color, stroke, st.stroke, st.align, obj.letterSpacing, obj.lineSpacing, hasShadow ? `${sh.x},${sh.y},${sh.color},${sh.blur}` : ''].join('|');
    if (this.nodeKeys.get(t) !== key) {
      const { fontStyle, fontWeight } = parseFontStyle(st.fontStyle);
      t.style = new PIXI.TextStyle({
        fontFamily: st.fontFamily,
        fontSize: fontPx,
        fontStyle,
        fontWeight,
        fill: st.color,
        align: (st.align === 'center' || st.align === 'right' ? st.align : 'left') as 'left' | 'center' | 'right',
        letterSpacing: obj.letterSpacing,
        lineHeight: fontPx * 1.2 + obj.lineSpacing,
        ...(stroke > 0 ? { stroke: { color: st.stroke, width: stroke, join: 'round' as const } } : {}),
        ...(hasShadow ? { dropShadow: { color: sh.color, blur: sh.blur, distance: globalThis.Math.hypot(sh.x, sh.y), angle: globalThis.Math.atan2(sh.y, sh.x), alpha: 1 } } : {})
      });
      this.nodeKeys.set(t, key);
    }
    // the shim wraps and measures (layout code reads obj.width/height); PIXI only rasterises the result
    const text = obj.text ? obj.getWrappedLines().join('\n') : '';
    if (t.text !== text) t.text = text;
    t.pivot.set(obj.width * obj.originX - obj.padding.left + stroke / 2, obj.height * obj.originY - obj.padding.top + stroke / 2);
  }

  private syncShape(obj: GameObjects.Rectangle | GameObjects.Ellipse | GameObjects.Arc, g: PIXI.Graphics): void {
    const key = [obj.type, obj.width, obj.height, obj instanceof GameObjects.Arc ? obj.radius : 0, obj.originX, obj.originY, obj.isFilled, obj.fillColor, obj.fillAlpha, obj.isStroked, obj.lineWidth, obj.strokeColor, obj.strokeAlpha].join('|');
    if (this.nodeKeys.get(g) === key) return;
    this.nodeKeys.set(g, key);
    const fill = obj.isFilled ? { color: obj.fillColor, alpha: obj.fillAlpha } : undefined;
    const line = obj.isStroked && obj.lineWidth > 0 ? { width: obj.lineWidth, color: obj.strokeColor, alpha: obj.strokeAlpha } : undefined;
    // ellipses and arcs stay centred on their position (the previous renderer ignored their origin)
    const op: GameObjects.DrawOp =
      obj instanceof GameObjects.Rectangle
        ? { k: 'rect', x: -obj.width * obj.originX, y: -obj.height * obj.originY, w: obj.width, h: obj.height, r: 0, fill, line }
        : obj instanceof GameObjects.Arc
          ? { k: 'circle', x: 0, y: 0, r: obj.radius, fill, line }
          : { k: 'ellipse', x: 0, y: 0, rx: obj.width / 2, ry: obj.height / 2, fill, line };
    GameObjects.drawOpsToPixi(g, [op]);
  }

  private syncParticles(obj: GameObjects.Particles.ParticleEmitter, node: PIXI.Container): void {
    const tex = obj.scene.textures.get(obj.textureKey);
    const base = tex.pixiFrame(tex.get()) ?? PIXI.Texture.WHITE;
    const pool = node.children as PIXI.Sprite[];
    while (pool.length < obj.particles.length) {
      const s = new PIXI.Sprite(base);
      s.anchor.set(0.5);
      node.addChild(s);
    }
    while (pool.length > obj.particles.length) pool[pool.length - 1]!.destroy();
    for (let i = 0; i < obj.particles.length; i++) {
      const p = obj.particles[i]!;
      const s = pool[i]!;
      const t = Math.Clamp(p.age / p.life, 0, 1);
      const a = p.alphaStart + (p.alphaEnd - p.alphaStart) * t;
      const sc = p.scaleStart + (p.scaleEnd - p.scaleStart) * t;
      if (s.texture !== base) s.texture = base;
      s.visible = a > 0 && sc > 0;
      s.position.set(p.x, p.y);
      s.scale.set(sc);
      s.alpha = Math.Clamp(a, 0, 1);
      s.tint = p.tint;
    }
  }

  destroy(removeCanvas = false): void {
    cancelAnimationFrame(this.rafId);
    this.renderer.pixi?.destroy({ removeView: removeCanvas });
    this.renderer.pixi = null;
    if (removeCanvas) {
      this.canvas.remove();
      this.uiLayer.remove();
    }
  }
}

export const VERSION = `PixiJS-${PIXI.VERSION}`;
export const PIXI_VERSION = PIXI.VERSION;
export const AUTO = 2;
export const WEBGL = 2;
export const CANVAS = 1;
}

export default Phaser;
