/**
 * Local full-stack development runner for Game Worker (:8787) + Admin Control Center (:8788).
 * - Applies D1 migrations and seeds characters, banners, catalog, and all 170 base assets.
 * - Publishes rel_0001 (content/base) into local R2 & D1 so every asset is stored and verified.
 * - Automatically injects a local Owner Cloudflare Access JWT on :8788 requests when no token
 *   is present, allowing direct browser access at http://127.0.0.1:8788 and http://127.0.0.1:5174.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer, request as proxyRequest, type Server } from 'node:http';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { buildSync } from 'esbuild';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { generateSigningKeyPair } from '../packages/shared/src/index';

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const STATE = process.platform === 'win32' ? join(tmpdir(), 'uomd-local-dev-state') : join(ROOT, '.cache/local-dev-state');
const PORTS = { game: 8787, admin: 8788, jwks: 8799 };
const TEAM = 'local-dev.uomd.internal';
const AUD = 'local-dev-audience';
const OWNER = 'owner@uomd.local';
const GOOGLE_CLIENT = 'local-dev-client.apps.googleusercontent.com';

const procs: ChildProcess[] = [];
let jwksServer: Server | null = null;
let adminProxy: Server | null = null;

function resolveSpawn(cmd: string, args: string[]): { bin: string; argv: string[] } {
  if (cmd === 'npx' && args[0] === 'wrangler') {
    return { bin: process.execPath, argv: [join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), ...args.slice(1)] };
  }
  if (cmd === 'npx' && args[0] === 'tsx') {
    return { bin: process.execPath, argv: [join(ROOT, 'node_modules/tsx/dist/cli.mjs'), ...args.slice(1)] };
  }
  if (process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx')) {
    return { bin: process.env.ComSpec ?? 'cmd.exe', argv: ['/d', '/s', '/c', `${cmd}.cmd`, ...args] };
  }
  return { bin: cmd, argv: args };
}

function sh(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const { bin, argv } = resolveSpawn(cmd, args);
    const p = spawn(bin, argv, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
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
      /* wait */
    }
    if (Date.now() > end) throw new Error(`timeout waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 400));
  }
}

function localEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' };
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete env[k];
  return env;
}

function start(name: string, args: string[], cwd: string): void {
  const { bin, argv } = resolveSpawn('npx', ['wrangler', ...args]);
  const p = spawn(bin, argv, { cwd, env: localEnv(), stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  p.stdout?.on('data', (d: Buffer) => process.stdout.write(`[${name}] ${d}`));
  p.stderr?.on('data', (d: Buffer) => process.stderr.write(`[${name}] ${d}`));
  procs.push(p);
}

async function boot(): Promise<void> {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/IM', 'workerd.exe', '/F'], { stdio: 'ignore' });
  }
  rmSync(STATE, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  mkdirSync(STATE, { recursive: true });

  const rsa = await generateKeyPair('RS256', { extractable: true });
  const jwk = { ...(await exportJWK(rsa.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const googleRsa = await generateKeyPair('RS256', { extractable: true });
  const googleJwk = { ...(await exportJWK(googleRsa.publicKey)), kid: 'g1', alg: 'RS256', use: 'sig' };

  jwksServer = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [req.url?.startsWith('/google') ? googleJwk : jwk] }));
  }).listen(PORTS.jwks, '127.0.0.1');

  const adminJwt = await new SignJWT({ email: OWNER })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(`https://${TEAM}`)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(rsa.privateKey);

  const signing = await generateSigningKeyPair();
  const kid = 'local-dev-signing-key';
  const pub = signing.publicJwk as { x: string; y: string };
  const trustedFile = join(STATE, 'trusted_public_keys.json');
  writeFileSync(trustedFile, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, kid }] }));

  const api = join(ROOT, 'apps/api');
  const persist = ['--persist-to', STATE];
  await sh('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', ...persist, '-c', 'wrangler.game.jsonc', '--env', 'dev'], api);
  await sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '-c', 'wrangler.game.jsonc', '--env', 'dev', '--file', 'seed/characters.sql'], api);
  await sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '-c', 'wrangler.game.jsonc', '--env', 'dev', '--file', 'seed/banners.sql'], api);
  await sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '-c', 'wrangler.game.jsonc', '--env', 'dev', '--file', 'seed/catalog.sql'], api);
  await sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '-c', 'wrangler.game.jsonc', '--env', 'dev', '--file', 'seed/assets.sql'], api);

  const copyDirSync = (srcDir: string, destDir: string): void => {
    mkdirSync(destDir, { recursive: true });
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const s = join(srcDir, entry.name);
      const d = join(destDir, entry.name);
      if (entry.isDirectory()) copyDirSync(s, d);
      else if (entry.isFile()) writeFileSync(d, readFileSync(s));
    }
  };

  const bundleEntry = (entryPath: string, outName: string): string => {
    if (process.platform !== 'win32') return entryPath;
    const outFile = join(STATE, outName);
    buildSync({
      entryPoints: [entryPath],
      outfile: outFile,
      bundle: true,
      format: 'esm',
      target: 'es2022',
      platform: 'neutral',
      mainFields: ['module', 'main'],
      conditions: ['workerd', 'worker', 'browser'],
      external: ['cloudflare:*', 'node:*']
    });
    return outFile;
  };

  const migrationsDir = process.platform === 'win32' ? join(STATE, 'migrations') : join(api, 'migrations');
  if (process.platform === 'win32') copyDirSync(join(api, 'migrations'), migrationsDir);

  const fixtureConfig = (kind: 'game' | 'admin', vars: Record<string, string>): string => {
    const file = join(api, `wrangler.${kind}.jsonc`);
    const parsed = ts.parseConfigFileTextToJson(file, readFileSync(file, 'utf8'));
    if (parsed.error) throw new Error(`Invalid local Worker config: ${file}`);
    const config = parsed.config;
    const { env: _env, $schema: _schema, account_id: _account, ...base } = config;
    const dev = config.env.dev;
    const srcAssetsDir = join(api, dev.assets.directory);
    const assetsDir = process.platform === 'win32' ? join(STATE, `assets-${kind}`) : srcAssetsDir;
    if (process.platform === 'win32') copyDirSync(srcAssetsDir, assetsDir);
    const mainFile = bundleEntry(join(api, config.main), `${kind}.mjs`);
    const target = join(STATE, `${kind}.json`);
    writeFileSync(
      target,
      JSON.stringify({
        ...base,
        ...dev,
        main: mainFile,
        assets: { ...dev.assets, directory: assetsDir },
        d1_databases: dev.d1_databases.map((db: Record<string, string>) => ({ ...db, migrations_dir: migrationsDir })),
        ...(kind === 'admin' ? { services: [{ binding: 'GAME', service: 'uomd-game-dev' }] } : {}),
        vars: { ...dev.vars, ...vars }
      }),
      { mode: 0o600 }
    );
    return target;
  };

  const gameConfig = fixtureConfig('game', {
    GOOGLE_CLIENT_IDS: GOOGLE_CLIENT,
    GOOGLE_JWKS_URL: `http://127.0.0.1:${PORTS.jwks}/google.json`
  });
  const adminConfig = fixtureConfig('admin', {
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
    ACCESS_JWKS_URL: `http://127.0.0.1:${PORTS.jwks}/jwks.json`,
    ADMIN_BOOTSTRAP_OWNERS: OWNER,
    CONTENT_SIGNING_KEY: JSON.stringify({ ...signing.privateJwk, kid }),
    CONTENT_SIGNING_KID: kid
  });

  const gatewayMain = bundleEntry(join(ROOT, 'tests/e2e/gateway.ts'), 'gateway.mjs');
  const gatewayConfig = join(STATE, 'gateway.json');
  writeFileSync(
    gatewayConfig,
    JSON.stringify({
      name: 'uomd-local-gateway',
      main: gatewayMain,
      compatibility_date: '2026-10-01',
      services: [
        { binding: 'GAME', service: 'uomd-game-dev' },
        { binding: 'ADMIN', service: 'uomd-admin-dev' }
      ]
    }),
    { mode: 0o600 }
  );

  start(
    'stack',
    ['dev', '-c', gatewayConfig, '-c', gameConfig, '-c', adminConfig, '--port', String(PORTS.game), '--inspector-port', '9305', ...persist],
    process.platform === 'win32' ? STATE : api
  );

  adminProxy = createServer((req, res) => {
    const headers: Record<string, string | string[] | undefined> = {
      ...req.headers,
      'x-uomd-e2e-admin': '1'
    };
    if (!headers['cf-access-jwt-assertion']) {
      headers['cf-access-jwt-assertion'] = adminJwt;
    }
    const upstream = proxyRequest(
      {
        hostname: '127.0.0.1',
        port: PORTS.game,
        path: req.url,
        method: req.method,
        headers
      },
      (reply) => {
        res.writeHead(reply.statusCode ?? 502, reply.headers);
        reply.pipe(res);
      }
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => {
      if (!res.writableEnded) upstream.destroy();
    });
    req.pipe(upstream);
  }).listen(PORTS.admin, '127.0.0.1');

  await waitFor(`http://127.0.0.1:${PORTS.game}/api/v1/health`);
  await waitFor(`http://127.0.0.1:${PORTS.admin}/admin/api/health`);

  await sh(
    'npx',
    ['tsx', 'tools/publish_release.ts', '--admin', `http://127.0.0.1:${PORTS.admin}`, '--dir', 'content/base', '--id', 'rel_0001', '--channel', 'dev', '--publish', '--notes', 'Base AAB v0.1.2 content'],
    ROOT,
    { UOMD_ADMIN_JWT: adminJwt }
  );

  // Trigger an initial live health probe so Monitoring & Dashboard immediately have fresh probe data
  try {
    await fetch(`http://127.0.0.1:${PORTS.admin}/admin/api/monitoring/probe`, {
      method: 'POST',
      headers: {
        'cf-access-jwt-assertion': adminJwt,
        Origin: `http://127.0.0.1:${PORTS.admin}`
      }
    });
  } catch {
    /* non-fatal */
  }

  console.log('\n============================================================');
  console.log('UOMD Local Stack Ready:');
  console.log(`  Game Worker:          http://127.0.0.1:${PORTS.game}`);
  console.log(`  Admin Control Center: http://127.0.0.1:${PORTS.admin}`);
  console.log(`  Owner Identity:       ${OWNER} (auto-injected on :${PORTS.admin})`);
  console.log('============================================================\n');
}

function shutdown(code: number): never {
  jwksServer?.close();
  adminProxy?.close();
  for (const p of procs) p.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

boot().catch((e) => {
  console.error(e);
  shutdown(1);
});
