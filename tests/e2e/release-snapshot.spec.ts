import { expect, test } from '@playwright/test';
import { ContentManifest } from '@uomd/content-schema';
import { ADMIN, GAME, SHOTS, openGame } from './helpers';

test('composed snapshots survive base-identical reads and reload; admin rollback and kill preserve compatibility', async ({ page, request }, info) => {
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  const current = async () => ContentManifest.parse(await (await request.get(`${GAME}/api/v1/content/channels/dev/manifest`)).json());
  const original = await current();
  const suffix = info.project.name.startsWith('phone') ? 'phone' : 'desktop';
  const first = `rel_snapshot_${suffix}_a`; const second = `rel_snapshot_${suffix}_b`;
  const file = original.files.find((f) => f.path === 'chapters/chapter_index.json')!;
  const problems = await openGame(page);
  try {
    for (const [id, source] of [[first, original.release.id], [second, first]]) {
      const draft = await request.post(`${ADMIN}/admin/api/releases`, { headers, data: { id, channel: 'dev', dependsOn: source, ...(id === first ? { maxClient: '0.9.0' } : {}), files: [{ path: file.path, sha256: file.sha256 }] } });
      expect(draft.status(), await draft.text()).toBe(201);
      expect((await request.post(`${ADMIN}/admin/api/releases/${id}/publish`, { headers, data: {} })).status()).toBe(200);
    }
    const snapshot = await current();
    expect(snapshot.depends_on).toBeUndefined();
    expect(snapshot.files).toEqual(original.files);
    expect(snapshot.compat).toEqual({ min_client: '0.1.2', max_client: '0.9.0', content_schema: 1, required_capabilities: ['attributes_v1', 'presentation_v1', 'vfx_v1'] });
    const apply = () => page.evaluate(async () => (window as any).__UOMD__.services.content.checkForUpdates());
    expect(await apply()).toMatchObject({ status: 'applied', releaseId: second });
    const active = () => page.evaluate(async () => (await (window as any).__UOMD__.services.content.state()).active?.releaseId ?? null);
    await page.evaluate(async () => {
      const ref = await (window as any).__UOMD__.services.content.asset('audio/bgm_ch1_ash_forest_calm.ogg');
      if ((await (await fetch(ref.url)).arrayBuffer()).byteLength < 1000) throw new Error('missing embedded audio');
    });
    expect(await active()).toBe(second);
    await page.reload();
    await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title'));
    expect(await active()).toBe(second);

    const admin = await page.context().newPage();
    await admin.setExtraHTTPHeaders(headers);
    await admin.goto(ADMIN);
    await admin.getByRole('button', { name: 'Patches', exact: true }).click();
    const row = (id: string) => admin.locator('tbody tr').filter({ has: admin.locator('code', { hasText: new RegExp(`^${id}$`) }) });
    await expect(row(second)).toContainText('Client 0.1.2–0.9.0');
    await expect(row(second)).toContainText('Schema 1');
    await expect(row(second).locator('.badge.ok', { hasText: 'current' })).toBeVisible();
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await admin.screenshot({ path: `${SHOTS}/release-${suffix}-snapshot.png`, fullPage: true });
    admin.on('dialog', (dialog) => dialog.accept());
    const rollbackButton = row(first).getByRole('button', { name: 'Roll back here' });
    if (suffix === 'phone') await rollbackButton.tap(); else await rollbackButton.click();
    await expect(admin.getByRole('status')).toContainText('done');
    const rollback = await current();
    expect(rollback.release.generation).toBeGreaterThan(snapshot.release.generation);
    expect(rollback.compat).toEqual(snapshot.compat);
    expect(rollback.depends_on).toBeUndefined();
    expect(await apply()).toMatchObject({ status: 'applied', releaseId: rollback.release.id });
    const killButton = row(rollback.release.id).getByRole('button', { name: 'Kill switch' });
    if (suffix === 'phone') await killButton.tap(); else await killButton.click();
    await expect.poll(async () => (await current()).rollout.kill_switch).toBe(true);
    const killed = await current();
    expect(killed.compat).toEqual(snapshot.compat);
    expect(await apply()).toMatchObject({ status: 'reverted_to_base' });
    expect(await active()).toBeNull();
    await expect(row(killed.release.id).locator('.badge.ok', { hasText: 'current' })).toBeVisible();
    await admin.screenshot({ path: `${SHOTS}/release-${suffix}-kill.png`, fullPage: true });
    await admin.close();
    expect(problems).toEqual([]);
  } finally {
    expect((await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { headers, data: { releaseId: original.release.id } })).status()).toBe(200);
  }
});
