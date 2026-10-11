import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { game, post, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let n = 0;
const rid = (): string => `e_${++n}_${Math.random().toString(36).slice(2, 10)}`;
const put = (auth: Record<string, string>, body: unknown) => game('/api/v1/entry', { ...post(body, auth), method: 'PUT' });
const get = async (auth: Record<string, string>): Promise<{ phase: string; prologue: boolean; tutorials: number; updatedAt: string | null; playerId: string }> => (await game('/api/v1/entry', { headers: auth })).json() as never;

describe('entry checkpoint', () => {
  it('starts as not_started and requires a session', async () => {
    const { auth, playerId } = await signIn(`sub-entry-${rid()}`);
    expect(await get(auth)).toEqual({ phase: 'not_started', prologue: false, tutorials: 0, updatedAt: null, playerId });
    expect((await game('/api/v1/entry')).status).toBe(401);
    expect((await put({}, { prologue: true, tutorials: 0 })).status).toBe(401);
  });

  it('only moves forward: stale or replayed reports never lower the record', async () => {
    const { auth } = await signIn(`sub-entry-${rid()}`);
    expect((await put(auth, { prologue: false, tutorials: 0 })).status).toBe(200);
    expect((await get(auth)).phase).toBe('not_started'); // nothing worth storing yet
    await put(auth, { prologue: true, tutorials: 0 });
    expect(await get(auth)).toMatchObject({ phase: 'in_progress', prologue: true, tutorials: 0 });
    await put(auth, { prologue: true, tutorials: 2 });
    await put(auth, { prologue: false, tutorials: 1 }); // a stale device reports older progress
    expect(await get(auth)).toMatchObject({ phase: 'in_progress', prologue: true, tutorials: 2 });
    await put(auth, { prologue: true, tutorials: 3 });
    expect((await get(auth)).tutorials).toBe(3);
  });

  it('completion needs the prologue and all tutorials, is final, and is idempotent', async () => {
    const { auth } = await signIn(`sub-entry-${rid()}`);
    expect((await put(auth, { prologue: true, tutorials: 2, completed: true })).status).toBe(422);
    expect((await put(auth, { prologue: false, tutorials: 0, completed: true })).status).toBe(422);
    expect((await get(auth)).phase).toBe('not_started');
    expect((await put(auth, { prologue: true, tutorials: 3, completed: true })).status).toBe(200);
    expect((await put(auth, { prologue: true, tutorials: 3, completed: true })).status).toBe(200);
    await put(auth, { prologue: false, tutorials: 0 });
    expect(await get(auth)).toMatchObject({ phase: 'completed', prologue: true, tutorials: 3 });
  });

  it('rejects malformed bodies', async () => {
    const { auth } = await signIn(`sub-entry-${rid()}`);
    for (const bad of [{ prologue: 'yes', tutorials: 1 }, { prologue: true, tutorials: 4 }, { prologue: true, tutorials: -1 }, { prologue: true, tutorials: 1.5 }, { prologue: true, tutorials: 1, extra: 1 }, {}]) {
      expect((await put(auth, bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('is exported with the account data and erased with the account', async () => {
    const { auth, playerId } = await signIn(`sub-entry-${rid()}`);
    await put(auth, { prologue: true, tutorials: 3, completed: true });
    const ex = (await (await game('/api/v1/account/export', { headers: auth })).json()) as { entry: { phase: string; tutorials: number }[] };
    expect(ex.entry).toHaveLength(1);
    expect(ex.entry[0]).toMatchObject({ phase: 'completed', tutorials: 3 });
    expect((await game('/api/v1/account/delete', post({ confirm: 'DELETE' }, auth))).status).toBe(200);
    const left = await db().prepare('SELECT count(*) AS c FROM player_entry WHERE player_id = ?1').bind(playerId).first<{ c: number }>();
    expect(left?.c).toBe(0);
  });
});
