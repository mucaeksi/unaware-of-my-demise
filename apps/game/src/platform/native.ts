import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * The three native bridges of the Android shell (apps/android). In a browser they do not exist: `isNative()` is false and every
 * caller must check it first. Nothing returned here is trusted by the game: the server verifies identity, purchases and ad rewards.
 */
export const isNative = (): boolean => Capacitor.isNativePlatform();

export interface GoogleSignInPlugin {
  signIn(): Promise<{ idToken: string }>;
  signOut(): Promise<void>;
}
export const GoogleSignIn = registerPlugin<GoogleSignInPlugin>('UomdGoogleSignIn');

export interface StoreProduct {
  productId: string;
  type: 'inapp' | 'subs';
  title: string;
  price?: string;
  offerToken?: string;
}
export interface PlayPurchase {
  productId: string;
  purchaseToken: string;
  state: 'purchased' | 'pending';
}
export interface BillingPlugin {
  getProducts(o: { products: { productId: string; type: 'inapp' | 'subs' }[] }): Promise<{ products: StoreProduct[] }>;
  purchase(o: { productId: string; type: 'inapp' | 'subs'; accountTag: string }): Promise<PlayPurchase>;
  owned(): Promise<{ purchases: PlayPurchase[] }>;
}
export const Billing = registerPlugin<BillingPlugin>('UomdBilling');

export interface ConsentState {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
}
export interface AdsPlugin {
  init(): Promise<ConsentState>;
  showPrivacyOptions(): Promise<ConsentState>;
  showRewarded(o: { userId: string; customData: string }): Promise<{ earned: boolean }>;
}
export const Ads = registerPlugin<AdsPlugin>('UomdAds');

/** Plugin errors carry a stable `code` (canceled, no_account, no_fill, ...). */
export const nativeCode = (e: unknown): string => (typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : 'error');
