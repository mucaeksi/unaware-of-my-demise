import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { weaponBanner } from '@uomd/economy';
import { applyLedger } from '../src/db/ledger';
import { sendMail } from '../src/mail/service';
import { claimMail } from '../src/mail/service';
import { game, post, seedCanonCatalog, signIn } from './helpers';
import { EventHook } from '@uomd/content-schema';
import { GEAR_PASSIVE_HOOKS, gearPassive, gearPassiveHook, requireNoGearPassive, requireSupportedGearPassive } from '../src/gear/effects';
import { levelGear } from '../src/gear/service';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let n = 0;
const rid = (): string => `x_${++n}_${Math.random().toString(36).slice(2, 10)}`;
beforeAll(seedCanonCatalog);

async function player(over: { stacks?: Record<string, number>; funds?: number } = {}): Promise<{ auth: Record<string, string>; playerId: string }> {
  const { auth, playerId } = await signIn(`sub-gear-${rid()}`);
  for (const [item, qty] of Object.entries(over.stacks ?? {})) await db().prepare('INSERT INTO player_stacks (player_id, item_id, qty) VALUES (?1, ?2, ?3)').bind(playerId, item, qty).run();
  if (over.funds) await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: over.funds, reason: 'test', idempotencyKey: `f:${rid()}` });
  return { auth, playerId };
}
/** grants gear the real way: a mail with gear attachments, claimed */
async function give(playerId: string, gearIds: string[]): Promise<number[]> {
  const before = (await db().prepare('SELECT id FROM player_gear WHERE player_id = ?1').bind(playerId).all<{ id: number }>()).results.map((r) => r.id);
  const m = await sendMail(db(), playerId, { kind: 'reward', title: 'gear', attachments: gearIds.map((gearId) => ({ type: 'gear' as const, gearId })) }, 'test');
  await claimMail(db(), playerId, m.id);
  return (await db().prepare('SELECT id FROM player_gear WHERE player_id = ?1 ORDER BY id').bind(playerId).all<{ id: number }>()).results.map((r) => r.id).filter((i) => !before.includes(i));
}
const call = (auth: Record<string, string>, path: string, body: unknown = {}) => game(`/api/v1${path}`, post(body, auth));
const list = async (auth: Record<string, string>) => ((await (await game('/api/v1/gear', { headers: auth })).json()) as { gear: { id: number; slot: string; level: number; levelCap: number; equippedBy: string | null; stats: { main: { stat: string }; subs: unknown[] } | null; ascension: number; canDismantle: boolean }[] }).gear;

/** a weapon whose passive has no approved battle effect (every seeded signature passive is supported now) */
const futurePassiveWeapon = async (): Promise<string> => {
  await db().prepare(`INSERT OR IGNORE INTO gear_defs (gear_id, slot, name_en, rarity, family, owner_character_id, banner_id, level_cap, base_json, growth_json, extra_json, dismantle_xp, dismantle_json, dismantle_allowed)
    SELECT 'weapon_future_passive', slot, 'Future Passive', rarity, family, owner_character_id, banner_id, level_cap, base_json, growth_json, '{"passive_effect_id":"future_proc","passive_name_en":"Future proc"}', dismantle_xp, dismantle_json, dismantle_allowed FROM gear_defs WHERE gear_id = 'weapon_mahmut_signature'`).run();
  return 'weapon_future_passive';
};

describe('gear: grants and equipping', () => {
  it('rejects malformed passive metadata and future effect IDs without interpreting text', () => {
    for (const value of ['invalid-json', '{"passive_effect_id":42}', '{"passive_name_en":null}']) expect(() => gearPassive(value)).toThrow(expect.objectContaining({ code: 'invalid_gear_definition', status: 503 }));
    expect(() => requireSupportedGearPassive('{"passive_effect_id":"future_proc"}')).toThrow(expect.objectContaining({ code: 'unsupported_gear_passive', status: 422 }));
    expect(gearPassive('{"main":[],"sub":[]}')).toBeNull();
  });
  it('treats a passive with an approved hook as supported and hands that hook to the battle party', () => {
    const hook = EventHook.parse({ event: 'after_ally_ultimate', event_filter: { team: 'player', source_is_owner: true }, limit: { per_owner_turn: 1 }, effect_ops: [{ op: 'gain_focus', target_selector_id: 'self', amount: 15 }] });
    const table = { signature_echo_test: hook };
    const extra = '{"passive_effect_id":"signature_echo_test","passive_name_en":"Echo"}';
    expect(gearPassive(extra, table)).toEqual({ name: 'Echo', supported: true });
    expect(gearPassiveHook(extra, table)).toEqual(hook);
    expect(gearPassive(extra)?.supported).toBe(false); // not in the shipped table until the owner approves it
    expect(gearPassiveHook('{"passive_effect_id":"future_proc"}', table)).toBeNull();
    expect(() => requireNoGearPassive(extra)).toThrow(expect.objectContaining({ code: 'unsupported_gear_passive' }));
    for (const h of Object.values(GEAR_PASSIVE_HOOKS)) expect(EventHook.safeParse(h).success).toBe(true);
  });
  it('refuses an undefined advertised passive before replacing working gear or writing state', async () => {
    const { auth, playerId } = await player();
    const [sword, signature] = await give(playerId, ['weapon_arming_sword_3_01', await futurePassiveWeapon()]);
    expect((await call(auth, `/gear/${sword}/equip`, { characterId: 'mahmut' })).status).toBe(200);
    const before = (await db().prepare('SELECT * FROM player_gear WHERE player_id = ?1 ORDER BY id').bind(playerId).all()).results;
    const response = await call(auth, `/gear/${signature}/equip`, { characterId: 'mahmut' });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'unsupported_gear_passive' });
    expect((await db().prepare('SELECT * FROM player_gear WHERE player_id = ?1 ORDER BY id').bind(playerId).all()).results).toEqual(before);
    const inventory = await (await game('/api/v1/gear', { headers: auth })).json() as { gear: { id: number; passive: unknown }[] };
    expect(inventory.gear.find((g) => g.id === signature)?.passive).toMatchObject({ supported: false });
  });
  it('reusing a gear upgrade identity with different XP is rejected without another spend', async () => {
    const { auth, playerId } = await player({ stacks: { weapon_tempering_xp: 100 }, funds: 100 });
    const [id] = await give(playerId, ['weapon_arming_sword_3_01']); const requestId = rid();
    expect((await call(auth, `/gear/${id}/level-up`, { requestId, xp: 50 })).status).toBe(200);
    expect((await call(auth, `/gear/${id}/level-up`, { requestId, xp: 75 })).status).toBe(409);
    expect((await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'weapon_tempering_xp'").bind(playerId).first<{ qty: number }>())?.qty).toBe(50);
  });

  it('grants weapons and armor as instances and rolls accessory stats at grant time', async () => {
    const { auth, playerId } = await player();
    const [w, a, ring] = await give(playerId, ['weapon_arming_sword_3_01', 'armor_padded_3_01', 'accessory_ash_maw_hide_ring_4']);
    const g = await list(auth);
    expect(g.find((x) => x.id === w)).toMatchObject({ slot: 'weapon', level: 1, levelCap: 5, equippedBy: null });
    expect(g.find((x) => x.id === a)?.slot).toBe('armor');
    const acc = g.find((x) => x.id === ring)!;
    expect(acc.slot).toBe('ring');
    expect(acc.stats?.main.stat).toMatch(/_(pct|flat)$/);
    expect(acc.stats?.subs.length).toBeGreaterThanOrEqual(2);
    // two copies of the same definition are two instances
    const [w2] = await give(playerId, ['weapon_arming_sword_3_01']);
    expect(w2).not.toBe(w);
  });

  it('weapon type and signature rules; slot swap; moving a piece between characters; no double occupancy', async () => {
    const { auth, playerId } = await player();
    await db().prepare("INSERT INTO player_items (player_id, item_type, item_id) VALUES (?1, 'character', 'fadyme')").bind(playerId).run().catch(() => undefined);
    const [sword1, sword2, bow, sigFadyme, mail] = await give(playerId, ['weapon_arming_sword_3_01', 'weapon_arming_sword_4_02', 'weapon_longbow_3_01', 'weapon_fadyme_signature', 'armor_mail_3_02']);
    expect((await call(auth, `/gear/${bow}/equip`, { characterId: 'mahmut' })).status).toBe(422); // Mahmut uses an arming sword
    expect((await call(auth, `/gear/${sigFadyme}/equip`, { characterId: 'mahmut' })).status).toBe(422); // another character's signature
    expect((await call(auth, `/gear/${sword1}/equip`, { characterId: 'kera_voss' })).status).toBe(404); // not owned
    expect((await call(auth, `/gear/${sword1}/equip`, { characterId: 'mahmut' })).status).toBe(200);
    expect((await call(auth, `/gear/${sword2}/equip`, { characterId: 'mahmut' })).status).toBe(200); // swaps the slot
    let g = await list(auth);
    expect(g.find((x) => x.id === sword1)?.equippedBy).toBeNull();
    expect(g.find((x) => x.id === sword2)?.equippedBy).toBe('mahmut');
    expect((await call(auth, `/gear/${mail}/equip`, { characterId: 'mahmut' })).status).toBe(200);
    expect((await call(auth, `/gear/${mail}/unequip`)).status).toBe(200);
    g = await list(auth);
    expect(g.filter((x) => x.equippedBy === 'mahmut').map((x) => x.slot)).toEqual(['weapon']);
    // parallel equips of the same piece onto two characters leave it with exactly one owner
    const rs = await Promise.all([call(auth, `/gear/${sword1}/equip`, { characterId: 'mahmut' }), call(auth, `/gear/${sword1}/equip`, { characterId: 'fadyme' })]);
    expect(rs.some((r) => r.status === 200)).toBe(true);
    const owners = (await db().prepare('SELECT equipped_by FROM player_gear WHERE id = ?1').bind(sword1).first<{ equipped_by: string | null }>())!.equipped_by;
    expect(['mahmut', 'fadyme']).toContain(owners);
    expect((await db().prepare("SELECT COUNT(*) AS n FROM player_gear WHERE player_id = ?1 AND equipped_by = 'mahmut' AND slot = 'weapon'").bind(playerId).first<{ n: number }>())?.n).toBeLessThanOrEqual(1);
  });
});

describe('gear: leveling, rivets, dismantling, rerolling', () => {
  it('binds reviewed costs to the item version before spending or recording a request', async () => {
    const { auth, playerId } = await player({ stacks: { weapon_tempering_xp: 100 }, funds: 100 });
    const [id] = await give(playerId, ['weapon_arming_sword_3_01']);
    const view = await (await game('/api/v1/gear', { headers: auth })).json() as { versionBound: boolean; gear: { id: number; version: number }[] };
    expect(view.versionBound).toBe(true);
    const expectedVersion = view.gear.find((g) => g.id === id)!.version;
    expect((await call(auth, `/gear/${id}/lock`, { locked: true })).status).toBe(200);
    const before = await db().prepare('SELECT * FROM player_gear WHERE id = ?1').bind(id).first();
    const wallet = await (await game('/api/v1/wallet', { headers: auth })).json();
    const requestId = rid();
    const response = await call(auth, `/gear/${id}/level-up`, { requestId, xp: 50, expectedVersion });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'gear_changed' });
    expect(await db().prepare('SELECT * FROM player_gear WHERE id = ?1').bind(id).first()).toEqual(before);
    expect((await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'weapon_tempering_xp'").bind(playerId).first<{ qty: number }>())?.qty).toBe(100);
    expect((await db().prepare('SELECT COUNT(*) AS n FROM progression_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<{ n: number }>())?.n).toBe(0);
    expect(await (await game('/api/v1/wallet', { headers: auth })).json()).toEqual(wallet);
  });

  it('rejects a version change between cost planning and the atomic batch without spending on retry', async () => {
    const { auth, playerId } = await player({ stacks: { weapon_tempering_xp: 100 }, funds: 100 });
    const [id] = await give(playerId, ['weapon_arming_sword_3_01']); const original = db();
    const expectedVersion = (await original.prepare('SELECT version FROM player_gear WHERE id = ?1').bind(id).first<{ version: number }>())!.version;
    let raced = false;
    const competing = new Proxy(original, { get(target, prop) {
      if (prop === 'batch') return async (statements: D1PreparedStatement[]) => {
        if (!raced) { raced = true; await original.prepare('UPDATE player_gear SET locked = 1, version = version + 1 WHERE id = ?1').bind(id).run(); }
        return original.batch(statements);
      };
      const value = Reflect.get(target, prop); return typeof value === 'function' ? value.bind(target) : value;
    } });
    const wallet = await (await game('/api/v1/wallet', { headers: auth })).json();
    const requestId = rid();
    await expect(levelGear(competing, playerId, id!, { requestId, xp: 50, expectedVersion })).rejects.toMatchObject({ status: 409, code: 'gear_changed' });
    expect(raced).toBe(true);
    expect(await original.prepare('SELECT level, xp, locked, version FROM player_gear WHERE id = ?1').bind(id).first()).toEqual({ level: 1, xp: 0, locked: 1, version: expectedVersion + 1 });
    expect((await original.prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'weapon_tempering_xp'").bind(playerId).first<{ qty: number }>())?.qty).toBe(100);
    expect((await original.prepare('SELECT COUNT(*) AS n FROM progression_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<{ n: number }>())?.n).toBe(0);
    expect(await (await game('/api/v1/wallet', { headers: auth })).json()).toEqual(wallet);
  });

  it('replays the original version-bound receipt after later equipment changes', async () => {
    const { auth, playerId } = await player({ stacks: { weapon_tempering_xp: 100 }, funds: 100 });
    const [id] = await give(playerId, ['weapon_arming_sword_3_01']);
    const expectedVersion = (await db().prepare('SELECT version FROM player_gear WHERE id = ?1').bind(id).first<{ version: number }>())!.version;
    const input = { requestId: rid(), xp: 50, expectedVersion };
    const first = await call(auth, `/gear/${id}/level-up`, input);
    expect(first.status).toBe(200);
    const receipt = await first.json() as Record<string, unknown>;
    expect(receipt.expectedVersion).toBe(expectedVersion);
    expect((await call(auth, `/gear/${id}/lock`, { locked: true })).status).toBe(200);
    const before = await db().prepare('SELECT * FROM player_gear WHERE id = ?1').bind(id).first();
    const replay = await call(auth, `/gear/${id}/level-up`, input);
    expect(replay.status).toBe(200);
    const repeated = await replay.json() as Record<string, unknown>;
    const { balance: _balance, replayed: _replayed, ...stored } = receipt;
    expect(repeated).toEqual({ ...stored, replayed: true });
    expect(await db().prepare('SELECT * FROM player_gear WHERE id = ?1').bind(id).first()).toEqual(before);
    expect((await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'weapon_tempering_xp'").bind(playerId).first<{ qty: number }>())?.qty).toBe(50);
  });

  it('levels with tempering XP up to level 5, then needs a Blacksmith Rivet; fee in the main currency; no XP wasted', async () => {
    const { auth, playerId } = await player({ stacks: { weapon_tempering_xp: 2000, blacksmith_rivet: 1 }, funds: 200 });
    const [w] = await give(playerId, ['weapon_arming_sword_3_01']);
    const r = await call(auth, `/gear/${w}/level-up`, { requestId: rid(), xp: 1000 });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { level: number; cap: number; spentXp: number; fee: number };
    expect(j).toMatchObject({ level: 5, cap: 5 }); // xp_to_next 25 + 30 + 35 + 40 = 130 to reach level 5
    expect(j.spentXp).toBe(130);
    expect((await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'weapon_tempering_xp'").bind(playerId).first<{ qty: number }>())?.qty).toBe(2000 - 130);
    expect(j.fee).toBeGreaterThan(0);
    expect((await call(auth, `/gear/${w}/level-up`, { requestId: rid(), xp: 10 })).status).toBe(409); // at the milestone cap
    const asc = await call(auth, `/gear/${w}/ascend`, { requestId: rid() });
    expect(await asc.json()).toMatchObject({ ascension: 1, newCap: 10, spentRivets: 1 });
    expect((await call(auth, `/gear/${w}/ascend`, { requestId: rid() })).status).toBe(409); // not at the new cap
    expect((await call(auth, `/gear/${w}/level-up`, { requestId: rid(), xp: 100 })).status).toBe(200);
    // a replayed request changes nothing
    const id = rid();
    const a = await (await call(auth, `/gear/${w}/level-up`, { requestId: id, xp: 50 })).json();
    const b = (await (await call(auth, `/gear/${w}/level-up`, { requestId: id, xp: 50 })).json()) as { replayed: boolean };
    expect(b.replayed).toBe(true);
    expect((a as { level: number }).level).toBeGreaterThanOrEqual(6);
  });

  it('refuses without materials and leaves the piece untouched; accessories cannot be leveled', async () => {
    const { auth, playerId } = await player({ stacks: { weapon_tempering_xp: 5 }, funds: 100 });
    const [w, ring] = await give(playerId, ['weapon_arming_sword_3_01', 'accessory_ash_maw_hide_ring_3']);
    expect((await call(auth, `/gear/${w}/level-up`, { requestId: rid(), xp: 100 })).status).toBe(402);
    expect((await list(auth)).find((x) => x.id === w)?.level).toBe(1);
    expect((await call(auth, `/gear/${ring}/level-up`, { requestId: rid(), xp: 1 })).status).toBe(422);
  });

  it('dismantle: tempering XP and Forge Dust, never equipped / locked / signature pieces; replay-safe; the piece is gone', async () => {
    const { auth, playerId } = await player();
    const [w, locked, equipped, sig] = await give(playerId, ['weapon_arming_sword_4_02', 'weapon_arming_sword_3_01', 'weapon_arming_sword_3_01', 'weapon_mahmut_signature']);
    expect((await call(auth, `/gear/${locked}/lock`, { locked: true })).status).toBe(200);
    expect((await call(auth, `/gear/${equipped}/equip`, { characterId: 'mahmut' })).status).toBe(200);
    expect((await call(auth, `/gear/${locked}/dismantle`, { requestId: rid() })).status).toBe(409);
    expect((await call(auth, `/gear/${equipped}/dismantle`, { requestId: rid() })).status).toBe(409);
    expect((await call(auth, `/gear/${sig}/dismantle`, { requestId: rid() })).status).toBe(422);
    const id = rid();
    const ok = await call(auth, `/gear/${w}/dismantle`, { requestId: id });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ gained: [{ itemId: 'weapon_tempering_xp', quantity: 80 }, { itemId: 'forge_dust', quantity: 3 }] });
    expect(((await (await call(auth, `/gear/${w}/dismantle`, { requestId: id })).json()) as { replayed: boolean }).replayed).toBe(true);
    expect((await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'forge_dust'").bind(playerId).first<{ qty: number }>())?.qty).toBe(3);
    expect((await list(auth)).some((x) => x.id === w)).toBe(false);
    expect((await call(auth, `/gear/${w}/dismantle`, { requestId: rid() })).status).toBe(404);
  });

  it('reroll: only 4-5 star accessories, costs Cinders, keeps the main stat', async () => {
    const { auth, playerId } = await player({ stacks: { unwritten_hour_cinder: 6 } });
    const [three, four] = await give(playerId, ['accessory_ash_maw_hide_necklace_3', 'accessory_ash_maw_hide_necklace_4']);
    expect((await call(auth, `/gear/${three}/reroll`, { requestId: rid() })).status).toBe(422);
    const before = (await list(auth)).find((x) => x.id === four)!;
    const r = await call(auth, `/gear/${four}/reroll`, { requestId: rid() });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { stats: { main: { stat: string } }; spent: { quantity: number } };
    expect(j.stats.main.stat).toBe(before.stats?.main.stat);
    expect(j.spent.quantity).toBe(3);
    expect((await call(auth, `/gear/${four}/reroll`, { requestId: rid() })).status).toBe(200);
    expect((await call(auth, `/gear/${four}/reroll`, { requestId: rid() })).status).toBe(402); // out of cinders
  });
});

describe('server-side character stats and weapon banners', () => {
  it('equipped gear raises the final stats; the same function will feed server-verified parties', async () => {
    const { auth, playerId } = await player();
    const base = (await (await game('/api/v1/characters/mahmut/stats', { headers: auth })).json()) as { stats: { atk: number; hp: number } };
    const [w, mail] = await give(playerId, ['weapon_arming_sword_4_02', 'armor_mail_3_02']);
    await call(auth, `/gear/${w}/equip`, { characterId: 'mahmut' });
    await call(auth, `/gear/${mail}/equip`, { characterId: 'mahmut' });
    const geared = (await (await game('/api/v1/characters/mahmut/stats', { headers: auth })).json()) as { stats: { atk: number; hp: number; def: number }; equipped: unknown[] };
    expect(geared.equipped).toHaveLength(2);
    expect(geared.stats.atk).toBeGreaterThanOrEqual(base.stats.atk);
    expect(geared.stats.hp).toBeGreaterThanOrEqual(base.stats.hp);
    expect((await game('/api/v1/characters/kera_voss/stats', { headers: auth })).status).toBe(404);
  });

  it('a weapon banner grants gear instances, charges the banner price and keeps the pity rules', async () => {
    const signatures = ['weapon_mahmut_signature', 'weapon_fadyme_signature', 'weapon_kera_voss_signature'];
    const rows = async (r: number) => (await db().prepare("SELECT gear_id FROM gear_defs WHERE slot = 'weapon' AND rarity = ?1 AND owner_character_id IS NULL ORDER BY gear_id LIMIT 6").bind(r).all<{ gear_id: string }>()).results.map((x) => x.gear_id);
    const cfg = weaponBanner('hall_test', signatures, [], { four: await rows(4), three: await rows(3) }, true);
    await db().prepare("INSERT OR REPLACE INTO banners (id, title_en, config_json, status) VALUES ('hall_test', 'Hall test', ?1, 'active')").bind(JSON.stringify(cfg)).run();
    const { auth, playerId } = await player({ funds: 160 * 10 });
    const res = await call(auth, '/gacha/pull', { bannerId: 'hall_test', count: 10, requestId: rid(), target: 'weapon_fadyme_signature' });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { pulls: { itemId: string; duplicate: boolean }[]; cost: { amount: number } };
    expect(j.cost.amount).toBe(1600);
    expect(j.pulls.every((p) => !p.duplicate)).toBe(true);
    expect((await db().prepare('SELECT COUNT(*) AS n FROM player_gear WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(10);
    expect((await call(auth, '/gacha/pull', { bannerId: 'hall_test', count: 1, requestId: rid() })).status).toBe(422); // a selectable banner needs a target
  });
});

it('keeps legacy empty-body unequip compatible', async () => {
  const { auth, playerId } = await player(); const [id] = await give(playerId, ['weapon_arming_sword_3_01']);
  expect((await call(auth, `/gear/${id}/equip`, { characterId: 'mahmut' })).status).toBe(200);
  const removed = await game(`/api/v1/gear/${id}/unequip`, { method: 'POST', headers: auth }); expect(removed.status).toBe(200);
  expect(await removed.json()).toMatchObject({ id, equippedBy: null });
});
