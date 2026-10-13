import { z } from 'zod';
import { Id, LineId, StoryScene, type StoryCommand, type ChapterIndex, type Encounter, type UnitPack } from '../../packages/content-schema/src/index';
import { fileBytes, sha256 } from './fsutil';

const ROOT = 'narrative/02_Main_Story';
const Line = z.object({ line_id: LineId, speaker_id: Id, speaker_display: z.string().min(1).max(40), text_en: z.string().min(1).max(600),
  emotion: z.string().max(40), voice_track: z.enum(['jp', 'jp_inner', 'jp_narration', 'none']) }).passthrough();
const Interlude = z.object({ trigger: z.string().regex(/^phase_[1-4]_(break|ward)$/), direction_en: z.string().max(6000), lines: z.array(Line).min(1).max(400) }).passthrough();
const Scene = z.object({ scene_id: Id, stage_id: z.string().regex(/^\d+-\d+$/).optional(), title_en: z.string().max(80), location_id: Id,
  direction_en: z.string().max(6000), music_cue: z.string().max(6000).optional(), lines: z.array(Line).min(1).max(400).optional(),
  pre_battle_lines: z.array(Line).min(1).max(400).optional(), post_battle_lines: z.array(Line).min(1).max(400).optional(), phase_interludes: z.array(Interlude).max(4).optional() }).passthrough();
const Chapter = z.object({ chapter_id: Id, opening_scene: Scene.optional(), scenes: z.array(Scene), after_battle_scenes: z.array(Scene).optional() }).passthrough();
const Manifest = z.object({ chapter_files: z.array(z.string().regex(/^story_script_ch\d{2}\.json$/)).min(1), main_stage_scene_count: z.number().int().positive(),
  non_stage_scene_ids: z.array(Id), story_order: z.array(z.string().regex(/^[a-z0-9_-]{1,80}$/)).min(1) }).passthrough();

export interface SourceFile { path: string; bytes: Uint8Array }
export interface StorySources { manifest: SourceFile; chapters: SourceFile[] }
export interface CampaignStoryEntry {
  id: string; chapterId: string; nodeId: string; title: string; stageId?: string; story?: string; preStory?: string; postStory?: string;
  interludes: { trigger: string; path: string }[]; scenePaths: string[]; lineIds: string[];
}
/** A broken numbered phase enters its successor; a ward names the numbered phase being entered. */
export function bindCampaignPhaseStories(entry: CampaignStoryEntry, enemies: Encounter['enemies'], pack: UnitPack): NonNullable<Encounter['phase_stories']> {
  const bindings: NonNullable<Encounter['phase_stories']> = [];
  for (const interlude of entry.interludes) {
    const bosses = enemies.map((enemy) => pack.units.find((unit) => unit.unit_id === enemy.unit_id)).filter((unit) => unit?.boss);
    if (bosses.length !== 1) throw new Error(`stage ${entry.id}: phase dialogue needs exactly one boss`);
    const boss = bosses[0]!;
    const match = /^phase_([1-4])_(break|ward)$/.exec(interlude.trigger);
    if (!match) throw new Error(`stage ${entry.id}: unsupported phase trigger ${interlude.trigger}`);
    const phase = boss.boss!.phases[Number(match[1]) - (match[2] === 'ward' ? 1 : 0)];
    if (!phase) throw new Error(`stage ${entry.id}: ${interlude.trigger} has no boss phase`);
    let binding = bindings.find((binding) => binding.unit_id === boss.unit_id && binding.phase_id === phase.phase_id);
    if (!binding) { binding = { unit_id: boss.unit_id, phase_id: phase.phase_id, stories: [] }; bindings.push(binding); }
    binding.stories.push(interlude.path);
  }
  return bindings;
}
const decode = (source: SourceFile): unknown => JSON.parse(new TextDecoder().decode(source.bytes));
export function canonicalStorySources(): StorySources {
  const manifest = { path: `${ROOT}/story_script_part1_manifest.json`, bytes: fileBytes(`${ROOT}/story_script_part1_manifest.json`) };
  return { manifest, chapters: Manifest.parse(decode(manifest)).chapter_files.map((file) => ({ path: `${ROOT}/Chapters/${file}`, bytes: fileBytes(`${ROOT}/Chapters/${file}`) })) };
}

/** Compile spoken lines/order from canon; snapshot mechanics and source prose never become executable code. */
export function compileCampaignStory(sources = canonicalStorySources(), portraits: ReadonlySet<string> = new Set(['mahmut', 'fadyme'])): {
  entries: CampaignStoryEntry[]; files: Map<string, StoryScene>; coverage: NonNullable<ChapterIndex['story_coverage']>
} {
  const manifest = Manifest.parse(decode(sources.manifest));
  const files = new Map<string, StoryScene>();
  const all = new Map<string, { scene: z.infer<typeof Scene>; chapterId: string; source: SourceFile }>();
  const sceneIds = new Set<string>();
  const lineIds = new Set<string>();
  const loaded = sources.chapters.map((source) => source.path.split('/').pop()!);
  if (JSON.stringify(loaded) !== JSON.stringify(manifest.chapter_files) || new Set(loaded).size !== loaded.length || sources.chapters.some((source, i) => source.path !== `${ROOT}/Chapters/${manifest.chapter_files[i]}`)) throw new Error('canonical chapter source coverage differs from the manifest');
  if (sources.manifest.path !== `${ROOT}/story_script_part1_manifest.json`) throw new Error('noncanonical story manifest path');
  const chapters = sources.chapters.map((source) => ({ source, chapter: Chapter.parse(decode(source)) }));
  for (const { source, chapter } of chapters) {
    for (const scene of [...(chapter.opening_scene ? [chapter.opening_scene] : []), ...chapter.scenes, ...(chapter.after_battle_scenes ?? [])]) {
      const id = scene.stage_id ?? scene.scene_id;
      if (all.has(id) || sceneIds.has(scene.scene_id)) throw new Error(`duplicate canonical entry/scene ${id}`);
      all.set(id, { scene, chapterId: chapter.chapter_id, source }); sceneIds.add(scene.scene_id);
    }
  }
  if (new Set(manifest.story_order).size !== manifest.story_order.length || manifest.story_order.length !== all.size || [...all.keys()].some((id) => !manifest.story_order.includes(id))) throw new Error('canonical story order omits or duplicates an entry');
  const standalone = [...all.values()].filter(({ scene }) => !scene.stage_id).map(({ scene }) => scene.scene_id);
  if (all.size - standalone.length !== manifest.main_stage_scene_count || new Set(manifest.non_stage_scene_ids).size !== manifest.non_stage_scene_ids.length || standalone.length !== manifest.non_stage_scene_ids.length || standalone.some((id) => !manifest.non_stage_scene_ids.includes(id))) throw new Error('canonical stage/non-stage coverage differs from the manifest');
  const make = (scene: z.infer<typeof Scene>, id: string, lines: z.infer<typeof Line>[], source: SourceFile, part: string, direction = scene.direction_en): string => {
    const path = `story/${id}.json`;
    if (files.has(path)) throw new Error(`duplicate compiled scene ${path}`);
    const commands: StoryCommand[] = [{ op: 'background', location_id: scene.location_id }, { op: 'music', cue_id: 'stop' }];
    // Only portraits actually supplied by the current manifest are shown; other speakers retain their exact names/text.
    [...new Set(lines.map((line) => line.speaker_id))].filter((id) => portraits.has(id)).slice(0, 2).forEach((character, index) => commands.push({ op: 'show', character, side: index === 0 ? 'left' : 'right' }));
    for (const line of lines) {
      if (lineIds.has(line.line_id)) throw new Error(`duplicate canonical line ${line.line_id}`);
      lineIds.add(line.line_id);
      commands.push({ op: 'say', line_id: line.line_id, speaker: line.speaker_id, speaker_display: line.speaker_display, text: line.text_en, emotion: line.emotion, voice_track: line.voice_track });
    }
    commands.push({ op: 'checkpoint', checkpoint_id: `${id}_done` }, { op: 'end' });
    files.set(path, StoryScene.parse({ schema_version: 1, scene_id: id, title_en: scene.title_en, location_id: scene.location_id, commands,
      production: { direction_en: direction, ...(scene.music_cue ? { music_direction_en: scene.music_cue } : {}) },
      provenance: { source: `${source.path}#${scene.scene_id}.${part}`, source_sha256: sha256(Buffer.from(source.bytes)) } }));
    return path;
  };
  const entries = manifest.story_order.map((id): CampaignStoryEntry => {
    const source = all.get(id);
    if (!source) throw new Error(`unknown canonical story entry ${id}`);
    const { scene, chapterId } = source;
    const entry: CampaignStoryEntry = { id, chapterId, nodeId: scene.stage_id ? `stage_${scene.stage_id.replace('-', '_')}` : scene.scene_id, title: scene.title_en, interludes: [], scenePaths: [], lineIds: [] };
    if (scene.stage_id) {
      if (!scene.pre_battle_lines || !scene.post_battle_lines) throw new Error(`canonical stage ${id} needs pre/post dialogue`);
      entry.stageId = scene.stage_id;
      entry.preStory = make(scene, `${scene.scene_id}_pre`, scene.pre_battle_lines, source.source, 'pre_battle_lines');
      entry.scenePaths.push(entry.preStory);
      for (const interlude of scene.phase_interludes ?? []) {
        const path = make(scene, `${scene.scene_id}_${interlude.trigger}`, interlude.lines, source.source, interlude.trigger, interlude.direction_en);
        entry.interludes.push({ trigger: interlude.trigger, path }); entry.scenePaths.push(path);
      }
      entry.postStory = make(scene, `${scene.scene_id}_post`, scene.post_battle_lines, source.source, 'post_battle_lines'); entry.scenePaths.push(entry.postStory);
    } else {
      if (!scene.lines) throw new Error(`canonical scene ${id} needs lines`);
      entry.story = make(scene, scene.scene_id, scene.lines, source.source, 'lines'); entry.scenePaths.push(entry.story);
    }
    entry.lineIds = entry.scenePaths.flatMap((path) => files.get(path)!.commands.flatMap((command) => command.op === 'say' || command.op === 'narrate' ? [command.line_id] : []));
    return entry;
  });
  return { entries, files, coverage: { chapter_ids: chapters.map(({ chapter }) => chapter.chapter_id),
    sources: [sources.manifest, ...sources.chapters].map((source) => ({ path: source.path, sha256: sha256(Buffer.from(source.bytes)) })),
    entries: entries.map((entry) => ({ entry_id: entry.id, node_id: entry.nodeId, scene_paths: entry.scenePaths, line_ids: entry.lineIds })) } };
}
