/**
 * Generates an ES256 content-signing key pair.
 *   tsx tools/gen_signing_key.ts --kid uomd-staging-2026-10 --out /secure/dir
 * The PRIVATE key is written only to --out (outside the repo, mode 0600) and is meant to become the
 * CONTENT_SIGNING_KEY secret of the admin Worker. The PUBLIC key is added to
 * content/keys/trusted_public_keys.json, which every client build trusts.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { generateSigningKeyPair } from '../packages/shared/src/index';
import { ROOT } from './lib/fsutil';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const kid = arg('kid');
const out = arg('out');
if (!kid || !out) throw new Error('usage: --kid <id> --out <directory outside the repository>');
const outDir = resolve(out);
if (outDir.startsWith(ROOT)) throw new Error('refusing to write a private key inside the repository');

const { publicJwk, privateJwk } = await generateSigningKeyPair();
mkdirSync(outDir, { recursive: true });
const privPath = join(outDir, `${kid}.private.jwk.json`);
writeFileSync(privPath, JSON.stringify({ ...privateJwk, kid }), { mode: 0o600 });
chmodSync(privPath, 0o600);

const trustedPath = join(ROOT, 'content/keys/trusted_public_keys.json');
const trusted = existsSync(trustedPath) ? (JSON.parse(readFileSync(trustedPath, 'utf8')) as { keys: unknown[] }) : { keys: [] };
trusted.keys.push({ kty: 'EC', crv: 'P-256', x: publicJwk.x, y: publicJwk.y, kid });
writeFileSync(trustedPath, `${JSON.stringify(trusted, null, 2)}\n`);
console.log(`private key written to ${privPath} (never commit it); public key added to content/keys/trusted_public_keys.json`);
