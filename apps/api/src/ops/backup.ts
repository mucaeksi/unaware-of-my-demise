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
