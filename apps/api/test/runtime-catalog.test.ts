import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { CATALOG_PATH, EconomyCatalog, Encounter, UnitPack } from '@uomd/content-schema';
import { playAuto } from '@uomd/combat';
import { sha256Hex } from '@uomd/shared';
import { admin, baseEnv, entries, post, resetContent, signIn, upload } from './helpers';
import { campaignFiles, type TestFile } from './fixtures';
import { ContentStore } from '../src/content/store';
import { exportCatalog } from '../src/content/catalog';
import { loadReleaseCatalog } from '../src/content/runtime-catalog';
import { grantStatements } from '../src/db/grants';
import { computeCharacterStats } from '../src/gear/service';
import { loanGear } from '../src/progress/loan-gear';
import { rollNodeDrops } from '../src/progress/drops';
import { startBattle, submitBattle } from '../src/progress/service';

const db = baseEnv.DB;
const releaseId = 'rel_catalog_runtime';
let files: TestFile[];
let catalog: EconomyCatalog;
let pack: UnitPack;
let encounter: Encounter;
let sha256: string;
let material: string;
const restoreRows: { table: string; key: string; columns: string[]; rows: Record<string, string | number | null>[] }[] = [];
const artifact = async (path: string, value: unknown): Promise<TestFile> => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return { path, bytes, sha256: await sha256Hex(bytes), mediaType: 'application/json' };
};
beforeAll(async () => {
  const sql = import.meta.glob('../seed/*.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
  for (const name of ['characters', 'catalog', 'banners']) {
    const statements = sql[`../seed/${name}.sql`]!.replace(/^--.*$/gm, '').trim().split(/;\n(?=(?:INSERT|UPDATE) )/).map((s) => s.trim().replace(/;$/, '')).filter(Boolean);
    for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50).map((s) => db.prepare(s)));
  }
  for (const [table, key, columns] of [
    ['characters', 'id', ['base_vit', 'growth_vit', 'role', 'status']],
    ['gear_defs', 'gear_id', ['base_json', 'growth_json', 'extra_json', 'status']],
    ['accessory_sets', 'set_id', ['bonus_json']], ['game_config', 'key', ['value_json']], ['item_defs', 'item_id', ['stack_cap', 'status']]
  ] as [string, string, string[]][]) restoreRows.push({ table, key, columns, rows: (await db.prepare(`SELECT ${[key, ...columns].join(', ')} FROM ${table}`).all<Record<string, string | number | null>>()).results });
  catalog = EconomyCatalog.parse(JSON.parse((await exportCatalog(db)).json));
  material = catalog.config.progression.equipment.xpItemId;
  // Test-only values distinguish this release from the editable authoring tables.
  catalog.items.find((i) => i.item_id === material)!.stack_cap = 7;
  catalog.config.drops.tables.catalog_probe = { firstClear: [{ kind: 'item', itemId: material, min: 11, max: 11, chance: 1 }], repeat: [] };
  const all = await campaignFiles();
  const decode = (path: string) => JSON.parse(new TextDecoder().decode(all.find((f) => f.path === path)!.bytes));
  pack = UnitPack.parse(decode('units/unit_pack.json'));
  encounter = Encounter.parse({ ...decode('encounters/tutorial_t1.json'), encounter_id: 'catalog_probe', party_mode: 'owned', party: [], guests: ['brin_alder'] });
  const index = decode('chapters/chapter_index.json');
  index.chapters[0].nodes.push({ node_id: 'catalog_probe', title_en: 'Catalog probe', kind: 'battle', encounter: 'encounters/catalog_probe.json', ration_class: 'campaign', drop: { table: 'catalog_probe' }, rewards: { first_clear: [{ type: 'character', itemId: 'iona_mist' }, { type: 'gear', gearId: 'armor_padded_3_01' }], three_star: [], repeat: [] } });
  const snapshot = await artifact(CATALOG_PATH, catalog); sha256 = snapshot.sha256;
  files = [...all.filter((f) => f.path !== 'chapters/chapter_index.json'), await artifact('chapters/chapter_index.json', index), await artifact('encounters/catalog_probe.json', encounter), snapshot];
});
beforeEach(async () => {
  await resetContent(); await upload(files);
  const draft = await admin('/admin/api/releases', post({ id: releaseId, channel: 'dev', files: entries(files) }));
  expect(draft.status, await draft.clone().text()).toBe(201);
});
afterEach(async () => {
  const statements = restoreRows.flatMap(({ table, key, columns, rows }) => rows.map((row) => db.prepare(`UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE ${key} = ?`).bind(...columns.map((c) => row[c]), row[key])));
  for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50));
});
async function admitFixture() {
  // Runtime integration fixture only: production activation MUST remain blocked until the other economic paths migrate.
  await db.batch([
    db.prepare("UPDATE content_releases SET state = 'published', published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1").bind(releaseId),
    db.prepare("INSERT INTO channel_pointers (channel, release_id, version, updated_by) VALUES ('dev', ?1, 1, 'test') ON CONFLICT (channel) DO UPDATE SET release_id = excluded.release_id, version = version + 1").bind(releaseId)
  ]);
}
async function player() { return signIn(`runtime-${crypto.randomUUID()}`); }
const begin = (playerId: string) => startBattle(baseEnv, playerId, { releaseId, nodeId: 'catalog_probe' });

it('does not treat a draft or another channel as runtime authority', async () => {
  await expect(loadReleaseCatalog(baseEnv, releaseId)).rejects.toMatchObject({ code: 'unknown_release' });
  await admitFixture();
  await expect(loadReleaseCatalog({ ...baseEnv, CONTENT_CHANNEL: 'staging' }, releaseId)).rejects.toMatchObject({ code: 'unknown_release' });
  expect(await loadReleaseCatalog(baseEnv, releaseId)).toMatchObject({ releaseId, sha256, data: catalog });
});

it('freezes owned stats, equipped definitions and story loans from the selected catalog despite authoring edits', async () => {
  await admitFixture(); const { playerId } = await player();
  await db.prepare("INSERT INTO player_gear (player_id, gear_id, slot, equipped_by) VALUES (?1, 'armor_padded_3_01', 'armor', 'mahmut')").bind(playerId).run();
  const original = await begin(playerId);
  await db.batch([
    db.prepare("UPDATE characters SET base_vit = 999, growth_vit = 99, role = 'other'"),
    db.prepare("UPDATE gear_defs SET base_json = '{}', growth_json = '{}', extra_json = '{}'"),
    db.prepare("UPDATE accessory_sets SET bonus_json = '{\"stat\":\"atk_pct\",\"pct\":4}'"),
    db.prepare("UPDATE game_config SET value_json = '{}' WHERE key IN ('progression','gear')")
  ]);
  expect((await begin(playerId)).party).toEqual(original.party);
  expect(original).toMatchObject({ catalogSha256: sha256 });
  expect(original.party!.find((m) => m.unit_id === 'brin_alder')).toMatchObject({ loan: true });
});

it('uses snapshot drop rules, item caps, character/gear grants and task events, then recovers the original result without catalog access', async () => {
  await admitFixture(); const { playerId } = await player();
  const started = await begin(playerId);
  await db.batch([
    db.prepare("UPDATE characters SET status = 'retired' WHERE id = 'iona_mist'"),
    db.prepare("UPDATE item_defs SET stack_cap = 1, status = 'retired' WHERE item_id = ?1").bind(material),
    db.prepare("UPDATE gear_defs SET status = 'retired' WHERE gear_id = 'armor_padded_3_01'"),
    db.prepare("UPDATE game_config SET value_json = '{}' WHERE key IN ('drops','tasks')")
  ]);
  const played = playAuto(pack, encounter, started.party!); expect(played.battle.result?.winner).toBe('player');
  const input = { releaseId, nodeId: 'catalog_probe', requestId: 'runtime_claim_001', sessionId: started.sessionId!, actions: played.actions };
  const claimed = await submitBattle(baseEnv, playerId, input);
  expect(claimed).toMatchObject({ replayed: false, catalogSha256: sha256 });
  expect(claimed.rewards).toContainEqual({ type: 'item', itemId: material, quantity: 11 });
  expect(await db.prepare('SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?2').bind(playerId, material).first()).toEqual({ qty: 7 });
  expect(await db.prepare("SELECT copies FROM player_items WHERE player_id = ?1 AND item_id = 'iona_mist'").bind(playerId).first()).toEqual({ copies: 1 });
  expect(await db.prepare("SELECT gear_id FROM player_gear WHERE player_id = ?1").bind(playerId).first()).toEqual({ gear_id: 'armor_padded_3_01' });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM player_tasks WHERE player_id = ?1').bind(playerId).first<number>('n')).toBeGreaterThan(0);
  await baseEnv.CONTENT.delete(ContentStore.objectKey(sha256));
  const replay = await submitBattle(baseEnv, playerId, input);
  expect(replay).toMatchObject({ ...claimed, ration: { ...claimed.ration, nextMs: expect.any(Number) }, replayed: true });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM player_gear WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 1 });
});

it('fails before creating sessions when a declared catalog object is missing or corrupt', async () => {
  await admitFixture(); const { playerId } = await player();
  await baseEnv.CONTENT.delete(ContentStore.objectKey(sha256));
  await expect(begin(playerId)).rejects.toMatchObject({ code: 'release_catalog_invalid' });
  await baseEnv.CONTENT.put(ContentStore.objectKey(sha256), '{}');
  await expect(begin(playerId)).rejects.toMatchObject({ code: 'release_catalog_invalid' });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM battle_sessions WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
});

it('retains explicit catalog-free legacy loading', async () => {
  const legacy = files.filter((f) => f.path !== CATALOG_PATH);
  expect((await admin('/admin/api/releases', post({ id: 'rel_catalog_free', channel: 'dev', files: entries(legacy) }))).status).toBe(201);
  expect((await admin('/admin/api/releases/rel_catalog_free/publish', post({}))).status).toBe(200);
  expect(await loadReleaseCatalog(baseEnv, 'rel_catalog_free')).toBeUndefined();
});

it('does not grant live-only definitions or silently ignore an undeclared drop table', async () => {
  await admitFixture(); const { playerId } = await player(); const runtime = (await loadReleaseCatalog(baseEnv, releaseId))!;
  await db.prepare("INSERT INTO characters (id, name_en, rarity, element, role, age, acquisition, base_vit, base_str, base_int, base_agi) VALUES ('live_only_probe','Probe',4,'Stone','tank',20,'gacha',10,2,2,4)").run();
  try {
    await expect(grantStatements(db, playerId, [{ type: 'character', itemId: 'live_only_probe' }], { keyPrefix: 'probe', reason: 'test', catalog: runtime })).rejects.toMatchObject({ code: 'unknown_item' });
    for (const table of ['undeclared_probe', 'constructor']) await expect(rollNodeDrops(db, { table }, true, true, runtime)).rejects.toMatchObject({ code: 'release_catalog_invalid' });
    expect(await db.prepare("SELECT 1 FROM player_items WHERE player_id = ?1 AND item_id = 'live_only_probe'").bind(playerId).first()).toBeNull();
  } finally { await db.prepare("DELETE FROM characters WHERE id = 'live_only_probe'").run(); }
});

it('loads eligible weapon/accessory/boss pools from the snapshot after live pool retirement', async () => {
  await admitFixture(); const runtime = (await loadReleaseCatalog(baseEnv, releaseId))!;
  const set = catalog.sets[0]!.set_id;
  runtime.data.config.drops.tables.pool_probe = { firstClear: [{ kind: 'boss_set', rarity: 3, chance: 1 }], repeat: [{ kind: 'gear_pool', slot: 'weapon', rarities: [3], chance: 1 }, { kind: 'gear_pool', slot: 'accessory', rarities: [3], chance: 1 }] };
  await db.prepare("UPDATE gear_defs SET status = 'retired'").run();
  const dropped = await rollNodeDrops(db, { table: 'pool_probe', boss_set_id: set }, true, true, runtime);
  expect(dropped.first).toHaveLength(1); expect(dropped.repeat).toHaveLength(2);
  const definition = (reward: { type: string; gearId?: string }) => catalog.gear.find((g) => g.gear_id === reward.gearId)!;
  expect(definition(dropped.first[0]!)).toMatchObject({ set_id: set, rarity: 3 });
  expect(definition(dropped.repeat[0]!)).toMatchObject({ slot: 'weapon', rarity: 3, owner_character_id: null, source_banner_id: null });
  expect(['necklace', 'ring']).toContain(definition(dropped.repeat[1]!).slot);
});

it.each(['start', 'submit'] as const)('rolls back %s if account authority changes after catalog reads', async (kind) => {
  await admitFixture(); const { playerId } = await player();
  const started = kind === 'submit' ? await begin(playerId) : null;
  let enter!: () => void; let resume!: () => void; let paused = false;
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const gate = new Promise<void>((resolve) => { resume = resolve; });
  const database = new Proxy(db, { get(target, key) {
    if (key === 'batch') return async (statements: D1PreparedStatement[]) => { if (!paused) { paused = true; enter(); await gate; } return target.batch(statements); };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
  const applying = kind === 'start' ? startBattle({ ...baseEnv, DB: database }, playerId, { releaseId, nodeId: 'catalog_probe' })
    : submitBattle({ ...baseEnv, DB: database }, playerId, { releaseId, nodeId: 'catalog_probe', requestId: 'runtime_guard_001', sessionId: started!.sessionId!, actions: playAuto(pack, encounter, started!.party!).actions });
  const settled = applying.then((value) => ({ ok: true, value }), (error: unknown) => ({ ok: false, error }));
  try { await entered; await db.prepare("UPDATE players SET status = 'banned' WHERE id = ?1").bind(playerId).run(); }
  finally { resume(); }
  expect(await settled).toMatchObject({ ok: false, error: { code: 'release_not_economic' } });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM battle_claims WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM reward_grants WHERE player_id = ?1 AND reason LIKE ?2').bind(playerId, 'stage:%').first()).toEqual({ n: 0 });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM player_ration WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
  if (kind === 'start') expect(await db.prepare('SELECT COUNT(*) AS n FROM battle_sessions WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
  else expect(await db.prepare('SELECT consumed_at FROM battle_sessions WHERE id = ?1').bind(started!.sessionId).first()).toEqual({ consumed_at: null });
});

it.each(['{}', '{broken', 'bad_utf8'] as const)('rejects a hash-correct invalid catalog (%s) without falling back', async (value) => {
  await admitFixture();
  const bytes = value === 'bad_utf8' ? new Uint8Array([0xff, 0xfe]) : new TextEncoder().encode(value);
  const hash = await sha256Hex(bytes);
  await upload([{ path: CATALOG_PATH, bytes, sha256: hash, mediaType: 'application/json' }]);
  const row = await db.prepare('SELECT manifest_json FROM content_releases WHERE id = ?1').bind(releaseId).first<{ manifest_json: string }>();
  const manifest = JSON.parse(row!.manifest_json);
  Object.assign(manifest.files.find((f: { path: string }) => f.path === CATALOG_PATH), { sha256: hash, bytes: bytes.byteLength });
  await db.batch([
    db.prepare('UPDATE content_releases SET manifest_json = ?2 WHERE id = ?1').bind(releaseId, JSON.stringify(manifest)),
    db.prepare('UPDATE release_files SET sha256 = ?2 WHERE release_id = ?1 AND path = ?3').bind(releaseId, hash, CATALOG_PATH)
  ]);
  await expect(loadReleaseCatalog(baseEnv, releaseId)).rejects.toMatchObject({ code: 'release_catalog_invalid' });
});

it('rejects a catalog index that disagrees with its declared manifest hash', async () => {
  await admitFixture();
  await db.prepare('UPDATE release_files SET sha256 = ?2 WHERE release_id = ?1 AND path = ?3').bind(releaseId, files.find((f) => f.path === 'units/unit_pack.json')!.sha256, CATALOG_PATH).run();
  await expect(loadReleaseCatalog(baseEnv, releaseId)).rejects.toMatchObject({ code: 'release_catalog_invalid' });
});

it('keeps an explicitly allowlisted older catalog distinct from the current release', async () => {
  await admitFixture(); const { playerId } = await player();
  const next = structuredClone(catalog); next.items.find((i) => i.item_id === material)!.stack_cap = 2;
  const replacement = await artifact(CATALOG_PATH, next);
  await upload([replacement]);
  const nextFiles = files.map((f) => f.path === CATALOG_PATH ? replacement : f);
  expect((await admin('/admin/api/releases', post({ id: 'rel_catalog_next', channel: 'dev', files: entries(nextFiles) }))).status).toBe(201);
  await db.batch([
    db.prepare("UPDATE content_releases SET state = 'published', published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 'rel_catalog_next'"),
    db.prepare("UPDATE channel_pointers SET release_id = 'rel_catalog_next', version = version + 1 WHERE channel = 'dev'")
  ]);
  await expect(begin(playerId)).rejects.toMatchObject({ code: 'release_not_economic' });
  expect((await admin(`/admin/api/releases/${releaseId}/economic-policy`, post({ mode: 'allowlisted', expectedVersion: 0, validUntil: new Date(Date.now() + 3_600_000).toISOString(), reason: 'local runtime exception fixture' }))).status).toBe(200);
  expect(await begin(playerId)).toMatchObject({ catalogSha256: sha256 });
  expect(await startBattle(baseEnv, playerId, { releaseId: 'rel_catalog_next', nodeId: 'catalog_probe' })).toMatchObject({ catalogSha256: replacement.sha256 });
});


it('does not fall back to live tables when the manifest declares a missing index entry', async () => {
  await admitFixture();
  await db.prepare('DELETE FROM release_files WHERE release_id = ?1 AND path = ?2').bind(releaseId, CATALOG_PATH).run();
  await expect(loadReleaseCatalog(baseEnv, releaseId)).rejects.toMatchObject({ code: 'release_catalog_invalid' });
});

it.each(['declared_size', 'object_size', 'byte_budget'] as const)('rejects catalog byte contract violations (%s)', async (kind) => {
  await admitFixture();
  const row = await db.prepare('SELECT manifest_json FROM content_releases WHERE id = ?1').bind(releaseId).first<{ manifest_json: string }>();
  const manifest = JSON.parse(row!.manifest_json);
  const declared = manifest.files.find((f: { path: string }) => f.path === CATALOG_PATH);
  if (kind === 'object_size') await baseEnv.CONTENT.put(ContentStore.objectKey(sha256), new Uint8Array(1024 * 1024 + 1));
  else {
    declared.bytes = kind === 'byte_budget' ? 1024 * 1024 + 1 : declared.bytes + 1;
    await db.prepare('UPDATE content_releases SET manifest_json = ?2 WHERE id = ?1').bind(releaseId, JSON.stringify(manifest)).run();
  }
  await expect(loadReleaseCatalog(baseEnv, releaseId)).rejects.toMatchObject({ code: 'release_catalog_invalid' });
});

it.each(['owned', 'loan'] as const)('preserves live role priority after canonical export for %s equipment', async (kind) => {
  await admitFixture(); const { playerId } = await player(); const runtime = (await loadReleaseCatalog(baseEnv, releaseId))!;
  const character = catalog.characters.find((c) => c.id === 'nara_vell')!;
  expect(runtime.data.config.gear.roleStatOrder).toEqual(['tank', 'guard', 'vanguard', 'templar', 'healer']);
  if (kind === 'loan') {
    const template = { ...pack.rules.story_loan_equipment!, rarity: 4, armor_id: 'armor_padded_4_01' };
    const legacy = await loanGear(db, character.id, character.weapon_type, character.role, 'priority_probe', catalog.config.progression, template);
    expect(await loanGear(db, character.id, character.weapon_type, character.role, 'priority_probe', catalog.config.progression, template, runtime)).toEqual(legacy);
  } else {
    const weapon = catalog.gear.find((g) => g.slot === 'weapon' && g.family === character.weapon_type && g.rarity === 4 && !g.owner_character_id)!;
    await db.batch([
      db.prepare("INSERT INTO player_items (player_id, item_type, item_id) VALUES (?1, 'character', ?2)").bind(playerId, character.id),
      db.prepare("INSERT INTO player_gear (player_id, gear_id, slot, equipped_by) VALUES (?1, ?2, 'weapon', ?3)").bind(playerId, weapon.gear_id, character.id)
    ]);
    expect(await computeCharacterStats(db, playerId, character.id, undefined, runtime)).toEqual(await computeCharacterStats(db, playerId, character.id));
  }
});
