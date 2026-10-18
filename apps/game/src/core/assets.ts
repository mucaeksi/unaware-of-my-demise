import * as PIXI from 'pixi.js';

/**
 * Loaded images (as PIXI textures, with named atlas frames) and decoded audio, keyed by the content-hash keys the
 * content service hands out. Nothing goes through PIXI's global cache, so removing a key frees its GPU memory.
 */

interface ImageEntry {
  source: PIXI.TextureSource;
  base: PIXI.Texture;
  frames: Map<string, PIXI.Texture>;
}

const images = new Map<string, ImageEntry>();
const sounds = new Map<string, AudioBuffer>();
const inflight = new Map<string, Promise<void>>();

function silentContext(): AudioContext {
  // without Web Audio (old WebViews, tests) music and effects are skipped; calls stay harmless
  const gain = { gain: { value: 1, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined, setTargetAtTime: () => undefined, cancelScheduledValues: () => undefined }, connect: () => undefined, disconnect: () => undefined };
  return { state: 'running', currentTime: 0, destination: {}, resume: async () => undefined, suspend: async () => undefined, createGain: () => gain, decodeAudioData: async () => { throw new Error('no Web Audio'); } } as unknown as AudioContext;
}

function makeContext(): AudioContext {
  const Ctx = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  try {
    return Ctx ? new Ctx() : silentContext();
  } catch {
    return silentContext();
  }
}

/** the one Web Audio graph: music and effects connect to `master` */
export const audio = (() => {
  const context = makeContext();
  const master = context.createGain();
  try {
    master.connect(context.destination);
  } catch {
    /* silent context */
  }
  let muted = false;
  if (typeof window !== 'undefined') {
    // browsers start audio suspended until a gesture
    const unlock = (): void => {
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }
  return {
    context,
    master,
    get mute(): boolean {
      return muted;
    },
    set mute(v: boolean) {
      muted = v;
      master.gain.value = v ? 0 : 1;
    }
  };
})();

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed to load: ${url.slice(0, 80)}`));
    img.src = url;
  });
}

function once(key: string, work: () => Promise<void>): Promise<void> {
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = work().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export const Assets = {
  hasImage(key: string): boolean {
    return images.has(key);
  },

  /** loads an image under `key` (a no-op when it is loaded; concurrent calls share one load) */
  loadImage(key: string, url: string): Promise<void> {
    if (images.has(key)) return Promise.resolve();
    return once(`img:${key}`, async () => {
      const img = await loadImageElement(url);
      const source = new PIXI.ImageSource({ resource: img });
      images.set(key, { source, base: new PIXI.Texture({ source }), frames: new Map() });
    });
  },

  /** names a sub-rectangle of a loaded image (atlas frames) */
  addFrame(key: string, name: string, x: number, y: number, w: number, h: number): void {
    const e = images.get(key);
    if (!e || e.frames.has(name)) return;
    const sw = e.source.width;
    const sh = e.source.height;
    const fx = Math.min(Math.max(0, x), sw - 1);
    const fy = Math.min(Math.max(0, y), sh - 1);
    e.frames.set(name, new PIXI.Texture({ source: e.source, frame: new PIXI.Rectangle(fx, fy, Math.min(w, sw - fx), Math.min(h, sh - fy)) }));
  },

  /** a loaded image or one of its frames; EMPTY when missing (draws nothing) */
  texture(key: string, frame?: string | number): PIXI.Texture {
    const e = images.get(key);
    if (!e) return PIXI.Texture.EMPTY;
    if (frame === undefined) return e.base;
    return e.frames.get(String(frame)) ?? e.base;
  },

  removeImage(key: string): void {
    const e = images.get(key);
    if (!e) return;
    images.delete(key);
    for (const t of e.frames.values()) t.destroy(false);
    e.base.destroy(true);
  },

  hasAudio(key: string): boolean {
    return sounds.has(key);
  },

  /** fetches and decodes audio under `key` */
  loadAudio(key: string, url: string): Promise<void> {
    if (sounds.has(key)) return Promise.resolve();
    return once(`snd:${key}`, async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sounds.set(key, await audio.context.decodeAudioData(await res.arrayBuffer()));
    });
  },

  audio(key: string): AudioBuffer | undefined {
    return sounds.get(key);
  },

  removeAudio(key: string): void {
    sounds.delete(key);
  }
};
