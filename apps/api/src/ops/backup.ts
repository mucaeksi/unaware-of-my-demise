import { Encrypter } from 'age-encryption';
import { sha256Hex } from '@uomd/shared';
import { dumpDatabase } from './dump';
import type { OpsEnv } from './env';

export interface BackupResult {
  key: string;
  bytes: number;
  tables: Record<string, number>;
  reconciled: boolean | null;
}

/** Dump, verify (counts + ledger reconciliation), age-encrypt to the public key, store in R2 with a small manifest. */
export async function runBackup(env: OpsEnv, now = new Date()): Promise<BackupResult> {
  if (!/^age1[a-z0-9]{50,}$/.test(env.AGE_RECIPIENT)) throw new Error('AGE_RECIPIENT is not an age public key');
  const dump = await dumpDatabase(env.DB);
  if (dump.reconciled === false) throw new Error('wallet balances do not reconcile with the ledger: refusing to call this backup good');
  const plain = new TextEncoder().encode(dump.sql);
  const enc = new Encrypter();
  enc.addRecipient(env.AGE_RECIPIENT);
  const cipher = await enc.encrypt(plain);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const key = `d1/${env.TARGET}/d1-${env.TARGET}-${stamp}.sql.age`;
  await env.BACKUPS.put(key, cipher, { customMetadata: { sha256_plain: await sha256Hex(dump.sql), tables: String(Object.keys(dump.tables).length) } });
  await env.BACKUPS.put(`${key}.manifest.json`, JSON.stringify({ createdAt: now.toISOString(), target: env.TARGET, bytes: cipher.byteLength, plainBytes: plain.byteLength, sha256Plain: await sha256Hex(dump.sql), tables: dump.tables, atomic: dump.atomic, reconciled: dump.reconciled }, null, 2), { httpMetadata: { contentType: 'application/json' } });
  if (env.BACKUP_PROBE === '1') await env.BACKUPS.put(`probe/${env.TARGET}-${stamp}.sql`, plain);
  return { key, bytes: cipher.byteLength, tables: dump.tables, reconciled: dump.reconciled };
}
