import { PresentationCommand } from './presentation';
import { z } from 'zod';
import { Id, LineId, SafeAssetPath } from './primitives';
import { NodeRewards, RationClass } from './rewards';

/**
 * Declarative story commands. The runtime (packages/story) is the only interpreter; scenes are pure
 * data and can be delivered by content patches. Every op is implemented and unit tested.
 */
const speaker = z.union([z.literal('narration'), Id]);
const label = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);

export const StoryCommand = z.discriminatedUnion('op', [
  ...PresentationCommand.options,
  z.object({ op: z.literal('set_flag'), flag: Id, value: z.boolean() }).strict(),
  z.object({ op: z.literal('branch'), flag: Id, equals: z.boolean(), goto: label }).strict(),
  z
    .object({
      op: z.literal('say'),
      line_id: LineId,
      speaker: Id,
      speaker_display: z.string().min(1).max(40),
      text: z.string().min(1).max(600),
      emotion: z.string().max(40).optional(),
      /** Production binding only; reviewed Japanese audio assets are supplied separately. */
      voice_track: z.enum(['jp', 'jp_inner', 'jp_narration', 'none']).optional(),
      hold_seconds: z.number().min(0).max(30).optional()
    })
    .strict(),
  z
    .object({
      op: z.literal('narrate'),
      line_id: LineId,
      text: z.string().min(1).max(600),
      hold_seconds: z.number().min(0).max(30).optional()
    })
    .strict(),
  z.object({ op: z.literal('show'), character: Id, side: z.enum(['left', 'right']) }).strict(),
  z.object({ op: z.literal('hide'), character: Id }).strict(),
  z.object({ op: z.literal('background'), location_id: Id }).strict(),
  z.object({ op: z.literal('music'), cue_id: Id.or(z.literal('stop')) }).strict(),
  z.object({ op: z.literal('fade'), direction: z.enum(['in', 'out']), seconds: z.number().min(0).max(5) }).strict(),
  z.object({ op: z.literal('flash'), seconds: z.number().min(0).max(2) }).strict(),
  z.object({ op: z.literal('shake'), seconds: z.number().min(0).max(2), intensity: z.number().min(0).max(1) }).strict(),
  z.object({ op: z.literal('wait'), seconds: z.number().min(0).max(10) }).strict(),
  z
    .object({
      op: z.literal('choice'),
      prompt: z.string().max(200).optional(),
      options: z.array(z.object({ id: Id, text: z.string().min(1).max(120), goto: label }).strict()).min(2).max(4)
    })
    .strict(),
  z.object({ op: z.literal('label'), name: label }).strict(),
  z.object({ op: z.literal('goto'), label }).strict(),
  z.object({ op: z.literal('checkpoint'), checkpoint_id: Id }).strict(),
  z.object({ op: z.literal('end') }).strict()
]);
export type StoryCommand = z.infer<typeof StoryCommand>;
export const STORY_OPS = StoryCommand.options.map((o) => o.shape.op.value);
void speaker;

export const StoryScene = z
  .object({
    schema_version: z.literal(1),
    scene_id: Id,
    title_en: z.string().max(80),
    location_id: Id,
    /**
     * Cutscene presentation (the first-install flow, v006 rules): present = Auto starts on with a single on/off toggle, no Skip, fixed 26 cps
     * reveal, minimum reading holds, speaker-change pauses. Absent = the regular story reader (text speed setting, Skip, log).
     */
    presentation: z.object({ auto: z.boolean(), speaker_pause_seconds: z.number().min(0).max(3) }).strict().optional(),
    /** shared illustration shown for the whole scene instead of portraits (art manifest `stills` entry named by the id); portraits are the fallback */
    illustration_id: Id.optional(),
    /** how long the last line of the scene stays before the scene ends */
    closing_hold_seconds: z.number().min(0).max(10).optional(),
    /** Authored direction/cue text is preserved as metadata, never interpreted as executable instructions. */
    production: z.object({ direction_en: z.string().max(6000), music_direction_en: z.string().max(6000).optional() }).strict().optional(),
    commands: z.array(StoryCommand).min(1).max(400),
    provenance: z.object({ source: z.string(), source_sha256: z.string().optional(), note: z.string().optional() }).strict()
  })
  .strict()
  .superRefine((scene, ctx) => {
    const labels = new Set<string>();
    const seenLines = new Set<string>();
    if (new Set(scene.commands.flatMap((c) => c.op === 'set_flag' || c.op === 'branch' ? [c.flag] : [])).size > 128) ctx.addIssue({ code: 'custom', message: 'scene exceeds its flag budget' });
    for (const [i, c] of scene.commands.entries()) {
      if (c.op === 'label') {
        if (labels.has(c.name)) ctx.addIssue({ code: 'custom', path: ['commands', i], message: `duplicate label ${c.name}` });
        labels.add(c.name);
      }
      if (c.op === 'say' || c.op === 'narrate') {
        if (seenLines.has(c.line_id)) ctx.addIssue({ code: 'custom', path: ['commands', i], message: `duplicate line_id ${c.line_id}` });
        seenLines.add(c.line_id);
      }
    }
    for (const [i, c] of scene.commands.entries()) {
      if (c.op === 'branch' && !labels.has(c.goto)) ctx.addIssue({ code: 'custom', path: ['commands', i], message: `branch to unknown label ${c.goto}` });
      if (c.op === 'goto' && !labels.has(c.label)) ctx.addIssue({ code: 'custom', path: ['commands', i], message: `goto unknown label ${c.label}` });
      if (c.op === 'choice') {
        for (const o of c.options) if (!labels.has(o.goto)) ctx.addIssue({ code: 'custom', path: ['commands', i], message: `choice goto unknown label ${o.goto}` });
      }
    }
  });
export type StoryScene = z.infer<typeof StoryScene>;

/** Finite equipped-effect grammar; version 1 supports outgoing healing and normal-action Focus. */
export const EquipmentEffects = z.object({
  version: z.literal(1),
  heal_bonus_pct: z.number().min(0).max(5).optional(),
  focus_gain_pct: z.number().min(0).max(5).optional()
}).strict();
export type EquipmentEffects = z.infer<typeof EquipmentEffects>;

/** One hero on the player's side of a battle. Content encounters list fixed (story) members; owned-hero battles get them from the server. */
export const PartyMember = z
  .object({
    unit_id: Id,
    level: z.number().int().min(1).max(20),
    slot: z.number().int().min(0).max(4),
    row: z.enum(['front', 'rear']),
    /** final combat stats computed by the server (level growth + gear + set bonuses); absent = the unit's own level curve */
    stats: z
      .object({ hp: z.number().int().min(1).max(100_000), atk: z.number().int().min(0).max(100_000), def: z.number().int().min(0).max(100_000), spd: z.number().int().min(1).max(10_000), res: z.number().int().min(0).max(100_000).optional() })
      .strict()
      .optional(),
    /** skill_id -> rank (1-3); each rank above 1 raises damage/heal/shield multipliers of that skill */
    skill_ranks: z.record(Id, z.number().int().min(1).max(3)).optional(),
    start_focus: z.number().int().min(0).max(100).optional(),
    /** Frozen, versioned equipped effects; absent retains the original battle contract. */
    equipment_effects: EquipmentEffects.optional(),
    /** story loan: not owned by the player */
    loan: z.boolean().optional()
  })
  .strict();
export type PartyMember = z.infer<typeof PartyMember>;
function checkFormation(members: readonly { unit_id: string; slot: number }[], ctx: z.RefinementCtx, path: string[], uniqueUnits: boolean): void {
  const slots = new Set<number>();
  const units = new Set<string>();
  for (const [index, member] of members.entries()) {
    if (slots.has(member.slot)) ctx.addIssue({ code: 'custom', path: [...path, index, 'slot'], message: `duplicate slot ${member.slot}` });
    if (uniqueUnits && units.has(member.unit_id)) ctx.addIssue({ code: 'custom', path: [...path, index, 'unit_id'], message: `duplicate unit ${member.unit_id}` });
    slots.add(member.slot); units.add(member.unit_id);
  }
}
export const BattleParty = z.array(PartyMember).min(1).max(5).superRefine((members, ctx) => checkFormation(members, ctx, [], true));
export type BattleParty = z.infer<typeof BattleParty>;

export const Encounter = z
  .object({
    schema_version: z.literal(1),
    encounter_id: Id,
    stage_id: z.string().max(20),
    title_en: z.string().max(80),
    location_id: Id,
    seed: z.number().int().min(0).max(0xffffffff),
    music_cue: Id.optional(),
    /**
     * fixed: the party below is the whole player side (tutorial). owned: the server composes it from the player's team plus the
     * story `guests` (see `BattleParty`); `party` is then only a preview/fallback and may be empty.
     */
    party_mode: z.enum(['fixed', 'owned']).optional(),
    /** Narrative runtime allows a 2-unit tutorial party; every other encounter is 5v5. */
    party: z
      .array(z.object({ unit_id: Id, level: z.number().int().min(1).max(20), slot: z.number().int().min(0).max(4), row: z.enum(['front', 'rear']) }).strict())
      .max(5),
    /** story loan heroes that join the player's team for this stage (they take slots before the player's own heroes) */
    guests: z.array(Id).max(6).optional(),
    enemies: z
      .array(z.object({ unit_id: Id, level: z.number().int().min(1).max(20), slot: z.number().int().min(0).max(4), row: z.enum(['front', 'rear']) }).strict())
      .min(1)
      .max(5),
    /** stage tuning from the narrative (`enemy_stat_multiplier`): applied to the listed stats of every enemy after level scaling */
    enemy_stat_multiplier: z.object({ value: z.number().min(0.1).max(10), applies_to: z.array(z.enum(['hp', 'atk', 'def', 'spd'])).min(1).max(4) }).strict().optional(),
    /** HUD switches: the first tutorials hide the speed and Auto buttons (a later patch turns them on without a new build). Absent = both shown. */
    ui: z.object({ speed: z.boolean(), auto: z.boolean() }).strict().optional(),
    pre_story: SafeAssetPath.optional(),
    post_story: SafeAssetPath.optional(),
    /** Precompiled story playback at a declared boss phase; it changes presentation only. */
    phase_stories: z.array(z.object({ unit_id: Id, phase_id: Id, stories: z.array(SafeAssetPath).min(1).max(4) }).strict()).max(4).optional(),
    provenance: z.object({ source: z.string(), source_sha256: z.string().optional() }).strict()
  })
  .strict()
  .refine((e) => (e.party_mode ?? 'fixed') === 'owned' || e.party.length >= 1, 'a fixed encounter needs at least one party member')
  .superRefine((encounter, ctx) => {
    checkFormation(encounter.party, ctx, ['party'], true);
    checkFormation(encounter.enemies, ctx, ['enemies'], false);
    const guests = new Set<string>();
    for (const [index, id] of (encounter.guests ?? []).entries()) {
      if (guests.has(id)) ctx.addIssue({ code: 'custom', path: ['guests', index], message: `duplicate guest ${id}` });
      guests.add(id);
    }
  });
export type Encounter = z.infer<typeof Encounter>;

const ChapterNode = z
  .object({
    node_id: Id,
    title_en: z.string().max(80),
    kind: z.enum(['story', 'battle']),
    story: SafeAssetPath.optional(),
    encounter: SafeAssetPath.optional(),
    requires: Id.optional(),
    /** battle nodes: what a win costs (Ration) and grants; the server reads this from the published release, never from the client */
    ration_class: RationClass.optional(),
    /** a boss encounter: counts toward boss-hunt tasks */
    boss: z.boolean().optional(),
    rewards: NodeRewards.optional(),
    /** random loot: a drop table (game_config 'drops') rolled by the server on every win; `boss_set_id` names the accessory set boss-set entries resolve to */
    drop: z.object({ table: Id, boss_set_id: Id.optional() }).strict().optional()
  })
  .strict();

const Chapter = z
  .object({
    chapter_id: Id,
    title_en: z.string().max(80),
    nodes: z.array(ChapterNode).min(1)
  })
  .strict();

export const ChapterIndex = z
  .object({
    schema_version: z.literal(1),
    chapters: z.array(Chapter).min(1),
    recruit_selectors: z.array(z.object({ item_id: Id, title_en: z.string().min(1).max(80), after_node: Id, scene_node: Id,
      rarity: z.literal(4), choices: z.array(Id).min(1).max(20),
      provenance: z.object({ source: z.string().min(1).max(512), source_sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()
    }).strict()).max(20).optional(),
    /** Compiler source coverage: validators check the declared order, links and stable line IDs. */
    story_coverage: z.object({
      sources: z.array(z.object({ path: z.string().regex(/^narrative\/[A-Za-z0-9_/-]+\.json$/), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1).max(100),
      chapter_ids: z.array(Id).min(1).max(100),
      entries: z.array(z.object({ entry_id: z.string().regex(/^[a-z0-9_-]{1,80}$/), node_id: Id,
        scene_paths: z.array(SafeAssetPath).min(1).max(6), line_ids: z.array(LineId).min(1).max(1000) }).strict()).min(1).max(1000)
    }).strict().optional()
  })
  .strict();
export type ChapterIndex = z.infer<typeof ChapterIndex>;
