// Errors of the battle port. GDScript reports these through `error` / `BattleState.fault` strings; the reference raises.

/** Construction or setup problem (invalid rules, unknown stage, invalid roster or loadout). */
export class BattleSetupError extends Error {
  override name = "BattleSetupError";
}
