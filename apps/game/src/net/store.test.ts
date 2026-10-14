import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAndroidReleaseEnv } from '../platform/releaseGate';

const mockNative = vi.hoisted(() => ({
  native: true,
  googleSignIn: {
    signIn: vi.fn(),
    signOut: vi.fn(),
    readSession: vi.fn(),
    writeSession: vi.fn(),
    clearSession: vi.fn()
  },
  billing: {
    getProducts: vi.fn(),
    purchase: vi.fn(),
    owned: vi.fn(),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() })
  },
  ads: {
    init: vi.fn(),
    showPrivacyOptions: vi.fn(),
    showRewarded: vi.fn()
  }
}));

vi.mock('../platform/native', () => ({
  isNative: () => mockNative.native,
  nativeCode: (e: unknown) => (e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : 'unknown'),
  GoogleSignIn: mockNative.googleSignIn,
  Billing: mockNative.billing,
  Ads: mockNative.ads
}));

import { GameApi, type Product } from './api';
import { Services } from '../services';
import {
  buyProduct,
  consentState,
  formatOfferTerms,
  initConsent,
  loadStoreCatalog,
  restorePurchases,
  showPrivacyOptions,
  subscribeConsent,
  watchRewardedAd
} from './store';

const storage = new Map<string, string>();
const expiry = () => new Date(Date.now() + 3_600_000).toISOString();

beforeEach(() => {
  storage.clear();
  mockNative.native = true;
  vi.clearAllMocks();
  mockNative.googleSignIn.readSession.mockResolvedValue({ token: 'native-tok', expiresAt: expiry(), playerId: 'p1' });
  mockNative.googleSignIn.writeSession.mockResolvedValue(undefined);
  mockNative.googleSignIn.clearSession.mockResolvedValue(undefined);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k)
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('R11 native keystore session persistence', () => {
  it('hydrates native session from AndroidKeyStore plugin and never leaves raw bearer tokens in localStorage', async () => {
    storage.set('uomd.session.v1', JSON.stringify({ token: 'legacy-token', expiresAt: expiry(), playerId: 'p1' }));
    const api = new GameApi('https://game.test');
    expect(await api.hydrateNativeSession()).toBe(true);
    expect(api.signedIn).toBe(true);
    expect(storage.has('uomd.session.v1')).toBe(false);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          token: 'new-native-token',
          expiresAt: expiry(),
          player: { id: 'p2', displayName: 'Wayfarer', isNew: false }
        })
      )
    );
    await api.signInWithIdToken('id-token');
    expect(mockNative.googleSignIn.writeSession).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'new-native-token', playerId: 'p2' })
    );
    expect(storage.has('uomd.session.v1')).toBe(false);
  });
});

describe('R11 store catalog, subscription offer terms, and purchase reconciliation', () => {
  const subProduct: Product = {
    productId: 'eclipse_blessing_30d',
    kind: 'subscription',
    title: 'Eclipse Blessing',
    grants: [],
    subscription: { duration_days: 30 }
  };

  it('formats localized prices, base plans, offers, and pricing phases without inventing fallback prices', async () => {
    const missingTerms = formatOfferTerms(subProduct, null);
    expect(missingTerms.priceLabel).toBe('See price in Google Play');

    mockNative.billing.getProducts.mockResolvedValue({
      products: [
        {
          productId: 'eclipse_blessing_30d',
          type: 'subs',
          title: 'Eclipse Blessing',
          description: '30-day blessing',
          formattedPrice: '$4.99',
          priceAmountMicros: 4990000,
          priceCurrencyCode: 'USD',
          offers: [
            {
              basePlanId: 'monthly-base',
              offerId: 'intro-trial',
              offerToken: 'tok-offer-1',
              pricingPhases: [
                {
                  formattedPrice: 'Free',
                  priceAmountMicros: 0,
                  priceCurrencyCode: 'USD',
                  billingPeriod: 'P1W',
                  recurrenceMode: 2,
                  billingCycleCount: 1
                },
                {
                  formattedPrice: '$4.99',
                  priceAmountMicros: 4990000,
                  priceCurrencyCode: 'USD',
                  billingPeriod: 'P1M',
                  recurrenceMode: 1,
                  billingCycleCount: 0
                }
              ]
            },
            {
              basePlanId: 'monthly-base',
              offerId: null,
              offerToken: 'tok-offer-2',
              pricingPhases: [
                {
                  formattedPrice: '$4.99',
                  priceAmountMicros: 4990000,
                  priceCurrencyCode: 'USD',
                  billingPeriod: 'P1M',
                  recurrenceMode: 1,
                  billingCycleCount: 0
                }
              ]
            }
          ]
        }
      ]
    });

    const catalog = await loadStoreCatalog([subProduct]);
    const storeProd = catalog.get('eclipse_blessing_30d')!;
    const unselected = formatOfferTerms(subProduct, storeProd);
    expect(unselected.requiresOfferSelection).toBe(true);

    const selected = formatOfferTerms(subProduct, storeProd, 0);
    expect(selected.requiresOfferSelection).toBe(false);
    expect(selected.priceLabel).toBe('$4.99 (monthly)');
    expect(selected.offerLabel).toContain('monthly-base');
    expect(selected.offerLabel).toContain('intro-trial');
    expect(selected.phasesLabel).toContain('Trial: Free (weekly) -> Recurring: $4.99 (monthly)');
    expect(selected.cancellationLabel).toContain('Cancel anytime in Google Play Subscriptions');
  });

  it('blocks multi-offer subscription checkout without explicit offer selection and retries transient verify errors', async () => {
    const api = new GameApi('https://game.test');
    await api.hydrateNativeSession();
    Services.api = api;

    let verifyCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/me')) {
          return Response.json({ id: 'p1', displayName: 'Wayfarer', createdAt: expiry(), billingTag: 'tag-p1' });
        }
        if (url.endsWith('/shop/verify')) {
          verifyCalls++;
          if (verifyCalls === 1) {
            return Response.json({ error: 'billing_busy', message: 'Busy' }, { status: 503 });
          }
          return Response.json({ status: 'granted', productId: 'eclipse_blessing_30d', orderId: 'GPA.1234' });
        }
        return Response.json({});
      })
    );

    mockNative.billing.getProducts.mockResolvedValue({
      products: [
        {
          productId: 'eclipse_blessing_30d',
          type: 'subs',
          title: 'Eclipse Blessing',
          description: '',
          formattedPrice: '$4.99',
          priceAmountMicros: 4990000,
          priceCurrencyCode: 'USD',
          offers: [
            { basePlanId: 'm1', offerId: 'o1', offerToken: 'tok-1', pricingPhases: [] },
            { basePlanId: 'm1', offerId: null, offerToken: 'tok-2', pricingPhases: [] }
          ]
        }
      ]
    });

    await expect(buyProduct(subProduct)).rejects.toMatchObject({ code: 'offer_selection_required' });

    mockNative.billing.purchase.mockResolvedValue({
      productId: 'eclipse_blessing_30d',
      purchaseToken: 'play-tok-1',
      state: 'purchased'
    });
    const outcome = await buyProduct(subProduct, { offerToken: 'tok-1', basePlanId: 'm1' });
    expect(outcome).toMatchObject({ status: 'granted', orderId: 'GPA.1234' });
    expect(verifyCalls).toBe(2);
    expect(mockNative.billing.purchase).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'eclipse_blessing_30d', offerToken: 'tok-1', basePlanId: 'm1' })
    );
  });

  it('reconciles owned purchases across granted, pending, and unconfirmed states', async () => {
    const api = new GameApi('https://game.test');
    await api.hydrateNativeSession();
    Services.api = api;

    mockNative.billing.owned.mockResolvedValue({
      purchases: [
        { productId: 'tokens_small', purchaseToken: 't-granted', state: 'purchased' },
        { productId: 'tokens_large', purchaseToken: 't-pending', state: 'pending' }
      ]
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { productId?: string; purchaseToken?: string };
        if (body.purchaseToken === 't-granted') {
          return Response.json({ status: 'granted', productId: body.productId, orderId: 'GPA.1' });
        }
        return Response.json({ status: 'pending', productId: body.productId });
      })
    );

    const res = await restorePurchases();
    expect(res).toEqual({ granted: 1, alreadyGranted: 0, pending: 1, notEntitled: 0, unconfirmed: 0 });
  });
});

describe('R11 reactive consent and nonce-bound rewarded ad verification', () => {
  it('manages consent login-independently, enforces childDirected=false and underAgeOfConsent, and notifies subscribers', async () => {
    const seen: (string | undefined)[] = [];
    const unsub = subscribeConsent((st) => seen.push(st?.status));

    mockNative.ads.init.mockResolvedValue({
      canRequestAds: true,
      privacyOptionsRequired: true,
      status: 'OBTAINED',
      underAgeOfConsent: false,
      childDirected: false,
      maxAdContentRating: 'T'
    });
    const initial = await initConsent();
    expect(initial).toMatchObject({
      canRequestAds: true,
      status: 'OBTAINED',
      childDirected: false,
      maxAdContentRating: 'T'
    });

    mockNative.ads.showPrivacyOptions.mockResolvedValue({
      canRequestAds: false,
      privacyOptionsRequired: true,
      status: 'withdrawn'
    });
    const withdrawn = await showPrivacyOptions({ withdrawConsent: true });
    expect(withdrawn).toMatchObject({ canRequestAds: false, status: 'withdrawn' });
    expect(consentState()?.canRequestAds).toBe(false);
    expect(seen).toContain('withdrawn');
    unsub();
  });

  it('verifies rewarded ads by polling exact nonce status rather than wallet balance growth, and returns pending on timeout', async () => {
    const api = new GameApi('https://game.test');
    await api.hydrateNativeSession();
    Services.api = api;

    mockNative.ads.init.mockResolvedValue({
      canRequestAds: true,
      privacyOptionsRequired: true,
      status: 'OBTAINED'
    });
    await initConsent();
    mockNative.ads.showRewarded.mockResolvedValue({ earned: true });

    let nonceChecks = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/me')) return Response.json({ id: 'p1', displayName: null, createdAt: expiry(), billingTag: 't' });
        if (url.endsWith('/ads/begin')) return Response.json({ nonce: 'nonce_1234567890123456' });
        if (url.includes('/ads/nonces/nonce_1234567890123456')) {
          nonceChecks++;
          if (nonceChecks === 1) {
            return Response.json({
              nonce: 'nonce_1234567890123456',
              state: 'pending',
              reward: null,
              reason: null,
              transactionId: null,
              verifiedAt: null
            });
          }
          return Response.json({
            nonce: 'nonce_1234567890123456',
            state: 'verified',
            reward: 30,
            reason: null,
            transactionId: 'tx-1',
            verifiedAt: expiry()
          });
        }
        return Response.json({});
      })
    );

    const verified = await watchRewardedAd({ pollAttempts: 3, pollIntervalMs: 1 });
    expect(verified).toBe('verified');
    expect(nonceChecks).toBe(2);

    // Timeout returns 'pending', never 'rewarded'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/me')) return Response.json({ id: 'p1', displayName: null, createdAt: expiry(), billingTag: 't' });
        if (url.endsWith('/ads/begin')) return Response.json({ nonce: 'nonce_pending_00000000' });
        return Response.json({
          nonce: 'nonce_pending_00000000',
          state: 'pending',
          reward: null,
          reason: null,
          transactionId: null,
          verifiedAt: null
        });
      })
    );
    const timedOut = await watchRewardedAd({ pollAttempts: 2, pollIntervalMs: 1 });
    expect(timedOut).toBe('pending');
  });
});

describe('R11 Android fail-closed release gate', () => {
  it('blocks unsigned, sample-test-ad, invalid-versionCode, or staging-pointed production releases', () => {
    const bad = validateAndroidReleaseEnv(
      {
        UOMD_CHANNEL: 'production',
        UOMD_API_BASE: 'https://uomd-game-staging.muratcaneksiii.workers.dev',
        UOMD_VERSION_CODE: '0',
        UOMD_ADMOB_REWARDED_UNIT: 'ca-app-pub-3940256099942544/5224354917'
      },
      () => false
    );
    expect(bad.ok).toBe(false);
    expect(bad.errors.length).toBeGreaterThanOrEqual(4);

    const good = validateAndroidReleaseEnv(
      {
        UOMD_CHANNEL: 'production',
        UOMD_API_BASE: 'https://api.unawareofmydemise.com',
        UOMD_VERSION_CODE: '42',
        UOMD_KEYSTORE_FILE: '/tmp/upload.jks',
        UOMD_KEYSTORE_PASSWORD: 'strong-password',
        UOMD_ADMOB_APP_ID: 'ca-app-pub-4258559369390965~2559970251',
        UOMD_ADMOB_REWARDED_UNIT: 'ca-app-pub-4258559369390965/3553164322',
        UOMD_GOOGLE_WEB_CLIENT_ID: '604013824221-n7htgfhfs55njs5ie11ulojsk1tnk6da.apps.googleusercontent.com'
      },
      () => true
    );
    expect(good).toEqual({ ok: true, errors: [] });
  });
});
