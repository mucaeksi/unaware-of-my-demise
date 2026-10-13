import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { standardCharacterBanner } from '@uomd/economy';
import { canonicalJson, sha256Hex } from '@uomd/shared';
import { applyLedger } from '../src/db/ledger';
import { game, post, seedCanonCatalog, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
const path = '/api/v1/gacha/pull';
const rid = () => `status_${crypto.randomUUID().replaceAll('-', '')}`;
const status = (auth: Record<string, string>, id: string, operationPath = path) => game(`/api/v1/operations/${id}?path=${encodeURIComponent(operationPath)}`, { headers: auth });
beforeAll(async () => {
  await seedCanonCatalog();
  const config = standardCharacterBanner('status_banner', { four: ['status_four'], three: ['status_three'], fiveStandard: ['mahmut', 'fadyme'] });
  await db().prepare("INSERT INTO banners (id, title_en, config_json, status) VALUES ('status_banner', 'Status fixture', ?1, 'active')").bind(JSON.stringify(config)).run();
});
async function committed() {
  const player = await signIn(`status-${rid()}`); const requestId = rid();
  const input = { requestId, bannerId: 'status_banner', count: 1 };
  await applyLedger(db(), { playerId: player.playerId, currency: 'eclipse_token', delta: 320, reason: 'isolated status fixture', idempotencyKey: rid() });
  const reply = await game(path, post(input, player.auth)); expect(reply.status).toBe(200);
  return { ...player, input, result: await reply.json() as { pulls: unknown[] } };
}

describe('authenticated operation result recovery', () => {
  it('returns the original committed result and exact input hash without repeating a grant', async () => {
    const { auth, playerId, input, result } = await committed();
    const before = await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first();
    const response = await status(auth, input.requestId); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ state: 'confirmed', binding: 'exact', requestId: input.requestId, path,
      inputHash: await sha256Hex(canonicalJson(input)), result: { requestId: input.requestId, pulls: result.pulls, balance: 160, replayed: true } });
    expect(await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first()).toEqual(before);
  });

  it('requires authentication, isolates players and validates resource paths', async () => {
    const { auth, input } = await committed(); const other = await signIn(`status-other-${rid()}`);
    expect((await status({}, input.requestId)).status).toBe(401);
    expect(await (await status(other.auth, input.requestId)).json()).toMatchObject({ state: 'unknown' });
    expect((await status(auth, input.requestId, '/api/v1/account/export')).status).toBe(400);
    expect((await status(auth, '../private')).status).toBe(404);
  });

  it('reports absence as unknown and never as a definitive financial rejection', async () => {
    const { auth } = await signIn(`status-unknown-${rid()}`);
    expect(await (await status(auth, rid())).json()).toMatchObject({ state: 'unknown', binding: null, result: null });
  });

  it('does not invent input proof for legacy rows and prevents changing new committed journals', async () => {
    const { auth, playerId, input, result } = await committed(); const legacy = rid();
    await db().prepare('INSERT INTO gacha_requests (player_id, request_id, banner_id, pull_count, result_json) VALUES (?1, ?2, ?3, 1, ?4)')
      .bind(playerId, legacy, input.bannerId, JSON.stringify({ ...result, requestId: legacy })).run();
    expect(await (await status(auth, legacy)).json()).toMatchObject({ state: 'confirmed', binding: 'legacy', inputHash: null });
    await expect(db().prepare("UPDATE gacha_requests SET input_json = '{}' WHERE player_id = ?1 AND request_id = ?2").bind(playerId, input.requestId).run()).rejects.toThrow(/immutable/i);
    await expect(db().prepare("UPDATE gacha_requests SET result_json = '{}' WHERE player_id = ?1 AND request_id = ?2").bind(playerId, input.requestId).run()).rejects.toThrow(/immutable/i);
  });

  it('recovers character and gear results from their own original paths', async () => {
    const { auth, playerId } = await signIn(`status-upgrades-${rid()}`);
    await db().prepare('INSERT INTO player_account (player_id, xp) VALUES (?1, 2500)').bind(playerId).run();
    await db().prepare("INSERT INTO player_stacks (player_id, item_id, qty) VALUES (?1, 'torn_chronicle_page', 3), (?1, 'weapon_tempering_xp', 100)").bind(playerId).run();
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 100, reason: 'test', idempotencyKey: rid() });
    const characterPath = '/api/v1/characters/mahmut/level-up'; const characterBody = { requestId: rid(), items: [{ itemId: 'torn_chronicle_page', quantity: 2 }] };
    expect((await game(characterPath, post(characterBody, auth))).status).toBe(200);
    expect(await (await status(auth, characterBody.requestId, characterPath)).json()).toMatchObject({ binding: 'exact', inputHash: await sha256Hex(canonicalJson(characterBody)), result: { character: 'mahmut', level: 2 } });
    expect((await status(auth, characterBody.requestId, '/api/v1/characters/fadyme/level-up')).status).toBe(409);
    const gear = await db().prepare("INSERT INTO player_gear (player_id, gear_id, slot) VALUES (?1, 'weapon_arming_sword_3_01', 'weapon') RETURNING id").bind(playerId).first<{ id: number }>();
    const gearPath = `/api/v1/gear/${gear!.id}/level-up`; const gearBody = { requestId: rid(), xp: 50 };
    expect((await game(gearPath, post(gearBody, auth))).status).toBe(200);
    expect(await (await status(auth, gearBody.requestId, gearPath)).json()).toMatchObject({ state: 'confirmed', binding: 'exact', inputHash: await sha256Hex(canonicalJson(gearBody)), result: { id: gear!.id, level: 2 } });
  });
});
