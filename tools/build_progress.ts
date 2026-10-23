/**
 * Builds the data of the Control Center "Development" page from files that already are the source of truth:
 * docs/INFRA_ROADMAP.md (status matrix), docs/DECISIONS.md (decision log), docs/DEV_TRACKER.json (now / next / blocked / ideas),
 * git history and the curated screenshots in docs/evidence. Output (git-ignored): apps/admin/public/dev/.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { MEDIA_TYPE_BY_EXTENSION, type AllowedExtension } from '../packages/content-schema/src/index';
import { chapterPatch } from './lib/chapter-patch';
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
copyTree(join(ROOT, 'docs/store/assets'), join(OUT, 'store'));
const storeDir = join(ROOT, 'docs/store/assets');
const storeScreenshotsDir = join(storeDir, 'screenshots');
const storeAssets: { file: string; label: string; kind: 'brand' | 'screenshot' }[] = [];
if (existsSync(storeDir)) {
  for (const [f, label] of [
    ['icon_512.png', 'Google Play App Icon (512×512 32-bit RGBA)'],
    ['logo_master.png', 'Master Brand Logo (1600×760 32-bit RGBA)'],
    ['logo_compact.png', 'Compact Brand Logo (960×360 32-bit RGBA)'],
    ['feature_graphic_1024x500.png', 'Google Play Feature Graphic (1024×500 24-bit RGB)']
  ] as const) {
    if (existsSync(join(storeDir, f))) storeAssets.push({ file: f, label, kind: 'brand' });
  }
}
if (existsSync(storeScreenshotsDir)) {
  for (const f of readdirSync(storeScreenshotsDir).filter((n) => n.endsWith('.png')).sort()) {
    storeAssets.push({
      file: `screenshots/${f}`,
      label: f.replace(/\.png$/, '').replace(/[-_]+/g, ' '),
      kind: 'screenshot'
    });
  }
}
const appArtDir = join(ROOT, 'content/approved_art/art');
if (existsSync(appArtDir)) {
  mkdirSync(join(OUT, 'media', 'art'), { recursive: true });
  for (const f of readdirSync(appArtDir).filter((n) => n.endsWith('.webp'))) {
    copyFileSync(join(appArtDir, f), join(OUT, 'media', 'art', f));
  }
}
const campDir = join(ROOT, 'content/patches/rel_0003_part1_campaign');
const campManifest = join(campDir, 'art/art_manifest.json');
if (existsSync(campManifest)) {
  mkdirSync(join(OUT, 'media', 'art'), { recursive: true });
  copyFileSync(campManifest, join(OUT, 'media', 'art', 'campaign_art_manifest.json'));
}
const campWorldMap = join(campDir, 'world/world_map.json');
if (existsSync(campWorldMap)) {
  mkdirSync(join(OUT, 'media', 'world'), { recursive: true });
  copyFileSync(campWorldMap, join(OUT, 'media', 'world', 'world_map.json'));
}
const campChapterIdx = join(campDir, 'chapters/chapter_index.json');
if (existsSync(campChapterIdx)) {
  mkdirSync(join(OUT, 'media', 'chapters'), { recursive: true });
  copyFileSync(campChapterIdx, join(OUT, 'media', 'chapters', 'campaign_chapter_index.json'));
}
const campUnitPack = join(campDir, 'units/unit_pack.json');
if (existsSync(campUnitPack)) {
  mkdirSync(join(OUT, 'media', 'units'), { recursive: true });
  copyFileSync(campUnitPack, join(OUT, 'media', 'units', 'campaign_unit_pack.json'));
}

const baseRel = JSON.parse(readFileSync(join(ROOT, 'content/base/release.json'), 'utf8')) as {
  release: { id: string; generation: number; channel: string; notes: string };
  compat: { min_client: string; content_schema: number };
  files: { path: string; sha256: string; bytes: number; media_type: string; kind: string }[];
};

// Build D-29 1-click release presets for the Control Center Releases page (/dev/releases/presets.json)
const shaHex = (buf: Uint8Array): string => createHash('sha256').update(buf).digest('hex');
const mediaType = (p: string): string => MEDIA_TYPE_BY_EXTENSION[p.split('.').pop() as AllowedExtension] ?? 'application/octet-stream';
const mediaHashes = new Map<string, string>();
for (const f of baseRel.files) mediaHashes.set(f.path, f.sha256);
if (existsSync(appArtDir)) {
  for (const f of readdirSync(appArtDir).filter((n) => n.endsWith('.webp'))) {
    const rel = `art/${f}`;
    mediaHashes.set(rel, shaHex(readFileSync(join(OUT, 'media', rel))));
  }
}
if (existsSync(campWorldMap)) mediaHashes.set('world/world_map.json', shaHex(readFileSync(campWorldMap)));

const fullCampFiles = new Map<string, Uint8Array>();
const fullCampHashes = new Map<string, string>();
if (existsSync(campDir)) {
  const walkCamp = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walkCamp(p);
      else if (e.name !== 'release.json') {
        const rel = relative(campDir, p).replaceAll('\\', '/');
        const bytes = new Uint8Array(readFileSync(p));
        const sha = shaHex(bytes);
        fullCampFiles.set(rel, bytes);
        fullCampHashes.set(rel, sha);
        if (mediaHashes.get(rel) !== sha) {
          const dest = join(OUT, 'patches', 'full', rel);
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, bytes);
        }
      }
    }
  };
  walkCamp(campDir);
}

interface PresetFileEntry {
  path: string;
  sha256: string;
  bytes: number;
  mediaType: string;
  url: string;
}
interface ReleasePreset {
  id: string;
  label: string;
  dependsOn?: string;
  notes: string;
  minClient: string;
  files: PresetFileEntry[];
}
const releasePresets: ReleasePreset[] = [
  {
    id: 'rel_0001',
    label: 'Base AAB v0.1.2 (rel_0001)',
    notes: baseRel.release.notes,
    minClient: baseRel.compat.min_client,
    files: baseRel.files.map((f) => ({
      path: f.path,
      sha256: f.sha256,
      bytes: f.bytes,
      mediaType: f.media_type,
      url: `/dev/media/${f.path}`
    }))
  }
];
if (fullCampFiles.size > 0) {
  for (let ch = 1; ch <= 7; ch++) {
    const snap = chapterPatch(fullCampFiles, ch);
    const pFiles: PresetFileEntry[] = [];
    for (const [rel, bytes] of snap) {
      const sha = shaHex(bytes);
      let url: string;
      if (mediaHashes.get(rel) === sha) url = `/dev/media/${rel}`;
      else if (fullCampHashes.get(rel) === sha) url = `/dev/patches/full/${rel}`;
      else {
        const dest = join(OUT, 'patches', `ch${ch}`, rel);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, bytes);
        url = `/dev/patches/ch${ch}/${rel}`;
      }
      pFiles.push({ path: rel, sha256: sha, bytes: bytes.byteLength, mediaType: mediaType(rel), url });
    }
    releasePresets.push({
      id: `rel_part1_ch${ch}`,
      label: ch === 1 ? 'Patch 1 — Part I Ch.1 + World Map Hub (rel_part1_ch1)' : ch === 7 ? 'Patch 7 — Part I Ch.1–7 + Hard Mode (rel_part1_ch7)' : `Patch ${ch} — Part I Ch.1–${ch} (rel_part1_ch${ch})`,
      dependsOn: 'rel_0001',
      notes: ch === 1 ? 'D-29 Phase C: Part I Chapter 1 + World Map Hub + 52 animated units' : `D-29 Phase D: Part I Chapters 1..${ch}${ch === 7 ? ' + Hard Mode' : ''}`,
      minClient: baseRel.compat.min_client,
      files: pFiles
    });
  }
  releasePresets.push({
    id: 'rel_0003_part1_campaign',
    label: 'Full Part I Campaign + Hard Mode (rel_0003_part1_campaign)',
    dependsOn: 'rel_0001',
    notes: 'Full Part I Campaign (Chapters 1–7, 35 Normal + 35 Hard stages, World Map, 52 animated units)',
    minClient: baseRel.compat.min_client,
    files: Array.from(fullCampFiles.entries()).map(([rel, bytes]) => {
      const sha = fullCampHashes.get(rel)!;
      return {
        path: rel,
        sha256: sha,
        bytes: bytes.byteLength,
        mediaType: mediaType(rel),
        url: mediaHashes.get(rel) === sha ? `/dev/media/${rel}` : `/dev/patches/full/${rel}`
      };
    })
  });
}
mkdirSync(join(OUT, 'releases'), { recursive: true });
writeFileSync(join(OUT, 'releases', 'presets.json'), JSON.stringify({ presets: releasePresets }, null, 1));
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
  JSON.stringify({ generatedAt: new Date().toISOString(), summary: { total: roadmap.length, done: count('✅'), partial: count('🟡'), missing: count('❌') }, baseRelease, roadmap, decisions, commits, screens, storeAssets, ...tracker }, null, 1)
);
console.log(`progress.json: ${roadmap.length} roadmap rows, ${decisions.length} decisions, ${commits.length} commits, ${screens.length} screens, ${approvedEntries.length} approved art entries`);

