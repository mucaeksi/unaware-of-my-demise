/**
 * Builds the data of the Control Center "Development" page from files that already are the source of truth:
 * docs/INFRA_ROADMAP.md (status matrix), docs/DECISIONS.md (decision log), docs/DEV_TRACKER.json (now / next / blocked / ideas),
 * git history and the curated screenshots in docs/evidence. Output (git-ignored): apps/admin/public/dev/.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
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

// Copy Workbench visual archives (CGs, Icons, Icon Sheets, UI Kit, UI Screen Concepts, Character/Boss Concept Sheets)
copyTree(join(ROOT, 'narrative/15_Art_Workbench/cg'), join(OUT, 'workbench/cg'));
copyTree(join(ROOT, 'narrative/15_Art_Workbench/icons/production_v001/icons_rgba'), join(OUT, 'workbench/icons'));
copyTree(join(ROOT, 'narrative/15_Art_Workbench/ui_screens/production_v001/ui_kit'), join(OUT, 'workbench/ui_kit'));
const wbIconsRoot = join(ROOT, 'narrative/15_Art_Workbench/icons');
if (existsSync(wbIconsRoot)) {
  mkdirSync(join(OUT, 'workbench/icons_sheets'), { recursive: true });
  for (const f of readdirSync(wbIconsRoot, { withFileTypes: true })) {
    if (f.isFile() && /\.(jpg|png|webp)$/i.test(f.name)) {
      copyFileSync(join(wbIconsRoot, f.name), join(OUT, 'workbench/icons_sheets', f.name));
    }
  }
  const coreSheet = join(wbIconsRoot, 'production_v001/icons_core_01_sheet_rgba_v001.png');
  if (existsSync(coreSheet)) {
    copyFileSync(coreSheet, join(OUT, 'workbench/icons_sheets/icons_core_01_sheet_rgba_v001.png'));
  }
}
const wbUiScreensRoot = join(ROOT, 'narrative/15_Art_Workbench/ui_screens');
if (existsSync(wbUiScreensRoot)) {
  mkdirSync(join(OUT, 'workbench/ui_screens'), { recursive: true });
  for (const f of readdirSync(wbUiScreensRoot, { withFileTypes: true })) {
    if (f.isFile() && /\.(jpg|png|webp)$/i.test(f.name)) {
      copyFileSync(join(wbUiScreensRoot, f.name), join(OUT, 'workbench/ui_screens', f.name));
    }
  }
}
mkdirSync(join(OUT, 'workbench/sheets'), { recursive: true });
function collectConceptSheets(dir: string): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) collectConceptSheets(p);
    else if (
      /\.(jpg|png|webp)$/i.test(e.name) &&
      ((p.includes('sheet') && !p.includes('chibi')) || e.name === 'kera_voss_gacha_splash_v001.png' || e.name === 'kera_voss_canonical_boydan_lock.jpg')
    ) {
      copyFileSync(p, join(OUT, 'workbench/sheets', e.name));
    }
  }
}
collectConceptSheets(join(ROOT, 'narrative/15_Art_Workbench/characters'));
collectConceptSheets(join(ROOT, 'narrative/15_Art_Workbench/enemies'));

// Build comprehensive, 100% disk-verified Review Catalog across all 12 categories
interface ReviewCatalogItem {
  id: string;
  category:
    | 'STEPS'
    | 'BANNERS'
    | 'PORTRAITS'
    | 'CHIBI_ATLAS'
    | 'CONCEPT_SHEETS'
    | 'BACKGROUNDS'
    | 'STILLS_CG'
    | 'ICONS_WEAPONS'
    | 'UI_BRAND_STORE'
    | 'AUDIO_SFX_BGM'
    | 'VOICES'
    | 'EVIDENCE_SCREENS';
  badge: string;
  origin: 'd30_new' | 'prev_approved';
  title: string;
  subtitle: string;
  description: string;
  imageUrl?: string;
  audioUrl?: string;
  sceneJump?: string;
  targetPath: string;
  dims?: string;
  bytes?: number;
  sha256?: string;
}

const prettyId = (s: string): string =>
  s
    .replace(/\.(webp|png|jpg|gif|ogg)$/i, '')
    .replace(/_v\d+$/i, '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const charNames = new Map<string, { name: string; role: string; rarity: number }>();
const charSnapPath = join(ROOT, 'narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/characters_part1.json');
if (existsSync(charSnapPath)) {
  const { characters } = JSON.parse(readFileSync(charSnapPath, 'utf8')) as {
    characters: { character_id: string; name_en: string; role: string; rarity: number }[];
  };
  for (const c of characters) charNames.set(c.character_id, { name: c.name_en, role: c.role, rarity: c.rarity });
}

const reviewCatalog: ReviewCatalogItem[] = [
  // 1. STEPS (7 core D-30 deliverables)
  {
    id: 'step_4_1_art_audit_objectives',
    category: 'STEPS',
    badge: '§4.1 · cebb36d4',
    origin: 'd30_new',
    title: '§4.1 Sanat Yönetimi Denetimi, Alt-Kare Pivot Düzeltmesi & 9×3 Boss Objective Atlası',
    subtitle: '258 Onaylı Eser Denetimi · 1728×576 (27 Hücre) Kırılabilir Boss Hedefleri · Phone-Landscape FPS/RAM',
    description:
      'UnitView, CharacterScene ve Animations.tsx içindeki alt-kare (idle_2, basic_2, vb.) pivot kayması düzeltildi. atlas_objective.webp 4×4 yerine 9×3 (1728×576, 27 hücre: intact/pulse/broken) olarak yeniden üretildi ve 13 boss hedefinin 8 animasyon durumuna bağlandı.',
    imageUrl: '/dev/media/art/atlas_objective.webp',
    sceneJump: 'battle_t3',
    targetPath: 'content/approved_art/art/atlas_objective.webp · apps/game/src/battle/UnitView.ts',
    dims: '1728×576'
  },
  {
    id: 'step_4_2_signature_vfx',
    category: 'STEPS',
    badge: '§4.2 · e7b7fab2',
    origin: 'd30_new',
    title: '§4.2 Signature VFX — 52 Birim İçin 115 Özel Preset & 133 Yetenek Bağlantısı',
    subtitle: '25 Kahraman + 7 Boss + 20 Düşman · 5 Yeni Amblem Dokusu · 4 Vektör Şekil · Hit-Stop & Shake',
    description:
      'VfxStage ve @uomd/content-schema içine bell, chain, seal, droplet, feather dokuları ile bell_arch, shield_wall, eclipse_corona, crosshair şekilleri eklendi. 133 aktif/temel/ultimate/imza yeteneğin tamamı karaktere özel VFX presetlerine bağlandı.',
    imageUrl: '/dev/store/screenshots/03_tactical_battle.png',
    sceneJump: 'battle_t3',
    targetPath: 'content/base/vfx/vfx_presets.json · apps/game/src/vfx/VfxStage.ts',
    dims: '1920×1080'
  },
  {
    id: 'step_4_3_identity_locks',
    category: 'STEPS',
    badge: '§4.3 · b7cbe3e7',
    origin: 'd30_new',
    title: '§4.3 Art Bible §4.11–§4.29 Kanonik Kimlik Çapaları & SHA-256 Kilit Tablosu',
    subtitle: '32 Konuşan Karakter Portre Kilidi (128 WebP) + 52 Savaş Birimi Chibi Atlas Kilidi · 53 Varlık Kuyruğu',
    description:
      'ART_BIBLE.md içine 17 kahraman, 7 Part I boss + Lord Cael Veyr ve 18 düşman için birebir kanon çapaları eklendi; CHARACTER_LOCKS.md içine tüm SHA-256 kilitleri işlendi; QUEUE_DATA.json 53 varlığa genişletildi ($0.00 harcama).',
    imageUrl: '/dev/store/screenshots/05_companion_roster.png',
    sceneJump: 'roster',
    targetPath: 'docs/media/ART_BIBLE.md · content/specs/character_locks/CHARACTER_LOCKS.md',
    dims: '1920×1080'
  },
  {
    id: 'step_4_4_banners_in_game',
    category: 'STEPS',
    badge: '§4.4 · 4cece6fe',
    origin: 'd30_new',
    title: '§4.4 16 Kanonik Gacha Banner Görseli (1376×768) — Summon & Dünya Haritası Vitrini',
    subtitle: '2 Kalıcı + 7 Oath Karakter + 7 İmza Silah Bannerı · SummonScene (940×440) & HomeScene (340×150)',
    description:
      'Eksik 5 banner master görseli üretildi, 16 bannerın tamamı approved_art kataloğuna alındı, BannerConfig.artKey eklendi, SummonScene vitrin kartına ve Dünya Haritası (HomeScene) LIMITED OATH SPOTLIGHT kartına bağlandı.',
    imageUrl: '/dev/media/art/ui_banner_oath_01_sister.webp',
    sceneJump: 'summon',
    targetPath: 'apps/game/src/scenes/SummonScene.ts · apps/game/src/scenes/HomeScene.ts',
    dims: '1376×768'
  },
  {
    id: 'step_4_5_motion_polish',
    category: 'STEPS',
    badge: '§4.5 · 50c8be33',
    origin: 'd30_new',
    title: '§4.5 Chibi, VN Portre, Summon Kart Açılışı & Hub Modal Hareket Cilası',
    subtitle: '2 Fazlı Anticipation/Impact Chibi İvmesi · Taban Sabitli VN Nefes & Konuşma Nabzı · 4★/5★ Hale Açılışı',
    description:
      'UnitView aksiyonlarında 2 fazlı geri çekilme + ileri vuruş ve 1.35× impact-hold; StoryScene içinde sahne anim.timeScale uyumlu altyazı sayacı, (0.5, 1) taban sabitli nefes, konuşma nabzı ve çift-opaklık yapmayan duygu geçişi; SummonScene kademeli kart açılışı.',
    imageUrl: '/dev/animations/08_kera_voss_chibi_combat_combo.gif',
    sceneJump: 'story_t1',
    targetPath: 'apps/game/src/battle/UnitView.ts · apps/game/src/scenes/StoryScene.ts · apps/game/src/scenes/SummonScene.ts'
  },
  {
    id: 'step_4_6_audio_sfx_music',
    category: 'STEPS',
    badge: '§4.6 · 493338eb',
    origin: 'd30_new',
    title: '§4.6 16 Kanonik Ogg Vorbis SFX Seti (presentation.sounds) & Bölüm 1–7 / Boss Müzik Motifleri',
    subtitle: 'UI, Adım, Kılıç, Kalkan, Çan, Statü ve Ultimate SFX · 7 Lyria 3.5 Müzik Motifi Eşlemesi',
    description:
      'tools/build_sfx_pack.mjs ile 16 adet Ogg Vorbis SFX üretildi, presentation.json sounds tablosuna ve SFX_PROVENANCE.json lisans kaydına eklendi. StoryScene ve BattleScene içinde Bölüm 1–7 ve 7 Boss karşılaşması Lyria 3.5 motiflerine bağlandı.',
    audioUrl: '/dev/media/sfx/sfx_ultimate_release.ogg',
    sceneJump: 'battle_t1',
    targetPath: 'content/base/presentation/presentation.json · apps/game/src/audio/Sfx.ts'
  },
  {
    id: 'step_4_7_narrative_upkeep',
    category: 'STEPS',
    badge: '§4.7 · 7138437f',
    origin: 'd30_new',
    title: '§4.7 Narrative Upkeep & Kanonik Kuyruk / Dokümantasyon Senkronizasyonu',
    subtitle: '258 Onaylı Sanat Eseri · 415 R2/D1 Seed Varlığı · 204 Base İçerik Dosyası · $0.00 / $20.00 Bütçe',
    description:
      'narrative/11_Audio_Cues/README_SOURCE.md, docs/media/QUEUE_DATA.json, docs/media/QUEUE.md, docs/DEV_TRACKER.json ve docs/NEXT_STEPS.md canlı oyun durumu ile birebir senkronize edildi.',
    imageUrl: '/dev/store/feature_graphic_1024x500.png',
    sceneJump: 'chapters',
    targetPath: 'docs/media/QUEUE_DATA.json · docs/DEV_TRACKER.json · docs/NEXT_STEPS.md',
    dims: '1024×500'
  }
];

// 2. BANNERS (16 canonical banners from approvedEntries)
const BANNER_META: Record<string, { title: string; sub: string; desc: string }> = {
  banner_hall_of_ancestors: {
    title: 'Hall of Ancestors — Kalıcı Kahraman Çağırma Bannerı',
    sub: '1376×768 WebP · Standart Kahraman Havuzu (Mahmut, Fadyme & 4★/3★ Yoldaşlar)',
    desc: 'SummonScene (Hall of Ancestors) ve Dünya Haritası varsayılan vitrin görseli.'
  },
  banner_hall_of_armaments_weapons: {
    title: 'Hall of Armaments — Kalıcı İmza Silah Bannerı',
    sub: '1376×768 WebP · Seçilebilir Hedefli 18 İmza Silah Havuzu',
    desc: 'Kalıcı 5★ imza silahları ve 4★/3★ silah aileleri için çağrı vitrini.'
  },
  banner_oath_01_sister: {
    title: 'Oath #1: Ashen Vigil — Sister Aveline (5★ Karakter Bannerı)',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #1 Kahramanı',
    desc: 'Sister Aveline sınırlı süreli karakter çağrı vitrin görseli.'
  },
  banner_oath_01_weapon: {
    title: 'Oath #1 Silah: Last Vigil of Saint Luthos — Sister Aveline İmza Silahı',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #1 Silah Bannerı',
    desc: 'Sister Aveline 5★ imza silahı (weapon_aveline_last_vigil) çağrı vitrini.'
  },
  banner_oath_02_sable: {
    title: 'Oath #2: Shadow Under Glass — Sable Wren (5★ Karakter Bannerı)',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #2 Kahramanı',
    desc: 'Sable Wren sınırlı süreli karakter çağrı vitrin görseli.'
  },
  banner_oath_02_weapon: {
    title: 'Oath #2 Silah: Broken Bell Misericorde — Sable Wren İmza Silahı',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #2 Silah Bannerı',
    desc: 'Sable Wren 5★ imza silahı (weapon_sable_broken_bell) çağrı vitrini.'
  },
  banner_oath_03_nara: {
    title: 'Oath #3: Iron on the Bridge — Nara Vell (5★ Karakter Bannerı)',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #3 Kahramanı',
    desc: 'Nara Vell sınırlı süreli karakter çağrı vitrin görseli.'
  },
  banner_oath_03_weapon: {
    title: 'Oath #3 Silah: Gatewarden’s Promise — Nara Vell İmza Silahı',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #3 Silah Bannerı',
    desc: 'Nara Vell 5★ imza silahı (weapon_nara_gatewarden_promise) çağrı vitrini.'
  },
  banner_oath_04_mirel: {
    title: 'Oath #4: Ink of the Ledger — Mirel Quill (5★ Karakter Bannerı)',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #4 Kahramanı',
    desc: 'Mirel Quill sınırlı süreli karakter çağrı vitrin görseli.'
  },
  banner_oath_04_weapon: {
    title: 'Oath #4 Silah: Unwritten Ledger — Mirel Quill İmza Silahı',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #4 Silah Bannerı',
    desc: 'Mirel Quill 5★ imza silahı (weapon_mirel_unwritten_ledger) çağrı vitrini.'
  },
  banner_oath_05_vespera: {
    title: 'Oath #5: Lantern in the Mist — Vespera Wisp (5★ Karakter Bannerı)',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #5 Kahramanı',
    desc: 'Vespera Wisp sınırlı süreli karakter çağrı vitrin görseli.'
  },
  banner_oath_05_weapon: {
    title: 'Oath #5 Silah: The Last Hour — Vespera Wisp İmza Silahı',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #5 Silah Bannerı',
    desc: 'Vespera Wisp 5★ imza silahı (weapon_vespera_last_hour) çağrı vitrini.'
  },
  banner_oath_06_garrick: {
    title: 'Oath #6: Forge of the Ashgate — Garrick Cinder (5★ Karakter Bannerı)',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #6 Kahramanı',
    desc: 'Garrick Cinder sınırlı süreli karakter çağrı vitrin görseli.'
  },
  banner_oath_06_weapon: {
    title: 'Oath #6 Silah: Ashgate Anvil-Hammer — Garrick Cinder İmza Silahı',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #6 Silah Bannerı',
    desc: 'Garrick Cinder 5★ imza silahı (weapon_garrick_cinder_signature) çağrı vitrini.'
  },
  banner_oath_07_corbin: {
    title: 'Oath #7: Key of the Undercroft — Corbin Locke (5★ Karakter Bannerı)',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #7 Kahramanı',
    desc: 'Corbin Locke sınırlı süreli karakter çağrı vitrin görseli.'
  },
  banner_oath_07_weapon: {
    title: 'Oath #7 Silah: Undercroft Reliquary — Corbin Locke İmza Silahı',
    sub: '1376×768 WebP · Sınırlı Süreli Oath #7 Silah Bannerı',
    desc: 'Corbin Locke 5★ imza silahı (weapon_corbin_locke_signature) çağrı vitrini.'
  }
};
for (const e of approvedEntries.filter((x) => x.class === 'banner')) {
  const m = BANNER_META[e.asset_id] ?? {
    title: `${prettyId(e.asset_id)} — Gacha Banner`,
    sub: `${e.dims || '1376×768'} WebP · Rev r${e.revision}`,
    desc: e.note || 'Kanonik Gacha Banner görseli.'
  };
  reviewCatalog.push({
    id: e.asset_id,
    category: 'BANNERS',
    badge: `Banner · r${e.revision}`,
    origin: 'd30_new',
    title: m.title,
    subtitle: m.sub,
    description: `${m.desc} (${e.note})`,
    imageUrl: `/dev/media/${e.path}`,
    sceneJump: 'summon',
    targetPath: `content/approved_art/${e.path}`,
    dims: e.dims,
    bytes: e.bytes,
    sha256: e.sha256
  });
}

// 3. PORTRAITS (128 portraits across 32 speaking characters × 4 emotions)
const EMOTION_TR: Record<string, string> = {
  composed: 'Sakin / Composed',
  grave: 'Ağırbaşlı / Grave',
  resolute: 'Kararlı / Resolute',
  strained: 'Gergin-Yaralı / Strained'
};
for (const e of approvedEntries.filter((x) => x.class === 'portrait')) {
  const baseName = basename(e.path, '.webp').replace(/^portrait_/, '');
  const parts = baseName.split('_');
  const emotionKey = parts.pop() ?? 'composed';
  const charId = parts.join('_');
  const info = charNames.get(charId);
  const charTitle = info ? `${info.name} (${info.rarity}★ ${info.role})` : prettyId(charId);
  const emoLabel = EMOTION_TR[emotionKey] ?? prettyId(emotionKey);
  reviewCatalog.push({
    id: `portrait_${baseName}`,
    category: 'PORTRAITS',
    badge: `VN Portre · ${emoLabel}`,
    origin: 'prev_approved',
    title: `${charTitle} — ${emoLabel}`,
    subtitle: `${e.dims || '896×1280'} Alfa-Keyed WebP · Rev r${e.revision} · ${(e.bytes / 1024).toFixed(1)} KB`,
    description: `Görsel Roman (StoryScene) boydan konuşma portresi ve diyalog duygu durumu (${emotionKey}). QC Notu: ${e.note || 'Kanonik kilitli portre.'}`,
    imageUrl: `/dev/media/${e.path}`,
    sceneJump: 'story_t1',
    targetPath: `content/approved_art/${e.path}`,
    dims: e.dims,
    bytes: e.bytes,
    sha256: e.sha256
  });
}

// 4. CHIBI_ATLAS (1 objective atlas 9×3 + 54 unit chibi sheets 4×4)
const objPath = join(OUT, 'media/art/atlas_objective.webp');
if (existsSync(objPath)) {
  const objBytes = readFileSync(objPath);
  reviewCatalog.push({
    id: 'atlas_objective_9x3',
    category: 'CHIBI_ATLAS',
    badge: 'Boss Hedef Atlası · 9×3 (27 Hücre)',
    origin: 'd30_new',
    title: 'atlas_objective.webp — 9×3 (1728×576) Kırılabilir Boss Hedefleri Atlası',
    subtitle: '1728×576 WebP · 9 Sütun × 3 Durum (Intact / Pulse / Broken) · 13 Boss Hedefi',
    description: 'Part I içindeki 13 boss hedefinin (çanlar, zincirler, rölikerler, mühürler) sağlam, nabız ve kırılmış durumlarını içeren 27 hücreli savaş atlası.',
    imageUrl: '/dev/media/art/atlas_objective.webp',
    sceneJump: 'battle_t3',
    targetPath: 'content/approved_art/art/atlas_objective.webp',
    dims: '1728×576',
    bytes: objBytes.byteLength,
    sha256: shaHex(new Uint8Array(objBytes))
  });
}
for (const e of approvedEntries.filter((x) => x.class === 'unit_sheet')) {
  const unitId = basename(e.path, '.webp').replace(/^atlas_/, '');
  const info = charNames.get(unitId);
  const isBoss = unitId.startsWith('boss_');
  const unitLabel = info
    ? `${info.name} (${info.rarity}★ Kahraman · ${info.role})`
    : isBoss
      ? `${prettyId(unitId)} (Part I Boss)`
      : `${prettyId(unitId)} (Düşman Birimi)`;
  reviewCatalog.push({
    id: `atlas_${unitId}`,
    category: 'CHIBI_ATLAS',
    badge: isBoss ? `Boss Chibi · r${e.revision}` : info ? `Kahraman Chibi · r${e.revision}` : `Düşman Chibi · r${e.revision}`,
    origin: 'prev_approved',
    title: `${unitLabel} — 16 Kare (4×4) Chibi Savaş Atlası`,
    subtitle: `${e.dims || '1024×1024'} Alfa-Keyed WebP · 8 Animasyon Durumu (Idle, Walk, Basic, Active, Ult, Hit, Defeat, Victory)`,
    description: `5v5 taktiksel savaş sahnesi (BattleScene / UnitView) 2-head SD chibi sprite atlası. QC: ${e.note || 'Onaylı 16-kare chibi sheet.'}`,
    imageUrl: `/dev/media/${e.path}`,
    sceneJump: 'battle_t1',
    targetPath: `content/approved_art/${e.path}`,
    dims: e.dims,
    bytes: e.bytes,
    sha256: e.sha256
  });
}

// 5. CONCEPT_SHEETS (53 character/boss/enemy turnaround & master sheets from Workbench)
const sheetsDir = join(OUT, 'workbench/sheets');
if (existsSync(sheetsDir)) {
  for (const f of readdirSync(sheetsDir).sort()) {
    const st = statSync(join(sheetsDir, f));
    const isBoss = f.startsWith('boss_');
    const isChar = f.startsWith('char_') || f.startsWith('kera_voss');
    reviewCatalog.push({
      id: `concept_${f.replace(/\.(jpg|png|webp)$/i, '')}`,
      category: 'CONCEPT_SHEETS',
      badge: isBoss ? 'Boss Konsept Paftası' : isChar ? 'Karakter Konsept Paftası' : 'Düşman Konsept Paftası',
      origin: 'prev_approved',
      title: `${prettyId(f)} — Karakter / Birim Tasarım & Turnaround Paftası`,
      subtitle: `Art Workbench Referans Paftası · ${(st.size / 1024).toFixed(1)} KB`,
      description: `narrative/15_Art_Workbench içindeki ana karakter/boss/düşman kostüm, silah, silüet ve renk paleti tasarım paftası (${f}).`,
      imageUrl: `/dev/workbench/sheets/${f}`,
      sceneJump: 'roster',
      targetPath: `narrative/15_Art_Workbench/**/${f}`,
      bytes: st.size
    });
  }
}

// 6. BACKGROUNDS (47 panoramic battlefields & VN locations)
for (const e of approvedEntries.filter((x) => x.class === 'background')) {
  const bgId = basename(e.path, '.webp').replace(/^bg_/, '');
  reviewCatalog.push({
    id: `bg_${bgId}`,
    category: 'BACKGROUNDS',
    badge: `Arka Plan · r${e.revision}`,
    origin: 'prev_approved',
    title: `${prettyId(bgId)} — Savaş Alanı & Hikâye Mekan Arka Planı`,
    subtitle: `${e.dims || '1376×768'} Panoramik WebP · ${(e.bytes / 1024).toFixed(1)} KB`,
    description: `StoryScene ve BattleScene içinde kullanılan gotik panoramik mekan görseli (${e.path}). QC: ${e.note || 'Onaylı mekan arka planı.'}`,
    imageUrl: `/dev/media/${e.path}`,
    sceneJump: 'battle_t1',
    targetPath: `content/approved_art/${e.path}`,
    dims: e.dims,
    bytes: e.bytes,
    sha256: e.sha256
  });
}

// 7. STILLS_CG (11 in-game still_*.webp + 15 workbench cg_*.jpg)
for (const e of approvedEntries.filter((x) => x.class === 'still')) {
  const stillId = basename(e.path, '.webp').replace(/^still_/, '');
  reviewCatalog.push({
    id: `still_${stillId}`,
    category: 'STILLS_CG',
    badge: `Prolog / Hikâye Still · r${e.revision}`,
    origin: 'prev_approved',
    title: `${prettyId(stillId)} — Sinematik Hikâye / Prolog Sahnesi`,
    subtitle: `${e.dims || '1376×768'} WebP · ${(e.bytes / 1024).toFixed(1)} KB`,
    description: `120 saniyelik Prolog ve T-1/T-2/T-3 geçişlerinde kullanılan tam ekran sinematik illüstrasyon (${e.path}).`,
    imageUrl: `/dev/media/${e.path}`,
    sceneJump: 'prologue',
    targetPath: `content/approved_art/${e.path}`,
    dims: e.dims,
    bytes: e.bytes,
    sha256: e.sha256
  });
}
const wbCgDir = join(OUT, 'workbench/cg');
if (existsSync(wbCgDir)) {
  for (const f of readdirSync(wbCgDir).filter((n) => /\.(jpg|png|webp)$/i.test(n)).sort()) {
    const st = statSync(join(wbCgDir, f));
    reviewCatalog.push({
      id: `wb_cg_${f.replace(/\.(jpg|png|webp)$/i, '')}`,
      category: 'STILLS_CG',
      badge: 'Bölüm CG İllüstrasyonu',
      origin: 'prev_approved',
      title: `${prettyId(f)} — Part I Sinematik Bölüm CG Sahnesi`,
      subtitle: `Art Workbench Tam Ekran CG · ${(st.size / 1024).toFixed(1)} KB`,
      description: `narrative/15_Art_Workbench/cg/${f} konumundaki tam ekran hikâye kırılma anı (Key Event CG) illüstrasyonu.`,
      imageUrl: `/dev/workbench/cg/${f}`,
      sceneJump: 'prologue',
      targetPath: `narrative/15_Art_Workbench/cg/${f}`,
      bytes: st.size
    });
  }
}

// 8. ICONS_WEAPONS (8 Master Icon Sheets + 112 Individual Clean RGBA Icons)
const wbIconSheetsDir = join(OUT, 'workbench/icons_sheets');
if (existsSync(wbIconSheetsDir)) {
  for (const f of readdirSync(wbIconSheetsDir).sort()) {
    const st = statSync(join(wbIconSheetsDir, f));
    reviewCatalog.push({
      id: `iconsheet_${f.replace(/\.(jpg|png|webp)$/i, '')}`,
      category: 'ICONS_WEAPONS',
      badge: 'Toplu İkon Paftası',
      origin: 'prev_approved',
      title: `${prettyId(f)} — Toplu İkon Seti Paftası`,
      subtitle: `Master İkon Paftası · ${(st.size / 1024).toFixed(1)} KB`,
      description: `Silah, zırh, aksesuar, element, statü ve para birimi ikonlarının toplu üretim paftası (${f}).`,
      imageUrl: `/dev/workbench/icons_sheets/${f}`,
      sceneJump: 'character',
      targetPath: `narrative/15_Art_Workbench/icons/${f}`,
      bytes: st.size
    });
  }
}
const wbIconsDir = join(OUT, 'workbench/icons');
if (existsSync(wbIconsDir)) {
  for (const f of readdirSync(wbIconsDir).filter((n) => n.endsWith('.png')).sort()) {
    const st = statSync(join(wbIconsDir, f));
    const kindBadge = f.includes('sig_')
      ? '5★ İmza Silah İkonu'
      : f.includes('armor_') || f.includes('acc_')
        ? 'Zırh / Aksesuar İkonu'
        : f.includes('element_') || f.includes('status_')
          ? 'Element / Statü İkonu'
          : f.includes('curr_') || f.includes('shard') || f.includes('token') || f.includes('ledger') || f.includes('vial')
            ? 'Para Birimi / Eşya İkonu'
            : f.includes('ch0') || f.includes('nav_') || f.includes('seal')
              ? 'Bölüm / UI Navigasyon İkonu'
              : 'Silah Ailesi / Ekipman İkonu';
    reviewCatalog.push({
      id: `icon_${f.replace(/\.png$/i, '')}`,
      category: 'ICONS_WEAPONS',
      badge: kindBadge,
      origin: 'prev_approved',
      title: `${prettyId(f.replace(/^icon_/, ''))} (${f})`,
      subtitle: `Alfa-Keyed RGBA PNG İkon · ${(st.size / 1024).toFixed(1)} KB`,
      description: `Envanter, karakter ekranı, savaş HUD ve mağazada kullanılan şeffaf arka planlı oyun ikonu (${f}).`,
      imageUrl: `/dev/workbench/icons/${f}`,
      sceneJump: 'character',
      targetPath: `narrative/15_Art_Workbench/icons/production_v001/icons_rgba/${f}`,
      bytes: st.size
    });
  }
}

// 9. UI_BRAND_STORE (4 core UI WebPs + 17 9-Slice UI Kit PNGs + 8 UI Screen Concept JPGs + 12 Store Kit PNGs + 16 Animated GIFs)
for (const f of ['ui_key_art.webp', 'ui_logo.webp', 'ui_studio_mark.webp', 'ui_title_bg.webp']) {
  const p = join(OUT, 'media/art', f);
  if (existsSync(p)) {
    const st = statSync(p);
    reviewCatalog.push({
      id: `core_${f.replace(/\.webp$/, '')}`,
      category: 'UI_BRAND_STORE',
      badge: 'Oyun İçi Ana UI / Marka',
      origin: 'prev_approved',
      title: `${prettyId(f)} (${f})`,
      subtitle: `Oyun İçi Base AAB Görseli · ${(st.size / 1024).toFixed(1)} KB`,
      description: `Splash, TitleScene ve ana menüde kullanılan temel marka/arka plan görseli (content/base/art/${f}).`,
      imageUrl: `/dev/media/art/${f}`,
      sceneJump: 'title_fresh',
      targetPath: `content/base/art/${f}`,
      bytes: st.size
    });
  }
}
const wbUiKitDir = join(OUT, 'workbench/ui_kit');
if (existsSync(wbUiKitDir)) {
  for (const f of readdirSync(wbUiKitDir).filter((n) => n.endsWith('.png')).sort()) {
    const st = statSync(join(wbUiKitDir, f));
    reviewCatalog.push({
      id: `uikit_${f.replace(/\.png$/i, '')}`,
      category: 'UI_BRAND_STORE',
      badge: 'Gotik UI Kit / 9-Slice',
      origin: 'prev_approved',
      title: `${prettyId(f)} — Gotik UI Bileşeni`,
      subtitle: `RGBA PNG UI Parçası · ${(st.size / 1024).toFixed(1)} KB`,
      description: `Gotik vitray, pirinç çerçeve, buton durumları, bar dolguları ve VFX halka dokusu (${f}).`,
      imageUrl: `/dev/workbench/ui_kit/${f}`,
      sceneJump: 'hub',
      targetPath: `narrative/15_Art_Workbench/ui_screens/production_v001/ui_kit/${f}`,
      bytes: st.size
    });
  }
}
const wbUiScreensOut = join(OUT, 'workbench/ui_screens');
if (existsSync(wbUiScreensOut)) {
  for (const f of readdirSync(wbUiScreensOut).sort()) {
    const st = statSync(join(wbUiScreensOut, f));
    reviewCatalog.push({
      id: `uiscreen_${f.replace(/\.(jpg|png|webp)$/i, '')}`,
      category: 'UI_BRAND_STORE',
      badge: 'UI Ekran Konsept Tasarımı',
      origin: 'prev_approved',
      title: `${prettyId(f)} — Tam Ekran UI Tasarım Plakası`,
      subtitle: `Art Workbench UI Master · ${(st.size / 1024).toFixed(1)} KB`,
      description: `Ana menü, Sanctuary Hub, Gacha Altar, Yemin Seçici ve Zafer/Yenilgi ekranlarının ana tasarım plakası (${f}).`,
      imageUrl: `/dev/workbench/ui_screens/${f}`,
      sceneJump: 'hub',
      targetPath: `narrative/15_Art_Workbench/ui_screens/${f}`,
      bytes: st.size
    });
  }
}
for (const s of storeAssets) {
  const p = join(OUT, 'store', s.file);
  const st = existsSync(p) ? statSync(p) : { size: 0 };
  reviewCatalog.push({
    id: `store_${s.file.replace(/[/.]/g, '_')}`,
    category: 'UI_BRAND_STORE',
    badge: s.kind === 'brand' ? 'Google Play Marka / İkon' : 'Google Play 1920×1080 Vitrin',
    origin: 'prev_approved',
    title: s.label,
    subtitle: `${s.kind === 'brand' ? 'Mağaza Kimlik Görseli' : '1920×1080 Landscape Mağaza Ekran Görüntüsü'} · ${(st.size / 1024).toFixed(1)} KB`,
    description: `Google Play Store mağaza sayfası için hazırlanan onaylı vitrin görseli (docs/store/assets/${s.file}).`,
    imageUrl: `/dev/store/${s.file}`,
    sceneJump: 'fresh_flow',
    targetPath: `docs/store/assets/${s.file}`,
    bytes: st.size
  });
}
const animOutDir = join(OUT, 'animations');
if (existsSync(animOutDir)) {
  for (const f of readdirSync(animOutDir).filter((n) => n.endsWith('.gif')).sort()) {
    const st = statSync(join(animOutDir, f));
    reviewCatalog.push({
      id: `animgif_${f.replace(/\.gif$/i, '')}`,
      category: 'UI_BRAND_STORE',
      badge: 'Hareketli GIF Vitrin',
      origin: 'prev_approved',
      title: `${prettyId(f)} — Animasyon Önizleme GIF`,
      subtitle: `Hareketli GIF · ${(st.size / 1024).toFixed(1)} KB`,
      description: `UI, logo, mühür, gacha ve chibi savaş döngülerini gösteren animasyon kaydı (${f}).`,
      imageUrl: `/dev/animations/${f}`,
      sceneJump: 'fresh_flow',
      targetPath: `narrative/15_Art_Workbench/ui_animations/gifs/${f}`,
      bytes: st.size
    });
  }
}

// 10. AUDIO_SFX_BGM (16 Canonical Ogg Vorbis SFX + 7 Lyria 3.5 BGM Motifs)
const sfxProvPath = join(ROOT, 'narrative/11_Audio_Cues/SFX_PROVENANCE.json');
const sfxProvMap = new Map<string, { category: string; duration_sec: number; description: string }>();
if (existsSync(sfxProvPath)) {
  const prov = JSON.parse(readFileSync(sfxProvPath, 'utf8')) as {
    cues: { id: string; category: string; duration_sec: number; description: string }[];
  };
  for (const c of prov.cues ?? []) sfxProvMap.set(c.id, c);
}
const sfxOutDir = join(OUT, 'media/sfx');
if (existsSync(sfxOutDir)) {
  for (const f of readdirSync(sfxOutDir).filter((n) => n.endsWith('.ogg')).sort()) {
    const id = f.replace(/\.ogg$/i, '');
    const st = statSync(join(sfxOutDir, f));
    const meta = sfxProvMap.get(id);
    reviewCatalog.push({
      id,
      category: 'AUDIO_SFX_BGM',
      badge: `SFX · ${meta?.category ?? 'combat'}`,
      origin: 'd30_new',
      title: `${f} — ${prettyId(id.replace(/^sfx_/, ''))}`,
      subtitle: `${meta ? `${meta.duration_sec}s · ` : ''}48 kHz Ogg Vorbis · ${(st.size / 1024).toFixed(1)} KB`,
      description: meta?.description ?? `Oyun içi ses efekti (content/base/sfx/${f}).`,
      audioUrl: `/dev/media/sfx/${f}`,
      sceneJump: 'battle_t1',
      targetPath: `content/base/sfx/${f}`,
      bytes: st.size
    });
  }
}
const BGM_META: Record<string, { title: string; sub: string; desc: string; jump: string }> = {
  bgm_title_theme: {
    title: 'bgm_title_theme.ogg — Ana Menü, Prolog, Hub & Summon Motifi',
    sub: 'Lyria 3.5 · D-Minör Çan, Çello & Koro',
    desc: 'TitleScene, PrologueScene, HomeScene (Hub) ve SummonScene arka plan müziği.',
    jump: 'title_fresh'
  },
  bgm_story_road: {
    title: 'bgm_story_road.ogg — Bölüm 1, 3, 5 Görsel Roman (StoryScene) Motifi',
    sub: 'Lyria 3.5 · Kül Yolu & Yalnız Çello',
    desc: 'Bölüm 1 (Whispering Ash), Bölüm 3 (Oakhaven) ve Bölüm 5 (Bridge of the Forsaken) hikâye sahneleri müziği.',
    jump: 'story_t1'
  },
  bgm_story_shelter: {
    title: 'bgm_story_shelter.ogg — Bölüm 2, 4, 6 Görsel Roman (StoryScene) Motifi',
    sub: 'Lyria 3.5 · Tapınak Sığınağı & Gümüş Çan',
    desc: 'Bölüm 2 (Saint Luthos), Bölüm 4 (Undercity) ve Bölüm 6 (Ashen Lord Estate) hikâye sahneleri müziği.',
    jump: 'story_t1_after'
  },
  bgm_story_omen: {
    title: 'bgm_story_omen.ogg — Bölüm 7 (Altar of the First Eclipse) & Boss Öncesi Motifi',
    sub: 'Lyria 3.5 · Tutulma Kehaneti & Düşük Koro',
    desc: 'Bölüm 7 hikâye sahneleri ve T-3 / Boss karşılaşmaları öncesi gerilim motifi.',
    jump: 'story_t3_before'
  },
  bgm_battle_ash: {
    title: 'bgm_battle_ash.ogg — Bölüm 1–3 Normal Savaş (BattleScene) Motifi',
    sub: 'Lyria 3.5 · Taktiksel Çatışma & Yaylı Ostinato',
    desc: 'Bölüm 1, 2 ve 3 standart 5v5 taktiksel savaş karşılaşmaları müziği.',
    jump: 'battle_t1'
  },
  bgm_battle_stone: {
    title: 'bgm_battle_stone.ogg — Bölüm 4–7 Normal Savaş (BattleScene) Motifi',
    sub: 'Lyria 3.5 · Taş Geçit & Demir Ritim',
    desc: 'Bölüm 4, 5, 6 ve 7 standart 5v5 taktiksel savaş karşılaşmaları müziği.',
    jump: 'battle_t2'
  },
  bgm_battle_courtyard: {
    title: 'bgm_battle_courtyard.ogg — Part I Boss Karşılaşmaları & T-3 Final Savaş Motifi',
    sub: 'Lyria 3.5 · Katedral Çanı, Koro & Boss Doruk Noktası',
    desc: 'Yedi Part I Boss savaşı (Bell-Widow, Ash-Maw, Red Vial Matron, Captain Rusk, Marshal Oren, Ashen Lord Wraith, Eclipse Construct) müziği.',
    jump: 'battle_t3'
  }
};
const bgmOutDir = join(OUT, 'media/audio');
if (existsSync(bgmOutDir)) {
  for (const f of readdirSync(bgmOutDir).filter((n) => n.endsWith('.ogg')).sort()) {
    const id = f.replace(/\.ogg$/i, '');
    const st = statSync(join(bgmOutDir, f));
    const m = BGM_META[id];
    reviewCatalog.push({
      id,
      category: 'AUDIO_SFX_BGM',
      badge: 'BGM · Lyria 3.5',
      origin: 'prev_approved',
      title: m?.title ?? `${f} — Müzik Motifi`,
      subtitle: `${m?.sub ?? 'Ogg Vorbis Müzik'} · ${(st.size / 1024).toFixed(1)} KB`,
      description: m?.desc ?? `Oyun içi arka plan müziği (content/base/audio/${f}).`,
      audioUrl: `/dev/media/audio/${f}`,
      sceneJump: m?.jump ?? 'title_fresh',
      targetPath: `content/base/audio/${f}`,
      bytes: st.size
    });
  }
}

// 11. VOICES (116 Chirp 3 HD Voiceover lines across Prologue & Tutorials T-1/T-2/T-3)
const voiceMeta = new Map<string, { speaker: string; text: string; sceneJump: string }>();
const prolPath = join(ROOT, 'content/base/entry/prologue.json');
if (existsSync(prolPath)) {
  const prol = JSON.parse(readFileSync(prolPath, 'utf8')) as {
    segments?: { id: string; voice?: string; caption?: string }[];
  };
  for (const seg of prol.segments ?? []) {
    if (seg.voice) {
      voiceMeta.set(seg.voice, { speaker: 'Prologue Narrator (Mahmut)', text: seg.caption ?? '', sceneJump: 'prologue' });
    }
  }
}
const storyJumpMap: Record<string, string> = {
  tutorial_1_before: 'story_t1',
  tutorial_1_after: 'story_t1_after',
  tutorial_2_before: 'story_t2_before',
  tutorial_2_after: 'story_t2_after',
  tutorial_3_before: 'story_t3_before',
  tutorial_3_after: 'story_t3_after'
};
const storyDir = join(ROOT, 'content/base/story');
if (existsSync(storyDir)) {
  for (const sf of readdirSync(storyDir).filter((n) => n.endsWith('.json'))) {
    const sKey = sf.replace(/\.json$/, '');
    const sData = JSON.parse(readFileSync(join(storyDir, sf), 'utf8')) as {
      beats?: { speaker?: string; text?: string; voice?: string }[];
    };
    for (const b of sData.beats ?? []) {
      if (b.voice) {
        voiceMeta.set(b.voice, {
          speaker: b.speaker ?? 'Narrator',
          text: b.text ?? '',
          sceneJump: storyJumpMap[sKey] ?? 'story_t1'
        });
      }
    }
  }
}
function collectVoices(dir: string): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) collectVoices(p);
    else if (e.name.endsWith('.ogg')) {
      const rel = relative(join(OUT, 'media'), p).replaceAll('\\', '/');
      const st = statSync(p);
      const vm = voiceMeta.get(rel);
      const id = `voice_${rel.replace(/[/.]/g, '_')}`;
      reviewCatalog.push({
        id,
        category: 'VOICES',
        badge: vm ? `Seslendirme · ${vm.speaker}` : 'Seslendirme · Chirp 3 HD',
        origin: 'prev_approved',
        title: `${vm ? `${vm.speaker}: ` : ''}${basename(rel)}`,
        subtitle: `Chirp 3 HD Ogg Vorbis · ${rel} · ${(st.size / 1024).toFixed(1)} KB`,
        description: vm?.text ? `"${vm.text}"` : `Seslendirme dosyası (content/base/${rel}).`,
        audioUrl: `/dev/media/${rel}`,
        sceneJump: vm?.sceneJump ?? 'story_t1',
        targetPath: `content/base/${rel}`,
        bytes: st.size
      });
    }
  }
}
collectVoices(join(OUT, 'media/voices'));

// 12. EVIDENCE_SCREENS (60 Curated Automated Browser & Gameplay Screenshots)
for (const s of screens) {
  const p = join(OUT, 'evidence', s.file);
  const st = existsSync(p) ? statSync(p) : { size: 0 };
  reviewCatalog.push({
    id: `evidence_${s.file.replace(/\.webp$/i, '')}`,
    category: 'EVIDENCE_SCREENS',
    badge: s.file.startsWith('aab-') ? 'AAB Akış Kanıtı' : 'Oyun / UI Kanıt Görüntüsü',
    origin: 'prev_approved',
    title: `${prettyId(s.file)} (${s.file})`,
    subtitle: `Otomatik Tarayıcı & Oyun İçi Ekran Görüntüsü · ${(st.size / 1024).toFixed(1)} KB`,
    description: `Canlı oyun ve yönetim paneli doğrulama ekran görüntüsü (docs/evidence/${s.file}).`,
    imageUrl: `/dev/evidence/${s.file}`,
    sceneJump: 'fresh_flow',
    targetPath: `docs/evidence/${s.file}`,
    bytes: st.size
  });
}

// Strict build-time verification gate: EVERY imageUrl and audioUrl in reviewCatalog MUST exist on disk and be > 0 bytes
for (const item of reviewCatalog) {
  if (item.imageUrl) {
    const diskPath = join(ROOT, 'apps/admin/public', item.imageUrl.replace(/^\//, ''));
    if (!existsSync(diskPath) || statSync(diskPath).size === 0) {
      throw new Error(`Broken imageUrl in reviewCatalog [${item.id}]: ${item.imageUrl} -> ${diskPath}`);
    }
  }
  if (item.audioUrl) {
    const diskPath = join(ROOT, 'apps/admin/public', item.audioUrl.replace(/^\//, ''));
    if (!existsSync(diskPath) || statSync(diskPath).size === 0) {
      throw new Error(`Broken audioUrl in reviewCatalog [${item.id}]: ${item.audioUrl} -> ${diskPath}`);
    }
  }
}

const count = (needle: string): number => roadmap.filter((r) => r.status.includes(needle)).length;
writeFileSync(
  join(OUT, 'progress.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      summary: { total: roadmap.length, done: count('✅'), partial: count('🟡'), missing: count('❌') },
      baseRelease,
      roadmap,
      decisions,
      commits,
      screens,
      storeAssets,
      reviewCatalog,
      ...tracker
    },
    null,
    1
  )
);
console.log(
  `progress.json: ${roadmap.length} roadmap rows, ${decisions.length} decisions, ${commits.length} commits, ${screens.length} screens, ${approvedEntries.length} approved art entries, ${reviewCatalog.length} verified review catalog items`
);

