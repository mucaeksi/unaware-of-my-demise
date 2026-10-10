/** Small per-device preferences (never gameplay state). localStorage can throw in private modes. */
export interface Prefs {
  musicVolume: number;
  sfxVolume: number;
  reducedMotion: boolean;
  textSpeed: 'slow' | 'normal' | 'fast';
  installId: string;
}

const KEY = 'uomd.prefs.v1';

function randomId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function defaults(): Prefs {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { musicVolume: 0.7, sfxVolume: 0.8, reducedMotion: reduced, textSpeed: 'normal', installId: randomId() };
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
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  prefs()[key] = value;
  save();
}
