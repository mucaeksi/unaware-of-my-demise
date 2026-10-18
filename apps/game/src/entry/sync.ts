import type { EntryCheckpoint } from '../net/api';
import { freshEntry, isForceFreshEntry, isReplaying, loadEntry, markCompleted, mergeEntry, saveEntry, type EntryState } from './state';

/** The slice of the API client the sync needs (a fake in tests). */
export interface EntryApi {
  readonly signedIn: boolean;
  entry(): Promise<EntryCheckpoint>;
  putEntry(b: { prologue: boolean; tutorials: number; completed?: boolean }): Promise<EntryCheckpoint>;
}

const OWNER_KEY = 'uomd.entry.owner.v1';

/** Where the entry checkpoint stands (R09): only on this device, being saved to the account, a failed save, or confirmed. */
export type EntrySaveState = 'local' | 'pending' | 'failed' | 'confirmed';
let saveState: EntrySaveState = 'local';
const watchers = new Set<(s: EntrySaveState) => void>();

function setSaveState(s: EntrySaveState): void {
  saveState = s;
  for (const w of watchers) w(s);
}

export function entrySaveState(): EntrySaveState {
  return saveState;
}

/** calls `fn` now and on every change; returns the unsubscribe */
export function watchEntrySaveState(fn: (s: EntrySaveState) => void): () => void {
  watchers.add(fn);
  fn(saveState);
  return () => watchers.delete(fn);
}

const readOwner = (): string | null => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};
const writeOwner = (id: string): void => {
  try {
    localStorage.setItem(OWNER_KEY, id);
  } catch {
    /* ignore */
  }
};

const fromServer = (c: EntryCheckpoint): EntryState =>
  c.phase === 'not_started' ? freshEntry() : { phase: c.phase, prologue: c.prologue, tutorials: c.tutorials, updatedAt: c.updatedAt ?? freshEntry().updatedAt };

const body = (s: EntryState): { prologue: boolean; tutorials: number; completed?: boolean } => ({ prologue: s.prologue, tutorials: s.tutorials, ...(s.phase === 'completed' ? { completed: true } : {}) });

const sameProgress = (a: EntryState, b: EntryState): boolean => a.phase === b.phase && a.prologue === b.prologue && a.tutorials === b.tutorials;

/**
 * Reconciles this device with the account checkpoint: the furthest progress wins on both sides, and a device that held another
 * account's progress does not leak it into a newly signed-in account. Offline or failing calls leave the local record untouched.
 */
export async function syncEntry(api: EntryApi): Promise<{ state: EntryState; synced: boolean }> {
  const local = loadEntry();
  if (!api.signedIn || isForceFreshEntry() || isReplaying()) return { state: local, synced: false };
  setSaveState('pending');
  try {
    const remote = await api.entry();
    const owner = readOwner();
    const base = owner !== null && owner !== remote.playerId ? freshEntry() : local; // another account's local record is dropped
    writeOwner(remote.playerId);
    const remoteState = fromServer(remote);
    const merged = mergeEntry(base, remoteState);
    saveEntry(merged);
    if (!sameProgress(merged, remoteState)) await api.putEntry(body(merged));
    setSaveState('confirmed');
    return { state: merged, synced: true };
  } catch {
    setSaveState('failed');
    return { state: local, synced: false };
  }
}

/** Applies one forward step locally (instant, offline safe) and pushes it to the account in the background when signed in. */
export function recordEntry(api: EntryApi, step: (s: EntryState) => EntryState): EntryState {
  const next = saveEntry(step(loadEntry()));
  if (isReplaying()) return next; // a replay never touches the account checkpoint
  if (!api.signedIn) {
    setSaveState('local');
    return next;
  }
  setSaveState('pending');
  // a missed push is repaired by the next syncEntry
  void api.putEntry(body(next)).then(
    () => setSaveState('confirmed'),
    () => setSaveState('failed')
  );
  return next;
}

/**
 * Confirms entry completion before the mandatory first restart.
 * Verifies prologue + 3 tutorials are complete, and when signed in awaits server checkpoint persistence before marking local state completed.
 */
export async function confirmEntryComplete(api: EntryApi): Promise<{ state: EntryState; remoteConfirmed: boolean }> {
  const cur = loadEntry();
  if (!cur.prologue || cur.tutorials < 3) {
    throw new Error('Entry prerequisites not met (prologue and all 3 tutorials required).');
  }
  if (api.signedIn) {
    setSaveState('pending');
    let remote: EntryCheckpoint;
    try {
      remote = await api.putEntry({ prologue: true, tutorials: 3, completed: true });
    } catch (e) {
      setSaveState('failed');
      throw e;
    }
    writeOwner(remote.playerId);
    const next = saveEntry(fromServer(remote));
    setSaveState('confirmed');
    return { state: next, remoteConfirmed: true };
  }
  const next = saveEntry(markCompleted(cur));
  return { state: next, remoteConfirmed: false };
}

