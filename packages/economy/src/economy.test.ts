import { describe, expect, it } from 'vitest';
import { Rng } from '@uomd/shared';
import {
  analyzeBanner,
  BannerConfig,
  CANON,
  emptyPity,
  fiveStarRate,
  firstFiveStarDistribution,
  GachaError,
  limitedCharacterBanner,
  pullMany,
  pullOnce,
  simulateBanner,
  standardCharacterBanner,
  weaponBanner,
  type PityState
} from './index';

const pools = {
  four: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'],
  three: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'],
  fiveStandard: ['mahmut', 'fadyme']
};
const limited = limitedCharacterBanner('oath_01_aveline', 'sister_aveline', pools);
const hall = standardCharacterBanner('hall_of_ancestors', pools);
const weapon = weaponBanner('oath_01_weapon', ['weapon_aveline_last_vigil'], ['w5_a', 'w5_b', 'w5_c', 'w5_d'], { four: ['w4_a', 'w4_b'], three: ['w3_a', 'w3_b'] }, false);
const armory = weaponBanner('hall_of_armaments', ['sig_a', 'sig_b'], ['w5_a', 'w5_b'], { four: ['w4_a', 'w4_b'], three: ['w3_a', 'w3_b'] }, true);

const seq = (...v: number[]) => {
  let i = 0;
  return () => {
    const x = v[i++ % v.length];
    if (x === undefined) throw new Error('empty');
    return x;
  };
};

describe('rate curve (canon economy_part1.json)', () => {
  it('limited character: 2.5 % through pull 64, +6 pp per pull from 65, 100 % at the hard pity 80', () => {
    expect(fiveStarRate(limited, 1)).toBe(0.025);
    expect(fiveStarRate(limited, 64)).toBe(0.025);
    expect(fiveStarRate(limited, 65)).toBeCloseTo(0.085, 12);
    expect(fiveStarRate(limited, 66)).toBeCloseTo(0.145, 12);
    expect(fiveStarRate(limited, 79)).toBeCloseTo(0.925, 12);
    expect(fiveStarRate(limited, 80)).toBe(1);
  });
  it('weapon banner has no soft pity and a hard pity of 65; the permanent banner is 2 % / 80', () => {
    expect(fiveStarRate(weapon, 64)).toBe(0.025);
    expect(fiveStarRate(weapon, 65)).toBe(1);
    expect(fiveStarRate(hall, 79)).toBe(0.02);
    expect(fiveStarRate(hall, 80)).toBe(1);
  });
  it('the exact first-five-star distribution sums to 1 and the expected value is below the hard pity', () => {
    for (const b of [limited, hall, weapon]) {
      const d = firstFiveStarDistribution(b);
      expect(d).toHaveLength(b.hardPity);
      expect(d.reduce((a, c) => a + c, 0)).toBeCloseTo(1, 12);
    }
    const r = analyzeBanner(limited);
    // canon numbers (2.5 % base, soft pity from 65): about 33 pulls per five-star, about 48 per featured character
    expect(r.expectedPullsPerFiveStar).toBeCloseTo(32.97, 1);
    expect(r.consolidatedFiveStarRate).toBeCloseTo(0.0303, 3);
    expect(r.expectedPullsPerTarget).toBeCloseTo(47.81, 1);
    expect(r.worstCasePullsForTarget).toBe(160);
    expect(analyzeBanner(weapon).worstCasePullsForTarget).toBe(195); // canon: worst case 195
    expect(analyzeBanner(hall).expectedPullsPerTarget).toBeNull();
    const within = analyzeBanner(limited).targetWithin!;
    expect(within.at(-1)!.probability).toBeCloseTo(1, 9); // the guarantee closes at 160
    expect(within.every((x, i) => i === 0 || x.probability >= within[i - 1]!.probability)).toBe(true);
  });
});

describe('single pull rules', () => {
  it('hard pity forces a five-star regardless of the roll', () => {
    const s: PityState = { pity5: 79, pity4: 3, lost: 0 };
    const { result, state } = pullOnce(limited, s, seq(0.999999, 0.0), undefined);
    expect(result.rarity).toBe(5);
    expect(result.pullNumber).toBe(80);
    expect(state).toEqual({ pity5: 0, pity4: 0, lost: state.lost });
  });
  it('a roll below the rate is a five-star, above it splits the rest 17 : 81', () => {
    const five = pullOnce(limited, emptyPity(), seq(0.02, 0.1, 0.0), undefined).result;
    expect(five.rarity).toBe(5);
    // u just above 2.5 %: v ~ 0 -> 4-star; u near 1 -> 3-star
    expect(pullOnce(limited, emptyPity(), seq(0.026, 0), undefined).result.rarity).toBe(4);
    expect(pullOnce(limited, emptyPity(), seq(0.999, 0), undefined).result.rarity).toBe(3);
    const boundary = 0.025 + 0.975 * (17 / 98); // exactly the 4/3 edge
    expect(pullOnce(limited, emptyPity(), seq(boundary - 1e-9, 0), undefined).result.rarity).toBe(4);
    expect(pullOnce(limited, emptyPity(), seq(boundary + 1e-9, 0), undefined).result.rarity).toBe(3);
  });
  it('the 10th pull without a 4-star is upgraded; the counter resets on a 4-star or better', () => {
    let s = emptyPity();
    for (let i = 1; i <= 9; i++) {
      const r = pullOnce(limited, s, seq(0.999, 0), undefined);
      expect(r.result.rarity).toBe(3);
      s = r.state;
    }
    const tenth = pullOnce(limited, s, seq(0.999, 0), undefined);
    expect(tenth.result.rarity).toBe(4);
    expect(tenth.result.upgraded).toBe(true);
    expect(tenth.state.pity4).toBe(0);
    // a naturally rolled 4-star also resets it
    const natural = pullOnce(limited, { pity5: 4, pity4: 4, lost: 0 }, seq(0.15, 0), undefined);
    expect(natural.result.rarity).toBe(4);
    expect(natural.state.pity4).toBe(0);
    expect(natural.result.upgraded).toBe(false);
  });
  it('55 % target roll: win keeps no debt, loss goes to the standard pool and guarantees the next five-star', () => {
    const win = pullOnce(limited, emptyPity(), seq(0.0, 0.54), undefined);
    expect(win.result).toMatchObject({ rarity: 5, itemId: 'sister_aveline', outcome: 'target' });
    expect(win.state.lost).toBe(0);
    const lose = pullOnce(limited, emptyPity(), seq(0.0, 0.55, 0.0), undefined);
    expect(lose.result).toMatchObject({ rarity: 5, itemId: 'mahmut', outcome: 'off' });
    expect(lose.state.lost).toBe(1);
    // the guarantee does not even roll for the 55 %
    const guaranteed = pullOnce(limited, lose.state, seq(0.0, 0.99), undefined);
    expect(guaranteed.result).toMatchObject({ itemId: 'sister_aveline', outcome: 'guaranteed' });
    expect(guaranteed.result.rolls).toHaveLength(1);
    expect(guaranteed.state.lost).toBe(0);
  });
  it('weapon: two Fate Knots (lost 50/50s) guarantee the target, then the knots reset', () => {
    let s = emptyPity();
    const lostRoll = seq(0.0, 0.99, 0.0);
    for (let k = 1; k <= 2; k++) {
      const r = pullOnce(weapon, s, lostRoll, undefined);
      expect(r.result.outcome).toBe('off');
      expect(r.state.lost).toBe(k);
      s = r.state;
    }
    const third = pullOnce(weapon, s, seq(0.0), undefined);
    expect(third.result).toMatchObject({ itemId: 'weapon_aveline_last_vigil', outcome: 'guaranteed' });
    expect(third.state.lost).toBe(0);
  });
  it('selectable target banners require a valid target; fixed and standard banners ignore it', () => {
    expect(() => pullOnce(armory, emptyPity(), seq(0.5), undefined)).toThrow(GachaError);
    expect(() => pullOnce(armory, emptyPity(), seq(0.5), 'nope')).toThrow(/valid target/);
    const r = pullOnce(armory, emptyPity(), seq(0.0, 0.1), 'sig_b');
    expect(r.result.itemId).toBe('sig_b');
    expect(pullOnce(hall, emptyPity(), seq(0.0, 0.9), undefined).result).toMatchObject({ outcome: 'standard', itemId: 'fadyme' });
  });
  it('rejects a broken roll source and invalid counts; ten-pull has no special rate', () => {
    expect(() => pullOnce(limited, emptyPity(), () => 1, undefined)).toThrow(GachaError);
    expect(() => pullMany(limited, emptyPity(), 0, seq(0.5))).toThrow(/1..10/);
    expect(() => pullMany(limited, emptyPity(), 11, seq(0.5))).toThrow(/1..10/);
    const rng = new Rng(7);
    const ten = pullMany(limited, emptyPity(), 10, () => rng.next());
    const rng2 = new Rng(7);
    let s = emptyPity();
    const single = Array.from({ length: 10 }, () => {
      const r = pullOnce(limited, s, () => rng2.next());
      s = r.state;
      return r.result;
    });
    expect(ten.results).toEqual(single);
    expect(ten.state).toEqual(s);
  });
  it('does not mutate the input state and the journal rolls reproduce the result', () => {
    const s: PityState = { pity5: 10, pity4: 2, lost: 1 };
    const frozen = Object.freeze({ ...s });
    const rng = new Rng(99);
    const a = pullOnce(limited, frozen, () => rng.next());
    expect(frozen).toEqual(s);
    const replay = pullOnce(limited, frozen, seq(...a.result.rolls));
    expect(replay).toEqual(a);
  });
});

describe('banner validation', () => {
  it('rejects inconsistent definitions', () => {
    const base = JSON.parse(JSON.stringify(limited)) as BannerConfig;
    expect(() => BannerConfig.parse({ ...base, softPity: { startPull: 99, increment: 0.06 } })).toThrow();
    expect(() => BannerConfig.parse({ ...base, baseFiveStarRate: 0 })).toThrow();
    expect(() => BannerConfig.parse({ ...base, pools: { ...base.pools, four: ['sister_aveline'] } })).toThrow(/only one pool/);
    expect(() => BannerConfig.parse({ ...base, pools: { ...base.pools, fiveFeatured: ['a', 'b'] } })).toThrow(/exactly one/);
    expect(() => BannerConfig.parse({ ...base, extra: 1 })).toThrow();
  });
});

describe('simulation against the exact numbers (seeded, deterministic)', () => {
  it('limited character: empirical five-star rate and expected pulls match the exact analysis', () => {
    const exact = analyzeBanner(limited);
    const sim = simulateBanner(limited, { accounts: 4000, pullsPerAccount: 400, seed: 20261011 });
    expect(sim.rarity.five).toBeGreaterThan(exact.consolidatedFiveStarRate * 0.97);
    expect(sim.rarity.five).toBeLessThan(exact.consolidatedFiveStarRate * 1.03);
    expect(sim.rarity.three + sim.rarity.four + sim.rarity.five).toBeCloseTo(1, 12);
    expect(sim.pullsToTarget!.max).toBeLessThanOrEqual(160);
    const again = simulateBanner(limited, { accounts: 50, pullsPerAccount: 50, seed: 1 });
    expect(simulateBanner(limited, { accounts: 50, pullsPerAccount: 50, seed: 1 })).toEqual(again);
  });
  it('weapon banner never needs more than 195 pulls for the target', () => {
    const sim = simulateBanner(weapon, { accounts: 3000, pullsPerAccount: 300, seed: 5 });
    expect(sim.pullsToTarget!.max).toBeLessThanOrEqual(CANON.hardPityWeapon * 3);
    expect(sim.pullsToTarget!.p99).toBeLessThanOrEqual(195);
  });
});
