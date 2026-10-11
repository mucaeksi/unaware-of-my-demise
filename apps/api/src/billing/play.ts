import { importPKCS8, SignJWT } from 'jose';
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
export interface PlayClient {
  getProduct(productId: string, token: string): Promise<ProductPurchase>;
  getSubscription(token: string): Promise<SubscriptionPurchase>;
  acknowledgeProduct(productId: string, token: string): Promise<void>;
  consumeProduct(productId: string, token: string): Promise<void>;
  acknowledgeSubscription(productId: string, token: string): Promise<void>;
}

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
let tokenCache: { token: string; exp: number } | undefined;

/** Access token for the Play service account (JWT bearer grant). The key lives only in the Worker secret GOOGLE_PLAY_SERVICE_ACCOUNT. */
async function accessToken(env: GameEnv): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  let sa: { client_email: string; private_key: string; token_uri?: string };
  try {
    sa = JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT ?? '');
  } catch {
    throw new HttpError(503, 'billing_not_configured', 'Google Play billing is not configured for this environment');
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience(sa.token_uri ?? 'https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3000)
    .sign(await importPKCS8(sa.private_key, 'RS256'));
  const res = await fetch(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  if (!res.ok) throw new HttpError(503, 'billing_unavailable', 'could not authenticate to Google Play');
  const j = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
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
    const res = await fetch(`${API}/${this.pkg}/${path}`, { method, headers: { Authorization: `Bearer ${await accessToken(this.env)}`, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) });
    if (res.status === 404 || res.status === 400) throw new HttpError(422, 'unknown_purchase', 'Google Play does not know this purchase');
    if (!res.ok) throw new HttpError(503, 'billing_unavailable', `Google Play API answered ${res.status}`);
    return (res.status === 204 ? {} : await res.json()) as T;
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
  async getSubscription(token: string): Promise<SubscriptionPurchase> {
    const r = await this.call<{
      subscriptionState?: string;
      latestOrderId?: string;
      acknowledgementState?: string;
      startTime?: string;
      lineItems?: { productId?: string; expiryTime?: string }[];
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
    const line = r.lineItems?.[0];
    return {
      state,
      productId: line?.productId ?? '',
      latestOrderId: r.latestOrderId ?? '',
      acknowledged: r.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
      ...(r.externalAccountIdentifiers?.obfuscatedExternalAccountId ? { obfuscatedAccountId: r.externalAccountIdentifiers.obfuscatedExternalAccountId } : {}),
      startTimeMs: ms(r.startTime),
      expiryTimeMs: ms(line?.expiryTime)
    };
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
