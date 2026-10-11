import { HttpError } from '../content/store';

export interface SsvKey {
  keyId: number | string;
  /** base64 of the SPKI DER public key */
  base64: string;
  /** a key from Google's TEST list: it signs AdMob's URL-verification request and test ads, and must never pay a reward */
  test?: boolean;
}
export type SsvKeyFetcher = () => Promise<SsvKey[]>;

export const ADMOB_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
export const ADMOB_TEST_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys-test.json';
let cache: { at: number; keys: SsvKey[] } | undefined;

/** Google's public AdMob verifier keys, live and test (rotated rarely; cached for an hour, refreshed when a key id is unknown). */
export const googleKeyFetcher: SsvKeyFetcher = async () => {
  if (cache && Date.now() - cache.at < 3_600_000) return cache.keys;
  const get = async (url: string, test: boolean): Promise<SsvKey[]> => {
    const res = await fetch(url);
    if (!res.ok) throw new HttpError(503, 'ssv_keys_unavailable', 'AdMob verifier keys could not be fetched');
    const j = (await res.json()) as { keys?: SsvKey[] };
    if (!Array.isArray(j.keys) || j.keys.length === 0) throw new HttpError(503, 'ssv_keys_unavailable', 'AdMob verifier key list is empty');
    return j.keys.map((k) => ({ keyId: k.keyId, base64: k.base64, ...(test ? { test: true } : {}) }));
  };
  const [live, test] = await Promise.all([get(ADMOB_KEYS_URL, false), get(ADMOB_TEST_KEYS_URL, true).catch(() => [] as SsvKey[])]);
  cache = { at: Date.now(), keys: [...live, ...test] };
  return cache.keys;
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

/** The query string as seen plus its plausible original encodings (space as + or %20, apostrophe literal or %27). */
export function signedMessageCandidates(message: string): string[] {
  const out = new Set<string>([message, message.replace(/%27/g, "'").replace(/%22/g, '"').replace(/%3C/gi, '<').replace(/%3E/gi, '>')]);
  const pairs = message.split('&').map((kv): [string, string] => {
    const i = kv.indexOf('=');
    const raw = i < 0 ? '' : kv.slice(i + 1);
    let v = raw;
    try {
      v = decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      /* keep the raw text */
    }
    return [i < 0 ? kv : kv.slice(0, i), v];
  });
  for (const space of ['+', '%20']) {
    for (const apos of ["'", '%27']) {
      out.add(pairs.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, space).replace(/'/g, apos)}`).join('&'));
    }
  }
  out.add(pairs.map(([k, v]) => `${k}=${v}`).join('&')); // fully decoded values
  return [...out];
}

export interface SsvParams {
  /** signed by Google's test key (AdMob's "verify URL" button and test ads): answer 200, never grant */
  viaTestKey: boolean;
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
  // Google signs the query exactly as it sends it, but the runtime hands us a URL that the URL parser already normalised (' becomes %27),
  // and clients differ on how a space is written (+ or %20). Try the message as seen, then every plausible re-encoding of the same values;
  // a signature can only match the form that was really signed, so this widens nothing.
  const candidates = signedMessageCandidates(message);
  let ok = false;
  try {
    const pub = await crypto.subtle.importKey('spki', b64(key.base64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const sig = derToRaw(b64(signature));
    for (const m of candidates) {
      if (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, new TextEncoder().encode(m))) {
        ok = true;
        break;
      }
    }
  } catch {
    ok = false;
  }
  if (!ok) throw new HttpError(400, 'bad_ssv', 'signature does not verify');
  const p = new URLSearchParams(message);
  const ts = Number(p.get('timestamp'));
  const adUnit = p.get('ad_unit');
  const transactionId = p.get('transaction_id');
  const userId = p.get('user_id') ?? '';
  // AdMob's own URL check sends neither user_id nor custom_data: those are validated later, only a payout needs them
  if (!adUnit || !transactionId || !Number.isFinite(ts)) throw new HttpError(400, 'bad_ssv', 'missing parameters');
  return {
    viaTestKey: key.test === true,
    adUnit,
    transactionId,
    userId,
    timestampMs: ts,
    rewardItem: p.get('reward_item') ?? '',
    rewardAmount: Number(p.get('reward_amount') ?? 0),
    ...(p.get('custom_data') ? { customData: p.get('custom_data') as string } : {})
  };
}
