import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyLedger } from '../src/db/ledger';
import { gearInstanceStatement } from '../src/db/grants';
import { game, post, seedCanonCatalog, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
const rid = (): string => crypto.randomUUID();
beforeAll(seedCanonCatalog);

async function player(stacks: Record<string, number> = {}) {
  const p = await signIn(`material-${rid()}`);
  await db().prepare('INSERT INTO player_account (player_id, xp) VALUES (?1, 1500)').bind(p.playerId).run();
  await applyLedger(db(), { playerId: p.playerId, currency: 'eclipse_token', delta: 1000, reason: 'test', idempotencyKey: rid() });
  for (const [item, qty] of Object.entries(stacks)) {
    await db().prepare('INSERT INTO player_stacks (player_id, item_id, qty) VALUES (?1, ?2, ?3)').bind(p.playerId, item, qty).run();
  }
  return p;
}

// Rejected operations must roll back the complete gameplay/finance batch, including newly created rows.
async function snapshot(playerId: string): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  for (const table of ['wallets', 'ledger', 'player_stacks', 'player_chars', 'player_gear', 'player_tasks', 'progression_requests', 'player_account']) {
    result[table] = (await db().prepare(`SELECT * FROM ${table} WHERE player_id = ?1`).bind(playerId).all()).results.map((r) => JSON.stringify(r)).sort();
  }
  return result;
}

const call = (auth: Record<string, string>, path: string, body: Record<string, unknown>, requestId = rid()) =>
  game(`/api/v1${path}`, post({ ...body, requestId }, auth));
const level = (auth: Record<string, string>, items = [{ itemId: 'torn_chronicle_page', quantity: 3 }], requestId = rid()) =>
  call(auth, '/characters/mahmut/level-up', { items }, requestId);

describe('material spending is atomic for every consumer', () => {
  it.each([undefined, 0, 2])('rejects never-owned/zero/insufficient character XP stacks (%s), without any partial change', async (qty) => {
    const p = await player(qty === undefined ? {} : { torn_chronicle_page: qty });
    const before = await snapshot(p.playerId);
    const response = await level(p.auth);
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({ error: 'insufficient_items' });
    expect(await snapshot(p.playerId)).toEqual(before);
  });

  it('rolls back the first material when a later material is absent', async () => {
    const p = await player({ torn_chronicle_page: 2 });
    const before = await snapshot(p.playerId);
    const response = await level(p.auth, [{ itemId: 'torn_chronicle_page', quantity: 1 }, { itemId: 'bound_chronicle', quantity: 1 }]);
    expect(response.status).toBe(402);
    expect(await snapshot(p.playerId)).toEqual(before);
  });

  it.each(['ascend', 'skill'])('rejects a missing character %s material with state/fee/journal unchanged', async (operation) => {
    const p = await player();
    await db().prepare("INSERT INTO player_chars (player_id, character_id, level) VALUES (?1, 'mahmut', 5)").bind(p.playerId).run();
    const before = await snapshot(p.playerId);
    const path = operation === 'ascend' ? '/characters/mahmut/ascend' : '/characters/mahmut/skills/mahmut_active_broken_crest_guard/upgrade';
    expect((await call(p.auth, path, {})).status).toBe(402);
    expect(await snapshot(p.playerId)).toEqual(before);
  });

  it.each(['level-up', 'ascend', 'reroll'])('rejects missing gear %s materials without changing gear/version/stats/fee/journal', async (operation) => {
    const p = await player();
    const gearId = operation === 'reroll' ? 'accessory_ash_maw_hide_necklace_4' : 'weapon_arming_sword_3_01';
    await db().batch([await gearInstanceStatement(db(), p.playerId, gearId)]);
    const gear = await db().prepare('SELECT id FROM player_gear WHERE player_id = ?1').bind(p.playerId).first<{ id: number }>();
    if (operation === 'ascend') await db().prepare('UPDATE player_gear SET level = 5 WHERE id = ?1').bind(gear!.id).run();
    const before = await snapshot(p.playerId);
    expect((await call(p.auth, `/gear/${gear!.id}/${operation}`, operation === 'level-up' ? { xp: 25 } : {})).status).toBe(402);
    expect(await snapshot(p.playerId)).toEqual(before);
  });

  it('spends an exact stack once and replays a response-lost/concurrent identical request without new changes', async () => {
    const p = await player({ torn_chronicle_page: 3 });
    const requestId = rid();
    const responses = await Promise.all([level(p.auth, undefined, requestId), level(p.auth, undefined, requestId)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'torn_chronicle_page'").bind(p.playerId).first()).toMatchObject({ qty: 0 });
    const committed = await snapshot(p.playerId);
    const replay = await level(p.auth, undefined, requestId);
    expect(await replay.json()).toMatchObject({ replayed: true, level: 3, xp: 8 });
    expect(await snapshot(p.playerId)).toEqual(committed);
    expect(await db().prepare('SELECT COUNT(*) AS n FROM progression_requests WHERE player_id = ?1').bind(p.playerId).first()).toMatchObject({ n: 1 });
  });

  it('two different concurrent requests cannot both spend the last stack; rejection can retry after a later grant', async () => {
    const p = await player({ torn_chronicle_page: 3 });
    const a = rid(), b = rid();
    const responses = await Promise.all([level(p.auth, undefined, a), level(p.auth, undefined, b)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 402]);
    expect(await db().prepare('SELECT COUNT(*) AS n FROM progression_requests WHERE player_id = ?1').bind(p.playerId).first()).toMatchObject({ n: 1 });
    await db().prepare("UPDATE player_stacks SET qty = 3 WHERE player_id = ?1 AND item_id = 'torn_chronicle_page'").bind(p.playerId).run();
    expect((await level(p.auth, undefined, responses[0]!.status === 402 ? a : b)).status).toBe(200);
    expect(await db().prepare('SELECT COUNT(*) AS n FROM progression_requests WHERE player_id = ?1').bind(p.playerId).first()).toMatchObject({ n: 2 });
  });
});
