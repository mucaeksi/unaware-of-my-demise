// The Eclipse Blessing, the one optional 30-day Google Play subscription (INF-036, owner decision D-10, DEC-0038; LEGACY
// Drive server/billing.py). economy_part1.json `subscription`: every 30-day period pays `instant_eclipse_token` (1,600)
// once, plus `halfday_entitlement_token` (187) for each of `halfday_entitlement_count` (60) twelve-hour windows of the
// period, claimed from the app; a missed window stays claimable for `mailbox_claim_grace_days` (14). Everything is
// granted by the server, and only after Google Play confirms the purchase (`receipt_verification: backend_required`).
//
// Trust: the app sends only the Play purchase token. The Worker asks Google Play about it, refuses a purchase the app
// tagged for another account (Play's obfuscatedExternalAccountId, set by the app to the account id), binds the token
// to the account (a token bound elsewhere is refused), pays the period's instant grant once per (purchase, period)
// ever, and acknowledges the purchase (Play refunds unacknowledged purchases after 3 days). Real-time developer
// notifications (Pub/Sub) re-read the purchase from Play on every event: renewals open the next period (and pay it),
// refunds and revocations stop further claims. Nothing already paid is taken back.
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import type { Db } from "./db";
import { sha256Hex } from "./crypto";
import { ApiError, isoUtc } from "./http";
import { setJournalContext } from "./journal";
import { bumpStateRevision } from "./state";
import economy from "../../game/data/content/economy_part1.json";

export const BLESSING = {
  productId: String(economy.subscription.id),
  days: Number(economy.subscription.duration_days),
  instant: Number(economy.subscription.instant_eclipse_token),
  perWindow: Number(economy.subscription.halfday_entitlement_token),
  windows: Number(economy.subscription.halfday_entitlement_count),
  graceDays: Number(economy.subscription.mailbox_claim_grace_days),
} as const;
const HALF_DAY_MS = 43_200_000;

export interface SubscriptionState {
  productId: string;
  /** Play says the subscription is paid up now (active, in grace, or cancelled but not yet expired). */
  entitled: boolean;
  /** Refunded, revoked, or cancelled by Google or the developer: no further claims. */
  revoked: boolean;
  expiresAt: Date;
  acknowledged: boolean;
  /** Play's subscriptionState, kept for support. */
  state: string;
  /** The account id the app tagged the purchase with (obfuscatedExternalAccountId); null when none. */
  accountRef: string | null;
}

export interface PlayVerifier {
  /** What Google Play says about a subscription purchase token (ApiError 400 when Play does not know it). */
  verifySubscription(purchaseToken: string): Promise<SubscriptionState>;
  acknowledge(purchaseToken: string, productId: string): Promise<void>;
}

const unknownToken = () => new ApiError(400, "INVALID_REQUEST", "Google Play does not know this purchase");

/**
 * The Google Play Developer API with a service account (secret GOOGLE_PLAY_SERVICE_ACCOUNT, its JSON key; Play Console
 * permissions "View financial data" and "Manage orders and subscriptions"). Access tokens are cached until a minute
 * before they expire. Field mapping: purchases.subscriptionsv2.get.
 */
export class GooglePlayVerifier implements PlayVerifier {
  static readonly BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
  private token: { value: string; expires: number } | null = null;
  private readonly account: { client_email: string; private_key: string; token_uri?: string };

  constructor(
    private readonly packageName: string,
    serviceAccountJson: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    const parsed = JSON.parse(serviceAccountJson) as { client_email?: unknown; private_key?: unknown; token_uri?: unknown };
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT is not a service account key");
    this.account = { client_email: parsed.client_email, private_key: parsed.private_key, token_uri: typeof parsed.token_uri === "string" ? parsed.token_uri : undefined };
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
    const audience = this.account.token_uri ?? "https://oauth2.googleapis.com/token";
    const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(this.account.client_email)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(await importPKCS8(this.account.private_key, "RS256"));
    const reply = await this.fetcher(audience, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    });
    if (!reply.ok) throw new Error(`Google OAuth token: HTTP ${reply.status}`);
    const body = (await reply.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  async verifySubscription(purchaseToken: string): Promise<SubscriptionState> {
    const url = `${GooglePlayVerifier.BASE}/${this.packageName}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const reply = await this.fetcher(url, { headers: { authorization: `Bearer ${await this.accessToken()}` } });
    if (reply.status === 400 || reply.status === 404 || reply.status === 410) throw unknownToken();
    if (!reply.ok) throw new Error(`Google Play subscriptionsv2: HTTP ${reply.status}`);
    return mapSubscription((await reply.json()) as Record<string, unknown>, new Date());
  }

  async acknowledge(purchaseToken: string, productId: string): Promise<void> {
    const url = `${GooglePlayVerifier.BASE}/${this.packageName}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
    const reply = await this.fetcher(url, {
      method: "POST",
      headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!reply.ok) throw new Error(`Google Play acknowledge: HTTP ${reply.status}`);
  }
}

/** A subscriptionsv2 resource as the state the rules need. */
export function mapSubscription(data: Record<string, unknown>, now: Date): SubscriptionState {
  const line = ((data.lineItems as Record<string, unknown>[] | undefined) ?? [])[0] ?? {};
  const expiresAt = new Date(String(line.expiryTime ?? ""));
  if (Number.isNaN(expiresAt.getTime())) throw new Error("Google Play subscription has no expiry time");
  const state = String(data.subscriptionState ?? "");
  const cancel = (data.canceledStateContext as Record<string, unknown> | undefined) ?? {};
  const external = (data.externalAccountIdentifiers as Record<string, unknown> | undefined) ?? {};
  return {
    productId: String(line.productId ?? ""),
    entitled: ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(state) && expiresAt > now,
    revoked: Boolean(cancel.developerInitiatedCancellation || cancel.systemInitiatedCancellation),
    expiresAt,
    acknowledged: data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    state,
    accountRef: typeof external.obfuscatedExternalAccountId === "string" ? external.obfuscatedExternalAccountId : null,
  };
}

/**
 * Records what Play said and, when the purchase is paid up, opens its current period and pays the instant grant once
 * per (purchase, period) ever (inside the caller's transaction, with the account row locked). Refuses a purchase of
 * another product, one tagged for or bound to another account, and one that is not active.
 */
export async function applySubscription(tx: Db, accountId: string, purchaseToken: string, state: SubscriptionState, now: Date): Promise<Record<string, unknown>> {
  if (state.productId !== BLESSING.productId) throw new ApiError(400, "INVALID_REQUEST", `Not the Eclipse Blessing product: ${state.productId}`);
  if (state.accountRef !== null && state.accountRef !== accountId) throw new ApiError(409, "CONFLICT", "This purchase was made for another account");
  const owner = await tx.query<{ account_id: string }>("SELECT account_id FROM subscriptions WHERE purchase_token = $1 FOR UPDATE", [purchaseToken]);
  if (owner.rows[0] && owner.rows[0].account_id !== accountId) throw new ApiError(409, "CONFLICT", "This purchase belongs to another account");
  await tx.query(
    `INSERT INTO subscriptions (purchase_token, account_id, product_id, expires_at, play_state, acknowledged, last_verified_at, revoked_at, revoke_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 THEN $7::timestamptz END, CASE WHEN $8 THEN 'revoked by Google Play' END)
     ON CONFLICT (purchase_token) DO UPDATE SET expires_at = excluded.expires_at, play_state = excluded.play_state,
       acknowledged = subscriptions.acknowledged OR excluded.acknowledged, last_verified_at = excluded.last_verified_at,
       revoked_at = COALESCE(subscriptions.revoked_at, excluded.revoked_at), revoke_reason = COALESCE(subscriptions.revoke_reason, excluded.revoke_reason)`,
    [purchaseToken, accountId, state.productId, state.expiresAt, state.state, state.acknowledged, now, state.revoked],
  );
  if (state.revoked || !state.entitled) {
    return { new_period: false, instant_eclipse_tokens: 0, period_end_utc: isoUtc(state.expiresAt), active: false };
  }
  const opened = await tx.query(
    "INSERT INTO subscription_periods (account_id, purchase_token, period_end, instant_granted_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
    [accountId, purchaseToken, state.expiresAt, now],
  );
  let paid = 0;
  if (opened.rowCount === 1) {
    const ledger = await tx.query("INSERT INTO billing_instant_grants (token_sha256, period_end) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
      await sha256Hex(purchaseToken),
      state.expiresAt,
    ]);
    if (ledger.rowCount === 1) {
      await setJournalContext(tx, null, "subscription_instant");
      await tx.query("UPDATE wallet SET eclipse_tokens = eclipse_tokens + $2 WHERE account_id = $1", [accountId, BLESSING.instant]);
      paid = BLESSING.instant;
      await bumpStateRevision(tx, accountId);
    }
  }
  return { new_period: opened.rowCount === 1, instant_eclipse_tokens: paid, period_end_utc: isoUtc(state.expiresAt), active: true };
}

interface Period {
  token: string;
  end: Date;
}

async function periods(db: Db, accountId: string, includeRevoked: boolean): Promise<Period[]> {
  const { rows } = await db.query<{ purchase_token: string; period_end: Date }>(
    `SELECT p.purchase_token, p.period_end FROM subscription_periods p JOIN subscriptions s ON s.purchase_token = p.purchase_token
     WHERE s.account_id = $1 AND ($2 OR s.revoked_at IS NULL) ORDER BY p.period_end DESC`,
    [accountId, includeRevoked],
  );
  return rows.map((row) => ({ token: row.purchase_token, end: row.period_end }));
}

/** Window ids (unix half days) of a period that have begun and are still within the claim grace; at most `windows`. */
export function eligibleWindows(end: Date, now: Date): number[] {
  const start = end.getTime() - BLESSING.days * 86_400_000;
  // A window belongs to the period if it overlaps it (a period starting mid-window includes that window).
  const first = Math.floor(start / HALF_DAY_MS);
  const last = Math.ceil(end.getTime() / HALF_DAY_MS) - 1;
  const grace = BLESSING.graceDays * 86_400_000;
  const out: number[] = [];
  for (let window = first; window <= last && out.length < BLESSING.windows; window++) {
    const windowStart = window * HALF_DAY_MS;
    if (windowStart <= now.getTime() && now.getTime() - (windowStart + HALF_DAY_MS) <= grace) out.push(window);
  }
  return out;
}

async function claimedWindows(db: Db, period: Period): Promise<Set<number>> {
  const { rows } = await db.query<{ window_id: string }>("SELECT window_id FROM subscription_claims WHERE purchase_token = $1 AND period_end = $2", [period.token, period.end]);
  return new Set(rows.map((row) => Number(row.window_id)));
}

export async function subscriptionStatus(db: Db, accountId: string, now: Date): Promise<Record<string, unknown>> {
  const all = await periods(db, accountId, true);
  const base = { product_id: BLESSING.productId, window_tokens: BLESSING.perWindow, windows_per_period: BLESSING.windows };
  const latest = all[0];
  if (!latest) return { ...base, subscribed: false, expires_at_utc: null, revoked: false, claimable_windows: [], claimed_this_period: 0 };
  const revoked = (await db.query<{ revoked_at: Date | null }>("SELECT revoked_at FROM subscriptions WHERE purchase_token = $1", [latest.token])).rows[0]?.revoked_at != null;
  const done = await claimedWindows(db, latest);
  const open = revoked ? [] : eligibleWindows(latest.end, now);
  return {
    ...base,
    subscribed: latest.end > now && !revoked,
    expires_at_utc: isoUtc(latest.end),
    revoked,
    claimable_windows: open.filter((window) => !done.has(window)),
    claimed_this_period: done.size,
  };
}

/** Pays one twelve-hour entitlement (the current window, or a missed one within the grace) inside the caller's transaction. */
export async function claimEntitlement(tx: Db, accountId: string, now: Date, windowId: number | null): Promise<Record<string, unknown>> {
  const open = await periods(tx, accountId, false);
  if (open.length === 0) throw new ApiError(400, "INVALID_REQUEST", "No active Eclipse Blessing on this account");
  const wanted = windowId ?? Math.floor(now.getTime() / HALF_DAY_MS);
  for (const period of open) {
    if (!eligibleWindows(period.end, now).includes(wanted)) continue;
    const done = await claimedWindows(tx, period);
    if (done.has(wanted)) return { already_claimed: true, eclipse_tokens: 0, window_id: wanted };
    if (done.size >= BLESSING.windows) throw new ApiError(400, "INVALID_REQUEST", "All entitlements of this period were claimed");
    await tx.query("UPDATE wallet SET eclipse_tokens = eclipse_tokens + $2 WHERE account_id = $1", [accountId, BLESSING.perWindow]);
    await tx.query(
      "INSERT INTO subscription_claims (account_id, purchase_token, period_end, window_id, tokens, claimed_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [accountId, period.token, period.end, wanted, BLESSING.perWindow, now],
    );
    return { already_claimed: false, eclipse_tokens: BLESSING.perWindow, window_id: wanted };
  }
  throw new ApiError(400, "INVALID_REQUEST", "That window is not claimable (outside the subscription or past the claim grace)");
}

/** A Pub/Sub push request authenticated by Google's OIDC token. */
export interface PushVerifier {
  verify(request: Request): Promise<void>;
}

const GOOGLE_CERTS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/**
 * Pub/Sub push authentication: the push subscription signs each request with an OIDC token of a service account we
 * chose (RTDN_PUSH_SERVICE_ACCOUNT) for an audience we chose (RTDN_AUDIENCE); anything else is refused.
 */
export class GooglePushVerifier implements PushVerifier {
  constructor(
    private readonly audience: string,
    private readonly serviceAccountEmail: string,
  ) {}

  async verify(request: Request): Promise<void> {
    const header = request.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "Missing push token");
    try {
      const { payload } = await jwtVerify(token, GOOGLE_CERTS, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: this.audience });
      if (payload.email !== this.serviceAccountEmail || payload.email_verified !== true) throw new Error("wrong sender");
    } catch {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid push token");
    }
  }
}

export interface RtdnEnvelope {
  messageId: string;
  kind: "subscription" | "voided" | "test" | "other";
  notificationType: number | null;
  purchaseToken: string | null;
  packageName: string | null;
}

/** The Pub/Sub push body ({message: {data: base64(JSON), messageId}}) as the notification it carries. */
export function parseRtdn(body: Record<string, unknown>): RtdnEnvelope {
  const message = body.message as Record<string, unknown> | undefined;
  const messageId = typeof message?.messageId === "string" ? message.messageId : typeof message?.message_id === "string" ? message.message_id : "";
  if (!message || !messageId || typeof message.data !== "string") throw new ApiError(400, "INVALID_REQUEST", "Not a Pub/Sub push message");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(atob(message.data)) as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "INVALID_REQUEST", "The message data is not a developer notification");
  }
  const subscription = data.subscriptionNotification as Record<string, unknown> | undefined;
  const voided = data.voidedPurchaseNotification as Record<string, unknown> | undefined;
  const packageName = typeof data.packageName === "string" ? data.packageName : null;
  if (subscription) {
    return { messageId, kind: "subscription", notificationType: Number(subscription.notificationType ?? 0), purchaseToken: String(subscription.purchaseToken ?? "") || null, packageName };
  }
  if (voided) return { messageId, kind: "voided", notificationType: null, purchaseToken: String(voided.purchaseToken ?? "") || null, packageName };
  if (data.testNotification) return { messageId, kind: "test", notificationType: null, purchaseToken: null, packageName };
  return { messageId, kind: "other", notificationType: null, purchaseToken: null, packageName };
}
