// INF-036 Eclipse Blessing (DEC-0038): purchase verification, the instant and half-day grants, developer notifications,
// and the Google Play client itself against a fake Google (a generated service-account key, recorded requests).
import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { BLESSING, eligibleWindows, GooglePlayVerifier, mapSubscription, type PlayVerifier, type PushVerifier, type SubscriptionState } from "../src/billing";
import { ApiError } from "../src/http";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;
const PACKAGE = "io.github.mucaeksi.unawareofmydemise";
// 2026-10-05 06:00 UTC.
let now = Date.parse("2026-10-05T06:00:00Z") / 1000;
const DAY = 86_400_000;

class FakePlay implements PlayVerifier {
  states = new Map<string, SubscriptionState>();
  acknowledged: string[] = [];
  down = false;
  async verifySubscription(token: string): Promise<SubscriptionState> {
    if (this.down) throw new Error("Play unreachable");
    const state = this.states.get(token);
    if (!state) throw new ApiError(400, "INVALID_REQUEST", "Google Play does not know this purchase");
    return { ...state, acknowledged: state.acknowledged || this.acknowledged.includes(token) };
  }
  async acknowledge(token: string): Promise<void> {
    this.acknowledged.push(token);
  }
}

const play = new FakePlay();
const push: PushVerifier = {
  verify: async (request) => {
    if (request.headers.get("authorization") !== "Bearer pubsub") throw new ApiError(401, "UNAUTHORIZED", "Invalid push token");
  },
};
const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};
const app = (deps: Partial<Parameters<typeof createApp>[0]> = {}) =>
  createApp({ connect: () => database.connect(), verifier, nowUnix: () => now, playVerifier: play, playPackageName: PACKAGE, pushVerifier: push, ...deps });

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

const active = (accountRef: string | null, expiresAt = new Date(now * 1000 + 30 * DAY), extra: Partial<SubscriptionState> = {}): SubscriptionState => ({
  productId: BLESSING.productId,
  entitled: true,
  revoked: false,
  expiresAt,
  acknowledged: false,
  state: "SUBSCRIPTION_STATE_ACTIVE",
  accountRef,
  ...extra,
});

async function call(token: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const all: Record<string, string> = { "idempotency-key": crypto.randomUUID(), ...headers };
  if (token) all.authorization = `Bearer ${token}`;
  const response = await app()(new Request(`https://api.test${path}`, { method, headers: all, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function player(): Promise<{ token: string; accountId: string }> {
  const nonce = (await call(null, "POST", "/v1/auth/nonce")).body.nonce as string;
  const signed = await call(null, "POST", "/v1/auth/google", { credential: `billing-${++counter}-${Date.now()}|${nonce}` });
  return { token: signed.body.session_token as string, accountId: signed.body.account_id as string };
}

const tokens = async (accountId: string) => Number((await database.pool.query("SELECT eclipse_tokens FROM wallet WHERE account_id = $1", [accountId])).rows[0].eclipse_tokens);
const purchase = () => `play-token-${++counter}-${"x".repeat(40)}`;
const rtdn = (messageId: string, data: Record<string, unknown>, auth = "Bearer pubsub") =>
  call(null, "POST", "/v1/billing/rtdn", { message: { messageId, data: btoa(JSON.stringify({ version: "1.0", packageName: PACKAGE, ...data })) }, subscription: "projects/p/subscriptions/s" }, { authorization: auth });

describe("POST /v1/subscription/verify", () => {
  it("binds the purchase, pays the period's instant grant once, acknowledges it, and answers the new state", async () => {
    const { token, accountId } = await player();
    const bought = purchase();
    play.states.set(bought, active(accountId));
    const before = await tokens(accountId);
    const first = await call(token, "POST", "/v1/subscription/verify", { purchase_token: bought });
    expect(first.body).toMatchObject({ new_period: true, instant_eclipse_tokens: 1600, active: true, acknowledged: true });
    expect(Number(first.body.state.wallet.eclipse_tokens)).toBe(before + 1600);
    expect(play.acknowledged).toContain(bought);
    const again = await call(token, "POST", "/v1/subscription/verify", { purchase_token: bought });
    expect(again.body).toMatchObject({ new_period: false, instant_eclipse_tokens: 0, acknowledged: true });
    expect(await tokens(accountId)).toBe(before + 1600);
    const journal = (await database.pool.query("SELECT endpoint FROM economy_journal WHERE account_id = $1 AND resource_id = 'eclipse_tokens' ORDER BY entry_id DESC LIMIT 1", [accountId])).rows[0];
    expect(journal.endpoint).toBe("subscription_instant");
  });

  it("refuses another account's purchase, another product, an unknown purchase, and a lapsed one pays nothing", async () => {
    const [owner, other] = [await player(), await player()];
    const bought = purchase();
    play.states.set(bought, active(owner.accountId));
    expect((await call(other.token, "POST", "/v1/subscription/verify", { purchase_token: bought })).body.error.message).toBe("This purchase was made for another account");
    const untagged = purchase();
    play.states.set(untagged, active(null));
    await call(owner.token, "POST", "/v1/subscription/verify", { purchase_token: untagged });
    expect((await call(other.token, "POST", "/v1/subscription/verify", { purchase_token: untagged })).body.error.message).toBe("This purchase belongs to another account");
    const otherProduct = purchase();
    play.states.set(otherProduct, active(owner.accountId, undefined, { productId: "gems_pack" }));
    expect((await call(owner.token, "POST", "/v1/subscription/verify", { purchase_token: otherProduct })).status).toBe(400);
    expect((await call(owner.token, "POST", "/v1/subscription/verify", { purchase_token: "never-bought" })).status).toBe(400);
    const lapsed = purchase();
    play.states.set(lapsed, active(owner.accountId, new Date(now * 1000 - DAY), { entitled: false, state: "SUBSCRIPTION_STATE_EXPIRED" }));
    const before = await tokens(owner.accountId);
    expect((await call(owner.token, "POST", "/v1/subscription/verify", { purchase_token: lapsed })).body).toMatchObject({ active: false, instant_eclipse_tokens: 0 });
    expect(await tokens(owner.accountId)).toBe(before);
  });

  it("never pays a period's instant grant twice, even to a new account after a deletion", async () => {
    const first = await player();
    const bought = purchase();
    play.states.set(bought, active(null));
    expect((await call(first.token, "POST", "/v1/subscription/verify", { purchase_token: bought })).body.instant_eclipse_tokens).toBe(1600);
    await database.pool.query("DELETE FROM account WHERE account_id = $1", [first.accountId]);
    const second = await player();
    const replayed = await call(second.token, "POST", "/v1/subscription/verify", { purchase_token: bought });
    expect(replayed.body).toMatchObject({ new_period: true, instant_eclipse_tokens: 0 });
  });

  it("answers 503 when Play is unreachable or purchases are not configured", async () => {
    const { token } = await player();
    play.down = true;
    expect((await call(token, "POST", "/v1/subscription/verify", { purchase_token: purchase() })).status).toBe(503);
    play.down = false;
    const unconfigured = await app({ playVerifier: null })(new Request("https://api.test/v1/subscription/verify", {
      method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ purchase_token: "x" }),
    }));
    expect(unconfigured.status).toBe(503);
  });
});

describe("half-day entitlements", () => {
  it("pays the current window once, missed windows within the grace, nothing after", async () => {
    const { token, accountId } = await player();
    const bought = purchase();
    const start = now * 1000;
    play.states.set(bought, active(accountId, new Date(start + 30 * DAY)));
    await call(token, "POST", "/v1/subscription/verify", { purchase_token: bought });
    const status = (await call(token, "GET", "/v1/subscription/status")).body;
    expect(status).toMatchObject({ subscribed: true, revoked: false, window_tokens: 187, claimed_this_period: 0 });
    const current = Math.floor(start / 43_200_000);
    expect(status.claimable_windows).toEqual([current]);
    const claimed = await call(token, "POST", "/v1/subscription/claim", {});
    expect(claimed.body).toMatchObject({ already_claimed: false, eclipse_tokens: 187, window_id: current });
    expect((await call(token, "POST", "/v1/subscription/claim", {})).body).toMatchObject({ already_claimed: true, eclipse_tokens: 0 });
    now += 3 * 86_400;
    const later = (await call(token, "GET", "/v1/subscription/status")).body.claimable_windows as number[];
    expect(later).toHaveLength(6);
    expect((await call(token, "POST", "/v1/subscription/claim", { window_id: current + 1 })).body.eclipse_tokens).toBe(187);
    now += 15 * 86_400;
    expect((await call(token, "POST", "/v1/subscription/claim", { window_id: current + 2 })).status, "past the 14-day grace").toBe(400);
    expect((await call(token, "POST", "/v1/subscription/claim", { window_id: -1 })).status).toBe(400);
    now -= 18 * 86_400;
  });

  it("counts the window a period starts in, and only the last 14 days of windows stay claimable", () => {
    // A period starting at 05:00 overlaps the window that began at 00:00.
    const end = new Date(Date.UTC(2026, 10, 1, 5));
    const start = end.getTime() - BLESSING.days * DAY;
    const firstDay = eligibleWindows(end, new Date(start + 1000));
    expect(firstDay).toEqual([Math.floor(start / 43_200_000)]);
    const lastSecond = eligibleWindows(end, new Date(end.getTime() - 1000));
    expect(lastSecond.length, "28 past windows within the grace and the current one").toBe(BLESSING.graceDays * 2 + 1);
    expect(lastSecond.length).toBeLessThanOrEqual(BLESSING.windows);
  });
});

describe("POST /v1/billing/rtdn", () => {
  it("needs the push subscription's token and our package", async () => {
    expect((await rtdn("m-auth", { testNotification: { version: "1.0" } }, "Bearer forged")).status).toBe(401);
    expect((await rtdn("m-pkg", { packageName: "com.other.game", testNotification: {} })).status).toBe(400);
    expect((await rtdn("m-test", { testNotification: { version: "1.0" } })).body).toEqual({ status: "test notification" });
  });

  it("a renewal opens and pays the next period without the app; a redelivery changes nothing", async () => {
    const { token, accountId } = await player();
    const bought = purchase();
    play.states.set(bought, active(accountId));
    await call(token, "POST", "/v1/subscription/verify", { purchase_token: bought });
    const before = await tokens(accountId);
    play.states.set(bought, active(accountId, new Date(now * 1000 + 60 * DAY)));
    const note = { subscriptionNotification: { version: "1.0", notificationType: 2, purchaseToken: bought, subscriptionId: BLESSING.productId } };
    expect((await rtdn(`m-renew-${counter}`, note)).body).toEqual({ status: "period opened" });
    expect(await tokens(accountId)).toBe(before + 1600);
    expect((await rtdn(`m-renew-${counter}`, note)).body).toEqual({ status: "already processed" });
    expect(await tokens(accountId)).toBe(before + 1600);
  });

  it("a purchase the app never reported is bound through the account it was tagged with", async () => {
    const { accountId } = await player();
    const bought = purchase();
    play.states.set(bought, active(accountId));
    const before = await tokens(accountId);
    const note = { subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: bought, subscriptionId: BLESSING.productId } };
    expect((await rtdn(`m-buy-${counter}`, note)).body).toEqual({ status: "period opened" });
    expect(await tokens(accountId)).toBe(before + 1600);
  });

  it("a refund stops further claims; Play being down is retried by Pub/Sub", async () => {
    const { token, accountId } = await player();
    const bought = purchase();
    play.states.set(bought, active(accountId));
    await call(token, "POST", "/v1/subscription/verify", { purchase_token: bought });
    expect((await rtdn(`m-void-${counter}`, { voidedPurchaseNotification: { purchaseToken: bought, orderId: "GPA.1", productType: 1, refundType: 1 } })).body).toEqual({ status: "voided: claims stopped" });
    expect((await call(token, "POST", "/v1/subscription/claim", {})).status).toBe(400);
    expect((await call(token, "GET", "/v1/subscription/status")).body).toMatchObject({ subscribed: false, revoked: true, claimable_windows: [] });

    const other = purchase();
    play.states.set(other, active(accountId));
    const note = { subscriptionNotification: { version: "1.0", notificationType: 4, purchaseToken: other, subscriptionId: BLESSING.productId } };
    play.down = true;
    expect((await rtdn(`m-down-${counter}`, note)).status).toBe(503);
    play.down = false;
    expect((await rtdn(`m-down-${counter}`, note)).body, "the redelivery is processed").toEqual({ status: "period opened" });
  });
});

describe("the Google Play client", () => {
  it("maps subscriptionsv2 resources", () => {
    const mapped = mapSubscription({
      subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      lineItems: [{ productId: "eclipse_blessing_30d", expiryTime: "2026-11-04T06:00:00.123Z" }],
      externalAccountIdentifiers: { obfuscatedExternalAccountId: "acct_x" },
      canceledStateContext: { userInitiatedCancellation: {} },
    }, new Date("2026-10-05T00:00:00Z"));
    expect(mapped).toEqual({ productId: "eclipse_blessing_30d", entitled: true, revoked: false, expiresAt: new Date("2026-11-04T06:00:00.123Z"), acknowledged: true, state: "SUBSCRIPTION_STATE_CANCELED", accountRef: "acct_x" });
    expect(mapSubscription({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: "p", expiryTime: "2026-11-04T06:00:00Z" }], canceledStateContext: { systemInitiatedCancellation: {} } }, new Date("2026-10-05T00:00:00Z")).revoked).toBe(true);
    expect(() => mapSubscription({}, new Date())).toThrow("expiry");
  });

  it("signs in as the service account once and calls the documented routes", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    const serviceAccount = JSON.stringify({ client_email: "play-reader@uomd.iam.gserviceaccount.com", private_key: await exportPKCS8(privateKey) });
    const requests: { url: string; method: string; auth: string | null; body: string }[] = [];
    const fetcher = (async (input: string, init: RequestInit = {}) => {
      const body = typeof init.body === "string" ? init.body : "";
      requests.push({ url: input, method: init.method ?? "GET", auth: new Headers(init.headers).get("authorization"), body });
      if (input === "https://oauth2.googleapis.com/token") {
        const assertion = new URLSearchParams(body).get("assertion")!;
        const { payload } = await jwtVerify(assertion, publicKey, { issuer: "play-reader@uomd.iam.gserviceaccount.com", audience: "https://oauth2.googleapis.com/token" });
        expect(payload.scope).toBe("https://www.googleapis.com/auth/androidpublisher");
        return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3599 }));
      }
      if (input.includes("/subscriptionsv2/tokens/missing")) return new Response("{}", { status: 404 });
      if (input.includes("/subscriptionsv2/")) {
        return new Response(JSON.stringify({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: "eclipse_blessing_30d", expiryTime: "2099-01-01T00:00:00Z" }] }));
      }
      return new Response("{}");
    }) as unknown as typeof fetch;
    const client = new GooglePlayVerifier(PACKAGE, serviceAccount, fetcher);
    expect((await client.verifySubscription("tok/en")).entitled).toBe(true);
    await expect(client.verifySubscription("missing")).rejects.toThrow("does not know");
    await client.acknowledge("tok/en", "eclipse_blessing_30d");
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "POST https://oauth2.googleapis.com/token",
      `GET ${GooglePlayVerifier.BASE}/${PACKAGE}/purchases/subscriptionsv2/tokens/tok%2Fen`,
      `GET ${GooglePlayVerifier.BASE}/${PACKAGE}/purchases/subscriptionsv2/tokens/missing`,
      `POST ${GooglePlayVerifier.BASE}/${PACKAGE}/purchases/subscriptions/eclipse_blessing_30d/tokens/tok%2Fen:acknowledge`,
    ]);
    expect(requests.slice(1).every((request) => request.auth === "Bearer ya29.test"), "one token for every call").toBe(true);
    expect(() => new GooglePlayVerifier(PACKAGE, "{}")).toThrow("service account");
  });
});
