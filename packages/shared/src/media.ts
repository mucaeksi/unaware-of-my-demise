/**
 * Google media generation helpers: verified price table, request builder and response parser for the Gemini image
 * models. Pure functions (no network, no fs) so they are unit tested; tools/gen_image.ts does the I/O and always
 * reserves budget (budget.ts) before a paid call.
 *
 * Prices: https://ai.google.dev/gemini-api/docs/pricing, paid tier, USD per image, fetched 2026-10-11
 * ("Last updated 2026-10-09"). Re-check the page before approving any amount; Google changes prices.
 * The REQUEST SHAPE below follows the public Gemini API reference but has NOT been exercised against the live API
 * (no approved budget yet): the first approved, budget-reserved call is the integration test.
 */
export type ImageModel = 'gemini-3.1-flash-image' | 'gemini-3.1-flash-lite-image' | 'gemini-3-pro-image';
export type ImageSize = '0.5K' | '1K' | '2K' | '4K';

export const PRICES_VERIFIED_ON = '2026-10-11';
export const IMAGE_PRICES_USD: Record<ImageModel, Partial<Record<ImageSize, number>>> = {
  // "Nano Banana 2"
  'gemini-3.1-flash-image': { '0.5K': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 },
  // "Nano Banana 2 Lite"
  'gemini-3.1-flash-lite-image': { '1K': 0.0336 },
  // "Nano Banana Pro"
  'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134, '4K': 0.24 }
};
/** Lyria per request (full song / 30 s clip), same source. Veo and Chirp are not priced here: estimate explicitly. */
export const MUSIC_PRICES_USD = { 'lyria-3.5': 0.08, 'lyria-3-clip-preview': 0.04 } as const;

export class MediaError extends Error {
  constructor(readonly code: 'unpriced' | 'bad_spec' | 'blocked' | 'no_image', message: string) {
    super(message);
  }
}

export interface ImageSpec {
  id: string;
  model: ImageModel;
  size: ImageSize;
  aspectRatio: string;
  prompt: string;
  /** reference images by repo path; the tool reads them and sends them inline (max 14 per Google's limit for pro models, 10 recommended) */
  references: { path: string; role: string }[];
  /** how many candidate images to request (each is a separate paid call) */
  count: number;
  notes?: string;
}

const ID = /^[a-z][a-z0-9_]{2,63}$/;
const RATIO = /^\d{1,2}:\d{1,2}$/;

export function validateSpec(spec: ImageSpec): void {
  if (!ID.test(spec.id)) throw new MediaError('bad_spec', `id must match ${ID}`);
  if (!RATIO.test(spec.aspectRatio)) throw new MediaError('bad_spec', 'aspectRatio must look like 3:4');
  if (!Number.isInteger(spec.count) || spec.count < 1 || spec.count > 8) throw new MediaError('bad_spec', 'count must be 1..8');
  if (spec.prompt.trim().length < 80) throw new MediaError('bad_spec', 'prompt is too short to be a production prompt (min 80 characters)');
  if (spec.references.length > 10) throw new MediaError('bad_spec', 'at most 10 reference images');
  priceOf(spec.model, spec.size);
}

export function priceOf(model: ImageModel, size: ImageSize): number {
  const p = IMAGE_PRICES_USD[model]?.[size];
  if (p === undefined) throw new MediaError('unpriced', `${model} at ${size} has no verified price; refusing to guess`);
  return p;
}

/** Upper bound for the whole spec: price × count. Reserve THIS before calling. */
export const estimateUsd = (spec: ImageSpec): number => Math.round(priceOf(spec.model, spec.size) * spec.count * 1e6) / 1e6;

export interface InlineImage {
  mimeType: string;
  base64: string;
}

export function buildImageRequest(spec: ImageSpec, refs: InlineImage[]): { path: string; body: unknown } {
  validateSpec(spec);
  if (refs.length !== spec.references.length) throw new MediaError('bad_spec', 'reference payload count does not match the spec');
  const roleLines = spec.references.map((r, i) => `Reference image ${i + 1}: ${r.role}.`).join('\n');
  const text = `${spec.prompt.trim()}${roleLines ? `\n\n${roleLines}` : ''}`;
  return {
    path: `/v1beta/models/${spec.model}:generateContent`,
    body: {
      contents: [{ role: 'user', parts: [{ text }, ...refs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.base64 } }))] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: spec.aspectRatio, imageSize: spec.size } }
    }
  };
}

interface GenerateContentResponse {
  candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: Record<string, unknown>;
}

export function parseImageResponse(json: unknown): { images: InlineImage[]; usage: Record<string, unknown> | undefined } {
  const r = json as GenerateContentResponse;
  if (r.promptFeedback?.blockReason) throw new MediaError('blocked', `prompt blocked: ${r.promptFeedback.blockReason}`);
  const images: InlineImage[] = [];
  for (const c of r.candidates ?? []) {
    for (const p of c.content?.parts ?? []) {
      if (p.inlineData?.data && p.inlineData.mimeType?.startsWith('image/')) images.push({ mimeType: p.inlineData.mimeType, base64: p.inlineData.data });
    }
  }
  if (images.length === 0) {
    const why = r.candidates?.[0]?.finishReason ?? 'no candidates';
    throw new MediaError('no_image', `response contained no image (${why})`);
  }
  return { images, usage: r.usageMetadata };
}

type Usage = Record<string, unknown>;
const isObj = (v: unknown): v is Usage => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Sums usage metadata across calls (a count > 1 batch is several billed calls): numbers add, nested objects merge, arrays of
 * per-modality entries (`{ modality, tokenCount }`) merge by modality, any other value keeps the latest. Pure; inputs untouched.
 */
export function mergeUsage(total: Usage | undefined, next: Usage | undefined): Usage | undefined {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  if (!next) return total;
  if (!total) return clone(next);
  const out: Usage = { ...total };
  for (const [k, v] of Object.entries(next)) {
    const prev = out[k];
    if (typeof v === 'number' && typeof prev === 'number') out[k] = prev + v;
    else if (isObj(v) && isObj(prev)) out[k] = mergeUsage(prev, v);
    else if (Array.isArray(v) && Array.isArray(prev) && [...v, ...prev].every((e) => isObj(e) && typeof e.modality === 'string')) {
      const byModality = new Map<string, Usage>();
      for (const e of [...prev, ...v] as Usage[]) byModality.set(e.modality as string, mergeUsage(byModality.get(e.modality as string), e) ?? e);
      out[k] = [...byModality.values()];
    } else out[k] = clone(v);
  }
  return out;
}

