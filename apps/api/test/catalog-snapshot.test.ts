import { beforeAll, beforeEach, expect, it } from 'vitest';
import { CATALOG_PATH, EconomyCatalog, MAX_CATALOG_BYTES, validateContentSet } from '@uomd/content-schema';
import { ContentStore } from '../src/content/store';
import type { CatalogSnapshot } from '../src/content/catalog';
import { sha256Hex } from '@uomd/shared';
import { admin, adminEnv, baseEnv, entries, game, resetContent, upload } from './helpers';
import { campaignFiles, type TestFile } from './fixtures';

let files: TestFile[];
let snapshot: CatalogSnapshot;
let catalog: EconomyCatalog;
beforeAll(async () => {
  const sql = import.meta.glob('../seed/*.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
  for (const name of ['characters', 'catalog', 'banners']) {
    const text = sql[`../seed/${name}.sql`]!;
    const statements = text.replace(/^--.*$/gm, '').trim().split(/;\n(?=(?:INSERT|UPDATE) )/).map((s) => s.trim().replace(/;$/, '')).filter(Boolean);
    for (let i = 0; i < statements.length; i += 50) await baseEnv.DB.batch(statements.slice(i, i + 50).map((s) => baseEnv.DB.prepare(s)));
  }
  files = await campaignFiles();
  const response = await admin('/admin/api/catalog/snapshot');
  expect(response.status, await response.clone().text()).toBe(200);
  snapshot = await response.json<CatalogSnapshot>();
  catalog = EconomyCatalog.parse(JSON.parse(snapshot.json));
});
beforeEach(resetContent);
const post = (path: string, body: unknown) => admin(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

it('rejects an unvalidated catalog JSON before draft/file/audit writes', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ schema_version: 1, commands: [{ op: 'run_script', code: 'untrusted' }] }));
  const bad = { path: 'catalog/economy.json', bytes, sha256: await sha256Hex(bytes), mediaType: 'application/json' };
  await upload([...files, bad]);
  const response = await post('/admin/api/releases', { id: 'rel_bad_catalog', channel: 'dev', files: entries([...files, bad]) });
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ error: 'content_invalid' });
  for (const [table, key] of [['content_releases', 'id'], ['release_files', 'release_id'], ['audit_log', 'target']]) expect(await baseEnv.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${key} = 'rel_bad_catalog'`).first()).toEqual({ n: 0 });
});

it('exports a deterministic bounded complete catalog from real canonical D1 rows', async () => {
  const first = await admin('/admin/api/catalog/snapshot'); const second = await admin('/admin/api/catalog/snapshot');
  expect(await first.json()).toEqual(await second.json());
  expect(snapshot.sha256).toBe(await sha256Hex(snapshot.json));
  expect(snapshot.bytes).toBe(new TextEncoder().encode(snapshot.json).byteLength);
  expect(snapshot.bytes).toBeLessThanOrEqual(MAX_CATALOG_BYTES);
  expect(snapshot.counts).toEqual({ characters: 25, skills: 100, items: 18, gear: 263, sets: 7, weapon_types: 20, banners: 12 });
  validateContentSet(new Map([...files.map((f) => [f.path, f.bytes] as const), [CATALOG_PATH, new TextEncoder().encode(snapshot.json)]]));
});

it('exports for a viewer but refuses an unauthenticated request', async () => {
  expect((await admin('/admin/api/catalog/snapshot', { as: null })).status).toBe(401);
  await baseEnv.DB.prepare("INSERT INTO admin_users (email, role, created_by) VALUES ('viewer@example.com', 'viewer', 'test')").run();
  expect((await admin('/admin/api/catalog/snapshot', { as: 'viewer@example.com' })).status).toBe(200);
});

it('keeps a staged catalog immutable and private, then publishes it with a signed capability and compatible binary floor', async () => {
  const bytes = new TextEncoder().encode(snapshot.json);
  const artifact = { path: CATALOG_PATH, bytes, sha256: snapshot.sha256, mediaType: 'application/json' };
  await upload([...files, artifact]);
  expect((await post('/admin/api/releases', { id: 'rel_catalog_legacy', channel: 'dev', files: entries(files) })).status).toBe(201);
  expect((await post('/admin/api/releases/rel_catalog_legacy/publish', {})).status).toBe(200);
  const pointer = await baseEnv.DB.prepare("SELECT * FROM channel_pointers WHERE channel = 'dev'").first();
  const created = await post('/admin/api/releases', { id: 'rel_catalog_stage', channel: 'dev', dependsOn: 'rel_catalog_legacy', files: entries([artifact]) });
  expect(created.status, await created.clone().text()).toBe(201);
  const store = new ContentStore(baseEnv.DB, baseEnv.CONTENT);
  const before = await store.getRelease('rel_catalog_stage');
  expect(JSON.parse(before!.manifest_json).files).toContainEqual(expect.objectContaining({ path: CATALOG_PATH, sha256: snapshot.sha256 }));
  await baseEnv.DB.prepare("UPDATE characters SET name_en = 'Later edit' WHERE id = 'mahmut'").run();
  expect(await store.effectiveBytes('rel_catalog_stage', CATALOG_PATH)).toEqual(bytes);
  expect((await game(`/api/v1/content/objects/${snapshot.sha256}`)).status).toBe(404);
  expect(JSON.parse(before!.manifest_json).compat).toMatchObject({ min_client: '0.1.2', required_capabilities: ['attributes_v1', 'catalog_v1', 'presentation_v1', 'vfx_v1'] });
  const published = await post('/admin/api/releases/rel_catalog_stage/publish', {});
  expect(published.status).toBe(200);
  const after = await store.getRelease('rel_catalog_stage');
  expect(after?.state).toBe('published'); expect(JSON.parse(after!.manifest_json).signature).toBeDefined();
  expect((await game(`/api/v1/content/objects/${snapshot.sha256}`)).status).toBe(200);
  expect(await baseEnv.DB.prepare("SELECT * FROM channel_pointers WHERE channel = 'dev'").first()).not.toEqual(pointer);
  expect(await baseEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE target = 'rel_catalog_stage' AND action = 'release.publish'").first()).toEqual({ n: 1 });
});

it.each(['progression', 'malformed JSON', 'unknown config', 'item metadata'] as const)('fails export closed on %s without repairing live rows', async (kind) => {
  if (kind === 'progression') await baseEnv.DB.prepare("UPDATE game_config SET value_json = '{\"invalid\":true}' WHERE key = 'progression'").run();
  else if (kind === 'malformed JSON') await baseEnv.DB.prepare("UPDATE gear_defs SET extra_json = 'broken' WHERE gear_id = 'weapon_mahmut_signature'").run();
  else if (kind === 'item metadata') await baseEnv.DB.prepare("UPDATE item_defs SET data_json = '{\"item_id\":\"forged_item\",\"description_en\":\"\",\"sources\":[]}' WHERE item_id = 'first_oath_invitation'").run();
  else await baseEnv.DB.prepare("INSERT INTO game_config (key, value_json) VALUES ('unsupported', '{}')").run();
  const before = await baseEnv.DB.prepare('SELECT key, value_json, version FROM game_config ORDER BY key').all();
  const response = await admin('/admin/api/catalog/snapshot');
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: 'catalog_invalid' });
  expect((await baseEnv.DB.prepare('SELECT key, value_json, version FROM game_config ORDER BY key').all()).results).toEqual(before.results);
});

const invalidCatalogs: [string, (c: EconomyCatalog) => void][] = [
  ['duplicate character', (c) => { c.characters.push(c.characters[0]!); }],
  ['duplicate skill', (c) => { c.skills.push(c.skills[0]!); }],
  ['duplicate gear', (c) => { c.gear.push(c.gear[0]!); }],
  ['unknown skill owner', (c) => { c.skills[0]!.character_id = 'missing_character'; }],
  ['signature owner', (c) => { c.characters[0]!.signature_weapon_id = 'missing_gear'; }],
  ['weapon family', (c) => { c.characters[0]!.weapon_type = 'missing_family'; }],
  ['dismantle item', (c) => { c.gear[0]!.dismantle.push({ item_id: 'missing_item', quantity: 1 }); }],
  ['banner rarity', (c) => { c.banners[0]!.config.pools.four[0] = c.banners[0]!.config.pools.three[0]!; c.banners[0]!.config.pools.three.shift(); }],
  ['banner identity', (c) => { c.banners[0]!.config.id = 'wrong_id'; }],
  ['banner schedule', (c) => { c.banners[0]!.starts_at = '2026-12-02T00:00:00Z'; c.banners[0]!.ends_at = '2026-12-01T00:00:00Z'; }],
  ['progression material', (c) => { c.config.progression.equipment.xpItemId = 'missing_item'; }],
  ['retired progression material', (c) => { c.items.find((i) => i.item_id === c.config.progression.equipment.xpItemId)!.status = 'retired'; }],
  ['task reward', (c) => { c.config.tasks.daily.tasks[0]!.rewards = [{ type: 'character', itemId: 'missing_character' }]; }],
  ['drop pool', (c) => { c.config.drops.tables.bad_table = { repeat: [{ kind: 'gear_pool', slot: 'weapon', rarities: [1], chance: 1 }], firstClear: [] }; }],
  ['drop item', (c) => { c.config.drops.tables.bad_table = { repeat: [{ kind: 'item', itemId: 'missing_item', min: 1, max: 1, chance: 1 }], firstClear: [] }; }],
  ['reroll item', (c) => { c.config.gear.rerollCost.itemId = 'missing_item'; }],
  // healer_support then matches two role keys with different stats
  ['missing role priority', (c) => { delete c.config.gear.roleStatOrder; (c.config.gear.roleStat as Record<string, string>).support = 'agi_flat'; }],
  ['duplicate role priority', (c) => { c.config.gear.roleStatOrder!.push(c.config.gear.roleStatOrder![0]!); }],
  ['unknown role priority', (c) => { c.config.gear.roleStatOrder!.push('unknown_role'); }],
  ['omitted role priority', (c) => { c.config.gear.roleStatOrder!.pop(); }],
  ['default role priority', (c) => { c.config.gear.roleStatOrder!.push('default'); }],
  ['role stat', (c) => { (c.config.gear.roleStat as Record<string, string>).default = 'unimplemented_stat'; }],
  ['unknown field', (c) => { Object.assign(c, { run_script: 'untrusted' }); }],
  ['accessory pool', (c) => { const g = c.gear.find((g) => g.slot === 'ring')!; if (g.slot === 'ring') g.extra.main[0]!.max_value = -1; }],
  ['reroll capability', (c) => { const g = c.gear.find((g) => g.slot === 'ring')!; if (g.slot === 'ring') g.extra.profile.is_rerollable = !g.extra.profile.is_rerollable; }],
  ['accessory set', (c) => { c.gear.find((g) => g.slot === 'ring')!.set_id = 'missing_set'; }]
];
it.each(invalidCatalogs)('rejects catalog %s', (_name, mutate) => {
  const candidate = structuredClone(catalog); mutate(candidate);
  expect(EconomyCatalog.safeParse(candidate).success).toBe(false);
});

it.each(['reward', 'drop', 'prototype drop', 'boss set', 'gate', 'stats', 'skill', 'selector', 'loan'] as const)('rejects a dangling %s against the exact release before draft writes', async (kind) => {
  const set = new Map(files.map((f) => [f.path, f.bytes])); const candidate = structuredClone(catalog);
  if (kind === 'gate') candidate.config.progression.character.ascension[1]!.requiresNode = 'unknown_node';
  else if (kind === 'stats') candidate.characters[0]!.attributes!.base.vit += 1;
  else if (kind === 'skill') candidate.skills[0]!.skill_id += '_changed';
  else if (kind === 'selector') candidate.items.find((i) => i.item_id === 'first_oath_invitation')!.consumable = false;
  else if (kind === 'loan') candidate.gear.find((g) => g.gear_id === 'armor_padded_3_01')!.status = 'retired';
  else {
    const index = JSON.parse(new TextDecoder().decode(set.get('chapters/chapter_index.json')!));
    const node = index.chapters.flatMap((ch: { nodes: { kind: string }[] }) => ch.nodes).find((n: { kind: string }) => n.kind === 'battle');
    if (kind === 'reward') node.rewards = { first_clear: [{ type: 'item', itemId: 'missing_item', quantity: 1 }], three_star: [], repeat: [] };
    else if (kind === 'drop' || kind === 'prototype drop') node.drop = { table: kind === 'drop' ? 'missing_table' : 'constructor' };
    else node.drop = { table: Object.entries(candidate.config.drops.tables).find(([, t]) => [...t.repeat, ...t.firstClear].some((e) => e.kind === 'boss_set'))![0], boss_set_id: 'missing_set' };
    set.set('chapters/chapter_index.json', new TextEncoder().encode(JSON.stringify(index)));
  }
  set.set(CATALOG_PATH, new TextEncoder().encode(JSON.stringify(candidate)));
  const input: TestFile[] = await Promise.all([...set].map(async ([path, bytes]) => ({ path, bytes, sha256: await sha256Hex(bytes), mediaType: files.find((f) => f.path === path)?.mediaType ?? 'application/json' })));
  await upload(input);
  const response = await post('/admin/api/releases', { id: 'rel_bad_catalog_ref', channel: 'dev', files: entries(input) });
  expect(response.status, await response.clone().text()).toBe(422);
  for (const [table, key] of [['content_releases', 'id'], ['release_files', 'release_id'], ['audit_log', 'target']]) expect(await baseEnv.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${key} = 'rel_bad_catalog_ref'`).first()).toEqual({ n: 0 });
});

it.each(['alternate path', 'oversized JSON'] as const)('rejects %s without a draft', async (kind) => {
  const path = kind === 'alternate path' ? 'catalog/other.json' : CATALOG_PATH;
  const bytes = new TextEncoder().encode(kind === 'alternate path' ? snapshot.json : `${snapshot.json}${' '.repeat(MAX_CATALOG_BYTES)}`);
  const artifact = { path, bytes, sha256: await sha256Hex(bytes), mediaType: 'application/json' };
  await upload([...files, artifact]);
  const response = await post('/admin/api/releases', { id: 'rel_catalog_budget', channel: 'dev', files: entries([...files, artifact]) });
  expect(response.status).toBe(kind === 'alternate path' ? 422 : 413);
  expect(await response.text()).toContain(kind === 'alternate path' ? 'unsupported catalog path' : 'resource budget');
  expect(await baseEnv.DB.prepare("SELECT COUNT(*) AS n FROM content_releases WHERE id = 'rel_catalog_budget'").first()).toEqual({ n: 0 });
});

it('republishes a catalog rollback with a higher generation and the required binary capabilities', async () => {
  const artifact = { path: CATALOG_PATH, bytes: new TextEncoder().encode(snapshot.json), sha256: snapshot.sha256, mediaType: 'application/json' };
  await upload([...files, artifact]);
  expect((await post('/admin/api/releases', { id: 'rel_catalog_history', channel: 'dev', files: entries([...files, artifact]) })).status).toBe(201);
  expect((await post('/admin/api/releases/rel_catalog_history/publish', {})).status).toBe(200);
  const response = await post('/admin/api/channels/dev/rollback', { releaseId: 'rel_catalog_history' });
  expect(response.status).toBe(200);
  const served = await game('/api/v1/content/channels/dev/manifest');
  expect(await served.json()).toMatchObject({ compat: { min_client: '0.1.2', required_capabilities: ['attributes_v1', 'catalog_v1', 'presentation_v1', 'vfx_v1'] }, release: { generation: 2 } });
  expect(await baseEnv.DB.prepare('SELECT COUNT(*) AS n FROM content_releases').first()).toEqual({ n: 2 });
});

it('retains retired banner references while rejecting retired characters in active pools', () => {
  const candidate = structuredClone(catalog);
  candidate.banners.forEach((b) => { b.status = 'retired'; });
  candidate.characters.find((c) => c.id === candidate.banners[0]!.config.pools.four[0])!.status = 'retired';
  expect(EconomyCatalog.safeParse(candidate).success).toBe(true);
  candidate.banners[0]!.status = 'active';
  expect(EconomyCatalog.safeParse(candidate).success).toBe(false);
});

it('keeps a catalog draft unsigned when the bound game runtime is old, then publishes after readiness is verified', async () => {
  const artifact = { path: CATALOG_PATH, bytes: new TextEncoder().encode(snapshot.json), sha256: snapshot.sha256, mediaType: 'application/json' }; await upload([...files, artifact]);
  expect((await post('/admin/api/releases', { id: 'rel_runtime_gate', channel: 'dev', files: entries([...files, artifact]) })).status).toBe(201);
  const store = new ContentStore(baseEnv.DB, baseEnv.CONTENT); const before = await store.getRelease('rel_runtime_gate');
  const unavailable = adminEnv({ GAME: { connect: () => { throw new Error('readiness fixture must not open raw sockets'); }, fetch: async () => Response.json({ environment: 'dev', channel: 'dev', d1: { ok: true, migrations_applied: 26 } }) } });
  const response = await admin('/admin/api/releases/rel_runtime_gate/publish', { method: 'POST', body: '{}', env: unavailable }); expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ error: 'game_runtime_unavailable' });
  expect(await store.getRelease('rel_runtime_gate')).toEqual(before); expect(await baseEnv.DB.prepare("SELECT 1 FROM audit_log WHERE target = 'rel_runtime_gate' AND action = 'release.publish'").first()).toBeNull();
  expect((await post('/admin/api/releases/rel_runtime_gate/publish', {})).status).toBe(200);
});
