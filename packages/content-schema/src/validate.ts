import { ArtManifest } from './art';
import { EntryIndex, Prologue } from './entry';
import type { Predicate } from './effects';
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
  const unique = (kind: string, ids: string[]): void => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`duplicate ${kind} ${id}`);
      seen.add(id);
    }
  };
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

  const units = new Map(pack?.units.map((u) => [u.unit_id, u]) ?? []);
  const statuses = new Set(pack?.rules.statuses.map((s) => s.status_id) ?? []);
  const tags = new Set(pack?.rules.statuses.flatMap((status) => status.tags ?? []) ?? []);
  const needStatus = (id: string, where: string): void => {
    if (!statuses.has(id)) problems.push(`${where}: unknown status ${id}`);
  };
  const needUnitKind = (id: string, kind: 'character' | 'enemy', where: string): void => {
    const unit = units.get(id);
    if (unit && unit.kind !== kind) problems.push(`${where}: unit ${id} must be ${kind === 'enemy' ? 'an enemy' : 'a character'}`);
  };
  const checkPredicate = (predicate: Predicate | undefined, where: string): void => {
    const pending = predicate ? [predicate] : [];
    while (pending.length) {
      const current = pending.pop()!;
      if ('all' in current) pending.push(...current.all);
      else if ('any' in current) pending.push(...current.any);
      else switch (current.predicate) {
        case 'last_target_has_status': case 'owner_has_status': case 'target_has_status': case 'event_target_had_status': case 'count_enemies_with_status':
          needStatus(current.value, where); break;
        case 'target_has_status_tag': case 'target_has_any_status_tag':
          for (const tag of current.predicate === 'target_has_any_status_tag' ? current.value.split('_or_') : [current.value]) {
            if (!tags.has(tag)) problems.push(`${where}: unknown status tag ${tag}`);
          }
          break;
      }
    }
  };
  if (pack) {
    const phases = pack.units.flatMap((unit) => unit.boss?.phases ?? []);
    unique('unit', pack.units.map((unit) => unit.unit_id));
    unique('skill', pack.units.flatMap((unit) => unit.skills.map((skill) => skill.skill_id)));
    unique('status', pack.rules.statuses.map((status) => status.status_id));
    unique('phase', phases.map((phase) => phase.phase_id));
    unique('objective', phases.flatMap((phase) => phase.objectives.map((objective) => objective.objective_id)));
    for (const status of pack.rules.statuses) for (const id of status.immune_status_ids ?? []) needStatus(id, `status ${status.status_id}`);
    for (const u of pack.units) {
      if (art && !art.units[u.art_key]) problems.push(`unit ${u.unit_id}: art_key ${u.art_key} missing from art manifest`);
      const bossPhases = u.boss?.phases ?? [];
      const objectives = new Set(bossPhases.flatMap((p) => p.objectives.map((o) => o.objective_id)));
      const phaseIds = new Set(bossPhases.map((p) => p.phase_id));
      const skillIds = new Set(u.skills.map((skill) => skill.skill_id));
      for (const id of [u.intent_skill_id, ...bossPhases.map((phase) => phase.signature_action_id)]) {
        if (id && !skillIds.has(id)) problems.push(`unit ${u.unit_id}: unknown own skill ${id}`);
      }
      for (const id of [...(u.status_immunities ?? []), ...(u.boss?.preserve_status_ids ?? [])]) needStatus(id, `unit ${u.unit_id}`);
      const hooks = [...u.skills.flatMap((skill) => skill.event_hooks ?? []), ...(u.passive_hooks ?? [])];
      const modifiers = [...u.skills.flatMap((skill) => skill.continuous_modifiers ?? []), ...(u.continuous_modifiers ?? [])];
      for (const entry of [...hooks, ...modifiers]) checkPredicate(entry.condition, `unit ${u.unit_id}`);
      const ops = [
        ...u.skills.flatMap((s) => [...s.effect_ops, ...(s.event_hooks ?? []).flatMap((h) => h.effect_ops)]),
        ...(u.passive_hooks ?? []).flatMap((h) => h.effect_ops),
        ...bossPhases.flatMap((p) => [...p.enter_ops, ...p.passive_ops, ...p.objectives.flatMap((o) => o.on_destroyed ?? [])])
      ];
      const needObjective = (id: string | undefined, where: string): void => {
        if (id !== undefined && !objectives.has(id)) problems.push(`unit ${u.unit_id}: ${where} names objective ${id}, which no phase defines`);
      };
      for (const op of ops) {
        checkPredicate(op.when, `unit ${u.unit_id}/${op.op}`);
        if (op.op === 'damage') for (const modifier of op.modifiers ?? []) checkPredicate(modifier.condition, `unit ${u.unit_id}/damage`);
        if (op.op === 'apply_status' && !statuses.has(op.status_id)) problems.push(`unit ${u.unit_id}: unknown status ${op.status_id}`);
        if (op.op === 'clear_status_if_all_objectives_destroyed') {
          if (!statuses.has(op.status_id)) problems.push(`unit ${u.unit_id}: unknown status ${op.status_id}`);
          for (const id of op.objective_ids) needObjective(id, op.op);
        }
        if (op.op === 'summon_enemies') {
          if (!units.has(op.enemy_id)) problems.push(`unit ${u.unit_id}: summons unknown unit ${op.enemy_id}`);
          needUnitKind(op.enemy_id, 'enemy', `unit ${u.unit_id}/summon_enemies`);
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
      ...Object.values(art.stills),
      ...Object.values(art.portraits).flatMap((p) => Object.values(p.images))
    ];
    for (const p of need) if (!files.has(p)) problems.push(`art manifest references missing file ${p}`);
  }

  let scenes = 0;
  let nodes = 0;
  const parsedScenes = new Map<string, StoryScene>();
  const parsedEncounters = new Map<string, Encounter>();
  const checkScene = (path: string, expectedLocation?: string): void => {
    const s = parse(path, StoryScene);
    if (!s) return;
    parsedScenes.set(path, s);
    scenes++;
    // a scene that names an illustration the art manifest does not ship simply runs on its portraits (the stand-in period); it is never an error
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
    parsedEncounters.set(path, enc);
    for (const e of [...enc.party, ...enc.enemies]) if (!units.has(e.unit_id)) problems.push(`${path}: unknown unit ${e.unit_id}`);
    for (const member of enc.party) needUnitKind(member.unit_id, 'character', `${path}/party`);
    for (const member of enc.enemies) needUnitKind(member.unit_id, 'enemy', `${path}/enemies`);
    for (const g of enc.guests ?? []) if (!units.has(g)) problems.push(`${path}: unknown guest ${g}`);
    for (const id of enc.guests ?? []) needUnitKind(id, 'character', `${path}/guests`);
    if (art && !art.backgrounds[enc.location_id]) problems.push(`${path}: no background for ${enc.location_id}`);
    if (art && enc.music_cue && !art.music[enc.music_cue]) problems.push(`${path}: unknown music cue ${enc.music_cue}`);
    if (enc.pre_story) checkScene(enc.pre_story, enc.location_id);
    if (enc.post_story) checkScene(enc.post_story, enc.location_id);
    unique(`${path} phase story binding`, (enc.phase_stories ?? []).map((binding) => `${binding.unit_id}:${binding.phase_id}`));
    for (const binding of enc.phase_stories ?? []) {
      const boss = units.get(binding.unit_id)?.boss;
      if (!enc.enemies.some((member) => member.unit_id === binding.unit_id) || !boss?.phases.some((phase) => phase.phase_id === binding.phase_id))
        problems.push(`${path}: unknown encounter boss phase ${binding.unit_id}/${binding.phase_id}`);
      for (const story of binding.stories) checkScene(story, enc.location_id);
    }
  };
  if (index) {
    // a node may require any node of the campaign (the server gates on the player's progress rows, which are global)
    const campaignNodes = index.chapters.flatMap((chapter) => chapter.nodes);
    unique('chapter', index.chapters.map((chapter) => chapter.chapter_id));
    unique('node', campaignNodes.map((node) => node.node_id));
    const allNodes = new Map(campaignNodes.map((node) => [node.node_id, node]));
    // Walk each single-prerequisite chain once without recursion, including cross-chapter edges.
    const checked = new Set<string>();
    for (const node of campaignNodes) {
      const chain = new Set<string>();
      let current: string | undefined = node.node_id;
      while (current !== undefined && allNodes.has(current) && !checked.has(current)) {
        if (chain.has(current)) {
          problems.push(`node ${current}: prerequisite cycle`);
          break;
        }
        chain.add(current);
        current = allNodes.get(current)?.requires;
      }
      for (const id of chain) checked.add(id);
    }
    for (const ch of index.chapters) {
      for (const n of ch.nodes) {
        nodes++;
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
    if (index.story_coverage) {
      const coverage = index.story_coverage;
      unique('story coverage source', coverage.sources.map((source) => source.path));
      unique('story coverage chapter', coverage.chapter_ids);
      unique('story coverage entry', coverage.entries.map((entry) => entry.entry_id));
      unique('story coverage node', coverage.entries.map((entry) => entry.node_id));
      unique('story coverage line', coverage.entries.flatMap((entry) => entry.line_ids));
      const sourceHashes = new Map(coverage.sources.map((source) => [source.path, source.sha256]));
      for (const id of coverage.chapter_ids) if (!index.chapters.some((chapter) => chapter.chapter_id === id)) problems.push(`story coverage: missing chapter ${id}`);
      const actualOrder = index.chapters.filter((chapter) => coverage.chapter_ids.includes(chapter.chapter_id)).flatMap((chapter) => chapter.nodes.map((node) => node.node_id));
      if (JSON.stringify(index.chapters.filter((chapter) => coverage.chapter_ids.includes(chapter.chapter_id)).map((chapter) => chapter.chapter_id)) !== JSON.stringify(coverage.chapter_ids)) problems.push('story coverage: chapter order differs from declared canon');
      if (JSON.stringify(actualOrder) !== JSON.stringify(coverage.entries.map((entry) => entry.node_id))) problems.push('story coverage: chapter node order differs from declared canon');
      for (const [position, entry] of coverage.entries.entries()) {
        const node = allNodes.get(entry.node_id);
        if (!node) { problems.push(`story coverage: missing node ${entry.node_id}`); continue; }
        if (node.requires !== coverage.entries[position - 1]?.node_id) problems.push(`story coverage ${entry.entry_id}: prerequisite differs from declared canon`);
        const encounter = node.encounter ? parsedEncounters.get(node.encounter) : undefined;
        const linked = node.kind === 'story' ? [node.story] : [encounter?.pre_story, ...(encounter?.phase_stories ?? []).flatMap((binding) => binding.stories), encounter?.post_story];
        if (JSON.stringify(linked) !== JSON.stringify(entry.scene_paths)) problems.push(`story coverage ${entry.entry_id}: scene links differ from declared canon`);
        const lines: string[] = [];
        for (const path of entry.scene_paths) {
          const scene = parsedScenes.get(path);
          if (!scene) { problems.push(`story coverage: missing referenced scene ${path}`); continue; }
          const source = scene.provenance.source.split('#')[0]!;
          if (!sourceHashes.has(source) || sourceHashes.get(source) !== scene.provenance.source_sha256) problems.push(`story coverage ${path}: source provenance differs from declared canon`);
          lines.push(...scene.commands.flatMap((command) => command.op === 'say' || command.op === 'narrate' ? [command.line_id] : []));
        }
        if (JSON.stringify(lines) !== JSON.stringify(entry.line_ids)) problems.push(`story coverage ${entry.entry_id}: line IDs/order differ from declared canon`);
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
