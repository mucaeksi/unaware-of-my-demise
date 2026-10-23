import { PRESENTATION_PATH, PresentationPack, PresentationCommand, LocalePack, EventSchedule, ShopSchedule } from './presentation';
import { VFX_PATH, VfxPack } from './vfx';
import { MAX_JSON_FILE_BYTES, MAX_JSON_TOTAL_BYTES, MAX_VIDEO_BYTES } from './primitives';
import { CATALOG_PATH, MAX_CATALOG_BYTES, EconomyCatalog, catalogContentProblems } from './catalog';
import { ArtManifest } from './art';
import { EntryIndex, Prologue } from './entry';
import type { Predicate } from './effects';
import { ChapterIndex, Encounter, StoryScene } from './story';
import { UnitPack } from './units';
import { NarrativeLibrary } from './library';
import { WORLD_MAP_PATH, WorldMap } from './world';

export class ContentValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`content validation failed (${problems.length}): ${problems.slice(0, 4).join(' | ')}${problems.length > 4 ? ' ...' : ''}`);
    this.name = 'ContentValidationError';
  }
}

const dec = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

/**
 * Validates the EFFECTIVE content set (patch files overlaid on the base) the way the client will use
 * it: every JSON file against its schema, then every cross reference (chapter -> encounter -> units
 * -> art -> files). Pure; runs identically in the Worker (publish gate) and on the device (before
 * activation).
 */
export function validateContentSet(files: ReadonlyMap<string, Uint8Array>): { chapters: number; nodes: number; units: number; scenes: number } {
  const problems: string[] = [];
  const parsedPaths = new Set<string>();
  const jsonFiles = [...files].filter(([path]) => path.endsWith('.json'));
  if (jsonFiles.some(([, bytes]) => bytes.byteLength > MAX_JSON_FILE_BYTES) || jsonFiles.reduce((n, [, bytes]) => n + bytes.byteLength, 0) > MAX_JSON_TOTAL_BYTES) throw new ContentValidationError(['JSON resource budget exceeded']);
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
    parsedPaths.add(path);
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
    checkSceneData(path, s, expectedLocation);
  };
  const checkSceneData = (path: string, s: StoryScene, expectedLocation?: string): void => {
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
    unique('recruit selector', (index.recruit_selectors ?? []).map((selector) => selector.item_id));
    for (const selector of index.recruit_selectors ?? []) {
      unique(`${selector.item_id} selector choice`, selector.choices);
      const after = allNodes.get(selector.after_node); const scene = allNodes.get(selector.scene_node);
      if (after?.kind !== 'battle' || scene?.kind !== 'story' || scene.requires !== selector.after_node) problems.push(`selector ${selector.item_id}: invalid battle/story gate`);
      for (const id of selector.choices) if (units.get(id)?.kind !== 'character' || units.get(id)?.rarity !== selector.rarity) problems.push(`selector ${selector.item_id}: invalid ${selector.rarity}-star character ${id}`);
      if (index.story_coverage && !index.story_coverage.sources.some((source) => source.path === selector.provenance.source.split('#')[0] && source.sha256 === selector.provenance.source_sha256)) problems.push(`selector ${selector.item_id}: invalid source provenance`);
    }
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
      const actualOrder = index.chapters.filter((chapter) => coverage.chapter_ids.includes(chapter.chapter_id)).flatMap((chapter) => chapter.nodes.filter((node) => node.difficulty !== 'hard').map((node) => node.node_id));
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
  if (files.has('library/library_index.json')) {
    const library = parse('library/library_index.json', NarrativeLibrary);
    if (library && index) {
      const mainNodes = new Map(index.chapters.flatMap((chapter) => chapter.nodes).map((node) => [node.node_id, node]));
      const entries = new Map(library.entries.map((entry) => [entry.entry_id, entry]));
      const sourceHashes = new Map(library.sources.map((source) => [source.path, source.sha256]));
      unique('library source', library.sources.map((source) => source.path));
      unique('library entry', library.entries.map((entry) => entry.entry_id));
      unique('library scene', library.entries.flatMap((entry) => entry.scenes.map((scene) => scene.scene_id)));
      unique('library line', library.entries.flatMap((entry) => entry.line_ids));
      const existingLines = new Set([...parsedScenes.values()].flatMap((scene) => scene.commands.flatMap((command) => command.op === 'say' || command.op === 'narrate' ? [command.line_id] : [])));
      const existingSceneIds = new Set([...parsedScenes.values()].map((scene) => scene.scene_id));
      const priorParts = new Map<string, { id: string; part: number }>();
      for (const entry of library.entries) {
        const where = `library ${entry.entry_id}`; const gate = entry.gate;
        if (mainNodes.has(entry.entry_id)) problems.push(`${where}: ID collides with a campaign node`);
        if (gate.after_node && mainNodes.get(gate.after_node)?.kind !== 'battle') problems.push(`${where}: unknown battle gate ${gate.after_node}`);
        if (gate.owned_character && units.get(gate.owned_character)?.kind !== 'character') problems.push(`${where}: unknown character gate ${gate.owned_character}`);
        if (gate.after_entry && !entries.has(gate.after_entry)) problems.push(`${where}: unknown previous entry`);
        if (entry.kind === 'companion') {
          const prior = priorParts.get(entry.group_id);
          if (units.get(entry.group_id)?.kind !== 'character' || !gate.after_node || entry.part !== (prior?.part ?? 0) + 1 || gate.after_entry !== prior?.id
            || gate.owned_character !== (['mahmut', 'fadyme'].includes(entry.group_id) ? undefined : entry.group_id)) problems.push(`${where}: invalid companion order/ownership`);
          priorParts.set(entry.group_id, { id: entry.entry_id, part: entry.part });
        } else if (gate.after_entry || gate.owned_character || entry.part !== 1 || entry.kind === 'event' && !gate.after_node) problems.push(`${where}: invalid codex/event gate`);
        if (sourceHashes.get(entry.provenance.source) !== entry.provenance.source_sha256) problems.push(`${where}: invalid provenance`);
        const lines: string[] = [];
        for (const scene of entry.scenes) {
          if (existingSceneIds.has(scene.scene_id)) problems.push(`${where}: scene ID collision`);
          existingSceneIds.add(scene.scene_id);
          checkSceneData(scene.scene_id, scene);
          if (scene.provenance.source.split('#')[0] !== entry.provenance.source || scene.provenance.source_sha256 !== entry.provenance.source_sha256) problems.push(`${where}: scene provenance mismatch`);
          lines.push(...scene.commands.flatMap((command) => command.op === 'say' || command.op === 'narrate' ? [command.line_id] : []));
        }
        if (JSON.stringify(lines) !== JSON.stringify(entry.line_ids) || lines.some((id) => existingLines.has(id))) problems.push(`${where}: line coverage/collision`);
      }
    }
  }
  let prologue: Prologue | undefined;
  // first-install flow (only present in releases that ship it): the prologue and every tutorial stage must resolve
  if (files.has('entry/entry_index.json')) {
    const entry = parse('entry/entry_index.json', EntryIndex);
    if (entry) {
      prologue = parse(entry.prologue, Prologue); // audio cues are hooks for the later sound pass and are not resolved against the music manifest
      const stages = new Set<string>();
      for (const t of entry.tutorial) {
        if (stages.has(t.stage_id)) problems.push(`entry index: duplicate stage ${t.stage_id}`);
        stages.add(t.stage_id);
        checkEncounter(t.encounter);
      }
    }
  }
  for (const path of files.keys()) if (path.startsWith('catalog/') && path !== CATALOG_PATH) problems.push(`unsupported catalog path ${path}`);
  if (files.has(CATALOG_PATH)) {
    if (files.get(CATALOG_PATH)!.byteLength > MAX_CATALOG_BYTES) problems.push('catalog snapshot exceeds the 1 MiB staging budget');
    else {
      const catalog = parse(CATALOG_PATH, EconomyCatalog);
      if (catalog && pack && index) problems.push(...catalogContentProblems(catalog, pack, index));
    }
  }
  for (const path of files.keys()) if (!parsedPaths.has(path) && path.endsWith('.json')) {
    if (path.startsWith('story/')) checkScene(path);
    if (path.startsWith('encounters/')) checkEncounter(path);
  }
  const profile = files.has(PRESENTATION_PATH) ? parse(PRESENTATION_PATH, PresentationPack) : undefined;
  const lineOwners = new Map<string, string>(); const sceneIds = new Set<string>();
  for (const [path, scene] of parsedScenes) {
    if (sceneIds.has(scene.scene_id)) problems.push(`${path}: duplicate stable scene ID ${scene.scene_id}`); sceneIds.add(scene.scene_id);
    for (const command of scene.commands) if (command.op === 'say' || command.op === 'narrate') { const owner = lineOwners.get(command.line_id); if (owner && owner !== path) problems.push(`${path}: stable line ${command.line_id} collides with ${owner}`); lineOwners.set(command.line_id, path); }
  }
  const lines = new Map([...parsedScenes.values()].flatMap((scene) => scene.commands.flatMap((c) => c.op === 'say' || c.op === 'narrate' ? [[c.line_id, c.text] as const] : [])));
  for (const line of prologue?.scenes ?? []) { if (lines.has(line.line_id)) problems.push(`prologue: colliding stable line ${line.line_id}`); lines.set(line.line_id, line.text_en); }
  const textIds = new Set(lines.keys());
  const textLimits = new Map([...lines.keys()].map((id) => [id, 600]));
  const exists = (table: Record<string, unknown> | undefined, id: string): boolean => !!table && Object.hasOwn(table, id);
  const needProfile = (kind: 'voices' | 'sounds' | 'videos' | 'panels', id: string, where: string): void => { if (!exists(profile?.[kind], id)) problems.push(`${where}: unknown presentation ${kind}/${id}`); };
  for (const [path, scene] of parsedScenes) {
    const layers = new Set<string>(); const masks = new Set<string>();
    for (const c of scene.commands) {
      if (PresentationCommand.options.some((op) => op.shape.op.value === c.op) && !profile) problems.push(`${path}: presentation commands require ${PRESENTATION_PATH}`);
      if (c.op === 'voice') needProfile('voices', c.line_id, path);
      if (c.op === 'sound') needProfile('sounds', c.cue_id, path);
      if (c.op === 'video') { needProfile('videos', c.video_id, path); if (scene.presentation && c.skippable) problems.push(`${path}: entry cutscenes cannot add Skip`); }
      if (c.op === 'panel') {
        needProfile('panels', c.panel_id, path);
        const pending = [c.panel_id]; const visited = new Set<string>();
        while (pending.length) { const id = pending.pop()!; if (visited.has(id)) continue; visited.add(id); const panel = profile && Object.hasOwn(profile.panels, id) ? profile.panels[id] : undefined;
          for (const button of panel?.buttons ?? []) { if (button.action.type === 'screen') problems.push(`${path}: modal notices cannot abandon a paused story through screen navigation`); if (button.action.type === 'panel') pending.push(button.action.panel_id); }
        }
      }
      if (c.op === 'layer') { if (layers.size >= 16 && !layers.has(c.layer_id)) problems.push(`${path}: too many stage layers`); layers.add(c.layer_id); if (!exists(c.kind === 'still' ? art?.stills : art?.ui, c.art_id)) problems.push(`${path}: unknown stage art ${c.art_id}`); }
      if ((c.op === 'animate' || c.op === 'mask' || c.op === 'remove_layer') && !layers.has(c.layer_id)) problems.push(`${path}: stage layer ${c.layer_id} must be declared first`);
      if (c.op === 'mask') { if (c.shape === 'none') masks.delete(c.layer_id); else masks.add(c.layer_id); if (masks.size > 2) problems.push(`${path}: mask framebuffer budget exceeded`); }
      if (c.op === 'remove_layer') { layers.delete(c.layer_id); masks.delete(c.layer_id); }
    }
    // Definite layer assignment across all reachable branches, including a jump over a declaration.
    const labels = new Map(scene.commands.flatMap((c, i) => c.op === 'label' ? [[c.name, i] as const] : []));
    const incoming = new Map<number, Set<string>>([[0, new Set()]]); const pending = [0];
    while (pending.length) {
      const pc = pending.pop()!; const command = scene.commands[pc]; if (!command) continue;
      const state = new Set(incoming.get(pc)!);
      if (command.op === 'layer') state.add(command.layer_id);
      if (command.op === 'remove_layer') state.delete(command.layer_id);
      const next = command.op === 'end' ? [] : command.op === 'goto' ? [labels.get(command.label)] : command.op === 'choice' ? command.options.map((o) => labels.get(o.goto)) : command.op === 'branch' ? [pc + 1, labels.get(command.goto)] : [pc + 1];
      for (const to of next) if (to !== undefined && to < scene.commands.length) {
        const prior = incoming.get(to); const merged = prior ? new Set([...prior].filter((id) => state.has(id))) : new Set(state);
        if (!prior || merged.size !== prior.size) { incoming.set(to, merged); pending.push(to); }
      }
    }
    for (const [pc, state] of incoming) {
      const command = scene.commands[pc]!;
      if ((command.op === 'animate' || command.op === 'mask' || command.op === 'remove_layer') && !state.has(command.layer_id)) problems.push(`${path}: layer ${command.layer_id} is not declared on every reachable branch`);
      if (command.op === 'layer' && state.size >= 16 && !state.has(command.layer_id)) problems.push(`${path}: reachable layer budget exceeded`);
    }
  }
  if (prologue?.video_id) {
    const video = profile && Object.hasOwn(profile.videos, prologue.video_id) ? profile.videos[prologue.video_id] : undefined;
    if (!video || Math.abs(video.duration_s - prologue.duration_seconds) > 0.01) problems.push('prologue: video must cover the authored duration');
  }
  if (prologue?.voice_status === 'recorded' && prologue.scenes.some((line) => !profile || !Object.hasOwn(profile.voices, line.line_id))) problems.push('prologue: recorded voice requires every Japanese line');
  if (profile) {
    for (const [id, voice] of Object.entries(profile.voices)) { if (!lines.has(id)) problems.push(`voice ${id}: unknown stable line`); if (!files.has(voice.file)) problems.push(`voice ${id}: missing audio`); const shot = prologue?.scenes.find((s) => s.line_id === id); if (shot && voice.duration_s > shot.duration_seconds) problems.push(`voice ${id}: exceeds authored shot duration`); }
    for (const [id, sound] of Object.entries(profile.sounds)) if (!files.has(sound.file)) problems.push(`sound ${id}: missing audio`);
    for (const [id, video] of Object.entries(profile.videos)) {
      if (!files.has(video.file)) problems.push(`video ${id}: missing media`);
      else if (files.get(video.file)!.byteLength > MAX_VIDEO_BYTES) problems.push(`video ${id}: exceeds the 20 MiB per-video budget`);
      if (video.poster_id && !exists(art?.stills, video.poster_id)) problems.push(`video ${id}: unknown poster`);
      for (const cue of video.captions) if (lines.get(cue.line_id) !== cue.text_en) problems.push(`video ${id}: captions differ from their stable English lines`);
    }
    const nodes = new Set(index?.chapters.flatMap((c) => c.nodes.map((n) => n.node_id)) ?? []);
    for (const [id, panel] of Object.entries(profile.panels)) {
      if (panel.after_node && !nodes.has(panel.after_node)) problems.push(`panel ${id}: unknown unlock node`);
      if (panel.image_id && !exists(art?.stills, panel.image_id)) problems.push(`panel ${id}: unknown illustration`);
      for (const [label, limit] of [[panel.title, 80], ...panel.body.map((l) => [l, 600] as const), ...panel.buttons.map((b) => [b.label, 40] as const)] as const) if (label.text_id) { textIds.add(label.text_id); textLimits.set(label.text_id, Math.min(textLimits.get(label.text_id) ?? limit, limit)); }
      for (const button of panel.buttons) if (button.action.type === 'panel') needProfile('panels', button.action.panel_id, `panel ${id}`);
    }
    for (const locale of profile.locales) {
      const pack = parse(`locales/${locale}.json`, LocalePack);
      if (pack) { if (pack.locale !== locale) problems.push(`locale ${locale}: filename identity mismatch`); for (const key of Object.keys(pack.strings)) { if (!textIds.has(key)) problems.push(`locale ${locale}: unknown text ID ${key}`); if (pack.strings[key]!.length > (textLimits.get(key) ?? 600)) problems.push(`locale ${locale}: text exceeds its presentation context budget ${key}`); } }
    }
  }
  if (files.has('schedules/events.json')) {
    const schedule = parse('schedules/events.json', EventSchedule); const library = files.has('library/library_index.json') ? parse('library/library_index.json', NarrativeLibrary) : undefined;
    unique('event schedule', schedule?.events.map((e) => e.entry_id) ?? []);
    for (const event of schedule?.events ?? []) if (!library?.entries.some((e) => e.entry_id === event.entry_id && e.kind === 'event')) problems.push(`event schedule: unknown event entry ${event.entry_id}`);
  }
  if (files.has('schedules/shop.json')) { const schedule = parse('schedules/shop.json', ShopSchedule); unique('shop schedule', schedule?.offers.map((e) => e.product_id) ?? []); }
  if (files.has(VFX_PATH)) {
    const vfx = parse(VFX_PATH, VfxPack);
    const skills = new Set([...units.values()].flatMap((u) => u.skills.map((skill) => skill.skill_id)));
    const isTutorialBaseOnly = units.size <= 4 && units.has('mahmut') && units.has('fadyme');
    for (const skill of Object.keys(vfx?.skills ?? {})) {
      if (skills.has(skill)) continue;
      if (isTutorialBaseOnly && ![...units.keys()].some((u) => skill.startsWith(`${u}_`))) continue;
      problems.push(`vfx: unknown skill ${skill}`);
    }
  }
  if (files.has(WORLD_MAP_PATH)) {
    const map = parse(WORLD_MAP_PATH, WorldMap);
    // a chapter region not in the index is "coming soon"; one in the index must be a real chapter, never the tutorial
    if (map?.background_id && !exists(art?.backgrounds, map.background_id)) problems.push(`world map: unknown background ${map.background_id}`);
    if (map && index) for (const r of map.regions) if (r.chapter_id === 'tutorial') problems.push('world map: the tutorial is not a map region');
  }
  // Every admitted JSON document gets a closed grammar, including unlinked resources.
  for (const path of files.keys()) if (path.endsWith('.json') && !parsedPaths.has(path)) {
    if (path.startsWith('story/')) checkScene(path);
    else if (path.startsWith('encounters/')) checkEncounter(path);
    else problems.push(`unsupported JSON document ${path}`);
  }
  if (problems.length > 0) throw new ContentValidationError(problems);
  return { chapters: index?.chapters.length ?? 0, nodes, units: units.size, scenes };
}
