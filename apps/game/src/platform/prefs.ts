/** Small per-device preferences (never gameplay state). localStorage can throw in private modes. */
export type TextSizePref = 'normal' | 'large';
export type QualityTierPref = 'auto' | 'low' | 'medium' | 'high';
export type BattleLayoutPref = 'afk_faithful' | 'current' | 'arena_lite';

export interface Prefs {
  musicVolume: number;
  voiceVolume: number;
  locale: string;
  sfxVolume: number;
  reducedMotion: boolean;
  reduceFlash: boolean;
  highContrast: boolean;
  textSize: TextSizePref;
  qualityTier: QualityTierPref;
  battleLayout: BattleLayoutPref;
  textSpeed: 'slow' | 'normal' | 'fast';
  installId: string;
}

const KEY = 'uomd.prefs.v1';
const listeners = new Set<(p: Prefs) => void>();

function randomId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function defaults(): Prefs {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const contrast = typeof matchMedia === 'function' && matchMedia('(prefers-contrast: more)').matches;
  return {
    voiceVolume: 0.8,
    locale: 'en',
    musicVolume: 0.7,
    sfxVolume: 0.8,
    reducedMotion: reduced,
    reduceFlash: reduced,
    highContrast: contrast,
    textSize: 'normal',
    qualityTier: 'auto',
    battleLayout: 'afk_faithful',
    textSpeed: 'normal',
    installId: randomId()
  };
}

let cache: Prefs | null = null;

export function prefs(): Prefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = { ...defaults(), ...(JSON.parse(raw) as Partial<Prefs>) };
      return cache;
    }
  } catch {
    /* fall through to defaults */
  }
  cache = defaults();
  save();
  return cache;
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable: keep in memory */
  }
  if (cache) {
    for (const fn of listeners) {
      try { fn(cache); } catch { /* ignore listener fault */ }
    }
  }
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  prefs()[key] = value;
  save();
}

export function onPrefsChanged(fn: (p: Prefs) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reset cached preferences from localStorage (used by tests when mutating storage or matchMedia). */
export function reloadPrefs(): Prefs {
  cache = null;
  return prefs();
}

