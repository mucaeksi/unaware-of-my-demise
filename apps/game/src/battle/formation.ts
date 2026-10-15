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
    groundTop: 470,
    groundBottom: 670,
    frontX: 700,
    rearX: 400,
    jitterX: 50,
    interleaveFrontTwo: false,
    turnOrderY: 192,
    skillBarY: 960,
    descY: 860,
    plateOffsetY: 44,
    scaleMin: 0.9,
    scaleSpan: 0.14
  },
  arena_lite: {
    id: 'arena_lite',
    code: 'B',
    title: 'B · Arena-Lite Wide',
    groundTop: 420,
    groundBottom: 700,
    frontX: 740,
    rearX: 340,
    jitterX: 44,
    interleaveFrontTwo: false,
    turnOrderY: 168,
    skillBarY: 970,
    descY: 872,
    plateOffsetY: 42,
    scaleMin: 0.88,
    scaleSpan: 0.16
  },
  afk_faithful: {
    id: 'afk_faithful',
    code: 'C',
    title: 'C · AFK-Faithful Staggered (Selected)',
    groundTop: 400,
    groundBottom: 716,
    frontX: 690,
    rearX: 370,
    jitterX: 136,
    interleaveFrontTwo: true,
    turnOrderY: 184,
    skillBarY: 960,
    descY: 856,
    plateOffsetY: 38,
    scaleMin: 0.74,
    scaleSpan: 0.12
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
    horizonY: [360, 420] as const,
    groundPlaneY: [410, 780] as const,
    hudTopReserveY: [0, 220] as const,
    hudBottomReserveY: [830, 1080] as const,
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
 * Screen position of a unit. Units of the same row are spread over the ground band (centered when
 * alone), alternating x offsets so tall sprites overlap less. `index`/`count` = place among the
 * living-or-dead members of that row, ordered by slot, so nobody moves when a neighbour falls.
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
    y = (spec.groundTop + spec.groundBottom) / 2;
  } else if (spec.interleaveFrontTwo && row === 'front' && count === 2) {
    // Interleave 2 front units at 25% and 75% of the band so they sit cleanly between 3 rear units (0%, 50%, 100%)
    y = spec.groundTop + span * (index === 0 ? 0.25 : 0.75);
  } else {
    y = spec.groundTop + (span * index) / (count - 1);
  }
  const jitter =
    count <= 1
      ? 0
      : count === 3
        ? index === 0
          ? -spec.jitterX
          : index === 1
            ? 0
            : spec.jitterX
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

