// Mutable, battle-local unit (port of core/battle/battle_unit.gd, LEGACY core/battle/models.py BattleUnit). Content
// records stay immutable; HP, gauge, statuses and shields change during one encounter. Statuses, shields and modifiers
// are plain dictionaries with the reference's key names: they are part of the event/replay contract.
//
// Data fields keep the reference dataclass names (snake_case); `str | None` fields are "" when absent. Build units with
// `BattleUnit.build({...})`, which applies the reference's `__post_init__` (max_hp/hp defaults, row from slot, HP clamp).
import { Frac } from "../frac";
import { addUnique, dget, dgetArray, dgetDict, toFloat, toInt, type Dict } from "./util";

export interface BattleUnitOptions {
  entity_id?: string;
  team?: string;
  slot_index?: number;
  stats?: Dict;
  hp?: number | null;
  max_hp?: number | null;
  element?: string;
  row?: string;
  weaknesses?: readonly string[];
  resistances?: readonly string[];
  status_immunities?: readonly string[];
  faction_id?: string;
  tags?: readonly string[];
  stat_resolution_rules?: Dict;
  status_definitions?: Dict;
  is_boss?: boolean;
  is_objective?: boolean;
  objective_id?: string;
  level?: number;
  enemy_id?: string;
  temporary?: boolean;
}

const unique = (items: readonly unknown[]): string[] => {
  const target: string[] = [];
  for (const item of items) addUnique(target, String(item));
  return target;
};

export class BattleUnit {
  entity_id = "";
  team = "";
  slot_index = 0;
  /** Stat id -> number. `status_immunities_runtime` (an array of dictionaries) also lives here. */
  stats: Dict = {};
  hp = 0;
  max_hp = 0;
  element = "";
  row = "";
  weaknesses: string[] = [];
  resistances: string[] = [];
  status_immunities: string[] = [];
  faction_id = "";
  /** A set: unique entries. */
  tags: string[] = [];
  stat_resolution_rules: Dict = {};
  status_definitions: Dict = {};
  statuses = new Map<string, Dict>();
  shields: Dict[] = [];
  stat_modifiers: Dict[] = [];
  damage_modifiers: Dict[] = [];
  redirects: Dict[] = [];
  counters: Dict[] = [];
  next_attack_bonuses: Dict[] = [];
  /** skill id -> turns */
  cooldowns = new Map<string, number>();
  focus = 0;
  gauge: Frac = Frac.of(0);
  pending_delay_gauge: Frac = Frac.of(0);
  alive = true;
  is_boss = false;
  is_objective = false;
  objective_id = "";
  level = 1;
  enemy_id = "";
  temporary = false;
  /** skill id -> rank (absent = rank 1). Set from the player's saved ranks; enemies never have ranks. */
  skill_ranks = new Map<string, number>();
  hit_focus_gained_this_turn = 0;
  has_acted = false;
  damage_taken_this_round = 0;
  /** Hits still blocked by `block_attack` (the reference sets this attribute dynamically). */
  blocked_attack_hits = 0;

  /** Builds a unit from keyword-style options (the reference dataclass names) and runs `__post_init__`. */
  static build(options: BattleUnitOptions): BattleUnit {
    const unit = new BattleUnit();
    if (options.entity_id !== undefined) unit.entity_id = options.entity_id;
    if (options.team !== undefined) unit.team = options.team;
    if (options.slot_index !== undefined) unit.slot_index = options.slot_index;
    if (options.stats !== undefined) unit.stats = options.stats;
    if (options.hp !== undefined && options.hp !== null) unit.hp = options.hp;
    if (options.max_hp !== undefined && options.max_hp !== null) unit.max_hp = options.max_hp;
    if (options.element !== undefined) unit.element = options.element;
    if (options.row !== undefined) unit.row = options.row;
    if (options.weaknesses !== undefined) unit.weaknesses = unique(options.weaknesses);
    if (options.resistances !== undefined) unit.resistances = unique(options.resistances);
    if (options.status_immunities !== undefined) unit.status_immunities = unique(options.status_immunities);
    if (options.faction_id !== undefined) unit.faction_id = options.faction_id;
    if (options.tags !== undefined) unit.tags = unique(options.tags);
    if (options.stat_resolution_rules !== undefined) unit.stat_resolution_rules = options.stat_resolution_rules;
    if (options.status_definitions !== undefined) unit.status_definitions = options.status_definitions;
    if (options.is_boss !== undefined) unit.is_boss = options.is_boss;
    if (options.is_objective !== undefined) unit.is_objective = options.is_objective;
    if (options.objective_id !== undefined) unit.objective_id = options.objective_id;
    if (options.level !== undefined) unit.level = options.level;
    if (options.enemy_id !== undefined) unit.enemy_id = options.enemy_id;
    if (options.temporary !== undefined) unit.temporary = options.temporary;
    if (options.max_hp === undefined || options.max_hp === null) unit.max_hp = Math.max(1, toInt(dget(unit.stats, "hp", 1)));
    if (options.hp === undefined || options.hp === null) unit.hp = unit.max_hp;
    if (options.row === undefined || options.row.length === 0) unit.row = unit.slot_index < 2 ? "front" : "rear";
    unit.hp = Math.max(0, Math.min(unit.hp, unit.max_hp));
    unit.alive = unit.alive && unit.hp > 0;
    return unit;
  }

  /** GDD-compatible alias used by the Action Gauge pseudocode. */
  unitId(): string {
    return this.entity_id;
  }

  effectiveSpeed(): number {
    return Math.max(1, this.effectiveStat("spd"));
  }

  shieldTotal(): number {
    let total = 0;
    for (const layer of this.shields) total += Math.max(0, toInt(dget(layer, "amount", 0)));
    return total;
  }

  /** Resolved stat with modifiers and status multipliers, rounded half up (the contract; Python's round() is banker's). */
  effectiveStat(statId: string): number {
    const base = toFloat(dget(this.stats, statId, 0));
    let flat = 0.0;
    let pct = 0.0;
    for (const modifier of this.stat_modifiers) {
      if (dget(modifier, "stat_id") === statId) {
        if (dget(modifier, "mode") === "flat") flat += toFloat(dget(modifier, "amount", 0));
        else if (dget(modifier, "mode") === "percent") pct += toFloat(dget(modifier, "amount", 0));
      }
    }
    let statusMultiplier = 1.0;
    const fracture = this.statuses.get("fracture");
    if (statId === "def" && fracture !== undefined) {
      const definition = dgetDict(this.status_definitions, "fracture");
      statusMultiplier *= toFloat(dget(fracture, "def_multiplier", dget(definition, "def_multiplier", 0.85)));
    }
    const value = (base + flat) * (1.0 + pct) * statusMultiplier;
    const result = value >= 0.0 ? Math.trunc(value + 0.5) : Math.trunc(value - 0.5);
    if (statId === "hp") return Math.max(toInt(dget(this.stat_resolution_rules, "minimum_hp", 1)), result);
    if (statId === "def" || statId === "res") {
      let resolved = Math.max(toInt(dget(this.stat_resolution_rules, "minimum_defense", 0)), result);
      const hasRes = Object.hasOwn(this.stats, "res");
      const dawnward = this.statuses.get("dawnward");
      if (dawnward !== undefined && (statId === "res" || (statId === "def" && !hasRes))) {
        const dawnDefinition = dgetDict(this.status_definitions, "dawnward");
        const bonus = dget(dawnward, "resistance_bonus_pct", dget(dawnDefinition, "resistance_bonus_pct", 0.1));
        resolved = Math.trunc(resolved * (1.0 + toFloat(bonus)) + 0.5);
      }
      return resolved;
    }
    if (statId === "spd") return Math.max(toInt(dget(this.stat_resolution_rules, "minimum_speed", 1)), result);
    return result;
  }

  hasStatus(statusId: string): boolean {
    const status = this.statuses.get(statusId);
    return status !== undefined && toInt(dget(status, "duration_turns", 0)) > 0;
  }

  /** Tags of one status: its own `tags` plus the definition's (unit_status_tags in the reference). */
  statusTags(statusId: string, definitions: Dict): string[] {
    const found: string[] = [];
    const status = this.statuses.get(statusId) ?? {};
    for (const tag of dgetArray(status, "tags")) addUnique(found, String(tag));
    const definition = dgetDict(definitions, statusId);
    for (const tag of dgetArray(definition, "tags")) addUnique(found, String(tag));
    return found;
  }
}
