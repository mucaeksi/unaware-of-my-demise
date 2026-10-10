/**
 * Narrative runtime snapshot -> validated runtime content (units, rules, story scenes, encounters).
 * Every output is parsed through the @uomd/content-schema zod schemas before it is written, so a
 * narrative value the engine cannot honour fails here, not on a player's phone.
 */
import {
  Encounter,
  IMPLEMENTED_OPS,
  RulesDef,
  SkillDef,
  StoryScene,
  UnitDef,
  UnitPack,
  type StatusDef
} from '../../packages/content-schema/src/index';
import { readJson, sha256, fileBytes } from './fsutil';

const NARR = 'narrative/09_VN_Scripts/Runtime_Snapshot/game/data';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const srcHash = (rel: string): string => sha256(fileBytes(`${NARR}/${rel}`));

/** Statuses the shipped engine implements; the rest stay out of runtime packs until supported. */
const SUPPORTED_STATUSES = new Set(['dread', 'stoneguard', 'taunt', 'break', 'decay', 'fracture', 'sanctuary']);

export function buildRules(): RulesDef {
  const rules = readJson<Json>(`${NARR}/content/battle_rules_part1.json`);
  const statuses: StatusDef[] = [];
  for (const s of rules.statuses as Json[]) {
    if (!SUPPORTED_STATUSES.has(s.status_id)) continue;
    const tags: string[] = s.tags ?? [];
    const category = tags.includes('control') && !tags.includes('buff') ? 'control' : tags.includes('buff') ? 'buff' : 'debuff';
    const def: Record<string, unknown> = {
      status_id: s.status_id,
      name_en: s.name_en,
      kind: s.kind,
      category,
      default_duration_turns: s.default_duration_turns
    };
    for (const k of ['outgoing_damage_multiplier', 'damage_taken_multiplier', 'healing_received_multiplier', 'def_multiplier', 'focus_gain_multiplier'] as const) {
      if (typeof s[k] === 'number') def[k] = s[k];
    }
    if (s.skip_next_action === true) def.skip_next_action = true;
    if (s.redirects_eligible_single_target_attacks === true) def.redirects_single_target_attacks = true;
    statuses.push(def as unknown as StatusDef);
  }
  const dmg = rules.damage;
  return RulesDef.parse({
    schema_version: 1,
    gauge_max: rules.turn_queue.gauge_max,
    max_pending_delay_fraction: rules.turn_queue.maximum_pending_delay_fraction,
    defense_scale: dmg.defense_scale,
    focus: {
      maximum: rules.focus.maximum,
      basic_gain: rules.focus.basic_attack_gain,
      active_gain: rules.focus.active_skill_gain,
      hit_gain: rules.focus.taking_hit_gain_per_hit,
      hit_gain_cap_per_turn: rules.focus.taking_hit_gain_max_per_actor_turn,
      ultimate_cost: rules.focus.ultimate_cost
    },
    crit: { chance: dmg.critical_chance_default, multiplier: dmg.critical_multiplier_default },
    element: {
      cycle: dmg.element_chart.cycle,
      advantage: dmg.element_chart.advantage_multiplier,
      disadvantage: dmg.element_chart.disadvantage_multiplier,
      neutral: dmg.element_chart.neutral_multiplier,
      weakness: dmg.element_chart.explicit_target_weakness_multiplier,
      resistance: dmg.element_chart.explicit_target_resistance_multiplier,
      mutual_pairs: [['Dawn', 'Veil']]
    },
    auto_battle: { heal_priority_hp_percent: rules.auto_battle.heal_priority_hp_percent, save_ultimate_until_boss: rules.auto_battle.save_ultimate_until_boss },
    statuses
  });
}

function convertOp(op: Json): Json {
  if (!IMPLEMENTED_OPS.includes(op.op)) throw new Error(`narrative uses op "${op.op}" the engine does not implement`);
  const { when, ...rest } = op;
  return when ? { ...rest, when } : rest;
}

function convertHook(h: Json): Json {
  const out: Json = { event: h.event, effect_ops: (h.effect_ops as Json[]).map(convertOp) };
  if (h.condition) out.condition = h.condition;
  if (h.limit) out.limit = h.limit;
  if (h.event_filter) out.event_filter = h.event_filter;
  return out;
}

function characterSkill(s: Json): SkillDef {
  const out: Json = {
    skill_id: s.skill_id,
    name_en: s.name_en,
    type: s.type,
    element: s.element,
    description_en: s.description_en,
    player_target: s.target_rule === 'single_enemy' ? 'enemy' : 'none',
    cooldown_turns: s.cooldown_turns ?? 0,
    focus_cost: s.focus_cost ?? 0,
    ai_priority: s.auto_priority ?? 0,
    effect_ops: (s.effect_ops as Json[]).map(convertOp)
  };
  if (s.event_hooks?.length) out.event_hooks = (s.event_hooks as Json[]).map(convertHook);
  return SkillDef.parse(out);
}

export function buildCharacter(id: string, artKey = id): UnitDef {
  const all = readJson<Json>(`${NARR}/content/characters_part1.json`).characters as Json[];
  const c = all.find((x) => x.character_id === id);
  if (!c) throw new Error(`character ${id} not found`);
  return UnitDef.parse({
    unit_id: c.character_id,
    kind: 'character',
    name_en: c.name_en,
    element: c.element,
    role: c.combat_role,
    rarity: c.rarity,
    formation_affinity: c.formation_affinity === 'front' || c.formation_affinity === 'rear' ? c.formation_affinity : undefined,
    base_stats: c.base_stats_level_1,
    growth_per_level: c.growth_per_level,
    skills: (c.skills as Json[]).map(characterSkill),
    art_key: artKey,
    provenance: { source: `${NARR}/content/characters_part1.json#${id}`, source_sha256: srcHash('content/characters_part1.json') }
  });
}

export function buildEnemy(id: string): UnitDef {
  const all = readJson<Json>(`${NARR}/content/enemies_part1.json`).enemies as Json[];
  const e = all.find((x) => x.enemy_id === id);
  if (!e) throw new Error(`enemy ${id} not found`);
  const skills = (e.skills as Json[]).map((s) => {
    const out: Json = {
      skill_id: s.skill_id,
      name_en: s.name_en,
      type: s.type,
      description_en: s.effect_en ?? '',
      player_target: 'none',
      cooldown_turns: s.cooldown_turns ?? 0,
      focus_cost: s.focus_cost ?? 0,
      ai_priority: s.ai_priority ?? 0,
      effect_ops: (s.effect_ops as Json[]).map(convertOp)
    };
    return SkillDef.parse(out);
  });
  return UnitDef.parse({
    unit_id: e.enemy_id,
    kind: 'enemy',
    name_en: e.name_en,
    element: e.element,
    role: e.role,
    base_stats: e.base_stats_level_1,
    growth_per_level: e.growth_per_level,
    weaknesses: e.weaknesses,
    resistances: e.resistances,
    skills,
    intent_skill_id: e.intent?.action_id,
    art_key: e.enemy_id,
    provenance: { source: `${NARR}/content/enemies_part1.json#${id}`, source_sha256: srcHash('content/enemies_part1.json') }
  });
}

export function buildUnitPack(packId: string, characters: string[], enemies: string[]): UnitPack {
  return UnitPack.parse({
    schema_version: 1,
    pack_id: packId,
    units: [...characters.map((c) => buildCharacter(c)), ...enemies.map(buildEnemy)],
    rules: buildRules()
  });
}

// ------------------------------------------------------------------ tutorial scenes + encounters

interface TutorialLine {
  line_id: string;
  speaker_id: string;
  speaker_display: string;
  text_en: string;
  emotion: string;
  hold_seconds?: number;
}
interface TutorialScene {
  scene_id: string;
  title_en: string;
  location_id: string;
  lines: TutorialLine[];
}
interface TutorialChapter {
  stage_id: string;
  title_en: string;
  seed: number;
  enemies: { enemy_id: string; count: number }[];
  before: TutorialScene;
  after: TutorialScene;
}

export function tutorialChapter(stageId: string): TutorialChapter {
  const t = readJson<{ chapters: TutorialChapter[] }>(`${NARR}/entry/tutorial_v001.json`);
  const ch = t.chapters.find((c) => c.stage_id === stageId);
  if (!ch) throw new Error(`tutorial stage ${stageId} missing`);
  return ch;
}

export function buildScene(scene: TutorialScene, stageId: string, which: 'before' | 'after', musicCue: string, party: string[]): StoryScene {
  const commands: Record<string, unknown>[] = [
    { op: 'background', location_id: scene.location_id },
    { op: 'music', cue_id: musicCue },
    { op: 'fade', direction: 'in', seconds: 0.8 }
  ];
  const sides: ('left' | 'right')[] = ['left', 'right'];
  party.forEach((c, i) => commands.push({ op: 'show', character: c, side: sides[i] ?? 'right' }));
  for (const l of scene.lines) {
    if (l.speaker_id) {
      const cmd: Record<string, unknown> = { op: 'say', line_id: l.line_id, speaker: l.speaker_id, speaker_display: l.speaker_display, text: l.text_en };
      if (l.emotion) cmd.emotion = l.emotion;
      if (typeof l.hold_seconds === 'number') cmd.hold_seconds = l.hold_seconds;
      commands.push(cmd);
    } else {
      const cmd: Record<string, unknown> = { op: 'narrate', line_id: l.line_id, text: l.text_en };
      if (typeof l.hold_seconds === 'number') cmd.hold_seconds = l.hold_seconds;
      commands.push(cmd);
    }
  }
  commands.push({ op: 'checkpoint', checkpoint_id: `${scene.scene_id}_done` }, { op: 'fade', direction: 'out', seconds: 0.6 }, { op: 'end' });
  return StoryScene.parse({
    schema_version: 1,
    scene_id: scene.scene_id,
    title_en: scene.title_en,
    location_id: scene.location_id,
    commands,
    provenance: { source: `${NARR}/entry/tutorial_v001.json#${stageId}.${which}`, source_sha256: srcHash('entry/tutorial_v001.json') }
  });
}

export function buildEncounter(
  stageId: string,
  encounterId: string,
  party: { unit_id: string; row: 'front' | 'rear' }[],
  musicCue: string,
  storyBase: string
): Encounter {
  const ch = tutorialChapter(stageId);
  const enemies: { unit_id: string; level: number; slot: number; row: 'front' | 'rear' }[] = [];
  for (const e of ch.enemies) {
    for (let i = 0; i < e.count; i++) enemies.push({ unit_id: e.enemy_id, level: 1, slot: enemies.length, row: 'front' });
  }
  return Encounter.parse({
    schema_version: 1,
    encounter_id: encounterId,
    stage_id: stageId,
    title_en: ch.title_en,
    location_id: ch.before.location_id,
    seed: ch.seed,
    music_cue: musicCue,
    party: party.map((p, i) => ({ unit_id: p.unit_id, level: 1, slot: i, row: p.row })),
    enemies,
    pre_story: `story/${storyBase}_before.json`,
    post_story: `story/${storyBase}_after.json`,
    provenance: { source: `${NARR}/entry/tutorial_v001.json#${stageId}`, source_sha256: srcHash('entry/tutorial_v001.json') }
  });
}

/** Emotion tags referenced by a set of scenes (so the art builder ships only the portraits it needs). */
export function emotionsUsed(scenes: StoryScene[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const s of scenes) {
    for (const c of s.commands) {
      if (c.op !== 'say' || !c.emotion) continue;
      if (!out.has(c.speaker)) out.set(c.speaker, new Set());
      out.get(c.speaker)?.add(c.emotion);
    }
  }
  return out;
}
