import { env } from 'cloudflare:workers';
import { Decrypter, generateX25519Identity, identityToRecipient } from 'age-encryption';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@uomd/shared';
import { applyLedger } from '../src/db/ledger';
import { pruneBackups, runBackup } from '../src/ops/backup';
import { dumpDatabase, sqlLiteral } from '../src/ops/dump';
import type { OpsEnv } from '../src/ops/env';
import { runHealth } from '../src/ops/health';
import { rehearseRestore, verifyEncryptedBackup } from '../src/ops/restore';
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

/** Records every SQL text prepared, and can run a hook before each batch (to simulate concurrent writers). */
function recording(inner: D1Database, beforeBatch?: (sqlSoFar: string[]) => Promise<void>): { db: D1Database; sql: string[] } {
  const sql: string[] = [];
  const db = {
    prepare: (q: string) => { sql.push(q); return inner.prepare(q); },
    batch: async (s: D1PreparedStatement[]) => { await beforeBatch?.(sql); return inner.batch(s); }
  };
  return { db: db as unknown as D1Database, sql };
}

describe('uomd-ops: bounded dump at scale (R17)', () => {
  const ROWS = 300;
  const withScaleTable = async (run: () => Promise<void>): Promise<void> => {
    await db().prepare('CREATE TABLE r17_scale (id INTEGER PRIMARY KEY, v TEXT NOT NULL) STRICT').run();
    await db().prepare("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?1) INSERT INTO r17_scale (id, v) SELECT i, 'row-' || i || '-''q' FROM n").bind(ROWS).run();
    try { await run(); } finally { await db().prepare('DROP TABLE r17_scale').run(); }
  };

  it('a database over the row cap fails from COUNT(*) alone, before any row is read', async () => {
    await withScaleTable(async () => {
      const { db: spy, sql } = recording(db());
      await expect(dumpDatabase(spy, { maxRows: ROWS })).rejects.toThrow(new RegExp(`capped at ${ROWS}`));
      expect(sql.some((q) => /SELECT \*/i.test(q))).toBe(false);
      expect(sql.filter((q) => /COUNT\(\*\)/.test(q)).length).toBeGreaterThan(0);
    });
  });

  it('multi-page dumps are byte-identical to single-page dumps, with every row exactly once', async () => {
    await withScaleTable(async () => {
      const { db: spy, sql } = recording(db());
      const paged = await dumpDatabase(spy, { pageRows: 7 });
      const whole = await dumpDatabase(db());
      expect(paged.pages.r17_scale).toBe(Math.floor(ROWS / 7) + 1);
      expect(whole.pages.r17_scale).toBe(1);
      expect(paged.tables).toEqual(whole.tables);
      expect(paged.tables.r17_scale).toBe(ROWS);
      expect(paged.bytes).toBe(new TextEncoder().encode(paged.sql).byteLength);
      expect(await sha256Hex(paged.sql)).toBe(await sha256Hex(whole.sql));
      for (const i of [1, 7, 8, 150, ROWS]) expect(paged.sql.split(`'row-${i}-''q'`).length - 1).toBe(1);
      // every row read is an explicitly bounded page in deterministic order
      expect(sql.filter((q) => /SELECT \*/i.test(q)).every((q) => /ORDER BY .+ LIMIT \?1 OFFSET \?2$/.test(q))).toBe(true);
      expect(paged.reconciled).toBe(true);
    });
  });

  it('growth between sizing and reading stays bounded: within headroom it is captured, beyond it the dump refuses', async () => {
    await withScaleTable(async () => {
      const grow = (n: number) => {
        let done = false;
        return async (sqlSoFar: string[]): Promise<void> => {
          if (done || !sqlSoFar.some((q) => /OFFSET \?2$/.test(q))) return; // only right before the page-read transaction
          done = true;
          await db().prepare("WITH RECURSIVE k(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM k WHERE i < ?1) INSERT INTO r17_scale (v) SELECT 'late-' || i FROM k").bind(n).run();
        };
      };
      // 300 rows at sizing, pages of 100 => capacity 400
      const within = await dumpDatabase(recording(db(), grow(50)).db, { pageRows: 100 });
      expect(within.tables.r17_scale).toBe(ROWS + 50);
      await expect(dumpDatabase(recording(db(), grow(200)).db, { pageRows: 100 })).rejects.toThrow(/grew from 350 to 550 rows/);
    });
  });

  it('enforces the byte budget while emitting, not after building the whole file', async () => {
    await withScaleTable(async () => {
      await expect(dumpDatabase(db(), { maxBytes: 4096 })).rejects.toThrow(/exceeds 4096 bytes/);
    });
  });

  it('the backup manifest records rows, pages, limits and duration as scale evidence', async () => {
    await withScaleTable(async () => {
      const bucket = fakeBucket();
      const id = await generateX25519Identity();
      const r = await runBackup({ DB: db(), BACKUPS: bucket as unknown as R2Bucket, AGE_RECIPIENT: await identityToRecipient(id), TARGET: 'test', GAME: fetcher(200), ADMIN: fetcher(401) }, new Date('2026-10-12T03:17:00Z'), { pageRows: 50 });
      const manifest = JSON.parse(bucket.objects.get(`${r.key}.manifest.json`) as string) as { rows: number; pages: Record<string, number>; limits: { pageRows: number; maxRows: number }; durationMs: number; sha256Plain: string; tables: Record<string, number> };
      expect(manifest.pages.r17_scale).toBe(Math.floor(ROWS / 50) + 1);
      expect(manifest.rows).toBe(Object.values(manifest.tables).reduce((a, b) => a + b, 0));
      expect(manifest.limits).toMatchObject({ pageRows: 50, maxRows: 200_000 });
      expect(manifest.durationMs).toBeGreaterThanOrEqual(0);
      const d = new Decrypter();
      d.addIdentity(id);
      expect(await sha256Hex(await d.decrypt(bucket.objects.get(r.key) as Uint8Array, 'text'))).toBe(manifest.sha256Plain);
    });
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

describe('uomd-ops: encrypted restore rehearsal, R2 retention, and out-of-band alerts (R17-B)', () => {
  it('verifies encrypted backup, reconciles table counts/ledger/triggers, and scrubs deleted accounts on restore', async () => {
    const { playerId: victimId } = await signIn(`sub-rehearse-del-${Math.random().toString(36).slice(2)}`);
    await applyLedger(db(), { playerId: victimId, currency: 'eclipse_token', delta: 100, reason: 'seed', idempotencyKey: `reh:${victimId}` });

    const id = await generateX25519Identity();
    const bucket = fakeBucket();
    const ops = {
      DB: db(),
      BACKUPS: bucket as unknown as R2Bucket,
      AGE_RECIPIENT: await identityToRecipient(id),
      TARGET: 'test',
      GAME: fetcher(200),
      ADMIN: fetcher(401)
    } satisfies OpsEnv;

    const bk = await runBackup(ops, new Date('2026-10-14T03:17:00Z'));
    const cipher = bucket.objects.get(bk.key) as Uint8Array;
    const manifestRaw = bucket.objects.get(`${bk.key}.manifest.json`) as string;

    const v = await verifyEncryptedBackup(cipher, manifestRaw, id, new Date('2026-10-14T05:17:00Z'));
    expect(v.ok).toBe(true);
    expect(v.sha256MatchesManifest).toBe(true);
    expect(v.plainBytesMatchesManifest).toBe(true);
    expect(v.tableCountsMatchDump).toBe(true);
    expect(v.triggersAfterInserts).toBe(true);
    expect(v.rpoHours).toBeCloseTo(2, 2);

    const rehearsal = await rehearseRestore(db(), cipher, manifestRaw, id, [victimId], new Date('2026-10-14T05:17:00Z'));
    expect(rehearsal.ok).toBe(true);
    expect(rehearsal.dbRowCountsMatch).toBe(true);
    expect(rehearsal.ledgerReconciled).toBe(true);
    expect(rehearsal.triggersEnforced).toBe(true);
    expect(rehearsal.deletedAccountsReapplied).toBeGreaterThanOrEqual(1);

    const victimRow = await db().prepare('SELECT status, google_sub FROM players WHERE id = ?1').bind(victimId).first<{ status: string; google_sub: string | null }>();
    expect(victimRow).toEqual({ status: 'deleted', google_sub: null });
  });

  it('prunes R2 backups older than retentionDays while preserving at least minKeep recent backups', async () => {
    const keys = [
      'd1/staging/d1-staging-20260801T031700Z.sql.age',
      'd1/staging/d1-staging-20260815T031700Z.sql.age',
      'd1/staging/d1-staging-20260901T031700Z.sql.age',
      'd1/staging/d1-staging-20261010T031700Z.sql.age',
      'd1/staging/d1-staging-20261014T031700Z.sql.age'
    ];
    const store = new Set<string>();
    for (const k of keys) {
      store.add(k);
      store.add(`${k}.manifest.json`);
    }
    const r2Mock = {
      list: async () => ({ objects: [...store].map((key) => ({ key })) }) as unknown as R2Objects,
      delete: async (toDelete: string | string[]) => {
        for (const k of Array.isArray(toDelete) ? toDelete : [toDelete]) store.delete(k);
      }
    };

    const res = await pruneBackups(r2Mock, 'staging', 30, 3, new Date('2026-10-15T00:00:00Z'));
    expect(res.inspected).toBe(5);
    // 2 newest are within 30 days; 3rd newest (2026-09-01) is kept by minKeep=3; 2 oldest are pruned
    expect(res.kept).toBe(3);
    expect(res.deleted).toEqual([
      'd1/staging/d1-staging-20260815T031700Z.sql.age',
      'd1/staging/d1-staging-20260801T031700Z.sql.age'
    ]);
    expect(store.has('d1/staging/d1-staging-20260901T031700Z.sql.age')).toBe(true);
    expect(store.has('d1/staging/d1-staging-20260801T031700Z.sql.age')).toBe(false);
    expect(store.has('d1/staging/d1-staging-20260801T031700Z.sql.age.manifest.json')).toBe(false);
  });

  it('persists out-of-band R2 alerts when health checks fail so outages do not rely solely on D1', async () => {
    const bucket = fakeBucket();
    const opsEnv = {
      DB: db(),
      BACKUPS: bucket as unknown as R2Bucket,
      AGE_RECIPIENT: await identityToRecipient(await generateX25519Identity()),
      TARGET: 'test_alert',
      GAME: down,
      ADMIN: down
    } satisfies OpsEnv;

    await runScheduled(CRON_HEALTH, opsEnv);
    const latestAlertRaw = bucket.objects.get('alerts/test_alert/latest.json') as string | undefined;
    expect(latestAlertRaw).toBeTruthy();
    const alertJson = JSON.parse(latestAlertRaw!) as { target: string; kind: string; ok: boolean };
    expect(alertJson).toMatchObject({ target: 'test_alert', kind: 'health', ok: false });
  });
});
