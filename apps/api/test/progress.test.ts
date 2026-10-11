import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { playAuto } from '@uomd/combat';
import { Encounter, UnitPack } from '@uomd/content-schema';
import { baseFiles, type TestFile } from './fixtures';
import { admin, entries, game, post, resetContent, signIn, upload } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let base: TestFile[];
let actions: { skillId: string; targetId?: string }[];
let three = false;
const dec = new TextDecoder();
let n = 0;
const rid = (): string => `b_${++n}_${Math.random().toString(36).slice(2, 10)}`;

beforeAll(async () => {
  const files = await baseFiles();
  const find = (p: string) => files.find((f) => f.path === p) as TestFile;
  const played = playAuto(UnitPack.parse(JSON.parse(dec.decode(find('units/unit_pack.json').bytes))), Encounter.parse(JSON.parse(dec.decode(find('encounters/tutorial_t1.json').bytes))));
  actions = played.actions;
  three = played.battle.result?.stars === 3;

  // a release whose chapter index carries rewards and a ration cost, plus a gated second node using the same encounter
  const index = JSON.parse(dec.decode(find('chapters/chapter_index.json').bytes));
  const t1 = index.chapters[0].nodes[0];
  t1.ration_class = 'campaign';
  t1.rewards = {
    first_clear: [{ type: 'currency', currency: 'eclipse_token', amount: 100 }, { type: 'character', itemId: 'prog_hero' }],
    three_star: [{ type: 'currency', currency: 'eclipse_token', amount: 50 }],
    repeat: [{ type: 'currency', currency: 'eclipse_token', amount: 1000 }]
  };
  index.chapters[0].nodes.push({ node_id: 't1b', title_en: 'Gated', kind: 'battle', encounter: t1.encounter, requires: 't1c' });
  index.chapters[0].nodes.push({ node_id: 't1c', title_en: 'Free', kind: 'battle', encounter: t1.encounter, requires: 't1' });
  const bytes = new TextEncoder().encode(JSON.stringify(index));
  const { sha256Hex } = await import('@uomd/shared');
  const patched: TestFile = { path: 'chapters/chapter_index.json', bytes, mediaType: 'application/json', sha256: await sha256Hex(bytes) };
  base = files.map((f) => (f.path === patched.path ? patched : f));
});
beforeEach(async () => {
  await resetContent();
  await db().prepare("INSERT OR IGNORE INTO characters (id, name_en, rarity, element, role, age, acquisition, base_hp, base_atk, base_def, base_spd) VALUES ('prog_hero','Prog Hero',4,'Stone','tank',20,'gacha',10,2,2,4)").run();
  await upload(base);
  const r = await admin('/admin/api/releases', { method: 'POST', body: JSON.stringify({ id: 'rel_0001', channel: 'dev', notes: 'progress fixture', files: entries(base) }), headers: { 'Content-Type': 'application/json' } });
  expect(r.status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })).status).toBe(200);
});

const submit = (auth: Record<string, string>, over: Record<string, unknown> = {}) => game('/api/v1/progress/battle', post({ releaseId: 'rel_0001', nodeId: 't1', requestId: rid(), actions, ...over }, auth));

describe('server-verified battle progress', () => {
  it('re-simulates the battle, pays Ration, grants first-clear and three-star rewards once, records progress', async () => {
    const { auth, playerId } = await signIn(`sub-prog-${rid()}`);
    const res = await submit(auth);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { stars: number; firstClear: boolean; newThreeStar: boolean; ration: { spent: number; value: number }; rewards: unknown[]; replayed: boolean };
    expect(j).toMatchObject({ firstClear: true, replayed: false, ration: { spent: 6, value: 94 } });
    const wallet = (await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> };
    expect(j.newThreeStar).toBe(three);
    expect(wallet.wallets.eclipse_token).toBe(100 + 1000 + (three ? 50 : 0));
    const inv = (await (await game('/api/v1/inventory', { headers: auth })).json()) as { items: { item_id: string }[] };
    expect(inv.items.map((i) => i.item_id)).toContain('prog_hero');

    // second win on the same node: only the repeat reward; first-clear rewards are not paid again
    const again = await submit(auth);
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ firstClear: false, ration: { spent: 6, value: 88 } });
    const w2 = (await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> };
    expect(w2.wallets.eclipse_token).toBe(100 + 2000 + (three ? 50 : 0));
    const prog = (await (await game('/api/v1/progress', { headers: auth })).json()) as { nodes: { node_id: string; stars: number; clears: number }[]; ration: { value: number; cap: number } };
    expect(prog.nodes).toMatchObject([{ node_id: 't1', clears: 2 }]);
    expect(prog.ration).toMatchObject({ value: 88, cap: 100 });
    const hero = await db().prepare("SELECT copies FROM player_items WHERE player_id = ?1 AND item_id = 'prog_hero'").bind(playerId).first<{ copies: number }>();
    expect(hero?.copies).toBe(1);
    // stars never go down
    await expect(db().prepare('UPDATE player_progress SET stars = 0 WHERE player_id = ?1').bind(playerId).run()).rejects.toThrow(/never decrease/);
  });

  it('a replayed requestId grants nothing twice; 15 identical concurrent submissions win exactly once', async () => {
    const { auth } = await signIn(`sub-prog-rep-${rid()}`);
    const id = rid();
    const rs = await Promise.all(Array.from({ length: 15 }, () => submit(auth, { requestId: id })));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    const bodies = (await Promise.all(rs.map((r) => r.json()))) as { replayed: boolean }[];
    expect(bodies.filter((b) => !b.replayed)).toHaveLength(1);
    const w = (await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> };
    expect(w.wallets.eclipse_token).toBe(100 + 1000 + (three ? 50 : 0));
    expect(((await (await game('/api/v1/progress', { headers: auth })).json()) as { ration: { value: number } }).ration.value).toBe(94);
  });

  it('simultaneous different submissions: first-clear rewards are paid once, Ration is never double spent', async () => {
    const { auth } = await signIn(`sub-prog-race-${rid()}`);
    const rs = await Promise.all(Array.from({ length: 12 }, () => submit(auth)));
    const ok = rs.filter((r) => r.status === 200).length;
    expect(ok + rs.filter((r) => r.status === 409 || r.status === 429).length).toBe(12);
    expect(ok).toBeGreaterThanOrEqual(1);
    const w = (await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> };
    expect(w.wallets.eclipse_token).toBe(100 + 1000 * ok + (three ? 50 : 0)); // first clear (and the 3-star bonus) exactly once
    expect(((await (await game('/api/v1/progress', { headers: auth })).json()) as { ration: { value: number } }).ration.value).toBe(100 - 6 * ok);
    expect((await db().prepare('SELECT COUNT(*) AS n FROM tx_guard').first<{ n: number }>())?.n).toBe(0);
  });

  it('rejects forged, incomplete and wrong-node submissions without any side effect', async () => {
    const { auth, playerId } = await signIn(`sub-prog-bad-${rid()}`);
    expect((await submit(auth, { actions: [] })).status).toBe(422);
    expect((await submit(auth, { actions: [{ skillId: 'fadyme_ultimate_the_bell_that_forgets' }] })).status).toBe(422);
    expect((await submit(auth, { actions: actions.slice(0, 2) })).status).toBe(422);
    expect((await submit(auth, { nodeId: 'no_such_node' })).status).toBe(404);
    expect((await submit(auth, { releaseId: 'rel_9999' })).status).toBe(404);
    expect((await submit(auth, { extra: 1 })).status).toBe(400);
    expect((await submit(auth, { nodeId: 't1b' })).status).toBe(403); // requires t1c, which requires t1
    expect((await submit(auth, { nodeId: 't1c' })).status).toBe(403); // requires t1, not cleared yet
    expect((await db().prepare('SELECT COUNT(*) AS n FROM player_progress WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(0);
    expect((await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(0);
    expect((await game('/api/v1/progress/battle', post({ releaseId: 'rel_0001', nodeId: 't1', requestId: 'abcdefgh', actions })) ).status).toBe(401);
    // after clearing t1 the gated node opens
    expect((await submit(auth)).status).toBe(200);
    expect((await submit(auth, { nodeId: 't1c' })).status).toBe(200);
  });

  it('refuses a win when Ration is short and leaves everything untouched', async () => {
    const { auth, playerId } = await signIn(`sub-prog-ration-${rid()}`);
    const now = Date.now();
    await db().prepare('INSERT INTO player_ration (player_id, value, at_ms) VALUES (?1, 5, ?2)').bind(playerId, now).run();
    const res = await submit(auth);
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: string }).error).toBe('not_enough_ration');
    expect((await db().prepare('SELECT COUNT(*) AS n FROM player_progress WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(0);
    // one regeneration step later it is affordable (6 needed)
    await db().prepare('UPDATE player_ration SET at_ms = ?2 WHERE player_id = ?1').bind(playerId, now - 300_000).run();
    expect((await submit(auth)).status).toBe(200);
  });
});

describe('cloud save', () => {
  it('starts empty, writes with compare-and-set, and returns the server copy on a conflict', async () => {
    const { auth } = await signIn(`sub-save-${rid()}`);
    const put = (body: unknown) => game('/api/v1/save', { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...auth } });
    expect(await (await game('/api/v1/save', { headers: auth })).json()).toMatchObject({ version: 0, data: {} });
    expect(await (await put({ expectedVersion: 0, data: { lang: 'tr', team: ['mahmut', 'fadyme'] } })).json()).toEqual({ version: 1 });
    expect(await (await put({ expectedVersion: 1, data: { lang: 'en' } })).json()).toEqual({ version: 2 });
    const stale = await put({ expectedVersion: 1, data: { lang: 'de' } });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: 'save_conflict', detail: { version: 2, data: { lang: 'en' } } });
    const again0 = await put({ expectedVersion: 0, data: {} });
    expect(again0.status).toBe(409);
    expect(await (await game('/api/v1/save', { headers: auth })).json()).toMatchObject({ version: 2, data: { lang: 'en' } });
  });

  it('limits size and shape, and concurrent writers cannot both win', async () => {
    const { auth } = await signIn(`sub-save2-${rid()}`);
    const put = (body: unknown) => game('/api/v1/save', { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...auth } });
    expect((await put({ expectedVersion: 0, data: { blob: 'x'.repeat(70_000) } })).status).toBe(413);
    expect((await put({ expectedVersion: 0, data: 'text' })).status).toBe(400);
    expect((await put({ data: {} })).status).toBe(400);
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => put({ expectedVersion: 0, data: { writer: i } })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(9);
  });
});
