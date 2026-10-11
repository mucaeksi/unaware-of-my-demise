import { env } from 'cloudflare:workers';
import { SignJWT, exportJWK, generateKeyPair, type JWTVerifyGetKey } from 'jose';
import { generateSigningKeyPair, type PublicKeyJwk } from '@uomd/shared';
import { createAdminApp } from '../src/adminApp';
import { createGameApp } from '../src/gameApp';
import type { AdminEnv, GameEnv } from '../src/env';
import type { TestFile } from './fixtures';

export const TEAM = 'test-team.cloudflareaccess.com';
export const AUD = 'test-aud-0123456789';

const keys = await generateKeyPair('RS256');
const other = await generateKeyPair('RS256');
const signing = await generateSigningKeyPair();
export const SIGNING_KID = 'test-kid-1';
export const signingPublic: PublicKeyJwk = { ...(signing.publicJwk as PublicKeyJwk), kid: SIGNING_KID };
void exportJWK;

export async function accessToken(identity: { email?: string; commonName?: string }, over: { aud?: string; iss?: string; wrongKey?: boolean; expired?: boolean } = {}): Promise<string> {
  let jwt = new SignJWT({ ...(identity.email ? { email: identity.email } : {}), ...(identity.commonName ? { common_name: identity.commonName } : {}) })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(over.iss ?? `https://${TEAM}`)
    .setAudience(over.aud ?? AUD)
    .setIssuedAt();
  jwt = over.expired ? jwt.setExpirationTime(Math.floor(Date.now() / 1000) - 60) : jwt.setExpirationTime('1h');
  return jwt.sign((over.wrongKey ? other : keys).privateKey);
}

const getKey = ((): JWTVerifyGetKey => async () => keys.publicKey) as unknown as () => JWTVerifyGetKey;

export const baseEnv = env as unknown as GameEnv & AdminEnv;

export function adminEnv(over: Partial<AdminEnv> = {}): AdminEnv {
  return {
    ...(baseEnv as AdminEnv),
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
    ADMIN_BOOTSTRAP_OWNERS: 'owner@example.com',
    CONTENT_SIGNING_KEY: JSON.stringify({ ...signing.privateJwk, kid: SIGNING_KID }),
    CONTENT_SIGNING_KID: SIGNING_KID,
    ...over
  };
}

const adminApp = createAdminApp({ getKey });
export const GOOGLE_CLIENT = 'test-client-1.apps.googleusercontent.com';
const googleKeys = await generateKeyPair('RS256');
const gameApp = createGameApp({ getGoogleKey: (async () => googleKeys.publicKey) as unknown as JWTVerifyGetKey });

export async function googleIdToken(sub: string, over: { aud?: string; iss?: string; expired?: boolean; wrongKey?: boolean; name?: string } = {}): Promise<string> {
  let jwt = new SignJWT({ email: `${sub}@example.com`, email_verified: true, name: over.name ?? 'Test Player', padding: 'x'.repeat(80) })
    .setProtectedHeader({ alg: 'RS256', kid: 'g1' })
    .setSubject(sub)
    .setIssuer(over.iss ?? 'https://accounts.google.com')
    .setAudience(over.aud ?? GOOGLE_CLIENT)
    .setIssuedAt();
  jwt = over.expired ? jwt.setExpirationTime(Math.floor(Date.now() / 1000) - 60) : jwt.setExpirationTime('1h');
  return jwt.sign((over.wrongKey ? other : googleKeys).privateKey);
}

export async function admin(path: string, init: RequestInit & { as?: string | null; env?: AdminEnv } = {}): Promise<Response> {
  const { as = 'owner@example.com', env: e = adminEnv(), headers, ...rest } = init;
  const h = new Headers(headers);
  if (as) h.set('Cf-Access-Jwt-Assertion', await accessToken({ email: as }));
  return adminApp.fetch(new Request(`https://admin.test${path}`, { ...rest, headers: h }), e);
}

export async function game(path: string, init: RequestInit = {}, over: Partial<GameEnv> = {}): Promise<Response> {
  return await gameApp.fetch(new Request(`https://game.test${path}`, init), { ...(baseEnv as GameEnv), GOOGLE_CLIENT_IDS: GOOGLE_CLIENT, ...over });
}

/** Signs a test player in through the real endpoint and returns the bearer header plus the player id. */
export async function signIn(sub: string): Promise<{ auth: Record<string, string>; playerId: string; token: string }> {
  const res = await game('/api/v1/auth/google', { method: 'POST', body: JSON.stringify({ idToken: await googleIdToken(sub) }) });
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { token: string; player: { id: string } };
  return { auth: { Authorization: `Bearer ${j.token}` }, playerId: j.player.id, token: j.token };
}

export const post = (body: unknown, auth: Record<string, string> = {}): RequestInit => ({ method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...auth } });

export async function upload(files: TestFile[], as = 'owner@example.com'): Promise<void> {
  for (const f of files) {
    const res = await admin(`/admin/api/objects/${f.sha256}`, { method: 'PUT', body: f.bytes as BodyInit, headers: { 'Content-Type': f.mediaType }, as });
    if (res.status !== 200 && res.status !== 201) throw new Error(`upload ${f.path} failed: ${res.status} ${await res.text()}`);
  }
}

export const entries = (files: TestFile[]): { path: string; sha256: string }[] => files.map((f) => ({ path: f.path, sha256: f.sha256 }));

export async function resetContent(): Promise<void> {
  // content tables are append-mostly; tests that need a clean slate wipe the non-audit tables in dependency order
  const db = baseEnv.DB;
  await db.batch([
    db.prepare('DELETE FROM channel_pointers'),
    db.prepare('DELETE FROM release_files'),
    db.prepare('DELETE FROM content_releases'),
    db.prepare('DELETE FROM content_objects'),
    db.prepare('DELETE FROM battle_audit'),
    db.prepare('DELETE FROM rate_counters')
  ]);
}
