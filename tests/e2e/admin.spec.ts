import { expect, test } from '@playwright/test';
import { ADMIN, GAME, SHOTS } from './helpers';

const jwt = (): string => process.env.E2E_ADMIN_JWT as string;

test.describe.configure({ mode: 'serial' });

test.describe('UOMD Control Center (admin SPA + API, local stack with a test-only Access identity)', () => {
  test('refuses to show anything without a valid Access token', async ({ page }) => {
    await page.goto(ADMIN);
    await expect(page.getByRole('alert')).toContainText(/401|invalid_token|missing_token/);
    expect(await page.getByRole('navigation').textContent()).toContain('not signed in');
  });

  test('dashboard, characters (optimistic edit), assets, patches and audit work against real D1/R2', async ({ page }, info) => {
    await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': jwt() });
    await page.goto(ADMIN);
    await expect(page.getByText('e2e-owner@example.com · owner')).toBeVisible();

    // dashboard: D1 + R2 health and the published channel pointer
    await expect(page.getByText('System health')).toBeVisible();
    await expect(page.getByText('operational')).toBeVisible();
    await expect(page.getByText(/migrations/)).toBeVisible();
    await expect(page.getByRole('cell', { name: 'dev', exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/admin-${info.project.name}-dashboard.png`, fullPage: true });

    // characters: 20 rows seeded from the narrative runtime data; edit one
    await page.getByRole('button', { name: 'Characters' }).click();
    await expect(page.getByRole('row')).toHaveCount(21);
    const fadyme = page.getByRole('row').filter({ hasText: 'fadyme' });
    const version = async (): Promise<number> => Number(await fadyme.locator('td').nth(10).textContent());
    const before = await version();
    await page.getByRole('button', { name: 'Edit Fadyme' }).click();
    await page.getByLabel('HP').fill('12');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('Fadyme saved');
    await expect(fadyme.locator('td').nth(5)).toHaveText('12');
    expect(await version()).toBe(before + 1); // optimistic-concurrency version bumped
    // restore the seed value so later runs start clean
    await page.getByRole('button', { name: 'Edit Fadyme' }).click();
    await page.getByLabel('HP').fill('11');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('Fadyme saved');
    await expect(fadyme.locator('td').nth(5)).toHaveText('11');

    // assets: register an asset with provenance
    await page.getByRole('button', { name: 'Assets' }).click();
    const probe = `art/e2e_probe_${info.project.name}.webp`;
    await page.getByLabel('Path').fill(probe);
    await page.getByLabel('SHA-256').fill('b'.repeat(64));
    await page.getByLabel('Bytes').fill('2048');
    await page.getByLabel('Kind').fill('atlas_image');
    await page.getByLabel('Source / provenance').fill('e2e: synthetic probe');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByRole('status')).toContainText('Asset registered');
    await expect(page.getByRole('cell', { name: new RegExp(probe.replace(/[./]/g, '\\$&')) })).toBeVisible();

    // patches: the base release is listed; exactly one release per channel is "current" (the live-patch test
    // may already have published rel_0002 on this shared stack, so this must not depend on test order)
    await page.getByRole('button', { name: 'Patches' }).click();
    await expect(page.locator('tbody tr', { has: page.locator('code', { hasText: /^rel_0001$/ }) })).toHaveCount(1);
    await expect(page.locator('tbody .badge.ok', { hasText: 'current' })).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS}/admin-${info.project.name}-patches.png`, fullPage: true });

    // audit: the edits above are recorded, append-only
    await page.getByRole('button', { name: 'Audit' }).click();
    await expect(page.getByRole('cell', { name: 'character.update' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'release.publish' }).first()).toBeVisible();
  });
  test('monitoring follows real callbacks, polls automatically and marks failed refreshes', async ({ page }, info) => {
    await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': jwt() });
    await page.clock.install();
    await page.goto(ADMIN);
    await expect(page.getByText('e2e-owner@example.com · owner')).toBeVisible();
    await page.getByRole('button', { name: 'Monitoring', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Economy flow / 24h' })).toBeVisible();
    await expect(page.getByText('Observed deployment versions', { exact: true })).toBeVisible();
    const before = await page.locator('time').getAttribute('datetime');
    await page.request.get(`${GAME}/api/v1/ads/ssv?private=PRIVATE_SIGNATURE`);
    const refreshed = page.waitForResponse((r) => r.url().includes('/admin/api/monitoring') && r.status() === 200);
    await page.clock.fastForward(30_000);
    await refreshed;
    await expect(page.getByRole('cell', { name: 'ssv_rejected' }).first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText('PRIVATE_SIGNATURE');
    // The server timestamp comes from actual D1 reads, rather than the browser clock.
    await expect(page.locator('time')).not.toHaveAttribute('datetime', before ?? '');
    await page.getByLabel('Event category').selectOption('ads');
    await expect(page.getByRole('cell', { name: 'missing signature' }).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/admin-${info.project.name}-monitoring.png`, fullPage: true });
    await page.route('**/admin/api/monitoring?*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable', message: 'test unavailable' }) }));
    const failed = page.waitForResponse((r) => r.url().includes('/admin/api/monitoring') && r.status() === 503);
    await page.clock.fastForward(30_000);
    await failed;
    await expect(page.getByText('Refresh failed. The values below are from the last successful update.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Economy flow / 24h' })).toBeVisible();
  });

});
