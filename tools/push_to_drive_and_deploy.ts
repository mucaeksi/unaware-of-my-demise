/**
 * Local (E:\unaware-of-my-demise) -> Google Drive (G:\Drive'ım\unaware-of-my-demise) -> Cloudflare deployment pipeline.
 *
 * Workflow:
 * 1. All development, tests, and Vite builds happen on fast local SSD (`E:\unaware-of-my-demise`).
 * 2. This script syncs the built AAB/Cloudflare assets (`apps/game/dist`, `apps/admin/dist`,
 *    `apps/android/android/app/src/main/assets/public`, and `apps/api`) into `G:\Drive'ım\unaware-of-my-demise`.
 * 3. Deploys `uomd-game-staging` and `uomd-admin-staging` to Cloudflare.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/fsutil';

const DRIVE_ROOT = "G:\\Drive'ım\\unaware-of-my-demise";

function syncDir(relPath: string): void {
  const src = join(ROOT, relPath);
  const dst = join(DRIVE_ROOT, relPath);
  if (!existsSync(src)) return;
  console.log(`  [sync] ${relPath} -> ${dst}`);
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(join(dst, '..'), { recursive: true });
  cpSync(src, dst, { recursive: true, force: true });
}

function runWrangler(cwd: string, args: string[]): void {
  console.log(`\n> npx wrangler ${args.join(' ')}`);
  const isWin = process.platform === 'win32';
  const res = spawnSync(isWin ? 'npx.cmd' : 'npx', ['--no-install', 'wrangler', ...args], {
    cwd,
    stdio: 'inherit',
    shell: isWin
  });
  if (res.status !== 0) {
    throw new Error(`wrangler ${args.join(' ')} exited with code ${res.status}`);
  }
}

function getVersionTag(): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  try {
    const sha = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    return `local-to-drive-${sha}-${ts}`;
  } catch {
    return `local-to-drive-${ts}`;
  }
}

function main(): void {
  const tag = getVersionTag();
  console.log(`=== [1/3] Syncing built AAB & Cloudflare bundle from ${ROOT} -> ${DRIVE_ROOT} ===`);
  if (existsSync(DRIVE_ROOT)) {
    syncDir('apps/game/dist');
    syncDir('apps/admin/dist');
    syncDir('apps/api/src');
    // Update the Android Capacitor AAB public web bundle on both Local and Drive
    const androidPublicLocal = join(ROOT, 'apps/android/android/app/src/main/assets/public');
    if (existsSync(join(ROOT, 'apps/game/dist'))) {
      rmSync(androidPublicLocal, { recursive: true, force: true });
      mkdirSync(androidPublicLocal, { recursive: true });
      cpSync(join(ROOT, 'apps/game/dist'), androidPublicLocal, { recursive: true, force: true });
      syncDir('apps/android/android/app/src/main/assets/public');
    }
  } else {
    console.warn(`Warning: ${DRIVE_ROOT} not found; deploying directly from ${ROOT}`);
  }

  // Deploy using the fast local node_modules/wrangler binary while pointing at the synced bundle
  const apiDir = join(ROOT, 'apps/api');
  console.log(`\n=== [2/3] Deploying uomd-game-staging [tag: ${tag}] ===`);
  runWrangler(apiDir, ['deploy', '-c', 'wrangler.game.jsonc', '--env', 'staging', '--keep-vars', '--tag', tag]);

  console.log(`\n=== [3/3] Deploying uomd-admin-staging [tag: ${tag}] ===`);
  runWrangler(apiDir, ['deploy', '-c', 'wrangler.admin.jsonc', '--env', 'staging', '--keep-vars', '--tag', tag]);

  console.log('\n=== Local (E:\\) -> Google Drive (G:\\) -> Cloudflare Deployment Complete ===');
  console.log('Game URL:  https://uomd-game-staging.muratcaneksiii.workers.dev');
  console.log('Admin URL: https://uomd-admin-staging.muratcaneksiii.workers.dev/?page=Animations');
}

main();
