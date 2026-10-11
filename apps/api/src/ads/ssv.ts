import { HttpError } from '../content/store';

export interface SsvKey {
  keyId: number | string;
  /** base64 of the SPKI DER public key */
  base64: string;
}
export type SsvKeyFetcher = () => Promise<SsvKey[]>;

export const ADMOB_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
let cache: { at: number; keys: SsvKey[] } | undefined;

/** Google's public AdMob verifier keys (rotated rarely; cached for an hour, refreshed when a key id is unknown). */
export const googleKeyFetcher: SsvKeyFetcher = async () => {
  if (cache && Date.now() - cache.at < 3_600_000) return cache.keys;
  const res = await fetch(ADMOB_KEYS_URL);
  if (!res.ok) throw new HttpError(503, 'ssv_keys_unavailable', 'AdMob verifier keys could not be fetched');
  const j = (await res.json()) as { keys?: SsvKey[] };
  if (!Array.isArray(j.keys) || j.keys.length === 0) throw new HttpError(503, 'ssv_keys_unavailable', 'AdMob verifier key list is empty');
  cache = { at: Date.now(), keys: j.keys };
  return j.keys;
};

const b64 = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

/** ASN.1 DER ECDSA signature -> IEEE P1363 (r || s), the form WebCrypto verifies. */
export function derToRaw(der: Uint8Array): Uint8Array {
  let i = 0;
  const read = (): number => {
    const b = der[i++];
    if (b === undefined) throw new Error('truncated');
    return b;
  };
  if (read() !== 0x30) throw new Error('not a sequence');
  let len = read();
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let k = 0; k < n; k++) len = (len << 8) | read();
  }
  const int = (): Uint8Array => {
    if (read() !== 0x02) throw new Error('not an integer');
    const l = read();
    let v = der.slice(i, i + l);
    i += l;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    if (v.length > 32) throw new Error('integer too large');
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = int();
  const s = int();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

export interface SsvParams {
  adUnit: string;
  transactionId: string;
  userId: string;
  timestampMs: number;
  rewardItem: string;
  rewardAmount: number;
  customData?: string;
}

/**
 * Verifies an AdMob server-side verification callback. The signed message is the query string up to (excluding) `&signature=`;
 * `signature` and `key_id` must be the last two parameters (Google's contract).
 */
export async function verifySsv(rawQuery: string, fetchKeys: SsvKeyFetcher): Promise<SsvParams> {
  const q = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
  if (q.length > 4096) throw new HttpError(400, 'bad_ssv', 'query too long');
  const cut = q.lastIndexOf('&signature=');
  if (cut < 0) throw new HttpError(400, 'bad_ssv', 'missing signature');
  const message = q.slice(0, cut);
  const tail = new URLSearchParams(q.slice(cut + 1));
  const signature = tail.get('signature');
  const keyId = tail.get('key_id');
  if (!signature || !keyId || [...tail.keys()].join(',') !== 'signature,key_id') throw new HttpError(400, 'bad_ssv', 'signature and key_id must be the last parameters');
  let keys = await fetchKeys();
  let key = keys.find((k) => String(k.keyId) === keyId);
  if (!key) {
    cache = undefined; // unknown key id: the list may have rotated
    keys = await fetchKeys();
    key = keys.find((k) => String(k.keyId) === keyId);
  }
  if (!key) throw new HttpError(400, 'bad_ssv', 'unknown verifier key');
  let ok: boolean;
  try {
    const pub = await crypto.subtle.importKey('spki', b64(key.base64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, derToRaw(b64(signature)), new TextEncoder().encode(message));
  } catch {
    ok = false;
  }
  if (!ok) throw new HttpError(400, 'bad_ssv', 'signature does not verify');
  const p = new URLSearchParams(message);
  const ts = Number(p.get('timestamp'));
  const adUnit = p.get('ad_unit');
  const transactionId = p.get('transaction_id');
  const userId = p.get('user_id');
  if (!adUnit || !transactionId || !userId || !Number.isFinite(ts)) throw new HttpError(400, 'bad_ssv', 'missing parameters');
  return {
    adUnit,
    transactionId,
    userId,
    timestampMs: ts,
    rewardItem: p.get('reward_item') ?? '',
    rewardAmount: Number(p.get('reward_amount') ?? 0),
    ...(p.get('custom_data') ? { customData: p.get('custom_data') as string } : {})
  };
}
