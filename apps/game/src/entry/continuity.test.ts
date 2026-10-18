import { beforeEach, describe, expect, it } from 'vitest';
import { emptyContinuity, loadContinuity, newer, onContinuityChange, parseContinuity, syncContinuity, type Continuity, type ContinuityApi } from './continuity';
import { clearFlowCheckpoint, loadFlowCheckpoint, loadStoryCheckpoint, saveFlowCheckpoint, saveStoryCheckpoint } from './resume';
import { endReplay, loadEntry, markPrologueSeen, resetEntryCache, saveEntry, startReplay } from './state';
import { recordEntry, type EntryApi } from './sync';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v))
  };
}

const state = { sceneId: 's1', index: 4, choices: ['a'] };

/** an in-memory cloud save with compare-and-set, like /api/v1/save */
function fakeCloud(initial: Record<string, unknown> = {}): ContinuityApi & { data: Record<string, unknown>; version: number; writes: number; race?: () => void } {
  const cloud = {
    signedIn: true,
    data: initial,
    version: Object.keys(initial).length ? 1 : 0,
    writes: 0,
    race: undefined as (() => void) | undefined,
    readSave: async () => ({ version: cloud.version, data: structuredClone(cloud.data) }),
    writeSaveDirect: async (expected: number, data: Record<string, unknown>) => {
      cloud.race?.();
      cloud.race = undefined;
      if (expected !== cloud.version) throw Object.assign(new Error('conflict'), { code: 'save_conflict' });
      cloud.writes++;
      cloud.data = structuredClone(data);
      cloud.version++;
      return { version: cloud.version };
    }
  };
  return cloud;
}

describe('R09 continuity', () => {
  beforeEach(() => {
    globalThis.localStorage = memoryStorage();
    globalThis.sessionStorage = memoryStorage();
    resetEntryCache();
    onContinuityChange(null);
  });

  it('every change bumps seq, cursor moves are urgent, line marks are not', () => {
    const pushes: boolean[] = [];
    onContinuityChange((_key, urgent) => pushes.push(urgent));
    saveFlowCheckpoint('player:a', { kind: 'campaign', nodeId: 'stage_1_1', step: 'pre_story' });
    saveStoryCheckpoint('player:a', { path: 'story/a.json', sceneId: 's1', sceneHash: 'h1', checkpointId: 'l4', state });
    clearFlowCheckpoint('player:a');
    expect(loadContinuity('player:a').seq).toBe(3);
    expect(pushes).toEqual([true, false, true]);
  });

  it('a scene mark only resumes the exact scene it was written in, and stays per account', () => {
    saveStoryCheckpoint('player:a', { path: 'story/a.json', sceneId: 's1', sceneHash: 'h1', state });
    expect(loadStoryCheckpoint('player:a', 'story/a.json', 's1', 'h1')?.state).toEqual(state);
    expect(loadStoryCheckpoint('player:a', 'story/a.json', 's1', 'h2')).toBeNull(); // the release changed the scene: it restarts
    expect(loadStoryCheckpoint('player:a', 'story/a.json', 's2', 'h1')).toBeNull();
    expect(loadStoryCheckpoint('player:b', 'story/a.json', 's1', 'h1')).toBeNull();
  });

  it('folds the pre-R09 flow and story keys in once', () => {
    localStorage.setItem('uomd.flow.checkpoint.v1:player:a', JSON.stringify({ kind: 'tutorial', index: 2, step: 'post_story', updatedAt: '2026-10-01T00:00:00.000Z' }));
    localStorage.setItem('uomd.story.checkpoint.v1:player:a', JSON.stringify({ 'story/t2.json': { path: 'story/t2.json', sceneId: 's1', state, updatedAt: '2026-10-01T00:00:00.000Z' } }));
    expect(loadFlowCheckpoint('player:a')).toMatchObject({ kind: 'tutorial', index: 2, step: 'post_story' });
    expect(loadStoryCheckpoint('player:a', 'story/t2.json', 's1', 'any')?.state).toEqual(state); // legacy marks carry no hash
    expect(localStorage.getItem('uomd.flow.checkpoint.v1:player:a')).toBeNull();
    expect(loadContinuity('player:a').seq).toBe(1);
  });

  it('rejects other versions and malformed records instead of throwing', () => {
    for (const bad of [null, 1, 'x', { v: 2, seq: 1 }, { v: 1, seq: -1 }, { v: 1, seq: 1.5 }]) expect(parseContinuity(bad)).toBeNull();
    const parsed = parseContinuity({ v: 1, seq: 3, cursor: { kind: 'campaign', nodeId: 'n', step: 'fly' }, stories: { x: { path: 'x', sceneId: 's', state: { sceneId: 'other', index: 0, choices: [] } } } });
    expect(parsed).toMatchObject({ seq: 3, cursor: null, stories: {} });
  });

  it('the newer record wins between device and cloud', () => {
    const a: Continuity = { ...emptyContinuity(), seq: 5, updatedAt: '2026-10-01T00:00:00.000Z' };
    const b: Continuity = { ...emptyContinuity(), seq: 4, updatedAt: '2026-10-09T00:00:00.000Z' };
    expect(newer(a, b)).toBe(a);
    expect(newer({ ...b, seq: 5 }, a).updatedAt).toBe(b.updatedAt);
  });

  it('pushes a newer device record and keeps the rest of the cloud save', async () => {
    const cloud = fakeCloud({ prefs: { textSize: 'large' } });
    saveFlowCheckpoint('player:a', { kind: 'campaign', nodeId: 'stage_1_2', step: 'battle' });
    expect(await syncContinuity(cloud, 'player:a')).toBe('synced');
    expect(cloud.data.prefs).toEqual({ textSize: 'large' });
    expect(parseContinuity(cloud.data.continuity)?.cursor).toMatchObject({ nodeId: 'stage_1_2', step: 'battle' });
    expect(await syncContinuity(cloud, 'player:a')).toBe('synced');
    expect(cloud.writes).toBe(1); // already in step: no second write
  });

  it('adopts a newer cloud record (another device, a reinstall) without re-sending it', async () => {
    const remote = { ...emptyContinuity(), seq: 9, cursor: { kind: 'campaign' as const, nodeId: 'stage_2_1', step: 'post_story' as const, updatedAt: '2026-10-02T00:00:00.000Z' }, updatedAt: '2026-10-02T00:00:00.000Z' };
    const cloud = fakeCloud({ continuity: remote });
    saveFlowCheckpoint('player:a', { kind: 'campaign', nodeId: 'stage_1_1', step: 'pre_story' }); // seq 1 on this device
    expect(await syncContinuity(cloud, 'player:a')).toBe('synced');
    expect(loadFlowCheckpoint('player:a')).toMatchObject({ nodeId: 'stage_2_1', step: 'post_story' });
    expect(loadContinuity('player:a').seq).toBe(9);
    expect(cloud.writes).toBe(0);
  });

  it('a concurrent write from another device is re-read and merged', async () => {
    const cloud = fakeCloud({ prefs: { a: 1 } });
    saveFlowCheckpoint('player:a', { kind: 'campaign', nodeId: 'stage_1_3', step: 'battle' });
    cloud.race = () => {
      cloud.data = { ...cloud.data, prefs: { a: 2 } };
      cloud.version++;
    };
    expect(await syncContinuity(cloud, 'player:a')).toBe('synced');
    expect(cloud.data.prefs).toEqual({ a: 2 });
    expect(parseContinuity(cloud.data.continuity)?.cursor).toMatchObject({ nodeId: 'stage_1_3' });
  });

  it('offline and signed-out syncs leave the device record alone', async () => {
    saveFlowCheckpoint('player:a', { kind: 'tutorial', index: 1, step: 'battle' });
    const down: ContinuityApi = { signedIn: true, readSave: () => Promise.reject(new Error('offline')), writeSaveDirect: () => Promise.reject(new Error('offline')) };
    expect(await syncContinuity(down, 'player:a')).toBe('offline');
    expect(await syncContinuity({ ...down, signedIn: false }, 'player:a')).toBe('signed_out');
    expect(loadFlowCheckpoint('player:a')).toMatchObject({ kind: 'tutorial', index: 1 });
  });

  it('a title replay of the opening never moves the account entry checkpoint', () => {
    const pushed: unknown[] = [];
    const api: EntryApi = {
      signedIn: true,
      entry: async () => ({ playerId: 'p1', phase: 'completed', prologue: true, tutorials: 3, updatedAt: null }),
      putEntry: async (b) => {
        pushed.push(b);
        return { playerId: 'p1', phase: 'completed', prologue: true, tutorials: 3, updatedAt: null };
      }
    };
    saveEntry({ phase: 'completed', prologue: true, tutorials: 3, updatedAt: '2026-10-01T00:00:00.000Z' });
    startReplay();
    expect(loadEntry()).toMatchObject({ phase: 'not_started', tutorials: 0 });
    recordEntry(api, (s) => markPrologueSeen(s));
    expect(loadEntry()).toMatchObject({ phase: 'in_progress', prologue: true });
    expect(pushed).toEqual([]);
    endReplay();
    expect(loadEntry()).toMatchObject({ phase: 'completed', tutorials: 3 });
  });
});
