import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyLedger } from '../src/db/ledger';
import { game, post, seedCanonCatalog, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let n = 0;
const rid = (): string => `g_${++n}_${Math.random().toString(36).slice(2, 10)}`;

beforeAll(seedCanonCatalog);

async function setup(over: { account?: number; stacks?: Record<string, number>; funds?: number } = {}): Promise<{ auth: Record<string, string>; playerId: string }> {
  const { auth, playerId } = await signIn(`sub-prog2-${rid()}`);
  if (over.account) await db().prepare('INSERT INTO player_account (player_id, xp) VALUES (?1, ?2)').bind(playerId, over.account).run();
  for (const [item, qty] of Object.entries(over.stacks ?? {})) await db().prepare('INSERT INTO player_stacks (player_id, item_id, qty) VALUES (?1, ?2, ?3)').bind(playerId, item, qty).run();
  if (over.funds) await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: over.funds, reason: 'test', idempotencyKey: `f:${rid()}` });
  return { auth, playerId };
}
const lvl = (auth: Record<string, string>, id: string, items: { itemId: string; quantity: number }[], requestId = rid()) => game(`/api/v1/characters/${id}/level-up`, post({ requestId, items }, auth));
const mine = async (auth: Record<string, string>) => (await (await game('/api/v1/characters/mine', { headers: auth })).json()) as { account: { level: number; xp: number }; characters: { id: string; level: number; xp: number; cap: number; ascension: number; xpToNext: number; skills: { skillId: string; rank: number; next: unknown }[]; nextAscension: { cap: number } | null }[] };
const wallet = async (auth: Record<string, string>) => ((await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> }).wallets.eclipse_token ?? 0;

describe('character growth', () => {
  it('lists the free-start roster at level 1; the cap follows account level and ascension', async () => {
    const { auth } = await setup({ account: 250 * 3 + 50 * 3 }); // account level 4
    const m = await mine(auth);
    expect(m.account.level).toBe(4);
    const mahmut = m.characters.find((c) => c.id === 'mahmut')!;
    expect(mahmut).toMatchObject({ level: 1, xp: 0, ascension: 0, cap: 4, xpToNext: 122 });
    expect(mahmut.nextAscension?.cap).toBe(10);
    expect(mahmut.skills.map((s) => s.rank)).toEqual([1, 1, 1, 1]);
  });

  it('levels up with Chronicle items: xp math, fee in the main currency, stacks consumed atomically, replay-safe', async () => {
    const { auth, playerId } = await setup({ account: 1500, stacks: { torn_chronicle_page: 10, bound_chronicle: 2 }, funds: 100 });
    const id = rid();
    const r = await lvl(auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 3 }], id); // 300 xp: level 1 -> 3 (122 + 170 = 292), 8 left
    expect(r.status).toBe(200);
    const j = (await r.json()) as { level: number; xp: number; spent: { fee: number }; balance: number; levelsGained: number };
    expect(j).toMatchObject({ level: 3, xp: 8, levelsGained: 2, spent: { fee: 2 + 2 } });
    expect(j.balance).toBe(100 - 4);
    const again = (await (await lvl(auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 3 }], id)).json()) as { replayed: boolean; level: number };
    expect(again).toMatchObject({ replayed: true, level: 3 });
    expect(await wallet(auth)).toBe(96);
    expect((await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'torn_chronicle_page'").bind(playerId).first<{ qty: number }>())?.qty).toBe(7);
    const m = await mine(auth);
    expect(m.characters.find((c) => c.id === 'mahmut')).toMatchObject({ level: 3, xp: 8 });
  });

  it('refuses without materials or funds and leaves no trace; refuses wrong items, unowned characters and at-cap characters', async () => {
    const poor = await setup({ account: 1500, stacks: { torn_chronicle_page: 1 }, funds: 100 });
    expect((await lvl(poor.auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 2 }])).status).toBe(402);
    const broke = await setup({ account: 1500, stacks: { bound_chronicle: 1 } });
    expect((await lvl(broke.auth, 'mahmut', [{ itemId: 'bound_chronicle', quantity: 1 }])).status).toBe(402);
    expect((await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'bound_chronicle'").bind(broke.playerId).first<{ qty: number }>())?.qty).toBe(1);
    expect((await db().prepare('SELECT COUNT(*) AS n FROM player_chars WHERE player_id = ?1').bind(broke.playerId).first<{ n: number }>())?.n).toBe(0);
    const ok = await setup({ account: 1500, stacks: { forge_dust: 5, torn_chronicle_page: 99 }, funds: 1000 });
    expect((await lvl(ok.auth, 'mahmut', [{ itemId: 'forge_dust', quantity: 1 }])).status).toBe(422);
    expect((await lvl(ok.auth, 'kera_voss', [{ itemId: 'torn_chronicle_page', quantity: 1 }])).status).toBe(404);
    expect((await lvl(ok.auth, 'mahmut', [{ itemId: 'nope_item', quantity: 1 }])).status).toBe(422);
    // 99 pages (9,900 xp) would level far past the cap of 5: whole items would be wasted
    const waste = await lvl(ok.auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 99 }]);
    expect(waste.status).toBe(422);
    expect(((await waste.json()) as { error: string }).error).toBe('xp_overflow');
    // exactly enough for cap 5 works, then the character is at its cap
    const total = 122 + 170 + 234 + 314; // xp_to_next(1..4) = 840
    const pages = Math.ceil(total / 100);
    expect((await lvl(ok.auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: pages }])).status).toBe(200);
    const capped = await lvl(ok.auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 1 }]);
    expect(capped.status).toBe(409);
    expect(((await capped.json()) as { error: string; detail: { reason: string } }).detail.reason).toBe('ascension');
  });

  it('account level limits a character below the ascension cap', async () => {
    const { auth } = await setup({ account: 250, stacks: { torn_chronicle_page: 20 }, funds: 100 }); // account level 2
    const r = await lvl(auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 2 }]); // 200 xp: reaches level 2 only
    expect(((await r.json()) as { level: number }).level).toBe(2);
    const stuck = await lvl(auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 1 }]);
    expect(stuck.status).toBe(409);
    expect(((await stuck.json()) as { detail: { reason: string } }).detail.reason).toBe('account_level');
  });

  it('ascension needs the cap level, the account level, the materials and the fee; then the cap rises', async () => {
    const { auth, playerId } = await setup({ account: 250 * 4 + 50 * 6, stacks: { torn_chronicle_page: 20, iron_oath_seal: 3 }, funds: 500 }); // account level 5
    const asc = (requestId = rid()) => game('/api/v1/characters/mahmut/ascend', post({ requestId }, auth));
    expect((await asc()).status).toBe(409); // not at the cap yet
    expect((await lvl(auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 9 }])).status).toBe(200); // 900 xp reaches level 5
    const before = await wallet(auth);
    const r = await asc();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ascension: 1, spent: { items: [{ itemId: 'iron_oath_seal', quantity: 3 }], fee: 50 } });
    expect(await wallet(auth)).toBe(before - 50);
    expect((await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'iron_oath_seal'").bind(playerId).first<{ qty: number }>())?.qty).toBe(0);
    expect((await mine(auth)).characters.find((c) => c.id === 'mahmut')).toMatchObject({ ascension: 1, cap: 5 }); // account level 5 still limits to 5
    // the next step needs account level 10, more seals and cores: refused for the right reason
    expect((await asc()).status).toBe(409);
  });

  it('skill ranks need the character level, the item and the fee', async () => {
    const { auth } = await setup({ account: 2500, stacks: { torn_chronicle_page: 20, tactical_notes: 10, hymn_leaves: 10 }, funds: 200 });
    const up = (skillId: string) => game(`/api/v1/characters/mahmut/skills/${skillId}/upgrade`, post({ requestId: rid() }, auth));
    expect((await up('mahmut_active_broken_crest_guard')).status).toBe(409); // level 1 < 5
    expect((await lvl(auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 9 }])).status).toBe(200); // level 5
    const r = await up('mahmut_active_broken_crest_guard');
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ rank: 2, spent: { items: [{ itemId: 'tactical_notes', quantity: 3 }], fee: 10 } });
    const u = await up('mahmut_ultimate_last_wall_at_dusk'); // ultimate uses hymn leaves
    expect(await u.json()).toMatchObject({ rank: 2, spent: { items: [{ itemId: 'hymn_leaves', quantity: 3 }] } });
    expect((await up('mahmut_active_broken_crest_guard')).status).toBe(409); // rank 3 needs level 10
    expect((await up('fadyme_basic_x')).status).toBe(404);
    const sk = (await mine(auth)).characters.find((c) => c.id === 'mahmut')!.skills;
    expect(sk.find((s) => s.skillId === 'mahmut_active_broken_crest_guard')?.rank).toBe(2);
  });

  it('10 simultaneous level-ups with the same materials: stacks never go negative, the fee is charged once per accepted request', async () => {
    const { auth, playerId } = await setup({ account: 2500, stacks: { torn_chronicle_page: 6 }, funds: 1000 });
    const rs = await Promise.all(Array.from({ length: 10 }, () => lvl(auth, 'mahmut', [{ itemId: 'torn_chronicle_page', quantity: 2 }])));
    const ok = rs.filter((r) => r.status === 200).length;
    expect(ok).toBe(3); // 6 pages = three requests of 2
    expect(rs.filter((r) => r.status === 402 || r.status === 409 || r.status === 429).length).toBe(7);
    expect((await db().prepare("SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = 'torn_chronicle_page'").bind(playerId).first<{ qty: number }>())?.qty).toBe(0);
    const c = (await mine(auth)).characters.find((x) => x.id === 'mahmut')!;
    expect(c.level * 1000 + c.xp).toBeGreaterThan(1000);
    expect(await wallet(auth)).toBe(1000 - (await db().prepare("SELECT -SUM(delta) AS s FROM ledger WHERE player_id = ?1 AND reason LIKE 'level_up:%'").bind(playerId).first<{ s: number }>())!.s);
  });
});
