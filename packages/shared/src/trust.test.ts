import { expect, it } from 'vitest';
import { assertTrustedKeys, generateSigningKeyPair, importPrivateKey, signPayload, verifyPayload, type PublicKeyJwk } from './index';
it('supports overlapping pretrusted roots and rejects unknown, ambiguous or private trust material', async () => {
  const first = await generateSigningKeyPair(); const second = await generateSigningKeyPair();
  const old = { ...first.publicJwk, kid: 'old' } as PublicKeyJwk; const next = { ...second.publicJwk, kid: 'next' } as PublicKeyJwk;
  const signed = await signPayload({ fixture: 'trust rotation' }, await importPrivateKey(second.privateJwk), 'next');
  expect(await verifyPayload(signed, [old, next])).toBe(true); expect(await verifyPayload(signed, [old])).toBe(false);
  expect(await verifyPayload(signed, [next, next])).toBe(false); expect(() => assertTrustedKeys([{ ...next, d: 'private-material' }])).toThrow();
  expect(() => assertTrustedKeys([])).toThrow(); expect(() => assertTrustedKeys([{ ...next, x: 'malformed' }])).toThrow();
});
