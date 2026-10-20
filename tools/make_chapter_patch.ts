/**
 * D-29 A3: writes the "Part I chapters 1..N" patch folder from the full campaign build, ready for publish_release.
 * Run: npx tsx tools/make_chapter_patch.ts --chapters 1 [--out .cache/patches/part1_ch1]
 * Then: npx tsx tools/publish_release.ts --admin "$UOMD_ADMIN_URL" --dir <out> --id rel_part1_ch1 --channel staging --depends rel_0001
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { chapterPatch } from './lib/chapter-patch';
import { ROOT } from './lib/fsutil';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const chapters = Number(arg('chapters'));
const out = join(ROOT, arg('out') ?? `.cache/patches/part1_ch${chapters}`);
const src = join(ROOT, 'content/patches/rel_0003_part1_campaign');

const files = new Map<string, Uint8Array>();
const walk = (d: string): void => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.set(relative(src, p).replaceAll('\\', '/'), new Uint8Array(readFileSync(p)));
  }
};
walk(src);

const patch = chapterPatch(files, chapters);
rmSync(out, { recursive: true, force: true });
for (const [path, bytes] of patch) {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), bytes);
}
console.log(`Part I chapters 1..${chapters}: ${patch.size} files -> ${relative(ROOT, out)}`);
