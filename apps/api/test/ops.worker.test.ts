import { env } from 'cloudflare:workers';
import { Decrypter, generateX25519Identity, identityToRecipient } from 'age-encryption';
import { describe, expect, it } from 'vitest';
import { applyLedger } from '../src/db/ledger';
import { runBackup } from '../src/ops/backup';
import { dumpDatabase, sqlLiteral } from '../src/ops/dump';
import type { OpsEnv } from '../src/ops/env';
import { runHealth } from '../src/ops/health';
import { CRON_BACKUP, CRON_HEALTH, backupIsOverdue, runScheduled } from '../src/ops';
import { signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;

function fakeBucket(): { put: (k: string, v: unknown) => Promise<void>; objects: Map<string, Uint8Array | string> } {
  const objects = new Map<string, Uint8Array | string>();
  return { objects, put: async (k, v) => void objects.set(k, v as Uint8Array | string) };
}

describe('uomd-ops: logical dump', () => {
  it('quotes values safely', () => {
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(42)).toBe('42');
    expect(sqlLiteral("it's")).toBe("'it''s'");
    expect(sqlLiteral([0, 255, 16])).toBe("X'00ff10'");
    expect(sqlLiteral(Number.NaN)).toBe('NULL');
  });

  it('dumps schema, data, then indexes and triggers; counts match; the ledger reconciles', async () => {
    const { playerId } = await signIn(`sub-dump-${Math.random().toString(36).slice(2)}`);
    await applyLedger(db(), { playerId, currency: 'eclipse_token', delta: 321, reason: "o'brien", idempotencyKey: `dump:${playerId}` });
    const d = await dumpDatabase(db());
    expect(d.atomic).toBe(true);
    expect(d.reconciled).toBe(true);
    expect(d.tables.players).toBeGreaterThanOrEqual(1);
    expect(d.tables.ledger).toBeGreaterThanOrEqual(1);
    expect(d.sql).toContain('CREATE TABLE players');
    expect(d.sql).toContain("'o''brien'");
    const lastInsert = d.sql.lastIndexOf('INSERT INTO');
    expect(d.sql.indexOf('CREATE TRIGGER ledger_no_update')).toBeGreaterThan(lastInsert); // append-only triggers must not block the restore
    expect(d.sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });
});

const fetcher = (status: number): Fetcher => ({ fetch: async () => new Response(JSON.stringify({ ok: true }), { status }) }) as unknown as Fetcher;
const down = { fetch: async () => { throw new Error('down'); } } as unknown as Fetcher;

describe('uomd-ops: encrypted backup and health', () => {
  it('encrypts to the public key only; the owner can decrypt; a manifest is stored', async () => {
    await signIn(`sub-bk-${Math.random().toString(36).slice(2)}`);
    const id = await generateX25519Identity();
    const bucket = fakeBucket();
    const ops = { DB: db(), BACKUPS: bucket as unknown as R2Bucket, AGE_RECIPIENT: await identityToRecipient(id), TARGET: 'test', GAME: fetcher(200), ADMIN: fetcher(401) } satisfies OpsEnv;
    const r = await runBackup(ops, new Date('2026-10-11T03:17:00Z'));
    expect(r.key).toBe('d1/test/d1-test-20261011T031700Z.sql.age');
    const cipher = bucket.objects.get(r.key) as Uint8Array;
    expect(new TextDecoder().decode(cipher.slice(0, 20))).toContain('age-encryption.org');
    const d = new Decrypter();
    d.addIdentity(id);
    const plain = await d.decrypt(cipher, 'text');
    expect(plain).toContain('CREATE TABLE players');
    const manifest = JSON.parse(bucket.objects.get(`${r.key}.manifest.json`) as string) as { reconciled: boolean; tables: Record<string, number> };
    expect(manifest.reconciled).toBe(true);
    expect(manifest.tables.players).toBeGreaterThan(0);
    await expect(runBackup({ ...ops, AGE_RECIPIENT: 'not-a-key' })).rejects.toThrow(/age public key/);
  });

  it('a wallet that does not match the ledger makes the backup fail loudly', async () => {
    const { playerId } = await signIn(`sub-bad-${Math.random().toString(36).slice(2)}`);
    await db().prepare("INSERT INTO wallets (player_id, currency, balance) VALUES (?1, 'eclipse_token', 5) ON CONFLICT (player_id, currency) DO UPDATE SET balance = 5").bind(playerId).run();
    await expect(runBackup({ DB: db(), BACKUPS: fakeBucket() as unknown as R2Bucket, AGE_RECIPIENT: await identityToRecipient(await generateX25519Identity()), TARGET: 'test', GAME: fetcher(200), ADMIN: fetcher(401) })).rejects.toThrow(/reconcile/);
    await db().prepare('DELETE FROM wallets WHERE player_id = ?1').bind(playerId).run();
  });

  it('health reports unreachable targets as not ok and the schedule records a row', async () => {
    const h = await runHealth({ DB: db(), BACKUPS: fakeBucket() as unknown as R2Bucket, AGE_RECIPIENT: '', TARGET: 'test', GAME: down, ADMIN: down });
    expect(h.ok).toBe(false);
    expect(h.checks.find((c) => c.name === 'game')?.ok).toBe(false);
    const healthy = await runHealth({ DB: db(), BACKUPS: fakeBucket() as unknown as R2Bucket, AGE_RECIPIENT: '', TARGET: 'test', GAME: fetcher(200), ADMIN: fetcher(401) });
    expect(healthy.checks.filter((c) => c.name !== 'backup_fresh').every((c) => c.ok)).toBe(true);
    const open = await runHealth({ DB: db(), BACKUPS: fakeBucket() as unknown as R2Bucket, AGE_RECIPIENT: '', TARGET: 'test', GAME: fetcher(200), ADMIN: fetcher(200) });
    expect(open.checks.find((c) => c.name === 'admin_protected')?.ok).toBe(false);
    expect(CRON_BACKUP).toBe('17 3 * * *');
  });

  it('a health tick records its probe and takes the missed backup itself, but not again within the cooldown', async () => {
    await db().prepare('DELETE FROM ops_runs').run();
    const bucket = fakeBucket();
    const env = { DB: db(), BACKUPS: bucket as unknown as R2Bucket, AGE_RECIPIENT: await identityToRecipient(await generateX25519Identity()), TARGET: 'test', GAME: down, ADMIN: down } satisfies OpsEnv;
    expect(await backupIsOverdue(env)).toBe(true);
    await runScheduled(CRON_HEALTH, env);
    const health = await db().prepare("SELECT ok FROM ops_runs WHERE kind = 'health' ORDER BY id DESC LIMIT 1").first<{ ok: number }>();
    expect(health?.ok).toBe(0);
    const backups = await db().prepare("SELECT ok FROM ops_runs WHERE kind = 'backup'").all<{ ok: number }>();
    expect(backups.results).toEqual([{ ok: 1 }]);
    expect(bucket.objects.size).toBeGreaterThanOrEqual(2); // dump + manifest
    await runScheduled(CRON_HEALTH, env);
    expect((await db().prepare("SELECT COUNT(*) AS n FROM ops_runs WHERE kind = 'backup'").first<{ n: number }>())?.n).toBe(1);
    expect(await backupIsOverdue(env, new Date(Date.now() + 31 * 3_600_000))).toBe(true);
    expect(await backupIsOverdue(env, new Date(Date.now() + 5 * 3_600_000))).toBe(false);
  });

  it('a failing catch-up backup is recorded and not retried on every tick', async () => {
    await db().prepare('DELETE FROM ops_runs').run();
    const env = { DB: db(), BACKUPS: fakeBucket() as unknown as R2Bucket, AGE_RECIPIENT: 'not-a-key', TARGET: 'test', GAME: fetcher(200), ADMIN: fetcher(401) } satisfies OpsEnv;
    await expect(runScheduled(CRON_HEALTH, env)).rejects.toThrow();
    expect(await backupIsOverdue(env)).toBe(false);
    await db().prepare('DELETE FROM ops_runs').run();
  });
});

describe('Control Center operations feed', () => {
  it('lists backups and health probes recorded by the cron Worker (viewer role)', async () => {
    await db().prepare("INSERT INTO ops_runs (kind, ok, detail_json) VALUES ('backup', 1, '{\"key\":\"d1/test/x.sql.age\",\"bytes\":123}'), ('health', 0, '{\"checks\":[{\"name\":\"game\",\"ok\":false,\"detail\":\"HTTP 503\"}]}')").run();
    const { admin } = await import('./helpers');
    const res = await admin('/admin/api/ops');
    expect(res.status).toBe(200);
    const j = (await res.json()) as { lastGoodBackupAt: string | null; backups: { ok: boolean; detail: { key: string } }[]; health: { ok: boolean }[] };
    expect(j.lastGoodBackupAt).toBeTruthy();
    expect(j.backups[0]).toMatchObject({ ok: true, detail: { key: 'd1/test/x.sql.age' } });
    expect(j.health[0]?.ok).toBe(false);
  });
});
