#!/usr/bin/env node
/* global process, console */
/**
 * Publishes the Unity capture (apps/unity/cloud/unity_ci.sh capture) to docs/evidence/unity-NN-screen.webp, replacing the
 * previous set, plus docs/evidence/unity-capture.json (commit, editor version, time). tools/build_progress.ts copies them into
 * the Control Center, whose Development page shows them as the current Unity build.
 * Usage: node tools/publish_unity_screens.mjs [captureDir]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] ?? join(ROOT, 'apps/unity/Builds/Capture');
const out = join(ROOT, 'docs/evidence');
if (!existsSync(join(src, 'capture.txt'))) throw new Error(`no capture in ${src}; run bash apps/unity/cloud/unity_ci.sh capture`);
for (const f of readdirSync(out)) if (f.startsWith('unity-')) rmSync(join(out, f));
const files = readdirSync(src).filter((f) => f.endsWith('.png')).sort();
for (const f of files) {
  await sharp(join(src, f)).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(out, `unity-${f.replace(/\.png$/, '.webp')}`));
}
const version = /m_EditorVersion:\s*(\S+)/.exec(readFileSync(join(ROOT, 'apps/unity/ProjectSettings/ProjectVersion.txt'), 'utf8'))?.[1] ?? '';
const commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
writeFileSync(join(out, 'unity-capture.json'), `${JSON.stringify({ commit, editorVersion: version, capturedAt: new Date().toISOString(), screens: files.length }, null, 2)}\n`);
console.log(`published ${files.length} Unity screens (${commit}) -> docs/evidence/unity-*.webp`);
