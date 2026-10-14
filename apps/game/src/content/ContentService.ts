import { Music } from '../audio/Music';
import {
  CONTENT_CAPABILITIES,
  PRESENTATION_PATH,
  PresentationPack,
  LocalePack,
  ArtManifest,
  ChapterIndex,
  ContentManifest,
  Encounter,
  EntryIndex,
  Prologue,
  StoryScene,
  UnitPack
} from '@uomd/content-schema';
import { PatchManager, type ApplyOptions, type BaseContent, type PatchOutcome, type PatchState } from '@uomd/patch';
import { sha256Hex, type PublicKeyJwk } from '@uomd/shared';
import trusted from '@uomd-trusted-keys';
import { BASE_CONTENT_URL, CHANNEL, CLIENT_VERSION, PATCH_STORAGE_BUDGET, SUPPORTED_CONTENT_SCHEMA } from '../config';
import { openContentStorage } from '../platform/idbStorage';
import { prefs } from '../platform/prefs';
import { imageSize } from './image-size';
import { ApiRemote } from './remote';
import { validatePatch } from './validator';

export interface AssetRef {
  /** Phaser cache key; includes the content hash so a patched file never collides with the old texture */
  key: string;
  url: string;
  width?: number;
  height?: number;
}

const dec = new TextDecoder('utf-8', { fatal: true });

async function loadBase(): Promise<BaseContent> {
  const res = await fetch(`${BASE_CONTENT_URL}/release.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`base release manifest missing (HTTP ${res.status})`);
  const manifest = ContentManifest.parse(await res.json());
  const files: Record<string, string> = {};
  for (const f of manifest.files) files[f.path] = f.sha256;
  return {
    releaseId: manifest.release.id,
    generation: manifest.release.generation,
    files,
    async read(path: string): Promise<Uint8Array> {
      const expected = files[path];
      if (!expected) throw new Error(`base content has no ${path}`);
      const r = await fetch(`${BASE_CONTENT_URL}/${path}`);
      if (!r.ok) throw new Error(`base file ${path}: HTTP ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      if ((await sha256Hex(bytes)) !== expected) throw new Error(`base file ${path} failed its integrity check`);
      return bytes;
    }
  };
}

/**
 * Single access point for game content. Everything the scenes show (units, scenes, art, music) is
 * resolved through the active snapshot, or through the embedded base when no snapshot is active.
 * Legacy dependent overlays may also inherit embedded files.
 */
export class ContentService {
  storageNotice: string | null = null;
  readonly lastCheck: { outcome: PatchOutcome | null; at: number | null } = { outcome: null, at: null };
  private readonly jsonCache = new Map<string, { value: unknown; bytes: number }>();
  private readonly assets = new Map<string, AssetRef & { cost: number; encodedBytes: number; owners: Set<object>; dispose?: () => void }>();
  private readonly watchedOwners = new WeakSet<object>();

  private constructor(
    private readonly patch: PatchManager,
    readonly base: BaseContent,
    readonly persistent: boolean
  ) {}

  static async create(): Promise<ContentService> {
    const base = await loadBase();
    const { storage, persistent } = await openContentStorage();
    const patch = new PatchManager(
      {
        channel: CHANNEL,
        clientVersion: CLIENT_VERSION,
        supportedContentSchema: SUPPORTED_CONTENT_SCHEMA,
        supportedCapabilities: CONTENT_CAPABILITIES,
        trustedKeys: (trusted as { keys: PublicKeyJwk[] }).keys,
        installId: prefs().installId,
        storageBudgetBytes: PATCH_STORAGE_BUDGET,
        validate: validatePatch,
        validateObject: (file, bytes) => { imageSize(file.path, bytes); },
        storageEstimate: async () => navigator.storage?.estimate().catch(() => ({})) ?? {},
        networkPolicy: () => {
          const connection = (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection;
          return navigator.onLine === false ? 'offline' : connection?.saveData || connection?.type === 'cellular' ? 'metered' : 'online';
        }
      },
      storage,
      new ApiRemote(),
      base
    );
    const service = new ContentService(patch, base, persistent);
    Music.assetOwner((key, owner) => { service.retainAsset(key, owner); return () => service.releaseAssets(owner); });
    if (!persistent) service.storageNotice = 'Local storage is unavailable. Downloads will be lost when this session closes.';
    else {
      try { const prior = localStorage.getItem('uomd.content.last-active.v1'); const active = (await service.state()).active?.releaseId; if (prior && prior !== base.releaseId && !active) service.storageNotice = 'Downloaded content was removed from this device. Reconnect to download it again.'; } catch { /* optional loss notice */ }
    }
    return service;
  }

  // ------------------------------------------------------------------ patch lifecycle

  state(): Promise<PatchState> {
    return this.patch.state();
  }

  async checkForUpdates(opts: ApplyOptions = {}): Promise<PatchOutcome> {
    const outcome = await this.patch.checkAndApply(opts);
    this.lastCheck.outcome = outcome;
    this.lastCheck.at = Date.now();
    if (outcome.status === 'applied' || outcome.status === 'reverted_to_base') { this.jsonCache.clear(); await this.rememberActive(); }
    return outcome;
  }

  /** Switches on a release that was downloaded earlier (the restart after the first-install flow); no network involved. */
  async activateStaged(): Promise<PatchOutcome | null> {
    const outcome = await this.patch.activateStaged();
    if (outcome) {
      this.lastCheck.outcome = outcome;
      this.lastCheck.at = Date.now();
      if (outcome.status === 'applied') { this.jsonCache.clear(); await this.rememberActive(); }
    }
    return outcome;
  }

  async rollback(): Promise<boolean> {
    const changed = await this.patch.rollback();
    if (changed) { this.jsonCache.clear(); await this.rememberActive(); }
    return changed;
  }

  private async rememberActive(): Promise<void> {
    try { localStorage.setItem('uomd.content.last-active.v1', await this.activeReleaseId()); if (this.persistent) this.storageNotice = null; } catch { /* optional marker; never game authority */ }
  }

  /** Release id currently served on top of the base ("rel_0001" when no patch is active). */
  async activeReleaseId(): Promise<string> {
    return (await this.patch.state()).active?.releaseId ?? this.base.releaseId;
  }

  // ------------------------------------------------------------------ typed content

  private async json<T>(path: string, schema: { parse(v: unknown): T }): Promise<T> {
    const loc = await this.patch.locate(path);
    const cached = this.jsonCache.get(loc.sha256);
    if (cached !== undefined) { this.jsonCache.delete(loc.sha256); this.jsonCache.set(loc.sha256, cached); return cached.value as T; }
    const bytes = await this.patch.read(path);
    const actual = await this.patch.locate(path);
    if (actual.sha256 !== loc.sha256) { this.storageNotice = 'Some downloaded content was lost. A healthy version was restored; reconnect to update.'; return this.json(path, schema); }
    const parsed = schema.parse(JSON.parse(dec.decode(bytes)));
    this.jsonCache.set(loc.sha256, { value: parsed, bytes: bytes.byteLength });
    let total = [...this.jsonCache.values()].reduce((n, entry) => n + entry.bytes, 0);
    while (this.jsonCache.size > 64 || total > 8 * 1024 * 1024) { const first = this.jsonCache.keys().next().value!; total -= this.jsonCache.get(first)!.bytes; this.jsonCache.delete(first); }
    return parsed;
  }

  async has(path: string): Promise<boolean> {
    const state = await this.patch.state();
    return (state.active?.manifest.files.some((f) => f.path === path) ?? false) || (!state.active || !!state.active.manifest.depends_on) && Object.hasOwn(this.base.files, path);
  }
  async presentation(): Promise<PresentationPack> { return await this.has(PRESENTATION_PATH) ? this.json(PRESENTATION_PATH, PresentationPack) : PresentationPack.parse({ schema_version: 1 }); }
  async locale(locale = prefs().locale): Promise<LocalePack | undefined> {
    const profile = await this.presentation();
    if (!profile.locales.includes(locale)) return undefined;
    return this.json(`locales/${locale}.json`, LocalePack);
  }

  unitPack(): Promise<UnitPack> {
    return this.json('units/unit_pack.json', UnitPack);
  }
  art(): Promise<ArtManifest> {
    return this.json('art/art_manifest.json', ArtManifest);
  }
  chapters(): Promise<ChapterIndex> {
    return this.json('chapters/chapter_index.json', ChapterIndex);
  }
  /** What the first-install flow plays (ships in the base release). */
  entryIndex(): Promise<EntryIndex> {
    return this.json('entry/entry_index.json', EntryIndex);
  }
  prologue(path: string): Promise<Prologue> {
    return this.json(path, Prologue);
  }
  encounter(path: string): Promise<Encounter> {
    return this.json(path, Encounter);
  }
  story(path: string): Promise<StoryScene> {
    return this.json(path, StoryScene);
  }

  // ------------------------------------------------------------------ binary assets

  /** Owners pin a resource through scene/media shutdown; unowned lookups have a bounded transient cache. */
  async asset(path: string, owner?: object, decodedBytes = 0): Promise<AssetRef> {
    const loc = await this.patch.locate(path);
    const key = `${path}@${loc.sha256}`;
    let record = this.assets.get(key);
    if (!record) {
      const bytes = await this.patch.read(path);
      if ((await this.patch.locate(path)).sha256 !== loc.sha256) { this.storageNotice = 'Some downloaded content was lost. A healthy version was restored; reconnect to update.'; return this.asset(path, owner, decodedBytes); }
      if (this.assets.has(key)) return this.asset(path, owner, decodedBytes);
      const dimensions = imageSize(path, bytes);
      const base = this.base.files[path] === loc.sha256;
      const type = path.endsWith('.webp') ? 'image/webp' : path.endsWith('.png') ? 'image/png' : path.endsWith('.ogg') ? 'audio/ogg' : path.endsWith('.mp3') ? 'audio/mpeg' : path.endsWith('.m4a') ? 'audio/mp4' : path.endsWith('.webm') ? 'video/webm' : 'application/octet-stream';
      const cost = bytes.byteLength + (dimensions ? dimensions.width * dimensions.height * 4 : decodedBytes);
      this.collectIdleAssets();
      if ([...this.assets.values()].reduce((n, a) => n + a.cost, 0) + cost > 128 * 1024 * 1024) throw new Error('The current scene exceeds its media memory budget');
      const url = base ? `${BASE_CONTENT_URL}/${path}` : URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
      record = { key, url, ...dimensions, cost, encodedBytes: bytes.byteLength, owners: new Set() }; this.assets.set(key, record);
    }
    if (owner) record.owners.add(owner);
    return { key: record.key, url: record.url, ...(record.width ? { width: record.width, height: record.height } : {}) };
  }

  accountDecodedAsset(key: string, bytes: number): void {
    const record = this.assets.get(key); if (!record) return;
    const cost = Math.max(record.cost, record.encodedBytes + bytes);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || [...this.assets.values()].reduce((n, a) => n + (a === record ? cost : a.cost), 0) > 128 * 1024 * 1024) throw new Error('Decoded media exceeds the scene memory budget');
    record.cost = cost;
  }

  watchAssetOwner(owner: object, onDispose: (release: () => void) => void): void {
    if (this.watchedOwners.has(owner)) return;
    this.watchedOwners.add(owner); onDispose(() => { this.watchedOwners.delete(owner); this.releaseAssets(owner); });
  }
  retainAsset(key: string, owner: object, dispose?: () => void): void {
    const record = this.assets.get(key); if (!record) return;
    record.owners.add(owner); if (dispose && !record.dispose) record.dispose = dispose;
  }
  releaseAssets(owner: object): void {
    for (const [key, record] of this.assets) if (record.owners.delete(owner) && record.owners.size === 0) this.disposeAsset(key);
  }
  private disposeAsset(key: string): void {
    const record = this.assets.get(key); if (!record) return;
    record.dispose?.(); if (record.url.startsWith('blob:')) URL.revokeObjectURL(record.url); this.assets.delete(key);
  }
  private collectIdleAssets(): void {
    for (const [key, record] of this.assets) if (!record.owners.size) this.disposeAsset(key);
  }
}
