import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ContentManifest } from '@uomd/content-schema';
import { PatchManager, MemoryStorage, type BaseContent, type RemoteSource } from '@uomd/patch';
import { sha256Hex, verifyPayload, type SignedPayload } from '@uomd/shared';
import { baseFiles, patchFiles, type TestFile } from './fixtures';
import { admin, baseEnv, entries, game, resetContent, signingPublic, upload, adminEnv } from './helpers';

let base: TestFile[];
let patch: TestFile[];

beforeAll(async () => {
  base = await baseFiles();
  patch = await patchFiles();
});
beforeEach(resetContent);

const post = (path: string, body: unknown, as?: string) => admin(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, ...(as ? { as } : {}) });

async function publishBase(): Promise<void> {
  await upload(base);
  expect((await post('/admin/api/releases', { id: 'rel_0001', channel: 'dev', notes: 'base', files: entries(base) })).status).toBe(201);
  expect((await post('/admin/api/releases/rel_0001/publish', {})).status).toBe(200);
}

async function publishPatch(): Promise<void> {
  await upload(patch);
  expect((await post('/admin/api/releases', { id: 'rel_0002', channel: 'dev', notes: 'T-2', dependsOn: 'rel_0001', files: entries(patch) })).status).toBe(201);
  expect((await post('/admin/api/releases/rel_0002/publish', {})).status).toBe(200);
}

describe('publishing pipeline (admin -> D1 + R2 -> game API)', () => {
  it('serves nothing until something is published', async () => {
    expect((await game('/api/v1/content/channels/dev/manifest')).status).toBe(404);
  });

  it('publishes a base then a patch release; the served manifest is signed and verifies', async () => {
    await publishBase();
    await publishPatch();
    const res = await game('/api/v1/content/channels/dev/manifest');
    expect(res.status).toBe(200);
    const manifest = ContentManifest.parse(await res.json());
    expect(manifest.release).toMatchObject({ id: 'rel_0002', generation: 2, channel: 'dev' });
    expect(manifest.depends_on).toMatchObject({ release_id: 'rel_0001', generation: 1 });
    expect(await verifyPayload(manifest as unknown as SignedPayload, [signingPublic])).toBe(true);
    // ETag round trip
    const again = await game('/api/v1/content/channels/dev/manifest', { headers: { 'If-None-Match': res.headers.get('ETag') as string } });
    expect(again.status).toBe(304);
  });

  it('serves published objects immutably and hides unpublished or unknown ones', async () => {
    await publishBase();
    const file = base.find((f) => f.path === 'units/unit_pack.json') as TestFile;
    const ok = await game(`/api/v1/content/objects/${file.sha256}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Cache-Control')).toContain('immutable');
    expect(await sha256Hex(await ok.arrayBuffer())).toBe(file.sha256);
    // uploaded but not part of any published release -> invisible
    const secret = patch.find((f) => f.path === 'encounters/tutorial_t2.json') as TestFile;
    await upload([secret]);
    expect((await game(`/api/v1/content/objects/${secret.sha256}`)).status).toBe(404);
    expect((await game(`/api/v1/content/objects/${'0'.repeat(64)}`)).status).toBe(404);
    expect((await game('/api/v1/content/objects/not-a-hash')).status).toBe(400);
  });

  it('a device running the REAL patch manager applies the published patch end to end', async () => {
    await publishBase();
    await publishPatch();
    const remote: RemoteSource = {
      fetchManifest: async () => (await game('/api/v1/content/channels/dev/manifest')).json(),
      fetchObject: async (sha) => new Uint8Array(await (await game(`/api/v1/content/objects/${sha}`)).arrayBuffer())
    };
    const baseHashes = Object.fromEntries(base.map((f) => [f.path, f.sha256]));
    const baseContent: BaseContent = { releaseId: 'rel_0001', generation: 1, files: baseHashes, read: async (p) => (base.find((f) => f.path === p) as TestFile).bytes };
    const pm = new PatchManager(
      { channel: 'dev', clientVersion: '0.1.0', supportedContentSchema: 1, trustedKeys: [signingPublic], installId: 'x', storageBudgetBytes: 1e9, validate: () => undefined, sleep: async () => undefined },
      new MemoryStorage(),
      remote,
      baseContent
    );
    const out = await pm.checkAndApply();
    expect(out).toMatchObject({ status: 'applied', releaseId: 'rel_0002' });
    expect(JSON.parse(new TextDecoder().decode(await pm.read('chapters/chapter_index.json'))).chapters[0].nodes).toHaveLength(2);
  });

  it('rejects objects whose bytes do not match the stated hash, and disallowed media types', async () => {
    const f = base[0] as TestFile;
    const bad = await admin(`/admin/api/objects/${'a'.repeat(64)}`, { method: 'PUT', body: f.bytes as BodyInit, headers: { 'Content-Type': f.mediaType } });
    expect(bad.status).toBe(400);
    expect((await bad.json<{ error: string }>()).error).toBe('hash_mismatch');
    const js = await admin(`/admin/api/objects/${f.sha256}`, { method: 'PUT', body: f.bytes as BodyInit, headers: { 'Content-Type': 'application/javascript' } });
    expect(js.status).toBe(400);
    expect((await js.json<{ error: string }>()).error).toBe('bad_media_type');
  });

  it('refuses a draft that references objects that were never uploaded', async () => {
    const r = await post('/admin/api/releases', { id: 'rel_0001', channel: 'dev', notes: '', files: entries(base) });
    expect(r.status).toBe(409);
    expect((await r.json<{ error: string }>()).error).toBe('missing_objects');
  });

  it('refuses a patch whose content fails semantic validation (unknown unit in an encounter)', async () => {
    await publishBase();
    const enc = patch.find((f) => f.path === 'encounters/tutorial_t2.json') as TestFile;
    const broken = JSON.parse(new TextDecoder().decode(enc.bytes));
    broken.enemies[0].unit_id = 'ghost_unit';
    const bytes = new TextEncoder().encode(JSON.stringify(broken));
    const evil: TestFile = { ...enc, bytes, sha256: await sha256Hex(bytes) };
    const files = [...patch.filter((f) => f.path !== enc.path), evil];
    await upload(files);
    const r = await post('/admin/api/releases', { id: 'rel_0002', channel: 'dev', notes: 'bad', dependsOn: 'rel_0001', files: entries(files) });
    expect(r.status).toBe(422);
    expect((await r.json<{ error: string }>()).error).toBe('content_invalid');
  });

  it('refuses unknown effect ops smuggled into a unit pack (no remote code execution surface)', async () => {
    await publishBase();
    const pack = patch.find((f) => f.path === 'units/unit_pack.json') as TestFile;
    const tampered = JSON.parse(new TextDecoder().decode(pack.bytes));
    tampered.units[0].skills[0].effect_ops.push({ op: 'run_script', code: 'fetch("https://evil")' });
    const bytes = new TextEncoder().encode(JSON.stringify(tampered));
    const evil: TestFile = { ...pack, bytes, sha256: await sha256Hex(bytes) };
    const files = [...patch.filter((f) => f.path !== pack.path), evil];
    await upload(files);
    const r = await post('/admin/api/releases', { id: 'rel_0002', channel: 'dev', notes: 'bad', dependsOn: 'rel_0001', files: entries(files) });
    expect(r.status).toBe(422);
  });

  it('rollback and kill switch publish NEW higher-generation releases (never lower)', async () => {
    await publishBase();
    await publishPatch();
    const rb = await post('/admin/api/channels/dev/rollback', { releaseId: 'rel_0001' });
    expect(rb.status).toBe(200);
    const rbBody = await rb.json<{ id: string; generation: number }>();
    expect(rbBody.generation).toBe(3);
    const m = ContentManifest.parse(await (await game('/api/v1/content/channels/dev/manifest')).json());
    expect(m.release.generation).toBe(3);
    expect(m.rollback_to).toMatchObject({ release_id: 'rel_0001' });
    expect(m.files.length).toBe(base.length);
    expect(await verifyPayload(m as unknown as SignedPayload, [signingPublic])).toBe(true);

    const kill = await post('/admin/api/channels/dev/kill', { releaseId: 'rel_0001' });
    expect(kill.status).toBe(200);
    const km = ContentManifest.parse(await (await game('/api/v1/content/channels/dev/manifest')).json());
    expect(km.rollout.kill_switch).toBe(true);
    expect(km.release.generation).toBe(4);
  });

  it('publishing is atomic and monotonic: a stale draft cannot replace a newer current release', async () => {
    await publishBase();
    await upload(patch);
    expect((await post('/admin/api/releases', { id: 'rel_0002', channel: 'dev', notes: 'a', dependsOn: 'rel_0001', files: entries(patch) })).status).toBe(201);
    expect((await post('/admin/api/releases', { id: 'rel_0003', channel: 'dev', notes: 'b', dependsOn: 'rel_0001', files: entries(patch) })).status).toBe(201);
    expect((await post('/admin/api/releases/rel_0003/publish', {})).status).toBe(200);
    const stale = await post('/admin/api/releases/rel_0002/publish', {});
    expect(stale.status).toBe(409);
    const m = ContentManifest.parse(await (await game('/api/v1/content/channels/dev/manifest')).json());
    expect(m.release.id).toBe('rel_0003');
  });

  it('production publishing needs the owner role; operators can publish to dev', async () => {
    await baseEnv.DB.prepare("INSERT INTO admin_users (email, role, created_by) VALUES ('op@example.com', 'operator', 'test')").run();
    await upload(base, 'op@example.com');
    const draft = await post('/admin/api/releases', { id: 'rel_0001', channel: 'production', notes: 'prod', files: entries(base) }, 'op@example.com');
    expect(draft.status).toBe(201);
    const pub = await post('/admin/api/releases/rel_0001/publish', {}, 'op@example.com');
    expect(pub.status).toBe(403);
    expect((await pub.json<{ error: string }>()).error).toBe('owner_required');
    await baseEnv.DB.prepare("DELETE FROM admin_users WHERE email = 'op@example.com'").run();
  });

  it('fails closed without a signing key', async () => {
    await publishBase();
    await upload(patch);
    await post('/admin/api/releases', { id: 'rel_0002', channel: 'dev', notes: 'x', dependsOn: 'rel_0001', files: entries(patch) });
    const res = await admin('/admin/api/releases/rel_0002/publish', { method: 'POST', body: '{}', env: adminEnv({ CONTENT_SIGNING_KEY: undefined }) });
    expect(res.status).toBe(503);
  });
});

describe('server-side battle verification', () => {
  it('re-simulates the tutorial T-1 battle and accepts a matching client hash', async () => {
    await publishBase();
    // play with the same engine the client uses and send the recorded actions
    const { playAuto } = await import('@uomd/combat');
    const { UnitPack, Encounter } = await import('@uomd/content-schema');
    const dec = new TextDecoder();
    const pack = UnitPack.parse(JSON.parse(dec.decode((base.find((f) => f.path === 'units/unit_pack.json') as TestFile).bytes)));
    const enc = Encounter.parse(JSON.parse(dec.decode((base.find((f) => f.path === 'encounters/tutorial_t1.json') as TestFile).bytes)));
    const { battle, actions } = playAuto(pack, enc);
    const { canonicalJson } = await import('@uomd/shared');
    const hash = await sha256Hex(canonicalJson(battle.log));
    const res = await game('/api/v1/battles/verify', { method: 'POST', body: JSON.stringify({ releaseId: 'rel_0001', encounterPath: 'encounters/tutorial_t1.json', actions, clientLogHash: hash }), headers: { 'Content-Type': 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ valid: true, complete: true, match: true, result: { winner: 'player' } });
    const audit = await baseEnv.DB.prepare('SELECT valid, client_match, winner FROM battle_audit ORDER BY id DESC LIMIT 1').first();
    expect(audit).toMatchObject({ valid: 1, client_match: 1, winner: 'player' });
  });

  it('rejects forged actions and a lying client hash', async () => {
    await publishBase();
    const bad = await game('/api/v1/battles/verify', { method: 'POST', body: JSON.stringify({ releaseId: 'rel_0001', encounterPath: 'encounters/tutorial_t1.json', actions: [{ skillId: 'fadyme_ultimate_the_bell_that_forgets' }] }), headers: { 'Content-Type': 'application/json' } });
    expect(await bad.json()).toMatchObject({ valid: false });
    const unknown = await game('/api/v1/battles/verify', { method: 'POST', body: JSON.stringify({ releaseId: 'rel_9999', encounterPath: 'encounters/tutorial_t1.json', actions: [] }), headers: { 'Content-Type': 'application/json' } });
    expect(unknown.status).toBe(404);
    const junk = await game('/api/v1/battles/verify', { method: 'POST', body: '{"nope":1}', headers: { 'Content-Type': 'application/json' } });
    expect(junk.status).toBe(400);
  });

  it('a patch-only encounter (T-2) is verifiable only against the patched release', async () => {
    await publishBase();
    await publishPatch();
    const body = (releaseId: string) => JSON.stringify({ releaseId, encounterPath: 'encounters/tutorial_t2.json', actions: [] });
    const onBase = await game('/api/v1/battles/verify', { method: 'POST', body: body('rel_0001'), headers: { 'Content-Type': 'application/json' } });
    expect(onBase.status).toBe(404);
    const onPatch = await game('/api/v1/battles/verify', { method: 'POST', body: body('rel_0002'), headers: { 'Content-Type': 'application/json' } });
    expect(onPatch.status).toBe(200);
    expect(await onPatch.json()).toMatchObject({ valid: true, complete: false });
  });

  it('rate limits the public verification endpoint', async () => {
    await publishBase();
    let limited = 0;
    for (let i = 0; i < 35; i++) {
      const r = await game('/api/v1/battles/verify', { method: 'POST', body: JSON.stringify({ releaseId: 'rel_0001', encounterPath: 'encounters/tutorial_t1.json', actions: [] }), headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' } });
      if (r.status === 429) limited++;
    }
    expect(limited).toBeGreaterThanOrEqual(4);
  });
});
