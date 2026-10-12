import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportPKCS8, generateKeyPair } from 'jose';
import { PlayApi } from '../src/billing/play';
import { baseEnv } from './helpers';

const pair = await generateKeyPair('RS256', { extractable: true });
const privateKey = await exportPKCS8(pair.privateKey);
let seq = 0;
const configured = () => ({ ...baseEnv, PLAY_PACKAGE_NAME: 'app.uomd.test', GOOGLE_PLAY_SERVICE_ACCOUNT: JSON.stringify({ client_email: `play-test-${++seq}@test.iam.gserviceaccount.com`, private_key: privateKey }) });
const oauth = 'https://oauth2.googleapis.com/token';
const api = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/app.uomd.test';
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Android Publisher transport contract (mocked HTTP)', () => {
  it('requires configured credentials even after another environment populated its token cache', async () => {
    const fetcher = vi.fn(async (url: string) => url === oauth ? response({ access_token: 'test-access-token', expires_in: 3600 }) : response({ purchaseState: 0, orderId: 'order-1' }));
    vi.stubGlobal('fetch', fetcher);
    const first = configured();
    await new PlayApi(first).getProduct('pouch', 'purchase-token');
    const calls = fetcher.mock.calls.length;
    await expect(new PlayApi({ ...first, GOOGLE_PLAY_SERVICE_ACCOUNT: '' }).getProduct('pouch', 'purchase-token')).rejects.toMatchObject({ code: 'billing_not_configured' });
    expect(fetcher).toHaveBeenCalledTimes(calls);
  });

  it('does not reuse OAuth credentials across service-account rotation', async () => {
    let count = 0; const bearer: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      if (url === oauth) return response({ access_token: `test-access-${++count}`, expires_in: 3600 });
      bearer.push(new Headers(init.headers).get('Authorization')!);
      return response({ purchaseState: 0, orderId: 'order-rotation' });
    });
    const first = configured(); const second = configured();
    await new PlayApi(first).getProduct('pouch', 'token');
    await new PlayApi(first).getProduct('pouch', 'token');
    await new PlayApi(second).getProduct('pouch', 'token');
    expect(count).toBe(2);
    expect(bearer).toEqual(['Bearer test-access-1', 'Bearer test-access-1', 'Bearer test-access-2']);
  });

  it('uses the selected subscription line and its last successful order', async () => {
    vi.stubGlobal('fetch', async (url: string) => url === oauth ? response({ access_token: 'test-access-token', expires_in: 3600 }) : response({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', latestOrderId: 'pending-root-order', startTime: '2025-01-01T00:00:00Z', lineItems: [{ productId: 'other', latestSuccessfulOrderId: 'other-order', expiryTime: '2026-01-01T00:00:00Z' }, { productId: 'blessing', latestSuccessfulOrderId: 'paid-renewal', expiryTime: '2026-11-12T00:00:00Z' }] }));
    expect(await new PlayApi(configured()).getSubscription('token', 'blessing')).toMatchObject({ state: 'active', productId: 'blessing', latestOrderId: 'paid-renewal', expiryTimeMs: Date.parse('2026-11-12T00:00:00Z') });
    expect(await new PlayApi(configured()).getSubscription('token', 'missing')).toMatchObject({ productId: '' });
  });

  it('reads only required official order fields and encodes the complete order id', async () => {
    let called = '';
    vi.stubGlobal('fetch', async (url: string) => {
      if (url === oauth) return response({ access_token: 'test-access-token', expires_in: 3600 });
      called = url;
      return response({ orderId: 'GPA/order..1', purchaseToken: 'test-token', createTime: '2026-02-28T00:00:00Z', buyerAddress: { address: 'private' }, total: { units: '100' } });
    });
    expect(await new PlayApi(configured()).getOrder('GPA/order..1')).toEqual({ orderId: 'GPA/order..1', purchaseToken: 'test-token', createTimeMs: Date.parse('2026-02-28T00:00:00Z'), fullRefundTimeMs: 0, partialRefund: false });
    expect(called).toBe(`${api}/orders/GPA%2Forder..1`);
  });

  it('applies a deadline to both OAuth and authenticated requests and maps aborts to a safe retryable code', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      if (url === oauth) return response({ access_token: 'test-access-token', expires_in: 3600 });
      throw new DOMException('private URL/token detail', 'AbortError');
    });
    await expect(new PlayApi(configured()).getOrder('order')).rejects.toMatchObject({ status: 503, code: 'billing_unavailable', message: 'Google Play request could not complete; retry later' });
    expect(timeout.mock.calls).toEqual([[8000], [8000]]);
  });

  it('keeps partial refunds distinct from the official full-refund event', async () => {
    let full = false;
    vi.stubGlobal('fetch', async (url: string) => url === oauth ? response({ access_token: 'test-access-token', expires_in: 3600 }) : response({ orderId: 'order', orderHistory: { partialRefundEvents: [{}], ...(full ? { refundEvent: { eventTime: '2026-10-12T00:00:00Z' } } : {}) } }));
    const client = new PlayApi(configured());
    expect(await client.getOrder('order')).toMatchObject({ partialRefund: true, fullRefundTimeMs: 0 });
    full = true;
    expect(await client.getOrder('order')).toMatchObject({ partialRefund: true, fullRefundTimeMs: Date.parse('2026-10-12T00:00:00Z') });
  });

  it.each([{ access_token: 'token', expires_in: -1 }, { expires_in: 3600 }, { access_token: 'token', expires_in: '3600' }])('rejects malformed OAuth token response %j', async (body) => {
    vi.stubGlobal('fetch', async () => response(body));
    await expect(new PlayApi(configured()).getOrder('order')).rejects.toMatchObject({ code: 'billing_invalid_response' });
  });

  it('maps malformed Google JSON and unknown orders without exposing response bodies', async () => {
    let mode = 'broken';
    vi.stubGlobal('fetch', async (url: string) => url === oauth ? response({ access_token: 'test-access-token', expires_in: 3600 }) : mode === 'broken' ? new Response('private invalid payload') : response({ secret: 'must stay hidden' }, 404));
    const client = new PlayApi(configured());
    await expect(client.getOrder('order')).rejects.toMatchObject({ code: 'billing_unavailable' });
    mode = 'not-found';
    await expect(client.getOrder('order')).rejects.toMatchObject({ code: 'unknown_purchase', status: 422 });
  });
});
