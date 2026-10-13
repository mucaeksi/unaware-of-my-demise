import { canonicalJson } from '@uomd/shared';
import { HttpError } from '../content/store';

export type OperationInput = { requestId: string } & Record<string, unknown>;

/** A response-loss retry reads original terms before consulting today's mutable eligibility/catalog. */
export async function recordedOperation(db: D1Database, playerId: string, kind: string, input: OperationInput): Promise<Record<string, unknown> | null> {
  const row = await db.prepare('SELECT kind, input_json, result_json FROM progression_requests WHERE player_id = ?1 AND request_id = ?2')
    .bind(playerId, input.requestId).first<{ kind: string; input_json: string | null; result_json: string }>();
  if (!row) return null;
  if (row.kind !== kind || row.input_json !== canonicalJson(input)) throw new HttpError(409, 'request_id_reused', 'this identity belongs to another action');
  return { ...JSON.parse(row.result_json) as Record<string, unknown>, replayed: true };
}

export function operationStatement(db: D1Database, playerId: string, kind: string, input: OperationInput, result: Record<string, unknown>): D1PreparedStatement {
  return db.prepare('INSERT INTO progression_requests (player_id, request_id, kind, input_json, result_json) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(playerId, input.requestId, kind, canonicalJson(input), JSON.stringify(result));
}
