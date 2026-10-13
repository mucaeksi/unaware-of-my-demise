import { expect, test, type Page } from '@playwright/test';
import { SHOTS, openGame, signInDev, tap, waitScene } from './helpers';

const go = (page: Page, key: string) => page.evaluate((target) => {
  const game = (window as any).__UOMD__.game; game.scene.getScenes(true).forEach((scene: any) => game.scene.stop(scene.sys.settings.key)); game.scene.start(target);
}, key);
const labels = (page: Page, key: string) => page.evaluate((scene) => ((window as any).__UOMD__.game.scene.getScene(scene).body?.list ?? []).flatMap((object: any) =>
  [object.text, ...(object.list ?? []).map((child: any) => child.text)]).filter(Boolean).join(' '), key);

// Response fixtures exercise rendering/reload; real D1 delivery/ownership is tested in purchase-history.test.ts.
test('purchase history distinguishes delivery/refund/review, reloads without payment and clears on account change', async ({ page }, info) => {
  await openGame(page, '/', { fresh: true }); await signInDev(page, `history-ui-${info.project.name}`);
  const common = { productId: 'fixture_blessing', title: 'Recorded blessing', kind: 'subscription', recordedAt: '2026-10-13T10:00:00Z',
    acknowledged: true, refundedAt: null, providerState: 'on_hold', providerCheckedAt: '2026-10-13T10:00:00Z', recoveryState: null };
  let records = [
    { ...common, recordKey: 'order:first', orderId: 'GPA.fixture.first', deliveryState: 'granted' },
    { ...common, recordKey: 'order:refund', orderId: 'GPA.fixture.refund', deliveryState: 'refunded', refundedAt: '2026-10-13T10:05:00Z' },
    { ...common, recordKey: 'pending:review', orderId: null, acknowledged: null, deliveryState: 'unconfirmed', providerState: null, recoveryState: 'review' }
  ];
  let paymentPosts = 0; page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/shop/verify')) paymentPosts++; });
  await page.route('**/api/v1/shop/history', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records, truncated: false }) }));
  await go(page, 'Account'); await waitScene(page, 'Account');
  await expect.poll(() => labels(page, 'Account')).toContain('PURCHASES');
  await page.evaluate(() => new Promise<void>((resolve) => (window as any).__UOMD__.game.events.once('postrender', () => resolve())));
  await tap(page, info, 300, 195); await waitScene(page, 'Purchases');
  await expect.poll(() => labels(page, 'Purchases')).toContain('Delivery recorded · Last observed: on_hold');
  expect(await labels(page, 'Purchases')).toContain('Refund recorded');
  expect(await labels(page, 'Purchases')).toContain('Needs payment review');
  await page.waitForFunction(() => !(window as any).__UOMD__.game.scene.getScene('Purchases').cameras.main.fadeEffect.isRunning);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-purchase-history-fixture.png` });
  await page.reload(); await waitScene(page, 'Title'); await go(page, 'Purchases');
  await expect.poll(() => labels(page, 'Purchases')).toContain('Delivery recorded');
  expect(paymentPosts).toBe(0);
  records = []; await signInDev(page, `history-other-${info.project.name}`);
  await expect.poll(() => labels(page, 'Purchases')).toContain('No server purchase records yet.');
  expect(await labels(page, 'Purchases')).not.toContain('Recorded blessing');
});
