import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * The three native bridges of the Android shell (apps/android). In a browser they do not exist: `isNative()` is false and every
 * caller must check it first. Nothing returned here is trusted by the game: the server verifies identity, purchases and ad rewards.
 */
export const isNative = (): boolean => Capacitor.isNativePlatform();

export interface GoogleSignInPlugin {
  signIn(): Promise<{ idToken: string }>;
  signOut(): Promise<void>;
  readSession(): Promise<{ token: string | null; expiresAt: string | null; playerId?: string | null }>;
  writeSession(o: { token: string; expiresAt: string; playerId?: string }): Promise<void>;
  clearSession(): Promise<void>;
}
export const GoogleSignIn = registerPlugin<GoogleSignInPlugin>('UomdGoogleSignIn');

export interface StorePricingPhase {
  formattedPrice: string;
  priceCurrencyCode?: string;
  priceAmountMicros?: number;
  billingPeriod: string;
  billingCycleCount: number;
  recurrenceMode: number;
}
export interface StoreSubscriptionOffer {
  basePlanId: string;
  offerId?: string | null;
  offerToken: string;
  offerTags?: string[];
  pricingPhases: StorePricingPhase[];
}
export interface StoreProduct {
  productId: string;
  type: 'inapp' | 'subs';
  title: string;
  description?: string;
  price?: string;
  formattedPrice?: string;
  currencyCode?: string;
  priceCurrencyCode?: string;
  priceAmountMicros?: number;
  offerToken?: string;
  offers?: StoreSubscriptionOffer[];
}
export interface PlayPurchase {
  productId: string;
  purchaseToken: string;
  state: 'purchased' | 'pending';
}
export interface BillingPlugin {
  getProducts(o: {
    inapp?: string[];
    subs?: string[];
    products?: { productId: string; type: 'inapp' | 'subs' }[];
  }): Promise<{ products: StoreProduct[] }>;
  purchase(o: {
    productId: string;
    type: 'inapp' | 'subs';
    accountTag: string;
    offerToken?: string;
    basePlanId?: string;
  }): Promise<PlayPurchase>;
  owned(): Promise<{ purchases: PlayPurchase[] }>;
  addListener?(
    eventName: 'purchasesUpdated',
    listenerFunc: (data: { purchases: PlayPurchase[] }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}
export const Billing = registerPlugin<BillingPlugin>('UomdBilling');

export type ConsentStatus =
  | 'OBTAINED'
  | 'REQUIRED'
  | 'NOT_REQUIRED'
  | 'UNKNOWN'
  | 'granted'
  | 'refused'
  | 'withdrawn'
  | 'denied'
  | 'not_required'
  | 'unknown'
  | 'error';
export interface ConsentState {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  status?: ConsentStatus;
  underAgeOfConsent?: boolean;
  childDirected?: false;
  maxAdContentRating?: 'T';
  updatedAt?: string;
  source?: 'ump' | 'offline_cache' | 'browser_local' | 'web' | 'cached';
}
export interface AdsPlugin {
  init(o?: { underAgeOfConsent?: boolean }): Promise<ConsentState>;
  showPrivacyOptions(o?: { underAgeOfConsent?: boolean; withdrawConsent?: boolean }): Promise<ConsentState>;
  showRewarded(o: { userId: string; customData: string }): Promise<{ earned: boolean }>;
}
export const Ads = registerPlugin<AdsPlugin>('UomdAds');

/** Plugin errors carry a stable `code` (canceled, no_account, no_fill, ...). */
export const nativeCode = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : 'error';

/** Native process relaunch (Capacitor plugin `UomdApp`, shipped with the next Android build); older shells and browsers reload the page instead. */
export interface AppPlugin {
  restart(): Promise<void>;
}
export const NativeApp = registerPlugin<AppPlugin>('UomdApp');

/** Restarts the game client exactly once per call; the caller guards against repeated presses. */
export async function restartGame(): Promise<void> {
  if (isNative()) {
    try {
      await NativeApp.restart();
      return;
    } catch {
      /* the shell has no relaunch plugin yet: fall back to reloading the web layer, which re-boots the game and activates the new content */
    }
  }
  location.reload();
}
