import type Phaser from 'phaser';
import type { ArtManifest, UnitAnimState } from '@uomd/content-schema';
import type { ContentService } from './ContentService';

interface Queued {
  type: 'image' | 'audio';
  key: string;
  url: string;
}

export interface UnitFrames {
  textureKey: string;
  facing: 'left' | 'right';
  heightPx: number;
  states: Record<string, { frame: string; scale: number; footY: number; pivotX: number; animationKey?: string }>;
}

/**
 * Resolves art-manifest entries to Phaser textures, loading only what a screen needs and only once.
 * Keys embed the content hash (see ContentService.asset), so patched art never reuses a stale texture.
 */
export class ArtLibrary {
  private readonly unitCache = new Map<string, UnitFrames>();
  private readonly portraitKeys = new Map<string, string>();
  private readonly bgKeys = new Map<string, string>();
  private readonly musicKeys = new Map<string, { key: string; loopStart: number; duration: number }>();
  private readonly uiKeys = new Map<string, string>();
  private readonly stillKeys = new Map<string, string>();

  constructor(private readonly content: ContentService, readonly art: ArtManifest) {}

  private async asset(scene: Phaser.Scene, path: string, decodedBytes = 0) {
    this.content.watchAssetOwner(scene, (release) => scene.events.once('shutdown', release));
    const ref = await this.content.asset(path, scene, decodedBytes);
    if (!scene.sys.isActive()) { this.content.releaseAssets(scene); throw new Error('scene closed while loading media'); }
    return ref;
  }

  private async run(scene: Phaser.Scene, queue: Queued[]): Promise<void> {
    for (const item of queue) this.content.retainAsset(item.key, scene, () => {
      if (item.type === 'image' && scene.textures.exists(item.key)) scene.textures.remove(item.key);
      if (item.type === 'audio' && scene.cache.audio.exists(item.key)) scene.cache.audio.remove(item.key);
      for (const key of scene.anims.getAnimsFromTexture(item.key)) if (key.startsWith(`${item.key}:`)) scene.anims.remove(key);
    });
    const todo = queue.filter((q) => (q.type === 'image' ? !scene.textures.exists(q.key) : !scene.cache.audio.exists(q.key)));
    if (todo.length === 0) return;
    await new Promise<void>((resolve, reject) => {
      const loader = scene.load;
      const cleanup = () => { loader.off('complete', complete); loader.off('loaderror', failed); scene.events.off('shutdown', closed); };
      const complete = () => { cleanup(); resolve(); };
      const failed = (file: Phaser.Loader.File) => { if (todo.some((q) => q.key === file.key)) { cleanup(); reject(new Error(`failed to load ${file.key}`)); } };
      const closed = () => { cleanup(); reject(new Error('scene closed while loading media')); };
      loader.once('complete', complete); loader.on('loaderror', failed); scene.events.once('shutdown', closed);
      for (const q of todo) {
        if (q.type === 'image') loader.image(q.key, q.url);
        else loader.audio(q.key, q.url);
      }
      loader.start();
    });
  }

  async loadUnits(scene: Phaser.Scene, artKeys: readonly string[]): Promise<void> {
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
      const tex = scene.textures.get(ref.key);
      for (const [name, [x, y, w, h]] of Object.entries(atlas.frames)) if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
      const states: UnitFrames['states'] = {};
      for (const [st, s] of Object.entries(u.states)) {
        const animationKey = s.animation ? `${ref.key}:${k}:${st}` : undefined;
        if (animationKey && s.animation && !scene.anims.exists(animationKey)) scene.anims.create({ key: animationKey, frames: s.animation.frames.map((frame) => ({ key: ref.key, frame })), frameRate: s.animation.fps, repeat: s.animation.loop ? -1 : 0 });
        states[st] = { frame: s.frame, scale: s.scale, footY: s.foot_y, pivotX: s.pivot_x, ...(animationKey ? { animationKey } : {}) };
      }
      this.unitCache.set(k, { textureKey: ref.key, facing: u.facing, heightPx: u.height_px, states });
    }
  }

  unit(artKey: string): UnitFrames {
    const u = this.unitCache.get(artKey);
    if (!u) throw new Error(`unit art ${artKey} not loaded`);
    return u;
  }

  frameFor(artKey: string, state: UnitAnimState): { key: string; frame: string; scale: number; footY: number; pivotX: number; animationKey?: string } {
    const u = this.unit(artKey);
    const s = u.states[state] ?? u.states.idle;
    if (!s) throw new Error(`unit ${artKey} has no idle state`);
    return { key: u.textureKey, frame: s.frame, scale: s.scale, footY: s.footY, pivotX: s.pivotX, ...(s.animationKey ? { animationKey: s.animationKey } : {}) };
  }

  async loadPortraits(scene: Phaser.Scene, characters: readonly string[], emotions?: ReadonlyMap<string, ReadonlySet<string>>): Promise<void> {
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

  async loadBackground(scene: Phaser.Scene, location: string): Promise<void> {
    const path = this.art.backgrounds[location];
    if (!path) throw new Error(`no background for ${location}`);
    const ref = await this.asset(scene,path);
    this.bgKeys.set(location, ref.key);
    await this.run(scene, [{ type: 'image', key: ref.key, url: ref.url }]);
  }

  /**
   * Adds a full-screen backdrop behind a scene. The art library is rebuilt after every content patch, so a scene must not assume an
   * earlier scene already loaded the image: this loads it (a no-op when the texture exists) and never throws, so a missing or failed
   * background leaves the plain dark backdrop instead of crashing the screen.
   */
  async addBackdrop(scene: Phaser.Scene, location: string, depth = -20): Promise<Phaser.GameObjects.Image | null> {
    try {
      await this.loadBackground(scene, location);
      if (!scene.sys.isActive()) return null;
      const img = scene.add.image(1920 / 2, 1080 / 2, this.background(location)).setDepth(depth);
      img.setScale(Math.max(1920 / img.width, 1080 / img.height));
      return img;
    } catch {
      return null;
    }
  }

  background(location: string): string {
    const k = this.bgKeys.get(location);
    if (!k) throw new Error(`background ${location} not loaded`);
    return k;
  }

  async loadMusic(scene: Phaser.Scene, cue: string): Promise<void> {
    const m = this.art.music[cue];
    if (!m) return;
    const ref = await this.asset(scene,m.file, Math.ceil(m.duration_s * 48_000 * 2 * 4));
    this.musicKeys.set(cue, { key: ref.key, loopStart: m.loop_start_s, duration: m.duration_s });
    await this.run(scene, [{ type: 'audio', key: ref.key, url: ref.url }]);
    const buffer = scene.cache.audio.get(ref.key) as AudioBuffer | undefined;
    if (buffer && typeof buffer.getChannelData === 'function') {
      try { if (buffer.duration > m.duration_s + 0.5 || buffer.numberOfChannels > 2 || buffer.sampleRate > 96_000) throw new Error('Music decoding differs from its declared resource budget'); this.content.accountDecodedAsset(ref.key, buffer.length * buffer.numberOfChannels * 4); }
      catch (error) { scene.cache.audio.remove(ref.key); throw error; }
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
  async ensureBoot(scene: Phaser.Scene): Promise<void> {
    await this.loadUi(scene);
    await this.loadBackground(scene, 'forest_whispering_ash');
  }

  async loadUi(scene: Phaser.Scene): Promise<void> {
    const queue: Queued[] = [];
    for (const [name, path] of Object.entries(this.art.ui)) {
      const ref = await this.asset(scene,path);
      this.uiKeys.set(name, ref.key);
      queue.push({ type: 'image', key: ref.key, url: ref.url });
    }
    await this.run(scene, queue);
  }

  /** Loads full-frame stills (prologue plates, event illustrations) on demand; ids the manifest does not ship are skipped without error. */
  async loadStills(scene: Phaser.Scene, ids: readonly string[]): Promise<void> {
    const queue: Queued[] = [];
    for (const id of ids) {
      const path = this.art.stills[id];
      if (!path) continue;
      const ref = await this.asset(scene,path);
      this.stillKeys.set(id, ref.key);
      queue.push({ type: 'image', key: ref.key, url: ref.url });
    }
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
