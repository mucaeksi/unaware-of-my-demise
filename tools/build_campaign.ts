/**
 * Builds the Part I campaign release from the preserved narrative data (35 stages, 7 chapters, the full cast) as a data patch over the base release:
 *   content/patches/rel_0003_part1_campaign/   units (20 heroes, 20 enemies, 7 bosses), 35 owned-hero encounters, chapter index, art manifest
 * Units without production art point at one generic placeholder atlas, so the whole campaign is playable while real art is made.
 * It also plays every stage with the Auto Battle policy and reports whether the stage can be won at its recommended level (docs/combat/CAMPAIGN_BALANCE.md).
 * Run: npm run build:campaign
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { playAuto } from '../packages/combat/src/index';
import { ArtManifest, BattleParty, ChapterIndex, Encounter, type UnitPack, validateContentSet, type RewardAttachment } from '../packages/content-schema/src/index';
import { aggregateGear, attributeStats, emptyGearStats, finalStats, type GearPiece, type GearStats } from '../packages/economy/src/index';
import { CANON_PROGRESSION } from '../packages/economy/src/fixtures';
import { ROLE_STAT, armorStats, balanceAttributes, weaponStats } from './lib/balance';
import { buildUnitPack } from './lib/data';
import { bindCampaignPhaseStories, compileCampaignStory } from './lib/campaign-story';
import { compileNarrativeLibrary } from './lib/narrative-library';
import { ROOT, campaignPortraitIds, readJson, writeJson, writeOut } from './lib/fsutil';
import { loadApprovedArtEntries } from './ingest_art';

const NARR = 'narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content';
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const OUT = 'content/patches/rel_0003_part1_campaign';

const chapters = readJson<Json>(`${NARR}/chapters_part1.json`).chapters as Json[];
const stages = readJson<Json>(`${NARR}/stages_part1.json`).stages as Json[];
const chars = readJson<Json>(`${NARR}/characters_part1.json`).characters as Json[];
const enemies = readJson<Json>(`${NARR}/enemies_part1.json`).enemies as Json[];
const dropTables = new Set((readJson<Json>(`${NARR}/drop_tables_part1.json`).drop_tables as Json[]).map((t) => t.drop_table_id as string));
const bossSets = new Map<string, string>(enemies.filter((e) => e.boss_id).map((e) => [e.boss_id as string, e.guaranteed_accessory_set_id as string]));

const seedOf = (id: string): number => createHash('sha256').update(`uomd:part1:${id}`).digest().readUInt32BE(0);
const snake = (stageId: string): string => `stage_${stageId.replace('-', '_')}`;
const REAR_ROLES = /caster|support|warder|assassin|flanker/;

// ---- units -------------------------------------------------------------------------------------------------------
const pack = buildUnitPack('part1_campaign', chars.map((c) => c.character_id as string), enemies.map((e) => e.enemy_id as string));
writeJson(`${OUT}/units/unit_pack.json`, pack);
const base = ArtManifest.parse(readJson(`content/base/art/art_manifest.json`));
const portraitSet = campaignPortraitIds();
const library = compileNarrativeLibrary(undefined, portraitSet);
writeJson(`${OUT}/library/library_index.json`, library);
const story = compileCampaignStory(undefined, portraitSet);
for (const [path, scene] of story.files) writeJson(`${OUT}/${path}`, scene);

// ---- encounters + chapter index ----------------------------------------------------------------------------------------
const nodeIds: string[] = [];
const chapterOut: Json[] = [
  {
    chapter_id: 'tutorial',
    title_en: 'Before the Road',
    nodes: [
      { node_id: 't1', title_en: 'The First Step', kind: 'battle', encounter: 'encounters/tutorial_t1.json' },
      { node_id: 't2', title_en: 'A Road Forgotten', kind: 'battle', encounter: 'encounters/tutorial_t2.json', requires: 't1' },
      { node_id: 't3', title_en: 'A Roof Before Dawn', kind: 'battle', encounter: 'encounters/tutorial_t3.json', requires: 't2' }
    ]
  }
];
const encounters = new Map<string, Encounter>();
const battleNodes = new Map<string, Json>();
const hardBattleNodes = new Map<string, Json>();

for (const ch of chapters) {
  for (const n of ch.nodes as Json[]) {
    const st = stages.find((s) => s.stage_id === n.stage_id) as Json;
    const id = snake(st.stage_id);
    const tutorial = st.stage_id === '1-1';
    // one narrative wave -> placed foes; at most two front-row foes keep the formation readable (canon 2 front + 3 rear)
    const place = (wave: Json[]): { unit_id: string; level: number; slot: number; row: 'front' | 'rear' }[] => {
      const placed: { unit_id: string; level: number; slot: number; row: 'front' | 'rear' }[] = [];
      for (const e of wave) {
        const role = (enemies.find((x) => x.enemy_id === e.enemy_id) as Json).role as string;
        for (let i = 0; i < e.count; i++) placed.push({ unit_id: e.enemy_id, level: st.enemy_level, slot: placed.length, row: REAR_ROLES.test(role) && placed.length > 0 ? 'rear' : 'front' });
      }
      let fronts = 0;
      for (const p of placed) if (p.row === 'front' && ++fronts > 2) p.row = 'rear';
      return placed;
    };
    const [firstWave, ...laterWaves] = st.enemy_waves as Json[][];
    const foes = place(firstWave!);
    // waves 2+ follow in order once the field is cleared (engine Encounter.waves)
    const waves = laterWaves.map(place);
    const entry = story.entries.find((entry) => entry.stageId === st.stage_id);
    if (!entry) throw new Error(`stage ${st.stage_id} has no canonical story entry`);
    const phaseStories = bindCampaignPhaseStories(entry, foes, pack);
    const enc = Encounter.parse({
      schema_version: 1,
      encounter_id: id,
      stage_id: st.stage_id,
      title_en: st.title_en,
      location_id: ch.location_id,
      pre_story: entry.preStory,
      post_story: entry.postStory,
      ...(phaseStories.length ? { phase_stories: phaseStories } : {}),
      seed: seedOf(st.stage_id),
      party_mode: tutorial ? 'fixed' : 'owned',
      party: tutorial ? [{ unit_id: 'mahmut', level: 1, slot: 0, row: 'front' }, { unit_id: 'fadyme', level: 1, slot: 1, row: 'rear' }] : [],
      ...(st.guest_characters.length ? { guests: st.guest_characters } : {}),
      enemies: foes,
      ...(waves.length ? { waves } : {}),
      // D-27: attribute enemies are tuned in content/balance/attributes.json; the narrative's flat multiplier only applies to legacy stat blocks
      ...(st.enemy_stat_multiplier !== 1 && foes.some((f) => !pack.units.find((u) => u.unit_id === f.unit_id)?.attributes) ? { enemy_stat_multiplier: { value: st.enemy_stat_multiplier, applies_to: ['hp', 'atk'] } } : {}),
      provenance: { source: `${NARR}/stages_part1.json#${st.stage_id}` }
    });
    if ((enc.waves?.length ?? 0) !== waves.length) throw new Error(`stage ${st.stage_id}: lost enemy waves`);
    encounters.set(id, enc);
    writeJson(`${OUT}/encounters/${id}.json`, enc);

    const rewards: RewardAttachment[] = [];
    for (const r of st.story_rewards as Json[]) {
      if (r.recruit_character_id) rewards.push({ type: 'character', itemId: r.recruit_character_id });
      if (r.grant_item_id) rewards.push({ type: 'item', itemId: r.grant_item_id, quantity: 1 });
    }
    if (st.drop_table_id && !dropTables.has(st.drop_table_id)) throw new Error(`stage ${st.stage_id}: unknown drop table ${st.drop_table_id}`);
    battleNodes.set(id, {
      node_id: id,
      title_en: st.title_en,
      kind: 'battle',
      encounter: `encounters/${id}.json`,
      ration_class: st.stamina_cost === 0 ? 'tutorial' : 'campaign',
      ...(st.boss_id ? { boss: true } : {}),
      ...(rewards.length ? { rewards: { first_clear: rewards, three_star: [], repeat: [] } } : {}),
      ...(st.drop_table_id ? { drop: { table: st.drop_table_id, ...(st.boss_id && bossSets.get(st.boss_id) ? { boss_set_id: bossSets.get(st.boss_id) } : {}) } } : {})
    });
    nodeIds.push(id);

    // D-29 Phase E: Hard mode variant per normal battle stage (stronger enemy levels + stat multiplier, own first-clear rewards)
    const hardId = `${id}_hard`;
    const hardLevel = Math.min(20, Math.max(15, Number(st.enemy_level) + 5));
    const hardScale = (wave: { unit_id: string; level: number; slot: number; row: 'front' | 'rear' }[]) =>
      wave.map((p) => ({ ...p, level: hardLevel }));
    const hardEnc = Encounter.parse({
      schema_version: 1,
      encounter_id: hardId,
      stage_id: `${st.stage_id}H`,
      title_en: `${st.title_en} (Hard)`,
      location_id: ch.location_id,
      seed: seedOf(`${st.stage_id}:hard`),
      party_mode: 'owned',
      party: [],
      enemies: hardScale(foes),
      ...(waves.length ? { waves: waves.map(hardScale) } : {}),
      enemy_stat_multiplier: { value: st.boss_id ? 1.35 : 1.25, applies_to: ['hp', 'atk', 'def'] },
      provenance: { source: `${NARR}/stages_part1.json#${st.stage_id}` }
    });
    writeJson(`${OUT}/encounters/${hardId}.json`, hardEnc);
    hardBattleNodes.set(id, {
      node_id: hardId,
      title_en: `${st.title_en} (Hard)`,
      kind: 'battle',
      difficulty: 'hard',
      encounter: `encounters/${hardId}.json`,
      ration_class: 'campaign',
      ...(st.boss_id ? { boss: true } : {}),
      rewards: {
        first_clear: [
          { type: 'currency', currency: 'eclipse_token', amount: st.boss_id ? 120 : 60 },
          { type: 'account_xp', amount: st.boss_id ? 100 : 50 }
        ],
        three_star: [{ type: 'currency', currency: 'eclipse_token', amount: st.boss_id ? 60 : 30 }],
        repeat: []
      },
      ...(st.drop_table_id ? { drop: { table: st.drop_table_id, ...(st.boss_id && bossSets.get(st.boss_id) ? { boss_set_id: bossSets.get(st.boss_id) } : {}) } } : {})
    });
  }
}
if (battleNodes.size !== story.entries.filter((entry) => entry.stageId).length) throw new Error('canonical/mechanical stage coverage differs');
let previous: string | undefined;
for (const [chapterNumber, ch] of chapters.entries()) {
  // Canon uses fuller names for chapters 2 and 5; stage IDs prove the snapshot mapping.
  const chapterId = story.coverage.chapter_ids[chapterNumber];
  if (!chapterId) throw new Error(`mechanical chapter ${ch.chapter_id} has no canonical chapter`);
  const entries = story.entries.filter((entry) => entry.chapterId === chapterId);
  const stageIds = new Set((ch.nodes as Json[]).map((node) => node.stage_id as string));
  if (entries.filter((entry) => entry.stageId).length !== stageIds.size || entries.some((entry) => entry.stageId && !stageIds.has(entry.stageId))) throw new Error(`chapter ${ch.chapter_id}: canonical stage mapping differs`);
  const nodes = entries.map((entry) => {
    const node = entry.stageId ? battleNodes.get(entry.nodeId)! : { node_id: entry.nodeId, title_en: entry.title, kind: 'story', story: entry.story };
    const linked = { ...node, ...(previous ? { requires: previous } : {}) };
    previous = entry.nodeId;
    return linked;
  });
  if (!nodes.length) throw new Error(`chapter ${ch.chapter_id} has no canonical story entries`);
  chapterOut.push({ chapter_id: chapterId, title_en: ch.title_en, nodes });
}
let hardPrevious = previous;
for (const ch of chapterOut.slice(1)) {
  const normalBattles = (ch.nodes as Json[]).filter((n) => n.kind === 'battle' && n.difficulty !== 'hard');
  for (const nb of normalBattles) {
    const hardNode = hardBattleNodes.get(nb.node_id as string)!;
    const linkedHard = { ...hardNode, requires: hardPrevious };
    hardPrevious = hardNode.node_id as string;
    (ch.nodes as Json[]).push(linkedHard);
  }
}
writeJson(`${OUT}/chapters/chapter_index.json`, ChapterIndex.parse({ schema_version: 1, chapters: chapterOut, story_coverage: story.coverage, recruit_selectors: story.selectors }));

// ---- art manifest: base art + SD Chibi archetype atlases for every campaign unit -------------------------------------------
const art = base; // the base art manifest carries the tutorial cast (Mahmut, Fadyme, Bellbound Dead, Hollow Pilgrim)
rmSync(join(ROOT, `${OUT}/art`), { recursive: true, force: true });
mkdirSync(join(ROOT, `${OUT}/art`), { recursive: true });
const approvedEntries = loadApprovedArtEntries(ROOT, false);
const usedEmotions = new Map<string, Set<string>>();
for (const scene of [...story.files.values(), ...library.entries.flatMap((entry) => entry.scenes)]) {
  for (const c of scene.commands) {
    if (c.op === 'show' && !usedEmotions.has(c.character)) usedEmotions.set(c.character, new Set(['composed']));
    if (c.op === 'say') {
      const set = usedEmotions.get(c.speaker) ?? new Set(['composed']);
      if (c.emotion) set.add(c.emotion);
      usedEmotions.set(c.speaker, set);
    }
  }
}
const rawPortraits = new Map<string, { emotions: Record<string, string>; images: Record<string, string> }>();
for (const entry of approvedEntries) {
  if (!entry.targets.portraits) continue;
  for (const [charId, pTarget] of Object.entries(entry.targets.portraits)) {
    if (art.portraits[charId]) continue;
    const prev = rawPortraits.get(charId) ?? { emotions: {}, images: {} };
    rawPortraits.set(charId, {
      emotions: { ...prev.emotions, ...pTarget.emotions },
      images: { ...prev.images, ...pTarget.images }
    });
  }
}
const campaignPortraits: ArtManifest['portraits'] = structuredClone(art.portraits);
for (const [charId, p] of Object.entries(campaignPortraits)) {
  const tags = usedEmotions.get(charId) ?? new Set<string>();
  for (const tag of tags) {
    if (p.emotions[tag]) continue;
    const t = tag.toLowerCase();
    if (charId === 'mahmut') {
      if (/dry|wry|amused|casual|polite|gentle|warm|grateful|tender|hopeful/.test(t) && p.images.dry_humor) {
        p.emotions[tag] = 'dry_humor';
      } else if (/protect|defian|command|decisive|urgent|warn|anger|angry|firm|resolv|promise|hard|raw|grief/.test(t) && p.images.protective_resolve) {
        p.emotions[tag] = 'protective_resolve';
      } else if (/watch|alert|observ|careful|search|question|skeptic|wary|tense|tight|strained|alarm|shaken|stun|surpris|fear|troubl|remors|asham|hurt/.test(t) && p.images.watchful) {
        p.emotions[tag] = 'watchful';
      } else {
        p.emotions[tag] = 'composed';
      }
    } else if (charId === 'fadyme') {
      if (/wry|dry|amused|knowing|deflect/.test(t) && p.images.wry) {
        p.emotions[tag] = 'wry';
      } else if (/warm|smile|smiling|gentle|soft|kind|hopeful|reliev|encourag|laugh|light|touch/.test(t) && p.images.warm) {
        p.emotions[tag] = 'warm';
      } else if (/resolv|defian|firm|focus|sharp|percept|observ|careful|wary|guard|serious|strained|tear|fragil|vulnerable|afraid|plead|sad|wistful|break|stun|disbelief|breathless|uneasy/.test(t) && p.images.resolve) {
        p.emotions[tag] = 'resolve';
      } else {
        p.emotions[tag] = 'composed';
      }
    }
  }
}
const playableCharIds = new Set(chars.map((c) => c.character_id));
for (const [charId, p] of rawPortraits) {
  const wantedTags = usedEmotions.get(charId) ?? new Set(['composed']);
  const wantedImgs = playableCharIds.has(charId)
    ? new Set(['composed', ...[...wantedTags].map((t) => p.emotions[t] ?? 'composed')])
    : new Set(['composed']);
  const images = Object.fromEntries(Object.entries(p.images).filter(([k]) => wantedImgs.has(k)));
  const emotions = Object.fromEntries(Object.entries(p.emotions).map(([t, img]) => [t, images[img] ? img : 'composed']));
  for (const t of wantedTags) {
    if (!emotions[t]) emotions[t] = 'composed';
  }
  if (!emotions.composed) emotions.composed = 'composed';
  for (const relPath of Object.values(images)) {
    writeOut(`${OUT}/${relPath}`, readFileSync(join(ROOT, 'content/approved_art', relPath)));
  }
  campaignPortraits[charId] = { emotions, images };
}

const heroArcanistEntry = readJson<Json>('content/approved_art/entries/roster_hero_arcanist_chibi_sheet.json');
const enemyKnightEntry = readJson<Json>('content/approved_art/entries/campaign_enemy_knight_chibi_sheet.json');
const heroArcanistBytes = readFileSync(join(ROOT, 'content/approved_art/art/atlas_hero_arcanist.webp'));
const enemyKnightBytes = readFileSync(join(ROOT, 'content/approved_art/art/atlas_enemy_knight.webp'));

const heroArcanistAtlas = heroArcanistEntry.targets.atlases.atlas_hero_arcanist;
const enemyKnightAtlas = enemyKnightEntry.targets.atlases.atlas_enemy_knight;
const heroArcanistUnit = heroArcanistEntry.targets.units.hero_arcanist;
const enemyKnightUnit = enemyKnightEntry.targets.units.enemy_knight;

const atlases: Record<string, unknown> = { ...art.atlases };
const unitArt: Record<string, unknown> = { ...art.units };
for (const entry of approvedEntries) {
  if (entry.class !== 'unit_sheet' || !entry.targets.units) continue;
  for (const [uKey, uTarget] of Object.entries(entry.targets.units)) {
    if (art.units[uKey] || uKey === 'hero_arcanist' || uKey === 'enemy_knight') continue;
    for (const out of entry.outputs) {
      writeOut(`${OUT}/${out.path}`, readFileSync(join(ROOT, 'content/approved_art', out.path)));
    }
    Object.assign(atlases, entry.targets.atlases ?? {});
    unitArt[uKey] = uTarget;
  }
}
const placeholders: string[] = [];
for (const u of pack.units) {
  if (unitArt[u.art_key]) continue;
  const tag = `${u.unit_id} ${u.role}`.toLowerCase();
  if (u.kind === 'character') {
    const isFrontMartial = u.formation_affinity === 'front' || /tank|bruiser|vanguard|knight|defender|shield|warden/.test(tag);
    const template = isFrontMartial ? art.units.mahmut! : heroArcanistUnit;
    unitArt[u.art_key] = { ...template, facing: 'right', height_px: isFrontMartial ? 258 : 248 };
  } else {
    const isKnightOrBoss = Boolean(u.boss) || /knight|warden|sentinel|guard|captain|lord|vanguard|bruiser|brute|executioner|inquisitor/.test(tag);
    const isPilgrimOrCaster = /caster|pilgrim|choir|priest|acolyte|lantern|whisper|shade|weaver|chanter/.test(tag);
    const template = isKnightOrBoss
      ? enemyKnightUnit
      : isPilgrimOrCaster
        ? art.units.hollow_pilgrim!
        : art.units.bellbound_dead!;
    unitArt[u.art_key] = {
      ...template,
      facing: 'left',
      height_px: u.boss ? 310 : isKnightOrBoss ? 260 : 242
    };
  }
  placeholders.push(u.art_key);
}
if (placeholders.length > 0) {
  writeOut(`${OUT}/art/atlas_hero_arcanist.webp`, heroArcanistBytes);
  writeOut(`${OUT}/art/atlas_enemy_knight.webp`, enemyKnightBytes);
  writeOut(`${OUT}/art/atlas_placeholder.webp`, heroArcanistBytes);
  atlases.atlas_hero_arcanist = heroArcanistAtlas;
  atlases.atlas_enemy_knight = enemyKnightAtlas;
  atlases.atlas_placeholder = { ...heroArcanistAtlas, image: 'art/atlas_placeholder.webp' };
  unitArt.hero_arcanist = heroArcanistUnit;
  unitArt.enemy_knight = enemyKnightUnit;
}
// breakable boss objectives use their dedicated intact + pulse + broken sprites packed in atlas_objective.webp (9x3 grid)
const OW = 192;
const OBJ_FAMILIES = [
  'jaw_bell',
  'wax_seal',
  'signal_banner',
  'flask_rack',
  'signal_standard',
  'mirror_frame',
  'chain_joint',
  'ankle_anchor',
  'altar_pylon',
] as const;
const objFrames: Record<string, [number, number, number, number]> = { idle: [0, 0, OW, OW] };
for (let c = 0; c < OBJ_FAMILIES.length; c++) {
  const fam = OBJ_FAMILIES[c]!;
  objFrames[`${fam}_intact`] = [c * OW, 0, OW, OW];
  objFrames[`${fam}_pulse`] = [c * OW, OW, OW, OW];
  objFrames[`${fam}_broken`] = [c * OW, OW * 2, OW, OW];
}
const OBJ_MAP: Record<string, { intact: string; pulse: string; broken: string }> = {
  jaw_bell: { intact: 'jaw_bell_intact', pulse: 'jaw_bell_pulse', broken: 'jaw_bell_broken' },
  wax_seal: { intact: 'wax_seal_intact', pulse: 'wax_seal_pulse', broken: 'wax_seal_broken' },
  signal_banner: { intact: 'signal_banner_intact', pulse: 'signal_banner_pulse', broken: 'signal_banner_broken' },
  flask_rack_left: { intact: 'flask_rack_intact', pulse: 'flask_rack_pulse', broken: 'flask_rack_broken' },
  flask_rack_right: { intact: 'flask_rack_intact', pulse: 'flask_rack_pulse', broken: 'flask_rack_broken' },
  signal_standard: { intact: 'signal_standard_intact', pulse: 'signal_standard_pulse', broken: 'signal_standard_broken' },
  mirror_frame: { intact: 'mirror_frame_intact', pulse: 'mirror_frame_pulse', broken: 'mirror_frame_broken' },
  chain_joint_left: { intact: 'chain_joint_intact', pulse: 'chain_joint_pulse', broken: 'chain_joint_broken' },
  chain_joint_right: { intact: 'chain_joint_intact', pulse: 'chain_joint_pulse', broken: 'chain_joint_broken' },
  ankle_anchor: { intact: 'ankle_anchor_intact', pulse: 'ankle_anchor_pulse', broken: 'ankle_anchor_broken' },
  altar_pylon_left: { intact: 'altar_pylon_intact', pulse: 'altar_pylon_pulse', broken: 'altar_pylon_broken' },
  altar_pylon_center: { intact: 'altar_pylon_intact', pulse: 'altar_pylon_pulse', broken: 'altar_pylon_broken' },
  altar_pylon_right: { intact: 'altar_pylon_intact', pulse: 'altar_pylon_pulse', broken: 'altar_pylon_broken' },
};
const approvedObjAtlas = join(ROOT, 'content/approved_art/art/atlas_objective.webp');
if (existsSync(approvedObjAtlas)) {
  writeOut(`${OUT}/art/atlas_objective.webp`, readFileSync(approvedObjAtlas));
  atlases.atlas_objective = { image: 'art/atlas_objective.webp', width: OW * 9, height: OW * 3, frames: objFrames };
} else {
  const objSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OW}"><circle cx="96" cy="96" r="80" fill="#3b2a4d" stroke="#e7c36a" stroke-width="6"/><path d="M60 120 L96 52 L132 120 Z" fill="none" stroke="#e7c36a" stroke-width="7" stroke-linejoin="round"/><circle cx="96" cy="108" r="7" fill="#e7c36a"/></svg>`;
  writeOut(`${OUT}/art/atlas_objective.webp`, await sharp(Buffer.from(objSvg)).webp({ quality: 85 }).toBuffer());
  atlases.atlas_objective = { image: 'art/atlas_objective.webp', width: OW, height: OW, frames: { idle: [0, 0, OW, OW] } };
}
for (const u of pack.units) {
  for (const o of u.boss?.phases.flatMap((p) => p.objectives) ?? []) {
    if (unitArt[o.objective_id]) continue;
    const mapping = existsSync(approvedObjAtlas) ? OBJ_MAP[o.objective_id] : undefined;
    const intactFrame = mapping?.intact ?? 'idle';
    const pulseFrame = mapping?.pulse ?? intactFrame;
    const brokenFrame = mapping?.broken ?? intactFrame;
    const states = Object.fromEntries(
      ['idle', 'walk', 'basic', 'active', 'ultimate', 'hit', 'defeat', 'victory'].map((st) => [
        st,
        {
          frame: st === 'defeat' ? brokenFrame : intactFrame,
          scale: 1,
          foot_y: 0.96,
          pivot_x: 0.5,
          ...(st === 'hit' && brokenFrame !== intactFrame
            ? { animation: { frames: [intactFrame, brokenFrame, intactFrame], fps: 8, loop: false } }
            : st === 'defeat' && brokenFrame !== intactFrame
              ? { animation: { frames: [intactFrame, brokenFrame], fps: 6, loop: false } }
              : pulseFrame !== intactFrame
                ? {
                    animation: {
                      frames: [intactFrame, pulseFrame, intactFrame],
                      fps: st === 'idle' ? 4 : 6,
                      loop: st === 'idle' || st === 'walk' || st === 'victory',
                    },
                  }
                : {}),
        },
      ]),
    );
    unitArt[o.objective_id] = { atlas: 'atlas_objective', facing: 'left', height_px: 150, states };
  }
}

// placeholder backdrops for the locations that have no painted background yet (a dim gradient, one colour per place)
const TINT: Record<string, [string, string]> = {
  cathedral_saint_luthos: ['#4a3b64', '#14101f'],
  village_oakhaven: ['#6a3a32', '#1a0f10'],
  undercity_subterranean: ['#24424a', '#0b1417'],
  bridge_forsaken: ['#3c4a66', '#10141f'],
  estate_ashen_lord: ['#55464f', '#16111a'],
  altar_first_eclipse: ['#5b2b4a', '#12060f']
};
const backgrounds: Record<string, string> = {
  ...art.backgrounds,
  ...(art.backgrounds.forgotten_stone_crossing ? { bridge_forsaken: art.backgrounds.forgotten_stone_crossing } : {}),
  ...(art.backgrounds.shelter_courtyard_dusk ? { village_oakhaven: art.backgrounds.shelter_courtyard_dusk } : {})
};
for (const entry of approvedEntries) {
  if (!entry.targets.backgrounds) continue;
  for (const [bgKey, bgPath] of Object.entries(entry.targets.backgrounds)) {
    if (art.backgrounds[bgKey]) continue;
    for (const out of entry.outputs) {
      writeOut(`${OUT}/${out.path}`, readFileSync(join(ROOT, 'content/approved_art', out.path)));
    }
    backgrounds[bgKey] = bgPath;
  }
}
for (const loc of new Set([...chapters.map((ch) => ch.location_id as string), ...[...story.files.values()].map((scene) => scene.location_id), ...library.entries.flatMap((entry) => entry.scenes.map((scene) => scene.location_id))])) {
  if (backgrounds[loc]) continue;
  const [a, b] = TINT[loc] ?? ['#3a3048', '#0f0b16'];
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><ellipse cx="640" cy="760" rx="900" ry="220" fill="#000" opacity="0.35"/></svg>`;
  writeOut(`${OUT}/art/bg_${loc}.webp`, await sharp(Buffer.from(bg)).webp({ quality: 70 }).toBuffer());
  backgrounds[loc] = `art/bg_${loc}.webp`;
}
const compiledArt = ArtManifest.parse({ ...art, portraits: campaignPortraits, atlases, units: unitArt, backgrounds });
const { stills, ...artWithoutStills } = compiledArt;
writeJson(`${OUT}/art/art_manifest.json`, Object.keys(stills).length ? compiledArt : artWithoutStills);

// ---- validate as the publisher does: base overlaid with this patch -------------------------------------------------------------------
const walk = (dir: string, rel = ''): string[] => readdirSync(join(dir, rel)).flatMap((n) => { const r = rel ? `${rel}/${n}` : n; return statSync(join(dir, r)).isDirectory() ? walk(dir, r) : [r]; });
const load = (dir: string): Map<string, Uint8Array> => new Map(walk(dir).filter((p) => p !== 'release.json').map((p) => [p, new Uint8Array(readFileSync(join(dir, p)))]));
const effective = load(join(ROOT, 'content/base'));
for (const [k, v] of load(join(ROOT, OUT))) effective.set(k, v);
const summary = validateContentSet(effective);

// ---- balance probe: can the stage be won at its recommended level with the heroes a player owns at that point? ----------------------------------------
const FREE = ['mahmut', 'fadyme'];
const owned = [...FREE];
const rows: string[] = [];
const charById = new Map(chars.map((c) => [c.character_id as string, c]));
/** starter gear: the first 3★ weapon of the hero's weapon type and the 3★ padded armor, both at the hero's level, no accessories */
const weapons = readJson<Json>(`${NARR}/weapons_part1.json`).weapons as Json[];
const starterArmor = (readJson<Json>(`${NARR}/armors_part1.json`).armors as Json[]).find((a) => a.armor_id === 'armor_padded_3_01') as Json;
const starterGear = (c: Json, level: number): GearStats => {
  const weapon = weapons.filter((w) => w.rarity === 3 && w.weapon_type === c.equip_weapon_type).sort((x, y) => String(x.weapon_id).localeCompare(String(y.weapon_id)))[0];
  const pieces: GearPiece[] = [{ slot: 'armor', setId: null, level, ascension: 0, ...armorStats(starterArmor) }];
  if (weapon) pieces.push({ slot: 'weapon', setId: null, level, ascension: 0, ...weaponStats(weapon as never) });
  return aggregateGear(CANON_PROGRESSION, pieces, catalogRoleStat(c.combat_role), {});
};
const catalogRoleStat = (role: string): string => {
  const key = Object.keys(ROLE_STAT.roleStat).find((k) => k !== 'default' && role.includes(k)) as keyof typeof ROLE_STAT.roleStat | undefined;
  return ROLE_STAT.roleStat[key ?? 'default'];
};
const member = (id: string, level: number, loan: boolean, geared: boolean): BattleParty[number] => {
  const c = charById.get(id) as Json;
  const block = balanceAttributes(id, c.rarity);
  const gear = geared && block ? starterGear(c, level) : emptyGearStats();
  const { attributes: _shown, ...stats } = block ? attributeStats(block, level, gear) : { attributes: null, ...finalStats(c.base_stats_level_1, c.growth_per_level, level, gear) };
  return { unit_id: id, level, slot: 0, row: c.formation_affinity === 'front' ? 'front' : 'rear', stats, ...(loan ? { loan: true } : {}) };
};
let results = 0;
for (const st of stages) {
  const enc = encounters.get(snake(st.stage_id)) as Encounter;
  const level = st.recommended_level as number;
  const guests = (enc.guests ?? []).slice(0, 5);
  const team = (enc.party_mode === 'fixed' ? enc.party.map((p) => p.unit_id) : [...guests, ...owned.filter((o) => !guests.includes(o))]).slice(0, 5);
  const cells: string[] = [];
  let names = '';
  for (const geared of [false, true]) {
    const draft = team.map((id) => member(id, level, guests.includes(id) && !owned.includes(id), geared));
    const front = draft.filter((m) => m.row === 'front').slice(0, 2);
    const rest = draft.filter((m) => !front.includes(m));
    const party = BattleParty.parse([...front.map((m, i) => ({ ...m, slot: i, row: 'front' as const })), ...rest.map((m, i) => ({ ...m, slot: front.length + i, row: 'rear' as const }))]);
    names = party.map((m) => m.unit_id.split('_')[0]).join(', ');
    let wins = 0;
    let rounds = 0;
    const tries = 8;
    for (let k = 0; k < tries; k++) {
      const e = Encounter.parse({ ...enc, seed: (enc.seed + k * 7919) >>> 0 });
      const { battle } = playAuto(pack as UnitPack, e, enc.party_mode === 'fixed' ? undefined : party);
      rounds += battle.log.filter((ev) => ev.type === 'round_end').length;
      if (battle.result?.winner === 'player') wins++;
    }
    cells.push(`${wins}/${tries}`, (rounds / tries).toFixed(1));
  }
  results++;
  rows.push(`| ${st.stage_id} | ${st.node_type} | ${level} | ${names} | ${cells.join(' | ')} |`);
  for (const r of st.story_rewards as Json[]) if (r.recruit_character_id && !owned.includes(r.recruit_character_id)) owned.push(r.recruit_character_id);
}
writeOut(
  'docs/combat/CAMPAIGN_BALANCE.md',
  `# Campaign balance probe (generated — do not edit)

Generated by \`npm run build:campaign\`. Every stage is played ${8} times (different seeds) with the **Auto Battle** policy by the heroes a player owns at that point
(free start + story recruits, no gacha, no skill ranks), at the stage's **recommended level**, plus the stage's story loans, twice: with **no gear**, and with
**starter gear** (a 3★ weapon of the hero's weapon type and the 3★ padded armor at the hero's level, no accessories). R16 checks the full runtime configuration.
Stats follow D-27 (STR/INT/VIT/AGI, docs/combat/STAT_MATH.md) from content/balance/attributes.json; the narrative's \`enemy_stat_multiplier\` is not
applied to attribute enemies. Targets with starter gear: normal stages 4-6 rounds, bosses 8-12, nearly every stage won; without gear most stages still winnable.

| Stage | Type | Level | Party | Wins (no gear) | Rounds | Wins (starter gear) | Rounds |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`
);
console.log(`campaign: ${summary.units} units, ${nodeIds.length} stages, ${story.entries.length} story entries, ${story.files.size} scenes, ${story.coverage.entries.reduce((n, entry) => n + entry.line_ids.length, 0)} lines, ${placeholders.length} placeholder-art units, ${results} stages probed`);
