// Continuous Action Gauge initiative using exact rational arithmetic (port of core/battle/action_gauge.gd, LEGACY
// core/battle/gauge.py): who acts next, spending an action, delaying a unit's next action, and the battle loop.
//
// Gauge overflow stays attached to the unit; `pending_delay_gauge` is a debt added to the next readiness threshold and
// cleared only when that action is spent. Frac is BigInt-exact, so the GDScript int64 overflow checks have no
// counterpart here.
import { Frac } from "../frac";
import { CpythonRandom } from "../random";
import { GaugeRules } from "./rules";
import type { BattleState } from "./state";
import type { BattleUnit } from "./unit";
import { keyLess, type SortKey } from "./util";

/** Chooses the action for `actor`: a function or an object with `chooseAction` (AutoBattleProvider). */
export type ActionProvider<S extends BattleState = BattleState> =
  | ((state: S, actor: BattleUnit) => unknown)
  | { chooseAction(state: S, actor: BattleUnit): unknown };

const ZERO = Frac.of(0);

export function effectiveSpeed(unit: BattleUnit, speedFloor = 1): number {
  return Math.max(speedFloor, unit.effectiveSpeed());
}

function delay(unit: BattleUnit, rules: GaugeRules): Frac {
  return Frac.minimum(rules.maximumPendingDelayGauge(), Frac.maximum(ZERO, unit.pending_delay_gauge));
}

export function readyThreshold(unit: BattleUnit, rules: GaugeRules): Frac {
  return Frac.of(rules.gauge_max).add(delay(unit, rules));
}

export function aliveUnits(units: readonly BattleUnit[]): BattleUnit[] {
  return units.filter((unit) => unit.alive && unit.hp > 0);
}

/** Advances exact gauge time until an actor is ready, then applies the GDD tie-breaks. Null if nobody is alive. */
export function nextActor(units: readonly BattleUnit[], rules: GaugeRules): BattleUnit | null {
  const living = aliveUnits(units);
  if (living.length === 0) return null;
  for (;;) {
    let best: BattleUnit | null = null;
    let bestKey: SortKey = [];
    for (const unit of living) {
      const overshoot = unit.gauge.sub(readyThreshold(unit, rules));
      if (overshoot.num < 0n) continue;
      // Sort key: (-(gauge - threshold), player first, slot index, entity id); the smallest key acts.
      const key: SortKey = [overshoot.neg(), unit.team === "player" ? 0 : 1, unit.slot_index, unit.entity_id];
      if (best === null || keyLess(key, bestKey)) {
        best = unit;
        bestKey = key;
      }
    }
    if (best !== null) return best;
    let delta: Frac | null = null;
    for (const unit of living) {
      const candidate = readyThreshold(unit, rules).sub(unit.gauge).divInt(effectiveSpeed(unit, rules.effective_speed_floor));
      if (delta === null || candidate.compare(delta) < 0) delta = candidate;
    }
    for (const unit of living) unit.gauge = unit.gauge.add(delta!.mulInt(effectiveSpeed(unit, rules.effective_speed_floor)));
  }
}

/** Pays the readiness threshold: overflow stays, the pending delay is cleared. False if the unit was not ready. */
export function spendAction(actor: BattleUnit, rules: GaugeRules): boolean {
  const threshold = readyThreshold(actor, rules);
  if (actor.gauge.compare(threshold) < 0) return false;
  actor.gauge = actor.gauge.sub(threshold);
  actor.pending_delay_gauge = ZERO;
  return true;
}

/** Adds `gauge_max * fraction` to the target's pending delay (capped) and returns the new pending delay. */
export function delayNextAction(target: BattleUnit, fraction: Frac, rules: GaugeRules): Frac {
  const amount = fraction.num >= 0n ? fraction : ZERO;
  target.pending_delay_gauge = Frac.minimum(rules.maximumPendingDelayGauge(), delay(target, rules).add(amount.mulInt(rules.gauge_max)));
  return target.pending_delay_gauge;
}

/**
 * The GDD's queue/orchestration loop. The state supplies turn, cycle, reaction and phase hooks. Returns the number of
 * actions taken; `state.fault` is set if the safety limit is exceeded.
 */
export function runBattle<S extends BattleState>(
  state: S,
  provider: ActionProvider<S>,
  runSeed: bigint | number,
  maxActions = 10000,
  gaugeRules: GaugeRules | null = null,
): number {
  const rng = new CpythonRandom(runSeed);
  state.rng = rng;
  const rules = gaugeRules ?? state.gauge_rules ?? new GaugeRules();
  state.gauge_rules = rules;
  state.beginCycle();
  let activeCycle = aliveUnits(state.units);
  let actions = 0;
  while (!state.isBattleOver() && actions < maxActions) {
    const actor = nextActor(activeCycle, rules);
    if (actor === null) break;
    state.startTurn(actor);
    if (actor.alive && actor.hp > 0) {
      const statusesAtTurnStart = state.turn_status_snapshot.get(actor.entity_id) ?? new Set<string>();
      let stunned = false;
      for (const statusId of ["stun", "break"]) {
        if (actor.hasStatus(statusId) || statusesAtTurnStart.has(statusId)) stunned = true;
      }
      if (stunned) {
        // No consume hook on the encounter state: the reference just drops both statuses.
        actor.statuses.delete("stun");
        actor.statuses.delete("break");
      } else {
        const action = typeof provider === "function" ? provider(state, actor) : provider.chooseAction(state, actor);
        state.resolveAction(actor, action, rng);
      }
      state.resolveReactions(actor, rng);
      // A held boss intent is resolved after the next player action opportunity, including a player turn spent under
      // Stun/Break.
      state.resolveBossTelegraphIfReady(actor, rng);
      if (!spendAction(actor, rules)) state.reportFault(`${actor.entity_id} is not ready to spend an Action Gauge`);
    }
    state.endTurn(actor);
    state.resolvePhaseTransitionIfNeeded(rng);
    actions++;
    if (state.fault.length > 0) break;
    const everyoneDone = activeCycle.every((unit) => !(unit.alive && unit.hp > 0 && !unit.has_acted));
    if (everyoneDone) {
      state.endCycle();
      activeCycle = aliveUnits(state.units);
      for (const unit of activeCycle) unit.has_acted = false;
      state.round_number++;
      state.beginCycle();
    }
  }
  if (actions >= maxActions && !state.isBattleOver()) state.reportFault(`Battle exceeded the ${maxActions} action safety limit`);
  if (state.isBattleOver() && state.fault.length === 0) {
    state.emitEvent({
      type: "battle_completed",
      result: state.livingUnits("player").length > 0 ? "victory" : "defeat",
      actions,
      units: state.units.map((unit) => ({ entity_id: unit.entity_id, hp: unit.hp, max_hp: unit.max_hp, alive: unit.alive })),
    });
  }
  return actions;
}
