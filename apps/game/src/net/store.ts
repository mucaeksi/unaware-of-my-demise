import { Ads, Billing, isNative, nativeCode, type ConsentState, type PlayPurchase } from '../platform/native';
import { Services } from '../services';
import type { Product } from './api';

export interface PurchaseOutcome {
  status: 'granted' | 'already_granted' | 'pending' | 'not_entitled' | 'canceled';
}

/** Buys a shop product through Google Play and lets the server verify and grant it. Returns what the SERVER decided. */
export async function buyProduct(p: Product): Promise<PurchaseOutcome> {
  if (!isNative()) throw new Error('Purchases run inside the Android app');
  const type = p.kind === 'subscription' ? 'subs' : 'inapp';
  const me = await Services.api.me();
  let bought: PlayPurchase;
  try {
    bought = await Billing.purchase({ productId: p.productId, type, accountTag: me.billingTag });
  } catch (e) {
    if (nativeCode(e) === 'canceled') return { status: 'canceled' };
    throw e;
  }
  if (bought.state === 'pending') return { status: 'pending' }; // granted later: the server hears about it through RTDN and the next restore
  return (await Services.api.verifyPurchase(bought.productId, bought.purchaseToken)) as PurchaseOutcome;
}

/** Re-submits purchases Google still lists for this account (interrupted flows, another device, reinstall). The server grants each at most once. */
export async function restorePurchases(): Promise<number> {
  if (!isNative() || !Services.api.signedIn) return 0;
  let granted = 0;
  const { purchases } = await Billing.owned();
  for (const p of purchases) {
    if (p.state !== 'purchased') continue;
    try {
      const r = (await Services.api.verifyPurchase(p.productId, p.purchaseToken)) as { status: string };
      if (r.status === 'granted') granted++;
    } catch {
      /* not one of our products, or not entitled: ignore */
    }
  }
  return granted;
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
