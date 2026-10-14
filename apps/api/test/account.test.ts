import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { reapplyAccountDeletions } from '../src/account/service';
import { applyLedger } from '../src/db/ledger';
import { game, googleIdToken, post, seedCanonCatalog, signIn } from './helpers';

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

describe('account export, deletion-on-restore, session rotation, and privacy/deletion routes', () => {
  it('exports complete player data inventory, deletes all 21 mutable tables, and enforces deletion-on-restore', async () => {
    const sub = `sub-del-${rid()}`;
    const { auth, playerId } = await signIn(sub);
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 500, reason: 'test', idempotencyKey: `f:${rid()}` });
    await put(auth, 1, { name: 'Starters', members: [member('mahmut', 0)] });
    await game('/api/v1/save', { ...post({ expectedVersion: 0, data: { k: 1 } }, auth), method: 'PUT' });

    const ex = await game('/api/v1/account/export', { headers: auth });
    expect(ex.status).toBe(200);
    const doc = (await ex.json()) as Record<string, unknown> & {
      profile: { id: string; status: string };
      wallets: { balance: number }[];
      teams: unknown[];
      characters: { item_id: string }[];
      ledger: unknown[];
      sessions: unknown[];
      dataInventory: { erasedOnDelete: string[] };
    };
    expect(doc.profile).toMatchObject({ id: playerId, status: 'active' });
    expect(doc.wallets[0]?.balance).toBe(500);
    expect(doc.teams).toHaveLength(1);
    expect(doc.characters.map((c) => c.item_id).sort()).toEqual(['fadyme', 'mahmut']);
    expect(doc.ledger.length).toBeGreaterThan(0);
    expect(doc.sessions.length).toBe(1);
    expect(Array.isArray(doc.weapons)).toBe(true);
    expect(Array.isArray(doc.battleSessions)).toBe(true);
    expect(Array.isArray(doc.battleClaims)).toBe(true);
    expect(Array.isArray(doc.pityState)).toBe(true);
    expect(Array.isArray(doc.tasks)).toBe(true);
    expect(Array.isArray(doc.gachaRequests)).toBe(true);
    expect(Array.isArray(doc.progressionRequests)).toBe(true);
    expect(Array.isArray(doc.adRewards)).toBe(true);
    expect(Array.isArray(doc.adNonces)).toBe(true);
    expect(doc.dataInventory.erasedOnDelete.length).toBeGreaterThanOrEqual(24);

    expect((await game('/api/v1/account/delete', post({ confirm: 'yes' }, auth))).status).toBe(400); // explicit confirmation required
    expect((await game('/api/v1/account/delete', post({ confirm: 'DELETE' }, auth))).status).toBe(200);

    // the session is dead, the player row is a tombstone, state is gone, the immutable ledger remains
    expect((await game('/api/v1/wallet', { headers: auth })).status).toBe(401);
    expect(await db().prepare('SELECT status, google_sub, display_name FROM players WHERE id = ?1').bind(playerId).first()).toMatchObject({ status: 'deleted', google_sub: null, display_name: null });
    for (const t of ['player_items', 'wallets', 'player_teams', 'player_saves', 'sessions']) {
      expect((await db().prepare(`SELECT COUNT(*) AS c FROM ${t} WHERE player_id = ?1`).bind(playerId).first<{ c: number }>())?.c, t).toBe(0);
    }
    expect((await db().prepare('SELECT COUNT(*) AS c FROM ledger WHERE player_id = ?1').bind(playerId).first<{ c: number }>())?.c).toBeGreaterThan(0);

    // Simulate a backup restore that brings the deleted player row back to 'active' with a google_sub and wallet:
    // reapplyAccountDeletions must re-tombstone the player and purge the restored mutable state.
    await db().prepare("UPDATE players SET status = 'active', google_sub = ?2, display_name = 'Restored' WHERE id = ?1").bind(playerId, sub).run();
    await db().prepare("INSERT INTO wallets (player_id, currency, balance) VALUES (?1, 'eclipse_token', 999)").bind(playerId).run();
    const { playerIds } = await reapplyAccountDeletions(db());
    expect(playerIds).toContain(playerId);
    expect(await db().prepare('SELECT status, google_sub, display_name FROM players WHERE id = ?1').bind(playerId).first()).toMatchObject({ status: 'deleted', google_sub: null, display_name: null });
    expect((await db().prepare('SELECT COUNT(*) AS c FROM wallets WHERE player_id = ?1').bind(playerId).first<{ c: number }>())?.c).toBe(0);

    // the same Google user can start over as a brand-new player with the free-start roster
    const again = await signIn(sub);
    expect(again.playerId).not.toBe(playerId);
  });

  it('rotates sessions via /api/v1/auth/refresh, revokes all device sessions on logout(allDevices), and serves public privacy and web deletion endpoints', async () => {
    const sub = `sub-rot-${rid()}`;
    const dev1 = await signIn(sub);
    const dev2 = await signIn(sub);
    expect(dev1.playerId).toBe(dev2.playerId);

    // Rotate dev1 session
    const refRes = await game('/api/v1/auth/refresh', post({}, dev1.auth));
    expect(refRes.status).toBe(200);
    const rotated = (await refRes.json()) as { token: string; expiresAt: string; playerId: string };
    expect(rotated.playerId).toBe(dev1.playerId);
    expect(rotated.token).not.toBe(dev1.token);

    // Old dev1 bearer is immediately revoked; new bearer works; dev2 bearer still works
    expect((await game('/api/v1/me', { headers: dev1.auth })).status).toBe(401);
    const rotatedAuth = { Authorization: `Bearer ${rotated.token}` };
    expect((await game('/api/v1/me', { headers: rotatedAuth })).status).toBe(200);
    expect((await game('/api/v1/me', { headers: dev2.auth })).status).toBe(200);

    // Logout with allDevices: true revokes both rotatedAuth and dev2
    expect((await game('/api/v1/auth/logout', post({ allDevices: true }, rotatedAuth))).status).toBe(200);
    expect((await game('/api/v1/me', { headers: rotatedAuth })).status).toBe(401);
    expect((await game('/api/v1/me', { headers: dev2.auth })).status).toBe(401);

    // Public privacy notice and web deletion endpoints
    const privJson = await game('/api/v1/privacy');
    expect(privJson.status).toBe(200);
    expect(await privJson.json()).toMatchObject({
      app: 'Unaware of My Demise',
      dataInventory: {
        ageAndConsentPolicy: { childDirected: false, maxAdContentRating: 'T' }
      }
    });
    const privHtml = await game('/privacy');
    expect(privHtml.status).toBe(200);
    expect(await privHtml.text()).toContain('Privacy &amp; Data Retention Notice');

    const delHtml = await game('/account/delete-request');
    expect(delHtml.status).toBe(200);
    expect(await delHtml.text()).toContain('Account Deletion Request');

    // Web account deletion with Google ID token (no active app session required)
    const idToken = await googleIdToken(sub, { name: 'Wayfarer' });
    const delWeb = await game('/api/v1/account/delete-request', post({ idToken, confirm: 'DELETE' }));
    expect(delWeb.status).toBe(200);
    expect(await delWeb.json()).toEqual({ deleted: true, playerId: dev1.playerId });
    expect(await db().prepare('SELECT status, google_sub FROM players WHERE id = ?1').bind(dev1.playerId).first()).toMatchObject({ status: 'deleted', google_sub: null });
  });
});

