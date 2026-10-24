/**
 * D-29 A3: the Part I campaign ships one chapter at a time. From the full campaign patch (tools/build_campaign.ts) this
 * derives the snapshot for "chapters 1..N": the chapter index, story coverage and recruit selectors keep only those
 * chapters, library entries gated behind a later chapter are dropped, and the encounters/scenes of later chapters are
 * left out (no spoilers, no download). Units, art and the world map stay whole: the map shows the rest as "coming soon".
 */
import type { ChapterIndex, Encounter, NarrativeLibrary, PresentationPack, StoryScene } from '@uomd/content-schema';

const dec = new TextDecoder();
const enc = new TextEncoder();
const read = <T>(files: ReadonlyMap<string, Uint8Array>, path: string): T => JSON.parse(dec.decode(files.get(path)!)) as T;
const write = (v: unknown): Uint8Array => enc.encode(`${JSON.stringify(v, null, 2)}\n`);

export const CHAPTER_INDEX_PATH = 'chapters/chapter_index.json';
const LIBRARY_PATH = 'library/library_index.json';
const PRESENTATION_PATH = 'presentation/presentation.json';

export function chapterPatch(files: ReadonlyMap<string, Uint8Array>, chapters: number): Map<string, Uint8Array> {
  const index = read<ChapterIndex>(files, CHAPTER_INDEX_PATH);
  const campaign = index.chapters.filter((c) => c.chapter_id !== 'tutorial');
  if (!Number.isInteger(chapters) || chapters < 1 || chapters > campaign.length) throw new Error(`chapters must be 1..${campaign.length}`);
  const kept = index.chapters
    .filter((c) => c.chapter_id === 'tutorial' || campaign.indexOf(c) < chapters)
    .map((c) => (chapters < campaign.length ? { ...c, nodes: c.nodes.filter((n) => n.difficulty !== 'hard') } : c));
  const keptIds = new Set(kept.map((c) => c.chapter_id));
  const nodes = new Set(kept.flatMap((c) => c.nodes.map((n) => n.node_id)));

  // every scene/encounter a kept node reaches; files of later chapters are dropped below
  const reached = new Set<string>();
  for (const n of kept.flatMap((c) => c.nodes)) {
    if (n.story) reached.add(n.story);
    if (n.encounter && files.has(n.encounter)) {
      reached.add(n.encounter);
      const e = read<Encounter>(files, n.encounter);
      for (const p of [e.pre_story, e.post_story, ...(e.phase_stories ?? []).flatMap((b) => b.stories)]) if (p) reached.add(p);
    }
  }

  const droppedLines = new Set<string>();
  const coverage = index.story_coverage;
  const out = new Map<string, Uint8Array>();
  for (const [path, bytes] of files) {
    if (path.startsWith('story/') && !reached.has(path)) {
      const sc = read<StoryScene>(files, path);
      for (const c of sc.commands) if (c.op === 'say' || c.op === 'narrate') droppedLines.add(c.line_id);
      continue;
    }
    if (path.startsWith('encounters/') && !reached.has(path)) continue;
    out.set(path, bytes);
  }
  out.set(CHAPTER_INDEX_PATH, write({
    ...index,
    chapters: kept,
    ...(index.recruit_selectors ? { recruit_selectors: index.recruit_selectors.filter((s) => nodes.has(s.after_node) && nodes.has(s.scene_node)) } : {}),
    ...(coverage ? { story_coverage: { ...coverage, chapter_ids: coverage.chapter_ids.filter((id) => keptIds.has(id)), entries: coverage.entries.filter((e) => nodes.has(e.node_id)) } } : {})
  }));

  if (files.has(LIBRARY_PATH)) {
    const library = read<NarrativeLibrary>(files, LIBRARY_PATH);
    // an entry stays when its battle gate is shipped and the entry it continues stayed too (companion parts form chains)
    const stay = new Set<string>();
    for (const entry of library.entries) {
      const gate = entry.gate;
      if (gate.after_node && !nodes.has(gate.after_node)) {
        for (const lid of entry.line_ids) droppedLines.add(lid);
        continue;
      }
      if (gate.after_entry && !stay.has(gate.after_entry)) {
        for (const lid of entry.line_ids) droppedLines.add(lid);
        continue;
      }
      stay.add(entry.entry_id);
    }
    out.set(LIBRARY_PATH, write({ ...library, entries: library.entries.filter((e) => stay.has(e.entry_id)) }));
  }

  if (files.has(PRESENTATION_PATH) && droppedLines.size > 0) {
    const pres = read<PresentationPack>(files, PRESENTATION_PATH);
    const keptVoices: Record<string, PresentationPack['voices'][string]> = {};
    for (const [id, v] of Object.entries(pres.voices)) {
      if (droppedLines.has(id)) {
        out.delete(v.file);
      } else {
        keptVoices[id] = v;
      }
    }
    out.set(PRESENTATION_PATH, write({ ...pres, voices: keptVoices }));
  }
  return out;
}
