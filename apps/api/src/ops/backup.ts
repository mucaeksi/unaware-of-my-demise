import { Encrypter } from 'age-encryption';
import { sha256Hex } from '@uomd/shared';
import { DUMP_LIMITS, dumpDatabase, type DumpLimits } from './dump';
import type { OpsEnv } from './env';

export interface BackupResult {
  key: string;
  bytes: number;
  tables: Record<string, number>;
  reconciled: boolean | null;
}

/** Dump (bounded, one snapshot), verify (counts + ledger reconciliation), age-encrypt to the public key, store in R2 with a small manifest. */
export async function runBackup(env: OpsEnv, now = new Date(), limits: Partial<DumpLimits> = {}): Promise<BackupResult> {
  if (!/^age1[a-z0-9]{50,}$/.test(env.AGE_RECIPIENT)) throw new Error('AGE_RECIPIENT is not an age public key');
  const started = Date.now();
  const { sql, ...dump } = await dumpDatabase(env.DB, limits);
  if (dump.reconciled === false) throw new Error('wallet balances do not reconcile with the ledger: refusing to call this backup good');
  const plain = new TextEncoder().encode(sql);
  const sha256Plain = await sha256Hex(plain);
  const enc = new Encrypter();
  enc.addRecipient(env.AGE_RECIPIENT);
  const cipher = await enc.encrypt(plain);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const key = `d1/${env.TARGET}/d1-${env.TARGET}-${stamp}.sql.age`;
  await env.BACKUPS.put(key, cipher, { customMetadata: { sha256_plain: sha256Plain, tables: String(Object.keys(dump.tables).length) } });
  const manifest = {
    createdAt: now.toISOString(),
    target: env.TARGET,
    bytes: cipher.byteLength,
    plainBytes: plain.byteLength,
    sha256Plain,
    tables: dump.tables,
    rows: Object.values(dump.tables).reduce((a, b) => a + b, 0),
    pages: dump.pages,
    limits: { ...DUMP_LIMITS, ...limits },
    durationMs: Date.now() - started,
    atomic: dump.atomic,
    reconciled: dump.reconciled
  };
  await env.BACKUPS.put(`${key}.manifest.json`, JSON.stringify(manifest, null, 2), { httpMetadata: { contentType: 'application/json' } });
  return { key, bytes: cipher.byteLength, tables: dump.tables, reconciled: dump.reconciled };
}

/**
 * Enforces R2 backup retention/lifecycle policy (`d1/<target>/d1-<target>-<YYYYMMDDTHHMMSSZ>.sql.age`),
 * deleting backups older than `retentionDays` while always retaining at least `minKeep` most recent backups.
 */
export async function pruneBackups(
  bucket: Pick<R2Bucket, 'list' | 'delete'>,
  target: string,
  retentionDays = 30,
  minKeep = 3,
  now = new Date()
): Promise<{ inspected: number; deleted: string[]; kept: number }> {
  if (typeof bucket.list !== 'function' || typeof bucket.delete !== 'function') {
    return { inspected: 0, deleted: [], kept: 0 };
  }
  const prefix = `d1/${target}/d1-${target}-`;
  const listed = await bucket.list({ prefix, limit: 500 });
  const ageKeys = (listed.objects ?? [])
    .map((o) => o.key)
    .filter((k) => k.endsWith('.sql.age'))
    .sort()
    .reverse();

  const cutoffMs = now.getTime() - Math.max(1, retentionDays) * 86_400_000;
  const deleted: string[] = [];

  for (let i = 0; i < ageKeys.length; i++) {
    if (i < Math.max(1, minKeep)) continue;
    const key = ageKeys[i]!;
    const match = /-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.sql\.age$/.exec(key);
    if (!match) continue;
    const stampIso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
    const ts = Date.parse(stampIso);
    if (Number.isFinite(ts) && ts < cutoffMs) {
      await bucket.delete([key, `${key}.manifest.json`]);
      deleted.push(key);
    }
  }

  return { inspected: ageKeys.length, deleted, kept: ageKeys.length - deleted.length };
}
