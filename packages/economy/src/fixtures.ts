import { ProgressionConfig } from './progression';

/** canon values (battle_rules_part1.json), fees converted at 100 crowns = 1 unit */
export const CANON_PROGRESSION = ProgressionConfig.parse({
  note: 'canon with crowns / 100',
  character: {
    levelCap: 20,
    xp: { a: 90, b: 24, c: 8 },
    fee: { base: 1, increment: 0.5 },
    ascension: [
      { cap: 5, accountLevel: 1, items: [], fee: 10 },
      { cap: 10, accountLevel: 5, items: [{ itemId: 'iron_oath_seal', quantity: 3 }], fee: 50 },
      { cap: 15, accountLevel: 10, items: [{ itemId: 'alchemy_core', quantity: 5 }, { itemId: 'iron_oath_seal', quantity: 5 }], fee: 200 },
      { cap: 20, accountLevel: 15, items: [{ itemId: 'bellglass_shard', quantity: 8 }, { itemId: 'alchemy_core', quantity: 8 }], fee: 500 }
    ],
    skills: {
      rankUnlockLevels: [5, 10],
      maxRank: { basic: 3, active: 3, passive: 2, ultimate: 3 },
      itemBySkillType: { basic: 'tactical_notes', active: 'tactical_notes', passive: 'hymn_leaves', ultimate: 'hymn_leaves' },
      quantityPerRank: [3, 6],
      feePerRank: [10, 30]
    }
  },
  account: { levelCap: 20, xp: { base: 250, increment: 50 } },
  equipment: { levelCap: 20, xp: { base: 20, increment: 5 }, fee: { base: 0.5, increment: 0.25 }, xpItemId: 'weapon_tempering_xp', milestoneItemId: 'blacksmith_rivet', milestones: [{ fromLevel: 5, rivets: 1, bonusPct: 0.05 }, { fromLevel: 10, rivets: 2, bonusPct: 0.1 }, { fromLevel: 15, rivets: 3, bonusPct: 0.15 }] }
});
