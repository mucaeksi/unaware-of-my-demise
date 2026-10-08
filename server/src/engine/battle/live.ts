// The same automatic readiness boundaries and explicit Ultimate commands as Godot.
import type { Skill } from "../content";
import { CpythonRandom } from "../random";
import { AutoBattleProvider } from "./auto";
import type { EncounterState } from "./encounter";
import { aliveUnits, nextActor, spendAction } from "./gauge";
import type { BattleUnit } from "./unit";

export const MANUAL_COMBAT_MODE = "manual_ultimate_v1";
export interface UltimateCommand { after_actions: number; actor_id: string }
export class LiveBattle {
  readonly provider: AutoBattleProvider;
  active_cycle: BattleUnit[];
  automatic_actions = 0;
  completed = false;

  constructor(readonly state: EncounterState, seed: number | bigint) {
    this.provider = AutoBattleProvider.fromRules(state.service.rules);
    this.provider.manual_ultimates = true;
    this.provider.nearest_default = true;
    state.gauge_rules = state.interpreter().gauge_rules;
    state.rng = new CpythonRandom(seed);
    state.beginCycle();
    this.active_cycle = aliveUnits(state.units);
  }

  ultimate(id: string): Skill | null {
    const unit = this.state.units.find(actor => actor.entity_id === id && actor.team === "player");
    if (!unit || this.completed || !unit.alive || unit.hp <= 0 || unit.hasStatus("stun") || unit.hasStatus("break")) return null;
    return this.state.records.get(id)!.skills.find(skill => skill.type === "ultimate" && unit.focus >= skill.focus_cost && (unit.cooldowns.get(skill.skill_id) ?? 0) === 0) ?? null;
  }

  cast(id: string): boolean {
    const skill = this.ultimate(id);
    if (!skill) return false;
    const actor = this.state.units.find(unit => unit.entity_id === id)!;
    this.state.actor = actor;
    this.state.resolveAction(actor,this.provider.action(this.state,actor,skill),this.state.rng!);
    this.state.resolveReactions(actor,this.state.rng!);
    this.state.resolvePhaseTransitionIfNeeded(this.state.rng!);
    return true;
  }

  step(): void {
    const state = this.state;
    const actor = nextActor(this.active_cycle,state.gauge_rules!,state);
    if (!actor) { state.reportFault("Live battle has no active actors"); return; }
    state.startTurn(actor);
    if (actor.alive && actor.hp > 0) {
      const snapshot = state.turn_status_snapshot.get(actor.entity_id) ?? new Set<string>();
      if (["stun","break"].some(status => actor.hasStatus(status) || snapshot.has(status))) {
        actor.statuses.delete("stun"); actor.statuses.delete("break");
      } else state.resolveAction(actor,this.provider.chooseAction(state,actor),state.rng!);
      state.resolveReactions(actor,state.rng!);
      state.resolveBossTelegraphIfReady(actor,state.rng!);
      if (!spendAction(actor,state.gauge_rules!)) state.reportFault("Live actor was not gauge-ready");
    }
    state.endTurn(actor);
    state.resolvePhaseTransitionIfNeeded(state.rng!);
    this.automatic_actions++;
    if (this.active_cycle.every(unit => !(unit.alive && unit.hp > 0 && !unit.has_acted))) {
      state.endCycle();
      this.active_cycle = aliveUnits(state.units);
      for (const unit of this.active_cycle) unit.has_acted = false;
      state.round_number++;
      state.beginCycle();
    }
  }

  run(commands: readonly UltimateCommand[]): void {
    const state = this.state;
    let cursor = 0;
    while (!state.isBattleOver() && !state.fault && this.automatic_actions < 10000) {
      while (cursor < commands.length && commands[cursor]!.after_actions === this.automatic_actions) {
        if (!this.cast(commands[cursor]!.actor_id)) { state.reportFault("Invalid manual Ultimate command"); break; }
        cursor++;
        if (state.isBattleOver() || state.fault) break;
      }
      if (state.isBattleOver() || state.fault) break;
      if (cursor < commands.length && commands[cursor]!.after_actions < this.automatic_actions) {
        state.reportFault("Manual Ultimate commands must be ordered"); break;
      }
      this.step();
    }
    this.completed = true;
    if (cursor < commands.length && !state.fault) state.reportFault("Manual Ultimate commands exceed the encounter");
    if (this.automatic_actions >= 10000 && !state.isBattleOver()) state.reportFault("Live battle action limit exceeded");
    if (!state.fault) state.emitEvent({
      type:"battle_completed",result:state.livingUnits("player").length ? "victory" : "defeat",
      actions:this.automatic_actions+commands.length,
      units:state.units.map(unit => ({entity_id:unit.entity_id,hp:unit.hp,max_hp:unit.max_hp,alive:unit.alive})),
    });
  }
}
