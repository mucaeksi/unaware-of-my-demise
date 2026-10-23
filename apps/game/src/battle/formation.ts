import type { Row, Side } from '@uomd/combat';
import { REF_H, REF_W } from '../config';
import { prefs, type BattleLayoutPref } from '../platform/prefs';

export type BattleLayoutPreset = BattleLayoutPref;

export interface Spot {
  x: number;
  y: number;
  /** perspective scale: units lower on screen are slightly larger */
  depthScale: number;
}

export interface BattleLayoutSpec {
  id: BattleLayoutPreset;
  code: 'A' | 'B' | 'C';
  title: string;
  groundTop: number;
  groundBottom: number;
  frontX: number;
  rearX: number;
  jitterX: number;
  /** When true, a 2-unit front row sits interleaved between a 3-unit rear row's Y bands so 5v5 plates never collide. */
  interleaveFrontTwo: boolean;
  turnOrderY: number;
  skillBarY: number;
  descY: number;
  plateOffsetY: number;
  scaleMin: number;
  scaleSpan: number;
}

export const BATTLE_LAYOUTS: Readonly<Record<BattleLayoutPreset, BattleLayoutSpec>> = {
  current: {
    id: 'current',
    code: 'A',
    title: 'A · Current Baseline',
    groundTop: 565,
    groundBottom: 780,
    frontX: 620,
    rearX: 360,
    jitterX: 24,
    interleaveFrontTwo: false,
    turnOrderY: 132,
    skillBarY: 964,
    descY: 868,
    plateOffsetY: 22,
    scaleMin: 0.56,
    scaleSpan: 0.08
  },
  arena_lite: {
    id: 'arena_lite',
    code: 'B',
    title: 'B · Arena-Lite Wide',
    groundTop: 568,
    groundBottom: 788,
    frontX: 640,
    rearX: 340,
    jitterX: 24,
    interleaveFrontTwo: false,
    turnOrderY: 132,
    skillBarY: 968,
    descY: 874,
    plateOffsetY: 18,
    scaleMin: 0.55,
    scaleSpan: 0.08
  },
  afk_faithful: {
    id: 'afk_faithful',
    code: 'C',
    title: 'C · AFK-Faithful 3-Rear 2-Front (Selected)',
    groundTop: 568,
    groundBottom: 788,
    frontX: 590,
    rearX: 346,
    jitterX: 28,
    interleaveFrontTwo: true,
    turnOrderY: 128,
    skillBarY: 964,
    descY: 872,
    plateOffsetY: 18,
    scaleMin: 0.53,
    scaleSpan: 0.07
  }
} as const;

/**
 * Locked R10 chibi, pivot and background safe-zone contract for R14/R15 asset production.
 */
export const LOCKED_CHIBI_CONTRACT = {
  referenceResolution: { width: REF_W, height: REF_H },
  selectedLayout: 'afk_faithful' as const,
  chibiHeightPx: {
    standard: 220,
    elite: 280,
    boss: 340,
    objective: 190
  },
  pivot: {
    x: 0.5,
    footY: 0.92
  },
  backgroundSafeZone: {
    horizonY: [480, 545] as const,
    groundPlaneY: [555, 790] as const,
    hudTopReserveY: [0, 185] as const,
    hudBottomReserveY: [855, 1080] as const,
    notchMarginX: 130
  }
} as const;

export function activeBattleLayout(): BattleLayoutPreset {
  if (typeof window !== 'undefined') {
    try {
      const q = new URLSearchParams(window.location.search).get('battleLayout')?.trim().toLowerCase();
      if (q === 'a' || q === 'current') return 'current';
      if (q === 'b' || q === 'arena_lite' || q === 'arena-lite') return 'arena_lite';
      if (q === 'c' || q === 'afk_faithful' || q === 'afk-faithful') return 'afk_faithful';
    } catch {
      /* ignore */
    }
  }
  return prefs().battleLayout ?? 'afk_faithful';
}

export function battleLayoutSpec(preset: BattleLayoutPreset = activeBattleLayout()): BattleLayoutSpec {
  return BATTLE_LAYOUTS[preset] ?? BATTLE_LAYOUTS.afk_faithful;
}

/**
 * Screen position of a unit in a 3-Rear + 2-Front formation grounded on the stone/ash battlefield floor.
 * - Rear column (up to 3 slots): 0%, 50%, 100% of ground band (or 0% and 100% when 2 rear units).
 * - Front column (up to 2 slots): interleaved at 25% and 75% of ground band (or 62% when solo).
 */
export function spotFor(
  side: Side,
  row: Row,
  index: number,
  count: number,
  preset: BattleLayoutPreset = activeBattleLayout(),
  safeInsetX = 0
): Spot {
  const spec = battleLayoutSpec(preset);
  const span = spec.groundBottom - spec.groundTop;
  let y: number;
  if (count <= 1) {
    y = spec.interleaveFrontTwo
      ? Math.round(spec.groundTop + span * (row === 'front' ? 0.62 : 0.36))
      : (spec.groundTop + spec.groundBottom) / 2;
  } else if (spec.interleaveFrontTwo && row === 'front' && count === 2) {
    // Interleave 2 front units at 25% and 75% of the band so they sit cleanly between 3 rear units (0%, 50%, 100%)
    y = Math.round(spec.groundTop + span * (index === 0 ? 0.25 : 0.75));
  } else if (spec.interleaveFrontTwo && row === 'rear' && count === 2) {
    // Keep a 2-unit rear row comfortably grounded away from the top horizon and bottom HUD
    y = Math.round(spec.groundTop + span * (index === 0 ? 0.14 : 0.86));
  } else {
    y = Math.round(spec.groundTop + (span * index) / (count - 1));
  }
  const jitter =
    count <= 1
      ? 0
      : count === 3
        ? index === 0
          ? -spec.jitterX
          : index === 1
            ? Math.round(spec.jitterX * 0.85)
            : -Math.round(spec.jitterX * 0.45)
        : index % 2 === 0
          ? -spec.jitterX
          : spec.jitterX;
  const basePlayerX = row === 'front' ? spec.frontX : spec.rearX;
  const minX = Math.max(220, safeInsetX + 160);
  const clampedPlayerX = Math.max(minX, basePlayerX + jitter);
  const x = side === 'player' ? clampedPlayerX : REF_W - clampedPlayerX;
  const depthScale = +(spec.scaleMin + spec.scaleSpan * ((y - spec.groundTop) / span)).toFixed(4);
  return { x, y, depthScale };
}

