import { describe, expect, it } from 'vitest';
import { BATTLE_LAYOUTS, LOCKED_CHIBI_CONTRACT, spotFor, type BattleLayoutPreset } from './formation';

describe('spotFor & R10 layout candidates', () => {
  const presets: BattleLayoutPreset[] = ['current', 'arena_lite', 'afk_faithful'];

  it.each(presets)('mirrors sides and keeps the front row closer to the centre (%s)', (preset) => {
    const pf = spotFor('player', 'front', 0, 1, preset);
    const pr = spotFor('player', 'rear', 0, 1, preset);
    const ef = spotFor('enemy', 'front', 0, 1, preset);
    expect(pf.x).toBeGreaterThan(pr.x);
    expect(ef.x).toBeLessThan(spotFor('enemy', 'rear', 0, 1, preset).x);
    expect(pf.x + ef.x).toBe(1920);
  });

  it.each(presets)('spreads five rows of units over the ground band without overlapping spots (%s)', (preset) => {
    const ys = [0, 1, 2, 3, 4].map((i) => spotFor('player', 'front', i, 5, preset).y);
    expect(new Set(ys).size).toBe(5);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(555);
    expect(Math.max(...ys)).toBeLessThanOrEqual(790);
  });

  it.each(presets)('deeper (lower) units are scaled up slightly (%s)', (preset) => {
    expect(spotFor('enemy', 'front', 1, 2, preset).depthScale).toBeGreaterThan(spotFor('enemy', 'front', 0, 2, preset).depthScale);
  });

  it('afk_faithful (C) interleaves 2-front and 3-rear units so all 5 slots on a side have unique Y bands separated by >= 55px', () => {
    const front = [0, 1].map((i) => spotFor('player', 'front', i, 2, 'afk_faithful'));
    const rear = [0, 1, 2].map((i) => spotFor('player', 'rear', i, 3, 'afk_faithful'));
    const allY = [...front.map((s) => s.y), ...rear.map((s) => s.y)].sort((a, b) => a - b);
    expect(new Set(allY).size).toBe(5);
    for (let i = 1; i < allY.length; i++) {
      expect(allY[i]! - allY[i - 1]!).toBeGreaterThanOrEqual(55);
    }
  });

  it('clamps rear units inside notched safe-area insets while preserving symmetry', () => {
    const pr = spotFor('player', 'rear', 0, 3, 'arena_lite', 160);
    const er = spotFor('enemy', 'rear', 0, 3, 'arena_lite', 160);
    expect(pr.x).toBeGreaterThanOrEqual(320);
    expect(pr.x + er.x).toBe(1920);
  });

  it('locks chibi dimensions, pivot, and background safe zones for R14/R15', () => {
    expect(LOCKED_CHIBI_CONTRACT.selectedLayout).toBe('afk_faithful');
    expect(BATTLE_LAYOUTS[LOCKED_CHIBI_CONTRACT.selectedLayout].code).toBe('C');
    expect(LOCKED_CHIBI_CONTRACT.pivot).toEqual({ x: 0.5, footY: 0.92 });
    expect(LOCKED_CHIBI_CONTRACT.chibiHeightPx.standard).toBe(220);
  });
});

