import { expect, test, type Page } from '@playwright/test';
import { ADMIN, SHOTS, openGame, signInDev, skipStory, tap, waitScene } from './helpers';
import { publishCampaign, seedLibraryFixture } from './stack';

const goto = (page: Page, key: string) => page.evaluate((key) => {
  const game = (window as any).__UOMD__.game;
  game.scene.getScenes(true).forEach((scene: any) => game.scene.stop(scene.key)); game.scene.start(key);
}, key);
const settled = async (page: Page, key: string) => {
  await expect.poll(() => page.evaluate((key) => !(window as any).__UOMD__.game.scene.getScene(key).fading, key)).toBe(true);
  await page.waitForTimeout(100);
};
const parts = (page: Page) => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Library').cards.filter((card: any) => card.kind === 'companion').map((card: any) => card.entry_id));

test('library: authoritative spoiler/ownership/order gates, canonical readers, lost-save recovery and account changes', async ({ page, request }, info) => {
  test.setTimeout(360_000);
  const id = `rel_library_${info.project.name.replaceAll('-', '_')}`;
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  await publishCampaign(process.env.E2E_ADMIN_JWT!, id);
  const problems: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.location().url} ${message.text()}`); });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  // the reload below cancels whatever was still loading (net::ERR_ABORTED); real failures carry other errors
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') problems.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`); });
  page.on('response', (response) => { if (response.status() >= 400 && !response.url().includes('/api/v1/content/channels/')) problems.push(`HTTP ${response.status()}: ${response.url()}`); });
  try {
    await openGame(page); const actor = await signInDev(page, `library-${info.project.name}`);
    await page.evaluate(async () => { const u = (window as any).__UOMD__; await u.services.content.checkForUpdates(); await u.services.refreshArt(); });
    await goto(page, 'Home'); await waitScene(page, 'Home'); await settled(page, 'Home');
    await tap(page, info, 1590, 1000); await waitScene(page, 'Library');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Library').cards.length)).toBe(3);
    await settled(page, 'Library');
    expect(await page.evaluate(() => JSON.stringify((window as any).__UOMD__.game.scene.getScene('Library').cards))).not.toMatch(/Clockless|cs_kera|event_/);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-library-premises.png` });
    await tap(page, info, 560, 435); await waitScene(page, 'Story');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').bodyText?.text.length ?? 0)).toBeGreaterThan(20);
    await settled(page, 'Story');
    // wait for the reveal instead of tapping it: a tap that lands just after the line finished would end the reading
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').lineDone)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-library-codex.png` });
    await tap(page, info, 220, 210); await waitScene(page, 'Library');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Library').cards.find((card: any) => card.entry_id === 'codex_law_of_hours')?.completed)).toBe(false);
    expect(await page.evaluate(async () => (await (window as any).__UOMD__.services.api.progress()).nodes.some((node: any) => node.node_id === 'codex_law_of_hours'))).toBe(false);
    await settled(page, 'Library'); await tap(page, info, 560, 435); await waitScene(page, 'Story');
    await skipStory(page, info, 'Library');

    // Isolated late-story gate fixture; this is reader/ownership QA, not a campaign balance/playthrough proof.
    await seedLibraryFixture(actor.id); await goto(page, 'Library'); await waitScene(page, 'Library');
    await expect.poll(() => parts(page)).toEqual(['cs_kera_voss_1']); await settled(page, 'Library');
    await tap(page, info, 480, 210); await page.waitForTimeout(100);
    await tap(page, info, 560, 435); await waitScene(page, 'Story'); await skipStory(page, info, 'Library');
    await expect.poll(() => parts(page)).toEqual(['cs_kera_voss_1', 'cs_kera_voss_2']); await settled(page, 'Library');
    let original = ''; let committed = false;
    await page.route('**/api/v1/progress/story', async (route) => {
      const body = route.request().postDataJSON();
      if (body.nodeId !== 'cs_kera_voss_2') { await route.continue(); return; }
      original = body.requestId; expect((await route.fetch()).status()).toBe(200); committed = true; await route.abort('failed');
    });
    await tap(page, info, 1360, 435); await waitScene(page, 'Story');
    for (let i = 0; i < 80 && !committed; i++) { await tap(page, info, 960, 420); await page.waitForTimeout(220); }
    await expect.poll(() => committed).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').texts().includes('RETRY SAVE'))).toBe(true);
    expect(await page.evaluate(() => { const scene = (window as any).__UOMD__.game.scene.getScene('Story'); return scene.saveBar && !scene.saveBar.destroyed && scene.saveBar.zIndex > 1600; })).toBe(true);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-library-save-retry.png` });
    await page.waitForTimeout(100); await tap(page, info, 720, 1000); await waitScene(page, 'Library');
    await page.unroute('**/api/v1/progress/story'); await page.reload();
    await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title') && (window as any).__UOMD__.services.api.signedIn);
    let writes = 0;
    await page.route('**/api/v1/progress/story', async (route) => { writes++; await route.abort('failed'); });
    expect(await page.evaluate(async (requestId) => (window as any).__UOMD__.services.api.retryOperation(requestId), original)).toMatchObject({ requestId: original, nodeId: 'cs_kera_voss_2', completed: true });
    expect(writes).toBe(0); await page.unroute('**/api/v1/progress/story');
    await goto(page, 'Library'); await waitScene(page, 'Library');
    await expect.poll(() => parts(page)).toEqual(['cs_kera_voss_1', 'cs_kera_voss_2', 'cs_kera_voss_3']); await settled(page, 'Library');
    await tap(page, info, 480, 210); await page.waitForTimeout(100);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-library-companion-order.png` });
    await tap(page, info, 560, 670); await waitScene(page, 'Story'); await skipStory(page, info, 'Library');
    await settled(page, 'Library'); await tap(page, info, 1440, 210); await page.waitForTimeout(100);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-library-events.png` });
    await tap(page, info, 560, 435); await waitScene(page, 'Story');
    for (const number of [1, 2, 3]) {
      const sceneId = `event_harvest_inn_meal_${number}`;
      await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').data0?.scene_id)).toBe(sceneId);
      for (let tapCount = 0; tapCount < 60; tapCount++) {
        const changed = await page.evaluate((sceneId) => { const game = (window as any).__UOMD__.game; return !game.scene.isActive('Story') || game.scene.getScene('Story').data0?.scene_id !== sceneId; }, sceneId);
        if (changed) break;
        // the reading may have ended (and its scene closed) since the check above
        if (!await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story')?.finished ?? true)) await tap(page, info, 960, 420);
        await page.waitForTimeout(220);
      }
    }
    await waitScene(page, 'Library');
    const progress = await page.evaluate(async () => (await (window as any).__UOMD__.services.api.progress()).nodes);
    for (const nodeId of ['codex_law_of_hours', 'cs_kera_voss_1', 'cs_kera_voss_2', 'cs_kera_voss_3', 'event_harvest_inn_meal']) expect(progress.find((node: any) => node.node_id === nodeId)).toMatchObject({ stars: 0, clears: 1 });
    await settled(page, 'Library'); await tap(page, info, 480, 210); await page.waitForTimeout(100);
    await tap(page, info, 560, 435); await waitScene(page, 'Story');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Story').data0?.scene_id)).toBe('cs_kera_voss_1');
    await signInDev(page, `library-other-${info.project.name}`); await waitScene(page, 'Library');
    await expect.poll(() => parts(page)).toEqual([]);
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.isActive('Story'))).toBe(false);
    expect(await page.evaluate(async () => (await (window as any).__UOMD__.services.api.operations()).length)).toBe(0);
    expect(problems.filter((problem) => !problem.includes('favicon') && !problem.includes('/api/v1/progress/story'))).toEqual([]);
  } finally {
    expect((await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { headers, data: { releaseId: 'rel_0001' } })).ok()).toBe(true);
  }
});
