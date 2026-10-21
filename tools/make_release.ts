/**
 * Builds the manifest of a content directory and (optionally) signs it.
 *   tsx tools/make_release.ts --dir content/base --id rel_0001 --generation 1 --channel staging --min-client 0.1.1 --out content/base/release.json
 *   tsx tools/make_release.ts --dir content/patches/rel_0002_road_forgotten --id rel_0002 --generation 2 --depends rel_0001:1 \
 *       --key /secure/uomd-staging-2026-10.private.jwk.json --out content/releases/rel_0002.staging.json
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildManifest, signManifest } from '../packages/patch/src/index';
import { compareSemver, importPrivateKey } from '../packages/shared/src/index';
import { MIN_SNAPSHOT_CLIENT_VERSION } from '../packages/content-schema/src/index';
import { ROOT } from './lib/fsutil';

const arg = (name: string, def?: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : def;
  if (v === undefined) throw new Error(`missing --${name}`);
  return v;
};
const opt = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const walk = (dir: string, rel = ''): string[] =>
  readdirSync(join(dir, rel))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap((n) => {
      const r = rel ? `${rel}/${n}` : n;
      return statSync(join(dir, r)).isDirectory() ? walk(dir, r) : [r];
    });

const dir = resolve(ROOT, arg('dir'));
const outPath = resolve(ROOT, arg('out'));
const files = walk(dir)
  .filter((p) => p !== 'release.json')
  .map((p) => ({ path: p, bytes: new Uint8Array(readFileSync(join(dir, p))) }));
const dep = opt('depends')?.split(':');
const requestedMin = arg('min-client', MIN_SNAPSHOT_CLIENT_VERSION);
const minClient = !dep && compareSemver(requestedMin, MIN_SNAPSHOT_CLIENT_VERSION) < 0 ? MIN_SNAPSHOT_CLIENT_VERSION : requestedMin;
const manifest = await buildManifest(
  {
    releaseId: arg('id'),
    generation: Number(arg('generation')),
    channel: arg('channel', 'staging') as 'dev' | 'staging' | 'production',
    notes: arg('notes', ''),
    minClient,
    ...(opt('max-client') ? { maxClient: opt('max-client') } : {}),
    ...(opt('content-schema') ? { contentSchema: Number(opt('content-schema')) } : {}),
    ...(dep ? { dependsOn: { releaseId: dep[0] as string, generation: Number(dep[1]) } } : {}),
    ...(opt('rollout') ? { rolloutPercent: Number(opt('rollout')) } : {}),
    ...(opt('created-at') ? { createdAt: opt('created-at') as string } : {})
  },
  files
);
const keyPath = opt('key');
let result = manifest;
if (keyPath) {
  const jwk = JSON.parse(readFileSync(resolve(keyPath), 'utf8')) as JsonWebKey & { kid: string };
  result = await signManifest(manifest, await importPrivateKey(jwk), jwk.kid);
}
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`${result.release.id} g${result.release.generation}: ${result.files.length} files, ${result.files.reduce((n, f) => n + f.bytes, 0)} bytes${keyPath ? ', signed' : ', UNSIGNED'} -> ${outPath}`);
