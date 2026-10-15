/**
 * Cross-process lock + atomic replace for the media budget ledger (content/budget/media_budget.json).
 * The lock is an exclusive-create lockfile (`open(..., 'wx')`), which is atomic on NTFS and POSIX filesystems, so two
 * `gen_image` / `media_budget` processes (or two async callers in one process) can never interleave a read-modify-write.
 * Writes go to a temp file and are renamed over the ledger, so a crash never leaves half-written JSON.
 */
import { closeSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import type { MediaBudget } from '@uomd/shared';

export interface LockOptions {
  /** give up after this long (ms) */
  timeoutMs?: number;
  /** a lockfile older than this (ms) is treated as left behind by a crashed process */
  staleMs?: number;
  /** base retry delay (ms); jitter is added */
  retryMs?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
let tmpSeq = 0;

export async function withFileLock<T>(file: string, fn: () => Promise<T> | T, o: LockOptions = {}): Promise<T> {
  const lock = `${file}.lock`;
  const deadline = Date.now() + (o.timeoutMs ?? 15_000);
  for (;;) {
    try {
      const fd = openSync(lock, 'wx');
      writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      closeSync(fd);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      try {
        // shortcut: a crashed holder cannot release; the window is long compared to a ledger update (milliseconds)
        if (Date.now() - statSync(lock).mtimeMs > (o.staleMs ?? 120_000)) {
          rmSync(lock, { force: true });
          continue;
        }
      } catch {
        continue; // released between open and stat
      }
      if (Date.now() > deadline) throw new Error(`budget ledger is locked by another process (${lock}); retry later or remove a stale lock`, { cause: e });
      const base = o.retryMs ?? 20;
      await sleep(base + Math.floor(Math.random() * base));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lock, { force: true });
  }
}

export const readBudget = (file: string): MediaBudget => JSON.parse(readFileSync(file, 'utf8')) as MediaBudget;

export function writeBudget(file: string, b: MediaBudget): void {
  const tmp = `${file}.${process.pid}.${Date.now()}.${++tmpSeq}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(b, null, 2)}\n`);
  renameSync(tmp, file);
}

/** Locked read-modify-write. `fn` returns the new ledger (written only if it changed) and a value for the caller. */
export async function updateBudget<T>(file: string, fn: (b: MediaBudget) => Promise<{ budget: MediaBudget; value: T }> | { budget: MediaBudget; value: T }, o?: LockOptions): Promise<T> {
  return withFileLock(
    file,
    async () => {
      const current = readBudget(file);
      const { budget, value } = await fn(current);
      if (budget !== current) writeBudget(file, budget);
      return value;
    },
    o
  );
}
