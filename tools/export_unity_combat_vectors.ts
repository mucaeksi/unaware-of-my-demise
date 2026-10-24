/**
 * Golden combat replays from the authoritative TypeScript engine (@uomd/combat) for the C# port (Uomd.Combat).
 * Every case is a real content battle (base tutorials + every Part I campaign encounter) played by Auto Battle or by a seeded
 * random-but-legal player, with varied seeds, parties, skill ranks, opening Focus, server stats, equipment hooks and
 * synthetic follow-up waves, plus illegal-action replays. The C# EditMode suite replays each case and must reproduce the
 * exact logHash, event count and result (apps/unity/Assets/_UOMD/Tests/EditMode/CombatParityTests.cs).
 * Run: npx tsx tools/export_unity_combat_vectors.ts   (tools/export_unity_combat_vectors.test.ts fails when the file is stale)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BattleParty, Encounter, UnitPack, unitStatsAt } from '../packages/content-schema/src/index.ts';
import { Battle, replayBattle, type PlayerAction } from '../packages/combat/src/index.ts';
import { Rng } from '../packages/shared/src/rng.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const COMBAT_VECTORS_PATH = join(ROOT, 'apps/unity/Assets/_UOMD/Tests/EditMode/combat_vectors.json');
const BASE_PACK = 'content/base/units/unit_pack.json';
const CAMPAIGN_PACK = 'content/patches/rel_0003_part1_campaign/units/unit_pack.json';
const CAMPAIGN_ENCOUNTERS = 'content/patches/rel_0003_part1_campaign/encounters';

type Json = Record<string, unknown>;
const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

export interface CombatCase {
  name: string;
  pack: string;
  encounter: string;
  /** encounter fields replaced before the battle (seed, waves) */
  override?: { seed?: number; waves?: Encounter['waves'] };
  party?: BattleParty;
  actions: PlayerAction[];
  valid: boolean;
  complete: boolean;
  error?: string;
  result: { winner: string; stars: number; turns: number } | null;
  logHash: string;
  eventCount: number;
}

/** A random-but-legal player: any available option, any legal target (seeded, so the case is reproducible). */
function playRandom(pack: UnitPack, encounter: Encounter, seed: number, party?: BattleParty): PlayerAction[] {
  const rng = new Rng(seed);
  const battle = Battle.create(pack, encounter, party);
  const actions: PlayerAction[] = [];
  let step = battle.advance();
  while (!step.result) {
    const options = step.prompt!.options.filter((o) => o.available);
    const o = options[Math.floor(rng.next() * options.length)]!;
    const action: PlayerAction = o.needsTarget ? { skillId: o.skillId, targetId: o.legalTargets[Math.floor(rng.next() * o.legalTargets.length)]! } : { skillId: o.skillId };
    actions.push(action);
    step = battle.act(action);
  }
  return actions;
}

function playAutoActions(pack: UnitPack, encounter: Encounter, party?: BattleParty): PlayerAction[] {
  const battle = Battle.create(pack, encounter, party);
  const actions: PlayerAction[] = [];
  let step = battle.advance();
  while (!step.result) {
    const a = battle.autoAction();
    actions.push(a);
    step = battle.act(a);
  }
  return actions;
}

/** Five heroes rotating through the roster; every few cases they carry server stats, ranks, Focus and their signature echo. */
function rotatingParty(pack: UnitPack, index: number, level: number, hooks: Record<string, unknown>): BattleParty {
  const heroes = pack.units.filter((u) => u.kind === 'character').map((u) => u.unit_id).sort();
  const members = [];
  for (let i = 0; i < 5; i++) {
    const id = heroes[(index * 5 + i) % heroes.length]!;
    const def = pack.units.find((u) => u.unit_id === id)!;
    const member: Json = { unit_id: id, level, slot: i, row: i < 3 ? 'front' : 'rear' };
    if (index % 3 === 1) {
      const st = unitStatsAt(def, level);
      member.stats = {
        hp: Math.round(st.hp * 1.15), atk: Math.round(st.atk * 1.1) + 1, def: Math.round(st.def * 1.1) + 1, spd: Math.max(1, st.spd + (i % 2)),
        ...(st.crit_rate !== undefined ? { crit_rate: Math.min(1, st.crit_rate + 0.05), crit_damage: st.crit_damage, effect_hit: Math.min(1, (st.effect_hit ?? 0) + 0.1) } : {})
      };
      member.skill_ranks = Object.fromEntries(def.skills.slice(0, 2).map((s, k) => [s.skill_id, 2 + (k % 2)]));
      member.start_focus = 20 * i;
    }
    const echo = hooks[`signature_echo_${id}`];
    if (index % 3 === 2 && echo) member.equipment_effects = { version: 1, heal_bonus_pct: 0.1, focus_gain_pct: 0.2, effect_res_pct: 0.15, element_res_pct: { Veil: 0.2, Dawn: -0.1 }, hooks: [echo] };
    members.push(member);
  }
  return BattleParty.parse(members);
}

async function record(name: string, packPath: string, encounterPath: string, override: CombatCase['override'], party: BattleParty | undefined, actions: PlayerAction[]): Promise<CombatCase> {
  const pack = UnitPack.parse(readJson(packPath));
  const encounter = Encounter.parse({ ...(readJson(encounterPath) as Json), ...override });
  const out = await replayBattle(pack, encounter, actions, party);
  return {
    name, pack: packPath, encounter: encounterPath, ...(override ? { override } : {}), ...(party ? { party } : {}), actions,
    valid: out.valid, complete: out.complete, ...(out.error ? { error: out.error } : {}), result: out.result, logHash: out.logHash, eventCount: out.eventCount
  };
}

export async function buildCombatVectors(): Promise<{ generated_by: string; cases: CombatCase[] }> {
  const cases: CombatCase[] = [];
  const basePack = UnitPack.parse(readJson(BASE_PACK));
  for (const t of ['tutorial_t1', 'tutorial_t2', 'tutorial_t3']) {
    const path = `content/base/encounters/${t}.json`;
    const enc = Encounter.parse(readJson(path));
    for (let k = 0; k < 4; k++) {
      const override = k === 0 ? undefined : { seed: (enc.seed + k * 7919) >>> 0 };
      const e = Encounter.parse({ ...enc, ...override });
      cases.push(await record(`${t}/auto/${k}`, BASE_PACK, path, override, undefined, playAutoActions(basePack, e)));
      cases.push(await record(`${t}/random/${k}`, BASE_PACK, path, override, undefined, playRandom(basePack, e, 1000 + k)));
    }
  }

  const campaignPack = UnitPack.parse(readJson(CAMPAIGN_PACK));
  const hooks = (readJson('content/balance/gear_passives.json') as { hooks: Record<string, unknown> }).hooks;
  const files = readdirSync(join(ROOT, CAMPAIGN_ENCOUNTERS)).filter((f) => f.endsWith('.json')).sort();
  for (const [index, file] of files.entries()) {
    const path = `${CAMPAIGN_ENCOUNTERS}/${file}`;
    const enc = Encounter.parse(readJson(path));
    const level = Math.max(...enc.enemies.map((e) => e.level));
    const party = enc.party.length > 0 && index % 2 === 0 ? undefined : rotatingParty(campaignPack, index, level, hooks);
    cases.push(await record(`${file}/auto`, CAMPAIGN_PACK, path, undefined, party, playAutoActions(campaignPack, enc, party)));
    const override = { seed: (enc.seed ^ 0x5bd1e995) >>> 0 };
    const reseeded = Encounter.parse({ ...enc, ...override });
    cases.push(await record(`${file}/random`, CAMPAIGN_PACK, path, override, party, playRandom(campaignPack, reseeded, 77 + index, party)));
  }

  // Follow-up waves (no Part I content uses them yet): three stages gain two extra waves borrowed from later stages.
  for (const [i, file] of ['stage_1_2.json', 'stage_3_4.json', 'stage_6_1.json'].entries()) {
    const path = `${CAMPAIGN_ENCOUNTERS}/${file}`;
    const enc = Encounter.parse(readJson(path));
    const waves = [files[(i * 11 + 20) % files.length]!, files[(i * 13 + 41) % files.length]!].map((f) => (readJson(`${CAMPAIGN_ENCOUNTERS}/${f}`) as Encounter).enemies);
    const override = { waves };
    const e = Encounter.parse({ ...enc, ...override });
    const party = rotatingParty(campaignPack, i + 3, 20, hooks);
    cases.push(await record(`${file}/waves/auto`, CAMPAIGN_PACK, path, override, party, playAutoActions(campaignPack, e, party)));
  }

  // Illegal replays must be rejected with the same log prefix: an action after the end, a wrong target, a target on a no-target skill.
  const t1 = 'content/base/encounters/tutorial_t1.json';
  const won = playAutoActions(basePack, Encounter.parse(readJson(t1)));
  cases.push(await record('illegal/extra_action', BASE_PACK, t1, undefined, undefined, [...won, won[0]!]));
  cases.push(await record('illegal/bad_target', BASE_PACK, t1, undefined, undefined, [{ ...won[0]!, targetId: 'player:9:nobody' }]));
  cases.push(await record('illegal/unknown_skill', BASE_PACK, t1, undefined, undefined, [{ skillId: 'no_such_skill' }]));
  cases.push(await record('incomplete/first_action_only', BASE_PACK, t1, undefined, undefined, won.slice(0, 1)));
  return { generated_by: 'tools/export_unity_combat_vectors.ts', cases };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const vectors = await buildCombatVectors();
  writeFileSync(COMBAT_VECTORS_PATH, `${JSON.stringify(vectors)}\n`, 'utf8');
  const valid = vectors.cases.filter((c) => c.valid).length;
  console.log(`wrote ${vectors.cases.length} combat cases (${valid} valid) -> ${COMBAT_VECTORS_PATH}`);
}
