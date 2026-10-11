/**
 * Builds the Part I campaign release from the preserved narrative data (35 stages, 7 chapters, the full cast) as a data patch over the base release:
 *   content/patches/rel_0003_part1_campaign/   units (20 heroes, 20 enemies, 7 bosses), 35 owned-hero encounters, chapter index, art manifest
 * Units without production art point at one generic placeholder atlas, so the whole campaign is playable while real art is made.
 * It also plays every stage with the Auto Battle policy and reports whether the stage can be won at its recommended level (docs/combat/CAMPAIGN_BALANCE.md).
 * Run: npm run build:campaign
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { playAuto } from '../packages/combat/src/index';
import { ArtManifest, BattleParty, ChapterIndex, Encounter, type UnitPack, validateContentSet, type RewardAttachment } from '../packages/content-schema/src/index';
import { finalStats } from '../packages/economy/src/index';
import { buildUnitPack } from './lib/data';
import { ROOT, readJson, writeJson, writeOut } from './lib/fsutil';

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

// ---- encounters + chapter index ----------------------------------------------------------------------------------------
const nodeIds: string[] = [];
const chapterOut: Json[] = [{ chapter_id: 'tutorial', title_en: 'Before the Road', nodes: [{ node_id: 't1', title_en: 'The First Step', kind: 'battle', encounter: 'encounters/tutorial_t1.json' }] }];
let prev: string | null = null;
const encounters = new Map<string, Encounter>();

for (const ch of chapters) {
  const nodes: Json[] = [];
  for (const n of ch.nodes as Json[]) {
    const st = stages.find((s) => s.stage_id === n.stage_id) as Json;
    const id = snake(st.stage_id);
    const tutorial = st.stage_id === '1-1';
    const foes: { unit_id: string; level: number; slot: number; row: 'front' | 'rear' }[] = [];
    let slot = 0;
    for (const wave of (st.enemy_waves as Json[][]).slice(0, 1)) {
      for (const e of wave) {
        const role = (enemies.find((x) => x.enemy_id === e.enemy_id) as Json).role as string;
        for (let i = 0; i < e.count; i++) {
          foes.push({ unit_id: e.enemy_id, level: st.enemy_level, slot, row: REAR_ROLES.test(role) && slot > 0 ? 'rear' : 'front' });
          slot++;
        }
      }
    }
    // at most two front-row foes keep the formation readable (canon 2 front + 3 rear)
    let fronts = 0;
    for (const f of foes) {
      if (f.row === 'front' && ++fronts > 2) f.row = 'rear';
    }
    const enc = Encounter.parse({
      schema_version: 1,
      encounter_id: id,
      stage_id: st.stage_id,
      title_en: st.title_en,
      location_id: ch.location_id,
      seed: seedOf(st.stage_id),
      party_mode: tutorial ? 'fixed' : 'owned',
      party: tutorial ? [{ unit_id: 'mahmut', level: 1, slot: 0, row: 'front' }, { unit_id: 'fadyme', level: 1, slot: 1, row: 'rear' }] : [],
      ...(st.guest_characters.length ? { guests: st.guest_characters } : {}),
      enemies: foes,
      ...(st.enemy_stat_multiplier !== 1 ? { enemy_stat_multiplier: { value: st.enemy_stat_multiplier, applies_to: ['hp', 'atk'] } } : {}),
      provenance: { source: `${NARR}/stages_part1.json#${st.stage_id}` }
    });
    encounters.set(id, enc);
    writeJson(`${OUT}/encounters/${id}.json`, enc);

    const rewards: RewardAttachment[] = [];
    for (const r of st.story_rewards as Json[]) {
      if (r.recruit_character_id) rewards.push({ type: 'character', itemId: r.recruit_character_id });
      if (r.grant_item_id) rewards.push({ type: 'item', itemId: r.grant_item_id, quantity: 1 });
    }
    if (st.drop_table_id && !dropTables.has(st.drop_table_id)) throw new Error(`stage ${st.stage_id}: unknown drop table ${st.drop_table_id}`);
    nodes.push({
      node_id: id,
      title_en: st.title_en,
      kind: 'battle',
      encounter: `encounters/${id}.json`,
      ...(prev ? { requires: prev } : {}),
      ration_class: st.stamina_cost === 0 ? 'tutorial' : 'campaign',
      ...(st.boss_id ? { boss: true } : {}),
      ...(rewards.length ? { rewards: { first_clear: rewards, three_star: [], repeat: [] } } : {}),
      ...(st.drop_table_id ? { drop: { table: st.drop_table_id, ...(st.boss_id && bossSets.get(st.boss_id) ? { boss_set_id: bossSets.get(st.boss_id) } : {}) } } : {})
    });
    nodeIds.push(id);
    prev = id;
  }
  chapterOut.push({ chapter_id: ch.chapter_id, title_en: ch.title_en, nodes });
}
writeJson(`${OUT}/chapters/chapter_index.json`, ChapterIndex.parse({ schema_version: 1, chapters: chapterOut }));

// ---- art manifest: base art + one placeholder atlas for every unit that has no production art yet ------------------------------
const base = ArtManifest.parse(readJson(`content/base/art/art_manifest.json`));
const rel2 = ArtManifest.parse(readJson(`content/patches/rel_0002_road_forgotten/art/art_manifest.json`));
const art = { ...base, atlases: { ...base.atlases, ...rel2.atlases }, units: { ...base.units, ...rel2.units } };
mkdirSync(join(ROOT, `${OUT}/art`), { recursive: true });
copyFileSync(join(ROOT, 'content/patches/rel_0002_road_forgotten/art/atlas_hollow_pilgrim.webp'), join(ROOT, `${OUT}/art/atlas_hollow_pilgrim.webp`));
const W = 256;
const H = 384;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b5a88"/><stop offset="1" stop-color="#2b2238"/></linearGradient></defs><ellipse cx="128" cy="360" rx="70" ry="14" fill="#000" opacity="0.35"/><path d="M128 150 C60 160 56 300 70 350 L186 350 C200 300 196 160 128 150 Z" fill="url(#g)" stroke="#c9b8e8" stroke-width="3"/><circle cx="128" cy="100" r="56" fill="url(#g)" stroke="#c9b8e8" stroke-width="3"/></svg>`;
writeOut(`${OUT}/art/atlas_placeholder.webp`, await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer());
const frames = { idle: [0, 0, W, H] as [number, number, number, number] };
const atlases: Record<string, unknown> = { ...art.atlases, atlas_placeholder: { image: 'art/atlas_placeholder.webp', width: W, height: H, frames } };
const unitArt: Record<string, unknown> = { ...art.units };
const placeholders: string[] = [];
for (const u of pack.units) {
  if (unitArt[u.art_key]) continue;
  const states = Object.fromEntries(['idle', 'walk', 'basic', 'active', 'ultimate', 'hit', 'defeat', 'victory'].map((s) => [s, { frame: 'idle', scale: 1, foot_y: 0.97, pivot_x: 0.5 }]));
  unitArt[u.art_key] = { atlas: 'atlas_placeholder', facing: 'right', height_px: u.role.includes('boss') ? 420 : 340, states };
  placeholders.push(u.art_key);
}
// breakable boss objectives are drawn from one generic "weak point" icon until each gets its own art
const OW = 192;
const objSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OW}"><circle cx="96" cy="96" r="80" fill="#3b2a4d" stroke="#e7c36a" stroke-width="6"/><path d="M60 120 L96 52 L132 120 Z" fill="none" stroke="#e7c36a" stroke-width="7" stroke-linejoin="round"/><circle cx="96" cy="108" r="7" fill="#e7c36a"/></svg>`;
writeOut(`${OUT}/art/atlas_objective.webp`, await sharp(Buffer.from(objSvg)).webp({ quality: 85 }).toBuffer());
atlases.atlas_objective = { image: 'art/atlas_objective.webp', width: OW, height: OW, frames: { idle: [0, 0, OW, OW] } };
for (const u of pack.units) {
  for (const o of u.boss?.phases.flatMap((p) => p.objectives) ?? []) {
    if (unitArt[o.objective_id]) continue;
    const states = Object.fromEntries(['idle', 'walk', 'basic', 'active', 'ultimate', 'hit', 'defeat', 'victory'].map((st) => [st, { frame: 'idle', scale: 1, foot_y: 0.97, pivot_x: 0.5 }]));
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
const backgrounds: Record<string, string> = { ...art.backgrounds };
for (const ch of chapters) {
  const loc = ch.location_id as string;
  if (backgrounds[loc]) continue;
  const [a, b] = TINT[loc] ?? ['#3a3048', '#0f0b16'];
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><ellipse cx="640" cy="760" rx="900" ry="220" fill="#000" opacity="0.35"/></svg>`;
  writeOut(`${OUT}/art/bg_${loc}.webp`, await sharp(Buffer.from(bg)).webp({ quality: 70 }).toBuffer());
  backgrounds[loc] = `art/bg_${loc}.webp`;
}
writeJson(`${OUT}/art/art_manifest.json`, ArtManifest.parse({ ...art, atlases, units: unitArt, backgrounds }));

// ---- validate as the publisher does: base overlaid with this patch -------------------------------------------------------------------
const walk = (dir: string, rel = ''): string[] => readdirSync(join(dir, rel)).flatMap((n) => { const r = rel ? `${rel}/${n}` : n; return statSync(join(dir, r)).isDirectory() ? walk(dir, r) : [r]; });
const load = (dir: string): Map<string, Uint8Array> => new Map(walk(dir).map((p) => [p, new Uint8Array(readFileSync(join(dir, p)))]));
const effective = load(join(ROOT, 'content/base'));
for (const [k, v] of load(join(ROOT, OUT))) effective.set(k, v);
const summary = validateContentSet(effective);

// ---- balance probe: can the stage be won at its recommended level with the heroes a player owns at that point? ----------------------------------------
const FREE = ['mahmut', 'fadyme'];
const owned = [...FREE];
const rows: string[] = [];
const charById = new Map(chars.map((c) => [c.character_id as string, c]));
const member = (id: string, level: number, loan: boolean): BattleParty[number] => {
  const c = charById.get(id) as Json;
  const stats = finalStats(c.base_stats_level_1, c.growth_per_level, level, { flat: {}, pct: {}, other: {} });
  return { unit_id: id, level, slot: 0, row: c.formation_affinity === 'front' ? 'front' : 'rear', stats, ...(loan ? { loan: true } : {}) };
};
let results = 0;
for (const st of stages) {
  const enc = encounters.get(snake(st.stage_id)) as Encounter;
  const level = st.recommended_level as number;
  const guests = (enc.guests ?? []).slice(0, 5);
  const team = (enc.party_mode === 'fixed' ? enc.party.map((p) => p.unit_id) : [...guests, ...owned.filter((o) => !guests.includes(o))]).slice(0, 5);
  const draft = team.map((id) => member(id, level, guests.includes(id) && !owned.includes(id)));
  const front = draft.filter((m) => m.row === 'front').slice(0, 2);
  const rest = draft.filter((m) => !front.includes(m));
  const party = BattleParty.parse([...front.map((m, i) => ({ ...m, slot: i, row: 'front' as const })), ...rest.map((m, i) => ({ ...m, slot: front.length + i, row: 'rear' as const }))]);
  let wins = 0;
  let stars = 0;
  const tries = 8;
  for (let k = 0; k < tries; k++) {
    const e = Encounter.parse({ ...enc, seed: (enc.seed + k * 7919) >>> 0 });
    const { battle } = playAuto(pack as UnitPack, e, enc.party_mode === 'fixed' ? undefined : party);
    if (battle.result?.winner === 'player') {
      wins++;
      stars += battle.result.stars;
    }
  }
  results++;
  rows.push(`| ${st.stage_id} | ${st.node_type} | ${level} | ${party.map((m) => m.unit_id.split('_')[0]).join(', ')} | ${wins}/${tries} | ${wins ? (stars / wins).toFixed(1) : '-'} |`);
  for (const r of st.story_rewards as Json[]) if (r.recruit_character_id && !owned.includes(r.recruit_character_id)) owned.push(r.recruit_character_id);
}
writeOut(
  'docs/combat/CAMPAIGN_BALANCE.md',
  `# Campaign balance probe (generated — do not edit)

Generated by \`npm run build:campaign\`. Every stage is played ${8} times (different seeds) with the **Auto Battle** policy by the heroes a player owns at that point
(free start + story recruits, no gacha, **no gear, no skill ranks**), at the stage's **recommended level**, plus the stage's story loans.
This is a smoke signal for the future balance pass, not a tuned result. The narrative's \`enemy_stat_multiplier\` (2.5 on every non-tutorial stage) is applied
to enemy HP and ATK — its exact meaning is not documented in the data (see docs/COMBAT_RULES.md).

| Stage | Type | Level | Party | Wins | Avg stars |
|---|---|---|---|---|---|
${rows.join('\n')}
`
);
console.log(`campaign: ${summary.units} units, ${nodeIds.length} stages, ${placeholders.length} placeholder-art units, ${results} stages probed`);
