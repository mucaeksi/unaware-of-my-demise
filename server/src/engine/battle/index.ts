// The battle engine (port of game/scripts/core/battle/*, LEGACY core/battle/*): server-side re-simulation of Auto
// battles from the server's own seed (DEC-0013). Gate: parity/fixtures/battle_*.json, loadouts.json, story_loans.json.
export { AutoBattleProvider, makeAction, type BattleAction } from "./auto";
export { attackerOfUnit, calculateDamage, defenseStatForDamageType, elementMultiplier, scaledAttacker, type Attacker, type DamageResult } from "./damage";
export { EncounterState, isCharacter, isEnemy, type UnitRecord } from "./encounter";
export { BattleSetupError } from "./errors";
export { aliveUnits, delayNextAction, effectiveSpeed, nextActor, readyThreshold, runBattle, spendAction, type ActionProvider } from "./gauge";
export { EffectInterpreter, OperationResult, type RawOperation } from "./interpreter";
export { FocusRules, GaugeRules, VictoryStarRules } from "./rules";
export { BattleResult, BattleService, type Loadout, type RunOptions, type StoryLoanLoadout } from "./service";
export { BattleState, type EventListener } from "./state";
export { BattleUnit, type BattleUnitOptions } from "./unit";
