import type { Channel } from '@uomd/content-schema';
import { auditStatement } from '../db/audit';
import { HttpError } from './store';

export const BATTLE_SESSION_TTL_MS = 2 * 3_600_000;
const MAX_ALLOWLIST_MS = 24 * 3_600_000;

const ADMITTED = `SELECT r.id FROM content_releases r
  JOIN channel_pointers p ON p.channel = r.channel
  LEFT JOIN release_economic_policy a ON a.release_id = r.id
  WHERE r.id = ?1 AND r.channel = ?2 AND r.state = 'published'
    AND EXISTS (SELECT 1 FROM players WHERE id = ?5 AND status = 'active')
    AND r.generation > p.economic_floor AND COALESCE(a.mode, '') != 'revoked'
    AND (p.release_id = r.id
      OR (a.mode = 'allowlisted' AND julianday(a.valid_until) > julianday(?3))
      OR (a.mode = 'grace' AND julianday(a.valid_until) > julianday(?3)
        AND EXISTS (SELECT 1 FROM battle_sessions s WHERE s.id = ?4 AND s.player_id = ?5
          AND s.release_id = r.id AND s.node_id = ?6 AND s.consumed_at IS NULL
          AND julianday(s.created_at) <= julianday(a.cutover_at)
          AND julianday(s.expires_at) > julianday(?3))))`;

export function economicStatement(db: D1Database, channel: Channel, releaseId: string, playerId: string, nodeId: string, now: Date, sessionId?: string, guard = false): D1PreparedStatement {
  return db.prepare(guard ? `INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (${ADMITTED}) THEN 1 ELSE 0 END)` : ADMITTED)
    .bind(releaseId, channel, now.toISOString(), sessionId ?? null, playerId, nodeId);
}

export async function requireEconomic(db: D1Database, channel: Channel, releaseId: string, playerId: string, nodeId: string, now: Date, sessionId?: string): Promise<void> {
  if (!(await economicStatement(db, channel, releaseId, playerId, nodeId, now, sessionId).first())) throw new HttpError(409, 'release_not_economic', 'this release no longer accepts new rewards; refresh content');
}

/** Manual exceptions expire; a channel kill floor cannot be waived by an allowlist. */
export async function setEconomicPolicy(db: D1Database, releaseId: string, actor: string, role: 'owner' | 'operator', input: { mode: 'allowlisted' | 'grace' | 'revoked'; expectedVersion: number; validUntil?: string; reason: string }, now = new Date()): Promise<void> {
  const release = await db.prepare('SELECT r.channel, r.generation, r.state, p.release_id AS current_id, p.economic_floor FROM content_releases r LEFT JOIN channel_pointers p ON p.channel = r.channel WHERE r.id = ?1').bind(releaseId).first<{ channel: Channel; generation: number; state: string; current_id: string | null; economic_floor: number | null }>();
  if (!release || release.state !== 'published') throw new HttpError(404, 'unknown_release', 'no published release');
  if (release.channel === 'production' && role !== 'owner') throw new HttpError(403, 'owner_required', 'production economic policy needs the owner');
  if (input.mode !== 'revoked' && (release.current_id === releaseId || release.generation <= (release.economic_floor ?? Infinity))) throw new HttpError(409, 'invalid_exception', 'exceptions require an older release above the channel kill floor');
  const until = input.validUntil ? Date.parse(input.validUntil) : NaN;
  const max = input.mode === 'grace' ? BATTLE_SESSION_TTL_MS : MAX_ALLOWLIST_MS;
  if (input.mode !== 'revoked' && (!Number.isFinite(until) || until <= now.getTime() || until > now.getTime() + max)) throw new HttpError(400, 'bad_deadline', 'exception requires a bounded future deadline');
  if (input.mode === 'revoked' && input.validUntil) throw new HttpError(400, 'bad_deadline', 'revocation has no expiry');
  const stamp = now.toISOString();
  // An edited grace cannot admit sessions started after the original publication cutover.
  const old = await db.prepare('SELECT cutover_at FROM release_economic_policy WHERE release_id = ?1').bind(releaseId).first<{ cutover_at: string }>();
  const successor = old ? null : await db.prepare("SELECT MIN(published_at) AS cutover_at FROM content_releases WHERE channel = ?1 AND generation > ?2 AND state = 'published'").bind(release.channel, release.generation).first<{ cutover_at: string | null }>();
  const cutover = old?.cutover_at ?? successor?.cutover_at ?? stamp;
  if (input.mode === 'grace' && until > Date.parse(cutover) + BATTLE_SESSION_TTL_MS) throw new HttpError(400, 'bad_deadline', 'grace cannot extend beyond the original cutover window');
  try {
    await db.batch([
      db.prepare(`INSERT INTO release_economic_policy (release_id, mode, valid_until, cutover_at, updated_by, updated_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE (?7 = 0 OR EXISTS (SELECT 1 FROM release_economic_policy WHERE release_id = ?1 AND version = ?7))
          AND EXISTS (SELECT 1 FROM content_releases r JOIN channel_pointers p ON p.channel = r.channel
            WHERE r.id = ?1 AND r.state = 'published' AND (?2 = 'revoked' OR (r.generation > p.economic_floor AND r.id != p.release_id)))
        ON CONFLICT (release_id) DO UPDATE SET mode = excluded.mode, valid_until = excluded.valid_until,
          cutover_at = excluded.cutover_at, version = version + 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at
        WHERE version = ?7`).bind(releaseId, input.mode, input.mode === 'revoked' ? null : new Date(until).toISOString(), cutover, actor, stamp, input.expectedVersion),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      auditStatement(db, actor, 'release.economic_policy', releaseId, { ...input, version: input.expectedVersion + 1 }),
      db.prepare('DELETE FROM tx_guard')
    ]);
  } catch (e) {
    if (/CHECK constraint failed: ok = 1/i.test(String(e))) throw new HttpError(409, 'policy_conflict', 'economic policy changed; refresh before retrying');
    throw e;
  }
}
