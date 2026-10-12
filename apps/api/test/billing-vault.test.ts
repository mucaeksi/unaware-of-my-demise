import { describe, expect, it } from 'vitest';
import { base64UrlEncode } from '@uomd/shared';
import { TokenVault } from '../src/billing/vault';
import { baseEnv } from './helpers';

const identity = { tokenHash: 'a'.repeat(64), playerId: 'test-player', productId: 'test-product' };
const keys = () => ({ a: base64UrlEncode(crypto.getRandomValues(new Uint8Array(32))), b: base64UrlEncode(crypto.getRandomValues(new Uint8Array(32))) });
const configured = (current: string, values: Record<string, string>) => ({ ...baseEnv, BILLING_TOKEN_KEYS: JSON.stringify({ current, keys: values }) });

describe('billing token encryption', () => {
  it('round-trips opaque Unicode/BOM tokens with fresh nonces and rejects a changed account/product/hash/environment/package', async () => {
    const env = configured('a', keys()); const vault = new TokenVault(env);
    const token = '\uFEFFopaque-token-日本語';
    const first = await vault.seal(token, identity); const second = await vault.seal(token, identity);
    expect(first).not.toBe(second); expect(first).not.toContain(token);
    expect(await vault.open(first, identity)).toBe(token);
    for (const different of [{ ...identity, playerId: 'other' }, { ...identity, productId: 'other' }, { ...identity, tokenHash: 'b'.repeat(64) }]) await expect(vault.open(first, different)).rejects.toMatchObject({ code: 'billing_recovery_corrupt' });
    for (const different of [{ ...env, ENVIRONMENT: 'staging' as const }, { ...env, PLAY_PACKAGE_NAME: 'other.app' }]) await expect(new TokenVault(different).open(first, identity)).rejects.toMatchObject({ code: 'billing_recovery_corrupt' });
  });

  it('rejects tampered ciphertext and malformed envelopes without returning token data', async () => {
    const vault = new TokenVault(configured('a', keys()));
    const envelope = JSON.parse(await vault.seal('private-opaque-purchase-token', identity)) as { data: string };
    envelope.data = (envelope.data[0] === 'A' ? 'B' : 'A') + envelope.data.slice(1);
    for (const ciphertext of [JSON.stringify(envelope), 'not JSON', '{"kid":"a","iv":"bad","data":"bad"}']) await expect(vault.open(ciphertext, identity)).rejects.toMatchObject({ code: 'billing_recovery_corrupt' });
  });

  it('reads retained keys after rotation and explicitly blocks a removed decryption key', async () => {
    const values = keys(); const original = new TokenVault(configured('a', values));
    const first = await original.seal('private-rotation-token', identity);
    const rotated = new TokenVault(configured('b', values));
    expect(await rotated.open(first, identity)).toBe('private-rotation-token');
    expect(JSON.parse(await rotated.seal('private-rotation-token', identity))).toHaveProperty('kid', 'b');
    await expect(new TokenVault(configured('b', { b: values.b })).open(first, identity)).rejects.toMatchObject({ code: 'billing_recovery_key_missing' });
    const aliases = new TokenVault(configured('a', { a: values.a, b: values.a }));
    const aliased = JSON.parse(await aliases.seal('private-alias-token', identity)) as { kid: string };
    aliased.kid = 'b';
    await expect(aliases.open(JSON.stringify(aliased), identity)).rejects.toMatchObject({ code: 'billing_recovery_corrupt' });
    aliased.kid = 'constructor';
    await expect(aliases.open(JSON.stringify(aliased), identity)).rejects.toMatchObject({ code: 'billing_recovery_key_missing' });
  });

  it('fails closed for absent/noncanonical/invalid keyrings and oversized UTF-8 input', async () => {
    for (const secret of ['', '{}', JSON.stringify({ current: 'missing', keys: keys() }), JSON.stringify({ current: 'constructor', keys: {} }), JSON.stringify({ current: 'a', keys: { a: 'A'.repeat(42) + 'B' } })]) expect(() => new TokenVault({ ...baseEnv, BILLING_TOKEN_KEYS: secret })).toThrow('billing recovery keyring is not configured');
    await expect(new TokenVault(configured('a', keys())).seal('日'.repeat(2000), identity)).rejects.toMatchObject({ code: 'bad_request' });
  });
});
