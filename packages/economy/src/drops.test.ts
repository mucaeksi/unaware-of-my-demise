import { describe, expect, it } from 'vitest';
import { DropConfig, rollEntries, type DropEntry, type DropPools } from './drops';

const pools: DropPools = {
  gear: (slot, rarities) => (slot === 'weapon' ? rarities.map((r) => `w${r}`) : []),
  bossSet: (setId, rarity) => [`${setId}_necklace_${rarity}`, `${setId}_ring_${rarity}`]
};
const seq = (...xs: number[]): (() => number) => {
  let i = 0;
  return () => xs[i++ % xs.length] as number;
};

describe('drop rolls', () => {
  it('rolls each entry independently by chance and quantity range', () => {
    const entries: DropEntry[] = [
      { kind: 'currency', min: 5, max: 9, chance: 1 },
      { kind: 'item', itemId: 'forge_dust', min: 1, max: 2, chance: 0.5 },
      { kind: 'account_xp', amount: 50, chance: 1 }
    ];
    // currency: qty roll 0.99 -> max; item chance roll 0.4 passes, qty 0.0 -> min
    expect(rollEntries(entries, seq(0.99, 0.4, 0), pools)).toEqual([
      { type: 'currency', currency: 'eclipse_token', amount: 9 },
      { type: 'item', itemId: 'forge_dust', quantity: 1 },
      { type: 'account_xp', amount: 50 }
    ]);
    // item chance roll 0.6 fails: nothing for it
    expect(rollEntries(entries, seq(0, 0.6), pools).map((g) => g.type)).toEqual(['currency', 'account_xp']);
  });

  it('resolves pools and boss sets, and drops nothing when a pool is empty', () => {
    const e: DropEntry[] = [
      { kind: 'gear_pool', slot: 'weapon', rarities: [3, 4], chance: 1 },
      { kind: 'gear_pool', slot: 'armor', rarities: [3], chance: 1 },
      { kind: 'boss_set', rarity: 4, chance: 1 }
    ];
    expect(rollEntries(e, seq(0.99, 0.99), pools, { bossSetId: 'ash_maw_hide' })).toEqual([
      { type: 'gear', gearId: 'w4' },
      { type: 'gear', gearId: 'ash_maw_hide_ring_4' }
    ]);
    expect(rollEntries(e, seq(0), pools)).toEqual([{ type: 'gear', gearId: 'w3' }]); // no boss set on this node: the entry yields nothing
  });

  it('statistics: a 35% entry hits about 35% of the time', () => {
    let s = 12345;
    const rng = (): number => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    let hits = 0;
    for (let i = 0; i < 20000; i++) hits += rollEntries([{ kind: 'boss_set', rarity: 4, chance: 0.35 }], rng, pools, { bossSetId: 'x' }).length;
    expect(hits / 20000).toBeGreaterThan(0.33);
    expect(hits / 20000).toBeLessThan(0.37);
  });

  it('rejects an inverted quantity range', () => {
    expect(DropConfig.safeParse({ tables: { t: { repeat: [{ kind: 'currency', min: 9, max: 5, chance: 1 }], firstClear: [] } } }).success).toBe(false);
  });
});
