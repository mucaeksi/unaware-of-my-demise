import { expect, test } from '@playwright/test';
import { SHOTS, openGame, signInDev, waitScene } from './helpers';

// Browser SDK fixture only: no real Play payment, device or provider-verification claim.
test('Shop distinguishes SDK pending receipts from failed server confirmation', async ({ page }, info) => {
  await page.addInitScript(() => {
    (window as any).androidBridge = {};
    (window as any).Capacitor = {
      PluginHeaders: [{ name: 'UomdBilling', methods: [{ name: 'owned', rtype: 'promise' }] }],
      nativePromise: async (plugin: string, method: string) => {
        if (plugin !== 'UomdBilling' || method !== 'owned') throw new Error('Unsupported fixture call');
        return { purchases: [{ productId: 'fixture_pending', purchaseToken: 'sdk-pending-receipt', state: 'pending' },
          { productId: 'fixture_uncertain', purchaseToken: 'sdk-uncertain-receipt', state: 'purchased' }] };
      }
    };
  });
  await openGame(page, '/', { fresh: true }); await signInDev(page, `shop-recovery-${info.project.name}`);
  const submitted: string[] = [];
  await page.route('**/api/v1/shop/verify', async (route) => {
    const { productId } = route.request().postDataJSON(); submitted.push(productId);
    await route.fulfill({ status: productId === 'fixture_pending' ? 200 : 503, contentType: 'application/json',
      body: JSON.stringify(productId === 'fixture_pending' ? { status: 'pending', productId } : { error: 'verification_unavailable', message: 'Confirmation unavailable' }) });
  });
  await page.evaluate(() => {
    const game = (window as any).__UOMD__.game;
    game.scene.getScenes(true).forEach((scene: any) => game.scene.stop(scene.key)); game.scene.start('Shop');
  });
  await waitScene(page, 'Shop');
  const messages = () => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Shop').texts().join(' '));
  await expect.poll(messages).toContain('1 payment(s) pending.');
  await expect.poll(messages).toContain('1 purchase(s) still need confirmation. Reopen Shop to retry.');
  expect(submitted).toEqual(['fixture_pending', 'fixture_uncertain']);
  expect(await messages()).not.toContain('sdk-pending-receipt');
  expect(await messages()).not.toContain('sdk-uncertain-receipt');
  await page.waitForFunction(() => !(window as any).__UOMD__.game.scene.getScene('Shop').fading);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-shop-recovery-fixture.png` });
});
