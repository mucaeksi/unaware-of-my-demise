import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AccessoryError, AccessoryRoller, rollValueFrom, type AccessoryInstance } from "../../src/engine/accessories";
import { loadPacks, PACK_FILES, type PackName } from "../../src/engine/content";
import { Equipment } from "../../src/engine/equipment";
import { loadFixture } from "./fixtures";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");
const registry = loadPacks(
  Object.fromEntries(PACK_FILES.map((name) => [name, JSON.parse(readFileSync(join(CONTENT, name), "utf8"))])) as Record<PackName, unknown>,
);

describe("Equipment against parity/fixtures/equipment_rules.json", () => {
  const equipment = new Equipment(registry);
  const rules = loadFixture<{ cases: Record<string, any>[] }>("equipment_rules").cases[0]!;

  it("can_equip_weapon for every character and weapon", () => {
    for (const row of rules.can_equip) {
      const character = registry.characters.get(row.character_id)!;
      const allowed = [...registry.weapons.values()].filter((weapon) => equipment.canEquipWeapon(character, weapon)).map((weapon) => weapon.weapon_id);
      expect(allowed, row.character_id).toEqual(row.weapon_ids);
    }
  });

  it("set bonus for every necklace and ring", () => {
    expect(rules.set_bonus.length).toBeGreaterThan(0);
    for (const row of rules.set_bonus) {
      const bonus = equipment.resolveSetBonus(registry.accessories.get(row.necklace_id)!, registry.accessories.get(row.ring_id)!);
      expect(bonus, `${row.necklace_id} + ${row.ring_id}`).toEqual(row.bonus);
    }
  });

  it("validate_loadout variants: errors in order", () => {
    for (const row of rules.validate_loadout) {
      const errors = equipment.validateLoadout(
        registry.characters.get(row.character_id)!,
        registry.weapons.get(row.weapon_id)!,
        row.armor_id === null ? null : registry.armors.get(row.armor_id)!,
        row.necklace_id === null ? null : registry.accessories.get(row.necklace_id)!,
        row.ring_id === null ? null : registry.accessories.get(row.ring_id)!,
      );
      expect(errors.length, row.variant).toBe(row.error_count);
      expect(errors, row.variant).toEqual(row.errors);
    }
  });
});

describe("AccessoryRoller against parity/fixtures/accessories.json", () => {
  const roller = new AccessoryRoller(registry.accessories);
  const fixture = loadFixture<{ cases: Record<string, any>[] }>("accessories").cases[0]!;

  it("every template and seed", () => {
    expect(fixture.drops.length).toBe(42 * 6);
    for (const drop of fixture.drops) expect(roller.rollDropSeeded(drop.accessory_id, BigInt(drop.seed)), `${drop.accessory_id} seed ${drop.seed}`).toEqual(drop.item);
  });

  it("stress rolls of the five-star templates", () => {
    for (const entry of fixture.stress) {
      entry.rolls.forEach((expected: unknown, seed: number) => {
        const item = roller.rollDropSeeded(entry.accessory_id, seed);
        const actual = [item.main_stat.stat_id, item.main_stat.value, item.sub_stats.map((sub) => [sub.stat_id, sub.value])];
        expect(actual, `${entry.accessory_id} seed ${seed}`).toEqual(expected);
      });
    }
  });

  it("five-step reroll chains", () => {
    for (const chain of fixture.rerolls) {
      let item = roller.rollDropSeeded(chain.accessory_id, BigInt(chain.start_seed));
      let inventory = { items: { [chain.token]: 40 }, equipment: [item] };
      for (const step of chain.steps) {
        ({ item, inventory } = roller.rerollSeeded(item, inventory, BigInt(step.seed)));
        expect(item, `${chain.accessory_id} after seed ${step.seed}`).toEqual(step.item);
        expect(inventory, `${chain.accessory_id} inventory after seed ${step.seed}`).toEqual(step.inventory);
      }
    }
  });

  it("reroll failure paths reject and consume nothing", () => {
    const templates = [...registry.accessories.values()];
    const profile = (template: (typeof templates)[number]) => template.rarity_profiles[String(template.rarity)] as Record<string, any>;
    const rerollable = templates.find((template) => profile(template).is_rerollable)!;
    const fixedRarity = templates.find((template) => !profile(template).is_rerollable)!;
    const fixed = roller.rollDropSeeded(rerollable.accessory_id, 5);
    const tokenId = profile(rerollable).reroll_cost.item_id as string;
    const locked: AccessoryInstance = { ...structuredClone(fixed), locked: true };
    const threeStar = roller.rollDropSeeded(fixedRarity.accessory_id, 5);
    const cases: Record<string, [AccessoryInstance, { items: Record<string, number>; equipment: AccessoryInstance[] }]> = {
      not_enough_tokens: [fixed, { items: { [tokenId]: 0 }, equipment: [fixed] }],
      locked: [locked, { items: { [tokenId]: 9 }, equipment: [locked] }],
      not_rerollable_rarity: [threeStar, { items: { any: 9 }, equipment: [threeStar] }],
      instance_not_in_inventory: [fixed, { items: { [tokenId]: 9 }, equipment: [] }],
    };
    expect(fixture.failures.length).toBe(5);
    for (const row of fixture.failures) {
      if (row.name === "unknown_template") {
        expect(() => roller.rollDropSeeded("no_such_accessory", 1)).toThrow(AccessoryError);
        continue;
      }
      const [item, inventory] = cases[row.name]!;
      const before = structuredClone(inventory);
      expect(() => roller.rerollSeeded(item, inventory, 1), row.name).toThrow(AccessoryError);
      expect(inventory, `${row.name} leaves the inventory untouched`).toEqual(before);
    }
  });

  it("the half-up rounding rule on exact fractions k/32", () => {
    expect(fixture.roll_values.length).toBeGreaterThan(5);
    for (const entry of fixture.roll_values) {
      const row = { stat_id: "x", min_value: entry.min, max_value: entry.max, unit: entry.unit };
      entry.values.forEach((value: number, k: number) => expect(rollValueFrom(row, k / 32).value, `${entry.min}..${entry.max} at ${k}/32`).toBe(value));
    }
  });
});
