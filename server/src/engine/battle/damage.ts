// Part I damage resolution with defense type and element kept independent (port of core/battle/damage.gd, LEGACY
// core/battle/damage.py).
//
// Defense selection depends only on the damage type; affinity only on the element and the defender's explicit
// weakness/resistance lists; the two multiply in the final formula. The float operation order is the reference's (all
// doubles), because `floor(raw)` decides the damage.
import { pyRepr } from "../content";
import type { CpythonRandom } from "../random";
import type { BattleUnit } from "./unit";
import { dget, dgetDict, removeFirstEqual, toBool, toFloat, toInt, type Dict } from "./util";

export const ELEMENTS = ["Ember", "Gale", "Stone", "Tide", "Dawn", "Veil"];
export const DAMAGE_TYPES = ["physical", "magic", "elemental"];
export const ELEMENT_CYCLE = ["Ember", "Gale", "Stone", "Tide"];

export interface DamageResult {
  damage: number;
  critical: boolean;
  defense_stat: string;
  effective_defense: number;
  element_multiplier: number;
  raw_damage: number;
  shield_absorbed: number;
  hp_damage: number;
  /** Non-empty when the reference raises ValueError (unknown damage type/element, negative multiplier ...). */
  error: string;
}

const emptyResult = (error = ""): DamageResult => ({
  damage: 0, critical: false, defense_stat: "", effective_defense: 0, element_multiplier: 1.0, raw_damage: 0.0,
  shield_absorbed: 0, hp_damage: 0, error,
});

/**
 * What the formula reads from the attacker: `effective_stat("atk")`, `stats` (crit), statuses and damage modifiers.
 * Non-ATK scale stats get a read-only view (`ScaledAttacker` in the reference).
 */
export interface Attacker {
  atk: number;
  stats: Dict;
  statuses: Map<string, Dict>;
  damage_modifiers: Dict[];
  status_definitions: Dict;
}

export function attackerOfUnit(unit: BattleUnit): Attacker {
  return {
    atk: unit.effectiveStat("atk"),
    stats: unit.stats,
    statuses: unit.statuses,
    damage_modifiers: unit.damage_modifiers,
    status_definitions: unit.status_definitions,
  };
}

/** The read-only ATK view for authored non-ATK scale-stat damage: stats copy with "atk" replaced. */
export function scaledAttacker(unit: BattleUnit, attack: number): Attacker {
  const stats: Dict = { ...unit.stats };
  stats.atk = attack;
  return {
    atk: toInt(dget(stats, "atk", 0)),
    stats,
    statuses: unit.statuses,
    damage_modifiers: unit.damage_modifiers,
    status_definitions: unit.status_definitions,
  };
}

/** Chooses DEF for physical and RES -> DEF fallback for magic/elemental: [stat id, effective defense]. */
export function defenseStatForDamageType(damageType: string, defender: BattleUnit, damageRules: Dict): [string, number] {
  const byType = dgetDict(damageRules, "defense_stat_by_damage_type");
  let statId = String(dget(byType, damageType, damageType === "physical" ? "def" : "res"));
  if (!Object.hasOwn(defender.stats, statId)) statId = String(dget(damageRules, "missing_res_stat_fallback", "def"));
  const value = defender.effectiveStat(statId);
  return [statId, Math.max(0, value)];
}

/** The elemental chart / explicit affinity multiplier; pushes to `errors` where the reference raises ValueError. */
export function elementMultiplier(
  attacking: string,
  defending: string,
  weaknesses: readonly string[],
  resistances: readonly string[],
  damageRules: Dict,
  errors: string[] = [],
): number {
  if (attacking.length === 0 || defending.length === 0) return 1.0;
  if (!ELEMENTS.includes(attacking) || !ELEMENTS.includes(defending)) {
    errors.push(`Unknown element pair: ${pyRepr(attacking)} -> ${pyRepr(defending)}`);
    return 1.0;
  }
  const chart = dgetDict(damageRules, "element_chart");
  for (const element of weaknesses) {
    if (resistances.includes(element)) {
      errors.push(`Element cannot be both weakness and resistance: ${element}`);
      return 1.0;
    }
  }
  if (weaknesses.includes(attacking)) return toFloat(dget(chart, "explicit_target_weakness_multiplier", 1.2));
  if (resistances.includes(attacking)) return toFloat(dget(chart, "explicit_target_resistance_multiplier", 0.9));
  const cycle = dget(chart, "cycle", ELEMENT_CYCLE) as unknown[];
  if (toBool(dget(chart, "attacker_is_strong_against_next_element", true)) && cycle.includes(attacking)) {
    const index = cycle.indexOf(attacking);
    if (defending === String(cycle[(index + 1) % cycle.length])) return toFloat(dget(chart, "advantage_multiplier", 1.2));
    const previous = (((index - 1) % cycle.length) + cycle.length) % cycle.length;
    if (defending === String(cycle[previous])) return toFloat(dget(chart, "disadvantage_multiplier", 0.9));
  } else if ((attacking === "Dawn" && defending === "Veil") || (attacking === "Veil" && defending === "Dawn")) {
    return toFloat(dget(chart, "advantage_multiplier", 1.2));
  }
  return toFloat(dget(chart, "neutral_multiplier", 1.0));
}

function statusMultiplier(statuses: Map<string, Dict>, key: string, definitions: Dict): number {
  let value = 1.0;
  const propertyName = key === "incoming" ? "damage_taken_multiplier" : "outgoing_damage_multiplier";
  for (const [statusId, status] of statuses) {
    const definition = dgetDict(definitions, statusId);
    if (Object.hasOwn(status, propertyName) || Object.hasOwn(definition, propertyName)) {
      const modifier = Object.hasOwn(status, propertyName) ? status[propertyName] : definition[propertyName];
      value *= toFloat(modifier);
    }
  }
  return value;
}

/** Calculates and applies one damage packet to `defender` (its shields, HP and alive flag change). */
export function calculateDamage(
  attacker: Attacker,
  defender: BattleUnit,
  damageType: string,
  element: string,
  multiplier: number,
  rng: CpythonRandom,
  damageRules: Dict,
  statusDefinitions: Dict,
  shieldDamageMultiplier = 1.0,
  applyShields = true,
  modifiers: readonly number[] = [],
  criticalChance: number | null = null,
  criticalMultiplier: number | null = null,
): DamageResult {
  if (!DAMAGE_TYPES.includes(damageType)) return emptyResult(`Unknown damage_type ${pyRepr(damageType)}`);
  if (element.length > 0 && !ELEMENTS.includes(element)) return emptyResult(`Unknown attacking element ${pyRepr(element)}`);
  if (multiplier < 0.0) return emptyResult("Damage multiplier cannot be negative");
  if (shieldDamageMultiplier < 0.0) return emptyResult("Shield damage multiplier cannot be negative");
  const [defenseStat, defenseValue] = defenseStatForDamageType(damageType, defender, damageRules);
  const affinityErrors: string[] = [];
  const affinity = elementMultiplier(element, defender.element, defender.weaknesses, defender.resistances, damageRules, affinityErrors);
  if (affinityErrors.length > 0) return emptyResult(affinityErrors[0]!);
  let other = 1.0;
  other *= statusMultiplier(attacker.statuses, "outgoing", statusDefinitions);
  other *= statusMultiplier(defender.statuses, "incoming", statusDefinitions);
  if (defender.statuses.has("soaked")) {
    const soakedRules = dgetDict(dgetDict(statusDefinitions, "soaked"), "element_damage_taken_multiplier");
    other *= toFloat(dget(soakedRules, element, 1.0));
  }
  for (const amount of modifiers) other *= amount;
  for (const modifier of attacker.damage_modifiers) {
    if (dget(modifier, "kind") === "outgoing" && toInt(dget(modifier, "hits_remaining", 1)) > 0) other *= toFloat(dget(modifier, "multiplier", 1.0));
  }
  for (const modifier of defender.damage_modifiers) {
    if (dget(modifier, "kind") === "incoming" && toInt(dget(modifier, "hits_remaining", 1)) > 0) other *= toFloat(dget(modifier, "multiplier", 1.0));
  }
  let critChance =
    criticalChance !== null ? criticalChance : toFloat(dget(attacker.stats, "crit_rate", dget(damageRules, "critical_chance_default", 0.05)));
  const critCap = toFloat(dget(damageRules, "critical_chance_cap", 1.0));
  critChance = Math.max(0.0, Math.min(critCap, critChance));
  const critMult =
    criticalMultiplier !== null ? criticalMultiplier : toFloat(dget(attacker.stats, "crit_damage", dget(damageRules, "critical_multiplier_default", 1.5)));
  const critical = rng.random() < critChance;
  const defenseScale = toFloat(dget(damageRules, "defense_scale", 10.0));
  if (defenseScale <= 0.0) return emptyResult("Damage defense_scale must be greater than zero");
  const defense = defenseValue;
  let raw = attacker.atk * multiplier * (defenseScale / (defenseScale + Math.max(0, defense))) * affinity * other;
  if (critical) raw *= critMult;
  const resolvedDamage = Math.max(toInt(dget(damageRules, "minimum_final_damage", 1)), Math.floor(raw));
  let absorbed = 0;
  let remaining = resolvedDamage;
  if (applyShields) {
    let shieldBudget = Math.floor(resolvedDamage * shieldDamageMultiplier);
    let shieldPointsConsumed = 0;
    for (const shield of [...defender.shields]) {
      if (shieldBudget <= 0) break;
      const available = Math.max(0, toInt(dget(shield, "amount", 0)));
      const consumed = Math.min(available, shieldBudget);
      shield.amount = available - consumed;
      shieldPointsConsumed += consumed;
      shieldBudget -= consumed;
      if (toInt(shield.amount) <= 0) removeFirstEqual(defender.shields, shield);
    }
    absorbed = shieldPointsConsumed;
    if (shieldDamageMultiplier > 0.0) {
      const preventedBaseDamage = Math.min(resolvedDamage, Math.ceil(shieldPointsConsumed / shieldDamageMultiplier));
      remaining = Math.max(0, resolvedDamage - preventedBaseDamage);
    }
  }
  const hpDamage = Math.min(defender.hp, remaining);
  defender.hp = Math.max(0, defender.hp - hpDamage);
  if (defender.hp <= 0) defender.alive = false;
  defender.damage_taken_this_round += resolvedDamage;
  return {
    damage: resolvedDamage,
    critical,
    defense_stat: defenseStat,
    effective_defense: defense,
    element_multiplier: affinity,
    raw_damage: raw,
    shield_absorbed: absorbed,
    hp_damage: hpDamage,
    error: "",
  };
}

