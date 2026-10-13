import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameApi } from './api';
import { OperationJournal, type OperationRecord, type OperationStorage } from './operations';
import { canonicalJson, sha256Hex } from '@uomd/shared';

class TestOperationStorage implements OperationStorage {
  records: OperationRecord[] = [];
  failWrites = false;
  async change<T>(work: (records: OperationRecord[]) => T): Promise<T> {
    const next = structuredClone(this.records); const value = work(next);
    if (this.failWrites) throw new Error('storage write failed');
    this.records = next; return structuredClone(value);
  }
}
const pullResult = (body: string, extra = {}) => {
  const request = JSON.parse(body);
  return Response.json({ requestId: request.requestId, pulls: Array.from({ length: request.count }, () => ({ itemId: 'mahmut' })), balance: 0, ...extra });
};

const values = new Map<string, string>();
const sessionKey = 'uomd.session.v1';
const expiry = () => new Date(Date.now() + 3_600_000).toISOString();
const success = (token = 'session-B') => Response.json({ token, expiresAt: expiry(), player: { id: 'player-B', displayName: null, isNew: false } });
const deferred = () => {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => {
  values.clear(); values.set(sessionKey, JSON.stringify({ token: 'session-A', expiresAt: expiry() }));
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

describe('authentication response ownership', () => {
  it('an old unauthorized response cannot sign a newer account out', async () => {
    const delayed = deferred(); const fetch = vi.fn().mockReturnValueOnce(delayed.promise).mockResolvedValueOnce(success()).mockResolvedValueOnce(Response.json({ id: 'player-B' }));
    vi.stubGlobal('fetch', fetch); const api = new GameApi('https://game.test');
    const old = api.me(); const rejected = expect(old).rejects.toMatchObject({ status: 401 });
    await api.signInWithIdToken('identity-B'); delayed.resolve(Response.json({ error: 'unauthorized' }, { status: 401 })); await rejected;
    expect(api.signedIn).toBe(true); await api.me();
    expect(fetch.mock.calls[2]![1].headers.Authorization).toBe('Bearer session-B');
  });

  it('a delayed logout does not erase a newly signed-in session', async () => {
    const delayed = deferred(); vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(delayed.promise).mockResolvedValueOnce(success()));
    const api = new GameApi('https://game.test'); const logout = api.signOut();
    await api.signInWithIdToken('identity-B'); delayed.resolve(Response.json({ ok: true })); await logout;
    expect(api.signedIn).toBe(true); expect(JSON.parse(values.get(sessionKey)!).token).toBe('session-B');
  });

  it('a slower sign-in cannot replace the account selected by a later sign-in', async () => {
    const delayed = deferred(); vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(delayed.promise).mockResolvedValueOnce(success()));
    const api = new GameApi('https://game.test'); const older = api.signInWithIdToken('identity-old');
    const rejected = expect(older).rejects.toMatchObject({ code: 'auth_changed' });
    await api.signInWithIdToken('identity-B'); delayed.resolve(success('session-old')); await rejected;
    expect(JSON.parse(values.get(sessionKey)!).token).toBe('session-B');
  });

  it('deleting the previous account cannot clear the current account session', async () => {
    const delayed = deferred(); vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(delayed.promise).mockResolvedValueOnce(success()));
    const api = new GameApi('https://game.test'); const deletion = api.deleteAccount();
    await api.signInWithIdToken('identity-B'); delayed.resolve(Response.json({ deleted: true })); await deletion;
    expect(api.signedIn).toBe(true); expect(JSON.parse(values.get(sessionKey)!).token).toBe('session-B');
  });
});

describe('durable client operations', () => {
  it('mail response loss preserves the original account-scoped claim across reload', async () => {
    const storage = new TestOperationStorage(); const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      sent.push(init.body as string); if (sent.length === 1) throw new TypeError('claim response lost');
      return Response.json({ requestId: JSON.parse(init.body as string).requestId, mailId: 42, claimed: [] });
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.claimMail(42)).rejects.toThrow();
    await new GameApi('https://game.test', new OperationJournal(storage)).claimMail(42);
    expect(sent[1]).toBe(sent[0]); expect(storage.records[0]!.state).toBe('confirmed');
  });

  it('a definite first task rejection does not block the next window or masquerade as success', async () => {
    const storage = new TestOperationStorage(); const ids: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      const input = JSON.parse(init.body as string); ids.push(input.requestId);
      if (ids.length === 1) return Response.json({ error: 'not_done' }, { status: 409 });
      return Response.json({ ...input, rewards: [] });
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.claimTask('d:old_window', 'task')).rejects.toMatchObject({ code: 'not_done' });
    expect(storage.records[0]!.state).toBe('rejected');
    await api.claimTask('d:new_window', 'task');
    expect(ids[0]).not.toBe(ids[1]); expect(storage.records[1]!.state).toBe('confirmed');
  });

  it('authoritative status recovers a committed action without another POST and replaces an untrusted cached result', async () => {
    const storage = new TestOperationStorage(); let body = ''; let posts = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      if (url.includes('/operations/')) {
        const input = JSON.parse(body);
        return Response.json({ requestId: input.requestId, path: '/api/v1/gacha/pull', state: 'confirmed', binding: 'exact', inputHash: await sha256Hex(canonicalJson(input)), result: await pullResult(body, { balance: 160, replayed: true }).json() });
      }
      posts++; body = init.body as string; throw new TypeError('response lost');
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.pull('banner', 1)).rejects.toThrow(); const id = storage.records[0]!.id;
    const reload = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(reload.retryOperation(id)).resolves.toMatchObject({ balance: 160 });
    storage.records[0]!.result = { balance: 999 };
    await expect(reload.retryOperation(id)).resolves.toMatchObject({ balance: 160 });
    expect(storage.records[0]!.result).toMatchObject({ balance: 160 }); expect(posts).toBe(1);
  });

  it('legacy or mismatched status proof cannot confirm the pending action or send a new mutation', async () => {
    const storage = new TestOperationStorage(); let proof = 'legacy'; let posts = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      if (url.includes('/operations/')) {
        const record = storage.records[0]!;
        return Response.json({ requestId: record.id, path: record.path, state: 'confirmed', binding: proof, inputHash: proof === 'legacy' ? null : '0'.repeat(64), result: { requestId: record.id, pulls: [{}] } });
      }
      posts++; throw new TypeError('unknown result');
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.pull('banner', 1)).rejects.toThrow(); const id = storage.records[0]!.id;
    await expect(api.retryOperation(id)).rejects.toMatchObject({ code: 'operation_unverified' });
    proof = 'exact'; await expect(api.retryOperation(id)).rejects.toMatchObject({ code: 'operation_unverified' });
    expect(storage.records[0]!.state).toBe('pending'); expect(posts).toBe(1);
  });

  it('unknown status retries only the original saved payload and identity', async () => {
    const storage = new TestOperationStorage(); const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      if (url.includes('/operations/')) { const record = storage.records[0]!; return Response.json({ requestId: record.id, path: record.path, state: 'unknown', binding: null, inputHash: null, result: null }); }
      sent.push(init.body as string); if (sent.length === 1) throw new TypeError('request may not have arrived');
      return pullResult(init.body as string);
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.pull('banner', 1)).rejects.toThrow();
    await api.retryOperation(storage.records[0]!.id); expect(sent[1]).toBe(sent[0]);
  });

  it('gear upgrades also save their original inputs before transport', async () => {
    const storage = new TestOperationStorage(); let sent = '';
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      sent = init.body as string; return Response.json({ id: 42, level: 2 });
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.levelGear(42, 50)).resolves.toMatchObject({ id: 42, level: 2 });
    expect(storage.records[0]).toMatchObject({ state: 'confirmed', path: '/api/v1/gear/42/level-up', body: { xp: 50 } });
    expect(JSON.parse(sent).requestId).toBe(storage.records[0]!.id);
  });

  it('a gear response without its growth result cannot be recorded as confirmed', async () => {
    const storage = new TestOperationStorage();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.endsWith('/me') ? { id: 'player-A' } : { id: 42 })));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.levelGear(42, 50)).rejects.toMatchObject({ code: 'invalid_response' });
    expect(storage.records[0]!.state).toBe('pending');
  });

  it('post-commit response loss and reload retry use the original request ID and confirm one result', async () => {
    const storage = new TestOperationStorage(); const bodies: string[] = []; let lost = false;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      bodies.push(init.body as string);
      if (!lost) { lost = true; throw new TypeError('response lost after commit'); }
      return pullResult(init.body as string, { replayed: true });
    }));
    const first = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(first.pull('banner', 1)).rejects.toThrow(/response lost/);
    expect(storage.records[0]).toMatchObject({ state: 'pending', attempts: 1 });
    const reload = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(reload.pull('banner', 1)).resolves.toMatchObject({ replayed: true });
    expect(bodies[1]).toBe(bodies[0]); expect(storage.records[0]!.state).toBe('confirmed');
    expect(JSON.stringify(storage.records)).not.toContain('session-A');
  });

  it('simultaneous identical taps share one identity and one transport call; a later confirmed intent gets a new ID', async () => {
    const storage = new TestOperationStorage(); const delayed = deferred(); const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Promise.resolve(Response.json({ id: 'player-A' }));
      sent.push(init.body as string); return sent.length === 1 ? delayed.promise : Promise.resolve(pullResult(init.body as string));
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    const taps = Array.from({ length: 5 }, () => api.pull('banner', 1));
    await vi.waitFor(() => expect(sent).toHaveLength(1)); delayed.resolve(pullResult(sent[0]!));
    await Promise.all(taps); expect(sent).toHaveLength(1);
    await api.pull('banner', 1); expect(sent).toHaveLength(2);
    expect(JSON.parse(sent[0]!).requestId).not.toBe(JSON.parse(sent[1]!).requestId);
  });

  it('failed persistence sends no mutation and unknown input cannot silently turn into a new action', async () => {
    const storage = new TestOperationStorage(); storage.failWrites = true;
    const fetch = vi.fn(async (_url: string) => Response.json({ id: 'player-A' })); vi.stubGlobal('fetch', fetch);
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.pull('banner', 1)).rejects.toMatchObject({ code: 'operation_not_saved' });
    expect(fetch).toHaveBeenCalledTimes(1); // account read only
    storage.failWrites = false;
    fetch.mockImplementation(async (url: string) => { if (url.endsWith('/me')) return Response.json({ id: 'player-A' }); throw new TypeError('unknown result'); });
    await expect(api.pull('banner', 1)).rejects.toThrow(/unknown/);
    const before = fetch.mock.calls.length;
    await expect(api.pull('different_banner', 10)).rejects.toMatchObject({ code: 'operation_not_saved' });
    expect(fetch.mock.calls.length).toBe(before);
  });

  it('a saved operation never replays against another verified account or backend', async () => {
    const storage = new TestOperationStorage(); const mutation = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      mutation(); throw new TypeError('unknown result');
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.pull('banner', 1)).rejects.toThrow(); const id = storage.records[0]!.id;
    vi.stubGlobal('fetch', vi.fn(async () => success())); await api.signInWithIdToken('identity-B');
    await expect(api.retryOperation(id)).rejects.toMatchObject({ code: 'operation_missing' });
    const otherBackend = new GameApi('https://other.test', new OperationJournal(storage));
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'player-A' })));
    await expect(otherBackend.retryOperation(id)).rejects.toMatchObject({ code: 'operation_missing' });
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it('payload mutation by the caller cannot change the body saved before a delayed transport', async () => {
    const storage = new TestOperationStorage(); const profile = deferred(); let sent = '';
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return profile.promise;
      sent = init.body as string; return Response.json({ character: 'mahmut', level: 2 });
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage)); const items = [{ itemId: 'book', quantity: 1 }];
    const upgrading = api.levelUp('mahmut', items); items[0]!.quantity = 9;
    profile.resolve(Response.json({ id: 'player-A' })); await upgrading;
    expect(JSON.parse(sent).items).toEqual([{ itemId: 'book', quantity: 1 }]);
  });

  it('unconfirmed success shapes stay pending and previous-account results cannot update the new account', async () => {
    const storage = new TestOperationStorage(); const delayed = deferred(); let sent = '';
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      if (url.endsWith('/google')) return success();
      sent = init.body as string; return delayed.promise;
    }); vi.stubGlobal('fetch', fetch);
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    const buying = api.pull('banner', 1); const rejected = expect(buying).rejects.toMatchObject({ code: 'auth_changed' });
    await vi.waitFor(() => expect(sent).not.toBe('')); await api.signInWithIdToken('identity-B');
    delayed.resolve(pullResult(sent)); await rejected;
    expect(storage.records[0]!.state).toBe('confirmed'); expect(api.signedIn).toBe(true);
    values.set(sessionKey, JSON.stringify({ token: 'session-A', expiresAt: expiry() }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/me') ? Response.json({ id: 'player-A' }) : Response.json({ requestId: 'wrong', pulls: [] })));
    const reload = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(reload.pull('banner', 1)).rejects.toMatchObject({ code: 'invalid_response' });
    expect(storage.records.at(-1)!.state).toBe('pending');
  });

  it('definite first-attempt rejection is recorded and a corrected intent gets its own ID', async () => {
    const storage = new TestOperationStorage(); let rejected = false;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      if (!rejected) { rejected = true; return Response.json({ error: 'insufficient_funds' }, { status: 402 }); }
      return pullResult(init.body as string);
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.pull('banner', 1)).rejects.toMatchObject({ code: 'insufficient_funds' });
    expect(storage.records[0]).toMatchObject({ state: 'rejected', code: 'insufficient_funds' });
    await api.pull('banner', 1); expect(storage.records[1]!.id).not.toBe(storage.records[0]!.id);
  });

  it('a confirmation write failure retains the original identity after the server has committed', async () => {
    const storage = new TestOperationStorage(); const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      sent.push(init.body as string);
      if (sent.length === 1) storage.failWrites = true;
      return pullResult(init.body as string);
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.pull('banner', 1)).rejects.toThrow(/storage write failed/);
    expect(storage.records[0]).toMatchObject({ state: 'pending', attempts: 1 });
    storage.failWrites = false;
    const reload = new GameApi('https://game.test', new OperationJournal(storage));
    await reload.pull('banner', 1);
    expect(sent[1]).toBe(sent[0]); expect(storage.records[0]!.state).toBe('confirmed');
  });

  it('an ambiguous earlier attempt stays pending even if a later attempt is rejected', async () => {
    const storage = new TestOperationStorage(); let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/me')) return Response.json({ id: 'player-A' });
      if (++attempts === 1) throw new TypeError('unknown result');
      return Response.json({ error: 'insufficient_funds' }, { status: 402 });
    }));
    const api = new GameApi('https://game.test', new OperationJournal(storage));
    await expect(api.pull('banner', 1)).rejects.toThrow(/unknown/);
    await expect(api.pull('banner', 1)).rejects.toMatchObject({ code: 'insufficient_funds' });
    expect(storage.records).toHaveLength(1);
    expect(storage.records[0]).toMatchObject({ state: 'pending', attempts: 2 });
  });

  it('corrupt identity/account/payload cannot be replayed and credentials never enter durable records', async () => {
    const storage = new TestOperationStorage(); const journal = new OperationJournal(storage);
    const record = await journal.begin('account-A', 'POST', '/api/v1/gacha/pull', { bannerId: 'banner', count: 1 });
    storage.records[0]!.id = 'altered_identity'; storage.records[0]!.body.requestId = 'altered_identity';
    await expect(journal.get('account-A', 'altered_identity')).rejects.toThrow(/changed/);
    storage.records[0]!.id = record.id; storage.records[0]!.body.requestId = record.id; storage.records[0]!.scope = 'account-B';
    await expect(journal.get('account-B', record.id)).rejects.toThrow(/changed/);
    await expect(journal.begin('account-C', 'POST', '/api/v1/gacha/pull', { purchaseToken: 'private receipt', bannerId: 'banner', count: 1 })).rejects.toThrow(/Credentials/);
    expect(JSON.stringify(storage.records)).not.toContain('private receipt');
  });
});
