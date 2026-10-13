import { describe, expect, it } from 'vitest';
import { canonicalStorySources, compileCampaignStory, bindCampaignPhaseStories, type SourceFile, type StorySources } from './campaign-story';
import { readJson, sha256 } from './fsutil';
import { ChapterIndex, Encounter, UnitPack } from '../../packages/content-schema/src/index';

const decode = (file: SourceFile) => JSON.parse(new TextDecoder().decode(file.bytes));
const edited = (file: SourceFile, edit: (value: ReturnType<typeof decode>) => void): SourceFile => {
  const value = decode(file); edit(value);
  return { path: file.path, bytes: new TextEncoder().encode(JSON.stringify(value)) };
};

describe('canonical campaign story compilation', () => {
  it('preserves all 51 entries, 419 unique spoken lines and exact canonical text/voice/direction', () => {
    const sources = canonicalStorySources(); const output = compileCampaignStory(sources);
    expect(output.entries.map((entry) => entry.id)).toEqual(decode(sources.manifest).story_order);
    expect(output.entries).toHaveLength(51);
    expect(output.entries.filter((entry) => entry.stageId)).toHaveLength(35);
    expect(output.files.size).toBe(88);
    const lines = output.coverage.entries.flatMap((entry) => entry.line_ids);
    expect(lines).toHaveLength(419); expect(new Set(lines).size).toBe(419);
    for (const source of sources.chapters) {
      const chapter = decode(source);
      for (const scene of [chapter.opening_scene, ...chapter.scenes, ...(chapter.after_battle_scenes ?? [])].filter(Boolean)) {
        const entry = output.entries.find((entry) => entry.id === (scene.stage_id ?? scene.scene_id))!;
        const expected = scene.stage_id ? [scene.pre_battle_lines, ...(scene.phase_interludes ?? []).map((interlude: { lines: unknown[] }) => interlude.lines), scene.post_battle_lines].flat() : scene.lines;
        const actual = entry.scenePaths.flatMap((path) => output.files.get(path)!.commands.filter((command) => command.op === 'say'));
        expect(actual).toEqual(expected.map((line: { line_id: string; speaker_id: string; speaker_display: string; text_en: string; emotion: string; voice_track: string }) => ({ op: 'say', line_id: line.line_id, speaker: line.speaker_id, speaker_display: line.speaker_display, text: line.text_en, emotion: line.emotion, voice_track: line.voice_track })));
        for (const path of entry.scenePaths) {
          const compiled = output.files.get(path)!;
          expect(compiled.provenance.source_sha256).toBe(sha256(Buffer.from(source.bytes)));
          expect(compiled.provenance.source.split('#')[0]).toBe(source.path);
          expect(compiled.production?.music_direction_en).toBe(scene.music_cue);
          expect(compiled.location_id).toBe(scene.location_id);
          expect(compiled.commands.filter((command) => command.op === 'music')).toEqual([{ op: 'music', cue_id: 'stop' }]);
        }
      }
    }
    expect(output.files.get('story/opening_sad_scene.json')!.production!.music_direction_en).toContain('bgm_fadyme_theme');
    for (const id of ['part1_emotional_confession', 'part1_clockless_reveal']) expect(output.files.get(`story/${id}.json`)!.production!.music_direction_en).toBeTruthy();
    expect(output.entries.at(-3)!.interludes.map((interlude) => interlude.trigger)).toEqual(['phase_1_break', 'phase_2_ward']);
  });
  it('compiles deterministically and never executes source tutorial/production prose', () => {
    const sources = canonicalStorySources();
    const first = compileCampaignStory(sources); const second = compileCampaignStory(sources);
    expect([...first.files]).toEqual([...second.files]); expect(first.coverage).toEqual(second.coverage);
    expect([...first.files.values()].flatMap((scene) => scene.commands).every((command) => ['background', 'music', 'show', 'say', 'checkpoint', 'end'].includes(command.op))).toBe(true);
    expect([...compileCampaignStory(sources, new Set()).files.values()].flatMap((scene) => scene.commands).some((command) => command.op === 'show')).toBe(false);
  });
  it('ships the exact compiled scenes and a continuous canonical node chain without changing stage mechanics', () => {
    const output = compileCampaignStory(); const root = 'content/patches/rel_0003_part1_campaign';
    for (const [path, scene] of output.files) expect(readJson(`${root}/${path}`)).toEqual(scene);
    const index = ChapterIndex.parse(readJson(`${root}/chapters/chapter_index.json`));
    expect(index.story_coverage).toEqual(output.coverage);
    const nodes = index.chapters.slice(1).flatMap((chapter) => chapter.nodes);
    expect(nodes.map((node) => node.node_id)).toEqual(output.entries.map((entry) => entry.nodeId));
    for (const [i, node] of nodes.entries()) expect(node.requires).toBe(nodes[i - 1]?.node_id);
    expect(nodes.filter((node) => node.kind === 'battle')).toHaveLength(35);
    expect(nodes.filter((node) => node.kind === 'story')).toHaveLength(16);
    const sources = readJson<{ stages: { stage_id: string; stamina_cost: number; story_rewards: { recruit_character_id?: string; grant_item_id?: string }[] }[] }>('narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/stages_part1.json');
    for (const stage of sources.stages) {
      const node = nodes.find((node) => node.node_id === `stage_${stage.stage_id.replace('-', '_')}`)!;
      expect(node.ration_class).toBe(stage.stamina_cost === 0 ? 'tutorial' : 'campaign');
      expect(node.rewards?.first_clear ?? []).toEqual(stage.story_rewards.flatMap((reward) => [
        ...(reward.recruit_character_id ? [{ type: 'character', itemId: reward.recruit_character_id }] : []),
        ...(reward.grant_item_id ? [{ type: 'item', itemId: reward.grant_item_id, quantity: 1 }] : [])
      ]));
    }
  });
  it('binds all five phase lines to the real Construct ward and rejects absent/ambiguous bosses or phases', () => {
    const output = compileCampaignStory(); const root = 'content/patches/rel_0003_part1_campaign';
    const entry = output.entries.find((entry) => entry.id === '7-5')!;
    const encounter = Encounter.parse(readJson(`${root}/encounters/stage_7_5.json`));
    const pack = UnitPack.parse(readJson(`${root}/units/unit_pack.json`));
    expect(bindCampaignPhaseStories(entry, encounter.enemies, pack)).toEqual([{ unit_id: 'boss_eclipse_construct', phase_id: 'aether_ward', stories: entry.interludes.map((interlude) => interlude.path) }]);
    expect(encounter.phase_stories).toEqual(bindCampaignPhaseStories(entry, encounter.enemies, pack));
    expect(() => bindCampaignPhaseStories(entry, [], pack)).toThrow(/exactly one boss/);
    expect(() => bindCampaignPhaseStories(entry, [...encounter.enemies, ...encounter.enemies], pack)).toThrow(/exactly one boss/);
    expect(() => bindCampaignPhaseStories({ ...entry, interludes: [{ ...entry.interludes[0]!, trigger: 'phase_4_break' }] }, encounter.enemies, pack)).toThrow(/no boss phase/);
  });
  it.each(['missing entry', 'duplicate entry', 'missing chapter', 'chapter order', 'duplicate line', 'missing post', 'unknown phase'] as const)('rejects %s rather than emitting a partial story', (kind) => {
    const sources: StorySources = canonicalStorySources();
    if (kind === 'missing entry') sources.manifest = edited(sources.manifest, (value) => value.story_order.pop());
    if (kind === 'duplicate entry') sources.manifest = edited(sources.manifest, (value) => value.story_order.push(value.story_order[0]));
    if (kind === 'missing chapter') sources.chapters.pop();
    if (kind === 'chapter order') sources.chapters.reverse();
    if (kind === 'duplicate line') sources.chapters[0] = edited(sources.chapters[0]!, (value) => { value.opening_scene.lines[1].line_id = value.opening_scene.lines[0].line_id; });
    if (kind === 'missing post') sources.chapters[0] = edited(sources.chapters[0]!, (value) => { delete value.scenes[0].post_battle_lines; });
    if (kind === 'unknown phase') sources.chapters[6] = edited(sources.chapters[6]!, (value) => { value.scenes.find((scene: { stage_id: string }) => scene.stage_id === '7-5').phase_interludes[0].trigger = 'phase_99_exec'; });
    expect(() => compileCampaignStory(sources)).toThrow();
  });
});
