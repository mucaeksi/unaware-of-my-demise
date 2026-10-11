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

export function buildRules(): RulesDef {
  const rules = readJson<Json>(`${NARR}/content/battle_rules_part1.json`);
  const statuses: StatusDef[] = [];
  for (const s of rules.statuses as Json[]) {
    const tags: string[] = s.tags ?? [];
    const category = tags.includes('control') && !tags.includes('buff') ? 'control' : tags.includes('buff') ? 'buff' : tags.includes('mark') ? 'mark' : 'debuff';
    const def: Record<string, unknown> = {
      status_id: s.status_id,
      name_en: s.name_en,
      kind: s.kind,
      category,
      default_duration_turns: s.default_duration_turns
    };
    if (tags.length) def.tags = tags;
    for (const k of ['outgoing_damage_multiplier', 'damage_taken_multiplier', 'healing_received_multiplier', 'def_multiplier', 'focus_gain_multiplier'] as const) {
      if (typeof s[k] === 'number') def[k] = s[k];
    }
    if (s.skip_next_action === true) def.skip_next_action = true;
    if (s.redirects_eligible_single_target_attacks === true) def.redirects_single_target_attacks = true;
    // `resistance_bonus_pct` (Dawnward) is a percentage bonus to RES
    if (typeof s.resistance_bonus_pct === 'number') def.res_multiplier = 1 + s.resistance_bonus_pct;
    if (typeof s.source_atk_multiplier_per_tick === 'number') def.dot_atk_multiplier = s.source_atk_multiplier_per_tick;
    if (s.element_damage_taken_multiplier) def.element_damage_taken_multiplier = s.element_damage_taken_multiplier;
    if (s.reaction_triggers) {
      def.reactions = (s.reaction_triggers as Json[]).map((r) => ({ element: r.element, name_en: r.name_en, bonus_damage_multiplier: r.bonus_damage_multiplier, consume_status: r.consume_status === true }));
    }
    if (typeof s.next_action_gauge_delay_fraction === 'number') def.next_action_gauge_delay_fraction = s.next_action_gauge_delay_fraction;
    if (s.immune_status_ids) def.immune_status_ids = s.immune_status_ids;
    if (typeof s.maximum_shared_damage_per_hit_pct_of_max_hp === 'number') def.shared_damage_cap_fraction = s.maximum_shared_damage_per_hit_pct_of_max_hp;
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

/**
 * Where the machine-readable hook contradicts the player-facing description, the description wins and the
 * correction is listed here (and in docs/COMBAT_RULES.md): Keep the Names promises "the first ALLIED attack".
 */
const HOOK_OVERRIDES: Record<string, (h: Json) => void> = {
  clem_marr_passive_keep_the_names: (h) => {
    h.event_filter = { ...(h.event_filter ?? {}), team: 'player' };
  }
};

function characterSkill(s: Json): SkillDef {
  const out: Json = {
    skill_id: s.skill_id,
    name_en: s.name_en,
    type: s.type,
    element: s.element,
    description_en: s.description_en,
    player_target: s.target_rule === 'single_enemy' ? 'enemy' : s.target_rule === 'single_ally' ? 'ally' : 'none',
    cooldown_turns: s.cooldown_turns ?? 0,
    focus_cost: s.focus_cost ?? 0,
    ai_priority: s.auto_priority ?? 0,
    effect_ops: (s.effect_ops as Json[]).map(convertOp)
  };
  if (s.event_hooks?.length) {
    out.event_hooks = (s.event_hooks as Json[]).map(convertHook);
    HOOK_OVERRIDES[s.skill_id]?.((out.event_hooks as Json[])[0] as Json);
  }
  if (s.continuous_modifiers?.length) out.continuous_modifiers = s.continuous_modifiers;
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
    if (s.phase_ids) out.phase_ids = s.phase_ids;
    if (s.telegraph_rules) out.telegraph = s.telegraph_rules;
    return SkillDef.parse(out);
  });
  const boss = e.boss_id
    ? {
        phases: (e.phases as Json[]).map((p) => ({
          phase_id: p.phase_id,
          name_en: p.name_en,
          transition: p.transition,
          transition_hp_percent: p.transition_hp_percent ?? null,
          hp_multiplier: p.hp_multiplier,
          atk_multiplier: p.atk_multiplier,
          def_multiplier: p.def_multiplier,
          weaknesses: p.weaknesses,
          signature_action_id: p.signature_action_id ?? null,
          tauntable: p.tauntable === true,
          objectives: (p.objectives as Json[]).map((o) => ({
            objective_id: o.objective_id,
            name_en: o.name_en,
            max_hp: o.max_hp,
            targetable_by_player: o.targetable_by_player === true,
            ...(o.persists_across_phases === true ? { persists_across_phases: true } : {}),
            ...(o.on_destroyed?.length ? { on_destroyed: (o.on_destroyed as Json[]).map(convertOp) } : {})
          })),
          enter_ops: (p.enter_ops as Json[]).map(convertOp),
          passive_ops: (p.passive_ops as Json[]).map(convertOp)
        })),
        preserve_status_ids: e.phase_transition_contract.preserve_status_ids,
        clear_status_category: e.phase_transition_contract.clear_status_category,
        control_duration_multiplier: e.control_rules.control_duration_multiplier
      }
    : undefined;
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
    passive_hooks: e.passive_hooks?.length ? (e.passive_hooks as Json[]).map(convertHook) : undefined,
    continuous_modifiers: e.continuous_modifiers?.length ? e.continuous_modifiers : undefined,
    faction_id: e.faction_id,
    boss,
    status_immunities: e.status_immunities?.length ? e.status_immunities : undefined,
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
