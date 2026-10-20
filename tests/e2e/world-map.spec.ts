import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, SHOTS, openGame, signInDev, tap, waitScene } from './helpers';
import { ROOT, publishCampaign } from './stack';

const goto = (page: Page, key: string) => page.evaluate((key) => {
  const game = (window as any).__UOMD__.game;
  game.scene.getScenes(true).forEach((scene: any) => game.scene.stop(scene.key)); game.scene.start(key);
}, key);
const settled = async (page: Page, key: string) => {
  await expect.poll(() => page.evaluate((key) => !(window as any).__UOMD__.game.scene.getScene(key).fading, key)).toBe(true);
  await page.waitForTimeout(150);
};
const texts = (page: Page, key: string): Promise<string[]> => page.evaluate((key) => (window as any).__UOMD__.game.scene.getScene(key)?.texts() ?? [], key);

test('world map hub: chapter 1 open, later chapters locked, a region opens its chapter and BACK returns to the map', async ({ page, request }, info) => {
  test.setTimeout(240_000);
  const id = `rel_map_${info.project.name.replaceAll('-', '_')}`;
  await publishCampaign(process.env.E2E_ADMIN_JWT!, id);
  try {
    const problems = await openGame(page);
    await signInDev(page, `map-${info.project.name}`);
    await page.evaluate(async () => { const u = (window as any).__UOMD__; await u.services.content.checkForUpdates(); await u.services.refreshArt(); });
    await goto(page, 'Home'); await waitScene(page, 'Home');
    await expect.poll(() => texts(page, 'Home')).toContain('CHAPTER 1');
    await settled(page, 'Home');
    const hub = await texts(page, 'Home');
    expect(hub).toEqual(expect.arrayContaining(['CHAPTER 1', 'Open', 'CHAPTER 2', 'Locked', 'SUMMON', 'TRIALS', 'ARCHIVE']));
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-world-map.png` });

    await tap(page, info, 390, 690); // Chapter 1 region
    await waitScene(page, 'Chapters'); await settled(page, 'Chapters');
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-world-map-chapter1.png` });
    await page.keyboard.press('Escape'); // BACK
    await waitScene(page, 'Home');
    expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
  } finally {
    const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
    expect((await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { headers, data: { releaseId: 'rel_0001' } })).ok()).toBe(true);
  }
});

test('patch 1 (Part I Chapter 1 only): the map shows chapter 1 and the rest as coming soon', async ({ page, request }, info) => {
  test.setTimeout(240_000);
  const id = `rel_ch1_${info.project.name.replaceAll('-', '_')}`;
  const dir = `.cache/patches/e2e_ch1_${info.project.name}`;
  execFileSync(process.execPath, [`${ROOT}/node_modules/tsx/dist/cli.mjs`, 'tools/make_chapter_patch.ts', '--chapters', '1', '--out', dir], { cwd: ROOT, stdio: 'inherit' });
  await publishCampaign(process.env.E2E_ADMIN_JWT!, id, dir);
  try {
    const problems = await openGame(page);
    await signInDev(page, `map-ch1-${info.project.name}`);
    await page.evaluate(async () => { const u = (window as any).__UOMD__; await u.services.content.checkForUpdates(); await u.services.refreshArt(); });
    await goto(page, 'Home'); await waitScene(page, 'Home');
    await expect.poll(() => texts(page, 'Home')).toContain('CHAPTER 1');
    await settled(page, 'Home');
    const hub = await texts(page, 'Home');
    expect(hub.filter((t) => t === 'Coming soon')).toHaveLength(6);
    expect(hub).not.toContain('THE RUINED CATHEDRAL OF SAINT LUTHOS'); // later chapter names stay hidden
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-world-map-patch1.png` });
    expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
  } finally {
    const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
    expect((await request.post(`${ADMIN}/admin/api/channels/dev/rollback`, { headers, data: { releaseId: 'rel_0001' } })).ok()).toBe(true);
  }
});
