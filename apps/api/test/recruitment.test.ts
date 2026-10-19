import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Battle, playAuto, type PlayerAction } from '@uomd/combat';
import { BattleParty, ChapterIndex, Encounter, UnitPack } from '@uomd/content-schema';
import { CANON } from '@uomd/economy';
import { sha256Hex, canonicalJson } from '@uomd/shared';
import { grantStatements } from '../src/db/grants';
import { selectRecruit } from '../src/recruitment/service';
import { admin, baseEnv, entries, game, post, resetContent, seedCanonCatalog, signIn, upload } from './helpers';
import { campaignFiles, type TestFile } from './fixtures';
import canonicalCharacters from '../../../narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/characters_part1.json';

const db = baseEnv.DB; const itemId = 'first_oath_invitation'; const path = `/api/v1/recruitment/${itemId}`;
const rid = () => crypto.randomUUID().replaceAll('-', '');
let files: TestFile[]; let pack: UnitPack; let index: ChapterIndex;
const read = (path: string) => JSON.parse(new TextDecoder().decode(files.find((file) => file.path === path)!.bytes));
beforeAll(async () => {
  await seedCanonCatalog(); files = await campaignFiles(); pack = UnitPack.parse(read('units/unit_pack.json')); index = ChapterIndex.parse(read('chapters/chapter_index.json'));
  // This chapter check uses real canonical stats, not helpers.ts's generic ten-HP catalog.
  for (const character of canonicalCharacters.characters) {
    const a = pack.units.find((u) => u.unit_id === character.character_id)!.attributes!; const g = a.growth ?? {};
    await db.prepare(`UPDATE characters SET name_en = ?2, element = ?3, role = ?4, formation_affinity = ?5, power_stat = ?6,
      base_str = ?7, base_int = ?8, base_vit = ?9, base_agi = ?10, growth_str = ?11, growth_int = ?12, growth_vit = ?13, growth_agi = ?14, armor = ?15 WHERE id = ?1`)
      .bind(character.character_id, character.name_en, character.element, character.combat_role, character.formation_affinity, a.power,
        a.base.str, a.base.int, a.base.vit, a.base.agi, g.str ?? 0, g.int ?? 0, g.vit ?? 0, g.agi ?? 0, a.armor ?? 0).run();
  }
});
beforeEach(async () => {
  await resetContent(); await upload(files);
  expect((await admin('/admin/api/releases', post({ id: 'rel_0001', channel: 'dev', files: entries(files) }))).status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', post({}))).status).toBe(200);
});
const input = (characterId = 'tilda_fen', requestId = rid()) => ({ releaseId: 'rel_0001', characterId, requestId });
const select = (auth: Record<string, string>, body = input()) => game(path, post(body, auth));
const options = (auth: Record<string, string>) => game('/api/v1/recruitment/selectors?releaseId=rel_0001', { headers: auth });
async function story(auth: Record<string, string>, nodeId: string) {
  expect((await game('/api/v1/progress/story', post({ releaseId: 'rel_0001', nodeId, requestId: rid() }, auth))).status).toBe(200);
}
async function win(auth: Record<string, string>, nodeId: string) {
  const node = index.chapters.flatMap((chapter) => chapter.nodes).find((node) => node.node_id === nodeId)!;
  const encounter = Encounter.parse(read(node.encounter!));
  const start = await game('/api/v1/progress/battle/start', post({ releaseId: 'rel_0001', nodeId }, auth)); expect(start.status).toBe(200);
  const session = await start.json() as { sessionId: string; party: unknown };
  let played = playAuto(pack, encounter, session.party ? BattleParty.parse(session.party) : undefined);
  if (played.battle.result?.winner !== 'player') {
    // Manual active/ultimate choices are valid even when the conservative Auto smoke loses.
    const battle = Battle.create(pack, encounter, session.party ? BattleParty.parse(session.party) : undefined); const actions: PlayerAction[] = [];
    battle.advance();
    while (!battle.result && actions.length < 600) {
      const prompt = battle.prompt()!; const available = prompt.options.filter((option) => option.available);
      const option = available.find((option) => option.type === 'ultimate') ?? available.find((option) => option.type === 'active') ?? available[0]!;
      const target = [...option.legalTargets].sort((a, b) => battle.unit(a).hp / battle.unit(a).maxHp - battle.unit(b).hp / battle.unit(b).maxHp)[0];
      const action = { skillId: option.skillId, ...(option.needsTarget ? { targetId: target! } : {}) };
      actions.push(action); battle.act(action);
    }
    played = { battle, actions };
  }
  expect(played.battle.result?.winner, nodeId).toBe('player');
  const claimed = await game('/api/v1/progress/battle', post({ releaseId: 'rel_0001', nodeId, sessionId: session.sessionId, requestId: rid(), actions: played.actions }, auth));
  expect(claimed.status).toBe(200); return claimed.json();
}
async function ready(readOath = true) {
  const actor = await signIn(`invitation-${rid()}`);
  await story(actor.auth, 'opening_sad_scene'); await win(actor.auth, 'stage_1_1'); await win(actor.auth, 'stage_1_2');
  if (readOath) await story(actor.auth, 'ch1_first_oath');
  return actor;
}

describe('canonical invitation spending', () => {
  it('continues the first chapter with the selected permanent companion and canonical loans without a wish', async () => {
    const actor = await ready(); expect((await select(actor.auth, input('iona_mist'))).status).toBe(200);
    await win(actor.auth, 'stage_1_3'); await win(actor.auth, 'stage_1_4'); await win(actor.auth, 'stage_1_5'); await story(actor.auth, 'ch1_camp');
    expect(await db.prepare('SELECT COUNT(*) AS n FROM gacha_requests WHERE player_id = ?1').bind(actor.playerId).first()).toEqual({ n: 0 });
    expect((await db.prepare("SELECT item_id FROM player_items WHERE player_id = ?1 AND item_type = 'character' ORDER BY item_id").bind(actor.playerId).all()).results).toEqual(['brin_alder', 'fadyme', 'iona_mist', 'mahmut', 'nixie_vale'].map((item_id) => ({ item_id })));
    expect(await db.prepare("SELECT COUNT(*) AS n FROM player_progress WHERE player_id = ?1 AND node_id IN ('opening_sad_scene','stage_1_1','stage_1_2','ch1_first_oath','stage_1_3','stage_1_4','stage_1_5','ch1_camp')").bind(actor.playerId).first()).toEqual({ n: 8 });
  });
  it('exposes the seven choices only after the authored scene and consumes one earned invitation with its exact original grant', async () => {
    const actor = await ready(false);
    expect(await (await options(actor.auth)).json()).toMatchObject({ selectors: [] });
    expect((await select(actor.auth)).status).toBe(403);
    await story(actor.auth, 'ch1_first_oath');
    const listed = await (await options(actor.auth)).json() as { selectors: { choices: { id: string }[]; quantity: number }[] };
    expect(listed.selectors[0]!.choices.map((choice) => choice.id)).toEqual(index.recruit_selectors![0]!.choices);
    expect(listed.selectors[0]!.quantity).toBe(1);
    const wallet = (await db.prepare('SELECT * FROM wallets WHERE player_id = ?1').bind(actor.playerId).all()).results;
    const ration = await db.prepare('SELECT * FROM player_ration WHERE player_id = ?1').bind(actor.playerId).first();
    const body = input(); const response = await select(actor.auth, body); expect(response.status).toBe(200);
    const result = await response.json() as Record<string, unknown>; expect(result).toMatchObject({ ...body, itemId, consumed: 1, grant: { copiesAdded: 1, copiesAfter: 1, shardsAdded: 0, shardsAfter: 0 }, replayed: false });
    expect(await (await select(actor.auth, body)).json()).toEqual({ ...result, replayed: true });
    expect((await select(actor.auth, { ...body, characterId: 'iona_mist' })).status).toBe(409);
    expect((await select(actor.auth, input('iona_mist'))).status).toBe(402);
    expect(await db.prepare('SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?2').bind(actor.playerId, itemId).first()).toEqual({ qty: 0 });
    expect((await db.prepare('SELECT * FROM wallets WHERE player_id = ?1').bind(actor.playerId).all()).results).toEqual(wallet);
    expect(await db.prepare('SELECT * FROM player_ration WHERE player_id = ?1').bind(actor.playerId).first()).toEqual(ration);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM gacha_requests WHERE player_id = ?1').bind(actor.playerId).first()).toEqual({ n: 0 });
  });
  it('rejects unlisted companions and unknown invitations without spending the stack', async () => {
    const actor = await ready();
    expect((await select(actor.auth, input('mahmut'))).status).toBe(422);
    expect((await game('/api/v1/recruitment/other_invitation', post(input(), actor.auth))).status).toBe(404);
    expect(await db.prepare('SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?2').bind(actor.playerId, itemId).first()).toEqual({ qty: 1 });
  });
  it('two concurrent choices compete for one invitation and grant only the committed choice', async () => {
    const actor = await ready(); const responses = await Promise.all([select(actor.auth, input()), select(actor.auth, input('iona_mist'))]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 402]);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM reward_grants WHERE player_id = ?1 AND reason = 'selector:first_oath_invitation'").bind(actor.playerId).first()).toEqual({ n: 1 });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM progression_requests WHERE player_id = ?1 AND kind = 'recruit_selector:first_oath_invitation'").bind(actor.playerId).first()).toEqual({ n: 1 });
  });
  it('uses shared duplicate grants and freezes their actual classification for recovery', async () => {
    const actor = await ready();
    await db.batch(await grantStatements(db, actor.playerId, [{ type: 'character', itemId: 'tilda_fen' }], { keyPrefix: rid(), reason: 'fixture:prior character grant' }));
    const body = input(); expect(await (await select(actor.auth, body)).json()).toMatchObject({ grant: { copiesAdded: 1, copiesAfter: 2, shardsAdded: CANON.duplicateShards[4], shardsAfter: CANON.duplicateShards[4] } });
    await db.batch(await grantStatements(db, actor.playerId, [{ type: 'character', itemId: 'tilda_fen' }], { keyPrefix: rid(), reason: 'fixture:later character grant' }));
    const status = await game(`/api/v1/operations/${body.requestId}?path=${encodeURIComponent(path)}`, { headers: actor.auth });
    expect(await status.json()).toMatchObject({ inputHash: await sha256Hex(canonicalJson(body)), binding: 'exact', state: 'confirmed', result: { grant: { copiesAfter: 2, shardsAfter: CANON.duplicateShards[4] } } });
  });
  it('recovers the original choice after a killed release while another account sees no result', async () => {
    const actor = await ready(); const body = input(); expect((await select(actor.auth, body)).status).toBe(200);
    expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    expect((await select(actor.auth, body)).status).toBe(200);
    const other = await signIn(`invitation-other-${rid()}`);
    expect(await (await game(`/api/v1/operations/${body.requestId}?path=${encodeURIComponent(path)}`, { headers: other.auth })).json()).toMatchObject({ state: 'unknown', result: null });
    expect((await select(actor.auth, input())).status).toBe(409);
  });
  it('rolls item, character and grant journal back if the original-result journal fails', async () => {
    const actor = await ready();
    await db.prepare("CREATE TRIGGER selector_journal_fault BEFORE INSERT ON progression_requests WHEN NEW.kind LIKE 'recruit_selector:%' BEGIN SELECT RAISE(ABORT, 'fixture journal failure'); END").run();
    try {
      expect((await select(actor.auth)).status).toBe(500);
      expect(await db.prepare('SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?2').bind(actor.playerId, itemId).first()).toEqual({ qty: 1 });
      expect(await db.prepare("SELECT COUNT(*) AS n FROM player_items WHERE player_id = ?1 AND item_id = 'tilda_fen'").bind(actor.playerId).first()).toEqual({ n: 0 });
      expect(await db.prepare("SELECT COUNT(*) AS n FROM reward_grants WHERE player_id = ?1 AND reason = 'selector:first_oath_invitation'").bind(actor.playerId).first()).toEqual({ n: 0 });
    } finally { await db.prepare('DROP TRIGGER selector_journal_fault').run(); }
  });
  it.each(['account', 'release', 'story gate', 'item', 'character'] as const)('fences a %s change at transaction time', async (race) => {
    const actor = await ready(); const body = input(); let enter!: () => void; let resume!: () => void;
    const entered = new Promise<void>((resolve) => { enter = resolve; }); const gate = new Promise<void>((resolve) => { resume = resolve; });
    const database = new Proxy(db, { get(target, key) { if (key === 'batch') return async (statements: D1PreparedStatement[]) => { enter(); await gate; return target.batch(statements); }; const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
    const attempt = selectRecruit({ ...baseEnv, DB: database }, actor.playerId, itemId, body); await entered;
    if (race === 'account') await db.prepare("UPDATE players SET status = 'deleted' WHERE id = ?1").bind(actor.playerId).run();
    if (race === 'release') expect((await admin('/admin/api/channels/dev/kill', post({ releaseId: 'rel_0001' }))).status).toBe(200);
    if (race === 'story gate') await db.prepare("DELETE FROM player_progress WHERE player_id = ?1 AND node_id = 'ch1_first_oath'").bind(actor.playerId).run();
    if (race === 'item') await db.prepare("UPDATE item_defs SET status = 'retired' WHERE item_id = ?1").bind(itemId).run();
    if (race === 'character') await db.prepare("UPDATE characters SET status = 'retired' WHERE id = 'tilda_fen'").run();
    resume();
    try { await expect(attempt).rejects.toMatchObject({ code: 'selector_state_changed' }); }
    finally {
      if (race === 'item') await db.prepare("UPDATE item_defs SET status = 'active' WHERE item_id = ?1").bind(itemId).run();
      if (race === 'character') await db.prepare("UPDATE characters SET status = 'active' WHERE id = 'tilda_fen'").run();
    }
    expect(await db.prepare('SELECT qty FROM player_stacks WHERE player_id = ?1 AND item_id = ?2').bind(actor.playerId, itemId).first()).toEqual({ qty: 1 });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM progression_requests WHERE player_id = ?1 AND kind LIKE 'recruit_selector:%'").bind(actor.playerId).first()).toEqual({ n: 0 });
  });
});
