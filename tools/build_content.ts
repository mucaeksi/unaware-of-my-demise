/**
 * Builds the runtime content tree from the preserved narrative/ sources and approved legacy art.
 *   content/base/                      -> embedded in the app (release rel_0001)
 *   content/patches/rel_0002_*         -> a data-only patch published through R2 (release rel_0002)
 * Run: npm run build:content   (add --contact-sheet to also render .cache/contact_sheet.png)
 */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ChapterIndex, type ArtManifest, type StoryScene, type UnitAnimState } from '../packages/content-schema/src/index';
import { buildEncounter, buildScene, buildUnitPack, emotionsUsed, tutorialChapter } from './lib/data';
import {
  buildBackground,
  buildPortrait,
  buildUnitAtlas,
  srcId,
  validateArt,
  type BuiltUnit,
  type PoseSource,
  type UnitArtConfig
} from './lib/art';
import { LEGACY_COMMIT, ROOT, fileBytes, legacyBlob, sha256, writeJson, writeOut } from './lib/fsutil';

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
    heightPx: 400,
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
    heightPx: 440,
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
    quiet_pain: { repo: `${VN_SRC}/sources/vn_quiet_pain_v001.png` },
    honest_fear: { repo: `${VN_SRC}/sources/vn_honest_fear_v001.png` },
    wry: { repo: `${VN_SRC}/sources/vn_wry_v001.png` },
    curiosity: { repo: `${VN_SRC}/vn_curiosity_v002.png` },
    resolve: { repo: `${VN_SRC}/vn_resolve_v002.png` },
    strain: { repo: `${VN_SRC}/vn_strain_v002.png` },
    vulnerable: { repo: `${VN_SRC}/vn_vulnerable_v002.png` }
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

const MUSIC_SRC = 'narrative/11_Audio_Cues/Music_Source/bgm_ch1_ash_forest';
const MUSIC: Record<string, { file: string; meta: string }> = {
  bgm_ch1_ash_forest_calm: { file: `${MUSIC_SRC}/bgm_ch1_ash_forest_calm_v001_loop.ogg`, meta: `${MUSIC_SRC}/bgm_ch1_ash_forest_calm_v001_loop.json` },
  bgm_ch1_ash_forest_chaotic: { file: `${MUSIC_SRC}/bgm_ch1_ash_forest_chaotic_v001_loop.ogg`, meta: `${MUSIC_SRC}/bgm_ch1_ash_forest_chaotic_v001_loop.json` }
};

interface Provenance {
  output: string;
  sha256: string;
  sources: Record<string, string>;
}
const provenance: Provenance[] = [];

async function main(): Promise<void> {
  const contactSheet = process.argv.includes('--contact-sheet');
  rmSync(join(ROOT, 'content/base'), { recursive: true, force: true });
  rmSync(join(ROOT, 'content/patches'), { recursive: true, force: true });

  const legacyPortraits = JSON.parse(legacyBlob('game/data/presentation/battle_art_v001.json').toString('utf8')).portraits as Record<string, { emotions: Record<string, string> }>;

  // ---- narrative -> scenes/encounters ---------------------------------------------------------
  const party = ['mahmut', 'fadyme'];
  const t1 = tutorialChapter('T-1');
  const t2 = tutorialChapter('T-2');
  const scenes = {
    t1_before: buildScene(t1.before, 'T-1', 'before', 'bgm_ch1_ash_forest_calm', party),
    t1_after: buildScene(t1.after, 'T-1', 'after', 'bgm_ch1_ash_forest_calm', party),
    t2_before: buildScene(t2.before, 'T-2', 'before', 'bgm_ch1_ash_forest_calm', party),
    t2_after: buildScene(t2.after, 'T-2', 'after', 'bgm_ch1_ash_forest_calm', party)
  };
  const partyDefs = [
    { unit_id: 'mahmut', row: 'front' as const },
    { unit_id: 'fadyme', row: 'rear' as const }
  ];
  const enc1 = buildEncounter('T-1', 'tutorial_t1', partyDefs, 'bgm_ch1_ash_forest_chaotic', 'tutorial_t1');
  const enc2 = buildEncounter('T-2', 'tutorial_t2', partyDefs, 'bgm_ch1_ash_forest_chaotic', 'tutorial_t2');

  // ---- art ---------------------------------------------------------------------------------
  const built = new Map<string, BuiltUnit>();
  for (const [k, cfg] of Object.entries(UNIT_ART)) built.set(k, await buildUnitAtlas(cfg, 'content/_tmp/art'));

  async function artManifest(unitKeys: string[], scenesUsed: StoryScene[], outDir: string): Promise<ArtManifest> {
    const atlases: ArtManifest['atlases'] = {};
    const units: ArtManifest['units'] = {};
    for (const k of unitKeys) {
      const b = built.get(k);
      if (!b) throw new Error(`no art for ${k}`);
      const rel = `art/atlas_${k}.webp`;
      writeOut(`${outDir}/${rel}`, b.atlasBytes);
      provenance.push({ output: `${outDir}/${rel}`, sha256: sha256(b.atlasBytes), sources: b.sourceHashes });
      atlases[`atlas_${k}`] = { image: rel, width: b.atlas.width, height: b.atlas.height, frames: b.atlas.frames };
      units[k] = b.unit as ArtManifest['units'][string];
    }
    const portraits: ArtManifest['portraits'] = {};
    for (const [char, tags] of emotionsUsed(scenesUsed)) {
      const files = PORTRAIT_FILES[char];
      const map = legacyPortraits[char]?.emotions;
      if (!files || !map) continue;
      const emotions: Record<string, string> = {};
      const images: Record<string, string> = {};
      const needed = new Set<string>(['composed']);
      for (const tag of tags) {
        const key = map[tag];
        if (key) {
          emotions[tag] = key;
          needed.add(key);
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
      emotions.composed = 'composed';
      portraits[char] = { emotions, images };
    }
    const backgrounds: ArtManifest['backgrounds'] = {};
    for (const [loc, src] of Object.entries(BG_FILES)) {
      const p = await buildBackground(src, 1920);
      const rel = `art/bg_${loc}.webp`;
      writeOut(`${outDir}/${rel}`, p.bytes);
      provenance.push({ output: `${outDir}/${rel}`, sha256: sha256(p.bytes), sources: { [srcId(src)]: p.hash } });
      backgrounds[loc] = rel;
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
    return validateArt({ schema_version: 1, atlases, units, portraits, backgrounds, music, ui: {} });
  }

  const putJson = (outDir: string, rel: string, value: unknown, sources: Record<string, string>): void => {
    const text = writeJson(`${outDir}/${rel}`, value);
    provenance.push({ output: `${outDir}/${rel}`, sha256: sha256(text), sources });
  };

  // ---- base release (T-1) ------------------------------------------------------------------
  const BASE = 'content/base';
  const baseArt = await artManifest(['fadyme', 'mahmut', 'bellbound_dead'], [scenes.t1_before, scenes.t1_after], BASE);
  putJson(BASE, 'art/art_manifest.json', baseArt, {});
  putJson(BASE, 'units/unit_pack.json', buildUnitPack('base_units', ['mahmut', 'fadyme'], ['bellbound_dead']), { narrative: 'characters_part1.json,enemies_part1.json,battle_rules_part1.json' });
  putJson(BASE, 'story/tutorial_t1_before.json', scenes.t1_before, { narrative: scenes.t1_before.provenance.source });
  putJson(BASE, 'story/tutorial_t1_after.json', scenes.t1_after, { narrative: scenes.t1_after.provenance.source });
  putJson(BASE, 'encounters/tutorial_t1.json', enc1, { narrative: enc1.provenance.source });
  putJson(
    BASE,
    'chapters/chapter_index.json',
    ChapterIndex.parse({
      schema_version: 1,
      chapters: [{ chapter_id: 'tutorial', title_en: 'Before the Road', nodes: [{ node_id: 't1', title_en: 'The First Step', kind: 'battle', encounter: 'encounters/tutorial_t1.json' }] }]
    }),
    {}
  );

  // ---- patch release (adds T-2: story + hollow pilgrim + chapter node) ----------------------
  const PATCH = 'content/patches/rel_0002_road_forgotten';
  const patchArt = await artManifest(['fadyme', 'mahmut', 'bellbound_dead', 'hollow_pilgrim'], [scenes.t1_before, scenes.t1_after, scenes.t2_before, scenes.t2_after], PATCH);
  putJson(PATCH, 'art/art_manifest.json', patchArt, {});
  putJson(PATCH, 'units/unit_pack.json', buildUnitPack('patch_units', ['mahmut', 'fadyme'], ['bellbound_dead', 'hollow_pilgrim']), { narrative: 'characters_part1.json,enemies_part1.json,battle_rules_part1.json' });
  putJson(PATCH, 'story/tutorial_t2_before.json', scenes.t2_before, { narrative: scenes.t2_before.provenance.source });
  putJson(PATCH, 'story/tutorial_t2_after.json', scenes.t2_after, { narrative: scenes.t2_after.provenance.source });
  putJson(PATCH, 'encounters/tutorial_t2.json', enc2, { narrative: enc2.provenance.source });
  putJson(
    PATCH,
    'chapters/chapter_index.json',
    ChapterIndex.parse({
      schema_version: 1,
      chapters: [
        {
          chapter_id: 'tutorial',
          title_en: 'Before the Road',
          nodes: [
            { node_id: 't1', title_en: 'The First Step', kind: 'battle', encounter: 'encounters/tutorial_t1.json' },
            { node_id: 't2', title_en: t2.title_en, kind: 'battle', encounter: 'encounters/tutorial_t2.json', requires: 't1' }
          ]
        }
      ]
    }),
    {}
  );
  // the patch only needs to ship files that differ from the base; drop byte-identical duplicates
  dedupeAgainstBase(BASE, PATCH);

  rmSync(join(ROOT, 'content/_tmp'), { recursive: true, force: true });
  writeFileSync(join(ROOT, 'content/provenance.json'), `${JSON.stringify({ generator: 'tools/build_content.ts', legacy_commit: LEGACY_COMMIT, outputs: provenance }, null, 2)}\n`);

  if (contactSheet) await renderContactSheet([...built.values()], baseArt);
  console.log(`content built: ${provenance.length} files`);
}

function listFiles(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir, rel))) {
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(join(ROOT, dir, r)).isDirectory()) out.push(...listFiles(dir, r));
    else out.push(r);
  }
  return out.sort();
}

function dedupeAgainstBase(base: string, patch: string): void {
  const baseSet = new Map(listFiles(base).map((f) => [f, sha256(fileBytes(`${base}/${f}`))]));
  for (const f of listFiles(patch)) {
    const h = sha256(fileBytes(`${patch}/${f}`));
    if (baseSet.get(f) === h) rmSync(join(ROOT, patch, f));
  }
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
