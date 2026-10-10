import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  bytesToHex,
  canonicalJson,
  compareSemver,
  generateSigningKeyPair,
  importPrivateKey,
  parseSemver,
  Rng,
  sha256Hex,
  signPayload,
  verifyPayload,
  type PublicKeyJwk
} from './index';

describe('hashing and encoding', () => {
  it('sha256 matches the known vector for "abc" and is identical for string and bytes', async () => {
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(await sha256Hex('abc')).toBe(expected);
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(expected);
  });

  it('base64url round-trips arbitrary bytes without padding', () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const text = base64UrlEncode(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect([...base64UrlDecode(text)]).toEqual([...bytes]);
    expect(bytesToHex(Uint8Array.from([0, 15, 255]))).toBe('000fff');
  });
});

describe('canonical JSON (the signing input)', () => {
  it('is independent of key order, drops undefined, and keeps arrays ordered', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 2, 1], c: undefined } })).toBe('{"a":{"d":[3,2,1]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it('refuses values that would make signatures ambiguous', () => {
    expect(() => canonicalJson({ x: NaN })).toThrow(/non-finite/);
    expect(() => canonicalJson({ x: Infinity })).toThrow(/non-finite/);
    expect(() => canonicalJson({ x: () => 1 })).toThrow(/unsupported/);
  });
});

describe('semver', () => {
  it('parses strictly and orders numerically (1.10.0 > 1.9.0)', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
    expect(() => parseSemver('1.2')).toThrow();
    expect(() => parseSemver('1.2.3-beta')).toThrow();
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
    expect(compareSemver('0.1.0', '0.1.0')).toBe(0);
    expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
  });
});

describe('deterministic RNG', () => {
  it('same seed gives the same sequence; different seeds differ; values are in [0,1)', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(Array.from({ length: 5 }, () => new Rng(43).next())).not.toEqual(seqA.slice(0, 5));
    // pinned values: a change here would silently invalidate every stored battle replay
    expect(new Rng(1).next()).toBeCloseTo(0.6270739405881613, 12);
  });
});

describe('ES256 manifest signatures', () => {
  async function fixture() {
    const pair = await generateSigningKeyPair();
    const trusted: PublicKeyJwk = { ...(pair.publicJwk as PublicKeyJwk), kid: 'k1' };
    const priv = await importPrivateKey(pair.privateJwk);
    return { trusted, priv };
  }

  it('verifies a signed payload and ignores key order', async () => {
    const { trusted, priv } = await fixture();
    const signed = await signPayload({ release: 'rel_1', generation: 1, files: [{ path: 'a.json', sha256: 'x' }] }, priv, 'k1');
    expect(await verifyPayload(signed, [trusted])).toBe(true);
    const reordered = { signature: signed.signature, files: signed.files, generation: 1, release: 'rel_1' };
    expect(await verifyPayload(reordered, [trusted])).toBe(true);
  });

  it('rejects tampering, unknown key ids, a different key, and missing or malformed signatures', async () => {
    const { trusted, priv } = await fixture();
    const other = await fixture();
    const signed = await signPayload({ release: 'rel_1', generation: 1 }, priv, 'k1');
    expect(await verifyPayload({ ...signed, generation: 2 }, [trusted])).toBe(false);
    expect(await verifyPayload(signed, [{ ...trusted, kid: 'other' }])).toBe(false);
    expect(await verifyPayload(signed, [{ ...other.trusted, kid: 'k1' }])).toBe(false);
    expect(await verifyPayload({ release: 'rel_1', generation: 1 }, [trusted])).toBe(false);
    expect(await verifyPayload({ ...signed, signature: { kid: 'k1', alg: 'ES256', value: 'AAAA' } }, [trusted])).toBe(false);
    expect(await verifyPayload({ ...signed, signature: { kid: 'k1', alg: 'none' as 'ES256', value: signed.signature?.value ?? '' } }, [trusted])).toBe(false);
  });
});
