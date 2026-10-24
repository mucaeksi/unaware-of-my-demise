#!/usr/bin/env node
/* global process, console */
/**
 * Records the latest Android build (apps/unity/cloud/unity_ci.sh build) as docs/evidence/unity-android-build.json, which
 * tools/lib/unity-status.ts reads for the Control Center Development page. The build itself is never committed.
 * Input: the sidecar `<output>.build.json` that UomdBuild.BuildAndroidBatch writes next to the AAB/APK.
 * Usage: node tools/record_unity_build.mjs [path/to/uomd.aab]
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/evidence/unity-android-build.json');

export async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/** Validates the sidecar written by UomdBuild and merges it with file facts. Throws on anything inconsistent. */
export function buildRecord(sidecar, file, { bytes, sha256, commit }) {
  const required = ['result', 'format', 'signing', 'versionName', 'versionCode', 'applicationId', 'editorVersion', 'builtAt'];
  for (const key of required) if (sidecar[key] === undefined || sidecar[key] === '') throw new Error(`build sidecar is missing "${key}"`);
  if (sidecar.result !== 'Succeeded') throw new Error(`build result is ${sidecar.result}; nothing to record`);
  if (!['aab', 'apk'].includes(sidecar.format)) throw new Error(`unknown build format ${sidecar.format}`);
  if (!['debug', 'release'].includes(sidecar.signing)) throw new Error(`unknown signing ${sidecar.signing}`);
  if (!Number.isInteger(sidecar.versionCode) || sidecar.versionCode < 1) throw new Error('versionCode must be a positive integer');
  return {
    commit,
    file: basename(file),
    bytes,
    sha256,
    format: sidecar.format,
    signing: sidecar.signing,
    applicationId: sidecar.applicationId,
    versionName: sidecar.versionName,
    versionCode: sidecar.versionCode,
    minSdk: sidecar.minSdk,
    targetSdk: sidecar.targetSdk,
    architectures: sidecar.architectures,
    scriptingBackend: sidecar.scriptingBackend,
    editorVersion: sidecar.editorVersion,
    builtAt: sidecar.builtAt,
    durationSeconds: sidecar.durationSeconds
  };
}

async function main() {
  const file = process.argv[2] ?? join(ROOT, 'apps/unity/Builds/Android/uomd.aab');
  const sidecarPath = `${file}.build.json`;
  if (!existsSync(file) || !existsSync(sidecarPath)) throw new Error(`no build at ${file} (run bash apps/unity/cloud/unity_ci.sh build)`);
  const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8'));
  const commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const record = buildRecord(sidecar, file, { bytes: statSync(file).size, sha256: await sha256File(file), commit });
  writeFileSync(OUT, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`recorded ${record.format} ${record.versionName} (${record.versionCode}, ${record.signing}) ${record.bytes} bytes -> docs/evidence/unity-android-build.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
