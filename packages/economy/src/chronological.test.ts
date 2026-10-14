import { describe, expect, it } from 'vitest';
import {
  analyzeChronological,
  buildCharacterUpgradeSchedule,
  resolveFinalBossDropTable
} from './chronological';
import { DropConfig } from './drops';

describe('R16 chronological variable-fee, material-gate, and recovery-floor simulator', () => {
  it('computes exact SOL-7 / R16 fee sums (570 levels + 170 ascensions = 740 tokens = 4.625 pulls; weapon 494 = 3.0875 pulls)', () => {
    const report = analyzeChronological();
    expect(report.singleHeroLevelCost).toBe(570);
    expect(report.singleHeroAscensionCost).toBe(170);
    expect(report.singleHeroTotalCost).toBe(740);
    expect(report.singleHeroCostInPulls).toBeCloseTo(4.625, 4);
    expect(report.singleWeaponTotalCost).toBe(494);
    expect(report.singleWeaponCostInPulls).toBeCloseTo(3.0875, 4);
    expect(report.worstCaseMaterialHuntRunsPerHero).toBe(29);
    expect(report.maxSingleStepFee).toBe(80);
    expect(report.guaranteedFreeDailyFloor).toBe(80);
    expect(report.strictRecoveryDays).toBe(1);
    expect(report.strictFloorHolds).toBe(true);
    expect(report.netRecoveryDaysAfterShop).toBe(1);

    const schedule = buildCharacterUpgradeSchedule(report.model);
    expect(schedule).toHaveLength(44); // 2 heroes * (19 levels + 3 ascensions)
  });

  it('proves strict 1-day recovery from zero balance with zero ads, zero windows, zero weeklies, and zero stage wins', () => {
    const supplyOnly = analyzeChronological({
      windowsPerDay: 0,
      missedWeeklySegments: 3,
      campaignRepeatsPerDay: 0,
      materialHuntRunsPerDay: 2,
      materialHuntTokens: 0,
      adsPerDay: 0,
      subscriptionActive: false,
      maxUpgradesPerDay: 1
    });

    expect(supplyOnly.strictRecoveryDays).toBe(1);
    expect(supplyOnly.strictFloorHolds).toBe(true);
    const balanced = supplyOnly.results.find((r) => r.archetype === 'balanced')!;
    expect(balanced.paidUpgradeSteps).toBeGreaterThanOrEqual(22);
    expect(balanced.blockedDays).toBe(0);
  });

  it('exposes the shop counterexample when shopSpendPerDay consumes the entire daily supply floor', () => {
    const shopCounterexample = analyzeChronological({
      windowsPerDay: 0,
      missedWeeklySegments: 3,
      campaignRepeatsPerDay: 0,
      materialHuntRunsPerDay: 0,
      shopSpendPerDay: 80
    });
    expect(shopCounterexample.strictFloorHolds).toBe(true);
    expect(shopCounterexample.netRecoveryDaysAfterShop).toBeNull();
  });

  it('resolves the final-boss repeat-5-star contradiction by moving first_eclipse to firstClear only and fixing Ration-10 repeat currency to 6', () => {
    const raw = DropConfig.parse({
      tables: {
        story_boss_final: {
          repeat: [
            { kind: 'currency', min: 9, max: 11, chance: 1 },
            { kind: 'gear', gearId: 'necklace_first_eclipse_5', chance: 1 },
            { kind: 'item', itemId: 'unwritten_hour_cinder', min: 2, max: 2, chance: 1 }
          ],
          firstClear: []
        }
      }
    });

    const { resolved, hadRepeatFiveStarContradiction } = resolveFinalBossDropTable(raw);
    expect(hadRepeatFiveStarContradiction).toBe(true);
    const table = resolved.tables['story_boss_final']!;
    expect(table.repeat.some((e) => e.kind === 'gear')).toBe(false);
    expect(table.repeat.find((e) => e.kind === 'currency')).toEqual({
      kind: 'currency',
      min: 6,
      max: 6,
      chance: 1
    });
    expect(table.firstClear).toContainEqual({
      kind: 'gear',
      gearId: 'necklace_first_eclipse_5',
      chance: 1
    });
  });
});
