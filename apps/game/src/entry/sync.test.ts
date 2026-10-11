import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryCheckpoint } from '../net/api';
import { freshEntry, markCompleted, markPrologueSeen, markTutorialDone, resetEntryCache, saveEntry } from './state';
import { recordEntry, syncEntry, type EntryApi } from './sync';

const T = '2026-10-11T10:00:00.000Z';

function fakeApi(over: { signedIn?: boolean; remote?: Partial<EntryCheckpoint>; failGet?: boolean } = {}): EntryApi & { puts: unknown[]; remote: EntryCheckpoint } {
  const remote: EntryCheckpoint = { phase: 'not_started', prologue: false, tutorials: 0, updatedAt: null, playerId: 'p1', ...over.remote };
  const puts: unknown[] = [];
  return {
    signedIn: over.signedIn ?? true,
    puts,
    remote,
    entry: () => (over.failGet ? Promise.reject(new Error('offline')) : Promise.resolve(remote)),
    putEntry: (b) => {
      puts.push(b);
      return Promise.resolve({ ...remote, phase: b.completed ? 'completed' : 'in_progress', prologue: b.prologue, tutorials: b.tutorials, updatedAt: T });
    }
  };
}

/** the unit tests run in node: give the module a real (in-memory) localStorage so owner scoping is exercised */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  resetEntryCache();
  saveEntry(freshEntry());
});

describe('entry sync', () => {
  it('signed out: nothing is read or written', async () => {
    const api = fakeApi({ signedIn: false });
    const out = await syncEntry(api);
    expect(out.synced).toBe(false);
    expect(api.puts).toEqual([]);
  });

  it('a reinstall resumes from the account checkpoint', async () => {
    const api = fakeApi({ remote: { phase: 'in_progress', prologue: true, tutorials: 2, updatedAt: T } });
    const out = await syncEntry(api);
    expect(out.state).toMatchObject({ phase: 'in_progress', prologue: true, tutorials: 2 });
    expect(api.puts).toEqual([]); // nothing to push, the account was already ahead
  });

  it('a device that is ahead pushes its progress to the account', async () => {
    saveEntry(markTutorialDone(markPrologueSeen(freshEntry(), T), 1, T));
    const api = fakeApi({ remote: { phase: 'in_progress', prologue: true, tutorials: 0, updatedAt: T } });
    const out = await syncEntry(api);
    expect(out.state.tutorials).toBe(1);
    expect(api.puts).toEqual([{ prologue: true, tutorials: 1 }]);
  });

  it('an offline failure keeps the local record', async () => {
    saveEntry(markPrologueSeen(freshEntry(), T));
    const out = await syncEntry(fakeApi({ failGet: true }));
    expect(out.synced).toBe(false);
    expect(out.state.prologue).toBe(true);
  });

  it('progress from another account on this device does not leak into the newly signed-in account', async () => {
    const first = fakeApi({ remote: { playerId: 'alice' } });
    saveEntry(markCompleted(freshEntry(), T));
    await syncEntry(first); // alice owns this device record
    const second = fakeApi({ remote: { playerId: 'bob', phase: 'not_started' } });
    const out = await syncEntry(second);
    expect(out.state.phase).toBe('not_started');
    expect(second.puts).toEqual([]);
  });

  it('recordEntry saves locally at once and pushes in the background', async () => {
    const api = fakeApi();
    const next = recordEntry(api, (s) => markPrologueSeen(s, T));
    expect(next.prologue).toBe(true);
    await Promise.resolve();
    expect(api.puts).toEqual([{ prologue: true, tutorials: 0 }]);
    const offline = fakeApi({ signedIn: false });
    recordEntry(offline, (s) => markTutorialDone(s, 1, T));
    expect(offline.puts).toEqual([]);
  });
});
