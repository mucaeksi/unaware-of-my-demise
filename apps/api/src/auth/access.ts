import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { AdminEnv } from '../env';

export type Role = 'viewer' | 'operator' | 'owner';
const RANK: Record<Role, number> = { viewer: 1, operator: 2, owner: 3 };
export const atLeast = (have: Role, need: Role): boolean => RANK[have] >= RANK[need];

export interface AdminIdentity {
  /** email, or "svc:<client id>" for Access service tokens */
  identity: string;
  role: Role;
}

export class AuthError extends Error {
  constructor(readonly status: 401 | 403 | 503, readonly code: string, message: string) {
    super(message);
  }
}

const remoteKeys = new Map<string, JWTVerifyGetKey>();

/** Production key resolver: Cloudflare Access publishes its signing keys per team domain. */
export function accessKeys(teamDomain: string): JWTVerifyGetKey {
  let k = remoteKeys.get(teamDomain);
  if (!k) {
    k = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`), { cooldownDuration: 30_000, cacheMaxAge: 3_600_000 });
    remoteKeys.set(teamDomain, k);
  }
  return k;
}

function localKeys(url: string): JWTVerifyGetKey {
  let k = remoteKeys.get(url);
  if (!k) {
    k = createRemoteJWKSet(new URL(url), { cooldownDuration: 1000 });
    remoteKeys.set(url, k);
  }
  return k;
}

function tokenFrom(req: Request): string | null {
  const header = req.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = req.headers.get('Cookie') ?? '';
  const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  return m?.[1] ?? null;
}

/**
 * Verifies the Cloudflare Access JWT (RS256, issuer = team domain, audience = this application) and
 * maps the identity to a role in D1. Fails CLOSED: with no Access config nothing is admitted.
 */
export async function authenticate(req: Request, env: AdminEnv, getKey?: (teamDomain: string) => JWTVerifyGetKey): Promise<AdminIdentity> {
  // Local development only: a test-only JWKS (never honoured outside ENVIRONMENT=dev) so e2e tests can use explicit test identities.
  const resolver = getKey ?? (env.ENVIRONMENT === 'dev' && env.ACCESS_JWKS_URL ? () => localKeys(env.ACCESS_JWKS_URL as string) : accessKeys);
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) throw new AuthError(503, 'admin_auth_not_configured', 'Cloudflare Access is not configured for this Worker');
  const token = tokenFrom(req);
  if (!token) throw new AuthError(401, 'missing_token', 'no Cloudflare Access token');
  let payload;
  try {
    ({ payload } = await jwtVerify(token, resolver(env.ACCESS_TEAM_DOMAIN), {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
      algorithms: ['RS256']
    }));
  } catch (e) {
    // the reason is only revealed in local development, never from a deployed Worker
    const why = env.ENVIRONMENT === 'dev' ? ` (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})` : '';
    throw new AuthError(401, 'invalid_token', `Cloudflare Access token rejected${why}`);
  }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined;
  const common = typeof payload.common_name === 'string' ? payload.common_name : undefined;
  const identity = email ?? (common ? `svc:${common}` : undefined);
  if (!identity) throw new AuthError(401, 'no_identity', 'token carries no identity');

  const row = await env.DB.prepare('SELECT role FROM admin_users WHERE email = ?1').bind(identity).first<{ role: Role }>();
  if (row) return { identity, role: row.role };
  const bootstrap = (env.ADMIN_BOOTSTRAP_OWNERS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (email && bootstrap.includes(email)) {
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO admin_users (email, role, created_by) VALUES (?1, 'owner', 'bootstrap')").bind(email),
      env.DB.prepare("INSERT INTO audit_log (actor, action, target, detail) VALUES ('bootstrap', 'admin.bootstrap_owner', ?1, '{}')").bind(email)
    ]);
    return { identity, role: 'owner' };
  }
  throw new AuthError(403, 'not_an_admin', 'this identity has no role in the Control Center');
}
