/** AFK Idle Patrol (R12): server-clock accrual capped at 12 hours; yields grow with the number of cleared battle stages. */
export const AFK_CAP_SEC = 12 * 3600;
export const AFK_MIN_CLAIM_SEC = 60;

export interface AfkYield {
  elapsedSeconds: number;
  capped: boolean;
  minutesAccrued: number;
  claimable: boolean;
  /** account XP, Torn Chronicle Pages (100 character XP each) and Forge Dust */
  accountXp: number;
  pages: number;
  dust: number;
}

export function afkYield(elapsedRawSeconds: number, clearedBattles: number): AfkYield {
  const elapsedSeconds = Math.min(Math.max(0, elapsedRawSeconds), AFK_CAP_SEC);
  const capped = elapsedRawSeconds >= AFK_CAP_SEC;
  const minutesAccrued = Math.floor(elapsedSeconds / 60);
  const claimable = clearedBattles >= 1 && elapsedSeconds >= AFK_MIN_CLAIM_SEC;
  if (!claimable) return { elapsedSeconds, capped, minutesAccrued, claimable, accountXp: 0, pages: 0, dust: 0 };
  const tier = Math.max(1, clearedBattles);
  return {
    elapsedSeconds,
    capped,
    minutesAccrued,
    claimable,
    accountXp: minutesAccrued * (2 + tier),
    pages: Math.max(1, Math.floor((minutesAccrued * (1 + Math.floor(tier / 3))) / 15)),
    dust: Math.floor((minutesAccrued * (1 + Math.floor(tier / 4))) / 30)
  };
}
