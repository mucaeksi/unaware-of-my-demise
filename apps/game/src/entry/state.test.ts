import { describe, expect, it } from 'vitest';
import { freshEntry, markCompleted, markPrologueSeen, markTutorialDone, mergeEntry, nextStep, parseEntry } from './state';

const T0 = '2026-10-11T10:00:00.000Z';
const T1 = '2026-10-11T10:05:00.000Z';

describe('entry state machine', () => {
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
});
