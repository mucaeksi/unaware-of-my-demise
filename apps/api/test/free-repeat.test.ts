import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { playAuto } from '@uomd/combat';
import { Encounter, UnitPack } from '@uomd/content-schema';
import { campaignFiles, type TestFile } from './fixtures';
import { admin, baseEnv, entries, post, resetContent, seedCanonCatalog, signIn, upload } from './helpers';
import { submitBattle } from '../src/progress/service';
import { completeStory } from '../src/progress/story';

const db = baseEnv.DB;
let files: TestFile[];
let actions: { skillId: string; targetId?: string }[];
beforeAll(async () => {
  await seedCanonCatalog(); files = await campaignFiles();
  const read = (path: string) => JSON.parse(new TextDecoder().decode(files.find((f) => f.path === path)!.bytes));
  const played = playAuto(UnitPack.parse(read('units/unit_pack.json')), Encounter.parse(read('encounters/stage_1_1.json')));
  expect(played.battle.result?.winner).toBe('player'); actions = played.actions;
});
beforeEach(async () => {
  await resetContent(); await upload(files);
  expect((await admin('/admin/api/releases', post({ id: 'rel_0001', channel: 'dev', files: entries(files) }))).status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', post({}))).status).toBe(200);
});
const claim = (playerId: string, requestId = crypto.randomUUID()) => submitBattle(baseEnv, playerId, { releaseId: 'rel_0001', nodeId: 'stage_1_1', requestId, actions });
async function financialState(playerId: string) {
  const result: Record<string, unknown> = {};
  for (const table of ['wallets', 'player_items', 'player_stacks', 'player_gear', 'player_account', 'ledger', 'reward_grants'])
    result[table] = (await db.prepare(`SELECT * FROM ${table} WHERE player_id = ?1`).bind(playerId).all()).results;
  return result;
}

describe('zero-Ration campaign practice', () => {
  it('cannot farm the real stage_1_1 drop table with new request IDs and a known winning action sequence', async () => {
    const { playerId } = await signIn(`free-repeat-${crypto.randomUUID()}`);
    await completeStory(baseEnv, playerId, { releaseId: 'rel_0001', nodeId: 'opening_sad_scene', requestId: crypto.randomUUID() });
    const first = await claim(playerId);
    expect(first.firstClear).toBe(true); expect(first.ration.spent).toBe(0); expect(first.repeatRewardsAllowed).toBe(false);
    const before = await financialState(playerId);
    for (let n = 0; n < 5; n++) {
      const practice = await claim(playerId);
      expect(practice.firstClear).toBe(false); expect(practice.rewards).toEqual([]);
      expect(practice.ration.spent).toBe(0);
      expect(practice.repeatRewardsAllowed).toBe(false);
    }
    expect(await financialState(playerId)).toEqual(before);
    expect(await db.prepare("SELECT clears FROM player_progress WHERE player_id = ?1 AND node_id = 'stage_1_1'").bind(playerId).first()).toEqual({ clears: 6 });
  });

  it('concurrent new IDs still grant only the finite first-clear/three-star milestones', async () => {
    const { playerId } = await signIn(`free-repeat-race-${crypto.randomUUID()}`);
    await completeStory(baseEnv, playerId, { releaseId: 'rel_0001', nodeId: 'opening_sad_scene', requestId: crypto.randomUUID() });
    const bodies = await Promise.all(Array.from({ length: 12 }, () => claim(playerId)));
    const first = bodies.find((b) => b.firstClear)!;
    expect(bodies.filter((b) => b.firstClear)).toHaveLength(1);
    expect(bodies.filter((b) => !b.firstClear).every((b) => b.rewards.length === 0)).toBe(true);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM reward_grants WHERE player_id = ?1 AND reason = 'stage:stage_1_1'").bind(playerId).first()).toEqual({ n: first.rewards.length });
    expect(bodies.every((b) => b.ration.spent === 0)).toBe(true);
  });
});
