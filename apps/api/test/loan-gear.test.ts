import { beforeAll, expect, it } from 'vitest';
import { UnitPack, type StoryLoanEquipment } from '@uomd/content-schema';
import type { ProgressionConfig } from '@uomd/economy';
import { baseEnv, seedCanonCatalog } from './helpers';
import { baseFiles } from './fixtures';
import { loanGear } from '../src/progress/loan-gear';
import { loadProgressionConfig } from '../src/progression/characters';

const db = baseEnv.DB;
let template: StoryLoanEquipment; let cfg: ProgressionConfig;
let character: { weapon_type: string; role: string };
beforeAll(async () => {
  await seedCanonCatalog(); cfg = await loadProgressionConfig(db);
  const files = await baseFiles();
  template = UnitPack.parse(JSON.parse(new TextDecoder().decode(files.find((file) => file.path === 'units/unit_pack.json')!.bytes))).rules.story_loan_equipment!;
  expect(template).toMatchObject({ rarity: 3, level: 1, ascension: 0 });
  character = (await db.prepare("SELECT weapon_type, role FROM characters WHERE id = 'brin_alder'").first<typeof character>())!;
});
const gear = (stage = '1-2', value = template) => loanGear(db, 'brin_alder', character.weapon_type, character.role, stage, cfg, value);

it('produces deterministic armor/weapon/two-piece bonuses without minting or consuming inventory', async () => {
  const before = await db.batch([db.prepare('SELECT COUNT(*) AS n FROM player_gear'), db.prepare('SELECT COUNT(*) AS n FROM player_stacks')]);
  const first = await gear(); expect(await gear()).toEqual(first);
  expect(first.flat.hp).toBeGreaterThan(0); expect(first.flat.atk).toBeGreaterThan(0); expect(first.pct.hp).toBeGreaterThanOrEqual(0.05);
  expect(await gear('1-3')).not.toEqual(first);
  const after = await db.batch([db.prepare('SELECT COUNT(*) AS n FROM player_gear'), db.prepare('SELECT COUNT(*) AS n FROM player_stacks')]);
  expect(after.map((batch) => batch.results)).toEqual(before.map((batch) => batch.results));
});

it('fails closed if declared loan equipment is missing', async () => {
  await expect(gear('1-2', { ...template, armor_id: 'nonexistent_loan_armor' })).rejects.toMatchObject({ code: 'loan_equipment_missing' });
});

it('chooses the lowest matching generic weapon and excludes signature ownership', async () => {
  for (const [id, owner, attack] of [['aaa_loan_signature', 'brin_alder', 999], ['aab_loan_generic', null, 123]] as const) {
    await db.prepare(`INSERT INTO gear_defs (gear_id, slot, name_en, rarity, family, owner_character_id, level_cap, base_json)
      VALUES (?1, 'weapon', ?1, 3, ?2, ?3, 20, ?4)`).bind(id, character.weapon_type, owner, JSON.stringify({ atk: attack })).run();
  }
  try { const result = await gear(); expect(result.flat.atk).toBeGreaterThanOrEqual(123); expect(result.flat.atk).toBeLessThan(125); }
  finally { await db.prepare("DELETE FROM gear_defs WHERE gear_id IN ('aaa_loan_signature', 'aab_loan_generic')").run(); }
});
