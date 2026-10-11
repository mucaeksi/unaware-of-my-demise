import { ArtManifest } from './art';
import { EntryIndex, Prologue } from './entry';
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
      const bossPhases = u.boss?.phases ?? [];
      const objectives = new Set(bossPhases.flatMap((p) => p.objectives.map((o) => o.objective_id)));
      const phaseIds = new Set(bossPhases.map((p) => p.phase_id));
      const ops = [
        ...u.skills.flatMap((s) => [...s.effect_ops, ...(s.event_hooks ?? []).flatMap((h) => h.effect_ops)]),
        ...(u.passive_hooks ?? []).flatMap((h) => h.effect_ops),
        ...bossPhases.flatMap((p) => [...p.enter_ops, ...p.passive_ops, ...p.objectives.flatMap((o) => o.on_destroyed ?? [])])
      ];
      const needObjective = (id: string | undefined, where: string): void => {
        if (id !== undefined && !objectives.has(id)) problems.push(`unit ${u.unit_id}: ${where} names objective ${id}, which no phase defines`);
      };
      for (const op of ops) {
        if (op.op === 'apply_status' && !statuses.has(op.status_id)) problems.push(`unit ${u.unit_id}: unknown status ${op.status_id}`);
        if (op.op === 'clear_status_if_all_objectives_destroyed') {
          if (!statuses.has(op.status_id)) problems.push(`unit ${u.unit_id}: unknown status ${op.status_id}`);
          for (const id of op.objective_ids) needObjective(id, op.op);
        }
        if (op.op === 'summon_enemies') {
          if (!units.has(op.enemy_id)) problems.push(`unit ${u.unit_id}: summons unknown unit ${op.enemy_id}`);
          needObjective(op.only_if_objective_alive, op.op);
        }
        if (op.op === 'boss_damage_taken_modifier') {
          needObjective(op.until_objective_destroyed, op.op);
          for (const id of op.while_any_objective_alive ?? []) needObjective(id, op.op);
        }
        if (op.op === 'damage') needObjective(op.multiplier_if_objective_alive?.objective_id, 'damage');
      }
      for (const s of u.skills) {
        for (const ph of s.phase_ids ?? []) if (!phaseIds.has(ph)) problems.push(`unit ${u.unit_id}/${s.skill_id}: phase ${ph} is not a phase of this boss`);
        needObjective(s.telegraph?.interrupt_if_objective_destroyed, `${s.skill_id} telegraph`);
        for (const id of s.telegraph?.interrupt_if_all_objectives_destroyed ?? []) needObjective(id, `${s.skill_id} telegraph`);
        needObjective(s.telegraph?.remove_copied_shields_if_objective_destroyed, `${s.skill_id} telegraph`);
      }
      if (u.boss && u.boss.phases[0]?.transition !== 'battle_start') problems.push(`unit ${u.unit_id}: the first boss phase must begin at battle_start`);
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
  const checkEncounter = (path: string): void => {
    const enc = parse(path, Encounter);
    if (!enc) return;
    for (const e of [...enc.party, ...enc.enemies]) if (!units.has(e.unit_id)) problems.push(`${path}: unknown unit ${e.unit_id}`);
    for (const g of enc.guests ?? []) if (!units.has(g)) problems.push(`${path}: unknown guest ${g}`);
    if (art && !art.backgrounds[enc.location_id]) problems.push(`${path}: no background for ${enc.location_id}`);
    if (art && enc.music_cue && !art.music[enc.music_cue]) problems.push(`${path}: unknown music cue ${enc.music_cue}`);
    if (enc.pre_story) checkScene(enc.pre_story, enc.location_id);
    if (enc.post_story) checkScene(enc.post_story, enc.location_id);
  };
  if (index) {
    // a node may require any node of the campaign (the server gates on the player's progress rows, which are global)
    const allNodes = new Set(index.chapters.flatMap((c) => c.nodes.map((x) => x.node_id)));
    for (const ch of index.chapters) {
      const ids = new Set<string>();
      for (const n of ch.nodes) {
        nodes++;
        if (ids.has(n.node_id)) problems.push(`chapter ${ch.chapter_id}: duplicate node ${n.node_id}`);
        ids.add(n.node_id);
        if (n.requires && !allNodes.has(n.requires)) problems.push(`node ${n.node_id}: requires unknown node ${n.requires}`);
        if (n.kind === 'story') {
          if (!n.story) problems.push(`node ${n.node_id}: story node without story path`);
          else checkScene(n.story);
        } else if (!n.encounter) {
          problems.push(`node ${n.node_id}: battle node without encounter path`);
        } else {
          checkEncounter(n.encounter);
        }
      }
    }
  }
  // first-install flow (only present in releases that ship it): the prologue and every tutorial stage must resolve
  if (files.has('entry/entry_index.json')) {
    const entry = parse('entry/entry_index.json', EntryIndex);
    if (entry) {
      parse(entry.prologue, Prologue); // audio cues are hooks for the later sound pass and are not resolved against the music manifest
      const stages = new Set<string>();
      for (const t of entry.tutorial) {
        if (stages.has(t.stage_id)) problems.push(`entry index: duplicate stage ${t.stage_id}`);
        stages.add(t.stage_id);
        checkEncounter(t.encounter);
      }
    }
  }
  if (problems.length > 0) throw new ContentValidationError(problems);
  return { chapters: index?.chapters.length ?? 0, nodes, units: units.size, scenes };
}
