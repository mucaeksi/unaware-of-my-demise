import { REF_H, REF_W } from '../config';

export interface A11yButtonControl {
  id: string;
  getLabel: () => string;
  isEnabled: () => boolean;
  isVisible: () => boolean;
  getDepth: () => number;
  getBoundsRef: () => { x: number; y: number; w: number; h: number };
  onFocusChange: (focused: boolean) => void;
  onActivate: () => void;
}

const controls = new Map<string, { ctrl: A11yButtonControl; el: HTMLButtonElement }>();
let layerEl: HTMLDivElement | null = null;
let liveEl: HTMLDivElement | null = null;
let keyListenerInstalled = false;
let nextId = 1;

function ensureDom(): { layer: HTMLDivElement | null; live: HTMLDivElement | null } {
  if (typeof document === 'undefined' || !document.body) return { layer: null, live: null };
  if (!layerEl || !document.body.contains(layerEl)) {
    layerEl = (document.getElementById('a11y-layer') as HTMLDivElement | null) ?? document.createElement('div');
    layerEl.id = 'a11y-layer';
    layerEl.setAttribute('role', 'region');
    layerEl.setAttribute('aria-label', 'Game interactive controls');
    layerEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;overflow:hidden;';
    if (!document.body.contains(layerEl)) document.body.appendChild(layerEl);
  }
  if (!liveEl || !document.body.contains(liveEl)) {
    liveEl = (document.getElementById('a11y-live') as HTMLDivElement | null) ?? document.createElement('div');
    liveEl.id = 'a11y-live';
    liveEl.setAttribute('role', 'status');
    liveEl.setAttribute('aria-live', 'polite');
    liveEl.setAttribute('aria-atomic', 'true');
    liveEl.style.cssText = 'position:fixed;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    if (!document.body.contains(liveEl)) document.body.appendChild(liveEl);
  }
  if (!keyListenerInstalled && typeof window !== 'undefined') {
    keyListenerInstalled = true;
    window.addEventListener('keydown', handleGlobalKeyDown);
  }
  return { layer: layerEl, live: liveEl };
}

function handleGlobalKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  const dismissLabels = ['CLOSE', 'CANCEL', 'RESUME', 'BACK', 'MENU'];
  const candidates = [...controls.values()]
    .map((x) => x.ctrl)
    .filter((c) => c.isVisible() && c.isEnabled() && dismissLabels.includes(c.getLabel().split(' — ')[0]?.trim().toUpperCase() ?? ''))
    .sort((a, b) => {
      const da = dismissLabels.indexOf(a.getLabel().split(' — ')[0]?.trim().toUpperCase() ?? '');
      const db = dismissLabels.indexOf(b.getLabel().split(' — ')[0]?.trim().toUpperCase() ?? '');
      return b.getDepth() - a.getDepth() || da - db;
    });
  const top = candidates[0];
  if (top) {
    e.preventDefault();
    top.onActivate();
  }
}

export function announce(message: string): void {
  const { live } = ensureDom();
  if (!live || !message.trim()) return;
  live.textContent = message.trim();
}

export function registerA11yButton(ctrl: Omit<A11yButtonControl, 'id'>): {
  id: string;
  sync: () => void;
  unregister: () => void;
} {
  const id = `uomd_btn_${nextId++}`;
  const full: A11yButtonControl = { ...ctrl, id };
  const { layer } = ensureDom();
  if (!layer) {
    return { id, sync: () => undefined, unregister: () => undefined };
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'uomd-a11y-btn';
  btn.dataset.a11yId = id;
  // pointer-events: none ensures canvas pointer tests hit Phaser directly while keyboard/AT focus and .click() work
  btn.style.cssText =
    'position:absolute;pointer-events:none;background:transparent;border:0;color:transparent;padding:0;margin:0;outline:none;';

  const sync = (): void => {
    const label = full.getLabel();
    const enabled = full.isEnabled();
    const visible = full.isVisible();
    btn.setAttribute('aria-label', label);
    btn.textContent = label;
    btn.disabled = !enabled;
    btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    btn.style.display = visible ? 'block' : 'none';
    btn.tabIndex = visible && enabled ? 0 : -1;
    const b = full.getBoundsRef();
    const leftPct = ((b.x - b.w / 2) / REF_W) * 100;
    const topPct = ((b.y - b.h / 2) / REF_H) * 100;
    const widthPct = (b.w / REF_W) * 100;
    const heightPct = (b.h / REF_H) * 100;
    btn.style.left = `${leftPct.toFixed(2)}%`;
    btn.style.top = `${topPct.toFixed(2)}%`;
    btn.style.width = `${widthPct.toFixed(2)}%`;
    btn.style.height = `${heightPct.toFixed(2)}%`;
  };

  btn.addEventListener('focus', () => full.onFocusChange(true));
  btn.addEventListener('blur', () => full.onFocusChange(false));
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (full.isEnabled() && full.isVisible()) {
      full.onActivate();
    }
  });

  sync();
  layer.appendChild(btn);
  controls.set(id, { ctrl: full, el: btn });

  return {
    id,
    sync,
    unregister: () => {
      controls.delete(id);
      btn.remove();
    }
  };
}
