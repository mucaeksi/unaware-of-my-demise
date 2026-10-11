import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { playAuto } from '@uomd/combat';
import { BattleParty, Encounter, UnitPack } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { baseFiles, type TestFile } from './fixtures';
import { admin, entries, game, post, resetContent, seedCanonCatalog, signIn, upload } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
const dec = new TextDecoder();
const enc = new TextEncoder();
let n = 0;
const rid = (): string => `ob_${++n}_${Math.random().toString(36).slice(2, 10)}`;
let files: TestFile[];
let pack: UnitPack;
let encounter: Encounter;

const file = async (path: string, value: unknown): Promise<TestFile> => {
  const bytes = enc.encode(JSON.stringify(value));
  return { path, bytes, mediaType: 'application/json', sha256: await sha256Hex(bytes) };
};

beforeAll(async () => {
  await seedCanonCatalog();
  const base = await baseFiles();
  const find = (p: string): TestFile => base.find((f) => f.path === p) as TestFile;
  pack = UnitPack.parse(JSON.parse(dec.decode(find('units/unit_pack.json').bytes)));
  const t1 = Encounter.parse(JSON.parse(dec.decode(find('encounters/tutorial_t1.json').bytes)));
  // an owned-hero stage against the same two Bellbound Dead (no player side in the content: the server composes it)
  encounter = { ...t1, encounter_id: 'owned_o1', party_mode: 'owned', party: [] };
  const index = JSON.parse(dec.decode(find('chapters/chapter_index.json').bytes));
  index.chapters[0].nodes.push({ node_id: 'o1', title_en: 'Owned', kind: 'battle', encounter: 'encounters/owned_o1.json' });
  files = [...base.filter((f) => f.path !== 'chapters/chapter_index.json'), await file('chapters/chapter_index.json', index), await file('encounters/owned_o1.json', encounter)];
});
beforeEach(async () => {
  await resetContent();
  await upload(files);
  const r = await admin('/admin/api/releases', { method: 'POST', body: JSON.stringify({ id: 'rel_0001', channel: 'dev', notes: 'owned battle fixture', files: entries(files) }), headers: { 'Content-Type': 'application/json' } });
  expect(r.status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })).status).toBe(200);
});

const start = (auth: Record<string, string>, nodeId = 'o1') => game('/api/v1/progress/battle/start', post({ releaseId: 'rel_0001', nodeId }, auth));
const submit = (auth: Record<string, string>, over: Record<string, unknown>) => game('/api/v1/progress/battle', post({ releaseId: 'rel_0001', nodeId: 'o1', requestId: rid(), ...over }, auth));
async function begin(sub: string): Promise<{ auth: Record<string, string>; playerId: string; sessionId: string; party: BattleParty }> {
  const { auth, playerId } = await signIn(sub);
  const r = await start(auth);
  expect(r.status).toBe(200);
  const j = (await r.json()) as { sessionId: string; party: unknown };
  return { auth, playerId, sessionId: j.sessionId, party: BattleParty.parse(j.party) };
}

describe('owned-hero battles are fought with a server-frozen party', () => {
  it('start returns the party the server computed: the free-start heroes with their stats from D1', async () => {
    const { party, sessionId } = await begin(`sub-ob-${rid()}`);
    expect(sessionId).toMatch(/^[a-f0-9]{32}$/);
    expect(party.map((m) => m.unit_id).sort()).toEqual(['fadyme', 'mahmut']);
    const mahmut = party.find((m) => m.unit_id === 'mahmut');
    expect(mahmut).toMatchObject({ level: 1, row: 'front', stats: { hp: 10, atk: 2, def: 2, spd: 4 } }); // the test catalog's placeholder base stats; growth only applies above level 1
    expect(party.find((m) => m.unit_id === 'fadyme')?.row).toBe('rear');
  });

  it('a win replayed on the server against the frozen party is accepted, and the session works once', async () => {
    const { auth, sessionId, party } = await begin(`sub-ob-${rid()}`);
    const played = playAuto(pack, encounter, party);
    expect(played.battle.result?.winner).toBe('player');
    const ok = await submit(auth, { sessionId, actions: played.actions });
    expect(ok.status).toBe(200);
    const again = await submit(auth, { sessionId, actions: played.actions });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: string }).error).toBe('session_used');
  });

  it('the party is frozen: levelling or re-equipping after the start does not change what is replayed', async () => {
    const { auth, playerId, sessionId, party } = await begin(`sub-ob-${rid()}`);
    const played = playAuto(pack, encounter, party);
    await db().prepare("INSERT OR REPLACE INTO player_chars (player_id, character_id, level, xp, ascension, skill_ranks, version) VALUES (?1, 'mahmut', 20, 0, 4, '{}', 1)").bind(playerId).run();
    expect((await submit(auth, { sessionId, actions: played.actions })).status).toBe(200);
  });

  it('refuses an owned stage without a session, with another player\'s session, with a forged action list and for another node', async () => {
    const a = await begin(`sub-ob-${rid()}`);
    const b = await begin(`sub-ob-${rid()}`);
    const played = playAuto(pack, encounter, a.party);
    expect((await submit(a.auth, { actions: played.actions })).status).toBe(400);
    expect((await submit(b.auth, { sessionId: a.sessionId, actions: played.actions })).status).toBe(404);
    expect((await submit(a.auth, { sessionId: a.sessionId, actions: [{ skillId: 'mahmut_ultimate_last_wall_at_dusk' }] })).status).toBe(422);
    expect((await submit(a.auth, { sessionId: 'a'.repeat(32), actions: played.actions })).status).toBe(404);
    // the forged attempts consumed nothing: the honest submission still works
    expect((await submit(a.auth, { sessionId: a.sessionId, actions: played.actions })).status).toBe(200);
  });

  it('an expired session is refused', async () => {
    const { auth, sessionId, party } = await begin(`sub-ob-${rid()}`);
    await db().prepare("UPDATE battle_sessions SET expires_at = '2020-01-01T00:00:00.000Z' WHERE id = ?1").bind(sessionId).run();
    const r = await submit(auth, { sessionId, actions: playAuto(pack, encounter, party).actions });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toBe('session_expired');
  });

  it('story loans take the first slots and the owned heroes fill the rest', async () => {
    const guestEnc = { ...encounter, encounter_id: 'owned_g1', guests: ['fadyme'] };
    const index = JSON.parse(dec.decode(files.find((f) => f.path === 'chapters/chapter_index.json')!.bytes));
    index.chapters[0].nodes.push({ node_id: 'g1', title_en: 'Guest', kind: 'battle', encounter: 'encounters/owned_g1.json' });
    const set = [...files.filter((f) => f.path !== 'chapters/chapter_index.json'), await file('chapters/chapter_index.json', index), await file('encounters/owned_g1.json', guestEnc)];
    await resetContent();
    await upload(set);
    expect((await admin('/admin/api/releases', { method: 'POST', body: JSON.stringify({ id: 'rel_0001', channel: 'dev', notes: 'guests', files: entries(set) }), headers: { 'Content-Type': 'application/json' } })).status).toBe(201);
    expect((await admin('/admin/api/releases/rel_0001/publish', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })).status).toBe(200);
    const { auth } = await signIn(`sub-ob-${rid()}`);
    const j = (await (await start(auth, 'g1')).json()) as { party: unknown };
    const party = BattleParty.parse(j.party);
    expect(party.map((m) => m.unit_id)).toEqual(expect.arrayContaining(['fadyme', 'mahmut']));
    expect(party.filter((m) => m.unit_id === 'fadyme')).toHaveLength(1); // the loan stands in for the owned hero
    expect(party.find((m) => m.unit_id === 'fadyme')?.loan).toBe(true);
  });

  it('a fixed story encounter needs no session and starts with a null party', async () => {
    const { auth } = await signIn(`sub-ob-${rid()}`);
    const r = await start(auth, 't1');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ sessionId: null, party: null, expiresAt: null });
  });
});
