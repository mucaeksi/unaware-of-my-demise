import { describe, expect, it } from 'vitest';
import { CUTSCENE, cutsceneHoldSeconds, cutscenePauseSeconds } from './cutscene';

describe('cutscene timing (v006)', () => {
  it('a short line stays at least 5.5 s in total: reveal + hold', () => {
    const chars = 26; // reveals in exactly 1 s
    expect(cutsceneHoldSeconds({ chars, last: false }) + chars / CUTSCENE.cps).toBeGreaterThanOrEqual(5.5);
    expect(cutsceneHoldSeconds({ chars: 5, last: false })).toBeCloseTo(5.5 - 5 / 26, 5);
  });
  it('after the full reveal Auto always waits at least 3.2 s, however long the line is', () => {
    expect(cutsceneHoldSeconds({ chars: 400, last: false })).toBe(3.2);
    expect(cutsceneHoldSeconds({ chars: 100, holdSeconds: 3, last: false })).toBe(3.2);
  });
  it('narration specifies 4 s; the data value wins when it is longer than the floor', () => {
    expect(cutsceneHoldSeconds({ chars: 120, holdSeconds: 4, last: false })).toBe(4);
  });
  it('the closing line of a scene holds for the scene closing time when that is longer', () => {
    expect(cutsceneHoldSeconds({ chars: 120, last: true, closingHoldSeconds: 5 })).toBe(5);
    expect(cutsceneHoldSeconds({ chars: 120, last: true, closingHoldSeconds: 1 })).toBe(3.2);
    expect(cutsceneHoldSeconds({ chars: 120, last: false, closingHoldSeconds: 5 })).toBe(3.2);
  });
  it('speaker pause: none before the first line, 1 s on a change, 0.65 s for the same speaker', () => {
    expect(cutscenePauseSeconds(null, 'mahmut', 1)).toBe(0);
    expect(cutscenePauseSeconds('mahmut', 'fadyme', 1)).toBe(1);
    expect(cutscenePauseSeconds('narration', 'mahmut', 1)).toBe(1);
    expect(cutscenePauseSeconds('mahmut', 'mahmut', 1)).toBe(0.65);
    expect(CUTSCENE.dissolveSeconds).toBe(0.8);
  });
});
