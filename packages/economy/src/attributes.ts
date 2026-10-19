import { z } from 'zod';

/**
 * The four RPG attributes (D-27, docs/combat/STAT_MATH.md). Units and gear are authored in STR / INT / VIT / AGI; the combat
 * stats the engine runs on (HP, ATK, DEF, SPD, crit, effect hit) are derived from them by `deriveStats`, the one formula the
 * engine, the server and the content tools share. Content without an attribute block keeps its original stat contract.
 */
export const ATTRIBUTES = ['str', 'int', 'vit', 'agi'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export type AttributeValues = Record<Attribute, number>;

const Value = z.number().min(0).max(1000);
export const AttributeBlock = z
  .object({
    /** the attribute that is this unit's ATK: weapon power, damage, healing and ATK-scaled shields all use it */
    power: z.enum(['str', 'int']),
    base: z.object({ str: Value, int: Value, vit: Value.min(1), agi: Value.min(1) }).strict(),
    growth: z.object({ str: Value, int: Value, vit: Value, agi: Value }).partial().strict().optional(),
    /** natural DEF (hides, plate, constructs, a tank's shield craft); everything else comes from equipped armor */
    armor: z.number().int().min(0).max(100).optional()
  })
  .strict();
export type AttributeBlock = z.infer<typeof AttributeBlock>;

/** Fixed derivation constants. shortcut: tuned in code together with tools/build_campaign.ts's probe; move to data if the Control Center must edit them. */
export const ATTRIBUTE_RULES = {
  hpBase: 4,
  hpPerVit: 3,
  critPerAgi: 0.02,
  critCap: 0.4,
  critDamage: 1.5,
  /** each AGI point past the crit cap (AGI 20) adds this much crit damage instead */
  critDamagePerAgiOverCap: 0.05,
  /** INT pierces the target's status resistance */
  effectHitPerInt: 0.01
} as const;

export interface DerivedStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit_rate: number;
  crit_damage: number;
  effect_hit: number;
}

/** Memory Shard resonance for attribute characters: whole points, odd tiers +1 VIT, even tiers +1 power (legacy catalogs: +1% per tier) */
export const resonancePoints = (tier: number): { vit: number; power: number } => ({ vit: Math.ceil(Math.max(0, tier) / 2), power: Math.floor(Math.max(0, tier) / 2) });

const half = (x: number): number => Math.floor(x + 0.5 + 1e-9);
const r3 = (x: number): number => Math.round(x * 1000) / 1000;

/** Attributes at a level plus flat attribute points (gear, sets, resonance); `power` points go to the unit's power attribute. Rounded half up, as shown to the player. */
export function attributesAt(block: AttributeBlock, level: number, bonus: Partial<Record<Attribute | 'power', number>> = {}): AttributeValues {
  const out = {} as AttributeValues;
  for (const k of ATTRIBUTES) out[k] = Math.max(0, half(block.base[k] + (block.growth?.[k] ?? 0) * (level - 1) + (bonus[k] ?? 0) + (k === block.power ? (bonus.power ?? 0) : 0)));
  return out;
}

/** Combat stats from (already rounded) attributes. `armor` is DEF from equipment, added to the unit's natural armor. DEF reduces every kind of damage. */
export function deriveStats(block: AttributeBlock, a: AttributeValues, armor = 0): DerivedStats {
  const R = ATTRIBUTE_RULES;
  const overCap = Math.max(0, a.agi - R.critCap / R.critPerAgi);
  return {
    hp: Math.max(1, R.hpBase + R.hpPerVit * a.vit),
    atk: a[block.power],
    // DEF is armor only (natural + equipped); VIT is HP only, so high-HP units are not also hard to hurt
    def: (block.armor ?? 0) + Math.max(0, half(armor)),
    spd: Math.max(1, a.agi),
    crit_rate: r3(Math.min(R.critCap, R.critPerAgi * a.agi)),
    crit_damage: r3(R.critDamage + R.critDamagePerAgiOverCap * overCap),
    effect_hit: r3(R.effectHitPerInt * a.int)
  };
}
