import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { playAuto, replayBattle } from '@uomd/combat';
import { BattleParty, Encounter, UnitPack } from '@uomd/content-schema';
import { canonicalJson, sha256Hex } from '@uomd/shared';
import { statAtLevel } from '@uomd/economy';
import { baseFiles, campaignFiles, type TestFile } from './fixtures';
import { admin, entries, game, post, resetContent, seedCanonCatalog, signIn, upload } from './helpers';
import { computeCharacterStats, equipGear } from '../src/gear/service';
import { claimMail, sendMail } from '../src/mail/service';
import { loanGear } from '../src/progress/loan-gear';
import { loadProgressionConfig } from '../src/progression/characters';

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

  it('an owned story guest uses its own gear/ranks once and keeps the frozen snapshot', async () => {
    const guestEnc = { ...encounter, encounter_id: 'owned_g1', guests: ['fadyme'] };
    const index = JSON.parse(dec.decode(files.find((f) => f.path === 'chapters/chapter_index.json')!.bytes));
    index.chapters[0].nodes.push({ node_id: 'g1', title_en: 'Guest', kind: 'battle', encounter: 'encounters/owned_g1.json' });
    const set = [...files.filter((f) => f.path !== 'chapters/chapter_index.json'), await file('chapters/chapter_index.json', index), await file('encounters/owned_g1.json', guestEnc)];
    await resetContent();
    await upload(set);
    expect((await admin('/admin/api/releases', { method: 'POST', body: JSON.stringify({ id: 'rel_0001', channel: 'dev', notes: 'guests', files: entries(set) }), headers: { 'Content-Type': 'application/json' } })).status).toBe(201);
    expect((await admin('/admin/api/releases/rel_0001/publish', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })).status).toBe(200);
    const { auth, playerId } = await signIn(`sub-ob-${rid()}`);
    const ranks = { fadyme_basic_veilglass_thorn: 2 };
    await db().prepare(`INSERT INTO player_chars (player_id, character_id, level, skill_ranks) VALUES (?1, 'fadyme', 5, ?2)
      ON CONFLICT (player_id, character_id) DO UPDATE SET level = 5, skill_ranks = excluded.skill_ranks`).bind(playerId, JSON.stringify(ranks)).run();
    const mail = await sendMail(db(), playerId, { kind: 'reward', title: 'owned guest gear fixture', attachments: [{ type: 'gear', gearId: 'armor_padded_3_01' }] }, 'test');
    await claimMail(db(), playerId, mail.id);
    const armor = await db().prepare("SELECT id FROM player_gear WHERE player_id = ?1 AND gear_id = 'armor_padded_3_01'").bind(playerId).first<{ id: number }>();
    await equipGear(db(), playerId, armor!.id, 'fadyme');
    const expected = await computeCharacterStats(db(), playerId, 'fadyme');
    const response = await start(auth, 'g1'); expect(response.status).toBe(200);
    const j = (await response.json()) as { party: unknown; sessionId: string };
    const party = BattleParty.parse(j.party);
    expect(party.map((m) => m.unit_id)).toEqual(expect.arrayContaining(['fadyme', 'mahmut']));
    expect(party.filter((m) => m.unit_id === 'fadyme')).toHaveLength(1);
    const guest = party.find((m) => m.unit_id === 'fadyme')!;
    expect(guest.loan).not.toBe(true);
    expect(guest).toMatchObject({ level: 5, stats: expected.stats, skill_ranks: ranks });
    await db().prepare('UPDATE player_gear SET equipped_by = NULL WHERE id = ?1').bind(armor!.id).run();
    const frozen = await db().prepare('SELECT party_json FROM battle_sessions WHERE id = ?1').bind(j.sessionId).first<{ party_json: string }>();
    expect(JSON.parse(frozen!.party_json)).toEqual(party);
  });

  it('the anonymous replay endpoint refuses an owned-hero stage instead of failing', async () => {
    const r = await game('/api/v1/battles/verify', post({ releaseId: 'rel_0001', encounterPath: 'encounters/owned_o1.json', actions: [], clientLogHash: 'a'.repeat(64) }));
    expect(r.status).toBe(422);
  });

  it('freezes supported accessory bonuses, keeps replay after unequipping and rejects an altered client snapshot', async () => {
    const { auth, playerId } = await signIn(`sub-ob-${rid()}`);
    const mail = await sendMail(db(), playerId, { kind: 'reward', title: 'effect fixture', attachments: [{ type: 'gear', gearId: 'accessory_red_vial_residue_ring_3' }] }, 'test');
    await claimMail(db(), playerId, mail.id);
    const accessory = await db().prepare('SELECT id FROM player_gear WHERE player_id = ?1').bind(playerId).first<{ id: number }>();
    await db().prepare('UPDATE player_gear SET stats_json = ?2 WHERE id = ?1').bind(accessory!.id, JSON.stringify({ main: { stat: 'heal_bonus_pct', value: 0.5 }, subs: [{ stat: 'focus_gain_pct', value: 0.5 }] })).run();
    await equipGear(db(), playerId, accessory!.id, 'fadyme');
    const response = await start(auth); expect(response.status).toBe(200);
    const { party: raw, sessionId } = await response.json() as { party: unknown; sessionId: string };
    const party = BattleParty.parse(raw);
    expect(party.find((m) => m.unit_id === 'fadyme')?.equipment_effects).toEqual({ version: 1, heal_bonus_pct: 0.5, focus_gain_pct: 0.5 });
    await db().prepare('UPDATE player_gear SET equipped_by = NULL WHERE id = ?1').bind(accessory!.id).run();
    const played = playAuto(pack, encounter, party);
    const hash = await sha256Hex(canonicalJson(played.battle.log));
    expect(await replayBattle(pack, encounter, played.actions, party)).toMatchObject({ valid: true, complete: true, logHash: hash });
    const altered = structuredClone(party); delete altered.find((m) => m.unit_id === 'fadyme')!.equipment_effects;
    const forgedHash = (await replayBattle(pack, encounter, played.actions, altered)).logHash;
    expect(forgedHash).not.toBe(hash);
    expect((await submit(auth, { sessionId, actions: played.actions, party: altered })).status).toBe(400);
    expect((await submit(auth, { sessionId, actions: played.actions })).status).toBe(200);
    const audit = await db().prepare('SELECT log_hash FROM battle_audit WHERE caller = ?1 ORDER BY id DESC LIMIT 1').bind(`player:${(await sha256Hex(playerId)).slice(0, 20)}`).first<{ log_hash: string }>();
    expect(audit?.log_hash).toBe(hash);
  });

  it('fails battle admission without a session write when an equipped supported bonus is malformed', async () => {
    const { auth, playerId } = await signIn(`sub-ob-${rid()}`);
    const mail = await sendMail(db(), playerId, { kind: 'reward', title: 'invalid effect fixture', attachments: [{ type: 'gear', gearId: 'accessory_red_vial_residue_ring_3' }] }, 'test');
    await claimMail(db(), playerId, mail.id);
    await db().prepare("UPDATE player_gear SET equipped_by = 'fadyme', stats_json = ?2 WHERE player_id = ?1").bind(playerId, JSON.stringify({ main: { stat: 'heal_bonus_pct', value: -0.5 }, subs: [] })).run();
    const response = await start(auth); expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'invalid_equipment_effects' });
    expect((await db().prepare('SELECT COUNT(*) AS n FROM battle_sessions WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(0);
  });

  it('requires removal of a legacy equipped undefined passive before a new battle but keeps the item', async () => {
    const { auth, playerId } = await signIn(`sub-ob-${rid()}`);
    const before = await start(auth); expect(before.status).toBe(200);
    const old = await before.json() as { sessionId: string; party: BattleParty };
    const mail = await sendMail(db(), playerId, { kind: 'reward', title: 'legacy passive fixture', attachments: [{ type: 'gear', gearId: 'weapon_mahmut_signature' }] }, 'test');
    await claimMail(db(), playerId, mail.id);
    const gear = await db().prepare("SELECT id FROM player_gear WHERE player_id = ?1 AND gear_id = 'weapon_mahmut_signature'").bind(playerId).first<{ id: number }>();
    await db().prepare("UPDATE player_gear SET equipped_by = 'mahmut' WHERE id = ?1").bind(gear!.id).run();
    const response = await start(auth); expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'unsupported_gear_passive' });
    expect((await db().prepare('SELECT COUNT(*) AS n FROM battle_sessions WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(1);
    expect((await submit(auth, { sessionId: old.sessionId, actions: playAuto(pack, encounter, old.party).actions })).status).toBe(200);
    expect((await game(`/api/v1/gear/${gear!.id}/unequip`, post({}, auth))).status).toBe(200);
    expect((await start(auth)).status).toBe(200);
    expect(await db().prepare('SELECT gear_id FROM player_gear WHERE id = ?1').bind(gear!.id).first()).toEqual({ gear_id: 'weapon_mahmut_signature' });
  });

  it('a fixed story encounter also freezes a release session and starts with a null party', async () => {
    const { auth } = await signIn(`sub-ob-${rid()}`);
    const r = await start(auth, 't1');
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ sessionId: expect.stringMatching(/^[a-f0-9]{32}$/), party: null, expiresAt: expect.any(String) });
  });
});

describe('the Part I campaign release', () => {
  it('stage 1-2: three story loans plus the two starters, and clearing it recruits Brin', async () => {
    const set = await campaignFiles();
    await resetContent();
    await upload(set);
    expect((await admin('/admin/api/releases', { method: 'POST', body: JSON.stringify({ id: 'rel_0001', channel: 'dev', notes: 'campaign', files: entries(set) }), headers: { 'Content-Type': 'application/json' } })).status).toBe(201);
    expect((await admin('/admin/api/releases/rel_0001/publish', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })).status).toBe(200);
    const campaignPack = UnitPack.parse(JSON.parse(dec.decode(set.find((f) => f.path === 'units/unit_pack.json')!.bytes)));
    const campaignEnc = Encounter.parse(JSON.parse(dec.decode(set.find((f) => f.path === 'encounters/stage_1_2.json')!.bytes)));
    const { auth, playerId } = await signIn(`sub-camp-${rid()}`);
    expect((await game('/api/v1/progress/battle/start', post({ releaseId: 'rel_0001', nodeId: 'stage_1_1' }, auth))).status).toBe(403);
    expect((await game('/api/v1/progress/story', post({ releaseId: 'rel_0001', nodeId: 'opening_sad_scene', requestId: rid() }, auth))).status).toBe(200);
    expect((await game('/api/v1/progress/battle/start', post({ releaseId: 'rel_0001', nodeId: 'stage_1_1' }, auth))).status).toBe(200); // the tutorial stage is fixed, no session
    await db().prepare("INSERT INTO player_progress (player_id, node_id, stars, clears, first_cleared_at, updated_at) VALUES (?1, 'stage_1_1', 3, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')").bind(playerId).run();
    const started = (await (await game('/api/v1/progress/battle/start', post({ releaseId: 'rel_0001', nodeId: 'stage_1_2' }, auth))).json()) as { sessionId: string; party: unknown };
    const party = BattleParty.parse(started.party);
    expect(party.map((m) => m.unit_id).sort()).toEqual(['brin_alder', 'fadyme', 'kera_voss', 'mahmut', 'nixie_vale']);
    const brin = party.find((member) => member.unit_id === 'brin_alder')!;
    const base = await db().prepare("SELECT base_vit, growth_vit FROM characters WHERE id = 'brin_alder'").first<{ base_vit: number; growth_vit: number }>();
    expect(brin.stats!.hp).toBeGreaterThan(4 + 3 * statAtLevel(base!.base_vit, base!.growth_vit, brin.level)); // loan armor adds VIT
    expect(await db().prepare('SELECT COUNT(*) AS n FROM player_gear WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
    expect(party.filter((m) => m.loan).map((m) => m.unit_id).sort()).toEqual(['brin_alder', 'kera_voss', 'nixie_vale']);
    const cfg = await loadProgressionConfig(db());
    for (const member of party.filter((m) => m.loan)) {
      const ch = await db().prepare('SELECT weapon_type, role FROM characters WHERE id = ?1').bind(member.unit_id).first<{ weapon_type: string; role: string }>();
      const gear = await loanGear(db(), member.unit_id, ch!.weapon_type, ch!.role, campaignEnc.stage_id, cfg, campaignPack.rules.story_loan_equipment!);
      const supported = Object.fromEntries(['heal_bonus_pct', 'focus_gain_pct'].filter((key) => gear.other[key] !== undefined).map((key) => [key, gear.other[key]]));
      expect(member.equipment_effects).toEqual(Object.keys(supported).length ? { version: 1, ...supported } : undefined);
    }
    expect(new Set(party.map((m) => m.slot)).size).toBe(5);
    const played = playAuto(campaignPack, campaignEnc, party);
    expect(played.battle.result?.winner).toBe('player');
    await db().prepare("INSERT OR REPLACE INTO player_ration (player_id, value, at_ms) VALUES (?1, 100, ?2)").bind(playerId, Date.now()).run();
    const done = await submit(auth, { nodeId: 'stage_1_2', sessionId: started.sessionId, actions: played.actions });
    expect(done.status).toBe(200);
    const j = (await done.json()) as { firstClear: boolean; rewards: { type: string; itemId?: string }[] };
    expect(j.firstClear).toBe(true);
    expect(j.rewards).toContainEqual(expect.objectContaining({ type: 'character', itemId: 'brin_alder' }));
    const owned = await db().prepare("SELECT 1 AS x FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = 'brin_alder'").bind(playerId).first();
    expect(owned).not.toBeNull();
  });
});

