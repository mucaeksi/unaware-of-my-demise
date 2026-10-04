// Mutable battle-local state (port of core/battle/battle_state.gd, LEGACY core/battle/models.py BattleState): units, the
// acting unit, the seeded rng, objectives, boss modifiers, the replay log and the presentation-neutral event list.
// EncounterState extends it with passive hooks, waves and boss phases.
//
// `battle_events` (via `recordEvent`) is the contract between battle logic and presentation: event types and fields are
// kept exactly as the reference writes them (parity/fixtures/battle_*.json). `log` only carries what authored
// applied-order values need. The GDScript `event_emitted` signal is `eventListeners`.
import type { Enemy, Character } from "../content";
import type { CpythonRandom } from "../random";
import type { EffectInterpreter } from "./interpreter";
import { FocusRules, type GaugeRules } from "./rules";
import type { BattleUnit } from "./unit";
import { dget, dgetDict, keysInOrder, removeFirstEqual, toFloat, toInt, truthy, type Dict } from "./util";

export type EventListener = (event: Dict) => void;

export class BattleState {
  units: BattleUnit[] = [];
  actor: BattleUnit | null = null;
  rng: CpythonRandom | null = null;
  gauge_rules: GaugeRules | null = null;
  focus_rules: FocusRules = new FocusRules();
  round_number = 1;
  action_type = "basic";
  automatic = true;
  /** selector id -> entity ids */
  manual_targets = new Map<string, string[]>();
  event: Dict = {};
  boss: BattleUnit | null = null;
  /** objective id -> objective dictionary (incl. "unit": BattleUnit) */
  objectives = new Map<string, Dict>();
  boss_modifiers: Dict[] = [];
  pending_telegraph: Dict | null = null;
  previous_operation_targets: BattleUnit[] = [];
  previous_successful_heal_targets: BattleUnit[] = [];
  last_target: BattleUnit | null = null;
  last_primary_target: BattleUnit | null = null;
  last_damage = 0;
  last_damage_target_max_hp = 0;
  last_damage_target_defeated = false;
  last_primary_target_defeated = false;
  /** entity id -> removed status payloads */
  last_removed_statuses = new Map<string, Dict[]>();
  acted_entity_ids = new Set<string>();
  damaged_entity_ids_this_round = new Set<string>();
  pending_summons: Dict[] = [];
  log: Dict[] = [];
  cycle_snapshot = new Set<string>();
  cycle_acted_entity_ids = new Set<string>();
  battle_events: Dict[] = [];
  /** entity id -> status ids held at turn start */
  turn_status_snapshot = new Map<string, Set<string>>();
  /** Subscribers of every recorded or emitted event (the GDScript `event_emitted` signal). */
  eventListeners: EventListener[] = [];

  /** First fault of the run ("" = none): the reference raises (EffectContractError, ValueError ...), the port stops. */
  fault = "";

  /** A bare state around `units` (unit tests; a real battle uses EncounterState). */
  static make(units: BattleUnit[]): BattleState {
    const state = new BattleState();
    state.units = units;
    return state;
  }

  reportFault(message: string): void {
    if (this.fault.length === 0) this.fault = message;
  }

  // -- hooks that EncounterState overrides (the base state has no service, passives or waves) ---------

  /** False for a bare BattleState (unit tests); EncounterState resolves passive hooks and continuous modifiers. */
  supportsPassives(): boolean {
    return false;
  }

  dispatchBattleEvent(_eventName: string, _payload: Dict, _interpreter: EffectInterpreter): void {}

  continuousDamageMultiplier(_eventName: string, _payload: Dict, _interpreter: EffectInterpreter): number {
    return 1.0;
  }

  nextDamageActionId(): number {
    return this.log.length;
  }

  /** Resolves the chosen action for `turnActor`. A bare state has no action model. */
  resolveAction(_turnActor: BattleUnit, _action: unknown, _random: CpythonRandom): void {
    this.reportFault("BattleState.resolve_action is not implemented for a bare state");
  }

  resolveReactions(_turnActor: BattleUnit, _random: CpythonRandom): void {}

  resolveBossTelegraphIfReady(_turnActor: BattleUnit, _random: CpythonRandom): void {}

  resolvePhaseTransitionIfNeeded(_random: CpythonRandom): void {}

  /** The interpreter owned by the service (null for a bare state). */
  serviceInterpreter(): EffectInterpreter | null {
    return null;
  }

  objectiveDestroyed(_objective: Dict, _interpreter: EffectInterpreter, _destroyingActor: BattleUnit): void {}

  /** The content record (Character | Enemy) behind an entity id; null for a bare state. */
  recordOf(_entityId: string): Character | Enemy | null {
    return null;
  }

  /** How many turns `entityId` has taken (counter arming compares against it); 0 for a bare state. */
  ownerTurnCount(_entityId: string): number {
    return 0;
  }

  /** Units a `summon_enemies` operation adds (the encounter's enemy factory); none for a bare state. */
  spawnSummons(_enemyId: string, _count: number): BattleUnit[] {
    return [];
  }

  // -- events -----------------------------------------------------------------------------------------

  /** Synchronously publishes one event without retaining it in the log. */
  emitEvent(payloadSource: Dict): void {
    const payload = { ...payloadSource };
    if (typeof payload.type !== "string" || payload.type.length === 0) {
      this.reportFault("battle event requires a non-empty 'type'");
      return;
    }
    for (const listener of this.eventListeners) listener({ ...payload });
  }

  /** Adds a deterministic, presentation-neutral event to the battle log and publishes it. */
  recordEvent(payloadSource: Dict): void {
    const payload = { ...payloadSource };
    this.battle_events.push(payload);
    this.emitEvent(payload);
  }

  livingUnits(team = ""): BattleUnit[] {
    return this.units.filter((unit) => unit.alive && unit.hp > 0 && (team.length === 0 || unit.team === team));
  }

  opposingTeam(ownerUnit: BattleUnit | null = null): string {
    const owner = ownerUnit ?? this.actor;
    if (owner === null) {
      this.reportFault("A battle actor is required to resolve opposing-team selectors");
      return "";
    }
    return owner.team === "player" ? "enemy" : "player";
  }

  isBattleOver(): boolean {
    return this.livingUnits("player").length === 0 || this.livingUnits("enemy").length === 0;
  }

  beginCycle(members: BattleUnit[] = []): void {
    const snapshot = members.length > 0 ? members : this.livingUnits();
    this.cycle_snapshot = new Set(snapshot.map((unit) => unit.entity_id));
    this.cycle_acted_entity_ids.clear();
    this.damaged_entity_ids_this_round.clear();
    for (const unit of snapshot) unit.damage_taken_this_round = 0;
  }

  endCycle(): void {
    for (const unit of this.units) {
      for (const effect of [...unit.damage_modifiers]) {
        if (Object.hasOwn(effect, "duration_rounds")) {
          effect.duration_rounds = Math.max(0, toInt(effect.duration_rounds) - 1);
          if (toInt(effect.duration_rounds) === 0) removeFirstEqual(unit.damage_modifiers, effect);
        }
      }
    }
  }

  cycleIsComplete(): boolean {
    const aliveIds = new Set(this.livingUnits().map((unit) => unit.entity_id));
    for (const entityId of this.cycle_snapshot) {
      if (aliveIds.has(entityId) && !this.cycle_acted_entity_ids.has(entityId)) return false;
    }
    return true;
  }

  startTurn(turnActor: BattleUnit): void {
    this.actor = turnActor;
    turnActor.has_acted = true;
    this.acted_entity_ids.add(turnActor.entity_id);
    this.cycle_acted_entity_ids.add(turnActor.entity_id);
    // Snapshot before expiry: a one-turn control status that expires at this boundary still interrupts this scheduled
    // action, then is consumed.
    this.turn_status_snapshot.set(turnActor.entity_id, new Set(turnActor.statuses.keys()));
    for (const skillId of [...turnActor.cooldowns.keys()]) {
      turnActor.cooldowns.set(skillId, Math.max(0, toInt(turnActor.cooldowns.get(skillId)) - 1));
    }
    // The authored contract decrements durations before owner-turn effects. Expiring DOT payloads are kept locally for
    // this final tick only.
    const expiringStatuses = new Map<string, Dict>();
    for (const statusId of [...turnActor.statuses.keys()]) {
      const status = turnActor.statuses.get(statusId)!;
      if (Object.hasOwn(status, "duration_turns")) {
        status.duration_turns = Math.max(0, toInt(dget(status, "duration_turns", 1)) - 1);
        if (toInt(status.duration_turns) === 0) {
          expiringStatuses.set(statusId, status);
          turnActor.statuses.delete(statusId);
        }
      }
    }
    for (const collection of [turnActor.shields, turnActor.stat_modifiers, turnActor.damage_modifiers, turnActor.redirects]) {
      for (const effect of [...collection]) {
        if (Object.hasOwn(effect, "duration_turns")) {
          effect.duration_turns = Math.max(0, toInt(effect.duration_turns) - 1);
          if (toInt(effect.duration_turns) === 0) removeFirstEqual(collection, effect);
        }
      }
    }
    const runtimeImmunities = dget(turnActor.stats, "status_immunities_runtime", []);
    if (Array.isArray(runtimeImmunities)) {
      for (const immunity of [...(runtimeImmunities as Dict[])]) {
        immunity.duration_turns = Math.max(0, toInt(dget(immunity, "duration_turns", 0)) - 1);
        if (toInt(immunity.duration_turns) === 0) removeFirstEqual(runtimeImmunities as Dict[], immunity);
      }
    }

    const turnStatuses = new Map(expiringStatuses);
    for (const [statusId, status] of turnActor.statuses) turnStatuses.set(statusId, status);
    for (const [statusId, status] of turnStatuses) {
      if (truthy(dget(status, "ticks_at_owner_turn_start")) && truthy(dget(status, "tick_damage"))) {
        this.tickDamage(turnActor, statusId, status);
      }
      if (statusId === "regeneration" && dget(status, "tick_event") === "owner_turn_start" && toInt(dget(status, "ticks_remaining", 0)) > 0) {
        const oldHp = turnActor.hp;
        turnActor.hp = Math.min(
          turnActor.max_hp !== 0 ? turnActor.max_hp : 1,
          turnActor.hp + Math.max(0, toInt(dget(status, "tick_healing", 0))),
        );
        this.emitEvent({
          type: "healing_applied", source_id: dget(status, "source_id"),
          target_id: turnActor.entity_id, amount: turnActor.hp - oldHp,
          hp: turnActor.hp, max_hp: turnActor.max_hp,
          alive: turnActor.alive, status_id: statusId,
        });
        status.ticks_remaining = Math.max(0, toInt(status.ticks_remaining) - 1);
        if (toInt(status.ticks_remaining) === 0) turnActor.statuses.delete(statusId);
      } else if (statusId === "regeneration" && dget(status, "tick_event") === "owner_turn_start") {
        turnActor.statuses.delete(statusId);
      }
    }
  }

  /** One damage-over-time tick at the owner's turn start. */
  private tickDamage(turnActor: BattleUnit, statusId: string, status: Dict): void {
    const baseAmount = Math.max(1, toInt(status.tick_damage));
    const oldHp = turnActor.hp;
    const interpreter = this.serviceInterpreter();
    const dispatcherReady = this.supportsPassives() && interpreter !== null;
    const sourceId = dget(status, "source_id");
    const source = this.units.find((unit) => unit.entity_id === sourceId) ?? null;
    const hitPayload: Dict = {
      actor: source, source, target: turnActor,
      action_type: "status", source_action_type: "status",
      incoming_action_type: "status", skill_id: statusId,
    };
    if (dispatcherReady) this.dispatchBattleEvent("before_damage_received", hitPayload, interpreter);

    let multiplier = 1.0;
    for (const [activeId, active] of turnActor.statuses) {
      const definition = dgetDict(turnActor.status_definitions, activeId);
      multiplier *= toFloat(dget(active, "damage_taken_multiplier", dget(definition, "damage_taken_multiplier", 1.0)));
    }
    for (const modifier of turnActor.damage_modifiers) {
      if (dget(modifier, "kind") === "incoming") multiplier *= toFloat(dget(modifier, "multiplier", 1.0));
    }
    if (this.supportsPassives() && interpreter !== null && source !== null) {
      const continuousPayload: Dict = { ...hitPayload };
      continuousPayload.damage = baseAmount;
      multiplier *= this.continuousDamageMultiplier("before_damage_received", continuousPayload, interpreter);
    }
    let amount = Math.max(1, Math.trunc(baseAmount * multiplier));
    const blocked = turnActor.blocked_attack_hits > 0;
    if (blocked) {
      turnActor.blocked_attack_hits -= 1;
      amount = 0;
    }
    let remaining = amount;
    let shieldAbsorbed = 0;
    for (const shield of [...turnActor.shields]) {
      if (remaining <= 0) break;
      const absorbed = Math.min(remaining, Math.max(0, toInt(dget(shield, "amount", 0))));
      shield.amount = Math.max(0, toInt(dget(shield, "amount", 0)) - absorbed);
      remaining -= absorbed;
      shieldAbsorbed += absorbed;
      if (toInt(shield.amount) === 0) removeFirstEqual(turnActor.shields, shield);
    }
    const hpDamage = Math.min(oldHp, remaining);
    turnActor.hp = Math.max(0, oldHp - hpDamage);
    turnActor.damage_taken_this_round += hpDamage;
    if (hpDamage > 0) this.damaged_entity_ids_this_round.add(turnActor.entity_id);
    turnActor.alive = turnActor.alive && turnActor.hp > 0;
    const tickEvent: Dict = {
      type: "damage_dealt", source_id: sourceId,
      target_id: turnActor.entity_id, amount,
      hp_damage: hpDamage, shield_absorbed: shieldAbsorbed,
      hp: turnActor.hp, max_hp: turnActor.max_hp,
      alive: turnActor.alive, damage_type: "status", status_id: statusId,
      blocked,
    };
    this.log.push({ ...tickEvent });
    this.recordEvent(tickEvent);
    if (dispatcherReady) {
      const maxHpFloor = Math.max(1, turnActor.max_hp);
      const payload: Dict = { ...hitPayload };
      payload.damage = amount;
      payload.hp_damage = hpDamage;
      payload.shield_absorbed = shieldAbsorbed;
      payload.target_hp_before_pct = (oldHp * 100.0) / maxHpFloor;
      payload.target_hp_after_pct = (turnActor.hp * 100.0) / maxHpFloor;
      if (amount > 0 || shieldAbsorbed > 0) {
        this.dispatchBattleEvent("after_damage_received", payload, interpreter);
        if (source === null || source.team !== turnActor.team) this.dispatchBattleEvent("ally_damaged", payload, interpreter);
      }
      const beforePct = payload.target_hp_before_pct as number;
      const afterPct = payload.target_hp_after_pct as number;
      if (turnActor.team === "player") {
        for (const threshold of [75, 50, 25]) {
          if (beforePct > threshold && threshold >= afterPct) {
            const crossed: Dict = { ...payload };
            crossed.target_hp_before_pct = beforePct;
            crossed.target_hp_after_pct = afterPct;
            crossed.threshold_pct = threshold;
            this.dispatchBattleEvent("ally_hp_threshold_crossed", crossed, interpreter);
            break;
          }
        }
      }
      if (oldHp > 0 && turnActor.hp === 0 && turnActor.team === "enemy") {
        const defeated: Dict = { ...payload };
        defeated.target_defeated = true;
        defeated.target_statuses_before = keysInOrder(turnActor.statuses);
        this.dispatchBattleEvent("after_enemy_defeated", defeated, interpreter);
      }
    }
    if (amount > 0) {
      const taken = turnActor.hit_focus_gained_this_turn;
      const gained = this.focus_rules.hitGain(taken);
      turnActor.focus = Math.min(this.focus_rules.maximum, turnActor.focus + gained);
      turnActor.hit_focus_gained_this_turn = taken + gained;
    }
  }

  endTurn(turnActor: BattleUnit): void {
    this.turn_status_snapshot.delete(turnActor.entity_id);
    turnActor.alive = turnActor.alive && turnActor.hp > 0;
    this.actor = turnActor;
    this.resetDefeatedFocus();
  }

  /**
   * `focus.death_resets_focus`: a defeated unit holds no Focus. Applied once per turn (`endTurn`) and before results are
   * built, since a defeated unit cannot act and no revive exists.
   */
  resetDefeatedFocus(): void {
    if (!this.focus_rules.death_resets_focus) return;
    for (const unit of this.units) if (!unit.alive || unit.hp <= 0) unit.focus = 0;
  }
}
