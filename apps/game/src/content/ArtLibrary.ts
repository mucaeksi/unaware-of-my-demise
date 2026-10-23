import { Assets } from '../core/assets';
import type { PixiScene } from '../core/PixiScene';
import type { ArtManifest, UnitAnimState } from '@uomd/content-schema';
import type { ContentService } from './ContentService';

interface Queued {
  type: 'image' | 'audio';
  key: string;
  url: string;
}

export interface UnitAnimation {
  frames: readonly string[];
  fps: number;
  loop: boolean;
}

export interface UnitState {
  frame: string;
  scale: number;
  footY: number;
  pivotX: number;
  animation?: UnitAnimation;
}

export interface UnitFrames {
  textureKey: string;
  facing: 'left' | 'right';
  heightPx: number;
  states: Record<string, UnitState>;
}

/**
 * Resolves art-manifest entries to loaded textures and audio, loading only what a screen needs and only once. Each
 * load is owned by the scene that asked for it and released when that scene closes. Keys embed the content hash (see
 * ContentService.asset), so patched art never reuses a stale texture.
 */
export class ArtLibrary {
  private readonly unitCache = new Map<string, UnitFrames>();
  private readonly portraitKeys = new Map<string, string>();
  private readonly bgKeys = new Map<string, string>();
  private readonly musicKeys = new Map<string, { key: string; loopStart: number; duration: number }>();
  private readonly uiKeys = new Map<string, string>();
  private readonly stillKeys = new Map<string, string>();

  constructor(private readonly content: ContentService, readonly art: ArtManifest) {}

  private async asset(scene: PixiScene<unknown>, path: string, decodedBytes = 0) {
    this.content.watchAssetOwner(scene, (release) => scene.onClose(release));
    const ref = await this.content.asset(path, scene, decodedBytes);
    if (!scene.live) {
      this.content.releaseAssets(scene);
      throw new Error('scene closed while loading media');
    }
    return ref;
  }

  private async run(scene: PixiScene<unknown>, queue: Queued[]): Promise<void> {
    for (const item of queue)
      this.content.retainAsset(item.key, scene, () => (item.type === 'image' ? Assets.removeImage(item.key) : Assets.removeAudio(item.key)));
    const seen = new Set<string>();
    const loads = queue.flatMap((q) => {
      if (seen.has(q.key)) return [];
      seen.add(q.key);
      return [q.type === 'image' ? Assets.loadImage(q.key, q.url) : Assets.loadAudio(q.key, q.url)];
    });
    try {
      await Promise.all(loads);
    } catch (e) {
      throw new Error(`failed to load media: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
    if (!scene.live) throw new Error('scene closed while loading media');
  }

  async loadUnits(scene: PixiScene<unknown>, artKeys: readonly string[]): Promise<void> {
    const queue: Queued[] = [];
    const want = [...new Set(artKeys)];
    for (const k of want) {
      const u = this.art.units[k];
      const atlas = u && this.art.atlases[u.atlas];
      if (!u || !atlas) throw new Error(`no art for unit ${k}`);
      const ref = await this.asset(scene,atlas.image);
      if (ref.width !== atlas.width || ref.height !== atlas.height) throw new Error('atlas dimensions differ from the art manifest');
      queue.push({ type: 'image', key: ref.key, url: ref.url });
    }
    await this.run(scene, queue);
    for (const k of want) {
      const u = this.art.units[k];
      const atlas = u && this.art.atlases[u.atlas];
      if (!u || !atlas) continue;
      const ref = await this.asset(scene,atlas.image);
      for (const [name, [x, y, w, h]] of Object.entries(atlas.frames)) Assets.addFrame(ref.key, name, x, y, w, h);
      const states: UnitFrames['states'] = {};
      for (const [st, s] of Object.entries(u.states)) {
        states[st] = { frame: s.frame, scale: s.scale, footY: s.foot_y, pivotX: s.pivot_x, ...(s.animation ? { animation: { frames: s.animation.frames, fps: s.animation.fps, loop: s.animation.loop } } : {}) };
      }
      this.unitCache.set(k, { textureKey: ref.key, facing: u.facing, heightPx: u.height_px, states });
    }
  }

  unit(artKey: string): UnitFrames {
    const u = this.unitCache.get(artKey);
    if (!u) throw new Error(`unit art ${artKey} not loaded`);
    return u;
  }

  frameFor(artKey: string, state: UnitAnimState): UnitState & { key: string } {
    const u = this.unit(artKey);
    const s = u.states[state] ?? u.states.idle;
    if (!s) throw new Error(`unit ${artKey} has no idle state`);
    return { key: u.textureKey, ...s };
  }

  async loadPortraits(scene: PixiScene<unknown>, characters: readonly string[], emotions?: ReadonlyMap<string, ReadonlySet<string>>): Promise<void> {
    const queue: Queued[] = [];
    for (const c of characters) {
      const p = this.art.portraits[c];
      if (!p) continue;
      const wanted = emotions?.get(c);
      const allowedImages = wanted
        ? new Set([...wanted, 'composed'].map((e) => p.emotions[e]).filter((img): img is string => Boolean(img)))
        : null;
      for (const [img, path] of Object.entries(p.images)) {
        if (allowedImages && allowedImages.size > 0 && !allowedImages.has(img)) continue;
        const ref = await this.asset(scene,path);
        this.portraitKeys.set(`${c}/${img}`, ref.key);
        queue.push({ type: 'image', key: ref.key, url: ref.url });
      }
    }
    await this.run(scene, queue);
  }

  portrait(character: string, emotion?: string): string | null {
    const p = this.art.portraits[character];
    if (!p) return null;
    const img = (emotion && p.emotions[emotion]) || p.emotions.composed || Object.keys(p.images)[0];
    return img ? (this.portraitKeys.get(`${character}/${img}`) ?? null) : null;
  }

  async loadBackground(scene: PixiScene<unknown>, location: string): Promise<void> {
    const path = this.art.backgrounds[location];
    if (!path) throw new Error(`no background for ${location}`);
    const ref = await this.asset(scene,path);
    this.bgKeys.set(location, ref.key);
    await this.run(scene, [{ type: 'image', key: ref.key, url: ref.url }]);
  }

  background(location: string): string {
    const k = this.bgKeys.get(location);
    if (!k) throw new Error(`background ${location} not loaded`);
    return k;
  }

  async loadMusic(scene: PixiScene<unknown>, cue: string): Promise<void> {
    const m = this.art.music[cue];
    if (!m) return;
    const ref = await this.asset(scene,m.file, Math.ceil(m.duration_s * 48_000 * 2 * 4));
    this.musicKeys.set(cue, { key: ref.key, loopStart: m.loop_start_s, duration: m.duration_s });
    await this.run(scene, [{ type: 'audio', key: ref.key, url: ref.url }]);
    const buffer = Assets.audio(ref.key);
    if (buffer) {
      try {
        if (buffer.duration > m.duration_s + 0.5 || buffer.numberOfChannels > 2 || buffer.sampleRate > 96_000) throw new Error('Music decoding differs from its declared resource budget');
        this.content.accountDecodedAsset(ref.key, buffer.length * buffer.numberOfChannels * 4);
      } catch (error) {
        Assets.removeAudio(ref.key);
        throw error;
      }
    }
  }

  music(cue: string): { key: string; loopStart: number; duration: number } | null {
    return this.musicKeys.get(cue) ?? null;
  }

  /**
   * The art library is rebuilt after every content patch (new instance, empty key maps), and a patch can land while the splash and studio
   * cards are still playing. Menu-level scenes therefore call this first: it (re)loads the boot images and the title backdrop for THIS library
   * (textures that already exist are skipped), so a scene never meets an art library that has not loaded what it draws.
   */
  async ensureBoot(scene: PixiScene<unknown>): Promise<void> {
    await this.loadUi(scene);
    await this.loadBackground(scene, 'forest_whispering_ash');
  }

  async loadUi(scene: PixiScene<unknown>): Promise<void> {
    const entries = Object.entries(this.art.ui).filter(([name]) => !name.startsWith('banner_'));
    const refs = await Promise.all(entries.map(async ([name, path]) => ({ name, ref: await this.asset(scene, path) })));
    const queue: Queued[] = refs.map(({ name, ref }) => {
      this.uiKeys.set(name, ref.key);
      return { type: 'image', key: ref.key, url: ref.url };
    });
    await this.run(scene, queue);
  }

  /** Resolves the key-art URL of a banner on demand without loading all banner plates during boot. */
  async bannerUrl(scene: PixiScene<unknown>, artKey?: string | null, bannerId?: string): Promise<string | null> {
    const candidates = [artKey, bannerId ? `banner_${bannerId}` : null].filter((k): k is string => Boolean(k));
    for (const key of candidates) {
      const path = this.art.ui[key];
      if (!path) continue;
      const ref = await this.asset(scene, path);
      return ref.url;
    }
    return null;
  }

  /** Loads full-frame stills (prologue plates, event illustrations) on demand; ids the manifest does not ship are skipped without error. */
  async loadStills(scene: PixiScene<unknown>, ids: readonly string[]): Promise<void> {
    const valid = ids.flatMap((id) => {
      const path = this.art.stills[id];
      return path ? [{ id, path }] : [];
    });
    const refs = await Promise.all(valid.map(async ({ id, path }) => ({ id, ref: await this.asset(scene, path) })));
    const queue: Queued[] = refs.map(({ id, ref }) => {
      this.stillKeys.set(id, ref.key);
      return { type: 'image', key: ref.key, url: ref.url };
    });
    await this.run(scene, queue);
  }

  /** Texture key of a loaded still, or null when the content does not ship it (callers fall back to a stand-in). */
  still(id: string): string | null {
    return this.stillKeys.get(id) ?? null;
  }

  /** The art-manifest ids a prologue scene may use, most specific first. */
  static plateIds(sceneId: string, visual: string): string[] {
    return [`prologue_${sceneId}`, `prologue_${visual}`];
  }

  ui(name: string): string | null {
    return this.uiKeys.get(name) ?? null;
  }
}
