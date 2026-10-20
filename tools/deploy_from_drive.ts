/**
 * Emergency fallback only (D-28): staging normally deploys through Cloudflare Workers Builds when the owner pushes
 * GitHub `main` (tools/deploy_staging.sh). This script applies remote D1 migrations & seeds and deploys
 * uomd-game-staging, uomd-admin-staging and uomd-ops-staging from this machine with Wrangler, and refuses to run
 * unless the tree is a clean `main` equal to `origin/main`, so it can only re-ship what GitHub already has.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib/fsutil';

const API_DIR = join(ROOT, 'apps/api');

function runWrangler(args: string[]): void {
  console.log(`\n> npx wrangler ${args.join(' ')}`);
  const isWin = process.platform === 'win32';
  const res = spawnSync(isWin ? 'npx.cmd' : 'npx', ['--no-install', 'wrangler', ...args], {
    cwd: API_DIR,
    stdio: 'inherit',
    shell: isWin,
    // non-interactive: from a terminal `d1 migrations apply --remote` otherwise waits on a y/N prompt and holds the deploy lock forever
    env: { ...process.env, CI: 'true' }
  });
  if (res.status !== 0) {
    throw new Error(`wrangler ${args.join(' ')} exited with code ${res.status}`);
  }
}

function getVersionTag(): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  try {
    // assertPushedMain() has already proven the tree clean, so the sha names the deployed source
    const sha = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    return `local-${sha}-${ts}`;
  } catch {
    return `local-${ts}`;
  }
}

/** one deploy at a time on this machine: two agents (Argon in Antigravity, Claude Code) share the working copy.
 *  The lock lives in the OS temp dir, not on Drive, so it is never synced or delayed. */
function acquireDeployLock(): () => void {
  const lock = join(tmpdir(), 'uomd-deploy.lock');
  try {
    const fd = openSync(lock, 'wx');
    writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    closeSync(fd);
  } catch {
    const held = existsSync(lock) ? readFileSync(lock, 'utf8') : '';
    // shortcut: a lock older than 30 minutes is treated as left by a crashed deploy
    if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > 30 * 60_000) {
      rmSync(lock, { force: true });
      return acquireDeployLock();
    }
    throw new Error(`another deploy is running (${lock}: ${held}); wait for it to finish`);
  }
  return () => rmSync(lock, { force: true });
}

/** D-28: only what is already on GitHub main may reach staging; a branch or uncommitted work never ships from here. */
function assertPushedMain(): void {
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  git('fetch', '--quiet', 'origin', 'main');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const dirty = git('status', '--porcelain', '--untracked-files=no');
  const head = git('rev-parse', 'HEAD');
  const remote = git('rev-parse', 'origin/main');
  const problems = [
    branch !== 'main' && `on branch ${branch}, not main`,
    dirty !== '' && 'uncommitted changes in tracked files',
    head !== remote && `HEAD ${head.slice(0, 8)} is not origin/main ${remote.slice(0, 8)} (push first, or pull)`
  ].filter(Boolean);
  if (problems.length > 0) throw new Error(`refusing to deploy: ${problems.join('; ')}`);
}

function main(): void {
  assertPushedMain();
  const release = acquireDeployLock();
  process.on('exit', release);
  const targets = process.argv.slice(2);
  const runAll = targets.length === 0 || targets.includes('all');
  const tag = getVersionTag();
  console.log(`=== Local fallback deploy (${ROOT}) to Cloudflare [tag: ${tag}] ===`);

  if (runAll || targets.includes('game')) {
    console.log('\n--- [1/3] Applying D1 migrations & seeds for uomd-game-staging ---');
    runWrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '-c', 'wrangler.game.jsonc', '--env', 'staging']);
    for (const seed of ['characters', 'catalog', 'banners', 'assets']) {
      runWrangler(['d1', 'execute', 'DB', '--remote', '-c', 'wrangler.game.jsonc', '--env', 'staging', '--file', `seed/${seed}.sql`]);
    }
    console.log('\n--- Deploying uomd-game-staging ---');
    runWrangler(['deploy', '-c', 'wrangler.game.jsonc', '--env', 'staging', '--keep-vars', '--tag', tag]);
  }

  if (runAll || targets.includes('admin')) {
    console.log('\n--- [2/3] Deploying uomd-admin-staging ---');
    runWrangler(['deploy', '-c', 'wrangler.admin.jsonc', '--env', 'staging', '--keep-vars', '--tag', tag]);
  }

  if (runAll || targets.includes('ops')) {
    console.log('\n--- [3/3] Deploying uomd-ops-staging ---');
    runWrangler(['deploy', '-c', 'wrangler.ops.jsonc', '--env', 'staging', '--tag', tag]);
  }

  console.log('\n=== Local fallback deploy complete ===');
  console.log('Game URL:  https://uomd-game-staging.muratcaneksiii.workers.dev');
  console.log('Admin URL: https://uomd-admin-staging.muratcaneksiii.workers.dev');
}

main();
