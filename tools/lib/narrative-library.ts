import { z } from 'zod';
import { Id, LineId, NarrativeLibrary, StoryScene, type LibraryEntry, type NarrativeGate, type StoryCommand } from '../../packages/content-schema/src/index';
import { campaignPortraitIds, fileBytes, sha256 } from './fsutil';

const Line = z.object({ line_id: LineId, speaker_id: Id, speaker_display: z.string().min(1).max(40), text_en: z.string().min(1).max(600), emotion: z.string().max(40), voice_track: z.enum(['jp', 'jp_inner', 'jp_narration', 'none']) }).passthrough();
const Stage = z.string().regex(/^\d+-\d+$/);
const Scene = z.object({ scene_id: Id, title_en: z.string().min(1).max(80), location_id: Id, direction_en: z.string().max(6000), lines: z.array(Line).min(1).max(300) }).passthrough();
const Companion = z.object({ stories: z.array(z.object({ character_id: Id, parts: z.array(Scene.omit({ scene_id: true }).extend({ story_id: Id, part: z.number().int().positive(), unlock: z.object({ requires_owned_character: Id.nullable(), after_stage: Stage }).strict() })).min(1) })).min(1) }).passthrough();
const Events = z.object({ events: z.array(z.object({ event_id: Id, title_en: z.string().min(1).max(80), canon_status: z.literal('canon'), unlock: z.object({ after_stage: Stage }).strict(), scenes: z.array(Scene).min(1).max(8) }).passthrough()).min(1) }).passthrough();
const Codex = z.object({ codex: z.array(z.object({ codex_id: Id, title_en: z.string().min(1).max(80), text_en: z.string().min(1).max(600), unlock: z.literal('always').or(z.object({ after_stage: Stage }).strict()) }).strict()).min(1) }).passthrough();
export const LIBRARY_SOURCES = ['narrative/03_Companion_Stories/character_stories_part1.json', 'narrative/05_Codex_Lore/lore_text_part1.json', 'narrative/04_Events/events_part1.json'] as const;
export const librarySources = () => LIBRARY_SOURCES.map((path) => ({ path, bytes: fileBytes(path) }));

const LIBRARY_LOCATION_MUSIC: Record<string, string> = {
  forest_whispering_ash: 'bgm_ch1_ash_forest_calm',
  cathedral_saint_luthos: 'bgm_ch2_cathedral',
  village_oakhaven: 'bgm_ch3_oakhaven',
  undercity_subterranean: 'bgm_ch4_undercity',
  bridge_forsaken: 'bgm_ch5_bridge',
  estate_ashen_lord: 'bgm_ch6_estate',
  altar_first_eclipse: 'bgm_ch7_altar'
};

export function compileNarrativeLibrary(sources = librarySources(), portraits: ReadonlySet<string> = campaignPortraitIds()): NarrativeLibrary {
  if (JSON.stringify(sources.map((source) => source.path)) !== JSON.stringify(LIBRARY_SOURCES)) throw new Error('library source coverage differs from canon');
  const entries: LibraryEntry[] = [];
  const sourceRecords = sources.map((source) => ({ path: source.path, sha256: sha256(Buffer.from(source.bytes)) }));
  const raw = (i: number): unknown => JSON.parse(new TextDecoder().decode(sources[i]!.bytes));
  const provenance = (i: number) => ({ source: sourceRecords[i]!.path, source_sha256: sourceRecords[i]!.sha256 });
  const gate = (after: string, owned?: string, previous?: string): NarrativeGate => ({ after_node: `stage_${after.replace('-', '_')}`, ...(owned ? { owned_character: owned } : {}), ...(previous ? { after_entry: previous } : {}) });
  const scene = (value: z.infer<typeof Scene>, source: number, characterId?: string): StoryScene => {
    const musicCue = characterId === 'mahmut' ? 'bgm_mahmut_theme' : characterId === 'fadyme' ? 'bgm_fadyme_theme' : (LIBRARY_LOCATION_MUSIC[value.location_id] ?? 'bgm_camp_night');
    const commands: StoryCommand[] = [{ op: 'background', location_id: value.location_id }, { op: 'music', cue_id: musicCue }];
    [...new Set(value.lines.map((line) => line.speaker_id))].filter((id) => portraits.has(id)).slice(0, 2).forEach((character, i) => commands.push({ op: 'show', character, side: i ? 'right' : 'left' }));
    commands.push(...value.lines.map((line): StoryCommand => ({ op: 'say', line_id: line.line_id, speaker: line.speaker_id, speaker_display: line.speaker_display, text: line.text_en, emotion: line.emotion, voice_track: line.voice_track })), { op: 'checkpoint', checkpoint_id: `${value.scene_id}_done` }, { op: 'end' });
    return StoryScene.parse({ schema_version: 1, scene_id: value.scene_id, title_en: value.title_en, location_id: value.location_id, commands, production: { direction_en: value.direction_en }, provenance: provenance(source) });
  };
  const add = (entry: Omit<LibraryEntry, 'line_ids'>) => entries.push({ ...entry, line_ids: entry.scenes.flatMap((scene) => scene.commands.flatMap((command) => command.op === 'say' || command.op === 'narrate' ? [command.line_id] : [])) });
  for (const character of Companion.parse(raw(0)).stories) {
    for (const [i, part] of character.parts.entries()) {
      if (part.part !== i + 1 || part.unlock.requires_owned_character !== null && part.unlock.requires_owned_character !== character.character_id) throw new Error('invalid companion part order/ownership');
      add({ entry_id: part.story_id, kind: 'companion', group_id: character.character_id, part: part.part, title_en: part.title_en,
        gate: gate(part.unlock.after_stage, part.unlock.requires_owned_character ?? undefined, character.parts[i - 1]?.story_id), scenes: [scene({ ...part, scene_id: part.story_id }, 0, character.character_id)], provenance: provenance(0) });
    }
  }
  for (const entry of Codex.parse(raw(1)).codex) {
    const data = StoryScene.parse({ schema_version: 1, scene_id: entry.codex_id, title_en: entry.title_en, location_id: 'forest_whispering_ash', provenance: provenance(1),
      commands: [{ op: 'background', location_id: 'forest_whispering_ash' }, { op: 'music', cue_id: 'bgm_ch1_ash_forest_calm' }, { op: 'narrate', line_id: `${entry.codex_id}_text`, text: entry.text_en }, { op: 'end' }] });
    add({ entry_id: entry.codex_id, kind: 'codex', group_id: 'codex', part: 1, title_en: entry.title_en, gate: entry.unlock === 'always' ? {} : gate(entry.unlock.after_stage), scenes: [data], provenance: provenance(1) });
  }
  for (const event of Events.parse(raw(2)).events) add({ entry_id: event.event_id, kind: 'event', group_id: event.event_id, part: 1, title_en: event.title_en,
    gate: gate(event.unlock.after_stage), scenes: event.scenes.map((value) => scene(value, 2)), provenance: provenance(2) });
  for (const [kind, ids] of [['entry', entries.map((e) => e.entry_id)], ['scene', entries.flatMap((e) => e.scenes.map((s) => s.scene_id))], ['line', entries.flatMap((e) => e.line_ids)]] as const) {
    if (new Set(ids).size !== ids.length) throw new Error(`duplicate library ${kind}`);
  }
  return NarrativeLibrary.parse({ schema_version: 1, sources: sourceRecords, entries });
}
