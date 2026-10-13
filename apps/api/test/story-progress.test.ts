import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { canonicalJson, sha256Hex } from '@uomd/shared';
import { ChapterIndex } from '@uomd/content-schema';
import { admin, baseEnv, entries, game, post, resetContent, signIn, upload } from './helpers';
import { baseFiles, type TestFile } from './fixtures';
import { completeStory } from '../src/progress/story';

let files: TestFile[];
const input = (requestId = crypto.randomUUID().replaceAll('-', ''), nodeId = 'story_start') => ({ releaseId: 'rel_0001', nodeId, requestId });
const complete = (auth: Record<string, string>, body = input()) => game('/api/v1/progress/story', post(body, auth));

beforeAll(async () => {
  files = await baseFiles();
  const original = files.find((file) => file.path === 'chapters/chapter_index.json')!;
  const index = ChapterIndex.parse(JSON.parse(new TextDecoder().decode(original.bytes)));
  index.chapters[0]!.nodes[0]!.requires = 'story_start';
  index.chapters[0]!.nodes.push({ node_id: 'story_start', title_en: 'Story start', kind: 'story', story: 'story/tutorial_t1_before.json' },
    { node_id: 'story_after', title_en: 'After the battle', kind: 'story', story: 'story/tutorial_t1_after.json', requires: 't1' });
  const bytes = new TextEncoder().encode(JSON.stringify(index));
  files = files.map((file) => file === original ? { ...original, bytes, sha256: '' } : file);
  files.find((file) => file.path === original.path)!.sha256 = await sha256Hex(bytes);
});
beforeEach(async () => {
  await resetContent(); await upload(files);
  expect((await admin('/admin/api/releases', post({ id: 'rel_0001', channel: 'dev', files: entries(files) }))).status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', post({}))).status).toBe(200);
});

describe('authoritative reward-free story progress', () => {
  it('records a zero-star story once and unlocks its following battle without spending or granting', async () => {
    const { auth, playerId } = await signIn('story-new-account');
    expect((await game('/api/v1/progress/battle/start', post({ releaseId: 'rel_0001', nodeId: 't1' }, auth))).status).toBe(403);
    const wallet = (await baseEnv.DB.prepare('SELECT * FROM wallets WHERE player_id = ?1').bind(playerId).all()).results;
    const response = await complete(auth);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ nodeId: 'story_start', releaseId: 'rel_0001', completed: true, replayed: false });
    expect(await baseEnv.DB.prepare('SELECT stars, clears FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(playerId, 'story_start').first()).toEqual({ stars: 0, clears: 1 });
    expect((await game('/api/v1/progress/battle/start', post({ releaseId: 'rel_0001', nodeId: 't1' }, auth))).status).toBe(200);
    expect((await baseEnv.DB.prepare('SELECT * FROM wallets WHERE player_id = ?1').bind(playerId).all()).results).toEqual(wallet);
    expect(await baseEnv.DB.prepare('SELECT COUNT(*) AS n FROM player_ration WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
    expect(await baseEnv.DB.prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
  });
  it('rejects locked, battle-kind and unknown nodes without recording progress', async () => {
    const { auth, playerId } = await signIn('story-invalid-account');
    expect((await complete(auth, input(undefined, 'story_after'))).status).toBe(403);
    expect((await complete(auth, input(undefined, 't1'))).status).toBe(404);
    expect((await complete(auth, input(undefined, 'unknown_story'))).status).toBe(404);
    expect(await baseEnv.DB.prepare('SELECT COUNT(*) AS n FROM player_progress WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
  });
  it('concurrent retries keep one original result and replays do not inflate clear counts', async () => {
    const { auth, playerId } = await signIn('story-concurrent-account'); const body = input();
    const responses = await Promise.all([complete(auth, body), complete(auth, body)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect((await complete(auth)).status).toBe(200);
    expect(await baseEnv.DB.prepare('SELECT clears FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(playerId, body.nodeId).first()).toEqual({ clears: 1 });
    expect(await baseEnv.DB.prepare('SELECT COUNT(*) AS n FROM progression_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, body.requestId).first()).toEqual({ n: 1 });
    expect((await complete(auth, { ...body, nodeId: 'story_after' })).status).toBe(409);
  });
  it('recovers the original response through account-scoped status after a channel kill', async () => {
    const a = await signIn('story-recovery-account'); const b = await signIn('story-other-account'); const body = input();
    expect((await complete(a.auth, body)).status).toBe(200);
    expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    expect((await complete(a.auth)).status).toBe(409);
    expect(await (await complete(a.auth, body)).json()).toMatchObject({ requestId: body.requestId, completed: true, replayed: true });
    const path = `/api/v1/operations/${body.requestId}?path=${encodeURIComponent('/api/v1/progress/story')}`;
    expect(await (await game(path, { headers: a.auth })).json()).toMatchObject({ state: 'confirmed', binding: 'exact', inputHash: await sha256Hex(canonicalJson(body)), result: { completed: true, nodeId: body.nodeId } });
    expect(await (await game(path, { headers: b.auth })).json()).toMatchObject({ state: 'unknown', result: null });
  });
  it('rolls progress back when the original-result journal cannot commit', async () => {
    const { auth, playerId } = await signIn('story-fault-account');
    await baseEnv.DB.prepare("CREATE TRIGGER story_journal_fault BEFORE INSERT ON progression_requests WHEN NEW.kind = 'story_complete' BEGIN SELECT RAISE(ABORT, 'fixture journal failure'); END").run();
    try {
      expect((await complete(auth)).status).toBe(500);
      expect(await baseEnv.DB.prepare('SELECT COUNT(*) AS n FROM player_progress WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
    } finally { await baseEnv.DB.prepare('DROP TRIGGER story_journal_fault').run(); }
  });
  it.each(['account deletion', 'release kill', 'prerequisite removal'] as const)('fences %s again inside the completion transaction', async (race) => {
    const { playerId } = await signIn(`story-race-${race}`);
    const body = input(undefined, race === 'prerequisite removal' ? 'story_after' : 'story_start');
    if (race === 'prerequisite removal') await baseEnv.DB.prepare("INSERT INTO player_progress (player_id, node_id, stars) VALUES (?1, 't1', 1)").bind(playerId).run();
    let enter!: () => void; let resume!: () => void;
    const entered = new Promise<void>((resolve) => { enter = resolve; });
    const gate = new Promise<void>((resolve) => { resume = resolve; });
    const database = new Proxy(baseEnv.DB, { get(target, key) {
      if (key === 'batch') return async (statements: D1PreparedStatement[]) => { enter(); await gate; return target.batch(statements); };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    const attempt = completeStory({ ...baseEnv, DB: database }, playerId, body);
    await entered;
    if (race === 'account deletion') await baseEnv.DB.prepare("UPDATE players SET status = 'deleted' WHERE id = ?1").bind(playerId).run();
    if (race === 'release kill') expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    if (race === 'prerequisite removal') await baseEnv.DB.prepare('DELETE FROM player_progress WHERE player_id = ?1').bind(playerId).run();
    resume();
    await expect(attempt).rejects.toMatchObject({ code: 'story_state_changed' });
    expect(await baseEnv.DB.prepare('SELECT COUNT(*) AS n FROM player_progress WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
    expect(await baseEnv.DB.prepare('SELECT COUNT(*) AS n FROM progression_requests WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
  });
});
