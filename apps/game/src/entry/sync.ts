import type { EntryCheckpoint } from '../net/api';
import { freshEntry, loadEntry, mergeEntry, saveEntry, type EntryState } from './state';

/** The slice of the API client the sync needs (a fake in tests). */
export interface EntryApi {
  readonly signedIn: boolean;
  entry(): Promise<EntryCheckpoint>;
  putEntry(b: { prologue: boolean; tutorials: number; completed?: boolean }): Promise<EntryCheckpoint>;
}

const OWNER_KEY = 'uomd.entry.owner.v1';

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
  if (!api.signedIn) return { state: local, synced: false };
  try {
    const remote = await api.entry();
    const owner = readOwner();
    const base = owner !== null && owner !== remote.playerId ? freshEntry() : local; // another account's local record is dropped
    writeOwner(remote.playerId);
    const remoteState = fromServer(remote);
    const merged = mergeEntry(base, remoteState);
    saveEntry(merged);
    if (!sameProgress(merged, remoteState)) await api.putEntry(body(merged));
    return { state: merged, synced: true };
  } catch {
    return { state: local, synced: false };
  }
}

/** Applies one forward step locally (instant, offline safe) and pushes it to the account in the background when signed in. */
export function recordEntry(api: EntryApi, step: (s: EntryState) => EntryState): EntryState {
  const next = saveEntry(step(loadEntry()));
  if (api.signedIn) void api.putEntry(body(next)).catch(() => undefined); // the next syncEntry repairs a missed push
  return next;
}
