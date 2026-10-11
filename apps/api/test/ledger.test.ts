import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyLedger } from '../src/db/ledger';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let n = 0;
let player: string;

beforeEach(async () => {
  player = `p_${++n}_${Math.random().toString(36).slice(2, 8)}`;
  await db().prepare('INSERT INTO players (id) VALUES (?1)').bind(player).run();
});

const credit = (key: string, delta: number) => applyLedger(db(), { playerId: player, currency: 'eclipse_token', delta, reason: 'test', idempotencyKey: key });

describe('D1 ledger', () => {
  it('credits, debits and records immutable rows', async () => {
    expect(await credit('a', 100)).toEqual({ applied: true, balance: 100 });
    expect(await credit('b', -30)).toEqual({ applied: true, balance: 70 });
    const rows = await db().prepare('SELECT delta FROM ledger WHERE player_id = ?1 ORDER BY id').bind(player).all<{ delta: number }>();
    expect(rows.results.map((r) => r.delta)).toEqual([100, -30]);
    await expect(db().prepare('UPDATE ledger SET delta = 999 WHERE player_id = ?1').bind(player).run()).rejects.toThrow(/append-only/);
    await expect(db().prepare('DELETE FROM ledger WHERE player_id = ?1').bind(player).run()).rejects.toThrow(/append-only/);
  });

  it('rejects an overdraft without leaving a ledger row or a changed balance', async () => {
    await credit('seed', 10);
    const r = await credit('too_much', -11);
    expect(r).toEqual({ applied: false, reason: 'insufficient_funds', balance: 10 });
    const count = await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE idempotency_key = ?1').bind('too_much').first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it('replaying an idempotency key never applies twice; a conflicting reuse is flagged', async () => {
    expect((await credit('once', 50)).applied).toBe(true);
    expect(await credit('once', 50)).toEqual({ applied: false, reason: 'duplicate', balance: 50 });
    expect(await credit('once', 60)).toEqual({ applied: false, reason: 'idempotency_conflict', balance: 50 });
  });

  it('50 concurrent debits against a balance of 20 let exactly 20 through and never overdraw', async () => {
    await credit('fund', 20);
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => credit(`spend_${i}`, -1)));
    expect(results.filter((r) => r.applied)).toHaveLength(20);
    expect(results.filter((r) => !r.applied && r.reason === 'insufficient_funds')).toHaveLength(30);
    const w = await db().prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(player).first<{ balance: number }>();
    expect(w?.balance).toBe(0);
    const sum = await db().prepare('SELECT SUM(delta) AS s FROM ledger WHERE player_id = ?1').bind(player).first<{ s: number }>();
    expect(sum?.s).toBe(0); // ledger always reconciles with the wallet
  });

  it('20 concurrent requests with the SAME idempotency key apply exactly once', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => credit('same_key', 7)));
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(results.filter((r) => !r.applied && r.reason === 'duplicate')).toHaveLength(19);
    const w = await db().prepare('SELECT balance FROM wallets WHERE player_id = ?1').bind(player).first<{ balance: number }>();
    expect(w?.balance).toBe(7);
  });

  it('rejects zero and non-integer deltas before touching the database', async () => {
    await expect(credit('z', 0)).rejects.toThrow();
    await expect(credit('f', 1.5)).rejects.toThrow();
  });
});
