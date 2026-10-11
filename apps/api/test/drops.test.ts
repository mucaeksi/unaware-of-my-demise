import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { playAuto } from '@uomd/combat';
import { Encounter, UnitPack } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { baseFiles, type TestFile } from './fixtures';
import { admin, entries, game, post, resetContent, seedCanonCatalog, signIn, upload } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let base: TestFile[];
let actions: { skillId: string; targetId?: string }[];
const dec = new TextDecoder();
let n = 0;
const rid = (): string => `d_${++n}_${Math.random().toString(36).slice(2, 10)}`;
const json = { 'Content-Type': 'application/json' };

const TABLE = {
  note: 'test',
  tables: {
    boss: {
      repeat: [
        { kind: 'currency', min: 7, max: 7, chance: 1 },
        { kind: 'item', itemId: 'forge_dust', min: 2, max: 2, chance: 1 },
        { kind: 'gear_pool', slot: 'weapon', rarities: [3], chance: 1 },
        { kind: 'boss_set', rarity: 4, chance: 0 }
      ],
      firstClear: [
        { kind: 'boss_set', rarity: 4, chance: 1 },
        { kind: 'account_xp', amount: 150, chance: 1 }
      ]
    }
  }
};

beforeAll(async () => {
  await seedCanonCatalog();
  const files = await baseFiles();
  const find = (p: string) => files.find((f) => f.path === p) as TestFile;
  actions = playAuto(UnitPack.parse(JSON.parse(dec.decode(find('units/unit_pack.json').bytes))), Encounter.parse(JSON.parse(dec.decode(find('encounters/tutorial_t1.json').bytes)))).actions;
  const index = JSON.parse(dec.decode(find('chapters/chapter_index.json').bytes));
  const t1 = index.chapters[0].nodes[0];
  t1.ration_class = 'campaign';
  t1.drop = { table: 'boss', boss_set_id: 'ash_maw_hide' };
  const bytes = new TextEncoder().encode(JSON.stringify(index));
  const patched: TestFile = { path: 'chapters/chapter_index.json', bytes, mediaType: 'application/json', sha256: await sha256Hex(bytes) };
  base = files.map((f) => (f.path === patched.path ? patched : f));
});
beforeEach(async () => {
  await resetContent();
  await db().prepare("UPDATE game_config SET value_json = ?1 WHERE key = 'drops'").bind(JSON.stringify(TABLE)).run();
  await upload(base);
  expect((await admin('/admin/api/releases', { method: 'POST', body: JSON.stringify({ id: 'rel_0001', channel: 'dev', notes: 'drops', files: entries(base) }), headers: json })).status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', { method: 'POST', body: '{}', headers: json })).status).toBe(200);
});

const submit = (auth: Record<string, string>) => game('/api/v1/progress/battle', post({ releaseId: 'rel_0001', nodeId: 't1', requestId: rid(), actions }, auth));
const gearOf = async (playerId: string) => (await db().prepare('SELECT gear_id, slot FROM player_gear WHERE player_id = ?1').bind(playerId).all<{ gear_id: string; slot: string }>()).results;

describe('drop tables', () => {
  it('first clear guarantees a boss-set piece and account XP; every win rolls the repeat table; results are recorded', async () => {
    const { auth, playerId } = await signIn(`sub-drop-${rid()}`);
    const res = await submit(auth);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { firstClear: boolean; rewards: { type: string }[] };
    expect(j.firstClear).toBe(true);
    const g1 = await gearOf(playerId);
    expect(g1.filter((g) => g.slot === 'necklace' || g.slot === 'ring')).toHaveLength(1);
    expect((await db().prepare("SELECT gear_id FROM player_gear WHERE player_id = ?1 AND gear_id LIKE 'accessory_ash_maw_hide_%_4'").bind(playerId).all()).results).toHaveLength(1);
    expect(g1.filter((g) => g.slot === 'weapon')).toHaveLength(1); // 3★ non-signature weapon from the pool
    const w = await db().prepare("SELECT owner_character_id, banner_id FROM gear_defs WHERE gear_id = ?1").bind(g1.find((g) => g.slot === 'weapon')?.gear_id).first<{ owner_character_id: string | null; banner_id: string | null }>();
    expect(w).toEqual({ owner_character_id: null, banner_id: null });
    const acct = await db().prepare('SELECT xp FROM player_account WHERE player_id = ?1').bind(playerId).first<{ xp: number }>();
    expect(acct?.xp).toBe(150);
    const wallet = (await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> };
    expect(wallet.wallets.eclipse_token).toBe(7);
    const stacks = await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'forge_dust'").bind(playerId).first<{ qty: number }>();
    expect(stacks?.qty).toBe(2);
    expect(j.rewards.length).toBeGreaterThanOrEqual(5);

    // repeat win: no boss set, no account XP again; currency / dust / another weapon
    expect((await submit(auth)).status).toBe(200);
    const g2 = await gearOf(playerId);
    expect(g2.filter((g) => g.slot === 'necklace' || g.slot === 'ring')).toHaveLength(1);
    expect((await db().prepare('SELECT xp FROM player_account WHERE player_id = ?1').bind(playerId).first<{ xp: number }>())?.xp).toBe(150);
    expect(g2.filter((g) => g.slot === 'weapon')).toHaveLength(2);
  });

  it('a retried request returns the stored drops and does not roll again', async () => {
    const { auth, playerId } = await signIn(`sub-drop-${rid()}`);
    const requestId = rid();
    const body = post({ releaseId: 'rel_0001', nodeId: 't1', requestId, actions }, auth);
    const a = (await (await game('/api/v1/progress/battle', body)).json()) as { rewards: unknown[] };
    const b = (await (await game('/api/v1/progress/battle', post({ releaseId: 'rel_0001', nodeId: 't1', requestId, actions }, auth))).json()) as { rewards: unknown[]; replayed: boolean };
    expect(b.replayed).toBe(true);
    expect(b.rewards).toEqual(a.rewards);
    expect(await gearOf(playerId)).toHaveLength(2); // boss-set piece + one weapon, rolled once
  });

  it('parallel first clears grant the first-clear drops exactly once', async () => {
    const { auth, playerId } = await signIn(`sub-drop-${rid()}`);
    const rs = await Promise.all([submit(auth), submit(auth), submit(auth)]);
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
    const sets = (await gearOf(playerId)).filter((g) => g.slot === 'necklace' || g.slot === 'ring');
    expect(sets).toHaveLength(1);
    expect((await db().prepare('SELECT xp FROM player_account WHERE player_id = ?1').bind(playerId).first<{ xp: number }>())?.xp).toBe(150);
    expect((await db().prepare('SELECT clears FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(playerId, 't1').first<{ clears: number }>())?.clears).toBe(3);
  });

  it('the seeded canon drop tables are valid and every id they name exists in the catalog', async () => {
    const row = await db().prepare("SELECT value_json FROM game_config WHERE key = 'drops'").first<{ value_json: string }>();
    expect(row).toBeTruthy();
    // admin PUT validates references: write the (test) config through the API and an unknown item is refused
    const cur = (await (await admin('/admin/api/config/drops')).json()) as { version: number };
    const bad = structuredClone(TABLE) as { tables: { boss: { repeat: unknown[] } } };
    bad.tables.boss.repeat.push({ kind: 'item', itemId: 'no_such_item', min: 1, max: 1, chance: 1 });
    const refused = await admin('/admin/api/config/drops', { method: 'PUT', body: JSON.stringify({ value: bad, expectedVersion: cur.version }), headers: json });
    expect(refused.status).toBe(422);
    const ok = await admin('/admin/api/config/drops', { method: 'PUT', body: JSON.stringify({ value: TABLE, expectedVersion: cur.version }), headers: json });
    expect(ok.status).toBe(200);
  });
});
