import { describe, expect, it } from 'vitest';
import { spotFor } from './formation';

describe('spotFor', () => {
  it('mirrors sides and keeps the front row closer to the centre', () => {
    const pf = spotFor('player', 'front', 0, 1);
    const pr = spotFor('player', 'rear', 0, 1);
    const ef = spotFor('enemy', 'front', 0, 1);
    expect(pf.x).toBeGreaterThan(pr.x);
    expect(ef.x).toBeLessThan(spotFor('enemy', 'rear', 0, 1).x);
    expect(pf.x + ef.x).toBe(1920);
  });
  it('spreads five rows of units over the ground band without overlapping spots', () => {
    const ys = [0, 1, 2, 3, 4].map((i) => spotFor('player', 'front', i, 5).y);
    expect(new Set(ys).size).toBe(5);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(400);
    expect(Math.max(...ys)).toBeLessThanOrEqual(760);
  });
  it('deeper (lower) units are scaled up slightly', () => {
    expect(spotFor('enemy', 'front', 1, 2).depthScale).toBeGreaterThan(spotFor('enemy', 'front', 0, 2).depthScale);
  });
});
