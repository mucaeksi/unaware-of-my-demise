import type { ApplyOptions, PatchOutcome, PatchProgress } from '@uomd/patch';
import { describe, expect, it } from 'vitest';
import { PatchService, type PatchSource, type PatchStatus } from './PatchService';

const prog = (bytesDone: number): PatchProgress => ({ phase: 'downloading', releaseId: 'rel_0004', filesDone: 0, filesTotal: 2, bytesDone, bytesTotal: 100 });

function source(outcomes: (PatchOutcome | Error)[], ticks: number[] = []): PatchSource & { calls: ApplyOptions[] } {
  const calls: ApplyOptions[] = [];
  return {
    calls,
    checkForUpdates: (opts) => {
      calls.push(opts ?? {});
      for (const t of ticks) opts?.onProgress?.(prog(t));
      const next = outcomes.shift();
      if (!next) return Promise.reject(new Error('no outcome queued'));
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    }
  };
}

const staged: PatchOutcome = { status: 'staged', releaseId: 'rel_0004', generation: 4, downloadedBytes: 100, downloadedFiles: 2 };

describe('PatchService', () => {
  it('stages (never activates) in the background and reports progress then ready', async () => {
    const src = source([staged], [10, 60, 100]);
    const svc = new PatchService(() => src);
    const seen: PatchStatus[] = [];
    svc.subscribe((s) => seen.push(s));
    expect(seen[0]?.kind).toBe('idle');
    const done = await svc.start();
    expect(src.calls[0]?.activate).toBe(false);
    expect(done.kind).toBe('ready');
    const running = seen.filter((s): s is Extract<PatchStatus, { kind: 'running' }> => s.kind === 'running');
    expect(running.length).toBeGreaterThanOrEqual(2);
    expect(running.map((r) => r.progress?.bytesDone ?? 0)).toEqual([...running.map((r) => r.progress?.bytesDone ?? 0)].sort((a, b) => a - b));
    expect(seen.at(-1)?.kind).toBe('ready');
  });

  it('start() is idempotent while running and after completion', async () => {
    const src = source([staged]);
    const svc = new PatchService(() => src);
    const a = svc.start();
    const b = svc.start();
    expect(a).toBe(b);
    await a;
    await svc.start();
    expect(src.calls).toHaveLength(1);
  });

  it('a nothing-newer-published run is ready, not an error', async () => {
    const svc = new PatchService(() => source([{ status: 'up_to_date', releaseId: null }]));
    expect((await svc.start()).kind).toBe('ready');
  });

  it('offline and exceptions fail with a retry path; a retry can succeed', async () => {
    const src = source([{ status: 'offline', detail: 'x' }, new Error('boom'), staged]);
    const svc = new PatchService(() => src);
    expect(await svc.start()).toMatchObject({ kind: 'failed', detail: 'no connection', updateRequired: false });
    expect(await svc.retry()).toMatchObject({ kind: 'failed', detail: 'boom' });
    expect((await svc.retry()).kind).toBe('ready');
    expect(src.calls).toHaveLength(3);
  });

  it('a release this binary can never apply asks for an app update instead of a retry loop', async () => {
    const svc = new PatchService(() => source([{ status: 'rejected', reason: 'client_too_old', detail: 'needs >= 0.3.0' }]));
    expect(await svc.start()).toMatchObject({ kind: 'failed', updateRequired: true });
  });

  it('fails cleanly when the content service does not exist yet', async () => {
    const svc = new PatchService(() => null);
    expect(await svc.start()).toMatchObject({ kind: 'failed' });
  });
});
