import {
  Ads,
  Billing,
  isNative,
  nativeCode,
  type ConsentState,
  type PlayPurchase,
  type StoreProduct,
  type StoreSubscriptionOffer
} from '../platform/native';
import { Services } from '../services';
import type { Product } from './api';
import { ApiError } from './api';

export interface PurchaseOutcome {
  status: 'granted' | 'already_granted' | 'pending' | 'not_entitled' | 'canceled';
  orderId?: string;
}

export interface RestoreOutcome {
  granted: number;
  alreadyGranted: number;
  pending: number;
  notEntitled: number;
  unconfirmed: number;
}

export type RewardedAdOutcome =
  | 'verified'
  | 'pending'
  | 'test_callback'
  | 'rejected'
  | 'closed_early'
  | 'no_ad'
  | 'no_consent'
  | 'error';

export interface OfferTermsView {
  priceLabel: string;
  offerLabel: string | null;
  phasesLabel: string | null;
  cancellationLabel: string | null;
  requiresOfferSelection: boolean;
  offers: StoreSubscriptionOffer[];
  selectedOffer: StoreSubscriptionOffer | null;
}

const CONSENT_STORAGE_KEY = 'uomd.privacy.consent.v1';

function requireAccount(revision: number): void {
  if (!Services.api.signedIn || Services.api.authRevision !== revision)
    throw new ApiError(409, 'auth_changed', 'The account changed; select the purchase account before retrying');
}

export function isTransientStoreError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return (
      [429, 502, 503, 504].includes(error.status) ||
      ['request_timeout', 'billing_busy', 'provider_unavailable', 'internal_error'].includes(error.code)
    );
  }
  return error instanceof TypeError;
}

async function verifyWithRetry(
  productId: string,
  purchaseToken: string,
  revision: number,
  retryDelayMs = 400
): Promise<{ status: 'granted' | 'already_granted' | 'pending' | 'not_entitled'; productId: string; orderId?: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    requireAccount(revision);
    try {
      return await Services.api.verifyPurchase(productId, purchaseToken, revision);
    } catch (error) {
      lastError = error;
      if (!isTransientStoreError(error) || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw lastError;
}

/** Loads localized product and subscription offer details from Google Play Billing without inventing fallback prices. */
export async function loadStoreCatalog(products: Product[]): Promise<Map<string, StoreProduct>> {
  const map = new Map<string, StoreProduct>();
  if (!isNative() || products.length === 0) return map;
  const inapp = products.filter((p) => p.kind === 'consumable').map((p) => p.productId);
  const subs = products.filter((p) => p.kind === 'subscription').map((p) => p.productId);
  try {
    const { products: storeProducts } = await Billing.getProducts({ inapp, subs });
    for (const sp of storeProducts ?? []) {
      if (sp && typeof sp.productId === 'string') map.set(sp.productId, sp);
    }
  } catch {
    /* store details unavailable; callers must display truthful unavailable/checkout notice instead of fake prices */
  }
  return map;
}

function humanBillingPeriod(isoPeriod: string): string {
  switch (isoPeriod) {
    case 'P1W':
      return 'weekly';
    case 'P1M':
      return 'monthly';
    case 'P3M':
      return 'quarterly';
    case 'P6M':
      return 'every 6 months';
    case 'P1Y':
      return 'yearly';
    default:
      return isoPeriod;
  }
}

/** Formats localized price, base plan/offer, pricing phases, and cancellation/restore terms from Play Billing metadata. */
export function formatOfferTerms(
  product: Product,
  storeProduct?: StoreProduct | null,
  selectedOfferIndex?: number
): OfferTermsView {
  if (product.kind !== 'subscription') {
    const priceLabel = storeProduct?.formattedPrice ? storeProduct.formattedPrice : 'Price in Google Play';
    return {
      priceLabel,
      offerLabel: null,
      phasesLabel: 'One-time purchase · Server-verified grant',
      cancellationLabel: null,
      requiresOfferSelection: false,
      offers: [],
      selectedOffer: null
    };
  }

  const offers = storeProduct?.offers ?? [];
  const hasMultipleOffers = offers.length > 1;
  const validSelection =
    typeof selectedOfferIndex === 'number' && selectedOfferIndex >= 0 && selectedOfferIndex < offers.length;
  const selectedOffer = hasMultipleOffers
    ? validSelection
      ? offers[selectedOfferIndex]!
      : null
    : offers[0] ?? null;

  const phases = selectedOffer?.pricingPhases ?? [];
  const primaryPhase = phases[phases.length - 1] ?? phases[0] ?? null;
  const priceLabel = primaryPhase?.formattedPrice
    ? `${primaryPhase.formattedPrice} (${humanBillingPeriod(primaryPhase.billingPeriod)})`
    : storeProduct?.formattedPrice
      ? storeProduct.formattedPrice
      : 'See price in Google Play';

  const offerLabel = selectedOffer
    ? `Plan: ${selectedOffer.basePlanId}${selectedOffer.offerId ? ` · Offer: ${selectedOffer.offerId}` : ''}`
    : hasMultipleOffers
      ? `Select 1 of ${offers.length} offers before checkout`
      : `Duration: ${product.subscription?.duration_days ?? 30} days`;

  const phasesLabel =
    phases.length > 0
      ? phases
          .map((phase, idx) => {
            const period = humanBillingPeriod(phase.billingPeriod);
            if (phase.priceAmountMicros === 0) return `Trial: ${phase.formattedPrice} (${period})`;
            if (idx < phases.length - 1) return `Intro: ${phase.formattedPrice} (${period} ×${phase.billingCycleCount || 1})`;
            return `Recurring: ${phase.formattedPrice} (${period})`;
          })
          .join(' -> ')
      : `Recurring (${product.subscription?.duration_days ?? 30}d cycle)`;

  return {
    priceLabel,
    offerLabel,
    phasesLabel,
    cancellationLabel: 'Auto-renewing · Cancel anytime in Google Play Subscriptions · Restore on reinstall',
    requiresOfferSelection: hasMultipleOffers && !selectedOffer,
    offers,
    selectedOffer
  };
}

/** Buys a shop product through Google Play and lets the server verify and grant it. Returns what the SERVER decided. */
export async function buyProduct(
  p: Product,
  options?: { offerToken?: string; basePlanId?: string; storeProduct?: StoreProduct | null }
): Promise<PurchaseOutcome> {
  if (!isNative()) throw new Error('Purchases run inside the Android app');
  const type = p.kind === 'subscription' ? 'subs' : 'inapp';
  const revision = Services.api.authRevision;
  const me = await Services.api.me();
  requireAccount(revision);

  let offerToken = options?.offerToken;
  let basePlanId = options?.basePlanId;
  if (type === 'subs' && !offerToken) {
    let storeProduct = options?.storeProduct ?? null;
    if (!storeProduct) {
      const catalog = await loadStoreCatalog([p]);
      storeProduct = catalog.get(p.productId) ?? null;
    }
    requireAccount(revision);
    const offers = storeProduct?.offers ?? [];
    if (offers.length > 1) {
      throw new ApiError(400, 'offer_selection_required', 'Select a subscription plan or offer before continuing to Google Play');
    }
    if (offers.length === 1) {
      offerToken = offers[0]!.offerToken;
      basePlanId = offers[0]!.basePlanId;
    }
  }

  let bought: PlayPurchase;
  try {
    bought = await Billing.purchase({
      productId: p.productId,
      type,
      accountTag: me.billingTag,
      ...(offerToken ? { offerToken } : {}),
      ...(basePlanId ? { basePlanId } : {})
    });
  } catch (e) {
    if (nativeCode(e) === 'canceled') return { status: 'canceled' };
    throw e;
  }
  requireAccount(revision);
  if (bought.productId !== p.productId) throw new ApiError(503, 'invalid_response', 'Google Play returned a different product');
  // Provider-bound pending receipts must reach the server's encrypted recovery before they clear.
  const verified = await verifyWithRetry(bought.productId, bought.purchaseToken, revision);
  if (verified.status === 'pending') schedulePendingReconcile();
  return verified;
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
  if (outcome.pending > 0 || outcome.unconfirmed > 0) schedulePendingReconcile();
  for (const fn of reconcileListeners) {
    try {
      fn(outcome);
    } catch {
      /* ignore listener errors */
    }
  }
  return outcome;
}

let reconcileInFlight: Promise<RestoreOutcome> | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let reconciliationInitialized = false;
const reconcileListeners = new Set<(outcome: RestoreOutcome) => void>();

function schedulePendingReconcile(delayMs = 15_000): void {
  if (pendingTimer || !isNative()) return;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (Services.api.signedIn) void triggerStoreReconciliation();
  }, delayMs);
}

export function triggerStoreReconciliation(): Promise<RestoreOutcome> {
  if (reconcileInFlight) return reconcileInFlight;
  reconcileInFlight = restorePurchases()
    .catch(() => ({ granted: 0, alreadyGranted: 0, pending: 0, notEntitled: 0, unconfirmed: 0 }))
    .finally(() => {
      reconcileInFlight = null;
    });
  return reconcileInFlight;
}

/** Subscribes to automatic purchase reconciliation outcomes (startup, sign-in, app resume, async Play updates). */
export function subscribeStoreReconciliation(listener: (outcome: RestoreOutcome) => void): () => void {
  reconcileListeners.add(listener);
  return () => reconcileListeners.delete(listener);
}

/** Wires automatic startup, resume, and native async Billing purchase reconciliation. */
export function initStoreReconciliation(): void {
  if (reconciliationInitialized) return;
  reconciliationInitialized = true;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Services.api.signedIn) void triggerStoreReconciliation();
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      if (Services.api.signedIn) void triggerStoreReconciliation();
    });
  }
  if (isNative() && typeof Billing.addListener === 'function') {
    void Billing.addListener('purchasesUpdated', () => {
      if (Services.api.signedIn) void triggerStoreReconciliation();
    }).catch(() => {});
  }
  if (Services.api.signedIn) void triggerStoreReconciliation();
}

function readStoredConsent(): ConsentState | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CONSENT_STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (!parsed || typeof parsed.canRequestAds !== 'boolean' || typeof parsed.privacyOptionsRequired !== 'boolean') return null;
    return normalizeConsent(parsed);
  } catch {
    return null;
  }
}

function writeStoredConsent(state: ConsentState): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function normalizeConsent(raw: Partial<ConsentState>, fallback?: ConsentState | null): ConsentState {
  const underAge = Boolean(raw.underAgeOfConsent ?? fallback?.underAgeOfConsent ?? false);
  const status = raw.status ?? (raw.canRequestAds ? 'OBTAINED' : 'REQUIRED');
  const withdrawnOrDenied = status === 'withdrawn' || status === 'denied' || underAge;
  return {
    canRequestAds: withdrawnOrDenied ? false : Boolean(raw.canRequestAds),
    privacyOptionsRequired: Boolean(raw.privacyOptionsRequired ?? true),
    status: underAge && status === 'OBTAINED' ? 'denied' : status,
    underAgeOfConsent: underAge,
    childDirected: false,
    maxAdContentRating: 'T',
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    source: raw.source ?? (isNative() ? 'ump' : 'web')
  };
}

let consent: ConsentState | null = readStoredConsent();
const consentListeners = new Set<(state: ConsentState | null) => void>();

function publishConsent(next: ConsentState | null): ConsentState | null {
  consent = next;
  if (next) writeStoredConsent(next);
  for (const fn of consentListeners) {
    try {
      fn(consent);
    } catch {
      /* ignore */
    }
  }
  return consent;
}

export function subscribeConsent(listener: (state: ConsentState | null) => void): () => void {
  consentListeners.add(listener);
  return () => consentListeners.delete(listener);
}

/** UMP consent first, then the ads SDK; safe to call repeatedly and independent of player sign-in. */
export async function initConsent(options?: { underAgeOfConsent?: boolean }): Promise<ConsentState | null> {
  const cached = readStoredConsent();
  if (!isNative()) {
    const next = normalizeConsent(
      {
        canRequestAds: false,
        privacyOptionsRequired: true,
        status: cached?.status ?? 'NOT_REQUIRED',
        underAgeOfConsent: options?.underAgeOfConsent ?? cached?.underAgeOfConsent ?? false,
        source: 'web'
      },
      cached
    );
    return publishConsent(next);
  }
  try {
    const underAgeOfConsent = options?.underAgeOfConsent ?? cached?.underAgeOfConsent ?? false;
    const raw = await Ads.init({ underAgeOfConsent });
    const PreserveWithdrawn =
      cached?.status === 'withdrawn' && raw.canRequestAds
        ? { ...raw, canRequestAds: false, status: 'withdrawn' as const }
        : raw;
    return publishConsent(normalizeConsent({ ...PreserveWithdrawn, underAgeOfConsent, source: 'ump' }, cached));
  } catch {
    if (cached) return publishConsent(cached);
    return publishConsent(
      normalizeConsent({
        canRequestAds: false,
        privacyOptionsRequired: true,
        status: 'error',
        underAgeOfConsent: options?.underAgeOfConsent ?? false,
        source: 'cached'
      })
    );
  }
}

export const consentState = (): ConsentState | null => consent ?? readStoredConsent();

/** Opens UMP privacy options or updates local consent state login-independently, notifying all active scenes immediately. */
export async function showPrivacyOptions(options?: {
  withdrawConsent?: boolean;
  grantConsent?: boolean;
  underAgeOfConsent?: boolean;
}): Promise<ConsentState | null> {
  const current = consentState();
  const underAge = options?.underAgeOfConsent ?? current?.underAgeOfConsent ?? false;
  if (isNative()) {
    try {
      const raw = await Ads.showPrivacyOptions();
      const status = options?.withdrawConsent
        ? ('withdrawn' as const)
        : options?.grantConsent && !underAge
          ? ('OBTAINED' as const)
          : raw.status ?? (raw.canRequestAds ? 'OBTAINED' : 'denied');
      return publishConsent(
        normalizeConsent(
          {
            ...raw,
            canRequestAds: status === 'withdrawn' || underAge ? false : raw.canRequestAds,
            status,
            underAgeOfConsent: underAge,
            source: 'ump'
          },
          current
        )
      );
    } catch {
      const status = options?.withdrawConsent ? 'withdrawn' : current?.status ?? 'error';
      return publishConsent(
        normalizeConsent(
          {
            ...current,
            canRequestAds: false,
            privacyOptionsRequired: true,
            status,
            underAgeOfConsent: underAge,
            source: 'cached'
          },
          current
        )
      );
    }
  }
  const nextStatus = options?.withdrawConsent
    ? 'withdrawn'
    : options?.grantConsent && !underAge
      ? 'OBTAINED'
      : current?.status === 'OBTAINED' && !underAge
        ? 'withdrawn'
        : underAge
          ? 'denied'
          : 'OBTAINED';
  return publishConsent(
    normalizeConsent(
      {
        canRequestAds: false,
        privacyOptionsRequired: true,
        status: nextStatus,
        underAgeOfConsent: underAge,
        source: 'web'
      },
      current
    )
  );
}

/**
 * One rewarded view: the server issues a one-time nonce, the ad carries it, Google calls the server SSV endpoint,
 * and the client polls `/api/v1/ads/nonces/:nonce` for the exact nonce's server-verified outcome.
 * Wallet growth is never treated as proof of ad verification, and timeouts return `'pending'`, never `'rewarded'`.
 */
export async function watchRewardedAd(options?: {
  pollAttempts?: number;
  pollIntervalMs?: number;
}): Promise<RewardedAdOutcome> {
  if (!isNative()) throw new Error('Rewarded ads run inside the Android app');
  const currentConsent = consentState();
  if (
    currentConsent &&
    (!currentConsent.canRequestAds ||
      currentConsent.status === 'withdrawn' ||
      currentConsent.status === 'denied' ||
      currentConsent.underAgeOfConsent)
  ) {
    return 'no_consent';
  }
  const revision = Services.api.authRevision;
  const me = await Services.api.me();
  requireAccount(revision);
  const { nonce } = await Services.api.adBegin();
  requireAccount(revision);
  let earned: boolean;
  try {
    ({ earned } = await Ads.showRewarded({ userId: me.id, customData: nonce }));
  } catch (e) {
    const c = nativeCode(e);
    return c === 'no_fill' ? 'no_ad' : c === 'no_consent' ? 'no_consent' : 'error';
  }
  if (!earned) return 'closed_early';

  const attempts = options?.pollAttempts ?? 6;
  const intervalMs = options?.pollIntervalMs ?? 1200;
  for (let i = 0; i < attempts; i++) {
    if (intervalMs > 0) await new Promise((r) => setTimeout(r, intervalMs));
    requireAccount(revision);
    try {
      const status = await Services.api.adNonceStatus(nonce, revision);
      if (status.state === 'verified') return 'verified';
      if (status.state === 'test_callback') return 'test_callback';
      if (status.state === 'rejected' || status.state === 'expired' || status.state === 'missing') return 'rejected';
    } catch (error) {
      if (error instanceof ApiError && error.code === 'auth_changed') throw error;
      /* transient poll failure keeps waiting until poll window ends */
    }
  }
  return 'pending';
}
