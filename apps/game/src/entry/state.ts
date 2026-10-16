/**
 * First-install progress record. Pure logic + a tiny localStorage mirror; the cloud checkpoint (account scoped) merges with it
 * through `mergeEntry`, so a reinstall or a second device resumes at the first unfinished step.
 * Order of the flow: prologue -> T-1 -> T-2 -> T-3 -> patch page / confirmation -> completed (the restart boundary).
 */
export type EntryPhase = 'not_started' | 'in_progress' | 'completed';

export const TUTORIAL_COUNT = 3;

export interface EntryState {
  phase: EntryPhase;
  /** the "Before the Road" interlude was watched to its end */
  prologue: boolean;
  /** tutorial stages finished in order (0..3) */
  tutorials: number;
  updatedAt: string;
}

export type EntryStep = { kind: 'prologue' } | { kind: 'tutorial'; index: 1 | 2 | 3 } | { kind: 'finish' } | { kind: 'menu' };

export const freshEntry = (): EntryState => ({ phase: 'not_started', prologue: false, tutorials: 0, updatedAt: new Date(0).toISOString() });

export function nextStep(s: EntryState): EntryStep {
  if (s.phase === 'completed') return { kind: 'menu' };
  if (!s.prologue) return { kind: 'prologue' };
  if (s.tutorials < TUTORIAL_COUNT) return { kind: 'tutorial', index: (s.tutorials + 1) as 1 | 2 | 3 };
  return { kind: 'finish' };
}

const touch = (s: EntryState, patch: Partial<EntryState>, now: string): EntryState => ({ ...s, ...patch, updatedAt: now });

export function markPrologueSeen(s: EntryState, now = new Date().toISOString()): EntryState {
  if (s.phase === 'completed') return s;
  return touch(s, { phase: 'in_progress', prologue: true }, now);
}

/** Tutorials count strictly in order: finishing T-n is only recorded when T-(n-1) is done; replays never move the counter back. */
export function markTutorialDone(s: EntryState, index: number, now = new Date().toISOString()): EntryState {
  if (s.phase === 'completed' || index !== s.tutorials + 1 || index > TUTORIAL_COUNT) return s;
  return touch(s, { phase: 'in_progress', prologue: true, tutorials: index }, now);
}

export function markCompleted(s: EntryState, now = new Date().toISOString()): EntryState {
  return touch(s, { phase: 'completed', prologue: true, tutorials: TUTORIAL_COUNT }, now);
}

const rank = (s: EntryState): number => (s.phase === 'completed' ? 100 : (s.prologue ? 1 : 0) + s.tutorials * 2);

/** The furthest of two records wins (progress never moves backwards when a device and the cloud disagree). */
export function mergeEntry(a: EntryState, b: EntryState): EntryState {
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra > rb ? a : b;
  return a.updatedAt >= b.updatedAt ? a : b;
}

/** Defensive parse: unknown shapes (older build, tampered storage) fall back to a fresh record instead of throwing. */
export function parseEntry(raw: unknown): EntryState {
  if (typeof raw !== 'object' || raw === null) return freshEntry();
  const o = raw as Record<string, unknown>;
  const phase: EntryPhase = o.phase === 'completed' || o.phase === 'in_progress' ? o.phase : 'not_started';
  const tutorials = typeof o.tutorials === 'number' && Number.isInteger(o.tutorials) ? Math.min(TUTORIAL_COUNT, Math.max(0, o.tutorials)) : 0;
  const prologue = o.prologue === true || tutorials > 0 || phase === 'completed';
  const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : freshEntry().updatedAt;
  if (phase === 'completed') return { phase, prologue: true, tutorials: TUTORIAL_COUNT, updatedAt };
  return { phase: prologue ? 'in_progress' : phase, prologue, tutorials, updatedAt };
}

const KEY = 'uomd.entry.v1';
const V012_RESET_KEY = 'uomd.entry.aab_v014_reset.v1';
const FORCE_FRESH_KEY = 'uomd.entry.force_fresh.v1';
let cache: EntryState | null = null;

function clearCheckpointKeys(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('uomd.flow') || k.startsWith('uomd.story') || k.startsWith('uomd.battle'))) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/**
 * Ensures browsers that played an earlier pre-v0.1.4 build or got stuck on a mid-battle checkpoint
 * start fresh in the Base AAB flow (Prologue + 3 Tutorials).
 * Skipped under automated tests / WebDriver so test fixtures remain untouched.
 */
function ensureV012EntryReset(): void {
  try {
    if (typeof window === 'undefined' || window.navigator?.webdriver) return;
    if (localStorage.getItem(V012_RESET_KEY) !== '1') {
      localStorage.setItem(V012_RESET_KEY, '1');
      localStorage.setItem(FORCE_FRESH_KEY, '1');
      localStorage.removeItem(KEY);
      localStorage.removeItem('uomd.entry.owner.v1');
      clearCheckpointKeys();
      cache = null;
    }
  } catch {
    /* ignore storage errors */
  }
}

export function isForceFreshEntry(): boolean {
  try {
    return typeof window !== 'undefined' && !window.navigator?.webdriver && localStorage.getItem(FORCE_FRESH_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearForceFreshEntry(): void {
  try {
    localStorage.removeItem(FORCE_FRESH_KEY);
  } catch {
    /* ignore */
  }
}

/** Explicitly resets the entry state to a brand-new player (used by Admin Live Preview & Title replay button). */
export function forceResetEntry(): EntryState {
  try {
    localStorage.setItem(V012_RESET_KEY, '1');
    localStorage.setItem(FORCE_FRESH_KEY, '1');
    localStorage.removeItem('uomd.entry.owner.v1');
    clearCheckpointKeys();
  } catch {
    /* ignore */
  }
  return saveEntry(freshEntry());
}

export function loadEntry(): EntryState {
  ensureV012EntryReset();
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? parseEntry(JSON.parse(raw)) : freshEntry();
  } catch {
    cache = freshEntry();
  }
  return cache;
}

export function saveEntry(s: EntryState): EntryState {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    if (s.phase === 'completed') clearForceFreshEntry();
  } catch {
    /* storage unavailable: the record lives for this session only */
  }
  return s;
}

/** test hook */
export function resetEntryCache(): void {
  cache = null;
}

