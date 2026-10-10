import { ArtManifest } from './art';
import { ChapterIndex, Encounter, StoryScene } from './story';
import { UnitPack } from './units';

export class ContentValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`content validation failed (${problems.length}): ${problems.slice(0, 4).join(' | ')}${problems.length > 4 ? ' ...' : ''}`);
    this.name = 'ContentValidationError';
  }
}

const dec = new TextDecoder();

/**
 * Validates the EFFECTIVE content set (patch files overlaid on the base) the way the client will use
 * it: every JSON file against its schema, then every cross reference (chapter -> encounter -> units
 * -> art -> files). Pure; runs identically in the Worker (publish gate) and on the device (before
 * activation).
 */
export function validateContentSet(files: ReadonlyMap<string, Uint8Array>): { chapters: number; nodes: number; units: number; scenes: number } {
  const problems: string[] = [];
  const json = (path: string): unknown => {
    const b = files.get(path);
    if (!b) {
      problems.push(`missing file ${path}`);
      return undefined;
    }
    try {
      return JSON.parse(dec.decode(b));
    } catch {
      problems.push(`${path}: not valid JSON`);
      return undefined;
    }
  };
  const parse = <T>(path: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }): T | undefined => {
    const raw = json(path);
    if (raw === undefined) return undefined;
    const r = schema.safeParse(raw);
    if (r.success) return r.data;
    for (const i of r.error.issues.slice(0, 5)) problems.push(`${path}: ${i.path.map(String).join('.')}: ${i.message}`);
    return undefined;
  };

  const pack = parse('units/unit_pack.json', UnitPack);
  const art = parse('art/art_manifest.json', ArtManifest);
  const index = parse('chapters/chapter_index.json', ChapterIndex);

  const units = new Set(pack?.units.map((u) => u.unit_id) ?? []);
  const statuses = new Set(pack?.rules.statuses.map((s) => s.status_id) ?? []);
  if (pack) {
    for (const u of pack.units) {
      if (art && !art.units[u.art_key]) problems.push(`unit ${u.unit_id}: art_key ${u.art_key} missing from art manifest`);
      for (const s of u.skills) {
        const ops = [...s.effect_ops, ...(s.event_hooks ?? []).flatMap((h) => h.effect_ops)];
        for (const op of ops) if (op.op === 'apply_status' && !statuses.has(op.status_id)) problems.push(`unit ${u.unit_id}/${s.skill_id}: unknown status ${op.status_id}`);
      }
    }
  }
  if (art) {
    const need = [
      ...Object.values(art.atlases).map((a) => a.image),
      ...Object.values(art.backgrounds),
      ...Object.values(art.music).map((m) => m.file),
      ...Object.values(art.ui),
      ...Object.values(art.portraits).flatMap((p) => Object.values(p.images))
    ];
    for (const p of need) if (!files.has(p)) problems.push(`art manifest references missing file ${p}`);
  }

  let scenes = 0;
  let nodes = 0;
  const checkScene = (path: string, expectedLocation?: string): void => {
    const s = parse(path, StoryScene);
    if (!s) return;
    scenes++;
    if (expectedLocation && s.location_id !== expectedLocation) problems.push(`${path}: location ${s.location_id} differs from encounter ${expectedLocation}`);
    if (art) {
      for (const c of s.commands) {
        if (c.op === 'background' && !art.backgrounds[c.location_id]) problems.push(`${path}: no background art for ${c.location_id}`);
        if (c.op === 'music' && c.cue_id !== 'stop' && !art.music[c.cue_id]) problems.push(`${path}: unknown music cue ${c.cue_id}`);
        if (c.op === 'show' && !art.portraits[c.character]) problems.push(`${path}: no portraits for ${c.character}`);
      }
    }
  };
  if (index) {
    for (const ch of index.chapters) {
      const ids = new Set<string>();
      for (const n of ch.nodes) {
        nodes++;
        if (ids.has(n.node_id)) problems.push(`chapter ${ch.chapter_id}: duplicate node ${n.node_id}`);
        ids.add(n.node_id);
        if (n.requires && !ch.nodes.some((o) => o.node_id === n.requires)) problems.push(`node ${n.node_id}: requires unknown node ${n.requires}`);
        if (n.kind === 'story') {
          if (!n.story) problems.push(`node ${n.node_id}: story node without story path`);
          else checkScene(n.story);
        } else if (!n.encounter) {
          problems.push(`node ${n.node_id}: battle node without encounter path`);
        } else {
          const enc = parse(n.encounter, Encounter);
          if (!enc) continue;
          for (const e of [...enc.party, ...enc.enemies]) if (!units.has(e.unit_id)) problems.push(`${n.encounter}: unknown unit ${e.unit_id}`);
          if (art && !art.backgrounds[enc.location_id]) problems.push(`${n.encounter}: no background for ${enc.location_id}`);
          if (art && enc.music_cue && !art.music[enc.music_cue]) problems.push(`${n.encounter}: unknown music cue ${enc.music_cue}`);
          if (enc.pre_story) checkScene(enc.pre_story, enc.location_id);
          if (enc.post_story) checkScene(enc.post_story, enc.location_id);
        }
      }
    }
  }
  if (problems.length > 0) throw new ContentValidationError(problems);
  return { chapters: index?.chapters.length ?? 0, nodes, units: units.size, scenes };
}
