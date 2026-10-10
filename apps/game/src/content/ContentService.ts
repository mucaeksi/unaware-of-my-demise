import {
  ArtManifest,
  ChapterIndex,
  ContentManifest,
  Encounter,
  StoryScene,
  UnitPack
} from '@uomd/content-schema';
import { PatchManager, type BaseContent, type PatchOutcome, type PatchState } from '@uomd/patch';
import { sha256Hex, type PublicKeyJwk } from '@uomd/shared';
import trusted from '../../../../content/keys/trusted_public_keys.json';
import { BASE_CONTENT_URL, CHANNEL, CLIENT_VERSION, PATCH_STORAGE_BUDGET, SUPPORTED_CONTENT_SCHEMA } from '../config';
import { openContentStorage } from '../platform/idbStorage';
import { prefs } from '../platform/prefs';
import { ApiRemote } from './remote';
import { validatePatch } from './validator';

export interface AssetRef {
  /** Phaser cache key; includes the content hash so a patched file never collides with the old texture */
  key: string;
  url: string;
}

const dec = new TextDecoder();

async function loadBase(): Promise<BaseContent> {
  const res = await fetch(`${BASE_CONTENT_URL}/release.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`base release manifest missing (HTTP ${res.status})`);
  const manifest = ContentManifest.parse(await res.json());
  const files: Record<string, string> = {};
  for (const f of manifest.files) files[f.path] = f.sha256;
  const verified = new Set<string>();
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
      if (!verified.has(path)) {
        if ((await sha256Hex(bytes)) !== expected) throw new Error(`base file ${path} failed its integrity check`);
        verified.add(path);
      }
      return bytes;
    }
  };
}

/**
 * Single access point for game content. Everything the scenes show (units, scenes, art, music) is
 * resolved through the patch overlay: active patch release first, embedded base otherwise.
 */
export class ContentService {
  readonly lastCheck: { outcome: PatchOutcome | null; at: number | null } = { outcome: null, at: null };
  private readonly jsonCache = new Map<string, unknown>();
  private readonly blobUrls = new Map<string, string>();

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
        trustedKeys: (trusted as { keys: PublicKeyJwk[] }).keys,
        installId: prefs().installId,
        storageBudgetBytes: PATCH_STORAGE_BUDGET,
        validate: validatePatch
      },
      storage,
      new ApiRemote(),
      base
    );
    return new ContentService(patch, base, persistent);
  }

  // ------------------------------------------------------------------ patch lifecycle

  state(): Promise<PatchState> {
    return this.patch.state();
  }

  async checkForUpdates(): Promise<PatchOutcome> {
    const outcome = await this.patch.checkAndApply();
    this.lastCheck.outcome = outcome;
    this.lastCheck.at = Date.now();
    if (outcome.status === 'applied' || outcome.status === 'reverted_to_base') this.jsonCache.clear();
    return outcome;
  }

  async rollback(): Promise<boolean> {
    const changed = await this.patch.rollback();
    if (changed) this.jsonCache.clear();
    return changed;
  }

  /** Release id currently served on top of the base ("rel_0001" when no patch is active). */
  async activeReleaseId(): Promise<string> {
    return (await this.patch.state()).active?.releaseId ?? this.base.releaseId;
  }

  // ------------------------------------------------------------------ typed content

  private async json<T>(path: string, schema: { parse(v: unknown): T }): Promise<T> {
    const loc = await this.patch.locate(path);
    const cached = this.jsonCache.get(loc.sha256);
    if (cached !== undefined) return cached as T;
    const parsed = schema.parse(JSON.parse(dec.decode(await this.patch.read(path))));
    this.jsonCache.set(loc.sha256, parsed);
    return parsed;
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
  encounter(path: string): Promise<Encounter> {
    return this.json(path, Encounter);
  }
  story(path: string): Promise<StoryScene> {
    return this.json(path, StoryScene);
  }

  // ------------------------------------------------------------------ binary assets

  async asset(path: string): Promise<AssetRef> {
    const loc = await this.patch.locate(path);
    const key = `${path}@${loc.sha256.slice(0, 10)}`;
    if (loc.source === 'base') return { key, url: `${BASE_CONTENT_URL}/${path}` };
    let url = this.blobUrls.get(key);
    if (!url) {
      const bytes = await this.patch.read(path);
      const type = path.endsWith('.webp') ? 'image/webp' : path.endsWith('.png') ? 'image/png' : path.endsWith('.ogg') ? 'audio/ogg' : 'application/octet-stream';
      url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
      this.blobUrls.set(key, url);
    }
    return { key, url };
  }
}
