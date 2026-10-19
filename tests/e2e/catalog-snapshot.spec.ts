import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { CATALOG_PATH, EconomyCatalog } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { ADMIN, GAME, SHOTS } from './helpers';

const run = promisify(execFile);

test('exports a validated catalog after retry, stages it through the CLI and publishes only for compatible clients', async ({ page, request }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  const pointer = await (await request.get(`${GAME}/api/v1/content/channels/dev/manifest`)).json();
  try {
  await page.setExtraHTTPHeaders(headers);
  await page.goto(ADMIN);
  await page.getByRole('button', { name: 'Catalog', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Catalog snapshot for a content draft' })).toBeVisible();
  await page.route('**/admin/api/catalog/snapshot', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'catalog_invalid', message: 'catalog needs operator review' }) }));
  await page.getByRole('button', { name: 'Export catalog snapshot' }).click();
  await expect(page.getByRole('alert')).toContainText('catalog needs operator review');
  await page.unroute('**/admin/api/catalog/snapshot');
  const downloaded = page.waitForEvent('download');
  const retry = page.getByRole('button', { name: 'Retry export' });
  if (info.project.name.startsWith('phone')) await retry.tap(); else await retry.click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('economy.json');
  const bytes = new Uint8Array(readFileSync((await download.path())!));
  const catalog = EconomyCatalog.parse(JSON.parse(new TextDecoder().decode(bytes)));
  expect(catalog.characters).toHaveLength(25); expect(catalog.skills).toHaveLength(100); expect(catalog.gear).toHaveLength(263);
  const hash = await sha256Hex(bytes);
  await expect(page.locator('.catalog-export [role="status"]')).toContainText(hash);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/catalog-${info.project.name}-export.png`, fullPage: true });

  const id = `rel_catalog_${info.project.name.startsWith('phone') ? 'phone' : 'desktop'}`;
  const cli = ['tsx', 'tools/publish_release.ts', '--admin', ADMIN, '--dir', 'content/patches/rel_0003_part1_campaign', '--id', id, '--channel', 'dev', '--depends', pointer.release.id, '--catalog-snapshot'];
  const options = { cwd: new URL('../../', import.meta.url), env: { ...process.env, UOMD_ADMIN_JWT: process.env.E2E_ADMIN_JWT! }, timeout: 90_000 };
  if (process.platform === 'win32') await run(process.execPath, ['node_modules/tsx/dist/cli.mjs', ...cli.slice(1)], options);
  else await run('npx', cli, options);
  const row = await (await request.get(`${ADMIN}/admin/api/releases/${id}`, { headers })).json();
  const manifest = JSON.parse(row.manifest_json);
  expect(row.state).toBe('draft');
  expect(manifest.signature).toBeUndefined();
  expect(manifest.files).toContainEqual(expect.objectContaining({ path: CATALOG_PATH, sha256: hash }));
  expect((await request.get(`${GAME}/api/v1/content/objects/${hash}`)).status()).toBe(404);
  await page.getByRole('button', { name: 'Patches', exact: true }).click();
  const release = page.locator('tbody tr').filter({ has: page.locator('code', { hasText: new RegExp(`^${id}$`) }) });
  await expect(release).toContainText('draft');
  page.on('dialog', (dialog) => dialog.accept());
  const publish = release.getByRole('button', { name: 'Publish', exact: true });
  if (info.project.name.startsWith('phone')) await publish.tap(); else await publish.click();
  await expect(page.getByRole('status')).toContainText('done');
  await expect(release).toContainText('published');
  const published = await (await request.get(`${GAME}/api/v1/content/channels/dev/manifest`)).json();
  expect(published).toMatchObject({ release: { id }, compat: { min_client: '0.1.2', required_capabilities: ['attributes_v1', 'catalog_v1', 'presentation_v1', 'vfx_v1'] }, signature: { alg: 'ES256' } });
  await page.screenshot({ path: `${SHOTS}/catalog-${info.project.name}-staged.png`, fullPage: true });
  expect(errors).toEqual([]);
  } finally { expect((await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { headers, data: { releaseId: pointer.release.id } })).status()).toBe(200); }
});
