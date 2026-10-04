// Equipment compatibility and accessory set resolution (port of core/equipment/equipment.gd, LEGACY core/equipment.py).
// Invalid content (a malformed slot list or set bonus) throws EquipmentContentError where the reference raises ValueError.
import { pyRepr, type AccessoryTemplate, type Armor, type Character, type ContentRegistry, type Weapon } from "./content";

export class EquipmentContentError extends Error {}

/** A content-authored percentage stat modifier from an accessory set. */
export interface StatModifier {
  stat_id: string;
  value_pct: number;
}

export class Equipment {
  constructor(private readonly registry: ContentRegistry) {}

  private accessorySlots(): string[] {
    const raw = this.registry.accessory_slots;
    const valid =
      Array.isArray(raw) &&
      raw.length > 0 &&
      raw.every((slot, index) => typeof slot === "string" && slot.length > 0 && raw.indexOf(slot) === index);
    if (!valid) throw new EquipmentContentError("accessories_part1.json has an invalid accessory_slots list");
    return raw as string[];
  }

  private armorSlotCount(): number {
    const raw = this.registry.armor_slot_count;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) throw new EquipmentContentError("armors_part1.json has an invalid armor_slot_count");
    return raw;
  }

  /**
   * Whether a weapon is legal for this character. A character's own signature weapon is allowed explicitly; any other
   * character's signature weapon is rejected before the shared weapon-family check, even if its family matches.
   */
  canEquipWeapon(character: Character, weapon: Weapon): boolean {
    if (weapon.weapon_id === character.signature_weapon_id) return true;
    if (weapon.owner_character_id !== null && weapon.owner_character_id !== character.character_id) return false;
    for (const other of this.registry.characters.values()) {
      if (other.character_id !== character.character_id && other.signature_weapon_id === weapon.weapon_id) return false;
    }
    return weapon.weapon_type === character.equip_weapon_type;
  }

  /** All loadout validation errors (order and count are contractual); an empty list means valid. */
  validateLoadout(
    character: Character,
    weapon: Weapon,
    armor: Armor | null,
    necklace: AccessoryTemplate | null,
    ring: AccessoryTemplate | null,
  ): string[] {
    const errors: string[] = [];
    if (!this.canEquipWeapon(character, weapon)) {
      errors.push(
        `${character.name_en} cannot equip weapon ${weapon.weapon_id}; expected signature ${pyRepr(character.signature_weapon_id)} ` +
          `or weapon type ${pyRepr(character.equip_weapon_type)}.`,
      );
    }
    const armorSlots = this.armorSlotCount();
    if (armorSlots !== 1) errors.push(`Part I requires exactly one armor slot; catalog declares ${armorSlots}.`);
    if (armor === null) errors.push("Exactly one armor item is required in the 'armor' slot.");
    else if (armor.slot !== "armor") errors.push("The armor item must occupy the single 'armor' slot.");
    const slots = this.accessorySlots();
    if (necklace === null) errors.push("Exactly one accessory is required in the 'necklace' slot.");
    else if (!slots.includes("necklace") || necklace.slot !== "necklace") errors.push("The necklace accessory must use the 'necklace' slot.");
    if (ring === null) errors.push("Exactly one accessory is required in the 'ring' slot.");
    else if (!slots.includes("ring") || ring.slot !== "ring") errors.push("The ring accessory must use the 'ring' slot.");
    return errors;
  }

  /** The authored set modifier when the equipped pieces meet its gate, else null. */
  resolveSetBonus(necklace: AccessoryTemplate, ring: AccessoryTemplate): StatModifier | null {
    if (necklace.slot !== "necklace" || ring.slot !== "ring" || necklace.set_id !== ring.set_id) return null;
    const set = this.registry.accessory_sets[necklace.set_id];
    if (!set) return null;
    const pieces = set.pieces_for_bonus;
    const statId = set.bonus_stat_id;
    const valuePct = set.bonus_value_pct;
    if (typeof pieces !== "number" || typeof valuePct !== "number") {
      throw new EquipmentContentError(`Accessory set ${pyRepr(necklace.set_id)} has an invalid bonus definition`);
    }
    const required = Math.trunc(pieces);
    if (required <= 0 || typeof statId !== "string" || statId.length === 0) {
      throw new EquipmentContentError(`Accessory set ${pyRepr(necklace.set_id)} has an invalid bonus threshold/stat`);
    }
    if (required > 2) return null;
    return { stat_id: statId, value_pct: valuePct };
  }
}
