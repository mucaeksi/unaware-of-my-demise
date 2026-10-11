import { describe, expect, it } from 'vitest';
import { keyRgba } from './key';

const W = 200;
const H = 160;
const BONE: [number, number, number] = [233, 226, 212];
const PLUM: [number, number, number] = [69, 41, 59];

/** a bone-coloured disc with a plum ring, soft 1.5 px edge, composited on key green; also returns the true alpha */
function fixture(): { rgba: Buffer; trueAlpha: Float32Array } {
  const rgba = Buffer.alloc(W * H * 4);
  const trueAlpha = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - W / 2, y - H / 2);
      const a = Math.min(1, Math.max(0, (60 - d) / 1.5 + 0.5));
      const fg = d > 52 ? PLUM : BONE;
      const i = (y * W + x) * 4;
      rgba[i] = a * fg[0] + (1 - a) * 3;
      rgba[i + 1] = a * fg[1] + (1 - a) * 254;
      rgba[i + 2] = a * fg[2] + (1 - a) * 3;
      rgba[i + 3] = 255;
      trueAlpha[y * W + x] = a;
    }
  }
  return { rgba, trueAlpha };
}

describe('keyRgba', () => {
  it('estimates the key colour and flatness from the border', () => {
    const { rgba } = fixture();
    const k = keyRgba(rgba, W, H);
    expect(k.key).toEqual([3, 254, 3]);
    expect(k.ringSigma).toBeLessThan(1);
  });

  it('recovers the subject: edge pixels carry no key green after decontamination and despill', () => {
    const { rgba, trueAlpha } = fixture();
    const k = keyRgba(rgba, W, H);
    let greenEdge = 0;
    let err = 0;
    let n = 0;
    for (let p = 0; p < W * H; p++) {
      const a = k.data[p * 4 + 3] as number;
      if (a === 0) continue;
      const r = k.data[p * 4] as number;
      const g = k.data[p * 4 + 1] as number;
      const b = k.data[p * 4 + 2] as number;
      if (g - Math.max(r, b) > 10) greenEdge++;
      if ((trueAlpha[p] as number) > 0 && (trueAlpha[p] as number) < 1) {
        // composite over bone ivory and compare with the true render over bone ivory
        const af = a / 255;
        const expectedR = (trueAlpha[p] as number) * (d(p) > 52 ? PLUM[0] : BONE[0]) + (1 - (trueAlpha[p] as number)) * BONE[0];
        err += Math.abs(af * r + (1 - af) * BONE[0] - expectedR);
        n++;
      }
    }
    expect(greenEdge).toBe(0);
    expect(err / n).toBeLessThan(14);
    function d(p: number): number {
      return Math.hypot((p % W) - W / 2, Math.floor(p / W) - H / 2);
    }
  });

  it('keeps the interior opaque and the background transparent', () => {
    const { rgba } = fixture();
    const k = keyRgba(rgba, W, H);
    expect(k.data[(H / 2) * W * 4 + (W / 2) * 4 + 3]).toBe(255);
    expect(k.data[3]).toBe(0);
  });

  it('transparent pixels do not carry key green (alpha bleed)', () => {
    const { rgba } = fixture();
    const k = keyRgba(rgba, W, H);
    for (let p = 0; p < W * H; p++) {
      if ((k.data[p * 4 + 3] as number) === 0) {
        const g = k.data[p * 4 + 1] as number;
        const m = Math.max(k.data[p * 4] as number, k.data[p * 4 + 2] as number);
        // either untouched key (far from the subject) or bled from the subject edge; never a green pixel next to the subject
        const x = p % W;
        const y = Math.floor(p / W);
        const near = Math.hypot(x - W / 2, y - H / 2) < 60 + 3;
        if (near) expect(g - m).toBeLessThanOrEqual(10);
      }
    }
  });

  it('removes isolated specks but keeps the figure', () => {
    const { rgba } = fixture();
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const i = ((10 + dy) * W + (10 + dx)) * 4; rgba[i] = 230; rgba[i + 1] = 200; rgba[i + 2] = 230; }
    const k = keyRgba(rgba, W, H);
    expect(k.removedSpecks).toBeGreaterThanOrEqual(1);
    expect(k.data[(10 * W + 10) * 4 + 3]).toBe(0);
    expect(k.data[(Math.floor(H / 2) * W + Math.floor(W / 2)) * 4 + 3]).toBe(255);
  });

  it('refuses an image whose borders are not green', () => {
    const grey = Buffer.alloc(W * H * 4, 120);
    expect(() => keyRgba(grey, W, H)).toThrow(/not flat green/);
  });
});
