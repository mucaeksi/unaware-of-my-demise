import { env } from 'cloudflare:workers';
import { SignJWT, exportJWK, generateKeyPair, type JWTVerifyGetKey } from 'jose';
import { base64UrlEncode, generateSigningKeyPair, sha256Hex, type PublicKeyJwk } from '@uomd/shared';
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

export async function accessToken(identity: { email?: string; commonName?: string }, over: { aud?: string; iss?: string; wrongKey?: boolean; expired?: boolean; amr?: string[]; mfa?: boolean } = {}): Promise<string> {
  let jwt = new SignJWT({
    ...(identity.email ? { email: identity.email } : {}),
    ...(identity.commonName ? { common_name: identity.commonName } : {}),
    ...(over.amr ? { amr: over.amr } : {}),
    ...(over.mfa !== undefined ? { mfa: over.mfa } : {})
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(over.iss ?? `https://${TEAM}`)
    .setAudience(over.aud ?? AUD)
    .setIssuedAt();
  jwt = over.expired ? jwt.setExpirationTime(Math.floor(Date.now() / 1000) - 60) : jwt.setExpirationTime('1h');
  return jwt.sign((over.wrongKey ? other : keys).privateKey);
}

const getKey = ((): JWTVerifyGetKey => async () => keys.publicKey) as unknown as () => JWTVerifyGetKey;

// Ephemeral unit-test keyring only; never written to a Worker or reused outside this test process.
export const baseEnv: GameEnv & AdminEnv = { ...(env as unknown as GameEnv & AdminEnv), PLAY_PACKAGE_NAME: 'app.uomd.test', BILLING_TOKEN_KEYS: JSON.stringify({ current: 'test', keys: { test: base64UrlEncode(crypto.getRandomValues(new Uint8Array(32))) } }) };

export function adminEnv(over: Partial<AdminEnv> = {}): AdminEnv {
  return {
    ...(baseEnv as AdminEnv),
    GAME: { fetch: async (input: RequestInfo | URL, init?: RequestInit) => gameApp.fetch(new Request(input, init), baseEnv) } as Fetcher,
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
export const ADMOB_UNIT = 'ca-app-pub-4258559369390965/3553164322';
/** AdMob's callback carries only the numeric unit id */
export const ADMOB_UNIT_NUMERIC = '3553164322';
const ssvPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
const ssvTestPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
const spkiB64 = async (k: CryptoKey): Promise<string> => btoa(String.fromCharCode(...new Uint8Array((await crypto.subtle.exportKey('spki', k)) as ArrayBuffer)));
const ssvTestSpki = await spkiB64(ssvTestPair.publicKey);
const ssvSpki = btoa(String.fromCharCode(...new Uint8Array((await crypto.subtle.exportKey('spki', ssvPair.publicKey)) as ArrayBuffer)));
import type { PlayClient, ProductPurchase, SubscriptionPurchase, OrderPurchase } from '../src/billing/play';

/** In-memory Google Play: tests script purchases/subscriptions and observe acknowledge/consume calls. */
export const fakePlay = {
  products: new Map<string, ProductPurchase>(),
  subs: new Map<string, SubscriptionPurchase>(),
  orders: new Map<string, OrderPurchase>(),
  calls: [] as string[],
  failAck: false,
  reset(): void {
    this.products.clear();
    this.subs.clear();
    this.orders.clear();
    this.calls = [];
    this.failAck = false;
  }
};
export const playClient: PlayClient = {
  async getProduct(_id, token) {
    const p = fakePlay.products.get(token);
    if (!p) throw new Error('unknown token');
    return p;
  },
  async getSubscription(token) {
    const s = fakePlay.subs.get(token);
    if (!s) throw new Error('unknown token');
    return s;
  },
  async getOrder(orderId) {
    const scripted = fakePlay.orders.get(orderId);
    if (scripted) return scripted;
    const entry = [...fakePlay.subs].find(([, s]) => s.latestOrderId === orderId);
    if (!entry) throw new Error('unknown order');
    return { orderId, purchaseToken: entry[0], createTimeMs: entry[1].startTimeMs, fullRefundTimeMs: 0, partialRefund: false };
  },
  async acknowledgeProduct(id, token) {
    fakePlay.calls.push(`ack:${id}:${token}`);
  },
  async consumeProduct(id, token) {
    if (fakePlay.failAck) throw new Error('play down');
    fakePlay.calls.push(`consume:${id}:${token}`);
    const p = fakePlay.products.get(token);
    if (p) p.consumed = true;
  },
  async acknowledgeSubscription(id, token) {
    if (fakePlay.failAck) throw new Error('play down');
    fakePlay.calls.push(`ack_sub:${id}:${token}`);
    const s = fakePlay.subs.get(token);
    if (s) s.acknowledged = true;
  }
};

/** Signs a Pub/Sub push token like Google does for an authenticated push subscription. */
export const RTDN_AUDIENCE = 'https://game.test/api/v1/billing/rtdn';
export const RTDN_SA = 'rtdn-push@project.iam.gserviceaccount.com';
export async function pushToken(over: { aud?: string; email?: string; wrongKey?: boolean; emailVerified?: boolean | null } = {}): Promise<string> {
  return new SignJWT({ email: over.email ?? RTDN_SA, ...(over.emailVerified === null ? {} : { email_verified: over.emailVerified ?? true }) })
    .setProtectedHeader({ alg: 'RS256', kid: 'g1' })
    .setIssuer('https://accounts.google.com')
    .setAudience(over.aud ?? RTDN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign((over.wrongKey ? other : googleKeys).privateKey);
}

const gameApp = createGameApp({
  play: () => playClient,
  getGoogleKey: (async () => googleKeys.publicKey) as unknown as JWTVerifyGetKey,
  admobKeys: async () => [{ keyId: 4242, base64: ssvSpki }, { keyId: 4343, base64: ssvTestSpki, test: true }]
});

function rawToDer(raw: Uint8Array): Uint8Array {
  const enc = (v: Uint8Array): number[] => {
    let a = [...v];
    while (a.length > 1 && a[0] === 0) a = a.slice(1);
    if ((a[0] as number) & 0x80) a = [0, ...a];
    return [0x02, a.length, ...a];
  };
  const body = [...enc(raw.slice(0, 32)), ...enc(raw.slice(32))];
  return Uint8Array.from([0x30, body.length, ...body]);
}

/** Builds an AdMob SSV callback URL path signed like Google does (ECDSA P-256 over the query without signature/key_id). */
export async function ssvPath(params: Record<string, string>, over: { badSignature?: boolean; keyId?: string; reorder?: boolean; test?: boolean; rawApostrophe?: boolean } = {}): Promise<string> {
  // `rawApostrophe`: Google signs the query exactly as it sends it; a reward name such as "Bell's Remains" may arrive with a literal '
  const message = over.rawApostrophe ? new URLSearchParams(params).toString().replace(/%27/g, "'") : new URLSearchParams(params).toString();
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, over.test ? ssvTestPair.privateKey : ssvPair.privateKey, new TextEncoder().encode(over.badSignature ? `${message}&tampered` : message)));
  const b64u = btoa(String.fromCharCode(...rawToDer(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return over.reorder ? `/api/v1/ads/ssv?key_id=${over.keyId ?? (over.test ? '4343' : '4242')}&${message}&signature=${b64u}` : `/api/v1/ads/ssv?${message}&signature=${b64u}&key_id=${over.keyId ?? (over.test ? '4343' : '4242')}`;
}

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
  return await gameApp.fetch(new Request(`https://game.test${path}`, init), { ...(baseEnv as GameEnv), GOOGLE_CLIENT_IDS: GOOGLE_CLIENT, ADMOB_AD_UNIT_IDS: ADMOB_UNIT, PLAY_PACKAGE_NAME: 'app.uomd.test', RTDN_AUDIENCE, RTDN_PUSH_SERVICE_ACCOUNT: RTDN_SA, ...over });
}

/** Signs a test player in through the real endpoint and returns the bearer header plus the player id. */
export async function signIn(sub: string): Promise<{ auth: Record<string, string>; playerId: string; token: string }> {
  // Independent synthetic actors use stable benchmark-range IPs; explicit auth-throttle tests call game directly.
  const hash = await sha256Hex(sub);
  const ip = `198.18.${parseInt(hash.slice(0, 2), 16)}.${parseInt(hash.slice(2, 4), 16)}`;
  const res = await game('/api/v1/auth/google', { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify({ idToken: await googleIdToken(sub) }) });
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

/** Seeds the 20 canon characters (stats are not the point here) and the canon catalog: the same SQL the deploy workflow runs. */
export async function seedCanonCatalog(): Promise<void> {
  const d = baseEnv.DB;
  const ids: [string, number][] = [['mahmut', 5], ['fadyme', 5], ['kera_voss', 4], ['brin_alder', 4], ['nixie_vale', 4], ['sister_aveline', 5], ['sable_wren', 5], ['tilda_fen', 4], ['rikka_ember', 4], ['mirel_quill', 5], ['odelia_pike', 4], ['pippa_bell', 4], ['nara_vell', 5], ['clem_marr', 3], ['vespera_wisp', 5], ['hana_birch', 3], ['thistle_roe', 4], ['iona_mist', 4], ['jori_flint', 3], ['marek_vane', 4]];
  for (const [id, r] of ids) {
    await d.prepare("INSERT OR IGNORE INTO characters (id, name_en, rarity, element, role, age, acquisition, base_hp, base_atk, base_def, base_spd) VALUES (?1,?1,?2,'Stone','tank',20,?3,10,2,2,4)").bind(id, r, id === 'mahmut' || id === 'fadyme' ? 'free_start' : 'gacha').run();
  }
  const sql = Object.values(import.meta.glob('../seed/catalog.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0] as string;
  const stmts = sql.split(/;\n(?=(?:INSERT|UPDATE) )/).map((x) => x.replace(/^--.*\n/, '').trim().replace(/;$/, '')).filter(Boolean);
  for (let i = 0; i < stmts.length; i += 50) await d.batch(stmts.slice(i, i + 50).map((s) => d.prepare(s)));
}
