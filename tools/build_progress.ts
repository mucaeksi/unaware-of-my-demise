/**
 * Builds the data of the Control Center "Development" page from files that already are the source of truth:
 * docs/INFRA_ROADMAP.md (status matrix), docs/DECISIONS.md (decision log), docs/DEV_TRACKER.json (now / next / blocked / ideas),
 * git history and the curated screenshots in docs/evidence. Output (git-ignored): apps/admin/public/dev/.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/fsutil';

const OUT = join(ROOT, 'apps/admin/public/dev');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'evidence'), { recursive: true });

const rows = (file: string, first: RegExp): string[][] =>
  readFileSync(join(ROOT, file), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map((l) => l.slice(1, l.lastIndexOf('|')).split('|').map((c) => c.trim()))
    .filter((c) => first.test(c[0] ?? ''));

const roadmap = rows('docs/INFRA_ROADMAP.md', /^\d+$/).map((c) => ({ n: Number(c[0]), area: c[1] ?? '', status: c[2] ?? '', detail: c.slice(3).join(' | ') }));
const decisions = rows('docs/DECISIONS.md', /^D-\d+$/).map((c) => ({ id: c[0] ?? '', when: c[1] ?? '', what: c[2] ?? '', note: c.slice(3).join(' | ') }));
const tracker = JSON.parse(readFileSync(join(ROOT, 'docs/DEV_TRACKER.json'), 'utf8')) as Record<string, unknown>;

let commits: { sha: string; at: string; subject: string }[] = [];
try {
  commits = execFileSync('git', ['log', '-n', '40', '--pretty=format:%h%x1f%cI%x1f%s'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [sha = '', at = '', subject = ''] = l.split('\x1f');
      return { sha, at, subject };
    });
} catch {
  /* shallow or no git: the page simply shows no history */
}

const evDir = join(ROOT, 'docs/evidence');
const screens = existsSync(evDir)
  ? readdirSync(evDir)
      .filter((f) => f.endsWith('.webp'))
      .sort((a, b) => {
        const aIsAab = a.startsWith('aab-') ? 0 : 1;
        const bIsAab = b.startsWith('aab-') ? 0 : 1;
        return aIsAab !== bIsAab ? aIsAab - bIsAab : a.localeCompare(b);
      })
      .map((f) => {
        copyFileSync(join(evDir, f), join(OUT, 'evidence', f));
        return { file: f, caption: f.replace(/\.webp$/, '').replace(/[-_]+/g, ' ') };
      })
  : [];

// Copy Base AAB & Approved Art media + JSON data into /dev/media/ so Control Center pages can preview/edit all game files
function copyTree(srcDir: string, destDir: string): void {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const s = join(srcDir, entry.name);
    const d = join(destDir, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else if (entry.isFile() && /\.(webp|png|gif|jpg|ogg|json)$/i.test(entry.name)) copyFileSync(s, d);
  }
}
copyTree(join(ROOT, 'content/base'), join(OUT, 'media'));
copyTree(join(ROOT, 'narrative/15_Art_Workbench/ui_animations/gifs'), join(OUT, 'animations'));
const appArtDir = join(ROOT, 'content/approved_art/art');
if (existsSync(appArtDir)) {
  mkdirSync(join(OUT, 'media', 'art'), { recursive: true });
  for (const f of readdirSync(appArtDir).filter((n) => n.endsWith('.webp'))) {
    copyFileSync(join(appArtDir, f), join(OUT, 'media', 'art', f));
  }
}

const baseRel = JSON.parse(readFileSync(join(ROOT, 'content/base/release.json'), 'utf8')) as {
  release: { id: string; generation: number; channel: string; notes: string };
  compat: { min_client: string; content_schema: number };
  files: { path: string; sha256: string; bytes: number; media_type: string; kind: string }[];
};
const entriesDir = join(ROOT, 'content/approved_art/entries');
const approvedEntries = existsSync(entriesDir)
  ? readdirSync(entriesDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => {
        const e = JSON.parse(readFileSync(join(entriesDir, f), 'utf8')) as {
          asset_id: string;
          class: string;
          revision: number;
          outputs: { path: string; sha256: string; bytes: number; width?: number; height?: number }[];
          qc?: { human?: { status?: string; note?: string } };
        };
        return {
          asset_id: e.asset_id,
          class: e.class,
          revision: e.revision,
          path: e.outputs[0]?.path ?? '',
          sha256: e.outputs[0]?.sha256 ?? '',
          bytes: e.outputs[0]?.bytes ?? 0,
          dims: e.outputs[0]?.width && e.outputs[0]?.height ? `${e.outputs[0].width}×${e.outputs[0].height}` : '',
          note: e.qc?.human?.note ?? ''
        };
      })
  : [];

const baseRelease = {
  id: baseRel.release.id,
  generation: baseRel.release.generation,
  minClient: baseRel.compat.min_client,
  notes: baseRel.release.notes,
  fileCount: baseRel.files.length,
  totalBytes: baseRel.files.reduce((sum, x) => sum + x.bytes, 0),
  approvedArtCount: approvedEntries.length,
  approvedEntries,
  files: baseRel.files
};

const count = (needle: string): number => roadmap.filter((r) => r.status.includes(needle)).length;
writeFileSync(
  join(OUT, 'progress.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), summary: { total: roadmap.length, done: count('✅'), partial: count('🟡'), missing: count('❌') }, baseRelease, roadmap, decisions, commits, screens, ...tracker }, null, 1)
);
console.log(`progress.json: ${roadmap.length} roadmap rows, ${decisions.length} decisions, ${commits.length} commits, ${screens.length} screens, ${approvedEntries.length} approved art entries`);

