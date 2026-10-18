import { expect, test, type Page } from '@playwright/test';
import { ADMIN, SHOTS, openGame, signInDev, skipStory, tap, waitScene } from './helpers';
import { publishCampaign } from './stack';

const goto = (page: Page, key: string) => page.evaluate((key) => {
  const game = (window as any).__UOMD__.game;
  game.scene.getScenes(true).forEach((scene: any) => game.scene.stop(scene.key)); game.scene.start(key);
}, key);
const play = (page: Page, nodeId: string) => page.evaluate(async (nodeId) => {
  const u = (window as any).__UOMD__; const index = await u.services.content.chapters();
  await u.playNode(u.game.scene.getScene('Chapters'), index.chapters.flatMap((chapter: any) => chapter.nodes).find((node: any) => node.node_id === nodeId));
}, nodeId);
const settledRecruit = async (page: Page) => {
  await expect.poll(() => page.evaluate(() => !(window as any).__UOMD__.game.scene.getScene('Recruit').fading)).toBe(true);
  await page.waitForTimeout(100); // allow the next input pre-update to register newly drawn buttons
};

test('First Oath: an earned seven-choice invitation survives response loss/reload and completes chapter one without wishes or ads', async ({ page, request }, info) => {
  test.setTimeout(720_000);
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  const id = `rel_oath_${info.project.name.replaceAll('-', '_')}`;
  await publishCampaign(process.env.E2E_ADMIN_JWT!, id);
  let wishes = 0; let ads = 0;
  const problems: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.location().url} ${message.text()}`); });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.stack ?? error.message}`));
  page.on('requestfailed', (request) => problems.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (response.status() >= 400 && !response.url().includes('/api/v1/content/channels/')) problems.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/gacha/pull')) wishes++; if (request.url().includes('/ads/begin')) ads++; });
  try {
    await openGame(page); await signInDev(page, `first-oath-${info.project.name}`);
    await page.evaluate(async () => { const u = (window as any).__UOMD__; await u.services.content.checkForUpdates(); await u.services.refreshArt(); });
    await goto(page, 'Chapters'); await waitScene(page, 'Chapters');
    await play(page, 'opening_sad_scene'); await waitScene(page, 'Story'); await skipStory(page, info, 'Chapters');
    const claimed = (nodeId: string) => page.evaluate(async (nodeId) => (await (window as any).__UOMD__.services.api.progress()).nodes.some((node: any) => node.node_id === nodeId && node.stars > 0), nodeId);
    const battle = async (nodeId: string, manual: boolean) => {
      await play(page, nodeId); await waitScene(page, 'Story'); await skipStory(page, info, 'Battle');
      await expect.poll(() => page.evaluate(() => Boolean((window as any).__UOMD__.game.scene.getScene('Battle').battle))).toBe(true);
      await tap(page, info, 1770, 70); await tap(page, info, 1770, 70); // presentation x3
      const deadline = Date.now() + 180_000;
      let done = false;
      while (!done && Date.now() < deadline) {
        done = await page.evaluate((manual) => {
          const scene = (window as any).__UOMD__.game.scene.getScene('Battle'); const battle = scene.battle;
          if (battle.result) return true;
          if (!scene.pendingResolve) return false;
          let action = battle.autoAction();
          if (manual) {
            const options = battle.prompt().options.filter((option: any) => option.available);
            const option = options.find((option: any) => option.type === 'ultimate') ?? options.find((option: any) => option.type === 'active') ?? options[0];
            const target = [...option.legalTargets].sort((a, b) => battle.unit(a).hp / battle.unit(a).maxHp - battle.unit(b).hp / battle.unit(b).maxHp)[0];
            action = { skillId: option.skillId, ...(option.needsTarget ? { targetId: target } : {}) };
          }
          scene.pendingResolve(action); return false;
        }, manual);
        if (!done) await page.waitForTimeout(100);
      }
      expect(done, nodeId).toBe(true);
      expect(await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Battle').battle.result.winner), nodeId).toBe('player');
      await expect.poll(() => claimed(nodeId), { timeout: 45_000 }).toBe(true);
      await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Battle').texts().includes('CONTINUE'))).toBe(true);
      await tap(page, info, 1170 - 230, 760); await waitScene(page, 'Story'); await skipStory(page, info, 'Chapters');
    };
    await battle('stage_1_1', false); await battle('stage_1_2', false);
    expect(await page.evaluate(async () => (await (window as any).__UOMD__.services.api.inventory()).some((item: any) => item.item_id === 'brin_alder'))).toBe(true);
    await play(page, 'ch1_first_oath'); await waitScene(page, 'Story'); await skipStory(page, info, 'Recruit');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Recruit').selectors[0]?.choices.length)).toBe(7);
    await settledRecruit(page);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-first-oath-choices.png` });
    await tap(page, info, 755, 575); // Iona Mist, canonical choice six
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Recruit').selected?.choice.id)).toBe('iona_mist');
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-first-oath-confirm.png` });
    let original = ''; let committed = false;
    await page.route('**/api/v1/recruitment/first_oath_invitation', async (route) => {
      original = route.request().postDataJSON().requestId;
      expect((await route.fetch()).status()).toBe(200); committed = true; await route.abort('failed');
    });
    await tap(page, info, 960, 680); await expect.poll(() => committed).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Recruit').texts().includes('CONFIRM SAVE'))).toBe(true);
    await page.unroute('**/api/v1/recruitment/first_oath_invitation'); await page.reload();
    await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title') && (window as any).__UOMD__.services.api.signedIn);
    await goto(page, 'Roster'); await waitScene(page, 'Roster'); await page.waitForTimeout(500);
    await tap(page, info, 1620, 170); await waitScene(page, 'Recruit');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Recruit').pendingId)).toBe(original);
    await settledRecruit(page);
    let posts = 0;
    await page.route('**/api/v1/recruitment/first_oath_invitation', async (route) => { posts++; await route.abort('failed'); });
    await tap(page, info, 960, 570);
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Recruit').texts().includes('1 invitation used. Your company is saved.'))).toBe(true);
    expect(posts).toBe(0); await page.unroute('**/api/v1/recruitment/first_oath_invitation');
    await settledRecruit(page);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-first-oath-recovered.png` });
    const owned = await page.evaluate(async () => (await (window as any).__UOMD__.services.api.inventory()).find((item: any) => item.item_id === 'iona_mist'));
    expect(owned).toMatchObject({ copies: 1, shards: 0 });
    await tap(page, info, 960, 660); await waitScene(page, 'Roster');
    await goto(page, 'Chapters'); await waitScene(page, 'Chapters');
    await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.isActive('Roster'))).toBe(false);
    await battle('stage_1_3', true); await battle('stage_1_4', true); await battle('stage_1_5', true);
    await play(page, 'ch1_camp'); await waitScene(page, 'Story'); await skipStory(page, info, 'Chapters');
    const progress = await page.evaluate(async () => (await (window as any).__UOMD__.services.api.progress()).nodes);
    for (const nodeId of ['opening_sad_scene', 'stage_1_1', 'stage_1_2', 'ch1_first_oath', 'stage_1_3', 'stage_1_4', 'stage_1_5', 'ch1_camp']) expect(progress.some((node: any) => node.node_id === nodeId && node.clears === 1)).toBe(true);
    expect(await page.evaluate(async () => (await (window as any).__UOMD__.services.api.inventory()).filter((item: any) => item.item_type === 'character').map((item: any) => item.item_id).sort())).toEqual(['brin_alder', 'fadyme', 'iona_mist', 'mahmut', 'nixie_vale']);
    expect(wishes).toBe(0); expect(ads).toBe(0);
    await goto(page, 'Recruit'); await waitScene(page, 'Recruit');
    await signInDev(page, `first-oath-new-account-${info.project.name}`);
    await expect.poll(() => page.evaluate(() => {
      const scene = (window as any).__UOMD__.game.scene.getScene('Recruit');
      return scene.selectors.length === 0 && scene.selected === null && scene.pendingId === null && scene.texts().includes('No invitation is ready. Continue the main story.');
    })).toBe(true);
    expect(problems.filter((problem) => !problem.includes('favicon') && !problem.includes('/api/v1/recruitment/first_oath_invitation'))).toEqual([]);
  } finally {
    expect((await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { headers, data: { releaseId: 'rel_0001' } })).ok()).toBe(true);
  }
});
