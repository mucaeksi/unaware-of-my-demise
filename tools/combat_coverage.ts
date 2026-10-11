/**
 * How much of the narrative cast the combat engine can run. A unit counts as supported when every skill, hook and
 * modifier it names passes the closed effect grammar (the same check the content build and the server publish gate use).
 * Bosses additionally need their phase machinery (phases, objectives, telegraphs), which is reported separately.
 * Run: npx tsx tools/combat_coverage.ts
 */
import { buildCharacter, buildEnemy, buildRules } from './lib/data';
import { readJson } from './lib/fsutil';

const NARR = 'narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content';
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const chars = readJson<Json>(`${NARR}/characters_part1.json`).characters as Json[];
const enemies = readJson<Json>(`${NARR}/enemies_part1.json`).enemies as Json[];

const failures: string[] = [];
const count = (label: string, ids: string[], build: (id: string) => unknown, skills: (id: string) => number): void => {
  let ok = 0;
  let skillsOk = 0;
  let skillsAll = 0;
  for (const id of ids) {
    skillsAll += skills(id);
    try {
      build(id);
      ok++;
      skillsOk += skills(id);
    } catch (e) {
      failures.push(`${label} ${id}: ${(e instanceof Error ? e.message : String(e)).replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
  console.log(`${label}: ${ok}/${ids.length} units, ${skillsOk}/${skillsAll} skills`);
};

buildRules();
console.log('rules: ok');
count('characters', chars.map((c) => c.character_id), buildCharacter, (id) => (chars.find((c) => c.character_id === id)?.skills as Json[]).length);
const regular = enemies.filter((e) => !e.boss_id);
const bosses = enemies.filter((e) => e.boss_id);
count('enemies (regular)', regular.map((e) => e.enemy_id), buildEnemy, (id) => (regular.find((e) => e.enemy_id === id)?.skills as Json[]).length);
count('bosses (skills only)', bosses.map((e) => e.enemy_id), buildEnemy, (id) => (bosses.find((e) => e.enemy_id === id)?.skills as Json[]).length);
console.log(`boss phases modelled: ${bosses.filter((b) => (b.phases as Json[]).every((p) => !(p.objectives as Json[]).length && !(p.enter_ops as Json[]).length && !(p.passive_ops as Json[]).length)).length}/${bosses.length} (objectives, enter/passive ops and telegraphs need the boss machinery)`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.some((f) => !f.startsWith('bosses')) ? 1 : 0);
