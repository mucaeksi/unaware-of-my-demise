import type { OperationRecord } from '../net/operations';

export type ClaimPath = '/api/v1/progress/battle' | '/api/v1/progress/story';

/** The slice of the API client reconciliation needs (a fake in tests). */
export interface ClaimApi {
  readonly signedIn: boolean;
  operations(): Promise<OperationRecord[]>;
  retryOperation<T>(id: string): Promise<T>;
}

/**
 * R09: a battle win or story completion the server may already have committed (response lost, app killed before the
 * client moved on) is read back from the operations journal before anything is replayed. A claim that cannot be
 * confirmed yet (offline) blocks the replay, so combat is never fought twice and rewards are never asked for twice.
 * Only operations started after `since` (the cursor reaching this step) count.
 */
export async function committedClaim(api: ClaimApi, path: ClaimPath, nodeId: string, since: string): Promise<{ stars: number } | 'unconfirmed' | null> {
  if (!api.signedIn) return null;
  let ops: OperationRecord[];
  try {
    ops = await api.operations();
  } catch {
    return 'unconfirmed';
  }
  const op = ops.filter((o) => o.path === path && o.body.nodeId === nodeId && o.at >= Date.parse(since)).sort((a, b) => b.at - a.at)[0];
  if (!op || op.state === 'rejected') return null;
  try {
    const result = op.state === 'confirmed' ? op.result : await api.retryOperation(op.id);
    const stars = (result as { stars?: unknown } | null)?.stars;
    return { stars: typeof stars === 'number' ? stars : 0 };
  } catch {
    return 'unconfirmed';
  }
}
