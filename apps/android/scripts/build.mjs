/* global process, console */
// Cross-platform Android build steps (the previous npm scripts used POSIX `VAR=${X:-y}` and `./gradlew`,
// which do not run in Windows cmd — the owner's machine).
//   node scripts/build.mjs web              build the game bundle for the native shell
//   node scripts/build.mjs gradle <task>    run a Gradle task in ./android (assembleDebug, bundleRelease, ...)
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const root = join(here, '..', '..');
const win = process.platform === 'win32';

function run(cmd, args, cwd, env = {}) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: win, env: { ...process.env, ...env } });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const [step, task] = process.argv.slice(2);
if (step === 'web') {
  run('npm', ['run', 'build', '-w', '@uomd/game'], root, {
    VITE_API_BASE: process.env.UOMD_API_BASE || 'https://uomd-game-staging.muratcaneksiii.workers.dev',
    VITE_CONTENT_CHANNEL: process.env.UOMD_CHANNEL || 'staging',
    VITE_PATCH_LAB: 'false',
    VITE_PREVIEW_FLOW: 'false'
  });
} else if (step === 'gradle' && task) {
  run(win ? 'gradlew.bat' : './gradlew', [task], join(here, 'android'));
} else {
  console.error('usage: node scripts/build.mjs web | gradle <task>');
  process.exit(2);
}
