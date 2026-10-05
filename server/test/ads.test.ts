// INF-036 rewarded ads (DEC-0038): AdMob SSV callbacks signed like AdMob signs them (ECDSA P-256, DER, URL-safe
// base64), with a test key standing in for Google's; the grant, its caps and its idempotency on the real schema.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { derToRaw, HttpAdmobKeys, VERIFIER_KEYS_URL, type AdmobKeys } from "../src/ads";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let signer: CryptoKeyPair;
let counter = 0;
const AD_UNIT = "ca-app-pub-0000000000000000/1111111111";
const KEY_ID = "3335741209";
// 2026-10-05 01:00 UTC: the first half-day window of the day.
let now = Date.parse("2026-10-05T01:00:00Z") / 1000;

const keys: AdmobKeys = { publicKey: async (keyId) => (keyId === KEY_ID ? signer.publicKey : null) };
const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};
const app = (deps: Partial<Parameters<typeof createApp>[0]> = {}) =>
  createApp({ connect: () => database.connect(), verifier, nowUnix: () => now, admobKeys: keys, admobAdUnits: [AD_UNIT], ...deps });

beforeAll(async () => {
  database = await createTestDatabase();
  signer = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
});
afterAll(async () => {
  await database?.close();
});

/** r||s as the DER SEQUENCE AdMob sends (each INTEGER minimal, with a 0x00 when its top bit is set). */
function rawToDer(raw: Uint8Array): Uint8Array {
  const integer = (bytes: Uint8Array): number[] => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    const value = [...bytes.subarray(start)];
    if (value[0]! & 0x80) value.unshift(0);
    return [0x02, value.length, ...value];
  };
  const body = [...integer(raw.subarray(0, 32)), ...integer(raw.subarray(32))];
  return Uint8Array.from([0x30, body.length, ...body]);
}

const urlSafe = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function callback(fields: Record<string, string>, tamper = false): Promise<string> {
  const message = new URLSearchParams({ ad_network: "5450213213286189855", ad_unit: AD_UNIT, reward_amount: "1", reward_item: "Reward", timestamp: "1791171000000", ...fields }).toString();
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signer.privateKey, new TextEncoder().encode(message)));
  const signed = tamper ? message.replace("reward_amount=1", "reward_amount=9") : message;
  return `${signed}&signature=${urlSafe(rawToDer(raw))}&key_id=${KEY_ID}`;
}

async function player(): Promise<{ token: string; accountId: string }> {
  const nonce = ((await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string }).nonce;
  const signed = (await (await app()(new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `ads-${++counter}|${nonce}` }) }))).json()) as {
    session_token: string;
    account_id: string;
  };
  return { token: signed.session_token, accountId: signed.account_id };
}

async function ssv(query: string, deps: Partial<Parameters<typeof createApp>[0]> = {}) {
  const response = await app(deps)(new Request(`https://api.test/v1/ads/ssv?${query}`));
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

const tokens = async (accountId: string) => Number((await database.pool.query("SELECT eclipse_tokens FROM wallet WHERE account_id = $1", [accountId])).rows[0].eclipse_tokens);

describe("GET /v1/ads/ssv", () => {
  it("pays a verified view once, journaled, with the state revision raised", async () => {
    const { accountId } = await player();
    const before = await tokens(accountId);
    const revision = Number((await database.pool.query("SELECT state_revision FROM account WHERE account_id = $1", [accountId])).rows[0].state_revision);
    const query = await callback({ transaction_id: `tx${++counter}`, user_id: accountId });
    expect(await ssv(query), "the first view of a window pays 10").toEqual({ status: 200, body: { granted: true, reason: "granted", eclipse_tokens: 10 } });
    expect(await tokens(accountId)).toBe(before + 10);
    expect(await ssv(query), "AdMob retries the same callback").toEqual({ status: 200, body: { granted: false, reason: "duplicate", eclipse_tokens: 0 } });
    expect(await tokens(accountId)).toBe(before + 10);
    const journal = (await database.pool.query("SELECT endpoint, delta::int FROM economy_journal WHERE account_id = $1 AND resource_id = 'eclipse_tokens' ORDER BY entry_id DESC LIMIT 1", [accountId])).rows[0];
    expect(journal).toEqual({ endpoint: "ad_reward", delta: 10 });
    expect(Number((await database.pool.query("SELECT state_revision FROM account WHERE account_id = $1", [accountId])).rows[0].state_revision)).toBe(revision + 1);
  });

  it("pays 10, 20, 30, 40, 50 for the views of a half-day window, at most 5 per window and 10 per UTC day", async () => {
    const { accountId, token } = await player();
    const view = async () => (await ssv(await callback({ transaction_id: `tx${++counter}`, user_id: accountId }))).body;
    const status = async (deps: Partial<Parameters<typeof createApp>[0]> = {}) =>
      (await (await app(deps)(new Request("https://api.test/v1/ads/status", { headers: { authorization: `Bearer ${token}` } }))).json()) as Record<string, unknown>;
    const before = await tokens(accountId);
    expect((await status()).reward_eclipse_tokens, "the next view's reward is shown before an ad").toBe(10);
    const paid: unknown[] = [];
    for (let index = 0; index < 5; index++) paid.push((await view()).eclipse_tokens);
    expect(paid).toEqual([10, 20, 30, 40, 50]);
    expect(await tokens(accountId), "150 per window, as 5 × 30").toBe(before + 150);
    expect(await view()).toEqual({ granted: false, reason: "cap", eclipse_tokens: 0 });
    expect((await status()).reward_eclipse_tokens, "nothing more to earn in this window").toBe(0);
    now += 12 * 3600;
    expect((await status()).reward_eclipse_tokens, "a new window starts at 10 again").toBe(10);
    for (let index = 0; index < 5; index++) expect((await view()).granted).toBe(true);
    expect(await status()).toEqual({ window_views: 5, window_cap: 5, day_views: 10, day_cap: 10, reward_eclipse_tokens: 0, ad_unit_id: AD_UNIT });
    expect((await status({ admobAdUnits: [] })).ad_unit_id, "no unit: the app offers no ad").toBeNull();
    expect((await status({ admobKeys: null })).ad_unit_id).toBeNull();
    now += 12 * 3600;
    expect((await view()).granted, "a new UTC day").toBe(true);
  });

  it("refuses forged, foreign and malformed callbacks", async () => {
    const { accountId } = await player();
    const before = await tokens(accountId);
    expect((await ssv(await callback({ transaction_id: `tx${++counter}`, user_id: accountId }, true))).body.error.message).toBe("Bad signature");
    expect((await ssv(await callback({ transaction_id: `tx${++counter}`, user_id: accountId, ad_unit: "ca-app-pub-9999999999999999/1" }))).body.error.message).toBe("Unexpected ad unit");
    expect((await ssv((await callback({ transaction_id: `tx${++counter}`, user_id: accountId })).replace(`key_id=${KEY_ID}`, "key_id=1"))).body.error.message).toBe("Unknown key_id");
    expect((await ssv(`user_id=${accountId}&transaction_id=x`)).body.error.message).toBe("Missing signature");
    expect((await ssv(await callback({ transaction_id: `tx${++counter}` }))).status, "no user").toBe(400);
    expect((await ssv(await callback({ transaction_id: `tx${++counter}`, user_id: "acct_ffffffffffffffffffffffffffffffff" }))).status).toBe(404);
    expect(await tokens(accountId)).toBe(before);
  });

  it("answers 503 until our ad units are configured", async () => {
    const { accountId } = await player();
    const query = await callback({ transaction_id: `tx${++counter}`, user_id: accountId });
    expect((await ssv(query, { admobAdUnits: [] })).status).toBe(503);
    expect((await ssv(query, { admobKeys: null })).status).toBe(503);
  });

  it("is outside the IP budget and the client-version gate", async () => {
    const used: string[] = [];
    const limiter = { limit: async () => (used.push("x"), { success: false }) };
    const { accountId } = await player();
    const reply = await ssv(await callback({ transaction_id: `tx${++counter}`, user_id: accountId }), {
      apiLimiter: limiter,
      release: { sourceSha: null, minClientVersionCode: 1, maintenanceMessage: "Down" },
    });
    expect(reply.status).toBe(200);
    expect(used).toEqual([]);
  });
});

describe("signature plumbing", () => {
  it("turns DER signatures into r||s, padding and all", () => {
    const raw = new Uint8Array(64).map((_, index) => (index === 0 || index === 32 ? 0x80 : index));
    expect(derToRaw(rawToDer(raw))).toEqual(raw);
    const short = new Uint8Array(64).map((_, index) => (index < 2 || (index >= 32 && index < 35) ? 0 : 7));
    expect(derToRaw(rawToDer(short))).toEqual(short);
    expect(derToRaw(Uint8Array.from([0x30, 0x02, 0x02, 0x00]))).toBeNull();
    expect(derToRaw(Uint8Array.from([0x31]))).toBeNull();
  });

  it("caches Google's keys, refetches for an unknown id at most once a minute", async () => {
    const spki = new Uint8Array((await crypto.subtle.exportKey("spki", signer.publicKey)) as ArrayBuffer);
    let fetches = 0;
    const fetcher = (async (url: string) => {
      fetches++;
      expect(url).toBe(VERIFIER_KEYS_URL);
      return new Response(JSON.stringify({ keys: [{ keyId: Number(KEY_ID), base64: btoa(String.fromCharCode(...spki)) }] }));
    }) as unknown as typeof fetch;
    const cache = new HttpAdmobKeys(fetcher);
    expect(await cache.publicKey(KEY_ID)).not.toBeNull();
    expect(await cache.publicKey(KEY_ID)).not.toBeNull();
    expect(await cache.publicKey("404")).toBeNull();
    expect(fetches, "the unknown id within a minute of the last fetch does not refetch").toBe(1);
  });
});
