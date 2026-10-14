import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { playAuto } from '@uomd/combat';
import { Encounter, UnitPack } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { baseFiles, type TestFile } from './fixtures';
import { applyLedger } from '../src/db/ledger';
import { claimTask } from '../src/tasks/service';
import { admin, entries, game, post, resetContent, seedCanonCatalog, signIn, upload } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let base: TestFile[];
let actions: { skillId: string; targetId?: string }[];
const dec = new TextDecoder();
let n = 0;
const rid = (): string => `t_${++n}_${Math.random().toString(36).slice(2, 10)}`;
const json = { 'Content-Type': 'application/json' };

const CONFIG = {
  windowHours: 12,
  daily: {
    tasks: [
      { id: 'win_two', title_en: 'Win two', objective: { type: 'eligible_wins', count: 2 }, rewards: [{ type: 'currency', currency: 'eclipse_token', amount: 10 }] },
      { id: 'improve', title_en: 'Improve', objective: { type: 'level_ups', count: 1 }, rewards: [{ type: 'item', itemId: 'bound_chronicle', quantity: 1 }] }
    ],
    completion: { requires: ['win_two', 'improve'], rewards: [{ type: 'account_xp', amount: 400 }] }
  },
  weekly: { claimGraceDays: 7, segments: [{ id: 'all_week', title_en: 'All week', startDay: 0, durationDays: 7, objective: { type: 'eligible_wins', count: 3 }, rewards: [{ type: 'currency', currency: 'eclipse_token', amount: 5 }] }] }
};

/** the test must not straddle a 12-hour window boundary */
async function clear(): Promise<void> {
  const left = 12 * 3_600_000 - (Date.now() % (12 * 3_600_000));
  if (left < 30_000) await new Promise((r) => setTimeout(r, left + 500));
}

beforeAll(async () => {
  await seedCanonCatalog();
  const files = await baseFiles();
  const find = (p: string) => files.find((f) => f.path === p) as TestFile;
  actions = playAuto(UnitPack.parse(JSON.parse(dec.decode(find('units/unit_pack.json').bytes))), Encounter.parse(JSON.parse(dec.decode(find('encounters/tutorial_t1.json').bytes)))).actions;
  const index = JSON.parse(dec.decode(find('chapters/chapter_index.json').bytes));
  index.chapters[0].nodes[0].ration_class = 'campaign';
  const bytes = new TextEncoder().encode(JSON.stringify(index));
  base = files.map((f) => (f.path === 'chapters/chapter_index.json' ? { path: f.path, bytes, mediaType: 'application/json', sha256: 'x' } : f));
  base = await Promise.all(base.map(async (f) => ({ ...f, sha256: await sha256Hex(f.bytes) })));
});
beforeEach(async () => {
  await clear();
  await resetContent();
  await db().prepare("UPDATE game_config SET value_json = ?1 WHERE key = 'tasks'").bind(JSON.stringify(CONFIG)).run();
  await upload(base);
  expect((await admin('/admin/api/releases', { method: 'POST', body: JSON.stringify({ id: 'rel_0001', channel: 'dev', notes: 'tasks', files: entries(base) }), headers: json })).status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', { method: 'POST', body: '{}', headers: json })).status).toBe(200);
});

const win = (auth: Record<string, string>) => game('/api/v1/progress/battle', post({ releaseId: 'rel_0001', nodeId: 't1', requestId: rid(), actions }, auth));
type View = { daily: { periodKey: string; tasks: { id: string; progress: number; done: boolean; claimed: boolean }[]; completion: { ready: boolean; claimed: boolean } }; weekly: { id: string; periodKey: string; progress: number; done: boolean; claimed: boolean; running: boolean }[] };
const tasks = async (auth: Record<string, string>) => (await (await game('/api/v1/tasks', { headers: auth })).json()) as View;
const claim = (auth: Record<string, string>, periodKey: string, taskId: string) => game('/api/v1/tasks/claim', post({ periodKey, taskId }, auth));
const wallet = async (auth: Record<string, string>) => ((await (await game('/api/v1/wallet', { headers: auth })).json()) as { wallets: Record<string, number> }).wallets.eclipse_token ?? 0;

describe('task engine', () => {
  it('durable result recovery survives an expired window and changed reward catalog', async () => {
    const { auth, playerId } = await signIn(`sub-task-operation-${rid()}`);
    const periodKey = (await tasks(auth)).daily.periodKey; const requestId = rid();
    await db().prepare("INSERT INTO player_tasks (player_id, period_key, task_id, progress, target) VALUES (?1, ?2, 'win_two', 2, 2)").bind(playerId, periodKey).run();
    const input = { periodKey, taskId: 'win_two', requestId };
    expect(await claimTask(db(), playerId, input)).toMatchObject({ rewards: [{ amount: 10 }] });
    const changed = structuredClone(CONFIG); changed.daily.tasks[0]!.rewards = [{ type: 'currency', currency: 'eclipse_token', amount: 999 }];
    await db().prepare("UPDATE game_config SET value_json = ?1 WHERE key = 'tasks'").bind(JSON.stringify(changed)).run();
    await expect(claimTask(db(), playerId, input, Date.now() + 13 * 3_600_000)).resolves.toMatchObject({ requestId, replayed: true, rewards: [{ amount: 10 }] });
    expect(await wallet(auth)).toBe(10);
  });

  it('a completion claim records one result for simultaneous identical retries', async () => {
    const { auth, playerId } = await signIn(`sub-task-completion-operation-${rid()}`); const periodKey = (await tasks(auth)).daily.periodKey;
    await db().prepare("INSERT INTO player_tasks (player_id, period_key, task_id, progress, target) VALUES (?1, ?2, 'win_two', 2, 2), (?1, ?2, 'improve', 1, 1)").bind(playerId, periodKey).run();
    const input = { periodKey, taskId: '_window_complete', requestId: rid() };
    const replies = await Promise.all(Array.from({ length: 8 }, () => game('/api/v1/tasks/claim', post(input, auth))));
    expect(replies.every((r) => r.status === 200)).toBe(true);
    expect((await db().prepare('SELECT xp FROM player_account WHERE player_id = ?1').bind(playerId).first<{ xp: number }>())?.xp).toBe(400);
    expect(await (await game(`/api/v1/operations/${input.requestId}?path=${encodeURIComponent('/api/v1/tasks/claim')}`, { headers: auth })).json()).toMatchObject({ state: 'confirmed', binding: 'exact', result: { ...input, rewards: [{ amount: 400 }] } });
  });

  it('counts server-verified wins toward the window and weekly tasks; rewards are claimed once', async () => {
    const { auth } = await signIn(`sub-task-${rid()}`);
    expect((await tasks(auth)).daily.tasks.map((t) => t.progress)).toEqual([0, 0]);
    expect((await win(auth)).status).toBe(200);
    let v = await tasks(auth);
    expect(v.daily.tasks[0]).toMatchObject({ progress: 1, done: false });
    expect(v.weekly[0]).toMatchObject({ id: 'all_week', progress: 1, running: true });
    expect((await claim(auth, v.daily.periodKey, 'win_two')).status).toBe(409); // not finished
    expect((await win(auth)).status).toBe(200);
    v = await tasks(auth);
    expect(v.daily.tasks[0]).toMatchObject({ progress: 2, done: true, claimed: false });
    const w0 = await wallet(auth);
    const ok = await claim(auth, v.daily.periodKey, 'win_two');
    expect(ok.status).toBe(200);
    expect(await wallet(auth)).toBe(w0 + 10);
    const twice = await claim(auth, v.daily.periodKey, 'win_two');
    expect(twice.status).toBe(409);
    expect(((await twice.json()) as { error: string }).error).toBe('already_claimed');
    expect(await wallet(auth)).toBe(w0 + 10);
    // progress is capped at the target
    await win(auth);
    expect((await tasks(auth)).daily.tasks[0]?.progress).toBe(2);
    // the weekly segment finished with the 3rd win
    const week = (await tasks(auth)).weekly[0]!;
    expect(week).toMatchObject({ progress: 3, done: true, claimed: false });
    expect((await claim(auth, week.periodKey, 'all_week')).status).toBe(200);
    expect((await tasks(auth)).weekly[0]).toMatchObject({ claimed: true });
  });

  it('a character level-up counts; the window completion bonus needs every required task and is claimable once', async () => {
    const { auth, playerId } = await signIn(`sub-task-${rid()}`);
    await db().prepare('INSERT INTO player_account (player_id, xp) VALUES (?1, 2000)').bind(playerId).run();
    await db().prepare("INSERT INTO player_stacks (player_id, item_id, qty) VALUES (?1, 'torn_chronicle_page', 5)").bind(playerId).run();
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 50, reason: 'test', idempotencyKey: `f:${rid()}` });
    await win(auth);
    await win(auth);
    let v = await tasks(auth);
    expect(v.daily.completion.ready).toBe(false);
    expect((await claim(auth, v.daily.periodKey, '_window_complete')).status).toBe(409);
    const lv = await game('/api/v1/characters/mahmut/level-up', post({ requestId: rid(), items: [{ itemId: 'torn_chronicle_page', quantity: 2 }] }, auth));
    expect(lv.status).toBe(200);
    v = await tasks(auth);
    expect(v.daily.tasks[1]).toMatchObject({ id: 'improve', progress: 1, done: true });
    expect(v.daily.completion.ready).toBe(true);
    const before = (await db().prepare('SELECT xp FROM player_account WHERE player_id = ?1').bind(playerId).first<{ xp: number }>())!.xp;
    expect((await claim(auth, v.daily.periodKey, '_window_complete')).status).toBe(200);
    expect((await db().prepare('SELECT xp FROM player_account WHERE player_id = ?1').bind(playerId).first<{ xp: number }>())!.xp).toBe(before + 400);
    expect((await claim(auth, v.daily.periodKey, '_window_complete')).status).toBe(409);
    expect((await tasks(auth)).daily.completion.claimed).toBe(true);
  });

  it('refuses claims for closed windows and for periods the server never opened; parallel claims pay once', async () => {
    const { auth } = await signIn(`sub-task-${rid()}`);
    expect((await claim(auth, 'd:2020-01-01T00', 'win_two')).status).toBe(409);
    await win(auth);
    await win(auth);
    const v = await tasks(auth);
    const w0 = await wallet(auth);
    const rs = await Promise.all([claim(auth, v.daily.periodKey, 'win_two'), claim(auth, v.daily.periodKey, 'win_two'), claim(auth, v.daily.periodKey, 'win_two')]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(await wallet(auth)).toBe(w0 + 10);
  });

  it('tasks need a signed-in player and the admin config is validated', async () => {
    expect((await game('/api/v1/tasks')).status).toBe(401);
    const cur = (await (await admin('/admin/api/config/tasks')).json()) as { version: number };
    const bad = structuredClone(CONFIG) as typeof CONFIG;
    bad.daily.completion.requires = ['nope'];
    expect((await admin('/admin/api/config/tasks', { method: 'PUT', body: JSON.stringify({ value: bad, expectedVersion: cur.version }), headers: json })).status).toBe(422);
    const badItem = structuredClone(CONFIG) as typeof CONFIG;
    badItem.daily.tasks[1]!.rewards = [{ type: 'item', itemId: 'no_such_item', quantity: 1 }] as never;
    expect((await admin('/admin/api/config/tasks', { method: 'PUT', body: JSON.stringify({ value: badItem, expectedVersion: cur.version }), headers: json })).status).toBe(422);
    expect((await admin('/admin/api/config/tasks', { method: 'PUT', body: JSON.stringify({ value: CONFIG, expectedVersion: cur.version }), headers: json })).status).toBe(200);
  });

  it('grants unconditional UTC daily supplies recovery floor without wins or token balance and exposes chronological economy analysis', async () => {
    const { auth } = await signIn(`sub-task-supplies-${rid()}`);
    expect(await wallet(auth)).toBe(0);
    const v0 = (await (await game('/api/v1/tasks', { headers: auth })).json()) as {
      supplies: { periodKey: string; amount: number; claimed: boolean; endsAtMs: number };
    };
    expect(v0.supplies).toMatchObject({ amount: 80, claimed: false });

    const reqId = rid();
    const res1 = await game('/api/v1/tasks/supplies', post({ requestId: reqId }, auth));
    expect(res1.status).toBe(200);
    expect(await res1.json()).toMatchObject({ taskId: '_daily_supplies', rewards: [{ type: 'currency', currency: 'eclipse_token', amount: 80 }] });
    expect(await wallet(auth)).toBe(80);

    // Idempotent replay with same requestId
    const replay = await game('/api/v1/tasks/supplies', post({ requestId: reqId }, auth));
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ replayed: true });
    expect(await wallet(auth)).toBe(80);

    // Second claim in same UTC day with a new requestId fails with 409 already_claimed
    const dup = await game('/api/v1/tasks/supplies', post({ requestId: rid() }, auth));
    expect(dup.status).toBe(409);
    expect(((await dup.json()) as { error: string }).error).toBe('already_claimed');

    const v1 = (await (await game('/api/v1/tasks', { headers: auth })).json()) as typeof v0;
    expect(v1.supplies).toMatchObject({ amount: 80, claimed: true });

    const simRes = await admin('/admin/api/economy/chronological', { method: 'POST', body: JSON.stringify({ days: 7 }), headers: json });
    expect(simRes.status).toBe(200);
    const simBody = (await simRes.json()) as { singleHeroTotalCost: number; strictFloorHolds: boolean; strictRecoveryDays: number };
    expect(simBody.singleHeroTotalCost).toBe(740);
    expect(simBody.strictFloorHolds).toBe(true);
    expect(simBody.strictRecoveryDays).toBe(1);
  });
});

