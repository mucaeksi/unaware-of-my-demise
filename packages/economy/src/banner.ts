import { z } from 'zod';

/**
 * Banner definition. Pure data (editable in the Control Center, validated before it can be activated).
 * Canonical numbers: narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/economy_part1.json (design 2026-09-27.1).
 */
const Id = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);
const Rate = z.number().min(0).max(1);

export const FeaturedRule = z
  .object({
    /** chance that an unprotected five-star is the target */
    chance: Rate,
    /** a lost 50/50 (non-target five-star) counts one "knot"; after `lossesToGuarantee` the next five-star is the target.
     *  Character banners: 1 (the lost-featured guarantee). Signature weapons: 2 (Fate Knots). */
    lossesToGuarantee: z.number().int().min(1).max(10),
    /** fixed: the single entry of `fiveFeatured`; selectable: the player picks one of `fiveFeatured` per pull */
    targetMode: z.enum(['fixed', 'selectable'])
  })
  .strict();

export const SoftPity = z
  .object({
    /** first pull number with an increased five-star probability */
    startPull: z.number().int().min(2),
    /** added to the probability for every pull from `startPull` on (0.06 = six percentage points) */
    increment: z.number().positive().max(1)
  })
  .strict();

export const BannerConfig = z
  .object({
    id: Id,
    kind: z.enum(['character', 'weapon']),
    /** optional key-art reference in ArtManifest.ui (e.g. `banner_hall_of_ancestors`) */
    artKey: Id.optional(),
    /** banners with the same group share pity, the 4-star counter and the knot counter (per account) */
    pityGroup: Id,
    hardPity: z.number().int().min(1).max(500),
    baseFiveStarRate: Rate,
    softPity: SoftPity.nullable(),
    /** null = no featured item (permanent character banner): the five-star is drawn uniformly from `fiveOther` */
    featured: FeaturedRule.nullable(),
    /** relative weights of 4-star and 3-star among non-five-star results (canon 17 : 81) */
    fourStarWeight: z.number().positive(),
    threeStarWeight: z.number().positive(),
    /** every N-th pull without a 4-star-or-better is upgraded to a 4-star (canon 10) */
    minFourStarEvery: z.number().int().min(2),
    /** price of one pull in the single main currency (D-17); data, so a banner or event can price itself differently */
    costPerPull: z.number().int().min(1).max(1_000_000).default(160),
    pools: z
      .object({
        fiveFeatured: z.array(Id).max(64),
        fiveOther: z.array(Id).max(256),
        four: z.array(Id).min(1).max(512),
        three: z.array(Id).min(1).max(512)
      })
      .strict()
  })
  .strict()
  .superRefine((b, ctx) => {
    const bad = (path: string, message: string): void => void ctx.addIssue({ code: 'custom', path: [path], message });
    if (b.softPity && b.softPity.startPull > b.hardPity) bad('softPity', 'soft pity must start at or before the hard pity');
    if (b.baseFiveStarRate <= 0) bad('baseFiveStarRate', 'a banner needs a positive base five-star rate');
    if (b.featured) {
      if (b.pools.fiveFeatured.length === 0) bad('pools', 'featured banners need fiveFeatured items');
      if (b.featured.targetMode === 'fixed' && b.pools.fiveFeatured.length !== 1) bad('pools', 'a fixed target needs exactly one featured item');
      if (b.featured.chance < 1 && b.pools.fiveOther.length === 0 && !(b.featured.targetMode === 'selectable' && b.pools.fiveFeatured.length >= 2)) bad('pools', 'fiveOther is needed when the target can be missed');
    } else if (b.pools.fiveOther.length === 0) bad('pools', 'banners without a featured item need fiveOther items');
    const all = [...b.pools.fiveFeatured, ...b.pools.fiveOther, ...b.pools.four, ...b.pools.three];
    if (new Set(all).size !== all.length) bad('pools', 'an item may appear in only one pool');
  });
export type BannerConfig = z.infer<typeof BannerConfig>;

/** Pity counters of one account in one pity group. */
export interface PityState {
  /** pulls since the last five-star */
  pity5: number;
  /** pulls since the last four-star-or-better */
  pity4: number;
  /** five-stars lost to the off-target pool since the last target (knots / lost-featured guarantee) */
  lost: number;
}
export const emptyPity = (): PityState => ({ pity5: 0, pity4: 0, lost: 0 });

/** Canonical banners (economy_part1.json). Item ids of the pools are filled in from the character/weapon catalogs. */
export const CANON = {
  hardPityCharacter: 80,
  hardPityWeapon: 65,
  baseFiveStar: 0.025,
  standardFiveStar: 0.02,
  softPityStart: 65,
  softPityIncrement: 0.06,
  featuredChance: 0.55,
  fourStarWeight: 17,
  threeStarWeight: 81,
  minFourStarEvery: 10,
  /** D-17: one main currency. A pull costs this many Eclipse Tokens (canon conversion rate 160 : 1 folded into the price) */
  mainCurrency: 'eclipse_token',
  pullCost: 160,
  duplicateShards: { 5: 10, 4: 5, 3: 2 } as Record<3 | 4 | 5, number>
} as const;

/** Pool item ids that the catalogs supply (characters / weapons by rarity). */
export interface CatalogPools {
  four: string[];
  three: string[];
  fiveStandard: string[];
}

const common = { fourStarWeight: CANON.fourStarWeight, threeStarWeight: CANON.threeStarWeight, minFourStarEvery: CANON.minFourStarEvery, costPerPull: CANON.pullCost } as const;

/** Limited character banner (canon: 2.5 %, soft pity from pull 65 (+6 pp), hard pity 80, 55 % target, lost-target guarantee). */
export function limitedCharacterBanner(id: string, featured: string, c: CatalogPools, artKey = `banner_${id}`): BannerConfig {
  return BannerConfig.parse({
    id,
    kind: 'character',
    artKey,
    pityGroup: 'limited_character',
    hardPity: CANON.hardPityCharacter,
    baseFiveStarRate: CANON.baseFiveStar,
    softPity: { startPull: CANON.softPityStart, increment: CANON.softPityIncrement },
    featured: { chance: CANON.featuredChance, lossesToGuarantee: 1, targetMode: 'fixed' },
    ...common,
    pools: { fiveFeatured: [featured], fiveOther: c.fiveStandard, four: c.four, three: c.three }
  });
}

/** Permanent character banner (Hall of Ancestors): 2 %, hard pity 80, no soft pity, no featured item, separate counters. */
export function standardCharacterBanner(id: string, c: CatalogPools, artKey = `banner_${id}`): BannerConfig {
  return BannerConfig.parse({
    id,
    kind: 'character',
    artKey,
    pityGroup: 'standard_character',
    hardPity: CANON.hardPityCharacter,
    baseFiveStarRate: CANON.standardFiveStar,
    softPity: null,
    featured: null,
    ...common,
    pools: { fiveFeatured: [], fiveOther: c.fiveStandard, four: c.four, three: c.three }
  });
}

/** Signature weapon banner (canon: 2.5 %, hard pity 65, no soft pity, 55 % target, two Fate Knots guarantee the target).
 *  `selectable` = Hall of Armaments (the player picks the target); limited banners have a fixed signature weapon. */
export function weaponBanner(id: string, targets: string[], others: string[], c: Pick<CatalogPools, 'four' | 'three'>, selectable: boolean, artKey = `banner_${id}`): BannerConfig {
  return BannerConfig.parse({
    id,
    kind: 'weapon',
    artKey,
    pityGroup: 'weapon',
    hardPity: CANON.hardPityWeapon,
    baseFiveStarRate: CANON.baseFiveStar,
    softPity: null,
    featured: { chance: CANON.featuredChance, lossesToGuarantee: 2, targetMode: selectable ? 'selectable' : 'fixed' },
    ...common,
    pools: { fiveFeatured: targets, fiveOther: others, four: c.four, three: c.three }
  });
}
