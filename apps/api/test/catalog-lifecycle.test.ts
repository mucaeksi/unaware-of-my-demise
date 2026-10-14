import { beforeAll, beforeEach, expect, it } from 'vitest';
import { CATALOG_PATH, EconomyCatalog, Encounter, UnitPack } from '@uomd/content-schema';
import { playAuto } from '@uomd/combat';
import { sha256Hex } from '@uomd/shared';
import { admin, baseEnv, entries, game, post, resetContent, signIn, upload } from './helpers';
import { campaignFiles, type TestFile } from './fixtures';
import { exportCatalog } from '../src/content/catalog';
import { ContentStore } from '../src/content/store';
import { grantStatements } from '../src/db/grants';
import { releaseScope, type RuntimeCatalog } from '../src/content/runtime-catalog';
import { levelUpCharacter } from '../src/progression/characters';

const db = baseEnv.DB; const releaseId = 'rel_catalog_lifecycle';
const hero = 'catalog_probe_hero'; const invitation = 'catalog_probe_invitation'; const xp = 'catalog_probe_xp'; const armor = 'catalog_probe_armor';
let files: TestFile[]; let runtime: RuntimeCatalog; let pack: UnitPack; let encounter: Encounter;
const artifact = async (path: string, value: unknown): Promise<TestFile> => { const bytes = new TextEncoder().encode(JSON.stringify(value)); return { path, bytes, sha256: await sha256Hex(bytes), mediaType: 'application/json' }; };
beforeAll(async () => {
  const sql = import.meta.glob('../seed/*.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
  for (const name of ['characters', 'catalog', 'banners']) {
    const statements = sql[`../seed/${name}.sql`]!.replace(/^--.*$/gm, '').trim().split(/;\n(?=(?:INSERT|UPDATE) )/).map((s) => s.trim().replace(/;$/, '')).filter(Boolean);
    for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50).map((s) => db.prepare(s)));
  }
  const catalog = EconomyCatalog.parse(JSON.parse((await exportCatalog(db)).json));
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value).replaceAll('iona_mist', hero));
  const character = clone(catalog.characters.find((c) => c.id === 'iona_mist')!); character.name_en = 'Catalog Probe';
  const signature = clone(catalog.gear.find((g) => g.gear_id === catalog.characters.find((c) => c.id === 'iona_mist')!.signature_weapon_id)!); signature.gear_id = 'catalog_probe_signature'; signature.source_banner_id = null; character.signature_weapon_id = signature.gear_id;
  catalog.characters.push(character); catalog.gear.push(signature); catalog.skills.push(...catalog.skills.filter((s) => s.character_id === 'iona_mist').map(clone));
  catalog.items.push({ ...structuredClone(catalog.items.find((i) => i.item_id === 'first_oath_invitation')!), item_id: invitation });
  catalog.items.push({ ...structuredClone(catalog.items.find((i) => i.item_id === 'bound_chronicle')!), item_id: xp });
  catalog.gear.push({ ...structuredClone(catalog.gear.find((g) => g.gear_id === 'armor_padded_3_01')!), gear_id: armor });
  const all = await campaignFiles(); const decode = (path: string) => JSON.parse(new TextDecoder().decode(all.find((f) => f.path === path)!.bytes));
  pack = UnitPack.parse(decode('units/unit_pack.json'));
  const unit = clone(pack.units.find((u) => u.unit_id === 'iona_mist')!); unit.name_en = character.name_en; unit.art_key = 'iona_mist'; pack.units.push(unit);
  const index = decode('chapters/chapter_index.json');
  index.recruit_selectors.push({ ...structuredClone(index.recruit_selectors[0]), item_id: invitation, choices: [hero] });
  encounter = Encounter.parse({ ...decode('encounters/tutorial_t1.json'), encounter_id: 'catalog_lifecycle', party_mode: 'owned', party: [], guests: [] });
  index.chapters[0].nodes.push({ node_id: 'catalog_lifecycle', title_en: 'Lifecycle probe', kind: 'battle', encounter: 'encounters/catalog_lifecycle.json' });
  const snapshot = await artifact(CATALOG_PATH, catalog); runtime = { releaseId, sha256: snapshot.sha256, data: catalog };
  files = [...all.filter((f) => !['units/unit_pack.json', 'chapters/chapter_index.json'].includes(f.path)), await artifact('units/unit_pack.json', pack), await artifact('chapters/chapter_index.json', index), await artifact('encounters/catalog_lifecycle.json', encounter), snapshot];
});
beforeEach(async () => {
  await resetContent(); await upload(files);
  const staged = await admin('/admin/api/releases', post({ id: releaseId, channel: 'dev', files: entries(files) }));
  expect(staged.status, await staged.clone().text()).toBe(201);
  // Explicit isolated runtime fixture. Publication remains blocked in the product API.
  await db.batch([
    db.prepare("UPDATE content_releases SET state = 'published', published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1").bind(releaseId),
    db.prepare("INSERT INTO channel_pointers (channel, release_id, version, updated_by) VALUES ('dev', ?1, 1, 'test') ON CONFLICT (channel) DO UPDATE SET release_id = excluded.release_id, version = version + 1").bind(releaseId)
  ]);
});
async function prepared() {
  const player = await signIn(`catalog-lifecycle-${crypto.randomUUID()}`);
  await db.batch(await grantStatements(db, player.playerId, [{ type: 'item', itemId: invitation, quantity: 2 }, { type: 'item', itemId: xp, quantity: 2 }, { type: 'item', itemId: 'tactical_notes', quantity: 3 }, { type: 'item', itemId: 'iron_oath_seal', quantity: 3 }, { type: 'gear', gearId: armor }, { type: 'account_xp', amount: 2000 }, { type: 'currency', currency: 'eclipse_token', amount: 1000 }], { keyPrefix: `fixture:${player.playerId}`, reason: 'test fixture', catalog: runtime }));
  await db.batch(['stage_1_2', 'ch1_first_oath'].map((node) => db.prepare('INSERT INTO player_progress (player_id, node_id, stars, clears) VALUES (?1, ?2, 3, 1)').bind(player.playerId, node)));
  return player;
}
const recruit = (auth: Record<string, string>, requestId = 'catalog_recruit_001') => game(`/api/v1/recruitment/${invitation}`, post({ releaseId, characterId: hero, requestId }, auth));
const grow = (auth: Record<string, string>, requestId = 'catalog_growth_001', selected: string | null = releaseId) => game(`/api/v1/characters/${hero}/level-up`, post({ ...(selected ? { releaseId: selected } : {}), requestId, items: [{ itemId: xp, quantity: 2 }] }, auth));

it('recruits, grows, ranks, ascends and fights with declared-only identities without materializing definitions', async () => {
  const { auth, playerId } = await prepared();
  const choices = await game(`/api/v1/recruitment/selectors?releaseId=${releaseId}`, { headers: auth });
  expect((await choices.json<{ selectors: { itemId: string; choices: { id: string; name_en: string }[] }[] }>()).selectors.find((s) => s.itemId === invitation)?.choices).toContainEqual(expect.objectContaining({ id: hero, name_en: 'Catalog Probe' }));
  expect((await recruit(auth)).status).toBe(200);
  const grown = await grow(auth); expect(grown.status, await grown.clone().text()).toBe(200); expect(await grown.json()).toMatchObject({ character: hero, level: 5, catalogSha256: runtime.sha256 });
  const basic = runtime.data.skills.find((s) => s.character_id === hero && s.type === 'basic')!.skill_id;
  expect((await game(`/api/v1/characters/${hero}/skills/${basic}/upgrade`, post({ releaseId, requestId: 'catalog_rank_001' }, auth))).status).toBe(200);
  expect((await game(`/api/v1/characters/${hero}/ascend`, post({ releaseId, requestId: 'catalog_ascend_001' }, auth))).status).toBe(200);
  const roster = await game(`/api/v1/characters?releaseId=${releaseId}`); expect((await roster.json<{ characters: { id: string }[] }>()).characters).toContainEqual(expect.objectContaining({ id: hero }));
  const mine = await game(`/api/v1/characters/mine?releaseId=${releaseId}`, { headers: auth }); expect((await mine.json<{ characters: { id: string; skills: unknown[] }[] }>()).characters.find((c) => c.id === hero)?.skills).toHaveLength(4);
  expect((await game(`/api/v1/characters/${hero}/stats?releaseId=${releaseId}`, { headers: auth })).status).toBe(200);
  const start = await game('/api/v1/progress/battle/start', post({ releaseId, nodeId: 'catalog_lifecycle' }, auth));
  const frozen = await start.json<{ sessionId: string; party: Parameters<typeof playAuto>[2] }>();
  const played = playAuto(pack, encounter, frozen.party); expect(played.battle.result?.winner).toBe('player');
  expect((await game('/api/v1/progress/battle', post({ releaseId, nodeId: 'catalog_lifecycle', sessionId: frozen.sessionId, requestId: 'catalog_battle_001', actions: played.actions }, auth))).status).toBe(200);
  for (const [table, key, id] of [['characters', 'id', hero], ['item_defs', 'item_id', xp], ['item_defs', 'item_id', invitation], ['gear_defs', 'gear_id', armor]]) expect(await db.prepare(`SELECT 1 FROM ${table} WHERE ${key} = ?1`).bind(id).first()).toBeNull();
  const gear = await db.prepare('SELECT id FROM player_gear WHERE player_id = ?1 AND gear_id = ?2').bind(playerId, armor).first<{ id: number }>();
  expect(gear).toBeTruthy(); expect(await db.prepare("SELECT json_extract(result_json, '$.instanceId') AS id FROM reward_grants WHERE player_id = ?1 AND grant_key = ?2").bind(playerId, `fixture:${playerId}:4`).first()).toEqual(gear);
});

it('ignores authoring rule edits and recovers original recruit/growth results after revocation and catalog loss', async () => {
  const { auth } = await prepared();
  const first = await recruit(auth); expect(first.status).toBe(200); const recruited = await first.json();
  const before = await db.prepare("SELECT value_json FROM game_config WHERE key = 'progression'").first<{ value_json: string }>();
  await db.prepare("UPDATE game_config SET value_json = '{}' WHERE key = 'progression'").run();
  try {
    const grown = await grow(auth); expect(grown.status, await grown.clone().text()).toBe(200); const original = await grown.json();
    expect((await admin(`/admin/api/releases/${releaseId}/economic-policy`, post({ mode: 'revoked', expectedVersion: 0, reason: 'local original recovery fixture' }))).status).toBe(200);
    await baseEnv.CONTENT.delete(ContentStore.objectKey(runtime.sha256));
    const recoveredGrowth = await grow(auth); expect(recoveredGrowth.status).toBe(200);
    expect(await recoveredGrowth.json()).toMatchObject({ character: hero, level: 5, catalogSha256: runtime.sha256, replayed: true });
    const recoveredRecruit = await recruit(auth); expect(recoveredRecruit.status).toBe(200);
    expect(await recoveredRecruit.json()).toMatchObject({ ...(recruited as object), replayed: true });
    expect(original).toMatchObject({ character: hero, level: 5 });
    expect(recruited).toMatchObject({ catalogSha256: runtime.sha256 });
  } finally { await db.prepare("UPDATE game_config SET value_json = ?1 WHERE key = 'progression'").bind(before!.value_json).run(); }
});

it('requires an explicit release for new growth while a catalog is current and rejects unknown release selections', async () => {
  const { auth, playerId } = await prepared(); expect((await recruit(auth)).status).toBe(200);
  expect((await grow(auth, 'catalog_no_release', null)).status).toBe(409);
  expect((await grow(auth, 'catalog_wrong_release', 'rel_missing_probe')).status).toBe(409);
  expect(await db.prepare('SELECT 1 FROM player_chars WHERE player_id = ?1 AND character_id = ?2').bind(playerId, hero).first()).toBeNull();
  expect(await db.prepare('SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?2').bind(playerId, xp).first()).toEqual({ qty: 2 });
});

it('rolls back growth if account admission changes at its transaction boundary', async () => {
  const { auth, playerId } = await prepared(); expect((await recruit(auth)).status).toBe(200);
  let enter!: () => void; let resume!: () => void; let paused = false;
  const entered = new Promise<void>((resolve) => { enter = resolve; }); const gate = new Promise<void>((resolve) => { resume = resolve; });
  const delayed = new Proxy(db, { get(target, key) {
    if (key === 'batch') return async (statements: D1PreparedStatement[]) => { if (!paused) { paused = true; enter(); await gate; } return target.batch(statements); };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
  const applying = levelUpCharacter(delayed, playerId, hero, { releaseId, requestId: 'catalog_guard_001', items: [{ itemId: xp, quantity: 2 }] }, releaseScope(baseEnv, releaseId));
  const settled = applying.then((value) => ({ ok: true, value }), (error: unknown) => ({ ok: false, error }));
  try { await entered; await db.prepare("UPDATE players SET status = 'banned' WHERE id = ?1").bind(playerId).run(); } finally { resume(); }
  expect(await settled).toMatchObject({ ok: false, error: { code: 'release_not_economic' } });
  expect(await db.prepare('SELECT 1 FROM player_chars WHERE player_id = ?1 AND character_id = ?2').bind(playerId, hero).first()).toBeNull();
  expect(await db.prepare('SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?2').bind(playerId, xp).first()).toEqual({ qty: 2 });
  expect(await db.prepare("SELECT balance FROM wallets WHERE player_id = ?1 AND currency = 'eclipse_token'").bind(playerId).first()).toEqual({ balance: 1000 });
});

it('does not reuse a committed growth identity for a different release', async () => {
  const { auth } = await prepared(); expect((await recruit(auth)).status).toBe(200);
  expect((await grow(auth)).status).toBe(200);
  const wrong = await grow(auth, 'catalog_growth_001', 'rel_other_probe');
  expect(wrong.status).toBe(409); expect(await wrong.json()).toMatchObject({ error: 'request_id_reused' });
});
