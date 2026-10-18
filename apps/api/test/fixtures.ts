import { sha256Hex } from '@uomd/shared';
import { MEDIA_TYPE_BY_EXTENSION, type AllowedExtension } from '@uomd/content-schema';

const baseJson = import.meta.glob('../../../content/base/**/*.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const campaignJson = import.meta.glob('../../../content/patches/rel_0003_part1_campaign/**/*.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

export interface TestFile {
  path: string;
  bytes: Uint8Array;
  mediaType: string;
  sha256: string;
}

const enc = new TextEncoder();
const mediaOf = (path: string): string => MEDIA_TYPE_BY_EXTENSION[path.split('.').pop() as AllowedExtension];

async function file(path: string, bytes: Uint8Array): Promise<TestFile> {
  return { path, bytes, mediaType: mediaOf(path), sha256: await sha256Hex(bytes) };
}

function rel(key: string, marker: string): string {
  return key.slice(key.indexOf(marker) + marker.length);
}

/** Real compiled JSON content; binary media is replaced by unique stand-in bytes (only existence matters server-side). */
async function build(json: Record<string, string>, marker: string, binaryPaths: string[]): Promise<TestFile[]> {
  const out: TestFile[] = [];
  for (const [k, text] of Object.entries(json)) {
    const p = rel(k, marker);
    if (p === 'release.json') continue;
    out.push(await file(p, enc.encode(text)));
  }
  for (const p of binaryPaths) out.push(await file(p, enc.encode(`stand-in binary for ${p}`)));
  return out;
}

export async function baseFiles(): Promise<TestFile[]> {
  const art = JSON.parse(Object.entries(baseJson).find(([k]) => k.endsWith('base/art/art_manifest.json'))?.[1] as string);
  const presRaw = Object.entries(baseJson).find(([k]) => k.endsWith('base/presentation/presentation.json'))?.[1];
  const pres = presRaw ? JSON.parse(presRaw) : undefined;
  const bin = new Set<string>([
    ...Object.values<{ image: string }>(art.atlases).map((a) => a.image),
    ...(Object.values(art.backgrounds) as string[]),
    ...Object.values<{ file: string }>(art.music).map((m) => m.file),
    ...(Object.values(art.ui) as string[]),
    ...(Object.values(art.stills ?? {}) as string[]),
    ...Object.values<{ images: Record<string, string> }>(art.portraits).flatMap((p) => Object.values(p.images)),
    ...Object.values<{ file: string }>(pres?.voices ?? {}).map((v) => v.file),
    ...Object.values<{ file: string }>(pres?.sounds ?? {}).map((s) => s.file),
    ...Object.values<{ file: string }>(pres?.videos ?? {}).map((v) => v.file)
  ]);
  return build(baseJson, '/content/base/', [...bin]);
}

/** The Part I campaign patch on its own (only the files it ships; binaries are stand-ins). */
export async function patchFiles(): Promise<TestFile[]> {
  const base = await baseFiles();
  const patch = await build(campaignJson, '/content/patches/rel_0003_part1_campaign/', []);
  const art = JSON.parse(new TextDecoder().decode(patch.find((f) => f.path === 'art/art_manifest.json')?.bytes));
  const bin = new Set<string>([
    ...Object.values<{ image: string }>(art.atlases).map((a) => a.image),
    ...(Object.values(art.backgrounds) as string[]),
    ...(Object.values(art.ui ?? {}) as string[]),
    ...(Object.values(art.stills ?? {}) as string[])
  ]);
  const have = new Set([...base.map((f) => f.path), ...patch.map((f) => f.path)]);
  const extra: TestFile[] = [];
  for (const p of bin) if (!have.has(p)) extra.push(await file(p, enc.encode(`stand-in binary for ${p}`)));
  return [...patch, ...extra];
}

/** The Part I campaign laid over the base release (the patch's files win), as the publisher's effective set. */
export async function campaignFiles(): Promise<TestFile[]> {
  const base = await baseFiles();
  const patch = await build(campaignJson, '/content/patches/rel_0003_part1_campaign/', []);
  const art = JSON.parse(new TextDecoder().decode(patch.find((f) => f.path === 'art/art_manifest.json')?.bytes));
  const bin = new Set<string>([
    ...Object.values<{ image: string }>(art.atlases).map((a) => a.image),
    ...(Object.values(art.backgrounds) as string[]),
    ...(Object.values(art.ui ?? {}) as string[]),
    ...(Object.values(art.stills ?? {}) as string[])
  ]);
  const have = new Set([...base.map((f) => f.path), ...patch.map((f) => f.path)]);
  const extra: TestFile[] = [];
  for (const p of bin) if (!have.has(p)) extra.push(await file(p, enc.encode(`stand-in binary for ${p}`)));
  const overridden = new Set(patch.map((f) => f.path));
  return [...base.filter((f) => !overridden.has(f.path)), ...patch, ...extra];
}
