import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameApi } from './api';

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
