/**
 * Local (E:\unaware-of-my-demise) -> Google Drive (G:\Drive'ım\unaware-of-my-demise) mirror of the built bundles.
 *
 * `npm run deploy:drive` first runs the verify-gated `npm run deploy:cloudflare` (lint, typecheck, tests, content check,
 * remote D1 migrations + seeds, game/admin/ops Workers), then this script copies the built output (`apps/game/dist`,
 * `apps/admin/dist`, the Android public web bundle and `apps/api/src`) into the Drive working copy with in-place file
 * copies (avoiding Google Drive virtual filesystem directory-delete race conditions). It never deploys by itself: a Worker
 * deployed without its migrations served 500s (D-27 code on a pre-0029 D1, 2026-10-19).
 */
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

function main(): void {
  console.log(`=== Mirroring built AAB & Cloudflare bundle from ${ROOT} -> ${DRIVE_ROOT} ===`);
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
    console.warn(`Warning: ${DRIVE_ROOT} not found; nothing mirrored`);
  }

  console.log('Game URL:  https://uomd-game-staging.muratcaneksiii.workers.dev');
  console.log('Admin URL: https://uomd-admin-staging.muratcaneksiii.workers.dev/?page=Animations');
}

main();
