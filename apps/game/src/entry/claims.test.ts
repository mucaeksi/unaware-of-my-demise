import { describe, expect, it } from 'vitest';
import type { OperationRecord } from '../net/operations';
import { committedClaim, type ClaimApi } from './claims';

const SINCE = '2026-10-18T10:00:00.000Z';
const at = (iso: string): number => Date.parse(iso);
const op = (o: Partial<OperationRecord>): OperationRecord => ({ id: 'op1', scope: 's', signature: 'x', payloadHash: 'h', method: 'POST', path: '/api/v1/progress/battle', body: { nodeId: 'stage_1_1' }, state: 'pending', attempts: 1, at: at('2026-10-18T10:05:00.000Z'), ...o });

function api(ops: OperationRecord[], retry: () => Promise<unknown> = async () => ({ stars: 2 })): ClaimApi & { retried: string[] } {
  const a = {
    signedIn: true,
    retried: [] as string[],
    operations: async () => ops,
    retryOperation: async <T,>(id: string): Promise<T> => {
      a.retried.push(id);
      return (await retry()) as T;
    }
  };
  return a;
}

describe('R09 post-commit reconciliation', () => {
  it('a confirmed win since the cursor resumes after the battle, with its stars, without asking the server again', async () => {
    const a = api([op({ state: 'confirmed', result: { stars: 3 } })]);
    expect(await committedClaim(a, '/api/v1/progress/battle', 'stage_1_1', SINCE)).toEqual({ stars: 3 });
    expect(a.retried).toEqual([]);
  });

  it('a pending claim (response lost) is replayed through the journal before deciding', async () => {
    const a = api([op({ state: 'pending' })]);
    expect(await committedClaim(a, '/api/v1/progress/battle', 'stage_1_1', SINCE)).toEqual({ stars: 2 });
    expect(a.retried).toEqual(['op1']);
  });

  it('an unconfirmable claim blocks a replay instead of fighting twice', async () => {
    const a = api([op({ state: 'pending' })], () => Promise.reject(new Error('offline')));
    expect(await committedClaim(a, '/api/v1/progress/battle', 'stage_1_1', SINCE)).toBe('unconfirmed');
    const down: ClaimApi = { signedIn: true, operations: () => Promise.reject(new Error('locked')), retryOperation: () => Promise.reject(new Error('x')) };
    expect(await committedClaim(down, '/api/v1/progress/battle', 'stage_1_1', SINCE)).toBe('unconfirmed');
  });

  it('no claim, a rejected claim, an older claim, another node or a signed-out player means the step is played', async () => {
    expect(await committedClaim(api([]), '/api/v1/progress/battle', 'stage_1_1', SINCE)).toBeNull();
    expect(await committedClaim(api([op({ state: 'rejected' })]), '/api/v1/progress/battle', 'stage_1_1', SINCE)).toBeNull();
    expect(await committedClaim(api([op({ state: 'confirmed', at: at('2026-10-17T00:00:00.000Z') })]), '/api/v1/progress/battle', 'stage_1_1', SINCE)).toBeNull();
    expect(await committedClaim(api([op({ state: 'confirmed', body: { nodeId: 'stage_9_9' } })]), '/api/v1/progress/battle', 'stage_1_1', SINCE)).toBeNull();
    expect(await committedClaim(api([op({ state: 'confirmed', path: '/api/v1/progress/story' })]), '/api/v1/progress/battle', 'stage_1_1', SINCE)).toBeNull();
    expect(await committedClaim({ ...api([op({ state: 'confirmed' })]), signedIn: false }, '/api/v1/progress/battle', 'stage_1_1', SINCE)).toBeNull();
  });

  it('the latest attempt decides when a node was tried more than once', async () => {
    const a = api([op({ id: 'old', state: 'rejected', at: at('2026-10-18T10:01:00.000Z') }), op({ id: 'new', state: 'confirmed', result: { stars: 1 } })]);
    expect(await committedClaim(a, '/api/v1/progress/battle', 'stage_1_1', SINCE)).toEqual({ stars: 1 });
  });
});
