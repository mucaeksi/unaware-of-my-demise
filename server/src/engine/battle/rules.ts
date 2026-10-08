// The validated rule blocks of battle_rules_part1.json the battle engine reads: `turn_queue` (port of
// core/battle/gauge_rules.gd), `focus` (focus_rules.gd) and `victory_stars` (victory_star_rules.gd).
// Validation failures throw BattleSetupError where the GDScript port sets `error`.
import { pyRepr } from "../content";
import { Frac } from "../frac";
import { BattleSetupError } from "./errors";
import type { BattleUnit } from "./unit";
import { dget, toInt, type Dict } from "./util";

export class GaugeRules {
  static readonly GAUGE_MAX = 10000;

  gauge_max = GaugeRules.GAUGE_MAX;
  effective_speed_floor = 1;
  maximum_pending_delay_fraction: Frac = Frac.of(1, 2);

  static fromMapping(rules: Dict): GaugeRules {
    const result = new GaugeRules();
    result.gauge_max = toInt(rules.gauge_max);
    result.effective_speed_floor = toInt(rules.effective_speed_floor);
    result.maximum_pending_delay_fraction = Frac.fromNumber(rules.maximum_pending_delay_fraction as number);
    return result;
  }

  /** Half a gauge by default: the most a unit's next action can be delayed. */
  maximumPendingDelayGauge(): Frac {
    return this.maximum_pending_delay_fraction.mulInt(this.gauge_max);
  }
}

const isWholeNonNegative = (value: unknown): value is number =>
  typeof value === "number" && value === Math.floor(value) && Math.trunc(value) >= 0;

export class FocusRules {
  maximum = 100;
  basic_attack_gain = 20;
  active_skill_gain = 25;
  taking_hit_gain_per_hit = 5;
  taking_hit_gain_max_per_actor_turn = 15;
  ultimate_cost = 100;
  death_resets_focus = true;

  static readonly INTEGER_FIELDS = [
    "maximum", "basic_attack_gain", "active_skill_gain", "taking_hit_gain_per_hit",
    "taking_hit_gain_max_per_actor_turn", "ultimate_cost",
  ] as const;

  static fromMapping(rules: Dict): FocusRules {
    const result = new FocusRules();
    for (const key of FocusRules.INTEGER_FIELDS) {
      const value = dget(rules, key);
      if (!isWholeNonNegative(value)) throw new BattleSetupError(`battle_rules focus.${key} must be a non-negative integer`);
      result[key] = Math.trunc(value);
    }
    const resets = dget(rules, "death_resets_focus");
    if (typeof resets !== "boolean") throw new BattleSetupError("battle_rules focus.death_resets_focus must be a boolean");
    result.death_resets_focus = resets;
    return result;
  }

  /** Focus a unit gains from one damaging hit this actor turn. */
  hitGain(alreadyGainedThisTurn: number): number {
    return Math.min(this.taking_hit_gain_per_hit, Math.max(0, this.taking_hit_gain_max_per_actor_turn - alreadyGainedThisTurn));
  }

  actionGain(actionType: string): number {
    if (actionType === "basic") return this.basic_attack_gain;
    if (actionType === "active") return this.active_skill_gain;
    return 0;
  }
}

const STAR_CONDITIONS = ["all_selected_heroes_alive", "exactly_one_selected_hero_defeated", "at_least_two_selected_heroes_defeated"];

export class VictoryStarRules {
  three_stars = "";
  two_stars = "";
  one_star = "";
  defeat_stars = 0;
  loaned_story_heroes_count = false;

  static fromMapping(rules: Dict): VictoryStarRules {
    const result = new VictoryStarRules();
    for (const key of ["three_stars", "two_stars", "one_star"] as const) {
      const condition = dget(rules, key);
      if (typeof condition !== "string" || !STAR_CONDITIONS.includes(condition)) {
        throw new BattleSetupError(`Unsupported victory_stars.${key} condition: ${pyRepr(condition)}`);
      }
      result[key] = condition;
    }
    if (dget(rules, "victory_requires_at_least_one_living_hero") !== true) {
      throw new BattleSetupError("The engine only supports victory_requires_at_least_one_living_hero = true");
    }
    const defeat = dget(rules, "defeat_stars");
    if (!isWholeNonNegative(defeat)) throw new BattleSetupError("victory_stars.defeat_stars must be a non-negative integer");
    result.defeat_stars = Math.trunc(defeat);
    const loaned = dget(rules, "loaned_story_heroes_count_as_selected_heroes");
    if (typeof loaned !== "boolean") {
      throw new BattleSetupError("victory_stars.loaned_story_heroes_count_as_selected_heroes must be a boolean");
    }
    result.loaned_story_heroes_count = loaned;
    return result;
  }

  private static holds(condition: string, fallen: number): boolean {
    switch (condition) {
      case "all_selected_heroes_alive":
        return fallen === 0;
      case "exactly_one_selected_hero_defeated":
        return fallen === 1;
      case "at_least_two_selected_heroes_defeated":
        return fallen >= 2;
    }
    return false;
  }

  /** Stars for an outcome ("victory" | "defeat"); -1 if no tier matches (the reference raises ValueError). */
  stars(outcome: string, units: readonly BattleUnit[]): number {
    if (outcome !== "victory") return this.defeat_stars;
    let fallen = 0;
    for (const unit of units) {
      if (unit.team === "player" && (this.loaned_story_heroes_count || !unit.temporary) && !unit.alive) fallen++;
    }
    const tiers: [number, string][] = [[3, this.three_stars], [2, this.two_stars], [1, this.one_star]];
    for (const [stars, condition] of tiers) if (VictoryStarRules.holds(condition, fallen)) return stars;
    return -1;
  }
}
