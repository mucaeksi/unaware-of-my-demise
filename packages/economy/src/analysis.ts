import { Rng } from '@uomd/shared';
import { emptyPity, type BannerConfig } from './banner';
import { fiveStarRate, pullOnce } from './gacha';

/** Exact probability that the first five-star of a fresh cycle lands on pull n (index 0 = pull 1). */
export function firstFiveStarDistribution(b: BannerConfig): number[] {
  const out: number[] = [];
  let survive = 1;
  for (let n = 1; n <= b.hardPity; n++) {
    const r = fiveStarRate(b, n);
    out.push(survive * r);
    survive *= 1 - r;
  }
  return out;
}

export interface RateReport {
  /** rate shown per pull number */
  perPull: { pull: number; fiveStar: number }[];
  expectedPullsPerFiveStar: number;
  /** average over all pulls (what the "overall five-star rate" disclosure means) */
  consolidatedFiveStarRate: number;
  /** expected pulls until the featured target, with the loss guarantee (null when the banner has no target) */
  expectedPullsPerTarget: number | null;
  worstCasePullsForTarget: number | null;
  /** probability of a target within N pulls, N = 10, 20, ... up to the worst case (exact) */
  targetWithin: { pulls: number; probability: number }[] | null;
}

/** Exact (not sampled) disclosure numbers for the rate screen and the Control Center. */
export function analyzeBanner(b: BannerConfig): RateReport {
  const dist = firstFiveStarDistribution(b);
  const expected5 = dist.reduce((s, p, i) => s + p * (i + 1), 0);
  const perPull = dist.map((_, i) => ({ pull: i + 1, fiveStar: fiveStarRate(b, i + 1) }));
  let expectedTarget: number | null = null;
  let worst: number | null = null;
  let targetWithin: { pulls: number; probability: number }[] | null = null;
  if (b.featured) {
    const q = b.featured.chance;
    const k = b.featured.lossesToGuarantee;
    let fiveStarsExpected = 0;
    for (let i = 0; i <= k; i++) fiveStarsExpected += (1 - q) ** i;
    expectedTarget = expected5 * fiveStarsExpected;
    worst = b.hardPity * (k + 1);
    // P(target within N pulls): convolve the (independent, pity resets at every five-star) cycles
    const cycle = dist;
    const horizon = worst;
    // state[j][t] = P(after t pulls, j losses so far, no target yet)
    const cur: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(horizon + 1).fill(0));
    cur[0]![0] = 1;
    const hit = new Array<number>(horizon + 1).fill(0);
    for (let j = 0; j <= k; j++) {
      for (let t = 0; t < horizon; t++) {
        const mass = cur[j]![t]!;
        if (mass === 0) continue;
        for (let d = 0; d < cycle.length && t + d + 1 <= horizon; d++) {
          const m = mass * cycle[d]!;
          const win = j >= k ? 1 : q;
          hit[t + d + 1] = (hit[t + d + 1] ?? 0) + m * win;
          if (j < k) cur[j + 1]![t + d + 1] = (cur[j + 1]![t + d + 1] ?? 0) + m * (1 - win);
        }
      }
    }
    targetWithin = [];
    let cum = 0;
    for (let t = 1; t <= horizon; t++) {
      cum += hit[t] ?? 0;
      if (t % 10 === 0 || t === horizon) targetWithin.push({ pulls: t, probability: Math.min(1, cum) });
    }
  }
  return {
    perPull,
    expectedPullsPerFiveStar: expected5,
    consolidatedFiveStarRate: 1 / expected5,
    expectedPullsPerTarget: expectedTarget,
    worstCasePullsForTarget: worst,
    targetWithin
  };
}

export interface SimulationReport {
  accounts: number;
  pullsPerAccount: number;
  rarity: { three: number; four: number; five: number };
  targetRate: number | null;
  /** pulls needed for the first target, per percentile (only accounts that reached it inside the horizon) */
  pullsToTarget: { p50: number; p90: number; p99: number; max: number } | null;
}

/** Monte Carlo over the real engine (so rule changes cannot drift from the simulator). Deterministic for a seed. */
export function simulateBanner(b: BannerConfig, opts: { accounts: number; pullsPerAccount: number; seed: number; target?: string }): SimulationReport {
  const rng = new Rng(opts.seed);
  const roll = (): number => rng.next();
  const counts = { three: 0, four: 0, five: 0 };
  let targets = 0;
  const firstTarget: number[] = [];
  const target = b.featured?.targetMode === 'selectable' ? (opts.target ?? b.pools.fiveFeatured[0]) : undefined;
  for (let a = 0; a < opts.accounts; a++) {
    let s = emptyPity();
    let got: number | null = null;
    for (let i = 1; i <= opts.pullsPerAccount; i++) {
      const r = pullOnce(b, s, roll, target);
      s = r.state;
      if (r.result.rarity === 5) counts.five++;
      else if (r.result.rarity === 4) counts.four++;
      else counts.three++;
      if (r.result.outcome === 'target' || r.result.outcome === 'guaranteed') {
        targets++;
        got ??= i;
      }
    }
    if (got !== null) firstTarget.push(got);
  }
  firstTarget.sort((x, y) => x - y);
  const total = opts.accounts * opts.pullsPerAccount;
  const pct = (p: number): number => firstTarget[Math.min(firstTarget.length - 1, Math.floor(p * firstTarget.length))] as number;
  return {
    accounts: opts.accounts,
    pullsPerAccount: opts.pullsPerAccount,
    rarity: { three: counts.three / total, four: counts.four / total, five: counts.five / total },
    targetRate: b.featured ? targets / total : null,
    pullsToTarget: firstTarget.length ? { p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: firstTarget[firstTarget.length - 1] as number } : null
  };
}
