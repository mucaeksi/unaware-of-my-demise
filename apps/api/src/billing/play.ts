import { importPKCS8, SignJWT } from 'jose';
import { sha256Hex } from '@uomd/shared';
import { HttpError } from '../content/store';
import type { GameEnv } from '../env';

/** The parts of the Play Developer API the game needs. A fake implements this in tests; PlayApi is the real client. */
export interface ProductPurchase {
  purchaseState: 'purchased' | 'canceled' | 'pending';
  orderId: string;
  acknowledged: boolean;
  consumed: boolean;
  obfuscatedAccountId?: string;
  purchaseTimeMs: number;
}
export interface SubscriptionPurchase {
  state: 'active' | 'canceled' | 'in_grace' | 'on_hold' | 'paused' | 'expired' | 'pending' | 'unknown';
  productId: string;
  /** order id of the latest billing period (changes on every renewal) */
  latestOrderId: string;
  acknowledged: boolean;
  obfuscatedAccountId?: string;
  startTimeMs: number;
  expiryTimeMs: number;
}
export interface OrderPurchase {
  orderId: string;
  createTimeMs: number;
  purchaseToken: string;
  fullRefundTimeMs: number;
  partialRefund: boolean;
}
export interface PlayClient {
  getProduct(productId: string, token: string): Promise<ProductPurchase>;
  getSubscription(token: string, productId?: string): Promise<SubscriptionPurchase>;
  getOrder(orderId: string): Promise<OrderPurchase>;
  acknowledgeProduct(productId: string, token: string): Promise<void>;
  consumeProduct(productId: string, token: string): Promise<void>;
  acknowledgeSubscription(productId: string, token: string): Promise<void>;
}

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const OAUTH = 'https://oauth2.googleapis.com/token';
let tokenCache: { token: string; exp: number; identity: string } | undefined;

/** Deadline includes response-body reads; provider failures never carry token/URL/body text into logs. */
async function googleJson<T>(url: string, init: RequestInit, purchase = false): Promise<T> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    if (purchase && [400, 404].includes(res.status)) throw new HttpError(422, 'unknown_purchase', 'Google Play does not know this purchase');
    if (!res.ok) throw new HttpError(503, 'billing_unavailable', 'Google Play request could not complete; retry later');
    return (res.status === 204 ? {} : await res.json()) as T;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(503, 'billing_unavailable', 'Google Play request could not complete; retry later');
  }
}

/** Access token for the Play service account (JWT bearer grant). The key lives only in the Worker secret GOOGLE_PLAY_SERVICE_ACCOUNT. */
async function accessToken(env: GameEnv): Promise<string> {
  let sa: { client_email: string; private_key: string; token_uri?: string };
  try {
    sa = JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT ?? '');
    if (!sa || typeof sa.client_email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(sa.client_email) || typeof sa.private_key !== 'string' || !sa.private_key || (sa.token_uri && sa.token_uri !== OAUTH)) throw new Error('invalid service account');
  } catch {
    throw new HttpError(503, 'billing_not_configured', 'Google Play billing is not configured for this environment');
  }
  const identity = await sha256Hex(`${env.ENVIRONMENT}:${env.PLAY_PACKAGE_NAME}:${env.GOOGLE_PLAY_SERVICE_ACCOUNT}`);
  if (tokenCache?.identity === identity && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  let key: Awaited<ReturnType<typeof importPKCS8>>;
  try { key = await importPKCS8(sa.private_key, 'RS256'); }
  catch { throw new HttpError(503, 'billing_not_configured', 'Google Play billing is not configured for this environment'); }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience(OAUTH)
    .setIssuedAt(now)
    .setExpirationTime(now + 3000)
    .sign(key);
  const j = await googleJson<{ access_token: string; expires_in: number }>(OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  if (!j || typeof j.access_token !== 'string' || !j.access_token || !Number.isSafeInteger(j.expires_in) || j.expires_in <= 0 || j.expires_in > 86400) throw new HttpError(503, 'billing_invalid_response', 'Google Play authentication response was invalid');
  tokenCache = { token: j.access_token, exp: Date.now() + j.expires_in * 1000, identity };
  return j.access_token;
}

const ms = (iso?: string): number => (iso ? Date.parse(iso) : 0);

/** NOTE: written against the documented Play Developer API v3 (purchases.products, purchases.subscriptionsv2); not yet exercised against the live API. */
export class PlayApi implements PlayClient {
  constructor(private readonly env: GameEnv) {}
  private get pkg(): string {
    if (!this.env.PLAY_PACKAGE_NAME) throw new HttpError(503, 'billing_not_configured', 'Google Play billing is not configured for this environment');
    return encodeURIComponent(this.env.PLAY_PACKAGE_NAME);
  }
  private async call<T>(method: 'GET' | 'POST', path: string): Promise<T> {
    return googleJson<T>(`${API}/${this.pkg}/${path}`, { method, headers: { Authorization: `Bearer ${await accessToken(this.env)}`, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) }, true);
  }
  async getProduct(productId: string, token: string): Promise<ProductPurchase> {
    const r = await this.call<{ purchaseState?: number; consumptionState?: number; acknowledgementState?: number; orderId?: string; obfuscatedExternalAccountId?: string; purchaseTimeMillis?: string }>(
      'GET',
      `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`
    );
    return {
      purchaseState: r.purchaseState === 0 ? 'purchased' : r.purchaseState === 1 ? 'canceled' : 'pending',
      orderId: r.orderId ?? '',
      acknowledged: r.acknowledgementState === 1,
      consumed: r.consumptionState === 1,
      ...(r.obfuscatedExternalAccountId ? { obfuscatedAccountId: r.obfuscatedExternalAccountId } : {}),
      purchaseTimeMs: Number(r.purchaseTimeMillis ?? 0)
    };
  }
  async getSubscription(token: string, productId?: string): Promise<SubscriptionPurchase> {
    const r = await this.call<{
      subscriptionState?: string;
      latestOrderId?: string;
      acknowledgementState?: string;
      startTime?: string;
      lineItems?: { productId?: string; expiryTime?: string; latestSuccessfulOrderId?: string }[];
      externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
    }>('GET', `purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`);
    const state = ((): SubscriptionPurchase['state'] => {
      switch (r.subscriptionState) {
        case 'SUBSCRIPTION_STATE_ACTIVE':
          return 'active';
        case 'SUBSCRIPTION_STATE_CANCELED':
          return 'canceled'; // still entitled until expiry
        case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
          return 'in_grace';
        case 'SUBSCRIPTION_STATE_ON_HOLD':
          return 'on_hold';
        case 'SUBSCRIPTION_STATE_PAUSED':
          return 'paused';
        case 'SUBSCRIPTION_STATE_EXPIRED':
          return 'expired';
        case 'SUBSCRIPTION_STATE_PENDING':
          return 'pending';
        default:
          return 'unknown';
      }
    })();
    const line = productId ? r.lineItems?.find((item) => item.productId === productId) : r.lineItems?.[0];
    return {
      state,
      productId: line?.productId ?? '',
      latestOrderId: line?.latestSuccessfulOrderId ?? r.latestOrderId ?? '',
      acknowledged: r.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
      ...(r.externalAccountIdentifiers?.obfuscatedExternalAccountId ? { obfuscatedAccountId: r.externalAccountIdentifiers.obfuscatedExternalAccountId } : {}),
      startTimeMs: ms(r.startTime),
      expiryTimeMs: ms(line?.expiryTime)
    };
  }
  /** Official Android Publisher v3 Order.createTime, not subscription lifecycle start or an assumed 30-day month. */
  async getOrder(orderId: string): Promise<OrderPurchase> {
    const order = await this.call<{ orderId?: string; createTime?: string; purchaseToken?: string; orderHistory?: { refundEvent?: { eventTime?: string }; partialRefundEvents?: unknown[] } }>('GET', `orders/${encodeURIComponent(orderId)}`);
    return { orderId: order.orderId ?? '', createTimeMs: ms(order.createTime), purchaseToken: order.purchaseToken ?? '', fullRefundTimeMs: ms(order.orderHistory?.refundEvent?.eventTime), partialRefund: (order.orderHistory?.partialRefundEvents?.length ?? 0) > 0 };
  }
  async acknowledgeProduct(productId: string, token: string): Promise<void> {
    await this.call('POST', `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`);
  }
  async consumeProduct(productId: string, token: string): Promise<void> {
    await this.call('POST', `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:consume`);
  }
  async acknowledgeSubscription(productId: string, token: string): Promise<void> {
    await this.call('POST', `purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`);
  }
}
