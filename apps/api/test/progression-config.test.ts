import { beforeAll, expect, it } from 'vitest';
import { BattleParty } from '@uomd/content-schema';
import type { ProgressionConfig } from '@uomd/economy';
import { admin, baseEnv, game, seedCanonCatalog, signIn } from './helpers';

beforeAll(seedCanonCatalog);
const read = async () => {
  const response = await admin('/admin/api/config/progression'); expect(response.status).toBe(200);
  return await response.json() as { version: number; value: ProgressionConfig };
};
const save = (value: ProgressionConfig, expectedVersion: number) => admin('/admin/api/config/progression', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value, expectedVersion })
});

it('invalid progression never changes config; a supported update retains CAS and battle admission', async () => {
  const before = await read();
  for (const mutate of [
    (config: ProgressionConfig) => { config.character.levelCap = 200; },
    (config: ProgressionConfig) => { config.character.skills.maxRank.basic = 10; },
    (config: ProgressionConfig) => { config.character.xp = { a: 0, b: 0, c: 0 }; },
    (config: ProgressionConfig) => { config.character.skills.feePerRank = []; }
  ]) {
    const value = structuredClone(before.value); mutate(value);
    expect((await save(value, before.version)).status).toBe(422); expect(await read()).toEqual(before);
  }
  expect(BattleParty.safeParse([{ unit_id: 'mahmut', level: before.value.character.levelCap, slot: 0, row: 'front',
    skill_ranks: { mahmut_basic_oathless_cut: before.value.character.skills.maxRank.basic } }]).success).toBe(true);
  expect((await save(before.value, before.version)).status).toBe(200);
  expect((await save(before.value, before.version)).status).toBe(409);
  expect((await read()).version).toBe(before.version + 1);
});

it('unknown ascension, skill and equipment material identities are rejected before storing config', async () => {
  const before = await read();
  for (const mutate of [
    (config: ProgressionConfig) => { config.equipment.xpItemId = 'nonexistent_material'; },
    (config: ProgressionConfig) => { config.character.skills.itemBySkillType.active = 'nonexistent_material'; },
    (config: ProgressionConfig) => { config.character.ascension[1]!.items[0]!.itemId = 'nonexistent_material'; }
  ]) {
    const value = structuredClone(before.value); mutate(value);
    expect((await save(value, before.version)).status).toBe(422); expect(await read()).toEqual(before);
  }
});

it('an unsupported stored config fails closed without replacing its data with defaults', async () => {
  const own = await signIn(crypto.randomUUID()); const before = await read();
  const invalid = structuredClone(before.value); invalid.character.levelCap = 200;
  await baseEnv.DB.prepare("UPDATE game_config SET value_json = ?1 WHERE key = 'progression'").bind(JSON.stringify(invalid)).run();
  try {
    const response = await game('/api/v1/characters/mine', { headers: own.auth });
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ error: 'invalid_progression_config' });
    expect((await read()).value).toEqual(invalid);
  } finally {
    await baseEnv.DB.prepare("UPDATE game_config SET value_json = ?1 WHERE key = 'progression'").bind(JSON.stringify(before.value)).run();
  }
});
