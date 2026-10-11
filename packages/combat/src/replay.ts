import type { BattleParty, Encounter, UnitPack } from '@uomd/content-schema';
import { canonicalJson, sha256Hex } from '@uomd/shared';
import { Battle } from './engine';
import { IllegalActionError, type BattleResult, type PlayerAction } from './types';

export interface ReplayOutput {
  valid: boolean;
  /** false when the action list ended while a player decision was still pending */
  complete: boolean;
  error?: string;
  result: BattleResult | null;
  /** SHA-256 over the canonical event log; client and server must agree on it. */
  logHash: string;
  eventCount: number;
}

/**
 * Server-side acceptance: re-simulates a battle from the encounter seed and the player's ordered
 * actions. Any illegal action (wrong skill, wrong target, cooldown/focus violation, acting after the
 * battle ended) makes the replay invalid. The client's visual result is never trusted.
 */
export async function replayBattle(pack: UnitPack, encounter: Encounter, actions: readonly PlayerAction[], party?: BattleParty): Promise<ReplayOutput> {
  const battle = Battle.create(pack, encounter, party);
  let step = battle.advance();
  let i = 0;
  try {
    while (!step.result) {
      if (!step.prompt) throw new IllegalActionError('battle stalled without a prompt');
      const action = actions[i];
      if (!action) break;
      step = battle.act(action);
      i++;
    }
    if (step.result && i < actions.length) throw new IllegalActionError(`${actions.length - i} extra action(s) after the battle ended`);
  } catch (e) {
    if (e instanceof IllegalActionError) {
      return { valid: false, complete: false, error: e.message, result: battle.result, logHash: await sha256Hex(canonicalJson(battle.log)), eventCount: battle.log.length };
    }
    throw e;
  }
  return {
    valid: true,
    complete: step.result !== null,
    result: battle.result,
    logHash: await sha256Hex(canonicalJson(battle.log)),
    eventCount: battle.log.length
  };
}

/** Plays a whole battle with the Auto Battle policy; returns the recorded actions (replayable). */
export function playAuto(pack: UnitPack, encounter: Encounter, party?: BattleParty): { battle: Battle; actions: PlayerAction[] } {
  const battle = Battle.create(pack, encounter, party);
  const actions: PlayerAction[] = [];
  let step = battle.advance();
  while (!step.result) {
    const a = battle.autoAction();
    actions.push(a);
    step = battle.act(a);
  }
  return { battle, actions };
}
