import { env } from 'cloudflare:workers';
import { sha256Hex } from '@uomd/shared';
import { MEDIA_TYPE_BY_EXTENSION, type AllowedExtension } from '@uomd/content-schema';

const baseJson = import.meta.glob('../../../content/base/**/*.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const campaignJson = import.meta.glob('../../../content/patches/rel_0003_part1_campaign/**/*.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

export interface TestFile {
  path: string;
  bytes: Uint8Array;
  mediaType: string;
  sha256: string;
  preseededSha256?: string;
}

const enc = new TextEncoder();
const mediaOf = (path: string): string => MEDIA_TYPE_BY_EXTENSION[path.split('.').pop() as AllowedExtension];

async function file(path: string, bytes: Uint8Array): Promise<TestFile> {
  const sha256 = await sha256Hex(bytes);
  return { path, bytes, mediaType: mediaOf(path), sha256, preseededSha256: sha256 };
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

type FileRef = { file: string };
/** The media-bearing slices of art_manifest.json / presentation.json the fixtures need. */
interface ArtRefs {
  atlases?: Record<string, { image: string }>;
  backgrounds?: Record<string, string>;
  music?: Record<string, FileRef>;
  ui?: Record<string, string>;
  stills?: Record<string, string>;
  portraits?: Record<string, { images: Record<string, string> }>;
}
interface PresentationRefs { voices?: Record<string, FileRef>; sounds?: Record<string, FileRef>; videos?: Record<string, FileRef> }

/** Every binary a release's art manifest and presentation pack reference (stand-ins are generated for these). */
function mediaPaths(art: ArtRefs = {}, pres: PresentationRefs = {}): Set<string> {
  const files = (refs?: Record<string, FileRef>) => Object.values(refs ?? {}).map((r) => r.file);
  return new Set<string>([
    ...Object.values(art.atlases ?? {}).map((a) => a.image),
    ...Object.values(art.backgrounds ?? {}),
    ...files(art.music),
    ...Object.values(art.ui ?? {}),
    ...Object.values(art.stills ?? {}),
    ...Object.values(art.portraits ?? {}).flatMap((p) => Object.values(p.images)),
    ...files(pres.voices),
    ...files(pres.sounds),
    ...files(pres.videos)
  ]);
}

let cachedBase: TestFile[] | null = null;
let cachedPatch: TestFile[] | null = null;
let cachedCampaign: TestFile[] | null = null;

async function ensureR2Seeded(list: TestFile[]): Promise<void> {
  if (list.length === 0) return;
  const bucket = (env as unknown as { CONTENT: R2Bucket }).CONTENT;
  const firstHead = await bucket.head(`objects/${list[0]!.sha256}`);
  const lastHead = await bucket.head(`objects/${list.at(-1)!.sha256}`);
  if (firstHead && lastHead) return;
  for (let i = 0; i < list.length; i += 32) {
    await Promise.all(
      list.slice(i, i + 32).map((f) =>
        bucket.put(`objects/${f.sha256}`, f.bytes, { httpMetadata: { contentType: f.mediaType }, sha256: f.sha256 })
      )
    );
  }
}

export async function baseFiles(): Promise<TestFile[]> {
  if (!cachedBase) {
    const raw = (suffix: string) => Object.entries(baseJson).find(([k]) => k.endsWith(suffix))?.[1];
    const json = (text: string | undefined) => (text ? JSON.parse(text) : undefined);
    const bin = mediaPaths(json(raw('base/art/art_manifest.json')), json(raw('base/presentation/presentation.json')));
    cachedBase = await build(baseJson, '/content/base/', [...bin]);
  }
  await ensureR2Seeded(cachedBase);
  return [...cachedBase];
}

/** The Part I campaign patch on its own (only the files it ships; binaries are stand-ins). */
export async function patchFiles(): Promise<TestFile[]> {
  if (!cachedPatch) {
    const base = await baseFiles();
    const patch = await build(campaignJson, '/content/patches/rel_0003_part1_campaign/', []);
    const decode = (path: string) => {
      const bytes = patch.find((f) => f.path === path)?.bytes;
      return bytes ? JSON.parse(new TextDecoder().decode(bytes)) : undefined;
    };
    const bin = mediaPaths(decode('art/art_manifest.json'), decode('presentation/presentation.json'));
    const have = new Set([...base.map((f) => f.path), ...patch.map((f) => f.path)]);
    const extra: TestFile[] = [];
    for (const p of bin) if (!have.has(p)) extra.push(await file(p, enc.encode(`stand-in binary for ${p}`)));
    cachedPatch = [...patch, ...extra];
  }
  await ensureR2Seeded(cachedPatch);
  return [...cachedPatch];
}

/** The Part I campaign laid over the base release (the patch's files win), as the publisher's effective set. */
export async function campaignFiles(): Promise<TestFile[]> {
  if (!cachedCampaign) {
    const base = await baseFiles();
    const patch = await patchFiles();
    const overridden = new Set(patch.map((f) => f.path));
    cachedCampaign = [...base.filter((f) => !overridden.has(f.path)), ...patch];
  }
  await ensureR2Seeded(cachedCampaign);
  return [...cachedCampaign];
}
