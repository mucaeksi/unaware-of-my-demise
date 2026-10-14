import { beforeEach, describe, expect, it } from 'vitest';
import type { ChapterIndex } from '@uomd/content-schema';
import {
  clearFlowCheckpoint,
  clearPrologueCheckpoint,
  clearStoryCheckpoint,
  loadFlowCheckpoint,
  loadPrologueCheckpoint,
  loadReadLines,
  loadStoryCheckpoint,
  resolveNextCampaignNode,
  saveFlowCheckpoint,
  savePrologueCheckpoint,
  saveReadLines,
  saveStoryCheckpoint
} from './resume';
import { freshEntry, loadEntry, markCompleted, markPrologueSeen, markTutorialDone, mergeEntry, nextStep, parseEntry, saveEntry } from './state';
import { confirmEntryComplete, type EntryApi } from './sync';

const T0 = '2026-10-11T10:00:00.000Z';
const T1 = '2026-10-11T10:05:00.000Z';

function installMemoryStorage(): void {
  const mk = (): Storage => {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (k: string) => map.get(k) ?? null,
      key: (i: number) => [...map.keys()][i] ?? null,
      removeItem: (k: string) => {
        map.delete(k);
      },
      setItem: (k: string, v: string) => {
        map.set(k, v);
      }
    };
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mk(), configurable: true, writable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: mk(), configurable: true, writable: true });
}

describe('entry state machine', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('walks prologue -> T-1 -> T-2 -> T-3 -> finish -> menu', () => {
    let s = freshEntry();
    expect(nextStep(s)).toEqual({ kind: 'prologue' });
    s = markPrologueSeen(s, T0);
    expect(s.phase).toBe('in_progress');
    expect(nextStep(s)).toEqual({ kind: 'tutorial', index: 1 });
    s = markTutorialDone(s, 1, T0);
    expect(nextStep(s)).toEqual({ kind: 'tutorial', index: 2 });
    s = markTutorialDone(s, 2, T0);
    s = markTutorialDone(s, 3, T0);
    expect(nextStep(s)).toEqual({ kind: 'finish' });
    s = markCompleted(s, T1);
    expect(nextStep(s)).toEqual({ kind: 'menu' });
  });

  it('records tutorials strictly in order and never moves back on replays', () => {
    let s = markPrologueSeen(freshEntry(), T0);
    expect(markTutorialDone(s, 2, T0)).toBe(s); // skipping ahead is ignored
    s = markTutorialDone(s, 1, T0);
    expect(markTutorialDone(s, 1, T1)).toBe(s); // replay of T-1 changes nothing
    expect(markTutorialDone(s, 4, T1)).toBe(s);
    expect(s.tutorials).toBe(1);
  });

  it('a finished entry cannot be reopened by later marks', () => {
    const done = markCompleted(freshEntry(), T0);
    expect(markPrologueSeen(done, T1)).toBe(done);
    expect(markTutorialDone(done, 1, T1)).toBe(done);
  });

  it('merge keeps the furthest progress, newest wins a tie', () => {
    const a = markTutorialDone(markPrologueSeen(freshEntry(), T0), 1, T0);
    const b = markPrologueSeen(freshEntry(), T1);
    expect(mergeEntry(a, b)).toBe(a);
    expect(mergeEntry(b, a)).toBe(a);
    const c = markPrologueSeen(freshEntry(), T1);
    expect(mergeEntry(b, c)).toBe(b);
    const done = markCompleted(freshEntry(), T0);
    expect(mergeEntry(a, done)).toBe(done);
  });

  it('parse is defensive', () => {
    expect(parseEntry(null)).toEqual(freshEntry());
    expect(parseEntry('x')).toEqual(freshEntry());
    expect(parseEntry({ phase: 'completed' }).tutorials).toBe(3);
    expect(parseEntry({ phase: 'weird', tutorials: 99 }).tutorials).toBe(3);
    expect(parseEntry({ tutorials: -4 }).tutorials).toBe(0);
    expect(parseEntry({ tutorials: 2 }).prologue).toBe(true);
    expect(parseEntry({ tutorials: 2 }).phase).toBe('in_progress');
  });

  it('confirmEntryComplete enforces prerequisites and waits for remote confirmation when signed in', async () => {
    saveEntry(markTutorialDone(markPrologueSeen(freshEntry(), T0), 1, T0));
    const offlineApi: EntryApi = {
      signedIn: false,
      entry: async () => ({ playerId: 'p1', phase: 'not_started', prologue: false, tutorials: 0, updatedAt: null }),
      putEntry: async () => {
        throw new Error('should not call');
      }
    };
    await expect(confirmEntryComplete(offlineApi)).rejects.toThrow(/prerequisites/i);
    expect(loadEntry().phase).toBe('in_progress');

    // Finish all 3 tutorials; signed-in failure must keep local state in_progress so reload returns to FinishScene
    let ready = markPrologueSeen(freshEntry(), T0);
    ready = markTutorialDone(ready, 1, T0);
    ready = markTutorialDone(ready, 2, T0);
    ready = markTutorialDone(ready, 3, T0);
    saveEntry(ready);

    let shouldFail = true;
    const signedInApi: EntryApi = {
      signedIn: true,
      entry: async () => ({ playerId: 'p1', phase: 'in_progress', prologue: true, tutorials: 3, updatedAt: T0 }),
      putEntry: async (b) => {
        if (shouldFail) throw new Error('network down');
        return {
          playerId: 'p1',
          phase: b.completed ? 'completed' : 'in_progress',
          prologue: b.prologue,
          tutorials: b.tutorials,
          updatedAt: T1
        };
      }
    };
    await expect(confirmEntryComplete(signedInApi)).rejects.toThrow('network down');
    expect(loadEntry().phase).toBe('in_progress');

    shouldFail = false;
    const ok = await confirmEntryComplete(signedInApi);
    expect(ok.remoteConfirmed).toBe(true);
    expect(loadEntry().phase).toBe('completed');
  });

  it('isolates read lines, prologue, story, and flow checkpoints per accountKey and resolves next campaign node truthfully', () => {
    saveReadLines('player:a', new Set(['l1', 'l2']));
    saveReadLines('player:b', new Set(['l9']));
    expect([...loadReadLines('player:a')]).toEqual(['l1', 'l2']);
    expect([...loadReadLines('player:b')]).toEqual(['l9']);

    savePrologueCheckpoint('player:a', 4, T0);
    expect(loadPrologueCheckpoint('player:a', 9)).toBe(4);
    expect(loadPrologueCheckpoint('player:a', 4)).toBeNull();
    expect(loadPrologueCheckpoint('player:b', 9)).toBeNull();
    clearPrologueCheckpoint('player:a');
    expect(loadPrologueCheckpoint('player:a', 9)).toBeNull();

    saveStoryCheckpoint('player:a', {
      path: 'story/t1.json',
      sceneId: 's_t1',
      checkpointId: 'cp1',
      state: { sceneId: 's_t1', index: 3, choices: ['opt_a'] }
    });
    expect(loadStoryCheckpoint('player:a', 'story/t1.json', 's_t1')?.state).toEqual({
      sceneId: 's_t1',
      index: 3,
      choices: ['opt_a']
    });
    expect(loadStoryCheckpoint('player:b', 'story/t1.json', 's_t1')).toBeNull();
    clearStoryCheckpoint('player:a', 'story/t1.json');
    expect(loadStoryCheckpoint('player:a', 'story/t1.json', 's_t1')).toBeNull();

    const idx: ChapterIndex = {
      schema_version: 1,
      chapters: [
        {
          chapter_id: 'tutorial',
          title_en: 'Before the Road',
          nodes: [{ node_id: 't1', title_en: 'The First Step', kind: 'battle', encounter: 'encounters/tutorial_t1.json' }]
        },
        {
          chapter_id: 'ch01_whispering_ash_forest',
          title_en: 'Whispering Ash Forest',
          nodes: [
            { node_id: 'opening_sad_scene', title_en: 'A Letter the Rain Could Not Keep', kind: 'story', story: 'story/opening_sad_scene.json' },
            { node_id: 'stage_1_1', title_en: 'The Road That Whispers', kind: 'battle', encounter: 'encounters/stage_1_1.json', requires: 'opening_sad_scene' }
          ]
        }
      ]
    };

    // After first restart with 0 campaign progress, Continue selects opening_sad_scene (not tutorial t1), leaving stage_1_1 unstarted
    expect(resolveNextCampaignNode(idx, {}, 'player:a')?.node_id).toBe('opening_sad_scene');
    // Once opening_sad_scene is complete, Continue selects stage_1_1
    expect(resolveNextCampaignNode(idx, { opening_sad_scene: { stars: 0 } }, 'player:a')?.node_id).toBe('stage_1_1');
    // When stage_1_1 is already marked complete in progress but has a pending post_story FlowCheckpoint, Continue resumes stage_1_1 post_story
    saveFlowCheckpoint('player:a', { kind: 'campaign', nodeId: 'stage_1_1', step: 'post_story', stars: 3 }, T0);
    expect(resolveNextCampaignNode(idx, { opening_sad_scene: { stars: 0 }, stage_1_1: { stars: 3 } }, 'player:a')?.node_id).toBe('stage_1_1');
    clearFlowCheckpoint('player:a');
    expect( loadFlowCheckpoint('player:a') ).toBeNull();
  });
});

