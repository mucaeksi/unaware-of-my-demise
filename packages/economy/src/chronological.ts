import { z } from 'zod';
import type { DropConfig } from './drops';
import type { Archetype } from './flow';

/**
 * R16 Chronological variable-fee, material-gate, and strict no-ad recovery floor simulator.
 * Replaces averaged cash proxies with actual versioned fees, discrete 12-hour windows,
 * non-amortized weekly segment payouts, XP/material gates, and the unconditional 80-token UTC daily supply floor.
 */
export const ChronologicalModelSchema = z
  .object({
    days: z.number().int().min(1).max(365).default(30),
    startBalance: z.number().int().min(0).max(1_000_000_000).default(0),
    pullCost: z.number().int().min(1).max(1_000_000).default(160),
    /** Unconditional UTC daily supplies claim (guaranteed free recovery floor, no win/spend/ad/Ration required). */
    dailySuppliesTokens: z.number().int().min(0).max(100_000).default(80),
    /** Number of 12-hour windows completed per day (0, 1, or 2). */
    windowsPerDay: z.number().int().min(0).max(2).default(2),
    winThreeTokens: z.number().int().min(0).max(100_000).default(60),
    winThreeBooks: z.number().int().min(0).max(1000).default(3),
    kitUpgradeTokens: z.number().int().min(0).max(100_000).default(20),
    kitUpgradeBooks: z.number().int().min(0).max(1000).default(1),
    windowCompletionBooks: z.number().int().min(0).max(1000).default(4),
    windowCompletionAccountXp: z.number().int().min(0).max(100_000).default(400),
    /** Discrete weekly segment payouts on days 3, 5, 7 of each 7-day cycle (never amortized into daily floor). */
    weeklySegmentTokens: z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int().min(0)]).default([320, 320, 160]),
    missedWeeklySegments: z.number().int().min(0).max(3).default(0),
    /** Ration-6 campaign repeats per day (4 tokens + 120 page XP each). */
    campaignRepeatsPerDay: z.number().int().min(0).max(60).default(6),
    campaignRepeatTokens: z.number().int().min(0).max(10_000).default(4),
    /** Ration-8 targeted material hunt runs per day (4 tokens + 1 guaranteed material + 35% bonus). */
    materialHuntRunsPerDay: z.number().int().min(0).max(40).default(2),
    materialHuntTokens: z.number().int().min(0).max(10_000).default(4),
    afkTokensPerDay: z.number().int().min(0).max(10_000).default(0),
    adsPerDay: z.number().int().min(0).max(10).default(0),
    adTokens: z.number().int().min(0).max(10_000).default(30),
    subscriptionActive: z.boolean().default(false),
    subscriptionImmediateTokens: z.number().int().min(0).max(1_000_000).default(1600),
    subscriptionDailyTokens: z.number().int().min(0).max(100_000).default(374),
    shopSpendPerDay: z.number().int().min(0).max(1_000_000).default(0),
    rosterSize: z.number().int().min(1).max(10).default(2),
    characterFee: z
      .object({
        base: z.number().min(0).max(10_000).default(10),
        increment: z.number().min(0).max(10_000).default(2)
      })
      .strict()
      .default({ base: 10, increment: 2 }),
    ascensionFees: z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int().min(0)]).default([30, 60, 80]),
    weaponFee: z
      .object({
        base: z.number().min(0).max(10_000).default(16),
        increment: z.number().min(0).max(10_000).default(1)
      })
      .strict()
      .default({ base: 16, increment: 1 }),
    maxUpgradesPerDay: z.number().int().min(0).max(50).default(2)
  })
  .strict();

export type ChronologicalModel = z.infer<typeof ChronologicalModelSchema>;

export const DEFAULT_CHRONOLOGICAL_MODEL: ChronologicalModel = ChronologicalModelSchema.parse({});

export interface UpgradeOperation {
  heroIndex: number;
  kind: 'level' | 'ascension';
  fromLevel: number;
  toLevel: number;
  fee: number;
  requiredMaterials: number;
}

/**
 * Generates the ordered sequence of 22 upgrade steps per hero (19 level-ups L1->20 + 3 paid ascensions at L5, L10, L15).
 * Under the proposed SOL-7 / R16 curve (`ceil(10 + 2L)` + `30/60/80` ascensions), each hero costs `570 + 170 = 740` tokens (4.625 pulls).
 */
export function buildCharacterUpgradeSchedule(model: ChronologicalModel): UpgradeOperation[] {
  const schedule: UpgradeOperation[] = [];
  const ascCaps = [5, 10, 15];
  const ascMats = [3, 10, 16]; // 3 iron; 5 alchemy + 5 iron; 8 bellglass + 8 alchemy (29 total per hero)

  // Interleave upgrades across the active starter roster so heroes advance together toward each ascension gate
  for (let level = 1; level < 20; level++) {
    const fee = Math.ceil(model.characterFee.base + model.characterFee.increment * level);
    for (let h = 0; h < model.rosterSize; h++) {
      schedule.push({
        heroIndex: h,
        kind: 'level',
        fromLevel: level,
        toLevel: level + 1,
        fee,
        requiredMaterials: 0
      });
    }
    const capIdx = ascCaps.indexOf(level + 1);
    if (capIdx !== -1 && level + 1 < 20) {
      const ascFee = model.ascensionFees[capIdx as 0 | 1 | 2];
      const mats = ascMats[capIdx]!;
      for (let h = 0; h < model.rosterSize; h++) {
        schedule.push({
          heroIndex: h,
          kind: 'ascension',
          fromLevel: level + 1,
          toLevel: level + 1,
          fee: ascFee,
          requiredMaterials: mats
        });
      }
    }
  }
  return schedule;
}

export interface ChronologicalArchetypeResult {
  archetype: Archetype;
  pulls: number;
  guaranteedFiveStarsFromPity: number;
  paidUpgradeSteps: number;
  totalUpgradeSteps: number;
  blockedDays: number;
  longestBlockedRun: number;
  materialBlockedDays: number;
  endBalance: number;
  totalTokensEarned: number;
  totalXpEarned: number;
  totalMaterialsFarmed: number;
}

export interface ChronologicalReport {
  model: ChronologicalModel;
  singleHeroLevelCost: number;
  singleHeroAscensionCost: number;
  singleHeroTotalCost: number;
  singleHeroCostInPulls: number;
  singleWeaponTotalCost: number;
  singleWeaponCostInPulls: number;
  worstCaseMaterialHuntRunsPerHero: number;
  maxSingleStepFee: number;
  guaranteedFreeDailyFloor: number;
  strictRecoveryDays: number;
  strictFloorHolds: boolean;
  netRecoveryDaysAfterShop: number | null;
  results: ChronologicalArchetypeResult[];
}

export function simulateChronological(model: ChronologicalModel, archetype: Archetype): ChronologicalArchetypeResult {
  const schedule = buildCharacterUpgradeSchedule(model);
  let stepCursor = 0;
  let balance = model.startBalance + (model.subscriptionActive ? model.subscriptionImmediateTokens : 0);
  let totalTokensEarned = model.subscriptionActive ? model.subscriptionImmediateTokens : 0;
  let totalXpEarned = 0;
  let materialsAvailable = 0;
  let totalMaterialsFarmed = 0;
  let pulls = 0;
  let blockedDays = 0;
  let currentBlockedRun = 0;
  let longestBlockedRun = 0;
  let materialBlockedDays = 0;

  for (let d = 0; d < model.days; d++) {
    const dayOfWeek = (d % 7) + 1; // 1..7

    // 1. Unconditional UTC daily supplies floor
    let dailyIncome = model.dailySuppliesTokens;

    // 2. Stage & Material Hunt repeat payouts + guaranteed targeted materials (1.0 worst-case guaranteed per run)
    dailyIncome += model.campaignRepeatsPerDay * model.campaignRepeatTokens;
    dailyIncome += model.materialHuntRunsPerDay * model.materialHuntTokens;
    dailyIncome += model.afkTokensPerDay;
    materialsAvailable += model.materialHuntRunsPerDay;
    totalMaterialsFarmed += model.materialHuntRunsPerDay;
    totalXpEarned += model.campaignRepeatsPerDay * 120;

    // 3. Optional ads and subscription half-day mail
    dailyIncome += model.adsPerDay * model.adTokens;
    if (model.subscriptionActive) {
      dailyIncome += model.subscriptionDailyTokens;
    }

    // 4. Discrete 12-hour windows (win_three_battles; improve_company_kit is granted below only if an upgrade is paid or base task income)
    const activeWindows = Math.min(2, Math.max(0, model.windowsPerDay));
    dailyIncome += activeWindows * model.winThreeTokens;
    totalXpEarned += activeWindows * model.winThreeBooks * 500;

    // 5. Discrete weekly segments on days 3, 5, 7 (unless missed)
    const activeWeeklySegments = Math.max(0, 3 - model.missedWeeklySegments);
    if (dayOfWeek === 3 && activeWeeklySegments >= 1) dailyIncome += model.weeklySegmentTokens[0];
    if (dayOfWeek === 5 && activeWeeklySegments >= 2) dailyIncome += model.weeklySegmentTokens[1];
    if (dayOfWeek === 7 && activeWeeklySegments >= 3) dailyIncome += model.weeklySegmentTokens[2];

    balance += dailyIncome;
    totalTokensEarned += dailyIncome;

    // Deduct optional daily shop convenience spend
    const shopSpend = Math.min(balance, model.shopSpendPerDay);
    balance -= shopSpend;

    const wantSteps = Math.min(model.maxUpgradesPerDay, schedule.length - stepCursor);
    let stepsBoughtToday = 0;
    let blockedByMatToday = false;

    const attemptUpgrades = (): void => {
      while (stepsBoughtToday < wantSteps && stepCursor < schedule.length) {
        const nextOp = schedule[stepCursor]!;
        if (nextOp.requiredMaterials > materialsAvailable) {
          blockedByMatToday = true;
          break;
        }
        if (balance < nextOp.fee) {
          break;
        }
        balance -= nextOp.fee;
        materialsAvailable -= nextOp.requiredMaterials;
        stepCursor++;
        stepsBoughtToday++;
      }
    };

    const attemptWishes = (): void => {
      const n = Math.floor(balance / model.pullCost);
      if (n > 0) {
        balance -= n * model.pullCost;
        pulls += n;
      }
    };

    if (archetype === 'all_in_wishes') {
      attemptWishes();
      attemptUpgrades();
    } else if (archetype === 'balanced') {
      attemptUpgrades();
      attemptWishes();
    } else {
      attemptUpgrades();
    }

    // If at least one upgrade step was paid today and windows are active, award the optional improve_company_kit window bonus
    if (stepsBoughtToday > 0 && activeWindows > 0) {
      const kitWindows = Math.min(activeWindows, stepsBoughtToday);
      const kitTokens = kitWindows * model.kitUpgradeTokens;
      balance += kitTokens;
      totalTokensEarned += kitTokens;
      totalXpEarned += kitWindows * (model.kitUpgradeBooks + model.windowCompletionBooks) * 500;
      if (archetype === 'all_in_wishes' || archetype === 'balanced') {
        attemptWishes();
      }
    }

    if (blockedByMatToday) materialBlockedDays++;
    if (wantSteps > 0 && stepsBoughtToday === 0 && !blockedByMatToday) {
      blockedDays++;
      currentBlockedRun++;
      longestBlockedRun = Math.max(longestBlockedRun, currentBlockedRun);
    } else {
      currentBlockedRun = 0;
    }
  }

  return {
    archetype,
    pulls,
    guaranteedFiveStarsFromPity: Math.floor(pulls / 80),
    paidUpgradeSteps: stepCursor,
    totalUpgradeSteps: schedule.length,
    blockedDays,
    longestBlockedRun,
    materialBlockedDays,
    endBalance: Math.round(balance),
    totalTokensEarned: Math.round(totalTokensEarned),
    totalXpEarned,
    totalMaterialsFarmed
  };
}

export function analyzeChronological(input: Partial<ChronologicalModel> = {}): ChronologicalReport {
  const model = ChronologicalModelSchema.parse(input);
  let singleHeroLevelCost = 0;
  for (let l = 1; l < 20; l++) {
    singleHeroLevelCost += Math.ceil(model.characterFee.base + model.characterFee.increment * l);
  }
  const singleHeroAscensionCost = model.ascensionFees[0] + model.ascensionFees[1] + model.ascensionFees[2];
  const singleHeroTotalCost = singleHeroLevelCost + singleHeroAscensionCost;

  let singleWeaponTotalCost = 0;
  for (let l = 1; l < 20; l++) {
    singleWeaponTotalCost += Math.ceil(model.weaponFee.base + model.weaponFee.increment * l);
  }

  const maxLevelFee = Math.ceil(model.characterFee.base + model.characterFee.increment * 19);
  const maxSingleStepFee = Math.max(maxLevelFee, ...model.ascensionFees);
  const guaranteedFreeDailyFloor = model.dailySuppliesTokens;
  const strictRecoveryDays =
    guaranteedFreeDailyFloor > 0 ? Math.ceil(maxSingleStepFee / guaranteedFreeDailyFloor) : Infinity;
  const netDailyAfterShop = guaranteedFreeDailyFloor - model.shopSpendPerDay;
  const netRecoveryDaysAfterShop =
    netDailyAfterShop > 0 ? Math.ceil(maxSingleStepFee / netDailyAfterShop) : null;

  const results = (['all_in_wishes', 'balanced', 'never_wishes'] as const).map((arch) =>
    simulateChronological(model, arch)
  );

  return {
    model,
    singleHeroLevelCost,
    singleHeroAscensionCost,
    singleHeroTotalCost,
    singleHeroCostInPulls: singleHeroTotalCost / model.pullCost,
    singleWeaponTotalCost,
    singleWeaponCostInPulls: singleWeaponTotalCost / model.pullCost,
    worstCaseMaterialHuntRunsPerHero: 29, // 8 iron_oath_seal + 13 alchemy_core + 8 bellglass_shard at 1 guaranteed/run
    maxSingleStepFee,
    guaranteedFreeDailyFloor,
    strictRecoveryDays,
    strictFloorHolds: strictRecoveryDays <= 1,
    netRecoveryDaysAfterShop,
    results
  };
}

/**
 * Resolves the R16 final-boss repeat-5★ vs first-clear-only contradiction:
 * ensures `story_boss_final.repeat` never drops a 5★ accessory or concrete `first_eclipse` gear on repeat,
 * keeping the 5★ `first_eclipse` guarantee strictly in `firstClear` and setting Ration-10 boss repeat currency to 6 fixed tokens.
 */
export function resolveFinalBossDropTable(drops: DropConfig): {
  resolved: DropConfig;
  hadRepeatFiveStarContradiction: boolean;
} {
  const cloned: DropConfig = JSON.parse(JSON.stringify(drops)) as DropConfig;
  const finalBoss = cloned.tables['story_boss_final'];
  if (!finalBoss) {
    return { resolved: cloned, hadRepeatFiveStarContradiction: false };
  }

  let hadContradiction = false;
  const filteredRepeat = finalBoss.repeat.filter((entry) => {
    if (entry.kind === 'gear' && entry.gearId.includes('first_eclipse')) {
      hadContradiction = true;
      if (!finalBoss.firstClear.some((fc) => fc.kind === 'gear' && fc.gearId === entry.gearId)) {
        finalBoss.firstClear.push(entry);
      }
      return false;
    }
    if (entry.kind === 'boss_set' && entry.rarity === 5) {
      hadContradiction = true;
      if (!finalBoss.firstClear.some((fc) => fc.kind === 'boss_set' && fc.rarity === 5)) {
        finalBoss.firstClear.push(entry);
      }
      return false;
    }
    return true;
  });

  // Normalize Ration-10 boss repeat currency payout to fixed 6 tokens per R16 / TUNING_PROPOSAL
  finalBoss.repeat = filteredRepeat.map((entry) =>
    entry.kind === 'currency' ? { kind: 'currency', min: 6, max: 6, chance: 1 } : entry
  );

  return { resolved: cloned, hadRepeatFiveStarContradiction: hadContradiction };
}
