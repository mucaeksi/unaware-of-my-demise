import { base64UrlDecode, base64UrlEncode } from './hash';
import { canonicalJson } from './canonical';

/**
 * Manifest signatures are ECDSA P-256 / SHA-256 (IEEE P1363 encoding) over canonicalJson(manifest
 * without its "signature" field). P-256 is available in every WebCrypto implementation we ship on,
 * including older Android WebViews, which Ed25519 is not.
 */
const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIG = { name: 'ECDSA', hash: 'SHA-256' } as const;

export interface PublicKeyJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  kid?: string;
}

export type SignedPayload = Record<string, unknown> & { signature?: { kid: string; alg: 'ES256'; value: string } };

/** Compiled trust roots only. Replacing/removing a root requires a new reviewed application binary. */
export function assertTrustedKeys(value: unknown): asserts value is PublicKeyJwk[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw new Error('expected 1..8 public content trust roots');
  const ids = new Set<string>();
  for (const key of value as Record<string, unknown>[]) {
    if (!key || key.kty !== 'EC' || key.crv !== 'P-256' || typeof key.kid !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(key.kid) || ids.has(key.kid) || key.d !== undefined ||
      typeof key.x !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key.x) || typeof key.y !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key.y)) throw new Error('invalid or ambiguous public content trust root');
    const allowed = new Set(['kty', 'crv', 'x', 'y', 'kid', 'use', 'key_ops', 'alg', 'ext']);
    if (Object.entries(key).some(([name, value]) => value !== undefined && !allowed.has(name)) || key.alg !== undefined && key.alg !== 'ES256' || key.use !== undefined && key.use !== 'sig' || key.key_ops !== undefined && (!Array.isArray(key.key_ops) || key.key_ops.some((op) => op !== 'verify'))) throw new Error('content trust roots must contain public verification material only');
    ids.add(key.kid);
  }
}

function signingInput(payload: SignedPayload): Uint8Array {
  const { signature: _ignored, ...rest } = payload;
  return new TextEncoder().encode(canonicalJson(rest));
}

export async function importPublicKey(jwk: PublicKeyJwk): Promise<CryptoKey> {
  const { kid: _kid, ...rest } = jwk;
  return crypto.subtle.importKey('jwk', rest, ALG, false, ['verify']);
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ALG, false, ['sign']);
}

export async function signPayload(payload: SignedPayload, privateKey: CryptoKey, kid: string): Promise<SignedPayload> {
  const sig = new Uint8Array(await crypto.subtle.sign(SIG, privateKey, signingInput(payload) as BufferSource));
  return { ...payload, signature: { kid, alg: 'ES256', value: base64UrlEncode(sig) } };
}

export async function verifyPayload(payload: SignedPayload, trustedKeys: readonly PublicKeyJwk[]): Promise<boolean> {
  const sig = payload.signature;
  if (!sig || sig.alg !== 'ES256' || typeof sig.value !== 'string') return false;
  try { assertTrustedKeys(trustedKeys); } catch { return false; }
  const jwk = trustedKeys.find((k) => k.kid === sig.kid);
  if (!jwk) return false;
  try {
    const key = await importPublicKey(jwk);
    return await crypto.subtle.verify(SIG, key, base64UrlDecode(sig.value) as BufferSource, signingInput(payload) as BufferSource);
  } catch {
    return false;
  }
}

export async function generateSigningKeyPair(): Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }> {
  const pair = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair;
  return {
    publicJwk: (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey,
    privateJwk: (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey
  };
}
