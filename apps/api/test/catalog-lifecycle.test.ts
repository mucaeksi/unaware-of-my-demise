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
import { pullGacha } from '../src/gacha/service';
import { levelGear, equipGear } from '../src/gear/service';
import { levelUpCharacter } from '../src/progression/characters';

const db = baseEnv.DB; const releaseId = 'rel_catalog_lifecycle';
const hero = 'catalog_probe_hero'; const invitation = 'catalog_probe_invitation'; const xp = 'catalog_probe_xp'; const armor = 'catalog_probe_armor';
const weapon = 'catalog_probe_weapon'; const banner = 'catalog_probe_banner'; const weaponBanner = 'catalog_probe_weapon_banner';
const tempering = 'catalog_probe_tempering'; const cinders = 'catalog_probe_cinders'; const ring = 'catalog_probe_ring';
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
  const sword = structuredClone(catalog.gear.find((g) => g.slot === 'weapon' && g.rarity === 3 && g.family === character.weapon_type)!); sword.gear_id = weapon; sword.source_banner_id = null; catalog.gear.push(sword);
  const characterBanner = structuredClone(catalog.banners.find((b) => b.id === 'hall_of_ancestors')!); characterBanner.id = banner; characterBanner.config.id = banner; characterBanner.config.pools.four = [hero]; characterBanner.status = 'active'; catalog.banners.push(characterBanner);
  const armaments = structuredClone(catalog.banners.find((b) => b.id === 'hall_of_armaments_weapons')!); armaments.id = weaponBanner; armaments.config.id = weaponBanner; armaments.config.pools.three = [weapon]; armaments.status = 'active'; catalog.banners.push(armaments);
  catalog.items.push({ ...structuredClone(catalog.items.find((i) => i.item_id === 'weapon_tempering_xp')!), item_id: tempering });
  catalog.config.progression.equipment.xpItemId = tempering;
  catalog.items.push({ ...structuredClone(catalog.items.find((i) => i.item_id === catalog.config.gear.rerollCost.itemId)!), item_id: cinders }); catalog.config.gear.rerollCost.itemId = cinders;
  catalog.gear.push({ ...structuredClone(catalog.gear.find((g) => g.gear_id === 'accessory_ash_maw_hide_ring_4')!), gear_id: ring });
  for (const g of catalog.gear) if ((g.slot === 'ring' || g.slot === 'necklace') && g.extra.profile.reroll_cost) g.extra.profile.reroll_cost.item_id = cinders;
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
  const published = await admin(`/admin/api/releases/${releaseId}/publish`, post({}));
  expect(published.status, await published.clone().text()).toBe(200);
});
async function prepared() {
  const player = await signIn(`catalog-lifecycle-${crypto.randomUUID()}`);
  await db.batch(await grantStatements(db, player.playerId, [{ type: 'item', itemId: invitation, quantity: 2 }, { type: 'item', itemId: xp, quantity: 2 }, { type: 'item', itemId: 'tactical_notes', quantity: 3 }, { type: 'item', itemId: 'iron_oath_seal', quantity: 3 }, { type: 'gear', gearId: armor }, { type: 'account_xp', amount: 2000 }, { type: 'currency', currency: 'eclipse_token', amount: 1000 }, { type: 'item', itemId: tempering, quantity: 1000 }, { type: 'item', itemId: 'blacksmith_rivet', quantity: 20 }, { type: 'item', itemId: cinders, quantity: 20 }, { type: 'gear', gearId: ring }], { keyPrefix: `fixture:${player.playerId}`, reason: 'test fixture', catalog: runtime }));
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
  const piece = await db.prepare('SELECT id FROM player_gear WHERE player_id = ?1 AND gear_id = ?2').bind(playerId, armor).first<{ id: number }>();
  expect((await game(`/api/v1/gear/${piece!.id}/equip`, post({ releaseId, characterId: hero }, auth))).status).toBe(200);
  const summoned = await pullGacha(db, playerId, { releaseId, bannerId: banner, requestId: 'catalog_summon_001', count: 1 }, { scope: releaseScope(baseEnv, releaseId), roll: () => 0.04 });
  expect(summoned).toMatchObject({ releaseId, catalogSha256: runtime.sha256, cost: { amount: 160 }, pulls: [{ itemId: hero, rarity: 4, duplicate: true, shards: 5 }] });
  const armament = await pullGacha(db, playerId, { releaseId, bannerId: weaponBanner, target: 'weapon_mahmut_signature', requestId: 'catalog_weapon_001', count: 1 }, { scope: releaseScope(baseEnv, releaseId), roll: () => 0.999 });
  expect(armament.pulls[0]).toMatchObject({ itemId: weapon, duplicate: false });
  const minted = await db.prepare('SELECT id FROM player_gear WHERE player_id = ?1 AND gear_id = ?2').bind(playerId, weapon).first<{ id: number }>();
  expect(await db.prepare("SELECT json_extract(result_json, '$.instanceId') AS id FROM reward_grants WHERE player_id = ?1 AND grant_key = ?2").bind(playerId, `gacha:${playerId}:catalog_weapon_001:0`).first()).toEqual(minted);
  expect((await game(`/api/v1/gear/${minted!.id}/equip`, post({ releaseId, characterId: hero }, auth))).status).toBe(200);
  const shown = await game(`/api/v1/gear?releaseId=${releaseId}`, { headers: auth }); expect((await shown.json<{ gear: { gearId: string; equippedBy: string | null }[] }>()).gear).toContainEqual(expect.objectContaining({ gearId: weapon, equippedBy: hero }));
  const history = await game('/api/v1/gacha/history', { headers: auth }); expect((await history.json<{ pulls: unknown[] }>()).pulls).toContainEqual(expect.objectContaining({ item_id: weapon, releaseId, catalogSha256: runtime.sha256 }));
  const start = await game('/api/v1/progress/battle/start', post({ releaseId, nodeId: 'catalog_lifecycle' }, auth));
  const frozen = await start.json<{ sessionId: string; party: Parameters<typeof playAuto>[2] }>();
  const played = playAuto(pack, encounter, frozen.party); expect(played.battle.result?.winner).toBe('player');
  expect((await game('/api/v1/progress/battle', post({ releaseId, nodeId: 'catalog_lifecycle', sessionId: frozen.sessionId, requestId: 'catalog_battle_001', actions: played.actions }, auth))).status).toBe(200);
  for (const [table, key, id] of [['characters', 'id', hero], ['item_defs', 'item_id', xp], ['item_defs', 'item_id', invitation], ['gear_defs', 'gear_id', armor], ['gear_defs', 'gear_id', weapon], ['banners', 'id', banner], ['banners', 'id', weaponBanner]]) expect(await db.prepare(`SELECT 1 FROM ${table} WHERE ${key} = ?1`).bind(id).first()).toBeNull();
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
  try { await Promise.race([entered, applying.then(() => { throw new Error('operation completed before the transaction gate'); })]); await db.prepare("UPDATE players SET status = 'banned' WHERE id = ?1").bind(playerId).run(); } finally { resume(); }
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


it('levels, ascends, rerolls and dismantles declared-only gear using frozen costs, caps and task rules', async () => {
  const { auth, playerId } = await prepared();
  const ids = (await db.prepare('SELECT id, gear_id FROM player_gear WHERE player_id = ?1').bind(playerId).all<{ id: number; gear_id: string }>()).results;
  const id = ids.find((g) => g.gear_id === armor)!.id; const accessory = ids.find((g) => g.gear_id === ring)!.id;
  const saved = (await db.prepare("SELECT key, value_json FROM game_config WHERE key IN ('progression', 'gear', 'tasks')").all<{ key: string; value_json: string }>()).results;
  await db.prepare("UPDATE game_config SET value_json = '{}' WHERE key IN ('progression', 'gear', 'tasks')").run();
  try {
    const level = await game(`/api/v1/gear/${id}/level-up`, post({ releaseId, requestId: 'catalog_gear_level_001', xp: 1000 }, auth)); expect(level.status, await level.clone().text()).toBe(200); expect(await level.json()).toMatchObject({ id, level: 5, releaseId, catalogSha256: runtime.sha256 });
    const ascend = await game(`/api/v1/gear/${id}/ascend`, post({ releaseId, requestId: 'catalog_gear_ascend_001' }, auth)); expect(ascend.status, await ascend.clone().text()).toBe(200); expect(await ascend.json()).toMatchObject({ ascension: 1, newCap: 10 });
    const reroll = await game(`/api/v1/gear/${accessory}/reroll`, post({ releaseId, requestId: 'catalog_gear_reroll_001' }, auth)); expect(reroll.status, await reroll.clone().text()).toBe(200); expect(await reroll.json()).toMatchObject({ spent: { itemId: cinders }, catalogSha256: runtime.sha256 });
    const dismantle = await game(`/api/v1/gear/${id}/dismantle`, post({ releaseId, requestId: 'catalog_gear_destroy_001' }, auth)); expect(dismantle.status, await dismantle.clone().text()).toBe(200); expect(await dismantle.json()).toMatchObject({ gained: expect.arrayContaining([expect.objectContaining({ itemId: tempering })]) });
    const replay = await game(`/api/v1/gear/${id}/level-up`, post({ releaseId, requestId: 'catalog_gear_level_001', xp: 1000 }, auth)); expect(replay.status).toBe(200); expect(await replay.json()).toMatchObject({ level: 5, replayed: true });
  } finally { await db.batch(saved.map((r) => db.prepare('UPDATE game_config SET value_json = ?1 WHERE key = ?2').bind(r.value_json, r.key))); }
});

it('recovers committed gear and gacha after revocation/catalog loss, retaining provenance and original grants', async () => {
  const { auth, playerId } = await prepared();
  const id = (await db.prepare('SELECT id FROM player_gear WHERE player_id = ?1 AND gear_id = ?2').bind(playerId, armor).first<{ id: number }>())!.id;
  const gearInput = { releaseId, requestId: 'catalog_recover_gear', xp: 100 };
  const pullInput = { releaseId, requestId: 'catalog_recover_pull', bannerId: weaponBanner, target: 'weapon_mahmut_signature', count: 1 };
  expect((await game(`/api/v1/gear/${id}/level-up`, post(gearInput, auth))).status).toBe(200);
  const pulled = await pullGacha(db, playerId, pullInput, { scope: releaseScope(baseEnv, releaseId), roll: () => 0.999 });
  const before = (await db.prepare('SELECT * FROM player_gear WHERE player_id = ?1 ORDER BY id').bind(playerId).all()).results;
  expect((await admin(`/admin/api/releases/${releaseId}/economic-policy`, post({ mode: 'revoked', expectedVersion: 0, reason: 'local gear/gacha recovery fixture' }))).status).toBe(200);
  await baseEnv.CONTENT.delete(ContentStore.objectKey(runtime.sha256));
  const gear = await game(`/api/v1/gear/${id}/level-up`, post(gearInput, auth)); expect(gear.status).toBe(200); expect(await gear.json()).toMatchObject({ replayed: true, catalogSha256: runtime.sha256 });
  const pull = await game('/api/v1/gacha/pull', post(pullInput, auth)); expect(pull.status).toBe(200); expect(await pull.json()).toMatchObject({ ...pulled, replayed: true });
  expect((await db.prepare('SELECT * FROM player_gear WHERE player_id = ?1 ORDER BY id').bind(playerId).all()).results).toEqual(before);
  const fresh = await game('/api/v1/gacha/pull', post({ ...pullInput, requestId: 'catalog_revoked_pull' }, auth)); expect(fresh.status).toBe(409); expect(await fresh.json()).toMatchObject({ error: 'release_not_economic' });
  expect((await game('/api/v1/gacha/pull', post({ ...pullInput, releaseId: 'rel_other_probe' }, auth))).status).toBe(409);
  expect((await game(`/api/v1/gear/${id}/level-up`, post({ ...gearInput, releaseId: 'rel_other_probe' }, auth))).status).toBe(409);
});

it('requires explicit gear/gacha selection and discloses only the selected banner catalog', async () => {
  const { auth, playerId } = await prepared();
  const id = (await db.prepare('SELECT id FROM player_gear WHERE player_id = ?1 AND gear_id = ?2').bind(playerId, armor).first<{ id: number }>())!.id;
  for (const [path, input] of [[`/api/v1/gear/${id}/level-up`, { requestId: 'catalog_missing_gear', xp: 1 }], [`/api/v1/gear/${id}/lock`, { locked: true }], ['/api/v1/gacha/pull', { requestId: 'catalog_missing_pull', bannerId: weaponBanner, target: 'weapon_mahmut_signature', count: 1 }]] as const) {
    const response = await game(path, post(input, auth)); expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ error: 'release_required' });
  }
  const response = await game(`/api/v1/banners?releaseId=${releaseId}`); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ releaseId, catalogSha256: runtime.sha256, banners: expect.arrayContaining([expect.objectContaining({ id: weaponBanner, cost: expect.objectContaining({ perPull: 160 }), pools: expect.objectContaining({ three: [weapon] }) })]) });
  expect((await game('/api/v1/banners?releaseId=rel_unknown')).status).toBe(404);
  expect(await db.prepare('SELECT 1 FROM gacha_requests WHERE player_id = ?1').bind(playerId).first()).toBeNull();
});

it.each(['gear', 'gacha', 'equip'] as const)('rolls back %s if account admission changes at the transaction boundary', async (kind) => {
  const { playerId } = await prepared();
  const id = (await db.prepare('SELECT id FROM player_gear WHERE player_id = ?1 AND gear_id = ?2').bind(playerId, armor).first<{ id: number }>())!.id;
  let enter!: () => void; let resume!: () => void; let paused = false;
  const entered = new Promise<void>((resolve) => { enter = resolve; }); const gate = new Promise<void>((resolve) => { resume = resolve; });
  const delayed = new Proxy(db, { get(target, key) {
    if (key === 'batch') return async (statements: D1PreparedStatement[]) => { if (!paused) { paused = true; enter(); await gate; } return target.batch(statements); };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
  const scope = releaseScope(baseEnv, releaseId);
  const applying = kind === 'gacha' ? pullGacha(delayed, playerId, { releaseId, bannerId: weaponBanner, target: 'weapon_mahmut_signature', requestId: 'catalog_guard_pull', count: 1 }, { scope, roll: () => 0.999 })
    : kind === 'gear' ? levelGear(delayed, playerId, id, { releaseId, requestId: 'catalog_guard_gear', xp: 100 }, scope) : equipGear(delayed, playerId, id, 'mahmut', scope);
  const settled = applying.then((value) => ({ ok: true, value }), (error: unknown) => ({ ok: false, error }));
  try { await Promise.race([entered, applying.then(() => { throw new Error('operation completed before the transaction gate'); })]); await db.prepare("UPDATE players SET status = 'banned' WHERE id = ?1").bind(playerId).run(); } finally { resume(); }
  expect(await settled).toMatchObject({ ok: false, error: { code: 'release_not_economic' } });
  expect(await db.prepare('SELECT level, version, equipped_by FROM player_gear WHERE id = ?1').bind(id).first()).toEqual({ level: 1, version: 0, equipped_by: null });
  expect(await db.prepare("SELECT balance FROM wallets WHERE player_id = ?1 AND currency = 'eclipse_token'").bind(playerId).first()).toEqual({ balance: 1000 });
  expect(await db.prepare('SELECT 1 FROM gacha_requests WHERE player_id = ?1').bind(playerId).first()).toBeNull();
});

it('summons a new catalog-only companion before recruitment and grows the same stable identity', async () => {
  const { auth, playerId } = await prepared();
  expect(await db.prepare("SELECT 1 FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2").bind(playerId, hero).first()).toBeNull();
  const summoned = await pullGacha(db, playerId, { releaseId, bannerId: banner, count: 1, requestId: 'catalog_new_character' }, { scope: releaseScope(baseEnv, releaseId), roll: () => 0.04 });
  expect(summoned.pulls[0]).toMatchObject({ itemId: hero, duplicate: false, shards: 0 });
  expect(await db.prepare('SELECT id FROM character_identities WHERE id = ?1').bind(hero).first()).toEqual({ id: hero });
  expect((await grow(auth)).status).toBe(200);
  expect(await db.prepare('SELECT 1 FROM characters WHERE id = ?1').bind(hero).first()).toBeNull();
});

it('keeps a declared-only team and freezes earned mail definitions before later catalog loss', async () => {
  const { auth, playerId } = await prepared(); expect((await recruit(auth)).status).toBe(200);
  expect((await game('/api/v1/teams/1', { ...post({ releaseId, name: 'Snapshot team', members: [{ characterId: hero, slot: 0, row: 'rear' }] }, auth), method: 'PUT' })).status).toBe(200);
  expect((await game('/api/v1/teams/1/activate', post({ releaseId }, auth))).status).toBe(200);
  const { sendMail, claimMail, listMail } = await import('../src/mail/service');
  const sent = await sendMail(db, playerId, { kind: 'reward', title: 'Frozen reward', attachments: [{ type: 'character', itemId: hero }, { type: 'item', itemId: xp, quantity: 1 }, { type: 'gear', gearId: armor }] }, 'test', new Date(), runtime);
  await baseEnv.CONTENT.delete(ContentStore.objectKey(runtime.sha256));
  expect((await listMail(db, playerId)).find((m) => m.id === sent.id)?.names?.[hero]).toBe('Catalog Probe');
  const received = await claimMail(db, playerId, sent.id, new Date(), 'catalog_mail_frozen'); expect(received.claimed).toHaveLength(3);
  expect(await claimMail(db, playerId, sent.id, new Date(), 'catalog_mail_frozen')).toMatchObject({ replayed: true });
  expect(await db.prepare("SELECT copies, shards FROM player_items WHERE player_id = ?1 AND item_id = ?2").bind(playerId, hero).first()).toEqual({ copies: 2, shards: 5 });
});

it('preserves a provider-confirmed catalog-only purchase across publication loss and catalog edits', async () => {
  const { playerId } = await prepared();
  const { fakePlay, playClient } = await import('./helpers'); const { billingTag } = await import('../src/billing/service'); const { verifyReceipt } = await import('../src/billing/recovery');
  const productId = 'catalog_paid_probe'; const token = `paid_catalog_${playerId}`; const orderId = `GPA.catalog.${playerId}`;
  await db.prepare("INSERT OR REPLACE INTO shop_products (product_id, kind, title_en, grants, active) VALUES (?1, 'consumable', 'Frozen catalog fixture', ?2, 0)").bind(productId, JSON.stringify([{ type: 'character', itemId: hero }, { type: 'gear', gearId: armor }])).run();
  fakePlay.products.set(token, { purchaseState: 'pending', orderId, acknowledged: false, consumed: false, purchaseTimeMs: Date.now(), obfuscatedAccountId: await billingTag(playerId) });
  expect(await verifyReceipt(baseEnv, playClient, playerId, { productId, purchaseToken: token })).toMatchObject({ status: 'pending' });
  await db.prepare("UPDATE shop_products SET grants = '[]' WHERE product_id = ?1").bind(productId).run();
  await baseEnv.CONTENT.delete(ContentStore.objectKey(runtime.sha256));
  fakePlay.products.get(token)!.purchaseState = 'purchased';
  expect(await verifyReceipt(baseEnv, playClient, playerId, { productId, purchaseToken: token })).toMatchObject({ status: 'granted' });
  expect(await db.prepare("SELECT copies FROM player_items WHERE player_id = ?1 AND item_id = ?2").bind(playerId, hero).first()).toEqual({ copies: 1 });
  expect(await db.prepare('SELECT count(*) AS n FROM player_gear WHERE player_id = ?1 AND gear_id = ?2').bind(playerId, armor).first()).toEqual({ n: 2 });
});

it('pins task rules across catalog changes without duplicate claims or changed rewards', async () => {
  const { auth, playerId } = await prepared(); const { taskEventStatements } = await import('../src/tasks/service');
  await db.batch(await taskEventStatements(db, playerId, { eligible_wins: 999, boss_wins: 999, three_star_wins: 999, level_ups: 999 }, Date.now(), runtime.data.config.tasks, runtime));
  const first = await game(`/api/v1/tasks?releaseId=${releaseId}`, { headers: auth }); expect(first.status).toBe(200);
  const shown = await first.json<{ windowHours: number; daily: { periodKey: string; tasks: { id: string; rewards: unknown[] }[] } }>(); const task = shown.daily.tasks[0]!;
  const changed = structuredClone(runtime.data); changed.config.tasks.windowHours = shown.windowHours === 12 ? 6 : 12; changed.config.tasks.daily.tasks[0]!.rewards = [{ type: 'currency', currency: 'eclipse_token', amount: 1 }];
  const snapshot = await artifact(CATALOG_PATH, changed); const nextId = 'rel_catalog_tasks_next'; await upload([snapshot]);
  expect((await admin('/admin/api/releases', post({ id: nextId, channel: 'dev', files: entries([...files.filter((f) => f.path !== CATALOG_PATH), snapshot]) }))).status).toBe(201);
  expect((await admin(`/admin/api/releases/${nextId}/publish`, post({}))).status).toBe(200);
  const fresh = await game(`/api/v1/tasks?releaseId=${nextId}`, { headers: auth }); expect(await fresh.json()).toMatchObject({ windowHours: shown.windowHours, daily: { periodKey: shown.daily.periodKey } });
  const input = { releaseId: nextId, periodKey: shown.daily.periodKey, taskId: task.id, requestId: 'catalog_task_frozen' };
  const claimed = await game('/api/v1/tasks/claim', post(input, auth)); expect(claimed.status, await claimed.clone().text()).toBe(200); expect(await claimed.json()).toMatchObject({ rewards: task.rewards });
  expect((await game('/api/v1/tasks/claim', post({ ...input, requestId: 'catalog_task_duplicate' }, auth))).status).toBe(409);
  await baseEnv.CONTENT.delete(ContentStore.objectKey(snapshot.sha256));
  const recovered = await game('/api/v1/tasks/claim', post(input, auth)); expect(recovered.status).toBe(200); expect(await recovered.json()).toMatchObject({ replayed: true, rewards: task.rewards });
});

async function publishVariant(id: string, data: EconomyCatalog) {
  const snapshot = await artifact(CATALOG_PATH, data); await upload([snapshot]);
  const staged = await admin('/admin/api/releases', post({ id, channel: 'dev', files: entries([...files.filter((f) => f.path !== CATALOG_PATH), snapshot]) })); expect(staged.status, await staged.clone().text()).toBe(201);
  expect((await admin(`/admin/api/releases/${id}/publish`, post({}))).status).toBe(200); return snapshot;
}
it('atomically starts new accounts from the published catalog while existing logins survive a kill', async () => {
  const changed = structuredClone(runtime.data); changed.characters.find((c) => c.id === hero)!.acquisition = 'free_start';
  const nextId = 'rel_catalog_starters'; await publishVariant(nextId, changed);
  const subject = `catalog-starter-${crypto.randomUUID()}`; const { playerId } = await signIn(subject);
  expect(await db.prepare("SELECT copies FROM player_items WHERE player_id = ?1 AND item_id = ?2").bind(playerId, hero).first()).toEqual({ copies: 1 });
  expect(await db.prepare("SELECT json_extract(result_json, '$.releaseId') AS releaseId FROM reward_grants WHERE player_id = ?1 AND grant_key = ?2").bind(playerId, `signup:${playerId}:${hero}`).first()).toEqual({ releaseId: nextId });
  const kill = await admin('/admin/api/channels/dev/kill', post({ releaseId: nextId })); expect(kill.status).toBe(200);
  const { playerForGoogle } = await import('../src/player/auth');
  expect(await playerForGoogle(db, { sub: subject }, baseEnv)).toMatchObject({ id: playerId, isNew: false });
  await expect(playerForGoogle(db, { sub: `killed-${subject}` }, baseEnv)).rejects.toMatchObject({ code: 'release_not_economic' });
  expect(await db.prepare('SELECT id FROM players WHERE google_sub = ?1').bind(`killed-${subject}`).first()).toBeNull();
});
it('preserves historical equipment and permits safe cleanup when its definition disappears', async () => {
  const { auth, playerId } = await prepared(); const id = (await db.prepare('SELECT id FROM player_gear WHERE player_id = ?1 AND gear_id = ?2').bind(playerId, armor).first<{ id: number }>())!.id;
  expect((await game(`/api/v1/gear/${id}/equip`, post({ releaseId, characterId: 'mahmut' }, auth))).status).toBe(200);
  const changed = structuredClone(runtime.data); changed.gear = changed.gear.filter((g) => g.gear_id !== armor); const nextId = 'rel_catalog_retired'; await publishVariant(nextId, changed);
  const listed = await game(`/api/v1/gear?releaseId=${nextId}`, { headers: auth });
  expect(await listed.json()).toMatchObject({ gear: expect.arrayContaining([expect.objectContaining({ id, gearId: armor, equippedBy: 'mahmut', unavailableReason: expect.any(String) })]) });
  expect((await game(`/api/v1/gear/${id}/unequip`, post({ releaseId: nextId }, auth))).status).toBe(200);
  expect((await game(`/api/v1/gear/${id}/lock`, post({ releaseId: nextId, locked: true }, auth))).status).toBe(200);
  expect((await game(`/api/v1/gear/${id}/equip`, post({ releaseId: nextId, characterId: 'mahmut' }, auth))).status).toBe(422);
  expect(await db.prepare('SELECT gear_id, equipped_by, locked FROM player_gear WHERE id = ?1').bind(id).first()).toEqual({ gear_id: armor, equipped_by: null, locked: 1 });
});
it('keeps subscription instant and periodic catalog-only benefits after their source object disappears', async () => {
  const { playerId } = await prepared();
  const { fakePlay, playClient } = await import('./helpers'); const { billingTag, syncSubscriptionMail } = await import('../src/billing/service'); const { verifyReceipt } = await import('../src/billing/recovery'); const { claimMail } = await import('../src/mail/service');
  const productId = 'catalog_sub_probe'; const token = `catalog_sub_${playerId}`; const now = new Date();
  const source = await db.prepare("SELECT sub_config FROM shop_products WHERE product_id = 'eclipse_blessing_30d'").first<{ sub_config: string }>(); const config = JSON.parse(source!.sub_config); config.instant = [{ type: 'character', itemId: hero }]; config.periodic.attachments = [{ type: 'gear', gearId: armor }];
  await db.prepare("INSERT OR REPLACE INTO shop_products (product_id, kind, title_en, grants, sub_config, active) VALUES (?1, 'subscription', 'Synthetic catalog subscription', '[]', ?2, 0)").bind(productId, JSON.stringify(config)).run();
  fakePlay.subs.set(token, { state: 'active', productId, latestOrderId: `GPA.catalog.${playerId}..0`, acknowledged: false, startTimeMs: now.getTime(), expiryTimeMs: now.getTime() + 30 * 86_400_000, obfuscatedAccountId: await billingTag(playerId) });
  expect(await verifyReceipt(baseEnv, playClient, playerId, { productId, purchaseToken: token }, now)).toMatchObject({ status: 'granted' });
  await baseEnv.CONTENT.delete(ContentStore.objectKey(runtime.sha256));
  const nextWindow = new Date(now.getTime() + 12 * 3_600_000 + 1);
  expect(await syncSubscriptionMail(db, playerId, nextWindow)).toBe(1);
  const mail = await db.prepare("SELECT id FROM mail WHERE player_id = ?1 AND kind = 'subscription' ORDER BY id DESC LIMIT 1").bind(playerId).first<{ id: number }>();
  expect(await claimMail(db, playerId, mail!.id, nextWindow, 'catalog_sub_mail_frozen')).toMatchObject({ claimed: [{ type: 'gear', gearId: armor }] });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM player_gear WHERE player_id = ?1 AND gear_id = ?2').bind(playerId, armor).first()).toEqual({ n: 2 });
  expect(await syncSubscriptionMail(db, playerId, nextWindow)).toBe(0);
});

it('displays original task reward names when the next catalog renames their item', async () => {
  const first = structuredClone(runtime.data); first.config.tasks.daily.tasks[0]!.rewards = [{ type: 'item', itemId: xp, quantity: 1 }]; const firstId = 'rel_task_names_original'; const snapshot = await publishVariant(firstId, first);
  const { auth, playerId } = await signIn(`task-names-${crypto.randomUUID()}`); const { taskEventStatements } = await import('../src/tasks/service');
  await db.batch(await taskEventStatements(db, playerId, { eligible_wins: 999, boss_wins: 999, three_star_wins: 999, level_ups: 999 }, Date.now(), first.config.tasks, { releaseId: firstId, sha256: snapshot.sha256, data: first }));
  const renamed = structuredClone(first); const originalName = renamed.items.find((i) => i.item_id === xp)!.name_en; renamed.items.find((i) => i.item_id === xp)!.name_en = 'Later synthetic label'; const nextId = 'rel_task_names_next'; await publishVariant(nextId, renamed);
  const response = await game(`/api/v1/tasks?releaseId=${nextId}`, { headers: auth }); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ daily: { tasks: expect.arrayContaining([expect.objectContaining({ rewardNames: expect.objectContaining({ [xp]: originalName }) })]) } });
});
