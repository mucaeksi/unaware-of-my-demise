import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NarrativeLibrary } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { completeStory } from '../src/progress/story';
import { grantStatements } from '../src/db/grants';
import { admin, baseEnv, entries, game, post, resetContent, seedCanonCatalog, signIn, upload } from './helpers';
import { campaignFiles, type TestFile } from './fixtures';

const db = baseEnv.DB; const rid = () => crypto.randomUUID().replaceAll('-', '');
const first = 'cs_kera_voss_1'; const second = 'cs_kera_voss_2'; const third = 'cs_kera_voss_3';
let files: TestFile[];
beforeAll(async () => { await seedCanonCatalog(); files = await campaignFiles(); });
beforeEach(async () => {
  await resetContent(); await upload(files);
  expect((await admin('/admin/api/releases', post({ id: 'rel_0001', channel: 'dev', files: entries(files) }))).status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', post({}))).status).toBe(200);
});
const list = (auth: Record<string, string>) => game('/api/v1/library?releaseId=rel_0001', { headers: auth });
const read = (auth: Record<string, string>, id: string) => game(`/api/v1/library/${id}?releaseId=rel_0001`, { headers: auth });
const input = (nodeId: string, requestId = rid()) => ({ releaseId: 'rel_0001', nodeId, requestId });
const complete = (auth: Record<string, string>, nodeId: string, requestId = rid()) => game('/api/v1/progress/story', post(input(nodeId, requestId), auth));
async function clear(playerId: string, nodeId: string, stars = 1) {
  await db.prepare('INSERT INTO player_progress (player_id, node_id, stars, clears) VALUES (?1, ?2, ?3, 1)').bind(playerId, nodeId, stars).run();
}
async function own(playerId: string) { await db.batch(await grantStatements(db, playerId, [{ type: 'character', itemId: 'kera_voss' }], { keyPrefix: rid(), reason: 'fixture:library ownership' })); }
async function ready() {
  const actor = await signIn(`library-${rid()}`); await clear(actor.playerId, 'stage_3_5'); await clear(actor.playerId, 'stage_4_5'); await own(actor.playerId); return actor;
}

describe('account-authoritative narrative library', () => {
  it('returns only premise cards and discloses no future titles, lines or gate metadata', async () => {
    const actor = await signIn(`library-premise-${rid()}`); const response = await list(actor.auth);
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json() as { entries: Record<string, unknown>[] };
    expect(body.entries).toHaveLength(3); expect(body.entries.every((entry) => entry.kind === 'codex' && !('scenes' in entry) && !('gate' in entry))).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/Clockless|cs_kera|event_council|Throne/);
    expect((await read(actor.auth, 'codex_clockless')).status).toBe(403);
    expect((await read(actor.auth, first)).status).toBe(403);
    expect((await read(actor.auth, 'unknown_reading')).status).toBe(404);
  });
  it('requires a starred exact battle and ownership; clears alone and a later stage do not substitute', async () => {
    const actor = await signIn(`library-owner-${rid()}`); await clear(actor.playerId, 'stage_3_5', 0); await clear(actor.playerId, 'stage_7_5');
    expect((await read(actor.auth, first)).status).toBe(403); await own(actor.playerId);
    expect((await read(actor.auth, first)).status).toBe(403);
    await db.prepare("UPDATE player_progress SET stars = 1 WHERE player_id = ?1 AND node_id = 'stage_3_5'").bind(actor.playerId).run();
    expect((await read(actor.auth, first)).status).toBe(200);
    const other = await signIn(`library-owner-other-${rid()}`); await clear(other.playerId, 'stage_3_5');
    expect((await read(other.auth, first)).status).toBe(403); expect((await complete(other.auth, first)).status).toBe(403);
  });
  it('keeps same-stage companion parts in read order and exposes the complete gated event', async () => {
    const actor = await ready();
    expect((await complete(actor.auth, second)).status).toBe(403);
    expect((await complete(actor.auth, first)).status).toBe(200);
    expect((await read(actor.auth, second)).status).toBe(200); expect((await read(actor.auth, third)).status).toBe(403);
    expect((await complete(actor.auth, second)).status).toBe(200); expect((await read(actor.auth, third)).status).toBe(200);
    const event = await read(actor.auth, 'event_harvest_inn_meal'); expect(event.status).toBe(200);
    expect((await event.json() as { entry: { scenes: unknown[] } }).entry.scenes).toHaveLength(3);
  });
  it('records once without rewards and recovers the exact original reading after a kill', async () => {
    const actor = await signIn(`library-result-${rid()}`); const body = input('codex_law_of_hours');
    const before = await db.batch([db.prepare('SELECT * FROM wallets WHERE player_id = ?1').bind(actor.playerId), db.prepare('SELECT * FROM reward_grants WHERE player_id = ?1').bind(actor.playerId)]);
    const responses = await Promise.all([complete(actor.auth, body.nodeId, body.requestId), complete(actor.auth, body.nodeId, body.requestId)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect((await complete(actor.auth, 'codex_names', body.requestId)).status).toBe(409);
    expect(await db.prepare('SELECT stars, clears FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(actor.playerId, body.nodeId).first()).toEqual({ stars: 0, clears: 1 });
    expect((await db.batch([db.prepare('SELECT * FROM wallets WHERE player_id = ?1').bind(actor.playerId), db.prepare('SELECT * FROM reward_grants WHERE player_id = ?1').bind(actor.playerId)])).map((result) => result.results)).toEqual(before.map((result) => result.results));
    expect(await db.prepare('SELECT COUNT(*) AS n FROM player_ration WHERE player_id = ?1').bind(actor.playerId).first()).toEqual({ n: 0 });
    expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    expect(await (await complete(actor.auth, body.nodeId, body.requestId)).json()).toMatchObject({ ...body, completed: true, replayed: true });
    expect((await list(actor.auth)).status).toBe(409);
    const other = await signIn(`library-result-other-${rid()}`);
    expect(await (await game(`/api/v1/operations/${body.requestId}?path=${encodeURIComponent('/api/v1/progress/story')}`, { headers: other.auth })).json()).toMatchObject({ state: 'unknown' });
  });
  it('rolls the completion back if the immutable original-result journal fails', async () => {
    const actor = await ready();
    await db.prepare("CREATE TRIGGER library_journal_fault BEFORE INSERT ON progression_requests WHEN NEW.kind = 'story_complete' BEGIN SELECT RAISE(ABORT, 'library fixture fault'); END").run();
    try { expect((await complete(actor.auth, first)).status).toBe(500); expect(await db.prepare('SELECT 1 FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(actor.playerId, first).first()).toBeNull(); }
    finally { await db.prepare('DROP TRIGGER library_journal_fault').run(); }
  });
  it.each(['account', 'release', 'stage', 'owner', 'previous'] as const)('fences a %s change inside the completion transaction', async (race) => {
    const actor = await ready(); expect((await complete(actor.auth, first)).status).toBe(200);
    let entered!: () => void; let resume!: () => void;
    const entry = new Promise<void>((resolve) => { entered = resolve; }); const gate = new Promise<void>((resolve) => { resume = resolve; });
    // A prepare proxy tags the existing tx_guard write without relying on D1 object internals.
    let write = false;
    const fenced = new Proxy(db, { get(target, key) { if (key === 'prepare') return (sql: string) => { if (sql.startsWith('INSERT INTO tx_guard')) write = true; return db.prepare(sql); };
      if (key === 'batch') return async (statements: D1PreparedStatement[]) => { if (write) { entered(); await gate; } return db.batch(statements); };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
    const attempt = completeStory({ ...baseEnv, DB: fenced }, actor.playerId, input(second)); await entry;
    if (race === 'account') await db.prepare("UPDATE players SET status = 'deleted' WHERE id = ?1").bind(actor.playerId).run();
    if (race === 'release') expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    if (race === 'stage') await db.prepare("DELETE FROM player_progress WHERE player_id = ?1 AND node_id = 'stage_4_5'").bind(actor.playerId).run();
    if (race === 'owner') await db.prepare("DELETE FROM player_items WHERE player_id = ?1 AND item_id = 'kera_voss'").bind(actor.playerId).run();
    if (race === 'previous') await db.prepare('DELETE FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(actor.playerId, first).run();
    resume(); await expect(attempt).rejects.toMatchObject({ code: 'story_state_changed' });
    expect(await db.prepare('SELECT 1 FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(actor.playerId, second).first()).toBeNull();
  });
  it('rejects an invalid stable-ID library gate before any draft/audit write', async () => {
    const changed = structuredClone(files); const file = changed.find((file) => file.path === 'library/library_index.json')!;
    const library = NarrativeLibrary.parse(JSON.parse(new TextDecoder().decode(file.bytes))); library.entries[0]!.gate.after_node = 'unknown_stage';
    file.bytes = new TextEncoder().encode(JSON.stringify(library)); file.sha256 = await sha256Hex(file.bytes); await upload(changed);
    const response = await admin('/admin/api/releases', post({ id: 'rel_bad_library', channel: 'dev', files: entries(changed) }));
    expect(response.status).toBe(422); expect(await response.json()).toMatchObject({ error: 'content_invalid' });
    expect(await db.prepare("SELECT 1 FROM content_releases WHERE id = 'rel_bad_library'").first()).toBeNull();
    expect(await db.prepare("SELECT 1 FROM audit_log WHERE target = 'rel_bad_library'").first()).toBeNull();
  });
});
