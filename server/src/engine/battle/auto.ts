// Deterministic Auto-battle policy and the action it hands back to the loop (port of core/battle/auto_battle.gd, LEGACY
// core/battle/auto_battle.py): the five-slot Auto policy, with boss objectives as explicit priorities. It only reads an
// EncounterState (and records the enemy intent events, as the reference does).
import type { Enemy, Skill } from "../content";
import { isEnemy, type EncounterState, type UnitRecord } from "./encounter";
import type { BattleUnit } from "./unit";
import { dget, dgetArray, dgetDict, minBy, sortedBy, toBool, toFloat, toInt, truthy, type Dict } from "./util";

/** One chosen action: a skill id and, per manual selector id, the target entity ids. */
export interface BattleAction {
  skill_id: string;
  targets: Map<string, string[]>;
}

export const makeAction = (skillId: string, targets: Map<string, string[]> = new Map()): BattleAction => ({ skill_id: skillId, targets });

const SUPPORT_TARGET_OPS = [
  "heal", "heal_per_removed_status", "grant_shield", "grant_damage_reduction", "modify_stat", "apply_regeneration",
  "grant_first_hit_guard", "grant_opening_guard",
];
const ALWAYS_USEFUL_OPS = [
  "apply_status", "delay_next_action", "summon_enemies", "reduce_cooldowns", "grant_redirect", "grant_intercept",
  "grant_first_hit_guard", "arm_counter", "arm_next_attack_bonus", "copy_buff",
];

export class AutoBattleProvider {
  heal_below_percent = 40.0;
  save_ultimate_for_boss = true;
  prioritize_boss_objectives = true;

  static fromRules(rules: Dict): AutoBattleProvider {
    const auto = dgetDict(rules, "auto_battle");
    const provider = new AutoBattleProvider();
    provider.heal_below_percent = toFloat(dget(auto, "heal_priority_hp_percent", 40));
    provider.save_ultimate_for_boss = toBool(dget(auto, "save_ultimate_until_boss", true));
    provider.prioritize_boss_objectives = toBool(dget(auto, "objective_automatic_targeting_authored", true));
    return provider;
  }

  chooseAction(state: EncounterState, actor: BattleUnit): BattleAction {
    const record = state.records.get(actor.entity_id)!;
    const basic = record.skills.find((skill) => skill.type === "basic") ?? null;
    if (basic === null) {
      state.reportFault(`${actor.entity_id} has no basic skill`);
      return makeAction("");
    }
    if (actor.team !== "player") return this.enemyAction(state, actor, record, basic);
    const usable = record.skills.filter(
      (skill) => (skill.type === "active" || skill.type === "ultimate") && (actor.cooldowns.get(skill.skill_id) ?? 0) === 0 && actor.focus >= skill.focus_cost,
    );
    const skills = sortedBy(usable, (skill) => [-AutoBattleProvider.priority(skill), skill.skill_id]);
    const injured = state.livingUnits("player").filter((unit) => AutoBattleProvider.hpPct(unit) <= this.heal_below_percent);
    const bossLive = state.boss !== null && state.boss.alive;
    for (const skill of skills) {
      const hasHeal = AutoBattleProvider.has(skill, ["heal", "heal_per_removed_status"]);
      if (hasHeal && injured.length > 0 && this.useful(state, actor, skill, injured)) return this.action(state, actor, skill);
    }
    for (const skill of skills) {
      if (skill.type === "ultimate") {
        if (this.save_ultimate_for_boss && truthy(state.stage.boss_id) && !bossLive) continue;
        if (!bossLive || skill.focus_cost < state.focus_rules.ultimate_cost) continue;
      }
      if (this.useful(state, actor, skill, injured)) return this.action(state, actor, skill);
    }
    return this.action(state, actor, basic);
  }

  private static priority(skill: Skill): number {
    return skill.auto_priority === null ? 0 : Math.trunc(skill.auto_priority);
  }

  private enemyAction(state: EncounterState, actor: BattleUnit, record: UnitRecord, basic: Skill): BattleAction {
    if (!isEnemy(record)) return this.action(state, actor, basic);
    const enemy: Enemy = record;
    let skill: Skill | null = null;
    if (actor.is_boss && enemy.phases.length > 0) {
      const signatureId = state.current_phase !== null ? state.current_phase.signature_action_id : "";
      if (state.current_phase !== null) skill = enemy.skills.find((item) => item.skill_id === signatureId) ?? null;
    } else {
      const actionId = dget(enemy.intent, "action_id");
      if (actionId !== null) skill = enemy.skills.find((item) => item.skill_id === actionId) ?? null;
    }
    if (skill === null || (actor.cooldowns.get(skill.skill_id) ?? 0) > 0) return this.action(state, actor, basic);
    if (actor.is_boss) {
      const intentRules: Dict = { ...skill.telegraph_rules };
      if (state.current_phase !== null) Object.assign(intentRules, { ...state.current_phase.intent_rules });
      state.pending_telegraph = {
        boss_id: actor.entity_id, action_id: skill.skill_id,
        player_actions_before_resolution: toInt(dget(intentRules, "player_actions_before_resolution", 1)),
        intent_rules: intentRules, cancelled: false,
      };
      state.telegraph_player_opportunities = 0;
      state.recordEvent({
        type: "boss_telegraph_started", boss_id: actor.entity_id, action_id: skill.skill_id,
        phase_id: state.current_phase !== null ? state.current_phase.phase_id : null,
        round: state.round_number,
      });
      return makeAction("__hold_telegraph__");
    }
    state.recordEvent({ type: "enemy_intent_resolved", enemy_id: actor.entity_id, action_id: skill.skill_id, round: state.round_number });
    return this.action(state, actor, skill);
  }

  private action(state: EncounterState, actor: BattleUnit, skill: Skill): BattleAction {
    const targets = new Map<string, string[]>();
    const selectorRules = state.interpreter().selector_rules;
    for (const op of skill.effect_ops) {
      const selector = op.target_selector_id;
      if (selector === null || selector.length === 0) continue;
      const rule = selectorRules[selector] as Dict;
      if (dget(rule, "kind") !== "manual_single") continue;
      let target: BattleUnit | null = null;
      if (dget(rule, "side") === "opposing") {
        target = this.objectiveTarget(state);
        if (target === null) target = AutoBattleProvider.enemyTarget(state, actor);
      } else if (SUPPORT_TARGET_OPS.includes(op.op)) {
        target = minBy(state.livingUnits(actor.team), (unit) => [AutoBattleProvider.hpPct(unit), unit.slot_index, unit.entity_id]);
      } else {
        target = AutoBattleProvider.enemyTarget(state, actor);
      }
      if (target !== null) targets.set(selector, [target.entity_id]);
    }
    return makeAction(skill.skill_id, targets);
  }

  private objectiveTarget(state: EncounterState): BattleUnit | null {
    if (!this.prioritize_boss_objectives || state.boss === null || !state.boss.alive) return null;
    let pendingId = "";
    if (state.pending_telegraph !== null) {
      const rules = dgetDict(state.pending_telegraph, "intent_rules");
      const single = dget(rules, "interrupt_if_objective_destroyed");
      if (single !== null && truthy(single)) {
        pendingId = String(single);
      } else {
        for (const item of dgetArray(rules, "interrupt_if_all_objectives_destroyed")) {
          if (toInt(dget(state.objectives.get(String(item)) ?? {}, "hp", 0)) > 0) {
            pendingId = String(item);
            break;
          }
        }
      }
    }
    const wardIds: string[] = [];
    for (const modifier of state.boss_modifiers) {
      const untilId = dget(modifier, "until_objective_destroyed");
      if (untilId !== null && truthy(untilId)) wardIds.push(String(untilId));
      const activeRule = dget(modifier, "while_any_objective_alive");
      if (activeRule !== null && typeof activeRule === "object" && !Array.isArray(activeRule)) {
        for (const item of dgetArray(activeRule as Dict, "objective_ids")) wardIds.push(String(item));
      } else if (Array.isArray(activeRule)) {
        for (const item of activeRule) wardIds.push(String(item));
      }
    }
    const priorityIds: string[] = [];
    if (pendingId.length > 0) priorityIds.push(pendingId);
    for (const ward of wardIds) if (!priorityIds.includes(ward)) priorityIds.push(ward);
    const phaseBreaks: string[] = [];
    if (state.current_phase !== null) {
      for (const item of state.current_phase.break_targets) {
        phaseBreaks.push(item);
        if (!priorityIds.includes(item)) priorityIds.push(item);
      }
    }
    for (const key of state.objectives.keys()) if (!priorityIds.includes(key)) priorityIds.push(key);
    for (const objectiveId of priorityIds) {
      const entry = state.objectives.get(objectiveId);
      if (entry === undefined || Object.keys(entry).length === 0) continue;
      if (toInt(dget(entry, "hp", 0)) <= 0 || !toBool(dget(entry, "targetable_by_player", true))) continue;
      if (objectiveId === pendingId || wardIds.includes(objectiveId) || phaseBreaks.includes(objectiveId)) return entry.unit as BattleUnit;
    }
    return null;
  }

  private static enemyTarget(state: EncounterState, actor: BattleUnit): BattleUnit | null {
    const enemies = state.livingUnits(state.opposingTeam(actor));
    if (state.boss !== null && enemies.includes(state.boss)) return state.boss;
    return minBy(enemies, (unit) => [unit.hp, unit.slot_index, unit.entity_id]);
  }

  private useful(state: EncounterState, actor: BattleUnit, skill: Skill, injured: readonly BattleUnit[]): boolean {
    if (AutoBattleProvider.has(skill, ["heal", "heal_per_removed_status", "apply_regeneration"])) {
      if (injured.length > 0) return true;
      if (!AutoBattleProvider.has(skill, ["damage"])) return false;
    }
    const statuses = state.interpreter().status_definitions;
    for (const op of skill.effect_ops) {
      if (op.op === "remove_status") {
        for (const unit of state.livingUnits(actor.team)) {
          for (const statusId of unit.statuses.keys()) if (unit.statusTags(statusId, statuses).includes("debuff")) return true;
        }
      } else if (op.op === "damage" && state.livingUnits(state.opposingTeam(actor)).length > 0) {
        return true;
      } else if (["modify_stat", "modify_outgoing_damage", "modify_incoming_damage"].includes(op.op)) {
        let ownModifier = false;
        for (const unit of state.units) {
          for (const modifier of [...unit.stat_modifiers, ...unit.damage_modifiers]) {
            if (dget(modifier, "source_id") === actor.entity_id) ownModifier = true;
          }
        }
        if (!ownModifier) return true;
      } else if (["grant_shield", "grant_damage_reduction", "grant_opening_guard"].includes(op.op)) {
        for (const unit of state.livingUnits(actor.team)) if (unit.shieldTotal() < AutoBattleProvider.maxHpOrOne(unit)) return true;
      } else if (ALWAYS_USEFUL_OPS.includes(op.op)) {
        return true;
      }
    }
    return false;
  }

  private static has(skill: Skill, names: readonly string[]): boolean {
    return skill.effect_ops.some((op) => names.includes(op.op));
  }

  private static maxHpOrOne(unit: BattleUnit): number {
    return unit.max_hp !== 0 ? unit.max_hp : 1;
  }

  static hpPct(unit: BattleUnit): number {
    return (100.0 * unit.hp) / Math.max(1, AutoBattleProvider.maxHpOrOne(unit));
  }
}
