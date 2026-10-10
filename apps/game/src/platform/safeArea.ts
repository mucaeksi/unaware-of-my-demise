import { REF_H } from '../config';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Reads CSS env(safe-area-inset-*) once and converts it from CSS pixels to 1920x1080 reference pixels. */
export function readSafeInsets(canvas: HTMLCanvasElement | null): Insets {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string): number => Number.parseFloat(v) || 0;
  const css = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  probe.remove();
  const shown = canvas?.getBoundingClientRect().height || window.innerHeight;
  const k = REF_H / shown;
  return { top: css.top * k, right: css.right * k, bottom: css.bottom * k, left: css.left * k };
}
