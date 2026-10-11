import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyLedger } from '../src/db/ledger';
import { game, post, seedCanonCatalog, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let n = 0;
const rid = (): string => `a_${++n}_${Math.random().toString(36).slice(2, 10)}`;
beforeAll(seedCanonCatalog);

const put = (auth: Record<string, string>, slot: number, body: unknown) => game(`/api/v1/teams/${slot}`, { ...post(body, auth), method: 'PUT' });
const member = (characterId: string, slot: number, row: 'front' | 'rear' = 'front') => ({ characterId, slot, row });

describe('team presets', () => {
  it('saves presets for owned characters only, rejects duplicates, keeps one active', async () => {
    const { auth } = await signIn(`sub-team-${rid()}`);
    expect((await put(auth, 1, { name: 'Starters', members: [member('mahmut', 0), member('fadyme', 1, 'rear')] })).status).toBe(200);
    expect((await put(auth, 2, { name: 'Dream', members: [member('mahmut', 0), member('nara_vell', 1)] })).status).toBe(422); // not owned
    expect((await put(auth, 2, { name: 'Dup', members: [member('mahmut', 0), member('mahmut', 1)] })).status).toBe(422);
    expect((await put(auth, 2, { name: 'Clash', members: [member('mahmut', 0), member('fadyme', 0)] })).status).toBe(422);
    expect((await put(auth, 6, { name: 'Six', members: [member('mahmut', 0)] })).status).toBe(400);
    expect((await put(auth, 2, { name: 'Solo', members: [member('fadyme', 2)] })).status).toBe(200);
    let t = (await (await game('/api/v1/teams', { headers: auth })).json()) as { teams: { slot: number; active: boolean }[] };
    expect(t.teams.map((x) => [x.slot, x.active])).toEqual([[1, true], [2, false]]);
    expect((await game('/api/v1/teams/2/activate', post({}, auth))).status).toBe(200);
    expect((await game('/api/v1/teams/3/activate', post({}, auth))).status).toBe(404);
    t = (await (await game('/api/v1/teams', { headers: auth })).json()) as { teams: { slot: number; active: boolean }[] };
    expect(t.teams.map((x) => [x.slot, x.active])).toEqual([[1, false], [2, true]]);
    expect((await game('/api/v1/teams/1', { method: 'DELETE', headers: auth })).status).toBe(200);
    expect((await game('/api/v1/teams', { headers: auth }).then((r) => r.json()) as { teams: unknown[] }).teams).toHaveLength(1);
    expect((await game('/api/v1/teams')).status).toBe(401);
  });
});

describe('account export and deletion', () => {
  it('exports the player data, then deletes the account: identity and mutable state go, the sign-in link is freed, history is pseudonymous', async () => {
    const sub = `sub-del-${rid()}`;
    const { auth, playerId } = await signIn(sub);
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 500, reason: 'test', idempotencyKey: `f:${rid()}` });
    await put(auth, 1, { name: 'Starters', members: [member('mahmut', 0)] });
    await game('/api/v1/save', { ...post({ expectedVersion: 0, data: { k: 1 } }, auth), method: 'PUT' });

    const ex = await game('/api/v1/account/export', { headers: auth });
    expect(ex.status).toBe(200);
    const doc = (await ex.json()) as { profile: { id: string; status: string }; wallets: { balance: number }[]; teams: unknown[]; characters: { item_id: string }[]; ledger: unknown[] };
    expect(doc.profile).toMatchObject({ id: playerId, status: 'active' });
    expect(doc.wallets[0]?.balance).toBe(500);
    expect(doc.teams).toHaveLength(1);
    expect(doc.characters.map((c) => c.item_id).sort()).toEqual(['fadyme', 'mahmut']);
    expect(doc.ledger.length).toBeGreaterThan(0);

    expect((await game('/api/v1/account/delete', post({ confirm: 'yes' }, auth))).status).toBe(400); // explicit confirmation required
    expect((await game('/api/v1/account/delete', post({ confirm: 'DELETE' }, auth))).status).toBe(200);

    // the session is dead, the player row is a tombstone, state is gone, the immutable ledger remains
    expect((await game('/api/v1/wallet', { headers: auth })).status).toBe(401);
    expect(await db().prepare('SELECT status, google_sub, display_name FROM players WHERE id = ?1').bind(playerId).first()).toMatchObject({ status: 'deleted', google_sub: null, display_name: null });
    for (const t of ['player_items', 'wallets', 'player_teams', 'player_saves', 'sessions']) {
      expect((await db().prepare(`SELECT COUNT(*) AS c FROM ${t} WHERE player_id = ?1`).bind(playerId).first<{ c: number }>())?.c, t).toBe(0);
    }
    expect((await db().prepare('SELECT COUNT(*) AS c FROM ledger WHERE player_id = ?1').bind(playerId).first<{ c: number }>())?.c).toBeGreaterThan(0);

    // the same Google user can start over as a brand-new player with the free-start roster
    const again = await signIn(sub);
    expect(again.playerId).not.toBe(playerId);
  });
});
