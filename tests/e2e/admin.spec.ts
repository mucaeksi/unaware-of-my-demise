import { expect, test } from '@playwright/test';
import { ChapterIndex, Encounter, UnitPack } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { ADMIN, GAME, SHOTS } from './helpers';

const jwt = (): string => process.env.E2E_ADMIN_JWT as string;

test.describe.configure({ mode: 'serial' });

test.describe('UOMD Control Center (admin SPA + API, local stack with a test-only Access identity)', () => {
  test('rejects invalid formations and conditional references without replacing the current release', async ({ page, request }, info) => {
    const headers = { 'Cf-Access-Jwt-Assertion': jwt() };
    const manifest = await (await request.get(`${GAME}/api/v1/content/channels/dev/manifest`)).json();
    const encounter = Encounter.parse(await (await request.get(`${GAME}/content/base/encounters/tutorial_t3.json`)).json());
    const pack = UnitPack.parse(await (await request.get(`${GAME}/content/base/units/unit_pack.json`)).json());
    for (const kind of ['slot', 'kind', 'condition'] as const) {
      const path = kind === 'condition' ? 'units/unit_pack.json' : 'encounters/tutorial_t3.json';
      const value = kind === 'condition' ? structuredClone(pack) : structuredClone(encounter);
      if ('units' in value) value.units[0]!.skills[0]!.effect_ops[0]!.when = { predicate: 'owner_has_status', value: 'missing_status' };
      else if (kind === 'slot') value.enemies[1]!.slot = value.enemies[0]!.slot;
      else value.enemies[0]!.unit_id = 'mahmut';
      const bytes = new TextEncoder().encode(JSON.stringify(value)); const sha256 = await sha256Hex(bytes);
      expect((await request.put(`${ADMIN}/admin/api/objects/${sha256}`, { headers: { ...headers, 'Content-Type': 'application/json' }, data: Buffer.from(bytes) })).ok()).toBe(true);
      const id = `rel_bad_${kind}_${info.project.name.replaceAll('-', '_')}`;
      const draft = await request.post(`${ADMIN}/admin/api/releases`, { headers, data: { id, channel: 'dev', dependsOn: 'rel_0001', files: [{ path, sha256 }] } });
      expect(draft.status()).toBe(422);
      expect(await draft.text()).toContain(kind === 'condition' ? 'unknown status missing_status' : kind === 'slot' ? 'duplicate slot' : 'must be an enemy');
      const releases = await (await request.get(`${ADMIN}/admin/api/releases`, { headers })).json();
      expect(JSON.stringify(releases)).not.toContain(id);
      expect(await (await request.get(`${GAME}/api/v1/content/channels/dev/manifest`)).json()).toEqual(manifest);
    }
    await page.setExtraHTTPHeaders(headers);
    await page.goto(ADMIN);
    await expect(page.getByText('e2e-owner@example.com · owner')).toBeVisible();
    await page.getByRole('button', { name: 'Patches' }).click();
    await expect(page.locator('tbody .badge.ok', { hasText: 'current' })).toHaveCount(1);
    await expect(page.locator('tbody')).not.toContainText('rel_bad_');
    await page.screenshot({ path: `${SHOTS}/admin-${info.project.name}-formation-rejection.png`, fullPage: true });
  });

  test('rejects duplicate and cyclic chapter drafts while the current release remains usable', async ({ page, request }, info) => {
    const headers = { 'Cf-Access-Jwt-Assertion': jwt() };
    const manifest = await (await request.get(`${GAME}/api/v1/content/channels/dev/manifest`)).json();
    const source = ChapterIndex.parse(await (await request.get(`${GAME}/content/base/chapters/chapter_index.json`)).json());
    for (const kind of ['duplicate', 'cycle'] as const) {
      const index = structuredClone(source);
      const first = index.chapters[0]!.nodes[0]!;
      const second = index.chapters[0]!.nodes[1]!;
      if (kind === 'duplicate') index.chapters.push({ chapter_id: 'duplicate_node_chapter', title_en: 'Duplicate fixture', nodes: [structuredClone(first)] });
      else { first.requires = second.node_id; second.requires = first.node_id; }
      const bytes = new TextEncoder().encode(JSON.stringify(index));
      const sha256 = await sha256Hex(bytes);
      const uploaded = await request.put(`${ADMIN}/admin/api/objects/${sha256}`, { headers: { ...headers, 'Content-Type': 'application/json' }, data: Buffer.from(bytes) });
      expect(uploaded.ok()).toBe(true);
      const id = `rel_bad_${kind}_${info.project.name.replaceAll('-', '_')}`;
      const draft = await request.post(`${ADMIN}/admin/api/releases`, { headers, data: { id, channel: 'dev', dependsOn: 'rel_0001', files: [{ path: 'chapters/chapter_index.json', sha256 }] } });
      expect(draft.status()).toBe(422);
      expect(await draft.text()).toContain(kind === 'duplicate' ? 'duplicate node' : 'prerequisite cycle');
      const releases = await (await request.get(`${ADMIN}/admin/api/releases`, { headers })).json();
      expect(JSON.stringify(releases)).not.toContain(id);
      expect(await (await request.get(`${GAME}/api/v1/content/channels/dev/manifest`)).json()).toEqual(manifest);
    }
    await page.setExtraHTTPHeaders(headers);
    await page.goto(ADMIN);
    await expect(page.getByText('e2e-owner@example.com · owner')).toBeVisible();
    await page.getByRole('button', { name: 'Patches' }).click();
    await expect(page.locator('tbody .badge.ok', { hasText: 'current' })).toHaveCount(1);
    await expect(page.locator('tbody')).not.toContainText('rel_bad_');
    await page.screenshot({ path: `${SHOTS}/admin-${info.project.name}-graph-rejection.png`, fullPage: true });
  });

  test('refuses to show any data page without a valid Access token', async ({ page }) => {
    // without a token only the local Animations studio opens; every data page shows the API's refusal
    await page.goto(`${ADMIN}?page=Dashboard`);
    await expect(page.getByRole('alert')).toContainText(/401|invalid_token|missing_token/);
    expect(await page.getByRole('navigation').textContent()).toContain('local studio mode');
  });

  test('dashboard, characters (optimistic edit), assets, patches and audit work against real D1/R2', async ({ page }, info) => {
    await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': jwt() });
    await page.goto(`${ADMIN}?page=Dashboard`); // the Control Center opens on the Animations studio by default
    await expect(page.getByText('e2e-owner@example.com · owner')).toBeVisible();

    // dashboard: D1 + R2 health and the published channel pointer
    await expect(page.getByText('System health')).toBeVisible();
    await expect(page.getByText('operational')).toBeVisible();
    await expect(page.getByText(/migrations/)).toBeVisible();
    await expect(page.getByRole('cell', { name: 'dev', exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/admin-${info.project.name}-dashboard.png`, fullPage: true });

    // characters: 25 rows seeded from the narrative runtime data; edit one
    await page.getByRole('button', { name: 'Characters' }).click();
    await expect(page.getByRole('row')).toHaveCount(26);
    const fadyme = page.getByRole('row').filter({ hasText: 'fadyme' });
    // columns: id, name, ★, element, role, power, STR, INT, VIT, AGI, status, version
    const version = async (): Promise<number> => Number(await fadyme.locator('td').nth(11).textContent());
    const before = await version();
    await page.getByRole('button', { name: 'Edit Fadyme' }).click();
    await page.getByLabel('VIT', { exact: true }).fill('12');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('Fadyme saved');
    await expect(fadyme.locator('td').nth(8)).toHaveText('12');
    expect(await version()).toBe(before + 1); // optimistic-concurrency version bumped
    // restore the seed value so later runs start clean
    await page.getByRole('button', { name: 'Edit Fadyme' }).click();
    await page.getByLabel('VIT', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('Fadyme saved');
    await expect(fadyme.locator('td').nth(8)).toHaveText('3');

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
    // may already have published rel_0003 on this shared stack, so this must not depend on test order)
    await page.getByRole('button', { name: 'Patches' }).click();
    await expect(page.locator('tbody tr', { has: page.locator('code', { hasText: /^rel_0001$/ }) })).toHaveCount(1);
    await expect(page.locator('tbody .badge.ok', { hasText: 'current' })).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS}/admin-${info.project.name}-patches.png`, fullPage: true });

    // audit: the edits above are recorded, append-only
    await page.getByRole('button', { name: 'Audit' }).click();
    await expect(page.getByRole('cell', { name: 'character.update' }).first()).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: probe }).getByRole('cell', { name: 'asset.upsert', exact: true })).toBeVisible();
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
