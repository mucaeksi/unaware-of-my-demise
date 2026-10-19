import { describe, expect, it } from 'vitest';
import { Encounter, UnitPack } from '@uomd/content-schema';
import { buildCharacter, buildEnemy, buildRules } from '../../../tools/lib/data';
import { readJson } from '../../../tools/lib/fsutil';
import { Battle, replayBattle, type BattleEvent, type PlayerAction } from './index';

const NARR = 'narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content';
const characterIds = (readJson<{ characters: { character_id: string }[] }>(`${NARR}/characters_part1.json`).characters).map((c) => c.character_id);
const allEnemies = readJson<{ enemies: { enemy_id: string; boss_id?: string }[] }>(`${NARR}/enemies_part1.json`).enemies;
const enemyIds = allEnemies.filter((e) => !e.boss_id).map((e) => e.enemy_id);
const bossIds = allEnemies.filter((e) => e.boss_id).map((e) => e.enemy_id);

const pack = UnitPack.parse({
  schema_version: 1,
  pack_id: 'roster_test',
  units: [...characterIds.map((c) => buildCharacter(c)), ...enemyIds.map((e) => buildEnemy(e)), ...bossIds.map((e) => buildEnemy(e))],
  rules: buildRules()
});

function encounter(seed: number, party: string[], enemies: string[], partyLevel = 12, enemyLevel = 12): Encounter {
  return Encounter.parse({
    schema_version: 1,
    encounter_id: `roster_${seed}`,
    stage_id: 'X-1',
    title_en: 'roster',
    location_id: 'nowhere',
    seed,
    party: party.map((unit_id, slot) => ({ unit_id, level: partyLevel, slot, row: slot < 2 ? 'front' : 'rear' })),
    enemies: enemies.map((unit_id, slot) => ({ unit_id, level: enemyLevel, slot, row: slot < 2 ? 'front' : 'rear' })),
    provenance: { source: 'test' }
  });
}

/** Exercises every skill: ultimates first, then actives, then basics (so nothing is left untested by the Auto Battle policy). */
function play(enc: Encounter, startFocus = 0): { battle: Battle; actions: PlayerAction[] } {
  const battle = Battle.create(pack, enc);
  for (const c of battle.living('player')) c.focus = startFocus;
  const actions: PlayerAction[] = [];
  let step = battle.advance();
  while (!step.result) {
    const prompt = step.prompt;
    if (!prompt) throw new Error('stalled');
    const options = prompt.options.filter((o) => o.available);
    const pick = options.find((o) => o.type === 'ultimate') ?? options.find((o) => o.type === 'active') ?? options.find((o) => o.type === 'basic');
    if (!pick) throw new Error('no usable skill');
    const first = [...pick.legalTargets].sort()[0];
    const action: PlayerAction = pick.needsTarget ? { skillId: pick.skillId, targetId: first as string } : { skillId: pick.skillId };
    actions.push(action);
    step = battle.act(action);
  }
  return { battle, actions };
}

describe('the full playable roster and the regular enemies run in the engine', () => {
  const used = new Set<string>();
  const hooks = new Set<string>();
  const battles: { enc: Encounter; actions: PlayerAction[]; log: BattleEvent[] }[] = [];

  it('every character and enemy can fight: 5v5 rotations finish without errors', () => {
    const groups = Math.ceil(characterIds.length / 5);
    for (let i = 0; i < 40; i++) {
      const party = Array.from({ length: 5 }, (_, k) => characterIds[((i % groups) * 5 + k) % characterIds.length] as string);
      const foes = Array.from({ length: 5 }, (_, k) => enemyIds[(i * 3 + k * 4) % enemyIds.length] as string);
      if (new Set(party).size < 5) continue;
      const boosted = i % (groups * 2) >= groups;
      // boosted rotations also fight a stronger enemy line (D-27 enemies hit hard enough at +8 levels to drop a slow front-liner before her turn, so +4)
      const enc = boosted ? encounter(1000 + i, party, foes, 10, 14) : encounter(1000 + i, party, foes); // half of the rotations open with full Focus so every Ultimate is exercised; the rest are replayable as-is
      const { battle, actions } = play(enc, boosted ? 100 : 0);
      expect(battle.result).not.toBeNull();
      if (!boosted) battles.push({ enc, actions, log: [...battle.log] });
      for (const e of battle.log) {
        if (e.type === 'skill_used') used.add(e.skill);
        if (e.type === 'hook_triggered') hooks.add(e.skill);
      }
    }
    expect(battles.length).toBeGreaterThan(8);
  });

  it('each battle replays to the identical log (determinism with every new rule in play)', async () => {
    for (const b of battles.slice(0, 8)) {
      const a = await replayBattle(pack, b.enc, b.actions);
      const c = await replayBattle(pack, b.enc, b.actions);
      expect(a.valid).toBe(true);
      expect(a.logHash).toBe(c.logHash);
    }
  });

  it("Clem's Keep the Names follows its text (any allied attack), not the owner-only scope of the raw data", () => {
    const clem = pack.units.find((u) => u.unit_id === 'clem_marr');
    const hook = clem?.skills.flatMap((k) => k.event_hooks ?? []).find((h) => h.event === 'before_damage_dealt');
    expect(hook?.event_filter?.team).toBe('player');
  });

  it('actions of every playable character were exercised', () => {
    const missing: string[] = [];
    for (const u of pack.units) for (const s of u.skills) if (s.type !== 'passive' && u.kind === 'character' && !used.has(s.skill_id)) missing.push(s.skill_id);
    expect(missing).toEqual([]);
  });

  it('the engine reports which passives never fired (informational floor: most of them do)', () => {
    const passives = pack.units.flatMap((u) => u.skills.filter((s) => s.event_hooks?.length).map((s) => s.skill_id));
    const fired = passives.filter((id) => hooks.has(id));
    console.log('NOFIRE', passives.filter((id) => !hooks.has(id)).join(' '));
    expect(fired.length).toBeGreaterThan(passives.length / 3);
  });
});

describe('the seven story bosses', () => {
  const team = ['mahmut', 'brin_alder', 'fadyme', 'sister_aveline', 'kera_voss'];

  for (const boss of bossIds) {
    it(`${boss}: fights through its phases, objectives and telegraphs, finishes and replays identically`, async () => {
      const enc = Encounter.parse({
        schema_version: 1,
        encounter_id: `boss_${boss}`,
        stage_id: 'X-5',
        title_en: boss,
        location_id: 'nowhere',
        seed: 4242,
        party: team.map((unit_id, slot) => ({ unit_id, level: 14, slot, row: slot < 2 ? 'front' : 'rear' })),
        enemies: [{ unit_id: boss, level: 12, slot: 0, row: 'front' }],
        provenance: { source: 'test' }
      });
      const { battle, actions } = play(enc);
      expect(battle.result).not.toBeNull();
      const phases = battle.log.filter((e) => e.type === 'phase_change');
      expect(phases.length).toBeGreaterThanOrEqual(1);
      expect(battle.log.some((e) => e.type === 'telegraph')).toBe(true);
      if (battle.result?.winner === 'player') expect(phases).toHaveLength(2);
      const again = await replayBattle(pack, enc, actions);
      expect(again.valid).toBe(true);
      expect(again.result).toEqual(battle.result);
    });
  }
});
