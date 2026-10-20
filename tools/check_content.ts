/**
 * Drift gate: proves `npm run build:content` reproduces content/base (and the D1 asset seed derived from it) byte for byte.
 * Workers Builds deploys the committed apps/api/seed/assets.sql, so a stale seed must fail here, not ship.
 * The tree is snapshotted first and written back when the rebuild differs, so the check can never destroy
 * authored media (the failure mode that once deleted the main theme and all 116 voice lines).
 * Run: npm run check:content
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { ROOT } from './lib/fsutil';

const BASE = join(ROOT, 'content/base');
const EXTRA = [join(ROOT, 'content/provenance.json'), join(ROOT, 'apps/api/seed/assets.sql')];

function snapshot(): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const d of readdirSync(BASE, { recursive: true, withFileTypes: true })) {
    if (d.isFile()) out.set(join(d.parentPath, d.name), readFileSync(join(d.parentPath, d.name)));
  }
  for (const f of EXTRA) if (existsSync(f)) out.set(f, readFileSync(f));
  return out;
}

const before = snapshot();
const run = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:content'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
const after = snapshot();

const changed = [...new Set([...before.keys(), ...after.keys()])].filter((f) => !before.get(f)?.equals(after.get(f) ?? Buffer.alloc(0)) || !after.has(f));
if (run.status !== 0 || changed.length > 0) {
  for (const f of after.keys()) if (!before.has(f)) rmSync(f, { force: true });
  for (const [f, bytes] of before) {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, bytes);
  }
  if (run.status !== 0) console.error('build:content failed; content/base restored');
  for (const f of changed) console.error(`drift: ${relative(ROOT, f).replaceAll('\\', '/')}${after.has(f) ? '' : ' (deleted by the builder)'}${before.has(f) ? '' : ' (new)'}`);
  console.error(`content check FAILED: ${changed.length} file(s) differ from what the builder produces; content/base was restored unchanged`);
  process.exit(1);
}
console.log(`content check passed: ${before.size} files reproduced exactly`);
