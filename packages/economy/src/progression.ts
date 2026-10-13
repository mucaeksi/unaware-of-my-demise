import { z } from 'zod';

/**
 * Character / account / equipment progression rules (canon: battle_rules_part1.json "character_progression", "account_progression",
 * "equipment_progression" and the GDD level-20 section). Everything is DATA (stored in D1 `game_config`, edited in the Control
 * Center); fees are paid in the single main currency (D-17), converted from the canon Silver Crowns at 100 crowns = 1 unit and
 * flagged as placeholders for the final math pass.
 */
const Fee = z.object({ base: z.number().min(0), increment: z.number().min(0) }).strict();
const ItemId = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);
const Item = z.object({ itemId: ItemId, quantity: z.number().int().min(1).max(9999) }).strict();
// Shipped level-20 progression and PartyMember's rank-3 contract must advance together.
const LevelCap = z.number().int().min(1).max(20);
const SkillRank = z.number().int().min(1).max(3);

export const ProgressionConfig = z
  .object({
    note: z.string().max(400).default(''),
    character: z
      .object({
        levelCap: LevelCap,
        /** xp_to_next(level) = a + b * level + c * level^2 */
        xp: z.object({ a: z.number(), b: z.number(), c: z.number() }).strict(),
        fee: Fee,
        /** a level-up fee for one level L -> L+1 is ceil(base + L * increment) */
        ascension: z.array(z.object({ cap: z.number().int().min(1), accountLevel: z.number().int().min(1), items: z.array(Item).max(6), fee: z.number().int().min(0), /** optional story gate: this chapter node must be cleared (canon: "Story Ch. 3") */ requiresNode: z.string().min(1).max(100).optional() }).strict()).max(10),
        skills: z
          .object({
            /** character level required for each rank (index 0 = rank 2) */
            rankUnlockLevels: z.array(z.number().int().min(1)).max(4),
            maxRank: z.object({ basic: SkillRank, active: SkillRank, passive: SkillRank, ultimate: SkillRank }).strict(),
            /** item used per skill type and quantity per target rank (index 0 = rank 2) */
            itemBySkillType: z.object({ basic: ItemId, active: ItemId, passive: ItemId, ultimate: ItemId }).strict(),
            quantityPerRank: z.array(z.number().int().min(1)).max(4),
            feePerRank: z.array(z.number().int().min(0)).max(4)
          })
          .strict()
      })
      .strict(),
    account: z.object({ levelCap: LevelCap, xp: z.object({ base: z.number(), increment: z.number() }).strict() }).strict(),
    equipment: z
      .object({
        levelCap: LevelCap,
        xp: z.object({ base: z.number(), increment: z.number() }).strict(),
        fee: Fee,
        xpItemId: ItemId,
        milestoneItemId: ItemId,
        /** ascending; reaching `fromLevel` (i.e. leveling past it) needs `rivets` Blacksmith Rivets and grants `bonusPct` of the level-1 stats */
        milestones: z.array(z.object({ fromLevel: z.number().int().min(1), rivets: z.number().int().min(1), bonusPct: z.number().min(0).max(5) }).strict()).max(6)
      })
      .strict()
  })
  .strict()
  .superRefine((config, ctx) => {
    const check = (ok: boolean, path: (string | number)[], message: string) => { if (!ok) ctx.addIssue({ code: 'custom', path, message }); };
    for (const kind of ['character', 'account', 'equipment'] as const) {
      const part = config[kind];
      let totalXp = 0; let totalFees = 0;
      for (let level = 1; level <= part.levelCap; level++) {
        const xp = kind === 'character' ? Math.round(config.character.xp.a + config.character.xp.b * level + config.character.xp.c * level * level)
          : kind === 'account' ? config.account.xp.base + (level - 1) * config.account.xp.increment : config.equipment.xp.base + level * config.equipment.xp.increment;
        check(Number.isSafeInteger(xp) && xp > 0, [kind, 'xp'], 'Every shipped XP threshold must be a positive safe integer');
        totalXp += xp;
        check(Number.isSafeInteger(totalXp), [kind, 'xp'], 'Total progression XP must stay within safe integers');
        if (kind !== 'account') {
          const fee = Math.ceil(config[kind].fee.base + level * config[kind].fee.increment);
          check(Number.isSafeInteger(fee), [kind, 'fee'], 'Computed level fees must be safe integers');
          totalFees += Math.max(1, fee);
          check(Number.isSafeInteger(totalFees), [kind, 'fee'], 'Total level fees must stay within safe integers');
        }
      }
    }
    config.character.ascension.forEach((step, index, steps) => {
      check(step.cap <= config.character.levelCap && (index === 0 || step.cap > steps[index - 1]!.cap), ['character', 'ascension', index, 'cap'], 'Caps must strictly increase within the character limit');
      check(step.accountLevel <= config.account.levelCap && (index === 0 || step.accountLevel >= steps[index - 1]!.accountLevel), ['character', 'ascension', index, 'accountLevel'], 'Account gates must be reachable and ordered');
    });
    const skills = config.character.skills; const needed = Math.max(...Object.values(skills.maxRank)) - 1;
    for (const key of ['rankUnlockLevels', 'quantityPerRank', 'feePerRank'] as const)
      check(skills[key].length >= needed, ['character', 'skills', key], 'Each supported rank needs its unlock and costs');
    skills.rankUnlockLevels.slice(0, needed).forEach((level, index, levels) => {
      check(level <= config.character.levelCap && (index === 0 || level > levels[index - 1]!), ['character', 'skills', 'rankUnlockLevels', index], 'Rank unlocks must be reachable and strictly ordered');
    });
    config.equipment.milestones.forEach((step, index, steps) => {
      check(step.fromLevel <= config.equipment.levelCap && (index === 0 || step.fromLevel > steps[index - 1]!.fromLevel), ['equipment', 'milestones', index, 'fromLevel'], 'Milestones must be reachable and strictly ordered');
    });
  });
export type ProgressionConfig = z.infer<typeof ProgressionConfig>;

/** xp needed to go from `level` to `level + 1` */
export const characterXpToNext = (c: ProgressionConfig, level: number): number => Math.round(c.character.xp.a + c.character.xp.b * level + c.character.xp.c * level * level);
export const characterLevelFee = (c: ProgressionConfig, level: number): number => Math.max(1, Math.ceil(c.character.fee.base + level * c.character.fee.increment));
export const accountXpToNext = (c: ProgressionConfig, level: number): number => c.account.xp.base + (level - 1) * c.account.xp.increment;
export const equipmentXpToNext = (c: ProgressionConfig, level: number): number => c.equipment.xp.base + level * c.equipment.xp.increment;
export const equipmentLevelFee = (c: ProgressionConfig, level: number): number => Math.max(1, Math.ceil(c.equipment.fee.base + level * c.equipment.fee.increment));

/** Account level from lifetime account XP. */
export function accountLevelFromXp(c: ProgressionConfig, totalXp: number): { level: number; into: number; toNext: number | null } {
  let level = 1;
  let left = Math.max(0, Math.floor(totalXp));
  while (level < c.account.levelCap) {
    const need = accountXpToNext(c, level);
    if (left < need) return { level, into: left, toNext: need - left };
    left -= need;
    level++;
  }
  return { level, into: 0, toNext: null };
}

/** The level cap a character can currently reach: the highest ascension step whose requirements it has passed, limited by account level. */
export function characterLevelCap(c: ProgressionConfig, ascension: number, accountLevel: number): number {
  const steps = c.character.ascension;
  // ascension n unlocks steps[n-1].cap; ascension 0 means the first step's cap is the starting cap (canon: levels 1-5 need nothing)
  const startCap = steps[0]?.cap ?? c.character.levelCap;
  const cap = ascension <= 0 ? startCap : (steps[Math.min(ascension, steps.length - 1)]?.cap ?? c.character.levelCap);
  return Math.min(cap, accountLevel, c.character.levelCap);
}

export interface CharState {
  level: number;
  xp: number;
  ascension: number;
}

/** Applies XP; stops at `cap` (XP never carries past a cap). */
export function applyCharacterXp(c: ProgressionConfig, s: CharState, gained: number, cap: number): { state: CharState; levelsGained: number; feeLevels: number[]; wasted: number } {
  let { level, xp } = s;
  xp += gained;
  const feeLevels: number[] = [];
  while (level < cap && xp >= characterXpToNext(c, level)) {
    xp -= characterXpToNext(c, level);
    feeLevels.push(level);
    level++;
  }
  let wasted = 0;
  if (level >= cap) {
    wasted = xp;
    xp = 0;
  }
  return { state: { level, xp, ascension: s.ascension }, levelsGained: level - s.level, feeLevels, wasted };
}

/** Total fee for the levels listed by applyCharacterXp. */
export const feeForLevels = (c: ProgressionConfig, levels: number[]): number => levels.reduce((sum, l) => sum + characterLevelFee(c, l), 0);

/** XP still needed to reach `cap` from the current state. */
export function xpToReach(c: ProgressionConfig, s: CharState, cap: number): number {
  let need = -s.xp;
  for (let l = s.level; l < cap; l++) need += characterXpToNext(c, l);
  return Math.max(0, need);
}

export const roundHalfUp = (x: number): number => Math.floor(x + 0.5);

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

/** canon: stat(level) = base_stats_level_1 + growth_per_level * (level - 1), rounded half up */
export const statAtLevel = (base: number, growth: number, level: number): number => roundHalfUp(base + growth * (level - 1));

export interface GearStats {
  flat: Partial<Record<'hp' | 'atk' | 'def' | 'spd', number>>;
  pct: Partial<Record<'hp' | 'atk' | 'def' | 'spd', number>>;
  other: Record<string, number>;
}

/** Final combat stats of a character: level stats, then flat gear stats, then the percentage stats of gear (additive). */
export function finalStats(base: BaseStats, growth: BaseStats, level: number, gear: GearStats): BaseStats {
  const out: BaseStats = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const k of ['hp', 'atk', 'def', 'spd'] as const) {
    const lv = base[k] + growth[k] * (level - 1);
    out[k] = roundHalfUp((lv + (gear.flat[k] ?? 0)) * (1 + (gear.pct[k] ?? 0)));
  }
  return out;
}

/** Gear stat at a level: base + growth * (level - 1), plus the milestone bonus (percentage of the level-1 value for the highest milestone passed). */
export function gearStatAt(c: ProgressionConfig, base: number, growth: number, level: number, milestonesPassed: number): number {
  const ms = c.equipment.milestones[milestonesPassed - 1];
  return base + growth * (level - 1) + (ms ? base * ms.bonusPct : 0);
}

/** Level cap of a piece of gear given how many milestones were unlocked with rivets. */
export function gearLevelCap(c: ProgressionConfig, milestonesPassed: number): number {
  const next = c.equipment.milestones[milestonesPassed];
  return next ? next.fromLevel : c.equipment.levelCap;
}
