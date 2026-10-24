import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM tool without type declarations
import { buildRecord, sha256File } from './record_unity_build.mjs';

const sidecar = {
  result: 'Succeeded',
  format: 'aab',
  signing: 'debug',
  versionName: '0.1.0',
  versionCode: 1,
  applicationId: 'io.github.mucaeksi.unawareofmydemise',
  minSdk: 24,
  targetSdk: 35,
  architectures: ['ARM64'],
  scriptingBackend: 'IL2CPP',
  editorVersion: '6000.0.58f2',
  builtAt: '2026-10-24T22:00:00Z',
  durationSeconds: 600
};
const facts = { bytes: 1234, sha256: 'ab'.repeat(32), commit: 'abc123def456' };
const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });

describe('record_unity_build', () => {
  it('merges the UomdBuild sidecar with file facts', () => {
    const record = buildRecord(sidecar, '/x/Builds/Android/uomd.aab', facts);
    expect(record).toMatchObject({ file: 'uomd.aab', bytes: 1234, commit: 'abc123def456', signing: 'debug', versionCode: 1, format: 'aab' });
  });

  it('refuses failed builds and incomplete or inconsistent sidecars', () => {
    expect(() => buildRecord({ ...sidecar, result: 'Failed' }, 'a.aab', facts)).toThrow(/Failed/);
    expect(() => buildRecord({ ...sidecar, versionName: '' }, 'a.aab', facts)).toThrow(/versionName/);
    expect(() => buildRecord({ ...sidecar, signing: 'unknown' }, 'a.aab', facts)).toThrow(/signing/);
    expect(() => buildRecord({ ...sidecar, versionCode: 0 }, 'a.aab', facts)).toThrow(/versionCode/);
    expect(() => buildRecord({ ...sidecar, format: 'zip' }, 'a.aab', facts)).toThrow(/format/);
  });

  it('hashes the file contents', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uomd-build-'));
    temps.push(dir);
    writeFileSync(join(dir, 'f.bin'), 'abc');
    expect(await sha256File(join(dir, 'f.bin'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
