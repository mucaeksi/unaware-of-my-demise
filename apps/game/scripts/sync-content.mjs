/* global URL, console */
// Copies the embedded base release into public/ so Vite serves/ships it at /content/base/.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = fileURLToPath(new URL('../../../content/base', import.meta.url));
const destRoot = fileURLToPath(new URL('../public/content/base', import.meta.url));

function syncDir(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  const entries = readdirSync(srcDir, { withFileTypes: true });
  const keep = new Set(entries.map((e) => e.name));
  for (const existing of readdirSync(destDir)) {
    if (!keep.has(existing)) {
      rmSync(join(destDir, existing), { recursive: true, force: true });
    }
  }
  for (const entry of entries) {
    const s = join(srcDir, entry.name);
    const d = join(destDir, entry.name);
    if (entry.isDirectory()) {
      syncDir(s, d);
    } else if (entry.isFile()) {
      const buf = readFileSync(s);
      if (existsSync(d) && statSync(d).size === buf.byteLength && readFileSync(d).equals(buf)) continue;
      writeFileSync(d, buf);
    }
  }
}

syncDir(srcRoot, destRoot);
console.log('content/base synced to apps/game/public/content/base');

