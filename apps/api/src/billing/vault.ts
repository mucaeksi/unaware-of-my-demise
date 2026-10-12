import { base64UrlDecode, base64UrlEncode } from '@uomd/shared';
import { z } from 'zod';
import { HttpError } from '../content/store';
import type { GameEnv } from '../env';

const KeyId = z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/);
const Keyring = z.object({ current: KeyId, keys: z.record(KeyId, z.string().regex(/^[A-Za-z0-9_-]{43}$/)) }).strict();
const Envelope = z.object({ kid: KeyId, iv: z.string().regex(/^[A-Za-z0-9_-]{16}$/), data: z.string().regex(/^[A-Za-z0-9_-]{20,6000}$/) }).strict();
export type TokenIdentity = { tokenHash: string; playerId: string; productId: string };
const enc = new TextEncoder();

/** Keyring is an environment-specific Worker secret; prior keys remain available until ciphertext is rewrapped. */
export class TokenVault {
  private readonly keyring: z.infer<typeof Keyring>;
  constructor(private readonly env: GameEnv) {
    try {
      this.keyring = Keyring.parse(JSON.parse(env.BILLING_TOKEN_KEYS ?? ''));
      if (!Object.hasOwn(this.keyring.keys, this.keyring.current) || Object.keys(this.keyring.keys).length > 8) throw new Error('invalid keyring');
      for (const value of Object.values(this.keyring.keys)) {
        const decoded = base64UrlDecode(value);
        if (decoded.length !== 32 || base64UrlEncode(decoded) !== value) throw new Error('invalid key');
      }
    } catch { throw new HttpError(503, 'billing_recovery_not_configured', 'billing recovery keyring is not configured'); }
  }
  private aad(identity: TokenIdentity, kid: string): Uint8Array {
    return enc.encode(JSON.stringify(['uomd-play-token-v1', kid, this.env.ENVIRONMENT, this.env.PLAY_PACKAGE_NAME, identity.tokenHash, identity.playerId, identity.productId]));
  }
  private async key(kid: string): Promise<CryptoKey> {
    const value = Object.hasOwn(this.keyring.keys, kid) ? this.keyring.keys[kid] : undefined;
    if (!value) throw new HttpError(503, 'billing_recovery_key_missing', 'billing recovery needs a retained decryption key');
    return crypto.subtle.importKey('raw', base64UrlDecode(value) as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async seal(token: string, identity: TokenIdentity): Promise<string> {
    const bytes = enc.encode(token);
    if (bytes.length < 1 || bytes.length > 4096) throw new HttpError(400, 'bad_request', 'invalid purchase token length');
    const kid = this.keyring.current;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this.aad(identity, kid) as BufferSource }, await this.key(kid), bytes);
    return JSON.stringify({ kid, iv: base64UrlEncode(iv), data: base64UrlEncode(new Uint8Array(data)) });
  }
  async open(ciphertext: string, identity: TokenIdentity): Promise<string> {
    let envelope: z.infer<typeof Envelope>;
    try { envelope = Envelope.parse(JSON.parse(ciphertext)); }
    catch { throw new HttpError(409, 'billing_recovery_corrupt', 'stored billing token needs operator review'); }
    const key = await this.key(envelope.kid);
    try {
      const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlDecode(envelope.iv) as BufferSource, additionalData: this.aad(identity, envelope.kid) as BufferSource }, key, base64UrlDecode(envelope.data) as BufferSource);
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data);
    } catch { throw new HttpError(409, 'billing_recovery_corrupt', 'stored billing token needs operator review'); }
  }
}
