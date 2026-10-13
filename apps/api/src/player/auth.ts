import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import type { GameEnv } from '../env';

export const SESSION_TTL_DAYS = 30;
const TOKEN_PREFIX = 'uomd1.';

export interface GoogleClaims {
  sub: string;
  email?: string;
  name?: string;
}

let googleKeys: JWTVerifyGetKey | undefined;
const testKeys = new Map<string, JWTVerifyGetKey>();

export function googleKeyResolver(env: GameEnv): JWTVerifyGetKey {
  // a test JWKS is honoured only in local development, never from a deployed Worker
  if (env.ENVIRONMENT === 'dev' && env.GOOGLE_JWKS_URL) {
    let k = testKeys.get(env.GOOGLE_JWKS_URL);
    if (!k) testKeys.set(env.GOOGLE_JWKS_URL, (k = createRemoteJWKSet(new URL(env.GOOGLE_JWKS_URL), { cooldownDuration: 1000 })));
    return k;
  }
  return (googleKeys ??= createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { cooldownDuration: 30_000, cacheMaxAge: 3_600_000 }));
}

/**
 * Verifies a Google ID token (RS256, issuer Google, audience = one of our OAuth client IDs, not expired).
 * Fails CLOSED: with no GOOGLE_CLIENT_IDS configured nobody can sign in. `getKey` is injectable for tests.
 */
export async function verifyGoogleIdToken(idToken: string, env: GameEnv, getKey?: JWTVerifyGetKey): Promise<GoogleClaims> {
  const audiences = (env.GOOGLE_CLIENT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (audiences.length === 0) throw new HttpError(503, 'sign_in_not_configured', 'Google sign-in is not configured for this environment');
  try {
    const { payload } = await jwtVerify(idToken, getKey ?? googleKeyResolver(env), {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: audiences,
      algorithms: ['RS256']
    });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 255) throw new Error('no subject');
    return {
      sub: payload.sub,
      ...(typeof payload.email === 'string' && payload.email_verified !== false ? { email: payload.email.toLowerCase() } : {}),
      ...(typeof payload.name === 'string' ? { name: payload.name.slice(0, 60) } : {})
    };
  } catch (e) {
    const why = env.ENVIRONMENT === 'dev' ? ` (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})` : '';
    throw new HttpError(401, 'invalid_id_token', `Google ID token rejected${why}`);
  }
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return TOKEN_PREFIX + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface PlayerRef {
  id: string;
  displayName: string | null;
}

/**
 * Finds or creates the player for a Google subject. A new player receives the free-start roster (Mahmut and Fadyme: the
 * `characters` rows whose acquisition is `free_start`) in the same transaction as the account.
 */
export async function playerForGoogle(db: D1Database, claims: GoogleClaims): Promise<PlayerRef & { isNew: boolean }> {
  const find = (): Promise<{ id: string; display_name: string | null; status: string } | null> =>
    db.prepare('SELECT id, display_name, status FROM players WHERE google_sub = ?1').bind(claims.sub).first();
  let row = await find();
  let isNew = false;
  if (!row) {
    const id = `p_${crypto.randomUUID().replaceAll('-', '')}`;
    try {
      await db.batch([
        db.prepare("INSERT INTO players (id, google_sub, display_name, last_seen_at) VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(id, claims.sub, claims.name ?? null),
        db
          .prepare("INSERT INTO player_items (player_id, item_type, item_id) SELECT ?1, 'character', id FROM characters WHERE acquisition = 'free_start' AND status = 'active'")
          .bind(id),
        db.prepare(`INSERT INTO reward_grants (player_id, grant_key, reason, attachment_json, result_json)
          SELECT ?1, 'signup:' || ?1 || ':' || item_id, 'signup', json_object('type', 'character', 'itemId', item_id),
            json_object('copiesAdded', 1, 'shardsAdded', 0, 'copiesAfter', copies, 'shardsAfter', shards)
          FROM player_items WHERE player_id = ?1 AND item_type = 'character'`).bind(id)
      ]);
      isNew = true;
    } catch (e) {
      if (!/UNIQUE constraint failed: players\.google_sub/i.test(String(e instanceof Error ? e.message : e))) throw e;
    }
    row = await find();
  }
  if (!row) throw new HttpError(503, 'account_unavailable', 'account could not be created');
  if (row.status !== 'active') throw new HttpError(403, 'account_blocked', 'this account cannot sign in');
  return { id: row.id, displayName: row.display_name, isNew };
}

export async function issueSession(db: D1Database, playerId: string, now = new Date()): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  await db.batch([
    db.prepare('INSERT INTO sessions (token_hash, player_id, created_at, expires_at, last_used_at) VALUES (?1, ?2, ?3, ?4, ?3)').bind(await sha256Hex(token), playerId, now.toISOString(), expiresAt),
    db.prepare('UPDATE players SET last_seen_at = ?2 WHERE id = ?1').bind(playerId, now.toISOString()),
    // keep the table bounded: sessions that expired more than a week ago are of no use to anyone
    db.prepare('DELETE FROM sessions WHERE player_id = ?1 AND expires_at < ?2').bind(playerId, new Date(now.getTime() - 7 * 86_400_000).toISOString())
  ]);
  return { token, expiresAt };
}

/** Resolves a bearer token to an active player or throws 401. Touches `last_used_at` at most once per hour. */
export async function resolveSession(db: D1Database, authorization: string | undefined, now = new Date()): Promise<{ playerId: string; tokenHash: string }> {
  const m = /^Bearer (uomd1\.[A-Za-z0-9_-]{40,60})$/.exec(authorization ?? '');
  if (!m?.[1]) throw new HttpError(401, 'unauthenticated', 'sign in required');
  const tokenHash = await sha256Hex(m[1]);
  const row = await db
    .prepare(
      `SELECT s.player_id AS player_id, s.last_used_at AS last_used_at FROM sessions s JOIN players p ON p.id = s.player_id
       WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2 AND p.status = 'active'`
    )
    .bind(tokenHash, now.toISOString())
    .first<{ player_id: string; last_used_at: string }>();
  if (!row) throw new HttpError(401, 'unauthenticated', 'session is invalid or expired');
  if (now.getTime() - Date.parse(row.last_used_at) > 3_600_000) {
    await db.batch([
      db.prepare('UPDATE sessions SET last_used_at = ?2 WHERE token_hash = ?1').bind(tokenHash, now.toISOString()),
      db.prepare('UPDATE players SET last_seen_at = ?2 WHERE id = ?1').bind(row.player_id, now.toISOString())
    ]);
  }
  return { playerId: row.player_id, tokenHash };
}

export async function revokeSession(db: D1Database, tokenHash: string, now = new Date()): Promise<void> {
  await db.prepare('UPDATE sessions SET revoked_at = ?2 WHERE token_hash = ?1 AND revoked_at IS NULL').bind(tokenHash, now.toISOString()).run();
}
