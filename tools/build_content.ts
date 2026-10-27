/**
 * Builds the runtime content tree from the preserved narrative/ sources and approved legacy art.
 *   content/base/                      -> embedded in the app (release rel_0001): the first-install flow = prologue + tutorials T-1..T-3
 * Everything after the first restart is a data-only patch published through R2 (content/patches/*, e.g. tools/build_campaign.ts).
 * Run: npm run build:content   (add --contact-sheet to also render .cache/contact_sheet.png)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { ChapterIndex, type ArtManifest, type StoryScene, type UnitAnimState } from '../packages/content-schema/src/index';
import { buildEncounter, buildScene, buildUnitPack, emotionsUsed, tutorialChapter } from './lib/data';
import { EntryIndex, Prologue } from '../packages/content-schema/src/index';
import {
  buildBackground,
  buildFadedKeyArt,
  buildKeyedImage,
  buildPortrait,
  buildUnitAtlas,
  srcId,
  validateArt,
  type BuiltUnit,
  type PoseSource,
  type UnitArtConfig
} from './lib/art';
import { loadApprovedArtEntries, type ApprovedArtEntry } from './ingest_art';
import { LEGACY_COMMIT, ROOT, fileBytes, legacyBlob, readJson, sha256, writeJson, writeOut } from './lib/fsutil';

/** the opening tutorials: no speed button and no Auto (manual turns); a later patch can switch them on by editing the encounter's ui block */
const TUTORIAL_UI = { speed: false, auto: false };
const L = (legacy: string): { legacy: string } => ({ legacy });
const VN_SRC = 'narrative/15_Art_Workbench/characters/fadyme/production_v002/vn';
const CHR = 'game/assets/characters';
const ENM = 'game/assets/enemies/tutorial';

type PoseMap = Record<UnitAnimState, PoseSource>;

function sheetPoses(sheet: string, regions: [number, number, number, number][], stateIdx: Record<UnitAnimState, number>, singles: Partial<Record<UnitAnimState, PoseSource>> = {}): PoseMap {
  const out = {} as PoseMap;
  for (const st of Object.keys(stateIdx) as UnitAnimState[]) {
    const idx = stateIdx[st];
    const region = regions[idx];
    if (!region) throw new Error(`missing region ${idx}`);
    out[st] = singles[st] ?? { file: L(sheet), region };
  }
  return out;
}

const SEQ: Record<UnitAnimState, number> = { idle: 0, walk: 1, basic: 2, active: 3, ultimate: 4, hit: 5, defeat: 6, victory: 7 };

const UNIT_ART: Record<string, UnitArtConfig> = {
  fadyme: {
    artKey: 'fadyme',
    facing: 'right',
    heightPx: 360,
    poses: sheetPoses(
      `${CHR}/fadyme/chibi_poses_v003.png`,
      [[25, 24, 366, 431], [445, 29, 385, 426], [918, 36, 453, 420], [1411, 24, 339, 431], [14, 450, 466, 417], [503, 484, 392, 381], [905, 537, 462, 332], [1376, 457, 377, 413]],
      SEQ,
      { ultimate: { file: L(`${CHR}/fadyme/ultimate_pose_v003.png`), relativeHeight: 1.12 } }
    )
  },
  mahmut: {
    artKey: 'mahmut',
    facing: 'right',
    heightPx: 360,
    poses: sheetPoses(
      `${CHR}/mahmut/chibi_poses_v003.png`,
      [[14, 28, 355, 423], [441, 32, 383, 419], [873, 61, 576, 390], [1358, 55, 393, 396], [14, 507, 422, 350], [471, 475, 414, 381], [885, 531, 420, 324], [1346, 454, 407, 407]],
      SEQ,
      { basic: { file: L(`${CHR}/mahmut/basic_attack_v003.png`), relativeHeight: 0.92 }, active: { file: L(`${CHR}/mahmut/guard_pose_v003.png`), relativeHeight: 0.98 } }
    )
  },
  bellbound_dead: {
    artKey: 'bellbound_dead',
    facing: 'left',
    heightPx: 340,
    poses: sheetPoses(
      `${ENM}/bellbound_poses_v003.png`,
      [[157, 32, 373, 647], [592, 89, 633, 590], [95, 673, 485, 552], [737, 804, 500, 425]],
      { idle: 0, walk: 0, basic: 1, active: 1, ultimate: 1, hit: 2, defeat: 3, victory: 0 },
      { basic: { file: L(`${ENM}/bellbound_attack_v003.png`), relativeHeight: 1.0 } }
    )
  },
  hollow_pilgrim: {
    artKey: 'hollow_pilgrim',
    facing: 'left',
    heightPx: 380,
    poses: sheetPoses(
      `${ENM}/pilgrim_poses_v003.png`,
      [[128, 46, 412, 564], [543, 121, 657, 488], [119, 637, 493, 551], [761, 735, 461, 455]],
      { idle: 0, walk: 0, basic: 1, active: 1, ultimate: 1, hit: 2, defeat: 3, victory: 0 },
      { basic: { file: L(`${ENM}/pilgrim_attack_v003.png`), relativeHeight: 1.0 } }
    )
  }
};

const PORTRAIT_FILES: Record<string, Record<string, { legacy: string } | { repo: string }>> = {
  fadyme: {
    composed: { repo: `${VN_SRC}/sources/vn_composed_v001.png` },
    warm: { repo: `${VN_SRC}/sources/vn_warm_v001.png` },
    wry: { repo: `${VN_SRC}/sources/vn_wry_v001.png` },
    resolve: { repo: `${VN_SRC}/vn_resolve_v002.png` }
    // quiet_pain, honest_fear, curiosity, strain and vulnerable were archived on 2026-10-10 (all portraits are being
    // regenerated with Google models); a scene that needs one fails with "no portrait source for fadyme/<key>".
  },
  mahmut: {
    composed: L(`${CHR}/mahmut/vn_watchful_v001.png`),
    dry_humor: L(`${CHR}/mahmut/vn_dry_humor_v001.png`),
    protective_resolve: L(`${CHR}/mahmut/vn_protective_resolve_v001.png`)
  }
};

const BG_FILES: Record<string, { legacy: string }> = {
  forest_whispering_ash: L('game/assets/backgrounds/forest_whispering_ash/side_arena_v001.png')
};

const UI_FILES = {
  logo: { repo: 'narrative/14_References/recovered_locked_v001/logo/brand_logo_wordmark_r2_v003.png' },
  key_art: { repo: 'narrative/14_References/recovered_locked_v001/key_art/brand_key_art_portrait_r2_v003.png' }
};

const MUSIC_SRC = 'narrative/11_Audio_Cues/Music_Source/bgm_ch1_ash_forest';
const PROLOGUE_MUSIC_SRC = 'narrative/11_Audio_Cues/Music_Source/bgm_prologue_before_the_road';
const FADYME_MUSIC_SRC = 'narrative/11_Audio_Cues/Fadyme_Theme_Reference';
const MUSIC: Record<string, { file: string; meta: string }> = {
  bgm_ch1_ash_forest_calm: { file: `${MUSIC_SRC}/bgm_ch1_ash_forest_calm_v001_loop.ogg`, meta: `${MUSIC_SRC}/bgm_ch1_ash_forest_calm_v001_loop.json` },
  bgm_ch1_ash_forest_chaotic: { file: `${MUSIC_SRC}/bgm_ch1_ash_forest_chaotic_v001_loop.ogg`, meta: `${MUSIC_SRC}/bgm_ch1_ash_forest_chaotic_v001_loop.json` },
  bgm_prologue_before_the_road: { file: `${PROLOGUE_MUSIC_SRC}/bgm_prologue_before_the_road_v001_loop.ogg`, meta: `${PROLOGUE_MUSIC_SRC}/bgm_prologue_before_the_road_v001_loop.json` },
  bgm_fadyme_theme: { file: `${FADYME_MUSIC_SRC}/bgm_fadyme_theme_v001_loop.ogg`, meta: `${FADYME_MUSIC_SRC}/bgm_fadyme_theme_v001_loop.json` }
};

const PRESENTATION = 'content/base/presentation/presentation.json';
const AUTHORED_DIRS = ['voices', 'presentation', 'vfx', 'sfx', 'video'];

/** music cues the base manifest declares beyond MUSIC whose file is still on disk (Lyria tracks written in place) */
function readAuthoredMusic(): { authored: ArtManifest['music']; order: string[] } {
  const path = 'content/base/art/art_manifest.json';
  if (!existsSync(join(ROOT, path))) return { authored: {}, order: [] };
  const music = ((readJson(path) as Partial<ArtManifest>).music ?? {}) as ArtManifest['music'];
  const authored = Object.fromEntries(Object.entries(music).filter(([cue, m]) => !MUSIC[cue] && existsSync(join(ROOT, 'content/base', m.file))));
  return { authored, order: Object.keys(music) };
}

/**
 * Locked repo-sourced UI art (`logo`, `key_art`) is built via sharp + SVG mask when its source PNG changes.
 * When the source PNG sha256 matches content/provenance.json and the existing .webp matches its recorded output sha256,
 * reuse the committed .webp bytes so cross-OS sharp/librsvg/libwebp float differences do not cause drift on Linux CI.
 */
function readReusableRepoUiArt(): Map<string, { bytes: Buffer; outSha: string; srcSha: string }> {
  const out = new Map<string, { bytes: Buffer; outSha: string; srcSha: string }>();
  const provPath = join(ROOT, 'content/provenance.json');
  if (!existsSync(provPath)) return out;
  try {
    const prov = JSON.parse(readFileSync(provPath, 'utf8')) as {
      outputs?: { output: string; sha256: string; sources?: Record<string, string> }[];
    };
    for (const [uiKey, ref] of Object.entries(UI_FILES)) {
      const relOut = `content/base/art/ui_${uiKey}.webp`;
      const absOut = join(ROOT, relOut);
      if (!existsSync(absOut)) continue;
      const srcHash = sha256(fileBytes(ref.repo));
      const rec = (prov.outputs ?? []).find((o) => o.output === relOut);
      if (!rec || rec.sources?.[ref.repo] !== srcHash) continue;
      const bytes = readFileSync(absOut);
      const outHash = sha256(bytes);
      if (outHash === rec.sha256) {
        out.set(uiKey, { bytes, outSha: outHash, srcSha: srcHash });
      }
    }
  } catch {
    // ignore malformed provenance
  }
  return out;
}

function authoredFiles(): string[] {
  return AUTHORED_DIRS.flatMap((dir) => {
    const abs = join(ROOT, 'content/base', dir);
    return existsSync(abs)
      ? readdirSync(abs, { recursive: true, withFileTypes: true })
          .filter((d) => d.isFile())
          .map((d) => relative(join(ROOT, 'content/base'), join(d.parentPath, d.name)).replaceAll('\\', '/'))
          .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      : [];
  });
}

interface Provenance {
  output: string;
  sha256: string;
  sources: Record<string, string>;
}
const provenance: Provenance[] = [];

function copyApprovedEntryOutputs(entry: ApprovedArtEntry, outDir: string): void {
  const srcKey = `${entry.source.kind}:${entry.asset_id}@rev${entry.revision}`;
  for (const out of entry.outputs) {
    const bytes = fileBytes(`content/approved_art/${out.path}`);
    writeOut(`${outDir}/${out.path}`, bytes);
    provenance.push({
      output: `${outDir}/${out.path}`,
      sha256: sha256(bytes),
      sources: { [srcKey]: entry.source.sha256, entry: entry.ingest.fingerprint }
    });
  }
}

async function main(): Promise<void> {
  const contactSheet = process.argv.includes('--contact-sheet');
  const strictArt = process.argv.includes('--strict-art');
  const requireApproved = process.argv.includes('--require-approved') || strictArt;
  const approvedEntries = loadApprovedArtEntries(ROOT, requireApproved);
  // voices/, presentation/ and the Lyria tracks are written in place by the media tools (record_game_vo.py,
  // build_all_voiceovers.py, generate_*_lyria35.py) and vfx/ presets are hand-authored; none has another source,
  // so keep them and regenerate the rest.
  const { authored: authoredMusic, order: previousMusicOrder } = readAuthoredMusic();
  const reusableUiArt = readReusableRepoUiArt();
  for (const dir of ['art', 'story', 'encounters', 'units', 'chapters', 'entry']) rmSync(join(ROOT, 'content/base', dir), { recursive: true, force: true });
  for (const cue of Object.keys(MUSIC)) rmSync(join(ROOT, `content/base/audio/${cue}.ogg`), { force: true });

  let cachedLegacyPortraits: Record<string, { emotions: Record<string, string> }> | null = null;
  const getLegacyPortraits = (): Record<string, { emotions: Record<string, string> }> => {
    if (!cachedLegacyPortraits) {
      cachedLegacyPortraits = JSON.parse(legacyBlob('game/data/presentation/battle_art_v001.json').toString('utf8')).portraits as Record<
        string,
        { emotions: Record<string, string> }
      >;
    }
    return cachedLegacyPortraits;
  };

  // ---- narrative -> scenes/encounters ---------------------------------------------------------
  const party = ['mahmut', 'fadyme'];
  const t1 = tutorialChapter('T-1');
  const t2 = tutorialChapter('T-2');
  t2.before.location_id = 'forgotten_stone_crossing';
  t2.after.location_id = 'forgotten_stone_crossing';
  const t3 = tutorialChapter('T-3');
  t3.before.location_id = 'shelter_courtyard_dusk';
  t3.after.location_id = 'shelter_courtyard_dusk';
  // owner decision (7ad4b2a8): tutorial cutscenes play without background music so the directed VO carries them
  const STORY_MUSIC = 'stop';
  const BATTLE_MUSIC = undefined;
  const scenes = {
    t1_before: buildScene(t1.before, 'T-1', 'before', STORY_MUSIC, party),
    t1_after: buildScene(t1.after, 'T-1', 'after', STORY_MUSIC, party),
    t2_before: buildScene(t2.before, 'T-2', 'before', STORY_MUSIC, party),
    t2_after: buildScene(t2.after, 'T-2', 'after', STORY_MUSIC, party),
    t3_before: buildScene(t3.before, 'T-3', 'before', STORY_MUSIC, party),
    t3_after: buildScene(t3.after, 'T-3', 'after', STORY_MUSIC, party)
  };
  // v006: "the final scene holds its closing line for 5 seconds" (the script JSON carries the 3.5 s default for every scene)
  scenes.t3_after.closing_hold_seconds = Math.max(scenes.t3_after.closing_hold_seconds ?? 0, 5);
  const partyDefs = [
    { unit_id: 'mahmut', row: 'front' as const },
    { unit_id: 'fadyme', row: 'rear' as const }
  ];
  const enc1 = buildEncounter('T-1', 'tutorial_t1', partyDefs, BATTLE_MUSIC, 'tutorial_t1', TUTORIAL_UI);
  const enc2 = {
    ...buildEncounter('T-2', 'tutorial_t2', partyDefs, BATTLE_MUSIC, 'tutorial_t2', TUTORIAL_UI),
    location_id: 'forgotten_stone_crossing',
    enemies: [
      { unit_id: 'hollow_pilgrim', level: 1, slot: 0, row: 'front' as const },
      { unit_id: 'bellbound_dead', level: 1, slot: 1, row: 'rear' as const },
      { unit_id: 'bellbound_dead', level: 1, slot: 2, row: 'rear' as const }
    ]
  };
  const enc3 = { ...buildEncounter('T-3', 'tutorial_t3', partyDefs, BATTLE_MUSIC, 'tutorial_t3', TUTORIAL_UI), location_id: 'shelter_courtyard_dusk' };

  // ---- art (approved_art first, legacy fallback only for uncovered keys) ----------------------
  const approvedUnits = new Map<string, ApprovedArtEntry>();
  const approvedPortraits = new Map<string, ApprovedArtEntry[]>();
  const approvedBackgrounds = new Map<string, ApprovedArtEntry>();
  const approvedUi = new Map<string, ApprovedArtEntry>();
  const approvedStills = new Map<string, ApprovedArtEntry>();
  const approvedExtraAtlases = new Map<string, ApprovedArtEntry>();

  for (const e of approvedEntries) {
    for (const uKey of Object.keys(e.targets.units ?? {})) approvedUnits.set(uKey, e);
    for (const cKey of Object.keys(e.targets.portraits ?? {})) {
      const list = approvedPortraits.get(cKey) ?? [];
      list.push(e);
      approvedPortraits.set(cKey, list);
    }
    for (const bgKey of Object.keys(e.targets.backgrounds ?? {})) approvedBackgrounds.set(bgKey, e);
    for (const uiKey of Object.keys(e.targets.ui ?? {})) approvedUi.set(uiKey, e);
    for (const stKey of Object.keys(e.targets.stills ?? {})) approvedStills.set(stKey, e);
    if (!e.targets.units) {
      for (const atKey of Object.keys(e.targets.atlases ?? {})) approvedExtraAtlases.set(atKey, e);
    }
  }

  const built = new Map<string, BuiltUnit>();
  for (const [k, cfg] of Object.entries(UNIT_ART)) {
    if (!approvedUnits.has(k)) {
      built.set(k, await buildUnitAtlas(cfg, 'content/_tmp/art'));
    }
  }

  async function artManifest(unitKeys: string[], scenesUsed: StoryScene[], outDir: string): Promise<ArtManifest> {
    const atlases: ArtManifest['atlases'] = {};
    const units: ArtManifest['units'] = {};
    for (const k of unitKeys) {
      const appUnit = approvedUnits.get(k);
      if (appUnit && appUnit.targets.units?.[k]) {
        copyApprovedEntryOutputs(appUnit, outDir);
        Object.assign(atlases, appUnit.targets.atlases ?? {});
        units[k] = appUnit.targets.units[k]!;
        continue;
      }
      const b = built.get(k);
      if (!b) throw new Error(`no art for ${k}`);
      const rel = `art/atlas_${k}.webp`;
      writeOut(`${outDir}/${rel}`, b.atlasBytes);
      provenance.push({ output: `${outDir}/${rel}`, sha256: sha256(b.atlasBytes), sources: b.sourceHashes });
      atlases[`atlas_${k}`] = { image: rel, width: b.atlas.width, height: b.atlas.height, frames: b.atlas.frames };
      units[k] = b.unit as ArtManifest['units'][string];
    }
    for (const [, extra] of approvedExtraAtlases) {
      copyApprovedEntryOutputs(extra, outDir);
      Object.assign(atlases, extra.targets.atlases ?? {});
    }
    // Explicit rebuilt variants are available for review; canonical unit keys keep their migration scope.
    for (const key of unitKeys) {
      const rebuiltKey = `sol_${key}`;
      const entry = approvedUnits.get(rebuiltKey);
      if (!entry?.targets.units?.[rebuiltKey]) continue;
      copyApprovedEntryOutputs(entry, outDir);
      Object.assign(atlases, entry.targets.atlases ?? {});
      units[rebuiltKey] = entry.targets.units[rebuiltKey];
    }
    const portraits: ArtManifest['portraits'] = {};
    for (const [char, tags] of emotionsUsed(scenesUsed)) {
      const appCharEntries = approvedPortraits.get(char) ?? [];
      const emotions: Record<string, string> = {};
      const images: Record<string, string> = {};
      for (const entry of appCharEntries) {
        copyApprovedEntryOutputs(entry, outDir);
        const pTarget = entry.targets.portraits?.[char];
        if (pTarget) {
          Object.assign(emotions, pTarget.emotions);
          Object.assign(images, pTarget.images);
        }
      }
      const files = PORTRAIT_FILES[char];
      const needed = new Set<string>(images.composed ? [] : ['composed']);
      const missingTags = [...tags].filter((tag) => !emotions[tag]);
      if (files && (needed.size > 0 || missingTags.length > 0)) {
        const map = getLegacyPortraits()[char]?.emotions;
        if (map) {
          for (const tag of missingTags) {
            const key = map[tag];
            if (key) {
              emotions[tag] = key;
              if (!images[key]) needed.add(key);
            }
          }
          for (const key of needed) {
            const src = files[key];
            if (!src) throw new Error(`no portrait source for ${char}/${key}`);
            const p = await buildPortrait(src, 1100);
            const rel = `art/portrait_${char}_${key}.webp`;
            writeOut(`${outDir}/${rel}`, p.bytes);
            provenance.push({ output: `${outDir}/${rel}`, sha256: sha256(p.bytes), sources: { [srcId(src)]: p.hash } });
            images[key] = rel;
          }
        }
      }
      if (images.composed) emotions.composed = 'composed';
      portraits[char] = { emotions, images };
    }
    const backgrounds: ArtManifest['backgrounds'] = {};
    for (const [loc, src] of Object.entries(BG_FILES)) {
      const appBg = approvedBackgrounds.get(loc);
      if (appBg && appBg.targets.backgrounds?.[loc]) {
        copyApprovedEntryOutputs(appBg, outDir);
        backgrounds[loc] = appBg.targets.backgrounds[loc]!;
        continue;
      }
      const p = await buildBackground(src, 1920);
      const rel = `art/bg_${loc}.webp`;
      writeOut(`${outDir}/${rel}`, p.bytes);
      provenance.push({ output: `${outDir}/${rel}`, sha256: sha256(p.bytes), sources: { [srcId(src)]: p.hash } });
      backgrounds[loc] = rel;
    }
    const baseLocations = new Set([
      'sol_hub_shelter',
      ...Object.keys(BG_FILES),
      ...scenesUsed.flatMap((s) => [s.location_id, ...s.commands.flatMap((c) => (c.op === 'background' ? [c.location_id] : []))]),
      enc1.location_id,
      enc2.location_id,
      enc3.location_id
    ]);
    // Native tutorial Story uses explicit rebuilt plates; battle keeps the legacy location key until its own migration.
    for (const scene of scenesUsed) {
      if (/^tutorial_t[123]_(before|after)$/.test(scene.scene_id)) baseLocations.add(`sol_${scene.location_id}`);
    }
    for (const [loc, appBg] of approvedBackgrounds) {
      if (baseLocations.has(loc) && !backgrounds[loc] && appBg.targets.backgrounds?.[loc]) {
        copyApprovedEntryOutputs(appBg, outDir);
        backgrounds[loc] = appBg.targets.backgrounds[loc]!;
      }
    }
    const music: ArtManifest['music'] = {};
    for (const [cue, m] of Object.entries(MUSIC)) {
      const bytes = fileBytes(m.file);
      const meta = JSON.parse(fileBytes(m.meta).toString('utf8')) as { engine_loop: { loop_offset_s: number }; file_length_s: number };
      const rel = `audio/${cue}.ogg`;
      writeOut(`${outDir}/${rel}`, bytes);
      provenance.push({ output: `${outDir}/${rel}`, sha256: sha256(bytes), sources: { [m.file]: sha256(bytes) } });
      music[cue] = { file: rel, loop_start_s: meta.engine_loop.loop_offset_s, duration_s: meta.file_length_s };
    }
    for (const [cue, m] of Object.entries(authoredMusic)) {
      provenance.push({ output: `${outDir}/${m.file}`, sha256: sha256(fileBytes(`${outDir}/${m.file}`)), sources: { authored: `${outDir}/${m.file}` } });
      music[cue] = m;
    }
    // keep the previous manifest's cue order so a rebuild does not reshuffle the file
    const order = [...previousMusicOrder, ...Object.keys(music)];
    const orderedMusic = Object.fromEntries([...new Set(order)].filter((cue) => music[cue]).map((cue) => [cue, music[cue]!]));
    const ui: ArtManifest['ui'] = {};
    if (approvedUi.has('logo')) {
      const e = approvedUi.get('logo')!;
      copyApprovedEntryOutputs(e, outDir);
      ui.logo = e.targets.ui!.logo!;
    } else {
      const cachedLogo = reusableUiArt.get('logo');
      const logo = cachedLogo
        ? { bytes: cachedLogo.bytes, hash: cachedLogo.srcSha }
        : await buildKeyedImage(UI_FILES.logo, 1400);
      writeOut(`${outDir}/art/ui_logo.webp`, logo.bytes);
      provenance.push({ output: `${outDir}/art/ui_logo.webp`, sha256: sha256(logo.bytes), sources: { [srcId(UI_FILES.logo)]: logo.hash } });
      ui.logo = 'art/ui_logo.webp';
    }
    if (approvedUi.has('key_art')) {
      const e = approvedUi.get('key_art')!;
      copyApprovedEntryOutputs(e, outDir);
      ui.key_art = e.targets.ui!.key_art!;
    } else {
      const cachedKey = reusableUiArt.get('key_art');
      const key = cachedKey
        ? { bytes: cachedKey.bytes, hash: cachedKey.srcSha }
        : await buildFadedKeyArt(UI_FILES.key_art, 760);
      writeOut(`${outDir}/art/ui_key_art.webp`, key.bytes);
      provenance.push({ output: `${outDir}/art/ui_key_art.webp`, sha256: sha256(key.bytes), sources: { [srcId(UI_FILES.key_art)]: key.hash } });
      ui.key_art = 'art/ui_key_art.webp';
    }
    for (const [uiKey, appUiEntry] of approvedUi) {
      if (!ui[uiKey] && appUiEntry.targets.ui?.[uiKey]) {
        copyApprovedEntryOutputs(appUiEntry, outDir);
        ui[uiKey] = appUiEntry.targets.ui[uiKey]!;
      }
    }
    const stills: ArtManifest['stills'] = {};
    for (const [stKey, appSt] of approvedStills) {
      if (appSt.targets.stills?.[stKey]) {
        copyApprovedEntryOutputs(appSt, outDir);
        stills[stKey] = appSt.targets.stills[stKey]!;
      }
    }
    return validateArt({ schema_version: 1, atlases, units, portraits, backgrounds, music: orderedMusic, ui, stills });
  }

  const putJson = (outDir: string, rel: string, value: unknown, sources: Record<string, string>): void => {
    const text = writeJson(`${outDir}/${rel}`, value);
    provenance.push({ output: `${outDir}/${rel}`, sha256: sha256(text), sources });
  };

  // ---- base release: the first-install flow (prologue + T-1..T-3) -------------------------------
  const BASE = 'content/base';
  const baseScenes = Object.values(scenes);
  const baseArt = await artManifest(['fadyme', 'mahmut', 'bellbound_dead', 'hollow_pilgrim'], baseScenes, BASE);
  putJson(BASE, 'art/art_manifest.json', baseArt, {});
  putJson(BASE, 'units/unit_pack.json', buildUnitPack('base_units', ['mahmut', 'fadyme'], ['bellbound_dead', 'hollow_pilgrim']), { narrative: 'characters_part1.json,enemies_part1.json,battle_rules_part1.json' });
  for (const [k, sc] of Object.entries(scenes)) putJson(BASE, `story/tutorial_${k}.json`, sc, { narrative: sc.provenance.source });
  putJson(BASE, 'encounters/tutorial_t1.json', enc1, { narrative: enc1.provenance.source });
  putJson(BASE, 'encounters/tutorial_t2.json', enc2, { narrative: enc2.provenance.source });
  putJson(BASE, 'encounters/tutorial_t3.json', enc3, { narrative: enc3.provenance.source });
  putJson(
    BASE,
    'chapters/chapter_index.json',
    ChapterIndex.parse({
      schema_version: 1,
      chapters: [
        {
          chapter_id: 'tutorial',
          title_en: 'Before the Road',
          nodes: [
            { node_id: 't1', title_en: t1.title_en, kind: 'battle', encounter: 'encounters/tutorial_t1.json' },
            { node_id: 't2', title_en: t2.title_en, kind: 'battle', encounter: 'encounters/tutorial_t2.json', requires: 't1' },
            { node_id: 't3', title_en: t3.title_en, kind: 'battle', encounter: 'encounters/tutorial_t3.json', requires: 't2' }
          ]
        }
      ]
    }),
    {}
  );
  // the first-install interlude, copied verbatim from the narrative source and checked against its schema
  const prologue = Prologue.parse(readJson('narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/prologue_v001.json'));
  // the narrative snapshot predates the VO session: it is "recorded" exactly when every line has an authored voice
  const voices = existsSync(join(ROOT, PRESENTATION)) ? (readJson(PRESENTATION) as { voices?: Record<string, unknown> }).voices ?? {} : {};
  prologue.voice_status = prologue.scenes.every((s) => Object.hasOwn(voices, s.line_id)) ? 'recorded' : 'unrecorded';
  for (const rel of authoredFiles()) provenance.push({ output: `${BASE}/${rel}`, sha256: sha256(fileBytes(`${BASE}/${rel}`)), sources: { authored: `${BASE}/${rel}` } });
  putJson(BASE, 'entry/prologue.json', prologue, { narrative: 'narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/prologue_v001.json' });
  putJson(
    BASE,
    'entry/entry_index.json',
    EntryIndex.parse({
      schema_version: 1,
      prologue: 'entry/prologue.json',
      tutorial: [
        { stage_id: 't1', encounter: 'encounters/tutorial_t1.json' },
        { stage_id: 't2', encounter: 'encounters/tutorial_t2.json' },
        { stage_id: 't3', encounter: 'encounters/tutorial_t3.json' }
      ]
    }),
    {}
  );

  rmSync(join(ROOT, 'content/_tmp'), { recursive: true, force: true });
  if (strictArt) {
    const legacyArtOutputs = provenance
      .filter((entry) => entry.output.includes('/art/') && Object.keys(entry.sources).some((key) => key.startsWith('git:')))
      .map((entry) => entry.output);
    if (legacyArtOutputs.length > 0 || approvedEntries.length === 0) {
      throw new Error(
        `strict-art check failed: ${legacyArtOutputs.length} art output(s) still depend on legacy git: sources (${legacyArtOutputs.slice(0, 5).join(', ')})`
      );
    }
  }
  writeFileSync(join(ROOT, 'content/provenance.json'), `${JSON.stringify({ generator: 'tools/build_content.ts', legacy_commit: LEGACY_COMMIT, outputs: provenance }, null, 2)}\n`);

  if (contactSheet) await renderContactSheet([...built.values()], baseArt);
  console.log(`content built: ${provenance.length} files`);
}

async function renderContactSheet(units: BuiltUnit[], art: ArtManifest): Promise<void> {
  const bg = await sharp(fileBytes('content/base/art/bg_forest_whispering_ash.webp')).resize(1920, 1080, { fit: 'cover' }).png().toBuffer();
  const layers: sharp.OverlayOptions[] = [];
  let row = 0;
  for (const u of units) {
    const atlas = sharp(u.atlasBytes);
    const states = Object.entries(u.unit.states);
    let col = 0;
    for (const [, s] of states) {
      const f = u.atlas.frames[s.frame];
      if (!f) continue;
      const buf = await atlas.clone().extract({ left: f[0], top: f[1], width: f[2], height: f[3] }).png().toBuffer();
      const dispH = Math.round(f[3] * 0.62);
      const small = await sharp(buf).resize({ height: dispH }).png().toBuffer();
      const meta = await sharp(small).metadata();
      layers.push({ input: small, left: Math.round(col * 235 + 117 - (meta.width ?? 0) * s.pivot_x), top: Math.round(row * 270 + 250 - dispH * s.foot_y) });
      col++;
    }
    row++;
  }
  await sharp(bg).composite(layers).png().toFile(join(ROOT, '.cache/contact_sheet.png'));
  void art;
  mkdirSync(join(ROOT, '.cache'), { recursive: true });
}

await main();
