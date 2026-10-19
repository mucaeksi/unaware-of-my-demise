import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { playAuto } from '@uomd/combat';
import { Encounter, UnitPack } from '@uomd/content-schema';
import { baseFiles, type TestFile } from './fixtures';
import { admin, baseEnv, entries, game, post, resetContent, signIn, upload } from './helpers';
import { startBattle, submitBattle, writeSave } from '../src/progress/service';
import { deleteAccount } from '../src/account/service';

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
  await db().prepare("INSERT OR IGNORE INTO characters (id, name_en, rarity, element, role, age, acquisition, base_vit, base_str, base_int, base_agi) VALUES ('prog_hero','Prog Hero',4,'Stone','tank',20,'gacha',10,2,2,4)").run();
  await upload(base);
  const r = await admin('/admin/api/releases', { method: 'POST', body: JSON.stringify({ id: 'rel_0001', channel: 'dev', notes: 'progress fixture', files: entries(base) }), headers: { 'Content-Type': 'application/json' } });
  expect(r.status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })).status).toBe(200);
});

const submit = (auth: Record<string, string>, over: Record<string, unknown> = {}) => game('/api/v1/progress/battle', post({ releaseId: 'rel_0001', nodeId: 't1', requestId: rid(), actions, ...over }, auth));

async function publishReplacement(rolloutPercent = 100): Promise<void> {
  expect((await admin('/admin/api/releases', post({ id: 'rel_0002', channel: 'dev', files: entries(base), rolloutPercent }))).status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0002/publish', post({}))).status).toBe(200);
}

const policyPath = '/admin/api/releases/rel_0001/economic-policy';
const input = (over: Record<string, unknown> = {}) => ({ releaseId: 'rel_0001', nodeId: 't1', requestId: rid(), actions, ...over });
function delayedDatabase() {
  let enter!: () => void; let resume!: () => void;
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const gate = new Promise<void>((resolve) => { resume = resolve; });
  let paused = false;
  const database = new Proxy(db(), { get(target, key) {
    if (key === 'batch') return async (statements: D1PreparedStatement[]) => { if (!paused) { paused = true; enter(); await gate; } return target.batch(statements); };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
  return { database, entered, resume };
}

describe('server-verified battle progress', () => {
  it('a recorded battle identity cannot be reused with different actions or a different session', async () => {
    const { auth } = await signIn(`sub-battle-intent-${rid()}`); const requestId = rid();
    expect((await submit(auth, { requestId })).status).toBe(200);
    expect((await submit(auth, { requestId, actions: [{ skillId: 'different_action' }] })).status).toBe(409);
    expect((await submit(auth, { requestId, sessionId: 'a'.repeat(32) })).status).toBe(409);
  });

  it('refuses new reward claims against an older published release after cutover', async () => {
    const { auth, playerId } = await signIn(`sub-prog-old-${rid()}`);
    await publishReplacement();
    expect((await submit(auth)).status).toBe(409);
    expect(await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first()).toMatchObject({ n: 0 });
  });

  it('a channel kill blocks old financial claims even when the client still has the content', async () => {
    const { auth, playerId } = await signIn(`sub-prog-kill-${rid()}`);
    expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    expect((await submit(auth)).status).toBe(409);
    expect(await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first()).toMatchObject({ n: 0 });
  });

  it('returns a recorded result idempotently after a channel kill without paying again', async () => {
    const { auth, playerId } = await signIn(`sub-prog-retry-kill-${rid()}`);
    const requestId = rid(); expect((await submit(auth, { requestId })).status).toBe(200);
    const before = await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first();
    expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    expect(await (await submit(auth, { requestId })).json()).toMatchObject({ replayed: true });
    const recovered = await game(`/api/v1/operations/${requestId}?path=${encodeURIComponent('/api/v1/progress/battle')}`, { headers: auth });
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({ state: 'confirmed', binding: 'exact', result: { requestId, nodeId: 't1', replayed: true } });
    expect(await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first()).toEqual(before);
  });

  it('refuses starting a new battle on an old release after cutover', async () => {
    const { auth } = await signIn(`sub-prog-start-old-${rid()}`); await publishReplacement();
    expect((await game('/api/v1/progress/battle/start', post({ releaseId: 'rel_0001', nodeId: 't1' }, auth))).status).toBe(409);
  });

  it('completes a fixed battle started before cutover once during its bounded grace', async () => {
    const { auth, playerId } = await signIn(`sub-prog-grace-${rid()}`);
    const started = await startBattle(baseEnv, playerId, { releaseId: 'rel_0001', nodeId: 't1' });
    expect(started.party).toBeNull(); expect(started.sessionId).toBeTruthy();
    await publishReplacement();
    const requestId = rid();
    expect((await submit(auth, { sessionId: started.sessionId, requestId })).status).toBe(200);
    expect(await (await submit(auth, { sessionId: started.sessionId, requestId })).json()).toMatchObject({ replayed: true });
    expect((await submit(auth, { sessionId: started.sessionId })).status).toBe(409);
  });

  it('denies expired grace and a foreign frozen session without grants', async () => {
    const a = await signIn(`sub-prog-expiry-${rid()}`); const b = await signIn(`sub-prog-foreign-${rid()}`);
    const started = await startBattle(baseEnv, a.playerId, { releaseId: 'rel_0001', nodeId: 't1' });
    await publishReplacement();
    expect((await submit(b.auth, { sessionId: started.sessionId })).status).toBe(409);
    await expect(submitBattle(baseEnv, a.playerId, input({ sessionId: started.sessionId }), new Date(Date.now() + 2 * 3_600_000 + 1000))).rejects.toMatchObject({ code: 'release_not_economic' });
    expect(await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id IN (?1, ?2)').bind(a.playerId, b.playerId).first()).toMatchObject({ n: 0 });
  });

  it('a kill revokes existing grace and its floor survives a newer authorized rollback', async () => {
    const { auth, playerId } = await signIn(`sub-prog-floor-${rid()}`);
    const started = await startBattle(baseEnv, playerId, { releaseId: 'rel_0001', nodeId: 't1' });
    expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    expect((await submit(auth, { sessionId: started.sessionId })).status).toBe(409);
    const restored = await admin('/admin/api/channels/dev/rollback', post({ releaseId: 'rel_0001' }));
    expect(restored.status).toBe(200);
    const { id } = await restored.json<{ id: string }>();
    expect((await submit(auth, { releaseId: id })).status).toBe(200);
    expect((await submit(auth, { sessionId: started.sessionId })).status).toBe(409);
    expect((await admin(policyPath, post({ mode: 'allowlisted', expectedVersion: 1, validUntil: new Date(Date.now() + 60_000).toISOString(), reason: 'cannot waive incident floor' }))).status).toBe(409);
    expect(await db().prepare("SELECT economic_floor FROM channel_pointers WHERE channel = 'dev'").first()).toMatchObject({ economic_floor: 2 });
  });

  it('supports audited bounded allowlists with CAS and blocks expiration or incident revocation', async () => {
    const { auth, playerId } = await signIn(`sub-prog-policy-${rid()}`); await publishReplacement();
    const deadline = new Date(Date.now() + 3_600_000).toISOString();
    const allow = { mode: 'allowlisted', expectedVersion: 1, validUntil: deadline, reason: 'approved compatibility window' };
    expect((await admin(policyPath, post(allow))).status).toBe(200);
    expect((await admin(policyPath, post(allow))).status).toBe(409);
    expect((await submit(auth)).status).toBe(200);
    const requestId = rid(); expect((await submit(auth, { requestId })).status).toBe(200);
    const before = await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first();
    await expect(submitBattle(baseEnv, playerId, input(), new Date(deadline))).rejects.toMatchObject({ code: 'release_not_economic' });
    expect((await admin(policyPath, post({ mode: 'revoked', expectedVersion: 2, reason: 'forced incident revocation' }))).status).toBe(200);
    expect((await submit(auth)).status).toBe(409);
    expect(await (await submit(auth, { requestId })).json()).toMatchObject({ replayed: true });
    expect(await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first()).toEqual(before);
  });

  it('validates exception deadlines and forbids viewer mutations or extending the original grace', async () => {
    await publishReplacement();
    expect((await admin(policyPath, post({ mode: 'allowlisted', expectedVersion: 1, reason: 'missing bounded deadline' }))).status).toBe(400);
    expect((await admin(policyPath, post({ mode: 'allowlisted', expectedVersion: 1, validUntil: new Date(Date.now() + 25 * 3_600_000).toISOString(), reason: 'overlong exception deadline' }))).status).toBe(400);
    expect((await admin(policyPath, post({ mode: 'grace', expectedVersion: 1, validUntil: new Date(Date.now() + 2 * 3_600_000).toISOString(), reason: 'cannot extend original grace' }))).status).toBe(400);
    await db().prepare("INSERT OR REPLACE INTO admin_users (email, role, created_by) VALUES ('authority-viewer@example.com', 'viewer', 'test')").run();
    try {
      expect((await admin(policyPath, { as: 'authority-viewer@example.com' })).status).toBe(200);
      expect((await admin(policyPath, { ...post({ mode: 'revoked', expectedVersion: 1, reason: 'unauthorized mutation' }), as: 'authority-viewer@example.com' })).status).toBe(403);
    } finally { await db().prepare("DELETE FROM admin_users WHERE email = 'authority-viewer@example.com'").run(); }
  });

  it('can revoke the current release immediately and resume only through a newer publication', async () => {
    const { auth, playerId } = await signIn(`sub-prog-current-revoke-${rid()}`);
    expect((await admin(policyPath, post({ mode: 'revoked', expectedVersion: 0, reason: 'current release incident' }))).status).toBe(200);
    expect((await submit(auth)).status).toBe(409);
    await expect(startBattle(baseEnv, playerId, { releaseId: 'rel_0001', nodeId: 't1' })).rejects.toMatchObject({ code: 'release_not_economic' });
    await publishReplacement();
    expect((await submit(auth, { releaseId: 'rel_0002' })).status).toBe(200);
    expect((await submit(auth)).status).toBe(409);
  });

  it('keeps the previous canary cohort economically eligible for a bounded window', async () => {
    const { auth, playerId } = await signIn(`sub-prog-canary-${rid()}`);
    await publishReplacement(50);
    expect((await submit(auth)).status).toBe(200);
    const policy = await db().prepare("SELECT mode, valid_until FROM release_economic_policy WHERE release_id = 'rel_0001'").first<{ mode: string; valid_until: string }>();
    expect(policy!.mode).toBe('allowlisted');
    await expect(submitBattle(baseEnv, playerId, input(), new Date(policy!.valid_until))).rejects.toMatchObject({ code: 'release_not_economic' });
    expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    expect((await submit(auth)).status).toBe(409);
  });

  it('rolls an economic exception back when its audit fails', async () => {
    await publishReplacement();
    const before = await db().prepare("SELECT * FROM release_economic_policy WHERE release_id = 'rel_0001'").first();
    await db().exec("CREATE TRIGGER test_reject_economic_audit BEFORE INSERT ON audit_log WHEN NEW.action = 'release.economic_policy' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
    try {
      expect((await admin(policyPath, post({ mode: 'allowlisted', expectedVersion: 1, validUntil: new Date(Date.now() + 60_000).toISOString(), reason: 'test audited exception failure' }))).status).toBe(500);
      expect(await db().prepare("SELECT * FROM release_economic_policy WHERE release_id = 'rel_0001'").first()).toEqual(before);
    } finally { await db().exec('DROP TRIGGER test_reject_economic_audit'); }
  });

  it('fences reward writes against a kill arriving after admission and before the grant batch', async () => {
    const { playerId } = await signIn(`sub-prog-write-race-${rid()}`);
    const delayed = delayedDatabase();
    const applying = submitBattle({ ...baseEnv, DB: delayed.database }, playerId, input());
    const rejected = expect(applying).rejects.toMatchObject({ code: 'release_not_economic' });
    try {
      await delayed.entered;
      expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    } finally { delayed.resume(); }
    await rejected;
    for (const table of ['ledger', 'player_progress', 'battle_claims', 'player_ration']) expect(await db().prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE player_id = ?1`).bind(playerId).first()).toMatchObject({ n: 0 });
  });

  it('fences a delayed battle start against publication before its session insert', async () => {
    const { playerId } = await signIn(`sub-prog-start-race-${rid()}`);
    const delayed = delayedDatabase();
    const starting = startBattle({ ...baseEnv, DB: delayed.database }, playerId, { releaseId: 'rel_0001', nodeId: 't1' });
    const rejected = expect(starting).rejects.toMatchObject({ code: 'release_not_economic' });
    try { await delayed.entered; await publishReplacement(); } finally { delayed.resume(); }
    await rejected;
    expect(await db().prepare('SELECT COUNT(*) AS n FROM battle_sessions WHERE player_id = ?1').bind(playerId).first()).toMatchObject({ n: 0 });
  });

  it('cannot recreate financial/progress state after deletion races an already admitted grant', async () => {
    const { playerId } = await signIn(`sub-prog-delete-race-${rid()}`);
    const started = await startBattle(baseEnv, playerId, { releaseId: 'rel_0001', nodeId: 't1' });
    const delayed = delayedDatabase();
    const applying = submitBattle({ ...baseEnv, DB: delayed.database }, playerId, input({ sessionId: started.sessionId }));
    const rejected = expect(applying).rejects.toMatchObject({ code: 'release_not_economic' });
    try { await delayed.entered; await deleteAccount(db(), playerId, 'DELETE'); } finally { delayed.resume(); }
    await rejected;
    for (const table of ['ledger', 'player_progress', 'battle_claims', 'player_ration', 'battle_sessions']) expect(await db().prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE player_id = ?1`).bind(playerId).first()).toMatchObject({ n: 0 });
  });

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

  it('keeps configured one-time free-stage milestones but suppresses their fixed repeat rewards and replays truthfully', async () => {
    const indexFile = base.find((f) => f.path === 'chapters/chapter_index.json')!;
    const index = JSON.parse(dec.decode(indexFile.bytes)); index.chapters[0].nodes[0].ration_class = 'tutorial';
    const bytes = new TextEncoder().encode(JSON.stringify(index));
    const { sha256Hex } = await import('@uomd/shared');
    const freeFiles = base.map((f) => f === indexFile ? { ...f, bytes, sha256: '' } : f);
    freeFiles.find((f) => f.path === indexFile.path)!.sha256 = await sha256Hex(bytes);
    await upload(freeFiles);
    expect((await admin('/admin/api/releases', post({ id: 'rel_free', channel: 'dev', files: entries(freeFiles) }))).status).toBe(201);
    expect((await admin('/admin/api/releases/rel_free/publish', post({}))).status).toBe(200);
    const { auth } = await signIn(`sub-prog-free-fixed-${rid()}`); const requestId = rid();
    const first = await submit(auth, { releaseId: 'rel_free', requestId }); expect(first.status).toBe(200);
    const body = await first.json<{ repeatRewardsAllowed: boolean; firstClear: boolean; rewards: unknown[]; ration: { spent: number } }>();
    expect(body).toMatchObject({ repeatRewardsAllowed: false, firstClear: true, ration: { spent: 0 } });
    const wallet = await (await game('/api/v1/wallet', { headers: auth })).json();
    expect(wallet).toEqual({ wallets: { eclipse_token: 100 + (three ? 50 : 0) } });
    expect(await (await submit(auth, { releaseId: 'rel_free' })).json()).toMatchObject({ rewards: [], repeatRewardsAllowed: false });
    expect(await (await submit(auth, { releaseId: 'rel_free', requestId })).json()).toMatchObject({ rewards: body.rewards, repeatRewardsAllowed: false, replayed: true });
    expect(await (await game('/api/v1/wallet', { headers: auth })).json()).toEqual(wallet);
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
  it('save journal failure rolls the CAS back and deleted accounts cannot recreate a save', async () => {
    const { auth, playerId } = await signIn(`sub-save-atomic-${rid()}`); const requestId = rid();
    const input = { requestId, expectedVersion: 0, data: { step: 1 } };
    await db().prepare("CREATE TRIGGER reject_save_journal BEFORE INSERT ON progression_requests WHEN NEW.kind = 'cloud_save' BEGIN SELECT RAISE(ABORT, 'isolated save journal failure'); END").run();
    try {
      expect((await game('/api/v1/save', { ...post(input, auth), method: 'PUT' })).status).toBe(500);
      expect(await (await game('/api/v1/save', { headers: auth })).json()).toMatchObject({ version: 0, data: {} });
    } finally { await db().prepare('DROP TRIGGER reject_save_journal').run(); }
    expect(await writeSave(db(), playerId, input)).toMatchObject({ requestId, version: 1 });
    await deleteAccount(db(), playerId, 'DELETE');
    await expect(writeSave(db(), playerId, { requestId: rid(), expectedVersion: 0, data: {} })).rejects.toMatchObject({ status: 401 });
    expect((await db().prepare('SELECT COUNT(*) AS n FROM player_saves WHERE player_id = ?1').bind(playerId).first<{ n: number }>())?.n).toBe(0);
  });

  it('same-ID concurrent save writes once and recovers the original result after another device advances', async () => {
    const { auth } = await signIn(`sub-save-operation-${rid()}`); const requestId = rid();
    const input = { requestId, expectedVersion: 0, data: { progress: { chapter: 1 } } };
    const put = (body: unknown) => game('/api/v1/save', { ...post(body, auth), method: 'PUT' });
    const responses = await Promise.all(Array.from({ length: 8 }, () => put(input)));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(await (await game('/api/v1/save', { headers: auth })).json()).toMatchObject({ version: 1, data: input.data });
    expect((await put({ requestId: rid(), expectedVersion: 1, data: { device: 'newer' } })).status).toBe(200);
    expect(await (await put(input)).json()).toMatchObject({ requestId, version: 1, replayed: true });
    expect(await (await game('/api/v1/save', { headers: auth })).json()).toMatchObject({ version: 2, data: { device: 'newer' } });
    expect((await put({ ...input, data: { changed: true } })).status).toBe(409);
    expect(await (await game(`/api/v1/operations/${requestId}?path=${encodeURIComponent('/api/v1/save')}`, { headers: auth })).json()).toMatchObject({ state: 'confirmed', binding: 'exact', result: { requestId, version: 1 } });
  });

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
