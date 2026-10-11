import type { BannerConfig, PityState } from './banner';

export type Rarity = 3 | 4 | 5;
/** a source of uniform floats in [0, 1); the server passes a CSPRNG, tests and simulations a seeded one */
export type Roll = () => number;

export class GachaError extends Error {
  constructor(
    public readonly code: 'invalid_target' | 'invalid_count' | 'invalid_banner',
    message: string
  ) {
    super(message);
  }
}

export interface PullResult {
  /** 1-based pull number inside the current pity cycle (what the player sees as "pull 37 / 80") */
  pullNumber: number;
  rarity: Rarity;
  itemId: string;
  /** unconditional probability that this pull is a five-star (shown in the rate screen / audited) */
  fiveStarChance: number;
  /** 'target' = got the featured item, 'guaranteed' = target by the loss guarantee, 'off' = lost the 50/50, 'standard' = no featured rule */
  outcome: 'target' | 'guaranteed' | 'off' | 'standard' | 'n/a';
  /** a 3-star that was raised to a 4-star by the minimum-4-star rule */
  upgraded: boolean;
  /** raw rolls consumed, in order: kept in the journal so a pull can be re-derived and audited */
  rolls: number[];
}

/** Unconditional probability that pull number `pullNumber` (1-based since the last five-star) is a five-star. */
export function fiveStarRate(b: BannerConfig, pullNumber: number): number {
  if (pullNumber >= b.hardPity) return 1;
  if (b.softPity && pullNumber >= b.softPity.startPull) {
    return Math.min(1, b.baseFiveStarRate + b.softPity.increment * (pullNumber - (b.softPity.startPull - 1)));
  }
  return b.baseFiveStarRate;
}

/** Single pull. Pure: returns the result and the next state; never mutates its inputs. */
export function pullOnce(banner: BannerConfig, state: PityState, roll: Roll, target?: string): { result: PullResult; state: PityState } {
  const rolls: number[] = [];
  const draw = (): number => {
    const v = roll();
    if (!(v >= 0 && v < 1)) throw new GachaError('invalid_banner', 'roll source returned a value outside [0, 1)');
    rolls.push(v);
    return v;
  };
  const pick = (pool: readonly string[]): string => pool[Math.min(pool.length - 1, Math.floor(draw() * pool.length))] as string;

  const f = banner.featured;
  let chosenTarget: string | undefined;
  if (f) {
    chosenTarget = f.targetMode === 'fixed' ? banner.pools.fiveFeatured[0] : target;
    if (!chosenTarget || !banner.pools.fiveFeatured.includes(chosenTarget)) {
      throw new GachaError('invalid_target', 'this banner needs a valid target among its featured items');
    }
  }

  const pullNumber = state.pity5 + 1;
  const p5 = fiveStarRate(banner, pullNumber);
  const u = draw();
  let rarity: Rarity;
  if (pullNumber >= banner.hardPity || u < p5) {
    rarity = 5;
  } else {
    // remaining probability keeps the base 4 : 3 ratio
    const v = (u - p5) / (1 - p5);
    rarity = v < banner.fourStarWeight / (banner.fourStarWeight + banner.threeStarWeight) ? 4 : 3;
  }
  let upgraded = false;
  if (rarity === 3 && state.pity4 + 1 >= banner.minFourStarEvery) {
    rarity = 4;
    upgraded = true;
  }

  let itemId: string;
  let outcome: PullResult['outcome'] = 'n/a';
  let lost = state.lost;
  if (rarity === 5) {
    if (!f) {
      itemId = pick(banner.pools.fiveOther);
      outcome = 'standard';
    } else {
      const protectedPull = state.lost >= f.lossesToGuarantee;
      if (protectedPull) {
        itemId = chosenTarget as string;
        outcome = 'guaranteed';
        lost = 0;
      } else if (draw() < f.chance) {
        itemId = chosenTarget as string;
        outcome = 'target';
        lost = 0;
      } else {
        itemId = pick(banner.pools.fiveOther);
        outcome = 'off';
        lost = state.lost + 1;
      }
    }
  } else {
    itemId = pick(rarity === 4 ? banner.pools.four : banner.pools.three);
  }

  const next: PityState = {
    pity5: rarity === 5 ? 0 : pullNumber,
    pity4: rarity >= 4 ? 0 : state.pity4 + 1,
    lost
  };
  return { result: { pullNumber, rarity, itemId, fiveStarChance: p5, outcome, upgraded, rolls }, state: next };
}

/** N pulls in order (single and ten-pulls are identical: no discount, no extra rate). */
export function pullMany(banner: BannerConfig, state: PityState, count: number, roll: Roll, target?: string): { results: PullResult[]; state: PityState } {
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new GachaError('invalid_count', 'a pull request is 1..10 pulls');
  const results: PullResult[] = [];
  let s = state;
  for (let i = 0; i < count; i++) {
    const r = pullOnce(banner, s, roll, target);
    results.push(r.result);
    s = r.state;
  }
  return { results, state: s };
}
