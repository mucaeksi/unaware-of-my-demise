import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { limitedCharacterBanner, standardCharacterBanner, weaponBanner } from '@uomd/economy';
import { applyLedger } from '../src/db/ledger';
import { pullGacha } from '../src/gacha/service';
import { game, post, seedCanonCatalog, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
const POOLS = {
  four: ['f1', 'f2', 'f3'],
  three: ['t1', 't2', 't3'],
  fiveStandard: ['mahmut', 'fadyme']
};
let n = 0;
const rid = (): string => `req_${++n}_${Math.random().toString(36).slice(2, 10)}`;

async function putBanner(id: string, cfg: unknown, over: { status?: string; starts?: string | null; ends?: string | null } = {}): Promise<void> {
  await db()
    .prepare('INSERT OR REPLACE INTO banners (id, title_en, config_json, starts_at, ends_at, status) VALUES (?1,?2,?3,?4,?5,?6)')
    .bind(id, id, JSON.stringify(cfg), over.starts ?? null, over.ends ?? null, over.status ?? 'active')
    .run();
}
/** D-17: one currency. Tests think in pulls; a pull costs 160 Eclipse Tokens. */
const P = 160;
const fund = (playerId: string, pulls: number, key = rid()) => applyLedger(db(), { playerId, currency: 'eclipse_token', delta: pulls * P, reason: 'test_grant', idempotencyKey: `fund:${key}` });

beforeAll(async () => {
  await seedCanonCatalog();
  await putBanner('hall_of_ancestors', standardCharacterBanner('hall_of_ancestors', POOLS));
  await putBanner('oath_01_aveline', limitedCharacterBanner('oath_01_aveline', 'sister_aveline', POOLS));
  await putBanner('hall_of_armaments', weaponBanner('hall_of_armaments', ['weapon_mahmut_signature', 'weapon_fadyme_signature'], [], { four: ['weapon_arming_sword_4_02'], three: ['weapon_arming_sword_3_01'] }, true));
});

describe('banner disclosure', () => {
  it('is public and lists exact rates, pity and pools of active banners only', async () => {
    await putBanner('old_banner', limitedCharacterBanner('old_banner', 'sister_aveline', POOLS), { status: 'retired' });
    await putBanner('future_banner', limitedCharacterBanner('future_banner', 'sister_aveline', POOLS), { starts: '2999-01-01T00:00:00.000Z' });
    const res = await game('/api/v1/banners');
    expect(res.status).toBe(200);
    const j = (await res.json()) as { banners: { id: string; hardPity: number; analysis: { consolidatedFiveStarRate: number; worstCasePullsForTarget: number | null; fiveStarRateByPull: { pull: number; fiveStar: number }[] } }[] };
    const ids = j.banners.map((b) => b.id);
    expect(ids).toContain('oath_01_aveline');
    expect(ids).not.toContain('old_banner');
    expect(ids).not.toContain('future_banner');
    const ave = j.banners.find((b) => b.id === 'oath_01_aveline')!;
    expect(ave.hardPity).toBe(80);
    expect(ave.analysis.worstCasePullsForTarget).toBe(160);
    expect(ave.analysis.fiveStarRateByPull.find((p) => p.pull === 65)?.fiveStar).toBeCloseTo(0.085, 12);
  });
});

describe('pull', () => {
  it('debits the cost, journals the pulls, grants items and persists the pity counters (single and ten-pull)', async () => {
    const { auth, playerId } = await signIn(`sub-pull-${rid()}`);
    await fund(playerId, 11);
    const one = await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_ancestors', count: 1, requestId: rid() }, auth));
    expect(one.status).toBe(200);
    const o = (await one.json()) as { pulls: { rarity: number; itemId: string }[]; balance: number; pity: { pity5: number }; replayed: boolean };
    expect(o).toMatchObject({ balance: 10 * P, replayed: false });
    expect(o.pulls).toHaveLength(1);
    const ten = await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_ancestors', count: 10, requestId: rid() }, auth));
    const t = (await ten.json()) as { pulls: { rarity: number; seq: number; duplicate: boolean; shards: number }[]; balance: number };
    expect(t.balance).toBe(0);
    expect(((await (await game('/api/v1/gacha/history?limit=1', { headers: auth })).json()) as { pulls: unknown[] }).pulls).toHaveLength(1);
    expect(t.pulls.map((p) => p.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // every ten-pull contains a 4-star or better (10 consecutive 3-stars are impossible with the guarantee)
    expect(t.pulls.some((p) => p.rarity >= 4)).toBe(true);

    const journal = await db().prepare('SELECT COUNT(*) AS n FROM gacha_pulls WHERE player_id = ?1').bind(playerId).first<{ n: number }>();
    expect(journal?.n).toBe(11);
    const ledger = await db().prepare("SELECT SUM(delta) AS s FROM ledger WHERE player_id = ?1 AND currency = 'eclipse_token'").bind(playerId).first<{ s: number }>();
    expect(ledger?.s).toBe(0); // grants and debits reconcile exactly with the wallet
    const state = (await (await game('/api/v1/gacha/state', { headers: auth })).json()) as { pity: { pity_group: string }[] };
    expect(state.pity.map((p) => p.pity_group)).toEqual(['standard_character']);
    const hist = (await (await game('/api/v1/gacha/history?limit=5', { headers: auth })).json()) as { pulls: { id: number }[]; next: number | null };
    expect(hist.pulls).toHaveLength(5);
    expect(hist.pulls[0]!.id).toBeGreaterThan(hist.pulls[4]!.id);
    expect(hist.next).toBe(hist.pulls[4]!.id);
    // the journal is immutable
    await expect(db().prepare('UPDATE gacha_pulls SET rarity = 5 WHERE player_id = ?1').bind(playerId).run()).rejects.toThrow(/append-only/);
    await expect(db().prepare('DELETE FROM gacha_pulls WHERE player_id = ?1').bind(playerId).run()).rejects.toThrow(/append-only/);
  });

  it('refuses to pull without funds and leaves no trace (no pity change, no journal, no items)', async () => {
    const { auth, playerId } = await signIn(`sub-broke-${rid()}`);
    await fund(playerId, 9);
    const res = await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_ancestors', count: 10, requestId: rid() }, auth));
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: string }).error).toBe('insufficient_funds');
    expect((await db().prepare('SELECT COUNT(*) AS n FROM gacha_pulls WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(0);
    expect((await db().prepare('SELECT COUNT(*) AS n FROM pity_state WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(0);
    expect((await db().prepare("SELECT balance FROM wallets WHERE player_id = ?1 AND currency = 'eclipse_token'").bind(playerId).first<{ balance: number }>())?.balance).toBe(9 * P);
  });

  it('a replayed requestId returns the stored pulls and never charges or pulls twice; reuse for another pull is 409', async () => {
    const { auth, playerId } = await signIn(`sub-replay-${rid()}`);
    await fund(playerId, 20);
    const id = rid();
    const a = (await (await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_ancestors', count: 10, requestId: id }, auth))).json()) as { pulls: unknown[]; balance: number };
    const b = (await (await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_ancestors', count: 10, requestId: id }, auth))).json()) as { pulls: unknown[]; balance: number; replayed: boolean };
    expect(b.replayed).toBe(true);
    expect(b.pulls).toEqual(a.pulls);
    expect(b.balance).toBe(10 * P);
    const other = await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_ancestors', count: 1, requestId: id }, auth));
    expect(other.status).toBe(409);
    expect((await db().prepare('SELECT COUNT(*) AS n FROM gacha_pulls WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(10);
  });

  it('the same requestId sent 12 times at once pulls exactly once', async () => {
    const { auth, playerId } = await signIn(`sub-same-${rid()}`);
    await fund(playerId, 30);
    const id = rid();
    const rs = await Promise.all(Array.from({ length: 12 }, () => game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_ancestors', count: 10, requestId: id }, auth))));
    expect(rs.map((r) => r.status).filter((s) => s === 200)).toHaveLength(12);
    const bodies = (await Promise.all(rs.map((r) => r.json()))) as { replayed: boolean; pulls: unknown[] }[];
    expect(bodies.filter((x) => !x.replayed)).toHaveLength(1);
    expect(new Set(bodies.map((x) => JSON.stringify(x.pulls))).size).toBe(1);
    expect((await db().prepare("SELECT balance FROM wallets WHERE player_id = ?1 AND currency = 'eclipse_token'").bind(playerId).first<{ balance: number }>())?.balance).toBe(20 * P);
    expect((await db().prepare('SELECT COUNT(*) AS n FROM gacha_pulls WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(10);
  });

  it('simultaneous different pulls on one account serialise: pity never forks, balance never goes negative', async () => {
    const { auth, playerId } = await signIn(`sub-race-${rid()}`);
    await fund(playerId, 15);
    const rs = await Promise.all(Array.from({ length: 28 }, () => game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_ancestors', count: 1, requestId: rid() }, auth))));
    const codes = rs.map((r) => r.status);
    const ok = codes.filter((c) => c === 200).length;
    const broke = codes.filter((c) => c === 402).length;
    const busy = codes.filter((c) => c === 409).length;
    expect(ok + broke + busy).toBe(28);
    expect(ok).toBeLessThanOrEqual(15);
    const bal = (await db().prepare("SELECT balance FROM wallets WHERE player_id = ?1 AND currency = 'eclipse_token'").bind(playerId).first<{ balance: number }>())!.balance;
    expect(bal).toBe((15 - ok) * P);
    const journal = (await db().prepare('SELECT COUNT(*) AS n FROM gacha_pulls WHERE player_id = ?1').bind(playerId).first<{ n: number }>())!.n;
    expect(journal).toBe(ok);
    // pity counters are consistent with the journal: every pull is journalled with a strictly increasing pull number inside its cycle
    const rows = (await db().prepare('SELECT pull_number, rarity FROM gacha_pulls WHERE player_id = ?1 ORDER BY id').bind(playerId).all<{ pull_number: number; rarity: number }>()).results;
    let expected = 1;
    for (const r of rows) {
      expect(r.pull_number).toBe(expected);
      expected = r.rarity === 5 ? 1 : expected + 1;
    }
    const st = (await db().prepare('SELECT pity5, version FROM pity_state WHERE player_id = ?1').bind(playerId).first<{ pity5: number; version: number }>())!;
    expect(st.pity5).toBe(expected - 1);
    expect(st.version).toBe(ok);
    const leftover = await db().prepare('SELECT COUNT(*) AS n FROM tx_guard').first<{ n: number }>();
    expect(leftover?.n).toBe(0);
  });

  it('hard pity is honoured end to end: a forced roll source reaches pull 80 and the featured guarantee follows a loss', async () => {
    const { playerId } = await signIn(`sub-pity-${rid()}`);
    await fund(playerId, 200);
    // rolls that never produce a five-star by chance (0.999) but a lost 50/50 when the hard pity hits (0.9)
    const roll = () => 0.999;
    let last: Awaited<ReturnType<typeof pullGacha>> | undefined;
    for (let i = 0; i < 8; i++) last = await pullGacha(db(), playerId, { bannerId: 'oath_01_aveline', count: 10, requestId: rid() }, { roll });
    const pulls = last!.pulls;
    expect(last!.pity.pity5).toBe(0); // pull 80 was a five-star and reset the counter
    expect(pulls.at(-1)).toMatchObject({ pullNumber: 80, rarity: 5, outcome: 'off' }); // 0.999 >= 55 % => lost the 50/50
    expect(last!.pity.lost).toBe(1);
    const next = await pullGacha(db(), playerId, { bannerId: 'oath_01_aveline', count: 10, requestId: rid() }, { roll: () => 0.0 });
    expect(next.pulls[0]).toMatchObject({ rarity: 5, itemId: 'sister_aveline', outcome: 'guaranteed' });
    expect(next.pity.lost).toBe(0);
  });

  it('duplicates grant Memory Shards (5★ 10, 4★ 5, 3★ 2) and copies are tracked; new items are not duplicates', async () => {
    const { auth, playerId } = await signIn(`sub-dupe-${rid()}`);
    await fund(playerId, 40);
    const roll = () => 0.999; // always a 3-star (or the upgraded 4-star on every tenth pull)
    const a = await pullGacha(db(), playerId, { bannerId: 'hall_of_ancestors', count: 10, requestId: rid() }, { roll });
    const b = await pullGacha(db(), playerId, { bannerId: 'hall_of_ancestors', count: 10, requestId: rid() }, { roll });
    expect(a.pulls.some((p) => !p.duplicate && p.shards === 0)).toBe(true);
    expect(b.pulls.filter((p) => p.duplicate).every((p) => p.shards === ({ 3: 2, 4: 5, 5: 10 } as Record<number, number>)[p.rarity])).toBe(true);
    const inv = (await (await game('/api/v1/inventory', { headers: auth })).json()) as { items: { item_id: string; copies: number; shards: number }[] };
    const totalCopies = inv.items.filter((i) => ['t1', 't2', 't3', 'f1', 'f2', 'f3'].includes(i.item_id)).reduce((s, i) => s + i.copies, 0);
    expect(totalCopies).toBe(20);
    const totalShards = inv.items.reduce((s, i) => s + i.shards, 0);
    expect(totalShards).toBe([...a.pulls, ...b.pulls].reduce((s, p) => s + p.shards, 0));
  });

  it('validates input, banner availability and the target of selectable banners', async () => {
    const { auth, playerId } = await signIn(`sub-valid-${rid()}`);
    await fund(playerId, 10);
    const bad = [
      { bannerId: 'hall_of_ancestors', count: 3, requestId: rid() },
      { bannerId: 'hall_of_ancestors', count: 1, requestId: 'x' },
      { bannerId: 'Hall-Of', count: 1, requestId: rid() },
      { bannerId: 'hall_of_ancestors', count: 1, requestId: rid(), extra: true }
    ];
    for (const b of bad) expect((await game('/api/v1/gacha/pull', post(b, auth))).status, JSON.stringify(b)).toBe(400);
    expect((await game('/api/v1/gacha/pull', post({ bannerId: 'does_not_exist', count: 1, requestId: rid() }, auth))).status).toBe(404);
    expect((await game('/api/v1/gacha/pull', post({ bannerId: 'future_banner', count: 1, requestId: rid() }, auth))).status).toBe(404);
    expect((await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_armaments', count: 1, requestId: rid() }, auth))).status).toBe(422);
    expect((await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_armaments', count: 1, requestId: rid(), target: 'weapon_zzz' }, auth))).status).toBe(422);
    expect((await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_armaments', count: 1, requestId: rid(), target: 'weapon_mahmut_signature' }, auth))).status).toBe(200);
    // none of the refusals cost anything
    expect((await db().prepare("SELECT balance FROM wallets WHERE player_id = ?1 AND currency = 'eclipse_token'").bind(playerId).first<{ balance: number }>())?.balance).toBe(9 * P);
  });
});

describe('single main currency (D-17)', () => {
  it('prices a pull in Eclipse Tokens from the banner data and discloses it; the old conversion endpoint is gone', async () => {
    const list = (await (await game('/api/v1/banners')).json()) as { banners: { id: string; cost: { currency: string; perPull: number } }[] };
    expect(list.banners.find((b) => b.id === 'hall_of_ancestors')?.cost).toEqual({ currency: 'eclipse_token', perPull: 160 });
    const { auth, playerId } = await signIn(`sub-single-${rid()}`);
    await fund(playerId, 1);
    const r = await game('/api/v1/gacha/pull', post({ bannerId: 'hall_of_ancestors', count: 1, requestId: rid() }, auth));
    expect(((await r.json()) as { cost: { amount: number; currency: string } }).cost).toEqual({ currency: 'eclipse_token', perPull: 160, amount: 160 });
    expect(await (await game('/api/v1/wallet', { headers: auth })).json()).toEqual({ wallets: { eclipse_token: 0 } });
    expect((await game('/api/v1/economy/convert-fates', post({ count: 1, requestId: rid() }, auth))).status).toBe(404);
  });

  it('a banner can price itself differently (data, not code)', async () => {
    const cfg = JSON.parse(((await db().prepare("SELECT config_json FROM banners WHERE id = 'hall_of_ancestors'").first<{ config_json: string }>())!).config_json);
    await putBanner('cheap_banner', { ...cfg, id: 'cheap_banner', costPerPull: 100 });
    const { auth, playerId } = await signIn(`sub-cheap-${rid()}`);
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 1000, reason: 'test_grant', idempotencyKey: `fund:${rid()}` });
    const r = await game('/api/v1/gacha/pull', post({ bannerId: 'cheap_banner', count: 10, requestId: rid() }, auth));
    expect(((await r.json()) as { balance: number }).balance).toBe(0);
  });

  it('migration 0009 folds legacy Fate\'s Thread (x160) and Silver Crowns (/100) into the main currency and keeps the ledger reconciled', async () => {
    const sql = Object.values(import.meta.glob('../migrations/0009_single_currency.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0] as string;
    const fold = sql.split(/;\s*\n/).map((x) => x.replace(/^(--.*\n)+/gm, '').trim()).filter((x) => /^(INSERT|UPDATE wallets)/.test(x));
    const pid = `p_${'a'.repeat(32)}`;
    await db().prepare('INSERT OR IGNORE INTO players (id) VALUES (?1)').bind(pid).run();
    await db().prepare("DELETE FROM wallets WHERE player_id = ?1").bind(pid).run();
    await db().batch([
      db().prepare("INSERT INTO wallets (player_id, currency, balance) VALUES (?1, 'fates_thread', 3), (?1, 'silver_crowns', 12345), (?1, 'eclipse_token', 50)").bind(pid),
      db().prepare("INSERT INTO ledger (player_id, currency, delta, reason, idempotency_key) VALUES (?1, 'fates_thread', 3, 't', 'm9:f'), (?1, 'silver_crowns', 12345, 't', 'm9:s'), (?1, 'eclipse_token', 50, 't', 'm9:e')").bind(pid)
    ]);
    for (const stmt of fold) await db().prepare(stmt).run();
    const w = Object.fromEntries((await db().prepare('SELECT currency, balance FROM wallets WHERE player_id = ?1').bind(pid).all<{ currency: string; balance: number }>()).results.map((r) => [r.currency, r.balance]));
    expect(w).toEqual({ fates_thread: 0, silver_crowns: 0, eclipse_token: 50 + 3 * 160 + 123 });
    const rec = await db().prepare('SELECT currency, SUM(delta) AS s FROM ledger WHERE player_id = ?1 GROUP BY currency').bind(pid).all<{ currency: string; s: number }>();
    for (const r of rec.results) expect(r.s, r.currency).toBe(w[r.currency]);
  });
});
