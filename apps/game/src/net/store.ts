import { Ads, Billing, isNative, nativeCode, type ConsentState, type PlayPurchase } from '../platform/native';
import { Services } from '../services';
import type { Product } from './api';
import { ApiError } from './api';

export interface PurchaseOutcome {
  status: 'granted' | 'already_granted' | 'pending' | 'not_entitled' | 'canceled';
}

export interface RestoreOutcome {
  granted: number;
  alreadyGranted: number;
  pending: number;
  notEntitled: number;
  unconfirmed: number;
}

function requireAccount(revision: number): void {
  if (!Services.api.signedIn || Services.api.authRevision !== revision) throw new ApiError(409, 'auth_changed', 'The account changed; select the purchase account before retrying');
}

/** Buys a shop product through Google Play and lets the server verify and grant it. Returns what the SERVER decided. */
export async function buyProduct(p: Product): Promise<PurchaseOutcome> {
  if (!isNative()) throw new Error('Purchases run inside the Android app');
  const type = p.kind === 'subscription' ? 'subs' : 'inapp';
  const revision = Services.api.authRevision;
  const me = await Services.api.me();
  requireAccount(revision);
  let bought: PlayPurchase;
  try {
    bought = await Billing.purchase({ productId: p.productId, type, accountTag: me.billingTag });
  } catch (e) {
    if (nativeCode(e) === 'canceled') return { status: 'canceled' };
    throw e;
  }
  requireAccount(revision);
  if (bought.productId !== p.productId) throw new ApiError(503, 'invalid_response', 'Google Play returned a different product');
  // Provider-bound pending receipts must reach the server's encrypted recovery before they clear.
  return Services.api.verifyPurchase(bought.productId, bought.purchaseToken, revision);
}

/** Re-submits purchases Google still lists for this account (interrupted flows, another device, reinstall). The server grants each at most once. */
export async function restorePurchases(): Promise<RestoreOutcome> {
  const outcome: RestoreOutcome = { granted: 0, alreadyGranted: 0, pending: 0, notEntitled: 0, unconfirmed: 0 };
  if (!isNative() || !Services.api.signedIn) return outcome;
  const revision = Services.api.authRevision;
  const { purchases } = await Billing.owned();
  requireAccount(revision);
  for (const p of purchases) {
    requireAccount(revision);
    try {
      const r = await Services.api.verifyPurchase(p.productId, p.purchaseToken, revision);
      if (r.status === 'granted') outcome.granted++;
      else if (r.status === 'already_granted') outcome.alreadyGranted++;
      else if (r.status === 'pending') outcome.pending++;
      else outcome.notEntitled++;
    } catch {
      requireAccount(revision);
      outcome.unconfirmed++;
    }
  }
  requireAccount(revision);
  return outcome;
}

let consent: ConsentState | null = null;
/** UMP consent first, then the ads SDK; safe to call repeatedly. */
export async function initConsent(): Promise<ConsentState | null> {
  if (!isNative()) return null;
  try {
    consent = await Ads.init();
  } catch {
    consent = null;
  }
  return consent;
}
export const consentState = (): ConsentState | null => consent;
export async function showPrivacyOptions(): Promise<void> {
  if (isNative()) consent = await Ads.showPrivacyOptions();
}

/**
 * One rewarded view: the server issues a one-time nonce, the ad carries it, Google calls the server, the server pays.
 * The client only waits (briefly) for the wallet to change; it never grants anything itself.
 */
export async function watchRewardedAd(): Promise<'rewarded' | 'closed_early' | 'no_ad' | 'no_consent' | 'error'> {
  if (!isNative()) throw new Error('Rewarded ads run inside the Android app');
  const me = await Services.api.me();
  const { nonce } = await Services.api.adBegin();
  const before = (await Services.api.wallet()).eclipse_token ?? 0;
  let earned: boolean;
  try {
    ({ earned } = await Ads.showRewarded({ userId: me.id, customData: nonce }));
  } catch (e) {
    const c = nativeCode(e);
    return c === 'no_fill' ? 'no_ad' : c === 'no_consent' ? 'no_consent' : 'error';
  }
  if (!earned) return 'closed_early';
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    if (((await Services.api.wallet()).eclipse_token ?? 0) > before) return 'rewarded';
  }
  return 'rewarded'; // the callback can be slow; the wallet strip refreshes on the next screen
}
