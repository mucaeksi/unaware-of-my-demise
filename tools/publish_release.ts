/**
 * Publishes a content directory through the Control Center API (the same path the admin UI uses).
 *   tsx tools/publish_release.ts --admin https://uomd-admin-staging.<sub>.workers.dev --dir content/base \
 *       --id rel_0001 --channel staging [--depends rel_0001] [--notes "..."] [--min-client 0.1.1] [--max-client 1.0.0] [--content-schema 1] [--rollout 100] [--publish]
 * Auth: set CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET (Access service token) or UOMD_ADMIN_JWT (tests only).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sha256Hex } from '../packages/shared/src/index';
import { CATALOG_PATH, EconomyCatalog, MAX_CATALOG_BYTES, MEDIA_TYPE_BY_EXTENSION, MIN_SNAPSHOT_CLIENT_VERSION, type AllowedExtension } from '../packages/content-schema/src/index';
import { ROOT } from './lib/fsutil';

const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const need = (n: string): string => arg(n) ?? (() => { throw new Error(`missing --${n}`); })();


const admin = need('admin').replace(/\/$/, '');
const dir = resolve(ROOT, need('dir'));
const headers: Record<string, string> = {};
if (process.env.UOMD_ADMIN_JWT) headers['Cf-Access-Jwt-Assertion'] = process.env.UOMD_ADMIN_JWT;
if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
  headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
  headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET;
}
if (Object.keys(headers).length === 0) throw new Error('no credentials: set UOMD_ADMIN_JWT or CF_ACCESS_CLIENT_ID/CF_ACCESS_CLIENT_SECRET');

const walk = (d: string, rel = ''): string[] =>
  readdirSync(join(d, rel)).flatMap((n) => {
    const r = rel ? `${rel}/${n}` : n;
    return statSync(join(d, r)).isDirectory() ? walk(d, r) : [r];
  });

async function call(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${admin}/admin/api${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  return res;
}

const files = [];
for (const p of walk(dir).filter((p) => p !== 'release.json')) {
  const bytes = new Uint8Array(readFileSync(join(dir, p)));
  files.push({ path: p, bytes, sha256: await sha256Hex(bytes), type: MEDIA_TYPE_BY_EXTENSION[p.split('.').pop() as AllowedExtension] });
}
if (process.argv.includes('--catalog-snapshot')) {
  if (files.some((f) => f.path === CATALOG_PATH)) throw new Error('catalog/economy.json is already present; omit --catalog-snapshot');
  const response = await call('/catalog/snapshot', { method: 'GET' });
  if (!response.ok) throw new Error(`catalog export: HTTP ${response.status} ${await response.text()}`);
  const snapshot = await response.json() as { json: string; sha256: string; bytes: number };
  const bytes = new TextEncoder().encode(snapshot.json);
  if (bytes.byteLength > MAX_CATALOG_BYTES || bytes.byteLength !== snapshot.bytes || await sha256Hex(bytes) !== snapshot.sha256) throw new Error('catalog export size/hash mismatch');
  EconomyCatalog.parse(JSON.parse(snapshot.json));
  files.push({ path: CATALOG_PATH, bytes, sha256: snapshot.sha256, type: 'application/json' });
  console.log(`catalog snapshot: ${snapshot.sha256} (${bytes.byteLength} bytes)`);
}
let created = 0;
for (const f of files) {
  const res = await call(`/objects/${f.sha256}`, { method: 'PUT', body: f.bytes as BodyInit, headers: { 'Content-Type': f.type as string } });
  if (!res.ok) throw new Error(`upload ${f.path}: HTTP ${res.status} ${await res.text()}`);
  if (res.status === 201) created++;
}
console.log(`objects: ${files.length} (${created} new)`);

const draft = await call('/releases', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: need('id'),
    channel: need('channel'),
    notes: arg('notes') ?? '',
    minClient: arg('min-client') ?? MIN_SNAPSHOT_CLIENT_VERSION,
    ...(arg('max-client') ? { maxClient: arg('max-client') } : {}),
    ...(arg('content-schema') ? { contentSchema: Number(arg('content-schema')) } : {}),
    ...(arg('depends') ? { dependsOn: arg('depends') } : {}),
    ...(arg('rollout') ? { rolloutPercent: Number(arg('rollout')) } : {}),
    files: files.map((f) => ({ path: f.path, sha256: f.sha256 }))
  })
});
if (!draft.ok) throw new Error(`draft: HTTP ${draft.status} ${await draft.text()}`);
const d = (await draft.json()) as { id: string; generation: number };
console.log(`draft ${d.id} generation ${d.generation}`);
if (process.argv.includes('--publish')) {
  const pub = await call(`/releases/${d.id}/publish`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
  if (!pub.ok) throw new Error(`publish: HTTP ${pub.status} ${await pub.text()}`);
  console.log(`published ${d.id}`);
}
