import { beforeAll, describe, expect, it } from 'vitest';
import type { RewardAttachment } from '@uomd/content-schema';
import { baseEnv, game, seedCanonCatalog, signIn } from './helpers';
import { grantStatements } from '../src/db/grants';
import { deleteAccount, exportAccount } from '../src/account/service';

const db = baseEnv.DB;
const id = () => crypto.randomUUID();
beforeAll(async () => {
  await seedCanonCatalog();
  await db.prepare("INSERT OR REPLACE INTO item_defs (item_id, name_en, kind, stack_cap) VALUES ('journal_material', 'Journal material', 'material', 10)").run();
});
const rows = async (playerId: string, reason = 'journal_test') =>
  (await db.prepare('SELECT grant_key, attachment_json, result_json FROM reward_grants WHERE player_id = ?1 AND reason = ?2 ORDER BY id').bind(playerId, reason).all<{ grant_key: string; attachment_json: string; result_json: string }>()).results
    .map((r) => ({ key: r.grant_key, attachment: JSON.parse(r.attachment_json), result: JSON.parse(r.result_json) }));
const grant = async (playerId: string, attachments: RewardAttachment[], key = id()) => db.batch(await grantStatements(db, playerId, attachments, { keyPrefix: key, reason: 'journal_test' }));

describe('atomic reward provenance', () => {
  it('records original currency, first-copy/duplicate shards and account XP from the committed batch', async () => {
    const { playerId } = await signIn(`journal-${id()}`);
    await grant(playerId, [
      { type: 'currency', currency: 'eclipse_token', amount: 37 },
      { type: 'character', itemId: 'sister_aveline' }, { type: 'character', itemId: 'sister_aveline' },
      { type: 'account_xp', amount: 19 }
    ]);
    const journal = await rows(playerId);
    expect(journal.map((r) => r.result)).toEqual([
      { amountAdded: 37, balanceAfter: 37 },
      { copiesAdded: 1, shardsAdded: 0, copiesAfter: 1, shardsAfter: 0 },
      { copiesAdded: 1, shardsAdded: 10, copiesAfter: 2, shardsAfter: 10 },
      { xpAdded: 19, xpAfter: 19 }
    ]);
  });

  it('records actual capped material amounts and changes nothing on a duplicate grant identity', async () => {
    const { playerId } = await signIn(`journal-cap-${id()}`);
    const key = id();
    await grant(playerId, [{ type: 'item', itemId: 'journal_material', quantity: 8 }]);
    await grant(playerId, [{ type: 'item', itemId: 'journal_material', quantity: 8 }], key);
    expect((await rows(playerId)).map((r) => r.result)).toEqual([{ quantityBefore: 0, quantityAdded: 8 }, { quantityBefore: 8, quantityAdded: 2 }]);
    await expect(grant(playerId, [{ type: 'item', itemId: 'journal_material', quantity: 1 }], key)).rejects.toThrow(/UNIQUE constraint failed: reward_grants/);
    expect(await db.prepare('SELECT qty FROM player_stacks WHERE player_id = ?1').bind(playerId).first()).toEqual({ qty: 10 });
    expect(await rows(playerId)).toHaveLength(2);
  });

  it('identifies each exact gear instance even when journal inserts intervene', async () => {
    const { playerId } = await signIn(`journal-gear-${id()}`);
    await grant(playerId, [{ type: 'gear', gearId: 'weapon_arming_sword_3_01' }, { type: 'gear', gearId: 'weapon_arming_sword_3_01' }]);
    const actual = (await db.prepare('SELECT id FROM player_gear WHERE player_id = ?1 ORDER BY id').bind(playerId).all<{ id: number }>()).results;
    expect((await rows(playerId)).map((r) => r.result.instanceId)).toEqual(actual.map((r) => r.id));
    expect(new Set(actual.map((r) => r.id)).size).toBe(2);
  });

  it('material provenance observes a competing grant at commit time rather than preparation time', async () => {
    const { playerId } = await signIn(`journal-stack-race-${id()}`);
    const delayed = await grantStatements(db, playerId, [{ type: 'item', itemId: 'journal_material', quantity: 8 }], { keyPrefix: id(), reason: 'journal_test' });
    await grant(playerId, [{ type: 'item', itemId: 'journal_material', quantity: 9 }]);
    await db.batch(delayed);
    expect((await rows(playerId)).map((r) => r.result)).toEqual([{ quantityBefore: 0, quantityAdded: 9 }, { quantityBefore: 9, quantityAdded: 1 }]);
  });

  it('rolls both grants and their journal back if a later statement fails', async () => {
    const { playerId } = await signIn(`journal-fault-${id()}`);
    const statements = await grantStatements(db, playerId, [{ type: 'currency', currency: 'eclipse_token', amount: 17 }, { type: 'character', itemId: 'sister_aveline' }], { keyPrefix: id(), reason: 'journal_test' });
    await expect(db.batch([...statements, db.prepare('INSERT INTO tx_guard (ok) VALUES (0)')])).rejects.toThrow(/CHECK constraint failed/);
    expect(await rows(playerId)).toHaveLength(0);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM wallets WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM player_items WHERE player_id = ?1 AND item_id = 'sister_aveline'").bind(playerId).first()).toEqual({ n: 0 });
  });

  it('rejects journal tampering, exports only this player and retains pseudonymous facts after deletion', async () => {
    const a = await signIn(`journal-owner-${id()}`); const b = await signIn(`journal-other-${id()}`);
    await grant(a.playerId, [{ type: 'character', itemId: 'sister_aveline' }]);
    await grant(b.playerId, [{ type: 'currency', currency: 'eclipse_token', amount: 99 }]);
    await expect(db.prepare("UPDATE reward_grants SET reason = 'tampered' WHERE player_id = ?1").bind(a.playerId).run()).rejects.toThrow(/append-only/);
    await expect(db.prepare('DELETE FROM reward_grants WHERE player_id = ?1').bind(a.playerId).run()).rejects.toThrow(/append-only/);
    const exported = await exportAccount(db, a.playerId) as { rewardGrants: { reason: string; player_id?: string }[]; truncated: { rewardGrants: boolean } };
    expect(exported.rewardGrants).toHaveLength(3); // two starters and this test grant
    expect(exported.truncated.rewardGrants).toBe(false);
    expect(exported.rewardGrants.every((r) => r.player_id === undefined)).toBe(true);
    const before = await rows(a.playerId); await deleteAccount(db, a.playerId, 'DELETE');
    expect(await rows(a.playerId)).toEqual(before);
    expect((await game('/api/v1/account/export', { headers: a.auth })).status).toBe(401);
  });

  it('journals starters once even under concurrent registration and never invents older provenance', async () => {
    const subject = `journal-signup-${id()}`;
    const players = await Promise.all(Array.from({ length: 5 }, () => signIn(subject)));
    expect(new Set(players.map((p) => p.playerId)).size).toBe(1);
    expect(await rows(players[0]!.playerId, 'signup')).toHaveLength(2);
    const { playerId } = await signIn(`journal-legacy-${id()}`);
    await db.prepare("INSERT INTO player_items (player_id, item_type, item_id) VALUES (?1, 'character', 'sister_aveline')").bind(playerId).run();
    expect(await rows(playerId)).toHaveLength(0); // direct/historical inventory is explicitly unproven
  });

  it('bounds the newest exported grant history and reports actual truncation', async () => {
    const { playerId } = await signIn(`journal-export-limit-${id()}`);
    await db.prepare(`WITH RECURSIVE series(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM series WHERE n < 2001)
      INSERT INTO reward_grants (player_id, grant_key, reason, attachment_json, result_json)
      SELECT ?1, 'export-fixture:' || ?1 || ':' || n, 'fixture', '{"type":"account_xp","amount":1}', '{"xpAdded":1}' FROM series`).bind(playerId).run();
    const exported = await exportAccount(db, playerId) as { rewardGrants: { id: number }[]; truncated: { rewardGrants: boolean } };
    expect(exported.rewardGrants).toHaveLength(2000); expect(exported.truncated.rewardGrants).toBe(true);
    expect(exported.rewardGrants[0]!.id).toBeGreaterThan(exported.rewardGrants.at(-1)!.id);
  });
});
