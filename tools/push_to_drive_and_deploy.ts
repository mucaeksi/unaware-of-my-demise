/**
 * Local (E:\unaware-of-my-demise) -> Google Drive (G:\Drive'ım\unaware-of-my-demise) -> Cloudflare deployment pipeline.
 *
 * Workflow:
 * 1. All development, tests, and Vite builds happen on fast local SSD (`E:\unaware-of-my-demise`).
 * 2. This script syncs the built AAB/Cloudflare assets (`apps/game/dist`, `apps/admin/dist`,
 *    `apps/android/android/app/src/main/assets/public`, and `apps/api/src`) into `G:\Drive'ım\unaware-of-my-demise`
 *    using in-place file copies (avoiding Google Drive virtual filesystem directory-delete race conditions).
 * 3. Deploys `uomd-game-staging` and `uomd-admin-staging` to Cloudflare.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/fsutil';

const DRIVE_ROOT = "G:\\Drive'ım\\unaware-of-my-demise";

function copyTreeInPlace(srcDir: string, dstDir: string): number {
  if (!existsSync(srcDir)) return 0;
  mkdirSync(dstDir, { recursive: true });
  let copied = 0;
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const s = join(srcDir, entry.name);
    const d = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyTreeInPlace(s, d);
    } else if (entry.isFile()) {
      const sStat = statSync(s);
      let same = false;
      if (existsSync(d)) {
        try {
          const dStat = statSync(d);
          // Skip unchanged asset files (e.g. identical .ogg/.png files in content/base)
          if (dStat.size === sStat.size && Math.abs(dStat.mtimeMs - sStat.mtimeMs) < 1000) {
            same = true;
          }
        } catch {
          same = false;
        }
      }
      if (!same) {
        copyFileSync(s, d);
        copied++;
      }
    }
  }
  return copied;
}

function syncDir(relPath: string): void {
  const src = join(ROOT, relPath);
  const dst = join(DRIVE_ROOT, relPath);
  if (!existsSync(src)) return;
  const count = copyTreeInPlace(src, dst);
  console.log(`  [sync] ${relPath} -> ${dst} (${count} updated files)`);
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
  // Update the Android Capacitor AAB public web bundle on Local first
  const androidPublicLocal = join(ROOT, 'apps/android/android/app/src/main/assets/public');
  if (existsSync(join(ROOT, 'apps/game/dist'))) {
    copyTreeInPlace(join(ROOT, 'apps/game/dist'), androidPublicLocal);
  }

  if (existsSync(DRIVE_ROOT)) {
    syncDir('apps/game/dist');
    syncDir('apps/admin/dist');
    syncDir('apps/api/src');
    syncDir('apps/android/android/app/src/main/assets/public');
  } else {
    console.warn(`Warning: ${DRIVE_ROOT} not found; deploying directly from ${ROOT}`);
  }

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
