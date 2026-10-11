import type { PatchStatus } from './PatchService';

/** The 0..1 fill of the bar for a status (null = indeterminate). Exported for tests. */
export function barFill(s: PatchStatus): number | null {
  if (s.kind === 'ready') return 1;
  if (s.kind !== 'running' || !s.progress) return null;
  const p = s.progress;
  if (p.phase === 'verifying' || p.phase === 'activating') return 1;
  return p.bytesTotal > 0 ? Math.min(1, p.bytesDone / p.bytesTotal) : p.phase === 'checking' ? null : 0;
}
