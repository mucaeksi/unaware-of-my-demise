import { z } from 'zod';
import { canonicalJson } from '@uomd/shared';
import { HttpError } from '../content/store';

export const RequestId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export interface AdminRequest {
  requestId: string;
  actor: string;
  action: string;
  target: string;
  input: Record<string, unknown>;
}

/** A retried requestId returns the original outcome; the same id for a different actor/action/target/input is a conflict. */
export async function recordedAdminRequest(db: D1Database, r: AdminRequest): Promise<{ status: 200 | 201; result: Record<string, unknown> } | null> {
  const row = await db
    .prepare('SELECT actor, action, target, input_json, status, result_json FROM admin_requests WHERE request_id = ?1')
    .bind(r.requestId)
    .first<{ actor: string; action: string; target: string; input_json: string; status: number; result_json: string }>();
  if (!row) return null;
  if (row.actor !== r.actor || row.action !== r.action || row.target !== r.target || row.input_json !== canonicalJson(r.input)) {
    throw new HttpError(409, 'request_id_reused', 'this requestId belongs to a different admin action');
  }
  return { status: row.status === 201 ? 201 : 200, result: { ...(JSON.parse(row.result_json) as Record<string, unknown>), replayed: true } };
}

/** Records the outcome in the same batch as the change. A `{ sql, binds }` result computes the JSON from rows written earlier in the batch; its placeholders start at ?7. */
export function adminRequestStatement(db: D1Database, r: AdminRequest, status: 200 | 201, result: Record<string, unknown> | { sql: string; binds: unknown[] }): D1PreparedStatement {
  const base = 'INSERT INTO admin_requests (request_id, actor, action, target, input_json, status, result_json)';
  if ('sql' in result && typeof result.sql === 'string') {
    return db.prepare(`${base} SELECT ?1, ?2, ?3, ?4, ?5, ?6, ${result.sql}`).bind(r.requestId, r.actor, r.action, r.target, canonicalJson(r.input), status, ...(result.binds as unknown[]));
  }
  return db.prepare(`${base} VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(r.requestId, r.actor, r.action, r.target, canonicalJson(r.input), status, JSON.stringify(result));
}

/** Aborts the whole batch unless the immediately preceding statement changed exactly one row. Pair with `clearGuard`. */
export const changedOne = (db: D1Database): D1PreparedStatement => db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)');
export const clearGuard = (db: D1Database): D1PreparedStatement => db.prepare('DELETE FROM tx_guard');
export const isGuardFailure = (e: unknown): boolean => /CHECK constraint failed: ok = 1/i.test(String(e instanceof Error ? e.message : e));
