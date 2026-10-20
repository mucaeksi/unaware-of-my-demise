/**
 * Progression pace probe: a day-by-day simulation of a no-gacha, no-ad player through Part I with the seeded rules.
 * It answers "on day N, what level is the team and which stage can it clear?" — the missing link between the campaign
 * balance probe (one level per stage) and the token-only chronological simulator.
 *
 * Player model (two sessions a day, 12 h apart): claim the daily supplies and the AFK patrol (12 h cap), spend Ration on the
 * next stage (a loss costs nothing, canon) and then on repeats of the furthest cleared stage, complete the window errands,
 * spend every XP book on the owned heroes (lowest level first) within the level cap, pay the level fees, and ascend when
 * the account level, materials and fee allow. Battles are real: the next stage is played with the engine's Auto policy.
 *
 * Assumptions (stated in the report): owned heroes wear a 3★ weapon and padded armor kept at their level (gear XP is cheap);
 * story loans keep the stage level with level-1 3★ loan gear; no gacha, no ads, no subscription; weekly segments are paid
 * when their objective count is met inside the segment; drops use the seeded tables and a fixed seed.
 * Run: npx tsx tools/progression_probe.ts [days]   -> docs/combat/PROGRESSION_PACE.md
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { playAuto } from '../packages/combat/src/index';
import { BattleParty, Encounter, UnitPack } from '../packages/content-schema/src/index';
import {
  afkYield,
  aggregateGear,
  applyCharacterXp,
  attributeStats,
  accountLevelFromXp,
  characterLevelCap,
  characterLevelFee,
  DropConfig,
  ProgressionConfig,
  rollEntries,
  type GearPiece,
  type GearStats,
  type Granted
} from '../packages/economy/src/index';
import { Rng } from '../packages/shared/src/index';
import { armorStats, balanceAttributes, ROLE_STAT, weaponStats } from './lib/balance';
import { readJson, writeOut } from './lib/fsutil';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const NARR = 'narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content';
const PATCH = 'content/patches/rel_0003_part1_campaign';
const DAYS = Number(process.argv[2] ?? 90);

// shortcut: the seeded game_config rows are read back from the generated SQL; read the composed catalog instead once one is committed
const sql = readFileSync('apps/api/seed/catalog.sql', 'utf8');
const seeded = (key: string): Json => {
  const m = new RegExp(`VALUES \\('${key}', '(.*?)'\\);`).exec(sql);
  if (!m) throw new Error(`game_config ${key} missing from apps/api/seed/catalog.sql`);
  return JSON.parse(m[1]!.replace(/''/g, "'")) as Json;
};
const cfg = ProgressionConfig.parse(seeded('progression'));
const drops = DropConfig.parse(seeded('drops'));
const tasks = seeded('tasks');

const XP_ITEMS: Record<string, number> = Object.fromEntries((readJson<Json>(`${NARR}/items_part1.json`).items as Json[]).filter((i) => i.kind === 'character_xp').map((i) => [i.item_id, i.xp_value]));
const chars = new Map((readJson<Json>(`${NARR}/characters_part1.json`).characters as Json[]).map((c) => [c.character_id as string, c]));
const stages = (readJson<Json>(`${NARR}/chapters_part1.json`).chapters as Json[]).flatMap((ch) => (ch.nodes as Json[]).map((n) => (readJson<Json>(`${NARR}/stages_part1.json`).stages as Json[]).find((s) => s.stage_id === n.stage_id) as Json));
const pack = UnitPack.parse(readJson(join(PATCH, 'units/unit_pack.json')));
const encounter = (stageId: string): Encounter => Encounter.parse(readJson(join(PATCH, 'encounters', `stage_${stageId.replace('-', '_')}.json`)));

// ---- gear and parties (same conventions as the campaign probe)
const weapons = readJson<Json>(`${NARR}/weapons_part1.json`).weapons as Json[];
const padded3 = (readJson<Json>(`${NARR}/armors_part1.json`).armors as Json[]).find((a) => a.armor_id === 'armor_padded_3_01') as Json;
const roleStat = (role: string): string => ROLE_STAT.roleStat[(Object.keys(ROLE_STAT.roleStat).find((k) => k !== 'default' && role.includes(k)) ?? 'default') as keyof typeof ROLE_STAT.roleStat];
const gear3 = (c: Json, gearLevel: number): GearStats => {
  const weapon = weapons.filter((w) => w.rarity === 3 && w.weapon_type === c.equip_weapon_type).sort((x, y) => String(x.weapon_id).localeCompare(String(y.weapon_id)))[0];
  const pieces: GearPiece[] = [{ slot: 'armor', setId: null, level: gearLevel, ascension: 0, ...armorStats(padded3) }];
  if (weapon) pieces.push({ slot: 'weapon', setId: null, level: gearLevel, ascension: 0, ...weaponStats(weapon as never) });
  return aggregateGear(cfg, pieces, roleStat(c.combat_role), {});
};
const member = (id: string, level: number, gearLevel: number, loan: boolean): BattleParty[number] => {
  const c = chars.get(id)!;
  const { attributes: _shown, ...stats } = attributeStats(balanceAttributes(id, c.rarity)!, level, gear3(c, gearLevel));
  return { unit_id: id, level, slot: 0, row: c.formation_affinity === 'front' ? 'front' : 'rear', stats, ...(loan ? { loan: true } : {}) };
};

// ---- player state
interface Hero { level: number; xp: number; ascension: number }
const heroes = new Map<string, Hero>([['mahmut', { level: 1, xp: 0, ascension: 0 }], ['fadyme', { level: 1, xp: 0, ascension: 0 }]]);
const bag = new Map<string, number>();
let tokens = 0;
let accountXp = 0;
let ration = 100;
let cleared = 0; // stages cleared so far, in story order
let xpWasted = 0;
/** character XP items are pooled as XP (the real game keeps them as books until spent; the total is the same) */
let xpBank = 0;
const rng = new Rng(20261020);
const roll = (): number => rng.next();
const noPools = { gear: () => [] as string[], bossSet: () => [] as string[] };
const add = (id: string, n: number): void => void bag.set(id, (bag.get(id) ?? 0) + n);
const grant = (g: Granted[]): void => {
  for (const x of g) {
    if (x.type === 'currency') tokens += x.amount;
    else if (x.type === 'account_xp') accountXp += x.amount;
    else if (x.type === 'item' && XP_ITEMS[x.itemId]) xpBank += XP_ITEMS[x.itemId]! * x.quantity;
    else if (x.type === 'item') add(x.itemId, x.quantity);
  }
};
const reward = (rs: Json[]): void => grant(rs.map((r) => (r.type === 'currency' ? { type: 'currency', currency: 'eclipse_token', amount: r.amount } : r.type === 'account_xp' ? { type: 'account_xp', amount: r.amount } : { type: 'item', itemId: r.itemId, quantity: r.quantity })) as Granted[]);
const accountLevel = (): number => accountLevelFromXp(cfg, accountXp).level;

function winnable(stageIdx: number): boolean {
  const st = stages[stageIdx]!;
  const enc = encounter(st.stage_id);
  if (enc.party_mode === 'fixed') return true;
  const guests = (enc.guests ?? []).slice(0, 5);
  const team = [...guests, ...[...heroes.keys()].filter((h) => !guests.includes(h))].slice(0, 5);
  const draft = team.map((id) => (heroes.has(id) && !guests.includes(id) ? member(id, heroes.get(id)!.level, heroes.get(id)!.level, false) : member(id, st.recommended_level, 1, true)));
  const front = draft.filter((m) => m.row === 'front').slice(0, 2);
  const rest = draft.filter((m) => !front.includes(m));
  const party = BattleParty.parse([...front.map((m, i) => ({ ...m, slot: i, row: 'front' as const })), ...rest.map((m, i) => ({ ...m, slot: front.length + i, row: 'rear' as const }))]);
  let wins = 0;
  for (let k = 0; k < 3; k++) if (playAuto(pack, Encounter.parse({ ...enc, seed: (enc.seed + k * 7919) >>> 0 }), party).battle.result?.winner === 'player') wins++;
  return wins >= 2;
}

const farmStage = (): number => {
  for (let i = cleared - 1; i >= 1; i--) if (stages[i]!.node_type !== 'boss') return i;
  return Math.max(1, cleared - 1);
};

function clearStage(idx: number, first: boolean): void {
  const st = stages[idx]!;
  const table = drops.tables[st.drop_table_id as string];
  if (table) grant(rollEntries(first ? [...table.firstClear, ...table.repeat] : table.repeat, roll, noPools));
  if (first) for (const r of st.story_rewards as Json[]) {
    if (r.recruit_character_id && !heroes.has(r.recruit_character_id)) heroes.set(r.recruit_character_id, { level: 1, xp: 0, ascension: 0 });
    if (r.grant_item_id) add(r.grant_item_id, 1);
  }
}

/** spend XP books (largest first) on the lowest hero; pay level fees; ascend when allowed. Returns level-ups done. */
function growHeroes(): number {
  let levelUps = 0;
  for (let guard = 0; guard < 200; guard++) {
    const order = [...heroes.entries()].sort((a, b) => a[1].level - b[1].level || a[1].xp - b[1].xp);
    let progressed = false;
    for (const [, h] of order) {
      const cap = characterLevelCap(cfg, h.ascension, accountLevel());
      if (h.level >= cap) {
        // ascend when at the ascension cap and the next step is affordable
        const step = cfg.character.ascension[h.ascension + 1];
        if (step && h.level >= characterLevelCap(cfg, h.ascension, 10_000) && accountLevel() >= step.accountLevel && tokens >= step.fee && step.items.every((i) => (bag.get(i.itemId) ?? 0) >= i.quantity)) {
          for (const i of step.items) add(i.itemId, -i.quantity);
          tokens -= step.fee;
          h.ascension++;
          progressed = true;
        }
        continue;
      }
      const need = Math.round(cfg.character.xp.a + cfg.character.xp.b * h.level + cfg.character.xp.c * h.level * h.level) - h.xp;
      const fee = characterLevelFee(cfg, h.level);
      if (xpBank <= 0 || tokens < fee) continue;
      const give = Math.min(xpBank, need);
      const r = applyCharacterXp(cfg, h, give, cap);
      xpBank -= give;
      xpWasted += r.wasted;
      if (r.levelsGained > 0) { tokens -= fee; levelUps += r.levelsGained; }
      Object.assign(h, r.state);
      progressed = true;
      break;
    }
    if (!progressed) break;
  }
  return levelUps;
}

// ---- days
interface Row { day: number; cleared: string; account: number; levels: string; tokens: number; blocker: string }
const rows: Row[] = [];
const chapterDone = new Map<string, number>();
let partOneDay: number | null = null;
let level20Day: number | null = null;
const blockerOf = (): string => {
  if ([...heroes.values()].every((h) => h.level >= 20)) return '—';
  const minLevel = Math.min(...[...heroes.values()].map((h) => h.level));
  const atCap = [...heroes.values()].filter((h) => h.level < 20 && h.level >= characterLevelCap(cfg, h.ascension, accountLevel())).sort((a, b) => a.level - b.level);
  if (atCap.length === 0) return `XP (lowest hero L${minLevel})`;
  const h = atCap[0]!;
  const step = cfg.character.ascension[h.ascension + 1];
  if (!step) return 'level 20';
  if (cleared < stages.length && h.level >= 20) return 'battle';
  if (h.level < characterLevelCap(cfg, h.ascension, 10_000)) return `account level ${accountLevel()}`;
  if (accountLevel() < step.accountLevel) return `account level ${accountLevel()} < ${step.accountLevel} for ascension`;
  const missing = step.items.filter((i) => (bag.get(i.itemId) ?? 0) < i.quantity).map((i) => `${i.itemId} ${bag.get(i.itemId) ?? 0}/${i.quantity}`);
  if (missing.length) return `materials: ${missing.join(', ')}`;
  if (tokens < step.fee) return `tokens ${tokens}/${step.fee}`;
  return 'battle';
};

let weeklyWins = 0;
let weeklyBossWins = 0;
for (let day = 1; day <= DAYS; day++) {
  const dow = (day - 1) % 7;
  if (dow === 0 || dow === 3 || dow === 6) { weeklyWins = 0; weeklyBossWins = 0; }
  tokens += 80; // daily supplies (recovery floor)
  for (let session = 0; session < 2; session++) {
    if (cleared > 0) { const y = afkYield(12 * 3600, cleared); accountXp += y.accountXp; xpBank += y.pages * XP_ITEMS.torn_chronicle_page!; add('forge_dust', y.dust); }
    ration = Math.min(100, ration + 144); // +1 per 5 min over 12 h, capped at 100
    let wins = 0;
    let leveled = 0;
    while (ration >= 6 || (cleared === 0 && stages[0]!.stamina_cost === 0)) {
      const next = cleared < stages.length ? cleared : -1;
      if (next >= 0) {
        leveled += growHeroes();
        if (winnable(next)) {
          const cost = stages[next]!.stamina_cost as number;
          ration -= cost;
          clearStage(next, true);
          cleared++;
          wins++;
          const ch = stages[next]!.chapter_id as string;
          if (stages[next + 1]?.chapter_id !== ch) chapterDone.set(ch, day);
          continue;
        }
      }
      if (cleared === 0) break;
      ration -= 6; // repeat the furthest cleared normal stage (boss tables drop no ascension materials)
      const rep = farmStage();
      clearStage(rep, false);
      wins++;
      if (stages[rep]!.node_type === 'boss') weeklyBossWins++;
    }
    weeklyWins += wins;
    leveled += growHeroes();
    const d = tasks.daily;
    const winThree = wins >= 3;
    const kit = leveled >= 1;
    if (winThree) reward(d.tasks.find((t: Json) => t.id === 'win_three_battles').rewards);
    if (kit) reward(d.tasks.find((t: Json) => t.id === 'improve_company_kit').rewards);
    if (winThree && kit) reward(d.completion.rewards);
    growHeroes();
  }
  const seg = tasks.weekly.segments as Json[];
  if (dow === 2 && weeklyWins >= seg[0]!.objective.count) reward(seg[0]!.rewards);
  if (dow === 5 && weeklyBossWins >= seg[1]!.objective.count) reward(seg[1]!.rewards);
  if (dow === 6 && weeklyWins >= seg[2]!.objective.count) reward(seg[2]!.rewards);

  // self-check: the simulation never spends what it does not have
  if (tokens < 0 || ration < 0 || [...bag.values()].some((n) => n < 0)) throw new Error(`day ${day}: negative balance`);
  if (cleared >= stages.length && partOneDay === null) partOneDay = day;
  const levels = [...heroes.entries()].map(([id, h]) => `${id.split('_')[0]} ${h.level}`).join(', ');
  if (level20Day === null && [...heroes.values()].every((h) => h.level >= 20)) level20Day = day;
  if (day <= 14 || day % 7 === 0 || day === partOneDay) rows.push({ day, cleared: cleared ? stages[cleared - 1]!.stage_id : '—', account: accountLevel(), levels, tokens, blocker: blockerOf() });
  if (partOneDay !== null && level20Day !== null) break;
}

const chapterLine = [...chapterDone.entries()].map(([ch, d]) => `${ch.split('_')[0]} day ${d}`).join(' · ');
writeOut(
  'docs/combat/PROGRESSION_PACE.md',
  `# Progression pace probe (generated — do not edit)

Generated by \`npx tsx tools/progression_probe.ts\`. A no-gacha, no-ad player with two sessions a day plays Part I with the seeded rules
(XP curve, ascension gates, level fees, errands, weekly segments, AFK patrol, Ration 100 cap / +1 per 5 min, seeded drop tables).
The next stage is played with the engine's Auto policy (won on 2 of 3 seeds). Owned heroes wear a 3★ weapon and padded armor at their
level; story loans keep the stage level with level-1 loan gear. See the header of the tool for every assumption.

- **Part I finished:** ${partOneDay === null ? `not within ${DAYS} days (furthest ${cleared ? stages[cleared - 1]!.stage_id : '—'})` : `day ${partOneDay}`}
- **Every owned hero at level 20:** ${level20Day === null ? `not within ${DAYS} days` : `day ${level20Day}`}
- **Chapters finished:** ${chapterLine || '—'}
- XP lost to level caps: ${xpWasted}; unspent XP at the end: ${xpBank}

| Day | Furthest stage | Account level | Hero levels | Tokens | What blocks the next step |
|---|---|---|---|---|---|
${rows.map((r) => `| ${r.day} | ${r.cleared} | ${r.account} | ${r.levels} | ${r.tokens} | ${r.blocker} |`).join('\n')}
`
);
console.log(`part I: ${partOneDay ?? `>${DAYS}`} days (furthest ${cleared ? stages[cleared - 1]!.stage_id : '—'}), all heroes L20: ${level20Day ?? `>${DAYS}`} days; ${chapterLine}`);
