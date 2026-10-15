/**
 * Chroma-key for generated art. Gemini never returns alpha, so keyed classes (busts, sprite sheets, icons) are generated on a flat
 * #00FF00 background and keyed here. Steps (docs/media/EXPORT_PIPELINE.md §3.4): estimate the key colour from the border, alpha from a linear
 * mixing ramp on the green dominance, decontaminate semi-transparent edge pixels (remove the key colour that bled in), despill, optional choke,
 * tiny-speck removal, and alpha bleed so no transparent pixel carries key green or black into a lossy encode or a filtered sampler.
 * Pure functions on RGBA buffers; the sharp calls are only decode/encode at the edges.
 */
import sharp from 'sharp';

export type Edge = 'top' | 'bottom' | 'left' | 'right';

export interface KeyOptions {
  /** which borders are guaranteed key background (a bust cut at the bottom samples top/left/right only) */
  sample?: Edge[];
  /** alpha ramp on the 0..255 dominance scale (0..255 = linear mixing model) */
  ramp?: [number, number];
  /** alpha erosion in pixels (0 = none; fractions blend with the eroded alpha) */
  choke?: number;
  despill?: boolean;
  /** connected opaque components smaller than this many pixels are removed as specks */
  minComponentPx?: number;
}

export interface Keyed {
  /** straight-alpha RGBA, 4 bytes per pixel */
  data: Buffer;
  width: number;
  height: number;
  key: [number, number, number];
  /** per-channel standard deviation of the border ring (flatness of the generated background) */
  ringSigma: number;
  removedSpecks: number;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const clamp255 = (x: number): number => (x < 0 ? 0 : x > 255 ? 255 : Math.round(x));

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = Float64Array.from(values).sort();
  return s[Math.floor(s.length / 2)] as number;
}

/** Key colour = per-channel median of the border ring pixels that are clearly green. */
export function estimateKey(rgba: Buffer, w: number, h: number, sample: Edge[]): { key: [number, number, number]; sigma: number } {
  const ring = Math.max(4, Math.round(Math.min(w, h) * 0.005));
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  const take = (x: number, y: number): void => {
    const i = (y * w + x) * 4;
    const pr = rgba[i] as number;
    const pg = rgba[i + 1] as number;
    const pb = rgba[i + 2] as number;
    if (pg - Math.max(pr, pb) >= 150) {
      r.push(pr);
      g.push(pg);
      b.push(pb);
    }
  };
  for (const e of sample) {
    if (e === 'top') for (let y = 0; y < ring; y++) for (let x = 0; x < w; x++) take(x, y);
    if (e === 'bottom') for (let y = h - ring; y < h; y++) for (let x = 0; x < w; x++) take(x, y);
    if (e === 'left') for (let x = 0; x < ring; x++) for (let y = 0; y < h; y++) take(x, y);
    if (e === 'right') for (let x = w - ring; x < w; x++) for (let y = 0; y < h; y++) take(x, y);
  }
  if (g.length === 0) throw new Error('no key-green pixels on the sampled borders: the background is not flat green');
  const mr = median(r);
  const mg = median(g);
  const mb = median(b);
  const sd = (v: number[], m: number): number => Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / v.length);
  return { key: [mr, mg, mb], sigma: Math.max(sd(r, mr), sd(g, mg), sd(b, mb)) };
}

/** Keys a decoded RGBA buffer in place semantics: returns a new buffer. */
export function keyRgba(src: Buffer, w: number, h: number, opts: KeyOptions = {}): Keyed {
  const sample = opts.sample ?? ['top', 'bottom', 'left', 'right'];
  const ramp = opts.ramp ?? [0, 255];
  const { key, sigma } = estimateKey(src, w, h, sample);
  const domK = key[1] - Math.max(key[0], key[2]);
  const lo = (ramp[0] * domK) / 255;
  const hi = Math.max(lo + 1, (ramp[1] * domK) / 255);
  const out = Buffer.from(src);
  const n = w * h;
  const alpha = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const r = src[i] as number;
    const g = src[i + 1] as number;
    const b = src[i + 2] as number;
    const dom = g - Math.max(r, b);
    const a = 1 - clamp01((dom - lo) / (hi - lo));
    alpha[p] = a;
    if (a > 0 && a < 1) {
      // C = a*F + (1-a)*K  =>  F = (C - (1-a)*K) / a
      out[i] = clamp255((r - (1 - a) * key[0]) / a);
      out[i + 1] = clamp255((g - (1 - a) * key[1]) / a);
      out[i + 2] = clamp255((b - (1 - a) * key[2]) / a);
    }
    if (a > 0 && opts.despill !== false) {
      const o = out[i + 1] as number;
      const cap = Math.max(out[i] as number, out[i + 2] as number);
      if (o > cap) out[i + 1] = cap;
    }
  }

  // choke: blend towards the 4-neighbour minimum (one pixel of erosion for choke = 1)
  const choke = opts.choke ?? 0;
  if (choke > 0) {
    const eroded = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        let m = alpha[p] as number;
        if (x > 0) m = Math.min(m, alpha[p - 1] as number);
        if (x < w - 1) m = Math.min(m, alpha[p + 1] as number);
        if (y > 0) m = Math.min(m, alpha[p - w] as number);
        if (y < h - 1) m = Math.min(m, alpha[p + w] as number);
        eroded[p] = m;
      }
    }
    const t = Math.min(1, choke);
    for (let p = 0; p < n; p++) alpha[p] = (alpha[p] as number) * (1 - t) + (eroded[p] as number) * t;
  }

  // specks: tiny isolated opaque components are generation noise
  const minPx = opts.minComponentPx ?? 24;
  let removed = 0;
  if (minPx > 0) {
    const seen = new Uint8Array(n);
    const stack: number[] = [];
    for (let s = 0; s < n; s++) {
      if (seen[s] || (alpha[s] as number) <= 0.05) continue;
      const comp: number[] = [];
      stack.push(s);
      seen[s] = 1;
      while (stack.length) {
        const p = stack.pop() as number;
        comp.push(p);
        const x = p % w;
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
        for (const q of nb) {
          if (q >= 0 && !seen[q] && (alpha[q] as number) > 0.05) {
            seen[q] = 1;
            stack.push(q);
          }
        }
        if (comp.length > minPx) {
          // large enough: drain the rest of the flood fill without storing it
          while (stack.length) {
            const pp = stack.pop() as number;
            const xx = pp % w;
            for (const q of [xx > 0 ? pp - 1 : -1, xx < w - 1 ? pp + 1 : -1, pp >= w ? pp - w : -1, pp < n - w ? pp + w : -1]) {
              if (q >= 0 && !seen[q] && (alpha[q] as number) > 0.05) {
                seen[q] = 1;
                stack.push(q);
              }
            }
          }
          break;
        }
      }
      if (comp.length <= minPx) {
        for (const p of comp) alpha[p] = 0;
        removed++;
      }
    }
  }

  for (let p = 0; p < n; p++) out[p * 4 + 3] = clamp255((alpha[p] as number) * 255);
  bleed(out, w, h, 4);
  return { data: out, width: w, height: h, key, ringSigma: sigma, removedSpecks: removed };
}

/** Fills the RGB of fully transparent pixels from the nearest opaque neighbour (up to `radius` px) so no key green or black leaks into edges. */
export function bleed(rgba: Buffer, w: number, h: number, radius: number): void {
  let frontier: number[] = [];
  const n = w * h;
  const done = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if ((rgba[p * 4 + 3] as number) > 0) {
      done[p] = 1;
      frontier.push(p);
    }
  }
  const steps = Math.max(radius, 16);
  for (let step = 0; step < steps; step++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1]) {
        if (q < 0 || done[q]) continue;
        done[q] = 1;
        rgba[q * 4] = rgba[p * 4] as number;
        rgba[q * 4 + 1] = rgba[p * 4 + 1] as number;
        rgba[q * 4 + 2] = rgba[p * 4 + 2] as number;
        next.push(q);
      }
    }
    frontier = next;
  }
  for (let p = 0; p < n; p++) {
    if (!done[p]) {
      rgba[p * 4] = 0;
      rgba[p * 4 + 1] = 0;
      rgba[p * 4 + 2] = 0;
    }
  }
}

/** Decode any raster input, key it, return straight-alpha RGBA. */
export async function keyImage(input: Buffer, opts: KeyOptions = {}): Promise<Keyed> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return keyRgba(data, info.width, info.height, opts);
}

export const toPng = (k: Keyed): Promise<Buffer> => sharp(k.data, { raw: { width: k.width, height: k.height, channels: 4 } }).png().toBuffer();
