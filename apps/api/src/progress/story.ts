import { z } from 'zod';
import { economicStatement, requireEconomic } from '../content/authority';
import { HttpError } from '../content/store';
import { operationStatement, recordedOperation } from '../db/operations';
import type { GameEnv } from '../env';
import { loadProgressNode } from './service';
import { loadLibrary, libraryGateStatement, requireLibraryGate } from '../library/service';

export const StoryCompletion = z.object({
  releaseId: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/),
  nodeId: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/)
}).strict();
export type StoryCompletion = z.infer<typeof StoryCompletion>;

/** Reading/skip completion advances the graph once; it never grants rewards, stars, tasks or Ration. */
export async function completeStory(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, playerId: string, input: StoryCompletion, now = new Date()): Promise<Record<string, unknown>> {
  const db = env.DB;
  const prior = await recordedOperation(db, playerId, 'story_complete', input);
  if (prior) return prior;
  const library = await loadLibrary(env, input.releaseId);
  const entry = library?.entries.find((entry) => entry.entry_id === input.nodeId);
  const campaign = entry ? null : await loadProgressNode(env, playerId, input.releaseId, input.nodeId, 'story');
  if (entry) await requireLibraryGate(env, playerId, entry);
  await requireEconomic(db, env.CONTENT_CHANNEL, input.releaseId, playerId, input.nodeId, now);
  const result = { requestId: input.requestId, releaseId: input.releaseId, nodeId: input.nodeId, completed: true, replayed: false };
  const statements = [economicStatement(db, env.CONTENT_CHANNEL, input.releaseId, playerId, input.nodeId, now, undefined, true)];
  if (entry) statements.push(libraryGateStatement(db, playerId, entry.gate));
  if (campaign?.node.requires) statements.push(db.prepare(`INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS
    (SELECT 1 FROM player_progress WHERE player_id = ?1 AND node_id = ?2 AND ${campaign.prerequisiteKind === 'story' ? 'clears' : 'stars'} >= 1) THEN 1 ELSE 0 END)`).bind(playerId, campaign.node.requires));
  statements.push(db.prepare(`INSERT INTO player_progress (player_id, node_id, stars, clears, first_cleared_at, updated_at)
    VALUES (?1, ?2, 0, 1, ?3, ?3) ON CONFLICT (player_id, node_id) DO NOTHING`).bind(playerId, input.nodeId, now.toISOString()),
    operationStatement(db, playerId, 'story_complete', input, result), db.prepare('DELETE FROM tx_guard'));
  try { await db.batch(statements); }
  catch (error) {
    const replay = await recordedOperation(db, playerId, 'story_complete', input);
    if (replay) return replay;
    if (/CHECK constraint failed: ok = 1/i.test(String(error))) throw new HttpError(409, 'story_state_changed', 'the account, release or prerequisite changed; refresh before continuing');
    throw error;
  }
  return result;
}
