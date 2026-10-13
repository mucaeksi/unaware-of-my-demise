import { z } from 'zod';
import { HttpError } from '../content/store';
import { canonicalJson } from '@uomd/shared';
import { recordedOperation } from '../db/operations';

export interface EntryRecord {
  phase: 'not_started' | 'in_progress' | 'completed';
  prologue: boolean;
  tutorials: number;
  updatedAt: string | null;
  requestId?: string;
  replayed?: boolean;
}

/** What a client may report. Values only ever move forward on the server: the stored record is the max of what it had and what is sent. */
export const EntryBody = z
  .object({
    prologue: z.boolean(),
    tutorials: z.number().int().min(0).max(3),
    completed: z.boolean().optional(),
    requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional()
  })
  .strict();
export type EntryBody = z.infer<typeof EntryBody>;

interface Row {
  phase: 'in_progress' | 'completed';
  prologue: number;
  tutorials: number;
  updated_at: string;
}

const toRecord = (r: Row | null): EntryRecord => (r ? { phase: r.phase, prologue: r.prologue === 1, tutorials: r.tutorials, updatedAt: r.updated_at } : { phase: 'not_started', prologue: false, tutorials: 0, updatedAt: null });

export async function getEntry(db: D1Database, playerId: string): Promise<EntryRecord> {
  return toRecord(await db.prepare('SELECT phase, prologue, tutorials, updated_at FROM player_entry WHERE player_id = ?1').bind(playerId).first<Row>());
}

/**
 * Raises the checkpoint (never lowers it; replays and out-of-order retries are harmless). `completed` is only accepted once the
 * merged record has the prologue seen and all three tutorials done: the patch page cannot be reached without them.
 */
export async function putEntry(db: D1Database, playerId: string, input: EntryBody): Promise<EntryRecord> {
  const operation = input.requestId ? { ...input, requestId: input.requestId } : null;
  const recorded = operation ? await recordedOperation(db, playerId, 'entry_checkpoint', operation) : null;
  if (recorded) return recorded as unknown as EntryRecord;
  const current = await getEntry(db, playerId);
  const prologue = current.prologue || input.prologue || input.tutorials > 0;
  const tutorials = Math.max(current.tutorials, input.tutorials);
  const completed = current.phase === 'completed' || input.completed === true;
  if (completed && (!prologue || tutorials < 3)) throw new HttpError(422, 'entry_incomplete', 'the prologue and all three tutorials must be finished first');
  const noop = !prologue && tutorials === 0 && !completed && current.phase === 'not_started';
  const statements: D1PreparedStatement[] = [db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status = 'active') THEN 1 ELSE 0 END)").bind(playerId)];
  if (!noop) statements.push(db.prepare(
      `INSERT INTO player_entry (player_id, phase, prologue, tutorials) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (player_id) DO UPDATE SET
         phase = CASE WHEN player_entry.phase = 'completed' OR excluded.phase = 'completed' THEN 'completed' ELSE 'in_progress' END,
         prologue = max(player_entry.prologue, excluded.prologue),
         tutorials = max(player_entry.tutorials, excluded.tutorials),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    )
    .bind(playerId, completed ? 'completed' : 'in_progress', prologue ? 1 : 0, tutorials));
  if (operation) {
    statements.push(db.prepare(`INSERT INTO progression_requests (player_id, request_id, kind, input_json, result_json)
      SELECT ?1, ?2, 'entry_checkpoint', ?3, json_object('phase', COALESCE(e.phase, 'not_started'), 'prologue', json(CASE WHEN e.prologue = 1 THEN 'true' ELSE 'false' END),
        'tutorials', COALESCE(e.tutorials, 0), 'updatedAt', e.updated_at, 'playerId', ?1, 'requestId', ?2)
        FROM players p LEFT JOIN player_entry e ON e.player_id = p.id WHERE p.id = ?1`)
      .bind(playerId, operation.requestId, canonicalJson(operation)));
  }
  statements.push(db.prepare('DELETE FROM tx_guard'));
  try { await db.batch(statements); }
  catch (error) {
    const replay = operation ? await recordedOperation(db, playerId, 'entry_checkpoint', operation) : null;
    if (replay) return replay as unknown as EntryRecord;
    if (/CHECK constraint failed: ok = 1/i.test(String(error))) throw new HttpError(401, 'unauthorized', 'the account is unavailable');
    throw error;
  }
  if (operation) {
    const committed = await recordedOperation(db, playerId, 'entry_checkpoint', operation);
    if (!committed) throw new HttpError(401, 'unauthorized', 'the account is unavailable');
    return { ...committed, replayed: false } as unknown as EntryRecord;
  }
  return getEntry(db, playerId);
}
