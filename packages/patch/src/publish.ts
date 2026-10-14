import { ContentManifest, MIN_EFFECTIVE_CLIENT_VERSION, requiredContentCapabilities, MEDIA_TYPE_BY_EXTENSION, type AllowedExtension, type Channel, type FileKind } from '@uomd/content-schema';
import { compareSemver, sha256Hex, signPayload, type SignedPayload } from '@uomd/shared';

export interface ReleaseMeta {
  releaseId: string;
  generation: number;
  channel: Channel;
  notes: string;
  minClient: string;
  maxClient?: string;
  requiredCapabilities?: string[];
  contentSchema?: number;
  dependsOn?: { releaseId: string; generation: number };
  rollbackTo?: { releaseId: string; generation: number };
  rolloutPercent?: number;
  killSwitch?: boolean;
  createdAt?: string;
}

export function classify(path: string): FileKind {
  if (path.startsWith('story/')) return 'story_scene';
  if (path.startsWith('encounters/')) return 'encounter';
  if (path.startsWith('units/')) return 'unit_pack';
  if (path.startsWith('chapters/')) return 'chapter_index';
  if (path === 'art/art_manifest.json') return 'art_manifest';
  if (path.startsWith('art/atlas_')) return 'atlas_image';
  if (path.startsWith('art/portrait_')) return 'portrait';
  if (path.startsWith('art/bg_') || path.startsWith('art/still_')) return 'background';
  if (path.startsWith('audio/')) return 'audio';
  return 'other_data';
}

export interface FileEntry {
  path: string;
  sha256: string;
  bytes: number;
}

/** Builds (and schema-validates) an UNSIGNED manifest from already-hashed file entries. */
export function manifestFromEntries(meta: ReleaseMeta, files: readonly FileEntry[]): ContentManifest {
  const entries = [...files]
    .sort((a, b) => (a.path < b.path ? -1 : 1))
    .map((f) => {
      const ext = f.path.split('.').pop()?.toLowerCase() as AllowedExtension;
      return { path: f.path, sha256: f.sha256, bytes: f.bytes, media_type: MEDIA_TYPE_BY_EXTENSION[ext], kind: classify(f.path) };
    });
  const manifest = {
    schema_version: 1,
    release: { id: meta.releaseId, generation: meta.generation, channel: meta.channel, created_at: meta.createdAt ?? new Date().toISOString(), notes: meta.notes },
    compat: { min_client: meta.minClient, ...(meta.requiredCapabilities?.length ? { required_capabilities: meta.requiredCapabilities } : {}), ...(meta.maxClient ? { max_client: meta.maxClient } : {}), content_schema: meta.contentSchema ?? 1 },
    ...(meta.dependsOn ? { depends_on: { release_id: meta.dependsOn.releaseId, generation: meta.dependsOn.generation } } : {}),
    ...(meta.rollbackTo ? { rollback_to: { release_id: meta.rollbackTo.releaseId, generation: meta.rollbackTo.generation } } : {}),
    rollout: { percent: meta.rolloutPercent ?? 100, kill_switch: meta.killSwitch ?? false },
    files: entries
  };
  return ContentManifest.parse(manifest);
}

/** Builds (and schema-validates) an UNSIGNED manifest from file contents. */
export async function buildManifest(meta: ReleaseMeta, files: { path: string; bytes: Uint8Array }[]): Promise<ContentManifest> {
  const entries: FileEntry[] = [];
  for (const f of files) entries.push({ path: f.path, sha256: await sha256Hex(f.bytes), bytes: f.bytes.byteLength });
  const requiredCapabilities = [...new Set([...(meta.requiredCapabilities ?? []), ...requiredContentCapabilities(new Map(files.map((f) => [f.path, f.bytes])))])].sort();
  const minClient = requiredCapabilities.length && compareSemver(meta.minClient, MIN_EFFECTIVE_CLIENT_VERSION) < 0 ? MIN_EFFECTIVE_CLIENT_VERSION : meta.minClient;
  return manifestFromEntries({ ...meta, minClient, requiredCapabilities }, entries);
}

export async function signManifest(manifest: ContentManifest, privateKey: CryptoKey, kid: string): Promise<ContentManifest> {
  const signed = await signPayload(manifest as unknown as SignedPayload, privateKey, kid);
  return ContentManifest.parse(signed);
}
