import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');

/** The legacy Godot runtime snapshot that owns the approved tutorial art (see content/SOURCES.md). */
export const LEGACY_COMMIT = '25dc0b2521d90a44a1125a8ceba328adf84babda';

export const sha256 = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex');

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;
}

export function writeOut(path: string, data: Buffer | string): void {
  const full = join(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, data);
}

export function writeJson(path: string, value: unknown): string {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  writeOut(path, text);
  return text;
}

/** Reads a file out of Git history (never from the working tree), caching under .cache/. */
export function legacyBlob(path: string): Buffer {
  const cache = join(ROOT, '.cache', 'legacy', LEGACY_COMMIT.slice(0, 12), path);
  if (existsSync(cache)) return readFileSync(cache);
  const buf = execFileSync('git', ['show', `${LEGACY_COMMIT}:${path}`], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, buf);
  return buf;
}

export function fileBytes(path: string): Buffer {
  return readFileSync(join(ROOT, path));
}
