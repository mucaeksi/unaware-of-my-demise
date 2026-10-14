import { ContentManifest, MAX_JSON_FILE_BYTES } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import type { z } from 'zod';
import type { GameEnv } from '../env';
import { ContentStore, HttpError } from './store';

type Env = Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>;
/** Exact published snapshot read. A declared but missing/corrupt object never becomes legacy data. */
export async function releaseData<T>(env: Env, releaseId: string, path: string, schema: z.ZodType<T>): Promise<T | undefined> {
  const store = new ContentStore(env.DB, env.CONTENT);
  const row = await store.getRelease(releaseId);
  if (!row || row.state !== 'published' || row.channel !== env.CONTENT_CHANNEL) throw new HttpError(404, 'unknown_release', 'release is not published on this channel');
  const invalid = () => new HttpError(503, 'content_unavailable', 'the declared release data is unavailable or invalid');
  try {
    const manifest = ContentManifest.parse(JSON.parse(row.manifest_json));
    const declared = manifest.files.find((f) => f.path === path);
    const sha = (await store.effectiveFiles(releaseId)).get(path);
    if (!declared && !sha) return undefined;
    if (!declared || declared.sha256 !== sha || declared.bytes > MAX_JSON_FILE_BYTES) throw invalid();
    const object = await store.getObject(declared.sha256);
    if (!object || object.size !== declared.bytes) throw invalid();
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (bytes.byteLength !== declared.bytes || await sha256Hex(bytes) !== sha) throw invalid();
    return schema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)));
  } catch { throw invalid(); }
}
export async function selectedRelease(env: Env, id?: string): Promise<string | undefined> {
  return id ?? (await env.DB.prepare('SELECT release_id FROM channel_pointers WHERE channel = ?1').bind(env.CONTENT_CHANNEL).first<{ release_id: string }>())?.release_id;
}
export function inWindow(window: { starts_at: string; ends_at: string }, now: Date): boolean {
  return Date.parse(window.starts_at) <= now.getTime() && now.getTime() < Date.parse(window.ends_at);
}
