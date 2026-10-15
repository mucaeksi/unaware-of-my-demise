import { describe, expect, it } from 'vitest';
import { buildImageRequest, estimateUsd, IMAGE_PRICES_USD, MediaError, mergeUsage, parseImageResponse, priceOf, validateSpec, type ImageSpec } from './media';

const spec = (over: Partial<ImageSpec> = {}): ImageSpec => ({
  id: 'fadyme_portrait_composed',
  model: 'gemini-3.1-flash-image',
  size: '2K',
  aspectRatio: '3:4',
  prompt: 'A painterly dark Gothic anime half-body portrait of Fadyme Veyr, pale ash-blonde hair, violet eyes, deep plum hooded cloak, composed expression, soft candlelight, 1920x1080 reference scale.',
  references: [{ path: 'reference/locked/fadyme/sheet/char-fadyme-uomd.png', role: 'canonical identity sheet; keep face, hair and costume exactly' }],
  count: 2,
  ...over
});
const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof MediaError ? e.code : 'other';
  }
  return undefined;
};

describe('media generation helpers', () => {
  it('prices come from the verified table and the estimate is price × count', () => {
    expect(priceOf('gemini-3.1-flash-image', '2K')).toBe(0.101);
    expect(estimateUsd(spec())).toBeCloseTo(0.202, 6);
    expect(estimateUsd(spec({ model: 'gemini-3-pro-image', size: '4K', count: 3 }))).toBeCloseTo(0.72, 6);
    expect(Object.keys(IMAGE_PRICES_USD)).toHaveLength(3);
  });

  it('refuses to guess a price for an unpriced model/size combination', () => {
    expect(code(() => priceOf('gemini-3.1-flash-lite-image', '4K'))).toBe('unpriced');
    expect(code(() => estimateUsd(spec({ model: 'gemini-3.1-flash-lite-image', size: '2K' })))).toBe('unpriced');
  });

  it('validates specs: id, ratio, count, prompt length and reference count', () => {
    expect(code(() => validateSpec(spec()))).toBeUndefined();
    expect(code(() => validateSpec(spec({ id: 'Bad Id' })))).toBe('bad_spec');
    expect(code(() => validateSpec(spec({ aspectRatio: 'wide' })))).toBe('bad_spec');
    expect(code(() => validateSpec(spec({ count: 0 })))).toBe('bad_spec');
    expect(code(() => validateSpec(spec({ count: 9 })))).toBe('bad_spec');
    expect(code(() => validateSpec(spec({ prompt: 'too short' })))).toBe('bad_spec');
    expect(code(() => validateSpec(spec({ references: Array.from({ length: 11 }, (_, i) => ({ path: `r${i}.png`, role: 'x' })) })))).toBe('bad_spec');
  });

  it('builds the generateContent request with the prompt, labelled references and image config', () => {
    const req = buildImageRequest(spec(), [{ mimeType: 'image/png', base64: 'QUJD' }]);
    expect(req.path).toBe('/v1beta/models/gemini-3.1-flash-image:generateContent');
    const body = req.body as { contents: { parts: Record<string, unknown>[] }[]; generationConfig: Record<string, unknown> };
    const parts = body.contents[0]?.parts ?? [];
    expect(String(parts[0]?.text)).toContain('Reference image 1: canonical identity sheet');
    expect(parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: 'QUJD' } });
    expect(body.generationConfig).toEqual({ responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4', imageSize: '2K' } });
    expect(code(() => buildImageRequest(spec(), []))).toBe('bad_spec'); // payload count must match the spec
  });

  it('parses images out of a response and reports blocks or empty answers explicitly', () => {
    const ok = parseImageResponse({ candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }], usageMetadata: { totalTokenCount: 1300 } });
    expect(ok.images).toEqual([{ mimeType: 'image/png', base64: 'AAAA' }]);
    expect(ok.usage).toEqual({ totalTokenCount: 1300 });
    expect(code(() => parseImageResponse({ promptFeedback: { blockReason: 'SAFETY' } }))).toBe('blocked');
    expect(code(() => parseImageResponse({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [{ text: 'no' }] } }] }))).toBe('no_image');
    expect(code(() => parseImageResponse({}))).toBe('no_image');
  });

  it('merges usageMetadata across multiple calls in a batch without losing earlier calls', () => {
    const u1 = { promptTokenCount: 120, candidatesTokenCount: 1000, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 40 }, { modality: 'IMAGE', tokenCount: 80 }] };
    const u2 = { promptTokenCount: 120, candidatesTokenCount: 1100, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 40 }, { modality: 'IMAGE', tokenCount: 80 }] };
    expect(mergeUsage(u1, u2)).toEqual({
      promptTokenCount: 240,
      candidatesTokenCount: 2100,
      promptTokensDetails: [
        { modality: 'TEXT', tokenCount: 80 },
        { modality: 'IMAGE', tokenCount: 160 }
      ]
    });
  });
});

