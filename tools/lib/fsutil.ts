import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');

/**
 * Commit that still holds the approved legacy tutorial art the content build reads through `git show` (retired Godot-era tree,
 * also kept on the read-only branch archive/godot-era). Provisional until Google-generated art replaces it; see content/provenance.json.
 */
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

export function campaignPortraitIds(): Set<string> {
  const ids = new Set<string>(['mahmut', 'fadyme']);
  const entriesDir = join(ROOT, 'content/approved_art/entries');
  if (existsSync(entriesDir)) {
    for (const file of readdirSync(entriesDir).filter((f) => f.endsWith('.json')).sort()) {
      const entry = JSON.parse(readFileSync(join(entriesDir, file), 'utf8')) as {
        qc?: { human?: { status?: string } };
        targets?: { portraits?: Record<string, unknown> };
      };
      if (entry.qc?.human?.status === 'rejected') continue;
      for (const charId of Object.keys(entry.targets?.portraits ?? {})) ids.add(charId);
    }
  }
  return ids;
}
