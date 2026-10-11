/**
 * Sink/source model of the single-currency economy (D-17). Pure arithmetic, deterministic, used by the Control Center to tune
 * prices and payouts BEFORE they ship. Defaults for income come from the canon (economy_part1.json: 240 per day from tasks,
 * 800 per week cycle, 240 per day from ads, 12,820 per 30-day subscription); the upgrade/shop numbers are placeholders to be tuned.
 */
export interface FlowModel {
  days: number;
  startBalance: number;
  /** average income per day by source, in the main currency */
  income: { tasks: number; weekly: number; ads: number; subscription: number };
  pullCost: number;
  /** one "upgrade step" = one level-up (or ascension) fee paid in the main currency; books/materials are items and not modelled here */
  upgradeStepFee: number;
  /** how many upgrade steps the player wants to take per day (bounded by gates) */
  upgradeStepsWantedPerDay: number;
  /** total number of steps available before the current level caps (the gate): demand stops after this */
  upgradeStepsAvailable: number;
  shopSpendPerDay: number;
}

export const DEFAULT_FLOW: FlowModel = {
  days: 30,
  startBalance: 0,
  income: { tasks: 240, weekly: 800 / 7, ads: 240, subscription: 0 },
  pullCost: 160,
  upgradeStepFee: 150,
  upgradeStepsWantedPerDay: 2,
  upgradeStepsAvailable: 40,
  shopSpendPerDay: 0
};

export type Archetype = 'all_in_wishes' | 'balanced' | 'never_wishes';

export interface FlowResult {
  archetype: Archetype;
  pulls: number;
  upgradeSteps: number;
  /** days on which the player wanted an upgrade step and could not afford any */
  blockedDays: number;
  /** longest run of consecutive blocked days */
  longestBlockedRun: number;
  endBalance: number;
  totalIncome: number;
}

const incomePerDay = (m: FlowModel): number => m.income.tasks + m.income.weekly + m.income.ads + m.income.subscription;

/**
 * all_in_wishes: spends every token on pulls first and upgrades only with what is left. This is the worst case: upgrades stall,
 * but the player is never locked out - pausing wishes for `recoveryDays` restores them (see analyzeFlow).
 * balanced: pays the day's upgrade steps first, wishes with the rest.
 * never_wishes: only upgrades (and the shop); the balance piles up.
 */
export function simulateFlow(m: FlowModel, archetype: Archetype): FlowResult {
  let balance = m.startBalance;
  let pulls = 0;
  let steps = 0;
  let blocked = 0;
  let run = 0;
  let longest = 0;
  let total = 0;
  const daily = incomePerDay(m);
  for (let d = 0; d < m.days; d++) {
    balance += daily;
    total += daily;
    const shop = Math.min(balance, m.shopSpendPerDay);
    balance -= shop;
    const wantSteps = Math.min(m.upgradeStepsWantedPerDay, m.upgradeStepsAvailable - steps);
    const payUpgrades = (): number => {
      const can = m.upgradeStepFee > 0 ? Math.min(wantSteps, Math.floor(balance / m.upgradeStepFee)) : wantSteps;
      balance -= can * m.upgradeStepFee;
      steps += can;
      return can;
    };
    const payWishes = (): void => {
      const n = Math.floor(balance / m.pullCost);
      balance -= n * m.pullCost;
      pulls += n;
    };
    let got: number;
    if (archetype === 'all_in_wishes') {
      // the player tries to upgrade FIRST only if balance happens to allow after wishing: wishes come first
      payWishes();
      got = payUpgrades();
    } else if (archetype === 'balanced') {
      got = payUpgrades();
      payWishes();
    } else {
      got = payUpgrades();
    }
    if (wantSteps > 0 && got === 0) {
      blocked++;
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  return { archetype, pulls, upgradeSteps: steps, blockedDays: blocked, longestBlockedRun: longest, endBalance: Math.round(balance), totalIncome: Math.round(total) };
}

export interface FlowReport {
  model: FlowModel;
  incomePerDay: number;
  results: FlowResult[];
  /** days of income a broke player needs (by pausing wishes) to pay one day's wanted upgrade steps; <= 1 is the design target */
  recoveryDays: number;
  /** the "floor rule": a broke player is back in business within one day of normal income */
  floorHolds: boolean;
  /** largest step fee for which the floor rule holds for the wanted steps per day */
  maxSafeStepFee: number;
  /** how many pulls' worth one upgrade step costs */
  stepFeeInPulls: number;
}

export function analyzeFlow(m: FlowModel): FlowReport {
  const results = (['all_in_wishes', 'balanced', 'never_wishes'] as const).map((a) => simulateFlow(m, a));
  const perDay = incomePerDay(m);
  const need = m.upgradeStepFee * Math.max(1, m.upgradeStepsWantedPerDay);
  const recoveryDays = perDay > 0 ? Math.ceil(need / perDay) : Infinity;
  return { model: m, incomePerDay: Math.round(perDay), results, recoveryDays, floorHolds: recoveryDays <= 1, maxSafeStepFee: Math.floor(perDay / Math.max(1, m.upgradeStepsWantedPerDay)), stepFeeInPulls: m.upgradeStepFee / m.pullCost };
}
