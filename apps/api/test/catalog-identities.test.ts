import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeAll, expect, it } from 'vitest';

const e = env as unknown as { MIGRATION_DB: D1Database; MIGRATION_EMPTY_DB: D1Database; TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1] };
const db = e.MIGRATION_DB;
const tables = ['player_stacks', 'player_chars', 'player_gear', 'reward_grants', 'progression_requests'];
let before: unknown[];
beforeAll(async () => {
  await applyD1Migrations(db, e.TEST_MIGRATIONS.slice(0, -1));
  await db.batch([
    db.prepare("INSERT INTO players (id, google_sub) VALUES ('migration_player', 'migration_subject')"),
    db.prepare("INSERT INTO characters (id, name_en, rarity, element, role, age, acquisition, base_hp, base_atk, base_def, base_spd) VALUES ('migration_hero','Hero',4,'Stone','tank',20,'gacha',10,2,2,4)"),
    db.prepare("INSERT INTO item_defs (item_id, name_en, kind) VALUES ('migration_item','Item','character_xp')"),
    db.prepare("INSERT INTO gear_defs (gear_id, name_en, slot, rarity, family) VALUES ('migration_gear','Gear','armor',3,'padded')"),
    db.prepare("INSERT INTO player_stacks VALUES ('migration_player','migration_item',42)"),
    db.prepare("INSERT INTO player_chars VALUES ('migration_player','migration_hero',7,23,2,'{\"migration_skill\":3}',9)"),
    db.prepare("INSERT INTO player_gear (id, player_id, gear_id, slot, level, xp, ascension, equipped_by, stats_json, locked, version, created_at) VALUES (9,'migration_player','migration_gear','armor',5,17,1,'migration_hero','{\"kept\":true}',1,8,'2026-10-01T00:00:00.000Z')"),
    db.prepare("INSERT INTO player_gear (id, player_id, gear_id, slot) VALUES (100,'migration_player','migration_gear','armor')"),
    db.prepare('DELETE FROM player_gear WHERE id = 100'),
    db.prepare("INSERT INTO reward_grants (player_id, grant_key, reason, attachment_json, result_json) VALUES ('migration_player','kept','fixture','{}','{\"instanceId\":100}')"),
    db.prepare("INSERT INTO progression_requests (player_id, request_id, kind, input_json, result_json) VALUES ('migration_player','kept_request','fixture','{}','{\"kept\":true}')")
  ]);
  before = (await db.batch(tables.map((t) => db.prepare(`SELECT * FROM ${t}`)))).map((r) => r.results);
  await applyD1Migrations(db, e.TEST_MIGRATIONS);
});
it('preserves every player field, journal result, index and deleted-instance high-water mark', async () => {
  expect((await db.batch(tables.map((t) => db.prepare(`SELECT * FROM ${t}`)))).map((r) => r.results)).toEqual(before);
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  expect(await db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'player_gear'").first()).toEqual({ seq: 100 });
  const created = await db.prepare("INSERT INTO player_gear (player_id, gear_id, slot) VALUES ('migration_player','migration_gear','armor')").run();
  expect(created.meta.last_row_id).toBeGreaterThan(100);
  await expect(db.prepare("INSERT INTO player_gear (player_id, gear_id, slot, equipped_by) VALUES ('migration_player','migration_gear','armor','migration_hero')").run()).rejects.toThrow(/UNIQUE constraint failed/);
});
it('retains nonnegative balances and foreign keys to existing players and registered identities', async () => {
  for (const query of [
    "INSERT INTO player_stacks VALUES ('migration_player','missing_identity',1)",
    "INSERT INTO player_chars (player_id, character_id) VALUES ('missing_player','migration_hero')",
    "INSERT INTO player_gear (player_id, gear_id, slot) VALUES ('migration_player','missing_gear','weapon')",
    "UPDATE player_stacks SET qty = -1 WHERE player_id = 'migration_player'"
  ]) await expect(db.prepare(query).run()).rejects.toThrow(/constraint failed/);
});
it('keeps legacy seed/admin inserts compatible and identities immutable after definition deletion', async () => {
  await db.prepare("INSERT INTO item_defs (item_id, name_en, kind) VALUES ('new_authoring_identity','Item','character_xp')").run();
  expect(await db.prepare("SELECT id FROM item_identities WHERE id = 'new_authoring_identity'").first()).toEqual({ id: 'new_authoring_identity' });
  await db.prepare("DELETE FROM item_defs WHERE item_id = 'new_authoring_identity'").run();
  for (const table of ['character_identities', 'item_identities', 'gear_identities']) {
    await expect(db.prepare(`UPDATE ${table} SET id = 'renamed'`).run()).rejects.toThrow(/identities are immutable/);
    await expect(db.prepare(`DELETE FROM ${table}`).run()).rejects.toThrow(/identities are retained/);
  }
});

it('preserves a deleted-instance high-water mark even with no surviving gear', async () => {
  const empty = e.MIGRATION_EMPTY_DB;
  await applyD1Migrations(empty, e.TEST_MIGRATIONS.slice(0, -1));
  await empty.batch([
    empty.prepare("INSERT INTO players (id) VALUES ('empty_player')"),
    empty.prepare("INSERT INTO gear_defs (gear_id, name_en, slot, rarity, family) VALUES ('empty_gear','Gear','armor',3,'padded')"),
    empty.prepare("INSERT INTO player_gear (id, player_id, gear_id, slot) VALUES (200,'empty_player','empty_gear','armor')"),
    empty.prepare('DELETE FROM player_gear')
  ]);
  await applyD1Migrations(empty, e.TEST_MIGRATIONS);
  const inserted = await empty.prepare("INSERT INTO player_gear (player_id, gear_id, slot) VALUES ('empty_player','empty_gear','armor')").run();
  expect(inserted.meta.last_row_id).toBeGreaterThan(200);
  expect((await empty.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
});
