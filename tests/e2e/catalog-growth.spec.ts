import { expect, test } from '@playwright/test';
import { ADMIN, SHOTS, openGame, signInDev, tap, waitScene } from './helpers';

test('character growth pins the selected release and recovers a committed response after reload', async ({ page, request }, info) => {
  const problems: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.location().url} ${message.text()}`); });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (response.status() >= 400 && !response.url().includes('/api/v1/content/channels/')) problems.push(`HTTP ${response.status()}: ${response.url()}`); });
  await openGame(page);
  const player = await signInDev(page, `catalog-growth-${info.project.name}`);
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  // Growth is capped by account level; this isolated fixture grants the existing account XP as well as materials.
  const mail = await request.post(`${ADMIN}/admin/api/players/${player.id}/mail`, { headers, data: { reason: 'local selected-catalog growth fixture', mail: { kind: 'reward', title: 'Growth fixture', attachments: [{ type: 'item', itemId: 'bound_chronicle', quantity: 1 }, { type: 'currency', currency: 'eclipse_token', amount: 320 }, { type: 'account_xp', amount: 2000 }] } } });
  expect(mail.ok()).toBe(true); const sent = await mail.json();
  await page.evaluate(async (id) => (window as any).__UOMD__.services.api.claimMail(id), sent.id);
  const release = await page.evaluate(async () => (window as any).__UOMD__.services.content.activeReleaseId());
  const scopedReads: string[] = [];
  page.on('request', (req) => { if (req.method() === 'GET' && /\/api\/v1\/(catalog|characters(?:\/mine|\/mahmut\/stats)?)\?/.test(req.url())) scopedReads.push(req.url()); });
  await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Title').scene.start('Character', { id: 'mahmut' }));
  await waitScene(page, 'Character');
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Character').body.list.some((object: any) => object.text?.startsWith('Level 1 /')))).toBe(true);
  expect(scopedReads).toHaveLength(4); expect(scopedReads.every((url) => new URL(url).searchParams.get('releaseId') === release)).toBe(true);
  let original = ''; let committed = false;
  await page.route('**/api/v1/characters/mahmut/level-up', async (route) => {
    const input = route.request().postDataJSON(); original = input.requestId; expect(input.releaseId).toBe(release);
    const response = await route.fetch(); expect(response.status()).toBe(200); expect(await response.json()).toMatchObject({ releaseId: release, character: 'mahmut', level: 3 });
    committed = true; await route.abort('failed');
  });
  await page.waitForTimeout(500); await tap(page, info, 340, 600);
  await expect.poll(() => committed).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await (window as any).__UOMD__.services.api.operations()).find((o: any) => o.path.endsWith('/characters/mahmut/level-up'))?.state)).toBe('pending');
  await page.unroute('**/api/v1/characters/mahmut/level-up'); await page.reload();
  await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title') && (window as any).__UOMD__.services.api.signedIn);
  let posts = 0;
  await page.route('**/api/v1/characters/mahmut/level-up', async (route) => { posts++; await route.abort('failed'); });
  const recovered = await page.evaluate(async (id) => (window as any).__UOMD__.services.api.retryOperation(id), original);
  expect(recovered).toMatchObject({ releaseId: release, character: 'mahmut', level: 3 }); expect(posts).toBe(0);
  await page.unroute('**/api/v1/characters/mahmut/level-up');
  await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Title').scene.start('Character', { id: 'mahmut' }));
  await waitScene(page, 'Character');
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Character').body.list.some((object: any) => object.text?.startsWith('Level 3 /')))).toBe(true);
  await page.waitForTimeout(500); await page.screenshot({ path: `${SHOTS}/${info.project.name}-catalog-growth-recovered.png` });
  expect(await page.evaluate(async () => (await (window as any).__UOMD__.services.api.stacks()).find((s: any) => s.item_id === 'bound_chronicle')?.qty ?? 0)).toBe(0);
  expect(problems.filter((problem) => !problem.includes('favicon') && !problem.includes('/api/v1/characters/mahmut/level-up'))).toEqual([]);
});
