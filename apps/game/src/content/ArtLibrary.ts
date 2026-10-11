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
  states: Record<string, { frame: string; scale: number; footY: number; pivotX: number }>;
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

  private async run(scene: Phaser.Scene, queue: Queued[]): Promise<void> {
    const todo = queue.filter((q) => (q.type === 'image' ? !scene.textures.exists(q.key) : !scene.cache.audio.exists(q.key)));
    if (todo.length === 0) return;
    await new Promise<void>((resolve, reject) => {
      const loader = scene.load;
      loader.once('complete', () => resolve());
      loader.once('loaderror', (file: Phaser.Loader.File) => reject(new Error(`failed to load ${file.key}`)));
      for (const q of todo) {
        if (q.type === 'image') loader.image(q.key, q.url);
        else loader.audio(q.key, q.url);
      }
      loader.start();
    });
  }

  async loadUnits(scene: Phaser.Scene, artKeys: readonly string[]): Promise<void> {
    const queue: Queued[] = [];
    const want = [...new Set(artKeys)].filter((k) => !this.unitCache.has(k));
    for (const k of want) {
      const u = this.art.units[k];
      const atlas = u && this.art.atlases[u.atlas];
      if (!u || !atlas) throw new Error(`no art for unit ${k}`);
      const ref = await this.content.asset(atlas.image);
      queue.push({ type: 'image', key: ref.key, url: ref.url });
    }
    await this.run(scene, queue);
    for (const k of want) {
      const u = this.art.units[k];
      const atlas = u && this.art.atlases[u.atlas];
      if (!u || !atlas) continue;
      const ref = await this.content.asset(atlas.image);
      const tex = scene.textures.get(ref.key);
      for (const [name, [x, y, w, h]] of Object.entries(atlas.frames)) if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
      const states: UnitFrames['states'] = {};
      for (const [st, s] of Object.entries(u.states)) states[st] = { frame: s.frame, scale: s.scale, footY: s.foot_y, pivotX: s.pivot_x };
      this.unitCache.set(k, { textureKey: ref.key, facing: u.facing, heightPx: u.height_px, states });
    }
  }

  unit(artKey: string): UnitFrames {
    const u = this.unitCache.get(artKey);
    if (!u) throw new Error(`unit art ${artKey} not loaded`);
    return u;
  }

  frameFor(artKey: string, state: UnitAnimState): { key: string; frame: string; scale: number; footY: number; pivotX: number } {
    const u = this.unit(artKey);
    const s = u.states[state] ?? u.states.idle;
    if (!s) throw new Error(`unit ${artKey} has no idle state`);
    return { key: u.textureKey, frame: s.frame, scale: s.scale, footY: s.footY, pivotX: s.pivotX };
  }

  async loadPortraits(scene: Phaser.Scene, characters: readonly string[]): Promise<void> {
    const queue: Queued[] = [];
    for (const c of characters) {
      const p = this.art.portraits[c];
      if (!p) continue;
      for (const [img, path] of Object.entries(p.images)) {
        const ref = await this.content.asset(path);
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
    const ref = await this.content.asset(path);
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
    const ref = await this.content.asset(m.file);
    this.musicKeys.set(cue, { key: ref.key, loopStart: m.loop_start_s, duration: m.duration_s });
    await this.run(scene, [{ type: 'audio', key: ref.key, url: ref.url }]);
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
      const ref = await this.content.asset(path);
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
      if (!path || this.stillKeys.has(id)) continue;
      const ref = await this.content.asset(path);
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
