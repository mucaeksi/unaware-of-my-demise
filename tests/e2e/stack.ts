/**
 * Spins up the REAL stack locally for browser tests: built game + built admin, both Workers under
 * one multi-Worker `wrangler dev` runtime (shared D1/R2), a test-only Access JWKS and a
 * test-only content signing key. No Cloudflare credentials are needed.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, request as proxyRequest, type Server } from 'node:http';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { generateSigningKeyPair } from '../../packages/shared/src/index';

export const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
export const STATE = join(ROOT, '.cache/e2e-state');
export const PORTS = { game: 8787, admin: 8788, jwks: 8799 };
export const TEAM = 'e2e-team.local';
export const AUD = 'e2e-audience';
export const OWNER = 'e2e-owner@example.com';
export const GOOGLE_CLIENT = 'e2e-client.apps.googleusercontent.com';

export interface Stack {
  adminJwt: string;
  stop(): Promise<void>;
}

const procs: ChildProcess[] = [];
let jwksServer: Server | null = null;
let adminProxy: Server | null = null;

/** Async on purpose: the test JWKS server lives in this process and must keep answering while children run. */
function sh(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.slice(0, 3).join(' ')} exited with ${code}`))));
  });
}

async function waitFor(url: string, ms = 90_000): Promise<void> {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > end) throw new Error(`timeout waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 400));
  }
}

/** Local dev servers must talk to each other (JWKS, API) directly; a sandbox/corporate proxy would swallow loopback fetches. */
function localEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' };
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete env[k];
  return env;
}

function start(name: string, args: string[], cwd: string): void {
  const p = spawn('npx', ['wrangler', ...args], { cwd, env: localEnv(), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  p.stdout?.on('data', (d: Buffer) => process.env.E2E_VERBOSE && process.stdout.write(`[${name}] ${d}`));
  p.stderr?.on('data', (d: Buffer) => process.env.E2E_VERBOSE && process.stderr.write(`[${name}] ${d}`));
  procs.push(p);
}

export async function startStack(): Promise<Stack> {
  try {
    return await boot();
  } catch (e) {
    await killAll();
    throw e;
  }
}

async function killAll(): Promise<void> {
  for (const p of procs) {
    try {
      if (p.pid) process.kill(-p.pid, 'SIGTERM'); // the whole group: npx -> wrangler -> workerd
    } catch {
      /* already gone */
    }
  }
  jwksServer?.close();
  adminProxy?.closeAllConnections();
  adminProxy?.close();
}

async function boot(): Promise<Stack> {
  rmSync(STATE, { recursive: true, force: true });
  mkdirSync(STATE, { recursive: true });

  // test-only identities and keys (never reused anywhere else)
  const rsa = await generateKeyPair('RS256', { extractable: true });
  const jwk = { ...(await exportJWK(rsa.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  // a second, unrelated key pair plays "Google" for ID tokens (the game Worker honours a test JWKS only in ENVIRONMENT=dev)
  const googleRsa = await generateKeyPair('RS256', { extractable: true });
  const googleJwk = { ...(await exportJWK(googleRsa.publicKey)), kid: 'g1', alg: 'RS256', use: 'sig' };
  process.env.E2E_GOOGLE_PRIVATE_JWK = JSON.stringify({ ...(await exportJWK(googleRsa.privateKey)), kid: 'g1', alg: 'RS256' });
  jwksServer = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [req.url?.startsWith('/google') ? googleJwk : jwk] }));
  }).listen(PORTS.jwks, '127.0.0.1');
  const adminJwt = await new SignJWT({ email: OWNER }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(`https://${TEAM}`).setAudience(AUD).setIssuedAt().setExpirationTime('6h').sign(rsa.privateKey);

  const signing = await generateSigningKeyPair();
  const kid = 'e2e-signing-key';
  const pub = signing.publicJwk as { x: string; y: string };
  const trustedFile = join(STATE, 'trusted_public_keys.json');
  writeFileSync(trustedFile, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, kid }] }));

  // builds (the e2e game trusts ONLY the test signing key)
  await sh('npm', ['run', 'build', '-w', '@uomd/game'], ROOT, { UOMD_TRUSTED_KEYS: trustedFile, VITE_CONTENT_CHANNEL: 'dev' });
  await sh('npm', ['run', 'build', '-w', '@uomd/admin'], ROOT);

  const api = join(ROOT, 'apps/api');
  const persist = ['--persist-to', STATE];
  await sh('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', ...persist, '-c', 'wrangler.game.jsonc', '--env', 'dev'], api);
  await sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '-c', 'wrangler.game.jsonc', '--env', 'dev', '--file', 'seed/characters.sql'], api);
  await sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '-c', 'wrangler.game.jsonc', '--env', 'dev', '--file', 'seed/banners.sql'], api);
  await sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '-c', 'wrangler.game.jsonc', '--env', 'dev', '--file', 'seed/catalog.sql'], api);

  // Two independent workerd processes opening the same SQLite database intermittently fail
  // with SQLITE_BUSY. Service-bind the unmodified Workers inside a single runtime instead.
  // Generated private configs contain only ephemeral fixture keys; deployment configs stay intact.
  const fixtureConfig = (kind: 'game' | 'admin', vars: Record<string, string>): string => {
    const file = join(api, `wrangler.${kind}.jsonc`);
    const parsed = ts.parseConfigFileTextToJson(file, readFileSync(file, 'utf8'));
    if (parsed.error) throw new Error(`Invalid local Worker config: ${file}`);
    const config = parsed.config;
    const { env: _env, $schema: _schema, account_id: _account, ...base } = config;
    const dev = config.env.dev;
    const target = join(STATE, `${kind}.json`);
    writeFileSync(target, JSON.stringify({ ...base, ...dev, main: join(api, config.main),
      assets: { ...dev.assets, directory: join(api, dev.assets.directory) },
      d1_databases: dev.d1_databases.map((db: Record<string, string>) => ({ ...db, migrations_dir: join(api, db.migrations_dir) })),
      vars: { ...dev.vars, ...vars }
    }), { mode: 0o600 });
    return target;
  };
  const gameConfig = fixtureConfig('game', { GOOGLE_CLIENT_IDS: GOOGLE_CLIENT, GOOGLE_JWKS_URL: `http://127.0.0.1:${PORTS.jwks}/google.json` });
  const adminConfig = fixtureConfig('admin', { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD,
    ACCESS_JWKS_URL: `http://127.0.0.1:${PORTS.jwks}/jwks.json`, ADMIN_BOOTSTRAP_OWNERS: OWNER,
    CONTENT_SIGNING_KEY: JSON.stringify({ ...signing.privateJwk, kid }), CONTENT_SIGNING_KID: kid });
  const gatewayConfig = join(STATE, 'gateway.json');
  writeFileSync(gatewayConfig, JSON.stringify({ name: 'uomd-e2e-gateway',
    main: join(ROOT, 'tests/e2e/gateway.ts'), compatibility_date: '2026-10-01',
    services: [{ binding: 'GAME', service: 'uomd-game-dev' }, { binding: 'ADMIN', service: 'uomd-admin-dev' }]
  }), { mode: 0o600 });
  start('stack', ['dev', '-c', gatewayConfig, '-c', gameConfig, '-c', adminConfig,
    '--port', String(PORTS.game), '--inspector-port', '9302', ...persist], api);
  // Preserve the separate admin browser origin without starting another database runtime.
  adminProxy = createServer((req, res) => {
    const upstream = proxyRequest({ hostname: '127.0.0.1', port: PORTS.game,
      path: req.url, method: req.method, headers: { ...req.headers, 'x-uomd-e2e-admin': '1' } }, (reply) => {
      res.writeHead(reply.statusCode ?? 502, reply.headers); reply.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  }).listen(PORTS.admin, '127.0.0.1');
  await waitFor(`http://127.0.0.1:${PORTS.game}/api/v1/health`);
  await waitFor(`http://127.0.0.1:${PORTS.admin}/admin/api/health`);

  const publish = (dir: string, id: string, extra: string[] = []): Promise<void> =>
    sh('npx', ['tsx', 'tools/publish_release.ts', '--admin', `http://127.0.0.1:${PORTS.admin}`, '--dir', dir, '--id', id, '--channel', 'dev', '--publish', ...extra], ROOT, { UOMD_ADMIN_JWT: adminJwt });
  await publish('content/base', 'rel_0001', ['--notes', 'Base content shipped inside the app']);

  return {
    adminJwt,
    stop: killAll
  };
}

/** The Part I campaign (35 stages) as a data patch over the base release. A release id can be published once per stack, so a later scenario passes its own. */
export function publishCampaign(adminJwt: string, id = 'rel_0003'): Promise<void> {
  return sh('npx', ['tsx', 'tools/publish_release.ts', '--admin', `http://127.0.0.1:${PORTS.admin}`, '--dir', 'content/patches/rel_0003_part1_campaign', '--id', id, '--channel', 'dev', '--depends', 'rel_0001', '--notes', 'Part I campaign', '--publish'], ROOT, { UOMD_ADMIN_JWT: adminJwt });
}

/** Gate/reader QA only: late progress and ownership in this stack's disposable local D1, never a playthrough claim. */
export async function seedLibraryFixture(playerId: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(playerId)) throw new Error('invalid library fixture player');
  const sql = `INSERT INTO player_progress (player_id, node_id, stars, clears) VALUES
    ('${playerId}', 'stage_3_5', 1, 1), ('${playerId}', 'stage_4_5', 1, 1), ('${playerId}', 'stage_6_5', 1, 1);
    INSERT INTO player_items (player_id, item_type, item_id, copies, shards) VALUES ('${playerId}', 'character', 'kera_voss', 1, 0);`;
  await sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--persist-to', STATE, '-c', 'wrangler.game.jsonc', '--env', 'dev', '--command', sql], join(ROOT, 'apps/api'));
}
