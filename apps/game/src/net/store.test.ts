import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ isNative: vi.fn(() => true), purchase: vi.fn(), owned: vi.fn(), init: vi.fn(), showRewarded: vi.fn() }));
vi.mock('../platform/native', () => ({
  isNative: native.isNative,
  nativeCode: (e: unknown) => (typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : 'error'),
  Billing: { purchase: native.purchase, owned: native.owned },
  Ads: { init: native.init, showRewarded: native.showRewarded, showPrivacyOptions: vi.fn() }
}));
const api = vi.hoisted(() => ({ signedIn: true, me: vi.fn(), verifyPurchase: vi.fn(), adBegin: vi.fn(), wallet: vi.fn() }));
vi.mock('../services', () => ({ Services: { api } }));

import { buyProduct, restorePurchases, watchRewardedAd } from './store';

const product = { productId: 'tokens_small', kind: 'consumable' as const, title: 't', grants: [], subscription: null };

beforeEach(() => {
  vi.clearAllMocks();
  native.isNative.mockReturnValue(true);
  api.me.mockResolvedValue({ id: 'p_1', billingTag: 'tag123' });
});

describe('store bridge (the server decides, the device only reports)', () => {
  it('binds a purchase to the account tag and returns the server verdict', async () => {
    native.purchase.mockResolvedValue({ productId: 'tokens_small', purchaseToken: 'tok', state: 'purchased' });
    api.verifyPurchase.mockResolvedValue({ status: 'granted' });
    expect(await buyProduct(product)).toEqual({ status: 'granted' });
    expect(native.purchase).toHaveBeenCalledWith({ productId: 'tokens_small', type: 'inapp', accountTag: 'tag123' });
    expect(api.verifyPurchase).toHaveBeenCalledWith('tokens_small', 'tok');
  });

  it('uses the subscription type for subscriptions, treats a cancel as a cancel and a pending payment as pending', async () => {
    native.purchase.mockRejectedValueOnce({ code: 'canceled' });
    expect(await buyProduct({ ...product, kind: 'subscription' })).toEqual({ status: 'canceled' });
    expect(native.purchase).toHaveBeenCalledWith(expect.objectContaining({ type: 'subs' }));
    native.purchase.mockResolvedValueOnce({ productId: 'x', purchaseToken: 't', state: 'pending' });
    expect(await buyProduct(product)).toEqual({ status: 'pending' });
    expect(api.verifyPurchase).not.toHaveBeenCalled();
  });

  it('refuses to run in a browser', async () => {
    native.isNative.mockReturnValue(false);
    await expect(buyProduct(product)).rejects.toThrow(/Android/);
    expect(await restorePurchases()).toBe(0);
  });

  it('restore re-submits only completed purchases and counts what the server granted', async () => {
    native.owned.mockResolvedValue({ purchases: [{ productId: 'a', purchaseToken: '1', state: 'purchased' }, { productId: 'b', purchaseToken: '2', state: 'pending' }, { productId: 'c', purchaseToken: '3', state: 'purchased' }] });
    api.verifyPurchase.mockResolvedValueOnce({ status: 'granted' }).mockRejectedValueOnce(new Error('not ours'));
    expect(await restorePurchases()).toBe(1);
    expect(api.verifyPurchase).toHaveBeenCalledTimes(2);
  });

  it('a rewarded view passes the player id and the one-time nonce to the ad; the reward is only observed, never granted', async () => {
    api.adBegin.mockResolvedValue({ nonce: 'n0nce' });
    api.wallet.mockResolvedValueOnce({ eclipse_token: 10 }).mockResolvedValue({ eclipse_token: 40 });
    native.showRewarded.mockResolvedValue({ earned: true });
    vi.useFakeTimers();
    const p = watchRewardedAd();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toBe('rewarded');
    vi.useRealTimers();
    expect(native.showRewarded).toHaveBeenCalledWith({ userId: 'p_1', customData: 'n0nce' });
    native.showRewarded.mockResolvedValue({ earned: false });
    expect(await watchRewardedAd()).toBe('closed_early');
    native.showRewarded.mockRejectedValue({ code: 'no_fill' });
    expect(await watchRewardedAd()).toBe('no_ad');
    native.showRewarded.mockRejectedValue({ code: 'no_consent' });
    expect(await watchRewardedAd()).toBe('no_consent');
  });
});
