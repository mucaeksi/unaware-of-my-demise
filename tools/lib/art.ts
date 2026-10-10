/**
 * Approved legacy runtime art -> web-ready WebP atlases + a validated art manifest.
 * All source pixels come from Git history (LEGACY_COMMIT) or the preserved narrative/ tree; nothing
 * is repainted. Processing = alpha-trim, uniform per-unit downscale, shelf-pack into one atlas.
 */
import sharp from 'sharp';
import { ArtManifest, UNIT_ANIM_STATES, type UnitAnimState } from '../../packages/content-schema/src/index';
import { fileBytes, legacyBlob, sha256 } from './fsutil';

type Region = [number, number, number, number];

export interface PoseSource {
  /** repo-relative path (working tree) or legacy path (Git history) */
  file: { legacy: string } | { repo: string };
  /** crop in source pixels; absent = whole image */
  region?: Region;
  /** figure height relative to the idle pose (singles are generated at arbitrary scale) */
  relativeHeight?: number;
  /** extra manual nudges */
  footY?: number;
  pivotX?: number;
}

export interface UnitArtConfig {
  artKey: string;
  facing: 'left' | 'right';
  heightPx: number;
  poses: Record<UnitAnimState, PoseSource>;
}

export interface PortraitConfig {
  characterId: string;
  /** image key -> source file */
  images: Record<string, { legacy: string } | { repo: string }>;
  /** emotion tag -> image key (subset used, or full map) */
  emotions: Record<string, string>;
}

const srcBuf = (f: { legacy: string } | { repo: string }): Buffer => ('legacy' in f ? legacyBlob(f.legacy) : fileBytes(f.repo));
export const srcId = (f: { legacy: string } | { repo: string }): string => ('legacy' in f ? `git:${f.legacy}` : f.repo);

interface Trimmed {
  data: Buffer;
  width: number;
  height: number;
  /** alpha-weighted centroid x as a 0..1 fraction of the trimmed width */
  centroidX: number;
}

async function trimmedCrop(buf: Buffer, region?: Region): Promise<Trimmed> {
  let img = sharp(buf).ensureAlpha();
  if (region) img = img.extract({ left: region[0], top: region[1], width: region[2], height: region[3] });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  let sumA = 0, sumAx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3] as number;
      if (a > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumA += a;
        sumAx += a * x;
      }
    }
  }
  if (maxX < 0) throw new Error('empty pose (fully transparent)');
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const cropped = await sharp(data, { raw: { width, height, channels: 4 } }).extract({ left: minX, top: minY, width: w, height: h }).png().toBuffer();
  return { data: cropped, width: w, height: h, centroidX: (sumAx / sumA - minX) / w };
}

interface Placed {
  name: string;
  w: number;
  h: number;
  x: number;
  y: number;
  data: Buffer;
}

function shelfPack(items: { name: string; w: number; h: number; data: Buffer }[], maxW: number, pad: number): { placed: Placed[]; width: number; height: number } {
  const sorted = [...items].sort((a, b) => b.h - a.h || (a.name < b.name ? -1 : 1));
  const placed: Placed[] = [];
  let x = pad, y = pad, rowH = 0, usedW = 0;
  for (const it of sorted) {
    if (x + it.w + pad > maxW) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    placed.push({ ...it, x, y });
    x += it.w + pad;
    rowH = Math.max(rowH, it.h);
    usedW = Math.max(usedW, x);
  }
  const height = y + rowH + pad;
  return { placed, width: usedW, height };
}

export interface BuiltUnit {
  atlasFile: string;
  atlasBytes: Buffer;
  atlas: { image: string; width: number; height: number; frames: Record<string, [number, number, number, number]> };
  unit: { atlas: string; facing: 'left' | 'right'; height_px: number; states: Record<string, { frame: string; scale: number; foot_y: number; pivot_x: number }> };
  sourceHashes: Record<string, string>;
}

export async function buildUnitAtlas(cfg: UnitArtConfig, outDir: string): Promise<BuiltUnit> {
  const raw = new Map<UnitAnimState, { t: Trimmed; cfg: PoseSource }>();
  const hashes: Record<string, string> = {};
  for (const st of UNIT_ANIM_STATES) {
    const p = cfg.poses[st];
    const buf = srcBuf(p.file);
    hashes[srcId(p.file)] = sha256(buf);
    raw.set(st, { t: await trimmedCrop(buf, p.region), cfg: p });
  }
  const idle = raw.get('idle');
  if (!idle) throw new Error('idle pose required');
  const kIdle = cfg.heightPx / idle.t.height;
  const items: { name: string; w: number; h: number; data: Buffer }[] = [];
  const meta = new Map<UnitAnimState, { w: number; h: number; centroidX: number; footY: number }>();
  const seenFrame = new Map<string, string>();
  for (const st of UNIT_ANIM_STATES) {
    const r = raw.get(st);
    if (!r) continue;
    const factor = r.cfg.relativeHeight ?? 1;
    const k = r.cfg.region ? kIdle * factor : (cfg.heightPx * factor) / r.t.height;
    const w = Math.max(1, Math.round(r.t.width * k));
    const h = Math.max(1, Math.round(r.t.height * k));
    const key = `${srcId(r.cfg.file)}:${r.cfg.region?.join(',') ?? 'full'}`;
    let name = seenFrame.get(key);
    if (!name) {
      name = st;
      seenFrame.set(key, st);
      const data = await sharp(r.t.data).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
      items.push({ name, w, h, data });
    }
    meta.set(st, { w, h, centroidX: r.cfg.pivotX ?? r.t.centroidX, footY: r.cfg.footY ?? 0.985 });
    (meta.get(st) as { frameName?: string }).frameName = name;
  }
  const { placed, width, height } = shelfPack(items, 2048, 2);
  const atlasImg = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(placed.map((p) => ({ input: p.data, left: p.x, top: p.y })))
    .webp({ quality: 86, alphaQuality: 92, effort: 5 })
    .toBuffer();
  const atlasFile = `${outDir}/atlas_${cfg.artKey}.webp`;
  const frames: Record<string, [number, number, number, number]> = {};
  for (const p of placed) frames[p.name] = [p.x, p.y, p.w, p.h];
  const states: BuiltUnit['unit']['states'] = {};
  for (const st of UNIT_ANIM_STATES) {
    const m = meta.get(st) as { w: number; h: number; centroidX: number; footY: number; frameName: string };
    states[st] = { frame: m.frameName, scale: 1, foot_y: m.footY, pivot_x: Math.round(m.centroidX * 1000) / 1000 };
  }
  return {
    atlasFile,
    atlasBytes: atlasImg,
    atlas: { image: atlasFile.replace(/^.*?art\//, 'art/'), width, height, frames },
    unit: { atlas: `atlas_${cfg.artKey}`, facing: cfg.facing, height_px: cfg.heightPx, states },
    sourceHashes: hashes
  };
}

export async function buildPortrait(src: { legacy: string } | { repo: string }, maxHeight: number): Promise<{ bytes: Buffer; hash: string }> {
  const buf = srcBuf(src);
  const out = await sharp(buf).resize({ height: maxHeight, withoutEnlargement: true, kernel: 'lanczos3' }).webp({ quality: 84, alphaQuality: 92, effort: 5 }).toBuffer();
  return { bytes: out, hash: sha256(buf) };
}

export async function buildBackground(src: { legacy: string } | { repo: string }, width: number): Promise<{ bytes: Buffer; hash: string }> {
  const buf = srcBuf(src);
  const out = await sharp(buf).resize({ width, withoutEnlargement: true, kernel: 'lanczos3' }).webp({ quality: 82, effort: 5 }).toBuffer();
  return { bytes: out, hash: sha256(buf) };
}

export function validateArt(manifest: unknown): ArtManifest {
  return ArtManifest.parse(manifest);
}

/** Removes a flat chroma-key green background (generator green screens) and returns trimmed WebP. */
export async function buildKeyedImage(src: { legacy: string } | { repo: string }, maxWidth: number): Promise<{ bytes: Buffer; hash: string }> {
  const buf = srcBuf(src);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] as number, g = data[i + 1] as number, b = data[i + 2] as number;
    const dominance = g - Math.max(r, b);
    if (dominance > 40) {
      const a = Math.max(0, Math.min(1, 1 - (dominance - 40) / 90));
      data[i + 3] = Math.round((data[i + 3] as number) * a);
      data[i + 1] = Math.min(g, Math.max(r, b)); // despill
    }
  }
  const keyed = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  const out = await keyed.trim({ threshold: 8 }).resize({ width: maxWidth, withoutEnlargement: true, kernel: 'lanczos3' }).webp({ quality: 88, alphaQuality: 95, effort: 5 }).toBuffer();
  return { bytes: out, hash: sha256(buf) };
}

/** Key art with a baked alpha ramp on its left edge so it melts into any background. */
export async function buildFadedKeyArt(src: { legacy: string } | { repo: string }, width: number): Promise<{ bytes: Buffer; hash: string }> {
  const buf = srcBuf(src);
  const resized = await sharp(buf).resize({ width, withoutEnlargement: true, kernel: 'lanczos3' }).ensureAlpha().png().toBuffer();
  const meta = await sharp(resized).metadata();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  const out = await sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).webp({ quality: 84, alphaQuality: 90, effort: 5 }).toBuffer();
  return { bytes: out, hash: sha256(buf) };
}
