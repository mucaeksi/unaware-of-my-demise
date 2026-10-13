import { expect, test, type Page } from '@playwright/test';
import { ADMIN, SHOTS, openGame, signInDev, tap, waitScene } from './helpers';

const labels = (page: Page, key: string): Promise<string[]> => page.evaluate((scene) => {
  const body = (window as any).__UOMD__.game.scene.getScene(scene).body;
  return (body?.list ?? []).flatMap((object: any) => [object.text, ...(object.list ?? []).map((child: any) => child.text)]).filter(Boolean);
}, key);
const go = (page: Page, key: string) => page.evaluate((scene) => {
  const game = (window as any).__UOMD__.game; game.scene.getScenes(true).forEach((active: any) => game.scene.stop(active.sys.settings.key)); game.scene.start(scene);
}, key);
async function visible(page: Page, scene: string): Promise<void> {
  await waitScene(page, scene);
  await page.waitForFunction((key) => !(window as any).__UOMD__.game.scene.getScene(key).cameras.main.fadeEffect.isRunning, scene);
}
async function readyTap(page: Page, info: Parameters<typeof tap>[1], x: number, y: number): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => (window as any).__UOMD__.game.events.once('postrender', () => resolve())));
  await tap(page, info, x, y);
}

test('saved actions show an offline pending result, recover through the UI and isolate a new account', async ({ page, request, context }, info) => {
  await openGame(page, '/', { fresh: true }); const player = await signInDev(page, `ui-recovery-${info.project.name}`);
  const adjustment = await request.post(`${ADMIN}/admin/api/players/${player.id}/adjust`, {
    data: { currency: 'eclipse_token', delta: 320, reason: 'isolated UI recovery fixture', requestId: `ui_recovery_${info.project.name}` },
    headers: { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! }
  });
  expect(adjustment.status()).toBe(200);
  let originalId = '';
  await page.route('**/api/v1/gacha/pull', async (route) => {
    originalId = route.request().postDataJSON().requestId;
    const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort('failed');
  });
  expect(await page.evaluate(async () => {
    const api = (window as any).__UOMD__.services.api; const banner = (await api.banners()).find((value: any) => value.kind === 'character');
    try { await api.pull(banner.id, 1); return false; } catch { return true; }
  })).toBe(true);
  await page.unroute('**/api/v1/gacha/pull');
  await context.setOffline(true);
  await go(page, 'Operations'); await visible(page, 'Operations');
  await expect.poll(() => labels(page, 'Operations')).toContain('PENDING (1)');
  expect((await labels(page, 'Operations')).join(' ')).toContain('Waiting for confirmation');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-actions-pending.png` });
  await context.setOffline(false);
  let retryPosts = 0;
  await page.route('**/api/v1/gacha/pull', async (route) => { retryPosts++; await route.abort('failed'); });
  await readyTap(page, info, 1660, 380);
  await expect.poll(() => labels(page, 'Operations')).toContain('No actions are waiting for confirmation.');
  expect(retryPosts).toBe(0);
  const records = await page.evaluate(async () => (window as any).__UOMD__.services.api.operations());
  expect(records.find((record: any) => record.id === originalId).state).toBe('confirmed');
  await readyTap(page, info, 1270, 270);
  await expect.poll(() => labels(page, 'Operations')).toContain('Wish ×1');
  expect((await labels(page, 'Operations')).join(' ')).toContain('Last known: confirmed');
  await page.waitForFunction(() => !(window as any).__UOMD__.game.scene.getScene('Operations').children.list.some((object: any) =>
    (object.list ?? []).some((child: any) => typeof child.text === 'string' && child.text.startsWith('Result confirmed.'))));
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-actions-confirmed.png` });
  const next = await signInDev(page, `ui-other-${info.project.name}`); expect(next.id).not.toBe(player.id);
  await expect.poll(() => labels(page, 'Operations')).toContain('No saved results yet.');
  expect((await labels(page, 'Operations')).join(' ')).not.toContain('Wish ×1');
});

test('account deletion confirmation belongs to the displayed player', async ({ page }, info) => {
  await openGame(page, '/', { fresh: true }); await signInDev(page, `delete-first-${info.project.name}`);
  await go(page, 'Account'); await visible(page, 'Account');
  await expect.poll(() => labels(page, 'Account')).toContain('DELETE ACCOUNT');
  await readyTap(page, info, 960, 880);
  await expect.poll(() => labels(page, 'Account')).toContain('TAP AGAIN TO DELETE FOREVER');
  // Keep the expiry timer still so account-switch invalidation, rather than elapsed time, is proved.
  await page.evaluate(() => { (window as any).__UOMD__.game.scene.getScene('Account').time.paused = true; });
  const selected = await signInDev(page, `delete-selected-${info.project.name}`);
  await expect.poll(() => labels(page, 'Account')).toContain('DELETE ACCOUNT');
  expect((await labels(page, 'Account')).join(' ')).not.toContain('TAP AGAIN TO DELETE FOREVER');
  await signInDev(page, `delete-first-${info.project.name}`);
  await expect.poll(() => labels(page, 'Account')).toContain('DELETE ACCOUNT');
  expect((await labels(page, 'Account')).join(' ')).not.toContain('TAP AGAIN TO DELETE FOREVER');
  await signInDev(page, `delete-selected-${info.project.name}`);
  await expect.poll(() => labels(page, 'Account')).toContain('DELETE ACCOUNT');
  await readyTap(page, info, 960, 880);
  await expect.poll(() => labels(page, 'Account')).toContain('TAP AGAIN TO DELETE FOREVER');
  expect(await page.evaluate(async () => (window as any).__UOMD__.services.api.me())).toMatchObject({ id: selected.id });
  await go(page, 'Home'); await visible(page, 'Home');
  await go(page, 'Account'); await visible(page, 'Account');
  await expect.poll(() => labels(page, 'Account')).toContain('DELETE ACCOUNT');
  expect((await labels(page, 'Account')).join(' ')).not.toContain('TAP AGAIN TO DELETE FOREVER');
});
