// Rewarded ads through Google AdMob server-side verification (INF-036, owner decision D-10, DEC-0038; LEGACY Drive
// server/ads.py). The device never grants an ad reward: after a completed ad, AdMob calls GET /v1/ads/ssv with a signed
// query string; the Worker checks the ECDSA-SHA256 signature against Google's published verifier keys, then pays
// `rewarded_ads.reward_token` Eclipse Tokens once per AdMob transaction id, within the authored caps (economy_part1.json:
// `rewarded_ads.per_window_cap` per 12-hour window, `daily_schedule.maximum_per_utc_day.rewarded_ads` per UTC day).
//
// Signature (AdMob documentation): the signed message is the raw query string up to, not including, "&signature=";
// `signature` is URL-safe base64 of a DER ECDSA signature; `key_id` names the public key (base64 DER SPKI, P-256).
import type { Db } from "./db";
import { ApiError } from "./http";
import { halfDayWindow } from "./engine/quests";
import { setJournalContext } from "./journal";
import { bumpStateRevision } from "./state";
import economy from "../../game/data/content/economy_part1.json";

export const VERIFIER_KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";

export interface AdmobKeys {
  /** The P-256 public key `keyId` names, or null when Google publishes no such key. */
  publicKey(keyId: string): Promise<CryptoKey | null>;
}

const importSpki = (der: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey("spki", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (character) => character.charCodeAt(0));

/** Google's verifier keys, fetched over HTTPS and kept per isolate; an unknown key id refetches (rotation), at most once a minute. */
export class HttpAdmobKeys implements AdmobKeys {
  private keys = new Map<string, CryptoKey>();
  private fetchedAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly ttlMs = 24 * 3600_000,
    private readonly minRefetchMs = 60_000,
  ) {}

  async publicKey(keyId: string): Promise<CryptoKey | null> {
    const age = Date.now() - this.fetchedAt;
    if (age > this.ttlMs || (!this.keys.has(keyId) && age > this.minRefetchMs)) await this.refresh();
    return this.keys.get(keyId) ?? null;
  }

  private async refresh(): Promise<void> {
    this.fetchedAt = Date.now();
    const reply = await this.fetcher(VERIFIER_KEYS_URL);
    if (!reply.ok) throw new Error(`AdMob verifier keys: HTTP ${reply.status}`);
    const payload = (await reply.json()) as { keys?: { keyId: number | string; base64: string }[] };
    const keys = new Map<string, CryptoKey>();
    for (const row of payload.keys ?? []) keys.set(String(row.keyId), await importSpki(fromBase64(row.base64)));
    this.keys = keys;
  }
}

/** A DER ECDSA signature (SEQUENCE of two INTEGERs) as the 64-byte r||s WebCrypto verifies; null when it is not one. */
export function derToRaw(der: Uint8Array): Uint8Array | null {
  let offset = 0;
  const readLength = (): number | null => {
    const first = der[offset++];
    if (first === undefined) return null;
    if (first < 0x80) return first;
    const bytes = first & 0x7f;
    if (bytes < 1 || bytes > 2) return null;
    let length = 0;
    for (let index = 0; index < bytes; index++) length = (length << 8) | (der[offset++] ?? 0);
    return length;
  };
  if (der[offset++] !== 0x30) return null;
  const total = readLength();
  if (total === null || offset + total !== der.length) return null;
  const raw = new Uint8Array(64);
  for (const target of [0, 32]) {
    if (der[offset++] !== 0x02) return null;
    let length = readLength();
    if (length === null || length < 1 || offset + length > der.length) return null;
    // Strip the sign padding; an integer longer than 32 bytes after that is not a P-256 value.
    while (length > 32 && der[offset] === 0) {
      offset++;
      length--;
    }
    if (length > 32) return null;
    raw.set(der.subarray(offset, offset + length), target + 32 - length);
    offset += length;
  }
  return offset === der.length ? raw : null;
}

const badCallback = (message: string) => new ApiError(400, "INVALID_REQUEST", message);

/** Checks an SSV callback's signature and answers its parameters (one value each). */
export async function verifySsv(rawQuery: string, keys: AdmobKeys): Promise<Record<string, string>> {
  const marker = "&signature=";
  const cut = rawQuery.indexOf(marker);
  if (cut < 0) throw badCallback("Missing signature");
  const message = rawQuery.slice(0, cut);
  // AdMob appends exactly "&signature=<sig>&key_id=<id>" after the signed part.
  const tail = rawQuery.slice(cut + marker.length);
  const split = tail.indexOf("&key_id=");
  const signature = split < 0 ? "" : tail.slice(0, split);
  const keyId = split < 0 ? "" : tail.slice(split + "&key_id=".length);
  if (!signature || !keyId || signature.includes("&") || keyId.includes("&")) throw badCallback("Malformed SSV query");
  let key: CryptoKey | null;
  try {
    key = await keys.publicKey(keyId);
  } catch {
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "AdMob verifier keys are unavailable");
  }
  if (key === null) throw badCallback("Unknown key_id");
  let der: Uint8Array;
  try {
    der = fromBase64(signature.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (signature.length % 4)) % 4));
  } catch {
    throw badCallback("Bad signature");
  }
  const raw = derToRaw(der);
  const valid = raw !== null && (await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, new TextEncoder().encode(message)));
  if (!valid) throw badCallback("Bad signature");
  const params: Record<string, string> = {};
  for (const [name, value] of new URLSearchParams(message)) if (!(name in params)) params[name] = value;
  return params;
}

const RULES = {
  token: Number(economy.rewarded_ads.reward_token),
  perWindow: Number(economy.rewarded_ads.per_window_cap),
  perDay: Number(economy.daily_schedule.maximum_per_utc_day.rewarded_ads),
};

async function counts(db: Db, accountId: string, nowUnix: number): Promise<{ window: number; day: number }> {
  const windowStart = new Date(halfDayWindow(nowUnix).cycle_id * 43_200 * 1000);
  const dayStart = new Date(Math.floor(nowUnix / 86_400) * 86_400 * 1000);
  const { rows } = await db.query<{ window: string; day: string }>(
    "SELECT count(*) FILTER (WHERE granted_at >= $2) AS window, count(*) AS day FROM ad_rewards WHERE account_id = $1 AND granted_at >= $3",
    [accountId, windowStart, dayStart],
  );
  return { window: Number(rows[0]!.window), day: Number(rows[0]!.day) };
}

/** How many ads the account may still watch for a reward now (the client shows it before offering one). */
export async function adStatus(db: Db, accountId: string, nowUnix: number): Promise<Record<string, number>> {
  const seen = await counts(db, accountId, nowUnix);
  return { window_views: seen.window, window_cap: RULES.perWindow, day_views: seen.day, day_cap: RULES.perDay, reward_eclipse_tokens: RULES.token };
}

/**
 * Pays one verified view (its own transaction). A repeated transaction id or a view over a cap pays nothing and is not
 * an error: AdMob must get a 200 so it stops retrying.
 */
export async function grantVerifiedAd(tx: Db, accountId: string, transactionId: string, nowUnix: number): Promise<Record<string, unknown>> {
  // One grant at a time per account, so the caps cannot be raced.
  await tx.query("SELECT 1 FROM account WHERE account_id = $1 FOR NO KEY UPDATE", [accountId]);
  if ((await tx.query("SELECT 1 FROM ad_rewards WHERE transaction_id = $1", [transactionId])).rowCount === 1) {
    return { granted: false, reason: "duplicate", eclipse_tokens: 0 };
  }
  const seen = await counts(tx, accountId, nowUnix);
  if (seen.window >= RULES.perWindow || seen.day >= RULES.perDay) return { granted: false, reason: "cap", eclipse_tokens: 0 };
  await setJournalContext(tx, null, "ad_reward");
  await tx.query("UPDATE wallet SET eclipse_tokens = eclipse_tokens + $2 WHERE account_id = $1", [accountId, RULES.token]);
  await tx.query("INSERT INTO ad_rewards (transaction_id, account_id, granted_at, tokens) VALUES ($1, $2, $3, $4)", [
    transactionId,
    accountId,
    new Date(nowUnix * 1000),
    RULES.token,
  ]);
  await bumpStateRevision(tx, accountId);
  return { granted: true, reason: "granted", eclipse_tokens: RULES.token };
}
