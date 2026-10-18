import type Phaser from '../engine';
import { REF_H, REF_W } from '../config';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const MAX_INSET_X = 220;
const MAX_INSET_Y = 120;

function clampInsets(raw: Insets): Insets {
  return {
    top: Math.max(0, Math.min(MAX_INSET_Y, Math.round(raw.top || 0))),
    right: Math.max(0, Math.min(MAX_INSET_X, Math.round(raw.right || 0))),
    bottom: Math.max(0, Math.min(MAX_INSET_Y, Math.round(raw.bottom || 0))),
    left: Math.max(0, Math.min(MAX_INSET_X, Math.round(raw.left || 0)))
  };
}

function readOverrideInsets(): Insets | null {
  if (typeof window === 'undefined') return null;
  const winOverride = (window as unknown as { __UOMD_SAFE_INSETS__?: Partial<Insets> }).__UOMD_SAFE_INSETS__;
  if (winOverride && typeof winOverride === 'object') {
    return clampInsets({
      top: Number(winOverride.top ?? 0),
      right: Number(winOverride.right ?? 0),
      bottom: Number(winOverride.bottom ?? 0),
      left: Number(winOverride.left ?? 0)
    });
  }
  try {
    const param = new URLSearchParams(window.location.search).get('safeInsets');
    if (param) {
      const parts = param.split(',').map((s) => Number.parseFloat(s.trim()) || 0);
      if (parts.length === 4) {
        return clampInsets({ top: parts[0]!, right: parts[1]!, bottom: parts[2]!, left: parts[3]! });
      }
    }
  } catch {
    /* ignore malformed query */
  }
  return null;
}

/** Reads CSS env(safe-area-inset-*) (or test/query override) and converts it from CSS pixels to 1920x1080 reference pixels. */
export function readSafeInsets(canvas?: HTMLCanvasElement | null): Insets {
  const override = readOverrideInsets();
  if (override) return override;
  if (typeof document === 'undefined' || !document.body) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string): number => Number.parseFloat(v) || 0;
  const css = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  probe.remove();
  const resolvedCanvas = canvas ?? (typeof document.querySelector === 'function' ? (document.querySelector('#game canvas') as HTMLCanvasElement | null) : null);
  const shown = resolvedCanvas?.getBoundingClientRect().height || (typeof window !== 'undefined' ? window.innerHeight : REF_H) || REF_H;
  const k = REF_H / shown;
  return clampInsets({ top: css.top * k, right: css.right * k, bottom: css.bottom * k, left: css.left * k });
}

export function safeInsets(scene?: Phaser.Scene): Insets {
  return readSafeInsets(scene?.game?.canvas ?? null);
}

export function safeBounds(insets: Insets): { left: number; right: number; top: number; bottom: number; width: number; height: number; centerX: number; centerY: number } {
  const left = insets.left;
  const right = REF_W - insets.right;
  const top = insets.top;
  const bottom = REF_H - insets.bottom;
  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(400, right - left),
    height: Math.max(300, bottom - top),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2
  };
}

