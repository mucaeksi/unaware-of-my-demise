import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ContentValidationError, validateContentSet, type ChapterIndex, type Encounter, type UnitPack, type NarrativeLibrary } from './index';

const ROOT = fileURLToPath(new URL('../../../content/', import.meta.url));
const walk = (dir: string, rel = ''): string[] =>
  readdirSync(join(dir, rel)).flatMap((n) => {
    const r = rel ? `${rel}/${n}` : n;
    return statSync(join(dir, r)).isDirectory() ? walk(dir, r) : [r];
  });
// read each tree from disk once (content/base carries ~23 MB of voice/music; re-reading it per test timed out on a
// synced Drive folder) and hand every test fresh copies so in-place edits cannot leak between tests
const disk = new Map<string, [string, Uint8Array][]>();
const load = (dir: string): Map<string, Uint8Array> => {
  let files = disk.get(dir);
  if (!files) disk.set(dir, (files = walk(dir).filter((p) => p !== 'release.json').map((p) => [p, new Uint8Array(readFileSync(join(dir, p)))])));
  return new Map(files.map(([p, bytes]) => [p, new Uint8Array(bytes)]));
};

/** the base release alone: the first-install flow (prologue + tutorials T-1..T-3) */
const overlay = (): Map<string, Uint8Array> => load(join(ROOT, 'base'));
const campaign = (): Map<string, Uint8Array> => {
  const m = load(join(ROOT, 'base'));
  for (const [k, v] of load(join(ROOT, 'patches/rel_0003_part1_campaign'))) m.set(k, v);
  return m;
};
const enc = new TextEncoder();
const edit = <T>(files: Map<string, Uint8Array>, path: string, change: (value: T) => void): void => {
  const value = JSON.parse(new TextDecoder().decode(files.get(path))) as T;
  change(value);
  files.set(path, enc.encode(JSON.stringify(value)));
};

describe('validateContentSet', () => {
  it.each(['duplicate entry', 'unknown stage', 'story stage', 'missing owner', 'unknown owner', 'part order', 'cycle', 'unknown previous', 'hash', 'scene hash', 'coverage', 'cross-main line', 'art', 'op'] as const)('rejects library %s', (kind) => {
    const files = campaign();
    edit<NarrativeLibrary>(files, 'library/library_index.json', (library) => {
      const entry = library.entries.find((entry) => entry.entry_id === 'cs_kera_voss_2')!;
      if (kind === 'duplicate entry') library.entries.push(structuredClone(entry));
      if (kind === 'unknown stage') entry.gate.after_node = 'stage_99_1';
      if (kind === 'story stage') entry.gate.after_node = 'ch1_first_oath';
      if (kind === 'missing owner') delete entry.gate.owned_character;
      if (kind === 'unknown owner') entry.gate.owned_character = 'unknown_hero';
      if (kind === 'part order') entry.part = 99;
      if (kind === 'cycle') entry.gate.after_entry = entry.entry_id;
      if (kind === 'unknown previous') entry.gate.after_entry = 'unknown_reading';
      if (kind === 'hash') entry.provenance.source_sha256 = '0'.repeat(64);
      if (kind === 'scene hash') entry.scenes[0]!.provenance.source_sha256 = '0'.repeat(64);
      if (kind === 'coverage') entry.line_ids.pop();
      if (kind === 'cross-main line') { const main = JSON.parse(new TextDecoder().decode(files.get('story/opening_sad_scene.json'))).commands.find((command: { op: string }) => command.op === 'say'); const say = entry.scenes[0]!.commands.find((command) => command.op === 'say')!; if (say.op === 'say') { say.line_id = main.line_id; entry.line_ids[0] = say.line_id; } }
      if (kind === 'art') entry.scenes[0]!.commands.push({ op: 'background', location_id: 'missing_location' });
      if (kind === 'op') (entry.scenes[0]!.commands as unknown[]).push({ op: 'eval', script: 'downloaded code' });
    });
    expect(() => validateContentSet(files)).toThrow();
  });
  it('accepts the base release', () => {
    expect(validateContentSet(load(join(ROOT, 'base')))).toMatchObject({ nodes: 3, units: 4 });
  });
  it('accepts base + the Part I campaign (35 stages, the full cast, placeholder art) as one effective set', () => {
    expect(validateContentSet(campaign())).toMatchObject({ chapters: 8, nodes: 54, units: 52 }); // 25 heroes, 20 enemies, 7 bosses
  });
  it.each(['duplicate item', 'duplicate choice', 'unknown hero', 'wrong rarity', 'battle gate', 'story gate', 'source hash'] as const)('rejects recruit selector %s', (kind) => {
    const files = campaign();
    edit<ChapterIndex>(files, 'chapters/chapter_index.json', (index) => {
      const selector = index.recruit_selectors![0]!;
      if (kind === 'duplicate item') index.recruit_selectors!.push(structuredClone(selector));
      if (kind === 'duplicate choice') selector.choices.push(selector.choices[0]!);
      if (kind === 'unknown hero') selector.choices[0] = 'unknown_hero';
      if (kind === 'wrong rarity') selector.choices[0] = 'mahmut';
      if (kind === 'battle gate') selector.after_node = 'ch1_first_oath';
      if (kind === 'story gate') selector.scene_node = 'stage_1_3';
      if (kind === 'source hash') selector.provenance.source_sha256 = '0'.repeat(64);
    });
    expect(() => validateContentSet(files)).toThrow(/selector/);
  });
  it.each(['entry omission', 'chapter order', 'gate removal', 'scene link', 'line removal', 'line order', 'source hash', 'phase', 'boss', 'duplicate phase'] as const)('rejects canonical story %s before publication', (kind) => {
    const files = campaign();
    if (['entry omission', 'chapter order', 'gate removal', 'scene link'].includes(kind)) edit<ChapterIndex>(files, 'chapters/chapter_index.json', (index) => {
      if (kind === 'entry omission') index.story_coverage!.entries.pop();
      if (kind === 'chapter order') index.chapters.reverse();
      if (kind === 'gate removal') delete index.chapters[1]!.nodes[1]!.requires;
      if (kind === 'scene link') index.chapters[1]!.nodes[0]!.story = 'story/ch1_camp.json';
    });
    if (['line removal', 'line order', 'source hash'].includes(kind)) {
      const scene = JSON.parse(new TextDecoder().decode(files.get('story/opening_sad_scene.json')));
      if (kind === 'line removal') scene.commands.splice(scene.commands.findIndex((command: { op: string }) => command.op === 'say'), 1);
      if (kind === 'line order') { const lines = scene.commands.filter((command: { op: string }) => command.op === 'say'); [lines[0].line_id, lines[1].line_id] = [lines[1].line_id, lines[0].line_id]; }
      if (kind === 'source hash') scene.provenance.source_sha256 = '0'.repeat(64);
      files.set('story/opening_sad_scene.json', enc.encode(JSON.stringify(scene)));
    }
    if (['phase', 'boss', 'duplicate phase'].includes(kind)) edit<Encounter>(files, 'encounters/stage_7_5.json', (encounter) => {
      if (kind === 'phase') encounter.phase_stories![0]!.phase_id = 'missing_phase';
      if (kind === 'boss') encounter.phase_stories![0]!.unit_id = 'mahmut';
      if (kind === 'duplicate phase') encounter.phase_stories!.push(structuredClone(encounter.phase_stories![0]!));
    });
    expect(() => validateContentSet(files)).toThrow(/story coverage|boss phase|phase story binding/);
  });
  it.each(['unit', 'skill', 'status', 'phase', 'objective'] as const)('rejects duplicate %s identities across the effective unit pack', (kind) => {
    const files = campaign();
    edit<UnitPack>(files, 'units/unit_pack.json', (pack) => {
      if (kind === 'unit') pack.units.push(structuredClone(pack.units[0]!));
      if (kind === 'skill') pack.units[1]!.skills.push(structuredClone(pack.units[0]!.skills[0]!));
      if (kind === 'status') pack.rules.statuses.push(structuredClone(pack.rules.statuses[0]!));
      const phases = pack.units.flatMap((unit) => unit.boss?.phases ?? []);
      if (kind === 'phase') pack.units.find((unit) => unit.boss)!.boss!.phases.push({ ...structuredClone(phases[0]!), objectives: [] });
      if (kind === 'objective') {
        const phase = phases.find((phase) => phase.objectives.length > 0)!;
        phase.objectives.push(structuredClone(phase.objectives[0]!));
      }
    });
    expect(() => validateContentSet(files)).toThrow(new RegExp(`duplicate ${kind} `));
  });
  it.each(['chapter', 'node'] as const)('rejects duplicate %s identities across chapters', (kind) => {
    const files = campaign();
    edit<ChapterIndex>(files, 'chapters/chapter_index.json', (index) => {
      const first = index.chapters[0]!;
      index.chapters.push({ chapter_id: kind === 'chapter' ? first.chapter_id : 'duplicate_node_chapter', title_en: 'Duplicate fixture',
        nodes: [{ ...structuredClone(first.nodes[0]!), ...(kind === 'chapter' ? { node_id: 'unique_cloned_node' } : {}) }] });
    });
    expect(() => validateContentSet(files)).toThrow(new RegExp(`duplicate ${kind} `));
  });
  it.each(['self', 'same chapter', 'cross chapter'] as const)('rejects a %s prerequisite cycle', (kind) => {
    const files = campaign();
    edit<ChapterIndex>(files, 'chapters/chapter_index.json', (index) => {
      const first = index.chapters[0]!.nodes[0]!;
      const second = kind === 'self' ? first : kind === 'same chapter' ? index.chapters[0]!.nodes[1]! : index.chapters[1]!.nodes[0]!;
      first.requires = second.node_id;
      second.requires = first.node_id;
    });
    expect(() => validateContentSet(files)).toThrow(/prerequisite cycle/);
  });
  it('accepts acyclic cross-chapter prerequisites regardless of chapter order', () => {
    const files = campaign();
    edit<ChapterIndex>(files, 'chapters/chapter_index.json', (index) => { delete index.story_coverage; index.chapters.reverse(); });
    expect(validateContentSet(files)).toMatchObject({ chapters: 8, nodes: 54 });
  });
  it.each(['party slot', 'enemy slot', 'hero', 'guest'] as const)('rejects repeated %s declarations without changing valid enemy copies', (kind) => {
    const files = campaign();
    const path = kind === 'guest' ? 'encounters/stage_1_2.json' : 'encounters/tutorial_t3.json';
    edit<Encounter>(files, path, (encounter) => {
      if (kind === 'party slot') encounter.party[1]!.slot = encounter.party[0]!.slot;
      if (kind === 'enemy slot') encounter.enemies[1]!.slot = encounter.enemies[0]!.slot;
      if (kind === 'hero') encounter.party[1]!.unit_id = encounter.party[0]!.unit_id;
      if (kind === 'guest') encounter.guests!.push(encounter.guests![0]!);
    });
    expect(() => validateContentSet(files)).toThrow(/duplicate (slot|unit|guest)/);
  });
  it.each(['party', 'enemies', 'guests', 'summon'] as const)('rejects a known unit of the wrong kind in %s', (side) => {
    const files = campaign();
    if (side === 'summon') edit<UnitPack>(files, 'units/unit_pack.json', (pack) => {
      pack.units[0]!.skills[0]!.effect_ops.push({ op: 'summon_enemies', target_selector_id: 'self', enemy_id: 'mahmut', count: 1 });
    });
    else edit<Encounter>(files, side === 'guests' ? 'encounters/stage_1_2.json' : 'encounters/tutorial_t3.json', (encounter) => {
      if (side === 'guests') encounter.guests = ['bellbound_dead'];
      else encounter[side][0]!.unit_id = side === 'party' ? 'bellbound_dead' : 'mahmut';
    });
    expect(() => validateContentSet(files)).toThrow(/must be (a character|an enemy)/);
  });
  it('retains repeated enemy types, per-side slots, T-3 rows and the six-person canonical guest list', () => {
    const files = campaign();
    const tutorial = JSON.parse(new TextDecoder().decode(files.get('encounters/tutorial_t3.json'))) as Encounter;
    expect(tutorial.party[0]!.slot).toBe(tutorial.enemies[0]!.slot);
    expect(tutorial.enemies.filter((member) => member.row === 'front')).toHaveLength(3);
    expect(tutorial.enemies.filter((member) => member.unit_id === 'bellbound_dead')).toHaveLength(2);
    const finalApproach = JSON.parse(new TextDecoder().decode(files.get('encounters/stage_7_4.json'))) as Encounter;
    expect(finalApproach.guests).toHaveLength(6);
    expect(validateContentSet(files)).toMatchObject({ nodes: 54 });
  });
  it.each(['intent', 'signature', 'unit immunity', 'boss preservation', 'status immunity'] as const)('rejects an undefined %s reference', (kind) => {
    const files = campaign();
    edit<UnitPack>(files, 'units/unit_pack.json', (pack) => {
      if (kind === 'intent') pack.units[0]!.intent_skill_id = 'missing_skill';
      if (kind === 'signature') pack.units.find((unit) => unit.boss)!.boss!.phases[0]!.signature_action_id = 'missing_skill';
      if (kind === 'unit immunity') pack.units[0]!.status_immunities = ['missing_status'];
      if (kind === 'boss preservation') pack.units.find((unit) => unit.boss)!.boss!.preserve_status_ids = ['missing_status'];
      if (kind === 'status immunity') pack.rules.statuses[0]!.immune_status_ids = ['missing_status'];
    });
    expect(() => validateContentSet(files)).toThrow(/missing_(status|skill)/);
  });
  it.each(['operation', 'damage modifier', 'skill hook', 'unit hook', 'skill modifier', 'unit modifier'] as const)('rejects undefined status predicates in a nested %s condition', (where) => {
    const files = campaign();
    edit<UnitPack>(files, 'units/unit_pack.json', (pack) => {
      const unit = pack.units[0]!; const skill = unit.skills[0]!;
      const condition = { all: [{ predicate: 'owner_hp_below_pct' as const, value: 50 }, { any: [{ predicate: 'owner_has_status' as const, value: 'missing_status' }] }] };
      if (where === 'operation') skill.effect_ops[0]!.when = condition;
      if (where === 'damage modifier') skill.effect_ops.push({ op: 'damage', target_selector_id: 'single_enemy', damage_type: 'physical', scale_stat: 'atk', multiplier: 1, modifiers: [{ condition, multiplier: 1 }] });
      const hook = { event: 'owner_turn_start' as const, condition, effect_ops: [{ op: 'gain_focus' as const, target_selector_id: 'self' as const, amount: 1 }] };
      if (where === 'skill hook') skill.event_hooks = [hook];
      if (where === 'unit hook') unit.passive_hooks = [hook];
      const modifier = { event: 'stat_snapshot' as const, condition, target: 'self' as const, stat_id: 'atk' as const, mode: 'add_pct' as const, amount: 0.1 };
      if (where === 'skill modifier') skill.continuous_modifiers = [modifier];
      if (where === 'unit modifier') unit.continuous_modifiers = [modifier];
    });
    expect(() => validateContentSet(files)).toThrow(/unknown status missing_status/);
  });
  it.each(['last_target_has_status', 'owner_has_status', 'target_has_status', 'event_target_had_status', 'count_enemies_with_status', 'target_has_status_tag', 'target_has_any_status_tag'] as const)('rejects undefined %s predicate identities', (predicate) => {
    const files = campaign();
    edit<UnitPack>(files, 'units/unit_pack.json', (pack) => {
      pack.units[0]!.skills[0]!.effect_ops[0]!.when = { predicate, value: predicate === 'target_has_any_status_tag' ? 'mark_or_ghost' : 'missing_status' };
    });
    expect(() => validateContentSet(files)).toThrow(/unknown status( tag)? (missing_status|ghost)/);
  });
  it('rejects a campaign stage that names a guest the unit pack does not contain', () => {
    const m = campaign();
    const bad = JSON.parse(new TextDecoder().decode(m.get('encounters/stage_1_2.json')));
    bad.guests = ['ghost_hero'];
    m.set('encounters/stage_1_2.json', enc.encode(JSON.stringify(bad)));
    expect(() => validateContentSet(m)).toThrow(/unknown guest ghost_hero/);
  });
  it('rejects an encounter whose enemy unit does not exist', () => {
    const m = overlay();
    const bad = JSON.parse(new TextDecoder().decode(m.get('encounters/tutorial_t2.json')));
    bad.enemies[0].unit_id = 'ghost_unit';
    m.set('encounters/tutorial_t2.json', enc.encode(JSON.stringify(bad)));
    expect(() => validateContentSet(m)).toThrow(ContentValidationError);
  });
  it('rejects a chapter node whose encounter file is absent', () => {
    const m = overlay();
    m.delete('encounters/tutorial_t2.json');
    expect(() => validateContentSet(m)).toThrow(/missing file encounters\/tutorial_t2.json/);
  });
  it('rejects unknown effect ops smuggled in a unit pack', () => {
    const m = overlay();
    const pack = JSON.parse(new TextDecoder().decode(m.get('units/unit_pack.json')));
    pack.units[0].skills[0].effect_ops.push({ op: 'run_script', code: 'alert(1)' });
    m.set('units/unit_pack.json', enc.encode(JSON.stringify(pack)));
    expect(() => validateContentSet(m)).toThrow(ContentValidationError);
  });
  it('rejects boss references that point nowhere: summons of unknown units, objectives no phase defines', () => {
    const m = overlay();
    const pack = JSON.parse(new TextDecoder().decode(m.get('units/unit_pack.json')));
    pack.units[0].skills[0].effect_ops.push({ op: 'summon_enemies', target_selector_id: 'self', enemy_id: 'ghost_unit', count: 1 });
    m.set('units/unit_pack.json', enc.encode(JSON.stringify(pack)));
    expect(() => validateContentSet(m)).toThrow(/summons unknown unit ghost_unit/);
    const pack2 = JSON.parse(new TextDecoder().decode(overlay().get('units/unit_pack.json')));
    pack2.units[0].skills[0].telegraph = { player_actions_before_resolution: 1, interrupt_if_objective_destroyed: 'no_such_bell' };
    const m2 = overlay();
    m2.set('units/unit_pack.json', enc.encode(JSON.stringify(pack2)));
    expect(() => validateContentSet(m2)).toThrow(/no_such_bell/);
  });
  it('rejects an entry index that points at a missing or broken tutorial stage, and a prologue whose timing does not add up', () => {
    const m = overlay();
    m.delete('encounters/tutorial_t3.json');
    expect(() => validateContentSet(m)).toThrow(/missing file encounters\/tutorial_t3.json/);
    const m2 = overlay();
    const prologue = JSON.parse(new TextDecoder().decode(m2.get('entry/prologue.json')));
    prologue.scenes[0].duration_seconds += 3;
    m2.set('entry/prologue.json', enc.encode(JSON.stringify(prologue)));
    expect(() => validateContentSet(m2)).toThrow(/scene durations add up/);
    const m3 = overlay();
    const entry = JSON.parse(new TextDecoder().decode(m3.get('entry/entry_index.json')));
    entry.tutorial.push({ stage_id: 't1', encounter: 'encounters/tutorial_t1.json' });
    m3.set('entry/entry_index.json', enc.encode(JSON.stringify(entry)));
    expect(() => validateContentSet(m3)).toThrow(/duplicate stage t1/);
  });
  it('rejects art that points at a file the release does not contain', () => {
    const m = overlay();
    m.delete('art/atlas_hollow_pilgrim.webp');
    expect(() => validateContentSet(m)).toThrow(/missing file art\/atlas_hollow_pilgrim.webp/);
  });
});
