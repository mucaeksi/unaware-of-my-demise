import { describe, expect, it } from 'vitest';
import type { PatchProgress } from '@uomd/patch';
import { barFill } from '../patch/barFill';

const p = (over: Partial<PatchProgress>): PatchProgress => ({ phase: 'downloading', releaseId: 'rel_0004', filesDone: 0, filesTotal: 2, bytesDone: 0, bytesTotal: 200, ...over });

describe('patch bar fill', () => {
  it('is indeterminate while checking and before totals are known', () => {
    expect(barFill({ kind: 'running', progress: null })).toBeNull();
    expect(barFill({ kind: 'running', progress: p({ phase: 'checking', bytesTotal: 0 }) })).toBeNull();
  });
  it('follows the bytes while downloading and never exceeds 1', () => {
    expect(barFill({ kind: 'running', progress: p({ bytesDone: 50 }) })).toBe(0.25);
    expect(barFill({ kind: 'running', progress: p({ bytesDone: 999 }) })).toBe(1);
    expect(barFill({ kind: 'running', progress: p({ bytesTotal: 0 }) })).toBe(0); // nothing to fetch yet
  });
  it('is full while verifying/activating and when ready', () => {
    expect(barFill({ kind: 'running', progress: p({ phase: 'verifying' }) })).toBe(1);
    expect(barFill({ kind: 'running', progress: p({ phase: 'activating' }) })).toBe(1);
    expect(barFill({ kind: 'ready', outcome: { status: 'up_to_date', releaseId: null } })).toBe(1);
  });
});
