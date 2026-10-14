import { describe, expect, it } from 'vitest';
import { compileNarrativeLibrary, librarySources } from './narrative-library';
import { readJson, sha256 } from './fsutil';
import { NarrativeLibrary } from '../../packages/content-schema/src/index';

describe('canonical narrative library', () => {
  it('preserves all 76 companion parts, 12 codex entries and four three-scene events exactly', () => {
    const sources = librarySources(); const library = compileNarrativeLibrary();
    const [companions, codex, events] = sources.map((source) => JSON.parse(new TextDecoder().decode(source.bytes)));
    expect(library.entries.filter((entry) => entry.kind === 'companion')).toHaveLength(76);
    expect(library.entries.filter((entry) => entry.kind === 'codex')).toHaveLength(12);
    expect(library.entries.filter((entry) => entry.kind === 'event')).toHaveLength(4);
    expect(library.entries.flatMap((entry) => entry.scenes)).toHaveLength(100);
    expect(library.entries.flatMap((entry) => entry.line_ids)).toHaveLength(445);
    for (const [i, source] of sources.entries()) expect(library.sources[i]).toEqual({ path: source.path, sha256: sha256(Buffer.from(source.bytes)) });
    const compare = (id: string, scenes: any[]) => {
      const entry = library.entries.find((entry) => entry.entry_id === id)!;
      expect(entry.scenes.flatMap((scene) => scene.commands.filter((command) => command.op === 'say'))).toEqual(scenes.flatMap((scene) => scene.lines.map((line: any) => ({ op: 'say', line_id: line.line_id, speaker: line.speaker_id, speaker_display: line.speaker_display, text: line.text_en, emotion: line.emotion, voice_track: line.voice_track }))));
      expect(entry.scenes.map((scene) => scene.production!.direction_en)).toEqual(scenes.map((scene) => scene.direction_en));
    };
    for (const character of companions.stories) for (const [i, part] of character.parts.entries()) {
      compare(part.story_id, [part]); const entry = library.entries.find((entry) => entry.entry_id === part.story_id)!;
      expect(entry.gate).toEqual({ after_node: `stage_${part.unlock.after_stage.replace('-', '_')}`, ...(part.unlock.requires_owned_character ? { owned_character: part.unlock.requires_owned_character } : {}), ...(i ? { after_entry: character.parts[i - 1].story_id } : {}) });
    }
    for (const event of events.events) { compare(event.event_id, event.scenes); expect(library.entries.find((entry) => entry.entry_id === event.event_id)!.gate).toEqual({ after_node: `stage_${event.unlock.after_stage.replace('-', '_')}` }); }
    for (const item of codex.codex) {
      const entry = library.entries.find((entry) => entry.entry_id === item.codex_id)!;
      expect(entry.scenes[0]!.commands.find((command) => command.op === 'narrate')).toEqual({ op: 'narrate', line_id: `${item.codex_id}_text`, text: item.text_en });
      expect(entry.gate).toEqual(item.unlock === 'always' ? {} : { after_node: `stage_${item.unlock.after_stage.replace('-', '_')}` });
    }
    expect(NarrativeLibrary.parse(readJson('content/patches/rel_0003_part1_campaign/library/library_index.json'))).toEqual(library);
    expect(compileNarrativeLibrary()).toEqual(library);
  });
  it.each(['source order', 'part order', 'ownership', 'duplicate line', 'malformed gate'] as const)('rejects %s instead of silently dropping a canonical requirement', (kind) => {
    const sources = librarySources();
    if (kind === 'source order') sources.reverse();
    else {
      const value = JSON.parse(new TextDecoder().decode(sources[0]!.bytes)); const part = value.stories[0].parts[0];
      if (kind === 'part order') part.part = 2;
      if (kind === 'ownership') part.unlock.requires_owned_character = 'another_hero';
      if (kind === 'duplicate line') part.lines.push(part.lines[0]);
      if (kind === 'malformed gate') part.unlock.after_stage = 'unknown-stage';
      sources[0]!.bytes = new TextEncoder().encode(JSON.stringify(value));
    }
    expect(() => compileNarrativeLibrary(sources)).toThrow();
  });
});
