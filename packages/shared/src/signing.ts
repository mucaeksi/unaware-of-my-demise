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
  const pair = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  return {
    publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey)
  };
}
