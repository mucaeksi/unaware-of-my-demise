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
      .sort()
      .map((f) => {
        copyFileSync(join(evDir, f), join(OUT, 'evidence', f));
        return { file: f, caption: f.replace(/\.webp$/, '').replace(/[-_]+/g, ' ') };
      })
  : [];

const count = (needle: string): number => roadmap.filter((r) => r.status.includes(needle)).length;
writeFileSync(
  join(OUT, 'progress.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), summary: { total: roadmap.length, done: count('✅'), partial: count('🟡'), missing: count('❌') }, roadmap, decisions, commits, screens, ...tracker }, null, 1)
);
console.log(`progress.json: ${roadmap.length} roadmap rows, ${decisions.length} decisions, ${commits.length} commits, ${screens.length} screens`);
